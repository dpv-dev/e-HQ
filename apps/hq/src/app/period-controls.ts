export type PeriodScope = "month" | "year" | "last6";

export interface PeriodOption {
  readonly value: PeriodScope;
  readonly label: string;
  readonly detail: string;
}

export interface DateRange {
  readonly from: string;
  readonly to: string;
}

const latestDataPeriod = "2026-05";

export function getLatestDataPeriod(): string {
  return latestDataPeriod;
}

export function createPeriodOptions(): readonly PeriodOption[] {
  return [
    { value: "month", label: "Latest month", detail: "May 2026" },
    { value: "year", label: "This year", detail: "Jan-May 2026" },
    { value: "last6", label: "Last 6 months", detail: "Dec 2025-May 2026" }
  ];
}

export function periodLabel(period: string): string {
  const [year = "", month = ""] = period.split("-");
  if (year.length !== 4 || month.length !== 2) {
    return period;
  }

  return `${month}/${year}`;
}

export function rangeForScope(scope: PeriodScope, latestPeriod: string): DateRange {
  if (scope === "year") {
    return {
      from: `${latestPeriod.slice(0, 4)}-01-01`,
      to: periodEndDate(latestPeriod)
    };
  }

  if (scope === "last6") {
    return {
      from: shiftMonthStart(latestPeriod, -5),
      to: periodEndDate(latestPeriod)
    };
  }

  return {
    from: `${latestPeriod}-01`,
    to: periodEndDate(latestPeriod)
  };
}

export function periodEndDate(period: string): string {
  const year = Number.parseInt(period.slice(0, 4), 10);
  const month = Number.parseInt(period.slice(5, 7), 10);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${period}-${String(lastDay).padStart(2, "0")}`;
}

function shiftMonthStart(period: string, offset: number): string {
  const year = Number.parseInt(period.slice(0, 4), 10);
  const monthIndex = Number.parseInt(period.slice(5, 7), 10) - 1;
  const date = new Date(Date.UTC(year, monthIndex + offset, 1));
  const shiftedYear = date.getUTCFullYear();
  const shiftedMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${String(shiftedYear)}-${shiftedMonth}-01`;
}
