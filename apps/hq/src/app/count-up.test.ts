import { describe, expect, it } from "vitest";
import { formatNumeric, parseNumericString } from "@ehq/ui";

describe("parseNumericString", () => {
  it("parses en-grouped money with decimals", () => {
    const parsed = parseNumericString("3,295,564.19 Rs");
    expect(parsed).not.toBeNull();
    expect(parsed?.target).toBe(3295564.19);
    expect(parsed?.decimals).toBe(2);
    expect(parsed?.groupChar).toBe(",");
    expect(parsed?.decimalChar).toBe(".");
    expect(parsed?.suffix).toBe(" Rs");
  });

  it("parses fr space-grouped money", () => {
    const parsed = parseNumericString("2 847 632 Rs");
    expect(parsed?.target).toBe(2847632);
    expect(parsed?.groupChar).toBe(" ");
    expect(parsed?.decimals).toBe(0);
  });

  it("parses negative amounts", () => {
    const parsed = parseNumericString("-16,218,606.05 Rs");
    expect(parsed?.target).toBe(-16218606.05);
  });

  it("parses percentages and plain counts", () => {
    expect(parseNumericString("88.63%")?.target).toBe(88.63);
    expect(parseNumericString("88.63%")?.suffix).toBe("%");
    expect(parseNumericString("128")?.target).toBe(128);
  });

  it("treats a single comma before exactly three digits as grouping", () => {
    const parsed = parseNumericString("1,204");
    expect(parsed?.target).toBe(1204);
    expect(parsed?.decimals).toBe(0);
  });

  it("keeps prefixes such as currency symbols and the locked marker", () => {
    expect(parseNumericString("€ 0.00")?.prefix).toBe("€ ");
    expect(parseNumericString("× 128")?.prefix).toBe("× ");
    expect(parseNumericString("0.00 months")?.suffix).toBe(" months");
  });

  it("refuses multi-token and non-numeric strings", () => {
    expect(parseNumericString("2026-07")).toBeNull();
    expect(parseNumericString("4/4")).toBeNull();
    expect(parseNumericString("complete")).toBeNull();
    expect(parseNumericString("EUR, MUR")).toBeNull();
  });
});

describe("formatNumeric", () => {
  it("re-renders intermediate values with the target's separators", () => {
    const parsed = parseNumericString("3,295,564.19 Rs");
    expect(parsed).not.toBeNull();
    if (parsed !== null) {
      expect(formatNumeric(1234567.891, parsed)).toBe("1,234,567.89 Rs");
      expect(formatNumeric(0, parsed)).toBe("0.00 Rs");
    }
  });

  it("keeps the sign through the tween", () => {
    const parsed = parseNumericString("-16,218,606.05 Rs");
    expect(parsed).not.toBeNull();
    if (parsed !== null) {
      expect(formatNumeric(-8100000.5, parsed)).toBe("-8,100,000.50 Rs");
    }
  });

  it("formats space-grouped integers", () => {
    const parsed = parseNumericString("2 847 632 Rs");
    expect(parsed).not.toBeNull();
    if (parsed !== null) {
      expect(formatNumeric(1500000, parsed)).toBe("1 500 000 Rs");
    }
  });
});
