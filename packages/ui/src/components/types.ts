import type { IconName } from "./icons.js";

export type Tone = "success" | "warning" | "error" | "info" | "muted" | "active";
export type WorkspaceKind = "office" | "distribution" | "command-center";
export type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost" | "danger";
export type AlertTone = "success" | "info" | "warning" | "error";
export type StatTrendDirection = "up" | "down" | "none";
export type ButtonSize = "small" | "medium";
export type FieldState = "default" | "focus" | "error" | "disabled";
export type SurfaceState = "default" | "hover" | "empty" | "error" | "locked" | "loading";
export type TableState = "default" | "loading" | "empty" | "error" | "locked";
export type DrawerState = "default" | "error" | "locked";
export type OperatorState = "ready" | "loading" | "empty" | "error" | "disabled";

export interface SelectOption {
  readonly label: string;
  readonly value: string;
}

export interface ToolbarFilter {
  readonly label: string;
  readonly value: string;
  readonly active: boolean;
  readonly disabled: boolean;
  readonly actionId?: string;
  readonly title?: string;
}

export interface WorkspaceNavItem {
  readonly label: string;
  readonly href: string;
  // Line-icon name from the internal set; "" renders no icon.
  readonly icon: IconName | "";
  readonly active: boolean;
  readonly disabled: boolean;
  readonly badge: string | null;
}

export interface WorkspaceNavGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly WorkspaceNavItem[];
}

export type TableCell =
  | { readonly kind: "text"; readonly value: string; readonly strong: boolean }
  | { readonly kind: "money"; readonly value: string; readonly tone: Tone }
  | { readonly kind: "badge"; readonly value: string; readonly tone: Tone }
  | { readonly kind: "action"; readonly value: string; readonly tone: Tone; readonly locked: boolean };

export interface TableColumn {
  readonly label: string;
  readonly align: "left" | "right";
  readonly sortable: boolean;
}

export interface TableRow {
  readonly id: string;
  readonly cells: readonly TableCell[];
}

// Optional per-row action button rendered in a trailing column (e.g. "Edit", "Cancel").
export interface TableRowAction {
  readonly label: string | ((rowId: string) => string);
  readonly onAction: (rowId: string) => void | Promise<void>;
  readonly danger?: boolean;
  readonly isEnabled?: (rowId: string) => boolean;
  readonly disabledReason?: (rowId: string) => string | null;
}

export interface TablePagination {
  readonly loadedCount: number;
  readonly hasMore: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly onLoadMore: (() => void | Promise<void>) | null;
  readonly onLoadAll: (() => void | Promise<void>) | null;
}

export interface ChartPoint {
  readonly label: string;
  readonly value: number;
}

export interface DivergePoint {
  readonly label: string;
  readonly negative: number;
  readonly positive: number;
}
