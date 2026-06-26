# Fönt — Regular

Police sans-serif **géométrique originale**, dessinée pour toi (et ë • distribution).
161 glyphes. 100 % originale : aucune copie d'une fonte commerciale.
Tu en es l'unique propriétaire — aucune licence, aucune redevance.

## Fichiers livrés

- **Fönt-Regular.otf** — OpenType/CFF. Format conseillé (macOS, print, design).
- **Fönt-Regular.ttf** — TrueType. Pour Windows, Office, web (convertible en WOFF2).
- **Fönt-Regular-source.ufo.zip** — la source éditable (UFO3). À dézipper puis ouvrir dans
  **FontForge** (gratuit), Glyphs, RoboFont ou FontLab pour retoucher lettre par lettre.
- **Fönt-source-scripts.zip** — le code paramétrique Python qui *génère* la police
  (`fontlib.py`, `glyphs.py`, `build_full.py`, `verify.py`, `specimen.py`). C'est la « vraie »
  source : change une valeur (graisse, hauteur d'x…) et relance.
- **Fönt-Specimen.pdf / .png** — planche de présentation.

## Installation

- **macOS** : double-clic sur `Fönt-Regular.otf` → *Installer la police*.
- **Windows** : clic droit sur `Fönt-Regular.ttf` → *Installer*.
- **Web** : héberge le `.ttf` (ou convertis-le en `.woff2`) et déclare-le via `@font-face`.

## Couverture

Latin de base (A–Z, a–z), chiffres, **français complet** (é è ê ë à â ä ç î ï ô ö ù û ü ÿ ñ,
majuscules accentuées, ligatures **œ / æ**), guillemets **« » ‹ ›**, apostrophes typographiques
« ' ' " " », ponctuation et symboles courants (@ # % * + = < > [ ] ( ) / – — • …).

## Caractéristiques techniques

- 1000 unités/em · hauteur de capitale 700 · hauteur d'x 512.
- Construction géométrique quasi-monolinéaire (le « o » est un cercle quasi parfait).
- `a` et `g` à un étage (esprit Futura) ; légères corrections optiques sur les courbes.

## Modifier la police

Deux voies :

1. **Éditeur visuel** — dézippe l'UFO et ouvre-le dans FontForge (gratuit) ou Glyphs.
2. **Code** — `pip install fonttools ufoLib2 ufo2ft skia-pathops pillow`, puis
   `python3 build_full.py`. Édite `glyphs.py` pour une lettre, ou `fontlib.py` pour les réglages
   globaux (graisse `SV` / `SH`, hauteurs…). `verify.py` contrôle la fonte, `specimen.py` refait la planche.

## Pistes pour une v2 (sur demande)

- Crénage (kerning) fin.
- Graisses Medium / Bold, voire une famille variable.
- Variante du `a` à deux étages.
- Italique, ligatures fi/fl, chiffres tabulaires.

---
Fönt n'est lié à aucune fonderie. Le nom et les dessins sont à toi.
