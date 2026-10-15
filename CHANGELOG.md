# Journal des modifications — Changelog

*Français, puis [English](#english).*

## 0.6.1 — 2026-10-15

Nouvelle animation **« Gravité et orbites »** (95ᵉ), d’après la simulation PhET « Gravity and Orbits » du projet PhET
Interactive Simulations de l’University of Colorado Boulder : idée et fonctions reprises, code, dessins et textes
propres à Coupole (aucune partie de PhET n’est copiée).

- **Scénarios** : Soleil et Terre ; Soleil, Terre et Lune ; Terre et Lune ; Terre et station spatiale (ISS) ; libre
  (Soleil, Terre, Lune et une comète d’aphélie 2,4 ua). Le Soleil, la Terre et la Lune ensemble partent de leurs
  positions et vitesses **réelles du 1ᵉʳ janvier 2026** (éphéméride DE440, chaque orbite ramenée dans l’écliptique
  autour de sa ligne des nœuds) : une Lune lancée sur un cercle de Kepler prendrait, dans le champ de marée du Soleil,
  une orbite de période 27,05 à 27,81 j selon la phase de départ.
- **Deux vues** : « Modèle » (astres agrandis, distance Terre–Lune agrandie 78 fois, rapports écrits sur la toile) et
  « À l’échelle » (tailles et distances vraies : vus du Soleil, la Terre et la Lune ne font qu’un point, entouré d’un
  anneau discret), avec un passage en douceur de l’une à l’autre (rayons et écart interpolés en logarithme) ; aucune
  image de plus une fois arrivé.
- **Mécanique** : N corps, schéma symplectique de **Yoshida d’ordre 4** (Verlet de vitesse composé), pas adaptatif
  (1 % du temps dynamique de la paire la plus serrée) ; constantes officielles (G CODATA 2018, GM☉ et GM⊕ nominaux UAI
  2015, GM☾ DE440, rayons UAI 2015 et NASA, ua UAI 2012, ISS NASA) ; collisions (le plus léger s’écrase, quantité de
  mouvement gardée). Périodes mesurées (passages par la direction de départ, instant interpolé) : Terre 365,26 j
  (vraie 365,256 j), Lune 27,34 j (vraie 27,322 j), ISS 92,9 min, comète 671,0 j ; énergie et moment cinétique
  conservés à 10⁻¹⁴ près. Vérifié par une intégration indépendante sous SageMath (DOP853, tolérance 10⁻¹³) : mêmes
  périodes à 2 × 10⁻⁶ près.
- **Réglages** : flèches de force de gravité (bleues) et de vitesse (vertes), trajectoires, grille avec la taille du
  carreau, ruban de mesure (vraie distance), gravité coupable (chaque corps file tout droit), masses du Soleil, de la
  Terre et de la Lune (0,5 à 2), « Lune vue du Soleil » ; boutons Pas, Retour (positions et vitesses du dernier
  départ), Effacer les trajectoires ; temps en jours terrestres.
- **Souris et doigt** : glisser un astre (ses satellites le suivent ; le temps est suspendu pendant la saisie), tirer
  le bout d’une flèche verte pour changer la vitesse, glisser les bouts du ruban ; toujours actif, sans focus préalable.
- **Lune vue du Soleil** : encart en vraie géométrie (60 derniers jours : la Lune suit la Terre sans jamais faire de
  boucle) et courbe du rapport des courbures Lune / Terre, toujours positif (0,49 à 1,41) : la trajectoire de la Lune
  est toujours tournée vers le Soleil, qui la tire 2,2 fois plus fort que la Terre.
- **Valeurs** : distances (ua et millions de km, ou km), vitesses relatives (km·s⁻¹), périodes mesurées comparées aux
  vraies (ou à Kepler pour l’ISS et la comète), énergie totale et sa variation, moment cinétique, ruban, courbure.
- Thème « Renaissance » et module « L’astronomie de la Renaissance » ; la recherche « gravity and orbits » ou
  « gravité et orbites » la donne en premier ; « Ce qu’il faut voir » ; à propos, NOTICE. Une image : 0,9 à 2,5 ms
  (Chromium, Firefox, WebKit, bureau et tablette).
- Tests : mécanique au bit près comme le bureau (cas communs), périodes à 0,5 % des vraies, conservation sur dix ans à
  vitesse ×10, chute libre, mouvement rectiligne sans gravité, accord avec SageMath ; animation (glisser, flèche,
  ruban, vues, valeurs, durée d’une image < 5 ms) ; Playwright 3 moteurs × 3 formats (recherche, module, glisser à la
  souris et au doigt, lecture, période, vue à l’échelle, repos).

## 0.6.0 — 2026-10-15

Recherche bilingue, favoris, bibliothèque, installation de l’application ; « Maintenant » et « En direct » ; ombres
d’éclipse en vraie géométrie.

- **Recherche bilingue** : quelle que soit la langue de l’interface, une recherche en anglais ou en français trouve le
  contenu (modules, animations, questions, fiches, tables, images), affiché dans la langue de l’interface (« seasons »
  → « Simulateur des saisons » ; « Kepler’s third law » → « Troisième loi de Kepler », « Les lois de Kepler »). Index
  commun FR + EN (titres, mots-clés, textes, titres d’origine de ClassAction) ; insensible aux accents, à la casse, aux
  pluriels simples et aux petites fautes (distance d’édition 1 ou 2 selon la longueur) ; classement titre > mots-clés >
  texte ; mots trouvés surlignés ; titre de l’autre langue quand c’est lui qui correspond ; résultats groupés par type.
  Même moteur, ligne pour ligne, que Coupole (bureau), avec des cas de référence communs (dont les 8 premiers
  résultats de 97 recherches sur les vrais contenus). Le catalogue des animations s’en sert aussi.
- **Favoris** : une étoile sur tout atelier (module, animation, question, fiche, table, image) dans les listes, les
  fenêtres et les pages ; section « Mes favoris » sur l’accueil, page « Favoris » (groupés par type, filtre, tri),
  filtre « favoris seulement » dans le catalogue, la bibliothèque et la recherche ; bascule accessible au clavier
  (aria-pressed). Enregistrés dans la sauvegarde commune, **format version 2** (une version 1 se lit telle quelle ;
  export / import web ⇄ bureau ; réinitialisation partielle « tous les favoris »).
- **« Mes modules » devient « Collections »**, au second plan : un bouton discret « Organiser en collections… » dans
  « Mes favoris » ; la navigation propose « Favoris ». Les modules personnels existants sont repris tels quels.
- **Bibliothèque** : la présentation d’origine de ClassAction ; onglets Questions, Animations, Fiches, Tables, Images
  montrant tout le contenu du type, rangé par module dans l’ordre d’origine, avec vignettes (animations dessinées par
  elles-mêmes, photos et schémas), aperçu au survol, filtres par module et « favoris seulement » ; une carte de
  l’accueil y mène (« Tout le contenu, comme dans ClassAction »).
- **Installer l’application** : proposée discrètement après un premier usage (2ᵉ visite ou 30 s), jamais si elle est
  déjà installée ; Chrome, Edge, Opera, Samsung Internet : invite du navigateur captée et déclenchée par « Installer »
  (bannière et bouton de l’en-tête) ; iPhone et iPad (y compris l’iPad qui se présente comme un Mac) : fiche illustrée
  « Partager → Sur l’écran d’accueil » ; Safari 17+ sur Mac : « Fichier → Ajouter au Dock » ; Firefox Android : menu ⋮ ;
  Firefox sur ordinateur : expliqué ; « Plus tard » (30 jours) et « Ne plus proposer » ; page « Installer
  l’application » dans « À propos ». Manifeste complété (captures larges et étroites, raccourcis) pour la boîte
  d’installation riche de Chrome.
- **« Maintenant » et « En direct »** dans les 19 animations qui dépendent de la date ou de l’heure : instant de
  l’appareil (temps universel absolu), affiché dans son fuseau (« 09:20 heure de Paris (UTC+2) · 07:20 TU ») ; aucune
  erreur de fuseau ni d’heure d’été (heure solaire au méridien du fuseau, ou à la longitude de « Ma position »,
  géolocalisation demandée seulement par le bouton) ; « En direct » met l’heure à jour sans rendu continu et s’arrête
  dès qu’on touche la date. Testé en fuseaux émulés (changement d’heure du 25 octobre 2026, Auckland +13, St. John’s
  −2:30, Katmandou +5:45, jour de l’an).
- **Simulateur des ombres d’éclipse** : le type d’éclipse est calculé en vraie géométrie (tailles réelles, distance de
  la Lune telle que placée) : en approchant la Lune, aucune → partielle → annulaire → totale ; largeur de la bande,
  distance comparée au périgée et à l’apogée extrêmes (DE440, 1900–2100) ; cônes d’ombre, d’antombre et de pénombre
  de la Lune dessinés ; vue 3D de l’orbite inclinée de 5,1°, de la ligne des nœuds et du décalage de la Lune ; les
  éclipses rejouées replacent la Lune dans toutes les vues avec leur géométrie réelle (JPL DE440 : distance, gamma,
  trajectoire) ; les 133 éclipses de la table retrouvent leur type.
- **Chaîne proton-proton, cycle CNO** : neutrino écrit νₑ (lettre grecque), particules légères reconnaissables et
  agrandies (positon marqué « + », neutrino en flèche pointillée, photon γ en flèche ondulée), étiquettes à taille
  normale placées sans chevauchement, légende des symboles, réaction centrée et agrandie.
- **Glisser toujours actif** sur les toiles (globe du simulateur jour-nuit compris) : un pointeur resté en mémoire
  (geste avalé par le système, doigt jamais relâché) ne bloque plus la rotation ; après un réglage fait au doigt, le
  réglage rend le focus pour que le toucher suivant sur la toile ne serve pas qu’à le fermer (iPad).
- Correctifs : une sauvegarde faite dans la même seconde que la précédente n’était pas reprise au rechargement (copie
  de secours ignorée à égalité de date) ; le bouton « Maintenant » de l’horloge de la Grande Ourse prenait l’heure
  d’été pour l’heure solaire ; ouvrir une animation juste après le catalogue pouvait laisser le catalogue affiché (sa
  réécriture d’adresse différée écrasait celle de l’animation) ; l’adresse partagée du simulateur d’ombres (éclipse
  rejouée, position sur l’orbite) ne replaçait pas la Lune ; audit : adresse partageable lue avant sa réécriture
  (WebKit).

## 0.5.0 — 2026-10-14

Passe finale : design, audit complet, accessibilité, confidentialité.

- **Téléphone : barre de navigation en bas** (Modules, Catalogue, Mes modules, Progression, À propos), libellés
  visibles, à portée du pouce ; plus aucun débordement de l’en-tête à 320 px. Très grands écrans : l’en-tête s’aligne
  sur la colonne du contenu, texte un peu plus grand en 4K.
- **Fiches, tables et images** dans une colonne de lecture centrée, en-tête aligné sur le contenu ; figures des
  questions limitées en largeur sur grand écran ; tableau « Ma progression » allégé sur téléphone.
- **Figures des questions lisibles dans les deux thèmes** : un texte posé sur une surface sombre (ou claire) prend
  automatiquement la couleur de texte la plus contrastée (au moins 3:1, vérifié pour toutes les variantes des 517
  questions, thèmes sombre et clair, réponse montrée ou non) ; la bonne réponse orange reçoit un liseré quand le fond
  est trop proche (ex. « Échelle » en thème clair, illisible jusque-là).
- **États soignés** : page « Introuvable » ou « Hors ligne » (selon la connexion) avec retour à l’accueil, au lieu
  d’un simple message ; listes vides encadrées ; indicateur de chargement ; apparition sobre des pages (désactivée si
  le mouvement est réduit) ; plus de cadre de focus parasite autour de la page après un changement de page.
- **Catalogue** : titre propre (« Animations interactives ») ; accueil : « 1 table », « 1 image » au singulier (et
  « 1 résultat », « 1 réglage », « 1 élément »).
- **Adresses partageables fidèles** (défauts trouvés par le nouveau balayage : 41 animations sur 94 ne redonnaient pas
  exactement les mêmes valeurs) : un curseur prend la valeur affichée dans son champ (plus de valeur cachée plus fine
  que l’affichage ; une flèche du clavier avance toujours d’au moins une unité du champ), une valeur fixée plus finement par un préréglage (période de Mercure, système d’exoplanète) passe
  telle quelle dans l’adresse et la mémoire ; l’adresse d’une animation quittée n’écrase plus celle de la page
  suivante ; un réglage changé juste avant de quitter la page est gardé (il était perdu dans les 0,35 s).
- **Ouverture plus rapide d’une animation** : page, textes et code chargés en parallèle, titre affiché tout de suite ;
  cadrans de la machine d’Anticythère construits progressivement (plus de longue tâche à l’ouverture). Lighthouse
  mobile : Anticythère 86 → 95, Orion en 3D 94 → 96 ; accueil 99, module et question 97 ; bureau 100.
- Icône « Exporter ou importer » cohérente ; lien de la marque nommé « accueil » ; « À propos » présente les modules.
- **Contenus** : corrections de la banque de questions recopiées (8 modules : Renaissance, propriétés stellaires,
  évolution, galaxies, Soleil, exoplanètes, planètes géantes, petits corps).
- **Audit** : nouveaux tests de bout en bout — les 517 questions (toutes les options de chaque menu, réponse, indice,
  explication, validation, score enregistré), chaque réglage des 94 animations et l’adresse partageable, toutes les
  fiches, tables et images, sauvegarde export → réinitialisation → import identique, langue changée en cours de route,
  hors ligne, aucun rendu au repos ; **axe-core** (WCAG 2.2 AA, contraste compris) sur chaque type de page dans les
  deux thèmes et navigation au clavier, sur Chromium, Firefox et WebKit.
- **Confidentialité** : garde-fou à empreintes salées commun aux dépôts publics (exécuté en intégration continue).

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

### 0.6.1 — 2026-10-15

New animation **“Gravity and Orbits”** (the 95th), after the PhET simulation “Gravity and Orbits” of the PhET
Interactive Simulations project at the University of Colorado Boulder: idea and features taken up, code, drawings and
texts are Coupole’s own (no part of PhET is copied).

- **Scenarios**: Sun and Earth; Sun, Earth and Moon; Earth and Moon; Earth and space station (ISS); free (Sun, Earth,
  Moon and a comet with a 2.4 au aphelion). The Sun, the Earth and the Moon together start from their **real positions
  and velocities on 1 January 2026** (DE440 ephemeris, each orbit brought into the ecliptic about its line of nodes): a
  Moon launched on a Keplerian circle would, in the Sun’s tidal field, take an orbit with a period of 27.05 to 27.81 d
  depending on the starting phase.
- **Two views**: “Model” (bodies enlarged, Earth–Moon distance enlarged 78 times, ratios written on the canvas) and “To
  scale” (true sizes and distances: seen from the Sun, the Earth and the Moon are a single dot, circled by a faint
  ring), with a smooth transition between them (radii and gap interpolated on a log scale); no further frame once
  there.
- **Mechanics**: N bodies, **4th-order Yoshida** symplectic scheme (composed velocity Verlet), adaptive step (1 % of the
  dynamical time of the tightest pair); official constants (G CODATA 2018, nominal GM☉ and GM⊕ IAU 2015, GM☾ DE440,
  radii IAU 2015 and NASA, au IAU 2012, ISS NASA); collisions (the lighter body crashes, momentum kept). Measured
  periods (passages through the starting direction, interpolated instant): Earth 365.26 d (true 365.256 d), Moon
  27.34 d (true 27.322 d), ISS 92.9 min, comet 671.0 d; energy and angular momentum conserved to 10⁻¹⁴. Checked by an
  independent SageMath integration (DOP853, tolerance 10⁻¹³): same periods to 2 × 10⁻⁶.
- **Settings**: gravity force (blue) and velocity (green) arrows, paths, grid with the square size, measuring tape
  (real distance), gravity on/off (each body moves off in a straight line), masses of the Sun, the Earth and the Moon
  (0.5 to 2), “Moon seen from the Sun”; Step, Rewind (positions and velocities of the last start), Clear paths buttons;
  time in Earth days.
- **Mouse and finger**: drag a body (its satellites follow; time is paused while holding it), pull the tip of a green
  arrow to change the velocity, drag the ends of the tape; always active, no prior focus needed.
- **Moon seen from the Sun**: true-geometry inset (last 60 days: the Moon follows the Earth and never loops) and the
  Moon / Earth curvature ratio curve, always positive (0.49 to 1.41): the Moon’s path always curves towards the Sun,
  which pulls it 2.2 times harder than the Earth does.
- **Values**: distances (au and million km, or km), relative speeds (km·s⁻¹), measured periods compared with the true
  ones (or with Kepler for the ISS and the comet), total energy and its change, angular momentum, tape, curvature.
- “Renaissance” theme and “Renaissance Astronomy” module; searching “gravity and orbits” or “gravité et orbites” gives
  it first; “What to see”; about page, NOTICE. One frame: 0.9 to 2.5 ms (Chromium, Firefox, WebKit, desktop and tablet).
- Tests: mechanics bit-identical to the desktop (shared cases), periods within 0.5 % of the true ones, conservation over
  ten years at ×10 speed, free fall, straight-line motion without gravity, agreement with SageMath; animation (drag,
  arrow, tape, views, values, frame time < 5 ms); Playwright 3 engines × 3 formats (search, module, mouse and finger
  drag, playback, period, to-scale view, idle).

### 0.6.0 — 2026-10-15

Bilingual search, favourites, library, app installation; “Now” and “Live”; eclipse shadows in true geometry.

- **Bilingual search**: whatever the interface language, a search in English or in French finds the content (modules,
  animations, questions, outlines, tables, images), shown in the interface language (“saisons” → “Seasons Simulator”).
  Shared FR + EN index (titles, keywords, texts, original ClassAction titles); insensitive to accents, case, simple
  plurals and small typos (edit distance 1 or 2 depending on length); ranking title > keywords > text; matches
  highlighted; the other language’s title when that is what matches; results grouped by type. Same engine, line for
  line, as Coupole (desktop), with shared reference cases.
- **Favourites**: a star on every item (module, animation, question, outline, table, image) in lists, windows and
  pages; “My favourites” on the home page, a Favourites page (grouped by type, filter, sort), “favourites only” filter
  in the catalogue, library and search; keyboard-accessible toggle (aria-pressed). Saved in the shared backup, **format
  version 2** (version 1 read as is; web ⇄ desktop export/import; partial reset “all favourites”).
- **“My modules” becomes “Collections”**, in the background: an “Organise into collections…” button in “My
  favourites”; the navigation offers “Favourites”. Existing personal modules are kept as they are.
- **Library**: ClassAction’s original presentation; Questions, Animations, Outlines, Tables, Images tabs showing all
  the content of the type, grouped by module in the original order, with thumbnails, hover preview, module and
  “favourites only” filters; a home-page card leads to it.
- **Install the app**: offered discreetly after a first use (2nd visit or 30 s), never when already installed; Chrome,
  Edge, Opera, Samsung Internet: browser prompt captured and triggered by “Install” (banner and header button); iPhone
  and iPad (including iPad presenting itself as a Mac): illustrated “Share → Add to Home Screen” sheet; Safari 17+ on
  Mac: “File → Add to Dock”; Firefox Android: ⋮ menu; Firefox desktop: explained; “Later” (30 days) and “Don’t ask
  again”; “Install the app” section in About. Manifest completed (wide and narrow screenshots, shortcuts).
- **“Now” and “Live”** in the 19 date- or time-dependent animations: the device’s instant (absolute universal time),
  shown in its time zone; no time zone or daylight-saving error; “Live” updates the time without continuous rendering
  and stops as soon as the date is touched; “My location” only on request. Tested with emulated time zones.
- **Eclipse Shadow Simulator**: eclipse type computed in true geometry (real sizes, Moon’s distance as placed): none →
  partial → annular → total as the Moon comes closer; path width; distance compared with the extreme perigee and
  apogee (DE440, 1900–2100); the Moon’s umbra, antumbra and penumbra cones drawn; 3D view of the 5.1°-tilted orbit,
  line of nodes and Moon offset; replayed eclipses place the Moon in all views with their real geometry (JPL DE440);
  the 133 table eclipses get their type back.
- **Proton-proton chain, CNO cycle**: neutrino written νₑ (Greek letter), recognisable enlarged light particles,
  normal-size labels placed without overlap, symbol legend, centred and enlarged reaction.
- **Dragging always works** on the canvases (day-night globe included), even after a lost pointer or a setting changed
  by touch (iPad).
- Fixes: a save made in the same second as the previous one was not restored on reload; the Big Dipper clock’s “Now”
  took daylight-saving time for solar time; opening an animation right after the catalogue could leave the catalogue
  on screen (its delayed address rewrite overwrote the animation’s); the Shadow Simulator’s shared address (replayed
  eclipse, orbit position) did not place the Moon; audit: shareable address read before being rewritten (WebKit).

### 0.5.0 — 2026-10-14

Final pass: design, full audit, accessibility, privacy.

- **Phone: bottom navigation bar** (Modules, Catalogue, My modules, Progress, About) with visible labels, within thumb
  reach; the header no longer overflows at 320 px. Very large screens: the header lines up with the content column,
  slightly larger text in 4K.
- **Outlines, tables and images** in a centred reading column with the header aligned on the content; question
  figures capped in width on large screens; lighter “My progress” table on phones.
- **Question figures readable in both themes**: text placed on a dark (or light) surface automatically takes the most
  contrasting text colour (at least 3:1, checked for every variant of the 517 questions, dark and light themes, answer
  shown or not); the orange correct answer gets an outline when the background is too close (e.g. “Scale” in the light
  theme, unreadable until now).
- **Polished states**: “Not found” or “Offline” page (depending on the connection) with a way back home instead of a
  bare message; framed empty lists; loading indicator; subtle page entrance (off when reduced motion is requested); no
  more stray focus frame around the page after navigating.
- **Catalogue**: its own title (“Interactive animations”); home: “1 table”, “1 image” in the singular (and “1 result”,
  “1 setting”, “1 item”).
- **Faithful shareable addresses** (defects found by the new sweep: 41 of the 94 animations did not give back exactly
  the same values): a slider takes the value shown in its field (no hidden value finer than the display; an arrow key
  always moves by at least one unit of the field), a value set
  more finely by a preset (Mercury’s period, an exoplanet system) goes as is into the address and the memory; the
  address of an animation being left no longer overwrites the next page’s; a setting changed just before leaving the
  page is kept (it was lost within 0.35 s).
- **Faster opening of an animation**: page, texts and code loaded in parallel, title shown at once; Antikythera dials
  built progressively (no long task on opening). Lighthouse mobile: Antikythera 86 → 95, Orion in 3D 94 → 96; home 99,
  module and question 97; desktop 100.
- Consistent “Export or import” icon; brand link named “home”; “About” presents the modules.
- **Content**: question bank corrections copied in (8 modules: Renaissance, stellar properties, evolution, galaxies,
  Sun, exoplanets, giant planets, small bodies).
- **Audit**: new end-to-end tests — all 517 questions (every option of every menu, answer, hint, explanation,
  validation, saved score), every setting of the 94 animations and the shareable address, every outline, table and
  image, backup export → reset → import identical, language switched midway, offline, no rendering at rest;
  **axe-core** (WCAG 2.2 AA, contrast included) on every page type in both themes and keyboard navigation, on
  Chromium, Firefox and WebKit.
- **Privacy**: salted-hash safeguard shared by the public repositories (run in continuous integration).

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
