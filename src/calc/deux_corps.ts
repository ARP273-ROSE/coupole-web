/**
 * Deux corps autour de leur centre de masse : exoplanètes et étoiles doubles (transposition de deux_corps.py de
 * Coupole).  Repère : X, Y dans le plan du ciel, Z vers l'observateur ; le compagnon est devant quand ν + ω = 90°.
 */
import LOT3 from '../donnees/genere/lot3.json';
import { pmod } from '../noyau/py';
import * as astro from './astro';
import * as hr from './hr';

export const G = astro.G_SI;
export const GM_SOLEIL = astro.GM_SOLEIL;
export const GM_JUPITER = 1.266_865_3e17;
export const M_SOLEIL_KG = GM_SOLEIL / G;
export const M_JUPITER_KG = GM_JUPITER / G;
export const R_SOLEIL_M = 6.957e8;
export const R_JUPITER_M = 7.1492e7;
export const UA_M = astro.UA_KM * 1000.0;
export const JOUR_S = 86_400.0;

export function periode_s(a_m: number, m1_kg: number, m2_kg: number): number {
  return 2 * Math.PI * Math.sqrt(a_m ** 3 / (G * (m1_kg + m2_kg)));
}

export function demi_grand_axe_m(p_s: number, m1_kg: number, m2_kg: number): number {
  return (G * (m1_kg + m2_kg) * (p_s / (2 * Math.PI)) ** 2) ** (1 / 3);
}

export function amplitude_k(m1_kg: number, m2_kg: number, a_m: number, e: number, i_deg: number): number {
  const p = periode_s(a_m, m1_kg, m2_kg);
  return (
    ((((2 * Math.PI * G) / p) ** (1 / 3) * m2_kg * Math.sin((i_deg * Math.PI) / 180)) / (m1_kg + m2_kg) ** (2 / 3)) /
    Math.sqrt(1 - e * e)
  );
}

export function anomalie_vraie(phase: number, e: number): number {
  const ee = astro.resoudre_kepler(2 * Math.PI * pmod(phase, 1.0), e);
  return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(ee / 2), Math.sqrt(1 - e) * Math.cos(ee / 2));
}

export function relative(phase: number, a: number, e: number, i_deg: number, omega_deg: number): [number, number, number] {
  const nu = anomalie_vraie(phase, e);
  const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
  const u = nu + (omega_deg * Math.PI) / 180;
  const i = (i_deg * Math.PI) / 180;
  return [r * Math.cos(u), r * Math.sin(u) * Math.cos(i), r * Math.sin(u) * Math.sin(i)];
}

export function vitesse_radiale(phase: number, k: number, e: number, omega_deg: number): number {
  const nu = anomalie_vraie(phase, e);
  const w = (omega_deg * Math.PI) / 180;
  return k * (Math.cos(nu + w) + e * Math.cos(w));
}

export function phase_conjonction(e: number, omega_deg: number): number {
  const nu = ((90.0 - omega_deg) * Math.PI) / 180;
  const ee = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
  return pmod((ee - e * Math.sin(ee)) / (2 * Math.PI), 1.0);
}

export function aire_recouvrement(r1: number, r2: number, d: number): number {
  if (d >= r1 + r2) return 0.0;
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
  const a1 = Math.acos(Math.max(-1.0, Math.min(1.0, (d * d + r1 * r1 - r2 * r2) / (2 * d * r1))));
  const a2 = Math.acos(Math.max(-1.0, Math.min(1.0, (d * d + r2 * r2 - r1 * r1) / (2 * d * r2))));
  return r1 * r1 * (a1 - Math.sin(2 * a1) / 2) + r2 * r2 * (a2 - Math.sin(2 * a2) / 2);
}

export function flux_deux_disques(
  phase: number, r1: number, r2: number, s1: number, s2: number, e: number, i_deg: number, omega_deg: number,
): number {
  const [x, y, z] = relative(phase, 1.0, e, i_deg, omega_deg);
  const d = Math.hypot(x, y);
  const cache = aire_recouvrement(r1, r2, d);
  const total = Math.PI * (r1 * r1 * s1 + r2 * r2 * s2);
  return total - cache * (z > 0 ? s1 : s2);
}

