/**
 * Propriétés stellaires (transposition de hr.py de Coupole) : relations physiques exactes (Stefan-Boltzmann,
 * constantes solaires de l'UAI 2015, Pogson, Doppler, mouvement propre) et étalonnages empiriques de l'original
 * ClassAction repris tels quels (température selon le type spectral, corrections bolométriques, classes de
 * luminosité, couleur d'affichage).
 */
import { nombre } from '../noyau/format';

export const SIGMA = 5.670_374_419e-8;
export const R_SOLEIL_M = 6.957e8;
export const L_SOLEIL_W = 3.828e26;
export const T_SOLEIL = (L_SOLEIL_W / (4 * Math.PI * R_SOLEIL_M ** 2 * SIGMA)) ** 0.25;
export const MBOL_SOLEIL = 4.74;
export const C_KM_S = 299_792.458;
export const UA_PAR_AN_KM_S = 149_597_870.7 / (365.25 * 86_400);

// ---------------------------------------------------------------- physique exacte
export function luminosite_solaire(rayon_rsol: number, temperature: number): number {
  return rayon_rsol ** 2 * (temperature / T_SOLEIL) ** 4;
}

export function puissance_w(rayon_m: number, temperature: number): number {
  return 4 * Math.PI * rayon_m ** 2 * SIGMA * temperature ** 4;
}

export function rayon_solaire(luminosite_lsol: number, temperature: number): number {
  return Math.sqrt(luminosite_lsol) / (temperature / T_SOLEIL) ** 2;
}

export function flux(puissance: number, distance: number): number {
  return puissance / (4 * Math.PI * distance ** 2);
}

export function mbol_de_log_lum(log_l: number): number {
  return MBOL_SOLEIL - 2.5 * log_l;
}

export function log_lum_de_mbol(mbol: number): number {
  return (MBOL_SOLEIL - mbol) / 2.5;
}

export function vitesse_radiale(lambda_obs: number, lambda_repos: number, relativiste = false): number {
  if (relativiste) {
    const r = lambda_obs / lambda_repos;
    return (C_KM_S * (r * r - 1)) / (r * r + 1);
  }
  return (C_KM_S * (lambda_obs - lambda_repos)) / lambda_repos;
}

export function vitesse_transverse(mouvement_propre_arcsec_an: number, distance_pc: number): number {
  return UA_PAR_AN_KM_S * mouvement_propre_arcsec_an * distance_pc;
}

// ---------------------------------------------------------------- étalonnages empiriques de l'original
const TABLES_TYPES: Record<string, readonly [number, number][]> = {
  V: [
    [7, 38000], [9, 33200], [9.5, 31450], [10, 29700], [11, 25600], [12, 22300], [13, 19000], [14, 17200],
    [15, 15400], [16, 14100], [17, 13000], [18, 11800], [19, 10700], [20, 9480], [22, 8810], [25, 8160],
    [27, 7930], [30, 7020], [32, 6750], [35, 6530], [37, 6240], [40, 5930], [42, 5830], [44, 5740],
    [46, 5620], [50, 5240], [52, 5010], [54, 4560], [55, 4340], [57, 4040], [60, 3800], [61, 3680],
    [62, 3530], [63, 3380], [64, 3180], [65, 3030], [66, 2850],
  ],
  III: [
    [40, 5910], [44, 5190], [46, 5050], [48, 4960], [50, 4810], [51, 4610], [52, 4500], [53, 4320],
    [54, 4080], [55, 3980], [60, 3820], [61, 3780], [62, 3710], [63, 3630], [64, 3560], [65, 3420],
    [66, 3250],
  ],
  I: [
    [9, 32500], [10, 26000], [11, 20700], [12, 17800], [13, 15600], [14, 13900], [15, 13400], [16, 12700],
    [17, 12000], [18, 11200], [19, 10500], [20, 9730], [21, 9230], [22, 9080], [25, 8510], [30, 7700],
    [32, 7170], [35, 6640], [38, 6100], [40, 5510], [43, 4980], [48, 4590], [50, 4420], [51, 4330],
    [52, 4260], [53, 4130], [55, 3850], [60, 3650], [61, 3550], [62, 3450], [63, 3200], [64, 2980],
  ],
};
export const LETTRES = 'OBAFGKM';

/** Type spectral numérique (O0 = 0, B0 = 10 … M9 = 69) → « G2 », « B9,5 ». */
export function nom_type(x: number): string {
  const lettre = LETTRES[Math.max(0, Math.min(6, Math.trunc(Math.floor(x / 10))))]!;
  const n = x - 10 * Math.floor(x / 10);
  return lettre + (Math.abs(n - pround0(n)) < 1e-9 ? String(Math.trunc(pround0(n))) : nombre(n, 1));
}

