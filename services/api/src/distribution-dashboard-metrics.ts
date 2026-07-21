import { parse as parseScaledUnits } from "@ehq/domain-finance";
import type { DistributionReadDataset } from "@ehq/domain-distribution";

export interface DistributionDashboardRule {
  readonly contractId: string | null;
  readonly scopeType: string | null;
  readonly scopeId: string | null;
  readonly percentage: string;
  readonly status: "draft" | "active" | "inactive" | "archived";
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
}

export interface DistributionDashboardDateRange {
  readonly from: string;
  readonly to: string;
}

export interface DistributionDashboardCoverage {
  readonly splitCovered: number;
  readonly contractCovered: number;
  readonly total: number;
  readonly mappedTotal: number;
  readonly missingSplit: number;
}

export function distributionDashboardDataRange(dataset: DistributionReadDataset): DistributionDashboardDateRange | null {
  const dates = dataset.importBatches
    .map((batch) => batch.importedAt?.slice(0, 10) ?? null)
    .filter((date): date is string => date !== null && /^\d{4}-\d{2}-\d{2}$/u.test(date))
    .sort();
  const from = dates[0];
  const to = dates[dates.length - 1];
  return from === undefined || to === undefined ? null : { from, to };
}

export function distributionDashboardEarningsInRange(
  dataset: DistributionReadDataset,
  period: string,
  dateFrom: string | null,
  dateTo: string | null
): readonly DistributionReadDataset["normalizedEarnings"][number][] {
  if (period === "all" || dateFrom === null || dateTo === null) {
    return dataset.normalizedEarnings;
  }

  return dataset.normalizedEarnings.filter((earning) => {
    const batch = dataset.importBatches.find((candidate) => candidate.id === earning.batchId);
    const importedOn = batch?.importedAt?.slice(0, 10) ?? null;
    return importedOn !== null && importedOn >= dateFrom && importedOn <= dateTo;
  });
}

export function distributionDashboardCoverage(
  dataset: DistributionReadDataset,
  rules: readonly DistributionDashboardRule[],
  contracts: readonly Readonly<{ id: string; status: string; effectiveFrom: string; effectiveTo: string | null }>[]
): DistributionDashboardCoverage {
  const eligibleEarnings = dataset.normalizedEarnings.filter(
    (earning) => earning.mappingStatus !== "ignored" && earning.calculationStatus !== "excluded"
  );
  const mappedEarnings = eligibleEarnings.filter((earning) => earning.mappingStatus === "matched");
  const splitCovered = new Set<string>();
  const contractCovered = new Set<string>();
  const batchDates = new Map(
    dataset.importBatches.map((batch) => [batch.id, batch.importedAt?.slice(0, 10) ?? null])
  );
  const tracksById = new Map(dataset.tracks.map((track) => [track.id, track]));
  const tracksByIsrc = new Map(dataset.tracks.flatMap((track) => track.isrc === null ? [] : [[track.isrc, track]]));
  const matchesByEarning = new Map<string, string>();
  for (const match of dataset.earningTrackMatches ?? []) {
    if (match.status === "matched") {
      matchesByEarning.set(match.earningId, match.trackId);
    }
  }
  const allocationsByEarning = new Map<string, DistributionReadDataset["earningAllocations"]>();
  for (const allocation of dataset.earningAllocations) {
    if (allocation.status === "void" || allocation.status === "error") {
      continue;
    }
    const existing = allocationsByEarning.get(allocation.earningId) ?? [];
    allocationsByEarning.set(allocation.earningId, [...existing, allocation]);
  }
  const globalRules: DistributionDashboardRule[] = [];
  const rulesByScope = new Map<string, DistributionDashboardRule[]>();
  for (const rule of rules) {
    if (rule.scopeType === null || rule.scopeId === null) {
      globalRules.push(rule);
      continue;
    }
    const key = `${rule.scopeType}:${rule.scopeId}`;
    rulesByScope.set(key, [...(rulesByScope.get(key) ?? []), rule]);
  }
  const contractsById = new Map(contracts.map((contract) => [contract.id, contract]));

  for (const earning of mappedEarnings) {
    const importedOn = batchDates.get(earning.batchId) ?? null;
    const trackId = matchesByEarning.get(earning.id) ?? tracksByIsrc.get(earning.isrc ?? "")?.id ?? null;
    const track = trackId === null ? undefined : tracksById.get(trackId);
    const applicableRules = [
      ...globalRules,
      ...(trackId === null ? [] : rulesByScope.get(`track:${trackId}`) ?? []),
      ...(track?.releaseId === null || track?.releaseId === undefined ? [] : rulesByScope.get(`release:${track.releaseId}`) ?? []),
      ...(earning.isrc === null ? [] : rulesByScope.get(`isrc:${earning.isrc}`) ?? []),
      ...(earning.upc === null ? [] : rulesByScope.get(`upc:${earning.upc}`) ?? rulesByScope.get(`ean:${earning.upc}`) ?? [])
    ].filter((rule) => ruleAppliesOnDate(rule, importedOn));
    const allocationRows = allocationsByEarning.get(earning.id) ?? [];
    const rulesAreValid = hasExactFullSplit(applicableRules.map((rule) => rule.percentage));
    const allocationsAreValid = hasExactFullSplit(allocationRows.map((allocation) => allocation.splitPercentage));
    if (!rulesAreValid && !allocationsAreValid) {
      continue;
    }

    splitCovered.add(earning.id);
    const rulesAreContractBacked = rulesAreValid && applicableRules.length > 0 && applicableRules.every(
      (rule) => rule.contractId !== null && activeContractApplies(contractsById, rule.contractId, importedOn)
    );
    const allocationsAreContractBacked = allocationsAreValid && allocationRows.length > 0 && allocationRows.every(
      (allocation) => allocation.contractId !== null && contractsById.get(allocation.contractId)?.status === "active"
    );
    if (rulesAreContractBacked || allocationsAreContractBacked) {
      contractCovered.add(earning.id);
    }
  }

  return {
    splitCovered: splitCovered.size,
    contractCovered: contractCovered.size,
    total: eligibleEarnings.length,
    mappedTotal: mappedEarnings.length,
    missingSplit: Math.max(mappedEarnings.length - splitCovered.size, 0)
  };
}

function ruleAppliesOnDate(rule: DistributionDashboardRule, importedOn: string | null): boolean {
  if (rule.status !== "active") {
    return false;
  }
  if (importedOn !== null && rule.effectiveFrom !== null && importedOn < rule.effectiveFrom) {
    return false;
  }
  if (importedOn !== null && rule.effectiveTo !== null && importedOn > rule.effectiveTo) {
    return false;
  }

  return true;
}

function activeContractApplies(
  contracts: ReadonlyMap<string, Readonly<{ id: string; status: string; effectiveFrom: string; effectiveTo: string | null }>>,
  contractId: string,
  importedOn: string | null
): boolean {
  const contract = contracts.get(contractId);
  if (contract === undefined || contract.status !== "active") {
    return false;
  }
  if (importedOn === null) {
    return true;
  }
  return contract.effectiveFrom <= importedOn && (contract.effectiveTo === null || contract.effectiveTo >= importedOn);
}

function hasExactFullSplit(percentages: readonly string[]): boolean {
  if (percentages.length === 0) {
    return false;
  }

  try {
    const total = percentages.reduce(
      (sum, percentage) => sum + parseScaledUnits(percentage, 6, "TRUNCATE"),
      0n
    );
    return total === 100000000n;
  } catch {
    return false;
  }
}