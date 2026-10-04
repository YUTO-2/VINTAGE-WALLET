import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import i18n from '../i18n';
import { DEFAULT_CHAIN, setNetworkMode as setChainsNetworkMode } from '../lib/chains';
import type { ChainKey, NetworkMode, Balances, TokenBalance } from '../lib/chains';
import { setStorageNetworkMode } from '../lib/storage';
import type { CustomChainRecord } from '../lib/storage';
import type { TransactionWrapper } from '../lib/transactionWrapper';

export type AppLanguage = 'ja' | 'en';

// Colour scheme of the whole app. 'light' (white, the default) or 'dark' (the original look).
export type ThemeMode = 'dark' | 'light';

// Which fiat the Home screen's balance card (and, when it's JPY-pegged JPYC vs. USD-pegged
// USDC that matters, QR Lab's payment-generating screens) is denominated in. 'JPY' (default)
// keeps every existing JPYC-based screen exactly as it was; 'USD' swaps the JPYC-balance slot
// for a USDC balance, converts the total-assets figure to a dollar amount, and - only for QR
// Lab's 指定金額を受け取る / QRレジスター screens - switches the generated payment QR/token
// itself from JPYC to USDC. Nothing else (Send, Receive, Marketplace, ...) reads this.
export type DisplayCurrency = 'JPY' | 'USD';

// Which form of the wallet's own address Home's balance card and the Receive screen show:
// 'h160' = the 0x Ethereum-style address, 'ss58' = the same account in Substrate form.
export type AddressFormat = 'h160' | 'ss58';

// Ported from the Vue app's src/lib/store.ts (Vuex). NEM-era mosaic/message-encryption
// state (sendMosaics, sendMessage, usesMessageEncryption, receiverPublicKey) was already
// dropped during the EVM migration and isn't carried over here.
interface AppState {
  calculatorFormula: string;
  calculatorValue: number;
  receiverAddress: string;
  // Set by AddressBookList when opened in "pick" mode (from Send's address-book button)
  // and read back by Send once it navigates back — deliberately not persisted (see
  // partialize below), it's a one-shot handoff between those two screens only.
  pickedContactAddress: string;
  backPathFromWalletSelect: string;
  backPathFromSendConfirmation: string;
  transaction: TransactionWrapper | null;
  // Cache of TransactionList's last successful fetch (grouped-by-date transactions + the
  // address-book name lookup for each sender/receiver), so navigating away and back shows
  // the previous result instantly instead of a blank spinner - see TransactionList.tsx,
  // which reads this on mount, renders it immediately if present, then kicks off a fresh
  // background fetch that overwrites it (and the on-screen list) once it resolves.
  // Deliberately NOT persisted (see partialize below): it should reset on reload, same as
  // `transaction` above.
  transactionListCache: { grouped: Record<string, TransactionWrapper[]>; peerNames: Record<string, string> } | null;
  // Same idea as transactionListCache above, but for pages/detail/Balance.tsx (the トークン
  // tab): every chain's balance/token rows plus any custom EVM
  // chains' balances, so returning to that screen also renders instantly from the last
  // fetch instead of a blank spinner, then gets refreshed in the background. Keyed by the
  // networkMode it was fetched under (see Balance.tsx's fetchAll, which depends on it) so
  // a mainnet/testnet toggle doesn't show stale balances from the other mode while the
  // fresh fetch is still in flight. Deliberately NOT persisted (see partialize below).
  balanceCache: {
    networkMode: NetworkMode;
    balances: Record<ChainKey, Balances & { tokens: TokenBalance[] }>;
    customAddresses: Record<ChainKey, Set<string>>;
    customChains: CustomChainRecord[];
    customChainStates: Record<string, Balances & { tokens: TokenBalance[] }>;
  } | null;
  // Which chain balances, sends and history apply to. Portaldot is the only one (see
  // lib/chains.ts); the field is kept so existing screens keep reading it unchanged.
  activeChain: ChainKey;
  // Kept for the existing storage/chain plumbing. Portaldot only has a testnet, so both
  // values resolve to the same PortaldotV3 Testnet config (see lib/chains.ts).
  networkMode: NetworkMode;
  // UI/display language. 'ja' (default) or 'en'. Drives i18n directly (see setLanguage) -
  // kept in this persisted store, rather than only in i18next's own cache, so every other
  // piece of state that depends on it (see AppLanguage usages) can react to it the same way
  // it reacts to networkMode.
  language: AppLanguage;
  // White (default) / dark colour scheme chosen in 設定 > テーマ. Persisted; main.tsx builds the MUI theme from it.
  themeMode: ThemeMode;
  // See DisplayCurrency above. Persisted like language/networkMode, since it's a standing
  // display preference rather than per-screen transient state.
  displayCurrency: DisplayCurrency;
  // See AddressFormat above. Persisted; shared by Home and Receive so both show the same form.
  addressFormat: AddressFormat;
  // Which token the current send flow is sending: the chain's native coin (tPOTv3), JPYC
  // (not deployed on Portaldot), or an arbitrary ERC-20 token's contract
  // address (in which case sendTokenMeta below holds its symbol/decimals/known balance).
  sendCurrency: string;
  sendTokenMeta: { address: string; symbol: string; decimals: number } | null;
  // Set alongside sendCurrency/sendTokenMeta when the asset being sent lives on a network
  // added by hand under 設定 > カスタムEVM (see CustomChainRecord in lib/storage.ts) rather
  // than one of CHAINS's curated chains - holds that CustomChainRecord's id. null for an
  // ordinary curated-chain send (the common case). activeChain's own ChainKey type can't
  // express a hand-added chain, so SendAmount/SendConfirmation check this field first and
  // fall back to activeChain + CHAINS only when it's null.
  sendCustomChainId: string | null;
  // Transaction hash of the most recently broadcast send, shown/linked on SendComplete.
  lastTxHash: string;

