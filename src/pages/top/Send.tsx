import { useEffect, useState } from 'react';
import { Box, TextField, IconButton, Button, Typography, Dialog, AppBar, Toolbar } from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import CloseIcon from '@mui/icons-material/Close';
import ContactsOutlinedIcon from '@mui/icons-material/ContactsOutlined';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { resolveRecipient } from '../../lib/ss58';
import { WalletsHelper } from '../../lib/storage';
import { useAppStore } from '../../store/appStore';
import ErrorSnackbar from '../../components/ErrorSnackbar';
import Scan from './Scan';

export default function Send() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const setReceiverAddress = useAppStore((s) => s.setReceiverAddress);
  const clearCalculatorFormula = useAppStore((s) => s.clearCalculatorFormula);
  const pickedContactAddress = useAppStore((s) => s.pickedContactAddress);
  const setPickedContactAddress = useAppStore((s) => s.setPickedContactAddress);
  const [address, setAddress] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  // Scanning a QR code now starts from here (the separate Scan tab/menu entry was removed).
  const [scanOpen, setScanOpen] = useState(false);

  // Picked up after returning from the address-book picker (/addressbook?pick=1) - see
  // AddressBookList's onSelect. Cleared right away so it doesn't get reapplied on a later
  // visit to this tab.
  useEffect(() => {
    if (pickedContactAddress) {
      setAddress(pickedContactAddress);
      setPickedContactAddress('');
    }
  }, [pickedContactAddress, setPickedContactAddress]);

  // When an SS58 address is typed, show the 0x address it maps to before sending.
  const ss58Preview = (() => {
    const r = resolveRecipient(address);
    return r.ok && r.fromSs58 ? r.address : null;
  })();

  const onClickedOk = async () => {
    if (!(await WalletsHelper.getActive())) {
      setErrorMessage(t('wallet.not_select_message'));
      return;
    }
    const trimmedAddress: string = address.trim();
    // Accepts a 0x address or an SS58 address (converted to the 0x form used for the transfer).
    const resolved = resolveRecipient(trimmedAddress);
    if (resolved.ok) {
      setReceiverAddress(resolved.address);
      clearCalculatorFormula(); // start a new transfer with an empty amount
      navigate('/send/amount');
      return;
    }

    setErrorMessage(t(resolved.reason === 'ss58_not_eth_derived' ? 'common.ss58_not_eth_derived' : 'common.invalid_address'));
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', px: 2 }}>
        <Typography sx={{ fontSize: 'large' }}>{t('send.destination')}</Typography>
        {/* No white card around the field any more: on the white theme it showed up as a big
            white slab on the tinted page. The field itself carries the (paper) background. */}
        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
          <TextField
            id="address"
            label={t('send.input_address')}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            fullWidth
            helperText={ss58Preview ? t('send.ss58_converted', { address: ss58Preview }) : undefined}
            slotProps={{ formHelperText: { sx: { wordBreak: 'break-all' } } }}
            sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
          />
          <IconButton onClick={() => setScanOpen(true)} aria-label={t('home.scan')} color="primary">
            <QrCodeScannerIcon />
          </IconButton>
          <IconButton onClick={() => navigate('/addressbook?pick=1')} aria-label={t('common.address_book')} color="primary">
            <ContactsOutlinedIcon />
          </IconButton>
        </Box>
        <Box sx={{ mt: 2 }}>
          <Button variant="contained" color="primary" disabled={address.length === 0} onClick={onClickedOk}>OK</Button>
        </Box>
      </Box>
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage('')} />

      {/* The scanner only mounts while open, so the camera is off otherwise. A successful scan
          navigates to /send/amount, which unmounts this whole screen (and the dialog). */}
      <Dialog fullScreen open={scanOpen} onClose={() => setScanOpen(false)}>
        <AppBar position="sticky" color="default" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={() => setScanOpen(false)} aria-label={t('common.close')}>
              <CloseIcon />
            </IconButton>
            <Typography variant="h6" sx={{ ml: 1 }}>{t('home.scan')}</Typography>
          </Toolbar>
        </AppBar>
        <Scan isActive={scanOpen} />
      </Dialog>
    </Box>
  );
}
