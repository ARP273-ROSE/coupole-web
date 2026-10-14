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

## Choix graphiques

À reprendre à l'identique dans l'application de bureau Coupole (le web sert de référence).

### Palette (`PALETTES` dans `src/noyau/dessin.ts`, identique à Coupole)

Thème sombre par défaut ; « auto » suit le système. Les dégradés des astres partent de ces couleurs.

| clé | sombre | clair |
|---|---|---|
| `fond` | `#1B1F26` | `#FBFBF8` |
| `texte` | `#D9DDE2` | `#2E333B` |
| `doux` | `#A3ABB6` | `#646C77` |
| `grille` | `#4A525E` | `#C9CED4` |
| `sphere` | `#2A3240` | `#E6ECF2` |
| `ciel` | `#2C4A6B` | `#BFD7EE` |
| `sol` | `#3E5B3A` | `#A9C79B` |
| `horizon` | `#7FA36F` | `#4E7A3E` |
| `equateur` | `#6FA8DC` | `#2F6FAF` |
| `ecliptique` | `#E8A85C` | `#C2701C` |
| `meridien` | `#C9A0DC` | `#8A4FA6` |
| `soleil` | `#FFD25A` | `#C08400` |
| `lune` | `#D8D8D0` | `#8C8C84` |
| `terre` | `#4F86C6` | `#2F6FAF` |
| `mars` | `#E07050` | `#B8452C` |
| `etoile` | `#FFFFFF` | `#2E333B` |
| `accent1` | `#F2C14E` | `#B07A00` |
| `accent2` | `#7CC4E8` | `#1F7AA6` |
| `accent3` | `#F28C8C` | `#B5403C` |
| `ombre` | `#000000` | `#000000` |
| `nuit` | `#0E1218` | `#5A6270` |
| `arc1` | `#A99BFF` | `#4B3FC9` |
| `arc2` | `#FF8F87` | `#C0392B` |
| `umbra` | `#05070A` | `#1B1F26` |
| `penombre` | `#9AA6B6` | `#5A6270` |

### Corps célestes (`astre()` dans `src/noyau/dessin.ts`)
- Le Soleil, la Lune, la Terre et Mars (clés de couleur `soleil`, `lune`, `terre`, `mars`) sont dessinés en sphères dès
  3,5 px de rayon ; en dessous, disque plein. Les autres couleurs (repères, points) restent des disques plats.
- Volume : dégradé radial dont le foyer est décalé de 0,42 r vers la lumière ; arrêts 0 → couleur éclaircie (122 %,
  132 % si un Soleil éclaire), 0,55 → couleur de base, 1 → couleur assombrie (70 %, 62 % éclairée) : le limbe est assombri.
- Lumière : vers le dernier Soleil dessiné dans le même panneau (oublié à chaque `cadre()` et à chaque image) ; sans
  Soleil, lumière d'en haut à gauche (−0,55 ; −0,83) et pas de terminateur.
