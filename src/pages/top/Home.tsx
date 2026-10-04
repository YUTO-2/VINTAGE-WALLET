import { useEffect, useState, useCallback } from 'react';
import { Box, Card, CardActionArea, Typography, CircularProgress, Divider, Snackbar, IconButton, Menu, MenuItem, ListItemIcon } from '@mui/material';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckIcon from '@mui/icons-material/Check';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CardRibbon from '../../components/CardRibbon';
import { useEvmBalance } from '../../hooks/useEvmBalance';
import { useTransactions } from '../../hooks/useTransactions';
import type { TransactionWrapper } from '../../lib/transactionWrapper';
import { useAppStore } from '../../store/appStore';
import { AddressBookHelper, WalletsHelper } from '../../lib/storage';
import { CHAINS, DEFAULT_CHAIN } from '../../lib/chains';
import { getHomeCache, setHomeCache } from '../../lib/homeCache';
import { evmToSs58 } from '../../lib/ss58';
import type { AddressFormat } from '../../store/appStore';
import iconReceiveGreen from '../../assets/icon_transaction_receive_green.png';
import iconReceiveRed from '../../assets/icon_transaction_receive_red.png';
import iconCheck from '../../assets/icon_transaction_check.png';
import iconUnconfirmed from '../../assets/icon_transaction_unconfirmed.png';

const RECENT_COUNT = 5;

interface HomeProps {
  needsUpdate: boolean;
}

