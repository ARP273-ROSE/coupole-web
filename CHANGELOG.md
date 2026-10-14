# Journal des modifications — Changelog

*Français, puis [English](#english).*

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
