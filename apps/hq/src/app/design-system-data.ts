import { tokens } from "@ehq/ui/tokens";

export type TokenPreviewKind = "swatch" | "type" | "space" | "radius" | "shadow" | "motion" | "text";

export interface CssTokenEntry {
  readonly name: string;
  readonly variable: string;
  readonly previewKind: TokenPreviewKind;
}

export interface CssTokenGroup {
  readonly title: string;
  readonly entries: readonly CssTokenEntry[];
}

export interface TypedTokenEntry {
  readonly path: string;
  readonly value: string;
}

interface TokenTree {
  readonly [key: string]: string | TokenTree;
}

type TokenLeaf = string | TokenTree;

const cssToken = (name: string, variable: string, previewKind: TokenPreviewKind): CssTokenEntry => ({
  name,
  variable,
  previewKind
});

const cssGroup = (title: string, entries: readonly CssTokenEntry[]): CssTokenGroup => ({
  title,
  entries
});

export const cssTokenGroups: readonly CssTokenGroup[] = [
  cssGroup("Accent", [
    cssToken("yellow", "--ehq-yellow", "swatch"),
    cssToken("yellow-hover", "--ehq-yellow-hover", "swatch"),
    cssToken("yellow-active", "--ehq-yellow-active", "swatch"),
    cssToken("yellow-muted", "--ehq-yellow-muted", "swatch"),
    cssToken("yellow-border", "--ehq-yellow-border", "swatch")
  ]),
  cssGroup("Surfaces", [
    cssToken("black", "--ehq-black", "swatch"),
    cssToken("bg-main", "--ehq-bg-main", "swatch"),
    cssToken("surface", "--ehq-surface", "swatch"),
    cssToken("surface-high", "--ehq-surface-high", "swatch"),
    cssToken("surface-raised", "--ehq-surface-raised", "swatch")
  ]),
  cssGroup("Text", [
    cssToken("text", "--ehq-text", "swatch"),
    cssToken("text-muted", "--ehq-text-muted", "swatch"),
    cssToken("text-soft", "--ehq-text-soft", "swatch"),
    cssToken("text-disabled", "--ehq-text-disabled", "swatch"),
    cssToken("text-on-yellow", "--ehq-text-on-yellow", "swatch")
  ]),
  cssGroup("Borders", [
    cssToken("border", "--ehq-border", "swatch"),
    cssToken("border-soft", "--ehq-border-soft", "swatch"),
    cssToken("border-strong", "--ehq-border-strong", "swatch")
  ]),
  cssGroup("States", [
    cssToken("success", "--ehq-success", "swatch"),
    cssToken("success-bg", "--ehq-success-bg", "swatch"),
    cssToken("info", "--ehq-info", "swatch"),
    cssToken("info-bg", "--ehq-info-bg", "swatch"),
    cssToken("warning", "--ehq-warning", "swatch"),
    cssToken("warning-bg", "--ehq-warning-bg", "swatch"),
    cssToken("error", "--ehq-error", "swatch"),
    cssToken("error-bg", "--ehq-error-bg", "swatch"),
    cssToken("purple", "--ehq-purple", "swatch")
  ]),
  cssGroup("Typography", [
    cssToken("font", "--ehq-font", "type"),
    cssToken("display", "--ehq-display", "type"),
    cssToken("mono", "--ehq-mono", "type"),
    cssToken("brand-font", "--ehq-brand-font", "type"),
    cssToken("h1", "--ehq-h1", "type"),
    cssToken("h2", "--ehq-h2", "type"),
    cssToken("h3", "--ehq-h3", "type"),
    cssToken("body", "--ehq-body", "type"),
    cssToken("small", "--ehq-small", "type"),
    cssToken("caption", "--ehq-caption", "type")
  ]),
  cssGroup("Spacing", [
    cssToken("space-1", "--ehq-space-1", "space"),
    cssToken("space-2", "--ehq-space-2", "space"),
    cssToken("space-3", "--ehq-space-3", "space"),
    cssToken("space-4", "--ehq-space-4", "space"),
    cssToken("space-5", "--ehq-space-5", "space"),
    cssToken("space-6", "--ehq-space-6", "space"),
    cssToken("space-7", "--ehq-space-7", "space"),
    cssToken("space-8", "--ehq-space-8", "space")
  ]),
  cssGroup("Radii", [
    cssToken("radius-sm", "--ehq-radius-sm", "radius"),
    cssToken("radius-md", "--ehq-radius-md", "radius"),
    cssToken("radius-lg", "--ehq-radius-lg", "radius"),
    cssToken("radius-xl", "--ehq-radius-xl", "radius"),
    cssToken("radius-pill", "--ehq-radius-pill", "radius")
  ]),
  cssGroup("Shadows", [
    cssToken("shadow-sm", "--ehq-shadow-sm", "shadow"),
    cssToken("shadow-md", "--ehq-shadow-md", "shadow"),
    cssToken("shadow-lg", "--ehq-shadow-lg", "shadow"),
    cssToken("glow-yellow", "--ehq-glow-yellow", "shadow")
  ]),
  cssGroup("Motion", [
    cssToken("transition-fast", "--ehq-transition-fast", "motion"),
    cssToken("transition-normal", "--ehq-transition-normal", "motion"),
    cssToken("ease", "--ehq-ease", "motion")
  ])
];

export const typedTokenEntries: readonly TypedTokenEntry[] = flattenTokenTree("tokens", tokens as TokenTree);

function flattenTokenTree(prefix: string, tree: TokenTree): readonly TypedTokenEntry[] {
  const entries: TypedTokenEntry[] = [];

  for (const [key, value] of Object.entries(tree)) {
    const path = `${prefix}.${key}`;

    if (isTokenTree(value)) {
      entries.push(...flattenTokenTree(path, value));
      continue;
    }

    entries.push({
      path,
      value
    });
  }

  return entries;
}

function isTokenTree(value: TokenLeaf): value is TokenTree {
  return typeof value !== "string";
}
