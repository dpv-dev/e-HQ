import type { AllocationLine, BasisPointShare, MoneyAmount } from "./types.js";
import { raiseFinanceDomainError } from "./errors.js";
import { addMoney, allocateMoneyByBasisPoints, assertSameCurrency, createMoneyAmount, createMoneyMicroUnits } from "./money.js";

export interface AllocationRequest {
  readonly sourceId: string;
  readonly grossAmount: MoneyAmount;
  readonly shares: readonly BasisPointShare[];
}

export interface AllocationResult {
  readonly sourceId: string;
  readonly lines: readonly AllocationLine[];
  readonly allocatedTotal: MoneyAmount;
}

export function allocateLargestRemainder(request: AllocationRequest): AllocationResult {
  if (request.sourceId.length === 0) {
    raiseFinanceDomainError("allocation_invalid", "Allocation source id is required.", {
      sourceId: request.sourceId
    });
  }

  const allocatedAmounts = allocateMoneyByBasisPoints(request.grossAmount, request.shares);
  const lines = request.shares.map((share: BasisPointShare, index: number) => {
    const grossAmount = allocatedAmounts[index];
    if (grossAmount === undefined) {
      raiseFinanceDomainError("allocation_invalid", "Allocated amount missing for share.", {
        sourceId: request.sourceId,
        participantId: share.participantId,
        index: String(index)
      });
    }

    const recoupmentAmount = createMoneyAmount(createMoneyMicroUnits(0n), request.grossAmount.currency);
    return {
      sourceId: request.sourceId,
      participantId: share.participantId,
      grossAmount,
      recoupmentAmount,
      netAmount: grossAmount
    };
  });

  const result = {
    sourceId: request.sourceId,
    lines,
    allocatedTotal: request.grossAmount
  };
  assertAllocationComplete(result);
  return result;
}

export function assertAllocationComplete(result: AllocationResult): void {
  const firstLine = result.lines[0];
  if (firstLine === undefined) {
    raiseFinanceDomainError("allocation_invalid", "Allocation result must contain at least one line.", {
      sourceId: result.sourceId
    });
  }

  const total = result.lines
    .slice(1)
    .map((line: AllocationLine) => line.grossAmount)
    .reduce((sum: MoneyAmount, amount: MoneyAmount) => addMoney(sum, amount), firstLine.grossAmount);

  assertSameCurrency(total, result.allocatedTotal);
  if (total.amountMicro !== result.allocatedTotal.amountMicro) {
    raiseFinanceDomainError("allocation_invalid", "Allocation lines must sum exactly to the source amount.", {
      sourceId: result.sourceId,
      lineTotalMicro: total.amountMicro.toString(),
      expectedMicro: result.allocatedTotal.amountMicro.toString()
    });
  }
}
