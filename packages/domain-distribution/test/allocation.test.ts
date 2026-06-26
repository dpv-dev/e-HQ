import assert from "node:assert/strict";
import test from "node:test";
import {
  type DistributionAllocationPlan,
  type DistributionAllocationSuspenseOutcome,
  type DistributionCostState,
  type DistributionEarningInput,
  type DistributionRoyaltyRuleInput,
  buildAllocationPlan
} from "../src/allocation.ts";

const emptyCostState: DistributionCostState = {
  costTerms: [],
  expenseApplications: [],
  fxRates: []
};

function earning(grossAmount: string): DistributionEarningInput {
  return {
    id: "earning_1",
    calculationRunId: "run_1",
    trackId: "track_1",
    grossAmount,
    currency: "USD",
    saleDate: "2026-01-31",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    today: "2026-06-21"
  };
}

function rule(id: string, percentage: string, payeeId: string, role: string, contractId: string | null): DistributionRoyaltyRuleInput {
  return {
    contractId,
    royaltyRuleId: id,
    payeeId,
    artistId: `artist_${payeeId}`,
    role,
    percentage
  };
}

function assertPlan(outcome: ReturnType<typeof buildAllocationPlan>): DistributionAllocationPlan {
  assert.ok(!("suspense" in outcome));
  return outcome;
}

function assertSuspense(outcome: ReturnType<typeof buildAllocationPlan>): DistributionAllocationSuspenseOutcome {
  assert.ok("suspense" in outcome);
  return outcome;
}

test("royalty split orders rules by id and reconciles a 60/40 remainder-last split exactly", () => {
  const plan = assertPlan(
    buildAllocationPlan(
      earning("1.0000000001"),
      [rule("rule_b", "40.000000", "payee_b", "artist", "contract_1"), rule("rule_a", "60.000000", "payee_a", "artist", "contract_1")],
      emptyCostState
    )
  );

  assert.deepEqual(
    plan.allocations.map((allocation) => ({
      royaltyRuleId: allocation.royaltyRuleId,
      splitPercentage: allocation.splitPercentage,
      grossShare: allocation.grossShare,
      recoupmentApplied: allocation.recoupmentApplied,
      netPayable: allocation.netPayable
    })),
    [
      {
        royaltyRuleId: "rule_a",
        splitPercentage: "60.000000",
        grossShare: "0.6000000000",
        recoupmentApplied: "0.0000000000",
        netPayable: "0.6000000000"
      },
      {
        royaltyRuleId: "rule_b",
        splitPercentage: "40.000000",
        grossShare: "0.4000000001",
        recoupmentApplied: "0.0000000000",
        netPayable: "0.4000000001"
      }
    ]
  );
});

test("strict split validation sends 99.999999 to suspense", () => {
  const outcome = assertSuspense(buildAllocationPlan(earning("10.0000000000"), [rule("rule_a", "99.999999", "payee_a", "artist", "contract_1")], emptyCostState));

  assert.deepEqual(outcome.suspense, {
    earningId: "earning_1",
    amount: "10.0000000000",
    currency: "USD",
    reasonCode: "invalid_split",
    message: "Royalty split must equal 100.000000, got 99.999999."
  });
});

test("recoupment caps at gross share when cost is greater than the share", () => {
  const plan = assertPlan(
    buildAllocationPlan(earning("100.0000000000"), [rule("rule_a", "100.000000", "payee_a", "artist", "contract_1")], {
      costTerms: [
        {
          id: "cost_1",
          contractId: "contract_1",
          payeeId: "payee_a",
          amount: "150.0000000000",
          currency: "USD",
          recoupable: true,
          status: "open",
          expenseDate: "2026-01-01"
        }
      ],
      expenseApplications: [],
      fxRates: []
    })
  );

  assert.equal(plan.allocations[0]?.recoupmentApplied, "100.0000000000");
  assert.equal(plan.allocations[0]?.netPayable, "0.0000000000");
  assert.deepEqual(plan.expenseApplications, [
    {
      costTermId: "cost_1",
      payeeId: "payee_a",
      amountApplied: "100.0000000000",
      currency: "USD",
      calculationRunId: "run_1"
    }
  ]);
  assert.deepEqual(plan.costTermStatusUpdates, [{ id: "cost_1", status: "partially_recovered" }]);
});

test("recoupment caps at remaining cost when cost is smaller than the share", () => {
  const plan = assertPlan(
    buildAllocationPlan(earning("100.0000000000"), [rule("rule_a", "100.000000", "payee_a", "artist", "contract_1")], {
      costTerms: [
        {
          id: "cost_1",
          contractId: "contract_1",
          payeeId: "payee_a",
          amount: "40.0000000000",
          currency: "USD",
          recoupable: true,
          status: "open",
          expenseDate: "2026-01-01"
        }
      ],
      expenseApplications: [],
      fxRates: []
    })
  );

  assert.equal(plan.allocations[0]?.recoupmentApplied, "40.0000000000");
  assert.equal(plan.allocations[0]?.netPayable, "60.0000000000");
  assert.deepEqual(plan.costTermStatusUpdates, [{ id: "cost_1", status: "recovered" }]);
});

