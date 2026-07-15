# DEPLOYMENT — ë • HQ (procédure complète, à jour)

Source de vérité pour mettre en production l'app consolidée. À exécuter avec un agent
qui a accès à la prod (Codex) ou par David. Tout ce qui est "build" est déjà prêt dans
le repo ; il ne reste que les étapes qui touchent la prod (DB, hébergeur).

## Ce qu'on déploie

UNE seule app : `apps/hq` (Office + Distribution + Command Center sont des sections
internes montées par le `WorkspaceShell` partagé de `packages/ui`).
- Frontend  : `apps/hq` → SPA statique → `app.eeee.mu`
- API       : `services/api` (Hono) → slot Node Hostinger → `api.eeee.mu`
- DB / Auth : Supabase (projet `ywibsaorpqyzovdtjkui`)

## Pré-requis (à fournir — un agent ne peut pas les inventer)

1. **Mot de passe de la base Supabase.**
   - ⚠️ `babanI123*` est **FAUX** (Postgres l'a refusé : `password authentication failed`, `28P01`).
   - Ce n'est ni une clé `sb_...`, ni le mot de passe du compte Supabase.
   - Le récupérer / réinitialiser : dashboard Supabase → **Settings → Database → Database password → Reset**.
2. **Accès hébergeur** : slot Node Hostinger (API) + hébergement statique (front).

## Connexion base (IMPORTANT : passer par le POOLER)

```
host = aws-1-ap-south-1.pooler.supabase.com
port = 5432
user = postgres.ywibsaorpqyzovdtjkui
db   = postgres
ssl  = require
```
Mettre la connexion dans le `.env` racine (gitignoré). Ne pas recréer de
`packages/db/.env` : le repo garde une seule source locale non commitée.
⚠️ Si le mot de passe contient des caractères spéciaux (`* @ : / ? #`), **URL-encoder**
dans `DATABASE_URL` (ex. `*` → `%2A`) — sinon le parsing d'URL casse. Alternative
robuste : utiliser des variables séparées `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE`.

Vérifier la connexion avant de migrer :
```bash
node --env-file=.env packages/db/diag.mjs
# attendu : CONNECT: OK  + liste des tables + état du journal Drizzle
```

## Étape 0 — Build des artefacts (déjà faisable, aucune prod touchée)

Pré-gate routes critiques (optionnel mais recommandé avant upload) :
```bash
corepack pnpm smoke:critical
```

```bash
./deploy-build.sh
# produit : services/api/deploy/server.bundle.js  et  apps/hq/dist/
```

## Étape 1 — Migrations DB (Supabase)

```bash
# .env racine doit contenir le BON DATABASE_URL (pooler + vrai mot de passe)
corepack pnpm --filter @ehq/db migrate:direct
```
Le migrateur direct appelle `drizzle-orm/node-postgres` avec `sslmode=no-verify`
et le dossier `packages/db/migrations`. C'est le chemin canonique en prod : le CLI
`drizzle-kit migrate` peut rester muet/spinner chez Hostinger alors que le migrator
Node remonte les erreurs correctement.

Le migrateur Drizzle est idempotent (journal `drizzle.__drizzle_migrations`).
Si erreur "type/table already exists" : le schéma existe déjà sans journal Drizzle →
baseliner (marquer les migrations comme appliquées) plutôt que recréer. Confirmer
l'état avec `diag.mjs` avant toute action destructive.

## Zips prêts à uploader (générés par ce repo, autonomes, gitignorés)

⚠️ **Uploader UNIQUEMENT ces deux fichiers.** Ignorer tout autre `*.zip` à la racine
(ex. les anciens `app-eeee-deploy-codex*.zip` — périmés, à ne pas utiliser).

- `app-eeee-api-hostinger.zip` — l'API Node **autonome** : à la racine du zip on a
  `server.bundle.js`, `package.json`, `package-lock.json`, `node_modules/` (avec `pg`),
  `scripts/refresh-fx.mjs` (job FX quotidien), `START.md`. Pour le module **Node.js de Hostinger**.
  Aucun secret dedans (garde-fou anti-`.env`/`sb_secret_` dans `deploy-zip.sh`).
- `app-eeee-frontend.zip` — la SPA statique (`index.html` + `assets/` à la racine du zip).

Régénérer : **`./deploy-build.sh`** (build + tests + zips en une commande) — il appelle
`./deploy-zip.sh` qui zippe le *contenu* de `services/api/deploy/` et `apps/hq/dist/` (à plat,
donc `server.bundle.js`/`index.html` à la racine) après un contrôle anti-secret.
Pour (re)zipper seul sans rebuild : `./deploy-zip.sh`.

### Module Node.js Hostinger (hPanel)
1. hPanel → **Advanced → Setup Node.js App** (ou "Node.js").
2. Uploader / décompresser **`app-eeee-api-hostinger.zip`** dans le dossier de l'app.
3. **Application startup file** = `server.bundle.js` ; **Node version** ≥ 18.
4. Variables d'environnement (cf. ci-dessous) → **Save** → **Restart**.
5. Le `node_modules` étant inclus, pas besoin de `npm install` (sinon "Run NPM Install" marche aussi).

## Étape 2 — API (serveur Hono)

Uploader `app-eeee-api-hostinger.zip` (ou le dossier `services/api/deploy/`) sur le slot Node.
⚠️ **Node ≥ 20** requis sur le slot (le SDK `@supabase/server` l'impose ; le bundle cible node20).
Variables d'env du slot (cf. `services/api/.env.example`) :
```
DATABASE_URL=<connexion pooler, vrai mot de passe>
SUPABASE_URL=https://ywibsaorpqyzovdtjkui.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # public
SUPABASE_SECRET_KEY=sb_secret_...             # SECRET — env runtime uniquement, jamais commité
SUPABASE_JWKS_URL=https://ywibsaorpqyzovdtjkui.supabase.co/auth/v1/.well-known/jwks.json
HOST=0.0.0.0
PORT=<port du slot>
NODE_ENV=production
WRITES_ENABLED=true
```
Note SDK : `services/api` utilise `@supabase/server` (intégration Hono isolée sous `/supabase`,
clients RLS + admin). Sa peer dependency **`@supabase/supabase-js` est requise** — l'installer
dans `services/api` avant de re-bundler (`corepack pnpm --filter @ehq/api add @supabase/supabase-js`).
Sur le slot :
```bash
cd services/api/deploy
npm install --omit=dev
node server.bundle.js
```
Liveness : `curl -fsS "$API_URL/healthz"` → `200 {"status":"ok"}`, même pendant le chargement des données.

Readiness : `curl -fsS "$API_URL/readyz"` → `200 {"status":"ready"}` lorsque Office et Distribution sont complètement chargés. Pendant le bootstrap, cette route renvoie `503` avec `Retry-After: 5`.

## Étape 3 — Frontend (apps/hq)

Décompresser `app-eeee-frontend.zip` (ou servir `apps/hq/dist/`) en statique sur `app.eeee.mu`. Les `VITE_*` sont déjà bakées
depuis `apps/hq/.env.production` (clé `sb_publishable_...` = publique).
Le zip front inclut maintenant `apps/hq/.htaccess` (règle SPA rewrite + cache headers).  
⚠️ Pendant le déploiement, ne jamais supprimer `public_html` sans restaurer ce `.htaccess` :
- soit via l’upload du zip `app-eeee-frontend.zip` (recommandé),
- soit en le recollant manuellement après upload.
**Config hébergeur indispensable** : fallback SPA — réécrire tout chemin inconnu vers
`/index.html` (routes client : `/`, `/login`, `/console/*`). Servir `/assets/*`
(fichiers hashés) avec cache long.

## Étape 4 — Taux de change EUR→MUR (auto, quotidien)

L'office tient ses livres en **MUR** ; une ligne bancaire en devise étrangère (relevé EUR)
est convertie à l'import via la table `exchange_rates` (cf. `parseOfficeBankPreviewRow`).
Pour alimenter cette table automatiquement, un job autonome récupère le taux du jour chez
exchangerate-api (gratuit, sans clé ; la BCE/Frankfurter NE publient PAS la roupie).

Script livré dans le bundle : `services/api/deploy/scripts/refresh-fx.mjs`
(utilise `pg` du `node_modules` du slot + `fetch` natif de Node 20 ; lit `DATABASE_URL`).

**Amorçage immédiat** (une fois la DB accessible, avant même le cron) :
```bash
cd services/api/deploy
DATABASE_URL="<pooler + sslmode=no-verify>" node scripts/refresh-fx.mjs
# -> upsert exchange_rates (EUR→MUR) à la date du jour
```
Alternative SQL directe (Supabase SQL editor) si besoin de poser une valeur à la main :
```sql
-- rate_e10 = taux × 10^10.  Ex. taux du 2026-06-29 = 53.941005 → 539410050000
insert into exchange_rates (from_currency, to_currency, rate_e10, effective_date)
values ('EUR', 'MUR', 539410050000, '2026-06-29')
on conflict (from_currency, to_currency, effective_date) do update set rate_e10 = excluded.rate_e10;
```

**Planification quotidienne (Hostinger → Cron Jobs)** — une fois par jour :
```bash
cd /home/<user>/<api-app-dir> && DATABASE_URL="<pooler + sslmode=no-verify>" /usr/bin/node scripts/refresh-fx.mjs >> fx-refresh.log 2>&1
```
(Le job est idempotent : ré-exécuté le même jour, il met à jour la même ligne. Source EUR
par défaut ; ajouter d'autres devises = `TARGET_CURRENCIES` dans le script — cross-rate via MUR.)

## Vérification finale (prod)

```bash
corepack pnpm smoke:critical
curl -fsS "$API_URL/healthz"
curl -fsS "$API_URL/readyz"
curl -fsS "$API_URL/eof/v1/pl/global?workspaceId=workspace_1&period=2026-02"   # route Office réelle
# ouvrir https://app.eeee.mu/  puis /login puis une page /console/* (vérifier le fallback SPA)
curl -fsS -o /dev/null -w "%{http_code}\\n" https://app.eeee.mu/console/office/bank   # doit retourner 200 (pas 404 Hostinger)
```

## Rollback

- API : ré-pointer la route prod vers l'ancien slot ; le bundle ne mute pas la DB au démarrage.
- DB : Supabase a des sauvegardes/PITR ; ne pas relancer de migration destructive en rollback.

## État au 2026-07-03

- Artefacts buildés et verts : API (`tsc` OK, **tests 44/44**, bundle ~1.65 Mo), frontend
  (`apps/hq/dist/`, build propre, shell unifié), api-client + domain-office OK.
- DB live **déjà migrée** : journal Drizzle 0000→0012 (13 entrées). Objets vérifiés :
  `api_import_previews`, `command_center_settings`,
  `command_center_integration_states`, `command_center_user_permissions`,
  `categories.account_code`, `categories.account_label`,
  enum `transaction_source = ledger_import`, table `exchange_rates` présente
  avec des taux jusqu'au 2026-06-30.
- API **déjà LIVE** à `api.eeee.mu` (`/healthz` 200, lit la vraie DB). Ce déploiement = **mise à jour**.

### Nouveautés de cette livraison (à prendre en compte au redéploiement)
1. **Import EUR + conversion FX** : les lignes en devise étrangère sont converties en MUR à
   l'import via la table `exchange_rates` (table historique, pas créée par 0012). → garder
   **Étape 4** active (poser/rafraîchir un taux + cron FX).
2. **Job FX quotidien** : `scripts/refresh-fx.mjs` (dans le zip API) — cron Hostinger quotidien.
3. **Filtre Period** : 6 options (This Week→Custom) filtrant réellement les vues Office (P&L,
   transactions, rapprochements, cashflow, partenaires, projets). Pur code → **redéployer API + front**.
4. **Taille du menu gauche** à 14px (front).

### Ce que Codex doit faire (prod)
1. Re-uploader **`app-eeee-api-hostinger.zip`** sur le slot Node Hostinger (**Node ≥ 20**) → Restart.
2. Re-uploader **`app-eeee-frontend.zip`** en statique (fallback SPA `/index.html`).
3. Vérifier les **variables d'env** du slot (Étape 2) : `DATABASE_URL` (pooler + `sslmode=no-verify`),
   `SUPABASE_*`, `WRITES_ENABLED=true`.
4. **Étape 4** : amorcer un taux EUR→MUR (`node scripts/refresh-fx.mjs` ou le SQL) + **cron quotidien**.
5. Vérifs finales (section ci-dessus) : `/healthz`, `/readyz`, une route `/eof/v1/pl/global`, et l'UI.
