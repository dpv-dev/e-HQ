import { describe, expect, it } from "vitest";
import { parseAmount, parseBankImportContent, parseMcbStatementText, parseSbiStatementText } from "./bank-parser.js";

const header = " DATE          PARTICULARS              CHQ.NO.     WITHDRAWALS        DEPOSITS          BALANCE";

describe("SBI fixed-column parser", () => {
  it("parses minor units exactly before exposing safe UI numbers", () => {
    expect(parseAmount("1,234.56")).toBe(1234.56);
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("(0.29)")).toBe(-0.29);
    expect(parseAmount("1.005")).toBe(1.01);
    expect(parseAmount("90,071,992,547,409.92")).toBeNull();
  });

  it("ignores B/F and reads withdrawal, deposit, cheque reference, and signed balance", () => {
    const chequeDebit = `${" 02-01-2026 CHEQUE PAYMENT".padEnd(40)}${"123456".padEnd(12)}100.00                 900.00 Cr`;
    const credit = " 03-01-2026 CLIENT PAYMENT                                        250.00       1,150.00 Cr";
    const rows = parseSbiStatementText([
      "SBI (Mauritius) Ltd",
      header,
      " 01-01-2026 B/F                                                               1,000.00 Cr",
      chequeDebit,
      credit
    ].join("\n"));

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: "2026-01-02",
      direction: "debit",
      directionConfidence: "high",
      amount: 100,
      balance: 900,
      reference: "123456"
    });
    expect(rows[1]).toMatchObject({
      date: "2026-01-03",
      direction: "credit",
      directionConfidence: "high",
      amount: 250,
      balance: 1150
    });
  });

  it("keeps the legacy comma-date SBI parser as a fallback", () => {
    const rows = parseSbiStatementText([
      "Transactions List",
      "",
      "11,Sep,2024 TRANSFER INWARD 1,000.00 5,000.00",
      "ID: ABC123",
      "",
      "12,Sep,2024 BILL PAYMENT 200.00 4,800.00",
      "ID: XYZ999"
    ].join("\n"));

    expect(rows).toHaveLength(2);
    expect(rows[0]?.reference).toBe("ABC123");
    expect(rows[1]?.reference).toBe("XYZ999");
  });

  it("keeps an overdrawn Dr balance negative", () => {
    const rows = parseSbiStatementText([
      "SBI (Mauritius) Ltd",
      header,
      " 01-01-2026 B/F                                                                  50.00 Cr",
      " 02-01-2026 LARGE DEBIT                          100.00                  50.00 Dr"
    ].join("\n"));

    expect(rows[0]).toMatchObject({ direction: "debit", balance: -50 });
  });
});

describe("MCB PDF parser", () => {
  it("does not append repeated page headers to transaction descriptions", () => {
    const rows = parseMcbStatementText([
      "Opening Balance 10,000.00",
      "07/07/2026 07/07/2026 FT26182R7CY0 JUICE Account Transfer|refund|MR KHILESH EMRITH 100.00 9,900.00",
      "The Mauritius Commercial Bank Ltd. 9-15 Sir William Newton Street, Port-Louis,",
      "Republic of Mauritius T: +230 202 6060 F: +230 208 7054 E: contact@mcb.mu",
      "SWIFT Code MCBLMUMU BRN: C07000934 www.mcb.mu Page 9 of 20",
      "Internet Banking Pro Account Name: Current Account IBAN:",
      "MU57MCBL0901000455164517000MUR BBAN: 000455164517 Currency: MUR",
      "Date Range: 12 Jun 2026 - Transaction Value Date Debit Credit Transaction reference & Description Balance date",
      "08/07/2026 08/07/2026 FT26183S4TQB IB Account Transfer|Internet online 50.00 9,850.00"
    ].join("\n"));

    expect(rows).toHaveLength(2);
    expect(rows[0]?.description).toBe("FT26182R7CY0 JUICE Account Transfer|refund|MR KHILESH EMRITH");
    expect(rows[1]?.description).toBe("FT26183S4TQB IB Account Transfer|Internet online");
  });

  it("normalizes a PDF into structured API rows locally", () => {
    const parsed = parseBankImportContent([
      "Current Account Statement",
      "Currency: MUR",
      "Opening Balance 1,000.00",
      "07/07/2026 07/07/2026 REF-1 PAYMENT 100.00 900.00"
    ].join("\n"), "statement.pdf");

    expect(parsed.source).toBe("mcb");
    expect(parsed.rows[0]).toMatchObject({ transactionDate: "2026-07-07", debit: "100.00", currency: "MUR" });
  });
});
