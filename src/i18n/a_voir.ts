/**
 * « Ce qu'il faut voir » : pour chaque animation, ce qu'on doit remarquer en la manipulant (FR, EN).
 * Texte propre à Coupole Web ; les descriptions et tous les autres textes sont ceux de Coupole.
 */
import type { Langue } from './i18n';

const A_VOIR: Record<string, [string, string]> = {
  sunmotions: [
    'Le Soleil suit chaque jour un parallèle de déclinaison et culmine au méridien, plein sud sous nos latitudes. Faites défiler les jours : sa course monte en été et descend en hiver, l’azimut du lever glisse vers le nord-est puis le sud-est, et la durée du jour change. Jour par jour à heure fixe, ses positions dessinent l’analemme, un « 8 » dû à l’obliquité et à l’excentricité de l’orbite.',
    'Each day the Sun follows a declination circle and culminates on the meridian, due south at our latitudes. Run through the days: its path rises in summer and sinks in winter, the sunrise azimuth slides toward the north-east then the south-east, and the day length changes. Day by day at a fixed time, its positions draw the analemma, an « 8 » due to the obliquity and the eccentricity of the orbit.',
  ],
  eclipticsimulator: [
    'L’axe de la Terre garde la même direction dans l’espace pendant toute l’année : c’est lui, et non la distance au Soleil, qui fait les saisons. Le point subsolaire monte jusqu’au tropique du Cancer en juin et descend au tropique du Capricorne en décembre. Pour l’observateur, un Soleil haut concentre la lumière sur une petite surface ; bas, le même faisceau s’étale.',
    'The Earth’s axis keeps the same direction in space all year long: it is this, not the distance to the Sun, that makes the seasons. The subsolar point rises to the Tropic of Cancer in June and sinks to the Tropic of Capricorn in December. For the observer, a high Sun concentrates light on a small area; a low one spreads the same beam out.',
  ],
  lunar_applet: [
    'La phase dépend seulement de l’angle Soleil–Terre–Lune : la moitié de la Lune tournée vers le Soleil est toujours éclairée, mais nous n’en voyons qu’une part. Tournez la Lune sur son orbite et comparez avec son aspect et sa place dans le ciel : la pleine lune se lève au coucher du Soleil, le premier quartier est au sud vers 18 h, le dernier quartier vers 6 h.',
    'The phase depends only on the Sun–Earth–Moon angle: the half of the Moon facing the Sun is always lit, but we see only part of it. Turn the Moon on its orbit and compare with its appearance and its place in the sky: the full Moon rises at sunset, the first quarter is due south around 6 pm, the last quarter around 6 am.',
  ],
  sunsrays: [
    'Les rayons du Soleil arrivent parallèles ; celui qui frappe la Terre à angle droit tombe à la latitude égale à la déclinaison du Soleil. Il balaie la zone entre les tropiques au fil de l’année, et les cercles polaires bordent les régions de jour ou de nuit polaire autour des solstices. Aux équinoxes, il atteint l’équateur et le terminateur passe par les deux pôles.',
    'The Sun’s rays arrive parallel; the one that strikes the Earth at a right angle falls at the latitude equal to the Sun’s declination. It sweeps the band between the tropics over the year, and the polar circles bound the regions of polar day or night around the solstices. At the equinoxes it reaches the equator and the terminator passes through both poles.',
  ],
  altazimuth: [
    'L’azimut se compte le long de l’horizon depuis le nord vers l’est, la hauteur depuis l’horizon vers le zénith. Déplacez l’étoile : la distance zénithale vaut 90° moins la hauteur. Ces coordonnées dépendent du lieu et de l’instant : une étoile fixe change sans cesse d’azimut et de hauteur.',
    'Azimuth is measured along the horizon from north toward east, altitude from the horizon toward the zenith. Move the star: the zenith distance is 90° minus the altitude. These coordinates depend on the place and the moment: a fixed star keeps changing its azimuth and altitude.',
  ],
  radecdemo: [
    'L’ascension droite se compte en heures le long de l’équateur céleste, vers l’est depuis le point vernal (cercle horaire 0 h) ; la déclinaison, en degrés depuis l’équateur. Ces coordonnées sont attachées aux étoiles et ne changent pas avec le lieu ni l’heure. L’écliptique, chemin annuel du Soleil, coupe l’équateur au point vernal avec une inclinaison de 23,44°.',
    'Right ascension is counted in hours along the celestial equator, eastward from the vernal point (the 0h hour circle); declination in degrees from the equator. These coordinates are attached to the stars and do not change with place or time. The ecliptic, the Sun’s annual path, crosses the equator at the vernal point with an inclination of 23.44°.',
  ],
  celhorcomp: [
    'Les deux vues décrivent le même instant : à gauche la sphère céleste avec les étoiles fixes et la Terre qui tourne, à droite le ciel de l’observateur qui tourne autour du pôle céleste. Les étoiles assez proches du pôle ne se couchent jamais (circumpolaires), celles du pôle opposé ne se lèvent jamais ; la limite dépend de la latitude.',
    'Both views describe the same moment: on the left the celestial sphere with the fixed stars and the rotating Earth, on the right the observer’s sky turning around the celestial pole. Stars close enough to the pole never set (circumpolar), those near the opposite pole never rise; the boundary depends on the latitude.',
  ],
  siderealTimeAndHourAngleDemo: [
    'Le temps sidéral local est l’ascension droite des étoiles qui passent au méridien. L’angle horaire d’une étoile, H = TSL − α, dit depuis combien de temps elle a culminé (positif vers l’ouest) : H = 0 au méridien, H = ± 6 h près de l’horizon pour une étoile de l’équateur. Faites tourner le ciel et suivez H.',
    'Local sidereal time is the right ascension of the stars crossing the meridian. A star’s hour angle, H = LST − α, tells how long ago it culminated (positive toward west): H = 0 on the meridian, H = ± 6 h near the horizon for a star on the equator. Turn the sky and follow H.',
  ],
  seasonsim: [
    'Sur la carte du ciel, l’écliptique ondule de part et d’autre de l’équateur céleste, jusqu’à ± 23,44°. Le Soleil y avance d’environ 1° par jour : il croise l’équateur aux équinoxes et atteint ses déclinaisons extrêmes aux solstices. Vue de l’intérieur de la sphère, l’ascension droite croît vers la gauche, l’est.',
    'On the sky map the ecliptic waves on either side of the celestial equator, up to ± 23.44°. The Sun moves along it by about 1° per day: it crosses the equator at the equinoxes and reaches its extreme declinations at the solstices. Seen from inside the sphere, right ascension increases toward the left, the east.',
  ],
  obliquity: [
    'L’obliquité est l’angle entre l’axe de rotation et la perpendiculaire au plan de l’orbite, ou entre l’équateur et ce plan. Comparez la Terre (23,4°), Mars (25,2°) et Uranus (97,8°), couchée sur son orbite : au-delà de 90°, la planète tourne à l’envers. L’obliquité terrestre diminue lentement (moins de 0,5″ par an).',
    'Obliquity is the angle between the rotation axis and the perpendicular to the orbital plane, or between the equator and that plane. Compare the Earth (23.4°), Mars (25.2°) and Uranus (97.8°), lying on its orbit: beyond 90° the planet spins backward. The Earth’s obliquity decreases slowly (less than 0.5″ per year).',
  ],
  zodiac: [
    'Vu de la Terre, le Soleil se projette devant une constellation de l’écliptique, qui change au fil de l’année ; à minuit, on voit la constellation opposée. Les limites officielles font traverser 13 constellations, dont Ophiuchus, avec des durées inégales, alors que les signes astrologiques sont 12 secteurs égaux de 30° comptés depuis l’équinoxe : ils ne coïncident plus.',
    'Seen from the Earth, the Sun lies in front of an ecliptic constellation, which changes over the year; at midnight we see the opposite constellation. The official boundaries make the Sun cross 13 constellations, including Ophiuchus, for unequal durations, whereas astrological signs are 12 equal 30° sectors counted from the equinox: they no longer match.',
  ],
  siderealSolarTime: [
    'En un jour solaire, la Terre a avancé d’environ 1° sur son orbite : elle doit tourner un peu plus d’un tour pour ramener le Soleil au méridien. Par rapport aux étoiles, un tour prend 23 h 56 min 4 s : en une année, la Terre fait un tour de plus par rapport aux étoiles qu’au Soleil. Comparez les deux horloges qui se décalent de 4 minutes par jour.',
    'In one solar day the Earth has moved about 1° along its orbit: it must turn a bit more than once to bring the Sun back to the meridian. Relative to the stars, one turn takes 23 h 56 min 4 s: in a year, the Earth makes one more turn relative to the stars than relative to the Sun. Compare the two clocks drifting apart by 4 minutes a day.',
  ],
  latsim: [
    'La hauteur du pôle céleste au-dessus de l’horizon est égale à la latitude. Les étoiles de déclinaison supérieure à 90° − φ sont circumpolaires, celles inférieures à −(90° − φ) ne se lèvent jamais, les autres se lèvent et se couchent. À l’équateur, toutes se lèvent et se couchent ; au pôle, aucune.',
    'The altitude of the celestial pole above the horizon equals the latitude. Stars with declination above 90° − φ are circumpolar, those below −(90° − φ) never rise, the others rise and set. At the equator, all of them rise and set; at the pole, none does.',
  ],
  shadowsim: [
    'Chaque corps éclairé par le Soleil projette une ombre conique (l’umbra), entourée d’une pénombre. Placez la Lune dans l’ombre de la Terre : éclipse de Lune ; placez la Terre dans l’ombre de la Lune : éclipse de Soleil, totale si l’umbra touche la Terre, annulaire si seul son prolongement l’atteint. À la distance de la Lune, l’ombre terrestre mesure environ 2,65 diamètres lunaires.',
    'Every body lit by the Sun casts a conical shadow (the umbra) surrounded by a penumbra. Put the Moon in the Earth’s shadow: lunar eclipse; put the Earth in the Moon’s shadow: solar eclipse, total if the umbra reaches the Earth, annular if only its extension does. At the Moon’s distance the Earth’s shadow is about 2.65 lunar diameters wide.',
  ],
  marsorbit: [
    'Dans le modèle de Ptolémée, Mars tourne sur un épicycle dont le centre parcourt le déférent ; vu de la Terre, la planète recule de temps en temps (mouvement rétrograde), toujours quand elle est à l’opposé du Soleil. Le mouvement est uniforme vu du point équant et non de la Terre : c’est ce qui permet au modèle de suivre les positions observées.',
    'In Ptolemy’s model, Mars turns on an epicycle whose centre travels along the deferent; seen from the Earth, the planet now and then moves backward (retrograde motion), always when it is opposite the Sun. The motion is uniform as seen from the equant point, not from the Earth: this is what lets the model follow the observed positions.',
  ],
  pathtracer: [
    'Le même système vu depuis trois corps différents : vu du jaune, les orbites sont des cercles ; vu du bleu, le rouge décrit des boucles, exactement comme un épicycle. Les deux descriptions donnent les mêmes positions relatives : le choix d’un centre fixe est une question de point de vue, pas d’observation.',
    'The same system seen from three different bodies: from the yellow one the orbits are circles; from the blue one the red body traces loops, exactly like an epicycle. Both descriptions give the same relative positions: choosing a fixed centre is a matter of viewpoint, not of observation.',
  ],
  retrograde: [
    'La Terre, plus rapide sur son orbite intérieure, rattrape Mars puis le dépasse. Autour de l’opposition, la ligne de visée Terre → Mars balaie les étoiles à l’envers : Mars recule vers l’ouest entre deux stations, pendant environ 73 jours et sur environ 16°. L’inclinaison de l’orbite de Mars transforme l’aller-retour en boucle.',
    'The Earth, faster on its inner orbit, catches up with Mars and overtakes it. Around opposition, the Earth → Mars line of sight sweeps the stars backward: Mars moves west between two stationary points, for about 73 days and about 16°. The inclination of Mars’s orbit turns the back-and-forth into a loop.',
  ],
  kepler: [
    'L’orbite est une ellipse dont le Soleil occupe un foyer (1re loi). Lancez le balayage : les aires couvertes en des temps égaux sont égales (2e loi), si bien que la planète va plus vite au périhélie. Changez le demi-grand axe : la période suit P² = a³ (3e loi), et la vitesse la relation de vis-viva.',
    'The orbit is an ellipse with the Sun at one focus (1st law). Start the sweep: areas covered in equal times are equal (2nd law), so the planet moves faster at perihelion. Change the semi-major axis: the period follows P² = a³ (3rd law), and the speed the vis-viva relation.',
  ],
  parallaxdiag: [
    'En six mois, la Terre se déplace de 2 ua : une étoile proche semble bouger sur le fond du ciel. La parallaxe p est l’angle sous lequel on voit 1 ua depuis l’étoile ; la distance en parsecs vaut 1/p (p en secondes d’arc). Même Proxima du Centaure, la plus proche, a une parallaxe inférieure à 1″.',
    'In six months the Earth moves by 2 au: a nearby star seems to shift against the background sky. The parallax p is the angle under which 1 au is seen from the star; the distance in parsecs is 1/p (p in arcseconds). Even Proxima Centauri, the nearest, has a parallax below 1″.',
  ],
  stellarmag: [
    'La magnitude apparente m dépend de l’éclat réel (magnitude absolue M) et de la distance : m − M = 5 log₁₀ d − 5. Une étoile dix fois plus loin paraît 5 magnitudes plus faible, cent fois moins brillante. À 10 pc, m = M ; verrouillez une grandeur et faites varier les deux autres.',
    'The apparent magnitude m depends on the true brightness (absolute magnitude M) and on the distance: m − M = 5 log₁₀ d − 5. A star ten times farther looks 5 magnitudes fainter, a hundred times dimmer. At 10 pc, m = M; lock one quantity and vary the two others.',
  ],
  longlat: [
    'La latitude se lit le long du méridien du lieu, depuis l’équateur ; la longitude le long de l’équateur, depuis le méridien de Greenwich. Déplacez le point : un degré de latitude vaut partout la même distance, alors que les méridiens se resserrent vers les pôles. La ligne de changement de date suit à peu près le méridien 180°, avec des détours pour ne pas couper les pays.',
    'Latitude is read along the local meridian, from the equator; longitude along the equator, from the Greenwich meridian. Move the point: one degree of latitude is the same distance everywhere, whereas meridians converge toward the poles. The International Date Line roughly follows the 180° meridian, with detours so as not to split countries.',
  ],
};

export function aVoir(id: string, l: Langue): string {
  const t = A_VOIR[id];
  return t ? t[l === 'fr' ? 0 : 1] : '';
}

export function idsAvecAVoir(): string[] {
  return Object.keys(A_VOIR);
}
