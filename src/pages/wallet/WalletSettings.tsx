import { useEffect, useState } from 'react';
import { Box, Card, List, ListItemButton, ListItemText, CircularProgress, Divider, Dialog, DialogTitle, DialogContent, TextField, Button } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import { WalletsHelper } from '../../lib/storage';
import { CHAINS, getProvider } from '../../lib/chains';
import type { ChainKey } from '../../lib/chains';
import { useAppStore } from '../../store/appStore';

export default function WalletSettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id') || '';
  const activeChain = useAppStore((s) => s.activeChain) as ChainKey;

  const [walletType, setWalletType] = useState('');
  const [renameDialog, setRenameDialog] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');

  useEffect(() => {
    (async () => {
      const wallet = await WalletsHelper.get(id);
      if (wallet === null) return;

      // EOA vs. smart-contract-wallet detection: a plain externally-owned account has no
      // deployed bytecode at its address. (There is no NEM-style multisig concept on EVM
      // chains — a "multisig" here would be a Safe or similar contract wallet instead.)
      try {
        const code = await getProvider(activeChain).getCode(wallet.address);
        setWalletType(code && code !== '0x' ? 'Contract' : 'Standard');
      } catch {
        setWalletType('Standard');
      }
    })();
  }, [id, activeChain]);

  const items = [
    { text: t('wallet.settings_detail'), action: () => navigate(`/wallet/detail?id=${id}`) },
    { text: t('wallet.settings_address'), action: () => navigate(`/wallet/address?id=${id}`) },
    { text: t('wallet.settings_backup'), action: () => navigate(`/wallet/backup_caution?id=${id}`) },
    { text: t('wallet.settings_rename'), action: () => { setNewWalletName(''); setRenameDialog(true); } },
    { text: t('wallet.settings_delete'), action: () => navigate(`/wallet/delete?id=${id}`) },
  ];

  const rename = async () => {
    await WalletsHelper.setName(id, newWalletName);
    setRenameDialog(false);
  };

  return (
    <Box>
      <AppToolBar back="/wallet/select" title={t('wallet.settings_title')} />
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 1 }}>
          {walletType.length === 0 ? (
            <CircularProgress color="primary" />
          ) : (
            <Card sx={{ width: '60vw' }}>
              <Box sx={{ textAlign: 'center', my: 1 }}>{CHAINS[activeChain].name}</Box>
              <Divider />
              <Box sx={{ textAlign: 'center', my: 1 }}>WalletType: {walletType}</Box>
            </Card>
          )}
        </Box>

        <Box sx={{ m: 1 }}>{t('wallet.settings_general')}</Box>
        <List>
          {items.map((item) => (
            <Box key={item.text}>
              <ListItemButton onClick={item.action}>
                <ListItemText primary={item.text} />
                <ChevronRightIcon color="secondary" />
              </ListItemButton>
              <Divider />
            </Box>
          ))}
        </List>
      </Box>

      <Dialog open={renameDialog} onClose={() => setRenameDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('wallet.rename_title')}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label={t('wallet.rename_hint')} value={newWalletName} onChange={(e) => setNewWalletName(e.target.value)} sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, pb: 2 }}>
            <Button variant="contained" color="primary" disabled={newWalletName.length === 0} onClick={rename}>OK</Button>
            <Button variant="contained" color="secondary" onClick={() => setRenameDialog(false)}>CANCEL</Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
