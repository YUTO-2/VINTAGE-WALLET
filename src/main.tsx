import { StrictMode, useEffect, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, CssBaseline } from '@mui/material'
import App from './App.tsx'
import { createRaccoonTheme } from './theme/raccoonTheme'
import { Storage, CustomChainsHelper } from './lib/storage'
import { useAppStore } from './store/appStore'
import './i18n'

// localForage's driver (IndexedDB → WebSQL → localStorage fallback) must be configured
// before any Storage/WalletsHelper read happens. Previously this call didn't exist
// anywhere, so a browser/profile where IndexedDB throws at open time (a completely fresh
// browser profile, some privacy modes, file:// origins) never fell back to WebSQL/
// localStorage — the wallet-detection read in router.tsx's RootRedirect would reject
// silently, leaving RootRedirect stuck and never reaching /welcome.
Storage.setup();

// This wallet supports Portaldot only. Clean up anything an older multi-chain version may
// have left behind: hand-added custom EVM chains (and their tokens), and persisted UI state
// that points at a chain / currency that no longer exists (e.g. activeChain 'ethereum',
// sendCurrency 'jpyc', or a custom chain id for the send flow).
CustomChainsHelper.purgeLegacy().catch((e) => console.error('Failed to purge legacy custom chains', e));
{
  const state = useAppStore.getState();
  if (state.activeChain !== 'portaldot') state.setActiveChain('portaldot');
  if (state.sendCurrency === 'jpyc') state.setSendCurrency('native');
  if (state.sendCustomChainId !== null) state.setSendCustomChainId(null);
  if (state.networkMode !== 'mainnet') state.setNetworkMode('mainnet');
}

// Builds the MUI theme from the dark / white choice in 設定 > テーマ (persisted in the app store),
// and mirrors it onto <html> so index.css, the browser's colour-scheme (scrollbars, form
// controls) and the mobile browser chrome (theme-color) follow it too.
function ThemedApp() {
  const mode = useAppStore((s) => s.themeMode);
  const theme = useMemo(() => createRaccoonTheme(mode), [mode]);
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'dark' ? '#0A0612' : '#F6F5FB');
  }, [mode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemedApp />
  </StrictMode>,
)
