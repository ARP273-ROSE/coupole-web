/**
 * Position de la Lune : l'algorithme de Meeus (Astronomical Algorithms, 2e éd., chap. 47), tel que l'implémente
 * ERFA (eraMoon98, licence BSD à trois clauses, © NumFOCUS Foundation ; dérivé de SOFA) — mêmes tables, même
 * arrondi des coefficients — puis nutation (Meeus chap. 22, termes principaux), écliptique et équateur VRAIS de la
 * date et temps sidéral apparent de Greenwich (UT1 ≈ UTC).  Précision : quelques secondes d'arc et quelques km
 * (ERFA : 2,9″ et 6,1 km en écart quadratique moyen sur 1950-2100), assez pour comparer à des élévations relevées
 * dans Stellarium.  TT = UTC + 69,184 s (aucune seconde intercalaire depuis 2017).
 */
const RAD = Math.PI / 180;
const UA_KM = 149597870.7;

// [D, M, M′, F, coefficient de sin pour la longitude (°), coefficient de cos pour la distance (m)]
const TLR: readonly (readonly [number, number, number, number, number, number])[] = [
  [0, 0, 1, 0, 6.288774, -20905355.0], [2, 0, -1, 0, 1.274027, -3699111.0], [2, 0, 0, 0, 0.658314, -2955968.0],
  [0, 0, 2, 0, 0.213618, -569925.0], [0, 1, 0, 0, -0.185116, 48888.0], [0, 0, 0, 2, -0.114332, -3149.0],
  [2, 0, -2, 0, 0.058793, 246158.0], [2, -1, -1, 0, 0.057066, -152138.0], [2, 0, 1, 0, 0.053322, -170733.0],
  [2, -1, 0, 0, 0.045758, -204586.0], [0, 1, -1, 0, -0.040923, -129620.0], [1, 0, 0, 0, -0.03472, 108743.0],
  [0, 1, 1, 0, -0.030383, 104755.0], [2, 0, 0, -2, 0.015327, 10321.0], [0, 0, 1, 2, -0.012528, 0.0],
  [0, 0, 1, -2, 0.01098, 79661.0], [4, 0, -1, 0, 0.010675, -34782.0], [0, 0, 3, 0, 0.010034, -23210.0],
  [4, 0, -2, 0, 0.008548, -21636.0], [2, 1, -1, 0, -0.007888, 24208.0], [2, 1, 0, 0, -0.006766, 30824.0],
  [1, 0, -1, 0, -0.005163, -8379.0], [1, 1, 0, 0, 0.004987, -16675.0], [2, -1, 1, 0, 0.004036, -12831.0],
  [2, 0, 2, 0, 0.003994, -10445.0], [4, 0, 0, 0, 0.003861, -11650.0], [2, 0, -3, 0, 0.003665, 14403.0],
  [0, 1, -2, 0, -0.002689, -7003.0], [2, 0, -1, 2, -0.002602, 0.0], [2, -1, -2, 0, 0.00239, 10056.0],
  [1, 0, 1, 0, -0.002348, 6322.0], [2, -2, 0, 0, 0.002236, -9884.0], [0, 1, 2, 0, -0.00212, 5751.0],
  [0, 2, 0, 0, -0.002069, 0.0], [2, -2, -1, 0, 0.002048, -4950.0], [2, 0, 1, -2, -0.001773, 4130.0],
  [2, 0, 0, 2, -0.001595, 0.0], [4, -1, -1, 0, 0.001215, -3958.0], [0, 0, 2, 2, -0.00111, 0.0],
  [3, 0, -1, 0, -0.000892, 3258.0], [2, 1, 1, 0, -0.00081, 2616.0], [4, -1, -2, 0, 0.000759, -1897.0],
  [0, 2, -1, 0, -0.000713, -2117.0], [2, 2, -1, 0, -0.0007, 2354.0], [2, 1, -2, 0, 0.000691, 0.0],
  [2, -1, 0, -2, 0.000596, 0.0], [4, 0, 1, 0, 0.000549, -1423.0], [0, 0, 4, 0, 0.000537, -1117.0],
  [4, -1, 0, 0, 0.00052, -1571.0], [1, 0, -2, 0, -0.000487, -1739.0], [2, 1, 0, -2, -0.000399, 0.0],
  [0, 0, 2, -2, -0.000381, -4421.0], [1, 1, 1, 0, 0.000351, 0.0], [3, 0, -2, 0, -0.00034, 0.0],
  [4, 0, -3, 0, 0.00033, 0.0], [2, -1, 2, 0, 0.000327, 0.0], [0, 2, 1, 0, -0.000323, 1165.0],
  [1, 1, -1, 0, 0.000299, 0.0], [2, 0, 3, 0, 0.000294, 0.0], [2, 0, -1, -2, 0.0, 8752.0],
];
// [D, M, M′, F, coefficient de sin pour la latitude (°)]
const TB: readonly (readonly [number, number, number, number, number])[] = [
  [0, 0, 0, 1, 5.128122], [0, 0, 1, 1, 0.280602], [0, 0, 1, -1, 0.277693], [2, 0, 0, -1, 0.173237],
  [2, 0, -1, 1, 0.055413], [2, 0, -1, -1, 0.046271], [2, 0, 0, 1, 0.032573], [0, 0, 2, 1, 0.017198],
  [2, 0, 1, -1, 0.009266], [0, 0, 2, -1, 0.008822], [2, -1, 0, -1, 0.008216], [2, 0, -2, -1, 0.004324],
  [2, 0, 1, 1, 0.0042], [2, 1, 0, -1, -0.003359], [2, -1, -1, 1, 0.002463], [2, -1, 0, 1, 0.002211],
  [2, -1, -1, -1, 0.002065], [0, 1, -1, -1, -0.00187], [4, 0, -1, -1, 0.001828], [0, 1, 0, 1, -0.001794],
  [0, 0, 0, 3, -0.001749], [0, 1, -1, 1, -0.001565], [1, 0, 0, 1, -0.001491], [0, 1, 1, 1, -0.001475],
  [0, 1, 1, -1, -0.00141], [0, 1, 0, -1, -0.001344], [1, 0, 0, -1, -0.001335], [0, 0, 3, 1, 0.001107],
  [4, 0, 0, -1, 0.001021], [4, 0, -1, 1, 0.000833], [0, 0, 1, -3, 0.000777], [4, 0, -2, 1, 0.000671],
  [2, 0, 0, -3, 0.000607], [2, 0, 2, -1, 0.000596], [2, -1, 1, -1, 0.000491], [2, 0, -2, 1, -0.000451],
  [0, 0, 3, -1, 0.000439], [2, 0, 2, 1, 0.000422], [2, 0, -3, -1, 0.000421], [2, 1, -1, 1, -0.000366],
  [2, 1, 0, 1, -0.000351], [4, 0, 0, 1, 0.000331], [2, -1, 1, 1, 0.000315], [2, -2, 0, -1, 0.000302],
  [0, 0, 1, 3, -0.000283], [2, 1, 1, -1, -0.000229], [1, 1, 0, -1, 0.000223], [1, 1, 0, 1, 0.000223],
  [0, 1, -2, -1, -0.00022], [2, 1, -1, -1, -0.00022], [1, 0, 1, 1, -0.000185], [2, -1, -2, -1, 0.000181],
  [0, 1, 2, 1, -0.000177], [4, 0, -2, -1, 0.000176], [4, -1, -1, -1, 0.000166], [1, 0, 1, -1, -0.000164],
  [4, 0, 1, -1, 0.000132], [1, 0, -1, -1, -0.000119], [4, -1, 0, -1, 0.000115], [2, -2, 0, 1, 0.000107],
];

