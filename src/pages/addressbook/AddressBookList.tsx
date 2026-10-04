import { useCallback, useEffect, useState } from 'react';
import {
  Box, List, ListItemButton, ListItemAvatar, ListItemText, Avatar, Checkbox,
  Typography, Divider, Dialog, DialogTitle, DialogActions, Button, Fab,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AddressBookHelper } from '../../lib/storage';
import type { AddressBookRecord } from '../../lib/storage';
import { menuBarSx, menuShiftSx } from '../../lib/menuShift';

// "フレンドリスト" — the address book's top screen, reached from the bottom nav's ADDRESS
// slot (see BottomNav) - so it shares the same WalletBar/BottomNav shell as
// Home/Token/Swap rather than a per-screen back+title bar. Ported from the original
// RaccoonWallet feature (see 2019-04's "新機能「アドレス帳」追加"): a plain local contact
// list, with "選択"(bulk-select/delete) and "Add" actions - the select/cancel-delete row
// is docked as its own fixed bar directly above BottomNav (see SELECT_BAR_HEIGHT below),
// since BottomNav itself now owns the outermost fixed-bottom position.
//
// Doubles as a picker when opened as /addressbook?pick=1 (from Send's address-book
// button) — tapping a friend there drills into their wallet tab so a specific wallet
// can be picked, rather than opening the profile for editing.
// Other pages (Balance.tsx, SwapTop.tsx) reserve pb: 7 (56px) of page-bottom padding to
// clear BottomNav's own fixed bar - see the identical constant used there. The select/
// cancel-delete row below is a second fixed bar stacked directly above it, given the same
// 56px height so the two stack cleanly with nothing left showing through between them.
// The bottom navigation bar was removed, so the select bar now sits at the very bottom.
const BOTTOM_NAV_HEIGHT = 0;
const SELECT_BAR_HEIGHT = 56;

export default function AddressBookList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPickMode = searchParams.get('pick') === '1';

  const [records, setRecords] = useState<AddressBookRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setRecords(await AddressBookHelper.list());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRowTap = (record: AddressBookRecord) => {
    if (selectMode) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(record.id)) next.delete(record.id); else next.add(record.id);
        return next;
      });
      return;
    }
    navigate(`/addressbook/detail?id=${record.id}${isPickMode ? '&pick=1' : ''}`);
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const onAdd = async () => {
    // Creates the (initially blank) contact record right away, then opens it straight
    // into the profile form in edit mode - see AddressBookDetail's `isNew` handling,
    // which deletes this draft again if the person backs out without naming it.
    const record = await AddressBookHelper.add({ name: '', reading: '', phone: '', email: '', xAccount: '', lineAccount: '', telegramAccount: '', iconDataUrl: '', coverDataUrl: '' });
    navigate(`/addressbook/detail?id=${record.id}&new=1`);
  };

  const onConfirmDelete = async () => {
    for (const id of selectedIds) {
      await AddressBookHelper.remove(id);
    }
    setDeleteDialogOpen(false);
    exitSelectMode();
    await load();
  };

  return (
    <Box sx={{ width: '100%', pb: `${BOTTOM_NAV_HEIGHT + SELECT_BAR_HEIGHT}px` }}>
      {!loading && records.length === 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8, px: 4 }}>
          <Typography align="center" color="text.secondary">{t('addressbook.empty_message')}</Typography>
        </Box>
      ) : (
        <List>
          {records.map((record, i) => (
            <Box key={record.id}>
              <ListItemButton onClick={() => onRowTap(record)} sx={{ py: 1.5 }}>
                {selectMode && (
                  <Checkbox edge="start" checked={selectedIds.has(record.id)} tabIndex={-1} disableRipple sx={{ mr: 1 }} />
                )}
                <ListItemAvatar>
                  <Avatar src={record.iconDataUrl || undefined}>
                    {!record.iconDataUrl && <PersonIcon />}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={record.name}
                  secondary={record.reading || undefined}
                />
              </ListItemButton>
              {i < records.length - 1 && <Divider component="li" />}
            </Box>
          ))}
        </List>
      )}

      {!selectMode && (
        <Fab
          color="primary"
          onClick={onAdd}
          aria-label={t('common.add')}
          sx={{ position: 'fixed', bottom: BOTTOM_NAV_HEIGHT + SELECT_BAR_HEIGHT + 16, right: 16, ...menuShiftSx }}
        >
          <AddIcon />
        </Fab>
      )}

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('addressbook.delete_confirm', { count: selectedIds.size })}</DialogTitle>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={onConfirmDelete} color="error">{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>

      {/* Fixed directly above BottomNav (bottom: BOTTOM_NAV_HEIGHT) rather than inline in
         the page flow - see the class doc above for why. */}
      <Box
        sx={{
          position: 'fixed', bottom: BOTTOM_NAV_HEIGHT, right: 0, maxWidth: 480, mx: 'auto',
          minHeight: SELECT_BAR_HEIGHT, display: 'flex', bgcolor: 'background.paper',
          borderTop: 1, borderColor: 'divider', ...menuBarSx,
        }}
      >
        {selectMode ? (
          <>
            <Button
              fullWidth
              onClick={exitSelectMode}
              sx={{ py: 1, borderRadius: 0, display: 'flex', flexDirection: 'column', color: 'text.secondary' }}
            >
              <CloseIcon fontSize="small" />
              <Typography variant="caption">{t('common.cancel')}</Typography>
            </Button>
            <Divider orientation="vertical" flexItem />
            <Button
              fullWidth
              disabled={selectedIds.size === 0}
              onClick={() => setDeleteDialogOpen(true)}
              sx={{ py: 1, borderRadius: 0, display: 'flex', flexDirection: 'column' }}
              color="error"
            >
              <DeleteOutlineOutlinedIcon fontSize="small" />
              <Typography variant="caption">{t('common.delete')}</Typography>
            </Button>
          </>
        ) : (
          <Button
            fullWidth
            onClick={() => setSelectMode(true)}
            disabled={records.length === 0}
            sx={{ py: 1, borderRadius: 0, display: 'flex', flexDirection: 'column', color: 'primary.main' }}
          >
            <CheckIcon fontSize="small" />
            <Typography variant="caption">{t('common.select')}</Typography>
          </Button>
        )}
      </Box>

    </Box>
  );
}

