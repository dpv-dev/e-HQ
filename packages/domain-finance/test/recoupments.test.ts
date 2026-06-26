import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRecoupments,
  compareRecoupableExpenseOrder,
  type RecoupableExpense
} from "../src/recoupments.ts";
import { assembleStatement, computeCarryForward, type StatementLineInput } from "../src/statements.ts";
import {
  createCurrencyCode,
  createMoneyAmount,
  createMoneyMicroUnits,
  formatMoneyAmount,
  parseDecimalToMicroUnits
} from "../src/money.ts";
import type { AllocationLine, CurrencyCode, MoneyAmount } from "../src/types.ts";

const eur = createCurrencyCode("EUR");
const usd = createCurrencyCode("USD");

interface GoldenRecoupmentCase {
  readonly name: string;
  readonly payeeId: string;
  readonly contractId: string | null;
  readonly role: string;
  readonly earning: string;
  readonly expenses: readonly RecoupableExpense[];
  readonly expectedRecouped: string;
  readonly expectedNet: string;
  readonly expectedOpenBefore: string;
  readonly expectedOpenAfter: string;
  readonly expectedApplications: readonly [string, string][];
}

const goldenCases: readonly GoldenRecoupmentCase[] = [
  {
    name: "no open recoupable balance pays full earnings",
    payeeId: "payee-1",
    contractId: "contract-1",
    role: "artist",
    earning: "100.000000",
    expenses: [],
    expectedRecouped: "0.000000",
    expectedNet: "100.000000",
    expectedOpenBefore: "0.000000",
    expectedOpenAfter: "0.000000",
    expectedApplications: []
  },
  {
    name: "full expense recovery leaves surplus net payable",
    payeeId: "payee-1",
    contractId: "contract-1",
    role: "artist",
    earning: "100.000000",
    expenses: [
      expense("expense-1", "contract-1", "payee-1", "40.000000", "0.000000", eur, "2026-01-01", "open", true)
    ],
    expectedRecouped: "40.000000",
    expectedNet: "60.000000",
    expectedOpenBefore: "40.000000",
    expectedOpenAfter: "0.000000",
    expectedApplications: [["expense-1", "40.000000"]]
  },
  {
    name: "partial recovery consumes all earnings and carries remaining balance",
    payeeId: "payee-1",
    contractId: "contract-1",
    role: "artist",
    earning: "30.000000",
    expenses: [
      expense("expense-1", "contract-1", "payee-1", "100.000000", "0.000000", eur, "2026-01-01", "open", true)
    ],
    expectedRecouped: "30.000000",
    expectedNet: "0.000000",
    expectedOpenBefore: "100.000000",
    expectedOpenAfter: "70.000000",
    expectedApplications: [["expense-1", "30.000000"]]
  },
  {
    name: "FIFO recovery fills oldest expense before later expense",
    payeeId: "payee-1",
    contractId: "contract-1",
    role: "artist",
    earning: "90.000000",
    expenses: [
      expense("expense-10", "contract-1", "payee-1", "100.000000", "0.000000", eur, "2026-02-01", "open", true),
      expense("expense-2", "contract-1", "payee-1", "50.000000", "0.000000", eur, "2026-01-01", "open", true)
    ],
    expectedRecouped: "90.000000",
    expectedNet: "0.000000",
    expectedOpenBefore: "150.000000",
    expectedOpenAfter: "60.000000",
    expectedApplications: [
      ["expense-2", "50.000000"],
      ["expense-10", "40.000000"]
    ]
  },
  {
    name: "global and payee-specific costs recover while other payee cost is skipped",
    payeeId: "payee-1",
    contractId: "contract-1",
    role: "artist",
    earning: "80.000000",
    expenses: [
      expense("expense-1", "contract-1", null, "30.000000", "0.000000", eur, "2026-01-01", "open", true),
      expense("expense-2", "contract-1", "payee-2", "50.000000", "0.000000", eur, "2026-01-02", "open", true),
      expense("expense-3", "contract-1", "payee-1", "60.000000", "0.000000", eur, "2026-01-03", "open", true)
    ],
    expectedRecouped: "80.000000",
    expectedNet: "0.000000",
    expectedOpenBefore: "90.000000",
    expectedOpenAfter: "10.000000",
    expectedApplications: [
      ["expense-1", "30.000000"],
      ["expense-3", "50.000000"]
    ]
  },
  {
    name: "same-currency rule skips foreign expense until FX prompt",
    payeeId: "payee-1",
    contractId: "contract-1",
    role: "artist",
    earning: "100.000000",
    expenses: [
      expense("expense-1", "contract-1", "payee-1", "40.000000", "0.000000", eur, "2026-01-01", "open", true),
      expense("expense-2", "contract-1", "payee-1", "50.000000", "0.000000", usd, "2026-01-02", "open", true)
    ],
    expectedRecouped: "40.000000",
    expectedNet: "60.000000",
    expectedOpenBefore: "40.000000",
    expectedOpenAfter: "0.000000",
    expectedApplications: [["expense-1", "40.000000"]]
  },
  {
    name: "label role bypasses recoupment",
    payeeId: "payee-1",
    contractId: "contract-1",
    role: "label",
    earning: "100.000000",
    expenses: [
      expense("expense-1", "contract-1", "payee-1", "80.000000", "0.000000", eur, "2026-01-01", "open", true)
    ],
    expectedRecouped: "0.000000",
    expectedNet: "100.000000",
    expectedOpenBefore: "0.000000",
    expectedOpenAfter: "0.000000",
    expectedApplications: []
  },
  {
    name: "partially recovered expense only exposes its remaining balance",
    payeeId: "payee-1",
    contractId: "contract-1",
    role: "artist",
    earning: "50.000000",
    expenses: [
      expense("expense-1", "contract-1", "payee-1", "100.000000", "70.000000", eur, "2026-01-01", "partially-recovered", true)
    ],
    expectedRecouped: "30.000000",
    expectedNet: "20.000000",
    expectedOpenBefore: "30.000000",
    expectedOpenAfter: "0.000000",
    expectedApplications: [["expense-1", "30.000000"]]
  },
  {
    name: "non-recoupable and recovered costs are ignored",
    payeeId: "payee-1",
    contractId: "contract-1",
    role: "artist",
    earning: "25.000000",
    expenses: [
      expense("expense-1", "contract-1", "payee-1", "10.000000", "0.000000", eur, "2026-01-01", "open", false),
      expense("expense-2", "contract-1", "payee-1", "15.000000", "15.000000", eur, "2026-01-02", "recovered", true)
    ],
    expectedRecouped: "0.000000",
    expectedNet: "25.000000",
    expectedOpenBefore: "0.000000",
    expectedOpenAfter: "0.000000",
    expectedApplications: []
  }
];

