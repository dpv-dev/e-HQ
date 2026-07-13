import { describe, expect, it } from "vitest";
import { suggestedImportAccountId, type ImportBankAccountCandidate } from "./bank-import-account.js";

const accounts: readonly ImportBankAccountCandidate[] = [
  { id: "mcb-mur", bankName: "Mauritius Commercial Bank", accountLabel: "Current", currency: "MUR", isActive: true },
  { id: "sbi-mur", bankName: "SBI (Mauritius)", accountLabel: "Current", currency: "MUR", isActive: true },
  { id: "mcb-eur", bankName: "MCB", accountLabel: "EUR", currency: "EUR", isActive: true },
  { id: "sbi-old", bankName: "State Bank", accountLabel: "Old", currency: "MUR", isActive: false }
];

describe("suggestedImportAccountId", () => {
  it("selects SBI MUR instead of the first MUR account", () => {
    expect(suggestedImportAccountId(accounts, "MUR", "sbi", "mcb-mur")).toBe("sbi-mur");
  });

  it("selects the matching MCB account", () => {
    expect(suggestedImportAccountId(accounts, "EUR", "mcb")).toBe("mcb-eur");
  });

  it("never selects an inactive account", () => {
    expect(suggestedImportAccountId(accounts.filter((account) => account.id === "sbi-old"), "MUR", "sbi")).toBe("");
  });

  it("requires an explicit choice when two matching accounts are ambiguous", () => {
    const ambiguous = [...accounts, { id: "sbi-mur-2", bankName: "SBI", accountLabel: "Reserve", currency: "MUR", isActive: true }];
    expect(suggestedImportAccountId(ambiguous, "MUR", "sbi")).toBe("");
    expect(suggestedImportAccountId(ambiguous, "MUR", "sbi", "sbi-mur-2")).toBe("sbi-mur-2");
  });
});
