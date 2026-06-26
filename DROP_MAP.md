# DROP_MAP — Thème ë • HQ (à déposer pour Codex)

**Rôle de ce paquet.** Tout le *layer visuel* prêt à consommer : tokens, polices,
images, classes de composants, écrans de référence. Toi (Claude) finis le thème ;
**Codex construit les apps** en important ça, sans réinventer couleurs/espacements.

## Comment déposer
Extrais ce zip **à la racine de `ehq-platform/`**. L'arborescence reflète déjà le
monorepo — rien à déplacer. Résultat :

```
ehq-platform/
└── packages/
    └── ui/
        ├── tokens/
        │   ├── visual-tokens.css   ← source de vérité (CSS variables + classes .ehq-*)
        │   └── tokens.ts           ← mêmes valeurs, typées (import TS/Svelte)
        ├── fonts/
        │   ├── Open Sans/          ← police active (UI + marque)
        │   └── Fönt/               ← legacy / fallback inactif
        ├── assets/
        │   ├── backgrounds/        ← fonds (globe, réseau, glow, grid…) + bg-office-panels.svg (créé)
        │   ├── icons/              ← 19 icônes SVG (1 / 1.5 / 2px)
        │   └── logos/              ← ë (yellow/white/mono/favicon) + 13 DSP (graphite/white/yellow)
        ├── components/
        │   └── component-guidelines.md
        └── reference/
            ├── hq-landing.html     ← maquette landing (vraies images, état verrouillé croix rouge)
            └── DISTRIBUTION_VISUAL_IDENTITY_IMPLEMENTATION.md
```

## Le contrat (à mettre dans AGENTS §charte)
1. **Accent canonique : `#FFB800`.** (Remplace l'ancien `#FFD200`. Les fonds SVG
   du pack ont été recolorés.)
2. Les apps **importent** `packages/ui/tokens/visual-tokens.css` (ou `tokens.ts`).
   **Aucun hex en dur** dans une app/un composant — uniquement les variables `--ehq-*`.
3. **Polices = celles du site `eeee.mu`** : **Inter** (corps + affichage, wght
   300→900) et **Space Mono** (libellés, coordonnées, micro-copie technique) via
   `--ehq-mono`. Chargées par `@import` Google Fonts dans `visual-tokens.css`
   (self-host possible plus tard). **Open Sans / Fönt sont archivées, inactives.**
4. Thème **sombre** (command center) : fond `#0D0F14`, surfaces graphite, jaune
   réservé à action primaire / nav active / focus / sélection / série de chart.
5. Le visuel ne bloque jamais une release fonctionnelle, et ne touche jamais
   moteur financier / allocations / migrations / DB / paiements / relevés.

## Écrans de référence (chez toi, non dupliqués ici pour rester léger)
`02 - Visual Identity/Template Assets/` : `02 - Landing.png`, `01 - Login.png`,
`04 - Command Center.png`, `06 - DEsign System.png`, `08 - Revenues.png`, etc.
Plus les composants : `components/{buttons,cards-kpi,table,charts,…}.png`.

## Prompt Codex suggéré (à consolider dans PROMPTS.md)
> Intègre `packages/ui` comme design system : expose un point d'entrée qui charge
> `tokens/visual-tokens.css` globalement, ré-exporte `tokens.ts`, et fournit les
> classes `.ehq-*`. Câble chaque app (`hq`, `command-center`, `office`,
> `distribution`) dessus. Implémente la landing `apps/hq` en Svelte d'après
> `packages/ui/reference/hq-landing.html` : grille de cartes par espace, routage
> par permissions (`packages/auth`), **carte verrouillée = croix rouge** + action
> « Demander l'accès ». Aucun hex en dur.

## Créé / modifié par rapport au pack d'origine
- `bg-office-panels.svg` : **créé** (l'art Office isométrique n'existait pas).
- Fonds SVG + logos : jaune **recoloré `#FFD200` → `#FFB800`**.
- `tokens.ts` : **créé** (export typé).
- `reference/hq-landing.html` : maquette landing (globe réel + réseau réel + panels créés).
