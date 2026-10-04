import { createTheme } from '@mui/material/styles';
import type { ThemeMode } from '../store/appStore';

// Ported 1:1 from the Vue app's src/raccoonTheme.json — keeping the same visual identity
// during the framework migration.
declare module '@mui/material/styles' {
  interface Palette {
    textSlightGray: string;
    textGray: string;
    textDarkGray: string;
    textLightGray: string;
    nemBlue: string;
    nemOrange: string;
    nemGreen: string;
  }
  interface PaletteOptions {
    textSlightGray?: string;
    textGray?: string;
    textDarkGray?: string;
    textLightGray?: string;
    nemBlue?: string;
    nemOrange?: string;
    nemGreen?: string;
  }
}

// Portaldot look, shared with the Welcome screen: dark navy-violet space background, the logo's
// purple -> blue gradient for primary actions, and softly bordered "glass" cards.
const PURPLE = '#7B2FF0';
const BLUE = '#0A84FF';
const GRADIENT = `linear-gradient(90deg, ${PURPLE} 0%, ${BLUE} 100%)`;

// Per-mode colour tokens. 'dark' is the original look; 'light' is the white variant. The grey
// scale is deliberately different: dark inverts it (so grey.100 / grey.200 "subtle panels" stay
// subtle on a dark page), light uses a normal light-to-dark scale.
const TOKENS = {
  dark: {
    BG: '#07051A',
    PAPER: '#120d33',
    LINE: 'rgba(255,255,255,0.10)',
    primary: { main: '#8B5CF6', light: '#A98BFF', dark: PURPLE, contrastText: '#fff' },
    secondary: '#9C99C9',
    text: { primary: '#F1EEFF', secondary: 'rgba(241,238,255,0.68)', disabled: 'rgba(241,238,255,0.4)' },
    grey: {
      50: '#0f0b2b', 100: '#171238', 200: '#201a48', 300: '#2b2560', 400: '#3d3778',
      500: '#57518f', 600: '#4b4585', 700: '#6f69a8', 800: '#9d98c9', 900: '#c8c5e6',
    },
    textSlightGray: '#9a98b5', textGray: '#b3b1cc', textDarkGray: '#c4c2da', textLightGray: '#8886a5',
    bodyBg: 'radial-gradient(ellipse at 50% -10%, #241062 0%, #07051A 62%) fixed',
    paperShadow: '0 4px 24px rgba(0,0,0,0.35)',
    cardBorder: '1px solid rgba(139,92,246,0.22)',
    cardBg: 'rgba(24,16,64,0.72)',
    appBarBg: 'rgba(10,6,36,0.88)',
    appBarText: '#F1EEFF',
    dialogBorder: '1px solid rgba(139,92,246,0.28)',
    btnDisabledBg: 'rgba(255,255,255,0.10)',
    btnDisabledText: 'rgba(255,255,255,0.35)',
  },
  light: {
    BG: '#F6F5FB',
    PAPER: '#FFFFFF',
    LINE: 'rgba(20,10,60,0.10)',
    primary: { main: '#6D3FE0', light: '#8B5CF6', dark: PURPLE, contrastText: '#fff' },
    secondary: '#6E6990',
    text: { primary: '#1D1A3A', secondary: 'rgba(29,26,58,0.68)', disabled: 'rgba(29,26,58,0.4)' },
    grey: {
      50: '#FAF9FE', 100: '#F1EFF9', 200: '#E6E3F2', 300: '#D3CFE6', 400: '#B4AFD0',
      500: '#8C87AC', 600: '#6E6990', 700: '#57527A', 800: '#3D3960', 900: '#26234A',
    },
    textSlightGray: '#7A7799', textGray: '#66638A', textDarkGray: '#4A4770', textLightGray: '#9A98B8',
    bodyBg: 'radial-gradient(ellipse at 50% -10%, #E7DEFF 0%, #F6F5FB 62%) fixed',
    paperShadow: '0 4px 20px rgba(60,30,140,0.10)',
    cardBorder: '1px solid rgba(123,47,240,0.16)',
    cardBg: '#FFFFFF',
    appBarBg: 'rgba(255,255,255,0.92)',
    appBarText: '#1D1A3A',
    dialogBorder: '1px solid rgba(123,47,240,0.20)',
    btnDisabledBg: 'rgba(20,10,60,0.08)',
    btnDisabledText: 'rgba(20,10,60,0.35)',
  },
} as const;

export function createRaccoonTheme(mode: ThemeMode) {
  const k = TOKENS[mode];
  return createTheme({
    palette: {
      mode,
      primary: k.primary,
      secondary: { main: k.secondary },
      error: { main: mode === 'dark' ? '#FF6B81' : '#D93851' },
      info: { main: BLUE },
      success: { main: mode === 'dark' ? '#3DDC97' : '#1FA971' },
      warning: { main: '#FFC107' },
      background: { default: k.BG, paper: k.PAPER },
      text: k.text,
      divider: k.LINE,
      grey: k.grey,
      textSlightGray: k.textSlightGray,
      textGray: k.textGray,
      textDarkGray: k.textDarkGray,
      textLightGray: k.textLightGray,
      nemBlue: BLUE,
      nemOrange: '#F7A800',
      nemGreen: mode === 'dark' ? '#3DDC97' : '#1FA971',
    },
    shape: { borderRadius: 16 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { background: k.bodyBg, backgroundColor: k.BG, minHeight: '100svh' },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          elevation1: { boxShadow: k.paperShadow },
        },
      },
      MuiCard: {
        styleOverrides: { root: { border: k.cardBorder, backgroundColor: k.cardBg } },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          colorDefault: {
            backgroundColor: k.appBarBg,
            backdropFilter: 'blur(10px)',
            color: k.appBarText,
            borderBottom: `1px solid ${k.LINE}`,
          },
        },
      },
      MuiDialog: { styleOverrides: { paper: { border: k.dialogBorder } } },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 700,
            '&.MuiButton-containedPrimary': {
              background: GRADIENT,
              color: '#fff',
              boxShadow: '0 6px 20px rgba(123,47,240,0.40)',
              '&:hover': { background: 'linear-gradient(90deg, #8F4BFF 0%, #3DA0FF 100%)', boxShadow: '0 8px 26px rgba(123,47,240,0.55)' },
              '&.Mui-disabled': { background: k.btnDisabledBg, boxShadow: 'none', color: k.btnDisabledText },
            },
            '&.MuiButton-outlinedPrimary': { borderColor: 'rgba(139,92,246,0.55)' },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            '&.Mui-selected': { backgroundColor: 'rgba(123,47,240,0.18)' },
            '&.Mui-selected:hover': { backgroundColor: 'rgba(123,47,240,0.26)' },
          },
        },
      },
      MuiBottomNavigation: { styleOverrides: { root: { borderTop: `1px solid ${k.LINE}` } } },
    },
  });
}
