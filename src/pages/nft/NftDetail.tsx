import { useEffect, useState } from 'react';
import {
  Box, Card, Typography, CircularProgress, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, Snackbar,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ImageNotSupportedOutlinedIcon from '@mui/icons-material/ImageNotSupportedOutlined';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ethers } from 'ethers';
import { resolveRecipient } from '../../lib/ss58';
import AppToolBar from '../../components/AppToolBar';
import PasswordDialog from '../../components/PasswordDialog';
import { WalletsHelper, CustomNftsHelper } from '../../lib/storage';
import type { CustomNftRecord } from '../../lib/storage';
import { DEFAULT_CHAIN, extractRpcMessage } from '../../lib/chains';
import { fetchNftCollectionInfo, fetchNftMetadata, sendErc721, verifyNftOwner } from '../../lib/nft';
import type { NftMetadata } from '../../lib/nft';

function InfoRow({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
  return (
    <Box sx={{ py: 1, borderTop: '0.5px solid', borderColor: 'divider' }}>
      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{label}</Typography>
      <Box
        onClick={onCopy}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: onCopy ? 'pointer' : 'default' }}
      >
        <Typography sx={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>{value}</Typography>
        {onCopy && <ContentCopyIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />}
      </Box>
    </Box>
  );
}

export default function NftDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const collectionParam = searchParams.get('c') ?? '';
  const tokenId = searchParams.get('id') ?? '';
  const validParams = ethers.isAddress(collectionParam) && /^\d+$/.test(tokenId);
  const collection = validParams ? ethers.getAddress(collectionParam) : '';

  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<NftMetadata>({});
  const [record, setRecord] = useState<Pick<CustomNftRecord, 'collectionName' | 'collectionSymbol'> | null>(null);
  const [owned, setOwned] = useState<boolean | null>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!validParams) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const wallet = await WalletsHelper.getActive();
      const saved = (await CustomNftsHelper.list(DEFAULT_CHAIN))
        .find((n) => n.address.toLowerCase() === collection.toLowerCase() && n.tokenId === tokenId);
      // Fall back to reading the collection on-chain if this NFT isn't in the saved list
      // (e.g. the page was opened from a bookmarked/old link).
      const info = saved
        ? { collectionName: saved.collectionName, collectionSymbol: saved.collectionSymbol }
        : await fetchNftCollectionInfo(DEFAULT_CHAIN, collection)
          .then((i) => ({ collectionName: i.name, collectionSymbol: i.symbol }))
          .catch(() => ({ collectionName: '', collectionSymbol: '' }));
      const [m, own] = await Promise.all([
        fetchNftMetadata(DEFAULT_CHAIN, collection, tokenId),
        wallet ? verifyNftOwner(DEFAULT_CHAIN, collection, tokenId, wallet.address) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setWalletAddress(wallet?.address ?? '');
      setRecord(info);
      setMeta(m);
      setOwned(own);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [validParams, collection, tokenId]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  // --- Send flow: address dialog -> PIN -> broadcast ------------------------------------
  const [sendOpen, setSendOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentOpen, setSentOpen] = useState(false);

  const onNext = () => {
    const resolved = resolveRecipient(recipient);
    if (!resolved.ok) {
      setRecipientError(t(resolved.reason === 'ss58_not_eth_derived' ? 'common.ss58_not_eth_derived' : 'common.invalid_address'));
      return;
    }
    const to = resolved.address;
    setRecipient(to); // SS58 input is replaced by the 0x address that will actually be used
    if (walletAddress && to.toLowerCase() === walletAddress.toLowerCase()) {
      // Sending to yourself would only burn gas.
      setRecipientError(t('common.invalid_address'));
      return;
    }
    setRecipientError(null);
    setSendOpen(false);
    setPinOpen(true);
  };

  const onPinPassed = async (pin: string) => {
    setPinOpen(false);
    setSending(true);
    setSendError(null);
    try {
      const wallet = await WalletsHelper.getActive();
      if (!wallet) return;
      const privateKey = await WalletsHelper.decryptKey(wallet.id, pin);
      if (privateKey == null) {
        setSendError(t('wallet.invalid_key'));
        return;
      }
      await sendErc721(DEFAULT_CHAIN, privateKey, collection, ethers.getAddress(recipient.trim()), tokenId);
      // It no longer belongs to this wallet, so drop it from the list.
      await CustomNftsHelper.remove(DEFAULT_CHAIN, collection, tokenId);
      setSentOpen(true);
    } catch (e) {
      console.error('Failed to send NFT', e);
      setSendError(`${t('nft.send_failed')}: ${extractRpcMessage(e)}`);
    } finally {
      setSending(false);
    }
  };

  const onRemove = async () => {
    await CustomNftsHelper.remove(DEFAULT_CHAIN, collection, tokenId);
    navigate('/nft', { replace: true });
  };

  const title = meta.name ?? (record?.collectionSymbol ? `${record.collectionSymbol} #${tokenId}` : `#${tokenId}`);

  return (
    <Box sx={{ pb: 4 }}>
      <AppToolBar back="/nft" title={t('nft.detail_title')} />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : !validParams ? (
        <Alert severity="error" sx={{ m: 2 }}>{t('common.error')}</Alert>
      ) : (
        <Box sx={{ px: 2, mt: 2 }}>
          <Card sx={{ overflow: 'hidden' }}>
            {meta.image ? (
              <Box component="img" src={meta.image} alt={title} sx={{ width: '100%', display: 'block' }} />
            ) : (
              <Box sx={{ py: 8, textAlign: 'center', bgcolor: 'grey.100', color: 'text.disabled' }}>
                <ImageNotSupportedOutlinedIcon sx={{ fontSize: 40 }} />
                <Typography sx={{ fontSize: '0.8rem' }}>{t('nft.no_image')}</Typography>
              </Box>
            )}
          </Card>

          <Typography sx={{ mt: 2, fontSize: 'large', fontWeight: 'bold', wordBreak: 'break-all' }}>{title}</Typography>
          {meta.description && (
            <Typography sx={{ mt: 0.5, fontSize: '0.85rem', color: 'text.secondary', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {meta.description}
            </Typography>
          )}

          {owned === null && <Alert severity="warning" sx={{ mt: 2 }}>{t('nft.owner_unknown')}</Alert>}
          {owned === false && <Alert severity="warning" sx={{ mt: 2 }}>{t('nft.error_not_owner')}</Alert>}

          <Box sx={{ mt: 2 }}>
            {record?.collectionName && <InfoRow label={t('nft.collection')} value={record.collectionName} />}
            <InfoRow label={t('nft.contract')} value={collection} onCopy={() => copy(collection)} />
            <InfoRow label={t('nft.token_id')} value={tokenId} onCopy={() => copy(tokenId)} />
          </Box>

          <Button
            variant="contained"
            fullWidth
            size="large"
            disabled={owned === false || sending}
            onClick={() => { setRecipient(''); setRecipientError(null); setSendError(null); setSendOpen(true); }}
            sx={{ mt: 3 }}
          >
            {sending ? <CircularProgress size={24} /> : t('nft.send')}
          </Button>
          {sendError && <Alert severity="error" sx={{ mt: 2, wordBreak: 'break-word' }}>{sendError}</Alert>}

          <Button fullWidth color="inherit" onClick={onRemove} sx={{ mt: 1, color: 'text.secondary' }}>
            {t('nft.remove')}
          </Button>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', textAlign: 'center' }}>{t('nft.remove_note')}</Typography>
        </Box>
      )}

      <Dialog open={sendOpen} onClose={() => setSendOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t('nft.send_dialog_title')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 'bold', wordBreak: 'break-all', mb: 1 }}>{title}</Typography>
          <TextField
            label={t('nft.recipient_label')}
            placeholder="0x..."
            fullWidth
            margin="dense"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            error={recipientError !== null}
            helperText={recipientError ?? undefined}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={onNext} variant="contained">{t('nft.next')}</Button>
        </DialogActions>
      </Dialog>

      <PasswordDialog open={pinOpen} mode="check" onClose={() => setPinOpen(false)} onPass={onPinPassed} />

      <Snackbar open={copied} autoHideDuration={1500} onClose={() => setCopied(false)} message={t('nft.address_copied')} />
      <Snackbar
        open={sentOpen}
        autoHideDuration={1500}
        onClose={() => navigate('/nft', { replace: true })}
        message={t('nft.sent')}
      />
    </Box>
  );
}
