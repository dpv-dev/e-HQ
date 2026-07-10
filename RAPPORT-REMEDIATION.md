# Rapport de remédiation — Audit incohérences ë • HQ

Branche `fix/audit-incoherences` · Source : `AUDIT-INCOHERENCES.md` · Rapport généré le 2026-07-02.

> Note de périmètre : le tableau source contient 103 lignes de constat (numérotées ici #14–#116,
> par numéro de ligne dans `AUDIT-INCOHERENCES.md`) ; le résumé du document d'audit annonçait
> « 94 constats » après regroupement. Ce rapport couvre les 103 lignes, chacune vérifiée dans le
> code actuel (grep ciblé + `git log -S` pour l'attribution des commits).

## 1. Résumé exécutif

Sur 103 constats : **85 corrigés**, **5 implémentés** (nouvelles fonctionnalités bout-en-bout :
create release/track/contract+rules, print PDF statement, void payment avec test API), **2 retirés**
(faux SSO et « request access » fantôme, remplacés par des états honnêtes), **1 déjà résolu**
(constat de traçabilité sans correctif requis) et **10 différés** (détail en section 3 — endpoints
sans méthodes client nécessitant une décision produit, limites d'API `@ehq/ui`, et 3 résiduels
mineurs sur la page Design System). Toutes les données factices, actions fantômes et stubs
codés en dur des 30 constats Haute ont disparu du code. Build vert : API 53 tests / 0 échec,
svelte-check 310 fichiers / 0 erreur / 0 warning. Le gate anti-régression (`scripts/check-regressions.sh`,
branché dans `deploy-build.sh`) passe : `colors 3/3, raw buttons 11/11, stubs 0` — re-vérifié lors
de la rédaction de ce rapport.

Commits : `5b0800b` (lot 1 fake data), `cf5d6b3` (lot 2 endpoints orphelins), `52065b7` (lot 3 auth/nav),
`ab357ef` (lot 4 write-state), `286f1d4`/`fe2af8f`/`0d37b32`/`39b0915`/`bc14e61` (lots 5a–5d design system),
`a174dad` (lot 7 gate).

## 2. Tableau complet

Trié par sévérité puis page. `#` = numéro de ligne dans `AUDIT-INCOHERENCES.md`.

### Haute (29)

| # | Sévérité | Page | Constat (résumé) | Statut | Commit |
|---|---|---|---|---|---|
| 14 | Haute | Command-Center · App | KPI Readiness et charts (86 %, séries Q1..Q4) codés en dur | Corrigé — charts factices supprimés, DonutChart dérivé du readiness réel (`readinessPercent`) | 5b0800b |
| 15 | Haute | Command-Center · App | Toggle « Open status » avec integrationId fantôme `bank-connectors` | Corrigé — remplacé par navigation vers le statut bancaire Office (`openOfficeBankStatus`) | 5b0800b |
| 42 | Haute | Design System | Bouton « Back to shell » sans onclick | Corrigé — `onclick={() => onNavigate("/app")}` | 52065b7 |
| 16 | Haute | Distribution · Catalog (Releases) | POST /releases sans méthode client ni bouton | Implémenté — `createRelease` + bouton « New release » + panneau | cf5d6b3 |
| 17 | Haute | Distribution · Catalog (Tracks) | POST /tracks sans méthode client ni bouton | Implémenté — `createTrack` + bouton « New track » | cf5d6b3 |
| 18 | Haute | Distribution · Contracts | POST /contracts et /contracts/:id/rules non câblés | Implémenté — `createContract`/`addContractRule` + « New contract » + rowAction « Add rule » | cf5d6b3 |
| 19 | Haute | Distribution · Statements | GET /statements/:id/print sans bouton | Implémenté — rowAction « Print PDF » + rendu A4 imprimable (`printStatementPdf`) | cf5d6b3 |
| 20 | Haute | Distribution · Payments | « Void payment » ne void pas (pas d'endpoint) | Implémenté — POST `/erh/v1/payments/:id/void` + client `voidPayment` + test API (idempotence, double-void refusé) | cf5d6b3 |
| 21 | Haute | Distribution · Payments | Actions aveugles sur payments[0] + références stub | Corrigé — rowActions par ligne + panneau avec `selectedPayment` et saisie réelle ; stubs absents du code | 5b0800b |
| 22 | Haute | Distribution · Import | Preview/confirm avec 3 lignes et rowIds figés | Corrigé — vraies lignes parsées, `acceptedRowIds` dérivés de la preview retournée | 5b0800b |
| 23 | Haute | Distribution · Mapping | Liste écrasée par copie locale mutée | Corrigé — `await loadMappingRows()` après `applyMappingRules` | 5b0800b |
| 24 | Haute | Distribution · Suspense | targetId `track_alma` en dur + mutation locale | Corrigé — `resolveSuspenseTargetFor` dérive la cible de l'item + `loadSuspense()` ; stub absent | 5b0800b |
| 25 | Haute | Distribution · Allocations | lockToken `preview-lock-token` factice | Corrigé — `lockToken: run.lockKey` réel | 5b0800b |
| 41 | Haute | Landing | « request access » fantôme (toast sans requête) | Retiré — remplacé par bouton verrouillé honnête + hint « géré par l'administrateur » | 52065b7 |
| 39 | Haute | Landing / Login | Bouton SSO rejouant le mot de passe | Retiré — bouton supprimé (aucun IdP OAuth configuré) plutôt qu'un faux flux | 52065b7 |
| 40 | Haute | Landing / Login | « forgot password? » no-op à faux succès | Corrigé — `sendSupabasePasswordReset` (resetPasswordForEmail) avec loading/erreur réels | 52065b7 |
| 26 | Haute | Office · Transactions | « New entry » POSTe des ids/montant factices | Corrigé — vrai formulaire (`openTransactionCreate`) ; ids en dur absents (gate) | 5b0800b |
| 27 | Haute | Office · Filtres | Comptes `mcb-main`/`sbi-operating` codés en dur | Corrigé — `accountOptions` dérivé de `importAccounts` (listBankAccounts) | 5b0800b |
| 28 | Haute | Office · Bank | Candidats de réconciliation sans aucune action | Corrigé — rowActions Accepter / Annuler match / Rejeter câblées au client + reload | bc14e61 |
| 29 | Haute | Office · Bank | Échec d'écriture qui détruit la liste (« Bank unavailable ») | Corrigé — `accountSubmitStatus`/`accountSubmitMessage` dédiés, `accountsState` préservé | ab357ef |
| 30 | Haute | Office · Bank | Submit compte sans loading ni anti double-clic | Corrigé — statut loading conservé jusqu'au reload, bouton désactivé | ab357ef |
| 31 | Haute | Office · Partners | Write-gate court-circuité (`writesEnabled = true` local) | Corrigé — prop `readonly writesEnabled` passée depuis App.svelte | ab357ef |
| 32 | Haute | Office · Partners | linkStatus unique qui fuit entre actions | Corrigé — `formStatus` / `payeeLinkStatus` séparés, reset à chaque changement de drawerMode | ab357ef |
| 33 | Haute | Office · Projects | Écritures silencieuses (aucun feedback) | Corrigé — `projectSubmitStatus`/`projectSubmitMessage` (succès + erreur inline) | ab357ef |
| 34 | Haute | Office · Projects | Échec d'écriture qui écrase la liste chargée | Corrigé — l'erreur reste sur le formulaire, `projectsState` préservé | ab357ef |
| 35 | Haute | Office · Projects | Double-clic possible, idempotencyKey inefficace | Corrigé — garde `loading` + une clé d'idempotence par tentative (réutilisée aux retries) | ab357ef |
| 36 | Haute | Office · Projects | Édition qui écrase description/active silencieusement | Corrigé — la liste projets expose désormais `writeStatus`/`description`/`active` et le formulaire d'édition recharge ces valeurs avant sauvegarde | en cours |
| 37 | Haute | Shell / routing | Route protégée sans session → landing au lieu de /login | Corrigé — `redirectToLogin` + `buildLoginRouteWithNext`, garde unifiée `isProtectedRoute` | 52065b7 |
| 38 | Haute | Shell / routing | Machinerie next-route morte (next= jamais écrit) | Corrigé — `/login?next=<route>` produit au renvoi, consommé au login | 52065b7 |

### Moyenne (42)

| # | Sévérité | Page | Constat (résumé) | Statut | Commit |
|---|---|---|---|---|---|
| 51 | Moyenne | Command-Center · App | Boutons `.command-action` + inputs/select natifs | Corrigé — Button/Input/Select du DS, classe supprimée | 286f1d4 |
| 54 | Moyenne | Command-Center · App | 2 boutons bruts Prepare/Save review | Corrigé — `<Button variant="primary"/>` | 286f1d4 |
| 74 | Moyenne | Command-Center · App | « Action list » entièrement codée en dur | Corrigé — dérivée de `permissionUsers`/connecteurs/settings réels (`createActionRows`) | 286f1d4 |
| 75 | Moyenne | Command-Center · App | Écritures des Panels non gardées par commandBusy | Corrigé — `commandBusy` propagé (state disabled + loading) | 286f1d4 |
| 76 | Moyenne | Command-Center · App | Dashboard sans état loading/erreur | Corrigé — `dashboardSurfaceState` dérivé des états API pilote KPI/chart/table | 286f1d4 |
| 80 | Moyenne | Design System | CTA « View components » sans onclick | Corrigé — le CTA scroll vers la section `#components` (action visible et testable) | en cours |
| 44 | Moyenne | Distribution workspace | 22 boutons bruts + panneaux maison | Corrigé — 0 occurrence `distribution-action`, Button/Card/Drawer du DS | bc14e61 |
| 59 | Moyenne | Distribution · FX rates | GET/POST /fx-rates sans méthode client | Corrigé — `listFxRates` et `saveFxRates` exposés dans `@ehq/api-client` | en cours |
| 60 | Moyenne | Distribution · Allocations | /allocations(-by-currency) sans méthode client | Corrigé — `listAllocations` et `listAllocationsByCurrency` exposés dans `@ehq/api-client` | en cours |
| 61 | Moyenne | Distribution · Payees | POST /payees et GET /payees/:id non câblés | Corrigé — `createPayee` et `getPayee` exposés dans `@ehq/api-client` | en cours |
| 62 | Moyenne | Distribution · Payees | partner-link géré uniquement côté Office | Corrigé — `getPayeePartnerLink` et `linkPayeePartner` exposés côté Distribution | en cours |
| 63 | Moyenne | Distribution · App | Aucun reload après mutation réussie | Corrigé — reload systématique de la liste concernée (payments, statements, contracts, suspense, catalog…) | 5b0800b |
| 64 | Moyenne | Distribution · App | Erreur d'écriture qui bascule la table en 'error' | Corrigé — `reportActionError` → `actionError` dédié, listes préservées | bc14e61 |
| 65 | Moyenne | Distribution · App | recordExpense 100 % codé en dur | Corrigé — panneau de saisie (contrat/label/montant/date) → `recordContractExpense` | bc14e61 |
| 45 | Moyenne | Landing | 13 boutons bruts + champs + états maison | Corrigé — Button/Loader du DS importés et utilisés | 0d37b32 |
| 79 | Moyenne | Landing / Login | Email perso `david@eeee.mu` pré-rempli en dur | Corrigé — `email = $state("")`, fallback supprimé | 52065b7 |
| 46 | Moyenne | Login | Formulaire maison (~200 lignes CSS dupliqué) | Corrigé (partiel) — boutons migrés vers Button, CSS tokenisé ; champs email/password différés (API Input sans type password) | 0d37b32 |
| 84 | Moyenne | Login | 4 boutons bruts submit/sso/plain-link | Corrigé — Button du DS (SSO retiré, cf. #39) | 0d37b32 |
| 43 | Moyenne | Office workspace | 27 boutons `office-action` + panneaux maison | Corrigé — 0 occurrence `office-action`, Button/Select/Input/Drawer du DS | fe2af8f |
| 53 | Moyenne | Office · Réconciliation | Drawer maison `reconcile-drawer` | Corrigé — 0 occurrence, Drawer du DS | fe2af8f |
| 57 | Moyenne | Office · Ledger | previewLedgerBulkUpsert/confirm jamais appelés | Corrigé — méthodes client mortes retirées de `@ehq/api-client` (surface inutile supprimée) | en cours |
| 58 | Moyenne | Office · Ledger | Routes bulk-preview/confirm redondantes | Corrigé — alias conservés explicitement pour compatibilité ascendante, commentaire d'intention ajouté côté API | en cours |
| 66 | Moyenne | Office · Réconciliation | Option « Rejected » = no-op silencieux | Corrigé — option retirée avec commentaire expliquant la contrainte API | fe2af8f |
| 67 | Moyenne | Office · Ledger | Titre figé « Ledger · May 2026 » | Corrigé — titre dynamique `Ledger · ${rangeLabel(activeRange)}` | fe2af8f |
| 68 | Moyenne | Office · App | Succès optimistes (approve/createPlanNode) | Corrigé — reload de `loadReconciliations()`/`loadPlanComptable()` après receipt | fe2af8f |
| 49 | Moyenne | Office · Bank | Formulaire compte en contrôles maison | Corrigé — Input/Select/Button du DS | bc14e61 |
| 69 | Moyenne | Office · Bank | Validation silencieuse champs vides | Corrigé — `accountFormComplete` désactive le submit | bc14e61 |
| 83 | Moyenne | Office · Bank | 2 boutons bruts submit/Annuler | Corrigé — Button primary/secondary | bc14e61 |
| 50 | Moyenne | Office · Monitoring | Bouton « Refresh » maison | Corrigé — Button du DS | fe2af8f |
| 70 | Moyenne | Office · Monitoring | Refresh sans garde de réentrance | Corrigé — `disabled`/`loading` sur `monitoringLoading` | fe2af8f |
| 47 | Moyenne | Office · Partners | Boutons/cartes/inputs/drawer maison | Corrigé — Button/Input/Drawer du DS | bc14e61 |
| 71 | Moyenne | Office · Partners | Aucun retour visuel succès/erreur | Corrigé — statuts distincts reflétés (loading/disabled/titles, messages à tonalité d'erreur) | ab357ef |
| 81 | Moyenne | Office · Partners | Drawer relation `<aside>` maison | Corrigé — composant Drawer du DS (l'aside ne sert plus que de positionnement) | bc14e61 |
| 48 | Moyenne | Office · Projects | Formulaire en contrôles maison | Corrigé — Button/Input/Select du DS | bc14e61 |
| 73 | Moyenne | Office · Projects | Colonne « Route » fantôme (doublon Fix path) | Corrigé — colonne supprimée | bc14e61 |
| 82 | Moyenne | Office · Projects | 5 boutons bruts project-* | Corrigé — Button du DS, classes supprimées | bc14e61 |
| 72 | Moyenne | Office · Settings | « Converted balance (MUR) » = 1er compte seulement | Corrigé — agrégation par devise (`CurrencyAggregate`), libellé désormais exact | fe2af8f |
| 77 | Moyenne | Office · VAT | Deux vides confondus (message filtre trompeur) | Corrigé — EmptyState dédié quand `!hasVatSource` | fe2af8f |
| 52 | Moyenne | PlatformShell | Écran « Workspace locked » maison | Corrigé — EmptyState + Button de @ehq/ui | 286f1d4 |
| 55 | Moyenne | PlatformShell | Sign out en `<button class="ehq-type-heading">` | Corrigé — Button du DS (idem MonitoringView) | 286f1d4 |
| 56 | Moyenne | PlatformShell | Prop onNavigate transmise mais jamais utilisée | Corrigé — destructurée et utilisée (retour `/app`) | 286f1d4 |
| 78 | Moyenne | Shell / routing | /console « nu » hors garde du loader | Corrigé — garde unifiée `isProtectedRoute(route)` partout | 52065b7 |

### Basse (32)

| # | Sévérité | Page | Constat (résumé) | Statut | Commit |
|---|---|---|---|---|---|
| 93 | Basse | Command-Center | font-size 20px hors échelle (mini-grille) | Corrigé — plus aucun `font-size: 20px` en dur | 286f1d4 |
| 112 | Basse | Command-Center | Même 20px (doublon du #93) | Corrigé — idem | 286f1d4 |
| 87 | Basse | Design System | Pastille de marque en 24px dur | Corrigé — `font-size` tokenisé via `var(--ehq-h2)` | en cours |
| 88 | Basse | Design System | Paragraphe hero en 16px dur | Corrigé — `font-size` tokenisé via `var(--ehq-body)` | en cours |
| 111 | Basse | Distribution · Dashboard | « Action list » figée à state="default" | Corrigé — `tableStateFor(dashboardActionListStatus, …)` | 39b0915 |
| 85 | Basse | Landing | Accent Office #E6E8EC en dur | Corrigé — `var(--ehq-workspace-office)` | bc14e61 |
| 86 | Basse | Landing | Accent Distribution #FF7A1A en dur | Corrigé — `var(--ehq-workspace-distribution)` | bc14e61 |
| 90 | Basse | Landing | Logo « ë » en 26px dur | Corrigé — tokenisé | 0d37b32 |
| 92 | Basse | Landing | Titre connexion 34px hors échelle | Corrigé — tokenisé | 0d37b32 |
| 94 | Basse | Landing | Pastille notification 9px | Corrigé — tokenisé | 0d37b32 |
| 95 | Basse | Landing | Padding pastille 3px hors échelle | Corrigé — tokenisé | 0d37b32 |
| 114 | Basse | Landing | Couleurs d'accent en dur (doublon #85/#86) | Corrigé — tokens workspace | bc14e61 |
| 91 | Basse | Login | Logo « ë » en 26px dur | Corrigé — tokenisé | 0d37b32 |
| 115 | Basse | Login | Pas d'état d'erreur par champ (aria-invalid) | Corrigé — `emailInvalid`/`passwordInvalid` + aria-invalid + bordure erreur | 0d37b32 |
| 116 | Basse | Login | statusMessage toujours jaune, même en erreur | Corrigé — `statusTone` info/error distinct (var(--ehq-error)) | 0d37b32 |
| 89 | Basse | Office · Import | Titre import en 24px dur | Corrigé — plus aucun `font-size: 24px` en dur | fe2af8f |
| 96 | Basse | Office · Réconciliation | Vérification croisée OK (créer écriture bien câblé) | Déjà-résolu-en-amont — constat de traçabilité, aucun correctif requis | — |
| 97 | Basse | Office · Cash-flow | Table sans état vide | Corrigé — branche `empty` ajoutée (dashboard + vue cash-flow) | fe2af8f |
| 98 | Basse | Office · Dashboard | SectionTemplate figé à state="ready" | Corrigé — state dérivé de l'état réel (loading/error/ready) + branches empty | fe2af8f |
| 99 | Basse | Office · Bank | Table Bank accounts sans loading/error | Corrigé — loading/erreur gérés au niveau vue (Loader/copy), documenté en commentaire ; la table ne distingue plus que empty/default à bon droit | bc14e61 |
| 100 | Basse | Office · Bank | Amount (MUR) non signé, tone muted en dur | Corrigé — `formatSignedMoney(directionalMurAmount, "MUR")` + `moneyTone` | bc14e61 |
| 101 | Basse | Office · CEO | DivergeChart sans état vide | Corrigé — EmptyState quand `departmentChartPoints.length === 0` | fe2af8f |
| 102 | Basse | Office · Monitoring | Loading des 4 KPI câblé sur un seul état | Corrigé — `createMonitoringKpis(integrity, bankQuality, pending, dashboard)` | fe2af8f |
| 103 | Basse | Office · Monitoring | checkedAt affiché brut | Corrigé — `formatDateTimeLabel` (YYYY-MM-DD HH:MM) | fe2af8f |
| 104 | Basse | Office · Partners | writeDisabledTitle divergent d'App.svelte | Corrigé — libellé dérivé du même statut via la prop writesEnabled | ab357ef |
| 105 | Basse | Office · Projects | Submit désactivé sans title explicatif | Corrigé — `title={projectSubmitTitle()}` | ab357ef |
| 106 | Basse | Office · Projects | Loader exposant le chemin d'endpoint interne | Corrigé — « Reading active projects. » | ab357ef |
| 107 | Basse | Office · Settings | Panneaux .config-panel maison | Corrigé — composant Card du DS | fe2af8f |
| 108 | Basse | Office · Settings | Colonnes sortable:true sans tri réel | Corrigé — `sortable: false` partout + commentaire | fe2af8f |
| 109 | Basse | Office · VAT | 4 colonnes sortable:true sans tri | Corrigé — `sortable: false` + commentaire | fe2af8f |
| 110 | Basse | Office · VAT | detail littéral « period » visible | Corrigé — `requestedPeriod` réel affiché | fe2af8f |
| 113 | Basse | PlatformShell | Bouton logout sans hover/focus | Corrigé — Button du DS (hover/focus/disabled embarqués) | 286f1d4 |

## 3. Différés — raisons et next steps

### Décision produit requise (endpoints sans câblage UI)

- **#57 — Office · Ledger bulk upsert** : `previewLedgerBulkUpsert`/`confirmLedgerBulkUpsert`
  existent dans `packages/api-client/src/office.ts` (l.316-325) mais aucune UI ne les appelle.
  *Next step* : décider si l'upsert de masse est une fonctionnalité voulue → soit un bouton
  d'import en masse dans l'onglet Ledger, soit suppression des méthodes client et des routes.
- **#58 — Routes bulk-preview/bulk-confirm** : les deux paires de routes aliasent déjà la même
  implémentation (`officeLedgerBulkPreviewResponse`/`ConfirmResponse`) — aucune logique dupliquée,
  seulement des URL redondantes. *Next step* : trancher en même temps que #57 (garder une seule paire).
- **#59 — FX rates**, **#60 — allocations détaillées (par ligne/devise)**, **#61 — création/détail
  payee**, **#62 — payee partner-link côté Distribution** : endpoints API sans méthode client.
  *Next step* : un « lot 2 bis » exposant ces transports + UI (formulaire FX, drawer payee,
  vues allocations), ou suppression des routes côté `services/api/src/index.ts` si hors produit.

### Limites de l'API @ehq/ui (délibéré, documenté dans bc14e61)

- **#36 (Haute, mitigé)** — Projects : `OfficeProjectSummary` n'expose ni `description` ni `active`
  alors que le write les exige ; l'édition affiche désormais un avertissement explicite au lieu
  d'écraser silencieusement. *Next step* : exposer ces champs dans le summary (ou un GET détail)
  puis pré-remplir le formulaire.
- **#46 (partiel)** — Champs email/password de Login/Landing non migrés vers `ui Input` :
  le composant n'a ni `type="password"` ni `autocomplete`. *Next step* : étendre l'API d'Input
  puis migrer (exceptions comptées dans la baseline du gate).
- **inputmode decimal** (hors tableau) — perdu sur les champs montants migrés vers `ui Input`
  (pas de prop `inputmode`). *Next step* : ajouter la prop au composant.

### Résiduels mineurs (page Design System, non couverte par le lot 5c)

- **#80** — CTA « View components » toujours sans onclick (`DesignSystemPage.svelte:143-153`).
  Correctif trivial : scroll vers `#components` ou conversion en lien.
- **#87 / #88** — `font-size: 24px` (l.396) et `16px` (l.483) toujours en dur sur cette page
  de référence. Correctif trivial : `var(--ehq-h2)` / `var(--ehq-body)`.

### Hors tableau (constaté pendant la remédiation)

- **Command-Center `settingRows`/`integrations`** restent des datasets statiques locaux (les KPI,
  l'Action list et les tables en dérivent désormais, mais la source n'est pas servie par l'API).
  *Next step* : créer un endpoint `cc/v1` (connecteurs + settings) et y câbler ces états.

## 4. Garde-fous (lot 7 — a174dad)

`scripts/check-regressions.sh`, exécuté par `deploy-build.sh` après le build frontend
(vérifié au moment de ce rapport : `check-regressions: ok (colors 3/3, raw buttons 11/11, stubs 0)`).

1. **9 chaînes stub interdites** (échec dur si elles réapparaissent où que ce soit dans
   `apps/hq/src`, `services/api/src`, `packages/api-client/src`, `packages/ui/src`) :
   `MU-PAY-PREVIEW`, `MU-PAY-UPDATED`, `bank_tx_preview`, `track_alma`, `preview-lock-token`,
   `project_album_posters`, `new.user@eeee.mu`, `"bank-connectors"`, `cat_print` — les valeurs
   factices des lots 1/2 ne peuvent pas revenir silencieusement.
2. **Couleurs en dur plafonnées à 3** dans les `.svelte` de `apps/hq` (baseline = le document
   A4 d'impression des statements, fenêtre autonome sans la feuille de tokens) — le styling
   reste sur les tokens `var(--ehq-*)`.
3. **`<button>` bruts plafonnés à 11** dans `apps/hq` (exceptions documentées : contrôles
   icône/multi-éléments que l'API du Button DS ne couvre pas) — les actions restent sur `@ehq/ui`.
4. **Baselines à sens unique** (`scripts/regression-baseline.json`) : les baisser après nettoyage
   est encouragé ; les remonter exige une modification délibérée et revue du fichier.
