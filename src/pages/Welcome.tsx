import { Box, Button, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { keyframes } from '@mui/system';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import logoPyoko from '../assets/logo_pyoko.png';
import { useAppStore } from '../store/appStore';
import type { AppLanguage } from '../store/appStore';
import { CHAINS, DEFAULT_CHAIN } from '../lib/chains';

// アプリを一番最初に起動したとき、またはウォレットが1件も無いときに表示するウェルカム画面。
// Portaldot Network 向けのデザイン: ダークな宇宙背景 + Portaldot ロゴの紫→青グラデーション(#7B2FF0 → #0A84FF)の「ポータル(輪)とドット」。
// 中央に Portaldot ロゴを置く。
// ここでの唯一のアクションは「GET STARTED」で、ウォレット選択画面（/wallet/select）へ進む。
// 言語切替トグル（日本語／English）はSettingsTop.tsxと同じsetLanguageを使う。
const PINK = '#7B2FF0'; // logo purple
const PINK_SOFT = '#0A84FF'; // logo blue
const BG = '#07051A';

const spin = keyframes`from { transform: rotate(0deg); } to { transform: rotate(360deg); }`;
const spinReverse = keyframes`from { transform: rotate(360deg); } to { transform: rotate(0deg); }`;
const pulse = keyframes`0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 0.9; transform: scale(1.06); }`;

const reducedMotion = '@media (prefers-reduced-motion: reduce)';

function PortalGraphic() {
  const SIZE = 248;
  return (
    <Box sx={{ position: 'relative', width: SIZE, height: SIZE, mb: 4, flexShrink: 0, maxWidth: '70vw', maxHeight: '70vw' }}>
      {/* soft glow behind the rings */}
      <Box
        sx={{
          position: 'absolute', inset: -40, borderRadius: '50%',
          background: `radial-gradient(circle, ${PINK}66 0%, ${PINK}22 45%, transparent 70%)`,
          animation: `${pulse} 4s ease-in-out infinite`,
          [reducedMotion]: { animation: 'none' },
        }}
      />
      {/* outer dashed ring, slowly turning, with an orbiting dot (the "dot" of Portaldot) */}
      <Box sx={{ position: 'absolute', inset: 0, animation: `${spin} 22s linear infinite`, [reducedMotion]: { animation: 'none' } }}>
        <svg viewBox="0 0 248 248" width="100%" height="100%" aria-hidden>
          <circle cx="124" cy="124" r="120" fill="none" stroke={PINK} strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="2 9" strokeLinecap="round" />
          <circle cx="124" cy="4" r="6" fill={PINK_SOFT} />
          <circle cx="124" cy="4" r="11" fill="none" stroke={PINK_SOFT} strokeOpacity="0.4" />
        </svg>
      </Box>
      {/* middle ring, turning the other way */}
      <Box sx={{ position: 'absolute', inset: 22, animation: `${spinReverse} 30s linear infinite`, [reducedMotion]: { animation: 'none' } }}>
        <svg viewBox="0 0 204 204" width="100%" height="100%" aria-hidden>
          <defs>
            <linearGradient id="portalRing" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={PINK_SOFT} />
              <stop offset="0.55" stopColor={PINK} stopOpacity="0.2" />
              <stop offset="1" stopColor={PINK_SOFT} />
            </linearGradient>
          </defs>
          <circle cx="102" cy="102" r="98" fill="none" stroke="url(#portalRing)" strokeWidth="3" />
          <circle cx="102" cy="200" r="4" fill="#fff" />
        </svg>
      </Box>
      {/* inner solid ring + the Portaldot logo in the middle of the portal */}
      <Box
        sx={{
          position: 'absolute', inset: 48, borderRadius: '50%',
          background: `radial-gradient(circle at 50% 35%, #150c3a 0%, ${BG} 75%)`,
          border: `2px solid ${PINK}`,
          boxShadow: `0 0 28px ${PINK}99, inset 0 0 24px ${PINK}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Box component="img" src={logoPyoko} alt="Portaldot" sx={{ width: '58%', height: '58%', objectFit: 'contain' }} />
      </Box>
    </Box>
  );
}

export default function Welcome() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const chain = CHAINS[DEFAULT_CHAIN];

  const onChangeLanguage = (_: React.MouseEvent<HTMLElement>, value: AppLanguage | null) => {
    if (value) setLanguage(value);
  };

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100svh',
        width: '100%',
        boxSizing: 'border-box',
        color: '#fff',
        textAlign: 'center',
        px: 3,
        py: 5,
        overflow: 'hidden',
        background: `radial-gradient(ellipse at 50% 18%, #241062 0%, ${BG} 62%)`,
      }}
    >
      {/* faint dot grid */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.35,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse at center, #000 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, #000 20%, transparent 75%)',
        }}
      />

      <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <PortalGraphic />

        <Typography sx={{ fontSize: 14, fontWeight: 700, letterSpacing: 4, color: PINK_SOFT, textTransform: 'uppercase' }}>
          {t('wallet.welcome_title_1')}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.25, mt: 0.5, mb: 2, letterSpacing: 0.5 }}>
          {t('wallet.welcome_title_2')}
        </Typography>

        <Typography variant="body2" sx={{ opacity: 0.8, mb: 3, maxWidth: 420 }}>
          {t('wallet.welcome_subtitle')}
        </Typography>

        {/* Network badge: which chain this wallet talks to */}
        <Box
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 1, mb: 5, px: 1.75, py: 0.75, borderRadius: 999,
            border: `1px solid ${PINK}88`, bgcolor: 'rgba(123, 47, 240, 0.16)', fontSize: 13, fontWeight: 600,
          }}
        >
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#3DDC97', boxShadow: '0 0 8px #3DDC97' }} />
          {chain.name}
          <Box component="span" sx={{ opacity: 0.6, fontWeight: 400 }}>· {chain.nativeCurrency.symbol}</Box>
        </Box>

        <Button
          variant="contained"
          onClick={() => navigate('/wallet/select')}
          sx={{
            width: '100%',
            maxWidth: 320,
            py: 1.5,
            borderRadius: 999,
            fontWeight: 800,
            letterSpacing: 2,
            color: '#fff',
            background: `linear-gradient(90deg, ${PINK} 0%, ${PINK_SOFT} 100%)`,
            boxShadow: `0 8px 28px ${PINK}66`,
            '&:hover': { background: `linear-gradient(90deg, #8F4BFF 0%, #3DA0FF 100%)`, boxShadow: `0 10px 34px ${PINK}99` },
          }}
        >
          {t('wallet.welcome_get_started')}
        </Button>

        <ToggleButtonGroup
          value={language}
          exclusive
          onChange={onChangeLanguage}
          size="small"
          sx={{
            mt: 3,
            bgcolor: 'rgba(255,255,255,0.08)',
            borderRadius: 999,
            p: 0.5,
            '& .MuiToggleButton-root': {
              border: 'none',
              borderRadius: 999,
              px: 2.5,
              py: 0.5,
              color: 'rgba(255,255,255,0.8)',
              fontWeight: 700,
              textTransform: 'none',
              '&.Mui-selected': {
                bgcolor: PINK,
                color: '#fff',
                '&:hover': { bgcolor: PINK_SOFT },
              },
            },
          }}
        >
          <ToggleButton value="ja">{t('settings.language_name_ja')}</ToggleButton>
          <ToggleButton value="en">{t('settings.language_name_en')}</ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Box>
  );
}
