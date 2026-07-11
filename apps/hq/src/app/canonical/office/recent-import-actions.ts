import type { OfficeRecentImport } from "@ehq/api-client";

type OfficeRecentImportLike = Pick<OfficeRecentImport, "status"> | null;

export function canCancelRecentImportItem(item: OfficeRecentImportLike): boolean {
  return item?.status === "confirmed";
}

export function recentImportCancelDisabledReasonFor(item: OfficeRecentImportLike): string | null {
  if (item === null) {
    return "Import not loaded.";
  }

  if (item.status === "failed") {
    return "Failed imports cannot be canceled.";
  }

  if (item.status !== "confirmed") {
    return "Only confirmed imports can be canceled.";
  }

  return null;
}

export function canDeleteRecentImportItem(item: OfficeRecentImportLike): boolean {
  return item !== null && (item.status === "confirmed" || item.status === "failed");
}

export function recentImportDeleteDisabledReasonFor(item: OfficeRecentImportLike): string | null {
  if (item === null) {
    return "Import not loaded.";
  }

  if (!canDeleteRecentImportItem(item)) {
    return "Only confirmed or failed imports can be deleted.";
  }

  return null;
}