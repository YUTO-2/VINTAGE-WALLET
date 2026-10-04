import { useEffect, useState } from 'react';
import { Avatar, Box, Button, InputAdornment, Menu, MenuItem, TextField, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import { CHAINS, DEFAULT_CHAIN, fetchBalances, fetchTokenBalances } from '../../lib/chains';
import type { ChainKey } from '../../lib/chains';
import { CHAIN_ICONS } from '../../lib/chainIcons';
import { getTokenIcon } from '../../lib/tokenIcons';
import { WalletsHelper, CustomTokensHelper } from '../../lib/storage';
import { useAppStore } from '../../store/appStore';
import { useNavigate } from 'react-router-dom';

// Rounded "grey card" look shared by the chain/token pickers on this screen.
const CARD_SX = { bgcolor: 'grey.100', borderRadius: 5, px: 2, py: 1.5 } as const;

// One selectable entry in the asset dropdown: Portaldot's native coin (tPOTv3), or an ERC-20
// token the person registered by contract address. (JPYC is not deployed on Portaldot, so
// there is no JPYC entry.) `key` is "portaldot|native" / "portaldot|0xAbc..." etc.
interface AssetOption {
  key: string;
  currency: 'native' | 'token';
  symbol: string;
  balance: string;
  tokenMeta: { address: string; symbol: string; decimals: number } | null;
}

// Largest number of decimal places the amount field accepts when the asset's own decimals are
// unknown yet (the chain's native coin uses 18 on the EVM RPC).
const FALLBACK_DECIMALS = 18;

// The store keeps the amount as a plain string ('0' = nothing entered). A QR scan can leave an
// exponent form like "1e-7" there, which a text field can't edit, so expand it first.
function toPlainAmount(formula: string): string {
  if (formula === '0' || formula === '') return '';
  const n = Number(formula);
  if (/e/i.test(formula) && isFinite(n)) return n.toFixed(FALLBACK_DECIMALS).replace(/\.?0+$/, '');
  return formula;
}

// Keep only what a decimal amount can contain: digits and a single '.', limited to `decimals`
// places. A comma (some keyboards) is accepted as the decimal point.
function sanitizeAmount(raw: string, decimals: number): string {
  let s = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const dot = s.indexOf('.');
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '');
  const [whole, frac] = s.split('.');
  if (frac !== undefined) s = `${whole}.${frac.slice(0, decimals)}`;
  return s;
}

const optionKey = (currency: string) => `${DEFAULT_CHAIN}|${currency}`;