test("golden recoupment oracle cases match the production plugin rules", () => {
  for (const goldenCase of goldenCases) {
    const result = applyGoldenCase(goldenCase);
    assert.equal(formatMoneyAmount(result.recoupedAmount), goldenCase.expectedRecouped, goldenCase.name);
    assert.equal(formatMoneyAmount(result.netPayable), goldenCase.expectedNet, goldenCase.name);
    assert.equal(formatMoneyAmount(result.openBalanceBefore), goldenCase.expectedOpenBefore, goldenCase.name);
    assert.equal(formatMoneyAmount(result.openBalanceAfter), goldenCase.expectedOpenAfter, goldenCase.name);
    assert.deepEqual(
      result.applications.map((application) => [application.expenseId, formatMoneyAmount(application.appliedAmount)]),
      goldenCase.expectedApplications,
      goldenCase.name
    );
    assert.equal(
      result.auditRecords.reduce((sum: bigint, record) => sum + record.applied_micro, 0n),
      result.recoupedAmount.amountMicro,
      goldenCase.name
    );
  }
});

test("recoupment ordering is deterministic FIFO by expense date then id", () => {
  const ordered = [
    expense("10", "contract-1", "payee-1", "1.000000", "0.000000", eur, "2026-01-02", "open", true),
    expense("2", "contract-1", "payee-1", "1.000000", "0.000000", eur, null, "open", true),
    expense("1", "contract-1", "payee-1", "1.000000", "0.000000", eur, null, "open", true),
    expense("3", "contract-1", "payee-1", "1.000000", "0.000000", eur, "2026-01-01", "open", true)
  ].sort(compareRecoupableExpenseOrder);

  assert.deepEqual(ordered.map((item) => item.id), ["1", "2", "3", "10"]);
});

test("recoupment conservation invariant holds across generated earnings and balances", () => {
  let seed = 98_765n;

  for (let index = 0; index < 200; index += 1) {
    const earningMicro = 1n + BigInt(nextInt(1_000_000));
    const expenseCount = 1 + nextInt(6);
    const expenses = Array.from({ length: expenseCount }, (_value, expenseIndex) => {
      const amountMicro = 1n + BigInt(nextInt(400_000));
      const appliedMicro = BigInt(nextInt(Number(amountMicro)));
      return expenseFromMicro(
        `${expenseIndex + 1}`,
        "contract-random",
        "payee-random",
        amountMicro,
        appliedMicro,
        eur,
        `2026-01-${String(expenseIndex + 1).padStart(2, "0")}`,
        appliedMicro === 0n ? "open" : "partially-recovered",
        true
      );
    });
    const allocationLine = allocation("random-allocation", "payee-random", moneyFromMicro(earningMicro, eur));
    const result = applyRecoupments({
      allocationLine,
      contractId: "contract-random",
      payeeId: "payee-random",
      role: "artist",
      openExpenses: expenses
    });
    const conservedEarnings = result.recoupedAmount.amountMicro + result.netPayable.amountMicro;
    assert.equal(conservedEarnings, earningMicro);
    assert.equal(result.openBalanceBefore.amountMicro - result.recoupedAmount.amountMicro, result.openBalanceAfter.amountMicro);
    assert.equal(result.openBalanceAfter.amountMicro >= 0n, true);
    assert.equal(
      result.auditRecords.reduce((sum: bigint, record) => sum + record.applied_micro, 0n),
      result.recoupedAmount.amountMicro
    );
  }

  function nextInt(maxExclusive: number): number {
    seed = (seed * 48_271n) % 2_147_483_647n;
    return Number(seed % BigInt(maxExclusive));
  }
});

