import { erhMoney, format as formatScaledUnits, parse as parseScaledUnits } from "@ehq/domain-finance";

export type DistributionAllocationOutcome = DistributionAllocationPlan | DistributionAllocationSuspenseOutcome;
export type DistributionCostTermStatus =
  | "draft"
  | "active"
  | "open"
  | "partially_recovered"
  | "recovered"
  | "non_recoverable"
  | "satisfied"
  | "cancelled"
  | "deleted";

export interface DistributionEarningInput {
  readonly id: string;
  readonly calculationRunId: string;
  readonly trackId: string | null;
  readonly grossAmount: string;
  readonly currency: string;
  readonly saleDate: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly today: string;
}

export interface DistributionRoyaltyRuleInput {
  readonly contractId: string | null;
  readonly royaltyRuleId: string;
  readonly payeeId: string;
  readonly artistId: string;
  readonly role: string;
  readonly percentage: string;
}

export interface DistributionCostTermInput {
  readonly id: string;
  readonly contractId: string;
  readonly payeeId: string | null;
  readonly amount: string;
  readonly currency: string;
  readonly recoupable: boolean;
  readonly status: DistributionCostTermStatus;
  readonly expenseDate: string;
}

export interface DistributionExistingExpenseApplication {
  readonly costTermId: string;
  readonly amountApplied: string;
  readonly currency: string;
}

export interface DistributionFxRateInput {
  readonly fromCurrency: string;
  readonly toCurrency: string;
  readonly effectiveDate: string;
  readonly rate: string;
}

export interface DistributionCostState {
  readonly costTerms: readonly DistributionCostTermInput[];
  readonly expenseApplications: readonly DistributionExistingExpenseApplication[];
  readonly fxRates: readonly DistributionFxRateInput[];
}

export interface DistributionRoyaltyShare {
  readonly contractId: string | null;
  readonly royaltyRuleId: string;
  readonly payeeId: string;
  readonly artistId: string;
  readonly role: string;
  readonly splitPercentage: string;
  readonly grossShare: string;
}

export interface EarningAllocationInsert {
  readonly earningId: string;
  readonly calculationRunId: string;
  readonly payeeId: string;
  readonly contractId: string | null;
  readonly trackId: string | null;
  readonly royaltyRuleId: string;
  readonly artistId: string;
  readonly role: string;
  readonly grossAmount: string;
  readonly originalGrossAmount: string;
  readonly fxRate: string;
  readonly grossShare: string;
  readonly recoupmentApplied: string;
  readonly netPayable: string;
  readonly splitPercentage: string;
  readonly currency: string;
  readonly originalCurrency: string;
  readonly status: "preview";
}

export interface ExpenseApplicationInsert {
  readonly costTermId: string;
  readonly payeeId: string;
  readonly amountApplied: string;
  readonly currency: string;
  readonly calculationRunId: string;
}

export interface CostTermStatusUpdate {
  readonly id: string;
  readonly status: "partially_recovered" | "recovered";
}

export interface DistributionSuspenseItemInsert {
  readonly earningId: string;
  readonly amount: string;
  readonly currency: string;
  readonly reasonCode: "invalid_split" | "missing_fx_rate";
  readonly message: string;
}

export interface DistributionAllocationSuspenseOutcome {
  readonly suspense: DistributionSuspenseItemInsert;
}

export interface DistributionAllocationPlan {
  readonly allocations: readonly EarningAllocationInsert[];
  readonly expenseApplications: readonly ExpenseApplicationInsert[];
  readonly costTermStatusUpdates: readonly CostTermStatusUpdate[];
}

interface ParsedRoyaltyRule {
  readonly contractId: string | null;
  readonly royaltyRuleId: string;
  readonly payeeId: string;
  readonly artistId: string;
  readonly role: string;
  readonly percentageUnits: bigint;
}

interface ParsedRoyaltyShare {
  readonly rule: ParsedRoyaltyRule;
  readonly grossShareUnits: bigint;
}

interface ParsedCostTerm {
  readonly id: string;
  readonly contractId: string;
  readonly payeeId: string | null;
  readonly amountUnits: bigint;
  readonly currency: string;
  readonly recoupable: boolean;
  readonly status: DistributionCostTermStatus;
  readonly expenseDate: string;
}

interface RecoupmentResult {
  readonly recoupmentAppliedUnits: bigint;
  readonly netPayableUnits: bigint;
  readonly expenseApplications: readonly ExpenseApplicationInsert[];
  readonly costTermStatusUpdates: readonly CostTermStatusUpdate[];
}

const PERCENTAGE_SCALE = 6;
const PERCENTAGE_ONE_HUNDRED_UNITS = 100_000_000n;

