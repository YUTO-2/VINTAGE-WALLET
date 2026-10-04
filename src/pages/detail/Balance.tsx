import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Card, Typography, Button, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton, Alert, Avatar, Menu, MenuItem, Select,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import EthereumSilhouetteIcon from '../../components/EthereumSilhouetteIcon';
import {
  CHAINS, TOKEN_LISTS, fetchBalances, fetchTokenBalances, fetchTokenMetadata,
} from '../../lib/chains';
import type { ChainKey, Balances, TokenBalance } from '../../lib/chains';
import { WalletsHelper, CustomTokensHelper } from '../../lib/storage';
import { useAppStore } from '../../store/appStore';
import { CHAIN_ICONS } from '../../lib/chainIcons';
import { getTokenIcon } from '../../lib/tokenIcons';

// Price data (jpyRate) has been dropped from this shape entirely - see the note above
// fetchAll below for why the "held amount" price line was removed from this screen.
type ChainBalanceState = Balances & { tokens: TokenBalance[] };

// Curated tokens that are always shown as their own row even at a zero balance. Portaldot
// has no curated token list yet, so this is empty; tokens are added by contract address.
const ALWAYS_SHOWN_TOKEN_SYMBOLS: Partial<Record<ChainKey, string[]>> = {};

// Filter/grouping key for the network-picker menu and the "add token" dialog's chain
// select. Portaldot is the only chain, so this is effectively 'all' or 'portaldot'.
type FilterKey = 'all' | ChainKey;

// One row of the flat asset list below - a native currency, a held ERC-20 token, or a
// custom chain's balance - normalized to a single shape so they can all render through
// the same <AssetRow>, mirroring how a MetaMask-style token list shows every asset (across
// every network) as one continuous list rather than grouped, per-network cards.
interface AssetRow {
  id: string;
  filterKey: FilterKey;
  // Undefined for a custom token with no curated/CoinGecko icon - Avatar then falls back
  // to the symbol-initial child below instead of showing a chain icon that could be
  // mistaken for the token's own logo (see the comment on the Avatar below).
  icon?: string;
  // 未設定(icon省略時)のカスタムEVMネイティブ通貨に、文字イニシャルの代わりに
  // イーサリアムのシルエットアイコンを出すためのフラグ。
  iconIsEthFallback?: boolean;
  // Small network-logo overlay in the icon's bottom-right corner, shown only for assets
  // that can exist on more than one chain (tokens) - a native currency IS its own
  // network identity, so it gets no badge.
  badgeIcon?: string;
  // カスタムEVMチェーンに独自アイコンが設定されていない場合、バッジもイーサリアムの
  // シルエットで表示する(badgeIconは未設定のまま)。
  badgeIsEthFallback?: boolean;
  name: string;
  symbol: string;
  amount: string;
  onSend: () => void;
  onRemove?: () => void;
}