test("statement assembly reconciles lines, totals, and carry-forward amount due", () => {
  const line1 = statementLine("allocation-1", "source-1", "payee-1", "100.000000", "40.000000", "60.000000", eur);
  const line2 = statementLine("allocation-2", "source-2", "payee-1", "20.000000", "0.000000", "20.000000", eur);
  const statement = assembleStatement({
    statementId: "statement-1",
    payeeId: "payee-1",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    currency: eur,
    version: 1,
    openingBalance: money("-50.000000", eur),
    lines: [line1, line2]
  });

  assert.equal(formatMoneyAmount(statement.statement.grossTotal), "120.000000");
  assert.equal(formatMoneyAmount(statement.statement.recoupmentTotal), "40.000000");
  assert.equal(formatMoneyAmount(statement.statement.netPayable), "80.000000");
  assert.equal(formatMoneyAmount(statement.statement.amountDue), "30.000000");
  assert.equal(formatMoneyAmount(statement.balanceMovement.closingBalance), "0.000000");
  assert.equal(statement.lines.length, 2);
  assert.equal(statement.auditRecords.length, 2);
});

test("carry-forward keeps negative balance when period net does not clear it", () => {
  const carry = computeCarryForward(money("-100.000000", eur), money("60.000000", eur));
  assert.equal(formatMoneyAmount(carry.amountDue), "0.000000");
  assert.equal(formatMoneyAmount(carry.closingBalance), "-40.000000");
});

test("statement assembly rejects unreconciled line totals", () => {
  const badLine = statementLine("allocation-1", "source-1", "payee-1", "10.000000", "3.000000", "8.000000", eur);
  assert.throws(
    () =>
      assembleStatement({
        statementId: "statement-bad",
        payeeId: "payee-1",
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
        currency: eur,
        version: 1,
        openingBalance: money("0.000000", eur),
        lines: [badLine]
      }),
    /recoupment plus net payable/
  );
});

function applyGoldenCase(goldenCase: GoldenRecoupmentCase) {
  return applyRecoupments({
    allocationLine: allocation(`${goldenCase.name}:allocation`, goldenCase.payeeId, money(goldenCase.earning, eur)),
    contractId: goldenCase.contractId,
    payeeId: goldenCase.payeeId,
    role: goldenCase.role,
    openExpenses: goldenCase.expenses
  });
}

function expense(
  id: string,
  contractId: string,
  payeeId: string | null,
  amount: string,
  appliedAmount: string,
  currency: CurrencyCode,
  expenseDate: string | null,
  status: RecoupableExpense["status"],
  recoupable: boolean
): RecoupableExpense {
  return {
    id,
    contractId,
    payeeId,
    amount: money(amount, currency),
    appliedAmount: money(appliedAmount, currency),
    recoupable,
    status,
    expenseDate
  };
}

function expenseFromMicro(
  id: string,
  contractId: string,
  payeeId: string | null,
  amountMicro: bigint,
  appliedMicro: bigint,
  currency: CurrencyCode,
  expenseDate: string | null,
  status: RecoupableExpense["status"],
  recoupable: boolean
): RecoupableExpense {
  return {
    id,
    contractId,
    payeeId,
    amount: moneyFromMicro(amountMicro, currency),
    appliedAmount: moneyFromMicro(appliedMicro, currency),
    recoupable,
    status,
    expenseDate
  };
}

function allocation(id: string, payeeId: string, grossAmount: MoneyAmount): AllocationLine {
  const zero = createMoneyAmount(createMoneyMicroUnits(0n), grossAmount.currency);
  return {
    sourceId: id,
    participantId: payeeId,
    grossAmount,
    recoupmentAmount: zero,
    netAmount: grossAmount
  };
}

function statementLine(
  earningAllocationId: string,
  sourceId: string,
  payeeId: string,
  grossShare: string,
  recoupmentApplied: string,
  netPayable: string,
  currency: CurrencyCode
): StatementLineInput {
  return {
    earningAllocationId,
    sourceId,
    payeeId,
    trackId: null,
    releaseId: null,
    dsp: null,
    country: null,
    quantity: "0.000000",
    grossShare: money(grossShare, currency),
    recoupmentApplied: money(recoupmentApplied, currency),
    netPayable: money(netPayable, currency)
  };
}

function money(decimalValue: string, currency: CurrencyCode): MoneyAmount {
  return parseDecimalToMicroUnits(decimalValue, currency);
}

function moneyFromMicro(amountMicro: bigint, currency: CurrencyCode): MoneyAmount {
  return createMoneyAmount(createMoneyMicroUnits(amountMicro), currency);
}
