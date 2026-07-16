const MCB_PAGE_CHROME_MARKER = /\s+(?:The Mauritius Commercial Bank Ltd\.?|Republic of Mauritius|SWIFT Code\b|Internet Banking Pro\b|Current Account IBAN\s*:|\bBBAN\s*:|Date Range\s*:)/iu;

// Imported source rows stay immutable in Postgres; the disposable read model
// strips PDF page chrome that older parser versions appended to descriptions.
export function sanitizeOfficeBankDescription(description: string): string {
  const marker = MCB_PAGE_CHROME_MARKER.exec(description);
  return (marker === null ? description : description.slice(0, marker.index))
    .replace(/\s+/gu, " ")
    .trim();
}
