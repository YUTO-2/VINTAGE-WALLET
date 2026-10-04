import { resolveRecipient } from './ss58';
import type { ChainKey } from './chains';
import { CHAIN_ICONS } from './chainIcons';
import type { CustomChainRecord } from './storage';

// The address book's chain picker. Portaldot is the only built-in chain, and it uses an
// ordinary EVM-style 0x address (the H160 form shown in MetaMask - see the PortaldotV3
// Testnet guide, section 3.2).
export type AddressBookChainKey = ChainKey;

export const ADDRESS_BOOK_CHAIN_ORDER: AddressBookChainKey[] = ['portaldot'];

export const ADDRESS_BOOK_CHAIN_NAMES: Record<AddressBookChainKey, string> = {
  portaldot: 'Portaldot',
};

export const ADDRESS_BOOK_CHAIN_ICONS: Record<AddressBookChainKey, string> = {
  ...CHAIN_ICONS,
};

// A contact/self wallet's `chain` field (see ContactWallet.chain in lib/storage.ts) is kept
// as a plain string precisely so it can also hold `custom:${id}`, pointing at a network the
// person added by hand under 設定 > カスタムEVM (see CustomChainRecord). It isn't part of the
// fixed AddressBookChainKey union above since the set of registered custom chains is
// dynamic, not a fixed list this module can enumerate ahead of time.
export function isCustomAddressBookChain(chain: string): chain is `custom:${string}` {
  return chain.startsWith('custom:');
}

export function findCustomAddressBookChain(chain: string, customChains: CustomChainRecord[]): CustomChainRecord | null {
  if (!isCustomAddressBookChain(chain)) return null;
  const id = chain.slice('custom:'.length);
  return customChains.find((c) => c.id === id) ?? null;
}

// Resolves a wallet's `chain` string to a display name, covering both the fixed
// AddressBookChainKey union and a `custom:${id}` value - falls back to the raw chain string
// if a custom chain was since removed under 設定 > カスタムEVM.
export function addressBookChainName(chain: string, customChains: CustomChainRecord[]): string {
  const custom = findCustomAddressBookChain(chain, customChains);
  if (custom) return custom.name;
  return ADDRESS_BOOK_CHAIN_NAMES[chain as AddressBookChainKey] ?? chain;
}

// Portaldot and every custom chain use EVM-style 0x addresses. An eth-derived SS58 address
// (see lib/ss58.ts) is the same account, so it is accepted too and stored in its 0x form.
export function isValidAddressForChain(_chain: string, address: string): boolean {
  return resolveRecipient(address).ok;
}

export function normalizeAddressForChain(_chain: string, address: string): string {
  const resolved = resolveRecipient(address);
  return resolved.ok ? resolved.address : address.trim();
}
