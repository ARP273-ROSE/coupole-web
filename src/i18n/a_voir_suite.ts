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
    'Vue de la Terre, Orion est une figure plate ; dépliez-la : Tabit est à 8 parsecs, Bellatrix à 77, Bételgeuse à 168, Rigel à 265, et la Ceinture comme la nébuleuse d’Orion vers 380–400 parsecs. Les étoiles d’une constellation n’ont rien à voir entre elles, sauf ici les étoiles chaudes de la Ceinture et de l’Épée, nées du même grand nuage. Les barres d’erreur montrent que la distance d’une étoile brillante reste mal connue : Alnilam et Mintaka saturent Gaia. Plongez vers M42 : le Trapèze éclaire la face avant du nuage Orion A, creusée en bol ouvert vers nous, devant lequel flotte le Voile.',
    'Seen from the Earth, Orion is a flat figure; unfold it: Tabit is 8 parsecs away, Bellatrix 77, Betelgeuse 168, Rigel 265, and the Belt and the Orion Nebula around 380–400 parsecs. The stars of a constellation have nothing to do with one another, except here the hot stars of the Belt and the Sword, born from the same large cloud. The error bars show that the distance of a bright star is still poorly known: Alnilam and Mintaka saturate Gaia. Dive towards M42: the Trapezium lights up the front face of the Orion A cloud, hollowed into a bowl open towards us, with the Veil floating in front.',
  ],
  // ------------------------------------------------------------------ introduction
  lookbacktimesim: [
    'L’explosion n’est vue qu’après le temps que met sa lumière pour nous parvenir : une étoile à 6 500 années-lumière a explosé 6 500 ans avant qu’on la voie. Regarder loin, c’est regarder dans le passé : on voit les astres tels qu’ils étaient, et certains n’existent peut-être plus.',
    'The explosion is only seen after the time its light takes to reach us: a star 6,500 light-years away exploded 6,500 years before we saw it. Looking far is looking back in time: we see objects as they were, and some of them may no longer exist.',
  ],
};
