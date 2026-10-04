import { ethers } from 'ethers';
import {
  CHAINS, getProvider, getGasOverrides, signAndSend, walkChunkedRange, withRpcFallback,
} from './chains';
import type { ChainKey } from './chains';

/**
 * ERC-721 support for Portaldot's EVM layer (pallet-revive, reached through the Ethereum
 * JSON-RPC endpoint).
 *
 * NOTE: this covers NFT *contracts written in Solidity* (ERC-721). The chain's native NFT
 * pallets (`Uniques` / `Nfts`, README section 2.2 / 2.3) live on the Substrate side and are
 * not visible through the Ethereum RPC, so they are NOT supported by this wallet.
 *
 * There is no indexer, so "which NFTs does this address own" cannot be asked of the chain
 * directly. Instead the wallet (a) enumerates through ERC721Enumerable when the contract
 * supports it, (b) otherwise scans recent Transfer logs, and (c) always lets the person add a
 * specific token id by hand. Ownership of every remembered NFT is re-checked with ownerOf().
 */

export const ERC721_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

const ERC721_INTERFACE_ID = '0x80ac58cd';
const ERC721_ENUMERABLE_INTERFACE_ID = '0x780e9d63';
const ERC721_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

// Upper bound on how many tokens one "discover" pass registers, so a whale-sized collection
// cannot turn a single tap into hundreds of RPC calls.
const MAX_DISCOVERED_TOKENS = 50;
// Same bounded-history trade-off the ERC-20 transfer scan makes (see lib/chains.ts).
const LOG_SCAN_MAX_WINDOWS = 40;

export interface NftCollectionInfo {
  address: string; // checksummed
  name: string;
  symbol: string;
}

export interface NftMetadata {
  name?: string;
  description?: string;
  image?: string; // already resolved to something an <img> can load
}

/** Reads name/symbol and checks the address really is an ERC-721 contract. */
export async function fetchNftCollectionInfo(chain: ChainKey, address: string): Promise<NftCollectionInfo> {
  if (!ethers.isAddress(address)) throw new Error('invalid_address');
  const checksummed = ethers.getAddress(address);
  const contract = new ethers.Contract(checksummed, ERC721_ABI, getProvider(chain));

  // ERC-165 says whether this is an ERC-721. A few older contracts do not implement ERC-165
  // at all (the call reverts) - those are given the benefit of the doubt here and are
  // validated by the ownerOf() check when a token is actually added. Only an explicit
  // "false" is rejected.
  try {
    const isErc721 = await (contract.supportsInterface(ERC721_INTERFACE_ID) as Promise<boolean>);
    if (!isErc721) throw new Error('not_erc721');
  } catch (e) {
    if (e instanceof Error && e.message === 'not_erc721') throw e;
  }

  let name = '';
  let symbol = '';
  try { name = await (contract.name() as Promise<string>); } catch { /* optional in the standard */ }
  try { symbol = await (contract.symbol() as Promise<string>); } catch { /* optional in the standard */ }
  return { address: checksummed, name: name || symbol || 'NFT', symbol: symbol || 'NFT' };
}

/**
 * true = `owner` owns the token, false = someone else does, null = could not tell (RPC
 * failure). A revert from ownerOf() (nonexistent / burned token) counts as false only when
 * the node answered, which is why a transient network error maps to null instead.
 */
export async function verifyNftOwner(chain: ChainKey, collection: string, tokenId: string, owner: string): Promise<boolean | null> {
  try {
    const current = await withRpcFallback(chain, (provider) => {
      const contract = new ethers.Contract(collection, ERC721_ABI, provider);
      return contract.ownerOf(BigInt(tokenId)) as Promise<string>;
    });
    return current.toLowerCase() === owner.toLowerCase();
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    // CALL_EXCEPTION = the contract itself reverted (token does not exist / was burned).
    return code === 'CALL_EXCEPTION' ? false : null;
  }
}

/**
 * Best-effort discovery of the token ids `owner` holds in one collection.
 * 1) ERC721Enumerable: exact and cheap. 2) Otherwise: scan recent Transfer(to=owner) logs and
 * keep the ids ownerOf() confirms are still held. (2) only sees a bounded recent window - a
 * token received long ago is found by entering its id by hand instead.
 */
