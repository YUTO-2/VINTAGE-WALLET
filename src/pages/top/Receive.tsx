import { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Avatar, Menu, MenuItem, ToggleButton, ToggleButtonGroup } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { WalletsHelper, CustomChainsHelper } from '../../lib/storage';
import type { CustomChainRecord } from '../../lib/storage';
import { CHAINS } from '../../lib/chains';
import type { ChainKey } from '../../lib/chains';
import { CHAIN_ICONS } from '../../lib/chainIcons';
import { buildChainLockedAddressUri, buildChainLockedAddressUriForChainId } from '../../lib/jpycPayment';
import { useAppStore } from '../../store/appStore';
import { evmToSs58 } from '../../lib/ss58';
import type { AddressFormat } from '../../store/appStore';
import CustomChainIcon from '../../components/CustomChainIcon';

const CHAIN_KEYS = Object.keys(CHAINS) as ChainKey[];

// Neutral blue-grey used for a network added under 設定 > カスタムEVM, since - unlike
// the built-in Portaldot entry - it has no brand color of its own to borrow.
const CUSTOM_CHAIN_COLOR = '#607D8B';

// Every network this screen can generate a receive QR for: Portaldot (the one built-in
// chain), plus any network the person added by hand under 設定 > カスタムEVM (see
// CustomChainRecord in lib/storage.ts) - `custom:${id}`. Picking a chain here is what lets
// the QR itself be chain-locked (see qrValue below / buildChainLockedAddressUri), so a
// sender's wallet can reject or auto-correct a mismatched chain.
type ReceiveMode = ChainKey | `custom:${string}`;

// Type guard (rather than a plain .startsWith() check) so TypeScript can actually narrow
// `mode` away from the `custom:${string}` branch below - a template literal type isn't
// narrowed by string methods like .startsWith() on their own, only by an explicit
// predicate like this one.
function isCustomReceiveMode(mode: ReceiveMode): mode is `custom:${string}` {
  return mode.startsWith('custom:');
}

