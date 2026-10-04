import { useState } from 'react';
import { Box, List, ListItemButton, ListItemText, Divider, Dialog, DialogTitle } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MessageDialog from '../../components/MessageDialog';
import ErrorSnackbar from '../../components/ErrorSnackbar';
import { useAppStore } from '../../store/appStore';
import type { AppLanguage, ThemeMode } from '../../store/appStore';
import { PinCodeHelper, WalletsHelper } from '../../lib/storage';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

export default function SettingsTop() {
  const { t } = useTranslation();
  // Each language's own name, shown in its own script regardless of the app's current
  // display language (the standard "endonym" pattern - e.g. always "日本語", never a
  // translated word like "Japanese"/"日本語" depending on which language happens to be
  // active right now).
  const LANGUAGE_OPTIONS: { code: AppLanguage; label: string }[] = [
    { code: 'ja', label: t('settings.language_name_ja') },
    { code: 'en', label: t('settings.language_name_en') },
  ];
  const navigate = useNavigate();
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const THEME_OPTIONS: { code: ThemeMode; label: string }[] = [
    { code: 'dark', label: t('settings.theme_dark') },
    { code: 'light', label: t('settings.theme_light') },
  ];
  const [showLanguageDialog, setShowLanguageDialog] = useState(false);
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');


  // Shows the recovery phrase for whichever wallet is currently active - same
  // caution-screen-then-reveal flow as a single wallet's own "Backup" menu item
  // (see WalletSettings.tsx), just reached from the app-wide settings screen instead. No
  // id is passed - WalletBackup already falls back to the active wallet when id is blank -
  // only `back` is set, so both screens' "←"/"完了" return here instead of a (nonexistent)
  // per-wallet settings URL.
  const goToBackup = () => {
    navigate('/wallet/backup_caution?back=/settings/top&mode=mnemonic');
  };

  // The testnet/mainnet switch that used to live here is gone: Portaldot currently only has
  // its PortaldotV3 Testnet, so there is nothing to switch between.

  // Erases every recovery phrase and private key stored on this device, plus the wallet
  // password itself - keeping it around after logout would let it unlock nothing yet
  // still leak whether the previous user had one set, and would otherwise get reused
  // as the password for whatever wallet is set up next. Irreversible without an external
  // backup, so this always goes through a confirmation dialog. No password check is required
  // here - someone who forgot their password still needs a way to log out, and logging out
  // only erases local data (it doesn't move any assets), so it doesn't need the same
  // gate as deleting a single wallet. Lands on /welcome (not /wallet/select) since
  // there's no wallet left to select from at all after this - matches router.tsx's own
  // fallback for the no-wallets case.
  const performLogout = async () => {
    await WalletsHelper.deleteAll();
    await PinCodeHelper.remove();
    navigate('/welcome');
  };

  const onConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    await performLogout();
  };

  const currentLanguageLabel = LANGUAGE_OPTIONS.find((o) => o.code === language)?.label ?? '';

  const onSelectLanguage = (code: AppLanguage) => {
    setLanguage(code);
    setShowLanguageDialog(false);
  };

  const currentThemeLabel = THEME_OPTIONS.find((o) => o.code === themeMode)?.label ?? '';

  const onSelectTheme = (code: ThemeMode) => {
    setThemeMode(code);
    setShowThemeDialog(false);
  };

  const generalItems = [
    { text: t('settings.language_select'), secondary: currentLanguageLabel, action: () => setShowLanguageDialog(true) },
    { text: t('settings.theme_select'), secondary: currentThemeLabel, action: () => setShowThemeDialog(true) },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <List>
          {generalItems.map((item) => (
            <Box key={item.text}>
              <ListItemButton onClick={item.action}>
                <ListItemText primary={item.text} secondary={item.secondary || undefined} />
                <ChevronRightIcon sx={{ color: 'text.secondary' }} />
              </ListItemButton>
              <Divider />
            </Box>
          ))}
          <ListItemButton onClick={goToBackup}>
            <ListItemText primary={t('common.backup')} />
            <ChevronRightIcon sx={{ color: 'text.secondary' }} />
          </ListItemButton>
          <Divider />
          <ListItemButton onClick={() => setShowLogoutConfirm(true)}>
            <ListItemText primary={t('settings.logout')} />
            <ChevronRightIcon sx={{ color: 'text.secondary' }} />
          </ListItemButton>
        </List>
      </Box>

      <Dialog open={showLanguageDialog} onClose={() => setShowLanguageDialog(false)}>
        <DialogTitle>{t('settings.language_select')}</DialogTitle>
        <List sx={{ minWidth: 240, pt: 0 }}>
          {LANGUAGE_OPTIONS.map((option) => (
            <ListItemButton key={option.code} selected={option.code === language} onClick={() => onSelectLanguage(option.code)}>
              <ListItemText primary={option.label} />
            </ListItemButton>
          ))}
        </List>
      </Dialog>
      <Dialog open={showThemeDialog} onClose={() => setShowThemeDialog(false)}>
        <DialogTitle>{t('settings.theme_select')}</DialogTitle>
        <List sx={{ minWidth: 240, pt: 0 }}>
          {THEME_OPTIONS.map((option) => (
            <ListItemButton key={option.code} selected={option.code === themeMode} onClick={() => onSelectTheme(option.code)}>
              <ListItemText primary={option.label} />
            </ListItemButton>
          ))}
        </List>
      </Dialog>
      <MessageDialog
        open={showLogoutConfirm}
        title={t('settings.logout_confirm_title')}
        texts={t('settings.logout_confirm_message', { returnObjects: true }) as string[]}
        selectable
        onClose={onConfirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage('')} />
    </Box>
  );
}
