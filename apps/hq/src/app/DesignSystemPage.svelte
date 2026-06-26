<script lang="ts">
  import {
    Badge,
    BarsChart,
    Button,
    Card,
    DivergeChart,
    DonutChart,
    Drawer,
    Input,
    KPI,
    LineChart,
    Loader,
    Panel,
    Select,
    Table,
    Toolbar,
    type ChartPoint,
    type DivergePoint,
    type SelectOption,
    type TableColumn,
    type TableRow,
    type ToolbarFilter
  } from "@ehq/ui";
  import { cssTokenGroups, typedTokenEntries, type CssTokenEntry } from "./design-system-data";
  import type { AppRoute } from "./routes";

  interface Props {
    readonly onNavigate: (route: AppRoute) => void;
  }

  const { onNavigate }: Props = $props();

  const previewStyle = (entry: CssTokenEntry): string => `--token-preview:var(${entry.variable});`;

  const statusOptions: readonly SelectOption[] = [
    { label: "Needs review", value: "review" },
    { label: "Validated", value: "validated" },
    { label: "Locked", value: "locked" }
  ];

  const toolbarFilters: readonly ToolbarFilter[] = [
    { label: "Period", value: "May 2026", active: true, disabled: false },
    { label: "Department", value: "All", active: false, disabled: false },
    { label: "Status", value: "Review", active: false, disabled: false },
    { label: "Workspace", value: "Locked", active: false, disabled: true }
  ];

  const tableColumns: readonly TableColumn[] = [
    { label: "Payee", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: false },
    { label: "Amount", align: "right", sortable: true },
    { label: "Action", align: "left", sortable: false }
  ];

  const tableRows: readonly TableRow[] = [
    {
      id: "alma",
      cells: [
        { kind: "text", value: "Alma Kreol", strong: true },
        { kind: "badge", value: "OK", tone: "success" },
        { kind: "money", value: "Rs 136 000", tone: "success" },
        { kind: "action", value: "Open", tone: "muted", locked: false }
      ]
    },
    {
      id: "avneesh",
      cells: [
        { kind: "text", value: "Avneesh", strong: true },
        { kind: "badge", value: "Pending", tone: "warning" },
        { kind: "money", value: "Rs 42 000", tone: "warning" },
        { kind: "action", value: "Post", tone: "active", locked: false }
      ]
    },
    {
      id: "locked",
      cells: [
        { kind: "text", value: "Locked distribution", strong: true },
        { kind: "badge", value: "Locked", tone: "error" },
        { kind: "money", value: "—", tone: "muted" },
        { kind: "action", value: "Access", tone: "error", locked: true }
      ]
    }
  ];

  const chartPoints: readonly ChartPoint[] = [
    { label: "Jan", value: 34 },
    { label: "Feb", value: 48 },
    { label: "Mar", value: 42 },
    { label: "Apr", value: 76 },
    { label: "May", value: 62 },
    { label: "Jun", value: 88 }
  ];

  const linePoints: readonly ChartPoint[] = [
    { label: "W1", value: 18 },
    { label: "W2", value: 38 },
    { label: "W3", value: 32 },
    { label: "W4", value: 64 },
    { label: "W5", value: 58 },
    { label: "W6", value: 78 }
  ];

  const divergePoints: readonly DivergePoint[] = [
    { label: "Office", negative: 22, positive: 66 },
    { label: "Rights", negative: 14, positive: 52 },
    { label: "Ops", negative: 38, positive: 30 }
  ];
</script>

<svelte:head>
  <title>ë • HQ — Design System</title>
</svelte:head>

