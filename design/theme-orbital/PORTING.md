# Orbital → ehq-platform : guide de portage

Comment passer des maquettes (`showcase/office/*.html`) à l'app réelle, étape par étape,
sans big-bang. Chaque étape est indépendamment shippable et réversible.

## Étape 0 — Re-skin global (1 ligne, réversible)

Dans `apps/hq/src/main.ts` (ou là où `visual-tokens.css` est importé), remplacer :

```ts
import "@ehq/ui/tokens/visual-tokens.css";
// par
import "../../design/theme-orbital/tokens/ehq-bridge.css";
```

Tout le shell existant (WorkspaceShell, Table, KPI, Button, Alert…) prend les couleurs
Orbital via les variables `--ehq-*` re-pointées. Aucun composant modifié. Rollback = revert
de l'import. **C'est l'étape à faire en premier pour valider la direction en conditions réelles.**

Points d'attention après le switch :
- Le cyan devient l'accent Office (`--ehq-workspace-office`) — vérifier les contrastes dans BankView.
- Les radius passent de 8/12/16 à 10/14/18 — vérifier les Drawer/Panel imbriqués.
- `--ehq-success` passe de #22C55E à #2EE6A8 — les tests de régression visuelle qui
  matchent la couleur exacte doivent être mis à jour (grep `#22C55E` dans les tests).

## Étape 1 — Composants : mapping .orb-* → @ehq/ui

| Maquette (.orb-*) | Composant app | Fichier | Travail |
|---|---|---|---|
| `.orb-kpi`, `--lead`, `__spark` | `KPI.svelte` / `StatCard.svelte` | `packages/ui/src/components/` | Fusionner : StatCard gagne la variante lead (ambre) + slot sparkline. Le sparkline est un `<svg>` inline avec 2 gradients — voir `showcase/index.html` section Cartes KPI |
| `.orb-kpi__gauge`, `.orb-ring` | **nouveau** `RingGauge.svelte` | à créer | conic-gradient + légende ; props: `stops` (segments), `value`, `legend[]` — pattern complet dans `dashboard.html` |
| `.orb-insight` | **nouveau** `InsightCard.svelte` | à créer | titre + badge confiance + body + actions ; consommer les suggestions de réconciliation existantes (`confidenceBp`) |
| `.orb-ticker` | **nouveau** `StatusTicker.svelte` | à créer | alimenter avec healthz + derniers imports + compteur unmatched (tout existe dans `OfficeScreenResponse`) |
| `.orb-stepper` | **nouveau** `PipelineStepper.svelte` | à créer | états done/active/todo ; utiliser pour le flux import (preview→confirm→réconcilier→valider) |
| `.orb-corners` | décoratif | CSS util dans visual-tokens | 4 `<i>` positionnés — trivial |
| `.orb-alert` | `Alert.svelte` | existant | ajouter le liseré gauche lumineux (`::before` + box-shadow) |
| `.orb-nav__item.active` | `WorkspaceShell.svelte` | existant | edge lumineux + gradient horizontal — remplace le highlight actuel |
| `.orb-badge` | `Badge.svelte` | existant | styles seulement (tokens) |
| `.orb-progress` | **nouveau** `ProgressBar.svelte` | à créer | déjà nécessaire pour Budget vs Actual (proposition validée) |
| `.heat` (balance âgée) | cellules `Table.svelte` | existant | nouveau `TableCell kind:"heat"` avec tone + intensité |
| `.tree-row/.tree-head` | **nouveau** `TreeTable.svelte` | à créer | pour P&L drilldown + Chart of Accounts (propositions validées) |

## Étape 2 — Pages, dans l'ordre de valeur

Chaque page maquette correspond à une section de `apps/hq/src/app/canonical/office/App.svelte`
(branche `activePageId === "…"`) ou à une sous-vue dédiée :

