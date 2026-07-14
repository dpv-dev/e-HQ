# Releve de parite - Office

Date: 2026-07-15
Reference: https://e-hq.eeee.mu/office
Cible: https://app.eeee.mu/console/office

## Regle de reference

Office App est une modernisation visuelle et technique de l'ancien Office. Les montants peuvent differer lorsque les imports ou les donnees disponibles different. Les sections, informations, tableaux, colonnes, filtres, actions, workflows et etats ne doivent pas etre simplifies sans accord explicite.

Les calculs restent dans `services/api`, `packages/domain-office` et `packages/domain-finance`. Le frontend consomme les endpoints Office types et ne lit pas les tables directement.

## Matrice

| Section legacy | Surface App | Contenu visible | Filtres / recherche | Actions / workflow | Etat |
| --- | --- | --- | --- | --- | --- |
| Dashboard | Office App dashboard | KPI Office, analytics, runway, project profitability, expense trend | Periode, From, To, presets rapides | Navigation vers imports, reconciliation, pending via les vues liees | Partiel a verifier live |
| CEO View | CeoView.svelte | Resume executif, P&L et indicateurs | Periode | Lecture executive | Present |
| Transactions | Office App transactions | Ledger, charts de mix, table generale | Account, department, division, category, project, type, status, periode | New entry, edit, approve, export CSV, pagination | Present |
| Pending | Office App pending | File des transactions pending | Periode et contexte Office | Classification et validation en masse | Present |
| P&L | Office App P&L | Department, division, category, charts et tables | Department, periode | Lecture et pagination | Present |
| Chart of accounts | Office App COA | Department -> division -> category, chart | Type, parent | Create, deactivate, row actions | Present |
| Clients | PartnersView facet client | Liste, detail, P&L, activite et suggestions | Facet client, periode | New client, open detail, edit, save | Present; parite des colonnes a verifier |
| Suppliers | PartnersView facet supplier | Liste, detail, P&L, activite et suggestions | Facet supplier, periode | New supplier, open detail, edit, save | Present; parite des colonnes a verifier |
| Projects | ProjectsView | Projets, P&L, coherence | Periode, dates | Open detail, corrections gardees | Present |
| VAT | VatView | Rapport VAT par periode | Periode | Lecture et export selon la vue | Present |
| Wave Invoices | Office App waveInvoices | Lane d'import et suivi Wave | Contexte imports/reconciliation/pending | Open imports, reconciliation, pending | Present; verifier les colonnes legacy |
| Bank | BankView | Comptes, lignes raw, qualite bancaire, reconciliation | Account, periode, dates et statuts | Import account, reassign, reconciliation, pagination | Present |
| PDF Import | Office App route `/console/office/pdf-import` | Upload, scan/analyse, review, import, rows detectees | Compte, source, periode et dates | Analyze, fix row, confirm import | Route exposee; workflow reutilise l'API canonique |
| Cash Flow | CashflowView | Actual, forecast, variance, closing, charts, manual entries, baseline import | Account, dates | Add forecast, cancel, preview/import baseline CSV | Obligatoire et present |
| Reconciliation | Office App reconciliation | Bank vs ledger, operations, suggestions, table | Account, status, periode, dates | Match, unmatch, reject, ignore, create transaction, approve suggestions | Present |
| Monitoring | MonitoringView | Integrity, bank quality, pending, audit et dashboard signals | Periode, dates | Refresh et navigation de correction | Present |
| Audit Log | Office App audit | Historique Office | Filtres disponibles dans la vue | Pagination, lecture | Present |
| Settings | SettingsView | Configuration Office, comptes, maintenance | Contexte workspace | Actions gardees par permissions | Present; verifier la parite des controles |
| Advances / comptes artiste-supplier | AdvancesView + PartnersView | Avances staff, freelancer, artist, supplier, contractor et autres; liens partenaires/payees | Kind, status, partner, projet, periode | Create, apply, mark paid, cancel, open partner | Obligatoire et present |

## Ecarts identifies pendant l'audit

- Le legacy affiche `PDF Import` comme une entree distincte; App l'expose maintenant sur `/console/office/pdf-import` en reutilisant le workflow API d'import deja existant.
- Le legacy affiche `CEO View` et `Cash Flow`; les libelles App sont alignes.
- Le legacy affiche des presets `Today`, `This Week`, `This Month`, `This Year` et `Clear`; ils sont ajoutes au controle de periode App.
- Le menu Office App suit maintenant l'ordre legacy; `Advances` et `Chart of accounts` restent visibles dans `Additional Office`.
- Transactions expose maintenant les champs backend `VAT` et `Partner` en plus des informations existantes de categorie, projet, montant et statut.
- Clients et Suppliers exposent les colonnes legacy `Name`, `Email`, `Phone`, `Tax ID`, tout en conservant les indicateurs d'activite et le detail partenaire App.
- Dashboard expose aussi le cashflow mensuel, les transactions validees recentes, les imports recents et la qualite bancaire par compte, en plus des analytics existantes.
- La vue PDF Import adapte ses titres et son action (`Upload a PDF`, `Scan PDF`) tout en reutilisant le meme preview API.
- L'ancien et le nouveau peuvent avoir des montants differents si les imports ne couvrent pas le meme perimetre. Ce n'est pas un ecart de parite frontend.
- Une verification detaillee des colonnes et actions de chaque table reste a conduire sur les routes live apres hydration complete, avec le meme workspace, periode, dates et permissions.

## Interdits

- Ne pas supprimer Cash Flow.
- Ne pas supprimer Advances ou les comptes artiste/supplier.
- Ne pas deplacer les calculs financiers dans Svelte.
- Ne pas creer de store canonique frontend.
- Ne pas modifier Distribution ou Command Center dans cette tache.
- Ne pas simplifier une section ou un tableau sans validation explicite.
