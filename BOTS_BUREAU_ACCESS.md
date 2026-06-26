# BOTS_BUREAU_ACCESS — entrée d'écriture sécurisée pour les Bots Bureau

But : permettre à nos bots (Sophie · Office, Théo · Distribution, …) d'**écrire,
modifier et push** des données **Distribution** (contracts, splits, expenses,
payees…) et **Office** (transactions, classification…) **comme un employé de
bureau** — sans jamais **plomber ni crasher le serveur**.

Principe : **on ne crée pas d'API parallèle.** Le serveur `e-hq.eeee.mu` expose
déjà tout ce qu'il faut. On passe par la **porte agent** existante et on la
**bride**.

---

## 1. La porte : Abilities API + royal-mcp (ne pas taper le REST brut ni la DB)
- `wp-abilities/v1/abilities/{name}/run` → la **WordPress Abilities API** est déjà active.
- Le connecteur **`royal-mcp/v1/mcp`** relaie ces abilities en MCP → c'est par là que les bots entrent.
- Chaque **ability** enveloppe la logique `erh/v1` / `eof/v1` existante avec : contrôle de capacité, validation de schéma, gating brouillon→validation, audit, idempotence.
- **Interdit aux bots** : REST brut `wp/v2`, écriture SQL directe, `eof/v1/maintenance/*` (hard-delete / reset), `eof/v1/settings`.

## 2. Identité : un compte de service par bot (moindre privilège)
- Un **utilisateur WP de service** par bot (Application Password ou jeton scoping), **jamais admin**.
- Rôles custom :
  - **bot_office** (Sophie) → abilities Office en écriture uniquement.
  - **bot_distribution** (Théo) → abilities Distribution en écriture uniquement.
- Le MCP s'authentifie **en tant que ce bot** → toute écriture est traçable à un acteur.

## 3. Abilities d'écriture à enregistrer (mappées sur l'existant)
**Distribution (erh/v1)** — Théo :
- `erh/contract.create` · `erh/contract.update` → `POST/PUT /erh/v1/contracts[/{id}]`
- `erh/contract.split.set` → met à jour les splits d'un contrat (somme = 100% vérifiée côté serveur)
- `erh/contract.expense.add` / `erh/contract.expense.update` → `/erh/v1/contracts/{id}/expenses`
- `erh/payee.upsert` · `erh/artist.upsert` · `erh/release.upsert` · `erh/track.upsert` · `erh/label.upsert`
- `erh/rule.link` → `/erh/v1/rules/{id}/link`
- (lecture pour contexte : `erh/contracts.list`, `erh/suspense.list`, `erh/dashboard`)

**Office (eof/v1)** — Sophie :
- `eof/bank.import.preview` → `eof/v1/bank/import/preview` (jamais d'écriture directe)
- `eof/bank.line.classify` → classe une ligne du relevé (départe./div./cat./projet) puis `eof/v1/bank/raw/{id}/create-transaction`
- `eof/bank.import.confirm` → `eof/v1/bank/import/confirm`
- `eof/transaction.upsert` · `eof/transaction.category.set` · `eof/transaction.validate`

> C'est le flux que tu décris : le bot **importe le relevé → classe la ligne → confirme**. Pas de tag manuel.

## 4. Garde-fous serveur (le « ne pas crasher ») — valeurs par défaut à ajuster
| Garde-fou | Réglage proposé | Pourquoi |
|---|---|---|
| **Rate limit / bot** | 60 req/min, burst 10 (429 + `Retry-After` au-delà) | empêche le matraquage |
| **Taille de payload** | ≤ 50 lignes / appel ; au-delà → flux `preview`→`confirm` chunké | pas de gros INSERT bloquant |
| **Écritures lourdes async** | allocations / imports passent par les **runs/waves** existants (`erh/v1/allocations/runs/{id}/release`, `eof/v1/wave/test`) | le serveur cadence, le bot **enfile** |
| **Verrou écrivain unique** | 1 run financier à la fois (le lock `allocations/runs/release` existe déjà) ; si occupé → back-off | pas de course / corruption |
| **Idempotency-Key** | obligatoire sur toute écriture ; rejeu = même résultat, pas de doublon | les retries ne dupliquent rien |
| **Brouillon → validation** | le bot crée des **drafts** (comme un employé) ; promotion via `*/validate` | rien n'est posté en force |
| **Override audité** | pas de mutation directe des données importées → **enregistrement d'override** + `eof/v1/audit-log` | réversible, traçable |
| **Circuit breaker** | si `eof/v1/integrity/check-all` échoue ou latence > seuil → le bot **se met en pause** | on ne pousse pas sur un serveur déjà à genoux |
| **Timeouts** | court (ex. 10 s) + retry exponentiel borné (max 3) | pas de connexions qui s'accumulent |
| **Fenêtre d'écriture** | optionnel : autoriser les gros batches hors heures de pointe | lisse la charge |

## 5. Contrat de comportement du bot (à mettre dans le skill de chaque bot)
1. **Lire d'abord** (list/dashboard) pour récupérer les IDs — ne jamais deviner un `cat_id` / `contract_id`.
2. Écrire en **petits lots idempotents**, en **brouillon**.
3. Respecter `429` / `Retry-After` et le **verrou** ; sinon back-off.
4. Sur erreur de validation serveur → **corriger**, ne pas réessayer en boucle.
5. Laisser la **validation finale** à l'humain ou à l'étape `validate` dédiée.
6. Ne jamais toucher `maintenance/*`, `settings`, ni le moteur d'allocations hors run cadencé.

## 6. À faire côté WordPress (résumé pour implémentation)
1. Créer les rôles `bot_office` / `bot_distribution` + comptes de service (Application Passwords).
2. Enregistrer les **abilities** ci-dessus (write) en mappant la logique `erh/v1` / `eof/v1` ; ajouter au registre `wp-abilities`.
3. Middleware commun aux abilities bot : rate-limit, idempotency, lock, audit, circuit-breaker.
4. Exposer ces abilities dans **`royal-mcp`** (scopées par rôle).
5. Tester en **dry-run** (preview) avant d'autoriser le `confirm`/`validate`.