export function buildAllocationPlan(
  earning: DistributionEarningInput,
  rules: readonly DistributionRoyaltyRuleInput[],
  costState: DistributionCostState
): DistributionAllocationOutcome {
  const split = splitRoyaltyShares(earning, rules);
  if ("suspense" in split) {
    return split;
  }

  const appliedByTerm = buildAppliedByTerm(costState.expenseApplications);
  const parsedCostTerms = costState.costTerms.map(parseCostTerm);
  const allocations: EarningAllocationInsert[] = [];
  const expenseApplications: ExpenseApplicationInsert[] = [];
  const costTermStatusUpdates = new Map<string, CostTermStatusUpdate>();
  const grossAmountUnits = parseErhAmount(earning.grossAmount);
  const referenceDate = resolveReferenceDate(earning);

  // Check every share for a missing FX rate BEFORE allocating any of them: the earning is
  // all-or-nothing, so we must not build (and then discard) allocations for shares that
  // preceded the one missing a rate.
  for (const share of split) {
    const missingFxCurrency = findMissingFxCurrency(share, parsedCostTerms, appliedByTerm, costState.fxRates, earning.currency, referenceDate);
    if (missingFxCurrency !== null) {
      return {
        suspense: {
          earningId: earning.id,
          amount: formatErhAmount(grossAmountUnits),
          currency: earning.currency,
          reasonCode: "missing_fx_rate",
          message: `Missing recoupment FX rate from ${missingFxCurrency} to ${earning.currency} for ${referenceDate}.`
        }
      };
    }
  }

  for (const share of split) {
    const recoupment = applyRecoupmentForShare(earning, share, parsedCostTerms, appliedByTerm);
    for (const application of recoupment.expenseApplications) {
      expenseApplications.push(application);
    }
    for (const update of recoupment.costTermStatusUpdates) {
      costTermStatusUpdates.set(update.id, update);
    }

    allocations.push({
      earningId: earning.id,
      calculationRunId: earning.calculationRunId,
      payeeId: share.rule.payeeId,
      contractId: share.rule.contractId,
      trackId: earning.trackId,
      royaltyRuleId: share.rule.royaltyRuleId,
      artistId: share.rule.artistId,
      role: share.rule.role,
      grossAmount: formatErhAmount(grossAmountUnits),
      originalGrossAmount: formatErhAmount(grossAmountUnits),
      fxRate: "1.0000000000",
      grossShare: formatErhAmount(share.grossShareUnits),
      recoupmentApplied: formatErhAmount(recoupment.recoupmentAppliedUnits),
      netPayable: formatErhAmount(recoupment.netPayableUnits),
      splitPercentage: formatPercentage(share.rule.percentageUnits),
      currency: earning.currency,
      originalCurrency: earning.currency,
      status: "preview"
    });
  }

  return {
    allocations,
    expenseApplications,
    costTermStatusUpdates: [...costTermStatusUpdates.values()]
  };
}

export function splitRoyaltyShares(
  earning: DistributionEarningInput,
  rules: readonly DistributionRoyaltyRuleInput[]
): readonly ParsedRoyaltyShare[] | DistributionAllocationSuspenseOutcome {
  const orderedRules = rules.map(parseRoyaltyRule).sort(compareRuleById);
  const percentageTotal = orderedRules.reduce((sum: bigint, rule: ParsedRoyaltyRule) => sum + rule.percentageUnits, 0n);
  if (percentageTotal !== PERCENTAGE_ONE_HUNDRED_UNITS) {
    return {
      suspense: {
        earningId: earning.id,
        amount: formatErhAmount(parseErhAmount(earning.grossAmount)),
        currency: earning.currency,
        reasonCode: "invalid_split",
        message: `Royalty split must equal 100.000000, got ${formatPercentage(percentageTotal)}.`
      }
    };
  }

  const grossAmountUnits = parseErhAmount(earning.grossAmount);
  const shareUnits = splitRemainderLastScale6Percentages(grossAmountUnits, orderedRules.map((rule) => rule.percentageUnits));
  return orderedRules.map((rule, index) => ({
    rule,
    grossShareUnits: requireShareUnit(shareUnits, index, rule.royaltyRuleId)
  }));
}

