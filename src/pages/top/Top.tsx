import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import Receive from './Receive';
import Home from './Home';
import Send from './Send';

type TabKey = 'receive' | 'home' | 'send';

// Ported from src/components/pages/top/Top.vue. Vuetify's v-tabs-items kept every tab's
// component mounted (just hidden) so state like the in-progress Send address wasn't lost
// when switching tabs; this keeps that same behavior by rendering every tab and toggling
// visibility with `display`, rather than conditionally mounting only the active one.
export default function Top() {
  const [searchParams] = useSearchParams();
  const [displayTab, setDisplayTab] = useState<TabKey>('home');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['receive', 'home', 'send'].includes(tab)) {
      setDisplayTab(tab as TabKey);
    }
  }, [searchParams]);

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <Box sx={{ minHeight: '100vh', pb: 2 }}>
        <Box sx={{ display: displayTab === 'receive' ? 'block' : 'none' }}><Receive /></Box>
        <Box sx={{ display: displayTab === 'home' ? 'block' : 'none' }}><Home needsUpdate={displayTab === 'home'} /></Box>
        <Box sx={{ display: displayTab === 'send' ? 'block' : 'none' }}><Send /></Box>
      </Box>
    </Box>
  );
}