export function duree_transit(
  phase0: number, r1: number, r2: number, e: number, i_deg: number, omega_deg: number, n = 4000,
): number {
  const pas = 1.0 / n;
  let dedans = 0;
  for (let k = Math.floor(-n / 4); k < Math.floor(n / 4); k++) {
    const ph = phase0 + k * pas;
    const [x, y, z] = relative(ph, 1.0, e, i_deg, omega_deg);
    if (z > 0 && Math.hypot(x, y) < r1 + r2) dedans += 1;
  }
  return dedans * pas;
}

// ---------------------------------------------------------------- étoile de la séquence principale (original)
export function luminosite_de_masse(m: number): number {
  return m < 0.43 ? 0.232_220_431_737_728 * m ** 2.26 : m ** 3.99;
}

const POLY_T: readonly [number, readonly number[]][] = [
  [-1.61, [3.76424847491303, 0.140316436337353, 0.0139709648834783, 0.00146257952166353, 0.000114203991057792, 0.00000534009520193973, 1.00897501873505e-7]],
  [0.22, [3.76404749064937, 0.139720836051662, 0.0131949471107482, 0.000878016217920958, -0.00016087678534046, -0.0000718923778642037, -0.0000098430921759891]],
  [1.48, [3.76404935999916, 0.139700505514371, 0.0132834512392025, 0.000681148684168764, 0.0000515647954029831, -0.000230931527900807, 0.0000134429776870977]],
  [2.61, [3.76208682178285, 0.14541668375348, 0.00684584757963743, 0.00396076543835346, -0.000464655201610208, -0.000381007438333072, 0.0000623586254118745]],
  [3.62, [3.7785507438146, 0.129897095940252, 0.00142810707728862, 0.0167045399494531, -0.00693250229182094, 0.00103845665508301, -0.000055992055857869]],
  [5.43, [3.94943146036608, -0.154281251321452, 0.1979230342627, -0.055596100619304, 0.00799539610207913, -0.000600846748510063, 0.0000187770530697032]],
  [Infinity, [4.36797099518548, -0.314871178456464, 0.143399968097621, -0.0130740129137381, -0.00159255369850374, 0.000357973227398207, -0.000017804556980593]],
];

export function temperature_de_luminosite(l: number): number {
  const x = Math.log10(l);
  for (const [b, c] of POLY_T) {
    if (x < b) {
      let v = 0.0;
      for (let i = c.length - 1; i >= 0; i--) v = v * x + c[i]!;
      return 10 ** v;
    }
  }
  throw new RangeError(String(l));
}

export function etoile_sequence_principale(m: number): { L: number; T: number; R: number } {
  const lum = luminosite_de_masse(m);
  const t = temperature_de_luminosite(lum);
  return { L: lum, T: t, R: hr.rayon_solaire(lum, t) };
}

// ---------------------------------------------------------------- planètes du Système solaire (Standish, JPL)
const ELEMENTS_STANDISH = LOT3.elements_standish as unknown as Record<string, [number[], number[]]>;
const GM_DE440 = LOT3.gm_de440 as Record<string, number>;

export function heliocentrique(nom: string, siecles: number): [number, number, number] {
  const [e0, de] = ELEMENTS_STANDISH[nom]!;
  const [a, e, i, l, varpi, om] = e0.map((x, k) => x + de[k]! * siecles) as [number, number, number, number, number, number];
  const w = varpi - om;
  const m = ((pmod(l - varpi + 180.0, 360.0) - 180.0) * Math.PI) / 180;
  const ee = astro.resoudre_kepler(m, e);
  const xp = a * (Math.cos(ee) - e),
    yp = a * Math.sqrt(1 - e * e) * Math.sin(ee);
  const r = Math.PI / 180;
  const cw = Math.cos(w * r),
    sw = Math.sin(w * r);
  const co = Math.cos(om * r),
    so = Math.sin(om * r);
  const ci = Math.cos(i * r),
    si = Math.sin(i * r);
  return [
    (cw * co - sw * so * ci) * xp + (-sw * co - cw * so * ci) * yp,
    (cw * so + sw * co * ci) * xp + (-sw * so + cw * co * ci) * yp,
    sw * si * xp + cw * si * yp,
  ];
}

export function soleil_barycentrique(siecles: number, planetes: readonly string[]): [number, number, number] {
  let tot = GM_DE440.soleil!;
  let sx = 0,
    sy = 0,
    sz = 0;
  for (const nom of planetes) {
    const [x, y, z] = heliocentrique(nom, siecles);
    const g = GM_DE440[nom]!;
    sx += g * x;
    sy += g * y;
    sz += g * z;
    tot += g;
  }
  return [-sx / tot, -sy / tot, -sz / tot];
}

