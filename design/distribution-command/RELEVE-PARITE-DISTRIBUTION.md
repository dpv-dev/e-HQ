# Releve De Parite - Distribution

Date: 2026-07-11
Perimetre: ancien plugin https://www.e-hq.eeee.mu/distribution/ vs nouvelle console https://app.eeee.mu/console/distribution/*
Decision de session: pas de deploy pour le moment, releve uniquement.

## Resume Executif

- Couverture navigation: bonne (14 sections legacy retrouvees, 15 sections dans la nouvelle console).
- Parite fonctionnelle: partielle.
- Parite disposition: non (layout modernise, structure cockpit legacy non reproduite a l'identique).
- Increment deja fait localement: flux Imports renforce (Import files, Preflight assistant, Open assistant, ouverture de batch vers Mapping, filtre Mapping par batch).
- Nettoyage deja fait localement: suppression des placeholders non utiles (Target Q3, Cible Q3, Generate batch PDF disabled).

## Methode

1. Connexion et navigation live sur l'ancien plugin (WordPress) avec compte admin.
2. Inventaire des sections, boutons, tables, formulaires et actions visibles.
3. Inventaire equivalent sur la nouvelle console Distribution.
4. Comparaison page par page: Equivalent / Partiel / Gap.

## Navigation Legacy (14)

1. Dashboard
2. Imports
3. Mapping
4. Catalog
5. Aliases
6. Duplicates
7. Contracts
8. Allocations
9. Suspense
10. Statements
11. Payments
12. Audit Log
13. Settings
14. Revenue

## Navigation Nouvelle Console (15)

1. Dashboard
2. Allocations
3. Suspense
4. Statements
5. Payments
6. Revenue
7. Imports
8. Mapping
9. Aliases
10. Duplicates
11. Catalog
12. Contracts
13. Financial Reconciliation (nouveau)
14. Audit Log
15. Settings

## Matrice De Parite Fonctionnelle

### Dashboard

- Legacy: cockpit readiness, diagnostics techniques, top royalties operationnels.
- Nouveau: KPIs + liste d'actions + chart revenus.
- Statut: Partiel.
- Delta a combler: reproduire cockpit blocages priorises et diagnostics operationnels au meme niveau de densite.

### Imports

- Legacy: Import files, Preflight assistant, Open assistant, ouverture rapide de lot.
- Nouveau initial: source/fichier/preview/confirm.
- Nouveau local (increment): Import files + Preflight assistant + Open assistant + action Open sur batch + pont vers Mapping.
- Statut: Partiel avance.
- Delta a combler: assistant pas encore structure visuelle legacy, et parcours batch -> mapping a enrichir (resume preflight et etapes guidage).

### Mapping

- Legacy: load/reset/bulk ops/automations de mapping.
- Nouveau: filtre statut + appliquer regles reutilisables.
- Nouveau local (increment): filtre batch en plus.
- Statut: Partiel.
- Delta a combler: bulk actions explicites (reset auto contributors, delete selected batches, clear selection), et orchestration guidee.

### Catalog

- Legacy: quality queue contributeurs + bulk edit/delete tracks.
- Nouveau: creation release/track + vue catalogue.
- Statut: Partiel.
- Delta a combler: queue qualite contributeurs et actions de masse.

### Aliases

- Legacy: new alias + filtre + ouverture.
- Nouveau: page presente mais capacites limitees.
- Statut: Gap.

### Duplicates

- Legacy: merge duplicate into master operationnel.
- Nouveau: detection consultative.
- Statut: Gap.

### Contracts

- Legacy: pilotage split et etats attention/ready.
- Nouveau: contrat + depenses/recoupements + remplacement regles.
- Statut: Partiel.
- Delta a combler: experience "needs attention / ready" equivalent et plus visible.

### Allocations

- Legacy: preview/post/safe wave/unpost all safe/prepare matched unallocated.
- Nouveau: preview/post/unpost avec verrou workflow.
- Statut: Partiel.
- Delta a combler: expose des operations legacy (safe wave prepare) selon les gardes de securite actuels.

### Suspense

- Legacy: filter + export CSV + resolve.
- Nouveau: filtre + resolve (panel) + table.
- Statut: Partiel.
- Delta a combler: export CSV explicite par filtre courant.

### Statements

- Legacy: generate statement.
- Nouveau: generer statements + impression PDF par ligne.
- Statut: Equivalent ou mieux (fonctionnel), mais layout different.

### Payments

- Legacy: record payment + coherence statement/payment.
- Nouveau: record/modifier/reconcile/void.
- Statut: Equivalent ou mieux.

### Audit Log

- Legacy: filtre operationnel.
- Nouveau: present mais surface plus legere.
- Statut: Partiel.

### Settings

- Legacy: configuration generale/imports/notifications + gestion FX.
- Nouveau: lecture seule.
- Statut: Gap (fonctionnel volontairement limite).

### Revenue

- Legacy: filtres + export CSV.
- Nouveau: lecture surtout.
- Statut: Gap.

### Financial Reconciliation (nouveau)

- Nouveau uniquement: diagnostic lecture seule statements/paiements/soldes/allocations.
- Statut: valeur ajoutee nouvelle.

## Parite Disposition (Layout)

- Legacy: hero permanent "Upload, exceptions, approval" + rail sections dans le contenu + cockpit dense et orientee blocages.
- Nouveau: shell unifie moderne, plus propre et cohérent, mais moins "tour de controle".
- Conclusion: pas de parite 1:1 de disposition.

## Backlog Propose (ordre de build)

### P0 - Critique Metier

1. Mapping bulk ops (reset auto contributors, clear selection, delete selected batches).
2. Duplicates merge operationnel.
3. Revenue: filtres complets + export CSV.
4. Settings: reintroduire les commandes utiles (au moins FX/import config) avec garde role + audit.

### P1 - Qualite Operationnelle

1. Catalog quality queue contributeurs + bulk edit.
2. Contracts: vue attention/ready plus explicite.
3. Suspense: export CSV filtre courant.
4. Imports assistant: rendre le flux guide plus proche du legacy (etapes visibles, resume preflight).

### P2 - Parite Layout Legacy

1. Hero distribution persistent.
2. Rail secondaire "sections" dans contenu.
3. Cockpit readiness/diagnostics structure legacy.

## Decisions De Session

1. Pas de deploy immediate.
2. Releve termine et formalise.
3. Placeholders non utiles retires localement.

## Etat Technique Local

- Fichier modifie: apps/hq/src/app/canonical/distribution/App.svelte
- Build local frontend: OK
- Deploy: non effectue sur cette etape

## Mise A Jour Parite - 2026-07-15

La reference live n'a pas pu etre relue dans cette session sans session WordPress partagee: les deux URLs redirigent vers leur formulaire de connexion. Les corrections ci-dessous sont donc alignees sur l'inventaire legacy deja capture dans ce releve et sur les contrats API canoniques existants.

### Aligne Dans La Console

- Dashboard: KPI Catalog tracks, Open royalties, Suspense et Last allocation; panneau Health derive des imports, splits, statements et allocations; actions de la liste navigables.
- Catalog: filtre de statut serveur, chargement complet des releases/tracks et action de revue des contributeurs par ligne.
- Contracts: KPI Active contracts, Open recoupments et Unbalanced splits.
- Suspense: export CSV du filtre courant.
- Statements: filtre Payee et periode partagee avec le contexte de la console.
- Revenue: filtres Group by, Payee, Store et Currency transmis au endpoint canonique.

### Restant A Verifier Ou A Completer

- Mapping: les actions legacy Accept/Map manually et les operations bulk de reset/delete n'ont pas d'equivalent API complet dans le client actuel.
- Duplicates: l'endpoint de resolution existe, mais le choix explicite du master doit etre confirme avec le comportement WordPress live.
- Settings: FX est gere; les commandes legacy de configuration/imports/notifications ne sont pas exposees par le contrat API actuel.
- Layout: la structure est modernisee et conserve les informations capturees, mais une comparaison pixel/ligne live reste necessaire apres connexion aux deux environnements.

### Snapshot Live Authentifie - 2026-07-15

La session partagee permet maintenant une comparaison directe.

**Ancien site - Dashboard**

- Revenus importes: `36,747.38 EUR` et `9,358.63 USD`.
- Royalties payees: `0.00 EUR`.
- Avances recoupables en cours: `2,533.34 EUR`.
- Couverture contrats: `124 / 169`, soit `73.4%` des titres earning.
- Blockers visibles: mapping `97,423`, catalog quality `608`, contrats sans split `162`, expenses sans payee `31`, allocations pending `29,044`, suspense `97,421`, reconciliation `0`.
- Diagnostics visibles: migration guard, dashboard cache, allocation runner, statement print/PDF.
- Top royalties visibles par artistes, tracks et stores, avec pagination entre les vues.

**App live - Dashboard**

- KPI affiches: Gross royalties `EUR 0.00`, Recouped `EUR 0.00`, Net payable `EUR 0.00`, Suspense `98,102`.
- Le graphique Revenue by source est vide.
- La table Action list contient seulement mapping `50`, statements `4`, payments `0`.
- Les blocs readiness, diagnostics, avances, couverture contrats et top royalties ne sont pas visibles.

Conclusion: l'ecart live est aussi un ecart de source/calcul dashboard. `toDistributionDashboard` et `toRevenueRows` utilisent uniquement les allocations `posted`, tandis que le legacy expose les revenus importes et les files operationnelles avant allocation. Une simple retouche CSS ou de shell ne peut pas resoudre cette difference.

### Regle D'Implementation Confirmee

- Les montants peuvent differer tant que les memes fichiers ne sont pas importes.
- Les calculs restent dans `services/api` et `packages/domain-distribution`.
- Le frontend ne touche ni la base ni les formules financieres: il affiche le contrat de lecture backend.
- La separation API / frontend et le modele de performance restent inchanges.
- La parite vise les zones visibles, colonnes, filtres, etats et actions du legacy; elle ne promet pas l'egalite numerique avant import equivalent.

### Implementation Locale - Tranche 2026-07-15

- `DistributionDashboardResponse` expose maintenant les KPI par devise, readiness, diagnostics et top royalties; ces blocs sont calcules par l'API.
- Le dashboard moderne affiche le cockpit readiness, les diagnostics, les top artists/tracks/stores et le bandeau workflow persistant.
- Imports expose les panneaux Upload/Assistant et la table de lots avec ID, distributor, status, rows, normalized, income, issues, skipped, currency et imported.
- Mapping expose Search, Automate, Apply rules, selection et compteur visible.
- Statements expose Payee, Currency et periode; Duplicates expose Merge into master avec choix explicite.
- Aucun calcul financier n'a ete deplace dans Svelte et aucune route API existante n'a ete remplacee.
