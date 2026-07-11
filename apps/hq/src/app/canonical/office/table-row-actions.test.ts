import { describe, expect, it } from "vitest";

import { isTableRowActionEnabled, tableRowActionTitle, type TableRowAction } from "@ehq/ui";

describe("table row action helpers", () => {
  it("treats actions as enabled when no isEnabled predicate is provided", () => {
    const action: TableRowAction = {
      label: "Open",
      onAction: () => undefined
    };

    expect(isTableRowActionEnabled(action, "row-1")).toBe(true);
    expect(tableRowActionTitle(action, "row-1")).toBe("Open");
  });

  it("uses the disabled reason when an action is disabled", () => {
    const action: TableRowAction = {
      label: "Cancel",
      onAction: () => undefined,
      isEnabled: () => false,
      disabledReason: () => "Voided batches are read-only."
    };

    expect(isTableRowActionEnabled(action, "row-1")).toBe(false);
    expect(tableRowActionTitle(action, "row-1")).toBe("Voided batches are read-only.");
  });

  it("falls back to '<label> unavailable' when disabled without a reason", () => {
    const action: TableRowAction = {
      label: "Delete permanently",
      onAction: () => undefined,
      isEnabled: () => false
    };

    expect(tableRowActionTitle(action, "row-1")).toBe("Delete permanently unavailable");
  });
});