function applyRecoupmentForShare(
  earning: DistributionEarningInput,
  share: ParsedRoyaltyShare,
  costTerms: readonly ParsedCostTerm[],
  appliedByTerm: Map<string, bigint>
): RecoupmentResult {
  if (share.rule.role === "label" || share.rule.contractId === null) {
    return emptyRecoupment(share.grossShareUnits);
  }

  const eligibleTerms = findEligibleSameCurrencyCostTerms(share.rule.contractId, share.rule.payeeId, earning.currency, costTerms);
  const recoupableRemaining = sumRemainingCostTerms(eligibleTerms, appliedByTerm);
  if (recoupableRemaining <= 0n) {
    return emptyRecoupment(share.grossShareUnits);
  }

  // VERIFY: PHP currently lets negative earning shares flow through min(remaining, gross_share);
  // this pins chargeback/refund behaviour until the F4 carry-forward domain decision.
  const recoupmentAppliedUnits = minUnits(recoupableRemaining, share.grossShareUnits);
  const netPayableUnits = erhMoney.sub(share.grossShareUnits, recoupmentAppliedUnits);
  if (recoupmentAppliedUnits <= 0n) {
    return {
      recoupmentAppliedUnits,
      netPayableUnits,
      expenseApplications: [],
      costTermStatusUpdates: []
    };
  }

  return distributeRecoupment(earning, share.rule.payeeId, eligibleTerms, appliedByTerm, recoupmentAppliedUnits, netPayableUnits);
}

function distributeRecoupment(
  earning: DistributionEarningInput,
  payeeId: string,
  terms: readonly ParsedCostTerm[],
  appliedByTerm: Map<string, bigint>,
  recoupmentAppliedUnits: bigint,
  netPayableUnits: bigint
): RecoupmentResult {
  const expenseApplications: ExpenseApplicationInsert[] = [];
  const costTermStatusUpdates: CostTermStatusUpdate[] = [];
  let remainingToApply = recoupmentAppliedUnits;

  for (const term of [...terms].sort(compareCostTermByFifo)) {
    if (remainingToApply <= 0n) {
      break;
    }

    const termRemaining = remainingForTerm(term, appliedByTerm);
    if (termRemaining <= 0n) {
      continue;
    }

    const chunk = minUnits(remainingToApply, termRemaining);
    const previousApplied = appliedByTerm.get(term.id) ?? 0n;
    const nextApplied = erhMoney.add(previousApplied, chunk);
    appliedByTerm.set(term.id, nextApplied);
    remainingToApply = erhMoney.sub(remainingToApply, chunk);
    expenseApplications.push({
      costTermId: term.id,
      payeeId,
      amountApplied: formatErhAmount(chunk),
      currency: earning.currency,
      calculationRunId: earning.calculationRunId
    });
    costTermStatusUpdates.push({
      id: term.id,
      status: nextApplied >= term.amountUnits ? "recovered" : "partially_recovered"
    });
  }

  return {
    recoupmentAppliedUnits,
    netPayableUnits,
    expenseApplications,
    costTermStatusUpdates
  };
}

function findMissingFxCurrency(
  share: ParsedRoyaltyShare,
  costTerms: readonly ParsedCostTerm[],
  appliedByTerm: ReadonlyMap<string, bigint>,
  fxRates: readonly DistributionFxRateInput[],
  earningCurrency: string,
  referenceDate: string
): string | null {
  if (share.rule.role === "label" || share.rule.contractId === null) {
    return null;
  }

  // LIMITATION: PHP gates foreign recoupable balances on FX availability but
  // does not apply cross-currency recoupment here. Converting advances across
  // currencies changes recovered money and is deferred for a domain call.
  const foreignTerms = costTerms.filter(
    (term) =>
      term.contractId === share.rule.contractId &&
      term.recoupable &&
      isOpenForFxGate(term.status) &&
      term.currency !== earningCurrency &&
      payeeScopeMatches(term.payeeId, share.rule.payeeId) &&
      remainingForTerm(term, appliedByTerm) > 0n
  );
  const missingTerm = foreignTerms.find((term) => !hasFxRate(fxRates, term.currency, earningCurrency, referenceDate));
  return missingTerm?.currency ?? null;
}

function findEligibleSameCurrencyCostTerms(
  contractId: string,
  payeeId: string,
  currency: string,
  costTerms: readonly ParsedCostTerm[]
): readonly ParsedCostTerm[] {
  return costTerms.filter(
    (term) =>
      term.contractId === contractId &&
      term.recoupable &&
      term.status !== "deleted" &&
      term.status !== "non_recoverable" &&
      term.currency === currency &&
      payeeScopeMatches(term.payeeId, payeeId)
  );
}

function sumRemainingCostTerms(terms: readonly ParsedCostTerm[], appliedByTerm: ReadonlyMap<string, bigint>): bigint {
  return terms.reduce((sum: bigint, term: ParsedCostTerm) => {
    const remaining = remainingForTerm(term, appliedByTerm);
    return remaining > 0n ? erhMoney.add(sum, remaining) : sum;
  }, 0n);
}

