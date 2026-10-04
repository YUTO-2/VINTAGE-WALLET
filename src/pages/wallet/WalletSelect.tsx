import { useEffect, useState } from 'react';
import { Box, Button, Typography, List, ListItemButton, ListItemText, IconButton, Divider } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WalletsHelper } from '../../lib/storage';
import type { Wallet } from '../../lib/storage';
import { DEFAULT_CHAIN, fetchBalances, fetchNativeJpyRate } from '../../lib/chains';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// 0x1234...abcd — short enough to fit on one line next to the wallet name.
function shortenAddress(address: string): string {
  if (address.length <= 14) {
    return address;
  }
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export default function WalletSelect() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Each wallet's JPY-denominated total (JPYC + native converted at the current rate, on
  // the default chain) — fetched once per wallet so it can be shown right in this list.
  const [jpyBalances, setJpyBalances] = useState<Record<string, number>>({});

  const getActiveWalletIndex = async (allWallets: Wallet[]): Promise<number> => {
    const activeWallet = await WalletsHelper.getActive();
    if (!activeWallet) {
      return -1;
    }
    return allWallets.findIndex((w) => w.id === activeWallet.id);
  };

  const load = async () => {
    const allWallets = await WalletsHelper.gets();
    setWallets(allWallets);
    setActiveIndex(await getActiveWalletIndex(allWallets));

    const jpyRate = await fetchNativeJpyRate(DEFAULT_CHAIN);
    const entries = await Promise.all(allWallets.map(async (wallet) => {
      try {
        const balances = await fetchBalances(DEFAULT_CHAIN, wallet.address);
        return [wallet.id, Number(balances.jpyc) + Number(balances.native) * jpyRate] as const;
      } catch (e) {
        console.error(`Failed to fetch balance for wallet ${wallet.id}`, e);
        return [wallet.id, 0] as const;
      }
    }));
    setJpyBalances(Object.fromEntries(entries));
  };

  useEffect(() => {
    load();
  }, []);

  const setActiveWallet = async (wallet: Wallet) => {
    await WalletsHelper.setActive(wallet.id);
    setActiveIndex(await getActiveWalletIndex(wallets));
    navigate('/top');
  };

  return (
    <div>
      <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        {/* No top bar. With no wallet yet there is no side menu either, so keep a bare back arrow
            to the welcome screen as the only way out. */}
        {wallets.length === 0 && (
          <Box sx={{ px: 1, pt: 1 }}>
            <IconButton onClick={() => navigate('/welcome')} aria-label="back"><ArrowBackIcon color="primary" /></IconButton>
          </Box>
        )}

        {/* 新規作成 / インポート - the only actions here (the big hero images were removed). */}
        <Box sx={{ display: 'flex', gap: 1.5, m: 2 }}>
          <Button variant="contained" color="primary" size="large" sx={{ flex: 1, py: 1.5 }} onClick={() => navigate('/wallet/creation/name')}>
            {t('wallet.create_new_wallet')}
          </Button>
          <Button variant="outlined" color="primary" size="large" sx={{ flex: 1, py: 1.5 }} onClick={() => navigate('/wallet/login/import')}>
            {t('wallet.import_wallet')}
          </Button>
        </Box>

        {wallets.length === 0 ? (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">{t('wallet.no_wallet_title')}</Typography>
            <Typography color="text.secondary" sx={{ mx: 2 }}>
              {(t('wallet.no_wallet_message', { returnObjects: true }) as string[]).map((line, i) => (
                <span key={i}>{line}<br /></span>
              ))}
            </Typography>
          </Box>
        ) : (
          <List>
            {wallets.map((wallet, index) => (
              <Box key={wallet.id}>
                <ListItemButton
                  onClick={() => setActiveWallet(wallet)}
                  selected={index === activeIndex}
                  sx={{ py: 1.5 }}
                >
                  <ListItemText
                    primary={wallet.name}
                    secondary={(
                      <>
                        <Typography component="span" variant="body2" sx={{ display: 'block', color: 'text.secondary' }}>
                          {shortenAddress(wallet.address)}
                        </Typography>
                        <Typography component="span" variant="body2" sx={{ display: 'block', color: 'text.secondary' }}>
                          {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(jpyBalances[wallet.id] ?? 0)}
                        </Typography>
                      </>
                    )}
                  />
                  <IconButton
                    edge="end"
                    onClick={(e) => { e.stopPropagation(); navigate(`/wallet/settings?id=${wallet.id}`); }}
                  >
                    <SettingsIcon color="primary" />
                  </IconButton>
                </ListItemButton>
                <Divider variant="inset" />
              </Box>
            ))}
          </List>
        )}
      </Box>
    </div>
  );
}