const poly = (c: number[], t: number): number => c.reduceRight((acc, k) => acc * t + k, 0);
const mod360 = (x: number): number => ((x % 360) + 360) % 360;

export interface Lune {
  /** longitude, latitude écliptiques moyennes de la date (°), distance (km) */
  lambda: number;
  beta: number;
  distance_km: number;
  /** position géocentrique dans le repère terrestre (km) : équateur vrai de la date tourné du temps sidéral */
  terrestre: [number, number, number];
}

export function jourJulien(t: Date): number {
  return t.getTime() / 86_400_000 + 2_440_587.5;
}

export function lunePosition(t: Date): Lune {
  const jdUt = jourJulien(t);
  const jdTt = jdUt + 69.184 / 86400;
  const T = (jdTt - 2451545.0) / 36525;
  const elp = mod360(poly([218.31665436, 481267.88123421, -0.0015786, 1 / 538841, -1 / 65194000], T)) * RAD;
  const d = mod360(poly([297.8501921, 445267.1114034, -0.0018819, 1 / 545868, 1 / 113065000], T)) * RAD;
  const em = mod360(poly([357.5291092, 35999.0502909, -0.0001536, 1 / 24490000, 0], T)) * RAD;
  const emp = mod360(poly([134.9633964, 477198.8675055, 0.0087414, 1 / 69699, -1 / 14712000], T)) * RAD;
  const f = mod360(poly([93.272095, 483202.0175233, -0.0036539, 1 / 3526000, 1 / 863310000], T)) * RAD;
  const a1 = (119.75 + 131.849 * T) * RAD;
  const a2 = (53.09 + 479264.29 * T) * RAD;
  const a3 = (313.45 + 481266.484 * T) * RAD;
  const e = 1 + (-0.002516 - 0.0000074 * T) * T;
  const facteur = (m: number): number => (Math.abs(m) === 1 ? e : Math.abs(m) === 2 ? e * e : 1);
  let vl = 0.003958 * Math.sin(a1) + 0.001962 * Math.sin(elp - f) + 0.000318 * Math.sin(a2);
  let vr = 0;
  let vb = -0.002235 * Math.sin(elp) + 0.000382 * Math.sin(a3) + 0.000175 * Math.sin(a1 - f) + 0.000175 * Math.sin(a1 + f) + 0.000127 * Math.sin(elp - emp) - 0.000115 * Math.sin(elp + emp);
  for (let n = TLR.length - 1; n >= 0; n--) {
    const [nd, nm, nmp, nf, cl, cr] = TLR[n]!;
    const arg = nd * d + nm * em + nmp * emp + nf * f;
    vl += cl * Math.sin(arg) * facteur(nm);
    vr += cr * Math.cos(arg) * facteur(nm);
  }
  for (let n = TB.length - 1; n >= 0; n--) {
    const [nd, nm, nmp, nf, cb] = TB[n]!;
    vb += cb * Math.sin(nd * d + nm * em + nmp * emp + nf * f) * facteur(nm);
  }
  const lambda = elp + vl * RAD;
  const beta = vb * RAD;
  const r = (vr + 385000560.0) / 1000;
  // nutation (termes principaux, Meeus chap. 22) et obliquité (IAU 2006)
  const om = (125.04452 - 1934.136261 * T) * RAD;
  const L = (280.4665 + 36000.7698 * T) * RAD;
  const Lp = (218.3165 + 481267.8813 * T) * RAD;
  const dpsi = (-17.2 * Math.sin(om) - 1.32 * Math.sin(2 * L) - 0.23 * Math.sin(2 * Lp) + 0.21 * Math.sin(2 * om)) / 3600;
  const deps = (9.2 * Math.cos(om) + 0.57 * Math.cos(2 * L) + 0.1 * Math.cos(2 * Lp) - 0.09 * Math.cos(2 * om)) / 3600;
  const eps = (poly([84381.406, -46.836769, -0.0001831, 0.0020034, -0.000000576, -0.0000000434], T) / 3600 + deps) * RAD;
  const lv = lambda + dpsi * RAD;
  const x = r * Math.cos(beta) * Math.cos(lv);
  const y = r * (Math.cos(beta) * Math.sin(lv) * Math.cos(eps) - Math.sin(beta) * Math.sin(eps));
  const z = r * (Math.cos(beta) * Math.sin(lv) * Math.sin(eps) + Math.sin(beta) * Math.cos(eps));
  const Tu = (jdUt - 2451545.0) / 36525;
  const gmst = 280.46061837 + 360.98564736629 * (jdUt - 2451545.0) + 0.000387933 * Tu * Tu - (Tu * Tu * Tu) / 38710000;
  const th = mod360(gmst + dpsi * Math.cos(eps)) * RAD;
  return {
    lambda: mod360(lambda / RAD), beta: beta / RAD, distance_km: r,
    terrestre: [x * Math.cos(th) + y * Math.sin(th), -x * Math.sin(th) + y * Math.cos(th), z],
  };
}

export { UA_KM };
