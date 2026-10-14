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

### Simulateur des ombres d'éclipse
- Le Soleil est entier (centre à r + 8 px du bord).
- « Rejouer une éclipse » : les 133 éclipses de la table 2015–2044, en proportions réelles (ombre et pénombre de la
  Terre à la distance de la Lune, ou ombre de la Lune sur la Terre) ; écart à l'axe y = D sin(5,145°) sin F (argument
  de latitude moyen, Meeus), ramené dans le domaine compatible avec le type de la table ; curseur « instant ».

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

## Reste à faire

- Rien d’obligatoire. Petits recouvrements de textes sans cartouche (graduations, légendes) encore possibles sur
  téléphone dans quelques animations. Pistes : tirages aléatoires identiques à ceux de Python (Mersenne Twister) pour le CCD et le
  télescope (seules les valeurs non affichées en dépendent) ; bouton « Version web » dans Coupole.