function pround0(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/** Température effective (K) par interpolation linéaire dans la table de l'original (classes V, III, I). */
export function temperature_de_type(x: number, classe = 'V'): number {
  const t = TABLES_TYPES[classe]!;
  let i = 0;
  while (i < t.length && x >= t[i]![0]) i += 1;
  const [i1, i2] = i === 0 ? [0, 1] : i === t.length ? [t.length - 2, t.length - 1] : [i - 1, i];
  const [x1, y1] = t[i1]!;
  const [x2, y2] = t[i2]!;
  return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
}

type Coef = readonly [number, number, number, number];

function poly(x: number, morceaux: readonly [number, Coef][], dernier: Coef): number {
  for (const [borne, c] of morceaux) if (x < borne) return c[0] + x * (c[1] + x * (c[2] + x * c[3]));
  return dernier[0] + x * (dernier[1] + x * (dernier[2] + x * dernier[3]));
}

export function log_temp_de_type(x: number): number {
  return poly(
    x,
    [
      [8.5167, [4.7009, -0.01, 0.0000392, -0.00014247]],
      [16.1, [4.4348, 0.08374, -0.010967, 0.000288299]],
      [23.2167, [6.0516, -0.21754, 0.007746, -0.000099133]],
      [34.1833, [5.0538, -0.08861, 0.0021924, -0.000019396]],
      [50.5108, [4.7553, -0.06241, 0.0014259, -0.000011922]],
      [57.9775, [1.1584, 0.15122, -0.0028034, 0.000015988]],
      [64.3942, [26.4612, -1.15805, 0.019779, -0.000113846]],
    ],
    [-115.7858, 5.46896, -0.0831343, 0.000418879],
  );
}

export function correction_bolometrique(log_t: number): number {
  return poly(
    log_t,
    [
      [3.588, [-1873.0763, 1364.8081, -328.11949, 25.958485]],
      [3.6978, [-4208.8678, 3317.811, -872.43468, 76.5266]],
      [3.7957, [-2920.8124, 2272.8215, -589.83737, 51.052264]],
      [3.903, [1749.5431, -1418.5107, 382.67484, -34.353217]],
      [4.1317, [-2011.2742, 1472.2021, -357.96384, 28.900577]],
    ],
    [123.5421, -77.8864, 17.20884, -1.367489],
  );
}

export const CLASSES: Record<number, [number, number]> = { 1: [3.39, 4.65], 2: [3.39, 4.45], 3: [3.38, 4.3], 4: [3.38, 4.0], 5: [3.359, 4.701] };

export function log_lum_classe(log_t: number, classe: number): number {
  const x = log_t;
  let c: Coef;
  if (classe === 1) c = x < 4.1476 ? [44.8387, -30.1309, 7.59468, -0.636977] : [-459.5864, 334.7205, -80.37116, 6.432557];
  else if (classe === 2) c = x < 4.0358 ? [-36.2843, 39.6781, -12.545, 1.280459] : [-37.0612, 40.2556, -12.68811, 1.292279];
  else if (classe === 3) c = x < 3.9092 ? [-53.8721, 59.2071, -19.71611, 2.108195] : [161.9073, -106.3856, 22.64341, -1.503738];
  else if (classe === 4) c = x < 4.1372 ? [-167.256, 125.271, -31.96691, 2.804002] : [54.567, -35.5787, 6.91186, -0.328444];
  else
    return poly(
      x,
      [
        [3.5081, [-4686.707, 4157.5332, -1232.05177, 121.875554]],
        [3.5799, [22801.9307, -19349.4898, 5468.65774, -514.806626]],
        [3.728, [-9950.2659, 8097.5483, -2198.40972, 199.100683]],
        [3.8287, [10594.1896, -8435.0942, 2236.33537, -197.427256]],
        [3.9156, [-7990.8168, 6127.2576, -1567.12652, 133.707956]],
        [4.2129, [277.0365, -207.2491, 50.62412, -4.009536]],
        [4.6015, [-280.446, 189.7309, -43.6049, 3.446011]],
      ],
      [-9724.5727, 6346.9359, -1381.69136, 100.377185],
    );
  return c[0] + x * (c[1] + x * (c[2] + x * c[3]));
}

export function position_hr(type_num: number, mv: number): [number, number] {
  const lt = log_temp_de_type(type_num);
  return [lt, log_lum_de_mbol(mv + correction_bolometrique(lt))];
}

/** Couleur d'affichage d'une étoile (polynômes de l'original, du rouge à 1 000 K au bleu à 40 000 K). */
export function couleur_rvb(temperature: number): [number, number, number] {
  const t = Math.max(1000.0, Math.min(40000.0, temperature));
  const lt = Math.log10(t);
  const r = 22686.34111 - lt * 15082.52755 + lt * lt * 3375.333832 - lt ** 3 * 252.4073853;
  const g =
    t <= 6500
      ? -811.6499145 + lt * 36.97365953 + lt * lt * 160.7861677 - lt ** 3 * 25.57573664
      : 13836.23586 - lt * 9069.078214 + lt * lt * 2015.254756 - lt ** 3 * 149.7766966;
  const b = -11545.34298 + lt * 8529.658165 - lt * lt * 2150.198586 + lt ** 3 * 190.0306573;
  return [r, g, b].map((v) => Math.trunc(Math.max(0, Math.min(255, v)))) as [number, number, number];
}
