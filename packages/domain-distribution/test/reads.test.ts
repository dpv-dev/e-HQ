import assert from "node:assert/strict";
import test from "node:test";
import {
  type DistributionReadDataset,
  readAllocationList,
  readEarningsPreview,
  readStatementSummaries,
  readSuspense
} from "../src/reads.ts";

const fixture: DistributionReadDataset = {
  importBatches: [
    {
      id: "batch_kontor",
      source: "kontor",
      fileName: "kontor.csv",
      status: "completed",
      importedAt: "2026-04-30T10:00:00.000Z"
    }
  ],
  normalizedEarnings: [
    {
      id: "earning_matched",
      batchId: "batch_kontor",
      dsp: "Spotify",
      grossAmount: "100.0000000000",
      quantity: "10.000000",
      currency: "USD",
      isrc: "MUAAA2600001",
      upc: "742000000001",
      rawTitle: "Seggae light",
      rawArtist: "Kaya",
      rawLabel: "Babani",
      mappingStatus: "matched",
      calculationStatus: "calculated"
    },
    {
      id: "earning_suspense",
      batchId: "batch_kontor",
      dsp: "Apple Music",
      grossAmount: "50.0000000000",
      quantity: "5.000000",
      currency: "USD",
      isrc: null,
      upc: "742000000002",
      rawTitle: "Unknown",
      rawArtist: "Unknown",
      rawLabel: "Babani",
      mappingStatus: "suspense",
      calculationStatus: "error"
    }
  ],
  calculationRuns: [
    {
      id: "run_1",
      batchId: "batch_kontor",
      status: "calculated",
      startedAt: "2026-05-01T10:00:00.000Z",
      finishedAt: "2026-05-01T10:10:00.000Z",
      createdAt: "2026-05-01T09:59:00.000Z"
    }
  ],
  earningAllocations: [
    {
      id: "alloc_alma",
      earningId: "earning_matched",
      calculationRunId: "run_1",
      payeeId: "payee_alma",
      contractId: "contract_1",
      trackId: "track_1",
      grossAmount: "100.0000000000",
      grossShare: "70.0000000000",
      recoupmentApplied: "10.0000000000",
      netPayable: "60.0000000000",
      splitPercentage: "70.000000",
      currency: "USD",
      status: "posted",
      createdAt: "2026-05-01T10:10:00.000Z"
    },
    {
      id: "alloc_david",
      earningId: "earning_matched",
      calculationRunId: "run_1",
      payeeId: "payee_david",
      contractId: "contract_1",
      trackId: "track_1",
      grossAmount: "100.0000000000",
      grossShare: "30.0000000000",
      recoupmentApplied: "0.0000000000",
      netPayable: "30.0000000000",
      splitPercentage: "30.000000",
      currency: "USD",
      status: "posted",
      createdAt: "2026-05-01T10:10:00.000Z"
    }
  ],
  suspenseItems: [
    {
      id: "suspense_1",
      earningId: "earning_suspense",
      amount: "50.0000000000",
      currency: "USD",
      reasonCode: "unmapped_track",
      resolved: false,
      resolvedAt: null,
      createdAt: "2026-05-01T10:20:00.000Z"
    }
  ],
  statements: [
    {
      id: "statement_alma",
      payeeId: "payee_alma",
      calculationRunId: "run_1",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
      currency: "USD",
      grossTotal: "70.0000000000",
      recoupmentTotal: "10.0000000000",
      netPayable: "60.0000000000",
      amountDue: "60.0000000000",
      version: 1,
      status: "generated",
      createdAt: "2026-05-02T10:00:00.000Z"
    }
  ],
  statementLines: [
    {
      id: "line_alma",
      statementId: "statement_alma",
      earningAllocationId: "alloc_alma",
      trackId: "track_1",
      grossShare: "70.0000000000",
      recoupmentApplied: "10.0000000000",
      netPayable: "60.0000000000",
      quantity: "10.000000",
      currency: "USD"
    }
  ],
  statementPaymentLinks: [
    {
      id: "link_1",
      statementId: "statement_alma",
      paymentId: "payment_1",
      amountApplied: "15.1000000000"
    },
    {
      id: "link_void",
      statementId: "statement_alma",
      paymentId: "payment_void",
      amountApplied: "99.0000000000"
    }
  ],
  payments: [
    {
      id: "payment_1",
      payeeId: "payee_alma",
      amount: "15.1000000000",
      currency: "USD",
      status: "recorded",
      paidAt: "2026-05-05T10:00:00.000Z",
      reference: "PAY-1"
    },
    {
      id: "payment_void",
      payeeId: "payee_alma",
      amount: "99.0000000000",
      currency: "USD",
      status: "void",
      paidAt: "2026-05-06T10:00:00.000Z",
      reference: "VOID"
    }
  ],
  payees: [
    {
      id: "payee_alma",
      name: "Alma",
      preferredCurrency: "USD",
      isActive: true
    },
    {
      id: "payee_david",
      name: "David",
      preferredCurrency: "USD",
      isActive: true
    }
  ],
  tracks: [
    {
      id: "track_1",
      title: "Seggae light",
      isrc: "MUAAA2600001",
      releaseId: "release_1"
    }
  ]
};

