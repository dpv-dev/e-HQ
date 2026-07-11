# Deploy

La procédure canonique est dans [`DEPLOYMENT.md`](./DEPLOYMENT.md).

Résumé opérationnel :

1. Vérifier le checkout (`main`, HEAD attendu selon le run en cours).
2. Vérifier la DB avec le `.env` racine gitignoré : `node --env-file=.env packages/db/diag.mjs`.
3. Appliquer les migrations avec le chemin direct : `corepack pnpm --filter @ehq/db migrate:direct`.
4. Pré-gate routes critiques (avant déploiement) : `corepack pnpm smoke:critical`.
5. Construire les artefacts : `./deploy-build.sh`.
6. Uploader seulement `app-eeee-api-hostinger.zip` et `app-eeee-frontend.zip`.
7. Redémarrer le slot API avec ses variables runtime.
8. Post-gate routes critiques : `corepack pnpm smoke:critical` (inclut `/healthz` + routes console).

Ne pas créer de `packages/db/.env`. Ne pas commiter de secrets.
