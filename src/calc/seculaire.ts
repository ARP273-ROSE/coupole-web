/**
 * Précession séculaire d'une orbite qui croise celle de la Terre — jumeau de `coupole/modules/anim/seculaire.py` de
 * Coupole (mêmes formules, mêmes nombres) : théorie de Laplace-Lagrange pour une particule test (Murray et Dermott 1999,
 * chap. 7), planètes géantes sur des orbites circulaires et coplanaires : ϖ = ϖ₀ + A t, Ω = Ω₀ − A t,
 * A = (n/4) Σ (m/M☉) α² b⁽¹⁾₃/₂(α) ; nœuds r = a(1 − e²)/(1 ± e cos ω), croisements, distance minimale (MOID).
 */
import { degrees, pmod, radians } from '../noyau/py';

export const DEUX_PI = 2.0 * Math.PI;
export const SEC_PAR_RAD = (180.0 / Math.PI) * 3600.0;
export const N_LAPLACE = 256;
export const AN_DEPART = 2026.0;

/** Planètes géantes : [clé, a (ua), M☉/m]. */
export const GEANTES: readonly [string, number, number][] = [
  ['jupiter', 5.2029, 1047.348_644], ['saturne', 9.5367, 3497.9018], ['uranus', 19.1892, 22_902.98], ['neptune', 30.0699, 19_412.26],
];
/** Géocroiseurs : [clé, a (ua), e, i (°), Ω (°), ω (°)] (SBDB, époque 2026, arrondis). */
export const OBJETS: readonly [string, number, number, number, number, number][] = [
  ['apollo', 1.47, 0.56, 6.35, 35.5, 286.0], ['icare', 1.08, 0.827, 22.8, 87.9, 31.4], ['phaethon', 1.27, 0.89, 22.3, 265.0, 322.0],
  ['adonis', 1.87, 0.764, 1.32, 349.0, 43.7], ['toutatis', 2.54, 0.625, 0.448, 125.0, 278.0],
];

const rad = radians;
const deg = degrees;

export function laplace_b(s: number, j: number, alpha: number, n = N_LAPLACE): number {
  let tot = 0.0;
  for (let k = 0; k < n; k++) {
    const psi = (DEUX_PI * k) / n;
    tot += Math.cos(j * psi) / (1.0 - 2.0 * alpha * Math.cos(psi) + alpha * alpha) ** s;
  }
  return (2.0 * tot) / n;
}

export const moyen_mouvement = (a: number): number => DEUX_PI / (a * Math.sqrt(a));

export function terme(a: number, aj: number, rapport: number): number {
  const al = a / aj;
  return (al * al * laplace_b(1.5, 1, al)) / rapport;
}

export function frequence(a: number): number {
  let s = 0.0;
  for (const [, aj, m] of GEANTES) s += terme(a, aj, m);
  return (moyen_mouvement(a) / 4.0) * s;
}

export function frequence_quadrupole(a: number): number {
  let s = 0.0;
  for (const [, aj, m] of GEANTES) s += (a / aj) ** 3 / m;
  return 0.75 * moyen_mouvement(a) * s;
}

/** [ω, Ω, ϖ] en degrés (0–360) au temps t (années depuis l'époque). */
export function angles(w0: number, o0: number, A: number, t: number): [number, number, number] {
  const d = deg(A * t);
  const o = pmod(o0 - d, 360.0);
  const w = pmod(w0 + 2.0 * d, 360.0);
  return [w, o, pmod(w + o, 360.0)];
}

export function noeuds(a: number, e: number, w_deg: number): [number, number] {
  const p = a * (1.0 - e * e);
  const c = e * Math.cos(rad(w_deg));
  return [p / (1.0 + c), p / (1.0 - c)];
}

export const croise = (a: number, e: number): boolean => a * (1.0 - e) <= 1.0 && 1.0 <= a * (1.0 + e);

export function croisements(a: number, e: number, w0: number, A: number, t0: number, t1: number): [number, string][] {
  if (!croise(a, e) || e <= 0.0 || A <= 0.0) return [];
  let c = (a * (1.0 - e * e) - 1.0) / e;
  c = Math.max(-1.0, Math.min(1.0, c));
  const ac = Math.acos(c);
  const demi = Math.PI / A;
  const out: [number, string][] = [];
  for (const [genre, cible] of [['asc', ac], ['asc', -ac], ['desc', Math.PI - ac], ['desc', Math.PI + ac]] as [string, number][]) {
    const t = (cible - rad(w0)) / (2.0 * A);
    const k = Math.ceil((t0 - t) / demi);
    let tk = t + k * demi;
    while (tk <= t1) {
      out.push([tk, genre]);
      tk += demi;
    }
  }
  out.sort((x, y) => (x[0] !== y[0] ? x[0] - y[0] : x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0));
  return out;
}

function d2(p: number, e: number, ci: number, si: number, w: number, nu: number): number {
  const r = p / (1.0 + e * Math.cos(nu));
  const u = w + nu;
  const cu = Math.cos(u),
    su = Math.sin(u);
  const rho = r * Math.sqrt(cu * cu + su * su * ci * ci);
  const z = r * su * si;
  return (rho - 1.0) ** 2 + z * z;
}

export const N_MOID = 360;
const OR = (Math.sqrt(5.0) - 1.0) / 2.0;

export function moid(a: number, e: number, i_deg: number, w_deg: number, n = N_MOID): number {
  const p = a * (1.0 - e * e);
  const i = rad(i_deg),
    w = rad(w_deg);
  const ci = Math.cos(i),
    si = Math.sin(i);
  const pas = DEUX_PI / n;
  let kmin = 0,
    dmin = Infinity;
  for (let k = 0; k < n; k++) {
    const d = d2(p, e, ci, si, w, k * pas);
    if (d < dmin) {
      kmin = k;
      dmin = d;
    }
  }
  let lo = (kmin - 1) * pas,
    hi = (kmin + 1) * pas;
  let x1 = hi - OR * (hi - lo),
    x2 = lo + OR * (hi - lo);
  let f1 = d2(p, e, ci, si, w, x1),
    f2 = d2(p, e, ci, si, w, x2);
  for (let k = 0; k < 40; k++) {
    if (f1 < f2) {
      hi = x2;
      x2 = x1;
      f2 = f1;
      x1 = hi - OR * (hi - lo);
      f1 = d2(p, e, ci, si, w, x1);
    } else {
      lo = x1;
      x1 = x2;
      f1 = f2;
      x2 = lo + OR * (hi - lo);
      f2 = d2(p, e, ci, si, w, x2);
    }
  }
  return Math.sqrt(Math.min(dmin, f1, f2));
}

export function table_moid(a: number, e: number, i_deg: number, n = 120): number[] {
  const out: number[] = [];
  for (let k = 0; k <= n; k++) out.push(moid(a, e, i_deg, (360.0 * k) / n, 180));
  return out;
}

export function orbite(a: number, e: number, i_deg: number, o_deg: number, w_deg: number, n = 180): [number, number, number][] {
  const i = rad(i_deg),
    o = rad(o_deg),
    w = rad(w_deg);
  const co = Math.cos(o),
    so = Math.sin(o),
    ci = Math.cos(i),
    si = Math.sin(i);
  const p = a * (1.0 - e * e);
  const out: [number, number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const nu = (DEUX_PI * k) / n;
    const r = p / (1.0 + e * Math.cos(nu));
    const u = w + nu;
    const cu = Math.cos(u),
      su = Math.sin(u);
    out.push([r * (co * cu - so * su * ci), r * (so * cu + co * su * ci), r * su * si]);
  }
  return out;
}
