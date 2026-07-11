import { describe, expect, it } from "vitest";

import {
  canCancelRecentImportItem,
  canDeleteRecentImportItem,
  recentImportCancelDisabledReasonFor,
  recentImportDeleteDisabledReasonFor
} from "./recent-import-actions.js";

describe("office recent import action guards", () => {
  it("allows cancel only for confirmed imports", () => {
    expect(canCancelRecentImportItem({ status: "confirmed" })).toBe(true);
    expect(canCancelRecentImportItem({ status: "failed" })).toBe(false);
    expect(canCancelRecentImportItem({ status: "previewed" })).toBe(false);
    expect(canCancelRecentImportItem(null)).toBe(false);
  });

  it("returns clear cancel disabled reasons", () => {
    expect(recentImportCancelDisabledReasonFor({ status: "confirmed" })).toBeNull();
    expect(recentImportCancelDisabledReasonFor({ status: "failed" })).toBe("Failed imports cannot be canceled.");
    expect(recentImportCancelDisabledReasonFor({ status: "previewed" })).toBe("Only confirmed imports can be canceled.");
    expect(recentImportCancelDisabledReasonFor(null)).toBe("Import not loaded.");
  });

  it("allows delete for confirmed and failed imports", () => {
    expect(canDeleteRecentImportItem({ status: "confirmed" })).toBe(true);
    expect(canDeleteRecentImportItem({ status: "failed" })).toBe(true);
    expect(canDeleteRecentImportItem({ status: "previewed" })).toBe(false);
    expect(canDeleteRecentImportItem(null)).toBe(false);
  });

  it("returns clear delete disabled reasons", () => {
    expect(recentImportDeleteDisabledReasonFor({ status: "confirmed" })).toBeNull();
    expect(recentImportDeleteDisabledReasonFor({ status: "failed" })).toBeNull();
    expect(recentImportDeleteDisabledReasonFor({ status: "previewed" })).toBe("Only confirmed or failed imports can be deleted.");
    expect(recentImportDeleteDisabledReasonFor(null)).toBe("Import not loaded.");
  });
});