<main class="design-page">
  <aside class="design-rail" aria-label="Design system navigation">
    <button class="brand" type="button" onclick={() => onNavigate("/app")}>
      <span>ë</span>
      <strong>Design System</strong>
    </button>
    <nav>
      <a href="#tokens">Tokens</a>
      <a href="#typed">Typed Mirror</a>
      <a href="#buttons">Buttons</a>
      <a href="#forms">Forms</a>
      <a href="#surfaces">Surfaces</a>
      <a href="#tables">Tables</a>
      <a href="#feedback">Feedback</a>
      <a href="#charts">Charts</a>
      <a href="#drawer">Drawer</a>
    </nav>
  </aside>

  <section class="design-main">
    <header class="hero">
      <p class="eyebrow">ë • HQ</p>
      <h1>Design System</h1>
      <p>
        Living reference for visual QA and onboarding. Foundations come from
        <code>--ehq-*</code> variables and components come from <code>@ehq/ui</code>.
      </p>
      <div class="hero-actions">
        <Button
          label="View components"
          variant="primary"
          size="medium"
          type="button"
          disabled={false}
          loading={false}
          locked={false}
          focus={false}
          ariaLabel="View components"
        />
        <Button
          label="Back to shell"
          variant="secondary"
          size="medium"
          type="button"
          disabled={false}
          loading={false}
          locked={false}
          focus={false}
          ariaLabel="Back to shell"
        />
      </div>
    </header>

    <section class="section" id="tokens">
      <div class="section-head">
        <p class="eyebrow">CSS Tokens</p>
        <h2>Visual variables</h2>
        <span>{cssTokenGroups.reduce((total, group) => total + group.entries.length, 0)} tokens rendered</span>
      </div>

      {#each cssTokenGroups as group (group.title)}
        <article class="reference-card">
          <div class="card-head">
            <h3>{group.title}</h3>
            <small>{group.entries.length} tokens</small>
          </div>
          <div class="token-grid">
            {#each group.entries as entry (entry.variable)}
              <div class={`token-row ${entry.previewKind}`} style={previewStyle(entry)}>
                <span class="token-preview" aria-hidden="true"></span>
                <div>
                  <strong>{entry.name}</strong>
                  <code>{entry.variable}</code>
                </div>
              </div>
            {/each}
          </div>
        </article>
      {/each}
    </section>

    <section class="section" id="typed">
      <div class="section-head">
        <p class="eyebrow">TypeScript Tokens</p>
        <h2>Typed mirror from @ehq/ui/tokens</h2>
        <span>{typedTokenEntries.length} values</span>
      </div>
      <article class="reference-card typed-card">
        {#each typedTokenEntries as entry (entry.path)}
          <div class="typed-row">
            <code>{entry.path}</code>
            <span>{entry.value}</span>
          </div>
        {/each}
      </article>
    </section>

    <section class="section" id="components">
      <div class="section-head">
        <p class="eyebrow">Prompt 05</p>
        <h2>Components and states</h2>
        <span>default · hover · focus · disabled · loading · empty · error · locked</span>
      </div>

      <article class="reference-card" id="buttons">
        <div class="card-head">
          <h3>Button</h3>
          <small>Primary, secondary, danger, focus, disabled, loading, locked</small>
        </div>
        <div class="component-grid compact">
          <Button label="Primary" variant="primary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Primary" />
          <Button label="Secondary" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Secondary" />
          <Button label="Danger" variant="danger" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Danger" />
          <Button label="Focus visible" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={true} ariaLabel="Focus visible" />
          <Button label="Loading" variant="secondary" size="medium" type="button" disabled={false} loading={true} locked={false} focus={false} ariaLabel="Loading" />
          <Button label="Locked" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={true} focus={false} ariaLabel="Locked" />
          <Button label="Disabled" variant="secondary" size="medium" type="button" disabled={true} loading={false} locked={false} focus={false} ariaLabel="Disabled" />
        </div>
      </article>

      <article class="reference-card" id="forms">
        <div class="card-head">
          <h3>Input, Select, Toolbar</h3>
          <small>Default, focus, error, disabled, filters and action loading</small>
        </div>
        <div class="component-grid">
          <Input id="ds-search" label="Search" value="Alma Kreol" placeholder="transaction, artist, statement..." type="search" state="default" message="" />
          <Input id="ds-focus" label="Focus" value="" placeholder="visible focus" type="text" state="focus" message="" />
          <Input id="ds-error" label="Error" value="Missing currency" placeholder="required" type="text" state="error" message="This field is required before validation." />
          <Input id="ds-disabled" label="Disabled" value="Read only" placeholder="" type="text" state="disabled" message="" />
          <Select id="ds-status" label="Status" value="review" options={statusOptions} state="default" message="" />
          <Select id="ds-status-error" label="Validation" value="locked" options={statusOptions} state="error" message="Choose a valid state." />
        </div>
        <Toolbar label="Filter toolbar" filters={toolbarFilters} actionLabel="Apply" loading={false} />
        <Toolbar label="Loading toolbar" filters={toolbarFilters} actionLabel="Refreshing" loading={true} />
      </article>

      <article class="reference-card" id="surfaces">
        <div class="card-head">
          <h3>Card, KPI, Panel</h3>
          <small>Standard, accent, hover, empty, error, locked, loading</small>
        </div>
        <div class="component-grid">
          <Card title="Workspace card" subtitle="Standard surface with compact hierarchy." eyebrow="Default" state="default" accent={false} badgeLabel="Stable" badgeTone="success" actionLabel="Open" />
          <Card title="Interactive card" subtitle="Hover and focus treatment for actionable surfaces." eyebrow="Hover" state="hover" accent={true} badgeLabel="Active" badgeTone="active" actionLabel="Review" />
          <Card title="No data" subtitle="The state remains calm when filters return no rows." eyebrow="Empty" state="empty" accent={false} badgeLabel="Empty" badgeTone="muted" actionLabel="Reset" />
          <Card title="Request failed" subtitle="The component exposes a clear error state." eyebrow="Error" state="error" accent={false} badgeLabel="Error" badgeTone="error" actionLabel="Retry" />
          <Card title="Distribution" subtitle="Locked access is shown with the red cross." eyebrow="Locked" state="locked" accent={false} badgeLabel="Locked" badgeTone="error" actionLabel="Request access" />
          <Card title="Loading card" subtitle="" eyebrow="Loading" state="loading" accent={false} badgeLabel="" badgeTone="muted" actionLabel="" />
        </div>
        <div class="component-grid">
          <KPI label="Revenue" value="Rs 5 890 000" detail="+ 8.2%" tone="success" state="default" accent={true} />
          <KPI label="Suspense" value="42" detail="needs review" tone="warning" state="hover" accent={false} />
          <KPI label="Blocked" value="3" detail="statements" tone="error" state="error" accent={false} />
          <KPI label="No data" value="None" detail="stable empty state" tone="muted" state="empty" accent={false} />
          <KPI label="Access" value="Locked" detail="request access" tone="error" state="locked" accent={false} />
          <KPI label="Loading" value="" detail="" tone="muted" state="loading" accent={false} />
        </div>
        <div class="component-grid">
          <Panel title="Panel standard" subtitle="Default" body="Graphite surface with subtle border and predictable action placement." state="default" primaryAction="Confirm" secondaryAction="Cancel" />
          <Panel title="Panel empty" subtitle="Empty" body="No line matches the active filters. The next action is explicit." state="empty" primaryAction="Reset" secondaryAction="" />
          <Panel title="Panel error" subtitle="Error" body="The load failed without hiding the rest of the screen." state="error" primaryAction="Retry" secondaryAction="Close" />
          <Panel title="Panel locked" subtitle="Locked" body="Unavailable workspaces remain visible with a request path." state="locked" primaryAction="Request access" secondaryAction="Close" />
        </div>
      </article>

      <article class="reference-card" id="tables">
        <div class="card-head">
          <h3>Table</h3>
          <small>Sortable headers, status cells, action cells, loading, empty, error, locked</small>
        </div>
        <div class="table-state-grid">
          <Table title="Royalty queue" columns={tableColumns} rows={tableRows} state="default" actionLabel="Export" />
          <Table title="Loading queue" columns={tableColumns} rows={[]} state="loading" actionLabel="Export" />
          <Table title="Empty queue" columns={tableColumns} rows={[]} state="empty" actionLabel="Export" />
          <Table title="Error queue" columns={tableColumns} rows={[]} state="error" actionLabel="Retry" />
          <Table title="Locked queue" columns={tableColumns} rows={[]} state="locked" actionLabel="Request access" />
        </div>
      </article>

      <article class="reference-card" id="feedback">
        <div class="card-head">
          <h3>Badge and Loader</h3>
          <small>Success, info, warning, error, active, muted, loader sizes</small>
        </div>
        <div class="component-grid compact">
          <Badge label="OK" tone="success" />
          <Badge label="Info" tone="info" />
          <Badge label="Review" tone="warning" />
          <Badge label="Blocked" tone="error" />
          <Badge label="Active" tone="active" />
          <Badge label="Muted" tone="muted" />
        </div>
        <div class="component-grid">
          <Loader label="Loading compact data" detail="" size="small" />
          <Loader label="Loading workspace" detail="The current context remains visible." size="medium" />
        </div>
      </article>

      <article class="reference-card" id="charts">
        <div class="card-head">
          <h3>Charts</h3>
          <small>Bars, line, diverging bars, donut</small>
        </div>
        <div class="component-grid">
          <BarsChart title="Revenue bars" points={chartPoints} tone="active" />
          <LineChart title="Cash movement" points={linePoints} tone="info" />
          <DivergeChart title="Variance" points={divergePoints} />
          <DonutChart title="Completion" value={72} label="Validated allocations" tone="success" />
        </div>
      </article>

      <article class="reference-card" id="drawer">
        <div class="card-head">
          <h3>Drawer</h3>
          <small>Open, closed, error and locked states</small>
        </div>
        <div class="component-grid">
          <Drawer open={true} title="Statement review" badgeLabel="Open" badgeTone="active" body="Drawer content uses the shared surface, badge and button primitives." primaryAction="Save" secondaryAction="Close" state="default" />
          <Drawer open={true} title="Failed request" badgeLabel="Error" badgeTone="error" body="The error state keeps the panel readable and points to a retry action." primaryAction="Retry" secondaryAction="Close" state="error" />
          <Drawer open={true} title="Office workspace" badgeLabel="Locked" badgeTone="error" body="Locked workspaces remain visible, with the red cross and access request path." primaryAction="Request access" secondaryAction="Close" state="locked" />
          <Drawer open={false} title="Closed drawer" badgeLabel="" badgeTone="muted" body="" primaryAction="Open" secondaryAction="Close" state="default" />
        </div>
      </article>
    </section>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    background: var(--ehq-bg-main);
    color: var(--ehq-text);
    font-family: var(--ehq-font);
  }

  :global(*) {
    box-sizing: border-box;
  }

  .design-page {
    min-height: 100vh;
    background: var(--ehq-bg-main);
    color: var(--ehq-text);
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    overflow-x: hidden;
  }

  .design-rail {
    position: sticky;
    top: 0;
    height: 100vh;
    padding: var(--ehq-space-4);
    border-right: 1px solid var(--ehq-border);
    background: var(--ehq-black);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: var(--ehq-space-5);
  }

  .brand {
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ehq-text);
    display: flex;
    align-items: center;
    gap: var(--ehq-space-3);
    text-align: left;
  }

  .brand span {
    width: 38px;
    aspect-ratio: 1;
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-yellow);
    color: var(--ehq-text-on-yellow);
    display: grid;
    place-items: center;
    font-size: 24px;
    font-weight: var(--ehq-type-display-weight);
  }

  .brand strong {
    font-family: var(--ehq-mono);
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  nav {
    display: grid;
    align-content: start;
    gap: var(--ehq-space-1);
  }

  nav a {
    padding: var(--ehq-space-2) var(--ehq-space-3);
    border-radius: var(--ehq-radius-sm);
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: 11px;
    text-decoration: none;
  }

  nav a:hover {
    background: var(--ehq-surface-high);
    color: var(--ehq-text);
  }

  .design-main {
    min-width: 0;
    padding: var(--ehq-space-6);
    display: grid;
    gap: var(--ehq-space-6);
  }

  .hero,
  .section,
  .reference-card {
    min-width: 0;
  }

  .hero {
    padding: var(--ehq-space-6);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-surface);
    display: grid;
    gap: var(--ehq-space-4);
  }

  .eyebrow {
    margin: 0;
    color: var(--ehq-yellow);
    font-family: var(--ehq-mono);
    font-size: 11px;
    font-weight: var(--ehq-type-label-weight);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1,
  h2,
  h3,
  p {
    margin: 0;
  }

  h1 {
    max-width: 760px;
    font-size: clamp(40px, 7vw, 84px);
    line-height: 0.95;
  }

  h2 {
    font-size: var(--ehq-h2);
  }

  h3 {
    font-size: var(--ehq-h3);
  }

  .hero > p:not(.eyebrow) {
    max-width: 760px;
    color: var(--ehq-text-soft);
    font-size: 16px;
    line-height: 1.7;
  }

  code {
    color: var(--ehq-yellow);
    font-family: var(--ehq-mono);
    font-size: 0.92em;
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ehq-space-2);
  }

  .section {
    display: grid;
    gap: var(--ehq-space-4);
  }

  .section-head,
  .card-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--ehq-space-4);
  }

  .section-head span,
  .card-head small {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: 11px;
    text-align: right;
  }

  .reference-card {
    padding: var(--ehq-space-4);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-surface);
    display: grid;
    gap: var(--ehq-space-4);
  }

  .token-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--ehq-space-2);
  }

  .token-row {
    min-width: 0;
    min-height: 64px;
    padding: var(--ehq-space-3);
    border: 1px solid var(--ehq-border-soft);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-bg-main);
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--ehq-space-3);
  }

  .token-preview {
    width: 42px;
    height: 42px;
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--token-preview);
  }

  .token-row.type .token-preview,
  .token-row.text .token-preview {
    background: var(--ehq-surface-high);
  }

  .token-row.space .token-preview {
    width: var(--token-preview);
    max-width: 42px;
    background: var(--ehq-yellow);
  }

  .token-row.radius .token-preview {
    border-radius: var(--token-preview);
    background: var(--ehq-yellow-muted);
  }

  .token-row.shadow .token-preview {
    background: var(--ehq-surface);
    box-shadow: var(--token-preview);
  }

  .token-row.motion .token-preview {
    background: linear-gradient(90deg, var(--ehq-yellow) 50%, var(--ehq-surface-high) 50%);
  }

  .token-row strong,
  .typed-row code {
    display: block;
    overflow-wrap: anywhere;
  }

  .token-row strong {
    font-size: 13px;
  }

  .token-row code {
    display: block;
    margin-top: var(--ehq-space-1);
    color: var(--ehq-text-muted);
  }

  .typed-card {
    max-height: 440px;
    overflow: auto;
  }

  .typed-row {
    min-width: 0;
    padding: var(--ehq-space-2) 0;
    border-bottom: 1px solid var(--ehq-border-soft);
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--ehq-space-3);
  }

  .typed-row:last-child {
    border-bottom: 0;
  }

  .typed-row span {
    color: var(--ehq-text-soft);
    font-family: var(--ehq-mono);
    font-size: 11px;
    overflow-wrap: anywhere;
  }

  .component-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--ehq-space-3);
    align-items: stretch;
  }

  .component-grid.compact {
    grid-template-columns: repeat(auto-fit, minmax(140px, max-content));
    align-items: center;
  }

  .table-state-grid {
    display: grid;
    gap: var(--ehq-space-3);
  }

  @media (max-width: 860px) {
    .design-page {
      grid-template-columns: 1fr;
    }

    .design-rail {
      position: relative;
      height: auto;
      border-right: 0;
      border-bottom: 1px solid var(--ehq-border);
    }

    nav {
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    }

    .design-main {
      padding: var(--ehq-space-4);
    }

    .hero {
      padding: var(--ehq-space-4);
    }

    .section-head,
    .card-head {
      align-items: start;
      flex-direction: column;
    }

    .section-head span,
    .card-head small {
      text-align: left;
    }

    .typed-row {
      grid-template-columns: 1fr;
    }
  }
</style>
