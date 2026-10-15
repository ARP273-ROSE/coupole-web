# Progression de Coupole Web

Version navigateur des animations d’astronomie de Coupole (module « Animations » de l’application de bureau, d’après
ClassAction, University of Nebraska-Lincoln Astronomy Education, Apache 2.0).

## État courant

- Socle complet : catalogue, fiche, toile, réglages, adresse partageable, mémoire, thèmes, langues, PWA hors ligne,
  sécurité, tests, CI, déploiement GitHub Pages.
- Animations disponibles : **94** — les 92 de ClassAction, la machine d’Anticythère (0.2.0, adaptée d’Anticythere3D)
  et Orion en 3D (0.3.0, propre à Coupole), toutes vérifiées contre les références de Coupole (réglages et valeurs
  affichées, FR et EN, références régénérées en entier depuis Coupole 0.5.0), chacune avec son texte « Ce qu’il faut
  voir ».
- 0.3.0 : spectres sur bases physiques, Orion en 3D, fiche au survol générique, couleur vraie des étoiles, règle
  typographique (unités SI, signe moins, délimiteurs extensibles) sur tous les textes affichés.
- 0.6.0 : recherche bilingue (FR/EN, accents, pluriels, fautes, surlignage), favoris, bibliothèque, collections,
  installation de l'application, « Maintenant » / « En direct », ombres d'éclipse en vraie géométrie + vue 3D.
- 0.5.0 : passe finale (barre de navigation en bas sur téléphone, contraste automatique des figures, états
  introuvable / hors ligne, audit de bout en bout exhaustif, axe-core, garde-fou de confidentialité à empreintes salées).
- 0.4.0 : navigation par les 22 modules de ClassAction (+ 2 bonus), 517 questions, 110 fiches, 14 tables, 109
  schémas, 58 images ; recherche globale FR/EN ; Mes modules ; sauvegarde de tout (IndexedDB, export/import commun
  avec le bureau, réinitialisation tout ou partie) ; Orion en 3D refaite sur le modèle de la Grande Ourse 3D avec M42
  et IC 434 en volume ; intensités des spectres sur grille fine (PCHIP) et contraste pédagogique.
- Lighthouse 13 (0.5.0 ; mobile / bureau) : accueil 99/100, module 97/100, question 97/100, Anticythère 95/100,
  Orion en 3D 96/100 en performances ; accessibilité, bonnes pratiques, référencement 100 partout. Première page
  102,5 Ko compressés (limite 150).

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
   que les 94 en ont un).

Régénérer les fichiers tirés de Coupole (quand Coupole change) :

