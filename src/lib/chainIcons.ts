import type { ChainKey } from './chains';
import iconPortaldot from '../assets/icon_chain_portaldot.svg';

// Small per-network logo shown next to a transaction row. Portaldot is the only network this
// wallet supports, so there is a single entry.
export const CHAIN_ICONS: Record<ChainKey, string> = {
  portaldot: iconPortaldot,
};
