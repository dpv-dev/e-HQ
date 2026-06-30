# Prompt de déploiement CODEX — ë • HQ (déploiement complet)

> Colle ce bloc dans Codex (agent avec accès prod). Exécute dans l'ordre. Runbook détaillé : `DEPLOYMENT.md`.
> Les **secrets** (mot de passe DB, `SUPABASE_SECRET_KEY`) viennent de ton coffre / `packages/db/.env`
> (gitignoré) — ne jamais les commiter ni les coller en clair dans un fichier suivi.

---

Tu déploies `ehq-platform` : **une** SPA Svelte (`apps/hq` = Office + Distribution + Command Center
montés par le `WorkspaceShell` partagé) + une **API Hono** (`services/api`) + **Supabase** (Auth + Postgres).

- Frontend : `apps/hq` → SPA statique → `app.eeee.mu`
- API : `services/api` (bundle Node) → slot Node Hostinger → `api.eeee.mu`
- DB / Auth : Supabase, projet `ywibsaorpqyzovdtjkui`

**État actuel** : l'API est **déjà LIVE** (`api.eeee.mu/healthz` = 200, lit la vraie DB) et la **DB est
déjà migrée** (53 tables, journal Drizzle 0000→0011). Ce déploiement est une **mise à jour** :
re-builder, re-uploader API + front, puis activer le taux de change FX. Rien de destructif sur la DB.

## Pré-requis
1. Mot de passe DB Supabase dans `packages/db/.env` (clé `DATABASE_URL`, pooler, `?sslmode=no-verify`).
2. Accès hébergeur : slot Node Hostinger (API) + hébergement statique (front).
3. `SUPABASE_SECRET_KEY` (`sb_secret_...`) disponible pour les variables d'env du slot.

## Étape 0 — Build + packaging (aucune prod touchée)
```bash
cd /Users/poups/Documents/Codex/Projects/ehq-platform
./deploy-build.sh
```
Cela : typecheck + **tests (API 45/45)** + build API (bundle) + build frontend + génère les **2 zips**
via `deploy-zip.sh` (avec garde-fou anti-secret). Doit finir par "Artifacts ready".