```sh
python3 outils/exporter_coupole.py CHEMIN_DE_COUPOLE            # textes, catalogue, données, images d'Orion, références communes
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

### Titres de panneaux (`cadre()` dans `src/noyau/dessin.ts`)
- Un titre ne dépasse jamais de son panneau (largeur utile = largeur du panneau − 24 px) : en entier sur une ligne s'il
  tient ; sinon sur deux lignes, coupé entre les mots, si le panneau a au moins 150 px de haut ; sinon sa forme courte
  (`titreCourt` : sans les parenthèses, puis sans ce qui suit « : »), sur une ou deux lignes ; sinon coupé par « … ».
  Police du titre : 0,95 × la base, gras ; le contenu du panneau descend d'autant de lignes.
- Le titre complet reste lisible : ajouté au libellé accessible de la toile (`aria-label`), et en infobulle seulement
  au survol d'un titre abrégé (aucune autre infobulle sur la toile). Les titres sont des obstacles pour le placeur.
- Tests : unitaire (92 animations, cinq formats dont 300 × 640, deux langues : chaque titre dans son panneau, aucun
  recouvrement) et Playwright téléphone (trois moteurs, 92 animations, mêmes contrôles sur `data-titres`).

### Trois vues d'un spectre (Kirchhoff)
- Le spectre suit l'ordre le long de la visée : distances d'entrée dans le nuage et dans l'ampoule ; l'ampoule est
  opaque (la visée s'arrête sur elle). Absorption seulement si le gaz est traversé avant l'ampoule ; ampoule devant le
  nuage : continu. Télescope sur un cercle de rayon 5,6 (au lieu de 4,6) : son tube (0,9) reste hors du halo de
  l'ampoule (3,2 + 2,2 × 0,55 = 4,41) ; étiquette à l'extérieur du cercle, repliée au-dessus du télescope si elle
  sortirait du panneau, halo réservé pour le placeur. Valeurs de référence inchangées (180° : absorption ; 318°, visée
  de l'ampoule : continu).

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
- Garde-fous (bogue « globe devenu un disque bleu vide » en glissant pendant la lecture) : chaque glisser est validé
  (entrées finies, rayon > 0) et le résultat doit être une vraie rotation (finie, orthonormée, déterminant +1),
  sinon il est ignoré ; une orientation invalide est remplacée par celle du départ avant le dessin ; une seule lancée
  d'inertie à la fois ; les vues 3D (`Vue3D.regler`) ignorent un angle non fini ; un réglage n'accepte jamais une valeur
  non finie (rien de tel dans l'adresse ni dans le navigateur). Tests : 1 000 glissers aléatoires en lecture avec
  élan et entrées aberrantes, 60 glissers en lecture dans chacune des 92 animations, et glissers rapides en lecture
  dans Chromium, Firefox et WebKit (globe, sphère, orbites) : image jamais vide.

### Simulateur des ombres d'éclipse (refait en 0.6.0 ; `src/calc/eclipses_geo.ts`, `ombres.ts`)
- Vraie géométrie : Soleil à l'infini (rayons parallèles), axes d'ombre parallèles à Soleil–Terre ; Lune repérée par
  (x le long de l'axe, y nord, z hors du plan), km. Type : `eclipses_geo` (Soleil : ombre de la Lune au plan central
  et au point de surface le plus proche → totale / hybride / annulaire, partielle si seule la pénombre touche ;
  largeur = diamètre de l'ombre à la surface ; Lune : règle de Danjon, rayon de la Terre + 1 %, celle des tables de la
  NASA — Chauvenet 2 % classait à tort la pénombrale du 29/09/2042). Constantes : R☉ 695 700, R⊕ 6 378,137, R☾
  1 737,4 km.
- Vue de côté (62 % de la largeur, ou 58 % de la hauteur si étroit) : kx = 384 400 km / (0,3 × largeur) le long de
  l'axe, ky = R⊕ / rt avec rt = 9–24 px (7,5 % de la hauteur) en travers ; Soleil = bord de disque `soleil` (rayon 0,9 h)
  et rayons horizontaux `soleil` 25 % ; cônes : pénombre `penombre` 20 %, ombre `umbra` 85 %, antombre contour
  `accent1` pointillé + fond 12 % ; Lune hors du plan de la figure (|z| > R⊕) : 45 % d'opacité. Étiquette du type
  d'éclipse en haut à droite (`accent3`). Échelle indiquée dans les valeurs.
- Vue 3D (38 %) : `Vue3D(215, 22)`, rayon de l'orbite min(0,42 l, 0,4 h) ; plan Terre–Soleil `ecliptique` 7 %, axe
  Soleil–Terre `soleil` pointillé + flèche « vers le Soleil », orbite `lune` 1,3 px inclinée de 5,145° (vraie
  inclinaison), ligne des nœuds `meridien` pointillé + « nœud ascendant », Lune et son fil vertical (`accent2` au
  nord, `accent3` au sud). Glisser = tourner (zone rotative), Lune et Terre restent saisissables dans la vue de côté.
- Curseurs : position sur l'orbite (0 = nouvelle lune, 180 = pleine lune), angle Soleil – nœuds (0 / 180 : saison
  d'éclipses) ; la Lune garde sa distance. Rejeu : géométrie DE440 de chaque éclipse au maximum (instant, d, gamma,
  position et vitesse dans le plan fondamental : `donnees/genere/eclipses_geometrie.json`, positions astrométriques
  pour le Soleil, apparentes pour la Lune comme les tables de la NASA), instant ∈ [−1, 1] = ± (R⊕ + pénombre) / v ;
  les trois vues suivent ; le type au maximum est celui de la table (133 / 133, testé). Distances extrêmes de la Lune
  (DE440, 1900–2100) : 356 375,3 km (4/01/1912), 406 711,7 km (9/01/1921).

### Chaîne proton-proton, cycle CNO (0.6.0)
- Particules légères agrandies à 10 px de rayon au moins (légende : « pas à l'échelle ») : positon = sphère `accent2`
  marquée « + » (gras 115 %), neutrino νₑ = trait `doux` 1,4 px pointillé + flèche, photon γ = onde `soleil` 2,2 px
  (3 périodes sur 4,2 r) + flèche ; étiquettes par `etiquette()` (placeur commun, trait de rappel), taille normale.
- Réaction centrée (centre − 8 px), noyaux s = min(l, h) / 10,5, écartement min(0,36 l, 0,32 h) ; légende 82 % en haut
  à gauche.

### Courbe de rotation de la Voie lactée
- Courbe : modèle de masse de McMillan (2017, arXiv:1608.00971 ; bulbe, disques d'étoiles mince et épais, gaz HI et
  H2, halo NFW), calculé avec galpy (`McMillan17`) dans le plan, de 0,05 à 25 kpc tous les 0,05 kpc, total et par
  composante (bulbe `accent3`, disques `equateur`, halo `arc1`, en tirets ; total `accent1`, 2,6 px), interpolation
  linéaire ; R0 = 8,21 kpc et v0 = 233,1 km/s du modèle (v_c(R0) calculée : 233,2 km/s). Plus de cassure : la courbe
  est lisse et physique. Vérifications SageMath (`outils/voie_lactee_verif.sage`) : vitesse du halo NFW et masse du
  bulbe retrouvées à 1,3 × 10⁻⁴ et 5 × 10⁻⁵ près.
- Mesures avec barres d'erreur : Eilers et al. (2019), table 1 (5,27 à 24,82 kpc, erreurs asymétriques), points
  `texte` ; compilation galkin (Pato & Iocco 2017) recalculée pour R0 = 8,21 kpc, v0 = 233,1 km/s, de 2 à 5,25 kpc par
  intervalles de 0,25 kpc (moyenne pondérée, barre = dispersion), points `accent2`.
- Courbe képlérienne : v = √(G M(<R) / r) pour r ≥ R, M(<R) = masse du modèle dans la sphère de rayon R (galpy,
  tous les 0,5 kpc, interpolée en log) ; elle part donc un peu sous la courbe (le disque n'est pas sphérique).
- Valeurs : masse « dynamique » v²R/G (comme Coupole) et, en plus, masse du modèle dans la sphère de rayon R.
- Galaxie vue du pôle Nord galactique, à l'échelle (disque de 25 kpc, anneaux tous les 5 kpc), Soleil en haut à
  R0 = 8,21 kpc, l = 90° à droite, rotation horaire (flèche au Soleil) ; lueur du disque exponentielle ; barre longue
  de Wegg et al. (2015) : demi-longueur 5,0 kpc, à 30,5° de la ligne Soleil–centre (milieu de 28–33°), extrémité
  proche du côté l > 0, épaisseur schématique (rapport 0,3) ; bras de Reid et al. (2019), table 2 : spirales
  log-périodiques ln(R/R_kink) = −(β − β_kink) tan ψ (ψ< avant le coude, ψ> après), β compté depuis la direction du
  Soleil vers l = 90°, tracées en trait plein sur la plage d'azimut des mesures et prolongées en estompé (entre 2,8 et
  17 kpc) ; largeur de bande = 2 × la largeur 1σ publiée. Norma et bras extérieur `arc2`, Scutum–Centaure `accent2`,
  Sagittaire–Carène `arc1`, Persée `equateur`, bras local `accent1`, bras de 3 kpc `accent3`. Cercle du rayon choisi en
  pointillé `accent3`.
- Coupole 0.4.1 a repris ce modèle : les références de la Voie lactée sont de nouveau celles du bureau (régénérées en
  0.3.0, clés `composantes` et `mesures`, textes `anim_milkywayrotationalvelocity_*`).

### Machine d'Anticythère (`src/calc/anticythere.ts`, `src/anim/animations/anticythere.ts`)
- Données et calculs repris d'Anticythere3D 1.3.1 (même auteur) sans changement : dents, trains (fractions exactes),
  `gear_angles`, tenon-fente (ε = 1,1 mm, r = 9,6 mm), implantation des 15 arbres et 16 étages, éclatement le long des
  arbres (`level_z`, `arbor_span`), cadrans (`dialface.py` : rayons, graduations, inscriptions, glyphes du Saros).
  Ajouts : vitesse exacte de chaque roue (`GEAR_RATES`, testée contre la dérivée de `gear_angles`), calendrier égyptien
  par l'ère de Nabonassar (JD 1 448 638, au lieu du jour de l'année grégorienne d'Anticythere3D), longitude
  géocentrique des planètes par l'épicycle (demi-grands axes) au lieu de la longitude héliocentrique moyenne.
- Date de départ : 12 août 2026, 12 h TU (éclipse totale de Soleil ; case ΗΣ du Saros). Machine calée à J2000.
- Caméra : quaternion [w, x, y, z] → matrice (lignes = axes de vue dans le repère de la machine). Vues : avant
  (identité), arrière (demi-tour autour de y), trois-quarts (Rx 24° · Ry −34°). Glisser : boule de commande d'angle
  |d| / (0,45 × min(l, h)) ; entrées non finies ignorées, résultat renormé et validé (sinon l'orientation de base) ;
  orientation invalide remplacée avant le dessin. Double-clic : vue choisie.
- Projection orthographique ; échelle = emprise projetée du coffret (8 coins) et de la poignée, × 0,95, centrée ;
  figée pendant un glisser de la vue (pas d'effet de pompage).
- Rendu : chaque pièce plane est dessinée dans son plan par `ctx.transform(affine_plan)` ; tri du peintre sur
  z × signe(R₂₂) ; arbres coupés aux plans des roues à moins de 20 mm (+ rayon) ; face cachée d'une roue = couronne de
  3 mm (seul son bord dépasse) ; denture triangulaire si une dent fait ≥ 3 px CSS, sinon cercle primitif ; roues à
  bras évidées (pair-impair). Machine fermée : faces du coffret tournées vers l'observateur seulement (bois
  `#664526` × 0,7–1), façade bronze `#C6A86A`.
