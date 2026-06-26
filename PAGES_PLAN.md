# PAGES_PLAN — ë • HQ (feuille de route UI pour Codex)

Compagnon de `DROP_MAP.md` (design system) et `AGENTS.md` (règles). Ce fichier
liste **toutes les pages** à construire, dans quel ordre, et où en est chaque
maquette. Backend déjà traité par ailleurs (kernel financier, prompts 01–04) —
ici on parle **uniquement de l'UI**.

## Division du travail
- **Nous (David + design)** : on produit chaque page en maquette HTML, dans le
  thème, rangée dans `packages/ui/reference/*.html`.
- **Codex** : implémente chaque maquette en **Svelte 5**, branchée sur les tokens
  `@ehq/ui`, l'API et `packages/auth`. Une page = un prompt consolidé ajouté à
  `PROMPTS.md` (jamais de fichiers de prompts séparés).

## Conventions (rappel, valables pour toutes les pages)
- Design system **`packages/ui`** : variables `--ehq-*` + classes `.ehq-*`. **Aucun hex en dur.**
- Accent **`#FFB800`** · fond **`#050505`** · **texte blanc 100%** · rouge `#FF3B30` (erreur/verrou).
- Polices **Inter** (UI + titres) + **Space Mono** (libellés, coords, technique).
- **Pages « porte d'entrée » (landing, login) = plein écran, zéro scroll** (`100dvh`, responsive).
- **Pages d'app** = shell commun (sidebar + topbar), **scroll interne** des panneaux/tables, jamais de scroll horizontal.
- Accès par **permissions** (`packages/auth`) ; élément non autorisé = **verrouillé, croix rouge**, jamais caché.
- Ne jamais toucher : moteur financier, allocations, migrations, DB, paiements, formules de relevés.
- Definition of Done : voir le bas du fichier.

---

## 0. Socle commun (à concevoir une fois, réutilisé partout)
| Élément | Rôle | Statut maquette |
|---|---|---|
| **App shell** | sidebar (logo ë, nav, statut système, collapse) + topbar (fil d'ariane, recherche ⌘K, cloche, user) | à faire |
| **Design System page** | référence vivante des composants (réf. `06 - Design System`) | à faire |
| **Bibliothèque de composants** | boutons, inputs/selects, cards/KPI, tables, drawers, badges, loaders, charts | dérivée de `components/*` |

---

## 1. HQ — `apps/hq` (porte d'entrée, plein écran)
| Page | Rôle | Source données | Statut |
|---|---|---|---|
| **Landing / sélecteur d'espace** | scène command-center + cartes par espace, verrou croix rouge | permissions | ✅ **maquette faite** (`reference/hq-landing.html`) |
| **Login** | tunnel d'entrée, routage par accès (réf. `01 - Login`) | auth | ⬜ **à faire (prochaine)** |

## 2. Command Center — `apps/command-center` (admin / supervision)
| Page | Rôle | Source | Statut |
|---|---|---|---|
| **Dashboard** | vue d'ensemble : KPI, santé écosystème, activité, alertes (réf. `04 Command Center`) | agrégats | ⬜ |
| **Utilisateurs & permissions** | qui accède à quoi (pilote les cartes verrouillées de HQ) | auth | ⬜ |
| **Intégrations / connecteurs** | WordPress, MCP, statuts | config | ⬜ |
| **Réglages système** | thème, préférences, statut « Operational » | config | ⬜ |

## 3. Office — `apps/office` (contrôle financier)
| Page | Rôle | Source | Statut |
|---|---|---|---|
| **P&L / Compte de résultat** | dashboard : revenus/dépenses/net/marge, par département (barres divergentes), top postes | projections validées | 🟡 **maquette partielle** (à reprendre dans l'ADN final + plein écran) |
| **Plan comptable** | CRUD **Département → Division → Catégorie** (type, cat_id) | plan comptable | ⬜ |
| **Transactions / grand livre** | saisie + liste filtrable (dépt/div/cat/projet/type), tags | ledger | ⬜ |
| **Imports** | relevés bancaires (MCB/SBI/CSV), cashflow, PDF | flux d'import | ⬜ |
| **Rapprochement bancaire** | matcher lignes banque ↔ ledger, valider en lot | banque + ledger | ⬜ |
| **Pending / classification** | vider la file des brouillons, bulk-valider | drafts | ⬜ |
| **Trésorerie (cashflow)** | entrées/sorties, projection | cashflow | ⬜ |

## 4. Distribution — `apps/distribution` (royalties) — d'après le doc d'implémentation
| Page | Rôle | Statut |
|---|---|---|
| **Dashboard** | cockpit : KPI, readiness, diagnostics, top royalties, revenu par trimestre, actions | ⬜ |
| **Imports** | santé des imports, diagnostics par lot, prochaine action | ⬜ |
| **Mapping** | revue des lignes importées, automatisations, règles réutilisables | ⬜ |
| **Catalog** | catalogue canonique, contributeurs, « needs review » → correction | ⬜ |
| **Contracts** | splits, payees, dépenses, recoupments (titre/artiste/ISRC/statut/action) | ⬜ |
| **Allocations** | preview / post / unpost en lot, cadence sûre, état du verrou serveur | ⬜ |
| **Suspense** | blockers groupés par raison, action exacte (catalog/split/mapping/retry/resolve) | ⬜ |
| **Statements** | relevé par artiste/payee/période/devise ; résumé financier d'abord | ⬜ |
| **PDF Statement** | A4, print-first, identité ë (réf. `pdf-statement-reference`) | ⬜ |
| **Payments** | enregistrer/éditer/annuler/réconcilier, drawer d'édition | ⬜ |
| **Revenue** | vue financière par payee/track/devise/store/période | ⬜ |

---

## Ordre de build pour Codex (phases)
1. **Phase 0 — Design system** : câbler `packages/ui` (tokens globaux, point d'entrée, assets). *(drop déjà prêt)*
2. **Phase 1 — Shell + auth** : sidebar/topbar communs, routage, garde d'accès par permissions.
3. **Phase 2 — HQ** : landing (faite) → login.
4. **Phase 3 — Office** : P&L → plan comptable → transactions → imports → rapprochement → pending → trésorerie.
5. **Phase 4 — Distribution** : dashboard → imports → mapping → catalog → contracts → allocations → suspense → statements (+PDF) → payments → revenue.
6. **Phase 5 — Command Center** : dashboard → utilisateurs/permissions → intégrations → réglages.

> Office et Distribution consomment le **kernel financier** (déjà bâti, prompts 01–04) via l'API typée. Aucune logique financière ré-écrite dans l'UI.

## Tracker des maquettes (ce qu'on doit finir avant de filer à Codex)
- ✅ Landing HQ
- 🟡 P&L Office (reprendre dans l'ADN final + plein écran)
- ⬜ Login · App shell · Command Center dashboard · Plan comptable · puis le reste

## Definition of Done (par page)
- Rendu fidèle à la maquette `reference/*.html`, en Svelte 5.
- 100% tokens `--ehq-*`, zéro hex en dur ; Inter + Space Mono ; texte blanc.
- Responsive ; pages porte-d'entrée sans scroll ; apps avec scroll interne propre.
- États gérés : vide, chargement (loader jaune), erreur (rouge), **verrouillé (croix rouge)**.
- Accessibilité : focus clavier visible, `prefers-reduced-motion` respecté.
- Aucune régression du moteur financier / allocations / paiements / relevés.