- Terminateur : quand le Soleil est connu, voile « nuit » en dégradé linéaire le long de la direction du Soleil
  (transparent jusqu'à 0,47, 62 % à 0,56, 80 % au limbe opposé) : le diamètre perpendiculaire au Soleil sépare jour et nuit.
- Soleil : limbe assombri (centre 118 %, 0,65 → base, bord 78 %) et halo discret (28 % d'opacité → 0) jusqu'à
  r + min(0,9 r ; 26 px).
- Phases de la Lune (`phase_lune`) : terminateur exact (ellipse) inchangé ; la partie éclairée reçoit le même volume
  (foyer côté Soleil).

### Étiquettes sans chevauchement (`texte(..., { fond: true })`, `etiquette()`)
- Toute étiquette à cartouche passe par un placeur commun à l'image : si sa place est prise (autre étiquette, petit
  objet de rayon ≤ 24 px, texte déjà écrit, bord de la toile), elle essaie 24 positions autour de son point d'accroche
  (en haut à droite, en bas à droite, en haut à gauche, en bas à gauche, dessus, dessous, droite, gauche, sur trois
  distances) et prend la première libre, sinon la moins encombrée (coût : recouvrement d'étiquettes × 4, d'objets × 1,
  hors toile × 8, plus 0,02 × déplacement).
- Une étiquette déplacée est reliée à sa place d'origine par un trait de rappel (0,9 px, 55 % d'opacité, couleur de
  l'étiquette). Cartouche : fond du thème à 78 %, coins de 4 px.
- Les textes sans cartouche ne bougent pas mais sont des obstacles ; un texte qui déborde à peine de la toile est ramené
  dedans ; un texte plus large que la toile est réduit (8 px au moins).
- Test : `tests/unit/animations.test.ts` vérifie, pour les 92 animations, quatre formats et trois images, qu'aucune
  boîte d'étiquette n'en recouvre une autre (plus de 15 %) ni ne sort de la toile.

### Formules
- Pages : MathML Core natif (aucune bibliothèque) ; fractions empilées, exposants et indices, radicaux, variables d'une
  lettre en italique, mots (sin, log, TSL) et majuscules grecques droits, petite espace avant une fonction.
  Police STIX Two Math auto-hébergée (sous-ensemble woff2 de 96 Ko, chargé seulement quand une formule s'affiche).
- Les formules des textes de Coupole sont reconnues (liste dans `src/app/texte_riche.ts`, ou `$…$`) ; une valeur qui
  n'est qu'une relation (« 1/S = 1/E − 1/P ») est rendue entière, mais pas un résultat avec unité (« 33 al »).
- Écriture : « a/b » collé lie plus fort que « a b / c d » espacé (tout le produit sur tout le produit) ; R☉, M⊕ :
  le symbole est un indice ; v_r, R_* : indices.
- Toile : même analyseur, même mise en forme (`dessin.formule`), pour les formules dessinées dans les animations.

### Interaction
- Glisser une sphère : le point sous le doigt suit le doigt (vers la droite, la face visible part vers la droite ; vers
  le bas, elle descend), au rythme de 1 radian par rayon de sphère, compensé par 1 / cos(hauteur) en azimut (borné).
- Aide : propre à chaque animation (texte « souris » de Coupole s'il existe, sinon selon qu'elle a une sphère à tourner
  et/ou des objets à déplacer), en petit sous la scène et dans la fiche ; jamais d'infobulle sur la toile.
- Panneaux : tout ce qui est dessiné dans un panneau y est découpé (rayons du Soleil des saisons : du bord du panneau
  jusqu'au limbe).

### Cartes et globes
- Côtes : Natural Earth 1:50m (ne_50m_land, domaine public), Douglas-Peucker 0,07°, îles de moins de 0,25 degré carré
  omises, bords artificiels (méridien ±180°, pôle Sud) retirés ; 65 Ko compressés, chargées à la demande.
- Projection équirectangulaire gardée pour le simulateur jour-nuit et les antipodes (terminateur exact, et
  correspondance linéaire entre le doigt et la latitude-longitude).
- Simulateur jour-nuit, réglage « Projection » : équirectangulaire (par défaut), pôle Nord, pôle Sud. Vue polaire :
  azimutale équidistante centrée sur le pôle (ρ proportionnel à la distance au pôle), bord à l'équateur ou 30° au-delà
  (les deux tropiques visibles) ; vu du pôle, l'est tourne dans le sens direct ; méridiens tous les 15° (30° plus
  marqués), parallèles tous les 15° ; équateur plein, tropiques (`accent1`) et cercles polaires (`accent2`) en
  pointillé ; Soleil au zénith marqué s'il est dans le disque ; longitudes 0°, 90° E, 180°, 90° O au bord.
- Par défaut la Terre tourne sous un terminateur fixe (méridien du point subsolaire en bas au Nord, en haut au Sud :
  midi en bas) ; « Terminateur tournant » fixe la carte (Greenwich en bas au Nord, en haut au Sud).
- Nuit et crépuscules (civil, nautique, astronomique, mêmes opacités que la carte plane : 55 %, 25 %, 20 %, 15 %) :
  pour chaque méridien, la latitude exacte où h = 0 (ou −6°, −12°, −18°), bornée au bord ; cela forme une boucle
  autour du pôle, sans artefact au pôle. La nuit est l'intérieur de la boucle si elle contient le pôle (δ☉ < 0 au
  Nord, δ☉ ≥ 0 au Sud), sinon l'anneau entre la boucle et le bord (remplissage pair-impair). Au solstice, la boucle
  est tangente au cercle polaire (test unitaire).
- Les côtes Natural Earth déjà chargées sont reprojetées, coupées quand elles sortent du disque.
- Quatrième projection « globe 3D (vue de l'espace) » : orthographique, Canvas 2D. Orientation = matrice de rotation
  (repère terrestre → vue, lignes est / nord / verticale), réorthonormalisée après chaque glisser. Glisser : rotation
  « boule de commande » autour de l'axe du plan de l'écran perpendiculaire au mouvement, d'angle |d| / r (le point
  sous le doigt suit le doigt, dans tous les sens) ; inertie légère (×0,9 par image, arrêt sous 0,3 px). Double-clic :
  recentrer sur le point subsolaire, nord en haut. Clic droit / appui long : placer l'observateur. Pincer et molette :
  le zoom commun de la scène. Vue de départ : 25° N, 50° à l'ouest du point subsolaire (le terminateur est visible).
- Sans « terminateur tournant », la Terre tourne sous un Soleil fixe dans la vue ; avec, le globe reste fixe.
- Toutes les lignes (graticule 15°/30°, côtes, équateur, tropiques et cercles polaires en pointillé, étiquetés à leur
  point visible le plus à droite) sont coupées au limbe au point exact de traversée (interpolé, ramené sur le cercle).
- Nuit et crépuscules : calottes exactes {p · s < −sin h} ; contour = arc visible du petit cercle + arc de limbe du
  côté de la calotte (ou disque entier, ou disque moins le cercle), remplissage pair-impair.
- Rendu : atmosphère fine (anneau `ciel` 55 % → 0 de 0,98 r à 1,06 r), sphère en dégradé radial centré vers le point
  subsolaire (135 % → base → 60 %), voile nuit progressif vers l'antipode du Soleil (jusqu'à 30 %), axe des pôles en
  option (partie derrière le globe en pointillé, N marqué), point subsolaire, flèche « vers le Soleil » au bord.