export default function Home({ needsUpdate }: HomeProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Portaldot is the only network, so everything on this screen is keyed to its native coin
  // (tPOTv3). JPYC/USDC, the total-assets figure and the per-chain breakdown are gone.
  const { nativeBalance, fetchEvmBalance, hydrateBalances } = useEvmBalance();
  const nativeSymbol = CHAINS[DEFAULT_CHAIN].nativeCurrency.symbol;

  const [loadingBalance, setLoadingBalance] = useState(false);
  const [address, setAddress] = useState('');
  const [addressCopied, setAddressCopied] = useState(false);
  // H160 (0x) vs SS58 display of the address; the choice is shared with the Receive screen.
  const addressFormat = useAppStore((s) => s.addressFormat);
  const setAddressFormat = useAppStore((s) => s.setAddressFormat);
  const [formatMenuAnchor, setFormatMenuAnchor] = useState<null | HTMLElement>(null);

  // Latest transactions shown under the balance card (the full list is /transaction/list).
  const { fetchTransactions } = useTransactions();
  const setTransaction = useAppStore((s) => s.setTransaction);
  const [recent, setRecent] = useState<TransactionWrapper[]>([]);
  const [peerNames, setPeerNames] = useState<Record<string, string>>({});
  const [loadingRecent, setLoadingRecent] = useState(false);

  const displayedAddress = addressFormat === 'ss58' ? (evmToSs58(address) ?? '') : address;

  const onCopyAddress = useCallback(async () => {
    if (!displayedAddress) return;
    try {
      await navigator.clipboard.writeText(displayedAddress);
      setAddressCopied(true);
    } catch (e) {
      console.error('Failed to copy address', e);
    }
  }, [displayedAddress]);

  const update = useCallback(async () => {
    const activeWallet = await WalletsHelper.getActive();
    if (activeWallet == null) {
      setAddress('');
      setLoadingBalance(false);
      return;
    }
    setAddress(activeWallet.address);

    // Show the last-known balance for this wallet instantly (see lib/homeCache.ts) while a
    // fresh fetch runs underneath and silently corrects it. No cache hit -> spinner.
    const cached = getHomeCache(activeWallet.address, 'native');
    if (cached) {
      hydrateBalances({ native: cached.nativeBalance, jpyc: '0', usdc: '0', totalJpy: 0 });
      setRecent(cached.recentTransactions);
      setPeerNames(cached.peerNames);
    } else {
      setLoadingBalance(true);
      setLoadingRecent(true);
    }

    // Balance and history load in parallel; either failing quietly keeps what was shown.
    const historyPromise = fetchTransactions(RECENT_COUNT, false, async (confirmed, unconfirmed) => {
      const list = [...unconfirmed, ...confirmed].slice(0, RECENT_COUNT);
      const addresses = new Set<string>();
      for (const tx of list) {
        addresses.add(tx.senderAddress.toLowerCase());
        addresses.add(tx.receiverAddress.toLowerCase());
      }
      const entries = await Promise.all(
        [...addresses].map(async (address) => [address, (await AddressBookHelper.findByAddress(address))?.name ?? null] as const)
      );
      const names = Object.fromEntries(entries.filter(([, name]) => name != null) as [string, string][]);
      setRecent(list);
      setPeerNames(names);
      const latest = getHomeCache(activeWallet.address, 'native');
      if (latest) setHomeCache(activeWallet.address, 'native', { ...latest, recentTransactions: list, peerNames: names });
    }).catch((e) => console.error('Failed to load recent transactions', e)).finally(() => setLoadingRecent(false));

    const balanceResult = await fetchEvmBalance().finally(() => setLoadingBalance(false));

    // balanceResult is null only on a transient RPC failure - keep what was shown before.
    const previous = getHomeCache(activeWallet.address, 'native');
    setHomeCache(activeWallet.address, 'native', {
      nativeBalance: balanceResult?.native ?? cached?.nativeBalance ?? '0',
      jpycBalance: '0',
      usdcBalance: '0',
      totalJpyBalance: 0,
      recentTransactions: previous?.recentTransactions ?? cached?.recentTransactions ?? [],
      peerNames: previous?.peerNames ?? cached?.peerNames ?? {},
      totalAssetsDisplay: 0,
      chainBalances: {} as never,
    });
    await historyPromise;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchEvmBalance, fetchTransactions, hydrateBalances]);

  useEffect(() => {
    update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (needsUpdate) {
      update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsUpdate]);

  return (
    <Box sx={{ width: '100%', px: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', mt: 2 }}>
        <Card sx={{ background: 'linear-gradient(135deg, #7B2FF0 0%, #0A84FF 100%)', position: 'relative', overflow: 'hidden' }}>
          <Box sx={{ position: 'relative', px: 2, pt: 1.5, pb: 2 }}>
            <CardRibbon text={t('home.balance_ribbon')} bgcolor="nemOrange" icon={<AccountBalanceWalletOutlinedIcon sx={{ fontSize: 14, color: 'white' }} />} sx={{ ml: 0 }} />

            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)' }}>
                {t('home.address_label')} ({addressFormat === 'ss58' ? 'SS58' : 'H160'})
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                <Box
                  onClick={onCopyAddress}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: displayedAddress ? 'pointer' : 'default', minWidth: 0 }}
                >
                  <Typography sx={{ fontSize: '1rem', color: 'white', fontWeight: 'bold', wordBreak: 'break-all', lineHeight: 1.4 }}>
                    {displayedAddress || '-'}
                  </Typography>
                  {displayedAddress && <ContentCopyIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', flexShrink: 0 }} />}
                </Box>
                <IconButton
                  size="small"
                  onClick={(e) => setFormatMenuAnchor(e.currentTarget)}
                  aria-label={t('receive.format_label')}
                  disabled={!address}
                  sx={{ color: 'white', p: 0.25, flexShrink: 0 }}
                >
                  <ExpandMoreIcon />
                </IconButton>
                <Menu anchorEl={formatMenuAnchor} open={!!formatMenuAnchor} onClose={() => setFormatMenuAnchor(null)}>
                  {(['ss58', 'h160'] as AddressFormat[]).map((format) => (
                    <MenuItem
                      key={format}
                      selected={format === addressFormat}
                      onClick={() => { setAddressFormat(format); setFormatMenuAnchor(null); }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {format === addressFormat && <CheckIcon fontSize="small" />}
                      </ListItemIcon>
                      {t(format === 'ss58' ? 'receive.format_ss58' : 'receive.format_h160')}
                    </MenuItem>
                  ))}
                </Menu>
              </Box>
            </Box>

            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)' }}>
                {nativeSymbol} {t('home.balance_ribbon')}
              </Typography>
              {loadingBalance ? (
                <CircularProgress size={22} sx={{ color: 'white', mt: 0.5 }} />
              ) : (
                <Typography sx={{ fontSize: 'xx-large', color: 'white', fontWeight: 'bold', lineHeight: 1.2 }}>
                  {Number(nativeBalance).toLocaleString(undefined, { maximumFractionDigits: 6 })} {nativeSymbol}
                </Typography>
              )}
            </Box>
          </Box>
        </Card>

        {/* Latest transactions. The Receive / Send / Scan / Token / NFT / Address entries live in the
            side menu now, so this card is all that sits under the balance. */}
        <Card sx={{ mt: 2, mb: 2 }}>
          <CardRibbon text={t('home.transaction_ribbon')} bgcolor="nemBlue" icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 14, color: 'white' }} />} />
          {loadingRecent && recent.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : recent.length === 0 ? (
            <Box sx={{ py: 3, px: 2 }}>
              <Typography sx={{ color: 'text.secondary', textAlign: 'center' }}>{t('home.no_transaction_title')}</Typography>
            </Box>
          ) : (
            <Box sx={{ mt: 1 }}>
              {recent.map((tx, i) => {
                const peerAddress = tx.peer;
                return (
                  <Box key={`${tx.hash}-${i}`}>
                    {i > 0 && <Divider />}
                    <CardActionArea onClick={() => { setTransaction(tx); navigate('/transaction/detail'); }} sx={{ px: 2, py: 1.25 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box component="img" src={tx.isReception ? iconReceiveGreen : iconReceiveRed} sx={{ width: 16, height: 16, flexShrink: 0 }} />
                        <Typography sx={{ fontWeight: 'bold', color: tx.isReception ? 'primary.main' : 'nemOrange' }}>
                          {tx.isReception ? '+' : '-'}{tx.amount} {tx.currencySymbol}
                        </Typography>
                        <Box sx={{ flexGrow: 1 }} />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{tx.dateString}</Typography>
                        <Box component="img" src={tx.isConfirmed ? iconCheck : iconUnconfirmed} sx={{ width: 14, height: 14 }} />
                      </Box>
                      <Typography variant="body2" noWrap sx={{ mt: 0.5, color: 'text.secondary', textAlign: 'left' }}>
                        {tx.isReception ? t('transaction.from_label') : t('transaction.to_label')}: {peerNames[peerAddress.toLowerCase()] ?? peerAddress}
                      </Typography>
                    </CardActionArea>
                  </Box>
                );
              })}
              <Divider />
              <CardActionArea onClick={() => navigate('/transaction/list')} sx={{ py: 1.25 }}>
                <Typography variant="body2" sx={{ color: 'primary.main', textAlign: 'center', fontWeight: 'bold' }}>{t('home.view_all_transactions')}</Typography>
              </CardActionArea>
            </Box>
          )}
        </Card>
      </Box>

      <Snackbar
        open={addressCopied}
        autoHideDuration={2000}
        onClose={() => setAddressCopied(false)}
        message={t('home.address_copied')}
      />
    </Box>
  );
}