// Ported from src/components/pages/top/Receive.vue. The QR carries only the address: for H160 it
// is chain-locked (buildChainLockedAddressUri, `ethereum:<addr>@<chainId>`) so it is never
// chain-ambiguous; for SS58 it is the bare SS58 address.
export default function Receive() {
  const { t } = useTranslation();
  const activeChain = useAppStore((s) => s.activeChain);
  // H160 (0x) or SS58 - shared with Home's balance card.
  const addressFormat = useAppStore((s) => s.addressFormat);
  const setAddressFormat = useAppStore((s) => s.setAddressFormat);
  const [address, setAddress] = useState('');

  const [mode, setMode] = useState<ReceiveMode>(activeChain);
  // Networks added under 設定 > カスタムEVM - offered here too so a custom network's
  // receive QR isn't only reachable from that settings screen. Same underlying address as
  // the curated EVM chains above (it's still an EVM account), just chain-locked to that
  // network's chainId instead of one of CHAINS's.
  const [customChains, setCustomChains] = useState<CustomChainRecord[]>([]);
  // Anchor for the chain/asset picker's dropdown menu - same tappable-card-plus-Menu pattern
  // used on Swap/QR Lab's chain selectors.
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => {
    (async () => {
      const activeWallet = await WalletsHelper.getActive();
      setAddress(activeWallet?.address ?? '');
      setCustomChains(await CustomChainsHelper.list());
    })();
  }, []);

  // The chain picker below can land on the built-in Portaldot chain or a custom chain
  // (`custom:${id}`).
  const customChainId = isCustomReceiveMode(mode) ? mode.slice('custom:'.length) : null;
  const selectedCustomChain = customChainId !== null
    ? customChains.find((c) => c.id === customChainId) ?? null
    : null;
  const showCustomMode = customChainId !== null && selectedCustomChain !== null;

  const chain = isCustomReceiveMode(mode) ? null : mode;
  // The same account in Substrate (SS58) form, as shown by the Node Explorer / polkadot tools.
  const ss58Address = useMemo(() => (address.length > 0 ? evmToSs58(address) : null), [address]);

  // SS58: the QR is the bare SS58 address. H160: the chain-locked EIP-681 address URI.
  const useSs58 = addressFormat === 'ss58' && ss58Address !== null;
  const shownAddress = useSs58 ? ss58Address : address;
  const qrValue = useSs58
    ? ss58Address
    : chain === null || address.length === 0
      ? address
      : buildChainLockedAddressUri(chain, address);

  // Options for the chain picker pill below - Portaldot, plus any network added under
  // 設定 > カスタムEVM.
  const options: { value: ReceiveMode; icon?: string; iconDataUrl?: string; label: string; color?: string }[] = [
    ...CHAIN_KEYS.map((key) => ({ value: key as ReceiveMode, icon: CHAIN_ICONS[key], label: CHAINS[key].name })),
    ...customChains.map((c) => ({
      value: `custom:${c.id}` as ReceiveMode,
      iconDataUrl: c.iconDataUrl,
      label: c.name,
      color: CUSTOM_CHAIN_COLOR,
    })),
  ];
  const selected = options.find((o) => o.value === mode) ?? options[0];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 4, mt: 2 }}>
        <Typography sx={{ fontWeight: 'bold', mb: 1 }}>{t('receive.chain_label')}</Typography>
        <Box
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          sx={{
            bgcolor: 'grey.100', borderRadius: 3, px: 2, py: 2, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {selected.icon ? (
              <Avatar src={selected.icon} sx={{ width: 32, height: 32 }} />
            ) : (
              <CustomChainIcon iconDataUrl={selected.iconDataUrl} size={32} />
            )}
            <Typography sx={{ fontWeight: 'bold', color: selected.color }}>{selected.label}</Typography>
          </Box>
          <ExpandMoreIcon sx={{ color: 'text.secondary' }} />
        </Box>
        <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
          {options.map((opt) => (
            <MenuItem
              key={opt.value}
              selected={opt.value === mode}
              onClick={() => { setMode(opt.value); setMenuAnchor(null); }}
            >
              {opt.icon ? (
                <Avatar src={opt.icon} sx={{ width: 24, height: 24, mr: 1.5 }} />
              ) : (
                <CustomChainIcon iconDataUrl={opt.iconDataUrl} size={24} sx={{ mr: 1.5 }} />
              )}
              <Typography sx={{ color: opt.color }}>{opt.label}</Typography>
            </MenuItem>
          ))}
        </Menu>
      </Box>

      {showCustomMode ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 3 }}>
          {address.length > 0 && (
            <QRCodeSVG
              value={buildChainLockedAddressUriForChainId(selectedCustomChain!.chainId, address)}
              size={200}
            />
          )}
          <Typography sx={{ mt: 4, color: CUSTOM_CHAIN_COLOR }}>{t('receive.your_address')}</Typography>
          <Typography align="center" sx={{ wordBreak: 'break-all', mx: 4 }}>{address}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3, mb: 4, mx: 4, textAlign: 'center' }}>
            {t('receive.custom_chain_caution', { name: selectedCustomChain!.name })}
          </Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 2 }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              color="primary"
              value={addressFormat}
              onChange={(_e, value: AddressFormat | null) => { if (value) setAddressFormat(value); }}
              aria-label={t('receive.format_label')}
              sx={{ mb: 2 }}
            >
              <ToggleButton value="h160" sx={{ px: 2.5 }}>{t('receive.format_h160')}</ToggleButton>
              <ToggleButton value="ss58" sx={{ px: 2.5 }}>{t('receive.format_ss58')}</ToggleButton>
            </ToggleButtonGroup>
            {address.length > 0 && <QRCodeSVG value={qrValue} size={200} />}
            <Typography sx={{ mt: 3, color: 'primary.main' }}>
              {useSs58 ? t('receive.your_ss58_address') : t('receive.your_address')}
            </Typography>
            <Typography
              align="center"
              sx={{ wordBreak: 'break-all', mx: 4, fontSize: '1.2rem', fontWeight: 'bold', lineHeight: 1.45 }}
            >
              {shownAddress}
            </Typography>
          </Box>

        </>
      )}
    </Box>
  );
}
