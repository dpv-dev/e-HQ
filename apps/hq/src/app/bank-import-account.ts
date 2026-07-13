export type DetectedBankImportSource = "sbi" | "mcb" | "csv" | "cashflow" | "pdf" | null;

export interface ImportBankAccountCandidate {
  readonly id: string;
  readonly bankName: string;
  readonly accountLabel: string;
  readonly currency: string;
  readonly isActive: boolean;
}

type KnownBank = "sbi" | "mcb";

// Select only when the detected bank/currency identifies one safe destination.
// An ambiguous match is deliberately left blank for an explicit operator choice.
export function suggestedImportAccountId(
  accounts: readonly ImportBankAccountCandidate[],
  currency: string | null,
  source: DetectedBankImportSource,
  currentAccountId = ""
): string {
  const active = accounts.filter((account) => account.isActive);
  const current = active.find((account) => account.id === currentAccountId) ?? null;
  const knownBank = source === "sbi" || source === "mcb" ? source : null;

  if (knownBank !== null) {
    const exact = active.filter(
      (account) =>
        normalizeImportBank(account) === knownBank &&
        (currency === null || account.currency === currency)
    );
    if (exact.length === 1) {
      return exact[0]?.id ?? "";
    }
    if (current !== null && exact.some((account) => account.id === current.id)) {
      return current.id;
    }
    return "";
  }

  const currencyMatches = currency === null
    ? active
    : active.filter((account) => account.currency === currency);
  if (current !== null && currencyMatches.some((account) => account.id === current.id)) {
    return current.id;
  }
  if (currencyMatches.length === 1) {
    return currencyMatches[0]?.id ?? "";
  }
  return currency === null ? (active[0]?.id ?? accounts[0]?.id ?? "") : "";
}

function normalizeImportBank(account: ImportBankAccountCandidate): KnownBank | null {
  const value = `${account.bankName} ${account.accountLabel}`.toLowerCase();
  if (/\b(sbi|sbm)\b/u.test(value) || value.includes("state bank")) {
    return "sbi";
  }
  if (/\bmcb\b/u.test(value) || value.includes("mauritius commercial bank")) {
    return "mcb";
  }
  return null;
}
