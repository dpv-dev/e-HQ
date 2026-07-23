<script lang="ts">
  import { onMount } from "svelte";
  import type { AuthSession } from "@ehq/auth";
  import {
    ApiClientHttpError,
    beginReload,
    createErrorState,
    createIdleState,
    createSuccessState,
    type ApiMutationReceipt,
    type ApiRequestState,
    type ApiRunReceipt,
    type AllocationRunSummary,
    type AuditLogEntry,
    type CurrencyCode,
    type DistributionAlias,
    type DistributionAliasTargetType,
    type DistributionAllocationRow,
    type DistributionAllocationTotal,
    type DistributionAllocationBatchCurrencyTotal,
    type DistributionAllocationBatchRow,
    type DistributionAllocationRecentBatch,
    type DistributionAllocationRunCurrencyTotal,
    type DistributionAllocationSuspenseReason,
    type DistributionAllocationUnallocatedCurrencyTotal,
    type DistributionAllocationUnallocatedTrack,
    type DistributionAllocationWorkbenchResponse,
    type DistributionCatalogArtistSource,
    type DistributionCatalogArtistPromoteRequest,
    type DistributionCatalogContributor,
    type DistributionCatalogReviewFilter,
    type DistributionCatalogTrackRow,
    type DistributionCatalogWorkbenchResponse,
    type DistributionContractExpense,
    type DistributionContractExpenseCategory,
    type DistributionContractTrackRow,
    type DistributionContractTrackStatus,
    type DistributionContractWorkbenchResponse,
    type DistributionContractWorkflowFilter,
    type DistributionDashboardResponse,
    type DistributionDashboardReadinessItem,
    type DistributionDashboardTopRoyalty,
    type DistributionDuplicate,
    type DistributionImportBatch,
    type DistributionImportConfirmResponse,
    type DistributionImportPreviewRequest,
    type DistributionImportPreviewResponse,
    type DistributionFxRate,
    type DistributionMappingRow,
    type DistributionReconciliationAction,
    type DistributionReconciliationResponse,
    type DistributionRevenueRow,
    type DistributionScreenResponse,
    type DistributionSettingsResponse,
    type DistributionSuspenseCurrencyTotal,
    type DistributionSuspenseReasonGroup,
    type DistributionSuspenseWorkbenchResponse,
    type DistributionSuspenseWorkbenchRow,
    type PageResult,
    type PayeeSummary,
    type PaymentSummary,
    type DistributionPaymentMethod,
    type ReleaseSummary,
    type StatementPrintLine,
    type StatementPrintResponse,
    type StatementSummary,
    type TrackSummary
  } from "@ehq/api-client";
  import { Alert, BarsChart, Button, Drawer, Input, KPI, Loader, PageHeader, SectionTemplate, Select, Table, Toolbar, WorkspaceShell } from "@ehq/ui";
  import type { ChartPoint, IconName, SelectOption, TableColumn, TablePagination, TableRow, TableRowAction, Tone, ToolbarFilter, WorkspaceNavGroup, WorkspaceNavItem } from "@ehq/ui";
  import { createShellApiClient } from "../../app-shell-data.js";
  import { parseCsvRecords } from "../../csv-records.js";
  import { formatDateOnly, formatDateRange } from "../../date-format.js";
  import { formatMoneyValue, moneyToneForValue } from "../../money-format.js";
  import "./distribution-command.css";
  import { createPeriodOptions, getLatestDataPeriod, periodLabel, rangeForScope, rangeLabel, todayIso, type DateRange, type PeriodScope } from "../../period-controls.js";
  import { normalizeRoutePath } from "../../route-utils.js";
  import { sortOptionsAlphabetically } from "../../select-options.js";
  import { appendPageResult, createTablePagination, loadPageResult, readPageItems, TABLE_PAGE_SIZE, type PageLoadMode } from "../../table-pagination.js";
  import {
    apiRequestStateLabel as stateLabel,
    isRequestStatusLoading
  } from "../request-state.js";
  import type { CanonicalRequestStatus } from "../request-state.js";
  import {
    canCancelDistributionImportBatch,
    canOpenDistributionImportBatch,
    distributionImportBatchReadOnlyReason,
    distributionImportActionLabel,
    distributionImportStatusTone,
    isDistributionImportBatchReversible
  } from "./import-batch-status.js";

  type DistributionPageId =
    | "dashboard"
    | "imports"
    | "mapping"
    | "catalog"
    | "contracts"
    | "allocations"
    | "suspense"
    | "statements"
    | "payments"
    | "revenue"
    | "financial-reconciliation"
    | "aliases"
    | "duplicates"
    | "audit-log"
    | "settings";
  type ImportSourceFilter = "all" | "kontor" | "routenote";
  type ImportBatchStatusFilter = "all" | "uploaded" | "mapped" | "validated" | "failed" | "voided";
  type ImportSource = "kontor" | "routenote";
  type MappingStatusFilter = "all" | "unmapped" | "suggested" | "mapped";
  type SuspenseStatusFilter = "all" | "open" | "resolved";
  type PaymentStatusFilter = "all" | "draft" | "paid" | "voided";
  type RevenueGroupBy = "payee" | "track" | "currency" | "store" | "period";
  type RequestStatus = CanonicalRequestStatus;
  type DistributionPagedTableId =
    | "importBatches"
    | "mapping"
    | "payees"
    | "releases"
    | "tracks"
    | "catalog"
    | "contracts"
    | "expenses"
    | "allocations"
    | "allocationBatches"
    | "allocationBank"
    | "suspense"
    | "statements"
    | "payments"
    | "revenue"
    | "aliases"
    | "duplicates"
    | "auditLog";

  interface Props {
    readonly session: AuthSession;
    readonly onLogout: () => void;
  }

  interface DistributionNavItem {
    readonly id: DistributionPageId;
    readonly label: string;
    readonly title: string;
    readonly subtitle: string;
  }

  interface DistributionNavGroup {
    readonly id: string;
    readonly label: string;
    readonly items: readonly DistributionNavItem[];
  }

  interface ImportUiState {
    readonly status: RequestStatus;
    readonly source: ImportSource;
    readonly fileName: string;
    readonly rows: readonly Readonly<Record<string, string>>[];
    readonly checksum: string;
    readonly preview: DistributionImportPreviewResponse | null;
    readonly confirm: DistributionImportConfirmResponse | null;
    readonly message: string;
  }

  type PaymentPanelMode = "edit" | "reconcile" | "void";
  type CatalogPanelMode = "release" | "track";
  type CatalogEntryStatus = "draft" | "released" | "archived";
  type CatalogStatusFilter = "all" | CatalogEntryStatus;
  type CatalogReviewFilter = "all" | DistributionCatalogReviewFilter;
  type ContractStatusFilter = "all" | DistributionContractTrackStatus;
  type ContractWorkflowFilter = "all" | DistributionContractWorkflowFilter;

  interface ContractSplitDraft {
    readonly payeeId: string;
    readonly percentage: string;
  }

  interface DistributionKpi {
    readonly label: string;
    readonly value: string;
    readonly detail: string;
    readonly tone: Tone;
    readonly accent: boolean;
  }

  const { session, onLogout }: Props = $props();
  const client = createShellApiClient();
  // One write at a time: every non-read client call flips this flag so buttons
  // show a busy state and a second click cannot fire a concurrent mutation.
  let mutationInFlight = $state(false);
  const distributionApi: typeof client.distribution = new Proxy(client.distribution, {
    get(target: typeof client.distribution, property: string | symbol, receiver: unknown): unknown {
      const value: unknown = Reflect.get(target, property, receiver);
      if (typeof value !== "function" || typeof property !== "string") {
        return value;
      }
      if (property.startsWith("get") || property.startsWith("list") || property.startsWith("print")) {
        return value;
      }
      return async (...args: unknown[]): Promise<unknown> => {
        if (mutationInFlight) {
          throw new Error("Please wait: the previous action is still processing.");
        }
        mutationInFlight = true;
        // Safety net: a hung request (dead connection, unresponsive server) must not
        // wedge every button on the page forever behind this single shared flag.
        const timeoutId = setTimeout((): void => {
          mutationInFlight = false;
        }, 60_000);
        try {
          return await (value as (...callArgs: unknown[]) => Promise<unknown>).apply(target, args);
        } finally {
          clearTimeout(timeoutId);
          mutationInFlight = false;
        }
      };
    }
  });
  const distributionWorkspaceId = "eeee-mu";
  const allValue = "all";
  const periodOptions = createPeriodOptions().map((option) =>
    option.value === "all" ? { ...option, label: "All imported data", detail: "All imported data" } : option
  );
  const navGroups: readonly DistributionNavGroup[] = [
    {
      id: "overview",
      label: "Overview",
      items: [
        { id: "dashboard", label: "Dashboard", title: "Dashboard", subtitle: "Royalty cockpit, blockers and priority actions." }
      ]
    },
    {
      id: "workflow",
      label: "Royalty workflow",
      items: [
        { id: "imports", label: "Imports", title: "Imports", subtitle: "Kontor/RouteNote exports, preview and confirmation." },
        { id: "mapping", label: "Mapping", title: "Mapping", subtitle: "Review rows, automate safe matches and apply rules." },
        { id: "catalog", label: "Catalog", title: "Catalog", subtitle: "Releases, tracks, contributors and split health." },
        { id: "aliases", label: "Aliases", title: "Aliases", subtitle: "Catalog aliases route imported names to canonical entities." },
        { id: "duplicates", label: "Duplicates", title: "Duplicates", subtitle: "Detect potentially duplicated records." },
        { id: "contracts", label: "Contracts", title: "Contracts", subtitle: "Splits, payees, expenses and recoupments." },
        { id: "allocations", label: "Allocations", title: "Allocations", subtitle: "Preview, post and reverse through scheduled, locked runs." },
        { id: "suspense", label: "Suspense", title: "Suspense", subtitle: "Grouped by cause with a clear resolution path." },
        { id: "statements", label: "Statements", title: "Statements", subtitle: "Financial summary, payment reconciliation and A4 printing." },
        { id: "payments", label: "Payments", title: "Payments", subtitle: "Standalone Distribution ledger payments and statement links." }
      ]
    },
    {
      id: "administration",
      label: "Administration",
      items: [
        { id: "audit-log", label: "Audit log", title: "Audit log", subtitle: "Distribution audit trail for recorded actions." },
        { id: "settings", label: "Settings", title: "Settings", subtitle: "Distribution configuration and FX rates." },
        { id: "revenue", label: "Revenue", title: "Revenue", subtitle: "Financial view by payee, track, currency, store or period." }
      ]
    }
  ];
  const reconciliationNavItem: DistributionNavItem = {
    id: "financial-reconciliation",
    label: "Financial reconciliation",
    title: "Financial reconciliation",
    subtitle: "Compatibility route; operational queues now live on Statements and Payments."
  };
  const navItems: readonly DistributionNavItem[] = [
    ...navGroups.flatMap((group: DistributionNavGroup): readonly DistributionNavItem[] => group.items),
    reconciliationNavItem
  ];
  const importSourceOptions: readonly SelectOption[] = [
    { label: "Kontor", value: "kontor" },
    { label: "RouteNote", value: "routenote" }
  ];
  const importFilterOptions: readonly SelectOption[] = [
    { label: "All sources", value: allValue },
    { label: "Kontor", value: "kontor" },
    { label: "RouteNote", value: "routenote" }
  ];
  const importStatusFilterOptions: readonly SelectOption[] = [
    { label: "All statuses", value: allValue },
    { label: "Uploaded", value: "uploaded" },
    { label: "Mapped", value: "mapped" },
    { label: "Validated", value: "validated" },
    { label: "Failed", value: "failed" },
    { label: "Voided", value: "voided" }
  ];
  const mappingStatusOptions: readonly SelectOption[] = [
    { label: "All", value: allValue },
    { label: "Unmapped", value: "unmapped" },
    { label: "Suggested", value: "suggested" },
    { label: "Mapped", value: "mapped" }
  ];
  const suspenseStatusOptions: readonly SelectOption[] = [
    { label: "All", value: allValue },
    { label: "Open", value: "open" },
    { label: "Resolved", value: "resolved" }
  ];
  const paymentStatusOptions: readonly SelectOption[] = [
    { label: "All", value: allValue },
    { label: "Draft", value: "draft" },
    { label: "Paid", value: "paid" },
    { label: "Voided", value: "voided" }
  ];
  const paymentMethodOptions: readonly SelectOption[] = [
    { label: "Bank transfer", value: "bank_transfer" },
    { label: "PayPal", value: "paypal" },
    { label: "Cash", value: "cash" },
    { label: "Cheque", value: "cheque" },
    { label: "Crypto", value: "crypto" },
    { label: "Other", value: "other" }
  ];
  const paymentRecordStatusOptions: readonly SelectOption[] = [
    { label: "Paid · post now", value: "paid" },
    { label: "Draft", value: "draft" }
  ];
  const expenseCategoryOptions: readonly SelectOption[] = [
    { label: "Advance", value: "advance" },
    { label: "Recoupment", value: "recoupment" },
    { label: "Studio", value: "studio" },
    { label: "Marketing", value: "marketing" },
    { label: "Distribution", value: "distribution" },
    { label: "Other", value: "other" }
  ];
  const catalogStatusOptions: readonly SelectOption[] = [
    { label: "Draft", value: "draft" },
    { label: "Released", value: "released" },
    { label: "Archived", value: "archived" }
  ];
  const catalogFilterOptions: readonly SelectOption[] = [
    { label: "All statuses", value: allValue },
    ...catalogStatusOptions
  ];
  const catalogArtistSourceOptions: readonly SelectOption[] = [
    { label: "Catalog + import", value: "catalog_import" },
    { label: "Catalog contributors", value: "catalog_contributors" },
    { label: "Import artist only", value: "import_only" }
  ];
  const catalogReviewOptions: readonly SelectOption[] = [
    { label: "All", value: allValue },
    { label: "Needs review", value: "needs_review" },
    { label: "Artist mismatch", value: "artist_mismatch" },
    { label: "No contributors", value: "no_contributors" }
  ];
  const catalogContributorRoleOptions: readonly SelectOption[] = [
    { label: "Main artist", value: "main_artist" },
    { label: "Featured artist", value: "featured_artist" },
    { label: "Remixer", value: "remixer" },
    { label: "Producer", value: "producer" },
    { label: "Composer", value: "composer" },
    { label: "Lyricist", value: "lyricist" },
    { label: "Other", value: "other" }
  ];
  const contractTrackStatusOptions: readonly SelectOption[] = [
    { label: "All statuses", value: allValue },
    { label: "Active", value: "active" },
    { label: "No split", value: "no_split" },
    { label: "Ambiguous", value: "ambiguous" }
  ];
  const revenueGroupOptions: readonly SelectOption[] = [
    { label: "Store", value: "store" },
    { label: "Payee", value: "payee" },
    { label: "Track", value: "track" },
    { label: "Currency", value: "currency" },
    { label: "Period", value: "period" }
  ];
  const aliasTargetTypeOptions: readonly SelectOption[] = [
    { label: "Unassigned", value: "unassigned" },
    { label: "Payee", value: "payee" },
    { label: "Release", value: "release" },
    { label: "Track", value: "track" },
    { label: "Artist", value: "artist" },
    { label: "Label", value: "label" }
  ];
  const dashboardReadinessColumns: readonly TableColumn[] = [
    { label: "Workflow area", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true },
    { label: "Count", align: "right", sortable: true },
    { label: "Why it matters", align: "left", sortable: true }
  ];
  const dashboardTopColumns: readonly TableColumn[] = [
    { label: "Name", align: "left", sortable: true },
    { label: "Context", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true }
  ];
  const importColumns: readonly TableColumn[] = [
    { label: "ID", align: "left", sortable: true },
    { label: "Distributor", align: "left", sortable: true },
    { label: "File", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true },
    { label: "Rows", align: "right", sortable: true },
    { label: "Normalized", align: "right", sortable: true },
    { label: "Income", align: "right", sortable: true },
    { label: "Issues", align: "right", sortable: true },
    { label: "Skipped", align: "right", sortable: true },
    { label: "Currency", align: "left", sortable: true },
    { label: "Imported", align: "left", sortable: true }
  ];
  const mappingColumns: readonly TableColumn[] = [
    { label: "Source title", align: "left", sortable: true },
    { label: "Artist", align: "left", sortable: true },
    { label: "Label", align: "left", sortable: true },
    { label: "Store", align: "left", sortable: true },
    { label: "ISRC / UPC", align: "left", sortable: true },
    { label: "Gross", align: "right", sortable: true },
    { label: "Suggested match", align: "left", sortable: true },
    { label: "Confidence", align: "left", sortable: true },
    { label: "Resolution path", align: "left", sortable: true },
    { label: "Selection", align: "left", sortable: true }
  ];
  const catalogColumns: readonly TableColumn[] = [
    { label: "Review", align: "left", sortable: true },
    { label: "Artist import", align: "left", sortable: true },
    { label: "Catalog artist", align: "left", sortable: true },
    { label: "Suggestion", align: "left", sortable: true },
    { label: "Track", align: "left", sortable: true },
    { label: "ISRC", align: "left", sortable: true },
    { label: "UPC / EAN", align: "left", sortable: true },
    { label: "Release", align: "left", sortable: true },
    { label: "Label", align: "left", sortable: true },
    { label: "Contributors", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true },
  ];
  const catalogReviewColumns: readonly TableColumn[] = [
    { label: "Reason", align: "left", sortable: true },
    { label: "Artist import", align: "left", sortable: true },
    { label: "Catalog artist", align: "left", sortable: true },
    { label: "Suggestion", align: "left", sortable: true },
    { label: "Track", align: "left", sortable: true },
    { label: "ISRC", align: "left", sortable: true }
  ];
  const contractColumns: readonly TableColumn[] = [
    { label: "Track / release", align: "left", sortable: true },
    { label: "Artist", align: "left", sortable: true },
    { label: "ISRC", align: "left", sortable: true },
    { label: "Label", align: "left", sortable: true },
    { label: "Splits", align: "left", sortable: true },
    { label: "Expenses", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true },
    { label: "Selection", align: "left", sortable: true }
  ];
  const payeeColumns: readonly TableColumn[] = [
    { label: "Payee", align: "left", sortable: true },
    { label: "Email", align: "left", sortable: true },
    { label: "Preferred currency", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const expenseColumns: readonly TableColumn[] = [
    { label: "Category", align: "left", sortable: true },
    { label: "Payee charged", align: "left", sortable: true },
    { label: "Description", align: "left", sortable: true },
    { label: "Date", align: "left", sortable: true },
    { label: "Original amount", align: "right", sortable: true },
    { label: "Open", align: "right", sortable: true },
    { label: "Recoverable", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const allocationColumns: readonly TableColumn[] = [
    { label: "Run", align: "left", sortable: true },
    { label: "Period", align: "left", sortable: true },
    { label: "Lock", align: "left", sortable: true },
    { label: "Input", align: "right", sortable: true },
    { label: "Allocated", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const allocationDetailColumns: readonly TableColumn[] = [
    { label: "Payee", align: "left", sortable: true },
    { label: "Track", align: "left", sortable: true },
    { label: "Gross share", align: "right", sortable: true },
    { label: "Recouped", align: "right", sortable: true },
    { label: "Net payable", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const allocationCurrencyTotalColumns: readonly TableColumn[] = [
    { label: "Currency", align: "left", sortable: true },
    { label: "Gross share", align: "right", sortable: true },
    { label: "Recouped", align: "right", sortable: true },
    { label: "Net payable", align: "right", sortable: true }
  ];
  const allocationReasonColumns: readonly TableColumn[] = [
    { label: "Suspense reason", align: "left", sortable: true },
    { label: "Open rows", align: "right", sortable: true }
  ];
  const allocationRecentColumns: readonly TableColumn[] = [
    { label: "Recent batch", align: "left", sortable: true },
    { label: "Period", align: "left", sortable: true },
    { label: "Rows", align: "right", sortable: true },
    { label: "Gross", align: "right", sortable: true },
    { label: "Recoup", align: "right", sortable: true },
    { label: "Net", align: "right", sortable: true },
    { label: "Link issues", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const allocationBatchColumns: readonly TableColumn[] = [
    { label: "Batch", align: "left", sortable: true },
    { label: "File", align: "left", sortable: true },
    { label: "Matched", align: "right", sortable: true },
    { label: "Pending", align: "right", sortable: true },
    { label: "Allocated", align: "right", sortable: true },
    { label: "Suspense", align: "right", sortable: true },
    { label: "Open amount", align: "right", sortable: true },
    { label: "Allocated amount", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const allocationBankColumns: readonly TableColumn[] = [
    { label: "Release", align: "left", sortable: true },
    { label: "Track", align: "left", sortable: true },
    { label: "ISRC", align: "left", sortable: true },
    { label: "Rows", align: "right", sortable: true },
    { label: "Batches", align: "right", sortable: true },
    { label: "Blocked by", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true },
    { label: "Seen", align: "left", sortable: true }
  ];
  const suspenseColumns: readonly TableColumn[] = [
    { label: "ID", align: "left", sortable: true },
    { label: "Batch", align: "left", sortable: true },
    { label: "Reason", align: "left", sortable: true },
    { label: "Fix path", align: "left", sortable: true },
    { label: "Track", align: "left", sortable: true },
    { label: "Artist", align: "left", sortable: true },
    { label: "ISRC", align: "left", sortable: true },
    { label: "UPC / EAN", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true },
    { label: "Split", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const suspensePlaybookColumns: readonly TableColumn[] = [
    { label: "Reason", align: "left", sortable: true },
    { label: "Rows", align: "right", sortable: true },
    { label: "Exposure", align: "right", sortable: true },
    { label: "Fix path", align: "left", sortable: true },
    { label: "Next action", align: "left", sortable: true }
  ];
  const statementColumns: readonly TableColumn[] = [
    { label: "Payee", align: "left", sortable: true },
    { label: "Gross", align: "right", sortable: true },
    { label: "Recoupment", align: "right", sortable: true },
    { label: "Paid", align: "right", sortable: true },
    { label: "Payable", align: "right", sortable: true },
    { label: "Period", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const statementLineColumns: readonly TableColumn[] = [
    { label: "Track", align: "left", sortable: true },
    { label: "Units", align: "right", sortable: true },
    { label: "Gross", align: "right", sortable: true },
    { label: "Recoupment", align: "right", sortable: true },
    { label: "Net payable", align: "right", sortable: true }
  ];
  const paymentColumns: readonly TableColumn[] = [
    { label: "ID", align: "left", sortable: true },
    { label: "Payee", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true },
    { label: "Ccy", align: "left", sortable: true },
    { label: "FX rate", align: "right", sortable: true },
    { label: "Method", align: "left", sortable: true },
    { label: "Reference", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true },
    { label: "Paid at", align: "left", sortable: true },
    { label: "Statements linked", align: "right", sortable: true }
  ];
  const revenueColumns: readonly TableColumn[] = [
    { label: "Group", align: "left", sortable: true },
    { label: "Gross", align: "right", sortable: true },
    { label: "Net", align: "right", sortable: true },
    { label: "Payable", align: "right", sortable: true },
    { label: "Currency", align: "left", sortable: true }
  ];
  const reconStatementColumns: readonly TableColumn[] = [
    { label: "Statement", align: "left", sortable: true },
    { label: "Payee", align: "left", sortable: true },
    { label: "Period", align: "left", sortable: true },
    { label: "Currency", align: "left", sortable: true },
    { label: "Net payable", align: "right", sortable: true }
  ];
  const reconExpenseColumns: readonly TableColumn[] = [
    { label: "Cost term", align: "left", sortable: true },
    { label: "Contract", align: "left", sortable: true },
    { label: "Description", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true },
    { label: "Currency", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const reconMatchedColumns: readonly TableColumn[] = [
    { label: "Earning", align: "left", sortable: true },
    { label: "Lot", align: "left", sortable: true },
    { label: "Track", align: "left", sortable: true },
    { label: "Currency", align: "left", sortable: true },
    { label: "Gross", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const reconBalanceColumns: readonly TableColumn[] = [
    { label: "Payee", align: "left", sortable: true },
    { label: "Currency", align: "left", sortable: true },
    { label: "Rows", align: "right", sortable: true },
    { label: "First row", align: "left", sortable: true },
    { label: "Last row", align: "left", sortable: true },
    { label: "Last closing balance", align: "right", sortable: true }
  ];
  const aliasColumns: readonly TableColumn[] = [
    { label: "Alias", align: "left", sortable: true },
    { label: "Target", align: "left", sortable: true },
    { label: "Type", align: "left", sortable: true }
  ];
  const duplicateColumns: readonly TableColumn[] = [
    { label: "Label", align: "left", sortable: true },
    { label: "Type", align: "left", sortable: true },
    { label: "Occurrences", align: "right", sortable: true },
    { label: "Examples", align: "left", sortable: true },
    { label: "Merge", align: "left", sortable: true }
  ];
  const auditColumns: readonly TableColumn[] = [
    { label: "Date", align: "left", sortable: true },
    { label: "Actor", align: "left", sortable: true },
    { label: "Action", align: "left", sortable: true },
    { label: "Entity", align: "left", sortable: true },
    { label: "Idempotency", align: "left", sortable: true },
    { label: "Context", align: "left", sortable: false }
  ];
  const fxRateColumns: readonly TableColumn[] = [
    { label: "From", align: "left", sortable: true },
    { label: "To", align: "left", sortable: true },
    { label: "Date", align: "left", sortable: true },
    { label: "Rate", align: "right", sortable: true }
  ];

  let activePageId = $state<DistributionPageId>("dashboard");
  const navIcons: Readonly<Record<DistributionPageId, IconName>> = {
    dashboard: "home",
    imports: "upload",
    mapping: "layout-grid",
    catalog: "folder",
    contracts: "file-text",
    allocations: "chart-bar",
    suspense: "triangle-alert",
    statements: "file-text",
    payments: "bank",
    revenue: "trending-up",
    "financial-reconciliation": "check",
    aliases: "more-horizontal",
    duplicates: "search",
    "audit-log": "clock",
    settings: "settings"
  };
  const shellNavGroups = $derived<readonly WorkspaceNavGroup[]>(
    navGroups.map((group: DistributionNavGroup): WorkspaceNavGroup => ({
      id: group.id,
      label: group.label,
      items: group.items.map((item: DistributionNavItem): WorkspaceNavItem => ({
        label: item.label,
        href: item.id,
        icon: navIcons[item.id],
        active: activePageId === item.id,
        disabled: false,
        badge: null
      }))
    }))
  );
  const handleShellNavigate = (href: string): void => {
    selectPage(href as DistributionPageId);
  };
  let periodScope = $state<PeriodScope>("year");
  let selectedPeriod = $state(getLatestDataPeriod());
  const today = todayIso();
  let customRange = $state<DateRange | null>(null);
  let dashboardState = $state<ApiRequestState<DistributionDashboardResponse>>(
    createIdleState<DistributionDashboardResponse>()
  );
  let importBatchesState = $state<ApiRequestState<PageResult<DistributionImportBatch>>>(
    createIdleState<PageResult<DistributionImportBatch>>()
  );
  let mappingState = $state<ApiRequestState<PageResult<DistributionMappingRow>>>(
    createIdleState<PageResult<DistributionMappingRow>>()
  );
  let payeesState = $state<ApiRequestState<PageResult<PayeeSummary>>>(createIdleState<PageResult<PayeeSummary>>());
  let releasesState = $state<ApiRequestState<PageResult<ReleaseSummary>>>(createIdleState<PageResult<ReleaseSummary>>());
  let tracksState = $state<ApiRequestState<PageResult<TrackSummary>>>(createIdleState<PageResult<TrackSummary>>());
  let catalogState = $state<ApiRequestState<DistributionCatalogWorkbenchResponse>>(
    createIdleState<DistributionCatalogWorkbenchResponse>()
  );
  let contractWorkbenchState = $state<ApiRequestState<DistributionContractWorkbenchResponse>>(
    createIdleState<DistributionContractWorkbenchResponse>()
  );
  let expensesState = $state<ApiRequestState<PageResult<DistributionContractExpense>>>(
    createIdleState<PageResult<DistributionContractExpense>>()
  );
  let allocationsState = $state<ApiRequestState<PageResult<AllocationRunSummary>>>(
    createIdleState<PageResult<AllocationRunSummary>>()
  );
  let allocationWorkbenchState = $state<ApiRequestState<DistributionAllocationWorkbenchResponse>>(
    createIdleState<DistributionAllocationWorkbenchResponse>()
  );
  let allocationDetailState = $state<ApiRequestState<PageResult<DistributionAllocationRow>>>(
    createIdleState<PageResult<DistributionAllocationRow>>()
  );
  let allocationCurrencyTotalsState = $state<ApiRequestState<PageResult<DistributionAllocationTotal>>>(
    createIdleState<PageResult<DistributionAllocationTotal>>()
  );
  let suspenseState = $state<ApiRequestState<DistributionSuspenseWorkbenchResponse>>(
    createIdleState<DistributionSuspenseWorkbenchResponse>()
  );
  let statementsState = $state<ApiRequestState<PageResult<StatementSummary>>>(
    createIdleState<PageResult<StatementSummary>>()
  );
  let paymentsState = $state<ApiRequestState<PageResult<PaymentSummary>>>(createIdleState<PageResult<PaymentSummary>>());
  let revenueState = $state<ApiRequestState<PageResult<DistributionRevenueRow>>>(
    createIdleState<PageResult<DistributionRevenueRow>>()
  );
  let reconciliationState = $state<ApiRequestState<DistributionReconciliationResponse>>(
    createIdleState<DistributionReconciliationResponse>()
  );
  let aliasesState = $state<ApiRequestState<PageResult<DistributionAlias>>>(
    createIdleState<PageResult<DistributionAlias>>()
  );
  let duplicatesState = $state<ApiRequestState<PageResult<DistributionDuplicate>>>(
    createIdleState<PageResult<DistributionDuplicate>>()
  );
  let auditLogState = $state<ApiRequestState<PageResult<AuditLogEntry>>>(
    createIdleState<PageResult<AuditLogEntry>>()
  );
  let auditFromInput = $state("");
  let auditToInput = $state("");
  let auditActorInput = $state("");
  let auditEntityInput = $state("");
  let settingsState = $state<ApiRequestState<DistributionSettingsResponse>>(
    createIdleState<DistributionSettingsResponse>()
  );
  let fxRatesState = $state<ApiRequestState<PageResult<DistributionFxRate>>>(
    createIdleState<PageResult<DistributionFxRate>>()
  );
  let importSourceFilter = $state<ImportSourceFilter>(allValue);
  let importStatusFilter = $state<ImportBatchStatusFilter>(allValue);
  let mappingStatusFilter = $state<MappingStatusFilter>("suggested");
  let mappingBatchFilter = $state<string>(allValue);
  let mappingSearch = $state("");
  let catalogStatusFilter = $state<CatalogStatusFilter>(allValue);
  let catalogSearch = $state("");
  let catalogArtistSource = $state<DistributionCatalogArtistSource>("catalog_import");
  let catalogIsrc = $state("");
  let catalogRoleFilter = $state(allValue);
  let catalogReviewFilter = $state<CatalogReviewFilter>(allValue);
  let catalogLabelFilter = $state(allValue);
  let catalogReleaseFrom = $state("");
  let catalogReleaseTo = $state("");
  let contractSearch = $state("");
  let contractStatusFilter = $state<ContractStatusFilter>(allValue);
  let contractWorkflowFilter = $state<ContractWorkflowFilter>(allValue);
  let allocationSearch = $state("");
  let suspenseStatusFilter = $state<SuspenseStatusFilter>("open");
  let suspenseSearch = $state("");
  let suspenseBatchReference = $state("");
  let suspenseReasonFilter = $state(allValue);
  let paymentStatusFilter = $state<PaymentStatusFilter>(allValue);
  let statementPayeeFilter = $state<string>(allValue);
  let statementCurrencyFilter = $state<CurrencyCode | "all">(allValue);
  let revenuePayeeFilter = $state<string>(allValue);
  let revenueStoreFilter = $state<string>(allValue);
  let revenueGroupBy = $state<RevenueGroupBy>("store");
  let revenueCurrencyFilter = $state<CurrencyCode | "all">(allValue);
  let importState = $state<ImportUiState>({
    status: "idle",
    source: "routenote",
    fileName: "",
    rows: [],
    checksum: "",
    preview: null,
    confirm: null,
    message: "Select a Kontor CSV/TSV or RouteNote Excel export to start the preview."
  });
  let importFileInput = $state<HTMLInputElement | null>(null);
  let importPanelOpen = $state(false);
  let importResetPanelOpen = $state(false);
  let importResetConfirmation = $state("");
  let runReceipt = $state<ApiRunReceipt | null>(null);
  let runReceiptIsPreview = $state(false);
  let mutationReceipt = $state<ApiMutationReceipt | null>(null);
  let runReceiptPageId = $state<DistributionPageId | null>(null);
  let mutationReceiptPageId = $state<DistributionPageId | null>(null);
  let actionNotice = $state<string | null>(null);
  let actionNoticePageId = $state<DistributionPageId | null>(null);
  let actionBannerElement = $state<HTMLElement | null>(null);
  let writesEnabled = $state(false);
  let writeGateMessage = $state("Checking write access.");
  let tablePaginationLoading = $state<DistributionPagedTableId | null>(null);
  let tablePaginationErrors = $state<Partial<Record<DistributionPagedTableId, string | null>>>({});
  let selectedMappingRowIds = $state<readonly string[]>([]);
  let selectedPaymentId = $state<string | null>(null);
  let paymentPanelMode = $state<PaymentPanelMode | null>(null);
  let paymentCreatePanelOpen = $state(false);
  let paymentReferenceInput = $state("");
  let paymentNotesInput = $state("");
  let paymentMethodInput = $state<DistributionPaymentMethod>("bank_transfer");
  let paymentStatusInput = $state<"draft" | "paid">("paid");
  let paymentPaidDateInput = $state(today);
  let paymentExchangeRateInput = $state("");
  let paymentReconcileStatementId = $state("");
  let paymentReconcileAmountInput = $state("");
  let paymentReconcileAmountEdited = $state(false);
  let recordStatementId = $state("");
  let recordPaymentPayeeId = $state("");
  let recordPaymentAmount = $state("");
  let recordPaymentAmountEdited = $state(false);
  let recordPaymentCurrency = $state("MUR");
  let recordPaymentExchangeRate = $state("");
  let recordPaymentMethod = $state<DistributionPaymentMethod>("bank_transfer");
  let recordPaymentStatus = $state<"draft" | "paid">("paid");
  let recordPaymentPaidDate = $state(today);
  let recordPaymentReference = $state("");
  let recordPaymentNotes = $state("");
  let selectedSuspenseId = $state<string | null>(null);
  let suspenseTargetTrackId = $state("");
  let suspenseResolutionNote = $state("");
  let suspenseTrackOptions = $state<readonly TrackSummary[] | null>(null);
  let suspenseTrackOptionsError = $state<string | null>(null);
  let selectedRunId = $state<string | null>(null);
  let allocationDetailRunId = $state<string | null>(null);
  let unpostReasonInput = $state("");
  let catalogPanelMode = $state<CatalogPanelMode | null>(null);
  let releaseTitleInput = $state("");
  let releaseArtistInput = $state("");
  let releaseLabelInput = $state("");
  let releaseUpcInput = $state("");
  let releaseStatusInput = $state<CatalogEntryStatus>("draft");
  let releaseDateInput = $state("");
  let trackTitleInput = $state("");
  let trackArtistInput = $state("");
  let trackIsrcInput = $state("");
  let trackReleaseIdInput = $state("");
  let trackStatusInput = $state<CatalogEntryStatus>("draft");
  let selectedCatalogTrackId = $state<string | null>(null);
  let catalogContributorDrafts = $state<readonly DistributionCatalogContributor[]>([]);
  let catalogContributorNameInput = $state("");
  let catalogContributorRoleInput = $state("main_artist");
  let catalogContributorReasonInput = $state("");
  let contractPickerOpen = $state(false);
  let contractPickerTrackId = $state("");
  let selectedContractRowIds = $state<readonly string[]>([]);
  let contractEditorTrackIds = $state<readonly string[]>([]);
  let contractSplitDrafts = $state<readonly ContractSplitDraft[]>([]);
  let contractRuleReasonInput = $state("");
  let contractRuleEffectiveFromInput = $state(today);
  let contractRuleEffectiveToInput = $state("");
  let contractRuleCurrencyInput = $state("MUR");
  let payeePanelOpen = $state(false);
  let payeeNameInput = $state("");
  let payeeEmailInput = $state("");
  let payeeCurrencyInput = $state("MUR");
  let expenseContractFilterId = $state("");
  let expensePanelOpen = $state(false);
  let expenseContractIdInput = $state("");
  let expenseLabelInput = $state("");
  let expenseCategoryInput = $state<DistributionContractExpenseCategory>("advance");
  let expensePayeeIdInput = $state("");
  let expenseRecoverableInput = $state("yes");
  let expenseAmountInput = $state("");
  let expenseDateInput = $state("");
  let expenseCurrencyInput = $state("MUR");
  let printingStatementId = $state<string | null>(null);
  let statementPrintError = $state<string | null>(null);
  let selectedStatementId = $state<string | null>(null);
  let statementDetailState = $state<ApiRequestState<StatementPrintResponse>>(createIdleState<StatementPrintResponse>());
  let statementVoidReason = $state("");
  let fxFromCurrencyInput = $state("EUR");
  let fxToCurrencyInput = $state("MUR");
  let fxEffectiveDateInput = $state(today);
  let fxRateInput = $state("");
  let aliasEditorId = $state<string | null>(null);
  let aliasEditorOpen = $state(false);
  let aliasTextInput = $state("");
  let aliasTargetTypeInput = $state<DistributionAliasTargetType>("unassigned");
  let aliasTargetIdInput = $state("");
  let fxRateSaveStatus = $state<RequestStatus>("idle");
  let fxRateSaveMessage = $state<string | null>(null);
  let duplicateEditorId = $state<string | null>(null);
  let duplicateMasterId = $state("");
  // Write failures land here (per page) so a transient mutation error never
  // clobbers the loaded list states rendered by the tables.
  let actionError = $state<string | null>(null);
  let actionErrorPageId = $state<DistributionPageId | null>(null);

  const activePage = $derived(getNavItem(activePageId));
  const distributionPeriod = $derived(selectedPeriod);
  const activeRange = $derived(rangeForScope(periodScope, today, customRange));
  const dashboardDataRange = $derived(
    dashboardState.status === "success" ? dashboardState.data.availableDataRange ?? null : null
  );
  const periodDisplayRange = $derived(
    activePageId === "dashboard" && periodScope === "all" && dashboardDataRange !== null
      ? dashboardDataRange
      : activeRange
  );
  const periodControlVisible = $derived(pageUsesPeriodControl(activePageId));
  const importBatches = $derived(readPageItems(importBatchesState));
  const mappingRows = $derived(readPageItems(mappingState));
  const filteredMappingRows = $derived(filterMappingRows(mappingRows, mappingSearch));
  const payees = $derived(readPageItems(payeesState));
  const releases = $derived(readPageItems(releasesState));
  const tracks = $derived(readPageItems(tracksState));
  const catalogWorkbench = $derived(catalogState.status === "success" ? catalogState.data : null);
  const catalogTracks = $derived(catalogWorkbench?.items ?? []);
  const contractWorkbench = $derived(contractWorkbenchState.status === "success" ? contractWorkbenchState.data : null);
  const contractTracks = $derived(contractWorkbench?.items ?? []);
  const expenses = $derived(readPageItems(expensesState));
  const allocationRuns = $derived(readPageItems(allocationsState));
  const allocationWorkbench = $derived(allocationWorkbenchState.status === "success" ? allocationWorkbenchState.data : null);
  const allocationBatches = $derived(allocationWorkbench?.batches.items ?? []);
  const allocationWavePeriod = $derived(allocationBatches.find((batch) => batch.pendingRowCount > 0)?.period ?? distributionPeriod);
  const allocationLockKey = $derived(`distribution:allocations:${allocationWavePeriod}`);
  const allocationBankItems = $derived(allocationWorkbench?.unallocatedBank.items ?? []);
  const suspenseWorkbench = $derived(suspenseState.status === "success" ? suspenseState.data : null);
  const suspenseItems = $derived(suspenseWorkbench?.items.items ?? []);
  const statements = $derived(readPageItems(statementsState));
  const statementsMatchingFilters = $derived(
    statements.filter((statement: StatementSummary): boolean => statementCurrencyFilter === allValue || statement.currency === statementCurrencyFilter)
  );
  // Removed statements remain auditable but do not clutter the operational queue.
  const filteredStatements = $derived(
    statementsMatchingFilters.filter((statement: StatementSummary): boolean => statement.status !== "void")
  );
  const selectedStatement = $derived(
    selectedStatementId === null ? null : filteredStatements.find((statement: StatementSummary): boolean => statement.id === selectedStatementId) ?? null
  );
  const statementDraftCount = $derived(filteredStatements.filter((statement: StatementSummary): boolean => statement.status === "draft").length);
  const statementLockedDueCount = $derived(filteredStatements.filter((statement: StatementSummary): boolean => statement.status === "posted").length);
  const statementPaidCount = $derived(filteredStatements.filter((statement: StatementSummary): boolean => statement.status === "paid").length);
  const statementVoidCount = $derived(statementsMatchingFilters.filter((statement: StatementSummary): boolean => statement.status === "void").length);
  // Deploys update API and static assets independently. Normalize the previous
  // payment shape so an in-flight rollout never crashes the Payments page.
  const payments = $derived(readPageItems(paymentsState).map(normalizePaymentSummary));
  const revenueRows = $derived(readPageItems(revenueState));
  const dashboardReadinessRows = $derived(createDashboardReadinessRows(dashboardState));
  const dashboardArtistRows = $derived(createDashboardTopRows(dashboardState, "artists"));
  const dashboardTrackRows = $derived(createDashboardTopRows(dashboardState, "tracks"));
  const dashboardStoreRows = $derived(createDashboardTopRows(dashboardState, "stores"));
  const importRows = $derived(createImportRows(importBatches));
  const mappingTableRows = $derived(createMappingRows(filteredMappingRows, selectedMappingRowIds));
  const selectedMappingRows = $derived(
    mappingRows.filter((row: DistributionMappingRow): boolean => selectedMappingRowIds.includes(row.id))
  );
  const visibleSuggestedMappingRows = $derived(
    filteredMappingRows.filter((row: DistributionMappingRow): boolean => row.status === "suggested" && row.suggestedTrackId !== null)
  );
  const mappingRowsForRuleApplication = $derived(
    selectedMappingRows.length > 0 ? selectedMappingRows : visibleSuggestedMappingRows
  );
  const mappingRulesSelectionIsApplicable = $derived(
    mappingRowsForRuleApplication.length > 0
      && mappingRowsForRuleApplication.every((row: DistributionMappingRow): boolean => row.status === "suggested" && row.suggestedTrackId !== null)
      && new Set(mappingRowsForRuleApplication.map((row: DistributionMappingRow): string => row.batchId)).size === 1
  );
  const mappingRulesDisabledReason = $derived(
    !writesEnabled ? writeGateMessage
      : mappingRowsForRuleApplication.length === 0 ? "No suggested mapping rows are ready to apply."
      : !mappingRulesSelectionIsApplicable ? "Select only suggested mapping rows with a target track."
      : null
  );
  const catalogRows = $derived(createCatalogRows(catalogTracks));
  const catalogReviewRows = $derived(createCatalogReviewRows(catalogTracks));
  const suggestedCatalogArtistTracks = $derived(catalogTracks.filter((track) => track.suggestedCatalogArtist !== null));
  const contractRows = $derived(createContractRows(contractTracks, selectedContractRowIds));
  const expenseRows = $derived(createExpenseRows(expenses));
  const allocationRows = $derived(createAllocationRows(allocationRuns));
  const allocationDetailRows = $derived(
    allocationDetailState.status === "success" ? createAllocationDetailRows(allocationDetailState.data.items) : []
  );
  const allocationCurrencyTotalRows = $derived(
    allocationCurrencyTotalsState.status === "success" ? createAllocationCurrencyTotalRows(allocationCurrencyTotalsState.data.items) : []
  );
  const allocationDetailRun = $derived(
    allocationDetailRunId === null ? null : allocationRuns.find((run: AllocationRunSummary): boolean => run.id === allocationDetailRunId) ?? null
  );
  const allocationKpis = $derived(createAllocationKpis(allocationWorkbench));
  const allocationHealthKpis = $derived(createAllocationHealthKpis(allocationWorkbench));
  const allocationReasonRows = $derived(createAllocationReasonRows(allocationWorkbench?.suspenseReasons ?? []));
  const allocationRecentRows = $derived(createAllocationRecentRows(allocationWorkbench?.recentBatches ?? []));
  const allocationBatchRows = $derived(createAllocationBatchRows(allocationBatches));
  const allocationBankRows = $derived(createAllocationBankRows(allocationBankItems));
  const suspenseTableRows = $derived(createSuspenseRows(suspenseItems));
  const suspensePlaybookRows = $derived(createSuspensePlaybookRows(suspenseWorkbench?.reasonGroups ?? []));
  const suspenseKpis = $derived(createSuspenseKpis(suspenseWorkbench));
  const statementRows = $derived(createStatementRows(filteredStatements));
  const statementDetailRows = $derived(
    statementDetailState.status === "success" ? createStatementLineRows(summarizeStatementPrintLines(statementDetailState.data.lines), tracks) : []
  );
  const statementDetailSourceLineCount = $derived(statementDetailState.status === "success" ? statementDetailState.data.lines.length : 0);
  const paymentRows = $derived(createPaymentRows(payments));
  const unlinkedPaymentRows = $derived(createPaymentRows(payments.filter((payment) => payment.linkedStatementIds.length === 0 && payment.status !== "voided")));
  const revenueTableRows = $derived(createRevenueRows(revenueRows));
  const revenueChartPoints = $derived(createRevenueChartPoints(revenueRows));
  const reconciliation = $derived(reconciliationState.status === "success" ? reconciliationState.data : null);
  const reconciliationKpis = $derived(createReconciliationKpis(reconciliation));
  const reconStatementRows = $derived(createReconStatementRows(reconciliation));
  const reconExpenseRows = $derived(createReconExpenseRows(reconciliation));
  const reconMatchedRows = $derived(createReconMatchedRows(reconciliation));
  const reconBalanceRows = $derived(createReconBalanceRows(reconciliation));
  const aliases = $derived(readPageItems(aliasesState));
  const duplicates = $derived(readPageItems(duplicatesState));
  const auditEntries = $derived(readPageItems(auditLogState));
  const fxRates = $derived(readPageItems(fxRatesState));
  const aliasRows = $derived(createAliasRows(aliases));
  const duplicateRows = $derived(createDuplicateRows(duplicates));
  const duplicateMasterOptions = $derived<readonly SelectOption[]>(createDuplicateMasterOptions(duplicates, duplicateEditorId));
  const auditRows = $derived(createAuditRows(auditEntries));
  const fxRateRows = $derived(createFxRateRows(fxRates));
  const revenueCurrencyOptions = $derived<readonly SelectOption[]>([
    { label: "All currencies", value: allValue },
    ...Array.from(new Set(revenueRows.map((row: DistributionRevenueRow): CurrencyCode => row.currency))).map((currency: CurrencyCode): SelectOption => ({ label: currency, value: currency }))
  ]);
  const revenuePayeeOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "All payees", value: allValue },
    ...payees.map((payee: PayeeSummary): SelectOption => ({ label: payee.displayName, value: payee.id }))
  ], 1));
  const revenueStoreOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "All stores", value: allValue },
    ...(revenueGroupBy === "store"
      ? Array.from(new Set(revenueRows.map((row: DistributionRevenueRow): string => row.label))).map((store: string): SelectOption => ({ label: store, value: store }))
      : [])
  ], 1));
  const dashboardKpis = $derived(createDashboardKpis(dashboardState));
  const contractKpis = $derived(createContractKpis(contractWorkbench));
  const payeeRows = $derived(createPayeeRows(payees));
  const revenueKpis = $derived(createRevenueKpis(revenueRows, payments, suspenseWorkbench?.summary.totals ?? []));
  const importPagination = $derived<TablePagination | null>(
    createTablePagination(importBatchesState, tablePaginationLoading === "importBatches", tablePaginationError("importBatches"), loadMoreImportBatches, loadAllImportBatches)
  );
  const mappingPagination = $derived<TablePagination | null>(
    createTablePagination(mappingState, tablePaginationLoading === "mapping", tablePaginationError("mapping"), loadMoreMappingRows, loadAllMappingRows)
  );
  const catalogPagination = $derived<TablePagination | null>(
    createTablePagination(catalogState, tablePaginationLoading === "catalog", tablePaginationError("catalog"), loadMoreCatalog, loadAllCatalog)
  );
  const contractsPagination = $derived<TablePagination | null>(
    createTablePagination(contractWorkbenchState, tablePaginationLoading === "contracts", tablePaginationError("contracts"), loadMoreContracts, loadAllContracts)
  );
  const expensesPagination = $derived<TablePagination | null>(
    createTablePagination(expensesState, tablePaginationLoading === "expenses", tablePaginationError("expenses"), loadMoreExpenses, loadAllExpenses)
  );
  const allocationsPagination = $derived<TablePagination | null>(
    createTablePagination(allocationsState, tablePaginationLoading === "allocations", tablePaginationError("allocations"), loadMoreAllocationRuns, loadAllAllocationRuns)
  );
  const allocationBatchesPagination = $derived<TablePagination | null>(
    allocationWorkbench === null ? null : {
      loadedCount: allocationWorkbench.batches.items.length,
      hasMore: allocationWorkbench.batches.nextCursor !== null,
      loading: tablePaginationLoading === "allocationBatches",
      error: tablePaginationError("allocationBatches"),
      onLoadMore: loadMoreAllocationBatches,
      onLoadAll: loadAllAllocationBatches
    }
  );
  const allocationBankPagination = $derived<TablePagination | null>(
    allocationWorkbench === null ? null : {
      loadedCount: allocationWorkbench.unallocatedBank.items.length,
      hasMore: allocationWorkbench.unallocatedBank.nextCursor !== null,
      loading: tablePaginationLoading === "allocationBank",
      error: tablePaginationError("allocationBank"),
      onLoadMore: loadMoreAllocationBank,
      onLoadAll: loadAllAllocationBank
    }
  );
  const suspensePagination = $derived<TablePagination | null>(
    suspenseWorkbench === null ? null : {
      loadedCount: suspenseWorkbench.items.items.length,
      hasMore: suspenseWorkbench.items.nextCursor !== null,
      loading: tablePaginationLoading === "suspense",
      error: tablePaginationError("suspense"),
      onLoadMore: loadMoreSuspense,
      onLoadAll: loadAllSuspense
    }
  );
  const statementsPagination = $derived<TablePagination | null>(
    createTablePagination(statementsState, tablePaginationLoading === "statements", tablePaginationError("statements"), loadMoreStatements, loadAllStatements)
  );
  const paymentsPagination = $derived<TablePagination | null>(
    createTablePagination(paymentsState, tablePaginationLoading === "payments", tablePaginationError("payments"), loadMorePayments, loadAllPayments)
  );
  const revenuePagination = $derived<TablePagination | null>(
    createTablePagination(revenueState, tablePaginationLoading === "revenue", tablePaginationError("revenue"), loadMoreRevenue, loadAllRevenue)
  );
  const aliasesPagination = $derived<TablePagination | null>(
    createTablePagination(aliasesState, tablePaginationLoading === "aliases", tablePaginationError("aliases"), loadMoreAliases, loadAllAliases)
  );
  const duplicatesPagination = $derived<TablePagination | null>(
    createTablePagination(duplicatesState, tablePaginationLoading === "duplicates", tablePaginationError("duplicates"), loadMoreDuplicates, loadAllDuplicates)
  );
  const auditPagination = $derived<TablePagination | null>(
    createTablePagination(auditLogState, tablePaginationLoading === "auditLog", tablePaginationError("auditLog"), loadMoreAuditLog, loadAllAuditLog)
  );
  const settings = $derived(settingsState.status === "success" ? settingsState.data : null);
  const fxFromCurrencyNormalized = $derived(normalizeCurrencyCode(fxFromCurrencyInput));
  const fxToCurrencyNormalized = $derived(normalizeCurrencyCode(fxToCurrencyInput));
  const fxEffectiveDateNormalized = $derived(normalizeIsoDate(fxEffectiveDateInput));
  const fxRateNormalized = $derived(normalizeFxRateValue(fxRateInput));
  const auditFromNormalized = $derived(normalizeIsoDate(auditFromInput));
  const auditToNormalized = $derived(normalizeIsoDate(auditToInput));
  const auditFiltersValid = $derived(
    (auditFromInput.trim() === "" || auditFromNormalized !== null)
      && (auditToInput.trim() === "" || auditToNormalized !== null)
      && (auditFromNormalized === null || auditToNormalized === null || auditFromNormalized <= auditToNormalized)
  );
  const fxRateFormValid = $derived(
    fxFromCurrencyNormalized !== null &&
    fxToCurrencyNormalized !== null &&
    fxEffectiveDateNormalized !== null &&
    fxRateNormalized !== null
  );
  const aliasTargetRequiresId = $derived(aliasTargetTypeInput !== "unassigned");
  const aliasTargetIsSelect = $derived(
    aliasTargetTypeInput === "payee" || aliasTargetTypeInput === "release" || aliasTargetTypeInput === "track"
  );
  const aliasTargetSelectOptions = $derived<readonly SelectOption[]>(createAliasTargetOptions(aliasTargetTypeInput, payees, releases, tracks));
  const aliasFormValid = $derived(
    aliasTextInput.trim().length > 0 &&
    (!aliasTargetRequiresId || aliasTargetIdInput.trim().length > 0)
  );
  const importToolbarFilters = $derived(createImportToolbarFilters(importState));
  const mappingBatchFilterOptions = $derived<readonly SelectOption[]>([
    { label: "All batches", value: allValue },
    ...importBatches
      .filter((batch: DistributionImportBatch): boolean => batch.status !== "voided")
      .map((batch: DistributionImportBatch): SelectOption => ({
      label: `${batch.fileName} · ${batch.period}`,
      value: batch.id
      }))
  ]);
  const canPreviewImport = $derived(importState.rows.length > 0 && importState.status !== "loading");
  const canConfirmImport = $derived(importState.preview !== null && importState.status !== "loading");
  const canOpenImportAssistant = $derived((importState.preview !== null || importState.rows.length > 0) && importState.status !== "loading");
  const statementPreview = $derived(
    filteredStatements.find((statement: StatementSummary): boolean => statementPayeeFilter !== allValue && statement.payeeId === statementPayeeFilter) ?? filteredStatements[0] ?? null
  );
  const selectedPayment = $derived(payments.find((payment: PaymentSummary): boolean => payment.id === selectedPaymentId) ?? null);
  const openStatements = $derived(
    filteredStatements.filter((statement: StatementSummary): boolean => statement.status === "draft" || statement.status === "posted")
  );
  const recordStatement = $derived(openStatements.find((statement: StatementSummary): boolean => statement.id === recordStatementId) ?? null);
  const recordPaymentAmountMicro = $derived(parseExpenseAmountMicro(recordPaymentAmount));
  const recordPaymentExchangeRateNormalized = $derived(
    recordPaymentExchangeRate.trim() === "" ? null : normalizeFxRateValue(recordPaymentExchangeRate)
  );
  const paymentExchangeRateNormalized = $derived(
    paymentExchangeRateInput.trim() === "" ? null : normalizeFxRateValue(paymentExchangeRateInput)
  );
  const paymentReconcileAmountMicro = $derived(parseExpenseAmountMicro(paymentReconcileAmountInput));
  const selectedSuspenseItem = $derived(suspenseItems.find((item: DistributionSuspenseWorkbenchRow): boolean => item.id === selectedSuspenseId) ?? null);
  const selectedSuspenseResolution = $derived(selectedSuspenseItem === null ? null : suspenseResolutionFor(selectedSuspenseItem));
  const selectedSuspenseTrack = $derived(
    (suspenseTrackOptions ?? []).find((track: TrackSummary): boolean => track.id === suspenseTargetTrackId) ?? null
  );
  const suspenseResolveTarget = $derived(resolveSuspenseTargetFor(selectedSuspenseResolution, selectedSuspenseTrack));
  const suspenseReasonOptions = $derived<readonly SelectOption[]>([
    { label: "All reasons", value: allValue },
    ...(suspenseWorkbench?.reasonGroups ?? []).map((group): SelectOption => ({
      label: `${group.title} · ${String(group.rowCount)}`,
      value: group.reasonCode
    }))
  ]);
  const selectedRun = $derived(allocationRuns.find((run: AllocationRunSummary): boolean => run.id === selectedRunId) ?? null);
  const contractEditorTracks = $derived(
    contractEditorTrackIds.map((trackId) => contractTracks.find((track) => track.trackId === trackId)).filter((track): track is DistributionContractTrackRow => track !== undefined)
  );
  const primaryContractEditorTrack = $derived(contractEditorTracks[0] ?? null);
  const selectedExpenseFilterContract = $derived(
    contractTracks.find((track) => track.contractId === expenseContractFilterId) ?? null
  );
  const selectedExpenseContract = $derived(
    contractTracks.find((track) => track.contractId === expenseContractIdInput) ?? null
  );
  const contractSplitTotal = $derived(contractSplitTotalPercentage(contractSplitDrafts));
  const contractSplitDraftValid = $derived(
    contractEditorTrackIds.length > 0 &&
    contractSplitDrafts.length > 0 &&
    contractSplitDrafts.every((split) => split.payeeId !== "" && parseContractPercentageUnits(split.percentage) !== null) &&
    new Set(contractSplitDrafts.map((split) => split.payeeId)).size === contractSplitDrafts.length &&
    contractSplitTotal === "100.000000" &&
    contractRuleReasonInput.trim() !== "" &&
    contractRuleEffectiveFromInput !== "" &&
    normalizeCurrencyCode(contractRuleCurrencyInput) !== null
  );
  const expenseAmountMicro = $derived(parseExpenseAmountMicro(expenseAmountInput));
  const expenseContractSelectOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "Select a contract", value: "" },
    ...uniqueContractTracks(contractTracks).map((track): SelectOption => ({
      label: `${track.title} · ${track.releaseTitle ?? "No release"}`,
      value: track.contractId ?? ""
    }))
  ], 1));
  const contractPickerOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "Select a track", value: "" },
    ...contractTracks.map((track): SelectOption => ({
      label: `${track.title} · ${track.catalogArtist} · ${contractTrackStatusLabel(track.status)}`,
      value: track.trackId
    }))
  ], 1));
  const expenseTableTitle = $derived(
    selectedExpenseFilterContract === null
      ? "Expenses / recoupments"
      : `Expenses / recoupments · ${selectedExpenseFilterContract.title}`
  );
  const payeeSelectOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "Select a payee", value: "" },
    ...payees.map((payee: PayeeSummary): SelectOption => ({ label: `${payee.displayName} · ${payee.defaultCurrency}`, value: payee.id }))
  ], 1));
  const expensePayeeOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "Shared / all payees", value: "" },
    ...payees.map((payee: PayeeSummary): SelectOption => ({ label: `${payee.displayName} · ${payee.defaultCurrency}`, value: payee.id }))
  ], 1));
  const catalogLabelOptions = $derived<readonly SelectOption[]>([
    { label: "All labels", value: allValue },
    ...(catalogWorkbench?.facets.labels ?? []).map((option): SelectOption => ({
      label: `${option.label} · ${option.count}`,
      value: option.value
    }))
  ]);
  const catalogRoleOptions = $derived<readonly SelectOption[]>([
    { label: "All roles", value: allValue },
    ...(catalogWorkbench?.facets.roles ?? []).map((option): SelectOption => ({
      label: `${formatCatalogRole(option.label)} · ${option.count}`,
      value: option.value
    }))
  ]);
  const trackReleaseSelectOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "No release", value: "" },
    ...(catalogWorkbench?.facets.releases ?? []).map((release): SelectOption => ({
      label: `${release.title} · ${release.artistName}`,
      value: release.id
    }))
  ], 1));
  const selectedCatalogTrack = $derived(
    catalogTracks.find((track: DistributionCatalogTrackRow): boolean => track.id === selectedCatalogTrackId) ?? null
  );
  const selectedCatalogMainArtist = $derived(
    catalogContributorDrafts.filter((contributor) => contributor.role === "main_artist").length === 1
      ? catalogContributorDrafts.find((contributor) => contributor.role === "main_artist") ?? null
      : null
  );
  const catalogKpis = $derived(createCatalogKpis(catalogWorkbench));
  const suspenseTrackSelectOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "Select a track", value: "" },
    ...(suspenseTrackOptions ?? []).map((track: TrackSummary): SelectOption => ({ label: `${track.title} · ${track.artistName}`, value: track.id }))
  ], 1));
  const openStatementSelectOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "No statement yet", value: "" },
    ...openStatements.map((statement: StatementSummary): SelectOption => ({
      label: `${statement.payeeName} · ${statement.period} · ${formatMoney(statement.netPayableMicro, statement.currency)}`,
      value: statement.id
    }))
  ], 1));
  const paymentReconcileStatementOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "Select a statement", value: "" },
    ...openStatements
      .filter((statement: StatementSummary): boolean =>
        selectedPayment !== null &&
        statement.payeeId === selectedPayment.payeeId &&
        statement.currency === selectedPayment.currency
      )
      .map((statement: StatementSummary): SelectOption => ({
        label: `${statement.payeeName} · ${statement.period} · ${formatMoney(statement.netPayableMicro, statement.currency)}`,
        value: statement.id
      }))
  ], 1));
  const statementPayeeOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "All payees", value: allValue },
    ...payees.map((payee: PayeeSummary): SelectOption => ({ label: payee.displayName, value: payee.id }))
  ], 1));
  const statementCurrencyOptions = $derived<readonly SelectOption[]>([
    { label: "All currencies", value: allValue },
    ...Array.from(new Set(statements.map((statement: StatementSummary): CurrencyCode => statement.currency))).map((currency: CurrencyCode): SelectOption => ({ label: currency, value: currency }))
  ]);
  const paymentRowActions: readonly TableRowAction[] = [
    { label: "Edit payment", onAction: (rowId: string): void => openPaymentPanel(rowId, "edit") },
    { label: "Link statement", onAction: (rowId: string): void => openPaymentPanel(rowId, "reconcile") },
    { label: "Void", onAction: (rowId: string): void => openPaymentPanel(rowId, "void"), danger: true }
  ];
  const dashboardReadinessRowActions: readonly TableRowAction[] = [
    { label: dashboardFixLabel, onAction: openDashboardReadiness }
  ];
  const contractRowActions: readonly TableRowAction[] = [
    { label: "Toggle selection", onAction: toggleContractRowSelection },
    { label: "Edit split group", onAction: openContractEditor }
  ];
  const statementRowActions: readonly TableRowAction[] = [
    { label: "Open lines", onAction: openStatementDetail },
    { label: "Export CSV", onAction: exportStatementCsv },
    { label: "Print PDF", onAction: printStatementPdf },
    { label: "Remove", onAction: openStatementVoidPanel, danger: true, isEnabled: statementCanVoid, disabledReason: statementVoidDisabledReason }
  ];
  const importRowActions: readonly TableRowAction[] = [
    {
      label: "Open",
      onAction: openImportBatch,
      isEnabled: canOpenImportBatch,
      disabledReason: importBatchReadOnlyReason
    },
    {
      label: "Process royalties",
      onAction: generateTracksFromImportBatch,
      isEnabled: canGenerateTracksFromImportBatch,
      disabledReason: generateTracksFromImportBatchDisabledReason
    },
    {
      label: "Cancel batch",
      onAction: reverseImportBatch,
      danger: true,
      isEnabled: canCancelImportBatch,
      disabledReason: importBatchReadOnlyReason
    }
  ];
  const mappingRowActions: readonly TableRowAction[] = [
    { label: "Toggle selection", onAction: toggleMappingRowSelection }
  ];
  const catalogRowActions: readonly TableRowAction[] = [
    { label: "Review contributors", onAction: reviewCatalogRow }
  ];
  const suspenseRowActions: readonly TableRowAction[] = [
    { label: suspenseFixLabel, onAction: openSuspenseFixPath },
    {
      label: "Resolve",
      onAction: openSuspenseResolution,
      isEnabled: suspenseRowCanResolve,
      disabledReason: suspenseRowResolveDisabledReason
    }
  ];
  const suspensePlaybookRowActions: readonly TableRowAction[] = [
    { label: (rowId: string): string => `Fix ${humanizeIssueCode(rowId)} queue`, onAction: openSuspenseReasonQueue }
  ];
  const allocationRowActions: readonly TableRowAction[] = [
    { label: "View allocations", onAction: openAllocationDetail },
    { label: "Request reversal", onAction: selectRunForUnpost, danger: true }
  ];
  const allocationReasonRowActions: readonly TableRowAction[] = [
    { label: (rowId: string): string => `Fix ${humanizeIssueCode(rowId)} queue`, onAction: openAllocationSuspenseReason }
  ];
  const allocationBatchRowActions: readonly TableRowAction[] = [
    { label: "Preview", onAction: previewAllocationBatch },
    { label: "Run", onAction: runAllocationBatch, isEnabled: allocationBatchCanRun, disabledReason: allocationBatchRunDisabledReason }
  ];
  const allocationBankRowActions: readonly TableRowAction[] = [
    { label: (rowId: string): string => `Create split for ${allocationTrackLabel(rowId)}`, onAction: openAllocationContractSetup },
    { label: (rowId: string): string => `Retry ${allocationTrackLabel(rowId)}`, onAction: retryAllocationTrack, isEnabled: allocationTrackCanRetry, disabledReason: allocationTrackRetryDisabledReason }
  ];
  const aliasRowActions: readonly TableRowAction[] = [
    { label: "Edit", onAction: openAliasEditor }
  ];
  const duplicateRowActions: readonly TableRowAction[] = [
    { label: "Merge into master", onAction: openDuplicateMerge, isEnabled: duplicateCanMerge, disabledReason: duplicateMergeDisabledReason }
  ];

  onMount((): (() => void) => {
    syncPageFromLocation();
    window.addEventListener("popstate", syncPageFromLocation);
    void loadInitialData();

    return (): void => {
      window.removeEventListener("popstate", syncPageFromLocation);
    };
  });

  $effect((): void => {
    if (selectedMappingRowIds.length === 0) {
      return;
    }

    const visibleIds = new Set(mappingRows.map((row: DistributionMappingRow): string => row.id));
    const kept = selectedMappingRowIds.filter((rowId: string): boolean => visibleIds.has(rowId));

    if (kept.length !== selectedMappingRowIds.length) {
      selectedMappingRowIds = kept;
    }
  });

  $effect((): void => {
    if (activePageId === "settings" && fxRatesState.status === "idle") {
      void loadFxRates();
    }
  });

  $effect((): void => {
    if (activePageId === "catalog" && catalogState.status === "idle") {
      void loadCatalog();
    }
  });

  $effect((): void => {
    if (activePageId === "contracts" && contractWorkbenchState.status === "idle") {
      void loadContractWorkbench();
    }
  });

  $effect((): void => {
    if ((activePageId === "allocations" || activePageId === "suspense") && allocationWorkbenchState.status === "idle") {
      void loadAllocationWorkbench();
    }
  });

  $effect((): void => {
    if (activePageId === "suspense" && suspenseState.status === "idle") {
      void loadSuspense();
    }
  });

  async function loadInitialData(): Promise<void> {
    try {
      const screen = await distributionApi.getScreen({
        workspaceId: distributionWorkspaceId,
        period: distributionPeriod,
        dateFrom: activeRange.from,
        dateTo: activeRange.to,
        importSource: toNullableImportSource(importSourceFilter),
        importStatus: toNullableImportBatchStatus(importStatusFilter),
        mappingStatus: toNullableMappingStatus(mappingStatusFilter),
        suspenseStatus: toNullableSuspenseStatus(suspenseStatusFilter),
        paymentStatus: toNullablePaymentStatus(paymentStatusFilter),
        revenueGroupBy
      });
      applyScreenBundle(screen);
      if (activePageId === "contracts") {
        await loadContractWorkbench();
      }
      if (activePageId === "allocations") {
        await loadAllocationWorkbench();
      }
      if (activePageId === "suspense" || activePageId === "revenue") {
        await loadSuspense();
      }
    } catch {
      await Promise.all([
        loadWriteGate(),
        loadDashboard(),
        loadImportBatches(),
        loadMappingRows(),
        loadPayees(),
        activePageId === "catalog" ? loadCatalog() : Promise.resolve(),
        activePageId === "contracts" ? loadContractWorkbench() : Promise.resolve(),
        (activePageId === "allocations" || activePageId === "suspense") ? loadAllocationWorkbench() : Promise.resolve(),
        loadAllocationRuns(),
        loadSuspense(),
        loadStatements(),
        loadPayments(),
        loadRevenue(),
        loadReconciliation(),
        loadAliases(),
        loadDuplicates(),
        loadAuditLog(),
        loadSettings(),
        loadFxRates()
      ]);
    }
  }

  function applyScreenBundle(screen: DistributionScreenResponse): void {
    writesEnabled = screen.status.writesEnabled;
    writeGateMessage = screen.status.writesEnabled ? "write access enabled" : "enable write access";
    dashboardState = createSuccessState<DistributionDashboardResponse>(screen.dashboard);
    importBatchesState = createSuccessState<PageResult<DistributionImportBatch>>(screen.importBatches);
    mappingState = createSuccessState<PageResult<DistributionMappingRow>>(screen.mappingRows);
    payeesState = createSuccessState<PageResult<PayeeSummary>>(screen.payees);
    releasesState = createSuccessState<PageResult<ReleaseSummary>>(screen.releases);
    tracksState = createSuccessState<PageResult<TrackSummary>>(screen.tracks);
    expensesState = createSuccessState<PageResult<DistributionContractExpense>>(emptyPageResult<DistributionContractExpense>());
    allocationsState = createSuccessState<PageResult<AllocationRunSummary>>(screen.allocations);
    // The bundled screen response is a bounded compatibility snapshot. Suspense
    // always loads from its live, cursor-paginated Postgres workbench instead.
    suspenseState = createIdleState<DistributionSuspenseWorkbenchResponse>();
    statementsState = createSuccessState<PageResult<StatementSummary>>(screen.statements);
    paymentsState = createSuccessState<PageResult<PaymentSummary>>(screen.payments);
    revenueState = createSuccessState<PageResult<DistributionRevenueRow>>(screen.revenue);
    reconciliationState = createSuccessState<DistributionReconciliationResponse>(screen.reconciliation);
    aliasesState = createSuccessState<PageResult<DistributionAlias>>(screen.aliases);
    duplicatesState = createSuccessState<PageResult<DistributionDuplicate>>(screen.duplicates);
    auditLogState = createSuccessState<PageResult<AuditLogEntry>>(screen.auditLog);
    settingsState = createSuccessState<DistributionSettingsResponse>(screen.settings);
    tablePaginationLoading = null;
    tablePaginationErrors = {};
  }

  function tablePaginationError(tableId: DistributionPagedTableId): string | null {
    return tablePaginationErrors[tableId] ?? null;
  }

  function setTablePaginationError(tableId: DistributionPagedTableId, error: string | null): void {
    tablePaginationErrors = {
      ...tablePaginationErrors,
      [tableId]: error
    };
  }

  async function loadDistributionPageResult<TItem>(
    tableId: DistributionPagedTableId,
    state: ApiRequestState<PageResult<TItem>>,
    setState: (state: ApiRequestState<PageResult<TItem>>) => void,
    fetchPage: (cursor: string) => Promise<PageResult<TItem>>,
    mode: PageLoadMode
  ): Promise<void> {
    await loadPageResult(mode, {
      state,
      loading: tablePaginationLoading === tableId,
      setLoading: (loading: boolean): void => {
        tablePaginationLoading = loading ? tableId : null;
      },
      setError: (error: string | null): void => {
        setTablePaginationError(tableId, error);
      },
      setState,
      fetchPage
    });
  }

  async function loadMoreImportBatches(): Promise<void> {
    await loadImportBatchesPage("one");
  }

  async function loadAllImportBatches(): Promise<void> {
    await loadImportBatchesPage("all");
  }

  async function loadImportBatchesPage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "importBatches",
      importBatchesState,
      (state: ApiRequestState<PageResult<DistributionImportBatch>>): void => {
        importBatchesState = state;
      },
      (cursor: string): Promise<PageResult<DistributionImportBatch>> =>
        distributionApi.listImportBatches({
          workspaceId: distributionWorkspaceId,
          source: toNullableImportSource(importSourceFilter),
          status: toNullableImportBatchStatus(importStatusFilter),
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMoreMappingRows(): Promise<void> {
    await loadMappingRowsPage("one");
  }

  async function loadAllMappingRows(): Promise<void> {
    await loadMappingRowsPage("all");
  }

  async function loadMappingRowsPage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "mapping",
      mappingState,
      (state: ApiRequestState<PageResult<DistributionMappingRow>>): void => {
        mappingState = state;
      },
      (cursor: string): Promise<PageResult<DistributionMappingRow>> =>
        distributionApi.listMappingRows({
          workspaceId: distributionWorkspaceId,
          batchId: toNullableBatchFilter(mappingBatchFilter),
          status: toNullableMappingStatus(mappingStatusFilter),
          search: mappingSearch.trim() === "" ? null : mappingSearch.trim(),
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMoreCatalog(): Promise<void> {
    await loadCatalogPage("one");
  }

  async function loadAllCatalog(): Promise<void> {
    await loadCatalogPage("all");
  }

  async function loadCatalogPage(mode: PageLoadMode): Promise<void> {
    if (
      tablePaginationLoading === "catalog" ||
      catalogState.status !== "success" ||
      catalogState.data.nextCursor === null
    ) {
      return;
    }

    tablePaginationLoading = "catalog";
    setTablePaginationError("catalog", null);

    try {
      let loaded = catalogState.data;
      let cursor = loaded.nextCursor;

      while (cursor !== null) {
        const nextPage = await distributionApi.getCatalogWorkbench(catalogQuery(cursor));
        loaded = {
          ...nextPage,
          items: [...loaded.items, ...nextPage.items]
        };
        catalogState = createSuccessState<DistributionCatalogWorkbenchResponse>(loaded);
        cursor = nextPage.nextCursor;

        if (mode === "one") {
          break;
        }
      }
    } catch (error: unknown) {
      setTablePaginationError("catalog", getErrorMessage(error));
    } finally {
      tablePaginationLoading = null;
    }
  }

  async function loadMoreContracts(): Promise<void> {
    await loadContractsPage("one");
  }

  async function loadAllContracts(): Promise<void> {
    await loadContractsPage("all");
  }

  async function loadContractsPage(mode: PageLoadMode): Promise<void> {
    if (
      tablePaginationLoading === "contracts" ||
      contractWorkbenchState.status !== "success" ||
      contractWorkbenchState.data.nextCursor === null
    ) {
      return;
    }

    tablePaginationLoading = "contracts";
    setTablePaginationError("contracts", null);
    try {
      let loaded = contractWorkbenchState.data;
      let cursor = loaded.nextCursor;
      while (cursor !== null) {
        const nextPage = await distributionApi.getContractWorkbench(contractQuery(cursor));
        loaded = { ...nextPage, items: [...loaded.items, ...nextPage.items] };
        contractWorkbenchState = createSuccessState<DistributionContractWorkbenchResponse>(loaded);
        cursor = nextPage.nextCursor;
        if (mode === "one") break;
      }
    } catch (error: unknown) {
      setTablePaginationError("contracts", getErrorMessage(error));
    } finally {
      tablePaginationLoading = null;
    }
  }

  async function loadMoreExpenses(): Promise<void> {
    await loadExpensesPage("one");
  }

  async function loadAllExpenses(): Promise<void> {
    await loadExpensesPage("all");
  }

  async function loadExpensesPage(mode: PageLoadMode): Promise<void> {
    if (expenseContractFilterId === "") {
      expensesState = createSuccessState<PageResult<DistributionContractExpense>>(emptyPageResult<DistributionContractExpense>());
      setTablePaginationError("expenses", null);
      return;
    }

    await loadDistributionPageResult(
      "expenses",
      expensesState,
      (state: ApiRequestState<PageResult<DistributionContractExpense>>): void => {
        expensesState = state;
      },
      (cursor: string): Promise<PageResult<DistributionContractExpense>> =>
        distributionApi.listContractExpenses({
          workspaceId: distributionWorkspaceId,
          contractId: expenseContractFilterId,
          status: null,
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMoreAllocationRuns(): Promise<void> {
    await loadAllocationRunsPage("one");
  }

  async function loadAllAllocationRuns(): Promise<void> {
    await loadAllocationRunsPage("all");
  }

  async function loadAllocationRunsPage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "allocations",
      allocationsState,
      (state: ApiRequestState<PageResult<AllocationRunSummary>>): void => {
        allocationsState = state;
      },
      (cursor: string): Promise<PageResult<AllocationRunSummary>> =>
        distributionApi.listAllocationRuns({
          workspaceId: distributionWorkspaceId,
          period: null,
          status: null,
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMoreSuspense(): Promise<void> {
    await loadSuspensePage("one");
  }

  async function loadAllSuspense(): Promise<void> {
    await loadSuspensePage("all");
  }

  async function loadSuspensePage(mode: PageLoadMode): Promise<void> {
    if (suspenseState.status !== "success" || tablePaginationLoading !== null) return;
    let current = suspenseState.data;
    let cursor = current.items.nextCursor;
    if (cursor === null) return;
    tablePaginationLoading = "suspense";
    setTablePaginationError("suspense", null);
    try {
      while (cursor !== null) {
        const next = await distributionApi.getSuspenseWorkbench(suspenseWorkbenchQuery(cursor));
        current = { ...next, items: appendPageResult(current.items, next.items) };
        suspenseState = createSuccessState<DistributionSuspenseWorkbenchResponse>(current);
        cursor = current.items.nextCursor;
        if (mode === "one") break;
      }
    } catch (error: unknown) {
      setTablePaginationError("suspense", getErrorMessage(error));
    } finally {
      tablePaginationLoading = null;
    }
  }

  async function loadMoreStatements(): Promise<void> {
    await loadStatementsPage("one");
  }

  async function loadAllStatements(): Promise<void> {
    await loadStatementsPage("all");
  }

  async function loadStatementsPage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "statements",
      statementsState,
      (state: ApiRequestState<PageResult<StatementSummary>>): void => {
        statementsState = state;
      },
      (cursor: string): Promise<PageResult<StatementSummary>> =>
        distributionApi.listStatements({
          workspaceId: distributionWorkspaceId,
          period: allocationWavePeriod,
          payeeId: toNullablePayeeFilter(statementPayeeFilter),
          status: null,
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMorePayments(): Promise<void> {
    await loadPaymentsPage("one");
  }

  async function loadAllPayments(): Promise<void> {
    await loadPaymentsPage("all");
  }

  async function loadPaymentsPage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "payments",
      paymentsState,
      (state: ApiRequestState<PageResult<PaymentSummary>>): void => {
        paymentsState = state;
      },
      (cursor: string): Promise<PageResult<PaymentSummary>> =>
        distributionApi.listPayments({
          workspaceId: distributionWorkspaceId,
          period: distributionPeriod,
          payeeId: null,
          status: toNullablePaymentStatus(paymentStatusFilter),
          dateFrom: activeRange.from,
          dateTo: activeRange.to,
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMoreRevenue(): Promise<void> {
    await loadRevenuePage("one");
  }

  async function loadAllRevenue(): Promise<void> {
    await loadRevenuePage("all");
  }

  async function loadRevenuePage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "revenue",
      revenueState,
      (state: ApiRequestState<PageResult<DistributionRevenueRow>>): void => {
        revenueState = state;
      },
      (cursor: string): Promise<PageResult<DistributionRevenueRow>> =>
        distributionApi.getRevenue({
          workspaceId: distributionWorkspaceId,
          period: distributionPeriod,
          payeeId: toNullablePayeeFilter(revenuePayeeFilter),
          store: toNullableStoreFilter(revenueStoreFilter),
          currency: toNullableCurrency(revenueCurrencyFilter),
          groupBy: revenueGroupBy,
          dateFrom: activeRange.from,
          dateTo: activeRange.to,
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMoreAliases(): Promise<void> {
    await loadAliasesPage("one");
  }

  async function loadAllAliases(): Promise<void> {
    await loadAliasesPage("all");
  }

  async function loadAliasesPage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "aliases",
      aliasesState,
      (state: ApiRequestState<PageResult<DistributionAlias>>): void => {
        aliasesState = state;
      },
      (cursor: string): Promise<PageResult<DistributionAlias>> =>
        distributionApi.listAliases({
          workspaceId: distributionWorkspaceId,
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMoreDuplicates(): Promise<void> {
    await loadDuplicatesPage("one");
  }

  async function loadAllDuplicates(): Promise<void> {
    await loadDuplicatesPage("all");
  }

  async function loadDuplicatesPage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "duplicates",
      duplicatesState,
      (state: ApiRequestState<PageResult<DistributionDuplicate>>): void => {
        duplicatesState = state;
      },
      (cursor: string): Promise<PageResult<DistributionDuplicate>> =>
        distributionApi.listDuplicates({
          workspaceId: distributionWorkspaceId,
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMoreAuditLog(): Promise<void> {
    await loadAuditLogPage("one");
  }

  async function loadAllAuditLog(): Promise<void> {
    await loadAuditLogPage("all");
  }

  async function loadAuditLogPage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "auditLog",
      auditLogState,
      (state: ApiRequestState<PageResult<AuditLogEntry>>): void => {
        auditLogState = state;
      },
      (cursor: string): Promise<PageResult<AuditLogEntry>> =>
        distributionApi.listAuditLog({
          workspaceId: distributionWorkspaceId,
          from: auditFromNormalized,
          to: auditToNormalized,
          actorId: auditActorInput.trim() === "" ? null : auditActorInput.trim(),
          entityType: auditEntityInput.trim() === "" ? null : auditEntityInput.trim(),
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadWriteGate(): Promise<void> {
    try {
      // Distribution-scoped write gate: the distribution role is 403 on cc/v1 since the domain-authz
      // fix, so read writesEnabled from erh/v1/status — not cc/v1/status.
      const status = await distributionApi.getStatus({
        workspaceId: distributionWorkspaceId
      });
      writesEnabled = status.writesEnabled;
      writeGateMessage = status.writesEnabled ? "write access enabled" : "enable write access";
    } catch (error: unknown) {
      writesEnabled = false;
      writeGateMessage = getErrorMessage(error);
    }
  }

  async function loadDashboard(): Promise<void> {
    dashboardState = beginReload<DistributionDashboardResponse>(dashboardState);

    try {
      dashboardState = createSuccessState<DistributionDashboardResponse>(
        await distributionApi.getDashboard({
          workspaceId: distributionWorkspaceId,
          period: distributionPeriod,
          dateFrom: activeRange.from,
          dateTo: activeRange.to
        })
      );
    } catch (error: unknown) {
      dashboardState = createErrorState<DistributionDashboardResponse>(error);
    }
  }

  async function loadImportBatches(): Promise<void> {
    importBatchesState = beginReload<PageResult<DistributionImportBatch>>(importBatchesState);

    try {
      importBatchesState = createSuccessState<PageResult<DistributionImportBatch>>(
        await distributionApi.listImportBatches({
          workspaceId: distributionWorkspaceId,
          source: toNullableImportSource(importSourceFilter),
          status: toNullableImportBatchStatus(importStatusFilter),
          cursor: null,
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("importBatches", null);
    } catch (error: unknown) {
      importBatchesState = createErrorState<PageResult<DistributionImportBatch>>(error);
    }
  }

  async function loadMappingRows(): Promise<void> {
    mappingState = beginReload<PageResult<DistributionMappingRow>>(mappingState);

    try {
      mappingState = createSuccessState<PageResult<DistributionMappingRow>>(
        await distributionApi.listMappingRows({
          workspaceId: distributionWorkspaceId,
          batchId: toNullableBatchFilter(mappingBatchFilter),
          status: toNullableMappingStatus(mappingStatusFilter),
          search: mappingSearch.trim() === "" ? null : mappingSearch.trim(),
          cursor: null,
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("mapping", null);
    } catch (error: unknown) {
      mappingState = createErrorState<PageResult<DistributionMappingRow>>(error);
    }
  }

  async function loadPayees(): Promise<void> {
    payeesState = beginReload<PageResult<PayeeSummary>>(payeesState);

    try {
      let page = await distributionApi.listPayees({ workspaceId: distributionWorkspaceId, status: null, cursor: null, limit: TABLE_PAGE_SIZE });
      while (page.nextCursor !== null) {
        const nextPage = await distributionApi.listPayees({ workspaceId: distributionWorkspaceId, status: null, cursor: page.nextCursor, limit: TABLE_PAGE_SIZE });
        page = appendPageResult(page, nextPage);
      }
      payeesState = createSuccessState<PageResult<PayeeSummary>>(page);
      setTablePaginationError("payees", null);
    } catch (error: unknown) {
      payeesState = createErrorState<PageResult<PayeeSummary>>(error);
    }
  }

  async function loadCatalog(): Promise<void> {
    catalogState = beginReload<DistributionCatalogWorkbenchResponse>(catalogState);

    try {
      catalogState = createSuccessState<DistributionCatalogWorkbenchResponse>(
        await distributionApi.getCatalogWorkbench(catalogQuery(null))
      );
      setTablePaginationError("catalog", null);
    } catch (error: unknown) {
      catalogState = createErrorState<DistributionCatalogWorkbenchResponse>(error);
    }
  }

  function catalogQuery(cursor: string | null) {
    return {
      workspaceId: distributionWorkspaceId,
      search: catalogSearch.trim() === "" ? null : catalogSearch.trim(),
      artistSource: catalogArtistSource,
      isrc: catalogIsrc.trim() === "" ? null : catalogIsrc.trim(),
      role: catalogRoleFilter === allValue ? null : catalogRoleFilter,
      review: catalogReviewFilter === allValue ? null : catalogReviewFilter,
      label: catalogLabelFilter === allValue ? null : catalogLabelFilter,
      releaseFrom: catalogReleaseFrom === "" ? null : catalogReleaseFrom,
      releaseTo: catalogReleaseTo === "" ? null : catalogReleaseTo,
      status: toNullableCatalogStatus(catalogStatusFilter),
      cursor,
      limit: TABLE_PAGE_SIZE
    } as const;
  }

  async function loadContractWorkbench(): Promise<void> {
    if (contractWorkbenchState.status === "loading") {
      return;
    }
    contractWorkbenchState = beginReload<DistributionContractWorkbenchResponse>(contractWorkbenchState);
    try {
      contractWorkbenchState = createSuccessState<DistributionContractWorkbenchResponse>(
        await distributionApi.getContractWorkbench(contractQuery(null))
      );
      setTablePaginationError("contracts", null);
    } catch (error: unknown) {
      contractWorkbenchState = createErrorState<DistributionContractWorkbenchResponse>(error);
    }
  }

  function contractQuery(cursor: string | null) {
    return {
      workspaceId: distributionWorkspaceId,
      search: contractSearch.trim() === "" ? null : contractSearch.trim(),
      status: contractStatusFilter === allValue ? null : contractStatusFilter,
      workflow: contractWorkflowFilter === allValue ? null : contractWorkflowFilter,
      cursor,
      limit: TABLE_PAGE_SIZE
    } as const;
  }

  async function loadExpenses(): Promise<void> {
    expensesState = beginReload<PageResult<DistributionContractExpense>>(expensesState);

    if (expenseContractFilterId === "") {
      expensesState = createSuccessState<PageResult<DistributionContractExpense>>(emptyPageResult<DistributionContractExpense>());
      setTablePaginationError("expenses", null);
      return;
    }

    try {
      expensesState = createSuccessState<PageResult<DistributionContractExpense>>(
        await distributionApi.listContractExpenses({
          workspaceId: distributionWorkspaceId,
          contractId: expenseContractFilterId,
          status: null,
          cursor: null,
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("expenses", null);
    } catch (error: unknown) {
      expensesState = createErrorState<PageResult<DistributionContractExpense>>(error);
    }
  }

  async function loadAllocationRuns(): Promise<void> {
    allocationsState = beginReload<PageResult<AllocationRunSummary>>(allocationsState);

    try {
      allocationsState = createSuccessState<PageResult<AllocationRunSummary>>(
        await distributionApi.listAllocationRuns({
          workspaceId: distributionWorkspaceId,
          period: null,
          status: null,
          cursor: null,
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("allocations", null);
    } catch (error: unknown) {
      allocationsState = createErrorState<PageResult<AllocationRunSummary>>(error);
    }
  }

  function openAllocationDetail(runId: string): void {
    allocationDetailRunId = runId;
    void loadAllocationDetail(runId);
  }

  async function loadAllocationDetail(runId: string): Promise<void> {
    allocationDetailState = beginReload<PageResult<DistributionAllocationRow>>(allocationDetailState);
    allocationCurrencyTotalsState = beginReload<PageResult<DistributionAllocationTotal>>(allocationCurrencyTotalsState);
    const query = { workspaceId: distributionWorkspaceId, runId, payeeId: null, status: null, cursor: null, limit: TABLE_PAGE_SIZE };
    const [lines, totals] = await Promise.allSettled([distributionApi.listAllocations(query), distributionApi.listAllocationsByCurrency(query)]);
    allocationDetailState = lines.status === "fulfilled" ? createSuccessState<PageResult<DistributionAllocationRow>>(lines.value) : createErrorState<PageResult<DistributionAllocationRow>>(lines.reason);
    allocationCurrencyTotalsState = totals.status === "fulfilled" ? createSuccessState<PageResult<DistributionAllocationTotal>>(totals.value) : createErrorState<PageResult<DistributionAllocationTotal>>(totals.reason);
  }

  function closeAllocationDetail(): void {
    allocationDetailRunId = null;
    allocationDetailState = createIdleState<PageResult<DistributionAllocationRow>>();
    allocationCurrencyTotalsState = createIdleState<PageResult<DistributionAllocationTotal>>();
  }

  function allocationWorkbenchQuery(batchCursor: string | null, bankCursor: string | null) {
    return {
      workspaceId: distributionWorkspaceId,
      search: allocationSearch.trim() === "" ? null : allocationSearch.trim(),
      dateFrom: activeRange.from,
      dateTo: activeRange.to,
      batchCursor,
      bankCursor,
      limit: TABLE_PAGE_SIZE
    } as const;
  }

  async function loadAllocationWorkbench(): Promise<void> {
    if (allocationWorkbenchState.status === "loading") return;
    allocationWorkbenchState = beginReload<DistributionAllocationWorkbenchResponse>(allocationWorkbenchState);
    try {
      allocationWorkbenchState = createSuccessState<DistributionAllocationWorkbenchResponse>(
        await distributionApi.getAllocationWorkbench(allocationWorkbenchQuery(null, null))
      );
      setTablePaginationError("allocationBatches", null);
      setTablePaginationError("allocationBank", null);
    } catch (error: unknown) {
      allocationWorkbenchState = createErrorState<DistributionAllocationWorkbenchResponse>(error);
    }
  }

  async function loadMoreAllocationBatches(): Promise<void> { await loadAllocationWorkbenchPage("batches", "one"); }
  async function loadAllAllocationBatches(): Promise<void> { await loadAllocationWorkbenchPage("batches", "all"); }
  async function loadMoreAllocationBank(): Promise<void> { await loadAllocationWorkbenchPage("bank", "one"); }
  async function loadAllAllocationBank(): Promise<void> { await loadAllocationWorkbenchPage("bank", "all"); }

  async function loadAllocationWorkbenchPage(kind: "batches" | "bank", mode: PageLoadMode): Promise<void> {
    if (allocationWorkbenchState.status !== "success" || tablePaginationLoading !== null) return;
    const tableId: DistributionPagedTableId = kind === "batches" ? "allocationBatches" : "allocationBank";
    let current = allocationWorkbenchState.data;
    let cursor = kind === "batches" ? current.batches.nextCursor : current.unallocatedBank.nextCursor;
    if (cursor === null) return;
    tablePaginationLoading = tableId;
    setTablePaginationError(tableId, null);
    try {
      while (cursor !== null) {
        const next = await distributionApi.getAllocationWorkbench(
          allocationWorkbenchQuery(kind === "batches" ? cursor : null, kind === "bank" ? cursor : null)
        );
        current = kind === "batches"
          ? { ...next, batches: appendPageResult(current.batches, next.batches), unallocatedBank: current.unallocatedBank }
          : { ...next, batches: current.batches, unallocatedBank: appendPageResult(current.unallocatedBank, next.unallocatedBank) };
        allocationWorkbenchState = createSuccessState<DistributionAllocationWorkbenchResponse>(current);
        cursor = kind === "batches" ? current.batches.nextCursor : current.unallocatedBank.nextCursor;
        if (mode === "one") break;
      }
    } catch (error: unknown) {
      setTablePaginationError(tableId, getErrorMessage(error));
    } finally {
      tablePaginationLoading = null;
    }
  }

  async function loadSuspense(): Promise<void> {
    suspenseState = beginReload<DistributionSuspenseWorkbenchResponse>(suspenseState);

    try {
      suspenseState = createSuccessState<DistributionSuspenseWorkbenchResponse>(
        await distributionApi.getSuspenseWorkbench(suspenseWorkbenchQuery(null))
      );
      setTablePaginationError("suspense", null);
    } catch (error: unknown) {
      suspenseState = createErrorState<DistributionSuspenseWorkbenchResponse>(error);
    }
  }

  function suspenseWorkbenchQuery(cursor: string | null) {
    return {
      workspaceId: distributionWorkspaceId,
      search: suspenseSearch.trim() === "" ? null : suspenseSearch.trim(),
      batchReference: suspenseBatchReference.trim() === "" ? null : suspenseBatchReference.trim(),
      reasonCode: suspenseReasonFilter === allValue ? null : suspenseReasonFilter,
      status: toNullableSuspenseStatus(suspenseStatusFilter),
      dateFrom: activeRange.from,
      dateTo: activeRange.to,
      cursor,
      limit: TABLE_PAGE_SIZE
    };
  }

  async function loadStatements(): Promise<void> {
    statementsState = beginReload<PageResult<StatementSummary>>(statementsState);

    try {
      statementsState = createSuccessState<PageResult<StatementSummary>>(
        await distributionApi.listStatements({
          workspaceId: distributionWorkspaceId,
          period: distributionPeriod,
          payeeId: toNullablePayeeFilter(statementPayeeFilter),
          status: null,
          cursor: null,
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("statements", null);
    } catch (error: unknown) {
      statementsState = createErrorState<PageResult<StatementSummary>>(error);
    }
  }

  async function loadPayments(): Promise<void> {
    paymentsState = beginReload<PageResult<PaymentSummary>>(paymentsState);

    try {
      paymentsState = createSuccessState<PageResult<PaymentSummary>>(
        await distributionApi.listPayments({
          workspaceId: distributionWorkspaceId,
          period: distributionPeriod,
          payeeId: null,
          status: toNullablePaymentStatus(paymentStatusFilter),
          dateFrom: activeRange.from,
          dateTo: activeRange.to,
          cursor: null,
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("payments", null);
    } catch (error: unknown) {
      paymentsState = createErrorState<PageResult<PaymentSummary>>(error);
    }
  }

  async function loadRevenue(): Promise<void> {
    revenueState = beginReload<PageResult<DistributionRevenueRow>>(revenueState);

    try {
      revenueState = createSuccessState<PageResult<DistributionRevenueRow>>(
        await distributionApi.getRevenue({
          workspaceId: distributionWorkspaceId,
          period: distributionPeriod,
          payeeId: toNullablePayeeFilter(revenuePayeeFilter),
          store: toNullableStoreFilter(revenueStoreFilter),
          currency: toNullableCurrency(revenueCurrencyFilter),
          groupBy: revenueGroupBy,
          dateFrom: activeRange.from,
          dateTo: activeRange.to,
          cursor: null,
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("revenue", null);
    } catch (error: unknown) {
      revenueState = createErrorState<PageResult<DistributionRevenueRow>>(error);
    }
  }

  async function loadReconciliation(): Promise<void> {
    reconciliationState = beginReload<DistributionReconciliationResponse>(reconciliationState);

    try {
      reconciliationState = createSuccessState<DistributionReconciliationResponse>(
        await distributionApi.getFinancialReconciliation({
          workspaceId: distributionWorkspaceId
        })
      );
    } catch (error: unknown) {
      reconciliationState = createErrorState<DistributionReconciliationResponse>(error);
    }
  }

  async function loadAliases(): Promise<void> {
    aliasesState = beginReload<PageResult<DistributionAlias>>(aliasesState);

    try {
      aliasesState = createSuccessState<PageResult<DistributionAlias>>(
        await distributionApi.listAliases({
          workspaceId: distributionWorkspaceId,
          cursor: null,
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("aliases", null);
    } catch (error: unknown) {
      aliasesState = createErrorState<PageResult<DistributionAlias>>(error);
    }
  }

  async function loadDuplicates(): Promise<void> {
    duplicatesState = beginReload<PageResult<DistributionDuplicate>>(duplicatesState);

    try {
      duplicatesState = createSuccessState<PageResult<DistributionDuplicate>>(
        await distributionApi.listDuplicates({
          workspaceId: distributionWorkspaceId,
          cursor: null,
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("duplicates", null);
    } catch (error: unknown) {
      duplicatesState = createErrorState<PageResult<DistributionDuplicate>>(error);
    }
  }

  async function loadAuditLog(): Promise<void> {
    auditLogState = beginReload<PageResult<AuditLogEntry>>(auditLogState);

    try {
      auditLogState = createSuccessState<PageResult<AuditLogEntry>>(
        await distributionApi.listAuditLog({
          workspaceId: distributionWorkspaceId,
          from: auditFromNormalized,
          to: auditToNormalized,
          actorId: auditActorInput.trim() === "" ? null : auditActorInput.trim(),
          entityType: auditEntityInput.trim() === "" ? null : auditEntityInput.trim(),
          cursor: null,
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("auditLog", null);
    } catch (error: unknown) {
      auditLogState = createErrorState<PageResult<AuditLogEntry>>(error);
    }
  }

  async function loadSettings(): Promise<void> {
    settingsState = beginReload<DistributionSettingsResponse>(settingsState);

    try {
      settingsState = createSuccessState<DistributionSettingsResponse>(
        await distributionApi.getSettings({
          workspaceId: distributionWorkspaceId
        })
      );
    } catch (error: unknown) {
      settingsState = createErrorState<DistributionSettingsResponse>(error);
    }
  }

  async function loadFxRates(): Promise<void> {
    fxRatesState = beginReload<PageResult<DistributionFxRate>>(fxRatesState);

    try {
      fxRatesState = createSuccessState<PageResult<DistributionFxRate>>(
        await distributionApi.listFxRates({
          workspaceId: distributionWorkspaceId,
          fromCurrency: null,
          toCurrency: null,
          effectiveDate: null,
          cursor: null,
          limit: TABLE_PAGE_SIZE
        })
      );
    } catch (error: unknown) {
      fxRatesState = createErrorState<PageResult<DistributionFxRate>>(error);
    }
  }

  async function reloadSettingsPage(): Promise<void> {
    await Promise.all([loadWriteGate(), loadSettings(), loadFxRates()]);
  }

  async function refreshRuntimeControls(): Promise<void> {
    await reloadSettingsPage();
  }

  function resetFxRateSaveMessage(): void {
    if (fxRateSaveStatus === "loading") {
      return;
    }

    fxRateSaveStatus = "idle";
    fxRateSaveMessage = null;
  }

  function updateFxFromCurrencyInput(value: string): void {
    fxFromCurrencyInput = value;
    resetFxRateSaveMessage();
  }

  function updateFxToCurrencyInput(value: string): void {
    fxToCurrencyInput = value;
    resetFxRateSaveMessage();
  }

  function updateFxEffectiveDateInput(value: string): void {
    fxEffectiveDateInput = value;
    resetFxRateSaveMessage();
  }

  function updateFxRateInput(value: string): void {
    fxRateInput = value;
    resetFxRateSaveMessage();
  }

  async function saveFxRate(): Promise<void> {
    if (fxRateSaveStatus === "loading") {
      return;
    }

    if (!writesEnabled) {
      fxRateSaveStatus = "error";
      fxRateSaveMessage = "Enable write access to save an FX rate.";
      return;
    }

    const fromCurrency = fxFromCurrencyNormalized;
    const toCurrency = fxToCurrencyNormalized;
    const effectiveDate = fxEffectiveDateNormalized;
    const rate = fxRateNormalized;

    if (fromCurrency === null || toCurrency === null || effectiveDate === null || rate === null) {
      fxRateSaveStatus = "error";
      fxRateSaveMessage = "Check the FX fields (ISO codes, YYYY-MM-DD date, rate > 0).";
      return;
    }

    fxRateSaveStatus = "loading";
    fxRateSaveMessage = null;

    try {
      await distributionApi.saveFxRates(
        {
          workspaceId: distributionWorkspaceId,
          rates: [
            {
              fromCurrency,
              toCurrency,
              effectiveDate,
              rate
            }
          ]
        },
        {
          idempotencyKey: createIdempotencyKey("settings-fx-rate")
        }
      );
      fxRateSaveStatus = "success";
      fxRateSaveMessage = "FX rate saved.";
      fxRateInput = "";
      await Promise.all([loadSettings(), loadFxRates(), loadAuditLog()]);
    } catch (error: unknown) {
      fxRateSaveStatus = "error";
      fxRateSaveMessage = getErrorMessage(error);
    }
  }

  function selectPage(pageId: DistributionPageId): void {
    activePageId = pageId;
    clearActionReceipts();
    pushPagePath(pageId);
  }

  function syncPageFromLocation(): void {
    activePageId = readPageIdFromPath(window.location.pathname);
  }

  function pushPagePath(pageId: DistributionPageId): void {
    const nextPath = pagePath(pageId);
    const currentPath = window.location.pathname;

    if (currentPath === nextPath) {
      return;
    }

    window.history.pushState(null, "", `${nextPath}${window.location.search}`);
  }

  function readPageIdFromPath(pathname: string): DistributionPageId {
    const normalizedPath = normalizeRoutePath(pathname);

    if (normalizedPath.endsWith("/console/distribution/contracts/duplicates")) {
      return "duplicates";
    }

    if (normalizedPath.endsWith("/console/contracts/duplicates")) {
      return "duplicates";
    }

    if (normalizedPath.endsWith("/console/distribution/contracts")) {
      return "contracts";
    }

    if (normalizedPath.endsWith("/console/contracts")) {
      return "contracts";
    }

    if (normalizedPath.endsWith("/console/import")) {
      return "imports";
    }

    if (normalizedPath.endsWith("/console/imports")) {
      return "imports";
    }

    if (normalizedPath.endsWith("/console/mapping")) {
      return "mapping";
    }

    if (normalizedPath.endsWith("/console/catalog")) {
      return "catalog";
    }

    if (normalizedPath.endsWith("/console/allocations")) {
      return "allocations";
    }

    if (normalizedPath.endsWith("/console/action-needed")) {
      return "suspense";
    }

    if (normalizedPath.endsWith("/console/suspense")) {
      return "suspense";
    }

    if (normalizedPath.endsWith("/console/statements")) {
      return "statements";
    }

    if (normalizedPath.endsWith("/console/payments")) {
      return "payments";
    }

    if (normalizedPath.endsWith("/console/revenue")) {
      return "revenue";
    }

    if (normalizedPath.endsWith("/console/aliases")) {
      return "aliases";
    }

    if (normalizedPath.endsWith("/console/duplicates")) {
      return "duplicates";
    }

    if (normalizedPath.endsWith("/console/audit-log")) {
      return "audit-log";
    }

    if (normalizedPath.endsWith("/console/distribution/import")) {
      return "imports";
    }

    if (normalizedPath.endsWith("/console/distribution/audit")) {
      return "audit-log";
    }

    if (normalizedPath.endsWith("/console/distribution/imports")) {
      return "imports";
    }

    if (normalizedPath.endsWith("/console/distribution/mapping")) {
      return "mapping";
    }

    if (normalizedPath.endsWith("/console/distribution/catalog")) {
      return "catalog";
    }

    if (normalizedPath.endsWith("/console/distribution/allocations")) {
      return "allocations";
    }

    if (normalizedPath.endsWith("/console/distribution/action-needed")) {
      return "suspense";
    }

    if (normalizedPath.endsWith("/console/distribution/suspense")) {
      return "suspense";
    }

    if (normalizedPath.endsWith("/console/distribution/statements")) {
      return "statements";
    }

    if (normalizedPath.endsWith("/console/distribution/payments")) {
      return "payments";
    }

    if (normalizedPath.endsWith("/console/distribution/revenue")) {
      return "revenue";
    }

    if (normalizedPath.endsWith("/console/distribution/financial-reconciliation")) {
      return "financial-reconciliation";
    }

    if (normalizedPath.endsWith("/console/distribution/aliases")) {
      return "aliases";
    }

    if (normalizedPath.endsWith("/console/distribution/duplicates")) {
      return "duplicates";
    }

    if (normalizedPath.endsWith("/console/distribution/audit-log")) {
      return "audit-log";
    }

    if (normalizedPath.endsWith("/console/distribution/settings")) {
      return "settings";
    }

    if (normalizedPath.endsWith("/console/financial-reconciliation")) {
      return "financial-reconciliation";
    }

    if (normalizedPath.endsWith("/console/settings")) {
      return "settings";
    }

    return "dashboard";
  }

  function pagePath(pageId: DistributionPageId): string {
    if (pageId === "imports") {
      return "/console/distribution/imports";
    }

    if (pageId === "mapping") {
      return "/console/distribution/mapping";
    }

    if (pageId === "catalog") {
      return "/console/distribution/catalog";
    }

    if (pageId === "contracts") {
      return "/console/distribution/contracts";
    }

    if (pageId === "allocations") {
      return "/console/distribution/allocations";
    }

    if (pageId === "suspense") {
      return "/console/distribution/suspense";
    }

    if (pageId === "statements") {
      return "/console/distribution/statements";
    }

    if (pageId === "payments") {
      return "/console/distribution/payments";
    }

    if (pageId === "revenue") {
      return "/console/distribution/revenue";
    }

    if (pageId === "financial-reconciliation") {
      return "/console/distribution/financial-reconciliation";
    }

    if (pageId === "aliases") {
      return "/console/distribution/aliases";
    }

    if (pageId === "duplicates") {
      return "/console/distribution/duplicates";
    }

    if (pageId === "audit-log") {
      return "/console/distribution/audit-log";
    }

    if (pageId === "settings") {
      return "/console/distribution/settings";
    }

    return "/console/distribution/dashboard";
  }

  function clearActionReceipts(): void {
    clearMutationReceipt();
    clearRunReceipt();
  }

  function clearMutationReceipt(): void {
    mutationReceipt = null;
    mutationReceiptPageId = null;
    actionError = null;
    actionErrorPageId = null;
    actionNotice = null;
    actionNoticePageId = null;
  }

  function clearRunReceipt(): void {
    runReceipt = null;
    runReceiptIsPreview = false;
    runReceiptPageId = null;
    actionError = null;
    actionErrorPageId = null;
    actionNotice = null;
    actionNoticePageId = null;
  }

  // Routes a write failure to the dedicated action banner: the loaded list
  // states stay intact so the tables keep rendering the last known data.
  function reportActionError(error: unknown): void {
    actionError = getErrorMessage(error);
    actionErrorPageId = activePageId;
  }

  // Feedback must be visible from drawers and scrolled positions alike.
  $effect(() => {
    const visible = (mutationReceipt !== null && mutationReceiptPageId === activePageId)
      || (runReceipt !== null && runReceiptPageId === activePageId)
      || (actionNotice !== null && actionNoticePageId === activePageId)
      || (actionError !== null && actionErrorPageId === activePageId);
    if (visible) {
      actionBannerElement?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  function updateImportFilter(value: string): void {
    importSourceFilter = value as ImportSourceFilter;
  }

  function updateImportStatusFilter(value: string): void {
    importStatusFilter = value as ImportBatchStatusFilter;
  }

  function updateAllocationSearch(value: string): void {
    allocationSearch = value;
  }

  function updateImportSource(value: string): void {
    const source = distributionImportSourceFromValue(value);

    importState = {
      ...importState,
      source,
      preview: null,
      confirm: null,
      message: "Source changed. Run the preview again."
    };
  }

  async function handleImportFile(event: Event): Promise<void> {
    const input = event.currentTarget;

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected file input event target.");
    }

    const file = input.files?.item(0) ?? null;

    if (file === null) {
      return;
    }

    try {
      const isExcel = /\.xlsx?$/iu.test(file.name);
      let rows: readonly Readonly<Record<string, string>>[];
      let checksum: string;
      let source: ImportSource;
      if (isExcel) {
        const content = await file.arrayBuffer();
        rows = await parseRouteNoteWorkbook(content);
        checksum = importContentChecksum(content);
        source = "routenote";
      } else {
        const content = await file.text();
        source = detectImportSource(content, importState.source);
        rows = source === "kontor"
          ? parseKontorRecords(content)
          : file.name.toLowerCase().endsWith(".tsv")
            ? parseTsvRecords(content)
            : parseCsvRecords(content);
        checksum = importContentChecksum(content);
      }

      if (rows.length === 0) {
        importState = {
          ...importState,
          status: "error",
          fileName: file.name,
          rows: [],
          checksum: "",
          preview: null,
          confirm: null,
          message: "No usable rows found in this file. A header followed by data rows is required."
        };
        return;
      }

      importState = {
        ...importState,
        source,
        status: "idle",
        fileName: file.name,
        rows,
        checksum,
        preview: null,
        confirm: null,
        message: `${String(rows.length)} ${source === "kontor" ? "Kontor" : "RouteNote"} rows read and ready for preview.`
      };
    } catch (error: unknown) {
      importState = {
        ...importState,
        status: "error",
        fileName: file.name,
        rows: [],
        checksum: "",
        preview: null,
        confirm: null,
        message: getErrorMessage(error)
      };
    }
  }

  function selectImportToolbarFilter(filter: ToolbarFilter): void {
    if (filter.actionId === "source") {
      cycleImportSource();
      return;
    }

    if (filter.actionId === "file") {
      clearImportFile();
      return;
    }

    if (filter.actionId === "status") {
      void previewImport();
      return;
    }

    throw new Error(`Unknown Distribution import toolbar action: ${filter.label}.`);
  }

  function cycleImportSource(): void {
    const currentIndex = importSourceOptions.findIndex((option: SelectOption): boolean => option.value === importState.source);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % importSourceOptions.length;
    const nextOption = importSourceOptions[nextIndex];

    if (nextOption === undefined) {
      throw new Error("Distribution import source options are empty.");
    }

    const source = distributionImportSourceFromValue(nextOption.value);
    importState = {
      ...importState,
      source,
      preview: null,
      confirm: null,
      message: "Source changed. Run the preview again."
    };
  }

  function clearImportFile(): void {
    importState = {
      ...importState,
      status: "idle",
      fileName: "",
      rows: [],
      checksum: "",
      preview: null,
      confirm: null,
      message: "Select a Kontor CSV/TSV or RouteNote Excel export to start the preview."
    };
  }

  function openImportFilePicker(): void {
    importFileInput?.click();
  }

  function openImportPanel(): void {
    importPanelOpen = true;
  }

  function closeImportPanel(): void {
    importPanelOpen = false;
  }

  function openImportResetPanel(): void {
    importResetConfirmation = "";
    importResetPanelOpen = true;
  }

  function closeImportResetPanel(): void {
    importResetPanelOpen = false;
    importResetConfirmation = "";
  }

  async function resetDistributionImports(): Promise<void> {
    if (importResetConfirmation !== "DELETE ALL DISTRIBUTION DATA") return;
    try {
      mutationReceipt = await distributionApi.resetFinancialData(
        { workspaceId: distributionWorkspaceId, confirmationPhrase: "DELETE ALL DISTRIBUTION DATA" },
        { idempotencyKey: createIdempotencyKey("distribution-financial-reset") }
      );
      mutationReceiptPageId = activePageId;
      closeImportResetPanel();
      clearImportFile();
      await Promise.all([loadImportBatches(), loadMappingRows(), loadAllocationWorkbench(), loadAllocationRuns(), loadSuspense(), loadStatements(), loadPayments(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function openImportAssistant(): Promise<void> {
    if (importState.preview === null) {
      await previewImport();
    }

    if (importState.preview === null) {
      return;
    }

    mappingBatchFilter = allValue;
    selectPage("mapping");
    await loadMappingRows();
  }

  function openImportBatch(batchId: string): void {
    if (!canOpenImportBatch(batchId)) {
      return;
    }

    mappingBatchFilter = batchId;
    selectPage("mapping");
    void loadMappingRows();
  }

  async function reverseImportBatch(batchId: string): Promise<void> {
    if (!writesEnabled) {
      reportActionError(new Error(writeGateMessage));
      return;
    }

    const batch = importBatches.find((candidate: DistributionImportBatch): boolean => candidate.id === batchId);
    if (batch === undefined) {
      reportActionError(new Error("Batch not found in the loaded list."));
      return;
    }

    if (!isDistributionImportBatchReversible(batch.status)) {
      reportActionError(new Error("This batch is already voided."));
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await distributionApi.reverseImportBatch(
        batch.id,
        { workspaceId: distributionWorkspaceId },
        { idempotencyKey: createIdempotencyKey("import-reverse") }
      );
      mutationReceiptPageId = activePageId;
      if (mappingBatchFilter === batch.id) {
        mappingBatchFilter = allValue;
      }
      await Promise.all([loadImportBatches(), loadMappingRows(), loadDashboard(), loadSuspense(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function generateTracksFromImportBatch(batchId: string): Promise<void> {
    if (!writesEnabled) {
      reportActionError(new Error(writeGateMessage));
      return;
    }

    if (!canGenerateTracksFromImportBatch(batchId)) {
      reportActionError(new Error(generateTracksFromImportBatchDisabledReason(batchId) ?? "This batch cannot generate tracks."));
      return;
    }

    const batch = importBatchById(batchId);
    if (batch === null) {
      reportActionError(new Error("Batch not found in the loaded list."));
      return;
    }

    clearMutationReceipt();
    try {
      const receipt = await distributionApi.generateTracksFromImportBatch(
        batchId,
        { workspaceId: distributionWorkspaceId },
        { idempotencyKey: createIdempotencyKey("import-generate-tracks") }
      );
      await distributionApi.startCadencedAllocationRun(
        {
          workspaceId: distributionWorkspaceId,
          period: batch.period,
          lockKey: `distribution:allocation:batch:${batch.id}`,
          cadence: "manual",
          batchId: batch.id
        },
        { idempotencyKey: createIdempotencyKey(`allocation-run-${batch.id}`) }
      );
      mutationReceipt = receipt;
      mutationReceiptPageId = activePageId;
      actionNotice = `Processed ${receipt.mappedEarningCount} earnings and completed allocation. Created ${receipt.createdTrackCount} draft tracks, reused ${receipt.existingTrackCount}, and left ${receipt.skippedEarningCount} rows for review.`;
      actionNoticePageId = activePageId;
      await Promise.all([loadImportBatches(), loadMappingRows(), loadCatalog(), loadDashboard(), loadAllocationWorkbench(), loadAllocationRuns(), loadSuspense(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function canCancelImportBatch(batchId: string): boolean {
    return canCancelDistributionImportBatch(importBatchById(batchId));
  }

  function canOpenImportBatch(batchId: string): boolean {
    return canOpenDistributionImportBatch(importBatchById(batchId));
  }

  function canGenerateTracksFromImportBatch(batchId: string): boolean {
    const batch = importBatchById(batchId);
    return batch !== null && (batch.status === "mapped" || batch.status === "validated");
  }

  function generateTracksFromImportBatchDisabledReason(batchId: string): string | null {
    const batch = importBatchById(batchId);
    if (batch === null) return "Batch not loaded.";
    if (batch.status === "voided") return "Voided batches cannot generate tracks.";
    if (batch.status === "failed") return "Failed batches cannot generate tracks.";
    if (batch.status === "uploaded") return "Confirm the import before generating tracks.";
    return null;
  }

  function importBatchReadOnlyReason(batchId: string): string | null {
    return distributionImportBatchReadOnlyReason(importBatchById(batchId));
  }

  function importBatchById(batchId: string): DistributionImportBatch | null {
    const batch = importBatches.find((candidate: DistributionImportBatch): boolean => candidate.id === batchId);

    if (batch === undefined) {
      return null;
    }

    return batch;
  }

  function toggleMappingRowSelection(rowId: string): void {
    if (selectedMappingRowIds.includes(rowId)) {
      selectedMappingRowIds = selectedMappingRowIds.filter((candidate: string): boolean => candidate !== rowId);
      return;
    }

    selectedMappingRowIds = [...selectedMappingRowIds, rowId];
  }

  function selectAllVisibleMappingRows(): void {
    selectedMappingRowIds = filteredMappingRows.map((row: DistributionMappingRow): string => row.id);
  }

  function clearMappingSelection(): void {
    selectedMappingRowIds = [];
  }

  function updateMappingStatus(value: string): void {
    mappingStatusFilter = value as MappingStatusFilter;
  }

  function updateMappingBatchFilter(value: string): void {
    mappingBatchFilter = value;
  }

  function updateMappingSearch(value: string): void {
    mappingSearch = value;
  }

  function filterMappingRows(rows: readonly DistributionMappingRow[], query: string): readonly DistributionMappingRow[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    if (normalizedQuery === "") {
      return rows;
    }

    return rows.filter((row: DistributionMappingRow): boolean =>
      [row.sourceTitle, row.sourceArtist, row.sourceLabel, row.sourceStore, row.sourceIsrc ?? "", row.sourceUpc ?? "", row.suggestedTrackTitle ?? ""]
        .some((value: string): boolean => value.toLocaleLowerCase().includes(normalizedQuery))
    );
  }

  function updateCatalogStatus(value: string): void {
    catalogStatusFilter = value as CatalogStatusFilter;
  }

  function updateCatalogSearch(value: string): void { catalogSearch = value; }
  function updateCatalogArtistSource(value: string): void { catalogArtistSource = value as DistributionCatalogArtistSource; }
  function updateCatalogIsrc(value: string): void { catalogIsrc = value; }
  function updateCatalogRole(value: string): void { catalogRoleFilter = value; }
  function updateCatalogReview(value: string): void { catalogReviewFilter = value as CatalogReviewFilter; }
  function updateCatalogLabel(value: string): void { catalogLabelFilter = value; }
  function updateCatalogReleaseFrom(event: Event): void { catalogReleaseFrom = readInputValue(event); }
  function updateCatalogReleaseTo(event: Event): void { catalogReleaseTo = readInputValue(event); }

  async function clearCatalogFilters(): Promise<void> {
    catalogSearch = "";
    catalogArtistSource = "catalog_import";
    catalogIsrc = "";
    catalogRoleFilter = allValue;
    catalogReviewFilter = allValue;
    catalogLabelFilter = allValue;
    catalogReleaseFrom = "";
    catalogReleaseTo = "";
    catalogStatusFilter = allValue;
    await loadCatalog();
  }

  function updateContractSearch(value: string): void { contractSearch = value; }
  function updateContractStatus(value: string): void { contractStatusFilter = value as ContractStatusFilter; }

  async function applyContractWorkflow(value: ContractWorkflowFilter): Promise<void> {
    contractWorkflowFilter = value;
    selectedContractRowIds = [];
    await loadContractWorkbench();
  }

  async function clearContractFilters(): Promise<void> {
    contractSearch = "";
    contractStatusFilter = allValue;
    contractWorkflowFilter = allValue;
    selectedContractRowIds = [];
    await loadContractWorkbench();
  }

  function updateSuspenseStatus(value: string): void {
    suspenseStatusFilter = value as SuspenseStatusFilter;
  }

  function updateSuspenseSearch(value: string): void { suspenseSearch = value; }
  function updateSuspenseBatchReference(value: string): void { suspenseBatchReference = value; }
  function updateSuspenseReason(value: string): void { suspenseReasonFilter = value; }
  function updateSuspenseResolutionNote(value: string): void { suspenseResolutionNote = value; }

  async function clearSuspenseFilters(): Promise<void> {
    suspenseSearch = "";
    suspenseBatchReference = "";
    suspenseReasonFilter = allValue;
    suspenseStatusFilter = "open";
    await loadSuspense();
  }

  function updatePaymentStatus(value: string): void {
    paymentStatusFilter = value as PaymentStatusFilter;
  }

  function updateStatementPayee(value: string): void {
    statementPayeeFilter = value;
  }

  function updateStatementCurrency(value: string): void {
    statementCurrencyFilter = value === allValue ? allValue : normalizeCurrencyCode(value) ?? allValue;
  }

  function updateRevenuePayee(value: string): void {
    revenuePayeeFilter = value;
  }

  function updateRevenueStore(value: string): void {
    revenueStoreFilter = value;
  }

  function updateRevenueGroup(value: string): void {
    revenueGroupBy = value as RevenueGroupBy;
  }

  function updateRevenueCurrency(value: string): void {
    revenueCurrencyFilter = value === allValue ? allValue : normalizeCurrencyCode(value) ?? allValue;
  }

  function updateRecordStatement(value: string): void {
    recordStatementId = value;
    const statement = openStatements.find((candidate) => candidate.id === value);
    if (statement !== undefined) {
      recordPaymentPayeeId = statement.payeeId;
      // Never overwrite an operator-typed amount; prefill only untouched or empty fields.
      if (!recordPaymentAmountEdited || recordPaymentAmount === "") {
        recordPaymentAmount = statement.netPayableMicro;
        recordPaymentAmountEdited = false;
      }
      recordPaymentCurrency = statement.currency;
    }
  }

  function updateRecordPaymentReference(value: string): void {
    recordPaymentReference = value;
  }

  function updateRecordPaymentPayee(value: string): void { recordPaymentPayeeId = value; }
  function updateRecordPaymentAmount(value: string): void { recordPaymentAmount = value; recordPaymentAmountEdited = true; }
  function updateRecordPaymentCurrency(value: string): void { recordPaymentCurrency = value.toUpperCase(); }
  function updateRecordPaymentExchangeRate(value: string): void { recordPaymentExchangeRate = value; }
  function updateRecordPaymentMethod(value: string): void { recordPaymentMethod = value as DistributionPaymentMethod; }
  function updateRecordPaymentStatus(value: string): void { recordPaymentStatus = value as "draft" | "paid"; }
  function updateRecordPaymentPaidDate(event: Event): void { recordPaymentPaidDate = readInputValue(event); }
  function updateRecordPaymentNotes(value: string): void { recordPaymentNotes = value; }

  function updatePaymentReferenceInput(value: string): void {
    paymentReferenceInput = value;
  }
  function updatePaymentNotesInput(value: string): void { paymentNotesInput = value; }
  function updatePaymentMethodInput(value: string): void { paymentMethodInput = value as DistributionPaymentMethod; }
  function updatePaymentStatusInput(value: string): void { paymentStatusInput = value as "draft" | "paid"; }
  function updatePaymentPaidDateInput(event: Event): void { paymentPaidDateInput = readInputValue(event); }
  function updatePaymentExchangeRateInput(value: string): void { paymentExchangeRateInput = value; }
  function updatePaymentReconcileStatement(value: string): void {
    paymentReconcileStatementId = value;
    const statement = openStatements.find((candidate) => candidate.id === value);
    if (statement !== undefined) {
      // Never overwrite an operator-typed amount; prefill only untouched or empty fields.
      if (!paymentReconcileAmountEdited || paymentReconcileAmountInput === "") {
        paymentReconcileAmountInput = statement.netPayableMicro;
        paymentReconcileAmountEdited = false;
      }
    }
  }
  function updatePaymentReconcileAmount(value: string): void { paymentReconcileAmountInput = value; paymentReconcileAmountEdited = true; }

  function updateSuspenseTargetTrack(value: string): void {
    suspenseTargetTrackId = value;
  }

  function updateUnpostReason(value: string): void {
    unpostReasonInput = value;
  }

  function updateReleaseTitle(value: string): void {
    releaseTitleInput = value;
  }

  function updateReleaseArtist(value: string): void {
    releaseArtistInput = value;
  }

  function updateReleaseLabel(value: string): void {
    releaseLabelInput = value;
  }

  function updateReleaseUpc(value: string): void {
    releaseUpcInput = value;
  }

  function updateReleaseStatus(value: string): void {
    releaseStatusInput = value as CatalogEntryStatus;
  }

  function updateReleaseDate(event: Event): void {
    releaseDateInput = readInputValue(event);
  }

  function updateTrackTitle(value: string): void {
    trackTitleInput = value;
  }

  function updateTrackArtist(value: string): void {
    trackArtistInput = value;
  }

  function updateTrackIsrc(value: string): void {
    trackIsrcInput = value;
  }

  function updateTrackRelease(value: string): void {
    trackReleaseIdInput = value;
  }

  function updateTrackStatus(value: string): void {
    trackStatusInput = value as CatalogEntryStatus;
  }

  function updatePeriodScope(value: string): void {
    periodScope = value as PeriodScope;
    if (periodScope === "custom" && customRange === null) {
      customRange = activeRange;
    }
    void reloadPeriodScopedData();
  }

  function updateCustomFrom(event: Event): void {
    const base = customRange ?? activeRange;
    customRange = { from: readInputValue(event), to: base.to };
    void reloadPeriodScopedData();
  }

  function updateCustomTo(event: Event): void {
    const base = customRange ?? activeRange;
    customRange = { from: base.from, to: readInputValue(event) };
    void reloadPeriodScopedData();
  }

  async function reloadPeriodScopedData(): Promise<void> {
    await Promise.all([
      loadDashboard(),
      loadSuspense(),
      loadPayments(),
      loadRevenue()
    ]);
  }

  async function previewImport(): Promise<void> {
    if (importState.rows.length === 0) {
      importState = {
        ...importState,
        status: "error",
        preview: null,
        confirm: null,
        message: "Select a CSV/TSV export file before previewing."
      };
      return;
    }

    importState = {
      ...importState,
      status: "loading",
      preview: null,
      confirm: null,
      message: "Import preview in progress."
    };

    try {
      const request: DistributionImportPreviewRequest = {
        workspaceId: distributionWorkspaceId,
        source: importState.source,
        fileName: importState.fileName,
        checksum: importState.checksum,
        rows: importState.rows
      };
      const preview = await distributionApi.previewImport(request, {
        idempotencyKey: createIdempotencyKey("import-preview")
      });
      importState = {
        ...importState,
        status: "success",
        preview,
        confirm: null,
        message: "Kontor/RouteNote preview ready."
      };
    } catch (error: unknown) {
      importState = {
        ...importState,
        status: "error",
        preview: null,
        confirm: null,
        message: getErrorMessage(error)
      };
    }
  }

  async function confirmImport(): Promise<void> {
    const preview = importState.preview;
    if (preview === null) {
      return;
    }

    importState = {
      ...importState,
      status: "loading",
      message: "Import confirmation in progress."
    };

    try {
      const acceptedRowIds = preview.rowResults
        .filter((row): boolean => row.status === "accepted")
        .map((row): string => row.id);

      const fallbackAcceptedRowIds = Array.from(
        { length: preview.acceptedRowCount },
        (_: unknown, index: number): string => `row_${String(index + 1)}`
      );

      const confirm = await distributionApi.confirmImport(
        {
          workspaceId: distributionWorkspaceId,
          previewId: preview.previewId,
          acceptedRowIds: acceptedRowIds.length > 0 ? acceptedRowIds : fallbackAcceptedRowIds,
          rejectedRowIds: []
        },
        {
          idempotencyKey: createIdempotencyKey("import-confirm")
        }
      );
      const catalog = await distributionApi.generateTracksFromImportBatch(
        confirm.id,
        { workspaceId: distributionWorkspaceId },
        { idempotencyKey: createIdempotencyKey("import-generate-tracks") }
      );
      const allocation = confirm.period === null
        ? null
        : await distributionApi.startCadencedAllocationRun(
          {
            workspaceId: distributionWorkspaceId,
            period: confirm.period,
            lockKey: `distribution:allocation:batch:${confirm.id}`,
            cadence: "manual",
            batchId: confirm.id
          },
          { idempotencyKey: createIdempotencyKey(`allocation-run-${confirm.id}`) }
        );
      importState = {
        ...importState,
        status: "success",
        confirm,
        message: allocation === null
          ? `Import processed: ${catalog.mappedEarningCount} earnings mapped. Review the source period before allocation.`
          : `Import processed: ${catalog.mappedEarningCount} earnings mapped and allocation completed. ${catalog.skippedEarningCount} rows need review.`
      };
      closeImportPanel();
      await Promise.all([loadImportBatches(), loadMappingRows(), loadCatalog(), loadDashboard(), loadAllocationWorkbench(), loadAllocationRuns(), loadSuspense(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      importState = {
        ...importState,
        status: "error",
        message: getErrorMessage(error)
      };
    }
  }

  async function applyMappingRules(): Promise<void> {
    const targetRows = mappingRowsForRuleApplication;

    if (targetRows.length === 0) {
      actionNotice = "No suggested mapping rows are ready to apply. ISRC-mapped rows are already complete.";
      actionNoticePageId = activePageId;
      return;
    }

    if (!mappingRulesSelectionIsApplicable) {
      reportActionError(new Error("Select only suggested mapping rows with a target track. Rows already mapped by ISRC do not need reusable rules."));
      return;
    }

    const batchIds = [...new Set(targetRows.map((row: DistributionMappingRow): string => row.batchId))];
    const batchId = batchIds[0];

    if (batchId === undefined || batchIds.length !== 1) {
      reportActionError(new Error("Invalid selection: apply rules to one batch at a time."));
      return;
    }

    const rowIds = targetRows.map((row: DistributionMappingRow): string => row.id);

    clearRunReceipt();

    try {
      mutationReceipt = await distributionApi.applyMappingRules(
        {
          workspaceId: distributionWorkspaceId,
          batchId,
          rowIds
        },
        {
          idempotencyKey: createIdempotencyKey("mapping-rules")
        }
      );
      mutationReceiptPageId = activePageId;
      clearMappingSelection();
      await Promise.all([loadMappingRows(), loadSuspense(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function openExpensePanel(): void {
    if (selectedExpenseFilterContract === null || selectedExpenseFilterContract.contractId === null) {
      reportActionError(new Error("Save a complete split set for one track before recording its expense or advance."));
      return;
    }
    expensePanelOpen = true;
    expenseContractIdInput = expenseContractFilterId;
    expensePayeeIdInput = selectedExpenseFilterContract.splits[0]?.payeeId ?? "";
    expenseCurrencyInput = contractRuleCurrencyInput;
    expenseCategoryInput = "advance";
    expenseLabelInput = "";
    expenseAmountInput = "";
    expenseDateInput = today;
    expenseRecoverableInput = "yes";
  }

  function closeExpensePanel(): void {
    expensePanelOpen = false;
  }

  function updateExpenseContract(value: string): void {
    expenseContractIdInput = value;
    const track = contractTracks.find((candidate) => candidate.contractId === value);
    expensePayeeIdInput = track?.splits[0]?.payeeId ?? "";
    expenseCurrencyInput = payees.find((payee) => payee.id === expensePayeeIdInput)?.defaultCurrency ?? "MUR";
  }

  function updateExpensePayee(value: string): void { expensePayeeIdInput = value; }
  function updateExpenseCategory(value: string): void { expenseCategoryInput = value as DistributionContractExpenseCategory; }
  function updateExpenseRecoverable(value: string): void { expenseRecoverableInput = value; }

  function updateExpenseContractFilter(value: string): void {
    expenseContractFilterId = value;
    void loadExpenses();
  }

  function updateExpenseLabel(value: string): void {
    expenseLabelInput = value;
  }

  function updateExpenseAmount(value: string): void {
    expenseAmountInput = value;
  }

  function updateExpenseDate(event: Event): void {
    expenseDateInput = readInputValue(event);
  }
  function updateExpenseCurrency(value: string): void { expenseCurrencyInput = value.toUpperCase(); }

  // Keep money textual across the UI/API boundary at the Distribution scale (10 decimals).
  function parseExpenseAmountMicro(input: string): string | null {
    const match = /^(\d+)(?:[.,](\d{1,10}))?$/u.exec(input.trim());

    if (match === null || match[1] === undefined) {
      return null;
    }

    const micro = BigInt(match[1]) * 10_000_000_000n + BigInt((match[2] ?? "").padEnd(10, "0"));

    if (micro <= 0n) {
      return null;
    }

    return `${String(micro / 10_000_000_000n)}.${String(micro % 10_000_000_000n).padStart(10, "0")}`;
  }

  async function recordExpense(): Promise<void> {
    const contract = selectedExpenseContract;
    const label = expenseLabelInput.trim();
    const amountMicro = expenseAmountMicro;

    const currency = normalizeCurrencyCode(expenseCurrencyInput);
    if (contract === null || contract.contractId === null || label === "" || amountMicro === null || expenseDateInput === "" || currency === null) {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await distributionApi.recordContractExpense(
        {
          workspaceId: distributionWorkspaceId,
          contractId: contract.contractId,
          payeeId: expensePayeeIdInput === "" ? null : expensePayeeIdInput,
          incurredOn: expenseDateInput,
          category: expenseCategoryInput,
          label,
          amountMicro,
          currency,
          recoverable: expenseRecoverableInput === "yes"
        },
        {
          idempotencyKey: createIdempotencyKey("expense-record")
        }
      );
      mutationReceiptPageId = activePageId;
      closeExpensePanel();
      await Promise.all([loadContractWorkbench(), loadExpenses(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function openCatalogPanel(mode: CatalogPanelMode): void {
    catalogPanelMode = mode;
    releaseTitleInput = "";
    releaseArtistInput = "";
    releaseLabelInput = "";
    releaseUpcInput = "";
    releaseStatusInput = "draft";
    releaseDateInput = "";
    trackTitleInput = "";
    trackArtistInput = "";
    trackIsrcInput = "";
    trackReleaseIdInput = "";
    trackStatusInput = "draft";
  }

  function closeCatalogPanel(): void {
    catalogPanelMode = null;
  }

  async function createRelease(): Promise<void> {
    const title = releaseTitleInput.trim();
    const artistName = releaseArtistInput.trim();

    if (title === "" || artistName === "") {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await distributionApi.createRelease(
        {
          workspaceId: distributionWorkspaceId,
          id: null,
          title,
          artistName,
          labelName: releaseLabelInput.trim() === "" ? null : releaseLabelInput.trim(),
          upc: releaseUpcInput.trim() === "" ? null : releaseUpcInput.trim(),
          status: releaseStatusInput,
          releaseDate: releaseDateInput === "" ? null : releaseDateInput
        },
        {
          idempotencyKey: createIdempotencyKey("release-create")
        }
      );
      mutationReceiptPageId = activePageId;
      closeCatalogPanel();
      await Promise.all([loadCatalog(), loadAliases(), loadDuplicates()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function createTrack(): Promise<void> {
    const title = trackTitleInput.trim();
    const artistName = trackArtistInput.trim();

    if (title === "" || artistName === "") {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await distributionApi.createTrack(
        {
          workspaceId: distributionWorkspaceId,
          id: null,
          releaseId: trackReleaseIdInput === "" ? null : trackReleaseIdInput,
          title,
          artistName,
          isrc: trackIsrcInput.trim() === "" ? null : trackIsrcInput.trim(),
          status: trackStatusInput
        },
        {
          idempotencyKey: createIdempotencyKey("track-create")
        }
      );
      mutationReceiptPageId = activePageId;
      closeCatalogPanel();
      await Promise.all([loadCatalog(), loadAliases(), loadDuplicates()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function openPayeePanel(): void {
    payeePanelOpen = true;
    payeeNameInput = "";
    payeeEmailInput = "";
    payeeCurrencyInput = "MUR";
  }

  function closePayeePanel(): void { payeePanelOpen = false; }
  function updatePayeeName(value: string): void { payeeNameInput = value; }
  function updatePayeeEmail(value: string): void { payeeEmailInput = value; }
  function updatePayeeCurrency(value: string): void { payeeCurrencyInput = value.toUpperCase(); }

  async function createPayee(): Promise<void> {
    const displayName = payeeNameInput.trim();
    const defaultCurrency = normalizeCurrencyCode(payeeCurrencyInput);
    if (displayName === "" || defaultCurrency === null) {
      return;
    }
    clearRunReceipt();
    try {
      mutationReceipt = await distributionApi.createPayee(
        {
          workspaceId: distributionWorkspaceId,
          id: null,
          displayName,
          email: payeeEmailInput.trim() || null,
          status: "active",
          defaultCurrency
        },
        { idempotencyKey: createIdempotencyKey("payee-create") }
      );
      mutationReceiptPageId = activePageId;
      closePayeePanel();
      await Promise.all([loadPayees(), loadContractWorkbench(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function openContractPanel(): void {
    contractPickerOpen = true;
    contractPickerTrackId = contractTracks.find((track) => track.status === "no_split")?.trackId ?? contractTracks[0]?.trackId ?? "";
  }

  function closeContractPanel(): void {
    contractPickerOpen = false;
    contractPickerTrackId = "";
  }

  function updateContractPickerTrack(value: string): void { contractPickerTrackId = value; }

  function openPickedContractTrack(): void {
    if (contractPickerTrackId === "") return;
    closeContractPanel();
    openContractEditor(contractPickerTrackId);
  }

  function toggleContractRowSelection(rowId: string): void {
    selectedContractRowIds = selectedContractRowIds.includes(rowId)
      ? selectedContractRowIds.filter((id) => id !== rowId)
      : [...selectedContractRowIds, rowId];
  }

  function selectAllVisibleContractRows(): void {
    selectedContractRowIds = contractTracks.map((track) => track.trackId);
  }

  function clearContractSelection(): void { selectedContractRowIds = []; }

  function openSelectedContractEditor(): void {
    openContractEditorForTracks(selectedContractRowIds);
  }

  function openContractEditor(rowId: string): void {
    openContractEditorForTracks([rowId]);
  }

  function openContractEditorForTracks(trackIds: readonly string[]): void {
    const editorTracks = trackIds
      .map((trackId) => contractTracks.find((track) => track.trackId === trackId))
      .filter((track): track is DistributionContractTrackRow => track !== undefined);
    if (editorTracks.length === 0) return;

    const sourceSplits = editorTracks[0]?.splits ?? [];
    contractEditorTrackIds = editorTracks.map((track) => track.trackId);
    contractSplitDrafts = sourceSplits.length > 0
      ? sourceSplits.map((split) => ({ payeeId: split.payeeId, percentage: normalizeContractPercentage(split.percentage) ?? split.percentage }))
      : [{ payeeId: "", percentage: "100" }];
    contractRuleReasonInput = "";
    contractRuleEffectiveFromInput = today;
    contractRuleEffectiveToInput = "";
    const primaryPayee = payees.find((payee) => payee.id === contractSplitDrafts[0]?.payeeId);
    contractRuleCurrencyInput = primaryPayee?.defaultCurrency ?? "MUR";
    expenseContractFilterId = editorTracks.length === 1 ? editorTracks[0]?.contractId ?? "" : "";
    if (expenseContractFilterId !== "") void loadExpenses();
  }

  function closeContractEditor(): void {
    contractEditorTrackIds = [];
    contractSplitDrafts = [];
    contractRuleReasonInput = "";
  }

  function updateContractSplitPayee(index: number, value: string): void {
    contractSplitDrafts = contractSplitDrafts.map((split, splitIndex) => splitIndex === index ? { ...split, payeeId: value } : split);
  }

  function updateContractSplitPercentage(index: number, value: string): void {
    contractSplitDrafts = contractSplitDrafts.map((split, splitIndex) => splitIndex === index ? { ...split, percentage: value } : split);
  }

  function addContractSplit(): void {
    const used = new Set(contractSplitDrafts.map((split) => split.payeeId));
    const nextPayeeId = payees.find((payee) => !used.has(payee.id))?.id ?? "";
    contractSplitDrafts = [...contractSplitDrafts, { payeeId: nextPayeeId, percentage: "" }];
  }

  function removeContractSplit(index: number): void {
    if (contractSplitDrafts.length <= 1) return;
    contractSplitDrafts = contractSplitDrafts.filter((_, splitIndex) => splitIndex !== index);
  }

  function updateContractRuleReason(value: string): void { contractRuleReasonInput = value; }
  function updateContractRuleCurrency(value: string): void { contractRuleCurrencyInput = value.toUpperCase(); }
  function updateContractRuleEffectiveFrom(event: Event): void { contractRuleEffectiveFromInput = readInputValue(event); }
  function updateContractRuleEffectiveTo(event: Event): void { contractRuleEffectiveToInput = readInputValue(event); }

  function parseContractPercentageUnits(value: string): bigint | null {
    const match = /^(\d{1,3})(?:[.,](\d{1,6}))?$/u.exec(value.trim());
    if (match === null || match[1] === undefined) return null;
    const units = BigInt(match[1]) * 1_000_000n + BigInt((match[2] ?? "").padEnd(6, "0"));
    return units > 0n && units <= 100_000_000n ? units : null;
  }

  function normalizeContractPercentage(value: string): string | null {
    const units = parseContractPercentageUnits(value);
    if (units === null) return null;
    return `${String(units / 1_000_000n)}.${String(units % 1_000_000n).padStart(6, "0")}`;
  }

  function contractSplitTotalPercentage(splits: readonly ContractSplitDraft[]): string {
    let total = 0n;
    for (const split of splits) {
      const value = parseContractPercentageUnits(split.percentage);
      if (value === null) return "Invalid";
      total += value;
    }
    return `${String(total / 1_000_000n)}.${String(total % 1_000_000n).padStart(6, "0")}`;
  }

  function emptyPageResult<TItem>(): PageResult<TItem> {
    return {
      items: [],
      nextCursor: null
    };
  }

  async function saveContractTrackRules(): Promise<void> {
    const currency = normalizeCurrencyCode(contractRuleCurrencyInput);
    if (!contractSplitDraftValid || currency === null) return;
    const rules = contractSplitDrafts.map((split) => ({
      payeeId: split.payeeId,
      percentage: normalizeContractPercentage(split.percentage) ?? split.percentage
    }));
    clearRunReceipt();
    try {
      mutationReceipt = await distributionApi.saveContractTrackRules({
        workspaceId: distributionWorkspaceId,
        trackIds: contractEditorTrackIds,
        rules,
        reason: contractRuleReasonInput.trim(),
        effectiveFrom: contractRuleEffectiveFromInput,
        effectiveTo: contractRuleEffectiveToInput === "" ? null : contractRuleEffectiveToInput,
        currency
      }, { idempotencyKey: createIdempotencyKey("contract-track-rules") });
      mutationReceiptPageId = activePageId;
      closeContractEditor();
      clearContractSelection();
      await Promise.all([loadContractWorkbench(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function previewAllocationRun(): Promise<void> {
    clearMutationReceipt();

    try {
      runReceipt = await distributionApi.previewAllocationRun(
        {
          workspaceId: distributionWorkspaceId,
          // Same source as the lock key: the wave period, never the UI range.
          period: allocationWavePeriod,
          lockKey: allocationLockKey,
          batchId: null
        },
        {
          idempotencyKey: createIdempotencyKey("allocation-preview")
        }
      );
      runReceiptPageId = activePageId;
      runReceiptIsPreview = true;
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function startCadencedAllocationRun(): Promise<void> {
    clearMutationReceipt();

    try {
      runReceipt = await distributionApi.startCadencedAllocationRun(
        {
          workspaceId: distributionWorkspaceId,
          // Same source as the lock key: the wave period, never the UI range.
          period: allocationWavePeriod,
          lockKey: allocationLockKey,
          cadence: "manual",
          batchId: null
        },
        {
          idempotencyKey: createIdempotencyKey("allocation-cadenced")
        }
      );
      runReceiptPageId = activePageId;
      runReceiptIsPreview = false;
      // The cadenced run persists a new calculation run; refresh the run list.
      await Promise.all([loadAllocationWorkbench(), loadAllocationRuns(), loadStatements(), loadPayments(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function previewAllocationBatch(rowId: string): Promise<void> {
    const batch = allocationBatches.find((candidate) => candidate.id === rowId);
    if (batch === undefined) return;
    clearMutationReceipt();
    try {
      runReceipt = await distributionApi.previewAllocationRun({
        workspaceId: distributionWorkspaceId,
        period: batch.period,
        lockKey: `distribution:allocation:batch:${batch.id}`,
        batchId: batch.id
      }, { idempotencyKey: createIdempotencyKey(`allocation-preview-${batch.id}`) });
      runReceiptPageId = activePageId;
      runReceiptIsPreview = true;
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function runAllocationBatch(rowId: string): Promise<void> {
    const batch = allocationBatches.find((candidate) => candidate.id === rowId);
    if (batch === undefined || !allocationBatchCanRun(rowId)) return;
    clearMutationReceipt();
    try {
      runReceipt = await distributionApi.startCadencedAllocationRun({
        workspaceId: distributionWorkspaceId,
        period: batch.period,
        lockKey: `distribution:allocation:batch:${batch.id}`,
        cadence: "manual",
        batchId: batch.id
      }, { idempotencyKey: createIdempotencyKey(`allocation-run-${batch.id}`) });
      runReceiptPageId = activePageId;
      runReceiptIsPreview = false;
      await Promise.all([loadAllocationWorkbench(), loadAllocationRuns(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function allocationBatchCanRun(rowId: string): boolean {
    const batch = allocationBatches.find((candidate) => candidate.id === rowId);
    return writesEnabled && batch !== undefined && batch.pendingRowCount > 0;
  }

  function allocationBatchRunDisabledReason(rowId: string): string | null {
    if (!writesEnabled) return writeGateMessage;
    const batch = allocationBatches.find((candidate) => candidate.id === rowId);
    return batch === undefined || batch.pendingRowCount === 0 ? "No matched pending rows remain in this batch." : null;
  }

  function humanizeIssueCode(value: string): string {
    return value.replaceAll("_", " ");
  }

  function dashboardFixLabel(rowId: string): string {
    const labels: Readonly<Record<string, string>> = {
      mapping: "Fix mapping queue",
      catalog: "Review catalog queue",
      contracts: "Fix missing splits",
      expenses: "Assign expense payees",
      allocations: "Run pending allocations",
      suspense: "Resolve suspense queue",
      payments: "Reconcile payments"
    };
    return labels[rowId] ?? "Open exact issue queue";
  }

  function suspenseFixLabel(rowId: string): string {
    const item = suspenseItems.find((candidate) => candidate.id === rowId);
    return item === undefined ? "Fix exact issue" : `Fix ${item.reasonTitle.toLocaleLowerCase()}`;
  }

  function allocationTrackLabel(rowId: string): string {
    const row = allocationBankItems.find((candidate) => candidate.trackId === rowId);
    return row === undefined ? "this track" : row.isrc ?? row.trackTitle;
  }

  function showAllImportedDataForIssue(): void {
    periodScope = "all";
    customRange = null;
  }

  function openAllocationSuspenseReason(reasonCode: string): void {
    showAllImportedDataForIssue();
    suspenseSearch = "";
    suspenseBatchReference = "";
    suspenseReasonFilter = reasonCode;
    suspenseStatusFilter = "open";
    selectPage("suspense");
    void loadSuspense();
  }

  function openAllocationContractSetup(rowId: string): void {
    const row = allocationBankItems.find((candidate) => candidate.trackId === rowId);
    if (row === undefined) return;
    contractSearch = row.isrc ?? row.trackTitle;
    contractStatusFilter = allValue;
    contractWorkflowFilter = "needs_attention";
    selectPage("contracts");
    void loadContractWorkbench();
  }

  function allocationTrackCanRetry(rowId: string): boolean {
    return writesEnabled && allocationBankItems.some((candidate) => candidate.trackId === rowId);
  }

  function allocationTrackRetryDisabledReason(): string | null {
    return writesEnabled ? null : writeGateMessage;
  }

  async function retryAllocationTrack(rowId: string): Promise<void> {
    if (!allocationTrackCanRetry(rowId)) return;
    clearRunReceipt();
    try {
      const receipt = await distributionApi.retryAllocationMissingContracts({
        workspaceId: distributionWorkspaceId,
        trackId: rowId
      }, { idempotencyKey: createIdempotencyKey(`allocation-retry-${rowId}`) });
      mutationReceipt = receipt;
      mutationReceiptPageId = activePageId;
      actionNotice = receipt.resetRowCount === 0
        ? "0 rows released: the remaining rows for this track are blocked earlier in the pipeline (catalog mapping), not by the contract."
        : `${String(receipt.resetRowCount)} rows released to the pending allocation queue.`;
      actionNoticePageId = activePageId;
      await Promise.all([loadAllocationWorkbench(), loadSuspense(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function selectRunForUnpost(runId: string): void {
    const run = allocationRuns.find((candidate: AllocationRunSummary): boolean => candidate.id === runId);

    if (run === undefined) {
      return;
    }

    selectedRunId = runId;
    unpostReasonInput = "";
  }

  function closeUnpostPanel(): void {
    selectedRunId = null;
    unpostReasonInput = "";
  }

  async function unpostAllocationRun(): Promise<void> {
    const run = selectedRun;
    const reason = unpostReasonInput.trim();

    if (run === null || reason === "") {
      return;
    }

    clearMutationReceipt();

    try {
      runReceipt = await distributionApi.requestAllocationUnpostRun(
        run.id,
        {
          workspaceId: distributionWorkspaceId,
          reason,
          // The server re-acquires the advisory lock under the run's own lock key
          // ("distribution:allocation:<runId>", surfaced as AllocationRunSummary.lockKey),
          // so that key is the real token to hand back on unpost.
          lockToken: run.lockKey
        },
        {
          idempotencyKey: createIdempotencyKey("allocation-unpost")
        }
      );
      runReceiptPageId = activePageId;
      closeUnpostPanel();
      await Promise.all([loadAllocationWorkbench(), loadAllocationRuns(), loadStatements(), loadPayments(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function openSuspenseResolution(rowId: string): void {
    const item = suspenseItems.find((candidate: DistributionSuspenseWorkbenchRow): boolean => candidate.id === rowId);

    if (item === undefined || item.status !== "open") {
      return;
    }

    selectedSuspenseId = rowId;
    suspenseTargetTrackId = "";
    suspenseResolutionNote = "";
    if (item.resolutionMode === "map") {
      void ensureSuspenseTrackOptions();
    }
  }

  function closeSuspensePanel(): void {
    selectedSuspenseId = null;
    suspenseTargetTrackId = "";
    suspenseResolutionNote = "";
  }

  async function ensureSuspenseTrackOptions(): Promise<void> {
    // The catalog can span several pages; fetch it once and cache it for later panels.
    if (suspenseTrackOptions !== null) {
      return;
    }

    suspenseTrackOptionsError = null;

    try {
      const items: TrackSummary[] = [];
      let cursor: string | null = null;

      do {
        const page: PageResult<TrackSummary> = await distributionApi.listTracks({
          workspaceId: distributionWorkspaceId,
          releaseId: null,
          status: null,
          cursor,
          limit: TABLE_PAGE_SIZE
        });
        items.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor !== null);

      suspenseTrackOptions = items;
    } catch (error: unknown) {
      suspenseTrackOptionsError = getErrorMessage(error);
    }
  }

  interface SuspenseResolveTarget {
    readonly ready: boolean;
    readonly targetId: string | null;
    readonly hint: string;
  }

  function resolveSuspenseTargetFor(
    resolution: "map_to_track" | "retry_row" | "mark_resolved" | null,
    track: TrackSummary | null
  ): SuspenseResolveTarget {
    if (resolution === null) {
      return { ready: false, targetId: null, hint: "Select a suspense item first." };
    }

    if (resolution !== "map_to_track") {
      return { ready: true, targetId: null, hint: "" };
    }

    if (track === null) {
      return { ready: false, targetId: null, hint: "Select the target track first." };
    }

    return { ready: true, targetId: track.id, hint: "" };
  }

  async function resolveSelectedSuspense(
    requestedResolution: "map_to_track" | "retry_row" | "mark_resolved" | null = null
  ): Promise<void> {
    const item = selectedSuspenseItem;
    const resolution = requestedResolution ?? selectedSuspenseResolution;
    const target = suspenseResolveTarget;

    if (item === null || resolution === null || (resolution === "map_to_track" && !target.ready)) {
      return;
    }
    if (resolution === "mark_resolved" && suspenseResolutionNote.trim() === "") {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await distributionApi.resolveSuspense(
        {
          workspaceId: distributionWorkspaceId,
          suspenseId: item.id,
          resolution,
          targetId: resolution === "map_to_track" ? target.targetId : null,
          note: suspenseResolutionNote.trim() || `${resolution === "retry_row" ? "Retried" : "Mapped"} through ${item.fixPath}`
        },
        {
          idempotencyKey: createIdempotencyKey("suspense-resolve")
        }
      );
      mutationReceiptPageId = activePageId;
      closeSuspensePanel();
      await Promise.all([loadSuspense(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function suspenseRowCanResolve(rowId: string): boolean {
    return suspenseItems.some((item) => item.id === rowId && item.status === "open");
  }

  function suspenseRowResolveDisabledReason(rowId: string): string | null {
    return suspenseRowCanResolve(rowId) ? null : "This suspense item is already resolved.";
  }

  async function openSuspenseReasonQueue(reasonCode: string): Promise<void> {
    showAllImportedDataForIssue();
    suspenseSearch = "";
    suspenseBatchReference = "";
    suspenseReasonFilter = reasonCode;
    suspenseStatusFilter = "open";
    selectPage("suspense");
    await loadSuspense();
  }

  function openSuspenseFixPath(rowId: string): void {
    const item = suspenseItems.find((candidate) => candidate.id === rowId);
    if (item === undefined) return;
    const reference = item.isrc ?? item.trackTitle ?? item.artistName ?? "";
    showAllImportedDataForIssue();
    if (item.fixPath === "mapping") {
      mappingSearch = reference;
      mappingStatusFilter = "all";
      selectPage("mapping");
      void loadMappingRows();
      return;
    }
    if (item.fixPath === "contracts") {
      contractSearch = reference;
      contractStatusFilter = allValue;
      contractWorkflowFilter = "needs_attention";
      selectPage("contracts");
      void loadContractWorkbench();
      return;
    }
    if (item.fixPath === "catalog") {
      catalogSearch = reference;
      catalogReviewFilter = allValue;
      selectPage("catalog");
      void loadCatalog();
      return;
    }
    if (item.fixPath === "settings") {
      fxFromCurrencyInput = item.currency;
      fxToCurrencyInput = "MUR";
      fxEffectiveDateInput = item.createdAt.slice(0, 10);
      selectPage("settings");
      return;
    }
    if (item.fixPath === "imports") {
      importSourceFilter = allValue;
      importStatusFilter = allValue;
      selectPage("imports");
      void loadImportBatches();
    }
  }

  async function generateStatements(): Promise<void> {
    clearMutationReceipt();

    try {
      runReceipt = await distributionApi.generateStatements(
        {
          workspaceId: distributionWorkspaceId,
          period: distributionPeriod,
          payeeIds: payees.map((payee: PayeeSummary): string => payee.id),
          lockKey: `distribution:statements:${distributionPeriod}`
        },
        {
          idempotencyKey: createIdempotencyKey("statements-generate")
        }
      );
      runReceiptPageId = activePageId;
      // The generation run persists new statements; refresh the list.
      await Promise.all([loadStatements(), loadPayments(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function openStatementDetail(statementId: string): void {
    selectedStatementId = statementId;
    statementVoidReason = "";
    void loadStatementDetail(statementId);
  }

  async function loadStatementDetail(statementId: string): Promise<void> {
    statementDetailState = beginReload<StatementPrintResponse>(statementDetailState);
    try {
      statementDetailState = createSuccessState<StatementPrintResponse>(
        await distributionApi.printStatement({ workspaceId: distributionWorkspaceId, statementId })
      );
    } catch (error: unknown) {
      statementDetailState = createErrorState<StatementPrintResponse>(error);
    }
  }

  function closeStatementDetail(): void {
    selectedStatementId = null;
    statementVoidReason = "";
    statementDetailState = createIdleState<StatementPrintResponse>();
  }

  async function exportStatementCsv(statementId: string): Promise<void> {
    try {
      const payload = await distributionApi.printStatement({ workspaceId: distributionWorkspaceId, statementId });
      downloadCsv(
        `distribution-statement-${statementId}.csv`,
        ["statement_id", "payee", "period_start", "period_end", "currency", "track", "units", "gross", "recoupment", "net_payable"],
        payload.lines.map((line: StatementPrintLine): readonly string[] => [
          payload.statement.id,
          payload.statement.payeeName,
          payload.statement.periodStart,
          payload.statement.periodEnd,
          line.currency,
          printTrackLabel(line.trackId, tracks),
          line.quantity,
          line.grossShare,
          line.recoupmentApplied,
          line.netPayable
        ])
      );
    } catch (error: unknown) {
      statementPrintError = getErrorMessage(error);
    }
  }

  function openStatementVoidPanel(statementId: string): void {
    selectedStatementId = statementId;
    statementVoidReason = "";
    statementDetailState = createIdleState<StatementPrintResponse>();
  }

  async function voidSelectedStatement(): Promise<void> {
    if (selectedStatement === null || statementVoidReason.trim() === "") {
      return;
    }

    try {
      mutationReceipt = await distributionApi.voidStatement(
        selectedStatement.id,
        { workspaceId: distributionWorkspaceId, reason: statementVoidReason.trim() },
        { idempotencyKey: createIdempotencyKey(`statement-void-${selectedStatement.id}`) }
      );
      mutationReceiptPageId = activePageId;
      await Promise.all([loadStatements(), loadPayments(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
      closeStatementDetail();
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function statementCanVoid(statementId: string): boolean {
    return writesEnabled
      && statements.some((statement: StatementSummary): boolean => statement.id === statementId && statement.status !== "void")
      && !hasActivePaymentForStatement(statementId);
  }

  function statementVoidDisabledReason(statementId: string): string | null {
    if (!writesEnabled) return writeGateMessage;
    const statement = statements.find((candidate: StatementSummary): boolean => candidate.id === statementId);
    if (statement?.status === "void") return "This statement is already removed from the active list.";
    if (hasActivePaymentForStatement(statementId)) return "Unlink or void the active payment before removing this statement.";
    return null;
  }

  function hasActivePaymentForStatement(statementId: string): boolean {
    return payments.some((payment: PaymentSummary): boolean =>
      payment.status !== "voided" && payment.linkedStatementIds.includes(statementId)
    );
  }

  async function printStatementPdf(statementId: string): Promise<void> {
    if (printingStatementId !== null) {
      return;
    }

    printingStatementId = statementId;
    statementPrintError = null;

    try {
      // The print endpoint returns a typed JSON payload (header + per-track
      // lines); render it into a printable A4 HTML page on the client.
      const payload = await distributionApi.printStatement({
        workspaceId: distributionWorkspaceId,
        statementId
      });
      const html = renderStatementPrintHtml(payload, tracks);
      const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      const printWindow = window.open(url, "_blank");

      if (printWindow === null) {
        URL.revokeObjectURL(url);
        throw new Error("The print tab was blocked by the browser; allow pop-ups for this console and retry.");
      }

      // Revoke the blob URL after printing/navigation to avoid leaking object URLs.
      const cleanupUrl = (): void => {
        URL.revokeObjectURL(url);
        printWindow.removeEventListener("afterprint", cleanupUrl);
        printWindow.removeEventListener("beforeunload", cleanupUrl);
      };
      printWindow.addEventListener("afterprint", cleanupUrl);
      printWindow.addEventListener("beforeunload", cleanupUrl);
      window.setTimeout(cleanupUrl, 60_000);
    } catch (error: unknown) {
      statementPrintError = getErrorMessage(error);
    } finally {
      printingStatementId = null;
    }
  }

  function renderStatementPrintHtml(payload: StatementPrintResponse, trackItems: readonly TrackSummary[]): string {
    const statement = payload.statement;
    const groupedLines = summarizeStatementPrintLines(payload.lines);
    const lineRows = groupedLines
      .map((line: StatementPrintLine): string => `
        <tr>
          <td>${escapeHtml(printTrackLabel(line.trackId, trackItems))}</td>
          <td class="num">${escapeHtml(line.quantity)}</td>
          <td class="num">${escapeHtml(formatPrintAmount(line.grossShare, line.currency))}</td>
          <td class="num">${escapeHtml(formatPrintAmount(line.recoupmentApplied, line.currency))}</td>
          <td class="num">${escapeHtml(formatPrintAmount(line.netPayable, line.currency))}</td>
        </tr>`)
      .join("");

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Statement ${escapeHtml(statement.payeeName)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: var(--ehq-font, "Inter", "Segoe UI", sans-serif); color: var(--ehq-text, CanvasText); background: var(--ehq-bg-main, Canvas); margin: 0; }
  header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid var(--ehq-workspace-distribution, currentColor); padding-bottom: 8px; }
  h1 { font-size: var(--ehq-type-section-title-size, 18px); margin: 16px 0 4px; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; margin: 16px 0; font-size: var(--ehq-type-caption-size, 12px); }
  dt { font-weight: 700; }
  dd { margin: 0; }
  table { width: 100%; border-collapse: collapse; font-size: var(--ehq-type-caption-size, 12px); }
  th, td { border-bottom: 1px solid var(--ehq-border, color-mix(in srgb, CanvasText 20%, Canvas)); padding: 6px 8px; text-align: left; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .detail-note { color: color-mix(in srgb, CanvasText 65%, Canvas); font-size: var(--ehq-type-caption-size, 12px); }
</style>
</head>
<body>
<header><strong>ë • Distribution</strong><span>Royalty statement · A4</span></header>
<h1>${escapeHtml(statement.payeeName)}</h1>
<p>Period ${escapeHtml(statement.periodStart)} → ${escapeHtml(statement.periodEnd)} · status ${escapeHtml(statement.status)} · version ${escapeHtml(String(statement.version))}</p>
<dl>
  <dt>Gross</dt><dd>${escapeHtml(formatPrintAmount(statement.grossTotal, statement.currency))}</dd>
  <dt>Recoupment</dt><dd>${escapeHtml(formatPrintAmount(statement.recoupmentTotal, statement.currency))}</dd>
  <dt>Net payable</dt><dd>${escapeHtml(formatPrintAmount(statement.netPayable, statement.currency))}</dd>
  <dt>Amount due</dt><dd>${escapeHtml(formatPrintAmount(statement.amountDue, statement.currency))}</dd>
</dl>
<p class="detail-note">${groupedLines.length} title summaries from ${payload.lines.length} source lines. The detailed source ledger is available as CSV.</p>
<table>
  <thead><tr><th>Track</th><th class="num">Quantity</th><th class="num">Gross share</th><th class="num">Recoupment</th><th class="num">Net payable</th></tr></thead>
  <tbody>${lineRows}</tbody>
</table>
<script>window.addEventListener("load", function () { window.print(); });</${"script"}>
</body>
</html>`;
  }

  function printTrackLabel(trackId: string | null, trackItems: readonly TrackSummary[]): string {
    if (trackId === null) {
      return "Unallocated";
    }

    const track = trackItems.find((candidate: TrackSummary): boolean => candidate.id === trackId);

    if (track === undefined) {
      return trackId;
    }

    return `${track.title} · ${track.artistName}`;
  }

  /** Groups printable source rows without altering the immutable statement ledger. */
  function summarizeStatementPrintLines(items: readonly StatementPrintLine[]): readonly StatementPrintLine[] {
    const grouped = new Map<string, StatementPrintLine>();

    for (const line of items) {
      const key = `${line.currency}:${line.trackId ?? "unallocated"}`;
      const existing = grouped.get(key);

      if (existing === undefined) {
        grouped.set(key, line);
        continue;
      }

      grouped.set(key, {
        ...existing,
        quantity: addPrintableDecimal(existing.quantity, line.quantity),
        grossShare: addPrintableDecimal(existing.grossShare, line.grossShare),
        recoupmentApplied: addPrintableDecimal(existing.recoupmentApplied, line.recoupmentApplied),
        netPayable: addPrintableDecimal(existing.netPayable, line.netPayable)
      });
    }

    return [...grouped.values()].sort((left, right): number =>
      `${left.trackId ?? ""}`.localeCompare(`${right.trackId ?? ""}`)
    );
  }

  /** Exact decimal addition for display-only aggregation; no floating-point coercion. */
  function addPrintableDecimal(left: string, right: string): string {
    const leftFraction = left.includes(".") ? left.split(".")[1]?.length ?? 0 : 0;
    const rightFraction = right.includes(".") ? right.split(".")[1]?.length ?? 0 : 0;
    const scale = Math.max(leftFraction, rightFraction);
    const factor = 10n ** BigInt(scale);
    const toScaledInteger = (value: string): bigint => {
      const negative = value.startsWith("-");
      const absolute = negative ? value.slice(1) : value;
      const [whole = "0", fraction = ""] = absolute.split(".");
      const scaled = BigInt(whole) * factor + BigInt(fraction.padEnd(scale, "0").slice(0, scale) || "0");
      return negative ? -scaled : scaled;
    };
    const sum = toScaledInteger(left) + toScaledInteger(right);
    const negative = sum < 0n;
    const absolute = negative ? -sum : sum;
    const whole = absolute / factor;
    const fraction = String(absolute % factor).padStart(scale, "0").replace(/0+$/u, "");
    return `${negative ? "-" : ""}${whole}${fraction === "" ? "" : `.${fraction}`}`;
  }

  // The print payload carries 10-decimal money strings; round to cents for A4 output.
  // Use integer arithmetic to avoid float precision drift on large amounts.
  function formatPrintAmount(value: string, currency: CurrencyCode): string {
    const negative = value.startsWith("-");
    const abs = negative ? value.slice(1) : value;
    const dotIdx = abs.indexOf(".");
    const intStr = dotIdx === -1 ? abs : abs.slice(0, dotIdx);
    const fracStr = dotIdx === -1 ? "" : abs.slice(dotIdx + 1);
    const padded = fracStr.padEnd(10, "0").slice(0, 10);
    const micro = BigInt(intStr) * 10_000_000_000n + BigInt(padded);
    // Round half-up to 2 decimal places (divide scale-10 by 10^8).
    const cents = (micro + 50_000_000n) / 100_000_000n;
    const wholePart = cents / 100n;
    const centPart = String(cents % 100n).padStart(2, "0");
    return `${negative ? "-" : ""}${currency} ${String(wholePart)}.${centPart}`;
  }

  function escapeHtml(value: string): string {
    return value
      .replace(/&/gu, "&amp;")
      .replace(/</gu, "&lt;")
      .replace(/>/gu, "&gt;")
      .replace(/"/gu, "&quot;");
  }

  function openPaymentPanel(paymentId: string, mode: PaymentPanelMode): void {
    const payment = payments.find((candidate: PaymentSummary): boolean => candidate.id === paymentId);

    if (payment === undefined) {
      return;
    }

    selectedPaymentId = paymentId;
    paymentPanelMode = mode;
    paymentReferenceInput = mode === "void" ? "" : payment.reference ?? "";
    paymentNotesInput = payment.notes ?? "";
    paymentMethodInput = payment.method;
    paymentStatusInput = payment.status === "draft" ? "draft" : "paid";
    paymentPaidDateInput = payment.paidAt?.slice(0, 10) ?? today;
    paymentExchangeRateInput = payment.exchangeRate ?? "";
    paymentReconcileStatementId = "";
    paymentReconcileAmountInput = payment.amountMicro;
    paymentReconcileAmountEdited = false;
  }

  function closePaymentPanel(): void {
    selectedPaymentId = null;
    paymentPanelMode = null;
    paymentReferenceInput = "";
    paymentNotesInput = "";
    paymentReconcileStatementId = "";
    paymentReconcileAmountInput = "";
    paymentReconcileAmountEdited = false;
  }

  function openPaymentCreatePanel(): void {
    paymentCreatePanelOpen = true;
    recordPaymentAmountEdited = recordPaymentAmount !== "";
  }

  function closePaymentCreatePanel(): void {
    paymentCreatePanelOpen = false;
  }

  async function recordPayment(): Promise<void> {
    const amountMicro = recordPaymentAmountMicro;
    const currency = normalizeCurrencyCode(recordPaymentCurrency);

    if (
      recordPaymentPayeeId === "" ||
      amountMicro === null ||
      currency === null ||
      (recordPaymentExchangeRate.trim() !== "" && recordPaymentExchangeRateNormalized === null) ||
      (recordPaymentStatus === "paid" && recordPaymentPaidDate === "")
    ) {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await distributionApi.recordPayment(
        {
          workspaceId: distributionWorkspaceId,
          statementId: recordStatement?.id ?? null,
          payeeId: recordPaymentPayeeId,
          amountMicro,
          currency,
          exchangeRate: recordPaymentExchangeRateNormalized,
          method: recordPaymentMethod,
          status: recordPaymentStatus,
          paidAt: recordPaymentStatus === "paid" ? `${recordPaymentPaidDate}T00:00:00.000Z` : null,
          reference: recordPaymentReference.trim() || null,
          notes: recordPaymentNotes.trim() || null
        },
        {
          idempotencyKey: createIdempotencyKey("payment-record")
        }
      );
      mutationReceiptPageId = activePageId;
      recordStatementId = "";
      recordPaymentPayeeId = "";
      recordPaymentAmount = "";
      recordPaymentAmountEdited = false;
      recordPaymentCurrency = "MUR";
      recordPaymentExchangeRate = "";
      recordPaymentMethod = "bank_transfer";
      recordPaymentStatus = "paid";
      recordPaymentPaidDate = today;
      recordPaymentReference = "";
      recordPaymentNotes = "";
      closePaymentCreatePanel();
      await Promise.all([loadPayments(), loadStatements(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function editPayment(): Promise<void> {
    const payment = selectedPayment;
    if (
      payment === null ||
      (paymentExchangeRateInput.trim() !== "" && paymentExchangeRateNormalized === null) ||
      (paymentStatusInput === "paid" && paymentPaidDateInput === "")
    ) {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await distributionApi.updatePayment(
        payment.id,
        {
          workspaceId: distributionWorkspaceId,
          amountMicro: payment.amountMicro,
          currency: payment.currency,
          exchangeRate: paymentExchangeRateNormalized,
          method: paymentMethodInput,
          status: paymentStatusInput,
          paidAt: paymentStatusInput === "paid" ? `${paymentPaidDateInput}T00:00:00.000Z` : null,
          reference: paymentReferenceInput.trim() || null,
          notes: paymentNotesInput.trim() || null
        },
        {
          idempotencyKey: createIdempotencyKey("payment-edit")
        }
      );
      mutationReceiptPageId = activePageId;
      closePaymentPanel();
      await Promise.all([loadPayments(), loadStatements(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function reconcilePayment(): Promise<void> {
    const payment = selectedPayment;
    const amountAppliedMicro = paymentReconcileAmountMicro;

    if (payment === null || paymentReconcileStatementId === "" || amountAppliedMicro === null) {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await distributionApi.reconcilePayment(
        payment.id,
        {
          workspaceId: distributionWorkspaceId,
          statementId: paymentReconcileStatementId,
          amountAppliedMicro,
          reconciledAt: new Date().toISOString()
        },
        {
          idempotencyKey: createIdempotencyKey("payment-reconcile")
        }
      );
      mutationReceiptPageId = activePageId;
      closePaymentPanel();
      await Promise.all([loadPayments(), loadStatements(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function voidPayment(): Promise<void> {
    const payment = selectedPayment;
    const reason = paymentReferenceInput.trim();

    if (payment === null || reason === "") {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await distributionApi.voidPayment(
        payment.id,
        {
          workspaceId: distributionWorkspaceId,
          reason
        },
        {
          idempotencyKey: createIdempotencyKey("payment-void")
        }
      );
      mutationReceiptPageId = activePageId;
      closePaymentPanel();
      await Promise.all([loadPayments(), loadStatements(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function runReconciliationAction(action: DistributionReconciliationAction): Promise<void> {
    clearActionReceipts();

    if (action.maintenance) {
      try {
        mutationReceipt = await distributionApi.runFinancialReconciliationAction(
          action.id,
          {
            workspaceId: distributionWorkspaceId,
            reason: `Triggered from Distribution reconciliation panel: ${action.id}`
          },
          { idempotencyKey: createIdempotencyKey(`recon-action-${action.id}`) }
        );
        mutationReceiptPageId = activePageId;
        await Promise.all([loadReconciliation(), loadAuditLog()]);
      } catch (error: unknown) {
        reportActionError(error);
      }
      return;
    }

    if (action.id === "link-statement-payment") {
      const statementGap = reconciliation?.statementsWithoutPaymentLinks[0];
      const statement = statements.find((candidate: StatementSummary): boolean => candidate.id === statementGap?.id) ?? statements[0];
      if (statement === undefined) {
        return;
      }

      try {
        mutationReceipt = await distributionApi.recordPayment(
          {
            workspaceId: distributionWorkspaceId,
            statementId: statement.id,
            payeeId: statement.payeeId,
            amountMicro: statement.netPayableMicro,
            currency: statement.currency,
            exchangeRate: null,
            method: "bank_transfer",
            status: "paid",
            paidAt: new Date().toISOString(),
            reference: "DISTRIBUTION-RECON-LINK",
            notes: "Created from the Distribution statement reconciliation queue."
          },
          { idempotencyKey: createIdempotencyKey("recon-link-payment") }
        );
        mutationReceiptPageId = activePageId;
        await Promise.all([loadPayments(), loadStatements(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
      } catch (error: unknown) {
        reportActionError(error);
      }
      return;
    }

    if (action.id === "recompute-payee-balance") {
      reportActionError(new Error("Recompute payee balance is disabled until a dedicated endpoint is available."));
      return;
    }

    if (action.id === "assign-expense-payee") {
      // The guarded expense write needs explicit operator input (contract, label,
      // amount, date): route to the real expense form instead of fabricating one.
      selectPage("contracts");
      openExpensePanel();
      return;
    }

    if (action.id === "allocate-matched-row") {
      await startCadencedAllocationRun();
      await Promise.all([loadReconciliation(), loadAuditLog()]);
      return;
    }

    if (action.id === "void-statement") {
      const statementGap = reconciliation?.statementsWithoutPaymentLinks[0];
      const statement = statements.find((candidate: StatementSummary): boolean => candidate.id === statementGap?.id) ?? statements[0];
      if (statement === undefined) {
        return;
      }

      try {
        mutationReceipt = await distributionApi.voidStatement(
          statement.id,
          {
            workspaceId: distributionWorkspaceId,
            reason: "Operator reconciliation void"
          },
          { idempotencyKey: createIdempotencyKey("recon-void-statement") }
        );
        mutationReceiptPageId = activePageId;
        await Promise.all([loadStatements(), loadPayments(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
      } catch (error: unknown) {
        reportActionError(error);
      }
    }
  }

  function openAliasCreatePanel(): void {
    aliasEditorOpen = true;
    aliasEditorId = null;
    aliasTextInput = "";
    aliasTargetTypeInput = "unassigned";
    aliasTargetIdInput = "";
  }

  function openAliasEditor(aliasId: string): void {
    const alias = aliases.find((candidate: DistributionAlias): boolean => candidate.id === aliasId);

    if (alias === undefined) {
      return;
    }

    aliasEditorId = alias.id;
    aliasEditorOpen = true;
    aliasTextInput = alias.aliasText;
    aliasTargetTypeInput = alias.targetType;
    aliasTargetIdInput = alias.targetId ?? "";
  }

  function closeAliasEditor(): void {
    aliasEditorOpen = false;
    aliasEditorId = null;
    aliasTextInput = "";
    aliasTargetTypeInput = "unassigned";
    aliasTargetIdInput = "";
  }

  function updateAliasTextInput(value: string): void {
    aliasTextInput = value;
  }

  function updateAliasTargetType(value: string): void {
    aliasTargetTypeInput = value as DistributionAliasTargetType;
    aliasTargetIdInput = "";
  }

  function updateAliasTargetId(value: string): void {
    aliasTargetIdInput = value;
  }

  async function saveAlias(): Promise<void> {
    if (!aliasFormValid) {
      return;
    }

    const normalizedAliasText = aliasTextInput.trim();
    const normalizedTargetId = aliasTargetTypeInput === "unassigned" ? null : aliasTargetIdInput.trim();
    clearRunReceipt();

    try {
      if (aliasEditorId === null) {
        mutationReceipt = await distributionApi.createAlias(
          {
            workspaceId: distributionWorkspaceId,
            aliasText: normalizedAliasText,
            targetType: aliasTargetTypeInput,
            targetId: normalizedTargetId
          },
          {
            idempotencyKey: createIdempotencyKey("alias-create")
          }
        );
      } else {
        mutationReceipt = await distributionApi.updateAlias(
          aliasEditorId,
          {
            workspaceId: distributionWorkspaceId,
            aliasText: normalizedAliasText,
            targetType: aliasTargetTypeInput,
            targetId: normalizedTargetId
          },
          {
            idempotencyKey: createIdempotencyKey("alias-update")
          }
        );
      }

      mutationReceiptPageId = activePageId;
      closeAliasEditor();
      await Promise.all([loadAliases(), loadDuplicates(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function openDuplicateMerge(duplicateId: string): void {
    const duplicate = duplicates.find((candidate: DistributionDuplicate): boolean => candidate.id === duplicateId);

    if (duplicate === undefined || !duplicate.resolutionAllowed) {
      return;
    }

    duplicateEditorId = duplicate.id;
    duplicateMasterId = duplicate.sampleIds[0] ?? "";
  }

  function closeDuplicateMerge(): void {
    duplicateEditorId = null;
    duplicateMasterId = "";
  }

  function updateDuplicateMaster(value: string): void {
    duplicateMasterId = value;
  }

  function createDuplicateMasterOptions(
    items: readonly DistributionDuplicate[],
    duplicateId: string | null
  ): readonly SelectOption[] {
    const duplicate = items.find((candidate: DistributionDuplicate): boolean => candidate.id === duplicateId);

    if (duplicate === undefined) {
      return [{ label: "Select a master", value: "" }];
    }

    return duplicate.sampleIds.map((sampleId: string, index: number): SelectOption => ({
      label: duplicate.sampleLabels[index] ?? sampleId,
      value: sampleId
    }));
  }

  async function mergeDuplicate(): Promise<void> {
    if (duplicateEditorId === null || duplicateMasterId === "") {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await distributionApi.resolveDuplicate(
        duplicateEditorId,
        {
          workspaceId: distributionWorkspaceId,
          keepEarningId: duplicateMasterId,
          reason: "Operator duplicate resolution from Distribution UI"
        },
        {
          idempotencyKey: createIdempotencyKey(`duplicate-resolve-${duplicateEditorId}`)
        }
      );
      mutationReceiptPageId = activePageId;
      closeDuplicateMerge();
      await Promise.all([loadDuplicates(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function getNavItem(pageId: DistributionPageId): DistributionNavItem {
    const item = navItems.find((navItem: DistributionNavItem): boolean => navItem.id === pageId);

    if (item === undefined) {
      throw new Error(`Unknown Distribution page: ${pageId}`);
    }

    return item;
  }

  function createDashboardKpis(state: ApiRequestState<DistributionDashboardResponse>): readonly DistributionKpi[] {
    if (state.status !== "success") {
      return [
        { label: "Imported revenue", value: "—", detail: stateLabel(state), tone: "muted", accent: true },
        { label: "Paid royalties", value: "—", detail: "backend totals", tone: "muted", accent: false },
        { label: "Open recoupments", value: "—", detail: "contract balances", tone: "muted", accent: false },
        { label: "Effective split coverage", value: "—", detail: "valid 100% split", tone: "muted", accent: false },
        { label: "Contract-backed coverage", value: "—", detail: "active contract + split", tone: "muted", accent: false }
      ];
    }

    return [
      {
        label: "Imported revenue",
        value: dashboardCurrencyTotalsValue(state.data.importedRevenue),
        detail: "normalized imports",
        tone: "info",
        accent: true
      },
      { label: "Paid royalties", value: dashboardCurrencyTotalsValue(state.data.paidRoyalties), detail: "recorded payments", tone: "success", accent: false },
      { label: "Open recoupments", value: dashboardCurrencyTotalsValue(state.data.openRecoupments), detail: "open by currency", tone: "warning", accent: false },
      {
        label: "Effective split coverage",
        value: `${String(state.data.splitCoverage.covered)}/${String(state.data.splitCoverage.total)}`,
        detail: "valid 100% split",
        tone: state.data.splitCoverage.covered === state.data.splitCoverage.total ? "success" : "warning",
        accent: false
      },
      {
        label: "Contract-backed coverage",
        value: `${String(state.data.contractCoverage.covered)}/${String(state.data.contractCoverage.total)}`,
        detail: "active contract + split",
        tone: state.data.contractCoverage.covered === state.data.contractCoverage.total ? "success" : "warning",
        accent: false
      }
    ];
  }

  function dashboardCurrencyTotalsValue(totals: readonly { readonly currency: CurrencyCode; readonly amountMicro: string }[]): string {
    if (totals.length === 0) {
      return "—";
    }

    return totals.map((total): string => formatMoney(total.amountMicro, total.currency)).join(" · ");
  }

  function createDashboardReadinessRows(state: ApiRequestState<DistributionDashboardResponse>): readonly TableRow[] {
    if (state.status !== "success") {
      return [];
    }

    return state.data.readiness.map((item: DistributionDashboardReadinessItem): TableRow => ({
      id: item.id,
      cells: [
        { kind: "text", value: item.label, strong: true },
        { kind: "badge", value: item.status, tone: item.status === "clear" ? "success" : item.status === "review" ? "warning" : "error" },
        { kind: "text", value: String(item.count), strong: false },
        { kind: "text", value: item.detail, strong: false }
      ]
    }));
  }

  function createDashboardTopRows(
    state: ApiRequestState<DistributionDashboardResponse>,
    group: "artists" | "tracks" | "stores"
  ): readonly TableRow[] {
    if (state.status !== "success") {
      return [];
    }

    const items: readonly DistributionDashboardTopRoyalty[] = group === "artists"
      ? state.data.topArtists
      : group === "tracks"
        ? state.data.topTracks
        : state.data.topStores;

    return items.map((item: DistributionDashboardTopRoyalty): TableRow => ({
      id: item.id,
      cells: [
        { kind: "text", value: item.label, strong: true },
        { kind: "text", value: item.secondaryLabel, strong: false },
        { kind: "money", value: formatMoney(item.amountMicro, item.currency), tone: "success" }
      ]
    }));
  }

  // Client-side CSV export keeps Distribution revenue extractable without adding
  // a backend endpoint.
  function downloadCsv(filename: string, header: readonly string[], rows: readonly (readonly string[])[]): void {
    const escapeCell = (value: string): string => (/[",\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
    const content = [header, ...rows].map((cells: readonly string[]): string => cells.map(escapeCell).join(",")).join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function updateAuditFromInput(value: string): void { auditFromInput = value; }
  function updateAuditToInput(value: string): void { auditToInput = value; }
  function updateAuditActorInput(value: string): void { auditActorInput = value; }
  function updateAuditEntityInput(value: string): void { auditEntityInput = value; }

  function clearAuditFilters(): void {
    auditFromInput = "";
    auditToInput = "";
    auditActorInput = "";
    auditEntityInput = "";
    void loadAuditLog();
  }

  function exportAuditCsv(): void {
    downloadCsv(
      `distribution-audit-${today}.csv`,
      ["Date", "Actor", "Action", "Entity type", "Entity", "Idempotency key", "Context"],
      auditEntries.map((entry) => [
        entry.occurredAt,
        auditActorLabel(entry),
        entry.action,
        entry.entityType,
        entry.entityReference,
        entry.idempotencyKey ?? "",
        JSON.stringify(entry.context)
      ])
    );
  }

  function exportRevenueCsv(): void {
    const rows = revenueRows.map((row: DistributionRevenueRow): readonly string[] => [
      row.label,
      row.grossMicro,
      row.netMicro,
      row.payableMicro,
      row.currency,
      String(row.barLevel)
    ]);
    downloadCsv(
      `distribution-revenue-${revenueGroupBy}-${distributionPeriod}.csv`,
      ["Group", "Gross", "Net", "Payable", "Currency", "Bar level"],
      rows
    );
  }

  function exportSuspenseCsv(): void {
    const rows = suspenseItems.map((item: DistributionSuspenseWorkbenchRow): readonly string[] => [
      item.id,
      item.batchReference,
      item.reasonCode,
      item.fixPath,
      item.trackTitle ?? "",
      item.artistName ?? "",
      item.isrc ?? "",
      item.upc ?? "",
      item.amountMicro,
      item.currency,
      item.splitPercentage ?? "",
      item.status,
      item.createdAt
    ]);
    downloadCsv(
      `distribution-suspense-${suspenseStatusFilter}-${today}.csv`,
      ["ID", "Batch", "Reason", "Fix path", "Track", "Artist", "ISRC", "UPC / EAN", "Amount", "Currency", "Split", "Status", "Created"],
      rows
    );
  }

  function exportPaymentsCsv(): void {
    const rows = payments.map((payment: PaymentSummary): readonly string[] => [
      payment.id,
      payment.payeeName,
      payment.amountMicro,
      payment.currency,
      payment.exchangeRate ?? "",
      payment.method,
      payment.reference ?? "",
      payment.status,
      payment.paidAt ?? "",
      payment.linkedStatementIds.join(" | "),
      payment.notes ?? ""
    ]);
    downloadCsv(
      `distribution-payments-${paymentStatusFilter}-${distributionPeriod}.csv`,
      ["Payment ID", "Payee", "Amount", "Currency", "FX rate", "Method", "Reference", "Status", "Paid at", "Linked statements", "Notes"],
      rows
    );
  }

  function openDashboardReadiness(rowId: string): void {
    showAllImportedDataForIssue();
    if (rowId === "mapping") {
      mappingSearch = "";
      mappingStatusFilter = "unmapped";
      selectPage("mapping");
      void loadMappingRows();
      return;
    }
    if (rowId === "catalog") {
      catalogSearch = "";
      catalogReviewFilter = "needs_review";
      selectPage("catalog");
      void loadCatalog();
      return;
    }
    if (rowId === "contracts") {
      contractSearch = "";
      contractStatusFilter = allValue;
      contractWorkflowFilter = "needs_attention";
      selectPage("contracts");
      void loadContractWorkbench();
      return;
    }
    if (rowId === "expenses") {
      contractSearch = "";
      contractStatusFilter = allValue;
      contractWorkflowFilter = "with_expenses";
      selectPage("contracts");
      void loadContractWorkbench();
      return;
    }
    if (rowId === "allocations") {
      allocationSearch = "";
      selectPage("allocations");
      void loadAllocationWorkbench();
      return;
    }
    if (rowId === "suspense") {
      suspenseSearch = "";
      suspenseBatchReference = "";
      suspenseReasonFilter = allValue;
      suspenseStatusFilter = "open";
      selectPage("suspense");
      void loadSuspense();
      return;
    }
    if (rowId === "payments") {
      paymentStatusFilter = allValue;
      selectPage("payments");
      void loadPayments();
    }
  }

  function reviewCatalogRow(rowId: string): void {
    const track = catalogTracks.find((candidate: DistributionCatalogTrackRow): boolean => candidate.id === rowId);

    if (track === undefined) {
      return;
    }

    selectedCatalogTrackId = track.id;
    catalogContributorDrafts = [...track.contributors];
    catalogContributorNameInput = "";
    catalogContributorRoleInput = "main_artist";
    catalogContributorReasonInput = "";
  }

  function closeCatalogContributorPanel(): void {
    selectedCatalogTrackId = null;
    catalogContributorDrafts = [];
    catalogContributorNameInput = "";
    catalogContributorReasonInput = "";
  }

  function updateCatalogContributorName(value: string): void { catalogContributorNameInput = value; }
  function updateCatalogContributorRole(value: string): void { catalogContributorRoleInput = value; }
  function updateCatalogContributorReason(value: string): void { catalogContributorReasonInput = value; }

  function addCatalogContributor(): void {
    const name = catalogContributorNameInput.trim();
    if (name === "" || catalogContributorDrafts.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase() && item.role === catalogContributorRoleInput)) {
      return;
    }

    catalogContributorDrafts = [...catalogContributorDrafts, { name, role: catalogContributorRoleInput }];
    catalogContributorNameInput = "";
  }

  function removeCatalogContributor(index: number): void {
    catalogContributorDrafts = catalogContributorDrafts.filter((_, candidateIndex): boolean => candidateIndex !== index);
  }

  async function saveCatalogContributors(): Promise<void> {
    const track = selectedCatalogTrack;
    const reason = catalogContributorReasonInput.trim();
    if (!writesEnabled || track === null || catalogContributorDrafts.length === 0 || reason === "") {
      return;
    }

    clearRunReceipt();
    try {
      mutationReceipt = await distributionApi.saveCatalogContributors(
        track.id,
        {
          workspaceId: distributionWorkspaceId,
          contributors: catalogContributorDrafts,
          reason
        },
        { idempotencyKey: createIdempotencyKey("catalog-contributors") }
      );
      mutationReceiptPageId = activePageId;
      closeCatalogContributorPanel();
      await Promise.all([loadCatalog(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function promoteCatalogMainArtist(): Promise<void> {
    const track = selectedCatalogTrack;
    const mainArtist = selectedCatalogMainArtist;
    const reason = catalogContributorReasonInput.trim();
    if (!writesEnabled || track === null || mainArtist === null || reason === "") return;

    try {
      const request: DistributionCatalogArtistPromoteRequest = {
        workspaceId: distributionWorkspaceId,
        contributorName: mainArtist.name,
        reason
      };
      mutationReceipt = await distributionApi.promoteCatalogArtist(
        track.id,
        request,
        { idempotencyKey: createIdempotencyKey("catalog-promote-main-artist") }
      );
      mutationReceiptPageId = activePageId;
      await Promise.all([loadCatalog(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function promoteVisibleCatalogArtistSuggestions(): Promise<void> {
    if (!writesEnabled || suggestedCatalogArtistTracks.length === 0) return;
    try {
      for (const track of suggestedCatalogArtistTracks) {
        await distributionApi.promoteCatalogArtist(
          track.id,
          { workspaceId: distributionWorkspaceId, contributorName: track.suggestedCatalogArtist ?? "", reason: "Confirmed unique imported main artist." },
          { idempotencyKey: createIdempotencyKey(`catalog-promote-suggestion-${track.id}`) }
        );
      }
      await Promise.all([loadCatalog(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function ensureContributorPayee(contributorName: string): Promise<void> {
    const track = selectedCatalogTrack;
    if (track === null || !writesEnabled) return;

    try {
      mutationReceipt = await distributionApi.linkCatalogContributorPayee(
        track.id,
        contributorName,
        {
          workspaceId: distributionWorkspaceId,
          defaultCurrency: "MUR"
        },
        { idempotencyKey: createIdempotencyKey("catalog-contributor-payee-link") }
      );
      mutationReceiptPageId = activePageId;
      await Promise.all([loadPayees(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function createImportRows(items: readonly DistributionImportBatch[]): readonly TableRow[] {
    return items.map((batch: DistributionImportBatch): TableRow => ({
      id: batch.id,
      cells: [
        { kind: "text", value: batch.id, strong: false },
        { kind: "badge", value: batch.source, tone: batch.source === "kontor" ? "active" : "info" },
        { kind: "text", value: batch.fileName, strong: true },
        { kind: "badge", value: batch.status, tone: distributionImportStatusTone(batch.status) },
        { kind: "text", value: String(batch.rowCount), strong: false },
        { kind: "text", value: String(batch.normalizedRowCount), strong: false },
        { kind: "money", value: formatMoney(batch.grossMicro, batch.currency), tone: "success" },
        { kind: "text", value: String(batch.issueCount), strong: false },
        { kind: "text", value: String(batch.skippedRowCount), strong: false },
        { kind: "badge", value: batch.currency, tone: "muted" },
        { kind: "text", value: formatDateOnly(batch.importedAt), strong: false }
      ]
    }));
  }

  function createMappingRows(items: readonly DistributionMappingRow[], selectedIds: readonly string[]): readonly TableRow[] {
    return items.map((row: DistributionMappingRow): TableRow => ({
      id: row.id,
      cells: [
        { kind: "text", value: row.sourceTitle, strong: true },
        { kind: "text", value: row.sourceArtist, strong: false },
        { kind: "text", value: row.sourceLabel || "—", strong: false },
        { kind: "text", value: row.sourceStore, strong: false },
        { kind: "text", value: row.sourceIsrc ?? row.sourceUpc ?? "missing", strong: false },
        { kind: "money", value: formatMoney(row.grossMicro, row.currency), tone: moneyTone(row.grossMicro) },
        { kind: "text", value: row.suggestedTrackTitle ?? "manual track required", strong: false },
        { kind: "badge", value: formatConfidence(row.confidenceBp), tone: confidenceTone(row.confidenceBp) },
        { kind: "badge", value: row.exactFixPath, tone: "active" },
        { kind: "badge", value: selectedIds.includes(row.id) ? "selected" : "—", tone: selectedIds.includes(row.id) ? "success" : "muted" }
      ]
    }));
  }

  function createCatalogRows(items: readonly DistributionCatalogTrackRow[]): readonly TableRow[] {
    return items.map((track: DistributionCatalogTrackRow): TableRow => ({
      id: track.id,
      cells: [
        { kind: "badge", value: catalogReviewLabel(track.reviewReason), tone: track.reviewReason === null ? "success" : "warning" },
        { kind: "text", value: track.artistImport ?? "—", strong: false },
        { kind: "text", value: track.catalogArtist, strong: false },
        { kind: "text", value: track.suggestedCatalogArtist ?? "—", strong: track.suggestedCatalogArtist !== null },
        { kind: "text", value: track.versionTitle === null ? track.title : `${track.title} · ${track.versionTitle}`, strong: true },
        { kind: "text", value: track.isrc ?? "—", strong: false },
        { kind: "text", value: track.upc ?? "—", strong: false },
        { kind: "text", value: track.releaseTitle ?? "—", strong: false },
        { kind: "text", value: track.label ?? "—", strong: false },
        { kind: "text", value: formatCatalogContributors(track.contributors, track.contributorSource), strong: false },
        { kind: "badge", value: track.status, tone: catalogTone(track.status) }
      ]
    }));
  }

  function createCatalogReviewRows(items: readonly DistributionCatalogTrackRow[]): readonly TableRow[] {
    return items
      .filter((track): boolean => track.reviewReason !== null)
      .slice(0, 12)
      .map((track): TableRow => ({
        id: track.id,
        cells: [
          { kind: "badge", value: catalogReviewLabel(track.reviewReason), tone: "warning" },
          { kind: "text", value: track.artistImport ?? "—", strong: false },
          { kind: "text", value: track.catalogArtist, strong: false },
          { kind: "text", value: track.suggestedCatalogArtist ?? "—", strong: track.suggestedCatalogArtist !== null },
          { kind: "text", value: track.title, strong: true },
          { kind: "text", value: track.isrc ?? "—", strong: false }
        ]
      }));
  }

  function createCatalogKpis(workbench: DistributionCatalogWorkbenchResponse | null): readonly DistributionKpi[] {
    const summary = workbench?.summary;
    return [
      { label: "Tracks", value: String(summary?.trackCount ?? 0), detail: "workspace catalog", tone: "info", accent: true },
      { label: "Needs review", value: String(summary?.needsReviewCount ?? 0), detail: "unconfirmed contributors", tone: summary?.needsReviewCount === 0 ? "success" : "warning", accent: false },
      { label: "Artist mismatch", value: String(summary?.artistMismatchCount ?? 0), detail: "import vs catalog", tone: summary?.artistMismatchCount === 0 ? "success" : "warning", accent: false },
      { label: "No contributors", value: String(summary?.noContributorCount ?? 0), detail: "missing credits", tone: summary?.noContributorCount === 0 ? "success" : "warning", accent: false }
    ];
  }

  function catalogReviewLabel(reason: DistributionCatalogReviewFilter | null): string {
    if (reason === null) return "confirmed";
    if (reason === "artist_mismatch") return "artist mismatch";
    if (reason === "no_contributors") return "no contributors";
    return "needs review";
  }

  function formatCatalogContributors(contributors: readonly DistributionCatalogContributor[], source: "imported" | "override"): string {
    if (contributors.length === 0) return "—";
    return `${contributors.map((item) => `${item.name} (${formatCatalogRole(item.role)})`).join(", ")} · ${source}`;
  }

  function formatCatalogRole(role: string): string {
    return role.replaceAll("_", " ");
  }

  function createContractRows(items: readonly DistributionContractTrackRow[], selectedIds: readonly string[]): readonly TableRow[] {
    return items.map((track): TableRow => ({
      id: track.trackId,
      cells: [
        { kind: "text", value: `${track.title} · ${track.releaseTitle ?? "No release"}`, strong: true },
        { kind: "text", value: `${track.artistImport ?? "No import artist"} · catalog: ${track.catalogArtist}`, strong: false },
        { kind: "text", value: track.isrc ?? "—", strong: false },
        { kind: "text", value: track.label ?? "—", strong: false },
        { kind: "text", value: formatContractSplits(track), strong: track.splits.length > 0 },
        { kind: "text", value: formatContractExpenses(track), strong: track.expenseCount > 0 },
        { kind: "badge", value: contractTrackStatusLabel(track.status), tone: contractTrackStatusTone(track.status) },
        { kind: "badge", value: selectedIds.includes(track.trackId) ? "selected" : "not selected", tone: selectedIds.includes(track.trackId) ? "active" : "muted" }
      ]
    }));
  }

  function createContractKpis(workbench: DistributionContractWorkbenchResponse | null): readonly DistributionKpi[] {
    const summary = workbench?.summary;
    return [
      { label: "Active contracts (track only)", value: String(summary?.activeTrackOnlyCount ?? 0), detail: "direct track rules", tone: "success", accent: true },
      { label: "Active contracts (effective)", value: String(summary?.activeEffectiveCount ?? 0), detail: "track + inherited", tone: "success", accent: false },
      { label: "Expired contracts", value: String(summary?.expiredContractCount ?? 0), detail: "inactive agreements", tone: summary?.expiredContractCount === 0 ? "success" : "warning", accent: false },
      { label: "Draft contracts", value: String(summary?.draftContractCount ?? 0), detail: "not active", tone: summary?.draftContractCount === 0 ? "success" : "warning", accent: false },
      { label: "Direct track split rules", value: String(summary?.directTrackRuleCount ?? 0), detail: "active rule rows", tone: "info", accent: false },
      { label: "Tracks without effective split", value: String(summary?.noEffectiveSplitCount ?? 0), detail: "needs attention", tone: summary?.noEffectiveSplitCount === 0 ? "success" : "warning", accent: false },
      { label: "Unallocated rows", value: String(summary?.unallocatedRowCount ?? 0), detail: "not allocated in Postgres", tone: summary?.unallocatedRowCount === 0 ? "success" : "warning", accent: false },
      { label: "Open recoupments", value: formatContractCurrencyTotals(summary?.openRecoupmentTotals ?? []), detail: "recoverable balances", tone: (summary?.openRecoupmentTotals.length ?? 0) === 0 ? "success" : "warning", accent: false }
    ];
  }

  function contractTrackStatusLabel(status: DistributionContractTrackStatus): string {
    return status === "no_split" ? "No split" : status === "ambiguous" ? "Ambiguous" : "Active";
  }

  function contractTrackStatusTone(status: DistributionContractTrackStatus): Tone {
    return status === "active" ? "success" : status === "ambiguous" ? "error" : "warning";
  }

  function formatContractSplits(track: DistributionContractTrackRow): string {
    if (track.splits.length === 0) return "—";
    const source = track.splitSource === "release" ? "inherited" : track.splitSource ?? "track";
    return `${track.splits.map((split) => `${split.payeeName} ${trimPercentage(split.percentage)}%`).join(" · ")} · ${source}`;
  }

  function trimPercentage(value: string): string {
    return value.includes(".") ? value.replace(/0+$/u, "").replace(/\.$/u, "") : value;
  }

  function formatContractExpenses(track: DistributionContractTrackRow): string {
    if (track.expenseCount === 0) return "—";
    const totals = formatContractCurrencyTotals(track.openExpenseTotals);
    return totals === "—" ? `${track.expenseCount} recorded` : `${track.expenseCount} · ${totals} open`;
  }

  function formatContractCurrencyTotals(totals: readonly { readonly currency: CurrencyCode; readonly amountMicro: string }[]): string {
    if (totals.length === 0) return "—";
    return totals.map((total) => formatMoney(total.amountMicro, total.currency)).join(" · ");
  }

  function uniqueContractTracks(items: readonly DistributionContractTrackRow[]): readonly DistributionContractTrackRow[] {
    const seen = new Set<string>();
    return items.filter((track) => {
      if (track.contractId === null || seen.has(track.contractId)) return false;
      seen.add(track.contractId);
      return true;
    });
  }

  function createPayeeRows(items: readonly PayeeSummary[]): readonly TableRow[] {
    return items.map((payee): TableRow => ({
      id: payee.id,
      cells: [
        { kind: "text", value: payee.displayName, strong: true },
        { kind: "text", value: payee.email ?? "—", strong: false },
        { kind: "badge", value: payee.defaultCurrency, tone: "muted" },
        { kind: "badge", value: payee.status, tone: payee.status === "active" ? "success" : "muted" }
      ]
    }));
  }

  function createRevenueKpis(
    rows: readonly DistributionRevenueRow[],
    paymentItems: readonly PaymentSummary[],
    suspenseTotals: readonly DistributionSuspenseCurrencyTotal[]
  ): readonly DistributionKpi[] {
    return [
      { label: "Gross", value: currencyTotalsLabel(rows, (row) => row.grossMicro, (row) => row.currency), detail: "allocated revenue view", tone: "info", accent: true },
      { label: "Allocated / payable", value: currencyTotalsLabel(rows, (row) => row.payableMicro, (row) => row.currency), detail: "after recoupment", tone: "active", accent: false },
      { label: "Paid", value: currencyTotalsLabel(paymentItems.filter((payment) => payment.status === "paid"), (payment) => payment.amountMicro, (payment) => payment.currency), detail: "Distribution ledger", tone: "success", accent: false },
      { label: "Suspense", value: formatSuspenseTotals(suspenseTotals), detail: "awaiting resolution", tone: "warning", accent: false }
    ];
  }

  function currencyTotalsLabel<T>(
    items: readonly T[],
    amount: (item: T) => string,
    currency: (item: T) => CurrencyCode
  ): string {
    const totals = new Map<CurrencyCode, bigint>();
    for (const item of items) {
      const code = currency(item);
      totals.set(code, (totals.get(code) ?? 0n) + parseScale10Units(amount(item)));
    }
    if (totals.size === 0) {
      return "—";
    }
    return [...totals.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([code, units]) => formatMoney(formatScale10Units(units), code))
      .join(" · ");
  }

  function parseScale10Units(value: string): bigint {
    const match = /^(-?)(\d+)(?:\.(\d{1,10}))?$/u.exec(value.trim());
    if (match === null || match[2] === undefined) {
      return 0n;
    }
    const units = BigInt(match[2]) * 10_000_000_000n + BigInt((match[3] ?? "").padEnd(10, "0"));
    return match[1] === "-" ? -units : units;
  }

  function formatScale10Units(units: bigint): string {
    const negative = units < 0n;
    const absolute = negative ? -units : units;
    return `${negative ? "-" : ""}${String(absolute / 10_000_000_000n)}.${String(absolute % 10_000_000_000n).padStart(10, "0")}`;
  }

  function createExpenseRows(items: readonly DistributionContractExpense[]): readonly TableRow[] {
    return items.map((expense: DistributionContractExpense): TableRow => ({
      id: expense.id,
      cells: [
        { kind: "badge", value: expense.category, tone: "muted" },
        { kind: "text", value: expense.payeeId === null ? "Shared" : payeeName(expense.payeeId, payees), strong: false },
        { kind: "text", value: expense.label, strong: true },
        { kind: "text", value: formatDateOnly(expense.incurredOn), strong: false },
        { kind: "money", value: formatMoney(expense.originalAmountMicro, expense.currency), tone: "info" },
        { kind: "money", value: formatMoney(expense.openAmountMicro, expense.currency), tone: moneyTone(expense.openAmountMicro) },
        { kind: "badge", value: expense.recoverable ? "yes" : "no", tone: expense.recoverable ? "active" : "muted" },
        { kind: "badge", value: expense.status, tone: expense.status === "open" ? "warning" : "success" }
      ]
    }));
  }

  function createAllocationRows(items: readonly AllocationRunSummary[]): readonly TableRow[] {
    return items.map((run: AllocationRunSummary): TableRow => ({
      id: run.id,
      cells: [
        { kind: "text", value: run.runReference, strong: true },
        { kind: "text", value: run.period, strong: false },
        { kind: "text", value: run.lockKey, strong: false },
        { kind: "text", value: formatAllocationRunTotals(run.currencyTotals, "grossMicro"), strong: false },
        { kind: "text", value: formatAllocationRunTotals(run.currencyTotals, "netMicro"), strong: true },
        { kind: "badge", value: run.status, tone: run.status === "completed" ? "success" : run.status === "failed" ? "error" : "warning" }
      ]
    }));
  }

  function createAllocationDetailRows(items: readonly DistributionAllocationRow[]): readonly TableRow[] {
    return items.map((item: DistributionAllocationRow): TableRow => ({
      id: item.id,
      cells: [
        { kind: "text", value: item.payeeName, strong: true },
        { kind: "text", value: item.trackTitle ?? "Unassigned track", strong: false },
        { kind: "money", value: formatMoney(item.grossShare, item.currency), tone: moneyTone(item.grossShare) },
        { kind: "money", value: formatMoney(item.recoupmentApplied, item.currency), tone: moneyTone(item.recoupmentApplied) },
        { kind: "money", value: formatMoney(item.netPayable, item.currency), tone: moneyTone(item.netPayable) },
        { kind: "badge", value: item.status, tone: item.status === "posted" ? "success" : "info" }
      ]
    }));
  }

  function createAllocationCurrencyTotalRows(items: readonly DistributionAllocationTotal[]): readonly TableRow[] {
    return items.map((item: DistributionAllocationTotal): TableRow => ({
      id: item.currency,
      cells: [
        { kind: "badge", value: item.currency, tone: "muted" },
        { kind: "money", value: formatMoney(item.grossShare, item.currency), tone: moneyTone(item.grossShare) },
        { kind: "money", value: formatMoney(item.recoupmentApplied, item.currency), tone: moneyTone(item.recoupmentApplied) },
        { kind: "money", value: formatMoney(item.netPayable, item.currency), tone: moneyTone(item.netPayable) }
      ]
    }));
  }

  function createAllocationKpis(workbench: DistributionAllocationWorkbenchResponse | null): readonly DistributionKpi[] {
    const summary = workbench?.summary;
    return [
      { label: "Ready rows", value: String(summary?.readyRowCount ?? 0), detail: "matched and pending", tone: (summary?.readyRowCount ?? 0) === 0 ? "success" : "active", accent: true },
      { label: "Open suspense", value: String(summary?.openSuspenseCount ?? 0), detail: "needs review", tone: (summary?.openSuspenseCount ?? 0) === 0 ? "success" : "warning", accent: false },
      { label: "Missing contracts", value: String(summary?.missingContractCount ?? 0), detail: "contract fixes first", tone: (summary?.missingContractCount ?? 0) === 0 ? "success" : "warning", accent: false }
    ];
  }

  function createAllocationHealthKpis(workbench: DistributionAllocationWorkbenchResponse | null): readonly DistributionKpi[] {
    const summary = workbench?.summary;
    return [
      { label: "Pending matched", value: String(summary?.readyRowCount ?? 0), detail: "ready for safe wave", tone: (summary?.readyRowCount ?? 0) === 0 ? "success" : "active", accent: false },
      { label: "Matched unallocated", value: String(summary?.matchedUnallocatedCount ?? 0), detail: "needs pending reset", tone: (summary?.matchedUnallocatedCount ?? 0) === 0 ? "success" : "warning", accent: false },
      { label: "Open suspense", value: String(summary?.openSuspenseCount ?? 0), detail: "fix before statements", tone: (summary?.openSuspenseCount ?? 0) === 0 ? "success" : "warning", accent: false },
      { label: "Allocation link issues", value: String(summary?.allocationLinkIssueCount ?? 0), detail: "payee / contract / track", tone: (summary?.allocationLinkIssueCount ?? 0) === 0 ? "success" : "error", accent: false }
    ];
  }

  function createAllocationReasonRows(items: readonly DistributionAllocationSuspenseReason[]): readonly TableRow[] {
    return items.map((item) => ({
      id: item.reason,
      cells: [
        { kind: "badge", value: item.reason, tone: "warning" },
        { kind: "text", value: String(item.openRowCount), strong: true }
      ]
    }));
  }

  function createAllocationRecentRows(items: readonly DistributionAllocationRecentBatch[]): readonly TableRow[] {
    return items.map((item) => ({
      id: item.runId,
      cells: [
        { kind: "text", value: item.batchReference, strong: true },
        { kind: "text", value: item.period, strong: false },
        { kind: "text", value: String(item.rowCount), strong: false },
        { kind: "text", value: formatAllocationRunTotals(item.totals, "grossMicro"), strong: false },
        { kind: "text", value: formatAllocationRunTotals(item.totals, "recoupmentMicro"), strong: false },
        { kind: "text", value: formatAllocationRunTotals(item.totals, "netMicro"), strong: true },
        { kind: "badge", value: item.linkIssueCount === 0 ? "OK" : String(item.linkIssueCount), tone: item.linkIssueCount === 0 ? "success" : "error" },
        { kind: "badge", value: item.status, tone: item.status === "completed" ? "success" : item.status === "failed" ? "error" : "warning" }
      ]
    }));
  }

  function createAllocationBatchRows(items: readonly DistributionAllocationBatchRow[]): readonly TableRow[] {
    return items.map((batch) => ({
      id: batch.id,
      cells: [
        { kind: "text", value: batch.reference, strong: true },
        { kind: "text", value: batch.fileName, strong: false },
        { kind: "text", value: `${String(batch.matchedRowCount)} / ${String(batch.totalRowCount)}`, strong: false },
        { kind: "text", value: String(batch.pendingRowCount), strong: true },
        { kind: "text", value: String(batch.allocatedRowCount), strong: false },
        { kind: "text", value: String(batch.suspenseRowCount), strong: false },
        { kind: "text", value: formatAllocationBatchTotals(batch.currencyTotals, "openAmountMicro"), strong: true },
        { kind: "text", value: formatAllocationBatchTotals(batch.currencyTotals, "allocatedAmountMicro"), strong: false },
        { kind: "badge", value: batch.status, tone: batch.pendingRowCount > 0 ? "active" : "muted" }
      ]
    }));
  }

  function allocationBankBlockedByLabel(item: DistributionAllocationUnallocatedTrack): string {
    if (item.mappingBlockedRowCount >= item.rowCount) {
      return `Mapping (${String(item.mappingBlockedRowCount)} rows)`;
    }
    if (item.mappingBlockedRowCount > 0) {
      return `Mapping (${String(item.mappingBlockedRowCount)}) + Contract (${String(item.rowCount - item.mappingBlockedRowCount)})`;
    }
    return "Contract split";
  }

  function createAllocationBankRows(items: readonly DistributionAllocationUnallocatedTrack[]): readonly TableRow[] {
    return items.map((item) => ({
      id: item.trackId,
      cells: [
        { kind: "text", value: item.releaseTitle ?? "No release", strong: true },
        { kind: "text", value: item.trackTitle, strong: true },
        { kind: "text", value: item.isrc ?? "—", strong: false },
        { kind: "text", value: String(item.rowCount), strong: false },
        { kind: "text", value: String(item.batchCount), strong: false },
        { kind: "text", value: allocationBankBlockedByLabel(item), strong: item.mappingBlockedRowCount > 0 },
        { kind: "text", value: formatAllocationUnallocatedTotals(item.currencyTotals), strong: true },
        { kind: "text", value: `${formatDateOnly(item.firstSeenAt)} → ${formatDateOnly(item.lastSeenAt)}`, strong: false }
      ]
    }));
  }

  function formatAllocationBatchTotals(
    totals: readonly DistributionAllocationBatchCurrencyTotal[],
    key: "openAmountMicro" | "allocatedAmountMicro"
  ): string {
    if (totals.length === 0) return "—";
    return totals.map((total) => formatMoney(total[key], total.currency)).join(" · ");
  }

  function formatAllocationRunTotals(
    totals: readonly DistributionAllocationRunCurrencyTotal[],
    key: "grossMicro" | "recoupmentMicro" | "netMicro"
  ): string {
    if (totals.length === 0) return "—";
    return totals.map((total) => formatMoney(total[key], total.currency)).join(" · ");
  }

  function formatAllocationUnallocatedTotals(totals: readonly DistributionAllocationUnallocatedCurrencyTotal[]): string {
    if (totals.length === 0) return "—";
    return totals.map((total) => formatMoney(total.amountMicro, total.currency)).join(" · ");
  }

  function createSuspenseRows(items: readonly DistributionSuspenseWorkbenchRow[]): readonly TableRow[] {
    return items.map((item: DistributionSuspenseWorkbenchRow): TableRow => ({
      id: item.id,
      cells: [
        { kind: "text", value: item.id.slice(0, 8), strong: false },
        { kind: "text", value: item.batchReference, strong: true },
        { kind: "badge", value: item.reasonTitle, tone: "warning" },
        { kind: "badge", value: item.fixPath, tone: "active" },
        { kind: "text", value: item.trackTitle ?? "—", strong: true },
        { kind: "text", value: item.artistName ?? "—", strong: false },
        { kind: "text", value: item.isrc ?? "—", strong: false },
        { kind: "text", value: item.upc ?? "—", strong: false },
        { kind: "money", value: formatMoney(item.amountMicro, item.currency), tone: moneyTone(item.amountMicro) },
        { kind: "text", value: item.splitPercentage === null ? "—" : `${item.splitPercentage}%`, strong: false },
        { kind: "badge", value: item.status, tone: item.status === "open" ? "warning" : "success" }
      ]
    }));
  }

  function createSuspensePlaybookRows(items: readonly DistributionSuspenseReasonGroup[]): readonly TableRow[] {
    return items.map((item) => ({
      id: item.reasonCode,
      cells: [
        { kind: "text", value: item.title, strong: true },
        { kind: "text", value: String(item.rowCount), strong: true },
        { kind: "text", value: formatSuspenseTotals(item.totals), strong: true },
        { kind: "badge", value: item.fixPath, tone: "active" },
        { kind: "text", value: item.actionLabel, strong: false }
      ]
    }));
  }

  function createSuspenseKpis(workbench: DistributionSuspenseWorkbenchResponse | null): readonly DistributionKpi[] {
    const summary = workbench?.summary;
    return [
      { label: "Filtered rows", value: String(summary?.filteredRowCount ?? 0), detail: "exact live queue", tone: (summary?.filteredRowCount ?? 0) === 0 ? "success" : "warning", accent: true },
      { label: "Open exposure", value: formatSuspenseTotals(summary?.totals ?? []), detail: "kept separate by currency", tone: "warning", accent: false },
      { label: "Reason types", value: String(summary?.reasonTypeCount ?? 0), detail: "resolution playbook", tone: "info", accent: false }
    ];
  }

  function formatSuspenseTotals(totals: readonly DistributionSuspenseCurrencyTotal[]): string {
    if (totals.length === 0) return "—";
    return totals.map((total) => formatMoney(total.amountMicro, total.currency)).join(" · ");
  }

  function createStatementRows(items: readonly StatementSummary[]): readonly TableRow[] {
    return items.map((statement: StatementSummary): TableRow => ({
      id: statement.id,
      cells: [
        { kind: "text", value: statement.payeeName, strong: true },
        { kind: "money", value: formatMoney(statement.grossMicro, statement.currency), tone: "info" },
        { kind: "money", value: formatMoney(statement.recoupedMicro, statement.currency), tone: "warning" },
        { kind: "money", value: formatMoney(statement.paidMicro, statement.currency), tone: "success" },
        { kind: "money", value: formatMoney(statement.netPayableMicro, statement.currency), tone: "active" },
        { kind: "text", value: formatDateRange(statement.period_start, statement.period_end), strong: false },
        { kind: "badge", value: statement.status, tone: statement.status === "paid" ? "success" : statement.status === "void" ? "error" : statement.status === "draft" ? "info" : "warning" }
      ]
    }));
  }

  function createStatementLineRows(items: readonly StatementPrintLine[], trackItems: readonly TrackSummary[]): readonly TableRow[] {
    return items.map((line: StatementPrintLine, index: number): TableRow => ({
      id: `${line.trackId}:${index}`,
      cells: [
        { kind: "text", value: printTrackLabel(line.trackId, trackItems), strong: true },
        { kind: "text", value: line.quantity, strong: false },
        { kind: "money", value: formatMoney(line.grossShare, line.currency), tone: "info" },
        { kind: "money", value: formatMoney(line.recoupmentApplied, line.currency), tone: "warning" },
        { kind: "money", value: formatMoney(line.netPayable, line.currency), tone: "active" }
      ]
    }));
  }

  function normalizePaymentSummary(payment: PaymentSummary): PaymentSummary {
    const rolloutPayment = payment as PaymentSummary & {
      readonly linkedStatementIds?: readonly string[];
      readonly exchangeRate?: string | null;
      readonly method?: DistributionPaymentMethod;
      readonly notes?: string | null;
    };
    const linkedStatementIds = rolloutPayment.linkedStatementIds
      ?? (payment.statementId === null ? [] : [payment.statementId]);

    return {
      ...payment,
      linkedStatementIds,
      exchangeRate: rolloutPayment.exchangeRate ?? null,
      method: rolloutPayment.method ?? "bank_transfer",
      notes: rolloutPayment.notes ?? null
    };
  }

  function createPaymentRows(items: readonly PaymentSummary[]): readonly TableRow[] {
    return items.map((payment: PaymentSummary): TableRow => ({
      id: payment.id,
      cells: [
        { kind: "text", value: payment.id, strong: false },
        { kind: "text", value: payment.payeeName, strong: true },
        { kind: "money", value: formatMoney(payment.amountMicro, payment.currency), tone: moneyTone(payment.amountMicro) },
        { kind: "badge", value: payment.currency, tone: "muted" },
        { kind: "text", value: payment.exchangeRate ?? "—", strong: false },
        { kind: "text", value: payment.method.replaceAll("_", " "), strong: false },
        { kind: "text", value: payment.reference ?? "missing", strong: false },
        { kind: "badge", value: payment.status, tone: payment.status === "paid" ? "success" : "warning" },
        { kind: "text", value: payment.paidAt === null ? "unpaid" : formatDateOnly(payment.paidAt), strong: false },
        { kind: "text", value: String(payment.linkedStatementIds.length), strong: false }
      ]
    }));
  }

  function createRevenueRows(items: readonly DistributionRevenueRow[]): readonly TableRow[] {
    return items.map((row: DistributionRevenueRow): TableRow => ({
      id: row.id,
      cells: [
        { kind: "text", value: row.label, strong: true },
        { kind: "money", value: formatMoney(row.grossMicro, row.currency), tone: "info" },
        { kind: "money", value: formatMoney(row.netMicro, row.currency), tone: "success" },
        { kind: "money", value: formatMoney(row.payableMicro, row.currency), tone: "active" },
        { kind: "badge", value: row.currency, tone: "muted" }
      ]
    }));
  }

  function createRevenueChartPoints(items: readonly DistributionRevenueRow[]): readonly ChartPoint[] {
    return items.map((row: DistributionRevenueRow): ChartPoint => ({ label: row.label, value: row.barLevel }));
  }

  function createReconciliationKpis(data: DistributionReconciliationResponse | null): readonly DistributionKpi[] {
    if (data === null) {
      return [];
    }

    return data.kpis.map((kpi): DistributionKpi => ({
      label: kpi.label,
      value: kpi.value,
      detail: kpi.detail,
      tone: kpi.tone,
      accent: false
    }));
  }

  function createReconStatementRows(data: DistributionReconciliationResponse | null): readonly TableRow[] {
    if (data === null) {
      return [];
    }

    return data.statementsWithoutPaymentLinks.map((row): TableRow => ({
      id: row.id,
      cells: [
        { kind: "text", value: row.statementReference, strong: true },
        { kind: "text", value: row.payee, strong: false },
        { kind: "text", value: formatDateRange(row.periodStart, row.periodEnd), strong: false },
        { kind: "badge", value: row.currency, tone: "muted" },
        { kind: "money", value: formatMoney(row.netPayableMicro, row.currency), tone: moneyTone(row.netPayableMicro) }
      ]
    }));
  }

  function createReconExpenseRows(data: DistributionReconciliationResponse | null): readonly TableRow[] {
    if (data === null) {
      return [];
    }

    return data.expenseTermsMissingPayee.map((row): TableRow => ({
      id: row.id,
      cells: [
        { kind: "text", value: humanReference(row.expenseReference, row.contract), strong: true },
        { kind: "text", value: row.contract, strong: false },
        { kind: "text", value: row.description, strong: false },
        { kind: "money", value: formatMoney(row.amountMicro, row.currency), tone: "info" },
        { kind: "badge", value: row.currency, tone: "muted" },
        { kind: "badge", value: row.status, tone: "warning" }
      ]
    }));
  }

  function createReconMatchedRows(data: DistributionReconciliationResponse | null): readonly TableRow[] {
    if (data === null) {
      return [];
    }

    return data.matchedUnallocatedSamples.map((row): TableRow => ({
      id: row.id,
      cells: [
        { kind: "text", value: humanReference(row.sourceReference, row.track), strong: true },
        { kind: "text", value: humanReference(row.batch, row.track), strong: false },
        { kind: "text", value: humanReference(row.track, row.sourceReference), strong: false },
        { kind: "badge", value: row.currency, tone: "muted" },
        { kind: "money", value: formatMoney(row.grossMicro, row.currency), tone: "info" },
        { kind: "badge", value: row.status, tone: "warning" }
      ]
    }));
  }

  function createReconBalanceRows(data: DistributionReconciliationResponse | null): readonly TableRow[] {
    if (data === null) {
      return [];
    }

    return data.payeeBalancesSummary.map((row): TableRow => ({
      id: `${row.payee}-${row.currency}`,
      cells: [
        { kind: "text", value: row.payee, strong: true },
        { kind: "badge", value: row.currency, tone: "muted" },
        { kind: "text", value: String(row.rows), strong: false },
        { kind: "text", value: row.firstReference ?? "—", strong: false },
        { kind: "text", value: row.lastReference ?? "—", strong: false },
        { kind: "money", value: formatMoney(row.latestClosingMicro, row.currency), tone: moneyTone(row.latestClosingMicro) }
      ]
    }));
  }

  function createAliasRows(items: readonly DistributionAlias[]): readonly TableRow[] {
    return items.map((alias: DistributionAlias): TableRow => ({
      id: alias.id,
      cells: [
        { kind: "text", value: alias.aliasText, strong: true },
        { kind: "text", value: alias.target, strong: false },
        { kind: "badge", value: alias.targetType, tone: "muted" }
      ]
    }));
  }

  function createDuplicateRows(items: readonly DistributionDuplicate[]): readonly TableRow[] {
    return items.map((duplicate: DistributionDuplicate): TableRow => ({
      id: duplicate.id,
      cells: [
        { kind: "text", value: duplicate.label, strong: true },
        { kind: "badge", value: duplicate.kind, tone: "muted" },
        { kind: "text", value: String(duplicate.count), strong: false },
        { kind: "text", value: duplicate.resolutionAllowed ? duplicate.sampleLabels.join(" · ") : `${duplicate.sampleLabels.join(" · ")} · same ISRC earnings`, strong: false },
        { kind: "badge", value: duplicate.resolutionAllowed ? "review required" : "aggregation only", tone: duplicate.resolutionAllowed ? "warning" : "info" }
      ]
    }));
  }

  function duplicateCanMerge(duplicateId: string): boolean {
    return duplicates.some((duplicate) => duplicate.id === duplicateId && duplicate.resolutionAllowed);
  }

  function duplicateMergeDisabledReason(duplicateId: string): string | null {
    return duplicateCanMerge(duplicateId) ? null : "Same-ISRC earnings are valid revenue rows and cannot be merged.";
  }

  function createAliasTargetOptions(
    targetType: DistributionAliasTargetType,
    payeeItems: readonly PayeeSummary[],
    releaseItems: readonly ReleaseSummary[],
    trackItems: readonly TrackSummary[]
  ): readonly SelectOption[] {
    if (targetType === "payee") {
      return sortOptionsAlphabetically([
        { label: "Select a payee", value: "" },
        ...payeeItems.map((payee: PayeeSummary): SelectOption => ({ label: `${payee.displayName} · ${payee.defaultCurrency}`, value: payee.id }))
      ], 1);
    }

    if (targetType === "release") {
      return sortOptionsAlphabetically([
        { label: "Select a release", value: "" },
        ...releaseItems.map((release: ReleaseSummary): SelectOption => ({ label: `${release.title} · ${release.artistName}`, value: release.id }))
      ], 1);
    }

    if (targetType === "track") {
      return sortOptionsAlphabetically([
        { label: "Select a track", value: "" },
        ...trackItems.map((track: TrackSummary): SelectOption => ({ label: `${track.title} · ${track.artistName}`, value: track.id }))
      ], 1);
    }

    return [{ label: "No selection", value: "" }];
  }

  function createAuditRows(items: readonly AuditLogEntry[]): readonly TableRow[] {
    return items.map((entry: AuditLogEntry): TableRow => ({
      id: entry.id,
      cells: [
        { kind: "text", value: formatDateOnly(entry.occurredAt), strong: false },
        { kind: "text", value: auditActorLabel(entry), strong: false },
        { kind: "badge", value: entry.action, tone: "info" },
        { kind: "text", value: `${entry.entityType} · ${entry.entityReference}`, strong: false },
        { kind: "text", value: entry.idempotencyKey ?? "—", strong: false },
        { kind: "text", value: auditContextLabel(entry.context), strong: false }
      ]
    }));
  }

  function auditContextLabel(context: Readonly<Record<string, string>>): string {
    const visibleEntries = Object.entries(context)
      .filter(([key]) => key !== "idempotencyKey")
      .map(([key, value]) => `${key}=${value}`);
    return visibleEntries.length === 0 ? "—" : visibleEntries.join(" · ");
  }

  function createFxRateRows(items: readonly DistributionFxRate[]): readonly TableRow[] {
    const sorted = [...items].sort((left: DistributionFxRate, right: DistributionFxRate): number => {
      if (left.effectiveDate !== right.effectiveDate) {
        return right.effectiveDate.localeCompare(left.effectiveDate);
      }

      if (left.fromCurrency !== right.fromCurrency) {
        return left.fromCurrency.localeCompare(right.fromCurrency);
      }

      return left.toCurrency.localeCompare(right.toCurrency);
    });

    return sorted.map((rate: DistributionFxRate, index: number): TableRow => ({
      id: `${rate.fromCurrency}-${rate.toCurrency}-${rate.effectiveDate}-${String(index)}`,
      cells: [
        { kind: "badge", value: rate.fromCurrency, tone: "muted" },
        { kind: "badge", value: rate.toCurrency, tone: "muted" },
        { kind: "text", value: rate.effectiveDate, strong: false },
        { kind: "text", value: rate.rate, strong: true }
      ]
    }));
  }

  function isLoadingStatus(status: RequestStatus): boolean {
    return isRequestStatusLoading(status);
  }

  function normalizeCurrencyCode(value: string): CurrencyCode | null {
    const normalized = value.trim().toUpperCase();
    return /^[A-Z]{3}$/u.test(normalized) ? normalized : null;
  }

  function toNullableCurrency(value: CurrencyCode | "all"): CurrencyCode | null {
    return value === allValue ? null : value;
  }

  function toNullablePayeeFilter(value: string): string | null {
    return value === allValue || value.trim() === "" ? null : value;
  }

  function toNullableStoreFilter(value: string): string | null {
    return value === allValue || value.trim() === "" ? null : value;
  }

  function normalizeIsoDate(value: string): string | null {
    const normalized = value.trim();
    return /^\d{4}-\d{2}-\d{2}$/u.test(normalized) ? normalized : null;
  }

  function normalizeFxRateValue(value: string): string | null {
    const normalized = value.trim().replace(/,/gu, ".");

    if (!/^\d+(?:\.\d{1,10})?$/u.test(normalized)) {
      return null;
    }

    if (/^0(?:\.0+)?$/u.test(normalized)) {
      return null;
    }

    return normalized;
  }

  function tableStateFor(status: RequestStatus, count: number): "loading" | "error" | "empty" | "default" {
    if (isLoadingStatus(status)) {
      return "loading";
    }

    if (status === "error") {
      return "error";
    }

    if (count === 0) {
      return "empty";
    }

    return "default";
  }

  function createImportToolbarFilters(state: ImportUiState): readonly ToolbarFilter[] {
    return [
      { label: "Source", value: state.source, active: true, disabled: false, actionId: "source", title: "Change import source" },
      { label: "File", value: state.fileName === "" ? "no file selected" : state.fileName, active: false, disabled: false, actionId: "file", title: "Clear selected file" },
      { label: "Status", value: state.status, active: false, disabled: false, actionId: "status", title: "Run preview" }
    ];
  }

  function toNullableImportSource(value: ImportSourceFilter): "kontor" | "routenote" | null {
    if (value === "kontor" || value === "routenote") {
      return value;
    }

    return null;
  }

  function toNullableImportBatchStatus(
    value: ImportBatchStatusFilter
  ): "uploaded" | "mapped" | "validated" | "failed" | "voided" | null {
    if (value === "uploaded" || value === "mapped" || value === "validated" || value === "failed" || value === "voided") {
      return value;
    }

    return null;
  }

  function toNullableBatchFilter(value: string): string | null {
    if (value === allValue || value.trim() === "") {
      return null;
    }

    return value;
  }

  function toNullableCatalogStatus(value: CatalogStatusFilter): "draft" | "released" | "archived" | null {
    if (value === "draft" || value === "released" || value === "archived") {
      return value;
    }

    return null;
  }

  function toNullableMappingStatus(value: MappingStatusFilter): "unmapped" | "suggested" | "mapped" | null {
    if (value === "unmapped" || value === "suggested" || value === "mapped") {
      return value;
    }

    return null;
  }

  function toNullableSuspenseStatus(value: SuspenseStatusFilter): "open" | "resolved" | null {
    if (value === "open" || value === "resolved") {
      return value;
    }

    return null;
  }

  function toNullablePaymentStatus(value: PaymentStatusFilter): "draft" | "paid" | "voided" | null {
    if (value === "draft" || value === "paid" || value === "voided") {
      return value;
    }

    return null;
  }

  function readInputValue(event: Event): string {
    const target = event.currentTarget;

    if (!(target instanceof HTMLInputElement)) {
      throw new Error("Expected input event target.");
    }

    return target.value;
  }

  function distributionImportSourceFromValue(value: string): ImportSource {
    if (value === "kontor" || value === "routenote") {
      return value;
    }

    throw new Error(`Unknown Distribution import source: ${value}.`);
  }

  // TSV twin of parseCsvRecords (bank-parser handles comma-separated files only):
  // first non-empty line is the header, remaining lines become keyed records.
  function parseTsvRecords(text: string): readonly Readonly<Record<string, string>>[] {
    const lines = text.split(/\r\n|\r|\n/u).filter((line: string): boolean => line.trim().length > 0);
    const headerLine = lines[0];

    if (lines.length < 2 || headerLine === undefined) {
      return [];
    }

    const header = headerLine.split("\t").map((value: string): string => value.trim());

    return lines.slice(1).map((line: string): Readonly<Record<string, string>> => {
      const cells = line.split("\t").map((value: string): string => value.trim());
      const record: Record<string, string> = {};

      for (let index = 0; index < header.length; index += 1) {
        const key = header[index];

        if (key !== undefined && key.length > 0) {
          record[key] = cells[index] ?? "";
        }
      }

      return record;
    });
  }

  function parseKontorRecords(text: string): readonly Readonly<Record<string, string>>[] {
    const lines = text.split(/\r\n|\r|\n/u).filter((line: string): boolean => line.trim().length > 0);
    const headerIndex = lines.findIndex((line: string): boolean => line.includes("Royalty Amount Customer") && line.includes(";"));
    const headerLine = lines[headerIndex];
    if (headerIndex < 0 || headerLine === undefined) return [];

    const currency = readKontorMetadata(lines, "Currency") ?? "";
    const accountingPeriod = readKontorMetadata(lines, "Accounting Period") ?? "";
    const header = parseDelimitedLine(headerLine, ";");

    return lines.slice(headerIndex + 1).map((line: string): Readonly<Record<string, string>> => {
      const cells = parseDelimitedLine(line, ";");
      const record: Record<string, string> = { Currency: currency, "Report Period": accountingPeriod };
      for (let index = 0; index < header.length; index += 1) {
        const key = header[index];
        if (key !== undefined && key.length > 0) record[key] = cells[index] ?? "";
      }
      return record;
    });
  }

  function detectImportSource(content: string, fallback: ImportSource): ImportSource {
    if (content.includes("KONTOR NEW MEDIA Royalty Statement") || content.includes("Royalty Amount Customer")) {
      return "kontor";
    }

    return fallback;
  }

  function readKontorMetadata(lines: readonly string[], label: string): string | null {
    const prefix = `${label}:`;
    const line = lines.find((candidate: string): boolean => candidate.trim().startsWith(prefix));
    if (line === undefined) return null;
    const value = line.slice(line.indexOf(":") + 1).trim();
    return value.length > 0 ? value : null;
  }

  async function parseRouteNoteWorkbook(content: ArrayBuffer): Promise<readonly Readonly<Record<string, string>>[]> {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(content, { type: "array", raw: true });
    const sheetName = workbook.SheetNames[0];
    if (sheetName === undefined) return [];
    const sheet = workbook.Sheets[sheetName];
    if (sheet === undefined) return [];
    const values = XLSX.utils.sheet_to_json<readonly unknown[]>(sheet, { header: 1, defval: "", raw: true });
    const header = values[0]?.map(spreadsheetCellText) ?? [];
    if (header.length === 0) return [];

    return values.slice(1).flatMap((cells: readonly unknown[]): readonly Readonly<Record<string, string>>[] => {
      const record: Record<string, string> = {};
      for (let index = 0; index < header.length; index += 1) {
        const key = header[index];
        if (key !== undefined && key.length > 0) record[key] = spreadsheetCellText(cells[index]);
      }
      const streamCount = parseRouteNoteCount(record.Stream);
      const downloadCount = parseRouteNoteCount(record.Downloads);
      const creationCount = parseRouteNoteCount(record.Creations);
      const month = routeNoteMonthNumber(record.Month);
      const year = record.Year?.trim();
      record.Currency = "USD";
      record.Store = record.Retailer ?? "RouteNote";
      record.Quantity = String(streamCount + downloadCount + creationCount);
      if (month !== null && year !== undefined && /^\d{4}$/u.test(year)) record["Report Period"] = `${year}-${month}`;
      return record["Track Title"]?.trim() === "" && record.ISRC?.trim() === "" ? [] : [record];
    });
  }

  function spreadsheetCellText(value: unknown): string {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function parseRouteNoteCount(value: string | undefined): bigint {
    const normalized = value ?? "";
    if (!/^\d+$/u.test(normalized)) return 0n;
    return BigInt(normalized);
  }

  function routeNoteMonthNumber(value: string | undefined): string | null {
    const month = value?.trim().split("-")[1]?.toUpperCase();
    const months: Readonly<Record<string, string>> = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
    return month === undefined ? null : months[month] ?? null;
  }

  function parseDelimitedLine(line: string, delimiter: string): readonly string[] {
    const cells: string[] = [];
    let cell = "";
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index] ?? "";
      if (character === '"') {
        if (inQuotes && line[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (character === delimiter && !inQuotes) {
        cells.push(cell.trim());
        cell = "";
      } else {
        cell += character;
      }
    }
    cells.push(cell.trim());
    return cells;
  }

  // FNV-1a 32-bit over the raw file text: a stable client-side content fingerprint
  // used as the preview checksum (the server folds it into its idempotency fingerprint).
  function importContentChecksum(content: string | ArrayBuffer): string {
    let hash = 0x811c9dc5;

    const values = typeof content === "string" ? Array.from(content, (character: string): number => character.charCodeAt(0)) : new Uint8Array(content);
    for (const value of values) {
      hash ^= value;
      hash = Math.imul(hash, 0x01000193);
    }

    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function formatMoney(amountMicro: string, currency: CurrencyCode): string {
    return formatMoneyValue(amountMicro, currency);
  }

  function moneyTone(amountMicro: string): Tone {
    return moneyToneForValue(amountMicro);
  }

  function auditActorLabel(entry: AuditLogEntry): string {
    const actorEmail = entry.context.actorEmail ?? entry.context.actor_email ?? entry.context.actor;

    if (actorEmail !== undefined && actorEmail.trim() !== "") {
      return actorEmail;
    }

    return "Verified actor";
  }

  function humanReference(value: string, fallback: string): string {
    const trimmed = stripRawMoneySuffix(value.trim());
    const [firstPart, ...rest] = trimmed.split(" · ");

    if (firstPart !== undefined && isUuidLike(firstPart) && rest.length > 0) {
      return rest.join(" · ");
    }

    if (isUuidLike(trimmed)) {
      return stripRawMoneySuffix(fallback.trim());
    }

    return trimmed;
  }

  function stripRawMoneySuffix(value: string): string {
    return value.replace(/ · [A-Z]{3} -?\d+\.\d{3,}$/u, "");
  }

  function isUuidLike(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  function formatBasisPoints(value: number): string {
    const whole = Math.trunc(value / 100);
    const fraction = value % 100;

    if (fraction === 0) {
      return `${String(whole)}%`;
    }

    return `${String(whole)}.${fraction.toString().padStart(2, "0")}%`;
  }

  function formatConfidence(confidenceBp: number): string {
    return formatBasisPoints(confidenceBp);
  }

  function confidenceTone(confidenceBp: number): Tone {
    if (confidenceBp >= 9000) {
      return "success";
    }

    if (confidenceBp >= 7000) {
      return "info";
    }

    return "warning";
  }

  function payeeName(payeeId: string, payeeItems: readonly PayeeSummary[]): string {
    const payee = payeeItems.find((item: PayeeSummary): boolean => item.id === payeeId);

    if (payee === undefined) {
      return payeeId;
    }

    return payee.displayName;
  }

  function exactImportAction(action: "review_mapping" | "apply_rules" | "validate" | "retry"): string {
    if (action === "review_mapping") {
      return "Review mapping";
    }

    if (action === "apply_rules") {
      return "Apply rules";
    }

    if (action === "validate") {
      return "Validate batch";
    }

    return "Retry import";
  }

  function catalogTone(status: "draft" | "released" | "archived"): Tone {
    if (status === "released") {
      return "success";
    }

    if (status === "draft") {
      return "warning";
    }

    return "muted";
  }

  function suspenseResolutionFor(item: DistributionSuspenseWorkbenchRow): "map_to_track" | "retry_row" | "mark_resolved" {
    if (item.resolutionMode === "map") return "map_to_track";
    if (item.resolutionMode === "retry") return "retry_row";
    return "mark_resolved";
  }

  function pageUsesPeriodControl(pageId: DistributionPageId): boolean {
    return pageId === "dashboard" ||
      pageId === "allocations" ||
      pageId === "suspense" ||
      pageId === "statements" ||
      pageId === "payments" ||
      pageId === "revenue";
  }

  function writeDisabledTitle(): string {
    return writesEnabled ? "" : writeGateMessage;
  }

  function createIdempotencyKey(scope: string): string {
    return `distribution-${scope}-${Date.now().toString()}`;
  }

  function apiErrorMessage(responseBody: string): string | null {
    let payload: unknown;

    try {
      payload = JSON.parse(responseBody);
    } catch {
      return null;
    }

    if (typeof payload !== "object" || payload === null || !("error" in payload)) {
      return null;
    }

    const error = payload.error;
    if (typeof error !== "object" || error === null || !("message" in error)) {
      return null;
    }

    const message = error.message;
    return typeof message === "string" && message.trim() !== "" ? message : null;
  }

  function getErrorMessage(error: unknown): string {
    if (error instanceof ApiClientHttpError) {
      return apiErrorMessage(error.responseBody) ?? error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "Unknown error.";
  }
</script>

<svelte:head>
  <title>ë • Distribution</title>
</svelte:head>

<WorkspaceShell
  workspace="distribution"
  brandLabel="ë • distribution"
  homeHref="/console/distribution/dashboard"
  navLabel="Navigation Distribution"
  navItems={[]}
  navGroups={shellNavGroups}
  statusLabel="erh/v1"
  statusValue={writesEnabled ? "write access enabled" : "read-only"}
  userInitial={session.initials}
  userName={session.displayName}
  userContext={session.roleLabel}
  signOutHref="#"
  onNavigate={handleShellNavigate}
  onSignOut={onLogout}
>
  <div class={`content distribution-page-${activePageId}`}>
      <PageHeader
        workspace="distribution"
        eyebrow="Distribution"
        title={activePage.title}
        description={activePage.subtitle}
        meta=""
        statusLabel=""
        statusTone="muted"
      />

      {#if periodControlVisible}
        <section class="period-control ehq-edge-surface" aria-label="Period controls">
          <Select
            id="distribution-period-scope"
            label="Period"
            value={periodScope}
            options={periodOptions}
            state="default"
            message=""
            onchange={updatePeriodScope}
          />
          {#if periodScope === "custom"}
            <label>
              <span>From</span>
              <input type="date" value={activeRange.from} max={activeRange.to} onchange={updateCustomFrom} />
            </label>
            <label>
              <span>To</span>
              <input type="date" value={activeRange.to} min={activeRange.from} onchange={updateCustomTo} />
            </label>
          {/if}
          <p>{activePageId === "dashboard" && periodScope === "all" ? `Import date: ${rangeLabel(periodDisplayRange)}` : rangeLabel(periodDisplayRange)}</p>
        </section>
      {/if}

      <div bind:this={actionBannerElement}>
        {#if mutationReceipt !== null && mutationReceiptPageId === activePageId}
          <Alert tone="success" title="Action accepted" message="Audit recorded." dismissible={false} />
        {/if}

        {#if runReceipt !== null && runReceiptPageId === activePageId}
          <Alert
            tone="info"
            title={runReceiptIsPreview ? "Preview ready" : "Run scheduled"}
            message={runReceiptIsPreview
              ? "Read-only preview. No allocation run, lock, financial data, or audit record was created."
              : "Allocation run accepted. The workflow lock protects this financial write while it completes."}
            dismissible={false}
          />
        {/if}

        {#if actionNotice !== null && actionNoticePageId === activePageId}
          <Alert tone="info" title="Result" message={actionNotice} dismissible={false} />
        {/if}

        {#if actionError !== null && actionErrorPageId === activePageId}
          <Alert tone="error" title="Error" message={actionError} dismissible={false} />
        {/if}
      </div>

      {#if activePageId === "dashboard"}
        <section class="kpi-grid" aria-label="KPI Distribution">
          {#each dashboardKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={isLoadingStatus(dashboardState.status) ? "loading" : "default"} accent={kpi.accent} />
          {/each}
        </section>
        <section class="dashboard-grid">
          <BarsChart title="Revenue by source" points={revenueChartPoints} tone="active" />
          <Table title="Distribution readiness (workspace-wide)" columns={dashboardReadinessColumns} rows={dashboardReadinessRows} state={tableStateFor(dashboardState.status, dashboardReadinessRows.length)} actionLabel="" rowActions={dashboardReadinessRowActions} />
        </section>
        <section class="dashboard-top-grid">
          <Table title="Top artists" columns={dashboardTopColumns} rows={dashboardArtistRows} state={tableStateFor(dashboardState.status, dashboardArtistRows.length)} actionLabel="" />
          <Table title="Top tracks" columns={dashboardTopColumns} rows={dashboardTrackRows} state={tableStateFor(dashboardState.status, dashboardTrackRows.length)} actionLabel="" />
          <Table title="Top stores" columns={dashboardTopColumns} rows={dashboardStoreRows} state={tableStateFor(dashboardState.status, dashboardStoreRows.length)} actionLabel="" />
        </section>
      {:else if activePageId === "imports"}
        <Toolbar label="Import Kontor RouteNote" filters={importToolbarFilters} actionLabel="" loading={isLoadingStatus(importState.status)} onFilterSelect={selectImportToolbarFilter} />
        <section class="contracts-actions ehq-edge-surface">
          <Button label="Import one file" variant="primary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Import one file" onclick={openImportPanel} />
          <Button label="Start fresh" variant="danger" size="medium" type="button" disabled={!writesEnabled} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Delete all Distribution data" title={writeDisabledTitle()} onclick={openImportResetPanel} />
          <span>One Kontor CSV/TSV or RouteNote Excel export at a time: select, preview, then process royalties.</span>
        </section>
        {#if importPanelOpen}
          <Drawer open={true} presentation="overlay" showFooter={false} title="Import one file" badgeLabel="audited batch" badgeTone="info" body="" primaryAction="" secondaryAction="Close" state="default" onSecondary={closeImportPanel}>
            {#snippet content()}
        <section class="form-panel" aria-label="Import Kontor RouteNote">
          <Select id="distribution-import-source" label="Source" value={importState.source} options={importSourceOptions} state="default" message="" onchange={updateImportSource} />
          <label>
            <span>Export file</span>
            <input type="file" bind:this={importFileInput} onchange={handleImportFile} />
          </label>
          <Button label="Choose file" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Choose one import file" title="Choose one Kontor CSV/TSV or RouteNote Excel export" onclick={openImportFilePicker} />
          <Button label="Preview" variant="secondary" size="medium" type="button" disabled={!canPreviewImport} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Preview import file" title={canPreviewImport ? "" : "Choose an import file first"} onclick={previewImport} />
          <Button label="Process royalties" variant="primary" size="medium" type="button" disabled={!canConfirmImport || !writesEnabled} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Process royalties" title={writeDisabledTitle()} onclick={confirmImport} />
          <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Cancel import" onclick={closeImportPanel} />
        </section>
            {/snippet}
          </Drawer>
        {/if}
        {#if importResetPanelOpen}
          <Drawer open={true} presentation="overlay" showFooter={false} title="Start fresh" badgeLabel="administrator only" badgeTone="warning" body="" primaryAction="" secondaryAction="Cancel" state="default" onSecondary={closeImportResetPanel}>
            {#snippet content()}
              <section class="form-panel" aria-label="Delete all Distribution data">
                <div class="panel-context"><strong>Delete all Distribution data</strong><span>Imports, catalogue, contracts, payees, aliases, rules, allocation history, statements, and payments will be permanently removed. The audit log and shared FX rates remain.</span></div>
                <Input id="distribution-import-reset-confirmation" label="Type confirmation" value={importResetConfirmation} placeholder="DELETE ALL DISTRIBUTION DATA" type="text" state="default" message="" oninput={(value) => importResetConfirmation = value} />
                <Button label="Delete all Distribution data" variant="danger" size="medium" type="button" disabled={!writesEnabled || importResetConfirmation !== "DELETE ALL DISTRIBUTION DATA"} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Delete all Distribution data" title={writeDisabledTitle()} onclick={resetDistributionImports} />
              </section>
            {/snippet}
          </Drawer>
        {/if}
        <section class="filter-strip ehq-edge-surface" aria-label="Import filters">
          <Select id="distribution-import-filter" label="Source filter" value={importSourceFilter} options={importFilterOptions} state="default" message="" onchange={updateImportFilter} />
          <Select id="distribution-import-status" label="Status filter" value={importStatusFilter} options={importStatusFilterOptions} state="default" message="" onchange={updateImportStatusFilter} />
          <Button label="Filter" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Apply import filters" onclick={loadImportBatches} />
        </section>
        <section class="import-result ehq-edge-surface" class:error={importState.status === "error"} aria-live="polite">
          <strong>{importState.message}</strong>
          {#if importState.preview !== null}
            <span>{importState.preview.acceptedRowCount} accepted · {importState.preview.unmappedRowCount} in suspense · {formatMoney(importState.preview.payableMicro, importState.preview.currencyCodes[0] ?? "USD")}</span>
            <span>{importState.preview.statementReference} · keys {importState.preview.joinKeys.join(" + ")}</span>
          {/if}
          {#if importState.confirm !== null}
            <span>{importState.confirm.importedRoyaltyEventCount} royalty events imported.</span>
          {/if}
        </section>
        <Table title="Imported data batches" columns={importColumns} rows={importRows} rowActions={importRowActions} state={tableStateFor(importBatchesState.status, importBatches.length)} actionLabel="" pagination={importPagination} />
      {:else if activePageId === "mapping"}
        <section class="filter-strip ehq-edge-surface" aria-label="Mapping filters">
          <Input id="distribution-mapping-search" label="Search" value={mappingSearch} placeholder="Title, artist or store" type="search" state="default" message="" oninput={updateMappingSearch} />
          <Select id="distribution-mapping-status" label="Status" value={mappingStatusFilter} options={mappingStatusOptions} state="default" message="" onchange={updateMappingStatus} />
          <Select id="distribution-mapping-batch" label="Batch" value={mappingBatchFilter} options={mappingBatchFilterOptions} state="default" message="" onchange={updateMappingBatchFilter} />
          <Button label="Filter" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Apply mapping filters" onclick={loadMappingRows} />
          <Button label="Automate" variant="secondary" size="medium" type="button" disabled={!mappingRulesSelectionIsApplicable} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Automate safe mapping matches" title={mappingRulesDisabledReason ?? writeDisabledTitle()} onclick={applyMappingRules} />
          <Button label="Select all (page)" variant="secondary" size="medium" type="button" disabled={mappingRows.length === 0} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Select all visible mapping rows" onclick={selectAllVisibleMappingRows} />
          <Button label="Clear selection" variant="secondary" size="medium" type="button" disabled={selectedMappingRowIds.length === 0} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Clear mapping selection" onclick={clearMappingSelection} />
          <Button label="Apply reusable rules" variant="primary" size="medium" type="button" disabled={!mappingRulesSelectionIsApplicable} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Apply reusable rules" title={mappingRulesDisabledReason ?? writeDisabledTitle()} onclick={applyMappingRules} />
          <span class="ehq-type-label-mono">{selectedMappingRowIds.length} selected · {filteredMappingRows.length} visible</span>
        </section>
        <Table title="Rows to review" columns={mappingColumns} rows={mappingTableRows} state={isLoadingStatus(mappingState.status) ? "loading" : mappingState.status === "error" ? "error" : filteredMappingRows.length === 0 ? "empty" : "default"} actionLabel="" rowActions={mappingRowActions} pagination={mappingPagination} />
      {:else if activePageId === "catalog"}
        <section class="filter-strip ehq-edge-surface" aria-label="Catalog filters">
          <Input id="distribution-catalog-search" label="Search" value={catalogSearch} placeholder="Track, artist, ISRC, UPC or release" type="search" state="default" message="" oninput={updateCatalogSearch} />
          <Select id="distribution-catalog-artist-source" label="Artist source" value={catalogArtistSource} options={catalogArtistSourceOptions} state="default" message="" onchange={updateCatalogArtistSource} />
          <Input id="distribution-catalog-isrc" label="ISRC" value={catalogIsrc} placeholder="Exact or partial ISRC" type="search" state="default" message="" oninput={updateCatalogIsrc} />
          <Select id="distribution-catalog-role" label="Role" value={catalogRoleFilter} options={catalogRoleOptions} state="default" message="" onchange={updateCatalogRole} />
          <Select id="distribution-catalog-review" label="Review" value={catalogReviewFilter} options={catalogReviewOptions} state="default" message="" onchange={updateCatalogReview} />
          <Select id="distribution-catalog-label" label="Label" value={catalogLabelFilter} options={catalogLabelOptions} state="default" message="" onchange={updateCatalogLabel} />
          <label>
            <span>Release from</span>
            <input type="date" value={catalogReleaseFrom} onchange={updateCatalogReleaseFrom} />
          </label>
          <label>
            <span>Release to</span>
            <input type="date" value={catalogReleaseTo} onchange={updateCatalogReleaseTo} />
          </label>
          <Select id="distribution-catalog-status" label="Status" value={catalogStatusFilter} options={catalogFilterOptions} state="default" message="" onchange={updateCatalogStatus} />
          <Button label="Filter" variant="secondary" size="medium" type="button" disabled={false} loading={isLoadingStatus(catalogState.status)} locked={false} focus={false} ariaLabel="Apply catalog filters" onclick={loadCatalog} />
          <Button label="Clear" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Clear catalog filters" onclick={clearCatalogFilters} />
        </section>
        <section class="kpi-grid" aria-label="Catalog KPIs">
          {#each catalogKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={isLoadingStatus(catalogState.status) ? "loading" : "default"} accent={kpi.accent} />
          {/each}
        </section>
        <section class="contracts-actions ehq-edge-surface">
          <Button label="New release" variant="primary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="New release" onclick={() => openCatalogPanel("release")} />
          <Button label="New track" variant="primary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="New track" onclick={() => openCatalogPanel("track")} />
          <Button label={`Apply ${suggestedCatalogArtistTracks.length} visible artist suggestion${suggestedCatalogArtistTracks.length === 1 ? "" : "s"}`} variant="secondary" size="medium" type="button" disabled={!writesEnabled || suggestedCatalogArtistTracks.length === 0} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Apply visible high-confidence Catalog Artist suggestions" title={writeDisabledTitle()} onclick={promoteVisibleCatalogArtistSuggestions} />
          <span>Imported contributors remain source data; reviewed corrections are append-only audited overrides.</span>
        </section>
        {#if catalogPanelMode === "release"}
          <Drawer open={true} presentation="overlay" showFooter={false} title="New release" badgeLabel="catalog" badgeTone="info" body="" primaryAction="" secondaryAction="Close" state="default" onSecondary={closeCatalogPanel}>
            {#snippet content()}
              <section class="form-panel" aria-label="New release">
                <Input id="distribution-release-title" label="Title" value={releaseTitleInput} placeholder="" type="text" state="default" message="" oninput={updateReleaseTitle} />
                <Input id="distribution-release-artist" label="Artist" value={releaseArtistInput} placeholder="" type="text" state="default" message="" oninput={updateReleaseArtist} />
                <Input id="distribution-release-label" label="Label (optional)" value={releaseLabelInput} placeholder="" type="text" state="default" message="" oninput={updateReleaseLabel} />
                <Input id="distribution-release-upc" label="UPC (optional)" value={releaseUpcInput} placeholder="" type="text" state="default" message="" oninput={updateReleaseUpc} />
                <Select id="distribution-release-status" label="Status" value={releaseStatusInput} options={catalogStatusOptions} state="default" message="" onchange={updateReleaseStatus} />
                <label>
                  <span>Release date (optional)</span>
                  <input type="date" value={releaseDateInput} onchange={updateReleaseDate} />
                </label>
                <Button label="Create release" variant="primary" size="medium" type="button" disabled={!writesEnabled || releaseTitleInput.trim() === "" || releaseArtistInput.trim() === ""} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Create release" title={writesEnabled ? (releaseTitleInput.trim() === "" ? "Enter a release title first" : releaseArtistInput.trim() === "" ? "Enter an artist name first" : "") : writeGateMessage} onclick={createRelease} />
                <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Cancel release creation" onclick={closeCatalogPanel} />
              </section>
            {/snippet}
          </Drawer>
        {:else if catalogPanelMode === "track"}
          <Drawer open={true} presentation="overlay" showFooter={false} title="New track" badgeLabel="catalog" badgeTone="info" body="" primaryAction="" secondaryAction="Close" state="default" onSecondary={closeCatalogPanel}>
            {#snippet content()}
              <section class="form-panel" aria-label="New track">
                <Input id="distribution-track-title" label="Title" value={trackTitleInput} placeholder="" type="text" state="default" message="" oninput={updateTrackTitle} />
                <Input id="distribution-track-artist" label="Artist" value={trackArtistInput} placeholder="" type="text" state="default" message="" oninput={updateTrackArtist} />
                <Input id="distribution-track-isrc" label="ISRC (optional)" value={trackIsrcInput} placeholder="" type="text" state="default" message="" oninput={updateTrackIsrc} />
                <Select id="distribution-track-release" label="Release" value={trackReleaseIdInput} options={trackReleaseSelectOptions} state="default" message="" onchange={updateTrackRelease} />
                <Select id="distribution-track-status" label="Status" value={trackStatusInput} options={catalogStatusOptions} state="default" message="" onchange={updateTrackStatus} />
                <Button label="Create track" variant="primary" size="medium" type="button" disabled={!writesEnabled || trackTitleInput.trim() === "" || trackArtistInput.trim() === ""} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Create track" title={writesEnabled ? (trackTitleInput.trim() === "" ? "Enter a track title first" : trackArtistInput.trim() === "" ? "Enter an artist name first" : "") : writeGateMessage} onclick={createTrack} />
                <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Cancel track creation" onclick={closeCatalogPanel} />
              </section>
            {/snippet}
          </Drawer>
        {/if}
        {#if selectedCatalogTrack !== null}
          <Drawer open={true} presentation="overlay" showFooter={false} title="Contributor review" badgeLabel={catalogReviewLabel(selectedCatalogTrack.reviewReason)} badgeTone="warning" body="" primaryAction="" secondaryAction="Close" state="default" onSecondary={closeCatalogContributorPanel}>
            {#snippet content()}
          <section class="catalog-contributor-panel" aria-label="Contributor review">
            <div class="catalog-contributor-heading">
              <div>
                <span class="ehq-type-label-mono">Contributor review</span>
                <strong>{selectedCatalogTrack.title} · {selectedCatalogTrack.catalogArtist}</strong>
              </div>
              <span>{catalogReviewLabel(selectedCatalogTrack.reviewReason)} · current source: {selectedCatalogTrack.contributorSource}</span>
            </div>
            <div class="catalog-contributor-list">
              {#each catalogContributorDrafts as contributor, index (`${contributor.name}-${contributor.role}-${index}`)}
                <div class="catalog-contributor-row">
                  <span>{contributor.name}</span>
                  <span>{formatCatalogRole(contributor.role)}</span>
                  <Button label={payees.some((payee) => payee.displayName.trim().toLocaleLowerCase() === contributor.name.trim().toLocaleLowerCase()) ? "Link payee" : "Create & link payee"} variant="secondary" size="small" type="button" disabled={!writesEnabled} loading={mutationInFlight} locked={false} focus={false} ariaLabel={`Create or link payee for ${contributor.name}`} title="Creates or links a Distribution payee only; it does not create a royalty entitlement." onclick={() => ensureContributorPayee(contributor.name)} />
                  <Button label="Remove" variant="secondary" size="small" type="button" disabled={catalogContributorDrafts.length === 1} loading={mutationInFlight} locked={false} focus={false} ariaLabel={`Remove ${contributor.name}`} onclick={() => removeCatalogContributor(index)} />
                </div>
              {/each}
            </div>
            <div class="form-panel">
              <Input id="distribution-catalog-contributor-name" label="Contributor" value={catalogContributorNameInput} placeholder="Person or project name" type="text" state="default" message="" oninput={updateCatalogContributorName} />
              <Select id="distribution-catalog-contributor-role" label="Role" value={catalogContributorRoleInput} options={catalogContributorRoleOptions} state="default" message="" onchange={updateCatalogContributorRole} />
              <Button label="Add contributor" variant="secondary" size="medium" type="button" disabled={catalogContributorNameInput.trim() === ""} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Add contributor" onclick={addCatalogContributor} />
              <Input id="distribution-catalog-contributor-reason" label="Review reason" value={catalogContributorReasonInput} placeholder="Why this contributor snapshot is correct" type="text" state="default" message="Required for the audit trail." oninput={updateCatalogContributorReason} />
              {#if selectedCatalogMainArtist !== null && selectedCatalogMainArtist.name.trim().toLocaleLowerCase() !== selectedCatalogTrack.catalogArtist.trim().toLocaleLowerCase()}
                <Button label={`Promote ${selectedCatalogMainArtist.name} to Catalog Artist`} variant="primary" size="medium" type="button" disabled={!writesEnabled || catalogContributorReasonInput.trim() === ""} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Promote main artist to Catalog Artist" title={catalogContributorReasonInput.trim() === "" ? "Enter a review reason first." : writeDisabledTitle()} onclick={promoteCatalogMainArtist} />
              {/if}
              <Button label="Save reviewed contributors" variant="primary" size="medium" type="button" disabled={!writesEnabled || catalogContributorDrafts.length === 0 || catalogContributorReasonInput.trim() === ""} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Save reviewed contributors" title={writeDisabledTitle()} onclick={saveCatalogContributors} />
              <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Cancel contributor review" onclick={closeCatalogContributorPanel} />
            </div>
          </section>
            {/snippet}
          </Drawer>
        {/if}
        <Table title="Catalog tracks + contributors" columns={catalogColumns} rows={catalogRows} state={tableStateFor(catalogState.status, catalogRows.length)} actionLabel="" rowActions={catalogRowActions} pagination={catalogPagination} />
      {:else if activePageId === "contracts"}
        <section class="kpi-grid" aria-label="Contract KPIs">
          {#each contractKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={isLoadingStatus(contractWorkbenchState.status) ? "loading" : "default"} accent={kpi.accent} />
          {/each}
        </section>
        <section class="contracts-actions ehq-edge-surface">
          <Button label="New payee" variant="secondary" size="medium" type="button" disabled={!writesEnabled} loading={mutationInFlight} locked={false} focus={false} ariaLabel="New Distribution payee" title={writeDisabledTitle()} onclick={openPayeePanel} />
          <Button label="New contract" variant="primary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="New contract" onclick={openContractPanel} />
          <span>Imported agreements remain immutable; split corrections are complete, audited override snapshots.</span>
        </section>
        <section class="filter-strip ehq-edge-surface" aria-label="Contract filters">
          <Input id="distribution-contract-search" label="Search" value={contractSearch} placeholder="Track, release, artist, ISRC, label or payee" type="search" state="default" message="" oninput={updateContractSearch} />
          <Select id="distribution-contract-status-filter" label="Status" value={contractStatusFilter} options={contractTrackStatusOptions} state="default" message="" onchange={updateContractStatus} />
          <Button label="Filter" variant="secondary" size="medium" type="button" disabled={false} loading={isLoadingStatus(contractWorkbenchState.status)} locked={false} focus={false} ariaLabel="Apply contract filters" onclick={loadContractWorkbench} />
          <Button label="Clear" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Clear contract filters" onclick={clearContractFilters} />
        </section>
        <nav class="contract-workflow ehq-edge-surface" aria-label="Contracts workflow filters">
          <Button label="All" variant={contractWorkflowFilter === allValue ? "primary" : "secondary"} size="small" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Show all contract tracks" onclick={() => applyContractWorkflow(allValue)} />
          <Button label="All splits" variant={contractWorkflowFilter === "all_splits" ? "primary" : "secondary"} size="small" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Show all tracks with splits" onclick={() => applyContractWorkflow("all_splits")} />
          <Button label="Needs attention" variant={contractWorkflowFilter === "needs_attention" ? "primary" : "secondary"} size="small" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Show contract tracks needing attention" onclick={() => applyContractWorkflow("needs_attention")} />
          <Button label="Ready" variant={contractWorkflowFilter === "ready" ? "primary" : "secondary"} size="small" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Show ready contract tracks" onclick={() => applyContractWorkflow("ready")} />
          <Button label="With expenses" variant={contractWorkflowFilter === "with_expenses" ? "primary" : "secondary"} size="small" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Show contract tracks with expenses" onclick={() => applyContractWorkflow("with_expenses")} />
        </nav>
        <section class="contracts-actions ehq-edge-surface" aria-label="Contract selection">
          <span>{selectedContractRowIds.length} tracks selected · {contractTracks.length} loaded</span>
          <Button label="Select all page" variant="secondary" size="medium" type="button" disabled={contractTracks.length === 0} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Select all loaded contract tracks" onclick={selectAllVisibleContractRows} />
          <Button label="Apply splits to selected" variant="primary" size="medium" type="button" disabled={selectedContractRowIds.length === 0} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Apply split group to selected tracks" onclick={openSelectedContractEditor} />
          <Button label="Clear selection" variant="secondary" size="medium" type="button" disabled={selectedContractRowIds.length === 0} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Clear contract track selection" onclick={clearContractSelection} />
        </section>
        {#if contractPickerOpen}
          <Drawer open={true} presentation="overlay" showFooter={false} title="New contract" badgeLabel="split setup" badgeTone="info" body="" primaryAction="" secondaryAction="Close" state="default" onSecondary={closeContractPanel}>
            {#snippet content()}
          <section class="form-panel" aria-label="New contract">
            <div class="panel-context">
              <strong>New track contract</strong>
              <span>Select a loaded track. Saving creates an audited contract anchor only when the track has no current agreement.</span>
            </div>
            <Select id="distribution-contract-track-picker" label="Track" value={contractPickerTrackId} options={contractPickerOptions} state="default" message="Use search and filters first if the track is not loaded." onchange={updateContractPickerTrack} />
            <Button label="Open split editor" variant="primary" size="medium" type="button" disabled={contractPickerTrackId === ""} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Open selected track split editor" onclick={openPickedContractTrack} />
            <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Cancel new contract" onclick={closeContractPanel} />
          </section>
            {/snippet}
          </Drawer>
        {/if}
        {#if payeePanelOpen}
          <Drawer open={true} presentation="overlay" showFooter={false} title="New payee" badgeLabel="counterparty" badgeTone="info" body="" primaryAction="" secondaryAction="Close" state="default" onSecondary={closePayeePanel}>
            {#snippet content()}
          <section class="form-panel" aria-label="New Distribution payee">
            <Input id="distribution-payee-name" label="Name" value={payeeNameInput} placeholder="Artist, staff member, supplier or freelancer" type="text" state="default" message="Any royalty or expense counterparty can be a payee." oninput={updatePayeeName} />
            <Input id="distribution-payee-email" label="Email (optional)" value={payeeEmailInput} placeholder="" type="text" state="default" message="" oninput={updatePayeeEmail} />
            <Input id="distribution-payee-currency" label="Preferred currency" value={payeeCurrencyInput} placeholder="MUR" type="text" state={normalizeCurrencyCode(payeeCurrencyInput) === null ? "error" : "default"} message="ISO 3-letter code" oninput={updatePayeeCurrency} />
            <Button label="Create payee" variant="primary" size="medium" type="button" disabled={!writesEnabled || payeeNameInput.trim() === "" || normalizeCurrencyCode(payeeCurrencyInput) === null} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Create Distribution payee" title={writeDisabledTitle()} onclick={createPayee} />
            <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Cancel payee creation" onclick={closePayeePanel} />
          </section>
            {/snippet}
          </Drawer>
        {/if}
        {#if primaryContractEditorTrack !== null}
          <Drawer open={true} presentation="overlay" showFooter={false} title="Track split editor" badgeLabel={contractEditorTracks.length === 1 ? "track contract" : "bulk split"} badgeTone="info" body="" primaryAction="" secondaryAction="Close" state="default" onSecondary={closeContractEditor}>
            {#snippet content()}
          <section class="contract-editor" aria-label="Track split editor">
            <div class="contract-editor-heading">
              <div>
                <span class="ehq-type-label-mono">{contractEditorTracks.length === 1 ? "Track contract" : "Bulk split snapshot"}</span>
                <strong>{primaryContractEditorTrack.title}{contractEditorTracks.length > 1 ? ` + ${contractEditorTracks.length - 1} tracks` : ""}</strong>
              </div>
              <span>Track rules override release and catalog defaults. Ambiguous sets remain blocked until this total is exactly 100%.</span>
            </div>
            <div class="contract-split-list">
              {#each contractSplitDrafts as split, index (`${index}-${split.payeeId}`)}
                <div class="contract-split-row">
                  <Select id={`distribution-contract-split-payee-${index}`} label="Payee" value={split.payeeId} options={payeeSelectOptions} state="default" message="" onchange={(value) => updateContractSplitPayee(index, value)} />
                  <Input id={`distribution-contract-split-percentage-${index}`} label="Split (%)" value={split.percentage} placeholder="50" type="text" state={parseContractPercentageUnits(split.percentage) === null ? "error" : "default"} message="Up to 6 decimals" oninput={(value) => updateContractSplitPercentage(index, value)} />
                  <Button label="Remove" variant="secondary" size="small" type="button" disabled={contractSplitDrafts.length === 1} loading={mutationInFlight} locked={false} focus={false} ariaLabel={`Remove split ${index + 1}`} onclick={() => removeContractSplit(index)} />
                </div>
              {/each}
            </div>
            <div class="contract-split-total" class:error={contractSplitTotal !== "100.000000"}>
              <span>Total split</span>
              <strong>{contractSplitTotal}%</strong>
            </div>
            <div class="form-panel contract-editor-fields">
              <label>
                <span>Effective from</span>
                <input type="date" value={contractRuleEffectiveFromInput} onchange={updateContractRuleEffectiveFrom} />
              </label>
              <label>
                <span>Effective to (optional)</span>
                <input type="date" value={contractRuleEffectiveToInput} min={contractRuleEffectiveFromInput} onchange={updateContractRuleEffectiveTo} />
              </label>
              <Input id="distribution-contract-rule-currency" label="Expense currency" value={contractRuleCurrencyInput} placeholder="MUR" type="text" state={normalizeCurrencyCode(contractRuleCurrencyInput) === null ? "error" : "default"} message="ISO 3-letter code" oninput={updateContractRuleCurrency} />
              <Input id="distribution-contract-rule-reason" label="Audit reason" value={contractRuleReasonInput} placeholder="Agreement, amendment or verified instruction" type="text" state="default" message="Required. Imported rules are never mutated." oninput={updateContractRuleReason} />
            </div>
            <div class="contract-editor-actions">
              <Button label="Add split payee" variant="secondary" size="medium" type="button" disabled={contractSplitDrafts.length >= payees.length} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Add split payee" onclick={addContractSplit} />
              <Button label="Save complete split set" variant="primary" size="medium" type="button" disabled={!writesEnabled || !contractSplitDraftValid} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Save complete track split set" title={writeDisabledTitle()} onclick={saveContractTrackRules} />
              <Button label="Record expense / advance" variant="secondary" size="medium" type="button" disabled={!writesEnabled || contractEditorTracks.length !== 1 || primaryContractEditorTrack.contractId === null} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Record an expense or advance for this contract" title={primaryContractEditorTrack.contractId === null ? "Save the split set first to create the contract anchor." : writeDisabledTitle()} onclick={openExpensePanel} />
              <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Cancel split editing" onclick={closeContractEditor} />
            </div>
          </section>
            {/snippet}
          </Drawer>
        {/if}
        {#if expensePanelOpen}
          <Drawer open={true} presentation="overlay" showFooter={false} title="Record expense or advance" badgeLabel="recoupment" badgeTone="warning" body="" primaryAction="" secondaryAction="Close" state="default" onSecondary={closeExpensePanel}>
            {#snippet content()}
          <section class="form-panel" aria-label="Record recoupable expense">
            <Select id="distribution-expense-contract" label="Contract" value={expenseContractIdInput} options={expenseContractSelectOptions} state="default" message="" onchange={updateExpenseContract} />
            <Select id="distribution-expense-category" label="Category" value={expenseCategoryInput} options={expenseCategoryOptions} state="default" message="" onchange={updateExpenseCategory} />
            <Select id="distribution-expense-payee" label="Payee charged" value={expensePayeeIdInput} options={expensePayeeOptions} state="default" message="" onchange={updateExpensePayee} />
            <Input id="distribution-expense-label" label="Description" value={expenseLabelInput} placeholder="Advance, studio session, campaign…" type="text" state="default" message="" oninput={updateExpenseLabel} />
            <Input id="distribution-expense-amount" label="Amount" value={expenseAmountInput} placeholder="2500.00" type="text" state="default" message="" oninput={updateExpenseAmount} />
            <Input id="distribution-expense-currency" label="Currency" value={expenseCurrencyInput} placeholder="MUR" type="text" state={normalizeCurrencyCode(expenseCurrencyInput) === null ? "error" : "default"} message="ISO 3-letter code" oninput={updateExpenseCurrency} />
            <Select id="distribution-expense-recoverable" label="Recoverable from payee share" value={expenseRecoverableInput} options={[{ label: "Yes", value: "yes" }, { label: "No", value: "no" }]} state="default" message="" onchange={updateExpenseRecoverable} />
            <label>
              <span>Expense date</span>
              <input type="date" value={expenseDateInput} onchange={updateExpenseDate} />
            </label>
            <Button label="Record expense" variant="primary" size="medium" type="button" disabled={!writesEnabled || selectedExpenseContract === null || selectedExpenseContract.contractId === null || expenseLabelInput.trim() === "" || expenseAmountMicro === null || expenseDateInput === "" || normalizeCurrencyCode(expenseCurrencyInput) === null} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Record expense" title={writesEnabled ? (selectedExpenseContract === null ? "Select a contract first" : expenseLabelInput.trim() === "" ? "Enter a label first" : expenseAmountMicro === null ? "Enter a positive amount, e.g. 2500.00" : expenseDateInput === "" ? "Choose the expense date first" : "") : writeGateMessage} onclick={recordExpense} />
            <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Cancel expense entry" onclick={closeExpensePanel} />
          </section>
            {/snippet}
          </Drawer>
        {/if}
        <Table title="Contracts & splits by track" columns={contractColumns} rows={contractRows} state={tableStateFor(contractWorkbenchState.status, contractRows.length)} actionLabel="" rowActions={contractRowActions} pagination={contractsPagination} />
        {#if expenseContractFilterId !== ""}
          <section class="filter-strip ehq-edge-surface" aria-label="Expense contract filter">
            <Select id="distribution-expense-contract-filter" label="Expense contract" value={expenseContractFilterId} options={expenseContractSelectOptions} state="default" message="" onchange={updateExpenseContractFilter} />
            <Button label="Reload expenses" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Reload expenses for the selected contract" onclick={loadExpenses} />
          </section>
          <Table title={expenseTableTitle} columns={expenseColumns} rows={expenseRows} state={tableStateFor(expensesState.status, expenses.length)} actionLabel="" pagination={expensesPagination} />
        {/if}
        <Table title="Payees" columns={payeeColumns} rows={payeeRows} state={tableStateFor(payeesState.status, payees.length)} actionLabel="" />
      {:else if activePageId === "allocations"}
        <section class="filter-strip allocation-command-bar ehq-edge-surface" aria-label="Allocation commands">
          <Input id="distribution-allocation-search" label="Search" value={allocationSearch} placeholder="Batch file, source, release, track, ISRC…" type="search" state="default" message="" oninput={updateAllocationSearch} />
          <Button label="Filter" variant="secondary" size="medium" type="button" disabled={false} loading={allocationWorkbenchState.status === "loading"} locked={false} focus={false} ariaLabel="Filter allocation workbench" onclick={loadAllocationWorkbench} />
          <Button label="Preview" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Preview the safe pending allocation wave" onclick={previewAllocationRun} />
          <Button label="Run safe pending wave" variant="primary" size="medium" type="button" disabled={!writesEnabled || (allocationWorkbench?.summary.readyRowCount ?? 0) === 0} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Run safe pending allocation wave" title={writeDisabledTitle()} onclick={startCadencedAllocationRun} />
        </section>
        <section class="kpi-grid allocation-readiness" aria-label="Allocation readiness">
          {#each allocationKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={isLoadingStatus(allocationWorkbenchState.status) ? "loading" : "default"} accent={kpi.accent} />
          {/each}
        </section>
        <section class="allocation-health ehq-edge-surface" aria-label="Allocation health">
          <div class="allocation-section-heading">
            <div>
              <span>Pre-run control</span>
              <h2>Allocation health</h2>
            </div>
            <p>Queue readiness, unresolved suspense, and allocation rows missing critical financial links.</p>
          </div>
          <section class="kpi-grid allocation-health-kpis" aria-label="Allocation health checks">
            {#each allocationHealthKpis as kpi (kpi.label)}
              <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={isLoadingStatus(allocationWorkbenchState.status) ? "loading" : "default"} accent={kpi.accent} />
            {/each}
          </section>
          <section class="allocation-health-grid">
            <Table title="Suspense reasons" columns={allocationReasonColumns} rows={allocationReasonRows} state={tableStateFor(allocationWorkbenchState.status, allocationReasonRows.length)} actionLabel="" rowActions={allocationReasonRowActions} />
            <Table title="Recent batches" columns={allocationRecentColumns} rows={allocationRecentRows} state={tableStateFor(allocationWorkbenchState.status, allocationRecentRows.length)} actionLabel="" />
          </section>
        </section>
        <section class="allocation-table-intro">
          <div class="allocation-section-heading">
            <div>
              <span>Accounting work</span>
              <h2>Batch Allocation Queue</h2>
            </div>
            <p>Pending rows can be allocated; missing-contract rows stay in suspense until a complete split is recorded.</p>
          </div>
          <Table title="Import batches" columns={allocationBatchColumns} rows={allocationBatchRows} state={tableStateFor(allocationWorkbenchState.status, allocationBatchRows.length)} actionLabel="" rowActions={allocationBatchRowActions} pagination={allocationBatchesPagination} />
        </section>
        <section class="allocation-table-intro">
          <div class="allocation-section-heading">
            <div>
              <span>Missing contracts</span>
              <h2>Unallocated Royalty Bank</h2>
            </div>
            <p>Mapped earnings are preserved but are not payable until an active 100% contract split applies.</p>
          </div>
          <Table title="Missing contracts by track" columns={allocationBankColumns} rows={allocationBankRows} state={tableStateFor(allocationWorkbenchState.status, allocationBankRows.length)} actionLabel="" rowActions={allocationBankRowActions} pagination={allocationBankPagination} />
        </section>
        <section class="lock-panel ehq-edge-surface">
          <SectionTemplate
            eyebrow="allocations"
            title="Server lock"
            detail="Preview, posting and reversal are only available through scheduled workflow runs."
            state="ready"
          >
            {#snippet action()}
              <Button label="Preview locked run" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Preview locked run" onclick={previewAllocationRun} />
              <Button label="Post scheduled batch" variant="primary" size="medium" type="button" disabled={!writesEnabled} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Post scheduled batch" title={writeDisabledTitle()} onclick={startCadencedAllocationRun} />
            {/snippet}
            <p class="lock-key">{allocationLockKey}</p>
          </SectionTemplate>
        </section>
        {#if selectedRun !== null}
          <Drawer open={true} presentation="overlay" showFooter={false} title="Reverse allocation run" badgeLabel={selectedRun.status} badgeTone="warning" body="" primaryAction="" secondaryAction="Close" state="default" onSecondary={closeUnpostPanel}>
            {#snippet content()}
              <section class="form-panel" aria-label="Request run reversal">
                <div class="panel-context">
                  <strong>{selectedRun.runReference}</strong>
                  <span>{selectedRun.period} · {selectedRun.status} · lock {selectedRun.lockKey}</span>
                </div>
                <Input id="distribution-unpost-reason" label="Reversal reason" value={unpostReasonInput} placeholder="" type="text" state="default" message="" oninput={updateUnpostReason} />
                <Button label="Reverse run" variant="danger" size="medium" type="button" disabled={!writesEnabled || unpostReasonInput.trim() === ""} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Reverse run" title={writesEnabled ? (unpostReasonInput.trim() === "" ? "Enter a reversal reason first" : "") : writeGateMessage} onclick={unpostAllocationRun} />
                <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Cancel reversal request" onclick={closeUnpostPanel} />
              </section>
            {/snippet}
          </Drawer>
        {/if}
        {#if allocationDetailRun !== null}
          <Drawer open={true} presentation="overlay" showFooter={false} title="Allocation breakdown" badgeLabel={allocationDetailRun.status} badgeTone="info" body="" primaryAction="" secondaryAction="Close" state="default" onSecondary={closeAllocationDetail}>
            {#snippet content()}
              <section class="allocation-detail-panel" aria-label="Allocation breakdown">
                <div class="panel-context"><strong>{allocationDetailRun.runReference}</strong><span>{allocationDetailRun.period} · {allocationDetailRun.lockKey}</span></div>
                <Table title="Totals by currency" columns={allocationCurrencyTotalColumns} rows={allocationCurrencyTotalRows} state={tableStateFor(allocationCurrencyTotalsState.status, allocationCurrencyTotalRows.length)} actionLabel="" />
                <Table title="Allocation lines" columns={allocationDetailColumns} rows={allocationDetailRows} state={tableStateFor(allocationDetailState.status, allocationDetailRows.length)} actionLabel="" />
              </section>
            {/snippet}
          </Drawer>
        {/if}
        <Table title="Allocation runs" columns={allocationColumns} rows={allocationRows} state={tableStateFor(allocationsState.status, allocationRuns.length)} actionLabel="" rowActions={allocationRowActions} pagination={allocationsPagination} />
      {:else if activePageId === "suspense"}
        <section class="filter-strip allocation-command-bar ehq-edge-surface" aria-label="Suspense filters">
          <Input id="distribution-suspense-search" label="Search" value={suspenseSearch} placeholder="Track, artist, ISRC, UPC, reason or file…" type="search" state="default" message="" oninput={updateSuspenseSearch} />
          <Input id="distribution-suspense-batch" label="Batch ID" value={suspenseBatchReference} placeholder="Reference or file name" type="text" state="default" message="" oninput={updateSuspenseBatchReference} />
          <Select id="distribution-suspense-reason" label="Reason" value={suspenseReasonFilter} options={suspenseReasonOptions} state="default" message="" onchange={updateSuspenseReason} />
          <Select id="distribution-suspense-status" label="Status" value={suspenseStatusFilter} options={suspenseStatusOptions} state="default" message="" onchange={updateSuspenseStatus} />
          <Button label="Filter" variant="secondary" size="medium" type="button" disabled={false} loading={isLoadingStatus(suspenseState.status)} locked={false} focus={false} ariaLabel="Apply suspense filters" onclick={loadSuspense} />
          <Button label="Clear" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Clear suspense filters" onclick={clearSuspenseFilters} />
          <Button label="Export CSV" variant="secondary" size="medium" type="button" disabled={suspenseItems.length === 0} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Export suspense as CSV" onclick={exportSuspenseCsv} />
          <Button label="Run safe pending wave" variant="primary" size="medium" type="button" disabled={!writesEnabled || (allocationWorkbench?.summary.readyRowCount ?? 0) === 0} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Run the safe pending allocation wave" title={writeDisabledTitle()} onclick={startCadencedAllocationRun} />
        </section>
        <section class="kpi-grid" aria-label="Suspense KPIs">
          {#each suspenseKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={isLoadingStatus(suspenseState.status) ? "loading" : "default"} accent={kpi.accent} />
          {/each}
        </section>
        <section class="allocation-health ehq-edge-surface" aria-label="Suspense reason playbook">
          <div class="allocation-section-heading">
            <div>
              <span>Resolution controls</span>
              <h2>Suspense reason playbook</h2>
            </div>
            <p>Resolve the underlying mapping, catalog, or split before retrying. Imported earnings remain immutable.</p>
          </div>
          <Table title="Open exposure by reason" columns={suspensePlaybookColumns} rows={suspensePlaybookRows} state={tableStateFor(suspenseState.status, suspensePlaybookRows.length)} actionLabel="" rowActions={suspensePlaybookRowActions} />
        </section>
        {#if selectedSuspenseItem !== null}
          <Drawer open={true} presentation="overlay" showFooter={false} title="Resolve suspense item" badgeLabel={selectedSuspenseItem.reasonTitle} badgeTone="warning" body="" primaryAction="" secondaryAction="Close" state="default" onSecondary={closeSuspensePanel}>
            {#snippet content()}
          <section class="form-panel" aria-label="Resolve suspense item">
            <div class="panel-context">
              <strong>{selectedSuspenseItem.trackTitle ?? "Unmatched ledger line"}</strong>
              <span>{selectedSuspenseItem.reasonTitle} · {selectedSuspenseItem.artistName ?? "Unknown artist"} · {formatMoney(selectedSuspenseItem.amountMicro, selectedSuspenseItem.currency)} · split {selectedSuspenseItem.splitPercentage ?? "—"}%</span>
            </div>
            <p>{selectedSuspenseItem.reasonDescription}</p>
            {#if selectedSuspenseResolution === "map_to_track"}
              <Select id="distribution-suspense-track" label="Target track" value={suspenseTargetTrackId} options={suspenseTrackSelectOptions} state="default" message="" onchange={updateSuspenseTargetTrack} />
              {#if suspenseTrackOptionsError !== null}
                <span class="panel-error">{suspenseTrackOptionsError}</span>
              {/if}
            {/if}
            {#if selectedSuspenseResolution === "mark_resolved"}
              <Input id="distribution-suspense-note" label="Manual decision note" value={suspenseResolutionNote} placeholder="Explain the verified decision" type="text" state={suspenseResolutionNote.trim() === "" ? "error" : "default"} message="Required and recorded in the audit trail." oninput={updateSuspenseResolutionNote} />
              <Button label="Retry row" variant="secondary" size="medium" type="button" disabled={!writesEnabled} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Retry suspense row" title={writeDisabledTitle()} onclick={() => resolveSelectedSuspense("retry_row")} />
              <Button label="Mark resolved" variant="primary" size="medium" type="button" disabled={!writesEnabled || suspenseResolutionNote.trim() === ""} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Mark suspense resolved" title={writesEnabled ? (suspenseResolutionNote.trim() === "" ? "Enter a manual decision note first" : "") : writeGateMessage} onclick={() => resolveSelectedSuspense("mark_resolved")} />
            {:else if selectedSuspenseResolution === "retry_row"}
              <Button label="Retry row" variant="primary" size="medium" type="button" disabled={!writesEnabled} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Retry suspense row" title={writeDisabledTitle()} onclick={() => resolveSelectedSuspense("retry_row")} />
            {:else}
              <Button label="Map and retry" variant="primary" size="medium" type="button" disabled={!writesEnabled || !suspenseResolveTarget.ready} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Map suspense row to target track and retry" title={writesEnabled ? suspenseResolveTarget.hint : writeGateMessage} onclick={() => resolveSelectedSuspense("map_to_track")} />
            {/if}
            <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Cancel suspense resolution" onclick={closeSuspensePanel} />
          </section>
            {/snippet}
          </Drawer>
        {/if}
        <Table title="Suspense queue" columns={suspenseColumns} rows={suspenseTableRows} state={isLoadingStatus(suspenseState.status) ? "loading" : suspenseState.status === "error" ? "error" : suspenseItems.length === 0 ? "empty" : "default"} actionLabel="" rowActions={suspenseRowActions} pagination={suspensePagination} />
      {:else if activePageId === "statements"}
        <section class="filter-strip ehq-edge-surface" aria-label="Statement filters">
          <Select id="distribution-statement-payee" label="Payee" value={statementPayeeFilter} options={statementPayeeOptions} state="default" message="" onchange={updateStatementPayee} />
          <Select id="distribution-statement-currency" label="Currency" value={statementCurrencyFilter} options={statementCurrencyOptions} state="default" message="" onchange={updateStatementCurrency} />
          <Button label="Filter" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Apply statement filters" onclick={loadStatements} />
        </section>
        <section class="kpi-grid" aria-label="Statement lifecycle summary">
          <KPI label="Draft" value={String(statementDraftCount)} detail="can still change" tone="warning" state={isLoadingStatus(statementsState.status) ? "loading" : "default"} accent={true} />
          <KPI label="Locked due" value={String(statementLockedDueCount)} detail="ready for payment" tone="info" state={isLoadingStatus(statementsState.status) ? "loading" : "default"} accent={true} />
          <KPI label="Paid" value={String(statementPaidCount)} detail="settled in Distribution" tone="success" state={isLoadingStatus(statementsState.status) ? "loading" : "default"} accent={true} />
          <KPI label="Voided" value={String(statementVoidCount)} detail="reversed, never deleted" tone="error" state={isLoadingStatus(statementsState.status) ? "loading" : "default"} accent={true} />
        </section>
        <section class="statement-summary ehq-edge-surface">
          {#if statementPreview !== null}
            <div>
              <p>Financial summary first</p>
              <h2>{statementPreview.payeeName} · {formatDateRange(statementPreview.period_start, statementPreview.period_end)}</h2>
              <dl>
                <div><dt>Gross</dt><dd>{formatMoney(statementPreview.grossMicro, statementPreview.currency)}</dd></div>
                <div><dt>Recouped</dt><dd>{formatMoney(statementPreview.recoupedMicro, statementPreview.currency)}</dd></div>
                <div><dt>Paid</dt><dd>{formatMoney(statementPreview.paidMicro, statementPreview.currency)}</dd></div>
                <div><dt>Total payable</dt><dd>{formatMoney(statementPreview.netPayableMicro, statementPreview.currency)}</dd></div>
              </dl>
            </div>
          {/if}
          <div class="statement-summary-actions">
            <Button label="Generate statements" variant="primary" size="medium" type="button" disabled={!writesEnabled} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Generate statements" title={writeDisabledTitle()} onclick={generateStatements} />
          </div>
        </section>
        {#if selectedStatement !== null && statementDetailState.status === "idle"}
          <Drawer open={true} presentation="overlay" showFooter={false} title="Remove statement" badgeLabel="controlled removal" badgeTone="warning" body="" primaryAction="" secondaryAction="Close" state="default" onSecondary={closeStatementDetail}>
            {#snippet content()}
              <section class="form-panel" aria-label="Remove statement from active list">
                <div class="panel-context">
                  <strong>Remove statement for {selectedStatement.payeeName}</strong>
                  <span>{formatMoney(selectedStatement.netPayableMicro, selectedStatement.currency)} · {formatDateRange(selectedStatement.period_start, selectedStatement.period_end)}</span>
                </div>
                <p>This removes the statement from the active list without changing source calculations. It remains in the audit trail with its reversal.</p>
                <Input id="distribution-statement-void-reason" label="Removal reason" value={statementVoidReason} placeholder="Explain why this statement is not needed" type="text" state={statementVoidReason.trim() === "" ? "error" : "default"} message="Required and recorded in the audit trail." oninput={(value: string): void => { statementVoidReason = value; }} />
                <Button label="Remove statement" variant="danger" size="medium" type="button" disabled={!writesEnabled || statementVoidReason.trim() === ""} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Remove statement from active list" title={writeDisabledTitle()} onclick={voidSelectedStatement} />
                <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Cancel statement removal" onclick={closeStatementDetail} />
              </section>
            {/snippet}
          </Drawer>
        {:else if selectedStatement !== null}
          <Drawer open={true} presentation="overlay" showFooter={false} title={`Statement ${selectedStatement.payeeName}`} badgeLabel={selectedStatement.status} badgeTone="info" body="" primaryAction="" secondaryAction="Close" state="default" onSecondary={closeStatementDetail}>
            {#snippet content()}
          <section class="statement-pdf" aria-label="Statement lines">
            <header>
              <strong>{selectedStatement.payeeName}</strong>
              <span>{formatDateRange(selectedStatement.period_start, selectedStatement.period_end)} · {selectedStatement.currency}</span>
            </header>
            {#if isLoadingStatus(statementDetailState.status)}
              <Loader label="Loading statement lines" detail="Retrieving the immutable statement breakdown." size="medium" />
            {:else if statementDetailState.status === "error"}
              <Alert tone="error" title="Statement detail unavailable" message="The line detail could not be loaded. Retry from the statement row." dismissible={false} />
            {:else}
              <p class="statement-detail-note">{statementDetailRows.length} title summaries from {statementDetailSourceLineCount} source lines. Export CSV keeps every source line.</p>
              <Table title="Statement summary by track" columns={statementLineColumns} rows={statementDetailRows} state={statementDetailRows.length === 0 ? "empty" : "default"} actionLabel="" />
            {/if}
            <Button label="Close detail" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Close statement detail" onclick={closeStatementDetail} />
          </section>
            {/snippet}
          </Drawer>
        {/if}
        {#if printingStatementId !== null}
          <Alert tone="info" title="Printing" message="Preparing print view…" dismissible={false} />
        {/if}
        {#if statementPrintError !== null}
          <span class="panel-error" role="alert">{statementPrintError}</span>
        {/if}
        <Table title="Statements" columns={statementColumns} rows={statementRows} state={tableStateFor(statementsState.status, statements.length)} actionLabel="" rowActions={statementRowActions} pagination={statementsPagination} />
      {:else if activePageId === "payments"}
        <Alert tone="info" title="Distribution subledger" message="Payments are recorded and linked to Distribution statements here. Office bank and accounting integration is intentionally out of scope." dismissible={false} />
        <section class="filter-strip ehq-edge-surface" aria-label="Payment filters">
          <Select id="distribution-payment-status" label="Status" value={paymentStatusFilter} options={paymentStatusOptions} state="default" message="" onchange={updatePaymentStatus} />
          <Button label="Filter" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Apply payment filters" onclick={loadPayments} />
          <Button label="Export CSV" variant="secondary" size="medium" type="button" disabled={payments.length === 0} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Export payments as CSV" onclick={exportPaymentsCsv} />
          <Button label="Record payment" variant="primary" size="medium" type="button" disabled={!writesEnabled} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Open payment recording" title={writeDisabledTitle()} onclick={openPaymentCreatePanel} />
        </section>
        {#if paymentCreatePanelOpen}
          <Drawer open={true} presentation="overlay" showFooter={false} title="Record payment" badgeLabel="new payment" badgeTone="info" body="" primaryAction="" secondaryAction="Close" state="default" onSecondary={closePaymentCreatePanel}>
            {#snippet content()}
        <section class="form-panel" aria-label="Record a payment">
          <Select id="distribution-record-payee" label="Payee" value={recordPaymentPayeeId} options={payeeSelectOptions} state="default" message="" onchange={updateRecordPaymentPayee} />
          <Input id="distribution-record-amount" label="Amount" value={recordPaymentAmount} placeholder="2500.00" type="text" state={recordPaymentAmount !== "" && recordPaymentAmountMicro === null ? "error" : "default"} message={recordPaymentAmount !== "" && recordPaymentAmountMicro === null ? "Enter a positive amount with up to 10 decimals." : ""} oninput={updateRecordPaymentAmount} />
          <Input id="distribution-record-currency" label="Currency" value={recordPaymentCurrency} placeholder="MUR" type="text" state={normalizeCurrencyCode(recordPaymentCurrency) === null ? "error" : "default"} message="ISO 3-letter code" oninput={updateRecordPaymentCurrency} />
          <Input id="distribution-record-fx" label="Exchange rate (optional)" value={recordPaymentExchangeRate} placeholder="" type="text" state={recordPaymentExchangeRate.trim() !== "" && recordPaymentExchangeRateNormalized === null ? "error" : "default"} message="Reference rate only; stored values are never rewritten." oninput={updateRecordPaymentExchangeRate} />
          <Select id="distribution-record-method" label="Method" value={recordPaymentMethod} options={paymentMethodOptions} state="default" message="" onchange={updateRecordPaymentMethod} />
          <Input id="distribution-record-reference" label="Reference (optional)" value={recordPaymentReference} placeholder="" type="text" state="default" message="" oninput={updateRecordPaymentReference} />
          <Select id="distribution-record-status" label="Status" value={recordPaymentStatus} options={paymentRecordStatusOptions} state="default" message="" onchange={updateRecordPaymentStatus} />
          {#if recordPaymentStatus === "paid"}
            <label><span>Paid date</span><input type="date" value={recordPaymentPaidDate} onchange={updateRecordPaymentPaidDate} /></label>
          {/if}
          <Input id="distribution-record-notes" label="Notes (optional)" value={recordPaymentNotes} placeholder="" type="text" state="default" message="" oninput={updateRecordPaymentNotes} />
          <Select id="distribution-record-statement" label="Link statement now (optional)" value={recordStatementId} options={openStatementSelectOptions} state="default" message="Can be linked later from the reconciliation queue." onchange={updateRecordStatement} />
          <Button label="Record payment" variant="primary" size="medium" type="button" disabled={!writesEnabled || recordPaymentPayeeId === "" || recordPaymentAmountMicro === null || normalizeCurrencyCode(recordPaymentCurrency) === null || (recordPaymentStatus === "paid" && recordPaymentPaidDate === "")} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Record payment" title={writeDisabledTitle()} onclick={recordPayment} />
          <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Cancel payment recording" onclick={closePaymentCreatePanel} />
        </section>
            {/snippet}
          </Drawer>
        {/if}
        {#if selectedPayment !== null && paymentPanelMode !== null}
          <Drawer open={true} presentation="overlay" showFooter={false} title={`${paymentPanelMode === "reconcile" ? "Link statement" : paymentPanelMode === "void" ? "Void payment" : "Edit payment"}: ${selectedPayment.payeeName}`} badgeLabel={selectedPayment.status} badgeTone={paymentPanelMode === "void" ? "warning" : "info"} body="" primaryAction="" secondaryAction="Close" state="default" onSecondary={closePaymentPanel}>
            {#snippet content()}
          <section class="form-panel" aria-label="Payment action">
            <div class="panel-context">
              <strong>{selectedPayment.payeeName}</strong>
              <span>{formatMoney(selectedPayment.amountMicro, selectedPayment.currency)} · {selectedPayment.status} · {selectedPayment.reference ?? "no reference"}</span>
            </div>
            {#if paymentPanelMode === "edit"}
              <Input id="distribution-payment-fx" label="Exchange rate (optional)" value={paymentExchangeRateInput} placeholder="" type="text" state={paymentExchangeRateInput.trim() !== "" && paymentExchangeRateNormalized === null ? "error" : "default"} message="Reference rate only." oninput={updatePaymentExchangeRateInput} />
              <Select id="distribution-payment-method" label="Method" value={paymentMethodInput} options={paymentMethodOptions} state="default" message="" onchange={updatePaymentMethodInput} />
              <Input id="distribution-payment-reference" label="Reference (optional)" value={paymentReferenceInput} placeholder="" type="text" state="default" message="" oninput={updatePaymentReferenceInput} />
              <Select id="distribution-payment-edit-status" label="Status" value={paymentStatusInput} options={paymentRecordStatusOptions} state="default" message="" onchange={updatePaymentStatusInput} />
              {#if paymentStatusInput === "paid"}
                <label><span>Paid date</span><input type="date" value={paymentPaidDateInput} onchange={updatePaymentPaidDateInput} /></label>
              {/if}
              <Input id="distribution-payment-notes" label="Notes (optional)" value={paymentNotesInput} placeholder="" type="text" state="default" message="" oninput={updatePaymentNotesInput} />
              <Button label="Save payment" variant="primary" size="medium" type="button" disabled={!writesEnabled || (paymentStatusInput === "paid" && paymentPaidDateInput === "")} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Save payment" title={writeDisabledTitle()} onclick={editPayment} />
            {:else if paymentPanelMode === "reconcile"}
              <Select id="distribution-payment-statement" label="Distribution statement" value={paymentReconcileStatementId} options={paymentReconcileStatementOptions} state="default" message="Only same-payee, same-currency statements are eligible." onchange={updatePaymentReconcileStatement} />
              <Input id="distribution-payment-applied" label="Amount applied" value={paymentReconcileAmountInput} placeholder="" type="text" state={paymentReconcileAmountInput !== "" && paymentReconcileAmountMicro === null ? "error" : "default"} message="Cannot exceed the payment or open statement balance." oninput={updatePaymentReconcileAmount} />
              <Button label="Link statement" variant="primary" size="medium" type="button" disabled={!writesEnabled || paymentReconcileStatementId === "" || paymentReconcileAmountMicro === null || selectedPayment.status !== "paid"} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Link payment to statement" title={selectedPayment.status === "draft" ? "Post the draft payment first." : writeDisabledTitle()} onclick={reconcilePayment} />
            {:else}
              <Input id="distribution-payment-void-reason" label="Void reason" value={paymentReferenceInput} placeholder="" type="text" state="default" message="" oninput={updatePaymentReferenceInput} />
              <Button label="Void payment" variant="danger" size="medium" type="button" disabled={!writesEnabled || paymentReferenceInput.trim() === ""} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Void payment" title={writesEnabled ? (paymentReferenceInput.trim() === "" ? "Enter a void reason first" : "") : writeGateMessage} onclick={voidPayment} />
            {/if}
            <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Close payment panel" onclick={closePaymentPanel} />
          </section>
            {/snippet}
          </Drawer>
        {/if}
        <Table title="Payments ledger" columns={paymentColumns} rows={paymentRows} state={isLoadingStatus(paymentsState.status) ? "loading" : paymentsState.status === "error" ? "error" : payments.length === 0 ? "empty" : "default"} actionLabel="" rowActions={paymentRowActions} pagination={paymentsPagination} />
      {:else if activePageId === "revenue"}
        <section class="kpi-grid" aria-label="Revenue totals">
          {#each revenueKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={isLoadingStatus(revenueState.status) ? "loading" : "default"} accent={kpi.accent} />
          {/each}
        </section>
        <section class="filter-strip ehq-edge-surface" aria-label="Revenue filters">
          <Select id="distribution-revenue-group" label="Group by" value={revenueGroupBy} options={revenueGroupOptions} state="default" message="" onchange={updateRevenueGroup} />
          <Select id="distribution-revenue-payee" label="Payee" value={revenuePayeeFilter} options={revenuePayeeOptions} state="default" message="" onchange={updateRevenuePayee} />
          <Select id="distribution-revenue-store" label="Store" value={revenueStoreFilter} options={revenueStoreOptions} state="default" message="" onchange={updateRevenueStore} />
          <Select id="distribution-revenue-currency" label="Currency" value={revenueCurrencyFilter} options={revenueCurrencyOptions} state="default" message="" onchange={updateRevenueCurrency} />
          <Button label="Export CSV" variant="secondary" size="medium" type="button" disabled={revenueRows.length === 0} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Export revenue as CSV" onclick={exportRevenueCsv} />
          <Button label="Refresh" variant="primary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Refresh revenue" onclick={loadRevenue} />
        </section>
        <section class="dashboard-grid">
          <BarsChart title="Grouped revenue view" points={revenueChartPoints} tone="active" />
          <Table title="Revenue details" columns={revenueColumns} rows={revenueTableRows} state={tableStateFor(revenueState.status, revenueRows.length)} actionLabel="" pagination={revenuePagination} />
        </section>
      {:else if activePageId === "financial-reconciliation"}
        {#if isLoadingStatus(reconciliationState.status)}
          <Loader label="Loading reconciliation" detail="Computing read-only diagnostics." size="medium" />
        {:else if reconciliationState.status === "error"}
          <section class="empty-state error ehq-edge-surface">
            <strong>Reconciliation unavailable</strong>
            <span>The read-only diagnostic could not be loaded. Try the request again.</span>
            <Button label="Retry" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Retry reconciliation loading" onclick={loadReconciliation} />
          </section>
        {:else}
          <section class="kpi-grid" aria-label="Reconciliation KPIs">
            {#each reconciliationKpis as kpi (kpi.label)}
              <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state="default" accent={kpi.accent} />
            {/each}
          </section>
          <Table title="Statements without payment links" columns={reconStatementColumns} rows={reconStatementRows} state={reconStatementRows.length === 0 ? "empty" : "default"} actionLabel="" />
          <Table title="Expense terms without a payee" columns={reconExpenseColumns} rows={reconExpenseRows} state={reconExpenseRows.length === 0 ? "empty" : "default"} actionLabel="" />
          <Table title="Matched but unallocated (sample)" columns={reconMatchedColumns} rows={reconMatchedRows} state={reconMatchedRows.length === 0 ? "empty" : "default"} actionLabel="" />
          <Table title="Payee balance summary" columns={reconBalanceColumns} rows={reconBalanceRows} state={reconBalanceRows.length === 0 ? "empty" : "default"} actionLabel="" />
          <section class="recon-actions ehq-edge-surface" aria-label="Secure corrective actions">
            <SectionTemplate
              eyebrow="reconciliation"
              title="Secure corrective actions"
              detail="These actions use the API write path with idempotency, auditing and locks."
              state="ready"
            >
            <div class="recon-action-grid">
              {#each (reconciliation?.actions ?? []) as action (action.id)}
                <div class="recon-action ehq-edge-surface">
                  <strong>{action.label}</strong>
                  <p>{action.description}</p>
                  {#if action.maintenance}
                    <span class="recon-action-flag">One-off maintenance · secure execution</span>
                  {/if}
                  <Button
                    label={action.maintenance ? "Run maintenance" : "Run secure action"}
                    variant="secondary"
                    size="medium"
                    type="button"
                    disabled={!writesEnabled}
                    loading={mutationInFlight}
                    locked={false}
                    focus={false}
                    ariaLabel={action.maintenance ? `Run maintenance: ${action.label}` : `Run secure action: ${action.label}`}
                    title={writeDisabledTitle()}
                    onclick={() => runReconciliationAction(action)}
                  />
                </div>
              {/each}
            </div>
            </SectionTemplate>
          </section>
        {/if}
      {:else if activePageId === "aliases"}
        <section class="contracts-actions ehq-edge-surface">
          <Button label="New alias" variant="primary" size="medium" type="button" disabled={!writesEnabled} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Create catalog alias" title={writeDisabledTitle()} onclick={openAliasCreatePanel} />
          <span>Aliases route imported names to canonical entities without changing imported source data.</span>
        </section>
        {#if aliasEditorOpen}
          <Drawer open={true} presentation="overlay" showFooter={false} title={aliasEditorId === null ? "New alias" : "Edit alias"} badgeLabel="catalog mapping" badgeTone="info" body="" primaryAction="" secondaryAction="Close" state="default" onSecondary={closeAliasEditor}>
            {#snippet content()}
        <section class="form-panel" aria-label="Alias editor">
          <header class="settings-editor-head">
            <strong>{aliasEditorId === null ? "Create an alias" : "Edit an alias"}</strong>
            <span>Route imported names to canonical entities.</span>
          </header>
          <div class="settings-editor-grid">
            <Input
              id="distribution-alias-text"
              label="Alias"
              value={aliasTextInput}
              placeholder="Exact source name"
              type="text"
              state={aliasTextInput.trim().length > 0 ? "default" : "error"}
              message={aliasTextInput.trim().length > 0 ? "" : "Alias required."}
              oninput={updateAliasTextInput}
            />
            <Select
              id="distribution-alias-target-type"
              label="Target type"
              value={aliasTargetTypeInput}
              options={aliasTargetTypeOptions}
              state="default"
              message=""
              onchange={updateAliasTargetType}
            />
            {#if aliasTargetRequiresId && aliasTargetIsSelect}
              <Select
                id="distribution-alias-target-id"
                label="Target"
                value={aliasTargetIdInput}
                options={aliasTargetSelectOptions}
                state="default"
                message=""
                onchange={updateAliasTargetId}
              />
            {:else if aliasTargetRequiresId}
              <Input
                id="distribution-alias-target-id-free"
                label="Target ID"
                value={aliasTargetIdInput}
                placeholder="Canonical ID"
                type="text"
                state={aliasTargetIdInput.trim().length > 0 ? "default" : "error"}
                message={aliasTargetIdInput.trim().length > 0 ? "" : "Target ID required."}
                oninput={updateAliasTargetId}
              />
            {/if}
          </div>
          <div class="settings-editor-actions">
            <Button
              label={aliasEditorId === null ? "Create alias" : "Update alias"}
              variant="primary"
              size="medium"
              type="button"
              disabled={!writesEnabled || !aliasFormValid}
              loading={mutationInFlight}
              locked={false}
              focus={false}
              ariaLabel={aliasEditorId === null ? "Create alias" : "Update alias"}
              title={writesEnabled ? (!aliasFormValid ? "Complete the required fields." : "") : writeGateMessage}
              onclick={saveAlias}
            />
            <Button
              label="Cancel"
              variant="secondary"
              size="medium"
              type="button"
              disabled={false}
              loading={mutationInFlight}
              locked={false}
              focus={false}
              ariaLabel="Reset alias editor"
              onclick={closeAliasEditor}
            />
          </div>
        </section>
            {/snippet}
          </Drawer>
        {/if}
        {#if aliases.length === 0 && aliasesState.status === "success"}
          <section class="empty-state ehq-edge-surface">
            <strong>No catalog aliases</strong>
            <span>No aliases are available for this workspace. Once configured, aliases route imported names to canonical entities.</span>
          </section>
        {:else}
          <Table title="Catalog aliases" columns={aliasColumns} rows={aliasRows} state={tableStateFor(aliasesState.status, aliases.length)} actionLabel="" rowActions={aliasRowActions} pagination={aliasesPagination} />
        {/if}
      {:else if activePageId === "duplicates"}
        <section class="recon-actions ehq-edge-surface" aria-label="Duplicate note">
          <SectionTemplate
            eyebrow="earnings integrity"
            title="Same-ISRC earnings"
            detail="Rows sharing an ISRC are valid revenue for the same recording, not duplicates. Financial merging stays disabled until immutable source references can prove an exact duplicate."
            state="ready"
          />
        </section>
        {#if duplicateEditorId !== null}
          <Drawer open={true} presentation="overlay" showFooter={false} title="Merge exact duplicate" badgeLabel="verification required" badgeTone="warning" body="" primaryAction="" secondaryAction="Close" state="default" onSecondary={closeDuplicateMerge}>
            {#snippet content()}
              <section class="form-panel" aria-label="Merge duplicate into master">
                <Select id="distribution-duplicate-master" label="Master record" value={duplicateMasterId} options={duplicateMasterOptions} state="default" message="" onchange={updateDuplicateMaster} />
                <Button label="Merge into master" variant="primary" size="medium" type="button" disabled={!writesEnabled || duplicateMasterId === ""} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Merge duplicate into selected master" title={writeDisabledTitle()} onclick={mergeDuplicate} />
                <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Cancel duplicate merge" onclick={closeDuplicateMerge} />
              </section>
            {/snippet}
          </Drawer>
        {/if}
        {#if duplicates.length === 0 && duplicatesState.status === "success"}
          <section class="empty-state ehq-edge-surface">
            <strong>No repeated ISRC earnings</strong>
            <span>No multi-row recording aggregates were found in the current workspace.</span>
          </section>
        {:else}
          <Table title="Same-ISRC earnings (aggregation only)" columns={duplicateColumns} rows={duplicateRows} state={tableStateFor(duplicatesState.status, duplicates.length)} actionLabel="" rowActions={duplicateRowActions} pagination={duplicatesPagination} />
        {/if}
      {:else if activePageId === "audit-log"}
        <section class="filter-strip ehq-edge-surface" aria-label="Audit log filters">
          <label>
            <span>From</span>
            <input type="date" value={auditFromInput} onchange={(event) => auditFromInput = readInputValue(event)} />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={auditToInput} onchange={(event) => auditToInput = readInputValue(event)} />
          </label>
          <Input id="distribution-audit-actor" label="Actor ID" value={auditActorInput} placeholder="User ID" type="text" state="default" message="" oninput={updateAuditActorInput} />
          <Input id="distribution-audit-entity" label="Entity type" value={auditEntityInput} placeholder="track, payment..." type="text" state="default" message="" oninput={updateAuditEntityInput} />
          <Button label="Apply filters" variant="secondary" size="medium" type="button" disabled={!auditFiltersValid} loading={isLoadingStatus(auditLogState.status)} locked={false} focus={false} ariaLabel="Apply Audit Log filters" onclick={() => void loadAuditLog()} />
          <Button label="Clear filters" variant="secondary" size="medium" type="button" disabled={auditFromInput === "" && auditToInput === "" && auditActorInput === "" && auditEntityInput === ""} loading={false} locked={false} focus={false} ariaLabel="Clear Audit Log filters" onclick={clearAuditFilters} />
          <Button label="Export CSV" variant="secondary" size="medium" type="button" disabled={auditEntries.length === 0} loading={false} locked={false} focus={false} ariaLabel="Export Audit Log as CSV" onclick={exportAuditCsv} />
        </section>
        {#if auditEntries.length === 0 && auditLogState.status === "success"}
          <section class="empty-state ehq-edge-surface">
            <strong>No audit entries</strong>
            <span>No Distribution-scoped audit events are recorded for this workspace.</span>
          </section>
        {:else}
          <Table title="Audit log" columns={auditColumns} rows={auditRows} state={tableStateFor(auditLogState.status, auditEntries.length)} actionLabel="" pagination={auditPagination} />
        {/if}
      {:else if activePageId === "settings"}
        {#if isLoadingStatus(settingsState.status)}
          <Loader label="Loading settings" detail="Reading workspace configuration." size="medium" />
        {:else if settingsState.status === "error"}
          <section class="empty-state error ehq-edge-surface">
            <strong>Settings unavailable</strong>
            <span>The workspace configuration could not be loaded.</span>
            <Button label="Retry" variant="secondary" size="medium" type="button" disabled={false} loading={mutationInFlight} locked={false} focus={false} ariaLabel="Retry settings loading" onclick={reloadSettingsPage} />
          </section>
        {:else if settings !== null}
          <div class="settings-grid">
            <section class="settings-panel ehq-edge-surface" aria-label="Distribution settings">
              <dl>
                <div><dt>Workspace</dt><dd>{settings.workspaceId}</dd></div>
                <div><dt>Namespace API</dt><dd>{settings.namespace}</dd></div>
                <div><dt>Reads</dt><dd>{settings.reads}</dd></div>
                <div><dt>Payees</dt><dd>{settings.payeeCount}</dd></div>
                <div><dt>Contracts</dt><dd>{settings.contractCount}</dd></div>
                <div><dt>Currencies</dt><dd>{settings.currencies.length === 0 ? "—" : settings.currencies.join(", ")}</dd></div>
                <div><dt>FX rates</dt><dd>{settings.fxRateCount}</dd></div>
                <div><dt>Mutations</dt><dd>{settings.mutationsEnabled ? "enabled" : "read-only"}</dd></div>
              </dl>
            </section>

            <section class="settings-panel ehq-edge-surface" aria-label="Runtime controls">
              <header class="settings-editor-head">
                <strong>Runtime controls</strong>
                <span>Write access is controlled by the API runtime environment.</span>
              </header>
              <dl>
                <div><dt>Write gate</dt><dd>{writesEnabled ? "enabled" : "read-only"}</dd></div>
                <div><dt>Gate message</dt><dd>{writeGateMessage}</dd></div>
                <div><dt>API namespace</dt><dd>{settings.namespace}</dd></div>
              </dl>
              <div class="settings-editor-actions">
                <Button label="Refresh runtime state" variant="secondary" size="medium" type="button" disabled={isLoadingStatus(settingsState.status)} loading={isLoadingStatus(settingsState.status)} locked={false} focus={false} ariaLabel="Refresh Distribution runtime state" onclick={() => void refreshRuntimeControls()} />
              </div>
            </section>

            <section class="settings-panel ehq-edge-surface" aria-label="Save an FX rate">
              <header class="settings-editor-head">
                <strong>Save an FX rate</strong>
                <span>Add or update a currency pair and effective date.</span>
              </header>

              <div class="settings-editor-grid">
                <Input
                  id="distribution-fx-from"
                  label="Source currency"
                  value={fxFromCurrencyInput}
                  placeholder="EUR"
                  type="text"
                  state={fxFromCurrencyInput.trim().length > 0 && fxFromCurrencyNormalized === null ? "error" : "default"}
                  message={fxFromCurrencyInput.trim().length > 0 && fxFromCurrencyNormalized === null ? "ISO code required (EUR, USD...)." : ""}
                  oninput={updateFxFromCurrencyInput}
                />
                <Input
                  id="distribution-fx-to"
                  label="Target currency"
                  value={fxToCurrencyInput}
                  placeholder="MUR"
                  type="text"
                  state={fxToCurrencyInput.trim().length > 0 && fxToCurrencyNormalized === null ? "error" : "default"}
                  message={fxToCurrencyInput.trim().length > 0 && fxToCurrencyNormalized === null ? "ISO code required (MUR, EUR...)." : ""}
                  oninput={updateFxToCurrencyInput}
                />
                <Input
                  id="distribution-fx-date"
                  label="Effective date"
                  value={fxEffectiveDateInput}
                  placeholder="YYYY-MM-DD"
                  type="text"
                  state={fxEffectiveDateInput.trim().length > 0 && fxEffectiveDateNormalized === null ? "error" : "default"}
                  message={fxEffectiveDateInput.trim().length > 0 && fxEffectiveDateNormalized === null ? "Required format: YYYY-MM-DD." : ""}
                  oninput={updateFxEffectiveDateInput}
                />
                <Input
                  id="distribution-fx-rate"
                  label="Rate"
                  value={fxRateInput}
                  placeholder="53.941005"
                  type="text"
                  state={fxRateInput.trim().length > 0 && fxRateNormalized === null ? "error" : "default"}
                  message={fxRateInput.trim().length > 0 && fxRateNormalized === null ? "Positive number, up to 10 decimal places." : ""}
                  oninput={updateFxRateInput}
                />
              </div>

              <div class="settings-editor-actions">
                <Button
                  label="Save rate"
                  variant="primary"
                  size="medium"
                  type="button"
                  disabled={fxRateSaveStatus === "loading" || !writesEnabled || !fxRateFormValid}
                  loading={fxRateSaveStatus === "loading"}
                  locked={false}
                  focus={false}
                  ariaLabel="Save FX rate"
                  onclick={saveFxRate}
                />
              </div>

              {#if fxRateSaveMessage !== null}
                <p class={`settings-save-message ${fxRateSaveStatus === "error" ? "error" : "success"}`}>{fxRateSaveMessage}</p>
              {/if}
            </section>
          </div>

          <Table title="FX history" columns={fxRateColumns} rows={fxRateRows} state={tableStateFor(fxRatesState.status, fxRateRows.length)} actionLabel="" />
        {/if}
      {/if}
    </div>
</WorkspaceShell>

<style>
  :global(body) {
    overflow: hidden;
  }

  label span,
  .import-result,
  .contracts-actions,
  .contract-workflow,
  .contract-split-total,
  .lock-panel,
  .statement-summary,
  .statement-pdf span,
  .statement-pdf p {
    font-family: var(--ehq-mono);
  }

  .content {
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    padding: var(--ehq-space-5);
    display: grid;
    align-content: start;
    gap: var(--ehq-space-4);
    overflow-y: auto;
    overflow-x: hidden;
  }

  .import-result {
    margin: 0;
    padding: var(--ehq-space-3);
    border: 1px solid var(--ehq-border-strong);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-workspace-distribution-bg);
    color: var(--ehq-workspace-distribution);
    font-size: var(--ehq-type-caption-size);
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--ehq-space-3);
  }

  .dashboard-grid {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: var(--ehq-space-3);
  }

  .dashboard-top-grid {
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--ehq-space-3);
  }

  .form-panel,
  .filter-strip,
  .contracts-actions,
  .contract-workflow,
  .lock-panel,
  .period-control,
  .statement-summary {
    padding: var(--ehq-space-3);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--ehq-space-3);
  }

  .allocation-command-bar :global(.ehq-input-field) {
    flex: 1 1 360px;
  }

  .allocation-health,
  .allocation-table-intro {
    min-width: 0;
    padding: var(--ehq-space-4);
    display: grid;
    gap: var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-md);
    background: var(--ehq-surface);
  }

  .allocation-section-heading {
    min-width: 0;
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--ehq-space-4);
  }

  .allocation-section-heading > div {
    display: grid;
    gap: var(--ehq-space-1);
  }

  .allocation-section-heading span,
  .allocation-section-heading h2,
  .allocation-section-heading p {
    margin: 0;
  }

  .allocation-section-heading span {
    color: var(--ehq-workspace-distribution);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .allocation-section-heading h2 {
    font-size: var(--ehq-type-section-title-size);
  }

  .allocation-section-heading p {
    max-width: 720px;
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
    line-height: var(--ehq-type-ui-line);
  }

  .allocation-readiness,
  .allocation-health-kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .allocation-health-kpis {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .allocation-health-grid {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(280px, 0.65fr) minmax(0, 1.35fr);
    gap: var(--ehq-space-3);
  }

  .contract-workflow {
    align-items: center;
  }

  .contract-editor {
    min-width: 0;
    padding: var(--ehq-space-4);
    display: grid;
    gap: var(--ehq-space-3);
  }

  .contract-editor-heading,
  .contract-editor-actions,
  .contract-split-row,
  .contract-split-total {
    display: flex;
    align-items: center;
    gap: var(--ehq-space-3);
  }

  .contract-editor-heading,
  .contract-split-total {
    justify-content: space-between;
  }

  .contract-editor-heading > div,
  .contract-split-list {
    display: grid;
    gap: var(--ehq-space-2);
  }

  .contract-editor-heading > span {
    max-width: 620px;
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
    line-height: var(--ehq-type-ui-line);
  }

  .contract-split-row {
    padding: var(--ehq-space-3) 0;
    border-bottom: 1px solid var(--ehq-border);
    align-items: end;
  }

  .contract-split-row :global(.ehq-select-field),
  .contract-split-row :global(.ehq-input-field) {
    flex: 1 1 260px;
  }

  .contract-split-total {
    padding: var(--ehq-space-3);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-success-bg);
    color: var(--ehq-success);
  }

  .contract-split-total.error {
    background: var(--ehq-error-bg);
    color: var(--ehq-error);
  }

  .contract-editor-fields {
    padding: 0;
  }

  .contract-editor-actions {
    flex-wrap: wrap;
  }

  .catalog-contributor-panel {
    display: grid;
    gap: var(--ehq-space-3);
    padding: var(--ehq-space-4);
    border: 1px solid var(--ehq-border-strong);
    border-radius: var(--ehq-radius-sm);
  }

  .catalog-contributor-heading,
  .catalog-contributor-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ehq-space-3);
  }

  .catalog-contributor-heading > div {
    display: grid;
    gap: var(--ehq-space-1);
  }

  .catalog-contributor-heading > span,
  .catalog-contributor-row > span:last-of-type {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-caption-size);
  }

  .catalog-contributor-list {
    display: grid;
    gap: var(--ehq-space-2);
  }

  .catalog-contributor-row {
    padding: var(--ehq-space-2) var(--ehq-space-3);
    border-bottom: 1px solid var(--ehq-border);
  }

  .period-control {
    justify-content: space-between;
  }

  .period-control label,
  .period-control :global(.ehq-select-field) {
    width: min(360px, 100%);
  }

  .period-control p {
    margin: 0;
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-caption-size);
  }

  label {
    min-width: 0;
    display: grid;
    gap: var(--ehq-space-1);
  }

  label span {
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  /* Raw inputs remain only for cases the DS Input does not cover: date, file, readonly. */
  input {
    min-height: 38px;
    width: 100%;
    padding: 0 var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-bg-main);
    color: var(--ehq-text);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-control-size);
    font-weight: var(--ehq-type-body-weight);
    line-height: var(--ehq-type-ui-line);
    color-scheme: dark;
    outline: 0;
  }

  input:focus {
    border-color: var(--ehq-border-strong);
    box-shadow: 0 0 0 3px var(--ehq-workspace-distribution-bg);
  }

  .import-result {
    display: grid;
    gap: var(--ehq-space-1);
  }

  .panel-context {
    display: grid;
    gap: var(--ehq-space-1);
  }

  .panel-context strong {
    font-size: var(--ehq-type-ui-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  .panel-context span {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-caption-size);
  }

  .panel-error {
    color: var(--ehq-error);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-caption-size);
  }

  .import-result.error {
    border-color: var(--ehq-error);
    background: var(--ehq-error-bg);
    color: var(--ehq-error);
  }

  .command-card,
  .statement-pdf {
    min-width: 0;
    padding: var(--ehq-space-4);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
  }

  .statement-summary h2,
  .statement-summary p,
  .statement-pdf h2,
  .statement-pdf p,
  .statement-pdf header {
    margin: 0;
  }

  .statement-summary h2,
  .statement-pdf h2 {
    font-size: var(--ehq-type-section-title-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  .contracts-actions,
  .lock-panel {
    justify-content: space-between;
  }

  .contracts-actions span,
  .lock-panel p {
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
  }

  .statement-summary {
    justify-content: space-between;
    align-items: start;
  }

  .statement-summary p {
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .statement-detail-note {
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
  }

  .statement-summary dl {
    margin: var(--ehq-space-3) 0 0;
    display: grid;
    grid-template-columns: repeat(5, minmax(90px, 1fr));
    gap: var(--ehq-space-2);
  }

  .statement-summary div {
    min-width: 0;
  }

  .statement-summary dt,
  .statement-summary dd {
    margin: 0;
  }

  .statement-summary dt {
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
  }

  .statement-summary dd {
    margin-top: var(--ehq-space-1);
    color: var(--ehq-text);
    font-weight: var(--ehq-type-figure-weight);
    font-variant-numeric: tabular-nums;
  }

  .statement-pdf {
    width: min(100%, 840px);
    min-height: 560px;
    margin: 0 auto;
    background: var(--ehq-surface-high);
  }

  .statement-pdf header {
    display: flex;
    justify-content: space-between;
    gap: var(--ehq-space-3);
    color: var(--ehq-workspace-distribution);
  }

  .statement-pdf h2 {
    margin-top: var(--ehq-space-5);
    font-size: var(--ehq-type-page-title-size);
  }

  .statement-pdf p {
    margin: var(--ehq-space-2) 0 var(--ehq-space-4);
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
  }

  .empty-state {
    padding: var(--ehq-space-5);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: grid;
    gap: var(--ehq-space-2);
    justify-items: start;
  }

  .empty-state strong {
    font-family: var(--ehq-display);
    font-size: var(--ehq-type-section-title-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  .empty-state span {
    color: var(--ehq-text-soft);
    font-size: var(--ehq-type-ui-size);
    line-height: var(--ehq-type-ui-line);
  }

  .empty-state.error {
    --ehq-edge-fill: var(--ehq-error-bg);
    --ehq-edge-border-color: var(--ehq-error);
  }

  .recon-actions {
    padding: var(--ehq-space-4);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: grid;
    gap: var(--ehq-space-3);
  }


  .recon-action-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--ehq-space-3);
  }

  .recon-action {
    padding: var(--ehq-space-3);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: grid;
    gap: var(--ehq-space-2);
    align-content: start;
  }

  .recon-action strong {
    font-size: var(--ehq-type-ui-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  .recon-action p {
    margin: 0;
    color: var(--ehq-text-soft);
    font-size: var(--ehq-type-caption-size);
    line-height: var(--ehq-type-ui-line);
  }

  .recon-action-flag {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .settings-panel {
    padding: var(--ehq-space-4);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
  }

  .settings-grid {
    display: grid;
    gap: var(--ehq-space-4);
  }

  .settings-editor-head {
    display: grid;
    gap: var(--ehq-space-1);
    margin-bottom: var(--ehq-space-3);
  }

  .settings-editor-head strong {
    font-size: var(--ehq-type-ui-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  .settings-editor-head span {
    color: var(--ehq-text-soft);
    font-size: var(--ehq-type-caption-size);
  }

  .settings-editor-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--ehq-space-3);
    margin-bottom: var(--ehq-space-3);
  }

  .settings-editor-actions {
    display: flex;
    justify-content: flex-start;
  }

  .settings-save-message {
    margin: var(--ehq-space-2) 0 0;
    font-size: var(--ehq-type-caption-size);
  }

  .settings-save-message.error {
    color: var(--ehq-error);
  }

  .settings-save-message.success {
    color: var(--ehq-success);
  }

  .settings-panel dl {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--ehq-space-3);
  }

  .settings-panel div {
    min-width: 0;
  }

  .settings-panel dt,
  .settings-panel dd {
    margin: 0;
  }

  .settings-panel dt {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-caption-size);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .settings-panel dd {
    margin-top: var(--ehq-space-1);
    color: var(--ehq-text);
    font-weight: var(--ehq-type-figure-weight);
  }

  @media print {
    :global(body) {
      overflow: visible;
    }

    .print-hidden,
    .statement-summary {
      display: none;
    }

    .content {
      display: block;
      padding: 0;
      overflow: visible;
    }

    .statement-pdf {
      width: 210mm;
      min-height: 297mm;
      border: 0;
      border-radius: 0;
      background: var(--ehq-bg-main);
    }
  }

  @media (max-width: 1100px) {
    .kpi-grid,
    .dashboard-grid,
    .dashboard-top-grid {
      grid-template-columns: 1fr 1fr;
    }

    .allocation-health-kpis,
    .allocation-health-grid {
      grid-template-columns: 1fr 1fr;
    }

    .statement-summary dl {
      grid-template-columns: repeat(2, minmax(120px, 1fr));
    }
  }

  @media (max-width: 760px) {
    .content {
      padding: var(--ehq-space-3);
    }

    .kpi-grid,
    .dashboard-grid,
    .dashboard-top-grid,
    .statement-summary dl {
      grid-template-columns: 1fr;
    }

    .allocation-readiness,
    .allocation-health-kpis,
    .allocation-health-grid {
      grid-template-columns: 1fr;
    }

    .allocation-section-heading {
      align-items: start;
      flex-direction: column;
    }

    .contract-workflow,
    .contract-editor-heading,
    .contract-editor-actions,
    .contract-split-row {
      align-items: stretch;
      flex-direction: column;
    }

    .contract-split-row :global(.ehq-select-field),
    .contract-split-row :global(.ehq-input-field) {
      flex-basis: auto;
    }
  }
</style>
