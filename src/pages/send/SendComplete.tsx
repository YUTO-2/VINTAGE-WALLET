import { Box, AppBar, Toolbar, Typography, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CHAINS } from '../../lib/chains';
import type { ChainKey } from '../../lib/chains';
import { useAppStore } from '../../store/appStore';
import bgTop from '../../assets/image_transaction_background_top.png';
import bgBottom from '../../assets/image_transaction_background_bottom.png';

export default function SendComplete() {
  const { t } = useTranslation();
  const txHash = useAppStore((s) => s.lastTxHash);
  const activeChain = useAppStore((s) => s.activeChain) as ChainKey;

  // Portaldot has no Etherscan-style explorer yet (blockExplorerUrl is ''), in which case the
  // "Transaction" button below is simply omitted, same as the empty-hash case.
  const explorerBase = CHAINS[activeChain].blockExplorerUrl;
  const explorerUrl = explorerBase ? `${explorerBase}/tx/${txHash}` : null;

  return (
    <Box>
      <AppBar position="sticky" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6">{t('send.complete_title')}</Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box component="img" src={bgTop} sx={{ width: '100%', maxWidth: 480 }} />

        <Typography align="center" sx={{ fontSize: 'x-large', color: 'primary.main', mt: '-48px' }}>
          {(t('send.complete_message', { returnObjects: true }) as string[]).map((line, i) => (
            <span key={i}>{line}<br /></span>
          ))}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', zIndex: 1, width: '100%', maxWidth: 480, px: 2, gap: 1 }}>
          <Button component={RouterLink} to="/top?tab=home" variant="contained" color="primary" fullWidth>HOME</Button>
          {txHash && explorerUrl && (
            <Button href={explorerUrl} target="_blank" rel="noopener" variant="contained" fullWidth sx={{ bgcolor: 'nemOrange', color: 'white' }}>
              Transaction
            </Button>
          )}
        </Box>

        <Box sx={{ maxWidth: 480, ml: 'auto', mr: 0, display: 'block', mt: 2 }}>
          <Box component="img" src={bgBottom} sx={{ width: '100%', mb: '-8px' }} />
        </Box>
      </Box>
    </Box>
  );
}
