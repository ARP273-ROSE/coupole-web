/**
 * L'assistance gravitationnelle en coniques raccordées — jumeau de `coupole/modules/anim/assistance.py` de Coupole
 * (mêmes formules, mêmes nombres).  Unités : km, s.
 */
import { radians } from '../noyau/py';
export const GM_SOLEIL = 1.327_124_400_18e11;
export const UA = 149_597_870.7;

/** Planètes : [clé, GM (km³ s⁻²), rayon équatorial (km), a (ua)]. */
export const PLANETES: readonly [string, number, number, number][] = [
  ['venus', 324_858.59, 6051.8, 0.723], ['terre', 398_600.44, 6378.1, 1.0], ['mars', 42_828.37, 3396.2, 1.524],
  ['jupiter', 126_686_534.0, 71_492.0, 5.203], ['saturne', 37_931_187.0, 60_268.0, 9.537],
];

export type V2 = [number, number];
export interface Orbite {
  a: number;
  e: number;
  q: number;
  Q: number;
}
export interface Survol {
  V: number;
  r_p: number;
  delta: number;
  e: number;
  b: number;
  u_in: V2;
  u_out: V2;
  n: V2;
  v_in: V2;
  v_out: V2;
  gain: number;
  dv: number;
  v_peri: number;
  orb_in: Orbite;
  orb_out: Orbite;
}

export function planete(cle: string): [number, number, number] {
  const p = PLANETES.find(([k]) => k === cle);
  if (!p) throw new Error(cle);
  return [p[1], p[2], p[3]];
}

export const vitesse_planete = (a_ua: number): number => Math.sqrt(GM_SOLEIL / (a_ua * UA));
export const deviation = (v_inf: number, r_p: number, gm: number): number => 2.0 * Math.asin(1.0 / (1.0 + (r_p * v_inf * v_inf) / gm));

export function survol(cle: string, v_inf: number, r_p_rayons: number, angle_deg: number, derriere: boolean): Survol {
  const [gm, rayon, a] = planete(cle);
  const V = vitesse_planete(a);
  const r_p = r_p_rayons * rayon;
  const ang = radians(angle_deg);
  const u: V2 = [Math.cos(ang), Math.sin(ang)];
  let n: V2 = [-u[1], u[0]];
  if (n[0] !== 0.0 && n[0] < 0.0 !== derriere) n = [-n[0], -n[1]];
  const d = deviation(v_inf, r_p, gm);
  const u_out: V2 = [Math.cos(d) * u[0] - Math.sin(d) * n[0], Math.cos(d) * u[1] - Math.sin(d) * n[1]];
  const v_in: V2 = [V + v_inf * u[0], v_inf * u[1]];
  const v_out: V2 = [V + v_inf * u_out[0], v_inf * u_out[1]];
  const e = 1.0 + (r_p * v_inf * v_inf) / gm;
  const b = r_p * Math.sqrt(1.0 + (2.0 * gm) / (r_p * v_inf * v_inf));
  return {
    V,
    r_p,
    delta: d,
    e,
    b,
    u_in: u,
    u_out,
    n,
    v_in,
    v_out,
    gain: Math.hypot(v_out[0], v_out[1]) - Math.hypot(v_in[0], v_in[1]),
    dv: 2.0 * v_inf * Math.sin(d / 2.0),
    v_peri: Math.sqrt(v_inf * v_inf + (2.0 * gm) / r_p),
    orb_in: orbite_soleil(a, v_in),
    orb_out: orbite_soleil(a, v_out),
  };
}

export function orbite_soleil(a_ua: number, v: V2): Orbite {
  const r = a_ua * UA;
  const [vt, vr] = v;
  const v2 = vt * vt + vr * vr;
  const en = v2 / 2.0 - GM_SOLEIL / r;
  const h = r * vt;
  const e = Math.sqrt(Math.max(0.0, 1.0 + (2.0 * en * h * h) / (GM_SOLEIL * GM_SOLEIL)));
  if (en >= 0.0) return { a: Infinity, e, q: (h * h) / GM_SOLEIL / (1.0 + e) / UA, Q: Infinity };
  const aa = -GM_SOLEIL / (2.0 * en);
  return { a: aa / UA, e, q: (aa * (1.0 - e)) / UA, Q: (aa * (1.0 + e)) / UA };
}

function norme(v: V2): V2 {
  const n = Math.hypot(v[0], v[1]);
  return n > 0.0 ? [v[0] / n, v[1] / n] : [1.0, 0.0];
}

/** Point de l'hyperbole (km, repère de la planète) d'anomalie hyperbolique f. */
export function hyperbole(s: Survol, _gm: number, f: number): V2 {
  const a = s.r_p / (s.e - 1.0);
  const p_ = norme([s.u_in[0] - s.u_out[0], s.u_in[1] - s.u_out[1]]);
  const w = norme([s.u_in[0] + s.u_out[0], s.u_in[1] + s.u_out[1]]);
  const x = a * (s.e - Math.cosh(f));
  const y = a * Math.sqrt(s.e ** 2 - 1.0) * Math.sinh(f);
  return [x * p_[0] + y * w[0], x * p_[1] + y * w[1]];
}

/** Anomalie hyperbolique au temps t (s) après le périastre : e sinh f − f = n t (Newton). */
export function anomalie(s: Survol, gm: number, t: number): number {
  const a = s.r_p / (s.e - 1.0);
  const m = Math.sqrt(gm / a ** 3) * t;
  let f = s.e > 1.0 ? Math.asinh(m / s.e) : 0.0;
  for (let k = 0; k < 60; k++) {
    const d = (s.e * Math.sinh(f) - f - m) / (s.e * Math.cosh(f) - 1.0);
    f -= d;
    if (Math.abs(d) < 1e-13) break;
  }
  return f;
}