function remainingForTerm(term: ParsedCostTerm, appliedByTerm: ReadonlyMap<string, bigint>): bigint {
  return erhMoney.sub(term.amountUnits, appliedByTerm.get(term.id) ?? 0n);
}

function splitRemainderLastScale6Percentages(totalUnits: bigint, percentageUnits: readonly bigint[]): readonly bigint[] {
  const parts: bigint[] = [];
  let allocated = 0n;
  for (let index = 0; index < percentageUnits.length - 1; index += 1) {
    const part = erhMoney.mulByRatio(totalUnits, requirePercentageUnit(percentageUnits, index), PERCENTAGE_ONE_HUNDRED_UNITS);
    parts.push(part);
    allocated = erhMoney.add(allocated, part);
  }

  parts.push(erhMoney.sub(totalUnits, allocated));
  return parts;
}

function buildAppliedByTerm(expenseApplications: readonly DistributionExistingExpenseApplication[]): Map<string, bigint> {
  const appliedByTerm = new Map<string, bigint>();
  for (const application of expenseApplications) {
    const current = appliedByTerm.get(application.costTermId) ?? 0n;
    appliedByTerm.set(application.costTermId, erhMoney.add(current, parseErhAmount(application.amountApplied)));
  }

  return appliedByTerm;
}

function parseRoyaltyRule(rule: DistributionRoyaltyRuleInput): ParsedRoyaltyRule {
  return {
    contractId: rule.contractId,
    royaltyRuleId: rule.royaltyRuleId,
    payeeId: rule.payeeId,
    artistId: rule.artistId,
    role: rule.role,
    percentageUnits: parsePercentage(rule.percentage)
  };
}

function parseCostTerm(term: DistributionCostTermInput): ParsedCostTerm {
  return {
    id: term.id,
    contractId: term.contractId,
    payeeId: term.payeeId,
    amountUnits: parseErhAmount(term.amount),
    currency: term.currency,
    recoupable: term.recoupable,
    status: term.status,
    expenseDate: term.expenseDate
  };
}

function parseErhAmount(value: string): bigint {
  return erhMoney.parse(value);
}

function formatErhAmount(value: bigint): string {
  return erhMoney.format(value);
}

function parsePercentage(value: string): bigint {
  return parseScaledUnits(value, PERCENTAGE_SCALE, "TRUNCATE");
}

function formatPercentage(value: bigint): string {
  return formatScaledUnits(value, PERCENTAGE_SCALE);
}

function resolveReferenceDate(earning: DistributionEarningInput): string {
  return earning.saleDate ?? earning.periodEnd ?? earning.periodStart ?? earning.today;
}

function payeeScopeMatches(termPayeeId: string | null, sharePayeeId: string): boolean {
  return termPayeeId === null || termPayeeId === "0" || termPayeeId === sharePayeeId;
}

function hasFxRate(fxRates: readonly DistributionFxRateInput[], fromCurrency: string, toCurrency: string, referenceDate: string): boolean {
  return fxRates.some((rate) => rate.fromCurrency === fromCurrency && rate.toCurrency === toCurrency && rate.effectiveDate === referenceDate);
}

function isOpenForFxGate(status: DistributionCostTermStatus): boolean {
  return status !== "deleted" && status !== "recovered" && status !== "non_recoverable" && status !== "satisfied" && status !== "cancelled";
}

function compareRuleById(left: ParsedRoyaltyRule, right: ParsedRoyaltyRule): number {
  return left.royaltyRuleId.localeCompare(right.royaltyRuleId);
}

function compareCostTermByFifo(left: ParsedCostTerm, right: ParsedCostTerm): number {
  const dateOrder = left.expenseDate.localeCompare(right.expenseDate);
  return dateOrder === 0 ? left.id.localeCompare(right.id) : dateOrder;
}

function minUnits(left: bigint, right: bigint): bigint {
  return left <= right ? left : right;
}

function requirePercentageUnit(percentageUnits: readonly bigint[], index: number): bigint {
  const unit = percentageUnits[index];
  if (unit === undefined) {
    throw new Error(`Missing royalty split percentage at index ${index}.`);
  }

  return unit;
}

function requireShareUnit(shareUnits: readonly bigint[], index: number, royaltyRuleId: string): bigint {
  const unit = shareUnits[index];
  if (unit === undefined) {
    throw new Error(`Missing royalty share for rule ${royaltyRuleId}.`);
  }

  return unit;
}

function emptyRecoupment(grossShareUnits: bigint): RecoupmentResult {
  return {
    recoupmentAppliedUnits: 0n,
    netPayableUnits: grossShareUnits,
    expenseApplications: [],
    costTermStatusUpdates: []
  };
}
