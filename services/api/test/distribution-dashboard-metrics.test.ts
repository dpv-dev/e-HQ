import assert from "node:assert/strict";
import test from "node:test";
import type { DistributionReadDataset } from "@ehq/domain-distribution";
import { createEmptyApiFixtureStore } from "../src/fixtures.js";
import {
  distributionDashboardCoverage,
  distributionDashboardDataRange,
  distributionDashboardEarningsInRange,
  type DistributionDashboardRule
} from "../src/distribution-dashboard-metrics.js";

function dataset(): DistributionReadDataset {
  const base = createEmptyApiFixtureStore().distribution;
  return {
    ...base,
    importBatches: [
      { id: "batch-april", source: "kontor", fileName: "april.csv", status: "completed", importedAt: "2026-04-30T10:00:00.000Z" },
      { id: "batch-may", source: "kontor", fileName: "may.csv", status: "completed", importedAt: "2026-05-31T10:00:00.000Z" }
    ],
    normalizedEarnings: [
      {
        id: "earning-contract",
        batchId: "batch-april",
        dsp: "Spotify",
        grossAmount: "100.0000000000",
        quantity: "1.000000",
        currency: "EUR",
        isrc: "ISRC-CONTRACT",
        upc: null,
        rawTitle: "Contract track",
        rawArtist: "Artist",
        rawLabel: null,
        mappingStatus: "matched",
        calculationStatus: "pending"
      },
      {
        id: "earning-split-only",
        batchId: "batch-may",
        dsp: "Spotify",
        grossAmount: "50.0000000000",
        quantity: "1.000000",
        currency: "EUR",
        isrc: "ISRC-SPLIT",
        upc: null,
        rawTitle: "Split-only track",
        rawArtist: "Artist",
        rawLabel: null,
        mappingStatus: "matched",
        calculationStatus: "pending"
      },
      {
        id: "earning-uncovered",
        batchId: "batch-may",
        dsp: "Spotify",
        grossAmount: "25.0000000000",
        quantity: "1.000000",
        currency: "EUR",
        isrc: "ISRC-UNCOVERED",
        upc: null,
        rawTitle: "Uncovered track",
        rawArtist: "Artist",
        rawLabel: null,
        mappingStatus: "matched",
        calculationStatus: "pending"
      }
    ],
    tracks: [
      { id: "track-contract", title: "Contract track", artistName: "Artist", catalogStatus: "released", isrc: "ISRC-CONTRACT", releaseId: null },
      { id: "track-split", title: "Split-only track", artistName: "Artist", catalogStatus: "released", isrc: "ISRC-SPLIT", releaseId: null },
      { id: "track-uncovered", title: "Uncovered track", artistName: "Artist", catalogStatus: "released", isrc: "ISRC-UNCOVERED", releaseId: null }
    ],
    earningTrackMatches: [
      { id: "match-contract", earningId: "earning-contract", trackId: "track-contract", confidence: "100.000000", status: "matched", createdAt: "2026-04-30T10:00:00.000Z" },
      { id: "match-split", earningId: "earning-split-only", trackId: "track-split", confidence: "100.000000", status: "matched", createdAt: "2026-05-31T10:00:00.000Z" },
      { id: "match-uncovered", earningId: "earning-uncovered", trackId: "track-uncovered", confidence: "100.000000", status: "matched", createdAt: "2026-05-31T10:00:00.000Z" }
    ]
  };
}

const rules: readonly DistributionDashboardRule[] = [
  { contractId: "contract-1", scopeType: "track", scopeId: "track-contract", percentage: "60.000000", status: "active", effectiveFrom: "2026-01-01", effectiveTo: null },
  { contractId: "contract-1", scopeType: "track", scopeId: "track-contract", percentage: "40.000000", status: "active", effectiveFrom: "2026-01-01", effectiveTo: null },
  { contractId: null, scopeType: "track", scopeId: "track-split", percentage: "100.000000", status: "active", effectiveFrom: "2026-01-01", effectiveTo: null }
];

test("dashboard coverage separates valid split coverage from contract-backed coverage", () => {
  const coverage = distributionDashboardCoverage(dataset(), rules, [
    { id: "contract-1", status: "active", effectiveFrom: "2026-01-01", effectiveTo: null }
  ]);

  assert.deepEqual(coverage, {
    splitCovered: 2,
    contractCovered: 1,
    total: 3,
    mappedTotal: 3,
    missingSplit: 1
  });
});

test("dashboard financial range follows import batch dates and exposes its bounds", () => {
  const current = dataset();

  assert.deepEqual(distributionDashboardDataRange(current), {
    from: "2026-04-30",
    to: "2026-05-31"
  });
  assert.equal(distributionDashboardEarningsInRange(current, "2026-04", "2026-04-01", "2026-04-30").length, 1);
  assert.equal(distributionDashboardEarningsInRange(current, "all", null, null).length, 3);
});