**Uploader UNIQUEMENT ces deux zips** (contenu à plat = racine de l'app) :
- `app-eeee-api-hostinger.zip` — `server.bundle.js`, `package.json`, `package-lock.json`,
  `node_modules/` (avec `pg`), `scripts/refresh-fx.mjs`, `START.md`.
- `app-eeee-frontend.zip` — `index.html`, `assets/`.

⚠️ **Ignorer** tout autre `*.zip` à la racine (`app-eeee-deploy-codex*.zip` = périmés).

## Étape 1 — Vérifier la connexion DB (lecture seule)
```bash
node --env-file=packages/db/.env packages/db/diag.mjs
# attendu : CONNECT OK + 53 tables + journal Drizzle appliqué (0000→0011)
```
Si "CONNECT OK" et journal complet → **rien à migrer**, passer à l'étape 2.
Si le mot de passe est refusé (`28P01`) → corriger `DATABASE_URL` dans `packages/db/.env`.
(Connexion via le POOLER : `aws-1-ap-south-1.pooler.supabase.com:5432`,
user `postgres.ywibsaorpqyzovdtjkui`, db `postgres`, suffixe `?sslmode=no-verify`.)

## Accès au host (lis ceci avant les uploads)
Tu pousses sur Hostinger. Deux cas :
- **Tu as un shell SSH/FTP vers le serveur** → fais les uploads/décompressions toi-même (commandes ci-dessous).
- **Hostinger n'est accessible qu'en hPanel web (clic)** → tu ne peux PAS uploader : demande à David
  de déposer les 2 zips via le panneau (Frontend = hébergement statique ; API = module Node.js),
  puis **continue toi-même** tout le reste (env vars, restart, Étape 4 FX, vérifications).
Annonce clairement lequel des deux cas s'applique avant de commencer.

## Étape 2 — API → slot Node Hostinger
1. Uploader/décompresser `app-eeee-api-hostinger.zip` dans le dossier de l'app Node.
2. **Node ≥ 20** (imposé par le SDK `@supabase/server` + le `fetch` du job FX).
3. **Application startup file** = `server.bundle.js`. `node_modules` est inclus (sinon "Run NPM Install").
4. Variables d'environnement du slot :
   ```
   DATABASE_URL=postgresql://postgres.ywibsaorpqyzovdtjkui:<MDP>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=no-verify
   SUPABASE_URL=https://ywibsaorpqyzovdtjkui.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_...     # clé publique
   SUPABASE_SECRET_KEY=sb_secret_...               # SECRET, depuis le coffre
   SUPABASE_JWKS_URL=https://ywibsaorpqyzovdtjkui.supabase.co/auth/v1/.well-known/jwks.json
   HOST=0.0.0.0
   PORT=<port du slot>
   NODE_ENV=production
   WRITES_ENABLED=true
   ```
   ⚠️ `DATABASE_URL` **doit** finir par `?sslmode=no-verify` — sinon 503
   "self signed certificate in certificate chain" (le pooler Supabase a un certif self-signed).
5. **Restart** le slot, puis :
   ```bash
   curl -fsS "$API_URL/healthz"        # -> 200 {"status":"ok"}
   ```

## Étape 3 — Frontend → statique (`app.eeee.mu`)
1. Décompresser `app-eeee-frontend.zip` en statique.
2. **Fallback SPA obligatoire** : réécrire tout chemin inconnu vers `/index.html`
   (routes client `/`, `/login`, `/console/*`). Servir `/assets/*` (hashés) en cache long.
3. Les `VITE_*` sont déjà bakées (clé `sb_publishable_` = publique, OK).

## Étape 4 — Taux de change EUR→MUR (conversion à l'import + job quotidien)
L'office tient ses livres en MUR ; les relevés EUR sont convertis à l'import via `exchange_rates`.
Depuis le dossier de l'app API (a `DATABASE_URL`) :
```bash
node scripts/refresh-fx.mjs
# récupère EUR→MUR (exchangerate-api, gratuit, sans clé) et upsert exchange_rates à la date du jour
```
Alternative SQL (Supabase SQL editor) si besoin de poser une valeur manuelle :
```sql
-- rate_e10 = taux × 10^10. Ex. 53.941005 -> 539410050000
insert into exchange_rates (from_currency, to_currency, rate_e10, effective_date)
values ('EUR', 'MUR', 539410050000, current_date)
on conflict (from_currency, to_currency, effective_date) do update set rate_e10 = excluded.rate_e10;
```
Puis **cron quotidien** (Hostinger → Cron Jobs), 1×/jour :
```bash
cd /home/<user>/<api-dir> && DATABASE_URL="...?sslmode=no-verify" /usr/bin/node scripts/refresh-fx.mjs >> fx-refresh.log 2>&1
```

⚠️ **Pré-requis pour l'import d'un relevé EUR** (sinon les lignes sont rejetées au preview avec
`amount_mur_missing_for_foreign_currency` ou `account_not_found`).
**Le plus simple — un seul fichier idempotent et validé** : exécuter **`prod-seed-eur-import.sql`**
(à la racine du repo) dans le SQL editor Supabase. Il pose le taux EUR→MUR ET le compte EUR
(workspace dérivé automatiquement des comptes office existants), puis affiche une vérif.
Détail des 2 pré-requis si tu préfères le faire à la main :
1. Un **taux EUR→MUR** dans `exchange_rates` (ci-dessus).
2. Un **compte bancaire EUR actif** pour le workspace. Vérifier :
   ```sql
   select id, account_label, currency, is_active from office_bank_accounts where currency = 'EUR';
   ```
   S'il n'y en a pas, en créer un (adapter label/référence au vrai compte MCB EUR 000455164509) :
   ```sql
   insert into office_bank_accounts (workspace_id, bank_name, account_label, account_reference_hash, currency, current_balance_minor, current_balance_mur_minor, is_active)
   values ('<workspace_id office>', 'MCB', 'MCB EUR', 'mcb-eur-000455164509', 'EUR', 0, 0, true);
   ```
   (Le `<workspace_id office>` = celui des autres `office_bank_accounts`/données office en prod.)

## Étape 4bis — Rôles dans le JWT (sinon « Workspace locked » + 403 partout)
L'UI et l'API lisent le rôle depuis `app_metadata.ehq_role` du token. Sans ce claim, un compte
retombe sur "viewer" → verrouillé côté UI ET refusé en 403 par l'API (autorisation désormais
appliquée côté serveur — cf. ci-dessous). Poser les rôles (idempotent, validé) :
```bash
# dans le SQL editor Supabase, ou via Codex avec DATABASE_URL :
psql "$DATABASE_URL" -f prod-seed-roles.sql
```
Puis **chaque utilisateur doit se reconnecter** (le claim arrive au prochain token). Compte agent
Office (Sophie) → `bot_office` (variante en bas du fichier SQL).

