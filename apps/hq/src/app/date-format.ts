export function formatDateOnly(value: string | null): string {
  if (value === null) {
    return "-";
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return "-";
  }

  const datePart = trimmedValue.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/u.test(datePart)) {
    return datePart;
  }

  return trimmedValue;
}

export function formatDateRange(start: string, end: string): string {
  return `${formatDateOnly(start)} → ${formatDateOnly(end)}`;
}
