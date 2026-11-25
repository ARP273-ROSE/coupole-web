/**
 * Résonances et chaos : astéroïde et jumeau dans le problème restreint circulaire Soleil-Jupiter — jumeau de
 * `coupole/modules/anim/resonances.py` de Coupole (mêmes formules, mêmes nombres ; intégration : `calc/lagrange.ts`).
 */
import * as lg from './lagrange';
import { radians } from '../noyau/py';

export const A_JUPITER_UA = 5.2026;
export const ANNEE_JUPITER = 11.862;
export const MU_JUPITER = 1.0 / (1.0 + 1047.348_644);
export const DELTA0 = 1e-7;

/** Cas : [clé, a (ua), e, φ₀ (°)]. */
export const CAS: readonly [string, number, number, number][] = [
  ['kirkwood', 2.5, 0.1, 0.0], ['ceinture', 2.3, 0.1, 0.0], ['hilda', 3.97, 0.15, 0.0],
  ['troyen', 5.2026, 0.03, 60.0], ['deux_un', 3.28, 0.1, 90.0], ['comete', 3.6, 0.55, 150.0],
];
export const RESONANCES: readonly [number, number][] = [[1, 1], [3, 2], [2, 1], [7, 3], [5, 2], [3, 1], [4, 1]];

export function etat_initial(a_ua: number, e: number, phi_deg: number, mu: number): lg.Etat {
  const a = a_ua / A_JUPITER_UA;
  const gm = 1.0 - mu;
  const r = a * (1.0 - e);
  const v = Math.sqrt((gm * (1.0 + e)) / r);
  const ph = radians(phi_deg);
  const x = -mu + r * Math.cos(ph),
    y = r * Math.sin(ph);
  const vx_i = -v * Math.sin(ph),
    vy_i = v * Math.cos(ph) - mu;
  return [x, y, vx_i + y, vy_i - x];
}

export function jumeau(s: lg.Etat, delta = DELTA0): lg.Etat {
  return [s[0] + delta, s[1], s[2], s[3]];
}

export function elements(s: lg.Etat, mu: number): [number, number] {
  const [x, y, vx, vy] = s;
  const dx = x + mu,
    dy = y;
  const ux = vx - y,
    uy = vy + x + mu;
  const gm = 1.0 - mu;
  const r = Math.sqrt(dx * dx + dy * dy);
  const v2 = ux * ux + uy * uy;
  const en = v2 / 2.0 - gm / r;
  const rv = dx * ux + dy * uy;
  const ex = ((v2 - gm / r) * dx - rv * ux) / gm;
  const ey = ((v2 - gm / r) * dy - rv * uy) / gm;
  const e = Math.sqrt(ex * ex + ey * ey);
  const a = en < 0.0 ? -gm / (2.0 * en) : Infinity;
  return [a * A_JUPITER_UA, e];
}

export const rapport_periodes = (a_ua: number): number => (A_JUPITER_UA / a_ua) ** 1.5;

export function resonance_proche(a_ua: number): [[number, number], number] {
  let meilleur: [[number, number], number] | null = null;
  for (const [p, q] of RESONANCES) {
    const ar = A_JUPITER_UA * (q / p) ** (2.0 / 3.0);
    const d = (a_ua - ar) / ar;
    if (meilleur === null || Math.abs(d) < Math.abs(meilleur[1])) meilleur = [[p, q], d];
  }
  return meilleur!;
}

export const ecart = (s1: lg.Etat, s2: lg.Etat): number => Math.hypot(s1[0] - s2[0], s1[1] - s2[1]);

export function inertiel(x: number, y: number, t: number): [number, number] {
  const c = Math.cos(t),
    s = Math.sin(t);
  return [c * x - s * y, s * x + c * y];
}

export function avancer(mu: number, s1: lg.Etat, s2: lg.Etat, duree: number): [lg.Etat, lg.Etat, boolean] {
  const [a, c1] = lg.integrer(mu, s1, duree);
  const [b, c2] = lg.integrer(mu, s2, duree);
  return [a, b, c1 || c2];
}