export async function discoverOwnedTokenIds(chain: ChainKey, collection: string, owner: string): Promise<string[]> {
  const provider = getProvider(chain);
  const contract = new ethers.Contract(collection, ERC721_ABI, provider);

  let enumerable = false;
  try {
    enumerable = await (contract.supportsInterface(ERC721_ENUMERABLE_INTERFACE_ID) as Promise<boolean>);
  } catch { /* no ERC-165 - fall through to the log scan */ }

  if (enumerable) {
    try {
      const count = Number(await (contract.balanceOf(owner) as Promise<bigint>));
      const n = Math.min(count, MAX_DISCOVERED_TOKENS);
      const ids = await Promise.all(
        Array.from({ length: n }, (_, i) => contract.tokenOfOwnerByIndex(owner, i) as Promise<bigint>),
      );
      return ids.map((id) => id.toString());
    } catch (e) {
      console.warn('ERC721Enumerable lookup failed, falling back to log scan', e);
    }
  }

  try {
    const padded = ethers.zeroPadValue(owner, 32);
    const tip = await withRpcFallback(chain, (p) => p.getBlockNumber());
    const { items } = await walkChunkedRange<string>(
      0,
      tip,
      async (fromBlock, toBlock) => {
        const logs = await withRpcFallback(chain, (p) => p.getLogs({
          address: collection,
          topics: [ERC721_TRANSFER_TOPIC, null, padded],
          fromBlock,
          toBlock,
        }));
        // ERC-20 and ERC-721 share the same Transfer signature hash; only the ERC-721 form
        // carries the token id as a 4th (indexed) topic.
        return logs.filter((l) => l.topics.length === 4).map((l) => BigInt(l.topics[3]).toString());
      },
      (found) => new Set(found).size >= MAX_DISCOVERED_TOKENS,
      LOG_SCAN_MAX_WINDOWS,
    );
    const candidates = [...new Set(items)].slice(0, MAX_DISCOVERED_TOKENS);
    const checks = await Promise.all(candidates.map(async (id) => ({ id, own: await verifyNftOwner(chain, collection, id, owner) })));
    return checks.filter((c) => c.own === true).map((c) => c.id);
  } catch (e) {
    console.warn('ERC-721 transfer-log scan failed', e);
    return [];
  }
}

/** Route of the detail screen for one NFT: /nft/detail?c=<contract>&id=<tokenId> */
export function nftDetailPath(nft: { address: string; tokenId: string }): string {
  return `/nft/detail?c=${nft.address}&id=${nft.tokenId}`;
}

// --- Metadata -------------------------------------------------------------------------

const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';
const METADATA_TIMEOUT_MS = 8000;
const metadataCache = new Map<string, NftMetadata>();

/** ipfs:// -> public gateway URL. Other schemes pass through unchanged. */
export function resolveNftUri(uri: string): string {
  const trimmed = uri.trim();
  if (trimmed.startsWith('ipfs://ipfs/')) return IPFS_GATEWAY + trimmed.slice('ipfs://ipfs/'.length);
  if (trimmed.startsWith('ipfs://')) return IPFS_GATEWAY + trimmed.slice('ipfs://'.length);
  return trimmed;
}

async function readJsonFromUri(uri: string): Promise<unknown> {
  // data:application/json;base64,... / data:application/json;utf8,... / data:application/json,...
  if (uri.startsWith('data:')) {
    const comma = uri.indexOf(',');
    if (comma < 0) throw new Error('bad_data_uri');
    const head = uri.slice(5, comma);
    const body = uri.slice(comma + 1);
    if (head.includes(';base64')) {
      const bytes = Uint8Array.from(atob(body), (ch) => ch.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    }
    return JSON.parse(decodeURIComponent(body));
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS);
  try {
    const res = await fetch(resolveNftUri(uri), { signal: controller.signal });
    if (!res.ok) throw new Error(`metadata_http_${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * tokenURI -> JSON -> { name, description, image }. Never throws: a missing/slow/CORS-blocked
 * metadata host just yields {} and the UI falls back to a placeholder tile showing "#<id>".
 * Only http(s)/ipfs/data image URLs are passed on to <img>, so a hostile contract cannot
 * smuggle in a javascript: URL.
 */
export async function fetchNftMetadata(chain: ChainKey, collection: string, tokenId: string): Promise<NftMetadata> {
  const key = `${chain}:${collection.toLowerCase()}:${tokenId}`;
  const cached = metadataCache.get(key);
  if (cached) return cached;

  let result: NftMetadata = {};
  try {
    const contract = new ethers.Contract(collection, ERC721_ABI, getProvider(chain));
    const uri = await (contract.tokenURI(BigInt(tokenId)) as Promise<string>);
    const json = await readJsonFromUri(uri) as { name?: unknown; description?: unknown; image?: unknown; image_url?: unknown };
    const rawImage = typeof json.image === 'string' ? json.image : typeof json.image_url === 'string' ? json.image_url : undefined;
    const image = rawImage ? resolveNftUri(rawImage) : undefined;
    result = {
      name: typeof json.name === 'string' ? json.name : undefined,
      description: typeof json.description === 'string' ? json.description : undefined,
      image: image && /^(https?:|data:image\/)/i.test(image) ? image : undefined,
    };
  } catch (e) {
    console.warn(`Failed to load NFT metadata for ${collection} #${tokenId}`, e);
  }
  metadataCache.set(key, result);
  return result;
}

// --- Transfer -------------------------------------------------------------------------

/** Sends one ERC-721 token via safeTransferFrom, using the same fee policy as other sends. */
export async function sendErc721(
  chain: ChainKey,
  privateKey: string,
  collection: string,
  to: string,
  tokenId: string,
) {
  const provider = getProvider(chain);
  const signer = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(collection, ERC721_ABI, signer);
  const id = BigInt(tokenId);

  const gasOverrides = await getGasOverrides(chain, provider);
  const data = contract.interface.encodeFunctionData('safeTransferFrom', [signer.address, to, id]);
  const gasLimit = await contract.safeTransferFrom.estimateGas(signer.address, to, id, gasOverrides);
  const nonce = await signer.getNonce('pending');
  const tx = await signAndSend(chain, signer, {
    ...gasOverrides,
    to: collection,
    data,
    nonce,
    gasLimit,
    chainId: CHAINS[chain].chainId,
  });
  return tx.wait();
}
