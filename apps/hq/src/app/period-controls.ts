// Period filter model shared by every workspace (Office, Distribution, Command Center).
// A scope + the current date (and an optional custom range) resolve to a concrete
// inclusive date range {from, to} that drives the API's dateFrom/dateTo filters.
// Pure functions only — the caller supplies "today" (and any custom range) so the
// math stays deterministic and testable.

export type PeriodScope = "week" | "month" | "last3" | "last6" | "year" | "lastyear" | "all" | "custom";

export interface PeriodOption {
  readonly value: PeriodScope;
  readonly label: string;
  readonly detail: string;
}

export interface DateRange {
  readonly from: string;
  readonly to: string;
}

const latestDataPeriod = "2026-07";

const allRangeFrom = "2015-01-01";
const allRangeTo = "2030-12-31";

export function getLatestDataPeriod(): string {
  return latestDataPeriod;
}

// Today's date as ISO "YYYY-MM-DD" (local). Impure boundary helper — call it once
// at the app edge and feed the value into the pure range functions.
export function todayIso(): string {
  const now = new Date();
  return `${String(now.getFullYear())}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function createPeriodOptions(): readonly PeriodOption[] {
  return [
    { value: "week", label: "This Week", detail: "Current week" },
    { value: "month", label: "This Month", detail: "Current month" },
    { value: "last3", label: "Last 3 Months", detail: "Trailing 3 months" },
    { value: "last6", label: "Last 6 Months", detail: "Trailing 6 months" },
    { value: "year", label: "This Year", detail: "Year to date" },
    { value: "lastyear", label: "Last Year", detail: "Previous calendar year" },
    { value: "all", label: "All", detail: "Entire history" },
    { value: "custom", label: "Custom", detail: "Pick dates" }
  ];
}

export function periodLabel(period: string): string {
  const [year = "", month = ""] = period.split("-");
  if (year.length !== 4 || month.length !== 2) {
    return period;
  }

  return `${month}/${year}`;
}

// Human label for the active range, e.g. "01/06/2026 → 30/06/2026".
export function rangeLabel(range: DateRange): string {
  return `${formatIsoDate(range.from)} → ${formatIsoDate(range.to)}`;
}

// Resolve a scope (+ today, + optional custom range) into an inclusive date range.
export function rangeForScope(scope: PeriodScope, today: string, customRange: DateRange | null): DateRange {
  if (scope === "week") {
    return weekRange(today);
  }
  if (scope === "month") {
    return monthRangeFromDate(today);
  }
  if (scope === "last3") {
    return trailingMonthsRange(today, 2);
  }
  if (scope === "last6") {
    return trailingMonthsRange(today, 5);
  }
  if (scope === "year") {
    return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
  }
  if (scope === "lastyear") {
    const previousYear = String(Number.parseInt(today.slice(0, 4), 10) - 1);
    return { from: `${previousYear}-01-01`, to: `${previousYear}-12-31` };
  }
  if (scope === "all") {
    return { from: allRangeFrom, to: allRangeTo };
  }
  // custom — fall back to the current month until the user picks dates.
  return customRange !== null ? customRange : monthRangeFromDate(today);
}

export function periodEndDate(period: string): string {
  const year = Number.parseInt(period.slice(0, 4), 10);
  const month = Number.parseInt(period.slice(5, 7), 10);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${period}-${pad2(lastDay)}`;
}

// Monday→Sunday week containing the given date (ISO week, Monday start).
function weekRange(today: string): DateRange {
  const date = parseUtc(today);
  const dayOfWeek = date.getUTCDay(); // 0=Sun..6=Sat
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(date.getTime());
  monday.setUTCDate(date.getUTCDate() + mondayOffset);
  const sunday = new Date(monday.getTime());
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: toIso(monday), to: toIso(sunday) };
}

function monthRangeFromDate(today: string): DateRange {
  const period = today.slice(0, 7);
  return { from: `${period}-01`, to: periodEndDate(period) };
}

// N months back through the end of the current month, inclusive of the current month
// (back=2 → 3 calendar months; back=5 → 6 calendar months).
function trailingMonthsRange(today: string, back: number): DateRange {
  const year = Number.parseInt(today.slice(0, 4), 10);
  const monthIndex = Number.parseInt(today.slice(5, 7), 10) - 1;
  const start = new Date(Date.UTC(year, monthIndex - back, 1));
  const fromPeriod = `${String(start.getUTCFullYear())}-${pad2(start.getUTCMonth() + 1)}`;
  return { from: `${fromPeriod}-01`, to: periodEndDate(today.slice(0, 7)) };
}

function parseUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function toIso(date: Date): string {
  return `${String(date.getUTCFullYear())}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function formatIsoDate(iso: string): string {
  const [year = "", month = "", day = ""] = iso.split("-");
  if (year.length !== 4 || month.length !== 2 || day.length !== 2) {
    return iso;
  }
  return `${day}/${month}/${year}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