test("earnings preview carries source, mapping, amount, and exact fix path for suspense rows", () => {
  assert.deepEqual(
    readEarningsPreview(fixture, {
      batchId: "batch_kontor",
      mappingStatus: "suspense",
      calculationStatus: null
    }),
    [
      {
        id: "earning_suspense",
        batchId: "batch_kontor",
        batchSource: "kontor",
        fileName: "kontor.csv",
        dsp: "Apple Music",
        rawTitle: "Unknown",
        rawArtist: "Unknown",
        rawLabel: "Babani",
        isrc: null,
        upc: "742000000002",
        grossAmount: "50.0000000000",
        quantity: "5.000000",
        currency: "USD",
        mappingStatus: "suspense",
        calculationStatus: "error",
        suspenseReason: "unmapped_track",
        exactFixPath: "mapping"
      }
    ]
  );
});

test("allocation list reads posted allocations without recomputing splits and totals exact by currency", () => {
  assert.deepEqual(readAllocationList(fixture, { calculationRunId: "run_1", payeeId: null, status: "posted" }), {
    rows: [
      {
        id: "alloc_alma",
        earningId: "earning_matched",
        calculationRunId: "run_1",
        payeeId: "payee_alma",
        payeeName: "Alma",
        contractId: "contract_1",
        trackId: "track_1",
        trackTitle: "Seggae light",
        grossAmount: "100.0000000000",
        grossShare: "70.0000000000",
        recoupmentApplied: "10.0000000000",
        netPayable: "60.0000000000",
        splitPercentage: "70.000000",
        currency: "USD",
        status: "posted"
      },
      {
        id: "alloc_david",
        earningId: "earning_matched",
        calculationRunId: "run_1",
        payeeId: "payee_david",
        payeeName: "David",
        contractId: "contract_1",
        trackId: "track_1",
        trackTitle: "Seggae light",
        grossAmount: "100.0000000000",
        grossShare: "30.0000000000",
        recoupmentApplied: "0.0000000000",
        netPayable: "30.0000000000",
        splitPercentage: "30.000000",
        currency: "USD",
        status: "posted"
      }
    ],
    totals: [
      {
        currency: "USD",
        grossShare: "100.0000000000",
        recoupmentApplied: "10.0000000000",
        netPayable: "90.0000000000"
      }
    ]
  });
});

test("suspense read groups open rows by reason and exact fix path", () => {
  assert.deepEqual(readSuspense(fixture, { status: "open", reasonCode: null }), {
    rows: [
      {
        id: "suspense_1",
        earningId: "earning_suspense",
        sourceReference: "742000000002",
        amount: "50.0000000000",
        currency: "USD",
        reasonCode: "unmapped_track",
        exactFixPath: "mapping",
        status: "open",
        createdAt: "2026-05-01T10:20:00.000Z"
      }
    ],
    groups: [
      {
        reasonCode: "unmapped_track",
        exactFixPath: "mapping",
        count: 1,
        totals: [{ currency: "USD", amount: "50.0000000000" }]
      }
    ]
  });
});

test("statement read subtracts non-void payments exactly and reports totals by currency", () => {
  assert.deepEqual(readStatementSummaries(fixture, { period: "2026-04", payeeId: null, status: null }), {
    rows: [
      {
        id: "statement_alma",
        payeeId: "payee_alma",
        payeeName: "Alma",
        calculationRunId: "run_1",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        currency: "USD",
        grossTotal: "70.0000000000",
        recoupmentTotal: "10.0000000000",
        netPayable: "60.0000000000",
        amountDue: "60.0000000000",
        paymentsApplied: "15.1000000000",
        statementBalance: "44.9000000000",
        lineCount: 1,
        version: 1,
        status: "generated"
      }
    ],
    totals: [
      {
        currency: "USD",
        grossTotal: "70.0000000000",
        recoupmentTotal: "10.0000000000",
        netPayable: "60.0000000000",
        amountDue: "60.0000000000",
        statementBalance: "44.9000000000"
      }
    ]
  });
});
