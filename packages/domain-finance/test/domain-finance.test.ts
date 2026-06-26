import assert from "node:assert/strict";
import test from "node:test";
import { allocateLargestRemainder } from "../src/allocations.ts";
import {
  convertDistributionDecimal24_10ToMoney,
  convertOfficeDecimal15_2ToMoney
} from "../src/legacy-conversion.ts";
import {
  assertSharesTotalBasisPoints,
  createBasisPoints,
  createCurrencyCode,
  eofMoney,
  erhMoney,
  format,
  formatMoneyAmount,
  parseDecimalToMicroUnits,
  roundRatioHalfUp,
  splitLargestRemainder,
  splitRemainderLast
} from "../src/money.ts";
import type { BasisPointShare, CurrencyCode, MoneyAmount } from "../src/types.ts";

const eur = createCurrencyCode("EUR");
const usd = createCurrencyCode("USD");

interface GoldenCase {
  readonly name: string;
  readonly total10dp: string;
  readonly shares: readonly number[];
  readonly pluginOracle6dp: readonly string[];
  readonly kernel6dp: readonly string[];
  readonly agreesWithPlugin: boolean;
}

const goldenCases: readonly GoldenCase[] = [
  {
    name: "70 / 30 exact royalty split",
    total10dp: "100.0000000000",
    shares: [7000, 3000],
    pluginOracle6dp: ["70.000000", "30.000000"],
    kernel6dp: ["70.000000", "30.000000"],
    agreesWithPlugin: true
  },
  {
    name: "33.33 / 33.33 / 33.34 on ten units",
    total10dp: "10.0000000000",
    shares: [3333, 3333, 3334],
    pluginOracle6dp: ["3.333000", "3.333000", "3.334000"],
    kernel6dp: ["3.333000", "3.333000", "3.334000"],
    agreesWithPlugin: true
  },
  {
    name: "cent-scale three-way split",
    total10dp: "0.0100000000",
    shares: [3333, 3333, 3334],
    pluginOracle6dp: ["0.003333", "0.003333", "0.003334"],
    kernel6dp: ["0.003333", "0.003333", "0.003334"],
    agreesWithPlugin: true
  },
  {
    name: "three micro-units over three payees",
    total10dp: "0.0000030000",
    shares: [3333, 3333, 3334],
    pluginOracle6dp: ["0.000001", "0.000001", "0.000001"],
    kernel6dp: ["0.000001", "0.000001", "0.000001"],
    agreesWithPlugin: true
  },
  {
    name: "seven micro-units 70 / 30",
    total10dp: "0.0000070000",
    shares: [7000, 3000],
    pluginOracle6dp: ["0.000005", "0.000002"],
    kernel6dp: ["0.000005", "0.000002"],
    agreesWithPlugin: true
  },
  {
    name: "large 70 / 30 split beyond Number precision",
    total10dp: "123456789.1234560000",
    shares: [7000, 3000],
    pluginOracle6dp: ["86419752.386419", "37037036.737037"],
    kernel6dp: ["86419752.386419", "37037036.737037"],
    agreesWithPlugin: true
  },
  {
    name: "one micro-unit 50 / 50",
    total10dp: "0.0000010000",
    shares: [5000, 5000],
    pluginOracle6dp: ["0.000001", "0.000001"],
    kernel6dp: ["0.000001", "0.000000"],
    agreesWithPlugin: false
  },
  {
    name: "one micro-unit 33.33 / 33.33 / 33.34",
    total10dp: "0.0000010000",
    shares: [3333, 3333, 3334],
    pluginOracle6dp: ["0.000000", "0.000000", "0.000000"],
    kernel6dp: ["0.000000", "0.000000", "0.000001"],
    agreesWithPlugin: false
  },
  {
    name: "five micro-units 70 / 30",
    total10dp: "0.0000050000",
    shares: [7000, 3000],
    pluginOracle6dp: ["0.000004", "0.000002"],
    kernel6dp: ["0.000004", "0.000001"],
    agreesWithPlugin: false
  },
  {
    name: "five micro-units 50 / 30 / 20",
    total10dp: "0.0000050000",
    shares: [5000, 3000, 2000],
    pluginOracle6dp: ["0.000003", "0.000002", "0.000001"],
    kernel6dp: ["0.000003", "0.000001", "0.000001"],
    agreesWithPlugin: false
  }
];

