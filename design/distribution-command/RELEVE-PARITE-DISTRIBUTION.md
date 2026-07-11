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
