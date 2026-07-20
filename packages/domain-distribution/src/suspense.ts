export type DistributionSuspenseFixPath =
  | "contracts"
  | "mapping"
  | "imports"
  | "catalog"
  | "settings"
  | "suspense";

export type DistributionSuspenseResolutionMode = "retry" | "map" | "manual_review";

export interface DistributionSuspenseReasonDefinition {
  readonly title: string;
  readonly description: string;
  readonly fixPath: DistributionSuspenseFixPath;
  readonly actionLabel: string;
  readonly resolutionMode: DistributionSuspenseResolutionMode;
}

const reasonDefinitions: Readonly<Record<string, DistributionSuspenseReasonDefinition>> = {
  missing_contract: {
    title: "Missing contract",
    description: "Create or complete the track split, then retry the affected rows.",
    fixPath: "contracts",
    actionLabel: "Fix exact split",
    resolutionMode: "retry"
  },
  missing_split: {
    title: "Missing split",
    description: "Create a complete effective split, then retry the affected row.",
    fixPath: "contracts",
    actionLabel: "Fix exact split",
    resolutionMode: "retry"
  },
  invalid_split: {
    title: "Invalid split",
    description: "Correct the split so it equals exactly 100%, then retry the row.",
    fixPath: "contracts",
    actionLabel: "Correct split",
    resolutionMode: "retry"
  },
  missing_fx_rate: {
    title: "Missing FX rate",
    description: "Add the dated conversion rate required by recoupment, then retry the row.",
    fixPath: "settings",
    actionLabel: "Add FX rate",
    resolutionMode: "retry"
  },
  unmapped_track: {
    title: "Unmapped track",
    description: "Map the earning to its canonical track before allocation.",
    fixPath: "mapping",
    actionLabel: "Map track",
    resolutionMode: "map"
  },
  mapping_low_confidence: {
    title: "Low-confidence mapping",
    description: "Review and confirm the suggested catalog match before allocation.",
    fixPath: "mapping",
    actionLabel: "Review mapping",
    resolutionMode: "map"
  },
  import_retry: {
    title: "Import retry required",
    description: "Review the source batch and retry the corrected import row.",
    fixPath: "imports",
    actionLabel: "Review import",
    resolutionMode: "retry"
  },
  negative_amount: {
    title: "Negative amount",
    description: "Review the refund or chargeback, then retry or record an explicit manual decision.",
    fixPath: "suspense",
    actionLabel: "Review row",
    resolutionMode: "manual_review"
  },
  contract_hold: {
    title: "Contract hold",
    description: "Review the contract hold and release it before retrying allocation.",
    fixPath: "contracts",
    actionLabel: "Review contract",
    resolutionMode: "manual_review"
  }
};

const fallbackDefinition: DistributionSuspenseReasonDefinition = {
  title: "Catalog review",
  description: "Review the exact source row and correct its catalog data before retrying.",
  fixPath: "catalog",
  actionLabel: "Review catalog",
  resolutionMode: "manual_review"
};

export function distributionSuspenseReasonDefinition(reasonCode: string): DistributionSuspenseReasonDefinition {
  return reasonDefinitions[reasonCode] ?? fallbackDefinition;
}
