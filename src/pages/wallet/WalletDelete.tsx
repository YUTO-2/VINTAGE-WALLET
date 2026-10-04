import { useEffect, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import PasswordDialog from '../../components/PasswordDialog';
import { PinCodeHelper, WalletsHelper } from '../../lib/storage';
import { Environment } from '../../lib/environment';
import cautionIcon from '../../assets/icon_caution.png';

export default function WalletDelete() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id') || '';
  const [showPinDialog, setShowPinDialog] = useState(false);

  useEffect(() => {
    (async () => {
      if (await PinCodeHelper.hasSavedCode()) {
        setShowPinDialog(true);
      }
    })();
  }, []);

  const goBackSettings = () => {
    if (Environment.isIos() && Environment.isInStandaloneMode()) {
      navigate(`/wallet/settings?id=${id}`);
    } else {
      navigate(-1);
    }
  };

  const goBackSelect = () => {
    if (Environment.isIos() && Environment.isInStandaloneMode()) {
      navigate('/wallet/select');
    } else {
      navigate(-2 as any);
    }
  };

  const deleteWallet = async () => {
    await WalletsHelper.delete(id);
    goBackSelect();
  };

  return (
    <Box sx={{ bgcolor: (th) => (th.palette.mode === 'dark' ? '#1a1240' : th.palette.background.default), minHeight: '100vh' }}>
      <AppToolBar back={`/wallet/settings?id=${id}`} title={t('common.delete')} />
      <Box sx={{ mb: 5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
          <Box component="img" src={cautionIcon} sx={{ width: 16, height: 16 }} />
          <Typography sx={{ color: 'text.primary' }}>{t('wallet.key_caution_title')}</Typography>
        </Box>

        <Typography align="center" sx={{ mt: 1, mx: 2, color: 'text.primary' }}>
          {(t('wallet.delete_caution_message', { returnObjects: true }) as string[]).map((line, i) => (
            <span key={i}>{line}<br /></span>
          ))}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 8, pb: 4 }}>
        <Button variant="contained" color="primary" size="small" onClick={deleteWallet}>REMOVE</Button>
        <Button variant="contained" color="secondary" size="small" onClick={goBackSettings}>CANCEL</Button>
      </Box>

      <PasswordDialog open={showPinDialog} mode="check" onClose={() => setShowPinDialog(false)} onCancel={goBackSettings} onPass={() => setShowPinDialog(false)} />
    </Box>
  );
}
