// Minimal RFC-4180 reader for structured CSV import endpoints.
function splitCsvLine(line: string): readonly string[] {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char ?? "";
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char ?? "";
    }
  }
  cells.push(cell.trim());
  return cells;
}

export function parseCsvRecords(text: string): readonly Readonly<Record<string, string>>[] {
  const lines = text.split(/\r\n|\r|\n/u).filter((line): boolean => line.trim().length > 0);
  const firstLine = lines[0];
  if (lines.length < 2 || firstLine === undefined) return [];
  const header = splitCsvLine(firstLine);
  return lines.slice(1).map((line): Readonly<Record<string, string>> => {
    const cells = splitCsvLine(line);
    const record: Record<string, string> = {};
    header.forEach((key, index): void => {
      if (key.length > 0) record[key] = cells[index] ?? "";
    });
    return record;
  });
}
