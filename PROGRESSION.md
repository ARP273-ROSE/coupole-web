# Progression de Coupole Web

Version navigateur des animations d’astronomie de Coupole (module « Animations » de l’application de bureau, d’après
ClassAction, University of Nebraska-Lincoln Astronomy Education, Apache 2.0).

## État courant

- Socle complet : catalogue, fiche, toile, réglages, adresse partageable, mémoire, thèmes, langues, PWA hors ligne,
  sécurité, tests, CI, déploiement GitHub Pages.
- Animations disponibles : **92 / 92**, toutes vérifiées contre les références de Coupole (réglages et valeurs
  affichées, FR et EN), chacune avec son texte « Ce qu’il faut voir ».
- Lighthouse (mobile et bureau, catalogue, à propos, deux animations) : performances 97–100, accessibilité 100,
  bonnes pratiques 100, référencement 100.

## Méthode de transposition

1. Lire `coupole/modules/anim/animations/<module>.py` dans le dépôt de Coupole.
2. Écrire `src/anim/animations/<module>.ts` (même nom de module, même classe, mêmes clés de réglages et de textes) :
   - réglages par `this.curseur / coche / choix / bouton / saisie` (mêmes bornes, défauts, décimales, unités) ;
   - dessin par le peintre (`src/noyau/peintre.ts`, sémantique de QPainter), `dessin.ts`, `scenes.ts`, `graphe.ts` ;
   - arrondis et modulos de Python par `src/noyau/py.ts` (`pmod`, `pround`, `proundn`, `fixe`…).
3. `npm test` : le test `tests/unit/animations.test.ts` compare réglages et valeurs affichées à ceux de Coupole
   (`tests/references/animations.json`), au caractère près, en français et en anglais, puis dessine l’animation dans
   quatre formats et deux thèmes, souris comprise.
4. Ajouter le texte « Ce qu’il faut voir » (FR, EN) dans `src/i18n/a_voir.ts` ou `a_voir_suite.ts` (un test vérifie
   que les 92 en ont un).

Régénérer les fichiers tirés de Coupole (quand Coupole change) :

```sh
python3 outils/exporter_coupole.py CHEMIN_DE_COUPOLE            # textes, catalogue, données
python3 outils/references_calculs.py CHEMIN_DE_COUPOLE          # références des calculs
QT_QPA_PLATFORM=offscreen python3 outils/references_animations.py CHEMIN_DE_COUPOLE   # (PyQt6 requis)
```

## Journal

### 2026-10-14 — 0.1.0 : socle et lot 1

- [x] Socle Vite + TypeScript strict, peintre façon QPainter, projection de sphère, réglages à valeur exacte.
- [x] Calculs : `astro`, `hr`, `lumiere`, `deux_corps` transposés ; 4 383 cas de référence de Coupole retrouvés
      (≤ 1e-9 relatif), arrondis et formats de Python compris.
- [x] Interface : catalogue, recherche, filtres, vignettes, fiche, barre de lecture, zoom, partage, mémoire,
      thèmes, langues, à propos ; PWA (manifeste, icônes, service worker) ; CSP stricte et SRI.
- [x] Lot 1 (21) : longlat, sunmotions, eclipticsimulator, lunar_applet, sunsrays, altazimuth, radecdemo,
      celhorcomp, siderealTimeAndHourAngleDemo, seasonsim, obliquity, zodiac, siderealSolarTime, latsim, shadowsim,
      marsorbit, pathtracer, retrograde, kepler, parallaxdiag, stellarmag.

### 2026-10-14 — lots 1 bis, 2 et 3 : 92 / 92

- [x] Lot 1 bis et lot 2 : coordonnées et mouvements, Lune, Renaissance, astronomie antique, propriétés stellaires.
- [x] Lot 3 : lumière et spectres, exoplanètes, étoiles doubles et variables, Système solaire, Soleil, Voie lactée,
      cosmologie, télescopes, temps de regard en arrière.
- [x] Directions des galaxies du ballon (tirage numpy de Coupole) exportées telles quelles dans `lot3.json`.
- [x] « Ce qu’il faut voir » pour les 92 animations (FR, EN).
- [x] Tests de bout en bout sur les 92 animations (bureau) et un échantillon (téléphone, tablette), trois moteurs.

## Reste à faire

- Rien d’obligatoire. Pistes : tirages aléatoires identiques à ceux de Python (Mersenne Twister) pour le CCD et le
  télescope (seules les valeurs non affichées en dépendent) ; bouton « Version web » dans Coupole.
