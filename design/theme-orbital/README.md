# ë • HQ — Theme « Orbital »

Thème complet pour ehq-platform, dérivé d'une référence visuelle « globe de données »
(sphère terrestre numérique, atmosphère cyan lumineuse, traînées orbitales ambre sur
fond noir spatial). Dossier autonome : **rien ici n'est branché dans l'app** — zéro
risque, adoption opt-in.

## Concept couleur

| Rôle | Couleur | Usage |
|---|---|---|
| Espace | `#030608 → #16242F` | Fonds et surfaces (échelle 5 niveaux, teintée bleu-vert) |
| Atmosphère — **cyan** | `#2FD4FF` / `#7CE7FF` | Donnée, glows, charts, focus, info, icônes |
| Action — **ambre** | `#FFB800` | Boutons primaires, KPI lead, nav active — **accent de marque verrouillé** (David, 2026-06) |
| Trail | `#FF8A3C` | Dégradés décoratifs uniquement (orbites), jamais interactif |
| Erreur | `#EF4444` | Verrouillé (référence design system 2026-07) |

Typographies **Inter + Space Mono conservées** (décision 2026-07-07) : le thème change
l'atmosphère, pas la voix de la marque.

## Structure

```
design/theme-orbital/
├── tokens/
│   ├── orbital-tokens.css    # tokens --orb-* (source de vérité du thème)
│   └── ehq-bridge.css        # remappe les --ehq-* de l'app vers Orbital (adoption drop-in)
├── components/
│   └── orbital-components.css  # .orb-* : boutons, champs, cartes KPI (lead/gauge/spark),
│                               # badges, alertes, table, nav, toggle, progress, picto-frame
│                               # + patterns command-center : ticker, coins HUD, carte
│                               #   "prochaine action", jauge annulaire à légende, stepper
├── assets/
│   ├── backgrounds/   # bg-hero-globe.svg · bg-page.svg · bg-card-veil.svg
│   ├── pictograms/    # 6 pictos duotone 96px : globe, network, orbit-chart,
│   │                  # datastream, beacon, vault
│   └── icons/         # 16 icônes trait 1.5 / 24px, currentColor (défaut cyan)
├── showcase/
│   ├── index.html      # vitrine complète de tout ce qui précède
│   ├── dashboard.html  # démo cockpit "command center" : ticker de statut, nav,
│   │                   # KPI, globe central encadré HUD, santé réconciliation,
│   │                   # prochaine action, balance âgée, budgets projets
│   └── office/         # LES 18 PAGES OFFICE maquettées (index.html = sommaire)
│       └── _shell.css  # shell partagé (topbar, nav, page-head, helpers)
├── scripts/
│   └── build-office-pages.py  # générateur des 18 pages (source unique du shell)
├── PORTING.md          # guide de portage vers l'app : mapping composants,
│                       # pages → fichiers Svelte, endpoints, étapes
```

## Prévisualiser

```bash
cd design/theme-orbital && python3 -m http.server 4173
# → http://localhost:4173/showcase/index.html      (composants & assets)
# → http://localhost:4173/showcase/dashboard.html  (démo cockpit assemblée)
```
(ou via `.claude/launch.json` → configuration `theme-orbital`)

## Adopter dans l'app (quand décidé)

1. Dans `apps/hq`, remplacer l'import de `packages/ui/tokens/visual-tokens.css`
   par `design/theme-orbital/tokens/ehq-bridge.css` — l'app entière se re-skinne
   sans toucher un composant (toutes les variables `--ehq-*` sont re-pointées).
2. Migrer ensuite composant par composant vers les patterns `.orb-*`
   (glows, cartes KPI lead/gauge) selon l'envie.
3. Les icônes/pictos sont des fichiers SVG indépendants ; en usage inline,
   `currentColor` reste surchargeable par CSS.

## Notes techniques

- **Aucun `<filter>` SVG dans les fonds** : les gros `feGaussianBlur` re-rasterisés au
  scroll peuvent geler des compositeurs peu puissants. Tous les halos des fonds sont
  des dégradés radiaux (les pictos, petits, gardent un blur léger).
- Le fond de page se pose via un pseudo-élément `position:fixed; z-index:-1`
  (voir showcase), pas `background-attachment:fixed` (même raison de perf).
- `prefers-reduced-motion` respecté sur les animations décoratives
  (`orb-spin`, `orb-pulse`).
- La référence est une image Shutterstock (via Pinterest) : le thème s'inspire de
  l'esthétique (palette, matière, lumière) sans copier l'œuvre — le globe est une
  « sphère de données » abstraite en points, pas la Terre de l'image.