test("EOF money reproduces PHP to_cents HALF_UP parity vectors", () => {
  const examples: ReadonlyArray<readonly [string, bigint]> = [
    ["0", 0n],
    ["1.99", 199n],
    ["-1.99", -199n],
    ["1.005", 101n],
    ["1.004", 100n],
    ["2.675", 268n],
    ["-1.005", -101n],
    ["0.05", 5n]
  ];

  for (const [input, expected] of examples) {
    assert.equal(eofMoney.parse(input), expected);
  }
});

test("EOF money reproduces PHP from_cents formatting vectors", () => {
  const examples: ReadonlyArray<readonly [bigint, string]> = [
    [0n, "0.00"],
    [199n, "1.99"],
    [-199n, "-1.99"],
    [5n, "0.05"],
    [-5n, "-0.05"]
  ];

  for (const [input, expected] of examples) {
    assert.equal(eofMoney.format(input), expected);
  }
});

test("EOF money reproduces PHP round_ratio vectors", () => {
  const examples: ReadonlyArray<readonly [bigint, bigint, bigint]> = [
    [5n, 2n, 3n],
    [7n, 2n, 4n],
    [4n, 2n, 2n],
    [-5n, 2n, -3n],
    [1n, 3n, 0n],
    [2n, 3n, 1n]
  ];

  for (const [numerator, denominator, expected] of examples) {
    assert.equal(roundRatioHalfUp(numerator, denominator), expected);
  }
});

test("EOF money reproduces PHP add, subtract, percentage, and decimal multiplication vectors", () => {
  assert.equal(eofMoney.format(eofMoney.add(eofMoney.parse("1.99"), eofMoney.parse("0.02"))), "2.01");
  assert.equal(eofMoney.format(eofMoney.sub(eofMoney.parse("1.00"), eofMoney.parse("1.99"))), "-0.99");
  assert.equal(eofMoney.format(eofMoney.percentage(eofMoney.parse("100.00"), "33.33")), "33.33");
  assert.equal(eofMoney.format(eofMoney.percentage(eofMoney.parse("10.00"), "33.33")), "3.33");
  assert.equal(eofMoney.format(eofMoney.applyDecimalFactor(eofMoney.parse("100.00"), "0.1")), "10.00");
  assert.equal(eofMoney.format(eofMoney.applyDecimalFactor(eofMoney.parse("3.33"), "3")), "9.99");
});

test("EOF money strips grouping commas and rejects malformed decimal text", () => {
  assert.equal(eofMoney.parse("1,234.565"), 123_457n);
  assert.throws(() => eofMoney.parse("12.1234567890123"), /fractional digits/);
  assert.throws(() => eofMoney.parse("12.1.2"), /plain decimal string/);
  assert.throws(() => eofMoney.parse("abc"), /plain decimal string/);
});

test("ERH money reproduces BCMath scale-10 truncation vectors", () => {
  assert.equal(erhMoney.format(erhMoney.add(erhMoney.parse("1.5"), erhMoney.parse("1.5"))), "3.0000000000");
  assert.equal(erhMoney.format(erhMoney.mulScaled(erhMoney.parse("1.5"), erhMoney.parse("1.5"))), "2.2500000000");
  assert.equal(erhMoney.format(erhMoney.divScaled(erhMoney.parse("1"), erhMoney.parse("3"))), "0.3333333333");
  assert.equal(erhMoney.format(erhMoney.divScaled(erhMoney.parse("2"), erhMoney.parse("3"))), "0.6666666666");
  assert.equal(erhMoney.format(erhMoney.divScaled(erhMoney.parse("1"), erhMoney.parse("7"))), "0.1428571428");
  assert.equal(erhMoney.format(erhMoney.parse("1.12345678901234")), "1.1234567890");
  assert.equal(erhMoney.format(erhMoney.mulScaled(erhMoney.parse("0.0000000001"), erhMoney.parse("1"))), "0.0000000001");
});

