# Journal des modifications — Changelog

*Français, puis [English](#english).*

## 0.1.0 — 2026-10-14

Première version de Coupole Web, la version navigateur des animations d’astronomie de Coupole.

- Les 92 animations de ClassAction, chacune avec sa fiche et son texte « Ce qu’il faut voir ».
- Rendu : astres en sphères ombrées (terminateur, limbe assombri, halo du Soleil), étiquettes placées sans
  chevauchement, formules typographiées (MathML, police STIX Two Math), côtes Natural Earth 1:50m ; le glisser suit le
  doigt ; aide propre à chaque animation ; éclipses de la table rejouables dans le simulateur des ombres ; vues polaires (pôle Nord, pôle Sud)
  et globe 3D qu’on fait tourner dans tous les sens dans le simulateur jour-nuit, terminateur et crépuscules exacts.
- Socle : Vite, TypeScript strict, Canvas 2D sans cadriciel ; transposition fidèle du module « Animations » de
  Coupole (même peintre que QPainter, mêmes projections de sphère, mêmes réglages à valeur exacte).
- Calculs transposés du Python de Coupole et vérifiés contre ses valeurs (plus de 4 000 cas, 10⁻⁹ relatif) ; chaque
  animation affiche les mêmes valeurs que l’application de bureau, au caractère près, en français et en anglais.
- Interface : catalogue par thème avec recherche sans accents, vignettes dessinées par les animations, fiche de chaque
  animation (description, ce qu’il faut voir, réglages), adresse partageable par animation et par réglages, mémoire
  des réglages ; thème sombre doux, clair ou automatique ; français et anglais.
- Toile : écrans haute densité, rendu seulement quand ça bouge, pause quand l’onglet est caché ; souris, doigt et
  stylet (glisser, pincer-zoomer, molette, appui long), clavier ; mouvement réduit respecté.
- Application web progressive : manifeste, icônes, service worker (hors ligne complet, mise à jour proposée).
- Sécurité : site statique, aucune requête vers un autre site, aucun traceur, politique de sécurité du contenu
  stricte, empreintes d’intégrité, dépendances minimales, Dependabot, actions épinglées par empreinte.
- Tests : Vitest (calculs, animations, confidentialité du dépôt), Playwright (Chromium, Firefox, WebKit ; téléphone,
  tablette, bureau), budget de poids.

---

## English

### 0.1.0 — 2026-10-14

First version of Coupole Web, the browser version of Coupole’s astronomy animations.

- All 92 ClassAction animations, each with its page and its « What to look for » text.
- Rendering: celestial bodies as shaded spheres (terminator, limb darkening, Sun halo), labels placed without overlap,
  typeset formulas (MathML, STIX Two Math font), Natural Earth 1:50m coastlines; dragging follows the finger;
  per-animation help; eclipses of the table can be replayed in the shadow simulator; polar views (North Pole, South Pole)
  and a 3D globe that turns in any direction in the daylight simulator, with exact terminator and twilights.
- Foundation: Vite, strict TypeScript, Canvas 2D without framework; faithful transposition of Coupole’s
  « Animations » module (a QPainter-like painter, the same sphere projections, the same exact-value settings).
- Computations transposed from Coupole’s Python and checked against its values (more than 4,000 cases, 10⁻⁹
  relative); each animation displays the same values as the desktop application, character for character, in French
  and English.
- Interface: catalogue by topic with accent-insensitive search, thumbnails drawn by the animations, a page per
  animation (description, what to look for, settings), shareable address per animation and settings, remembered
  settings; soft dark, light or automatic theme; French and English.
- Canvas: high-density screens, drawn only when something moves, paused when the tab is hidden; mouse, finger and
  pen (drag, pinch-zoom, wheel, long press), keyboard; reduced motion honoured.
- Progressive web app: manifest, icons, service worker (fully offline, update offered).
- Security: static site, no request to any other site, no tracker, strict content security policy, subresource
  integrity, minimal dependencies, Dependabot, actions pinned by hash.
- Tests: Vitest (computations, animations, repository privacy), Playwright (Chromium, Firefox, WebKit; phone, tablet,
  desktop), weight budget.
