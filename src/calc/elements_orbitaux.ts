/**
 * Éléments d'une orbite képlérienne autour de la Terre — jumeau de `coupole/modules/anim/elements_orbitaux.py` de
 * Coupole (mêmes formules, mêmes nombres) : équation de Kepler, anomalie vraie, rotation Rz(Ω) Rx(i) Rz(ω) vers le
 * repère équatorial, vis-viva, point sous le satellite (la Terre tourne en un jour sidéral).
 */
import * as astro from './astro';

export const MU_KM3_S2 = astro.GM_TERRE / 1e9;
export const R_TERRE_KM = astro.R_TERRE_KM;
export const JOUR_SIDERAL_S = 86_164.0905;
export const OMEGA_TERRE = (2.0 * Math.PI) / JOUR_SIDERAL_S;
const RAD = Math.PI / 180;

/** Orbites types : clé → [a en km, e, i, Ω, ω en degrés] (même ordre que Coupole). */
export const ORBITES: [string, [number, number, number, number, number]][] = [
  ['iss', [6_795.0, 0.0005, 51.64, 45.0, 60.0]],
  ['polaire', [7_178.0, 0.001, 98.6, 45.0, 90.0]],
  ['gps', [26_560.0, 0.01, 55.0, 45.0, 60.0]],
  ['molniya', [26_562.0, 0.74, 63.4, 45.0, 270.0]],
  ['geo', [42_164.0, 0.0, 0.0, 0.0, 0.0]],
];

export type M3 = [[number, number, number], [number, number, number], [number, number, number]];
export type P3 = [number, number, number];

export function periode_s(a_km: number): number {
  return 2.0 * Math.PI * Math.sqrt(a_km ** 3 / MU_KM3_S2);
}

export function demi_grand_axe_de_periode(t_s: number): number {
  return (MU_KM3_S2 * (t_s / (2.0 * Math.PI)) ** 2) ** (1.0 / 3.0);
}

export function vitesse(r_km: number, a_km: number): number {
  return Math.sqrt(MU_KM3_S2 * (2.0 / r_km - 1.0 / a_km));
}

export function rotation(i: number, om: number, w: number): M3 {
  const ci = Math.cos(i * RAD),
    si = Math.sin(i * RAD);
  const co = Math.cos(om * RAD),
    so = Math.sin(om * RAD);
  const cw = Math.cos(w * RAD),
    sw = Math.sin(w * RAD);
  return [
    [co * cw - so * sw * ci, -co * sw - so * cw * ci, so * si],
    [so * cw + co * sw * ci, -so * sw + co * cw * ci, -co * si],
    [sw * si, cw * si, ci],
  ];
}

export function appliquer(m: M3, v: readonly number[]): P3 {
  return [0, 1, 2].map((k) => m[k]![0] * v[0]! + m[k]![1] * v[1]! + m[k]![2] * v[2]!) as P3;
}

const mod360 = (x: number): number => ((x % 360) + 360) % 360;

export interface Etat {
  E: number;
  nu: number;
  r: number;
  v: number;
  pos: P3;
  vit: P3;
}

export function etat(a: number, e: number, i: number, om: number, w: number, m_deg: number): Etat {
  const m = mod360(m_deg) * RAD;
  const ee = astro.resoudre_kepler(m, e);
  const nu = 2.0 * Math.atan2(Math.sqrt(1.0 + e) * Math.sin(ee / 2.0), Math.sqrt(1.0 - e) * Math.cos(ee / 2.0));
  const r = a * (1.0 - e * Math.cos(ee));
  const p = a * (1.0 - e * e);
  const h = Math.sqrt(MU_KM3_S2 * p);
  const rot = rotation(i, om, w);
  return {
    E: mod360(ee / RAD),
    nu: mod360(nu / RAD),
    r,
    v: vitesse(r, a),
    pos: appliquer(rot, [r * Math.cos(nu), r * Math.sin(nu), 0.0]),
    vit: appliquer(rot, [(-MU_KM3_S2 / h) * Math.sin(nu), (MU_KM3_S2 / h) * (e + Math.cos(nu)), 0.0]),
  };
}

export function point_orbite(a: number, e: number, rot: M3, nu_deg: number): P3 {
  const nu = nu_deg * RAD;
  const r = (a * (1.0 - e * e)) / (1.0 + e * Math.cos(nu));
  return appliquer(rot, [r * Math.cos(nu), r * Math.sin(nu), 0.0]);
}

export function sous_satellite(pos: readonly number[], t_s: number): [number, number] {
  const [x, y, z] = pos as P3;
  const lat = Math.atan2(z, Math.hypot(x, y)) / RAD;
  const lon = (Math.atan2(y, x) - OMEGA_TERRE * t_s) / RAD;
  return [lat, mod360(lon + 180.0) - 180.0];
}

export function trace_au_sol(a: number, e: number, i: number, om: number, w: number, m0_deg: number, t0_s: number, t1_s: number, n = 400): [number, number][] {
  const nmoy = 360.0 / periode_s(a);
  const out: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const t = t0_s + ((t1_s - t0_s) * k) / n;
    out.push(sous_satellite(etat(a, e, i, om, w, m0_deg + nmoy * t).pos, t));
  }
  return out;
}

export function genre_orbite(a: number, e: number, i: number): string {
  if (a * (1.0 - e) < R_TERRE_KM) return 'heurte';
  const synchrone = Math.abs(periode_s(a) - JOUR_SIDERAL_S) < 0.005 * JOUR_SIDERAL_S;
  if (synchrone && e < 0.01 && i < 1.0) return 'geostationnaire';
  if (synchrone) return 'geosynchrone';
  if (Math.abs(i - 90.0) <= 10.0) return 'polaire';
  return i > 90.0 ? 'retrograde' : 'prograde';
}
