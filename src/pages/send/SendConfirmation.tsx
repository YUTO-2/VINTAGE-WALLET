import { useEffect, useState } from 'react';
import { Box, Typography, Button, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import MessageDialog from '../../components/MessageDialog';
import PasswordDialog from '../../components/PasswordDialog';
import ErrorSnackbar from '../../components/ErrorSnackbar';
import { WalletsHelper } from '../../lib/storage';
import { CHAINS, sendNative, sendErc20, parseSendError, estimateSendFee } from '../../lib/chains';
import type { ChainKey, ParsedSendError } from '../../lib/chains';
import { useAppStore } from '../../store/appStore';
import { ethers } from 'ethers';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

export default function SendConfirmation() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const backPath = useAppStore((s) => s.backPathFromSendConfirmation);
  const calculatorFormula = useAppStore((s) => s.calculatorFormula);
  const receiverAddress = useAppStore((s) => s.receiverAddress);
  const activeChain = useAppStore((s) => s.activeChain) as ChainKey;
  const sendCurrency = useAppStore((s) => s.sendCurrency);
  const sendTokenMeta = useAppStore((s) => s.sendTokenMeta);
  const setLastTxHash = useAppStore((s) => s.setLastTxHash);

  // Portaldot is the only network, so the network name / native symbol come straight from
  // its CHAINS entry. A leftover 'jpyc' currency from an older version is treated as native.
  const activeChainConfig = CHAINS[activeChain];
  const networkName = activeChainConfig.name;
  const nativeSymbol = activeChainConfig.nativeCurrency.symbol;
  const isToken = sendCurrency !== 'jpyc' && sendCurrency !== 'native';
  const currencyLabel = isToken ? (sendTokenMeta?.symbol ?? '') : nativeSymbol;

  const [showSendCaution, setShowSendCaution] = useState(true);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [sendError, setSendError] = useState<ParsedSendError | null>(null);
  // 'loading' while the estimate request is in flight, null once it settles with no result
  // (bad address, RPC failure) so the UI can fall back to "not available" instead of "0".
  const [estimatedFee, setEstimatedFee] = useState<string | null | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    setEstimatedFee('loading');
    (async () => {
      const activeWallet = await WalletsHelper.getActive();
      if (!activeWallet || cancelled) return;
      const fee = await estimateSendFee(
        activeChain,
        activeWallet.address,
        receiverAddress,
        isToken ? 'token' : 'native',
        calculatorFormula,
        sendTokenMeta ? { address: sendTokenMeta.address, decimals: sendTokenMeta.decimals } : undefined,
      );
      if (!cancelled) {
        setEstimatedFee(fee);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeChain, receiverAddress, isToken, calculatorFormula, sendTokenMeta]);

  const onPassed = async (pin: string) => {
    const amount = calculatorFormula;
    const to = receiverAddress;

    if (!ethers.isAddress(to)) {
      setErrorMessage(t('common.invalid_address'));
      return;
    }

    setSending(true);
    try {
      const activeWallet = await WalletsHelper.getActive();
      if (!activeWallet) {
        return;
      }
      const privateKey = await WalletsHelper.decryptKey(activeWallet.id, pin);
      if (privateKey == null) {
        setErrorMessage(t('wallet.invalid_key'));
        return;
      }

      let receipt;
      if (!isToken) {
        receipt = await sendNative(activeChain, privateKey, to, amount);
      } else if (sendTokenMeta != null) {
        receipt = await sendErc20(activeChain, privateKey, sendTokenMeta.address, sendTokenMeta.decimals, to, amount);
      } else {
        throw new Error('Unknown send currency');
      }

      setLastTxHash((receipt && receipt.hash) || '');
      navigate('/send/complete');
    } catch (error) {
      setSendError(parseSendError(error, { chain: activeChain, isNativeSend: !isToken, amount }));
    } finally {
      setSending(false);
    }
  };

  // Turns the classified send error into a dialog title + list of lines, in the current
  // language. Kept out of parseSendError() itself (lib/chains.ts) since that file has no
  // access to i18n and shouldn't need to.
  const sendErrorTitle = sendError
    ? t(`send.error_${sendError.kind}_title`)
    : '';
  // The detailed (amount/fee/total/balance) template only makes sense once we've actually
  // parsed those figures out of the RPC error - if we couldn't, fall back to a plain-
  // language explanation of the same kind rather than let "undefined" show up in the UI.
  const hasFigures = sendError?.estimatedFee != null || sendError?.balance != null;
  const sendErrorMessageKey = sendError
    ? (sendError.kind === 'insufficient_gas' || sendError.kind === 'insufficient_total') && !hasFigures
      ? `send.error_${sendError.kind}_message_simple`
      : `send.error_${sendError.kind}_message`
    : '';
  const sendErrorTexts = sendError
    ? (t(sendErrorMessageKey, {
        returnObjects: true,
        symbol: sendError.symbol,
        amount: sendError.amount,
        fee: sendError.estimatedFee,
        total: sendError.requiredTotal,
        balance: sendError.balance,
        detail: sendError.rawMessage,
      }) as string[])
    : [];

  // One row of the summary card: small teal label, comfortable value underneath.
  const rows: { label: string; value: string; big?: boolean; breakAll?: boolean }[] = [
    { label: t('common.amount'), value: `${calculatorFormula} ${currencyLabel}`, big: true, breakAll: true },
    { label: t('send.network'), value: networkName },
    { label: t('common.destination'), value: receiverAddress, breakAll: true },
    {
      label: t('send.gas_fee'),
      value: estimatedFee === 'loading'
        ? t('send.fee_estimating')
        : estimatedFee != null
          ? `${t('common.approx')} ${estimatedFee} ${nativeSymbol}`
          : t('send.fee_estimate_unavailable'),
      breakAll: true,
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppToolBar back={backPath} title={t('send.confirmation_title')} />
      {/* Summary: one roomy card (generous padding, a divider between rows) centred in a
          comfortable reading width instead of bare text hugging the screen edge. */}
      <Box sx={{ flexGrow: 1, width: '100%', maxWidth: 560, mx: 'auto', px: 3, py: 3, boxSizing: 'border-box', textAlign: 'left' }}>
        <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 4, px: 3, py: 1 }}>
          {rows.map((row, i) => (
            <Box key={row.label}>
              {i > 0 && <Divider />}
              <Box sx={{ py: 2.5 }}>
                <Typography sx={{ color: 'primary.main', fontSize: '0.85rem', mb: 0.75 }}>{row.label}</Typography>
                <Typography sx={{ fontSize: row.big ? '1.6rem' : '1rem', fontWeight: row.big ? 'bold' : 'normal', lineHeight: 1.5, wordBreak: row.breakAll ? 'break-all' : 'normal' }}>
                  {row.value}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <MessageDialog
        open={showSendCaution}
        title={t('send.confirmation_title')}
        texts={t('send.confirmation_dialog_message', { returnObjects: true }) as string[]}
        onClose={() => setShowSendCaution(false)}
      />

      {/* Action area: full width, with the call to action as a proper large button. */}
      <Box sx={{ position: 'sticky', bottom: 0, bgcolor: 'background.paper', borderTop: '4px solid', borderColor: 'primary.main', px: 3, py: 2.5 }}>
        <Box sx={{ maxWidth: 560, mx: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
          <Typography>{sending ? t('send.sending') : t('send.confirmation_ready')}</Typography>
          <Button
            variant="contained"
            color="primary"
            size="large"
            fullWidth
            disabled={sending}
            onClick={() => setShowPinDialog(true)}
            startIcon={<LockOutlinedIcon />}
            sx={{ py: 1.5 }}
          >
            {t('send.confirmation_password')}
          </Button>
        </Box>
      </Box>

      <PasswordDialog open={showPinDialog} mode="check" onClose={() => setShowPinDialog(false)} onPass={onPassed} />
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage('')} />
      <MessageDialog
        open={sendError != null}
        title={sendErrorTitle}
        texts={sendErrorTexts}
        onClose={() => setSendError(null)}
      />
    </Box>
  );
}