function AssetRowItem({ row }: { row: AssetRow }) {
  return (
    <Box
      onClick={row.onSend}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, cursor: 'pointer',
        borderTop: '0.5px solid', borderColor: 'divider',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box sx={{ position: 'relative', flexShrink: 0 }}>
        {/* Most rows' icons are bundled assets that never fail to load, and several of
            those PNGs have transparent corners (Kaia/Avalanche/USDT/USDC/Symbol/NEM) - so
            the avatar backing is always plain white, letting only the logo mark itself
            show its own color rather than a per-symbol tinted circle behind it. A custom
            token's icon can instead be a remote CoinGecko URL (see lib/chains.ts's
            fetchTokenIconUrl) that may fail to load, or be omitted entirely when neither
            CoinGecko nor the curated set has it (row.icon is undefined then, by design -
            see the icon: computation below) - Avatar falls back to the symbol-initial
            child in both cases. MUI's no-image fallback defaults the text color to
            theme.palette.background.default (white in this app's light theme), which read
            as invisible white-on-white against the bgcolor override below - so the text
            color needs its own explicit override too, not just the background. A custom-
            EVM native currency with no user-picked icon (iconIsEthFallback) gets the grey
            Ethereum silhouette instead of a plain letter. */}
        <Avatar
          src={row.icon}
          sx={{
            width: 40, height: 40,
            bgcolor: row.iconIsEthFallback ? 'grey.200' : '#fff',
            color: 'text.primary',
          }}
        >
          {row.iconIsEthFallback ? <EthereumSilhouetteIcon size={20} /> : row.symbol.slice(0, 1)}
        </Avatar>
        {row.badgeIsEthFallback ? (
          <Box
            sx={{
              position: 'absolute', right: -2, bottom: -2, width: 18, height: 18,
              borderRadius: '50%', border: '2px solid', borderColor: 'background.paper',
              bgcolor: 'grey.200', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <EthereumSilhouetteIcon size={9} />
          </Box>
        ) : row.badgeIcon && (
          <Box
            component="img"
            src={row.badgeIcon}
            sx={{
              position: 'absolute', right: -2, bottom: -2, width: 18, height: 18,
              borderRadius: '50%', border: '2px solid', borderColor: 'background.paper',
            }}
          />
        )}
      </Box>

      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography noWrap sx={{ fontWeight: 'bold' }}>{row.name}</Typography>
        </Box>
        <Typography sx={{ color: '#929292', fontSize: 12 }}>{row.amount} {row.symbol}</Typography>
      </Box>

      {row.onRemove && (
        <IconButton
          size="small"
          aria-label="remove"
          onClick={(e) => { e.stopPropagation(); row.onRemove?.(); }}
        >
          <CloseIcon fontSize="small" sx={{ color: '#929292' }} />
        </IconButton>
      )}
    </Box>
  );
}

export default function Balance() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setActiveChain = useAppStore((s) => s.setActiveChain);
  const setSendCurrency = useAppStore((s) => s.setSendCurrency);
  const setSendTokenMeta = useAppStore((s) => s.setSendTokenMeta);
  const clearReceiverAddress = useAppStore((s) => s.clearReceiverAddress);
  // Re-read on every render (not hoisted to module scope) so a debug-mode toggle is
  // reflected immediately next time this screen renders, instead of being frozen at
  // whatever CHAINS resolved to the first time this module was loaded.
  const networkMode = useAppStore((s) => s.networkMode);
  const balanceCache = useAppStore((s) => s.balanceCache);
  const setBalanceCache = useAppStore((s) => s.setBalanceCache);
  // Cache only counts if it was fetched under the network mode currently in effect - a
  // mainnet/testnet toggle shouldn't briefly show the other mode's stale balances (see
  // appStore.ts's balanceCache doc comment).
  const cachedForCurrentMode = balanceCache?.networkMode === networkMode ? balanceCache : null;
  const chains = Object.keys(CHAINS).map((key) => CHAINS[key as ChainKey]);

  // Seed from the cached result of the previous visit (if any, and if fetched under the
  // same networkMode) so returning to this screen shows the last-known balances instantly
  // instead of a blank spinner. The background refetch in fetchAll below (which always
  // runs, regardless of whether a cache existed) then replaces both this state and the
  // store cache once fresh data arrives, so anything that changed on-chain since the last
  // visit still shows up "in real time" - just without the loading flash.
  const [loading, setLoading] = useState(cachedForCurrentMode == null);
  // Every chain's balance (native + JPYC + any known ERC-20 token held, plus tokens the
  // person registered by hand below), fetched and shown together - no network picker
  // gating what's visible.
  const [balances, setBalances] = useState<Record<ChainKey, ChainBalanceState>>(
    cachedForCurrentMode?.balances ?? ({} as Record<ChainKey, ChainBalanceState>),
  );
  // Contract addresses (lowercased) the person has manually registered per chain, so the
  // token rows below know which ones to offer a remove button on.
  const [customAddresses, setCustomAddresses] = useState<Record<ChainKey, Set<string>>>(
    cachedForCurrentMode?.customAddresses ?? ({} as Record<ChainKey, Set<string>>),
  );

  const fetchAll = useCallback(async () => {
    const activeWallet = await WalletsHelper.getActive();
    if (activeWallet == null) {
      setLoading(false);
      return;
    }
    // Only show the spinner when there's nothing cached for this networkMode to display
    // yet - if a previous result is already on screen, this fetch happens quietly in the
    // background and simply swaps the balances once it resolves (see balanceCache in
    // appStore.ts), rather than hiding the existing content behind a spinner every time
    // this screen is opened. Read straight from the store rather than the cachedForCurrentMode
    // closure above so a networkMode change right before this runs is picked up correctly.
    if (useAppStore.getState().balanceCache?.networkMode !== networkMode) {
      setLoading(true);
    }
    try {
      // This screen no longer shows a JPY/USD price next to each balance - it was backed
      // by a client-side call straight to CoinGecko's free/keyless API, which is rate-
      // limited to roughly 5-15 requests/minute and had no reliable way around that from
      // inside the browser (CoinMarketCap, the other option considered, blocks browser
      // calls outright via CORS to protect its API key and requires a backend proxy this
      // app doesn't have). Several rounds of consolidating requests and decoupling the
      // price fetch from the balance fetch narrowed the failure but never eliminated it,
      // so rather than continuing to show an unreliable number, this screen now shows
      // only the amount held for every asset, same as before but without a price column.
      const [entries] = await Promise.all([
        Promise.all(chains.map(async (chain) => {
          const customTokens = await CustomTokensHelper.list(chain.key);
          const [chainBalances, tokens] = await Promise.all([
            fetchBalances(chain.key, activeWallet.address),
            fetchTokenBalances(chain.key, activeWallet.address, customTokens),
          ]);
          return {
            key: chain.key,
            chainBalances,
            tokens,
            customSet: new Set(customTokens.map((t) => t.address.toLowerCase())),
          };
        })),
      ]);
      setBalances(Object.fromEntries(entries.map((e) => [
        e.key,
        { ...e.chainBalances, tokens: e.tokens } as ChainBalanceState,
      ])) as Record<ChainKey, ChainBalanceState>);
      setCustomAddresses(Object.fromEntries(entries.map((e) => [e.key, e.customSet])) as Record<ChainKey, Set<string>>);
      const resolvedBalances = Object.fromEntries(entries.map((e) => [
        e.key,
        { ...e.chainBalances, tokens: e.tokens } as ChainBalanceState,
      ])) as Record<ChainKey, ChainBalanceState>;
      const resolvedCustomAddresses = Object.fromEntries(entries.map((e) => [e.key, e.customSet])) as Record<ChainKey, Set<string>>;

      // Save this fetch's result so the next time this screen is opened (without a full
      // reload) it can render immediately from cache while a fresh fetch runs underneath.
      setBalanceCache({
        networkMode,
        balances: resolvedBalances,
        customAddresses: resolvedCustomAddresses,
        customChains: [],
        customChainStates: {},
      });
    } catch (e) {
      console.error('Failed to fetch balances', e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkMode]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Jumps into the destination-entry step (the Send tab) rather than straight into
  // /send/amount - receiverAddress is only ever set there (see pages/top/Send.tsx), so
  // skipping it left the previous/empty address in place and produced an
  // "invalid hexlify value" on estimateGas once send actually tried to broadcast to "".
  // Clearing it first also stops a stale address from a previous send silently carrying
  // over to this one.
  const onSendJpycOrNative = (chain: ChainKey, currency: 'jpyc' | 'native') => {
    setActiveChain(chain);
    setSendCurrency(currency);
    setSendTokenMeta(null);
    clearReceiverAddress();
    navigate('/top?tab=send');
  };

  const onSendToken = (chain: ChainKey, token: TokenBalance) => {
    setActiveChain(chain);
    setSendCurrency(token.address);
    setSendTokenMeta({ address: token.address, symbol: token.symbol, decimals: token.decimals });
    clearReceiverAddress();
    navigate('/top?tab=send');
  };

  // --- Add-custom-token dialog --------------------------------------------------------
  //
  // JPYC/USDT/native/USDC etc. come from the curated list in lib/chains.ts, so any other
  // token (a new airdrop, a niche project, something region-specific) simply never shows
  // up - there's no way to ask a plain RPC node "list every token this address holds"
  // without a paid indexer. This dialog lets the person register one by hand. Now that
  // the list below is a single flat feed rather than one card per chain, the dialog's
  // chain is picked with a Select inside it (defaulting to whichever network is currently
  // filtered on, if any) instead of being fixed to whichever card's "Add token" button
  // was tapped.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formChain, setFormChain] = useState<ChainKey>(chains[0].key);
  const [formAddress, setFormAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openDialog = (chain?: ChainKey) => {
    setFormChain(chain ?? chains[0].key);
    setFormAddress('');
    setFormError(null);
    setDialogOpen(true);
  };
  const closeDialog = () => {
    if (submitting) return;
    setDialogOpen(false);
  };

  const onSubmitToken = async () => {
    const address = formAddress.trim();
    if (address.length === 0) {
      setFormError(t('balance.error_empty_address'));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const activeWallet = await WalletsHelper.getActive();
      if (activeWallet == null) {
        setFormError(t('balance.error_no_wallet'));
        return;
      }
      const meta = await fetchTokenMetadata(formChain, address);
      await CustomTokensHelper.add({ chain: formChain, ...meta });
      setDialogOpen(false);
      await fetchAll();
    } catch (e) {
      console.error('Failed to add custom token', e);
      setFormError(t('balance.error_fetch_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const onRemoveToken = async (chain: ChainKey, token: TokenBalance) => {
    await CustomTokensHelper.remove(chain, token.address);
    await fetchAll();
  };

  const isCustomToken = useMemo(
    () => (chain: ChainKey, token: TokenBalance) => customAddresses[chain]?.has(token.address.toLowerCase()) ?? false,
    [customAddresses],
  );

  // --- Network filter ------------------------------------------------------------------
  //
  // Visual + functional counterpart to the reference screenshot's "人気のネットワーク"
  // pill: "all" shows every asset across every chain (the default, and the closest match
  // to how this screen worked before), or picking one network narrows the flat list down
  // to just that chain's assets.
  const [networkFilter, setNetworkFilter] = useState<FilterKey>('all');
  const [networkMenuAnchor, setNetworkMenuAnchor] = useState<HTMLElement | null>(null);
  const networkFilterLabel = useMemo(() => {
    if (networkFilter === 'all') return t('balance.all_networks');
    return CHAINS[networkFilter as ChainKey].name;
  }, [networkFilter, t]);

  // Builds the single flat row list every asset renders through - one entry per native
  // currency, per held ERC-20 token (curated or custom) - instead of the grouped-by-chain cards this screen used to render. No row
  // carries a price anymore - see the note in fetchAll above for why.
  const allRows = useMemo<AssetRow[]>(() => {
    const rows: AssetRow[] = [];
    for (const chain of chains) {
      const balance = balances[chain.key];
      const chainIcon = CHAIN_ICONS[chain.key];

      rows.push({
        id: `${chain.key}-native`,
        filterKey: chain.key,
        icon: chainIcon,
        name: chain.nativeCurrency.symbol,
        symbol: chain.nativeCurrency.symbol,
        amount: balance?.native ?? '0.0',
        onSend: () => onSendJpycOrNative(chain.key, 'native'),
      });

      // JPYC is not deployed on Portaldot (jpycAddress is null), so no JPYC row there.
      if (chain.jpycAddress) {
        rows.push({
          id: `${chain.key}-jpyc`,
          filterKey: chain.key,
          icon: getTokenIcon('JPYC') ?? chainIcon,
          badgeIcon: chainIcon,
          name: 'JPYC',
          symbol: 'JPYC',
          amount: balance?.jpyc ?? '0.0',
          onSend: () => onSendJpycOrNative(chain.key, 'jpyc'),
        });
      }

      const alwaysShownSymbols = ALWAYS_SHOWN_TOKEN_SYMBOLS[chain.key] ?? [];
      const heldTokens = balance?.tokens ?? [];

      // Icon fallback order: curated bundled icon (USDT/USDC/JPYC - consistent, never
      // fails to load) -> CoinGecko logo captured at add-time -> the chain icon, but only
      // for a curated/known token. A custom token with neither gets no icon at all
      // (undefined) rather than the chain icon, so Avatar shows the symbol-initial letter
      // instead of a chain logo that could be mistaken for the token's own artwork (e.g.
      // an Ethereum diamond shown for an unrelated "BGB" token just because it happens to
      // live on Ethereum).
      const resolveTokenIcon = (token: TokenBalance): string | undefined =>
        getTokenIcon(token.symbol) ?? token.iconUrl ?? (isCustomToken(chain.key, token) ? undefined : chainIcon);

      alwaysShownSymbols.forEach((symbol) => {
        const held = heldTokens.find((t) => t.symbol === symbol);
        const curated = TOKEN_LISTS[chain.key].find((t) => t.symbol === symbol);
        if (!curated) return;
        const token: TokenBalance = held ?? { ...curated, balance: '0.0' };
        rows.push({
          id: `${chain.key}-${token.address}`,
          filterKey: chain.key,
          icon: resolveTokenIcon(token),
          badgeIcon: chainIcon,
          name: token.symbol,
          symbol: token.symbol,
          amount: token.balance,
          onSend: () => onSendToken(chain.key, token),
          onRemove: isCustomToken(chain.key, token) ? () => onRemoveToken(chain.key, token) : undefined,
        });
      });

      heldTokens.filter((token) => !alwaysShownSymbols.includes(token.symbol)).forEach((token) => {
        rows.push({
          id: `${chain.key}-${token.address}`,
          filterKey: chain.key,
          icon: resolveTokenIcon(token),
          badgeIcon: chainIcon,
          name: token.symbol,
          symbol: token.symbol,
          amount: token.balance,
          onSend: () => onSendToken(chain.key, token),
          onRemove: isCustomToken(chain.key, token) ? () => onRemoveToken(chain.key, token) : undefined,
        });
      });
    }

    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balances, isCustomToken]);

  const visibleRows = networkFilter === 'all' ? allRows : allRows.filter((r) => r.filterKey === networkFilter);

  return (
    <Box sx={{ width: '100%', pb: 2 }}>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ px: 2, mt: 3, pb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box
              onClick={(e) => setNetworkMenuAnchor(e.currentTarget)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
                bgcolor: 'grey.100', borderRadius: 5, px: 1.5, py: 0.75,
              }}
            >
              <Typography sx={{ fontWeight: 'bold', fontSize: 14 }}>{networkFilterLabel}</Typography>
              <ExpandMoreIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            </Box>
            <IconButton
              aria-label={t('balance.add_token')}
              onClick={() => openDialog(networkFilter !== 'all' ? (networkFilter as ChainKey) : undefined)}
            >
              <AddIcon />
            </IconButton>
          </Box>

          <Menu anchorEl={networkMenuAnchor} open={!!networkMenuAnchor} onClose={() => setNetworkMenuAnchor(null)}>
            <MenuItem selected={networkFilter === 'all'} onClick={() => { setNetworkFilter('all'); setNetworkMenuAnchor(null); }}>
              {t('balance.all_networks')}
            </MenuItem>
            {chains.map((chain) => (
              <MenuItem
                key={chain.key}
                selected={networkFilter === chain.key}
                onClick={() => { setNetworkFilter(chain.key); setNetworkMenuAnchor(null); }}
              >
                <Avatar src={CHAIN_ICONS[chain.key]} sx={{ width: 22, height: 22, mr: 1.5 }} />
                {chain.name}
              </MenuItem>
            ))}
          </Menu>

          <Card sx={{ overflow: 'hidden' }}>
            {visibleRows.map((row) => (
              <AssetRowItem key={row.id} row={row} />
            ))}
          </Card>
        </Box>
      )}


      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="xs">
        <DialogTitle>{t('balance.add_token_dialog_title')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary', fontSize: 'small', mb: 2 }}>
            {t('balance.add_token_dialog_message')}
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ color: '#929292', fontSize: 12, mb: 0.5 }}>{t('balance.chain_label')}</Typography>
            <Select
              fullWidth
              size="small"
              value={formChain}
              onChange={(e) => setFormChain(e.target.value as ChainKey)}
              disabled={submitting}
            >
              {chains.map((chain) => (
                <MenuItem key={chain.key} value={chain.key}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box component="img" src={CHAIN_ICONS[chain.key]} sx={{ width: 20, height: 20, borderRadius: '50%' }} />
                    {chain.name}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </Box>
          <TextField
            label={t('balance.contract_address_label')}
            placeholder="0x..."
            fullWidth
            margin="dense"
            value={formAddress}
            onChange={(e) => setFormAddress(e.target.value)}
            disabled={submitting}
            autoFocus
          />
          {formError && <Alert severity="error" sx={{ mt: 2 }}>{formError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={submitting}>{t('common.cancel')}</Button>
          <Button onClick={onSubmitToken} variant="contained" disabled={submitting}>
            {submitting ? <CircularProgress size={20} /> : t('common.add')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
