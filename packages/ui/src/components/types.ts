export type Tone = "success" | "warning" | "error" | "info" | "muted" | "active";
export type ButtonVariant = "primary" | "secondary" | "danger";
export type ButtonSize = "small" | "medium";
export type FieldState = "default" | "focus" | "error" | "disabled";
export type SurfaceState = "default" | "hover" | "empty" | "error" | "locked" | "loading";
export type TableState = "default" | "loading" | "empty" | "error" | "locked";
export type DrawerState = "default" | "error" | "locked";

export interface SelectOption {
  readonly label: string;
  readonly value: string;
}

export interface ToolbarFilter {
  readonly label: string;
  readonly value: string;
  readonly active: boolean;
  readonly disabled: boolean;
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

export interface ChartPoint {
  readonly label: string;
  readonly value: number;
}

export interface DivergePoint {
  readonly label: string;
  readonly negative: number;
  readonly positive: number;
}