- Couleurs des sous-ensembles : celles d'Anticythere3D en thème clair (entrée `#DE6910`, Lune `#0D59C1`, anomalie
  `#8E1700`, métonique `#1D9594`, callippique `#786F4C`, Saros `#841959`, exeligmos `#B66CCD`) ; thème sombre :
  éclaircies de 38 % vers le blanc. Bronze et gravure des cadrans : ceux de `dialface.py` (indépendants du thème).
- Cadrans en cache : image carrée (R = 0,485 × envergure ; avant 251,5 mm, arrière = BACK_DIAL_SPAN), côté 256 à
  2048 px, puissance de 2 selon le zoom réel (dpr et zoom de la scène compris) ; anneau calendaire à part, tourné pour
  que l'aiguille du Soleil montre la date égyptienne ; face arrière dessinée en miroir (vue par-derrière).
- Aiguilles : Soleil `#D9A626` (97,7 mm), Lune `#CCD1DB` (88,8 mm) avec sphère de phase demi-argentée (r 5,5 mm à
  82 mm, limbe éclairé tourné vers l'aiguille du Soleil) ; anneaux du Cosmos (rayons 26–72 mm) et symboles ☾ ☿ ♀ ☉ ♂
  ♃ ♄ placés par le placeur ; dos : aiguilles métonique et du Saros avec curseur sur le sillon, aiguilles des cadrans
  callippique, exeligmos et Jeux.
- Interaction : poignée (rayon de saisie max(16 px, 7 mm)) ; angle par intersection du rayon de vue avec le plan de
  la poignée ; 1 tour de poignée = 48/223 an ; lecture : 1 tour par seconde × vitesse. Survol (souris) ou toucher
  sans glisser (doigt) : roue la plus proche de l'observateur sous le pointeur (bras des roues évidées compris),
  cartouche « nom · dents · rapport » et ligne « Roue » des valeurs.
- Durée d'une image (Chromium, iPhone 15 émulé, NAS chargé, moyenne de 15 à 30 images) : fermée 0,4 ms (×1) et 1,5–2,3 ms
  (processeur ralenti ×4) ; ouverte 0,9–1,2 ms (×1), 3,5–4,8 ms (×4) ; éclatée 3,6–4,9 ms (×4). Première image d'une
  face : ≈ 200 ms (construction du cache, une fois).
- Tests : `anticythere.test.ts` (tests d'Anticythere3D + références SageMath `tests/references/anticythere_sage.json`),
  `anticythere_rendu.test.ts` (1 000 glissers aberrants, toutes vues, survol, manivelle), tests génériques des 93
  animations, Playwright 3 moteurs × 3 formats.

### Spectres sur bases physiques (0.3.0 ; `src/calc/spectres_physiques.ts`, `src/anim/spectre_physique.ts`)
- Moteur « spectres physiques » 1.0.0 copié tel quel (même API, nom pour nom, que `spectres_physiques.py` du bureau) et
  ses données `modele_spectres.json` (1 Mo, 264 Ko compressés, morceau chargé avec ces deux animations seulement) ;
  ses 100 cas de référence (5 classes × 20 types) reproduits à 10⁻⁹ (`tests/unit/spectres_physiques.test.ts`, et
  `tests/test_anim_etoiles_reelles.py` au bureau).
- Bande de spectre : 60 à 720 colonnes (une par pixel CSS), λ de 380 à 720 nm ; couleur de chaque colonne = couleur
  CIE 1931 de λ (`couleur_lambda`) en lumière linéaire × continu de Planck à T_eff (normé à son maximum dans la bande)
  × I/I_continu (raies et bandes des familles cochées) ; les raies sont élargies à 1,2 colonne au moins (résolution
  gaussienne, largeur équivalente conservée) ; cache des deux dernières bandes. Émission : raies colorées sur fond
  noir, opacité = profondeur / profondeur maximale (au moins 12 %), largeur = FWHM (1,6 px au moins).
- Explorateur : courbes des six familles (et bande G du CH en tirets, couleur des molécules) pour la classe choisie,
  par quart de type ; axe du bas en type spectral, axe du haut en température de la classe (40 000 K … 3 000 K, aux
  types où la classe les atteint, sans chevauchement) ; légende dans la marge de droite si le graphe garde 240 px,
  sinon en rangées au-dessus du graphe ; noms des 3, 5 ou 7 raies les plus fortes (largeur équivalente) au-dessus de la
  bande (Hα…Hε, H8, H9, sinon l’espèce), sans chevauchement ; remarques sous la bande (`accent1`, « ⚠ »).
- Cas signalés à l’écran et dans les valeurs : étalonnage borné ou interpolé (drapeaux du modèle), atmosphère
  extrapolée (log g hors grille ATLAS9 ; T_eff < 3 500 K), table `spectres_atmosphere.json` tirée de
  `etalonnage.json` du modèle.
- Parallaxe spectroscopique : T_eff et M_V du nouvel étalonnage quand ils sont publiés (V partout, III pour O et G–M7,
  I pour O) ; sinon M_V de l’ancien étalonnage (celui de l’original) et la valeur « Étalonnage de la magnitude
  absolue : ancien étalonnage… ». Diagramme HR de 2 300 à 48 000 K : courbes des classes paramétrées par le type
  (nouvel étalonnage en trait plein, ancien en pointillé, seulement dans le domaine de l’original), nom de la classe à
  son extrémité froide (placeur), point de l’étoile en couleur vraie ; le doigt choisit le type de la classe dont la
  T_eff est la plus proche.
- Écart avec l’original (et avec les références d’avant 0.3.0) : intensités, températures (G2 V = 5 770 K au lieu de
  5 830 K), magnitudes absolues, raies et couleurs changent ; les références des deux animations sont celles de
  Coupole 0.5.0 (même moteur).

### Orion en 3D (0.3.0 ; `src/calc/orion3d.ts`, `src/anim/animations/orion3d.ts`)
- Données : `orion3d.json` (60 étoiles, figure Stellarium, primitives 3D, textures) préparé hors dépôt (SIMBAD,
  Gaia DR3, Hipparcos 2007, articles ; vérification SageMath), matrice ICRS → galactique calculée par astropy à la
  construction des données (`outils/donnees_etoiles_reelles.py` de Coupole) et revérifiée par SageMath depuis la
  définition du repère galactique (écart 10⁻⁷).
- Repère ICRS centré sur le Soleil (pc). Caméra en perspective autour d’un pivot ; vue du ciel : œil au Soleil, d’où
  la projection gnomonique (nord en haut, est à gauche), demi-champ 18° (Orion), 0,55° (M42), 0,075° (Tête de
  Cheval). Dépliement u (réglage 0–100 %) : chaque point glisse sur sa ligne de visée de la sphère R0 = 400 pc à sa
  distance ; s = lissage(u) fait passer distance et focale (interpolation logarithmique) de la vue du ciel à la vue 3D
  (pivot à 300 pc pour Orion entier, œil à 1 000 pc, 270 pc visibles ; M42 : 16 pc, 6 pc ; Tête de Cheval : 9 pc,
  4,6 pc), lacet automatique 75° (Orion), 55° (M42), 35° (Tête de Cheval) et tangage 20° ; glisser = lacet et tangage
  en plus (Vue3D), double-clic : retour. Changement de cible : transition de 2,2 s (lissée) ; boutons « Vue du ciel »,
  « Vue 3D » : le dépliement va en 2,2 s, la lecture lancée par eux s’arrête seule ; en lecture demandée, la scène
  tourne de 6° par seconde.
- Rendu (de l’arrière vers l’avant) : fond `#04060C` dans les deux thèmes ; boucle de Barnard (arc de 14°, angles de
  position −15° à 195°, sur la coquille de Foley et al. 2023 : milieu de la corde de la ligne de visée, trois passes
  14/6/2 px, rouge Hα) ; bulle de λ Ori (lueur radiale) et son anneau, Orion A et B : tubes (squelettes Zucker et al.
  2021), une polyligne par morceau visible, épaisseur 2 × rayon à la profondeur moyenne (halo × 2,6 à 35 %, cœur), qui
  s’efface quand elle dépasserait 48 px (plongées) ; lueurs de M42 (rose et cœur cyan) et d’IC 434, effacées quand
  l’image de l’objet est montrée ; images posées sur le ciel (plan perpendiculaire à la ligne de visée à la distance de
  l’objet, transformation affine de trois coins, opacité 1 − 0,55 s, au moins 35 %, seulement au-delà de 24 px) ; M42
  de près (dès 40 px et s > 0,05) : cinq anneaux du front en bol z(r) = 0,2 (r/R)² pc et Voile en tirets à 2 pc
  devant ; lignes de visée du Soleil (12 % × s), figure (`#F2C14E` à 55 %), barres d’erreur (trait de 2,4 px ; pour
  une distance d’affichage publiée, tirets vers la mesure brute et petit cercle) ; étoiles de la plus lointaine à la
  plus proche, rayon `rayon_disque(V, 0, 5,5, 1,3, 8)` (× 1,25 dans les plongées), lueur (2,6 r, 22 %) dès 2,2 px,
  couleur vraie (accentuée × 2,5 sur option) ; noms (et distance quand s > 0,5) par le placeur ; Soleil en 3D ;
  échelle (100, 2 ou 1 pc) ; crédits des images en bas à gauche (cartouche) et en lien sous la scène ; légende
  « couleur = température ».
- Durée d’une image (Chromium, iPhone 15 émulé, NAS chargé, moyenne de 15) : ciel 0,8 ms (2,5 ms processeur ralenti
  × 4), 3D 1,1 ms (2,7 ms), M42 en 3D 0,6 ms (1,6 ms), Tête de Cheval 0,4 ms (1,1 ms). Bureau (QPainter hors écran,
  720 × 470, minimum de 8, charge 5–9) : ciel 5,5 ms, 3D 7,4 ms, plongée 1,7 ms.
- Tests : géométrie et fiches identiques au bureau (`tests/references/orion3d_reference.json`, produit par
  `outils/verif_anim/references_etoiles.py` de Coupole), données (|xyz| = d, directions, matrice orthonormée),
  vue du ciel gnomonique, 1 000 glissers aberrants, boutons, couleurs ; Playwright 3 moteurs × 3 formats (ciel, fiche
  au clavier jamais sur l’objet, vue 3D, durée de rendu, plongée vers M42 avec image et crédit).

### Fiche au survol (0.3.0 ; `src/anim/fiches.ts`, `fiche_texte.ts`, `src/app/fiche_flottante.ts`)
- Registre générique : `Animation.survolable(p, fiche, x, y, r, ordre)` dans `dessiner()` (coordonnées ramenées au
  repère de la toile, valeurs non finies ignorées), `objet_sous(pos, marge)`, `objets_ordonnes()` ; la scène s’en
  sert : souris (survol, marge 4 px), toucher sans glisser (marge 14 px ; à côté, la fiche se ferme), clavier (Tab et
  Maj+Tab parcourent les objets du plus brillant au plus faible puis rendent le focus, flèches quand la fiche est
  ouverte au clavier, Échap) ; la fiche suit son objet à chaque image et disparaît avec lui.
- Contenu (`contenu_fiche`, identique au bureau) : titre (nom UAI), désignations (4), lignes libellé / valeur / source
  (type et type spectral, V, M_V, distance pc et al avec incertitude « ± » ou « (−a/+b) », « mesure incertaine »,
  distance affichée, autres mesures (4), T_eff, rayon, luminosité, taille, longueur, diamètre, arc, âge, étoiles
  excitatrices) ; en anglais, le commentaire en français qui suit une référence est retiré ; résumé (nom, type,
  distance, température) lu par la région `aria-live`.
- Boîte : `.fiche-objet` (fond `surface` à 92 %, flou 6 px, bord, ombre, 0,74 rem, 300 px au plus), posée à côté de
  l’objet du côté qui a le plus de place (droite/gauche puis dessous/dessus, chaque côté puis ramené dans la scène),
  jamais sur l’objet quand un côté a la place (`placer_fiche`, identique au bureau, testé sur 300 cas) ; ne capte pas
  la souris ; scène de moins de 560 × 480 px : fiche compacte (type, magnitude, distance, température, taille, âge ;
  sources raccourcies à 44 caractères).
- Fiches chargées à la demande (`fiches.json`, 321 fiches, 47 Ko compressés) ; étoiles réelles (fiche, T_eff, couleur,
  distance) dans `etoiles_reelles.json` (19 Ko), statique.

### Couleur vraie des étoiles (0.3.0 ; `src/calc/couleur_etoile.ts`, `src/anim/etoiles_reelles.ts`)
- Table T → sRGB (1 000 à 50 000 K, 340 lignes, interpolation en log T) : corps noir → CIE 1931 2° → sRGB, composante
  linéaire maximale 1, vérifiée par SageMath (21 étoiles, 0 écart) ; à un niveau près de `couleurs_reference.json`.
  La même fonction pour toutes les étoiles (Orion, Grande Ourse, horloge, lever héliaque, repères, HR, parallaxe).
- Grande Ourse 3D : couleur vraie, contour `grille`, distances des parallaxes adoptées par SIMBAD (barres −/+),
  valeur « Distances : parallaxes adoptées par SIMBAD… » ; horloge et repères : contour `doux` en thème clair ;
  diagramme HR : case « Couleur = température » (cochée par défaut) : disque de 3 px en couleur vraie de la
  température du point, contour de la couleur du groupe ; Soleil et étoile comparés en couleur vraie.

### Règle typographique (0.3.0 ; `src/noyau/typographie.ts`, `src/noyau/typo.ts`)
- Formateur commun aux ressources et aux applis (`typographie.ts` : `unite`, `nombre`, `sci`, `normaliser`,
  `controle` ; cas `typographie_cas.json`) ; règle des animations (`typo.ts` : unités à barre oblique → exposants,
  « - » devant un chiffre → « − », `10^x` → exposant ; cas `typographie_reference.json`), appliquée en filet de
  sécurité à tout texte de la toile (`texte`, `etiquette`) et aux valeurs affichées ; `nombre()` écrit « − ».
- Sources corrigées (bureau et web) : km·s⁻¹, m·s⁻¹, m·s⁻², W·m⁻², g·cm⁻³, ph·s⁻¹, s⁻¹, a·s⁻¹, ″·a⁻¹, °·j⁻¹ (°·d⁻¹),
  « ° par image » ; milliers des textes en espace fine insécable ; indices hors formule récrits (Mₚ sin i, « magnitude
  absolue », « température effective »).
- Formules : délimiteurs MathML `stretchy="true"` (symétriques) ; sur la toile, glyphe des parenthèses agrandi à la
  hauteur du contenu ; racine qui couvre son contenu ; indice d’un mot entier (λ_max, f_obs, a_int) = un identificateur
  droit.
- Tests : tous les textes (valeurs, réglages, aides des 94 animations FR et EN, interface, catalogue, « Ce qu’il faut
  voir », textes dessinés sur la toile) passent `controle` (hors formules ; « CC BY 4.0 » et « License 2.0 » exceptés)
  et la règle des animations ; formules du demandeur (« d = 10^((m − M + 5)/5) », « t ≈ 10¹⁰ × (M/M☉)^(−2,5) »,
  racine de « (1+β)/(1−β) »).


### Modules, questions et ressources (0.4.0 ; `src/app/page_*.ts`, `src/contenu/*`)
- Contenus importés par `outils/importer_contenu.py DOSSIER` dans `public/contenu/` (aucun fichier écrit à la main) :
  `modules.json` (24 modules : ordre, numéros W/G/C/D, ressources), `q/<module>.json` (questions), `q/macros.json`,
  `q/couleurs.json`, `q/images.json` + WebP, `fiches|tables|schemas/<id>.json`, `images/images.json` + WebP,
  `recherche.json`, `titres.json`, `relevant.json` (★), `sources.json` ; moteur des questions recopié tel quel
  (`src/contenu/moteur_questions.ts`) ; références de parité recalculées par le moteur Python de référence
  (`tests/references/questions/banque_empreintes.json`). Quelques tournures sont neutralisées à l'import (dépôt public).
  Ajouter des questions = relancer le script.
- Chargement : la page d'accueil ne lit que `modules.json` (20 Ko compressés) ; pages des modules dans un morceau
  (`pages_modules`, 32 Ko) avec sa feuille `classe.css` ; chaque question, fiche, table, image lue à l'ouverture ;
  service worker : seuls les index sont préchargés, le reste est gardé à la première ouverture.
- Adresses : `#/` accueil, `#/animations` catalogue, `#/m/<module>[/<onglet>]`, `#/m/<module>/q/<id>?p_<menu>=…&g=…`,
  `#/mm/<id>` (module personnel), `#/mes-modules`, `#/progression`, `#/recherche?q=`, `#/r/<fiche|table|image>/<id>`.
- Onglets : motif ARIA (flèches, Début, Fin), panneau rempli à la première ouverture ; bascule « ce module / tous les
  modules » (groupés par module, comme ClassAction).
- Question : menus construits depuis `parametres` (options indisponibles exclues), « Nouveau tirage » (graine) si la
  question tire au hasard ou mélange ; choix en boutons radio (cases si plusieurs bonnes réponses), disposition
  liste / ligne / grille / colonnes ; « Valider » note la tentative (choix, menus, graine), « Montrer la réponse » :
  bonne réponse orange (#FF9900), 7 clignotements de 200 ms puis fixe, éléments `afficher: reponse` et explication ;
  indice (texte et figure) ; statut « Question corrigée » / « Réponse établie pour Coupole » ; volet « Ce qui a
  changé » ; ressources liées ★ (liens de l'original, puis choisis, puis par mots-clés en dernier, sans étoile).
- Figures des questions : `figure_svg.ts` (port de rendu_svg.py des questions) → SVG, jetons de `couleurs.json` selon
  le thème, `**…**` en couleur « valeur », `$…$` en MathML dans un `foreignObject`, cartes et globes avec les côtes
  Natural Earth (chargées seulement si la figure en a), photos avec leur crédit sous la figure.
- Fiches : HTML et MathML préparés (nettoyés par liste blanche, aucun style en ligne), schémas en SVG, encadrés
  « Piège » et « Pour aller plus loin », « Ce qui a changé », sources repliables. Tables : `<table>` à en-têtes de
  ligne et de colonne, nombres alignés à droite, source en infobulle.
- Schémas : `schema_svg.ts` (port de rendu_svg.py des ressources) ; mesure réelle des textes par `measureText` pour la
  marge du titre vertical et le cadre de vue (élargi si un texte en sort) ; contrôle de recouvrement repris
  (tests : 109 schémas × FR/EN, 0 conflit) ; couleurs résolues par thème, redessinées au changement de thème.
- Fenêtres de ressources : panneaux non modaux (role=dialog), barre déplaçable (pointeur ou flèches), redimensionnables
  (`resize`), une par ressource, en cascade ; sous 720 px, en bas de l'écran ; Échap ferme ; elles restent ouvertes
  quand la page change (question + fiche + table côte à côte).
- Aperçu au survol : bulle de 196 × 156 px après 400 ms (fondu 300 ms) : résumé et premier schéma d'une fiche, 4
  lignes d'une table, image réduite ; aussi au focus clavier.
- Recherche : normalisation sans accents, chaque mot préfixe d'un mot du titre (×1,5), des mots-clés (×1,3), du
  résumé (×1), dans les deux langues ; tri par nombre de mots trouvés puis score ; résultats par genre.

### Sauvegarde (0.4.0 ; `src/contenu/sauvegarde.ts`, `src/app/stockage.ts`)
- Format commun `coupole-sauvegarde` version 1 (portage Python identique au bureau, 34 cas de parité) ; migration de
  la version 0 (clés « coupole-web:reglages:<id> », thème, langue) ; une version future n'est jamais écrasée.
- IndexedDB (base `coupole-web`, magasin `etat`), repli localStorage, tout en try/catch ; écriture au plus tard 400 ms
  après un changement (minuteur non relancé), copie de secours synchrone quand la page est cachée ou quittée (la plus
  récente est reprise au chargement).
- Export : JSON stable (clés triées) ; import : fusionner ou remplacer (confirmation, copie téléchargée avant) ;
  réinitialisation : une animation, un module, réglages, réponses, Mes modules, préférences, tout ; « Annuler » 10 s.

### Orion en 3D (0.4.0, refaite)
- Mise en scène de la Grande Ourse 3D : direction d'Orion (α 84°, δ −1°) ramenée par une rotation (est et nord
  gardés) à celle de la Grande Ourse ; Terre à l'origine ; sphère céleste de 450 pc ; étoiles principales (8 de la
  figure + Hatysa + θ¹ Ori C) à leur distance (distance du groupe pour Alnilam, Mintaka, Meissa, Hatysa ; mesures
  brutes en option) ; projections et figure (Stellarium) sur la sphère, épée en trait fin ; figure dans l'espace en
  option ; toute la scène cadrée dans la toile ; vues instantanées « De côté » (172,5°, 12°, défaut) et « De face »
  (352,5°, −55°) ; aucune lecture (ANIMEE = false).
- M42 et IC 434 en volume (`src/calc/nebuleuses_orion.ts`, jumeau Python, référence commune) : 1 038 particules
  pré-calculées (mulberry32), géométrie publiée, agrandies ×12 autour de leur centre avec leurs étoiles excitatrices,
  triées par profondeur, sprites dégradés préparés une fois par couleur, gaz en mélange additif, poussière opaque ;
  estompées en vue de face (sinon elles cachent la figure) ; mention « taille agrandie ×12, position et distance
  exactes ; forme de M42 au-delà de 0,5 pc et profondeur d'IC 434 schématiques ».
- Ciel nocturne (#06080E) dans les deux thèmes ; étiquettes 1,08 × la base, grasses, sur cartouche (placeur commun).
- Gel signalé après le dépliement : non reproduit par mesure (Chromium et WebKit, processeur ralenti ×4 : aucune
  boucle de rendu au repos, une tâche longue de 98 ms au premier affichage d'une photographie en plongée ; bureau :
  6–14 ms par image dans les transitions) ; causes possibles supprimées à la racine (transitions automatiques de
  2,2 s pilotant un curseur à chaque image, photographies décodées et transformées à chaque image) ; garde-fous : test
  « aucune animation ne redessine au repos » sur les 94 animations (Playwright), test d'Orion (pas de tâche > 50 ms
  en tournant, rendu court, aucune image au repos), test unitaire de durée.

### Spectres (0.4.0)
- Intensités des familles calculées tous les 1/8 de type (`intensites_fines.json`, 24 Ko compressés) par la physique du
  modèle (outils/verif_anim/intensites_fines.py de Coupole), étalonnage interpolé par PCHIP (log T_eff, log g) ; aux
  types entiers, écart ≤ 0,01 sur 100 avec la table du modèle ; le moteur interpole la grille fine par PCHIP ;
  courbes tracées tous les 1/8 de type.
- Bande de spectre : « contraste pédagogique » par défaut (raies élargies à 0,8 nm, résidu élevé au cube), dit sous
  la bande et dans les valeurs ; « échelle réaliste » en option ; aussi dans la Parallaxe spectroscopique.

### Interface (0.5.0)
- Téléphone (≤ 640 px) : navigation en barre fixe en bas (icône 22 px + libellé 0,66 rem, élément actif `accent`
  sur `surface-2`), en-tête opaque à 92 % ; au-delà, navigation en haut (libellés masqués sous 1 180 px).
- Grand écran (≥ 1 600 px) : en-tête aligné sur la colonne du contenu ; ≥ 3 000 px : texte 21 px, colonne 2 400 px.
- Pages de lecture (fiche, table, image) : colonne de 80 ch centrée. Figures des questions : 760 px au plus.
- États : carte centrée (icône ronde `accent` sur `surface-2`, titre, texte, actions) pour « Introuvable » et « Hors
  ligne » ; listes vides en cadre pointillé ; chargement = anneau `accent` qui tourne (0,8 s).
- Mouvement : apparition des pages 180 ms (opacité + 4 px) ; tout est coupé sous `prefers-reduced-motion`.
- Figures des questions : un texte sur une surface de contraste < 3:1 prend la couleur `avant` (sombre ou clair) la
  plus contrastée ; texte de la bonne réponse : liseré (`paint-order: stroke`) de la couleur la plus contrastée.

### Recherche, favoris, bibliothèque, installation (0.6.0)
- Recherche : moteur `src/contenu/recherche.ts` (= `recherche.py` du bureau) ; points entiers : même racine 10, début
  8, une faute 7, deux fautes 5 ; × titre 3, mots-clés 2, texte 1 ; phrase = titre +12, contenue +6 ; couverture du
  titre + ⌊6 × trouvés / mots⌋. Résultats groupés par type dans l'ordre du meilleur résultat ; `mark` : fond `accent`
  22 %, texte `texte`, gras 620 ; titre de l'autre langue en italique (« En anglais : … »).
- Favoris : icône étoile (contour ; pleine `accent`, #8a5a00 en thème clair) ; sur les cartes du catalogue et de la
  bibliothèque, bouton rond 40 px en haut à droite sur fond translucide ; accueil : puces « genre + titre » (12 au plus,
  récentes d'abord). Page « Favoris » : puces de type, tri, groupes, collections en bas (bouton discret).
- Bibliothèque : `#/bibliotheque/<onglet>?m=…&f=1`, grilles de cartes 220 px pour animations et images (vignettes
  paresseuses), listes pour questions (W / G / C / D), fiches, tables ; carte d'accueil en pointillé.
- Navigation (6) : Modules, Bibliothèque, Catalogue, Favoris, Progression, À propos.
- Installation : bannière dans la zone des annonces (en bas, au-dessus de la barre de navigation) : icône 40 px, texte,
  « Installer » / « Comment installer », « Plus tard », « Ne plus proposer » ; fiche (dialogue) : étapes numérotées
  avec icônes 40 px (Partager, Sur l'écran d'accueil) ; bouton de l'en-tête (icône téléphone + flèche).
- Date et heure : bloc « Date et heure » en tête du panneau (Maintenant, En direct `aria-pressed` + point qui
  pulse, Ma position), ligne « date · heure locale (UTC±h) · heure TU », note sur l'heure solaire.

### Catalogue
- Ordre des thèmes : Introduction, Coordonnées et mouvements, Lune, Astronomie antique, Renaissance, Système solaire,
  Petits corps, Soleil, Lumière et spectres, Télescopes, Propriétés stellaires, Étoiles doubles et variables,
  Exoplanètes, Milieu interstellaire et formation des étoiles, Voie lactée, Cosmologie.

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

### 2026-10-14 — 0.2.0 : titres de panneaux, Kirchhoff, jour-nuit, machine d’Anticythère

- [x] Trois vues d’un spectre : ordre le long de la visée (ampoule opaque), télescope hors du halo ; références
      inchangées.
- [x] Titres de panneaux mis en page dans leur panneau (22 animations débordaient à 300 px de large) ; tests unitaire
      et Playwright téléphone.
- [x] Simulateur jour-nuit : globe 3D par défaut.
- [x] Machine d’Anticythère (93ᵉ) : cœur, rendu, textes FR/EN (exportés de Coupole, seulement les nouvelles clés :
      la réexportation complète des textes changerait d’autres libellés, voir « Reste à faire »), références de
      Coupole (`references_animations.py … antikythera`), « Ce qu’il faut voir », lien croisé, à propos, NOTICE.

### 2026-10-14 — 0.3.0 : spectres physiques, Orion en 3D, fiches au survol, couleur vraie, typographie

- [x] Moteur des spectres physiques (TS) et ses 100 cas de référence ; Explorateur de spectres et Parallaxe
      spectroscopique refaits avec lui ; cas extrapolés et ancien étalonnage signalés.
- [x] Orion en 3D (94ᵉ animation, nouveau thème « Milieu interstellaire et formation des étoiles ») ; images ESO et
      ESA/Hubble chargées à la demande (`public/orion/`), crédits mot pour mot ; NOTICE.
- [x] Fiche au survol générique (souris, doigt, clavier, `aria-live`), branchée sur six animations ; couleur vraie.
- [x] Textes réexportés en entier depuis Coupole 0.5.0, références régénérées en entier (94 animations) : la Voie
      lactée, le jour-nuit et les ombres d’éclipse prennent les clés et les textes du bureau (clés `web_…` retirées) ;
      `anim_phasedemonstrator_glisser` (aide sur la toile) remplacé par l’aide sous la scène du bureau.
- [x] Règle typographique sur toutes les animations ; formateur commun ; délimiteurs extensibles ; tests.
- [x] WebKit : une scène observée avant sa mise en page pouvait rester 1 × 1 (redimension vérifiée jusqu’à la mise en
      page).
- [x] Tests : 827 unitaires ; Playwright 3 moteurs × 3 formats ; 0.3.0.

### 2026-10-14 — 0.4.0 : modules, questions, ressources, sauvegarde ; Orion refaite ; spectres lissés

- [x] Contenus importés (24 modules, 517 questions, 110 fiches, 14 tables, 109 schémas, 58 + 3 images) ; moteur des
      questions et sauvegarde identiques au bureau (empreintes, 34 cas).
- [x] Accueil des modules, page de module à onglets, question, fenêtres de ressources, aperçu, recherche, Mes modules,
      Ma progression, À propos, NOTICE (licences et crédits exacts).
- [x] Orion en 3D sur le modèle de la Grande Ourse 3D, M42 et IC 434 en volume ; notes des fiches traduites.
- [x] Explorateur de spectres : grille fine, PCHIP, contraste pédagogique.
- [x] Tests : unitaires (contenus, typographie de tous les textes, schémas, moteur, sauvegarde), Playwright (modules,
      questions, fenêtres, Mes modules, progression, Orion, repos des 94 animations), 3 moteurs × 3 formats.

### 2026-10-14 — 0.5.0 : passe finale (design, audit complet, accessibilité, confidentialité)

Design (captures avant/après de chaque type de page, 320 px, 390 px, 1440 px, 4K, deux thèmes) :
- [x] Téléphone (≤ 640 px) : barre de navigation en bas, libellés visibles (mesurés sans troncature à 320 px FR/EN) ;
      l'en-tête débordait à 320 px (bouton de thème hors écran).
- [x] Figures des questions : contraste automatique des textes (≥ 3:1 sur la surface dessous, `CONTRASTE_MIN`),
      liseré pour la bonne réponse orange ; test unitaire sur toutes les variantes des 517 questions, deux thèmes,
      réponse montrée ou non. Défaut trouvé : « Échelle » (ovales sombres) illisible en thème clair.
      À reprendre au bureau (`classe/figure_qt.py`) : même règle.
- [x] Fiches, tables, images : colonne de lecture centrée (80 ch), « + » aligné ; figures des questions ≤ 760 px ;
      tableau de progression sans colonne « barre » sur téléphone ; 4K : en-tête aligné sur le contenu, texte 21 px.
- [x] États : « Introuvable » / « Hors ligne » (selon `navigator.onLine`) avec actions, listes vides encadrées,
      indicateur de chargement, apparition des pages 180 ms (mouvement réduit respecté), plus de cadre de focus sur
      `main` après un changement de page.
- [x] Catalogue : titre propre ; singuliers (« 1 table », « 1 résultat ») par une règle générique de `tr` (clé `_1`) ;
      icône « Exporter ou importer » ; marque « accueil » ; À propos à jour.
Fonctionnel (tests `tests/e2e/audit.spec.ts`, Chromium bureau, Firefox tablette, WebKit téléphone) :
- [x] 517 questions : toutes les options de chaque menu, réponse, indice, explication, validation, score dans Ma
      progression ; 94 animations : chaque réglage, toile non vide, adresse partageable rechargée = mêmes valeurs ;
      fiches, tables, images (crédit sous chaque photo) ; sauvegarde export → tout effacer → import = identique ;
      langue changée en cours de route ; hors ligne ; aucune image au repos hors animations.
- [x] Défauts corrigés : adresse partageable infidèle pour 41 animations (le curseur gardait une valeur plus fine que
      le champ ; les préréglages fixent des valeurs plus fines que le champ) → curseur arrondi aux décimales du champ
      (`Reglage.depuisCurseur`), valeur exacte (12 chiffres) dans l'adresse et la mémoire quand elle diffère du champ,
      reprise telle quelle ; réglage changé moins de 0,35 s avant de quitter l'animation perdu ; l'adresse d'une
      animation quittée pouvait écraser celle de la page suivante (minuteur de 0,35 s). Le temps (lecture, boutons
      « +1 jour »…) n'est pas un réglage et ne passe pas dans l'adresse (comme au bureau).
      À reprendre au bureau : arrondi du curseur aux décimales du champ (même règle).
Accessibilité (`tests/e2e/accessibilite.spec.ts`) :
- [x] axe-core (WCAG 2.2 A/AA, contraste) sur 15 types de page × 2 thèmes × 9 projets : 0 violation ; clavier
      (évitement, focus visible sur 40 arrêts, question au clavier, réglages) ; rôles et `aria-live`.
Performances :
- [x] Lighthouse mobile ≥ 95 sur les animations lourdes (Anticythère 86 → 95, Orion 94 → 96) : cadrans d'Anticythère
      construits progressivement (256 px tout de suite, la bonne résolution dans une tâche suivante : longue tâche
      434 → 150 ms au processeur ×4) ; page, textes et code d'une animation ouverte directement chargés en parallèle
      dès le démarrage ; titre affiché tout de suite (squelette de même mise en page).
Sécurité et confidentialité :
- [x] CSP stricte (méta, aucun `unsafe-inline`), SRI, actions épinglées par SHA, `npm audit` : 0 ;
      garde-fou de confidentialité remplacé par le gabarit commun à empreintes salées (`tests/test_confidentialite.py`,
      exécuté en CI) ; NOTICE : crédits des 13 photos des images et des 3 photos des questions présents.
Contenus :
- [x] Banque de questions recopiée après contre-expertise (8 modules) ; empreintes de parité recalculées.

### Retours de l'utilisateur (14/10) — vérifiés un par un pour 0.5.0

Retours sur les animations (`retours_anim_14oct`) :
- [x] Général : planètes, Lune, Soleil, Terre en sphères (dégradé, terminateur, limbe, halo), palette commune.
- [x] 1. Longitude / latitude : la Terre suit le glisser (test `vue.test.ts`, capture).
- [x] 2. Saisons, « Vue de la Terre » : rayons découpés au panneau.
- [x] 3. Cartes : Natural Earth 1:50m, projections (équirectangulaire, polaires, globe 3D).
- [x] 4. Grande Ourse 3D : étiquettes sans chevauchement (placeur + test).
- [x] 5. Ombres d'éclipse : Soleil entier ; 133 éclipses rejouables.
- [x] 6. Audit des 92 animations (puis 94) : unitaire (étiquettes, titres) + balayage de chaque réglage (0.5.0).
- [x] 7. Formules : MathML + STIX Two Math (fractions, exposants, délimiteurs extensibles).
- [x] 8. Aide propre à chaque animation, discrète, sous la scène ; aucune infobulle sur la toile.
- [x] 9. Sphères en 3D.
- [x] 10. Lanceur de marteau et étiquetage anti-collision générique + test.
- [x] 11. Ordre pédagogique des thèmes.
- [x] 12. Spectres : physique (Saha–Boltzmann), raies NIST et bandes, Planck, 5 772 K, légende dans le graphe.
File d'attente :
- [x] 1. Spectres physiques. - [x] 2. Orion en 3D. - [x] 4. Couleur vraie des étoiles. - [x] 5. Fiche au survol.
- [x] 6. Parité ClassAction (questions, fiches, tables, images, modules, Mes modules).
- [x] 7. Jour-nuit : globe 3D par défaut. - [x] 8. Sauvegarde de tout (+ aller-retour vérifié en 0.5.0).
- [ ] 3. Page privée de comparaison avec l'original (Ruffle) : hors de ce dépôt public (page NAS), à proposer.
- [x] Consigne finale « moderne, léger, fonctionnel, tout tester » : cette passe.

### 2026-10-15 — 0.6.0 : recherche bilingue, favoris, bibliothèque, installation, maintenant, ombres d'éclipse
- Recherche bilingue (moteur commun web / bureau, cas `tests/references/recherche_cas.json` produits par
  `outils/cas_recherche.py` de Coupole : unitaires, petit corpus, 97 recherches sur les vrais contenus).
- Favoris (sauvegarde version 2 : `favoris`, cas de parité régénérés, 39), collections (ex-« Mes modules »),
  bibliothèque, installation (règles pures `installation_regles.ts`, tests unitaires et Playwright Chromium / WebKit
  iPhone, iPad, iPad « Mac » / Firefox), manifeste (captures `outils/captures_manifeste.mjs`).
- « Maintenant » / « En direct » / « Ma position » (`src/calc/maintenant.ts` = `maintenant.py`, 165 cas zoneinfo) ;
  glisser toujours actif (pointeurs périmés oubliés au premier doigt d'un nouveau geste, saisie retentée au glisser,
  focus rendu après un réglage au doigt) ; ombres d'éclipse en vraie géométrie + vue 3D ; fusion lisible (νₑ).
- Audit : adresse partageable lue une fois stable (WebKit), première animation avec un délai long.
- Données DE440 : `outils/verif_anim/geometrie_eclipses.py` de Coupole (python-lab, skyfield 1.54, de440s.bsp).

## Reste à faire

- Rien d’obligatoire. Petits recouvrements de textes sans cartouche (graduations, légendes) encore possibles sur
  téléphone dans quelques animations. Pistes : tirages aléatoires identiques à ceux de Python (Mersenne Twister) pour le CCD et le
  télescope (seules les valeurs non affichées en dépendent) ; bouton « Version web » dans Coupole.
