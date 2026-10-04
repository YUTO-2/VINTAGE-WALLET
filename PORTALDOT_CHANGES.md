# Vintage Wallet (formerly Raccoon Wallet, Portaldot edition) - change notes

This wallet now supports **PortaldotV3 Testnet only**.

- RPC: https://testnetv3-eth-rpc.feso-apps.xyz  (chainId 420420777, symbol tPOTv3)
- Node Explorer: https://node-console.feso-apps.xyz/
- Source: PortaldotV3 Testnet guide, section 3.1 (EVM RPC endpoint).

## Removed
Symbol / NEM, Ethereum / Polygon / Kaia / Avalanche, Swap, QR Lab, Marketplace,
JPYC / USDC features, testnet/mainnet toggle, display-currency setting,
and "custom EVM" chain registration (settings > asset recovery).

## Changed
- Home shows the tPOTv3 balance; Send / Receive / Scan use tPOTv3 (native) by default.
- Receive QR uses EIP-681: ethereum:<addr>@420420777?value=<amount>.
- On startup, legacy custom chains and stale chain/currency state are purged (src/main.tsx).
- ERC-20 tokens can still be added by contract address on the Token screen.

## NFT support + new Home layout
- **Bottom bar:** ホーム / **取引履歴** / アドレス (トークン removed - Token is reached from Home's picker). The transaction history screen
  (`/transaction/list`) is now reached from this bar instead of from a card on Home.
- **Home:** the recent-transactions card was replaced by a Token / NFT picker. Token opens the
  existing token list (`/balance`); NFT opens the new NFT screens.
- **NFT (`/nft`, `/nft/detail`)**: ERC-721 contracts on the EVM layer. Add an NFT by contract
  address (+ optional token id; with no id the wallet tries ERC721Enumerable, then a bounded
  Transfer-log scan). Shows image/name/description from `tokenURI` (ipfs:// goes through
  ipfs.io), and can send an NFT (`safeTransferFrom`, wallet password required). Code: `src/lib/nft.ts`.
- **Not supported:** the chain's native `Nfts` / `Uniques` pallets (README 2.2 / 2.3). They are
  Substrate-side and not visible through the Ethereum RPC this wallet uses.
- NFT transfers are not listed in the transaction history yet.

## Hamburger menu
The hamburger sits at the **top-left** of the app bar (the raccoon icon, tap = Home, moved to the
right). It opens a full-height sidebar on the left, side by side with the page, with no dimming
backdrop and nothing blocked (not a modal drawer on top of the page):
- **Wide screens (>= 900px):** the page shrinks to the space right of the menu.
- **Narrow screens (phones):** the page is pushed right and keeps its width, so its right part
  slides off-screen (shrinking would leave only ~100px).
The sidebar has its own hamburger in its header to close it; it also closes with Escape, when an
entry is picked, or on any navigation.
- `components/MenuShell.tsx`: layout route around every screen (owns the layout + breakpoint)
- `components/NavigationDrawer.tsx`: the sidebar; `store/menuStore.ts`: open/closed state
- `lib/menuShift.ts`: `menuBarSx` / `menuShiftSx` for screen-fixed bars (bottom nav, wallet notch,
  address-book bars, FAB) so they follow the page. Any new `position: 'fixed'` bar needs one.
- `width: '100vw'` on Home / Balance / AddressBook list became `100%` so they can shrink.

## Things to verify on a real device
1. Native decimals: guide says 14 (Substrate side); the EVM RPC is assumed to use 18
   (src/lib/chains.ts, nativeCurrency.decimals). Change it if balances are off by 10^n.
2. History only lists ERC-20 Transfer logs; native tPOTv3 transfers are not listed.
3. No block explorer URL exists, so tx links open the Node Explorer instead.
4. NFT: needs a real ERC-721 contract on the testnet to try add / display / send. Metadata
   hosts that block cross-origin requests (CORS) will show the placeholder tile instead of an image.
5. src/lib/storage.ts still contains unused legacy Symbol/NEM wallet fields (kept for
   compatibility with data saved by older versions).

## Light sidebar / no bottom bar (latest)
- Sidebar is now light (white-grey gradient, blue active pill) to match Home. It stays open across
  screen changes and closes **only** via a hamburger button (app bar or the sidebar header);
  the route-change and Escape closing were removed (`MenuShell.tsx`).
- The bottom navigation bar was removed everywhere (`BottomNav.tsx` deleted). Home's picker is now
  a 2x2 grid: Token / NFT on top, 取引履歴 under Token, アドレス under NFT.

## Icon rail menu / Home history (latest)
- The side menu is always visible as a 72px icon rail (hamburger + avatar + icons, tooltips). The
  hamburger widens it to the labelled menu and collapses it back; nothing else opens/closes it.
  Hidden only on welcome / lesson / wallet creation+login+select screens (`MenuShell.tsx`).
- Menu entries: Home / 受け取る / 送る / スキャン / トークン / NFT / アドレス / About / 設定
  (取引履歴 removed, スキャン added since Home's buttons are gone). The app-bar hamburger was removed.
- Home: all buttons removed; under the balance card is a latest-5 transactions card
  (tap a row = detail, 「すべての取引履歴を見る」 = /transaction/list).

## Wallet switch in menu / no wallet notch / scan from Send (latest)
- The wallet-name notch (`WalletBar`) was removed from every screen and the component deleted.
- Menu: added 「ウォレット切替」 (opens /wallet/select); removed スキャン. The menu is also shown on
  /wallet/select once a wallet is active (hidden during first-run setup).
- Scan tab removed from Top. Send now has a QR-scan button next to the address-book button that
  opens a full-screen scanner dialog (same parsing as before, then goes to /send/amount).

## Direct amount input / roomier confirmation (latest)
- Send amount: the on-screen keypad (`Calculator.tsx`, `lib/arithmetic.ts`) was removed. The amount is
  typed into a text field (decimal keyboard, digits + one '.', limited to the asset's decimals).
  The button 「確認画面へ」 is enabled only for 0 < amount <= available balance.
  Stale amounts are cleared when a new send starts (Send OK / QR scan).
- Send confirmation: summary rows live in one padded card with dividers, max width 560, and the
  PIN action is a full-width button instead of a cramped bar.

## Welcome -> wallet select / 新規作成 + インポート (latest)
- Welcome's GET STARTED now goes to /wallet/select (was the lesson).
- /wallet/select no longer shows the big hero/empty images or the For BEGINNERS button; it has only
  two buttons: 新規作成 (/wallet/creation/name) and インポート (/wallet/login/import), then the wallet list.
- The two-image /wallet/creation/type screen was removed; its back links now point to /wallet/select.
  The lesson screens still exist as routes but are no longer linked from the UI.

## Hero images removed / dark-white theme / wallet password instead of PIN (latest)
- **Hero images:** every screen's hero banner is gone (all `heroimage_*.png` + `hero.png` deleted, imports and
  `<img>` elements removed from 22 pages).
- **Theme:** 設定 > テーマ switches between ダーク (default, the old look) and ホワイト. Stored as `themeMode` in the
  persisted app store; `theme/raccoonTheme.ts` exports `createRaccoonTheme(mode)`, `main.tsx` (`ThemedApp`) builds it and
  mirrors the mode to `<html data-theme>` / `color-scheme` / `theme-color`. The side menu and the backup/delete caution
  screens follow the theme. The Welcome splash keeps its own dark artwork in both modes.
- **Wallet password replaces the 6-digit PIN:** `components/PasswordDialog.tsx` (typed directly into a text field,
  show/hide toggle, no keypad) replaces `PinDialog.tsx`. Register = password + confirmation, min 8 chars (max 72 bytes,
  bcrypt's limit); check = single field, 3 wrong tries closes it, the storage-backed lockout is unchanged.
  Used at wallet creation/import (first wallet sets it, later ones ask for it), send confirmation, NFT send, backup and
  wallet deletion. `PinExposureGuard`/`WalletPinRequired` became `PasswordExposureGuard`/`WalletPasswordRequired`
  (route `/wallet/password-required`) - a wallet still on the legacy placeholder is forced to set a password first.
- **Settings:** the 「パスワードの設定・変更」 and 「PINコードの設定・変更」 rows are removed (there is no in-app way to change
  the password any more; logout wipes it together with the wallets).
- Existing installs: the saved hash/storage keys (`PIN_CODE`, `PIN_ATTEMPTS`) and encryption are untouched, so a wallet
  protected by an old 6-digit PIN unlocks by typing those 6 digits as its password.
- The password is still one per device (shared by all wallets), as the PIN was.

## Vintage Wallet rename / Send screen / About (latest)
- The app is now **Vintage Wallet (ヴィンテージウォレット)**: page title, Welcome heading, wallet-name/import messages,
  About text and label. Storage keys / database name (`RaccoonWallet`, `raccoon-wallet-app-store`, ...) are deliberately
  unchanged so existing local data keeps working. The original-author credits (Donation / About the original author) and
  the terms-of-service link still refer to the original Raccoon Wallet project.
- Send screen: the white card around the address field is gone (it was a white slab on the white theme); the field has the
  paper background and the address-book button is a themed icon instead of the grey PNG.
- About: the hero (icon + logotype on a coloured banner) is removed; the concept text stays as plain text.

## About / original-author pages removed (latest)
- 「原作者について」(Donation top + detail screens, their routes, texts and portraits) are deleted. The About concept text
  (「信頼性が高く…」) is gone too.
- About now has: 公式DISCORDサーバー (opens https://discord.com/channels/1440212664751099996/1440212665363464264 in a new tab;
  the words 「紹介リンク」 are removed) and the privacy-policy link.

## Default theme is white (latest)
- After the Welcome screen the app now starts in the **white** theme; ダーク is the optional choice in 設定 > テーマ.
  (Welcome keeps its own dark artwork.) The persisted store is bumped to version 1 and resets a previously stored
  `dark` to white once.

Build: npm install && npm run build   (output: dist/index.html)

## SS58 (Substrate) address support
- New `src/lib/ss58.ts`: SS58 decode/encode (blake2b checksum, no extra dependency) and
  `resolveRecipient()`, which turns a typed/scanned string into the 0x address used for the transfer.
- pallet-revive maps a 0x address to AccountId32 = H160 ++ 0xEE*12, so an SS58 address whose account id
  ends in twelve 0xEE bytes is the *same account* as a 0x address and converts losslessly (any prefix).
- **Send / QR scan / NFT send / address book** accept such SS58 addresses and convert them to 0x
  (Send shows the resulting 0x under the input; the address book stores the 0x form). `substrate:<ss58>:...` QRs are read too.
- **Receive** also shows your own address in SS58 form (prefix 42, "5...").
- **Rejected on purpose:** SS58 addresses of ordinary Substrate keys (sr25519/ed25519, no 0xEE suffix),
  with the message `common.ss58_not_eth_derived`. Through the Ethereum RPC their EVM-side address is a hash,
  and funds only reach the real account if it ran `Revive.map_account` first; otherwise they go to an
  unreachable fallback account. Supporting them needs a native `Balances.transfer` extrinsic (Substrate RPC + sr25519/signing), not done here.
- Verify on a real device: that Portaldot's SS58 prefix is 42 (change `DEFAULT_SS58_PREFIX` if not).

## Address format switch (H160 / SS58)
- `appStore.addressFormat` ('h160' default | 'ss58', persisted) is shared by Home and Receive.
- **Receive:** an H160 / SS58 toggle above the QR. The QR and the printed address follow the choice
  (H160 = EIP-681 request with the optional amount, as before; SS58 = bare SS58 address, amount disabled
  because EIP-681 can't carry an SS58 recipient). Scan/Send already read both QR kinds.
- **Home balance card:** a V (expand) button right of the address opens a menu to pick SS58 / H160; tapping
  the address still copies the one being shown.
- Addresses are shown larger (Home 0.8rem -> 1rem, Receive -> 1.2rem bold).

## Receive: amount removed / NFT empty-state character removed
- **Receive:** the optional 「受け取る金額 (任意)」 field is gone. The QR now carries only the address
  (H160 = chain-locked `ethereum:<addr>@<chainId>`, SS58 = bare SS58 address). `receive.ss58_hint` removed.
- **NFT list:** the character image in the empty state was removed (title, message and 追加 button stay).
  The same image is still used on the transaction history empty state.

## Side menu: icons keep their position / address removed
- `NavigationDrawer.tsx`: the header now uses one layout for the collapsed rail and the expanded menu.
  The hamburger and the avatar each sit in a 72px-wide centred cell (the rail width, `RAIL_WIDTH_PX`) in
  both states, top-aligned, so expanding no longer moves them (before, the hamburger jumped to the top-right
  and the avatar to the left edge). Expanding only reveals the name / wallet name to the right of the avatar.
  The menu entries already kept the same x position.
- The wallet address line in the expanded header was removed (the address lives on Home / Receive).

## Self profile simplified (`/addressbook/detail?id=self`)
Removed from the person's own profile (friends' cards in the address book are unchanged):
- the ウォレット tab and wallet registration (no tabs any more; the 追加 bar and the "no master wallet" note are gone),
- phone and email, name and reading (名前 / よみがな) - fields and read-only rows,
- the ウォレット 0 / 通貨 0 counters,
- the cover-photo ("背景") strip and its change/remove buttons.
What is left: the icon (change/remove) and the X / LINE / Telegram accounts, plus 編集 / 完了.
Saving the self profile keeps whatever name/reading/phone/email/cover are already stored; the name is no longer required.
- Side menu header (`NavigationDrawer.tsx`) no longer shows the profile name or the cover image (they can't be set
  any more); expanded, it shows the wallet name next to the avatar. Already-stored values are left untouched in storage.

## Self profile screen removed
- The person's own profile screen is gone. In the side menu the avatar is now a plain mascot (not tappable, no custom icon);
  the expanded header shows the avatar and the wallet name.
- `AddressBookDetail.tsx` is friends-only again (all self-profile branches removed). An old `?id=self` link redirects to the address book list.
- Removed the unused `addressbook.self_title` string. Storage (`AddressBookHelper.SELF_ID` / `getSelf`) is left as is, so existing saved data
  is untouched and `findByAddress` still works.

## Home balance card
- Removed the gem illustration at the bottom-right of the card (and the now-unused `image_home_balance_background.png`).