export default function SendAmount() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const calculatorFormula = useAppStore((s) => s.calculatorFormula);
  const setCalculatorFormula = useAppStore((s) => s.setCalculatorFormula);
  const setCalculatorValue = useAppStore((s) => s.setCalculatorValue);
  const sendCurrency = useAppStore((s) => s.sendCurrency);
  const setActiveChain = useAppStore((s) => s.setActiveChain);
  const setSendCurrency = useAppStore((s) => s.setSendCurrency);
  const setSendTokenMeta = useAppStore((s) => s.setSendTokenMeta);

  const chain: ChainKey = DEFAULT_CHAIN;
  const [assetOptions, setAssetOptions] = useState<AssetOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [tokenMenuAnchor, setTokenMenuAnchor] = useState<null | HTMLElement>(null);
  // What the person has typed. Seeded from the store so coming back from the confirmation
  // screen (or a scanned QR's amount) shows the amount again.
  const [amountText, setAmountText] = useState(() => toPlainAmount(calculatorFormula));

  // This wallet only ever sends on Portaldot - pin the active chain and clear leftovers from
  // older versions (custom chains, JPYC as the default currency).
  useEffect(() => {
    setActiveChain(chain);
    if (sendCurrency === 'jpyc') {
      setSendCurrency('native');
      setSendTokenMeta(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Everything the active wallet can send: tPOTv3 first, then any registered tokens.
  useEffect(() => {
    (async () => {
      setLoadingOptions(true);
      const activeWallet = await WalletsHelper.getActive();
      if (activeWallet == null) {
        setAssetOptions([]);
        setLoadingOptions(false);
        return;
      }
      try {
        const customTokens = await CustomTokensHelper.list(chain);
        const [balances, tokens] = await Promise.all([
          fetchBalances(chain, activeWallet.address),
          fetchTokenBalances(chain, activeWallet.address, customTokens),
        ]);
        setAssetOptions([
          { key: optionKey('native'), currency: 'native', symbol: CHAINS[chain].nativeCurrency.symbol, balance: balances.native, tokenMeta: null },
          ...tokens.map((token): AssetOption => ({
            key: optionKey(token.address),
            currency: 'token',
            symbol: token.symbol,
            balance: token.balance,
            tokenMeta: { address: token.address, symbol: token.symbol, decimals: token.decimals },
          })),
        ]);
      } catch (e) {
        console.error('Failed to load asset options', e);
      } finally {
        setLoadingOptions(false);
      }
    })();
  }, [chain]);

  // The selected asset is derived from the store (sendCurrency), so a token pre-selected on
  // the Token screen shows up already selected here too.
  const effectiveCurrency = sendCurrency === 'jpyc' ? 'native' : sendCurrency;
  const selectedKey = optionKey(effectiveCurrency);
  const selectedOption = assetOptions.find((o) => o.key === selectedKey) ?? null;
  const currencyLabel = selectedOption?.symbol ?? CHAINS[chain].nativeCurrency.symbol;
  const availableBalance = selectedOption?.balance ?? '0.0';

  const amountDecimals = selectedOption?.tokenMeta?.decimals ?? CHAINS[chain].nativeCurrency.decimals ?? FALLBACK_DECIMALS;
  const amountNumber = amountText === '' || amountText === '.' ? 0 : Number(amountText);
  const overBalance = isFinite(amountNumber) && amountNumber > Number(availableBalance);
  const canGo = isFinite(amountNumber) && amountNumber > 0 && !overBalance;

  const onChangeAmount = (raw: string) => {
    const next = sanitizeAmount(raw, amountDecimals);
    setAmountText(next);
    // Mirror into the store as a clean number string ('0' when empty) for the next screens.
    const normalized = next === '' || next === '.' ? '0' : next.replace(/\.$/, '').replace(/^\./, '0.');
    setCalculatorFormula(normalized);
    setCalculatorValue(Number(normalized));
  };

  const assetIcon = (option: AssetOption | null): string | null => {
    if (!option) return null;
    if (option.currency === 'native') return CHAIN_ICONS[chain];
    return getTokenIcon(option.symbol);
  };

  const onSelectAsset = (key: string) => {
    const option = assetOptions.find((o) => o.key === key);
    if (!option) return;
    if (option.currency === 'token' && option.tokenMeta) {
      setSendCurrency(option.tokenMeta.address);
      setSendTokenMeta(option.tokenMeta);
    } else {
      setSendCurrency('native');
      setSendTokenMeta(null);
    }
  };

  return (
    <Box sx={{ height: '100%' }}>
      <AppToolBar back="/top?tab=send" title={t('qrlab.amount_title')} />
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {/* Step 1: チェーン - Portaldot is the only network, so this is a fixed label. */}
        <Box sx={{ px: 2, mt: 2 }}>
          <Typography sx={{ fontWeight: 'bold', mb: 1 }}>{t('send.chain_label')}</Typography>
          <Box sx={{ ...CARD_SX, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar src={CHAIN_ICONS[chain]} sx={{ width: 32, height: 32 }} />
            <Typography sx={{ fontWeight: 'bold' }}>{CHAINS[chain].name}</Typography>
          </Box>
        </Box>

        {/* Step 2: トークン - pick which asset on that chain to send (scoped to the chain
            chosen above). */}
        <Box sx={{ px: 2, mt: 2 }}>
          <Typography sx={{ fontWeight: 'bold', mb: 1 }}>{t('send.token_label')}</Typography>
          <Box
            onClick={(e) => assetOptions.length > 0 && setTokenMenuAnchor(e.currentTarget)}
            sx={{
              ...CARD_SX, display: 'inline-flex', alignItems: 'center', gap: 1,
              cursor: assetOptions.length > 0 ? 'pointer' : 'default',
            }}
          >
            <Avatar src={assetIcon(selectedOption) ?? undefined} sx={{ width: 24, height: 24, fontSize: 12 }}>
              {currencyLabel.charAt(0)}
            </Avatar>
            <Typography sx={{ fontWeight: 'bold' }}>
              {loadingOptions ? t('common.loading') : (currencyLabel || t('send.select_token'))}
            </Typography>
            <ExpandMoreIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          </Box>
          <Menu anchorEl={tokenMenuAnchor} open={!!tokenMenuAnchor} onClose={() => setTokenMenuAnchor(null)}>
            {assetOptions.map((option) => (
              <MenuItem
                key={option.key}
                selected={option.key === selectedKey}
                onClick={() => { onSelectAsset(option.key); setTokenMenuAnchor(null); }}
              >
                <Avatar src={assetIcon(option) ?? undefined} sx={{ width: 24, height: 24, mr: 1.5, fontSize: 12 }}>
                  {option.symbol.charAt(0)}
                </Avatar>
                {option.symbol}
              </MenuItem>
            ))}
            {assetOptions.length === 0 && <MenuItem disabled>{t('send.select_token')}</MenuItem>}
          </Menu>
        </Box>

        {/* Step 3: 金額 - typed straight into the field (the keypad was removed). */}
        <Box sx={{ px: 2, mt: 3 }}>
          <Typography sx={{ color: 'primary.main', mb: 1 }}>{t('common.amount')}</Typography>
          <TextField
            value={amountText}
            onChange={(e) => onChangeAmount(e.target.value)}
            placeholder={t('send.amount_placeholder')}
            fullWidth
            autoFocus
            error={overBalance}
            slotProps={{
              htmlInput: { inputMode: 'decimal', autoComplete: 'off', 'aria-label': t('common.amount'), style: { fontSize: '1.6rem' } },
              input: { endAdornment: <InputAdornment position="end"><Typography sx={{ fontWeight: 'bold' }}>{currencyLabel}</Typography></InputAdornment> },
            }}
          />
          <Typography sx={{ color: '#929292', fontSize: 12, mt: 1 }}>
            {t('send.available_balance')}: {availableBalance} {currencyLabel}
          </Typography>
          {overBalance && (
            <Typography sx={{ color: 'error.main', fontSize: 12, mt: 0.5 }}>
              {t('chain.insufficient_balance_error')}
            </Typography>
          )}
        </Box>
      </Box>
      <Box sx={{ position: 'sticky', bottom: 0, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider', px: 2, py: 1.5, mt: 3 }}>
        <Box sx={{ maxWidth: 480, mx: 'auto' }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            fullWidth
            disabled={!canGo}
            onClick={() => navigate('/send/confirmation')}
          >
            {t('send.go_confirm')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