  setCalculatorFormula: (value: string) => void;
  appendCalculatorFormula: (value: string) => void;
  dropCalculatorFormula: () => void;
  clearCalculatorFormula: () => void;
  setCalculatorValue: (value: number) => void;
  setReceiverAddress: (address: string) => void;
  clearReceiverAddress: () => void;
  setPickedContactAddress: (address: string) => void;
  setBackPathFromWalletSelect: (path: string) => void;
  setBackPathFromSendConfirmation: (path: string) => void;
  setTransaction: (transaction: TransactionWrapper) => void;
  setTransactionListCache: (cache: { grouped: Record<string, TransactionWrapper[]>; peerNames: Record<string, string> }) => void;
  setBalanceCache: (cache: {
    networkMode: NetworkMode;
    balances: Record<ChainKey, Balances & { tokens: TokenBalance[] }>;
    customAddresses: Record<ChainKey, Set<string>>;
    customChains: CustomChainRecord[];
    customChainStates: Record<string, Balances & { tokens: TokenBalance[] }>;
  }) => void;
  setActiveChain: (chain: ChainKey) => void;
  setNetworkMode: (mode: NetworkMode) => void;
  setLanguage: (language: AppLanguage) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
  setAddressFormat: (format: AddressFormat) => void;
  setSendCurrency: (currency: string) => void;
  setSendTokenMeta: (meta: { address: string; symbol: string; decimals: number } | null) => void;
  setSendCustomChainId: (id: string | null) => void;
  setLastTxHash: (hash: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      calculatorFormula: '0',
      calculatorValue: 0,
      receiverAddress: '',
      pickedContactAddress: '',
      backPathFromWalletSelect: '',
      backPathFromSendConfirmation: '',
      transaction: null,
      transactionListCache: null,
      balanceCache: null,
      activeChain: DEFAULT_CHAIN,
      networkMode: 'mainnet',
      language: 'ja',
      themeMode: 'light',
      displayCurrency: 'JPY',
      addressFormat: 'h160',
      sendCurrency: 'native',
      sendTokenMeta: null,
      sendCustomChainId: null,
      lastTxHash: '',

      setCalculatorFormula: (value) => set({ calculatorFormula: value }),
      appendCalculatorFormula: (value) => set((state) => ({
        calculatorFormula: (state.calculatorFormula === '0' && isFinite(Number(value)))
          ? value
          : state.calculatorFormula + value,
      })),
      dropCalculatorFormula: () => set((state) => ({
        calculatorFormula: state.calculatorFormula.length <= 1
          ? '0'
          : state.calculatorFormula.slice(0, -1),
      })),
      clearCalculatorFormula: () => set({ calculatorFormula: '0' }),
      setCalculatorValue: (value) => set({ calculatorValue: value }),
      setReceiverAddress: (address) => set({ receiverAddress: address }),
      clearReceiverAddress: () => set({ receiverAddress: '' }),
      setPickedContactAddress: (address) => set({ pickedContactAddress: address }),
      setBackPathFromWalletSelect: (path) => set({ backPathFromWalletSelect: path }),
      setBackPathFromSendConfirmation: (path) => set({ backPathFromSendConfirmation: path }),
      setTransaction: (transaction) => set({ transaction }),
      setTransactionListCache: (cache) => set({ transactionListCache: cache }),
      setBalanceCache: (cache) => set({ balanceCache: cache }),
      setActiveChain: (chain) => set({ activeChain: chain }),
      setNetworkMode: (mode) => {
        setChainsNetworkMode(mode);
        setStorageNetworkMode(mode);
        set({ networkMode: mode });
      },
      setLanguage: (language) => {
        i18n.changeLanguage(language);
        set({ language });
      },
      setThemeMode: (themeMode) => set({ themeMode }),
      setDisplayCurrency: (currency) => set({ displayCurrency: currency }),
      setAddressFormat: (addressFormat) => set({ addressFormat }),
      setSendCurrency: (currency) => set({ sendCurrency: currency }),
      setSendTokenMeta: (meta) => set({ sendTokenMeta: meta }),
      setSendCustomChainId: (id) => set({ sendCustomChainId: id }),
      setLastTxHash: (hash) => set({ lastTxHash: hash }),
    }),
    {
      name: 'raccoon-wallet-app-store',
      // v1: the default theme became white. Anyone who already has a stored 'dark' from the
      // first build (where dark was the default and got persisted with the rest of the state)
      // is reset to the new default once; their later choice in 設定 > テーマ is kept.
      version: 1,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        if (version < 1) {
          state.themeMode = 'light';
        }
        return state as unknown as AppState;
      },
      storage: createJSONStorage(() => localStorage),
      // transaction/calculator state is transient per-session; only persist what the
      // Vuex version persisted via vuex-persistedstate (everything except the live
      // in-progress transaction object, which doesn't need to survive a reload).
      partialize: (state) => ({
        activeChain: state.activeChain,
        networkMode: state.networkMode,
        language: state.language,
        themeMode: state.themeMode,
        displayCurrency: state.displayCurrency,
        addressFormat: state.addressFormat,
        sendCurrency: state.sendCurrency,
        sendCustomChainId: state.sendCustomChainId,
      }),
      // localStorage is the single source of truth for networkMode/language, but chains.ts,
      // storage.ts and i18next each keep their own module-level copy (so plain
      // functions/components that aren't reading this store directly still see the right
      // value). Sync all three once the persisted values are loaded, so a reload doesn't
      // silently fall back to mainnet chains/addresses or Japanese.
      onRehydrateStorage: () => (state) => {
        if (state?.networkMode) {
          setChainsNetworkMode(state.networkMode);
          setStorageNetworkMode(state.networkMode);
        }
        if (state?.language) {
          i18n.changeLanguage(state.language);
        }
      },
    }
  )
);
