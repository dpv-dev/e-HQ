export type OfficeBankImportDirection = "credit" | "debit";

export interface OfficeBankDedupeLine {
  readonly id: string;
  readonly accountId: string;
  readonly occurredOn: string | null;
  readonly valueOn: string | null;
  readonly description: string;
  readonly direction: OfficeBankImportDirection;
  readonly amountMinor: bigint;
  readonly balanceMinor: bigint | null;
  readonly currency: string;
  readonly reference: string | null;
}

export interface OfficeBankDuplicateMatch {
  readonly existingId: string;
  readonly reason: "balance" | "reference";
}

export interface OfficeBankDuplicateMatchResult {
  readonly candidateId: string;
  readonly match: OfficeBankDuplicateMatch | null;
}

interface IndexedExistingLine {
  readonly line: OfficeBankDedupeLine;
  readonly normalizedReference: string | null;
}

/**
 * Matches an import preview against existing statement lines without collapsing
 * legitimate repeated movements. Every existing line can satisfy at most one
 * candidate, so the comparison behaves as a multiset rather than a set.
 */
export function detectOfficeBankImportDuplicates(
  candidates: readonly OfficeBankDedupeLine[],
  existingLines: readonly OfficeBankDedupeLine[]
): readonly OfficeBankDuplicateMatchResult[] {
  const existingByBaseKey = indexExistingLines(existingLines);
  const consumedExistingIds = new Set<string>();

  return candidates.map((candidate): OfficeBankDuplicateMatchResult => {
    const possibleMatches = possibleExistingMatches(candidate, existingByBaseKey, consumedExistingIds);
    const balanceMatch = possibleMatches.find(
      (existing) =>
        candidate.balanceMinor !== null &&
        existing.line.balanceMinor !== null &&
        candidate.balanceMinor === existing.line.balanceMinor
    );

    if (balanceMatch !== undefined) {
      consumedExistingIds.add(balanceMatch.line.id);
      return matchedResult(candidate.id, balanceMatch.line.id, "balance");
    }

    const candidateReference = normalizeReference(candidate.reference);
    if (candidateReference !== null) {
      const referenceMatch = possibleMatches.find(
        (existing) =>
          (candidate.balanceMinor === null || existing.line.balanceMinor === null) &&
          existing.normalizedReference === candidateReference
      );

      if (referenceMatch !== undefined) {
        consumedExistingIds.add(referenceMatch.line.id);
        return matchedResult(candidate.id, referenceMatch.line.id, "reference");
      }
    }

    return { candidateId: candidate.id, match: null };
  });
}

function indexExistingLines(
  existingLines: readonly OfficeBankDedupeLine[]
): ReadonlyMap<string, readonly IndexedExistingLine[]> {
  const index = new Map<string, IndexedExistingLine[]>();

  for (const line of existingLines) {
    const indexedLine: IndexedExistingLine = {
      line,
      normalizedReference: normalizeReference(line.reference)
    };

    for (const date of lineDates(line)) {
      const key = baseKey(line, date);
      const bucket = index.get(key);
      if (bucket === undefined) {
        index.set(key, [indexedLine]);
      } else {
        bucket.push(indexedLine);
      }
    }
  }

  return index;
}

function possibleExistingMatches(
  candidate: OfficeBankDedupeLine,
  existingByBaseKey: ReadonlyMap<string, readonly IndexedExistingLine[]>,
  consumedExistingIds: ReadonlySet<string>
): readonly IndexedExistingLine[] {
  const matches: IndexedExistingLine[] = [];
  const seenExistingIds = new Set<string>();

  for (const date of lineDates(candidate)) {
    for (const existing of existingByBaseKey.get(baseKey(candidate, date)) ?? []) {
      if (consumedExistingIds.has(existing.line.id) || seenExistingIds.has(existing.line.id)) {
        continue;
      }

      seenExistingIds.add(existing.line.id);
      matches.push(existing);
    }
  }

  return matches;
}

function lineDates(line: OfficeBankDedupeLine): readonly string[] {
  const dates: string[] = [];
  for (const date of [line.occurredOn, line.valueOn]) {
    const normalized = date?.trim() ?? "";
    if (normalized !== "" && !dates.includes(normalized)) {
      dates.push(normalized);
    }
  }
  return dates;
}

function baseKey(line: OfficeBankDedupeLine, date: string): string {
  return [line.accountId, date, line.direction, line.amountMinor.toString(), line.currency.trim().toUpperCase()].join("\u001f");
}

function normalizeReference(reference: string | null): string | null {
  const normalized = reference
    ?.normalize("NFKC")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]/gu, "") ?? "";
  return normalized.length < 4 ? null : normalized;
}

function matchedResult(
  candidateId: string,
  existingId: string,
  reason: OfficeBankDuplicateMatch["reason"]
): OfficeBankDuplicateMatchResult {
  return {
    candidateId,
    match: { existingId, reason }
  };
}
