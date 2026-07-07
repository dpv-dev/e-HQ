import type { SelectOption } from "@ehq/ui";

// Shared A→Z ordering for dynamic dropdown options (departments, categories, projects,
// accounts, payees…). Placeholder entries ("All …", "Choose…", "Root", "— None —") keep
// their position at the top: callers pass how many leading options must stay pinned.
// Static enum dropdowns with a workflow order (type, status, period) do NOT use this.
export function sortOptionsAlphabetically(
  options: readonly SelectOption[],
  pinnedPrefixCount: number
): readonly SelectOption[] {
  const pinned = options.slice(0, pinnedPrefixCount);
  const sortable = [...options.slice(pinnedPrefixCount)];
  sortable.sort((left: SelectOption, right: SelectOption): number =>
    left.label.localeCompare(right.label, undefined, { sensitivity: "base", numeric: true })
  );
  return [...pinned, ...sortable];
}
