import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { List, ListItemButton, ListItemIcon, ListItemText, Box, Divider, Typography, Avatar, IconButton, Tooltip, useTheme } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import TokenOutlinedIcon from '@mui/icons-material/TokenOutlined';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import ContactsOutlinedIcon from '@mui/icons-material/ContactsOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WalletsHelper } from '../lib/storage';
import ErrorSnackbar from './ErrorSnackbar';
import logoPyoko from '../assets/logo_pyoko.png';

// Portaldot palette for the side menu, one per colour scheme (dark: navy-violet panel; white: light
// panel), both with the purple->blue active pill.
const MENU_PALETTE = {
  dark: {
    panel: 'linear-gradient(180deg, #120b3a 0%, #090620 100%)',
    text: '#ECE9FF',
    icon: '#A9A5D6',
    line: 'rgba(255, 255, 255, 0.10)',
    hover: 'rgba(255, 255, 255, 0.07)',
    shadow: '2px 0 18px rgba(0, 0, 0, 0.45)',
  },
  light: {
    panel: 'linear-gradient(180deg, #FFFFFF 0%, #F1EEFB 100%)',
    text: '#1D1A3A',
    icon: '#6E6990',
    line: 'rgba(20, 10, 60, 0.10)',
    hover: 'rgba(20, 10, 60, 0.06)',
    shadow: '2px 0 14px rgba(60, 30, 140, 0.12)',
  },
} as const;
// Width of the collapsed icon rail; the header cells below use it so icons keep their x position.
const RAIL_WIDTH_PX = 72;
const ACTIVE_BG = 'linear-gradient(90deg, #7B2FF0 0%, #0A84FF 100%)';

interface NavigationDrawerProps {
  // true = full menu with labels; false = narrow icon rail (the "closed" state).
  expanded: boolean;
  onToggle: () => void;
}

