// Previously this derived and cached the wallet's Symbol / NEM accounts right after a PIN
// check. This wallet now supports Portaldot only (an EVM-style 0x account derived straight
// from the mnemonic / private key), so there is nothing extra to unlock. The function is
// kept as a no-op so PIN-entry call sites (PinDialog, WalletCreationName, ...) keep working.
export async function unlockDerivedAccountsIfPossible(_pin: string): Promise<void> {
  // intentionally empty
}