| Maquette | Cible dans l'app | Données | Notes |
|---|---|---|---|
| `dashboard.html` | `App.svelte` § dashboard | `getScreen` (bundle) | ring réconciliation = compteurs `reconciliations` déjà dans le bundle ; insight = suggestions haute confiance |
| `reconciliation.html` | `App.svelte` § reconciliation | `listReconciliations` | le lot « Rapprocher N » = `approveSuggestedReconciliations` (existe déjà côté API) |
| `pnl.html` | `App.svelte` § pnl | `getGlobalPnl` + `getDivisionPnl` + `getCategoryPnl` | remplace les 3 tables par TreeTable — cf. proposition validée |
| `coa.html` | `App.svelte` § coa | `getPlanComptable` | + contextuel : pré-remplir parentId au clic — cf. proposition validée |
| `transactions.html` | `App.svelte` § transactions | `listTransactions` | drawer d'édition = panneau existant re-stylé |
| `projects.html` | `ProjectsView.svelte` | `getProjectPnl` | Budget vs Actual : exige d'exposer `budget_income`/`budget_expenses` dans `OfficeProjectPnl` (champ API à ajouter — petit) |
| `clients/suppliers.html` | `PartnersView.svelte` | `listPartners` + `getPartnerRecord` | balance âgée : **nouveau endpoint d'agrégation par tranches** à créer côté API (calcul depuis transactionDate) |
| `imports.html` | `App.svelte` § imports | preview/confirm existants | stepper = état du dernier batch |
| `pending.html` | `App.svelte` § pending | `listTransactions status=pending` | classify = updateTransaction (type préservé — déjà corrigé) |
| `cashflow.html` | `App.svelte` § cashflow | `getCashflow` | chart bars in/out = composant BarsChart existant à re-styler |
| `bank.html` | `BankView.svelte` | bank accounts + raw | cartes compte = KPI lead par compte |
| `monitoring.html` | `MonitoringView.svelte` | `runIntegrityChecks` | mini-lists = données existantes |
| `audit.html` | `App.svelte` § audit | `listAuditLog` | table simple |
| `vat.html` | `VatView.svelte` | `getVatReport` | table par taux |
| `settings.html` | `SettingsView.svelte` | `listBankAccounts` | **danger zone** = UI du reset backend déjà livré (`resetFinancialData`, phrase `DELETE ALL OFFICE DATA`, admin-only) — il ne manque QUE cette UI + un test |
| `ceo.html` | `CeoView.svelte` | dashboard + pnl | top revenus = transactions income triées |
| `wave-invoices.html` | `App.svelte` § wave-invoices | existant | table + statuts |

## Étape 3 — Assets

- **Icônes** : les 29 SVG de `assets/icons/` dupliquent/étendent le set interne
  (`packages/ui/src/components/icons.ts`). Pour l'app, NE PAS charger en `<img>` :
  transposer les nouveaux paths (eye, layout-grid, filter, plus, x, pencil, refresh,
  trash, info, circle-alert, arrow-right, log-out, more-horizontal) dans `icons.ts`
  (même format path-data) pour rester sur le système `Icon.svelte` existant.
- **Fonds** : copier `assets/backgrounds/` dans `packages/ui/assets/backgrounds/` et
  référencer comme les fonds actuels (`?url` imports). `bg-hero-globe.svg` remplace
  la scène du login/landing ; `bg-page.svg` se pose derrière le shell via un
  pseudo-élément `position:fixed` (PAS `background-attachment:fixed` — gèle certains
  compositeurs, cf. README).
- **Pictogrammes** : usage empty-states (`EmptyState.svelte`) et cartes du landing.

## Étape 4 — Nettoyage

Une fois toutes les pages passées : supprimer le bridge, promouvoir les valeurs Orbital
comme nouvelles valeurs canoniques de `visual-tokens.css`, archiver ce dossier.

## Ce que les maquettes NE couvrent PAS (à ne pas oublier)

- États loading/error/empty par page (les composants Loader/EmptyState existants se
  re-stylent via tokens, mais chaque page mockée ne montre que l'état nominal).
- Responsive < 900px (les maquettes dégradent en 1 colonne mais l'app a ses propres
  breakpoints à vérifier).
- Le toggle Tree/Chart du P&L et les `<details>` interactifs : les maquettes sont
  statiques, l'interactivité vient des composants Svelte.
- Accessibilité : reporter les aria-labels existants de l'app, ne pas les perdre au re-style.
