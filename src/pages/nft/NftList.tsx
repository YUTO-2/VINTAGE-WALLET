import { useCallback, useEffect, useState } from 'react';
import {
  Box, Card, CardActionArea, Typography, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Button, IconButton, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ImageNotSupportedOutlinedIcon from '@mui/icons-material/ImageNotSupportedOutlined';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WalletsHelper, CustomNftsHelper } from '../../lib/storage';
import type { CustomNftRecord } from '../../lib/storage';
import { DEFAULT_CHAIN } from '../../lib/chains';
import {
  fetchNftCollectionInfo, fetchNftMetadata, discoverOwnedTokenIds, verifyNftOwner, nftDetailPath,
} from '../../lib/nft';
import type { NftMetadata } from '../../lib/nft';

function NftTile({ record, onOpen }: { record: CustomNftRecord; onOpen: () => void }) {
  const { t } = useTranslation();
  const [meta, setMeta] = useState<NftMetadata | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchNftMetadata(DEFAULT_CHAIN, record.address, record.tokenId).then((m) => {
      if (!cancelled) setMeta(m);
    });
    return () => { cancelled = true; };
  }, [record.address, record.tokenId]);

  return (
    <Card>
      <CardActionArea onClick={onOpen}>
        <Box sx={{ position: 'relative', width: '100%', pt: '100%', bgcolor: 'grey.100' }}>
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {meta === null ? (
              <CircularProgress size={24} />
            ) : meta.image ? (
              <Box component="img" src={meta.image} alt={meta.name ?? ''} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Box sx={{ textAlign: 'center', color: 'text.disabled' }}>
                <ImageNotSupportedOutlinedIcon />
                <Typography sx={{ fontSize: '0.65rem' }}>{t('nft.no_image')}</Typography>
              </Box>
            )}
          </Box>
        </Box>
        <Box sx={{ p: 1 }}>
          <Typography noWrap sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
            {meta?.name ?? `${record.collectionSymbol} #${record.tokenId}`}
          </Typography>
          <Typography noWrap sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
            {record.collectionName} #{record.tokenId}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
}

export default function NftList() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<CustomNftRecord[]>([]);

  const load = useCallback(async () => {
    const wallet = await WalletsHelper.getActive();
    if (wallet == null) {
      setRecords([]);
      setLoading(false);
      return;
    }
    const saved = await CustomNftsHelper.list(DEFAULT_CHAIN);
    // Re-check ownership every time: an NFT that was sent away (from here or elsewhere) must
    // not keep showing up. `null` = the check itself failed, so keep it rather than lose it.
    const checks = await Promise.all(
      saved.map(async (r) => ({ r, own: await verifyNftOwner(DEFAULT_CHAIN, r.address, r.tokenId, wallet.address) })),
    );
    for (const { r, own } of checks) {
      if (own === false) await CustomNftsHelper.remove(r.chain, r.address, r.tokenId);
    }
    setRecords(checks.filter((c) => c.own !== false).map((c) => c.r));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // --- Add dialog -----------------------------------------------------------------------
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formAddress, setFormAddress] = useState('');
  const [formTokenId, setFormTokenId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openDialog = () => {
    setFormAddress('');
    setFormTokenId('');
    setFormError(null);
    setDialogOpen(true);
  };
  const closeDialog = () => {
    if (submitting) return;
    setDialogOpen(false);
  };

  const onSubmit = async () => {
    const address = formAddress.trim();
    const tokenId = formTokenId.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      setFormError(t('nft.error_invalid_address'));
      return;
    }
    if (tokenId !== '' && !/^\d+$/.test(tokenId)) {
      setFormError(t('nft.error_invalid_token_id'));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const wallet = await WalletsHelper.getActive();
      if (wallet == null) {
        setFormError(t('balance.error_no_wallet'));
        return;
      }
      const info = await fetchNftCollectionInfo(DEFAULT_CHAIN, address);
      const base = { chain: DEFAULT_CHAIN, address: info.address, collectionName: info.name, collectionSymbol: info.symbol };

      if (tokenId !== '') {
        const own = await verifyNftOwner(DEFAULT_CHAIN, info.address, tokenId, wallet.address);
        if (own !== true) {
          setFormError(own === false ? t('nft.error_not_owner') : t('nft.error_add_failed'));
          return;
        }
        await CustomNftsHelper.add({ ...base, tokenId: BigInt(tokenId).toString() });
      } else {
        const ids = await discoverOwnedTokenIds(DEFAULT_CHAIN, info.address, wallet.address);
        if (ids.length === 0) {
          setFormError(t('nft.error_not_found'));
          return;
        }
        for (const id of ids) await CustomNftsHelper.add({ ...base, tokenId: id });
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      console.error('Failed to add NFT', e);
      setFormError(e instanceof Error && e.message === 'not_erc721' ? t('nft.error_not_erc721') : t('nft.error_add_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ pb: 3 }}>
      <Box sx={{ px: 2, mt: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <IconButton onClick={openDialog} aria-label={t('nft.add')} color="primary">
            <AddIcon />
          </IconButton>
        </Box>
        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 1.5 }}>{t('nft.scope_note')}</Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
            <CircularProgress />
          </Box>
        ) : records.length === 0 ? (
          <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography sx={{ fontSize: 'large', color: 'text.secondary' }}>{t('nft.empty_title')}</Typography>
            <Typography sx={{ color: 'text.secondary', textAlign: 'center' }}>
              {(t('nft.empty_message', { returnObjects: true }) as string[]).map((line, i) => (
                <span key={i}>{line}<br /></span>
              ))}
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openDialog} sx={{ mt: 2 }}>
              {t('nft.add')}
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
            {records.map((r) => (
              <NftTile key={`${r.address}:${r.tokenId}`} record={r} onOpen={() => navigate(nftDetailPath(r))} />
            ))}
          </Box>
        )}
      </Box>


      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="xs">
        <DialogTitle>{t('nft.add_dialog_title')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary', fontSize: 'small', mb: 2 }}>{t('nft.add_dialog_message')}</Typography>
          <TextField
            label={t('nft.contract_address_label')}
            placeholder="0x..."
            fullWidth
            margin="dense"
            value={formAddress}
            onChange={(e) => setFormAddress(e.target.value)}
            disabled={submitting}
            autoFocus
          />
          <TextField
            label={t('nft.token_id_label')}
            fullWidth
            margin="dense"
            value={formTokenId}
            onChange={(e) => setFormTokenId(e.target.value)}
            disabled={submitting}
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          />
          {formError && <Alert severity="error" sx={{ mt: 2 }}>{formError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={submitting}>{t('common.cancel')}</Button>
          <Button onClick={onSubmit} variant="contained" disabled={submitting}>
            {submitting ? <CircularProgress size={20} /> : t('common.add')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
