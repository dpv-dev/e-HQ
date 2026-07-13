// Extract layout-preserved text from a PDF File in the browser, using a lazy local PDF.js
// chunk. Lines are rebuilt from
// the text items' X/Y positions to approximate `pdftotext -layout`, which the bank
// parsers in bank-parser.ts expect.

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_PDF_PAGES = 500;
const PAGE_BATCH_SIZE = 4;

interface PdfTextItem {
  readonly str: string;
  readonly transform: readonly number[];
  readonly width: number;
  readonly height: number;
}

interface PdfTextContent {
  readonly items: readonly PdfTextItem[];
}

interface PdfPage {
  getTextContent: () => Promise<PdfTextContent>;
}

interface PdfDocument {
  readonly numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
}

interface PdfLoadingTask {
  readonly promise: Promise<PdfDocument>;
}

interface PdfJsLib {
  readonly GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { readonly data: ArrayBuffer }) => PdfLoadingTask;
}

let pdfjsPromise: Promise<PdfJsLib> | null = null;

async function loadPdfjs(): Promise<PdfJsLib> {
  if (pdfjsPromise === null) {
    pdfjsPromise = (async (): Promise<PdfJsLib> => {
      const [pdfModule, workerModule] = await Promise.all([
        import("pdfjs-dist"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url")
      ]);
      const lib = pdfModule as unknown as PdfJsLib;
      lib.GlobalWorkerOptions.workerSrc = workerModule.default;
      return lib;
    })();
  }
  return pdfjsPromise;
}

export async function extractPdfText(
  file: File,
  onProgress?: (pageNumber: number, pageCount: number) => void
): Promise<string> {
  if (file.size > MAX_PDF_BYTES) {
    throw new Error("The PDF exceeds the maximum size of 25 MB.");
  }

  const pdfjs = await loadPdfjs();
  const buffer = await file.arrayBuffer();
  const document = await pdfjs.getDocument({ data: buffer }).promise;
  if (document.numPages > MAX_PDF_PAGES) {
    await document.destroy();
    throw new Error("The PDF exceeds the 500-page limit.");
  }

  const pages = new Array<string>(document.numPages);
  let completedPageCount = 0;
  try {
    for (let start = 1; start <= document.numPages; start += PAGE_BATCH_SIZE) {
      const pageNumbers = Array.from(
        { length: Math.min(PAGE_BATCH_SIZE, document.numPages - start + 1) },
        (_value, index): number => start + index
      );
      await Promise.all(pageNumbers.map(async (pageNumber: number): Promise<void> => {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        pages[pageNumber - 1] = reconstructLines(content.items);
        completedPageCount += 1;
        onProgress?.(completedPageCount, document.numPages);
      }));
    }
    return pages.join("\n");
  } finally {
    await document.destroy();
  }
}

// Rebuild text lines from positioned items, approximating `pdftotext -layout` closely
// enough for the whitespace-tolerant bank-statement regexes. Three things matter:
//   1. group items of the SAME printed row together despite sub-pixel Y jitter,
//   2. separate adjacent items by their REAL horizontal gap (never glue two values), and
//   3. emit a blank line across a large VERTICAL gap, so visually separated blocks stay
//      separated (the SBI parser splits transactions on blank lines, like pdftotext).
// The first version rounded Y to an integer (splitting a row that straddled a .5
// boundary), spaced by a fixed column scale (gluing "11/02/202611/02/2026"), and dropped
// vertical gaps entirely (merging every SBI transaction into one block).
function reconstructLines(items: readonly PdfTextItem[]): string {
  const visible = items.filter((item: PdfTextItem): boolean => item.str.trim().length > 0);
  if (visible.length === 0) {
    return "";
  }

  const median = medianGlyphHeight(visible);
  const sameLineTolerance = Math.max(2, median * 0.6);
  const blankLineGap = median * 1.7;
  const topToBottom = [...visible].sort(
    (a: PdfTextItem, b: PdfTextItem): number => (b.transform[5] ?? 0) - (a.transform[5] ?? 0)
  );

  const grouped: { readonly y: number; readonly items: PdfTextItem[] }[] = [];
  let currentItems: PdfTextItem[] = [];
  let anchorY: number | null = null;
  for (const item of topToBottom) {
    const y = item.transform[5] ?? 0;
    if (anchorY === null || Math.abs(y - anchorY) <= sameLineTolerance) {
      currentItems.push(item);
      if (anchorY === null) {
        anchorY = y;
      }
    } else {
      grouped.push({ y: anchorY, items: currentItems });
      currentItems = [item];
      anchorY = y;
    }
  }
  if (currentItems.length > 0 && anchorY !== null) {
    grouped.push({ y: anchorY, items: currentItems });
  }

  const lines: string[] = [];
  let previousY: number | null = null;
  for (const line of grouped) {
    if (previousY !== null && previousY - line.y > blankLineGap) {
      lines.push("");
    }
    lines.push(renderLine(line.items));
    previousY = line.y;
  }
  return lines.join("\n");
}

function medianGlyphHeight(items: readonly PdfTextItem[]): number {
  const heights = items
    .map((item: PdfTextItem): number => item.height)
    .filter((height: number): boolean => height > 0)
    .sort((a: number, b: number): number => a - b);
  const middle = heights[Math.floor(heights.length / 2)];
  return middle !== undefined ? middle : 8;
}

// Render one row left-to-right, inserting spaces proportional to the real X gap between
// items, with at least one space whenever there is a visible gap (so neighbouring values
// never merge) and none when items are contiguous (so "1,621.91" stays intact).
function renderLine(lineItems: readonly PdfTextItem[]): string {
  const leftToRight = [...lineItems].sort(
    (a: PdfTextItem, b: PdfTextItem): number => (a.transform[4] ?? 0) - (b.transform[4] ?? 0)
  );

  let line = "";
  let previousEnd: number | null = null;
  for (const item of leftToRight) {
    const startX = item.transform[4] ?? 0;
    const charWidth = item.str.length > 0 && item.width > 0 ? item.width / item.str.length : 3;
    if (previousEnd !== null) {
      const gap = startX - previousEnd;
      if (gap > charWidth * 0.5) {
        line += " ".repeat(Math.max(1, Math.round(gap / charWidth)));
      }
    }
    line += item.str;
    previousEnd = startX + item.width;
  }
  return line.replace(/\s+$/u, "");
}
