/**
 * « Ce qu'il faut voir », suite : les animations qui ne font pas partie du premier lot (FR, EN).
 * Texte propre à Coupole Web.
 */
export const A_VOIR_SUITE: Record<string, [string, string]> = {
  // ------------------------------------------------------------------ coordonnées et mouvements
  daylighthoursexplorer: [
    'À l’équateur, le jour dure toujours 12 h ; plus on s’éloigne de l’équateur, plus l’écart entre l’été et l’hiver se creuse. Aux équinoxes, le jour dure 12 h partout. Au-delà des cercles polaires, la courbe touche 0 h et 24 h : nuit polaire et soleil de minuit. Sur le globe, comparez l’arc de jour et l’arc de nuit du parallèle de l’observateur.',
    'At the equator the day always lasts 12 h; the farther from the equator, the wider the gap between summer and winter. At the equinoxes the day lasts 12 h everywhere. Beyond the polar circles the curve reaches 0 h and 24 h: polar night and midnight sun. On the globe, compare the day arc and the night arc of the observer’s parallel.',
  ],
  meridaltdiagram: [
    'L’équateur céleste culmine toujours à 90° moins la latitude ; un astre passe au méridien d’autant plus haut que sa déclinaison est grande. Le Soleil oscille de ±23,44° autour de l’équateur : à Paris (48,9° N), il culmine à environ 64,5° au solstice d’été et 17,7° au solstice d’hiver. Entre les tropiques, il peut passer au nord du zénith.',
    'The celestial equator always culminates at 90° minus the latitude; an object crosses the meridian the higher, the greater its declination. The Sun swings ±23.44° around the equator: in Paris (48.9° N) it culminates at about 64.5° at the June solstice and 17.7° at the December solstice. Between the tropics it can pass north of the zenith.',
  ],
  sunpaths: [
    'Chaque jour, le Soleil décrit un cercle parallèle à l’équateur céleste. Aux équinoxes, il se lève plein est, se couche plein ouest et reste 12 h au-dessus de l’horizon. En été (hémisphère nord), il se lève au nord-est, monte plus haut et reste plus longtemps ; en hiver, il se lève au sud-est et sa course est courte et basse.',
    'Each day the Sun traces a circle parallel to the celestial equator. At the equinoxes it rises due east, sets due west and stays 12 h above the horizon. In summer (northern hemisphere) it rises in the north-east, climbs higher and stays up longer; in winter it rises in the south-east and its path is short and low.',
  ],
  sunmotionsoverview: [
    'Suivez la construction étape par étape : l’axe des pôles pointe vers le pôle céleste, à une hauteur égale à la latitude ; l’équateur céleste lui est perpendiculaire. Les trajets des équinoxes et des solstices sont des cercles parallèles à l’équateur, décalés de ±23,44°. Changez la latitude : tout le dispositif s’incline.',
    'Follow the construction step by step: the polar axis points to the celestial pole, at an altitude equal to the latitude; the celestial equator is perpendicular to it. The equinox and solstice paths are circles parallel to the equator, shifted by ±23.44°. Change the latitude: the whole set-up tilts.',
  ],
  horizon: [
    'Le point de lever va et vient le long de l’horizon au fil de l’année : il atteint ses positions extrêmes aux solstices, où il semble s’arrêter quelques jours (« solstice » veut dire « Soleil arrêté »), et passe plein est aux équinoxes, où il se déplace le plus vite. Plus la latitude est grande, plus l’amplitude est large.',
    'The sunrise point moves back and forth along the horizon over the year: it reaches its extreme positions at the solstices, where it seems to stop for a few days (“solstice” means “Sun standing still”), and passes due east at the equinoxes, where it moves fastest. The higher the latitude, the wider the swing.',
  ],
  daylightsimulator: [
    'La zone éclairée glisse vers l’ouest de 15° par heure : c’est la rotation de la Terre. Au fil de l’année, sa forme change : aux équinoxes le terminateur suit les méridiens et passe par les pôles ; aux solstices, il dégage une calotte de jour permanent autour d’un pôle et de nuit permanente autour de l’autre. Le point subsolaire reste entre les tropiques.',
    'The lit area slides west by 15° per hour: this is the Earth’s rotation. Over the year its shape changes: at the equinoxes the terminator follows meridians and runs through the poles; at the solstices it leaves a cap of permanent day around one pole and permanent night around the other. The subsolar point stays between the tropics.',
  ],
  antipodesexplorer: [
    'L’antipode a la latitude opposée et une longitude décalée de 180° : quand il est midi en un point, il est minuit à son antipode, et les saisons y sont inversées. Promenez le point : la plupart des terres ont leur antipode dans l’océan ; l’Espagne et la Nouvelle-Zélande font partie des rares exceptions.',
    'The antipode has the opposite latitude and a longitude shifted by 180°: when it is noon at a point it is midnight at its antipode, and the seasons are reversed there. Move the point around: most land has its antipode in the ocean; Spain and New Zealand are among the rare exceptions.',
  ],
  bigdipper: [
    'Vue de la Terre, la Grande Ourse forme une casserole familière ; tournez la vue et elle se défait : ses étoiles sont entre 81 et 123 années-lumière de nous (Dubhe la plus loin, Megrez la plus proche). Une constellation n’est qu’un effet de perspective sur la sphère céleste ; vue d’une autre étoile, la figure serait méconnaissable.',
    'Seen from the Earth, the Big Dipper forms a familiar saucepan; rotate the view and it falls apart: its stars lie between 81 and 123 light-years away (Dubhe the farthest, Megrez the closest). A constellation is only a perspective effect on the celestial sphere; seen from another star, the figure would be unrecognisable.',
  ],
  celestialhorizon: [
    'C’est la même sphère dans les deux vues : seul l’axe choisi pour « en haut » change. En repère céleste, le pôle est en haut et l’horizon s’incline de 90° moins la latitude ; en repère local, le zénith est en haut. Basculez et suivez l’équateur, l’horizon et le pôle : la hauteur du pôle vaut toujours la latitude.',
    'Both views show the same sphere: only the axis chosen as “up” changes. In the celestial frame the pole is up and the horizon tilts by 90° minus the latitude; in the local frame the zenith is up. Switch views and follow the equator, the horizon and the pole: the altitude of the pole always equals the latitude.',
  ],
  // ------------------------------------------------------------------ cycles lunaires
  lunar_phaser: [
    'Le nom de la phase suit l’âge de la Lune : croissant, premier quartier, gibbeuse, pleine lune, puis la même chose à l’envers jusqu’à la nouvelle lune. Dans l’hémisphère nord, la partie éclairée croît par la droite et décroît par la gauche. Une lunaison complète dure 29,53 jours.',
    'The phase name follows the Moon’s age: crescent, first quarter, gibbous, full Moon, then the same in reverse until new Moon. In the northern hemisphere the lit part grows from the right and shrinks from the left. A complete lunation lasts 29.53 days.',
  ],
  basketball: [
    'Le ballon est toujours éclairé à moitié par la lampe ; seule change la part de cette moitié que voit l’œil. Placez l’œil près de la lampe : ballon « plein » ; à l’opposé : « nouveau » ; de côté : un quartier. La fraction éclairée vaut (1 + cos i) / 2, où i est l’angle lampe–ballon–œil.',
    'The ball is always half lit by the lamp; only the share of that half seen by the eye changes. Put the eye next to the lamp: a “full” ball; opposite: a “new” one; to the side: a quarter. The lit fraction is (1 + cos i) / 2, where i is the lamp–ball–eye angle.',
  ],
  moonphases: [
    'Le même instant vu de trois endroits donne trois phases différentes : depuis le Soleil, la Lune est toujours pleine ; depuis la Terre, sa phase dépend de sa place sur l’orbite. La phase n’est donc pas une ombre de la Terre, mais un effet de point de vue sur une sphère à moitié éclairée.',
    'The same moment seen from three places gives three different phases: from the Sun the Moon is always full; from the Earth its phase depends on its place on the orbit. So the phase is not the Earth’s shadow but a viewpoint effect on a half-lit sphere.',
  ],
  phaseDemonstrator: [
    'Chaque corps voit l’autre avec une phase qui ne dépend que de l’angle Soleil–cible–observateur. Placez les deux corps alignés avec le Soleil : l’un voit l’autre plein, l’autre le voit nouveau. Les phases vues depuis chaque corps sont « complémentaires » : quand la Lune est en croissant vue de la Terre, la Terre est gibbeuse vue de la Lune.',
    'Each body sees the other with a phase that depends only on the Sun–target–observer angle. Line both bodies up with the Sun: one sees the other full, the other sees it new. The phases seen from each body are “complementary”: when the Moon is a crescent seen from the Earth, the Earth is gibbous seen from the Moon.',
  ],
  positionsdemonstrator: [
    'La place du Soleil donne l’heure, l’écart entre le Soleil et la Lune donne la phase. La pleine lune, à l’opposé du Soleil, se lève au coucher du Soleil et culmine à minuit ; le premier quartier culmine vers 18 h ; le dernier quartier vers 6 h ; la nouvelle lune accompagne le Soleil et reste invisible.',
    'The Sun’s position gives the time, the gap between Sun and Moon gives the phase. The full Moon, opposite the Sun, rises at sunset and culminates at midnight; the first quarter culminates around 6 pm; the last quarter around 6 am; the new Moon travels with the Sun and stays invisible.',
  ],
  lunarphasequizzer: [
    'Le questionnaire vérifie qu’on sait passer d’une description à l’autre : position sur l’orbite, aspect vu de la Terre et direction du Soleil sont liés. Repère utile : le côté éclairé de la Lune pointe toujours vers le Soleil. Plusieurs réponses peuvent donner la même phase nommée.',
    'The quiz checks that you can go from one description to another: position on the orbit, appearance from the Earth and direction of the Sun are linked. A useful landmark: the lit side of the Moon always points toward the Sun. Several answers can give the same named phase.',
  ],
  moonbisector: [
    'Deux plans suffisent : l’un sépare le jour et la nuit sur la Lune, l’autre la moitié visible de la moitié cachée. La partie vue et éclairée est le quartier de sphère compris entre les deux plans ; l’angle entre les plans est l’angle de phase. Les plans confondus donnent la pleine lune, opposés la nouvelle lune.',
    'Two planes are enough: one separates day and night on the Moon, the other the visible half from the hidden half. The lit part we see is the wedge of sphere between the two planes; the angle between the planes is the phase angle. Coinciding planes give a full Moon, opposite ones a new Moon.',
  ],
  fullmoondec: [
    'La pleine lune est à l’opposé du Soleil, donc sa déclinaison est presque l’inverse de celle du Soleil. En hiver, quand le Soleil est bas, la pleine lune monte haut et reste longtemps dans le ciel de la nuit ; en été, elle reste basse et sa course est courte. L’écart de ±5,1° vient de l’inclinaison de l’orbite lunaire.',
    'The full Moon is opposite the Sun, so its declination is almost the reverse of the Sun’s. In winter, when the Sun is low, the full Moon climbs high and stays up most of the night; in summer it stays low and its path is short. The ±5.1° spread comes from the inclination of the lunar orbit.',
  ],
  synodiclag: [
    'Après un tour complet par rapport aux étoiles, la Terre a avancé sur son orbite : il lui faut encore tourner d’environ 1° pour retrouver le Soleil au méridien. D’où un jour solaire (24 h) plus long que le jour sidéral (23 h 56 min 4 s) d’environ 4 minutes. Ralentissez la rotation pour voir l’écart grandir.',
    'After one full turn relative to the stars, the Earth has moved along its orbit: it must still turn about 1° to bring the Sun back to the meridian. Hence a solar day (24 h) longer than the sidereal day (23 h 56 min 4 s) by about 4 minutes. Slow the rotation down to see the gap grow.',
  ],
  tidesim: [
    'Il y a deux bourrelets, l’un tourné vers la Lune et l’autre à l’opposé : la marée vient de la différence d’attraction d’un côté à l’autre de la Terre. La Terre tourne sous ces bourrelets, d’où deux marées hautes par jour lunaire (24 h 50 min). Soleil et Lune alignés : vives-eaux ; à angle droit : mortes-eaux. L’effet du Soleil vaut environ 46 % de celui de la Lune.',
    'There are two bulges, one facing the Moon and one opposite: the tide comes from the difference in pull from one side of the Earth to the other. The Earth turns under these bulges, hence two high tides per lunar day (24 h 50 min). Sun and Moon aligned: spring tides; at right angles: neap tides. The Sun’s effect is about 46 % of the Moon’s.',
  ],
  mooninc: [
    'Comme l’orbite de la Lune est inclinée de 5,1°, la Lune passe le plus souvent au-dessus ou au-dessous de l’ombre de la Terre, et son ombre manque la Terre. Il n’y a d’éclipse que si la nouvelle ou la pleine lune tombe quand le Soleil est près de la ligne des nœuds : deux saisons d’éclipses par an environ.',
    'Because the Moon’s orbit is tilted by 5.1°, the Moon usually passes above or below the Earth’s shadow, and its own shadow misses the Earth. An eclipse only happens if new or full Moon falls when the Sun is near the line of nodes: about two eclipse seasons per year.',
  ],
  eclipsetable: [
    'Les éclipses ne tombent pas au hasard : elles se groupent en saisons, tous les 173,3 jours environ (une demi-année draconitique). D’une année à l’autre, ces saisons avancent d’environ 19 jours dans le calendrier, d’où les bandes obliques. Éclipses de Soleil et de Lune se suivent souvent à deux semaines d’écart.',
    'Eclipses do not fall at random: they cluster in seasons, about every 173.3 days (half a draconic year). From one year to the next these seasons move about 19 days earlier in the calendar, hence the slanted bands. Solar and lunar eclipses often follow each other two weeks apart.',
  ],
  // ------------------------------------------------------------------ Renaissance
  venusphases: [
    'Dans le système de Copernic, Vénus montre toutes les phases : pleine et petite quand elle est derrière le Soleil, en grand croissant quand elle passe près de la Terre. Ses dimensions apparentes varient de 10″ à 60″ environ. C’est ce que Galilée a observé en 1610, une preuve que Vénus tourne autour du Soleil.',
    'In the Copernican system Venus shows every phase: full and small when it is behind the Sun, a large crescent when it passes close to the Earth. Its apparent size varies from about 10″ to 60″. This is what Galileo observed in 1610, a proof that Venus orbits the Sun.',
  ],
  ptolemaic: [
    'Dans le système de Ptolémée, l’épicycle de Vénus reste toujours entre la Terre et le Soleil : on ne la verrait jamais qu’en croissant, jamais pleine ni gibbeuse. Comparez avec la version copernicienne : les phases gibbeuses observées par Galilée suffisent à réfuter ce modèle.',
    'In the Ptolemaic system the epicycle of Venus always stays between the Earth and the Sun: we would only ever see it as a crescent, never full or gibbous. Compare with the Copernican version: the gibbous phases Galileo observed are enough to refute this model.',
  ],
  configurationssimulator: [
    'Les configurations reviennent après une période synodique, et non après une période sidérale. Pour une planète supérieure : conjonction, quadrature, opposition (au plus près, au plus brillant), quadrature. Pour une planète inférieure : conjonctions inférieure et supérieure, et plus grandes élongations, limitées à 46° environ pour Vénus et 28° pour Mercure.',
    'Configurations recur after one synodic period, not one sidereal period. For a superior planet: conjunction, quadrature, opposition (closest and brightest), quadrature. For an inferior planet: inferior and superior conjunctions, and greatest elongations, limited to about 46° for Venus and 28° for Mercury.',
  ],
  synodiccalculator: [
    'Les deux planètes se rattrapent comme les aiguilles d’une horloge : la période synodique est le temps qu’il faut à la plus rapide pour prendre un tour d’avance. Une planète dont la période est proche d’un an a une très longue période synodique ; Mars revient en opposition tous les 780 jours, Jupiter tous les 399 jours.',
    'The two planets catch each other up like the hands of a clock: the synodic period is the time the faster one needs to gain a full lap. A planet with a period close to one year has a very long synodic period; Mars returns to opposition every 780 days, Jupiter every 399 days.',
  ],
  keplers_third: [
    'Sur le graphique logarithmique, toutes les planètes tombent sur une même droite de pente 3/2 : P² = a³. Doublez le demi-grand axe et la période est multipliée par 2,83. Changez la masse de l’étoile : la droite se décale, car une étoile plus massive fait tourner ses planètes plus vite.',
    'On the logarithmic plot all the planets fall on the same line of slope 3/2: P² = a³. Double the semi-major axis and the period is multiplied by 2.83. Change the star’s mass: the line shifts, because a more massive star makes its planets go round faster.',
  ],
  ellipsedemo: [
    'L’excentricité mesure l’écart des foyers au centre : e = 0 donne un cercle, e proche de 1 une ellipse très allongée. Suivez le point : la somme de ses distances aux deux foyers reste égale à 2a. L’orbite de la Terre (e = 0,017) est presque indiscernable d’un cercle, celle de la comète de Halley (e = 0,97) très étirée.',
    'Eccentricity measures how far the foci are from the centre: e = 0 gives a circle, e close to 1 a very elongated ellipse. Follow the point: the sum of its distances to the two foci stays equal to 2a. The Earth’s orbit (e = 0.017) is almost indistinguishable from a circle, Halley’s Comet’s (e = 0.97) very stretched.',
  ],
  gravalgebra: [
    'La force est proportionnelle à chaque masse et inversement proportionnelle au carré de la distance. Doubler une masse double la force ; doubler la distance la divise par 4 ; tripler la distance la divise par 9. Combinez les facteurs : la force est multipliée par a × b / c².',
    'The force is proportional to each mass and inversely proportional to the square of the distance. Doubling a mass doubles the force; doubling the distance divides it by 4; tripling the distance divides it by 9. Combine the factors: the force is multiplied by a × b / c².',
  ],
  gravcalc: [
    'La gravitation est toujours attractive mais très faible : entre deux personnes à un mètre, elle est minuscule ; il faut des masses de planètes pour qu’elle domine. La force est la même sur les deux corps, mais l’accélération a = F / M est bien plus grande pour le plus léger : c’est la pomme qui tombe, pas la Terre.',
    'Gravity is always attractive but very weak: between two people one metre apart it is tiny; planetary masses are needed for it to dominate. The force is the same on both bodies, but the acceleration a = F / M is much larger for the lighter one: the apple falls, not the Earth.',
  ],
  earthorbitplot: [
    'Plus un satellite est loin, plus il va lentement et plus sa période est longue. Au ras du sol, un tour dure environ 1 h 25 min ; la Station spatiale, à 400 km, en met 1 h 32 ; l’orbite géostationnaire, à 35 786 km d’altitude, dure un jour sidéral, d’où un satellite immobile dans le ciel.',
    'The farther a satellite is, the slower it moves and the longer its period. Skimming the ground, an orbit takes about 1 h 25 min; the Space Station, at 400 km, takes 1 h 32 min; the geostationary orbit, 35,786 km up, lasts one sidereal day, hence a satellite that stays still in the sky.',
  ],
  // ------------------------------------------------------------------ astronomie ancienne
  smallangledemo: [
    'Pour un petit angle, le diamètre angulaire est simplement proportionnel à d / D : doubler la distance divise l’angle par deux. L’approximation reste excellente tant que l’angle est petit ; elle ne s’écarte de la valeur exacte que pour des objets très proches. La Lune et le Soleil font tous deux environ 0,5°.',
    'For a small angle the angular diameter is simply proportional to d / D: doubling the distance halves the angle. The approximation stays excellent while the angle is small; it only departs from the exact value for very close objects. The Moon and the Sun both span about 0.5°.',
  ],
  dipperclock: [
    'La Grande Ourse tourne autour de la Polaire dans le sens inverse des aiguilles d’une montre, d’un tour par jour sidéral, soit 15° par heure. À heure fixe, elle avance d’environ 1° par jour : un tour en un an. Connaissant la date, on peut lire l’heure sur cette horloge céleste, et réciproquement.',
    'The Big Dipper turns around Polaris counter-clockwise, one turn per sidereal day, i.e. 15° per hour. At a fixed time it moves about 1° per day: one turn in a year. Knowing the date you can read the time on this sky clock, and vice versa.',
  ],
  heliacalrisingsim: [
    'Une étoile proche du Soleil sur le ciel se perd dans sa lumière ; le lever héliaque est le premier matin où elle redevient visible à l’aube. Il revient chaque année à la même date pour un lieu donné, ce qui servait de calendrier : en Égypte, celui de Sirius annonçait la crue du Nil. Changez la latitude : la date change.',
    'A star close to the Sun in the sky is lost in its glare; the heliacal rising is the first morning it becomes visible again at dawn. It returns each year on the same date for a given place, which served as a calendar: in Egypt, Sirius’s announced the Nile flood. Change the latitude: the date changes.',
  ],
  transitmovie: [
    'À heure fixe, l’ombre du bâtiment raccourcit jusqu’au solstice d’été puis s’allonge jusqu’au solstice d’hiver : la hauteur du Soleil au midi vrai vaut 90° moins la latitude plus la déclinaison. Sa direction change aussi, car le Soleil n’est pas au même azimut à la même heure tout au long de l’année.',
    'At a fixed time the building’s shadow shortens until the June solstice, then lengthens until the December solstice: the Sun’s altitude at true noon is 90° minus the latitude plus the declination. Its direction changes too, since the Sun is not at the same azimuth at the same time all year round.',
  ],
  // ------------------------------------------------------------------ propriétés des étoiles
  stellarlum: [
    'La luminosité croît comme le carré du rayon et la puissance quatre de la température. Doublez la température : l’étoile est 16 fois plus lumineuse ; doublez le rayon : 4 fois. Une géante rouge froide peut ainsi surpasser une étoile chaude mais petite, et une naine blanche très chaude rester faible.',
    'Luminosity grows as the square of the radius and the fourth power of the temperature. Double the temperature: the star is 16 times more luminous; double the radius: 4 times. A cool red giant can thus outshine a hot but small star, and a very hot white dwarf can remain faint.',
  ],
  lightdetector: [
    'La même puissance se répartit sur des sphères de plus en plus grandes : à deux fois la distance, le flux est quatre fois plus faible ; à trois fois, neuf fois. C’est pour cela qu’une étoile très lumineuse mais lointaine peut paraître plus faible qu’une étoile modeste mais proche.',
    'The same power spreads over larger and larger spheres: at twice the distance the flux is four times weaker; at three times, nine times. That is why a very luminous but distant star can look fainter than a modest but nearby one.',
  ],
  stellarvel: [
    'La vitesse d’une étoile a deux parts : la vitesse radiale, mesurée par le décalage Doppler des raies, et la vitesse transverse, qui demande le mouvement propre et la distance. Une étoile peut avoir un grand mouvement propre et aucune vitesse radiale, ou l’inverse ; la vitesse dans l’espace combine les deux.',
    'A star’s velocity has two parts: the radial velocity, measured from the Doppler shift of its lines, and the transverse velocity, which needs the proper motion and the distance. A star can have a large proper motion and no radial velocity, or the reverse; the space velocity combines both.',
  ],
  spectroparallax: [
    'Le spectre dit quel genre d’étoile on regarde (type spectral et classe de luminosité) ; le diagramme HR en donne la magnitude absolue. L’écart avec la magnitude apparente donne la distance : chaque fois que m − M augmente de 5, la distance est multipliée par 10. Cette méthode porte bien plus loin que la parallaxe, mais avec moins de précision. La classe change aussi le spectre : les raies de Balmer d’une supergéante sont plus fines que celles d’une naine du même type.',
    'The spectrum tells what kind of star we are looking at (spectral type and luminosity class); the HR diagram gives its absolute magnitude. The gap with the apparent magnitude gives the distance: each time m − M grows by 5, the distance is multiplied by 10. This method reaches much farther than parallax, but with less precision. The class also changes the spectrum: the Balmer lines of a supergiant are narrower than those of a dwarf of the same type.',
  ],
  hrexplorer: [
    'La plupart des étoiles se rangent sur la séquence principale, de la naine rouge froide et faible à l’étoile bleue chaude et lumineuse. En haut à droite, les géantes : froides mais immenses ; en bas à gauche, les naines blanches : chaudes mais minuscules. Les droites d’égal rayon montrent que la position sur le diagramme fixe la taille de l’étoile. En couleur vraie, les étoiles froides sont orangées et les chaudes blanc bleuté : des teintes pâles, comme à l’œil.',
    'Most stars lie on the main sequence, from the cool, faint red dwarf to the hot, luminous blue star. At top right, the giants: cool but huge; at bottom left, the white dwarfs: hot but tiny. The lines of equal radius show that the position on the diagram fixes the size of the star. In true colour, cool stars are orange and hot ones bluish white: pale tints, as seen by the eye.',
  ],
  // ------------------------------------------------------------------ lumière et spectres
  meltednail: [
    'En chauffant, le clou émet de plus en plus (σT⁴) et son maximum se déplace vers les courtes longueurs d’onde (Wien). Sous 800 K environ, tout est dans l’infrarouge : le clou est chaud mais ne luit pas. Il passe ensuite au rouge sombre, puis à l’orangé vers la fusion du fer : la couleur d’un corps chaud donne sa température.',
    'As it heats, the nail emits more and more (σT⁴) and its peak moves to shorter wavelengths (Wien). Below about 800 K everything is in the infrared: the nail is hot but does not glow. It then turns dark red, then orange near the melting point of iron: the colour of a hot body gives its temperature.',
  ],
  bbexplorer: [
    'Une courbe plus chaude est au-dessus d’une plus froide à toutes les longueurs d’onde, et son maximum est plus à gauche. L’aire sous la courbe croît comme T⁴ ; le maximum se déplace comme 1/T. L’indice de couleur B − V diminue quand la température monte : les étoiles bleues sont chaudes, les rouges froides.',
    'A hotter curve lies above a cooler one at every wavelength, and its peak is further left. The area under the curve grows as T⁴; the peak moves as 1/T. The B − V colour index falls as the temperature rises: blue stars are hot, red ones cool.',
  ],
  spectrum010: [
    'Les raies d’absorption dépendent surtout de la température de l’étoile, pas de sa composition : l’hydrogène culmine vers 9 000 K (étoiles A), l’hélium dans les étoiles O et B très chaudes, les métaux et les molécules dans les étoiles froides K et M. C’est l’origine de la suite O B A F G K M : la population du niveau n = 2 de l’hydrogène croît avec la température (Boltzmann) jusqu’à ce que l’ionisation (Saha) vide l’hydrogène neutre. Les bandes de TiO apparaissent en fin de K et dominent les M.',
    'Absorption lines depend mostly on the star’s temperature, not its composition: hydrogen peaks around 9,000 K (A stars), helium in very hot O and B stars, metals and molecules in cool K and M stars. This is the origin of the O B A F G K M sequence: the population of hydrogen’s n = 2 level grows with temperature (Boltzmann) until ionisation (Saha) empties neutral hydrogen. TiO bands appear in late K and dominate the M stars.',
  ],
  emspectrum: [
    'La lumière visible n’est qu’une infime tranche du spectre électromagnétique, de 380 à 750 nm environ. Plus la longueur d’onde est courte, plus la fréquence et l’énergie du photon sont grandes : un photon gamma est des milliards de fois plus énergétique qu’un photon radio. Chaque domaine correspond à des corps de températures et de tailles différentes.',
    'Visible light is only a tiny slice of the electromagnetic spectrum, about 380 to 750 nm. The shorter the wavelength, the higher the frequency and the photon energy: a gamma-ray photon is billions of times more energetic than a radio photon. Each band corresponds to bodies of different temperatures and sizes.',
  ],
  dopplershift: [
    'Devant la source, les crêtes sont serrées : fréquence plus haute (vers le bleu pour la lumière) ; derrière, elles sont espacées : fréquence plus basse (vers le rouge). Placé sur le côté, l’observateur ne perçoit presque aucun décalage : seule compte la vitesse le long de la ligne de visée.',
    'In front of the source the crests are bunched up: higher frequency (bluer for light); behind it they are spread out: lower frequency (redder). Placed to the side, the observer sees almost no shift: only the velocity along the line of sight counts.',
  ],
  filters: [
    'Un filtre ne fait que retirer de la lumière : le spectre reçu est le produit du spectre de la source et des transmissions. Un corps noir chaud passe mieux le filtre B, un froid le filtre R : comparer les deux mesure la couleur, donc la température. L’atmosphère coupe l’ultraviolet sous 300 nm environ.',
    'A filter only removes light: the received spectrum is the product of the source spectrum and the transmissions. A hot blackbody gets through the B filter better, a cool one the R filter: comparing them measures the colour, hence the temperature. The atmosphere cuts the ultraviolet below about 300 nm.',
  ],
  hydrogenatom: [
    'Un photon n’est absorbé que si son énergie correspond exactement à l’écart entre deux niveaux : les autres traversent l’atome. Au-delà de 13,6 eV, l’électron est arraché. En retombant, l’électron émet des photons aux mêmes énergies : les raies de Balmer (vers le niveau 2) tombent dans le visible, celle de Hα à 656 nm.',
    'A photon is absorbed only if its energy exactly matches the gap between two levels: the others pass through the atom. Above 13.6 eV the electron is torn away. Falling back, the electron emits photons at the same energies: the Balmer lines (down to level 2) fall in the visible, Hα at 656 nm.',
  ],
  threeviewsspectra: [
    'Le même gaz donne des raies brillantes vu seul sur fond noir, et des raies sombres aux mêmes longueurs d’onde vu devant la source chaude. Directement vers l’ampoule, sans gaz, le spectre est continu. Ce sont les trois lois de Kirchhoff : elles permettent de reconnaître la composition d’un gaz lointain.',
    'The same gas gives bright lines when seen alone against a dark background, and dark lines at the same wavelengths when seen in front of the hot source. Looking straight at the bulb, without gas, the spectrum is continuous. These are Kirchhoff’s three laws: they let us identify the composition of a distant gas.',
  ],
  // ------------------------------------------------------------------ exoplanètes
  hammerthrower: [
    'Le lanceur et le marteau tournent tous deux autour de leur centre de masse commun ; plus le marteau est léger, plus le lanceur bouge peu. De même, une étoile décrit un petit cercle sous l’effet de sa planète : c’est ce mouvement, et non la planète, qu’on détecte par les vitesses radiales.',
    'The thrower and the hammer both turn around their common centre of mass; the lighter the hammer, the less the thrower moves. Likewise, a star traces a small circle under the pull of its planet: it is this motion, not the planet, that radial velocities detect.',
  ],
  ca_extrasolarplanets_graph: [
    'La vitesse de l’étoile le long de la ligne de visée trace une sinusoïde, de période égale à celle de la planète. Son amplitude grandit avec la masse de la planète et diminue avec la distance ; vue de face (inclinaison 0°), l’orbite ne donne aucun signal. Jupiter fait osciller le Soleil d’environ 12,5 m·s⁻¹.',
    'The star’s velocity along the line of sight traces a sine curve, with the same period as the planet. Its amplitude grows with the planet’s mass and shrinks with distance; seen face-on (0° inclination), the orbit gives no signal. Jupiter makes the Sun wobble by about 12.5 m·s⁻¹.',
  ],
  ca_extrasolarplanets_starwobble: [
    'Le Soleil n’est pas immobile : il décrit une boucle compliquée autour du centre de masse du Système solaire, parfois à plus d’un rayon solaire de celui-ci. Le motif est mené surtout par Jupiter (période 11,9 ans) et Saturne (29,5 ans) ; les autres planètes y ajoutent de petits détails.',
    'The Sun is not still: it traces a complicated loop around the centre of mass of the Solar System, sometimes more than one solar radius away from it. The pattern is driven mainly by Jupiter (11.9-year period) and Saturn (29.5 years); the other planets add small details.',
  ],
  pulsarPeriodSim: [
    'Le pulsar émet ses impulsions à intervalles parfaitement réguliers, mais elles arrivent plus serrées quand il s’approche de nous et plus espacées quand il s’éloigne. La période mesurée oscille donc au rythme de l’orbite : c’est ainsi qu’ont été découvertes en 1992 les premières planètes hors du Système solaire, autour d’un pulsar.',
    'The pulsar emits its pulses at perfectly regular intervals, but they arrive closer together when it approaches us and further apart when it recedes. The measured period therefore oscillates with the orbit: this is how the first planets beyond the Solar System were discovered in 1992, around a pulsar.',
  ],
  radialvelocitydemo: [
    'Quand l’étoile s’approche de nous, ses raies se décalent vers le bleu ; quand elle s’éloigne, vers le rouge. Le décalage est minuscule (Δλ / λ = v / c, quelques mètres par seconde sur 300 000 km·s⁻¹) : il faut des spectrographes d’une stabilité extrême pour le mesurer.',
    'When the star approaches us its lines shift toward the blue; when it recedes, toward the red. The shift is tiny (Δλ / λ = v / c, a few metres per second against 300,000 km·s⁻¹): extremely stable spectrographs are needed to measure it.',
  ],
  transitsimulator: [
    'Quand la planète passe devant l’étoile, la lumière baisse de (R_p / R_*)² : environ 1 % pour une Jupiter devant le Soleil, 0,01 % pour une Terre. Il faut que l’orbite soit vue presque par la tranche ; inclinez-la un peu et le transit disparaît. La durée du transit renseigne sur la taille de l’orbite.',
    'When the planet passes in front of the star the light drops by (R_p / R_*)²: about 1 % for a Jupiter in front of the Sun, 0.01 % for an Earth. The orbit must be seen almost edge-on; tilt it a little and the transit disappears. The transit duration tells about the size of the orbit.',
  ],
  radialvelocitysimulator: [
    'Pour une orbite circulaire, la courbe est une sinusoïde ; une orbite excentrique la déforme, avec un pic brusque au passage près de l’étoile. L’orientation de l’orbite (ω) change la forme de ce pic. On ne mesure que Mₚ sin i : sans connaître l’inclinaison, la masse trouvée est un minimum.',
    'For a circular orbit the curve is a sine wave; an eccentric orbit distorts it, with a sharp peak at the passage near the star. The orbit’s orientation (ω) changes the shape of that peak. Only Mₚ sin i is measured: without the inclination, the mass found is a minimum.',
  ],
  // ------------------------------------------------------------------ étoiles binaires
  eclipsingbinarysim: [
    'Chaque étoile cache l’autre à tour de rôle : deux creux par période. Le creux le plus profond se produit quand l’étoile la plus brillante en surface (la plus chaude) est cachée. La forme et la durée des creux donnent les rayons, l’écart entre eux renseigne sur l’excentricité ; inclinez l’orbite et les éclipses disparaissent.',
    'Each star hides the other in turn: two dips per period. The deeper dip occurs when the star with the brighter surface (the hotter one) is hidden. The shape and duration of the dips give the radii, the spacing between them tells about the eccentricity; tilt the orbit and the eclipses vanish.',
  ],
  lightcurve: [
    'Une seule nuit ne montre qu’un bout de la courbe ; en ramenant chaque mesure à sa phase (temps / période modulo 1), les nuits successives remplissent la courbe complète. Si la période supposée est fausse, les points s’éparpillent : c’est ainsi qu’on trouve la vraie période.',
    'A single night only shows a piece of the curve; by folding each measurement to its phase (time / period modulo 1), successive nights fill in the whole curve. If the assumed period is wrong the points scatter: this is how the true period is found.',
  ],
  centerofmass: [
    'Le centre de masse est toujours plus près du corps le plus massif : m₁ r₁ = m₂ r₂. Avec des masses égales, il est au milieu ; si l’une est dix fois plus lourde, il est dix fois plus près d’elle. Faites tourner le couple : les deux corps décrivent des cercles autour de ce point, de même période.',
    'The centre of mass is always closer to the more massive body: m₁ r₁ = m₂ r₂. With equal masses it is in the middle; if one is ten times heavier, it is ten times closer to it. Spin the pair: both bodies trace circles around that point, with the same period.',
  ],
  wagonwheel: [
    'Si la roue fait presque un tour (ou presque l’écart entre deux rayons) entre deux images, elle semble tourner lentement, s’arrêter, voire repartir à l’envers. On le voit au cinéma avec les roues de chariot. En astronomie, des observations trop espacées peuvent de même faire croire à une fausse période.',
    'If the wheel turns almost a full turn (or almost the gap between two spokes) between two frames, it seems to turn slowly, stop, or even go backwards. This is seen in films with wagon wheels. In astronomy, observations spaced too widely can likewise suggest a false period.',
  ],
  // ------------------------------------------------------------------ Système solaire
  solarsystemproperties: [
    'Deux familles se dégagent : les planètes telluriques, petites, denses et proches du Soleil, avec peu ou pas de satellites ; les géantes, massives, peu denses, lointaines, entourées de nombreux satellites. Passez en échelle logarithmique : les distances et les masses s’étalent sur plusieurs ordres de grandeur.',
    'Two families stand out: the terrestrial planets, small, dense and close to the Sun, with few or no moons; the giants, massive, low-density, distant, surrounded by many moons. Switch to a logarithmic scale: distances and masses span several orders of magnitude.',
  ],
  formationtemps: [
    'Près du Soleil, il faisait trop chaud pour que les glaces se forment : seuls les métaux et les silicates sont devenus solides, d’où des planètes petites et rocheuses. Au-delà de la ligne des glaces (vers 5 ua dans ce modèle), l’eau gèle et la matière solide abonde : les planètes géantes ont pu grossir.',
    'Close to the Sun it was too hot for ices to form: only metals and silicates became solid, hence small rocky planets. Beyond the frost line (around 5 au in this model) water freezes and solid matter abounds: the giant planets could grow.',
  ],
  drivingthroughsnow: [
    'Les flocons tombent tous parallèlement, mais en perspective ils semblent jaillir d’un même point devant la voiture. Accélérez : le point descend vers l’horizon. Les étoiles filantes d’un même essaim font de même : elles semblent partir d’un radiant, qui donne son nom à la pluie (Perséides, Léonides…).',
    'The snowflakes all fall parallel, but in perspective they seem to burst from a single point ahead of the car. Speed up: the point drops toward the horizon. Meteors from the same stream do the same: they seem to come from a radiant, which gives the shower its name (Perseids, Leonids…).',
  ],
  // ------------------------------------------------------------------ le Soleil
  fusion01: [
    'Quatre protons deviennent un noyau d’hélium 4 ; la masse finale est plus faible d’environ 0,7 %, et cette masse devient énergie (E = Δm c²), 26,7 MeV par noyau formé. Les étapes 1 et 2 doivent se produire deux fois pour une étape 3. La première, qui transforme un proton en neutron, est très lente : c’est elle qui règle la durée de vie du Soleil.',
    'Four protons become a helium-4 nucleus; the final mass is about 0.7 % lower, and that mass becomes energy (E = Δm c²), 26.7 MeV per nucleus formed. Steps 1 and 2 must happen twice for one step 3. The first, which turns a proton into a neutron, is very slow: it sets the Sun’s lifetime.',
  ],
  fusion02: [
    'Le carbone 12 sert de catalyseur : il est consommé à la première étape et rendu à la dernière. Le bilan est le même que pour la chaîne proton-proton, quatre protons donnant un noyau d’hélium 4 et 26,7 MeV. Ce cycle demande des températures plus élevées : il domine dans les étoiles plus massives que le Soleil.',
    'Carbon-12 acts as a catalyst: it is consumed in the first step and given back in the last. The net result is the same as the proton-proton chain, four protons giving a helium-4 nucleus and 26.7 MeV. This cycle needs higher temperatures: it dominates in stars more massive than the Sun.',
  ],
  // ------------------------------------------------------------------ Voie lactée
  milkywayrotationalvelocity: [
    'Si toute la masse était concentrée au centre, la vitesse décroîtrait comme 1/√R, comme les planètes autour du Soleil (courbe képlérienne). Or elle reste presque constante loin du centre, là où il n’y a presque plus d’étoiles : la masse contenue continue de croître avec R. C’est l’un des indices de la matière noire.',
    'If all the mass were concentrated at the centre, the speed would fall as 1/√R, like the planets around the Sun (Keplerian curve). Instead it stays almost constant far from the centre, where there are hardly any stars: the enclosed mass keeps growing with R. This is one of the clues to dark matter.',
  ],
  trafficdensity: [
    'Le bouchon suit le tracteur, mais les voitures qui le forment changent sans cesse : elles y entrent par l’arrière et en sortent par l’avant. Les bras spiraux d’une galaxie sont de même des ondes de densité : les étoiles et le gaz les traversent, s’y attardent, et le gaz comprimé y forme de nouvelles étoiles.',
    'The jam follows the tractor, but the cars forming it keep changing: they enter from behind and leave from the front. A galaxy’s spiral arms are likewise density waves: stars and gas pass through them, linger there, and the compressed gas forms new stars.',
  ],
  // ------------------------------------------------------------------ cosmologie
  balloon: [
    'En gonflant, le ballon éloigne toutes les galaxies les unes des autres, et plus une galaxie est loin, plus elle s’éloigne vite : les points du graphique restent sur une droite, la loi de Hubble-Lemaître. Changez de galaxie de référence : on obtient la même loi, aucune galaxie n’est au centre de l’expansion.',
    'As the balloon inflates, every galaxy moves away from every other, and the farther a galaxy is, the faster it recedes: the points on the graph stay on a straight line, the Hubble-Lemaître law. Change the reference galaxy: you get the same law, no galaxy is at the centre of the expansion.',
  ],
  galacticredshift: [
    'Toutes les raies glissent ensemble vers le rouge, dans le même rapport 1 + z : c’est ce qui permet de les reconnaître et de mesurer z. Avec le décalage, la lumière quitte le filtre B pour le filtre V et R : la galaxie paraît plus rouge, et Hα sort même du visible au-delà de z ≈ 0,14.',
    'All the lines slide together toward the red, in the same ratio 1 + z: this is what lets us recognise them and measure z. With the shift, light leaves the B filter for the V and R filters: the galaxy looks redder, and Hα even leaves the visible beyond z ≈ 0.14.',
  ],
  // ------------------------------------------------------------------ télescopes
  telescope10: [
    'Un oculaire plus court grossit davantage mais rétrécit le champ : la Lune entière tient dans l’oculaire de 40 mm, pas dans celui de 10 mm. Le diamètre de l’objectif fixe la finesse des détails et la quantité de lumière recueillie ; le grossissement ne fait que les agrandir. Déréglez la mise au point : chaque point devient une tache.',
    'A shorter eyepiece magnifies more but narrows the field: the whole Moon fits in the 40 mm eyepiece, not in the 10 mm one. The objective’s diameter sets the finest detail and the amount of light gathered; magnification only enlarges them. Throw the focus off: every point becomes a blob.',
  ],
  buckets: [
    'Pendant la pose, les pixels proches de l’étoile se remplissent vite, ceux du fond lentement ; un pixel plein sature et perd l’information. À la lecture, les charges ne sont pas lues sur place : elles glissent ligne par ligne puis case par case vers l’unique amplificateur. Les comptes fluctuent d’environ √N d’une pose à l’autre.',
    'During the exposure, pixels near the star fill quickly, background ones slowly; a full pixel saturates and loses information. At readout the charges are not read in place: they shift row by row, then cell by cell, toward the single amplifier. The counts fluctuate by about √N from one exposure to the next.',
  ],
  snellslaw: [
    'En entrant dans un milieu plus réfringent, le rayon se rapproche de la normale ; en en sortant, il s’en écarte. Vers un milieu moins réfringent, au-delà de l’angle limite, il n’y a plus de rayon réfracté : réflexion totale, comme dans les fibres optiques. À l’angle de Brewster, la lumière réfléchie est entièrement polarisée.',
    'Entering a more refractive medium, the ray bends toward the normal; leaving it, it bends away. Toward a less refractive medium, beyond the critical angle, there is no refracted ray any more: total internal reflection, as in optical fibres. At Brewster’s angle the reflected light is fully polarised.',
  ],
  // ------------------------------------------------------------------ astronomie antique : la machine d'Anticythère
  antikythera: [
    'Tournez la manivelle : un tour de poignée fait avancer la grande roue b1 de 48/223 de tour, soit 78,6 jours. Sur la face avant, l’aiguille du Soleil parcourt le zodiaque en un an et montre la date sur l’anneau égyptien (365 jours, recalé tous les quatre ans) ; celle de la Lune fait 254 tours en 19 ans (254/19, exactement) et accélère près du périgée grâce au tenon et à la fente de k1/k2, montés sur e3 ; la sphère demi-argentée montre la phase. Les anneaux du Cosmos portent les planètes (relations de période de Freeth et al. 2021). Au dos, l’aiguille métonique parcourt 235 cases en 19 ans (5 spires) ; celle du Saros, 223 lunaisons en 4 spires, avec Η (Soleil) ou Σ (Lune) sur les cases à éclipse ; l’exeligmos dit combien d’heures ajouter (0, 8 ou 16). Décochez « Enveloppe » et éclatez les étages : les roues de même couleur forment une chaîne, et survoler une roue donne son rapport exact.',
    'Turn the crank: one turn of the handle advances the great wheel b1 by 48/223 of a turn, that is 78.6 days. On the front, the Sun pointer runs through the zodiac in a year and shows the date on the Egyptian ring (365 days, reset every four years); the Moon pointer makes 254 turns in 19 years (254/19, exactly) and speeds up near perigee thanks to the pin and slot of k1/k2, mounted on e3; the half-silvered ball shows the phase. The Cosmos rings carry the planets (period relations of Freeth et al. 2021). On the back, the Metonic pointer runs through 235 cells in 19 years (5 turns); the Saros pointer through 223 lunations in 4 turns, with Η (Sun) or Σ (Moon) on the eclipse cells; the exeligmos tells how many hours to add (0, 8 or 16). Untick “Case” and explode the levels: gears of the same colour form one chain, and hovering over a gear gives its exact ratio.',
  ],
  // ------------------------------------------------------------------ milieu interstellaire : Orion en 3D
  orion3d: [
    'De face, depuis la Terre, les projections sur la sphère céleste dessinent Orion. Faites tourner la scène : Bellatrix est à 77 parsecs (252 années-lumière), Bételgeuse à 168, Saiph à 198, Rigel à 265, et la Ceinture, Meissa, l’épée et la nébuleuse d’Orion vers 380 à 410 parsecs : les traits de la figure relient des étoiles qui n’ont rien à voir entre elles, sauf les étoiles chaudes de la Ceinture et de l’épée, nées du même grand nuage, avec M42 et la Tête de Cheval. Les barres d’erreur montrent que la distance d’une étoile brillante reste mal connue : Alnilam et Mintaka saturent Gaia.',
    'Face-on, from the Earth, the projections on the celestial sphere draw Orion. Turn the scene: Bellatrix is 77 parsecs away (252 light-years), Betelgeuse 168, Saiph 198, Rigel 265, and the Belt, Meissa, the sword and the Orion Nebula around 380 to 410 parsecs: the lines of the figure join stars that have nothing to do with one another, except the hot stars of the Belt and the sword, born from the same large cloud, with M42 and the Horsehead. The error bars show that the distance of a bright star is still poorly known: Alnilam and Mintaka saturate Gaia.',
  ],
  // ------------------------------------------------------------------ Renaissance : gravité et orbites (d'après PhET)
  gravityorbits: [
    'La Terre tourne autour du Soleil en 365,26 jours, la Lune autour de la Terre en 27,3 jours : les périodes mesurées le confirment à mieux que 0,2 %. Coupez la gravité : chaque corps file tout droit, c’est la gravité qui courbe les trajectoires. Passez « à l’échelle » : vus du Soleil, la Terre et la Lune ne font qu’un seul point, et le Soleil n’est qu’un tout petit disque. En vue « Modèle », la distance Terre–Lune est agrandie 78 fois : la trace de la Lune y fait des boucles qui n’existent pas. La vraie trajectoire de la Lune autour du Soleil ne fait jamais de boucle : elle est toujours tournée vers le Soleil, qui la tire deux fois plus fort que la Terre. L’énergie totale et le moment cinétique restent constants.',
    'The Earth goes round the Sun in 365.26 days, the Moon round the Earth in 27.3 days: the measured periods confirm it to better than 0.2%. Turn gravity off: each body moves off in a straight line; gravity is what bends the paths. Switch to “to scale”: seen from the Sun, the Earth and the Moon are a single dot, and the Sun is only a tiny disc. In the “Model” view the Earth–Moon distance is enlarged 78 times: the Moon’s trace makes loops there that do not exist. The Moon’s real path around the Sun never loops: it always curves towards the Sun, which pulls it twice as hard as the Earth does. Total energy and angular momentum stay constant.',
  ],
  // ------------------------------------------------------------------ introduction
  lookbacktimesim: [
    'L’explosion n’est vue qu’après le temps que met sa lumière pour nous parvenir : une étoile à 6 500 années-lumière a explosé 6 500 ans avant qu’on la voie. Regarder loin, c’est regarder dans le passé : on voit les astres tels qu’ils étaient, et certains n’existent peut-être plus.',
    'The explosion is only seen after the time its light takes to reach us: a star 6,500 light-years away exploded 6,500 years before we saw it. Looking far is looking back in time: we see objects as they were, and some of them may no longer exist.',
  ],
  earthatmosphere: [
    'Près de l’horizon, la lumière traverse jusqu’à 38 fois plus d’air qu’au zénith : les étoiles y pâlissent (Δm = k X) et rougissent, car l’air diffuse le bleu bien plus que le rouge (Rayleigh, ∝ λ⁻⁴). L’atmosphère ne laisse passer que le visible, quelques fenêtres infrarouges et la radio : d’où les télescopes en altitude et dans l’espace. Elle courbe aussi les rayons : un astre paraît plus haut qu’il n’est (34′ à l’horizon, plus que le diamètre du Soleil), le Soleil couchant s’aplatit et se lève 2 à 3 min plus tôt. Dans le défi parallaxe, la réfraction se retire avant le calcul.',
    "Near the horizon, light crosses up to 38 times more air than at the zenith: stars fade there (Δm = k X) and redden, because air scatters blue much more than red (Rayleigh, ∝ λ⁻⁴). The atmosphere only lets through the visible, a few infrared windows and radio: hence telescopes at altitude and in space. It also bends rays: an object looks higher than it is (34′ at the horizon, more than the Sun’s diameter), the setting Sun flattens and rises 2 to 3 min earlier. In the parallax challenge, refraction is removed before computing.",
  ],
  newtoncannon: [
    'Tirez de plus en plus vite : le boulet retombe de plus en plus loin, car la Terre se courbe sous lui. À v₁ ≈ 7,8 km·s⁻¹ (depuis 100 km), il tombe toujours mais ne touche plus le sol : c’est une orbite, la chute libre autour de l’astre. Entre v₁ et v₂ = √2 v₁, l’orbite s’allonge en ellipse dont le canon est le périgée ; à v₂ ≈ 11,1 km·s⁻¹, il ne revient plus. Toute orbite repasse par son point de départ : pour tourner au-dessus de l’air, il faut monter le canon. Sur Dimorphos, quelques centimètres par seconde suffisent. Avec l’air, une orbite basse se dégrade et finit en rentrée.',
    'Fire faster and faster: the ball lands farther and farther away, because the Earth curves away beneath it. At v₁ ≈ 7.8 km·s⁻¹ (from 100 km) it still falls but never reaches the ground: this is an orbit, free fall around the body. Between v₁ and v₂ = √2 v₁ the orbit stretches into an ellipse with the cannon at perigee; at v₂ ≈ 11.1 km·s⁻¹ it never comes back. Every orbit passes through its starting point again: to orbit above the air, the cannon must be raised. On Dimorphos, a few centimetres per second are enough. With air, a low orbit decays and ends in re-entry.',
  ],
  resolution: [
    'Une étoile n’est jamais un point : la lumière qui passe par une ouverture de diamètre D s’étale en une tache d’Airy, entourée d’anneaux, dont le premier anneau noir est à 1,22 λ / D. Deux étoiles plus proches que cela se confondent (critère de Rayleigh ; au milieu, l’intensité ne retombe qu’à 73 %). Doubler D divise la tache par deux, l’infrarouge l’élargit. Au sol, la turbulence étale l’image d’une pose longue sur environ 1″ : passé 14 cm de diamètre dans le visible, c’est elle qui décide, d’où les télescopes spatiaux et l’optique adaptative.',
    'A star is never a point: light passing through an aperture of diameter D spreads into an Airy spot surrounded by rings, whose first dark ring lies at 1.22 λ / D. Two stars closer than that merge (Rayleigh criterion; in between, the intensity only drops to 73%). Doubling D halves the spot; the infrared widens it. On the ground, turbulence spreads a long exposure over about 1″: beyond 14 cm of diameter in visible light, turbulence decides, hence space telescopes and adaptive optics.',
  ],
  orbitalelements: [
    'Six nombres suffisent : a fixe la taille et la période (T = 2π √(a³ / GM), 92 min pour la station spatiale, un jour sidéral à 42 164 km), e la forme, i l’inclinaison du plan sur l’équateur, Ω l’orientation de ce plan (depuis le point vernal γ), ω celle de l’ellipse dans son plan (du nœud ascendant au périgée), et le temps dit où est le satellite. Il va plus vite au périgée qu’à l’apogée (vis-viva). La trace au sol se décale à chaque tour parce que la Terre tourne dessous ; une orbite géostationnaire reste au-dessus d’un point, une Molniya s’attarde au-dessus du Nord.',
    'Six numbers are enough: a sets the size and the period (T = 2π √(a³ / GM), 92 min for the space station, one sidereal day at 42,164 km), e the shape, i the tilt of the plane on the equator, Ω the orientation of that plane (from the vernal point γ), ω that of the ellipse within its plane (from the ascending node to the perigee), and time says where the satellite is. It moves faster at perigee than at apogee (vis-viva). The ground track shifts at each turn because the Earth turns beneath it; a geostationary orbit stays above one point, a Molniya orbit lingers over the North.',
  ],
  hohmann: [
    'Pour monter d’une orbite circulaire à une autre, on accélère une fois pour entrer sur une demi-ellipse qui touche les deux orbites, puis une seconde fois à l’arrivée pour s’y mettre en cercle : c’est le transfert le plus économe entre deux orbites proches. Vers Mars, il faut 2,9 puis 2,6 km·s⁻¹ et 259 jours ; vers Vénus, les deux poussées freinent. Comme le voyage dure longtemps, il faut partir quand la cible a la bonne avance (44° pour Mars) : la fenêtre de tir ne revient qu’à chaque période synodique (780 jours pour Mars).',
    'To climb from one circular orbit to another, you speed up once to enter a half-ellipse touching both orbits, then a second time on arrival to circularise: this is the most economical transfer between two nearby orbits. To Mars it takes 2.9 then 2.6 km·s⁻¹ and 259 days; to Venus both burns brake. Since the trip is long, you must leave when the target has the right lead (44° for Mars): the launch window only comes back every synodic period (780 days for Mars).',
  ],
  meteorradiant: [
    'Les poussières d’un essaim arrivent toutes parallèles, comme les flocons devant une voiture : vues du sol, les traînées semblent jaillir d’un même point, le radiant. Prolongées vers l’arrière, elles s’y croisent ; tout près du radiant, une étoile filante vient vers nous et paraît courte, loin de lui elle file de profil. Le radiant tourne avec les étoiles : sous l’horizon, aucune étoile filante de l’essaim ; plus il monte, plus le taux approche le ZHR (taux horaire ≈ ZHR × sin h, moins sous un ciel urbain). Les Perséides donnent le meilleur en fin de nuit, quand Persée est haut.',
    'The dust of a stream all arrives in parallel, like snowflakes in front of a car: seen from the ground, the trails seem to burst from one point, the radiant. Extended backwards, they cross there; close to the radiant a meteor comes towards us and looks short, far from it it flies past side-on. The radiant turns with the stars: below the horizon, no meteors from the stream; the higher it climbs, the closer the rate gets to the ZHR (hourly rate ≈ ZHR × sin h, less under an urban sky). The Perseids are best late at night, when Perseus is high.',
  ],
  interferometry: [
    'Deux télescopes séparés de B forment des franges, comme deux fentes d’Young : leur écart sur le ciel vaut λ / B, bien plus fin que la tache 1,22 λ / d d’un télescope seul. Une étoile non résolue donne des franges bien contrastées (V = 1) ; quand on allonge la base, le disque d’une étoile les efface : V tombe à zéro pour B = 1,22 λ / θ, ce qui donne son diamètre (Bételgeuse, 47 mas, par Michelson et Pease en 1920 : franges disparues vers 3 m). Au-delà, elles reviennent, retournées. Un couple fait battre la visibilité, au plus bas pour B = λ / 2ρ. Second montage, les anneaux de Newton : entre une lentille et une lame de verre, la lame d’air s’épaissit comme r² ; les anneaux sombres tombent là où son épaisseur vaut un nombre entier de demi-longueurs d’onde, à √(kλR), de plus en plus serrés ; le centre est noir en réflexion.',
    'Two telescopes B apart form fringes, like two Young’s slits: their spacing on the sky is λ / B, much finer than the 1.22 λ / d spot of a single telescope. An unresolved star gives high-contrast fringes (V = 1); as the baseline grows, the disc of a star washes them out: V drops to zero at B = 1.22 λ / θ, which gives its diameter (Betelgeuse, 47 mas, by Michelson and Pease in 1920: fringes gone near 3 m). Beyond that they come back, reversed. A pair makes the visibility beat, lowest at B = λ / 2ρ. Second set-up, Newton’s rings: between a lens and a glass plate, the air film thickens as r²; dark rings fall where its thickness is a whole number of half wavelengths, at √(kλR), closer and closer; the centre is dark in reflection.',
  ],
  occultation: [
    'L’étoile est si loin que l’ombre de l’astéroïde a sa taille même : elle balaie la Terre à une dizaine de km·s⁻¹ (plus vite pour un objet lointain, car c’est surtout la Terre qui bouge). Chaque observateur voit l’étoile disparaître quelques secondes : durée × vitesse = longueur de la corde. Une seule corde ne donne qu’une taille minimale ; trois cordes ou plus dessinent la forme (ellipse ajustée), d’autant mieux que les observateurs sont nombreux et bien chronométrés. Les « négatifs » des bords comptent aussi. Une supergéante, plus grande que l’astéroïde vue de lui, n’est cachée qu’en partie.',
    'The star is so far away that the asteroid’s shadow has the asteroid’s own size: it sweeps the Earth at about ten km·s⁻¹ (faster for a distant object, because it is mostly the Earth that moves). Each observer sees the star vanish for a few seconds: duration × speed = chord length. A single chord only gives a minimum size; three chords or more draw the shape (fitted ellipse), the better the more observers and the better their timing. The “negatives” at the edges count too. A supergiant, larger than the asteroid as seen from it, is only partly hidden.',
  ],
  kozai: [
    'Le perturbateur est loin, et pourtant, avec le temps, il déforme l’orbite : l’excentricité et l’inclinaison s’échangent, en gardant C = √(1 − e²) cos i constant (le cercle très incliné et l’ellipse allongée peu inclinée ont le même C). Sous 39,2°, presque rien ne se passe. Au-dessus, une orbite presque circulaire s’allonge jusqu’à eₘₐₓ = √(1 − 5/3 cos² i₀) — 0,84 pour 65° — au moment où l’inclinaison redescend à 39,2°, puis revient : périodiquement, en quelques tₖ. Selon ω₀, le périastre tourne ou oscille autour de 90° (portrait de phase).',
    'The perturber is far away, and yet over time it reshapes the orbit: eccentricity and inclination trade off, keeping C = √(1 − e²) cos i constant (the highly inclined circle and the elongated, less inclined ellipse share the same C). Below 39.2°, almost nothing happens. Above it, a nearly circular orbit stretches up to eₘₐₓ = √(1 − 5/3 cos² i₀) — 0.84 for 65° — when the inclination has come down to 39.2°, then comes back: periodically, within a few tₖ. Depending on ω₀, the periapsis goes round or swings around 90° (phase portrait).',
  ],
  lagrange: [
    'Dans le repère qui tourne avec les deux astres, cinq points où un petit corps resterait immobile. L1 et L2 encadrent le petit astre, à peu près au rayon de Hill a ∛(μ/3) : 1,5 million de km de la Terre, là où travaillent SOHO et le JWST ; ils sont instables (lâchez un corps à côté : il s’en va). L4 et L5, au sommet de triangles équilatéraux, sont stables tant que μ < 0,0385 : les troyens de Jupiter y dessinent des « têtards », d’autres corps des « fers à cheval ». Les zones grises lui sont interdites (constante de Jacobi). Pour Pluton et Charon, L4 ne retient plus rien. Choisissez une orbite de halo : autour de L1 ou L2, le corps tourne hors du plan, sur une boucle que l’on voit du grand astre comme un halo ; lâché sur l’orbite calculée (Richardson), il la suit un tour puis s’en va : les sondes doivent corriger leur trajectoire.',
    'In the frame rotating with the two bodies, five points where a small body would stay still. L1 and L2 flank the small body, roughly at the Hill radius a ∛(μ/3): 1.5 million km from the Earth, where SOHO and JWST operate; they are unstable (release a body nearby: it drifts away). L4 and L5, at the tips of equilateral triangles, are stable as long as μ < 0.0385: Jupiter’s Trojans trace “tadpoles” there, other bodies “horseshoes”. Grey regions are forbidden to it (Jacobi constant). For Pluto and Charon, L4 no longer holds anything. Choose a halo orbit: around L1 or L2, the body circles out of the plane, on a loop seen from the large body as a halo; released on the computed orbit (Richardson), it follows it for one turn then leaves: probes must correct their path.',
  ],
  aediagram: [
    'Chaque point du diagramme est une orbite : a donne sa taille et sa période (P = a √a), e son allongement. Les familles de géocroiseurs suivent des courbes : un Apollo a un périhélie q = a(1 − e) sous l’aphélie de la Terre (1,017 ua), il croise donc son orbite ; un Amor la frôle par l’extérieur ; un Aten croise l’orbite terrestre avec a < 1 ua ; un Atira reste tout entier à l’intérieur. La ceinture principale se tient entre Mars et Jupiter, trouée aux résonances avec Jupiter (lacunes de Kirkwood 3:1, 5:2, 7:3, 2:1). Le paramètre de Tisserand distingue les orbites d’astéroïdes (au-dessus de 3) de celles des comètes.',
    'Each point of the diagram is an orbit: a gives its size and period (P = a √a), e its elongation. Near-Earth groups follow curves: an Apollo has a perihelion q = a(1 − e) below Earth’s aphelion (1.017 au), so it crosses its orbit; an Amor grazes it from outside; an Aten crosses Earth’s orbit with a < 1 au; an Atira stays entirely inside. The main belt lies between Mars and Jupiter, holed at the resonances with Jupiter (Kirkwood gaps 3:1, 5:2, 7:3, 2:1). The Tisserand parameter tells asteroid orbits (above 3) from comet orbits.',
  ],
  gravityassist: [
    'Vue de la planète, la sonde arrive et repart à la même vitesse v∞ : la planète ne fait que tourner sa trajectoire, d’autant plus qu’elle est massive et qu’on passe près. Vue du Soleil, il faut ajouter la vitesse V de la planète : la flèche v∞ a tourné sur son cercle, donc v = V + v∞ a changé de longueur. Passer derrière la planète tourne v∞ vers l’avant : la sonde gagne de la vitesse et monte vers les planètes lointaines (Voyager, Cassini) ; passer devant la freine et la fait descendre vers le Soleil (BepiColombo vers Mercure). La planète paie la différence, imperceptiblement.',
    'Seen from the planet, the probe arrives and leaves at the same speed v∞: the planet only turns its trajectory, all the more as it is massive and the pass is close. Seen from the Sun, the planet’s velocity V must be added: the v∞ arrow has turned on its circle, so v = V + v∞ has changed length. Passing behind the planet turns v∞ forwards: the probe gains speed and climbs towards distant planets (Voyager, Cassini); passing in front slows it down and lets it fall towards the Sun (BepiColombo towards Mercury). The planet pays the difference, imperceptibly.',
  ],
  impactcrater: [
    'Un impacteur de 1,5 km à 20 km·s⁻¹ creuse une cavité dix fois plus large que lui en quelques dizaines de secondes, puis les parois s’effondrent : le cratère final mesure une quinzaine de fois l’impacteur (22 km ici). Sous 3 km environ, c’est une cuvette (cratère simple, comme Meteor Crater) ; au-delà, un cratère complexe, à fond plat, peu profond pour sa largeur. Le diamètre croît comme la puissance 0,78 de la taille, mais seulement comme la puissance 0,44 de la vitesse : doubler la taille compte bien plus que doubler la vitesse. L’énergie s’exprime en mégatonnes ; plus l’impact est énergique, plus il est rare.',
    'A 1.5 km impactor at 20 km·s⁻¹ digs a cavity ten times its own width in a few tens of seconds, then the walls collapse: the final crater is some fifteen times the impactor (22 km here). Below about 3 km it is a bowl (simple crater, like Meteor Crater); above, a complex crater, flat-floored and shallow for its width. The diameter grows as the 0.78 power of the size, but only as the 0.44 power of the speed: doubling the size counts far more than doubling the speed. The energy is given in megatons; the more energetic the impact, the rarer it is.',
  ],
  libration: [
    'La Lune tourne sur elle-même en un mois, d’un mouvement parfaitement régulier, mais elle parcourt son orbite elliptique plus vite près de la Terre (périgée) que loin d’elle : sa rotation prend tantôt de l’avance, tantôt du retard sur sa course, et l’on voit un peu plus loin derrière le bord est, puis derrière le bord ouest (jusqu’à 6,3° ici, 7,9° pour la vraie Lune que le Soleil perturbe). Son équateur étant incliné de 6,68° sur son orbite, on voit aussi tour à tour au-delà de chaque pôle. Au total, au fil des années, on finit par voir près de 59 % de sa surface. Une Lune qui ne tournerait pas nous montrerait tout en un mois.',
    'The Moon spins once a month at a perfectly steady rate, but it travels its elliptical orbit faster near the Earth (perigee) than far from it: its rotation runs now ahead, now behind its motion, and we see a little further beyond the eastern edge, then beyond the western edge (up to 6.3° here, 7.9° for the real Moon, perturbed by the Sun). As its equator is tilted by 6.68° to its orbit, we also see beyond each pole in turn. Altogether, over the years, we end up seeing nearly 59% of its surface. A Moon that did not spin would show us everything within a month.',
  ],
  precession: [
    'L’axe de la Terre ne reste pas fixe parmi les étoiles : attiré par la Lune et le Soleil sur son renflement équatorial, il décrit lentement un cône, comme une toupie, en 25 772 ans. Le pôle céleste fait donc le tour du pôle de l’écliptique : aujourd’hui près de Polaris (au plus près en 2100, à 0,46°), il était près de Thuban quand on bâtissait les pyramides et passera à 5° de Véga vers l’an 13 800. Le point vernal recule de 50″ par an : au temps d’Hipparque, qui découvrit la précession vers −130, l’équinoxe de mars tombait dans le Bélier ; il est dans les Poissons et passera dans le Verseau vers 2600. Les signes du zodiaque, eux, sont restés attachés à l’équinoxe.',
    'The Earth’s axis does not stay fixed among the stars: pulled by the Moon and the Sun on its equatorial bulge, it slowly sweeps a cone, like a spinning top, in 25,772 years. The celestial pole therefore goes round the ecliptic pole: near Polaris today (closest in 2100, at 0.46°), it was near Thuban when the pyramids were built and will pass 5° from Vega around the year 13,800. The vernal point moves back by 50″ a year: in the time of Hipparchus, who discovered precession around −130, the March equinox fell in Aries; it is in Pisces and will move into Aquarius around 2600. The signs of the zodiac, for their part, stayed attached to the equinox.',
  ],
  resonances: [
    'Dans le repère qui tourne avec Jupiter, un astéroïde en résonance repasse toujours aux mêmes endroits : un Hilda (3 tours pendant que Jupiter en fait 2) dessine un triangle dont les pointes évitent Jupiter, un troyen oscille autour de L4. Ces résonances-là protègent l’astéroïde ; d’autres (3:1, 2:1) le poussent au contraire, petit à petit, et vident les lacunes de Kirkwood. Le jumeau, lâché 78 km plus loin, montre la différence entre ordre et chaos : sur une orbite régulière, l’écart grandit lentement ; quand l’astéroïde frôle Jupiter, il est multiplié par mille en quelques orbites, et l’on ne peut plus prévoir sa trajectoire.',
    'In the frame rotating with Jupiter, a resonant asteroid always comes back to the same places: a Hilda (3 turns while Jupiter makes 2) draws a triangle whose tips avoid Jupiter, a Trojan swings around L4. These resonances protect the asteroid; others (3:1, 2:1) on the contrary push it, little by little, and empty the Kirkwood gaps. The twin, released 78 km away, shows the difference between order and chaos: on a regular orbit the distance grows slowly; when the asteroid skims past Jupiter, it is multiplied by a thousand within a few orbits, and its path can no longer be predicted.',
  ],
  roche: [
    'La planète attire plus fort la face du satellite tournée vers elle que la face opposée : c’est la marée, qui étire le satellite le long de la ligne qui les joint. Loin de la planète, sa propre gravité le tient sans peine ; mais la marée croît comme l’inverse du cube de la distance. Sous la limite de Roche, 2,44 R ∛(ρₚ/ρₛ) pour un satellite fluide, elle l’emporte : les grains se séparent et, comme ceux qui sont plus près de la planète tournent plus vite, ils s’étalent en anneau. Les anneaux de Saturne sont à l’intérieur de sa limite de Roche, ses satellites à l’extérieur ; Phobos, qui descend vers Mars, finira en anneau.',
    'The planet pulls harder on the side of the satellite facing it than on the far side: that is the tide, which stretches the satellite along the line joining them. Far from the planet, the satellite’s own gravity holds it together easily; but the tide grows as the inverse cube of the distance. Below the Roche limit, 2.44 R ∛(ρₚ/ρₛ) for a fluid satellite, it wins: the grains drift apart and, since those closer to the planet move faster, they spread into a ring. Saturn’s rings lie inside its Roche limit, its moons outside; Phobos, spiralling in towards Mars, will end up as a ring.',
  ],
  secularprecession: [
    'L’orbite d’un géocroiseur ne reste pas en place : tirée par Jupiter et Saturne, sa ligne des apsides avance de quelques secondes d’arc par an, et sa ligne des nœuds recule d’autant. Elle ne perce l’écliptique qu’en deux points, les nœuds ; une collision avec la Terre n’est possible que si l’un d’eux est sur l’orbite terrestre. Suivez les courbes : les nœuds passent à 1 ua quatre fois par tour de ω (quelques dizaines de milliers d’années), et la distance minimale entre les orbites (MOID) tombe alors presque à zéro. Entre deux de ces époques, l’astéroïde, même s’il « croise » l’orbite terrestre vu de dessus, passe au-dessus ou au-dessous d’elle.',
    'The orbit of a near-Earth asteroid does not stay put: pulled by Jupiter and Saturn, its line of apsides advances by a few arcseconds per year, and its line of nodes regresses by as much. It pierces the ecliptic at only two points, the nodes; a collision with the Earth is only possible if one of them lies on the Earth’s orbit. Follow the curves: the nodes pass 1 au four times per turn of ω (a few tens of thousands of years), and the minimum orbit intersection distance (MOID) then drops almost to zero. Between those epochs, the asteroid, even if it “crosses” the Earth’s orbit seen from above, passes above or below it.',
  ],
  mutualevents: [
    'Les satellites galiléens tournent presque dans le plan de l’équateur de Jupiter, que la Terre et le Soleil ne traversent que tous les six ans. Au voisinage de ces dates, vus de la Terre, deux satellites alignés peuvent se cacher l’un l’autre (occultation) ; vus du Soleil, l’un peut faire de l’ombre à l’autre (éclipse, avec une pénombre car le Soleil n’est pas un point). L’éclat total de la paire baisse alors de quelques dizaines de pour cent pendant quelques minutes à une heure : la forme de cette courbe de lumière donne la position relative des deux satellites à quelques kilomètres près. Augmentez B : au-delà de quelques dixièmes de degré, les disques ne se touchent plus.',
    'The Galilean satellites orbit almost in the plane of Jupiter’s equator, which the Earth and the Sun cross only every six years. Around those dates, seen from the Earth, two aligned satellites can hide one another (occultation); seen from the Sun, one can cast its shadow on the other (eclipse, with a penumbra since the Sun is not a point). The total brightness of the pair then drops by a few tens of per cent for a few minutes to an hour: the shape of this light curve gives the relative position of the two satellites to within a few kilometres. Increase B: beyond a few tenths of a degree, the discs no longer touch.',
  ],
  meteoroidtrails: [
    'À chaque passage près du Soleil, la comète lâche un nuage de grains un peu plus rapides ou plus lents qu’elle : leurs périodes diffèrent, et le nuage s’étire en une traînée le long de l’orbite, d’autant plus vite que les grains sont petits (la lumière du Soleil les pousse). La Terre traverse l’essaim chaque année au même jour, mais ne rencontre beaucoup de grains que lorsqu’une traînée jeune et encore dense passe au nœud en même temps qu’elle : c’est pourquoi les averses de Léonides suivent les retours de la comète (1833, 1866, 1966, 1999). Sur le diagramme, chaque point est un grain au nœud : Δt, son avance ou son retard sur la Terre ; Δr, sa distance à l’orbite terrestre.',
    'At each passage near the Sun, the comet releases a cloud of grains slightly faster or slower than itself: their periods differ, and the cloud stretches into a trail along the orbit, all the faster as the grains are small (sunlight pushes them). The Earth crosses the stream every year on the same day, but meets many grains only when a young, still dense trail passes the node at the same time: that is why Leonid storms follow the comet’s returns (1833, 1866, 1966, 1999). On the diagram, each point is a grain at the node: Δt, how far ahead of or behind the Earth it is; Δr, its distance from the Earth’s orbit.',
  ],
};