- Coût de calcul mesuré par un test : moins de 5 ms par image.

### Simulateur des ombres d'éclipse
- Le Soleil est entier (centre à r + 8 px du bord).
- « Rejouer une éclipse » : les 133 éclipses de la table 2015–2044, en proportions réelles (ombre et pénombre de la
  Terre à la distance de la Lune, ou ombre de la Lune sur la Terre) ; écart à l'axe y = D sin(5,145°) sin F (argument
  de latitude moyen, Meeus), ramené dans le domaine compatible avec le type de la table ; curseur « instant ».

### Catalogue
- Ordre des thèmes : Introduction, Coordonnées et mouvements, Lune, Astronomie antique, Renaissance, Système solaire,
  Petits corps, Soleil, Lumière et spectres, Télescopes, Propriétés stellaires, Étoiles doubles et variables,
  Exoplanètes, Voie lactée, Cosmologie.

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

### 2026-10-14 — retours : style, formules, étiquettes, cartes, éclipses

- [x] Corps célestes en sphères ombrées, étiquettes sans chevauchement (et test), formules MathML + STIX Two Math,
      glisser qui suit le doigt, aide propre à chaque animation, côtes Natural Earth à la demande, éclipses rejouées,
      ordre pédagogique des thèmes ; audit visuel des 92 animations sur bureau et téléphone.

## Reste à faire

- Rien d’obligatoire. Petits recouvrements de textes sans cartouche (graduations, légendes) encore possibles sur
  téléphone dans quelques animations. Pistes : tirages aléatoires identiques à ceux de Python (Mersenne Twister) pour le CCD et le
  télescope (seules les valeurs non affichées en dépendent) ; bouton « Version web » dans Coupole.
