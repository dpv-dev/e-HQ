import type { TableRowAction } from "./types.js";

export function isTableRowActionEnabled(action: TableRowAction, rowId: string): boolean {
  return action.isEnabled?.(rowId) !== false;
}

export function tableRowActionTitle(action: TableRowAction, rowId: string): string {
  if (isTableRowActionEnabled(action, rowId)) {
    return action.label;
  }

  return action.disabledReason?.(rowId) ?? `${action.label} unavailable`;
}