// Ported from src/components/parts/NavigationDrawer.vue. A full-height sidebar fixed to the left
// edge, always visible as a narrow icon rail and widened to a labelled menu by its hamburger
// button (see MenuShell, which makes room for it next to the page). It is never closed
// automatically: navigating, tapping an entry or pressing Escape leave it as it is - only the
// hamburger toggles it.
export default function NavigationDrawer({ expanded, onToggle }: NavigationDrawerProps) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const tab = new URLSearchParams(search).get('tab');
  const { t } = useTranslation();
  const M = MENU_PALETTE[useTheme().palette.mode];
  const TEXT = M.text;
  const ICON = M.icon;
  const LINE = M.line;
  const [walletName, setWalletName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    (async () => {
      const wallet = await WalletsHelper.getActive();
      if (wallet === null) {
        setWalletName(t('common.not_select'));
      } else {
        setWalletName(wallet.name);
      }
    })();
  }, [t, pathname]);

  const iconSx = { color: 'inherit' };
  const items: ({ title: string; icon: ReactNode; active: boolean; action: () => void } | null)[] = [
    { title: 'Home', icon: <HomeOutlinedIcon sx={iconSx} />, active: pathname === '/top' && (tab === null || tab === 'home'), action: () => navigate('/top?tab=home', { replace: true }) },
    { title: t('home.receive'), icon: <CallReceivedIcon sx={iconSx} />, active: pathname === '/top' && tab === 'receive', action: () => navigate('/top?tab=receive', { replace: true }) },
    { title: t('home.send'), icon: <SendOutlinedIcon sx={iconSx} />, active: pathname === '/top' && tab === 'send', action: () => navigate('/top?tab=send', { replace: true }) },
    { title: t('home.nav_token'), icon: <TokenOutlinedIcon sx={iconSx} />, active: pathname.startsWith('/balance'), action: () => navigate('/balance') },
    { title: 'NFT', icon: <CollectionsOutlinedIcon sx={iconSx} />, active: pathname.startsWith('/nft'), action: () => navigate('/nft') },
    { title: t('home.nav_address'), icon: <ContactsOutlinedIcon sx={iconSx} />, active: pathname.startsWith('/addressbook'), action: () => navigate('/addressbook') },
    { title: t('wallet.switch'), icon: <AccountBalanceWalletOutlinedIcon sx={iconSx} />, active: pathname.startsWith('/wallet'), action: () => navigate('/wallet/select') },
    null,
    { title: 'About', icon: <InfoOutlinedIcon sx={iconSx} />, active: pathname.startsWith('/about'), action: () => navigate('/about') },
    { title: t('common.settings'), icon: <SettingsOutlinedIcon sx={iconSx} />, active: pathname.startsWith('/settings'), action: () => navigate('/settings/top') },
  ];

  // The avatar is always the default mascot now that the profile screen (and its custom icon) is gone.
  const avatar = (size: number) => (
    <Avatar sx={{ width: size, height: size, bgcolor: 'rgba(123, 47, 240, 0.25)', flexShrink: 0 }}>
      <Box component="img" src={logoPyoko} sx={{ width: '75%' }} />
    </Avatar>
  );

  return (
    <>
      <Box
        component="nav"
        aria-label="menu"
        sx={{
          position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 1200,
          width: expanded ? 'var(--menu-width, 280px)' : 'var(--rail-width, 72px)',
          transition: 'width 0.25s ease',
          background: M.panel, color: TEXT, overflowY: 'auto', overflowX: 'hidden',
          borderRight: `1px solid ${LINE}`, boxShadow: M.shadow,
        }}
      >
        {/* One header layout for both states, so the hamburger and the avatar never move:
            each sits in a cell exactly as wide as the collapsed rail (RAIL_WIDTH_PX), centred,
            and the rows are top-aligned. Expanding only adds the name next to the avatar. */}
        <Box
          sx={{
            borderBottom: `1px solid ${LINE}`, pt: 1, pb: 1.5,
          }}
        >
          <Box sx={{ width: RAIL_WIDTH_PX, display: 'flex', justifyContent: 'center' }}>
            <IconButton
              onClick={onToggle}
              aria-label={expanded ? 'collapse menu' : 'expand menu'}
              aria-expanded={expanded}
              sx={{ color: TEXT }}
            >
              <MenuIcon />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', mt: 1 }}>
            <Box sx={{ width: RAIL_WIDTH_PX, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
              <Tooltip title={expanded ? '' : walletName} placement="right">
                <Box sx={{ display: 'flex' }}>{avatar(40)}</Box>
              </Tooltip>
            </Box>
            {expanded && (
              <Box sx={{ minWidth: 0, pr: 2, mt: '-2px' }}>
                <Typography sx={{ fontSize: 'large', color: TEXT, wordBreak: 'break-all' }}>{walletName}</Typography>
              </Box>
            )}
          </Box>
        </Box>

        <List sx={{ px: 1.5, py: 1.5 }}>
          {items.map((item, i) =>
            item === null ? (
              <Divider key={i} sx={{ my: 1, borderColor: LINE }} />
            ) : (
              <Tooltip key={item.title} title={expanded ? '' : item.title} placement="right">
                <ListItemButton
                  onClick={item.action}
                  selected={item.active}
                  sx={{
                    borderRadius: '14px', mb: 0.5, py: 1.25, px: '12px', overflow: 'hidden', color: item.active ? 'white' : ICON,
                    '&.Mui-selected, &.Mui-selected:hover': { background: ACTIVE_BG, boxShadow: '0 6px 16px rgba(123, 47, 240, 0.40)' },
                    '&:hover': { bgcolor: M.hover },
                  }}
                >
                  {/* Same x position as the icon in the collapsed rail, so widening the menu only
                     reveals the labels instead of moving the icons. */}
                  <ListItemIcon sx={{ color: 'inherit', minWidth: 24 }}>{item.icon}</ListItemIcon>
                  <ListItemText
                    primary={item.title}
                    sx={{ ml: 2, whiteSpace: 'nowrap' }}
                    slotProps={{ primary: { sx: { color: item.active ? 'white' : TEXT, fontWeight: item.active ? 600 : 400 } } }}
                  />
                </ListItemButton>
              </Tooltip>
            )
          )}
        </List>
      </Box>
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage('')} />
    </>
  );
}
