/* Count-up animation for pre-formatted numeric strings ("3,295,564.19 Rs",
   "88.63%", "128", "-16,218,606.05 Rs"). The action owns the element's text:
   it tweens the numeric token from the previously displayed value (0 on first
   mount) to the new target while preserving prefix/suffix and the exact
   grouping/decimal separators found in the target string.
   Strings with zero or multiple numeric tokens ("2026-07", "4/4", "live",
   "EUR, MUR") are rendered as-is with no animation, as are all values when the
   user prefers reduced motion. Presentation-only: never touches the value
   semantics — the final rendered string is always exactly the input string. */

export interface ParsedNumeric {
  readonly prefix: string;
  readonly suffix: string;
  readonly target: number;
  readonly decimals: number;
  readonly groupChar: string;
  readonly decimalChar: string;
}

interface CountUpHandle {
  update(next: string): void;
  destroy(): void;
}

const TOKEN_PATTERN = /-?\d[\d.,'\u202F\u00A0 ]*/g;
const TRAILING_SEPARATORS = /[.,'\u202F\u00A0 ]+$/;
const DURATION_MS = 900;

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function parseNumericString(value: string): ParsedNumeric | null {
  const matches = value.match(TOKEN_PATTERN);
  if (matches === null || matches.length !== 1) {
    return null;
  }
  const rawToken = matches[0];
  const token = rawToken.replace(TRAILING_SEPARATORS, "");
  const tokenStart = value.indexOf(rawToken);
  const prefix = value.slice(0, tokenStart);
  const suffix = value.slice(tokenStart + token.length);

  const negative = token.startsWith("-");
  const body = negative ? token.slice(1) : token;

  const spaceGroup = /[\u202F\u00A0 ']/.exec(body);
  const hasDot = body.includes(".");
  const hasComma = body.includes(",");

  let groupChar = spaceGroup === null ? "" : spaceGroup[0];
  let decimalChar = "";

  if (hasDot && hasComma) {
    // Later separator is the decimal one ("2,704.96" vs "2.704,96").
    if (body.lastIndexOf(".") > body.lastIndexOf(",")) {
      decimalChar = ".";
      groupChar = groupChar === "" ? "," : groupChar;
    } else {
      decimalChar = ",";
      groupChar = groupChar === "" ? "." : groupChar;
    }
  } else if (hasDot || hasComma) {
    const sep = hasDot ? "." : ",";
    const occurrences = body.split(sep).length - 1;
    const afterLast = body.length - body.lastIndexOf(sep) - 1;
    if (occurrences > 1 || afterLast === 3) {
      // Repeated, or exactly-3-digits tail: grouping ("1,234,567" / "1,234").
      groupChar = groupChar === "" ? sep : groupChar;
    } else {
      decimalChar = sep;
    }
  }

  let integerPart = body;
  let decimalPart = "";
  if (decimalChar !== "") {
    const split = body.lastIndexOf(decimalChar);
    integerPart = body.slice(0, split);
    decimalPart = body.slice(split + 1);
  }
  const digits = integerPart.replace(/[^\d]/g, "");
  if (digits.length === 0) {
    return null;
  }
  const magnitude = Number(`${digits}${decimalPart.length > 0 ? `.${decimalPart}` : ""}`);
  if (!Number.isFinite(magnitude)) {
    return null;
  }

  return {
    prefix,
    suffix,
    target: negative ? -magnitude : magnitude,
    decimals: decimalPart.length,
    groupChar,
    decimalChar: decimalChar === "" ? "." : decimalChar
  };
}

export function formatNumeric(value: number, parsed: ParsedNumeric): string {
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(parsed.decimals);
  const dot = fixed.indexOf(".");
  let integerPart = dot === -1 ? fixed : fixed.slice(0, dot);
  const decimalPart = dot === -1 ? "" : fixed.slice(dot + 1);
  if (parsed.groupChar !== "") {
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, parsed.groupChar);
  }
  const sign = negative ? "-" : "";
  const tail = decimalPart.length > 0 ? `${parsed.decimalChar}${decimalPart}` : "";
  return `${parsed.prefix}${sign}${integerPart}${tail}${parsed.suffix}`;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Svelte action: `<strong use:animateNumericText={formattedValue}></strong>` */
export function animateNumericText(node: HTMLElement, value: string): CountUpHandle {
  let frame = 0;
  let displayed = 0;

  function cancel(): void {
    if (frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }

  function render(next: string, from: number): void {
    cancel();
    const parsed = parseNumericString(next);
    if (parsed === null || prefersReducedMotion()) {
      node.textContent = next;
      displayed = parsed === null ? 0 : parsed.target;
      return;
    }
    const parsedValue: ParsedNumeric = parsed;
    // Paint the starting value synchronously so the element is never empty.
    node.textContent = formatNumeric(from, parsedValue);
    const start = performance.now();
    const delta = parsedValue.target - from;
    function tick(now: number): void {
      const t = Math.min((now - start) / DURATION_MS, 1);
      displayed = from + delta * easeOutExpo(t);
      if (t < 1) {
        node.textContent = formatNumeric(displayed, parsedValue);
        frame = requestAnimationFrame(tick);
      } else {
        // Land exactly on the source string — no rounding drift.
        node.textContent = next;
        displayed = parsedValue.target;
        frame = 0;
      }
    }
    frame = requestAnimationFrame(tick);
  }

  render(value, 0);

  return {
    update(next: string): void {
      render(next, displayed);
    },
    destroy(): void {
      cancel();
    }
  };
}