test("recoupment distributes FIFO across cost terms at scale 10", () => {
  const plan = assertPlan(
    buildAllocationPlan(earning("0.0000000003"), [rule("rule_a", "100.000000", "payee_a", "artist", "contract_1")], {
      costTerms: [
        {
          id: "cost_new",
          contractId: "contract_1",
          payeeId: "payee_a",
          amount: "0.0000000002",
          currency: "USD",
          recoupable: true,
          status: "open",
          expenseDate: "2026-01-02"
        },
        {
          id: "cost_old",
          contractId: "contract_1",
          payeeId: "payee_a",
          amount: "0.0000000001",
          currency: "USD",
          recoupable: true,
          status: "open",
          expenseDate: "2026-01-01"
        }
      ],
      expenseApplications: [],
      fxRates: []
    })
  );

  assert.deepEqual(plan.expenseApplications, [
    {
      costTermId: "cost_old",
      payeeId: "payee_a",
      amountApplied: "0.0000000001",
      currency: "USD",
      calculationRunId: "run_1"
    },
    {
      costTermId: "cost_new",
      payeeId: "payee_a",
      amountApplied: "0.0000000002",
      currency: "USD",
      calculationRunId: "run_1"
    }
  ]);
  assert.equal(plan.allocations[0]?.netPayable, "0.0000000000");
});

test("label shares are not recouped", () => {
  const plan = assertPlan(
    buildAllocationPlan(earning("100.0000000000"), [rule("rule_a", "100.000000", "payee_label", "label", "contract_1")], {
      costTerms: [
        {
          id: "cost_1",
          contractId: "contract_1",
          payeeId: "payee_label",
          amount: "100.0000000000",
          currency: "USD",
          recoupable: true,
          status: "open",
          expenseDate: "2026-01-01"
        }
      ],
      expenseApplications: [],
      fxRates: []
    })
  );

  assert.equal(plan.allocations[0]?.recoupmentApplied, "0.0000000000");
  assert.equal(plan.allocations[0]?.netPayable, "100.0000000000");
  assert.deepEqual(plan.expenseApplications, []);
});

test("payee scoped costs apply globally for null or zero payee and ignore other payees", () => {
  const plan = assertPlan(
    buildAllocationPlan(earning("100.0000000000"), [rule("rule_a", "100.000000", "payee_a", "artist", "contract_1")], {
      costTerms: [
        {
          id: "cost_global_null",
          contractId: "contract_1",
          payeeId: null,
          amount: "10.0000000000",
          currency: "USD",
          recoupable: true,
          status: "open",
          expenseDate: "2026-01-01"
        },
        {
          id: "cost_global_zero",
          contractId: "contract_1",
          payeeId: "0",
          amount: "20.0000000000",
          currency: "USD",
          recoupable: true,
          status: "open",
          expenseDate: "2026-01-02"
        },
        {
          id: "cost_other_payee",
          contractId: "contract_1",
          payeeId: "payee_b",
          amount: "40.0000000000",
          currency: "USD",
          recoupable: true,
          status: "open",
          expenseDate: "2026-01-03"
        }
      ],
      expenseApplications: [],
      fxRates: []
    })
  );

  assert.equal(plan.allocations[0]?.recoupmentApplied, "30.0000000000");
  assert.equal(plan.allocations[0]?.netPayable, "70.0000000000");
  assert.deepEqual(
    plan.expenseApplications.map((application) => application.costTermId),
    ["cost_global_null", "cost_global_zero"]
  );
});

test("missing cross-currency recoupment FX sends the whole earning to suspense", () => {
  const outcome = assertSuspense(
    buildAllocationPlan(earning("100.0000000000"), [rule("rule_a", "100.000000", "payee_a", "artist", "contract_1")], {
      costTerms: [
        {
          id: "cost_eur",
          contractId: "contract_1",
          payeeId: "payee_a",
          amount: "50.0000000000",
          currency: "EUR",
          recoupable: true,
          status: "open",
          expenseDate: "2026-01-01"
        }
      ],
      expenseApplications: [],
      fxRates: []
    })
  );

  assert.equal(outcome.suspense.reasonCode, "missing_fx_rate");
  assert.equal(outcome.suspense.message, "Missing recoupment FX rate from EUR to USD for 2026-01-31.");
});

test("negative earning behaviour is pinned for domain review", () => {
  const plan = assertPlan(
    buildAllocationPlan(earning("-10.0000000000"), [rule("rule_a", "100.000000", "payee_a", "artist", "contract_1")], {
      costTerms: [
        {
          id: "cost_1",
          contractId: "contract_1",
          payeeId: "payee_a",
          amount: "100.0000000000",
          currency: "USD",
          recoupable: true,
          status: "open",
          expenseDate: "2026-01-01"
        }
      ],
      expenseApplications: [],
      fxRates: []
    })
  );

  assert.equal(plan.allocations[0]?.grossShare, "-10.0000000000");
  assert.equal(plan.allocations[0]?.recoupmentApplied, "-10.0000000000");
  assert.equal(plan.allocations[0]?.netPayable, "0.0000000000");
  assert.deepEqual(plan.expenseApplications, []);
});