test("money kernel generic parse and format stay string-only and mode-aware", () => {
  assert.equal(format(eofMoney.parse("1.005"), eofMoney.scale), "1.01");
  assert.equal(format(erhMoney.parse("1.005"), erhMoney.scale), "1.0050000000");
  assert.throws(() => eofMoney.parse(1.005 as unknown as string), /string/);
});

test("split helpers reproduce EOF remainder-last and new largest-remainder invariants", () => {
  assert.deepEqual(splitRemainderLast(10_000n, [3333, 3333, 3334]), [3333n, 3333n, 3334n]);

  const cents = splitRemainderLast(100n, [3333, 3333, 3334]);
  assert.deepEqual(cents, [33n, 33n, 34n]);
  assert.equal(cents.reduce((sum: bigint, part: bigint) => sum + part, 0n), 100n);

  const largestRemainder = splitLargestRemainder(100n, [1n, 1n, 1n]);
  assert.deepEqual(largestRemainder, [34n, 33n, 33n]);
  assert.equal(largestRemainder.reduce((sum: bigint, part: bigint) => sum + part, 0n), 100n);
});

test("money parses and formats decimal strings at the 6-decimal micro-unit scale", () => {
  const examples: ReadonlyArray<readonly [string, string]> = [
    ["0", "0.000000"],
    ["1", "1.000000"],
    ["1.2", "1.200000"],
    ["1.234567", "1.234567"],
    ["-0.000001", "-0.000001"],
    ["9007199254740993.000001", "9007199254740993.000001"]
  ];

  for (const [input, expected] of examples) {
    assert.equal(formatMoneyAmount(parseDecimalToMicroUnits(input, eur)), expected);
  }

  const overflowSafe = parseDecimalToMicroUnits("9007199254740993.000001", eur);
  assert.equal(overflowSafe.amountMicro > BigInt(Number.MAX_SAFE_INTEGER), true);
});

test("money rejects non-string, imprecise, or over-scale decimal input", () => {
  assert.throws(() => parseDecimalToMicroUnits(1.23 as unknown as string, eur), /string/);
  assert.throws(() => parseDecimalToMicroUnits("1.0000001", eur), /fractional digits/);
  assert.throws(() => parseDecimalToMicroUnits("1,23", eur), /plain decimal string/);
});

test("basis-point shares must sum to exactly 10000", () => {
  assertSharesTotalBasisPoints(makeShares([7000, 3000]));
  assert.throws(() => assertSharesTotalBasisPoints(makeShares([7000, 2999])), /10000/);
  assert.throws(() => createBasisPoints(10.5), /integer/);
});

test("largest-remainder allocation preserves the exact integer invariant", () => {
  const allocation = allocateLargestRemainder({
    sourceId: "royalty-row-70-30",
    grossAmount: parseDecimalToMicroUnits("100.000000", eur),
    shares: makeShares([7000, 3000])
  });

  assert.deepEqual(formatLines(allocation.lines.map((line) => line.grossAmount)), ["70.000000", "30.000000"]);
});

test("largest-remainder allocation preserves exact sums across generated cases", () => {
  let seed = 123_456_789n;

  for (let index = 0; index < 250; index += 1) {
    const participantCount = 2 + nextInt(5);
    const basisPoints = generatedBasisPoints(participantCount);
    const totalMicro = 1n + BigInt(nextInt(9_999_999));
    const total = {
      amountMicro: totalMicro,
      currency: usd
    } as MoneyAmount;
    const allocation = allocateLargestRemainder({
      sourceId: `generated-${index}`,
      grossAmount: total,
      shares: makeShares(basisPoints)
    });
    const allocatedMicro = allocation.lines.reduce((sum: bigint, line) => sum + line.grossAmount.amountMicro, 0n);
    assert.equal(allocatedMicro, totalMicro);
  }

  function nextInt(maxExclusive: number): number {
    seed = (seed * 1_103_515_245n + 12_345n) % 2_147_483_648n;
    return Number(seed % BigInt(maxExclusive));
  }

  function generatedBasisPoints(count: number): readonly number[] {
    const values: number[] = [];
    let remaining = 10_000;
    for (let index = 0; index < count - 1; index += 1) {
      const remainingSlots = count - index - 1;
      const maximum = remaining - remainingSlots;
      const value = 1 + nextInt(maximum);
      values.push(value);
      remaining -= value;
    }
    values.push(remaining);
    return values;
  }
});

