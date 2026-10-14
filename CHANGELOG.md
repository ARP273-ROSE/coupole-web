# Journal des modifications — Changelog

*Français, puis [English](#english).*

## 0.4.0 — 2026-10-14

- **Navigation par modules** (comme ClassAction) : l’accueil présente les **22 modules** (et deux modules bonus),
  « Mes modules », la reprise de la dernière question et les animations par thème. Une page de module a des onglets
  **Questions** (Échauffement, Générales, Défis, Discussion, numérotées W1, G1…, avec leur état ✓ ✗ •), **Animations**,
  **Fiches**, **Tables**, **Images** (ce module ou tous les modules) ; fil d’Ariane partout.
- **517 questions** d’instruction par les pairs, d’après ClassAction (Apache 2.0), traduites et réécrites en données :
  menus « Adapter la question » (variantes), nouveau tirage, figures vectorielles, choix A–H, **Valider** (tentative
  enregistrée), **Montrer la réponse** (la bonne réponse clignote en orange puis reste orange), indice, explication,
  éléments de réponse des questions de discussion, « Ce qui a changé par rapport à l’original », ressources liées
  **★**, question précédente / suivante (W → G → C → D, en boucle), plein écran ; clavier A–H, Entrée, R, I, N, F,
  ← →. Moteur des questions identique au bureau (empreintes de 8 000 instances).
- **110 fiches, 14 tables, 109 schémas** écrits pour Coupole (valeurs recalculées et sourcées) : fiches en HTML et
  MathML, schémas dessinés en SVG par un moteur qui lit leur description (mesure réelle des textes pour les marges,
  contrôle de non-chevauchement), tables accessibles, photos libres avec **crédit et licence** sous chaque image.
  Fenêtres de ressources flottantes (plusieurs à la fois, déplaçables, redimensionnables, Échap), **aperçu au survol**.
- **Recherche globale FR/EN** : questions, animations, fiches, tables, images.
- **Mes modules** : créer, copier (y compris un module de ClassAction), renommer, supprimer (avec annulation),
  ajouter ou retirer n’importe quelle question ou ressource (bouton +), réordonner (flèches ou glisser).
- **Sauvegarde de tout** dans le navigateur (IndexedDB, repli localStorage) : réglages de chaque animation, réponses,
  scores et tentatives, progression par module, Mes modules, préférences ; format commun versionné avec migration,
  **export / import JSON** lisible aussi par Coupole (bureau), **réinitialisation tout ou partie** (une animation, un
  module, les réglages, les réponses, Mes modules, les préférences, tout) avec confirmation, copie téléchargée avant
  l’effacement et « Annuler » ; page **Ma progression**.
- **Orion en 3D refaite sur le modèle de la Grande Ourse 3D** : les étoiles principales (Bételgeuse, Bellatrix,
  Meissa, la Ceinture, Saiph, Rigel, l’épée) à leur distance, la Terre, les lignes de visée, la figure sur la sphère
  céleste ; boutons « De face » et « De côté » ; **M42 et IC 434 / Tête de Cheval en volume** (cloque de M42 creusée
  dans OMC-1, Trapèze, Voile, Barre ; front d’IC 434, pilier de la Tête de Cheval, bord d’Orion B, NGC 2023, σ Ori),
  taille agrandie ×12 et signalée, position exacte ; plus de dépliement ni de photographies ; étiquettes plus grandes,
  sur cartouche contrasté ; scène fixe (aucun rendu au repos), test de performance ; notes des fiches traduites en
  anglais (âges d’Orion A, B, λ Ori, boucle de Barnard…).
- **Explorateur de spectres** : intensités des familles calculées tous les 1/8 de type (physique du modèle,
  étalonnage interpolé de façon monotone et lisse, PCHIP), plus de paliers ni de cassures (He I, He II) ; **contraste
  pédagogique** des raies (par défaut, dit à l’écran) ou **échelle réaliste** ; même réglage dans la Parallaxe
  spectroscopique.
- Première page : 100 Ko compressés ; contenus chargés à la demande et gardés hors ligne à la première ouverture.

## 0.3.0 — 2026-10-14

- **Orion en 3D** (nouveau thème « Milieu interstellaire et formation des étoiles », entre Exoplanètes et Voie
  lactée) : la constellation telle qu’on la voit, puis dépliée progressivement en trois dimensions, chaque étoile à
  sa distance mesurée (de Tabit, 8 pc, à la Ceinture, vers 380–400 pc) avec sa barre d’erreur ; nuages moléculaires
  Orion A et B (squelettes 3D de Zucker et al. 2021, épine de Großschedl et al. 2018), anneau de λ Orionis, boucle de
  Barnard sur la coquille d’Orion (Foley et al. 2023), nébuleuse d’Orion en « blister » (front d’ionisation en bol,
  Voile, Trapèze : Wen & O’Dell 1995, O’Dell et al. 2009) et Tête de Cheval ; plongée vers M42 et la Tête de Cheval
  avec les images de l’ESO et de l’ESA/Hubble posées sur le ciel à leur place exacte (CC BY 4.0, crédit affiché sur la
  scène et en lien sous la scène, images chargées à la demande). Distances publiées par défaut pour Alnilam, Mintaka,
  Meissa et Hatysa (mesure propre peu fiable), option « distances mesurées brutes » ; Trapèze à 388 ± 5 pc (VLBA),
  Gaia DR3 (402 pc) et Menten et al. 2007 (414 pc) dans la fiche ; option « couleurs accentuées » (désactivée par
  défaut). Tout est à l’échelle, sauf la taille des étoiles.
- **Fiche au survol, générique** : survoler (souris), toucher (doigt) ou atteindre au clavier (Tab, flèches, Échap)
  une étoile ou une nébuleuse ouvre une petite fiche, jamais posée sur l’objet, lue par les lecteurs d’écran (région
  « aria-live ») : noms et désignations, type, magnitudes, distance (pc et al, incertitude, mesure peu fiable,
  autres mesures), température, rayon et luminosité publiés ; la source de chaque valeur. Branchée sur Orion en 3D, la
  Grande Ourse 3D, l’horloge de la Grande Ourse, le lever héliaque, la comparaison des repères et le diagramme HR
  (321 fiches, SIMBAD, Gaia DR3, Hipparcos 2007, articles).
- **Couleur vraie des étoiles** (corps noir à T_eff → CIE 1931 → sRGB, vérifiée par SageMath) dans ces animations ;
  diagramme HR : case « couleur = température » ; Grande Ourse 3D : distances mises à jour (parallaxes adoptées par
  SIMBAD : Merak 84,5 al au lieu de 79,4, Alkaid 103,9 au lieu de 100,7…).
- **Spectres sur bases physiques** (Explorateur de spectres, Parallaxe spectroscopique) : intensités des familles de
  raies calculées par Saha–Boltzmann sur des atmosphères ATLAS9, courbes lisses par classe (V, III, I) avec le type
  spectral en bas et la température en haut, 133 raies NIST (les plus fortes nommées), bandes TiO et CH dégradées
  vers le rouge, continu de Planck coloré (CIE 1931) ; G2 V = 5 770 K (Mamajek 2022) ; la classe change le spectre.
  Cas extrapolés (atmosphère hors grille, étalonnage borné ou interpolé) et magnitude absolue de l’ancien étalonnage
  signalés à l’écran ; légende qui passe au-dessus du graphe quand la place manque.
- **Règle typographique partout** : unités SI à exposants (km·s⁻¹, m·s⁻², W·m⁻², g·cm⁻³), signe moins « − », espaces
  fines des milliers, puissances de dix en exposant, formules à délimiteurs extensibles, indices de mots en romain
  (λ_max, a_int) ; formateur commun au bureau et aux ressources ; test sur tous les textes affichés.
- **Textes réexportés en entier depuis Coupole** et références régénérées : la Voie lactée, le simulateur jour-nuit
  (deux lignes « au pôle Nord / Sud ») et le simulateur des ombres reprennent les clés et les textes du bureau.
- **Mesures** : voir PROGRESSION.md.

## 0.2.0 — 2026-10-14

- **La machine d’Anticythère en 3D** (thème « Astronomie antique ») : une 93ᵉ animation, qui s’ajoute aux 92
  d’après ClassAction, adaptée d’[Anticythere3D](https://github.com/ARP273-ROSE/Anticythere3D), du même auteur.
  Mêmes nombres de dents (Freeth et al. 2006, 2008), mêmes rapports exacts, même implantation des arbres, mêmes
  cadrans gravés en grec, mêmes tests ; rapports clés revérifiés sous SageMath (métonique 235/19, Saros 223 lunaisons,
  callippique 1/76, exeligmos 235/12711, Lune sidérale 254/19). Manivelle saisie au doigt ou à la souris, lecture
  animée ; date, calendrier égyptien, zodiaque, phase de la Lune sur la sphère demi-argentée, planètes du Cosmos
  (Freeth et al. 2021), spirales métonique et du Saros avec leur aiguille et les glyphes d’éclipses ; machine fermée
  ou ouverte, étages éclatés, face avant, face arrière ou trois-quarts ; survol ou toucher d’une roue : nom, dents,
  rapport, fonction ; lien vers l’application complète. Canvas 2D sans WebGL : projection orthographique, caméra par
  quaternion avec garde-fous, algorithme du peintre, cadrans en cache selon le zoom (0,4 à 1,2 ms par image sur
  téléphone émulé). Valeurs identiques à l’application de bureau au caractère près.
- **Titres de panneaux** : ils ne débordent plus sur le panneau voisin (Phases de Vénus chez Copernic et chez
  Ptolémée, et 20 autres animations, sur téléphone ou fenêtre étroite) : deux lignes, forme courte ou « … », titre
  complet dans le libellé accessible et en infobulle ; tests unitaire et Playwright (téléphone, trois moteurs).
- **Trois vues d’un spectre** : l’ampoule opaque devant le nuage donne un spectre continu (et non des raies
  d’absorption) ; l’ordre le long de la visée décide ; télescope et étiquette hors du halo de l’ampoule.
- **Simulateur jour-nuit** : s’ouvre sur le globe 3D (un choix mémorisé est gardé).

## 0.1.0 — 2026-10-14

Première version de Coupole Web, la version navigateur des animations d’astronomie de Coupole.

- Les 92 animations de ClassAction, chacune avec sa fiche et son texte « Ce qu’il faut voir ».
- Rendu : astres en sphères ombrées (terminateur, limbe assombri, halo du Soleil), étiquettes placées sans
  chevauchement, formules typographiées (MathML, police STIX Two Math), côtes Natural Earth 1:50m ; le glisser suit le
  doigt ; aide propre à chaque animation ; éclipses de la table rejouables dans le simulateur des ombres ; vues polaires (pôle Nord, pôle Sud)
  et globe 3D qu’on fait tourner dans tous les sens dans le simulateur jour-nuit, terminateur et crépuscules exacts ;
  courbe de rotation de la Voie lactée d'après le modèle de McMillan (2017) avec les mesures d'Eilers et al. (2019) et
  la compilation galkin, Galaxie vue de face avec barre et bras de Reid et al. (2019).
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

### 0.4.0 — 2026-10-14

- **Module navigation** (as in ClassAction): the home page shows the **22 modules** (and two bonus modules), “My
  modules”, resuming the last question, and animations by topic. A module page has **Questions** (Warm-up, General,
  Challenge, Discussion, numbered W1, G1…, with their state ✓ ✗ •), **Animations**, **Outlines**, **Tables**,
  **Images** tabs (this module or all modules); breadcrumb everywhere.
- **517 peer-instruction questions**, after ClassAction (Apache 2.0), translated and rewritten as data: “Adapt
  question” menus (variants), new draw, vector figures, choices A–H, **Check** (attempt recorded), **Show answer**
  (the right answer flashes orange, then stays orange), hint, explanation, answer elements for discussion questions,
  “What changed from the original”, related resources **★**, previous / next question (W → G → C → D, looping), full
  screen; keys A–H, Enter, R, I, N, F, ← →. Question engine identical to the desktop (fingerprints of 8,000 instances).
- **110 outlines, 14 tables, 109 diagrams** written for Coupole (recomputed, sourced values): outlines in HTML and
  MathML, diagrams drawn in SVG by an engine that reads their description (real text measurement for margins,
  overlap check), accessible tables, free photos with **credit and licence** under each image. Floating resource
  windows (several at once, movable, resizable, Escape), **hover preview**.
- **Global FR/EN search**: questions, animations, outlines, tables, images.
- **My modules**: create, copy (including a ClassAction module), rename, delete (with undo), add or remove any
  question or resource (+ button), reorder (arrows or drag).
- **Everything saved** in the browser (IndexedDB, localStorage fallback): each animation’s settings, answers, scores
  and attempts, progress per module, My modules, preferences; common versioned format with migration, **JSON export /
  import** also read by Coupole (desktop), **reset all or part** (one animation, one module, settings, answers, My
  modules, preferences, everything) with confirmation, a copy downloaded before erasing and “Undo”; **My progress**
  page.
- **Orion in 3D remade after the Big Dipper 3D**: the main stars (Betelgeuse, Bellatrix, Meissa, the Belt, Saiph,
  Rigel, the sword) at their distances, the Earth, lines of sight, the figure on the celestial sphere; “Face-on” and
  “From the side” buttons; **M42 and IC 434 / Horsehead in volume** (M42 blister hollowed into OMC-1, Trapezium, Veil,
  Bar; IC 434 front, Horsehead pillar, edge of Orion B, NGC 2023, σ Ori), size enlarged ×12 and said so, exact
  position; no more unfolding or photographs; larger labels on contrasted boxes; still scene (no rendering at rest),
  performance test; data sheet notes translated into English (ages of Orion A, B, λ Ori, Barnard’s Loop…).
- **Spectrum Explorer**: family intensities computed every 1/8 of a type (the model’s physics, calibration
  interpolated monotonically and smoothly, PCHIP), no more plateaus or kinks (He I, He II); **teaching contrast** of
  the lines (default, stated on screen) or **realistic scale**; same setting in the Spectroscopic Parallax.
- First page: 100 KB compressed; contents loaded on demand and kept offline once opened.

### 0.3.0 — 2026-10-14

- **Orion in 3D** (new topic “Interstellar Medium and Star Formation”, between Extrasolar Planets and Milky Way): the
  constellation as we see it, then gradually unfolded in three dimensions, every star at its measured distance (from
  Tabit, 8 pc, to the Belt, around 380–400 pc) with its error bar; Orion A and B molecular clouds (3D skeletons of
  Zucker et al. 2021, spine of Großschedl et al. 2018), λ Orionis ring, Barnard’s Loop on the Orion shell (Foley et
  al. 2023), the Orion Nebula as a “blister” (bowl-shaped ionisation front, Veil, Trapezium: Wen & O’Dell 1995,
  O’Dell et al. 2009) and the Horsehead; dive towards M42 and the Horsehead with ESO and ESA/Hubble images laid on the
  sky at their exact place (CC BY 4.0, credit shown on the scene and as a link below it, images loaded on demand).
  Published distances by default for Alnilam, Mintaka, Meissa and Hatysa (unreliable own measurement), “raw measured
  distances” option; Trapezium at 388 ± 5 pc (VLBA), Gaia DR3 (402 pc) and Menten et al. 2007 (414 pc) in the data
  sheet; “enhanced colours” option (off by default). Everything is to scale except the size of the stars.
- **Generic hover data sheet**: hovering (mouse), touching (finger) or reaching with the keyboard (Tab, arrows,
  Escape) a star or a nebula opens a small sheet, never laid over the object, read by screen readers (“aria-live”
  region): names and designations, type, magnitudes, distance (pc and ly, uncertainty, unreliable measurement, other
  measurements), temperature, published radius and luminosity; the source of each value. Wired to Orion in 3D, Big
  Dipper 3D, the Big Dipper clock, heliacal rising, coordinate systems comparison and the HR diagram (321 sheets,
  SIMBAD, Gaia DR3, Hipparcos 2007, papers).
- **True star colours** (black body at T_eff → CIE 1931 → sRGB, checked with SageMath) in these animations; HR
  diagram: “colour = temperature” box; Big Dipper 3D: updated distances (SIMBAD adopted parallaxes: Merak 84.5 ly
  instead of 79.4, Alkaid 103.9 instead of 100.7…).
- **Physically based spectra** (Spectrum Explorer, Spectroscopic Parallax): line-family strengths computed with
  Saha–Boltzmann on ATLAS9 atmospheres, smooth curves per class (V, III, I) with the spectral type at the bottom and the
  temperature at the top, 133 NIST lines (the strongest named), TiO and CH bands degraded to the red, coloured Planck
  continuum (CIE 1931); G2 V = 5,770 K (Mamajek 2022); the class changes the spectrum. Extrapolated cases (atmosphere
  outside the grid, clamped or interpolated calibration) and the former absolute-magnitude calibration flagged on
  screen; legend moved above the graph when space is short.
- **Typography rule everywhere**: SI units with exponents (km·s⁻¹, m·s⁻², W·m⁻², g·cm⁻³), “−” minus sign, thin
  thousands spaces, powers of ten as superscripts, formulas with stretchy delimiters, word subscripts upright (λ_max,
  a_int); formatter shared with the desktop application and the resources; test on every displayed text.
- **Texts fully re-exported from Coupole** and references regenerated: the Milky Way, the day-night simulator (two
  “at the North / South Pole” lines) and the eclipse shadows simulator use the desktop keys and texts.
- **Measurements**: see PROGRESSION.md.

### 0.2.0 — 2026-10-14

- **The Antikythera Mechanism in 3D** (“Ancient astronomy” topic): a 93rd animation, added to the 92 after
  ClassAction, adapted from [Anticythere3D](https://github.com/ARP273-ROSE/Anticythere3D), by the same author. Same
  tooth counts (Freeth et al. 2006, 2008), same exact ratios, same arbor layout, same dials engraved in Greek, same
  tests; key ratios checked again with SageMath (Metonic 235/19, Saros 223 lunations, Callippic 1/76, exeligmos
  235/12711, sidereal Moon 254/19). Crank grabbed with a finger or the mouse, animated playback; date, Egyptian
  calendar, zodiac, Moon phase on the half-silvered ball, Cosmos planets (Freeth et al. 2021), Metonic and Saros
  spirals with their pointer and eclipse glyphs; closed or open machine, exploded levels, front, back or
  three-quarter view; hovering or tapping a gear: name, teeth, ratio, function; link to the full application.
  Canvas 2D without WebGL: orthographic projection, quaternion camera with safeguards, painter’s algorithm, dials
  cached according to the zoom (0.4 to 1.2 ms per frame on an emulated phone). Values identical to the desktop
  application, character for character.
- **Panel titles** no longer spill onto the neighbouring panel (Phases of Venus, Copernican and Ptolemaic, and 20
  other animations, on a phone or a narrow window): two lines, short form or “…”, full title in the accessible label
  and in a tooltip; unit and Playwright tests (phone, three engines).
- **Three views of a spectrum**: the opaque bulb in front of the cloud gives a continuous spectrum (not absorption
  lines); the order along the line of sight decides; telescope and label out of the bulb’s halo.
- **Day-night simulator**: opens on the 3D globe (a remembered choice is kept).

### 0.1.0 — 2026-10-14

First version of Coupole Web, the browser version of Coupole’s astronomy animations.

- All 92 ClassAction animations, each with its page and its « What to look for » text.
- Rendering: celestial bodies as shaded spheres (terminator, limb darkening, Sun halo), labels placed without overlap,
  typeset formulas (MathML, STIX Two Math font), Natural Earth 1:50m coastlines; dragging follows the finger;
  per-animation help; eclipses of the table can be replayed in the shadow simulator; polar views (North Pole, South Pole)
  and a 3D globe that turns in any direction in the daylight simulator, with exact terminator and twilights;
  Milky Way rotation curve from the McMillan (2017) model with the Eilers et al. (2019) measurements and the galkin
  compilation, face-on Galaxy with bar and arms from Reid et al. (2019).
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