> 🔒 Note sécurité (corrigé dans cette livraison) : l'API applique maintenant l'autorisation par
> domaine côté serveur (`eof`→office, `erh`→distribution, `cc`→command-center). Un compte non
> autorisé reçoit `403 workspace_access_denied`, même en appelant l'API directement. Le gate UI
> n'est plus la seule barrière.

## Étape 5 — Vérification finale
```bash
curl -fsS "$API_URL/healthz"
curl -fsS "$API_URL/eof/v1/pl/global?workspaceId=workspace_1&period=2026-02"
```
- Ouvrir `https://app.eeee.mu/` → `/login` → une page `/console/*` (vérifier le fallback SPA).
- Dans **Office**, changer le filtre **Period** (This Week / This Month / Last 3 Months / Last 6 Months /
  This Year / Custom) → les chiffres (P&L, transactions, rapprochements, cashflow, partenaires, projets)
  doivent se **refiltrer**.
- Vérifier que `exchange_rates` contient une ligne **EUR→MUR** à la date du jour.
- **Rôles/autorisation** : `office@eeee.mu` (après re-login) déverrouille `/console/office/*` ;
  un appel API direct à `erh/v1/*` ou `cc/v1/*` avec son token renvoie **403 `workspace_access_denied`**
  (et `eof/v1/*` → 200). `david@eeee.mu` (administrator) atteint les 3 espaces.
- **Import bancaire** : Office → Imports → uploader un relevé MCB EUR → le preview doit afficher
  **14 lignes prêtes, 0 rejetée** (et non l'inverse). Si rejet → vérifier le taux EUR→MUR + le compte
  EUR actif (Étape 4).

## Rollback
- API : re-pointer la route prod vers l'ancien slot (le bundle ne mute pas la DB au démarrage).
- DB : PITR / sauvegardes Supabase ; **ne pas** relancer de migration destructive.

## Nouveautés de cette livraison (pourquoi ce redéploiement)
1. 🔒 **Sécurité — autorisation API côté serveur** : chaque rôle est cantonné à son domaine
   (`eof`→office, `erh`→distribution, `cc`→command-center) ; **403** sinon, même en appel API direct.
   Avant, tout compte authentifié lisait tout. → **IMPÉRATIF** de redéployer l'API (#2) **et** de poser
   les rôles (Étape 4bis), sinon la faille reste ouverte / les comptes restent verrouillés.
2. **Import bancaire** étendu : lit **MCB PDF (EUR)**, **SBI PDF (MUR)** et **CSV** ; détection auto
   du format + de la devise ; **conversion EUR→MUR** à l'import via `exchange_rates`.
3. **Job FX quotidien** autonome (`scripts/refresh-fx.mjs`) + à brancher en cron.
4. **Filtre Period** : 6 options (This Week…Custom) qui filtrent réellement les vues Office.
5. **Annulation d'écriture** : rôle `office`/`bot_office` peut annuler une transaction (soft-delete →
   statut `cancelled`, exclue des chiffres, conservée pour l'audit) ; bouton « Annuler » dans le Ledger.
   Correctif au passage : l'endpoint `/validate` (cassé : permission manquante) refonctionne.
6. Menu gauche à **14px**.

## Checklist des fichiers (tous à la racine du repo)
- `app-eeee-api-hostinger.zip` → slot Node Hostinger (Étape 2). **Porte le correctif sécurité.**
- `app-eeee-frontend.zip` → statique `app.eeee.mu` (Étape 3). Porte imports PDF/CSV/SBI, Period, bouton Annuler, menu 14px.
- `prod-seed-roles.sql` → rôles dans le JWT (Étape 4bis). **Sans ça, comptes verrouillés.**
- `prod-seed-eur-import.sql` → taux EUR→MUR + compte EUR (Étape 4, pour imports EUR).
- `DEPLOYMENT.md` → runbook détaillé de secours.

Ordre conseillé : **0** (build) → **1** (diag DB) → **2** (API) → **3** (front) → **4bis** (rôles + re-login)
→ **4** (FX/EUR si besoin d'importer de l'EUR) → **5** (vérifs).