test("legacy Office DECIMAL(15,2) conversion is lossless and string-only", () => {
  assert.equal(formatMoneyAmount(convertOfficeDecimal15_2ToMoney({ source: "office:test:1", decimalValue: "123.45", currency: eur })), "123.450000");
  assert.equal(formatMoneyAmount(convertOfficeDecimal15_2ToMoney({ source: "office:test:2", decimalValue: "123", currency: eur })), "123.000000");
  assert.throws(() => convertOfficeDecimal15_2ToMoney({ source: "office:test:3", decimalValue: "123.456", currency: eur }), /fractional digits/);
  assert.throws(() => convertOfficeDecimal15_2ToMoney({ source: "office:test:4", decimalValue: "123,45", currency: eur }), /plain decimal string/);
});

test("legacy Distribution DECIMAL(24,10) conversion uses half-up rounding with audit delta", () => {
  const down = convertDistributionDecimal24_10ToMoney({ source: "distribution:test:down", decimalValue: "1.2345674999", currency: eur });
  assert.equal(formatMoneyAmount(down.amount), "1.234567");
  assert.equal(down.auditRecord.original_10dp, "1.2345674999");
  assert.equal(down.auditRecord.result_micro, down.amount.amountMicro);
  assert.equal(down.auditRecord.delta, "-0.0000004999");

  const up = convertDistributionDecimal24_10ToMoney({ source: "distribution:test:up", decimalValue: "1.2345675000", currency: eur });
  assert.equal(formatMoneyAmount(up.amount), "1.234568");
  assert.equal(up.auditRecord.delta, "0.0000005000");

  const negative = convertDistributionDecimal24_10ToMoney({ source: "distribution:test:negative", decimalValue: "-1.2345675000", currency: eur });
  assert.equal(formatMoneyAmount(negative.amount), "-1.234568");
  assert.equal(negative.auditRecord.delta, "-0.0000005000");
});

test("golden cases that agree with the production plugin oracle stay green", () => {
  for (const goldenCase of goldenCases.filter((candidate) => candidate.agreesWithPlugin)) {
    const kernel = allocateGoldenCase(goldenCase);
    assert.deepEqual(kernel, goldenCase.pluginOracle6dp, goldenCase.name);
  }
});

test("production plugin oracle divergences stay explicit for human decision", () => {
  for (const goldenCase of goldenCases.filter((candidate) => !candidate.agreesWithPlugin)) {
    const kernel = allocateGoldenCase(goldenCase);
    assert.deepEqual(kernel, goldenCase.kernel6dp, goldenCase.name);
    assert.notDeepEqual(kernel, goldenCase.pluginOracle6dp, goldenCase.name);
  }
});

function allocateGoldenCase(goldenCase: GoldenCase): readonly string[] {
  const converted = convertDistributionDecimal24_10ToMoney({
    source: `golden:${goldenCase.name}`,
    decimalValue: goldenCase.total10dp,
    currency: eur
  });
  const allocation = allocateLargestRemainder({
    sourceId: `golden:${goldenCase.name}`,
    grossAmount: converted.amount,
    shares: makeShares(goldenCase.shares)
  });
  return formatLines(allocation.lines.map((line) => line.grossAmount));
}

function makeShares(values: readonly number[]): readonly BasisPointShare[] {
  return values.map((value: number, index: number) => ({
    participantId: `participant-${index + 1}`,
    shareBasisPoints: createBasisPoints(value)
  }));
}

function formatLines(amounts: readonly MoneyAmount[]): readonly string[] {
  return amounts.map((amount: MoneyAmount) => formatMoneyAmount(amount));
}
