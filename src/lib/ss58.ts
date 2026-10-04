import { ethers } from 'ethers';
import { blake2b } from '@noble/hashes/blake2.js';

/**
 * SS58 (Substrate) address support.
 *
 * Portaldot is a Substrate chain whose EVM layer is pallet-revive. This wallet signs with
 * an Ethereum (secp256k1) key and talks to the chain over the Ethereum JSON-RPC, so the
 * only on-chain identity it controls is the 20-byte `0x` address. pallet-revive maps that
 * to a 32-byte native AccountId by appending twelve 0xEE bytes ("eth-derived" account):
 *
 *   AccountId32 = <20-byte H160> ++ 0xEE * 12
 *
 * which means an eth-derived SS58 address and the 0x address are the same account and can
 * be converted losslessly in both directions - that is what this file does.
 *
 * An SS58 address whose account id does NOT end in 0xEE*12 belongs to a regular Substrate
 * key (sr25519 / ed25519). Its EVM-side address is a hash of the key, and the Ethereum RPC
 * only credits the real account if that account ran `Revive.map_account` beforehand;
 * otherwise the value lands in an unreachable 0xEE-suffixed fallback account. Sending to
 * such an address through this wallet could therefore lose funds, so it is rejected.
 */

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const SS58_PREFIX_BYTES = new TextEncoder().encode('SS58PRE');
const ETH_SUFFIX_BYTE = 0xee;

/** Generic Substrate prefix (addresses start with "5"). Used when showing our own address. */
export const DEFAULT_SS58_PREFIX = 42;

function base58Decode(input: string): Uint8Array | null {
  let value = 0n;
  for (const ch of input) {
    const digit = B58_ALPHABET.indexOf(ch);
    if (digit < 0) return null;
    value = value * 58n + BigInt(digit);
  }
  const bytes: number[] = [];
  while (value > 0n) {
    bytes.push(Number(value & 0xffn));
    value >>= 8n;
  }
  // Each leading '1' stands for one leading zero byte.
  for (const ch of input) {
    if (ch !== '1') break;
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}

function base58Encode(bytes: Uint8Array): string {
  let value = 0n;
  for (const b of bytes) value = (value << 8n) | BigInt(b);
  let out = '';
  while (value > 0n) {
    out = B58_ALPHABET[Number(value % 58n)] + out;
    value /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = '1' + out;
  }
  return out;
}

function checksum(payload: Uint8Array): Uint8Array {
  const data = new Uint8Array(SS58_PREFIX_BYTES.length + payload.length);
  data.set(SS58_PREFIX_BYTES, 0);
  data.set(payload, SS58_PREFIX_BYTES.length);
  return blake2b(data, { dkLen: 64 }).slice(0, 2);
}

export interface DecodedSs58 {
  prefix: number;
  accountId: Uint8Array; // 32 bytes
}

/** Decodes a 32-byte-account SS58 address and verifies its checksum. Null if invalid. */
export function decodeSs58(address: string): DecodedSs58 | null {
  const raw = base58Decode(address.trim());
  if (raw === null) return null;

  let prefix: number;
  let prefixLen: number;
  if (raw.length === 35) {
    // Simple prefix (0-63): 1 byte.
    if (raw[0] >= 64) return null;
    prefix = raw[0];
    prefixLen = 1;
  } else if (raw.length === 36) {
    // Two-byte prefix (64-16383).
    const first = raw[0];
    if ((first & 0b11000000) !== 0b01000000) return null;
    const second = raw[1];
    prefix = ((first & 0b00111111) << 2) | (second >> 6) | ((second & 0b00111111) << 8);
    prefixLen = 2;
  } else {
    return null;
  }

  const payload = raw.slice(0, prefixLen + 32);
  const expected = checksum(payload);
  if (raw[prefixLen + 32] !== expected[0] || raw[prefixLen + 33] !== expected[1]) return null;
  return { prefix, accountId: raw.slice(prefixLen, prefixLen + 32) };
}

/** Encodes a 32-byte account id as an SS58 string (prefix 0-63 only, which covers 42). */
export function encodeSs58(accountId: Uint8Array, prefix: number = DEFAULT_SS58_PREFIX): string {
  if (accountId.length !== 32) throw new Error('invalid_account_id');
  if (!Number.isInteger(prefix) || prefix < 0 || prefix >= 64) throw new Error('unsupported_ss58_prefix');
  const payload = new Uint8Array(33);
  payload[0] = prefix;
  payload.set(accountId, 1);
  const full = new Uint8Array(35);
  full.set(payload, 0);
  full.set(checksum(payload), 33);
  return base58Encode(full);
}

/** `0x…` (20 bytes) -> the eth-derived SS58 address (H160 ++ 0xEE*12). Null if not a valid address. */
export function evmToSs58(address: string, prefix: number = DEFAULT_SS58_PREFIX): string | null {
  if (!ethers.isAddress(address)) return null;
  const accountId = new Uint8Array(32).fill(ETH_SUFFIX_BYTE);
  accountId.set(ethers.getBytes(address), 0);
  return encodeSs58(accountId, prefix);
}

export function isSs58Address(value: string): boolean {
  return decodeSs58(value) !== null;
}

export type ResolveRecipientResult =
  | { ok: true; address: string; fromSs58: boolean }
  | { ok: false; reason: 'invalid' | 'ss58_not_eth_derived' };

/**
 * Turns whatever the person typed/scanned into the `0x` address used for the actual
 * transfer. Accepts a plain EVM address or an SS58 address (any prefix) whose account id
 * is eth-derived; see the file header for why other SS58 addresses are refused.
 */
export function resolveRecipient(input: string): ResolveRecipientResult {
  const trimmed = input.trim();
  if (ethers.isAddress(trimmed)) {
    return { ok: true, address: trimmed, fromSs58: false };
  }
  const decoded = decodeSs58(trimmed);
  if (decoded === null) return { ok: false, reason: 'invalid' };

  const tail = decoded.accountId.slice(20);
  if (!tail.every((b) => b === ETH_SUFFIX_BYTE)) {
    return { ok: false, reason: 'ss58_not_eth_derived' };
  }
  return { ok: true, address: ethers.getAddress(ethers.hexlify(decoded.accountId.slice(0, 20))), fromSs58: true };
}
