/**
 * Rotation synchrone et libration de la Lune — jumeau de `coupole/modules/anim/libration.py` de Coupole (mêmes formules,
 * mêmes nombres) : l = ν − M, b = arcsin(sin I sin(ν + ϖ)), part de la surface vue au moins une fois (méthode des
 * azimuts autour du point opposé à la Terre), libration diurne arcsin(R⊕/d).
 */
import { degrees, radians } from '../noyau/py';
export const E_LUNE = 0.0549;
export const I_LUNE = 6.68;
export const MOIS_SIDERAL_J = 27.321_661_55;
export const A_LUNE_KM = 384_400.0;
export const R_TERRE_KM = 6378.137;
export const N_PSI = 120;
export const N_T = 48;
export const N_OMEGA = 6;

/** Formations repères : [clé, latitude (°), longitude (° est)]. */
export const FORMATIONS: readonly [string, number, number][] = [
  ['crisium', 17.0, 59.1], ['tycho', -43.3, -11.4], ['copernic', 9.6, -20.1], ['grimaldi', -5.2, -68.6], ['orientale', -19.4, -92.8],
];

const rad = radians;
const deg = degrees;

export function kepler(m: number, e: number): number {
  let E = e < 0.8 ? m : Math.PI;
  for (let k = 0; k < 50; k++) {
    const d = (E - e * Math.sin(E) - m) / (1.0 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-14) break;
  }
  return E;
}

export function anomalie_vraie(m: number, e: number): number {
  const E = kepler(m, e);
  return 2.0 * Math.atan2(Math.sqrt(1.0 + e) * Math.sin(E / 2.0), Math.sqrt(1.0 - e) * Math.cos(E / 2.0));
}

export function distance(m: number, e: number, a = A_LUNE_KM): number {
  return a * (1.0 - e * Math.cos(kepler(m, e)));
}

export function libration(m: number, e: number, i_deg: number, varpi_deg: number, synchrone = true): [number, number] {
  const nu = anomalie_vraie(m, e);
  const rot = synchrone ? m : 0.0;
  const l = Math.atan2(Math.sin(nu - rot), Math.cos(nu - rot));
  const b = Math.asin(Math.sin(rad(i_deg)) * Math.sin(nu + rad(varpi_deg)));
  return [deg(l), deg(b)];
}

export function direction(l_deg: number, b_deg: number): [number, number, number] {
  const l = rad(l_deg),
    b = rad(b_deg);
  return [Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)];
}

export function fraction_vue(directions: readonly [number, number, number][], rho_deg = 0.0, n_psi = N_PSI): number {
  const s = Math.sin(rad(rho_deg));
  let jamais = 0.0;
  for (let k = 0; k < n_psi; k++) {
    const psi = (2.0 * Math.PI * (k + 0.5)) / n_psi;
    const c = Math.cos(psi),
      sn = Math.sin(psi);
    let amin = Math.PI;
    for (const [sx, sy, sz] of directions) {
      const d = sy * c + sz * sn;
      const r = Math.sqrt(sx * sx + d * d);
      const a = Math.atan2(sx, d) - (r > 0.0 ? Math.asin(Math.min(1.0, s / r)) : 0.0);
      if (a < amin) amin = a;
    }
    if (amin > 0.0) jamais += 1.0 - Math.cos(amin);
  }
  return 1.0 - (jamais * ((2.0 * Math.PI) / n_psi)) / (4.0 * Math.PI);
}

export function directions_cycle(e: number, i_deg: number, varpi_deg: number, synchrone = true, n = N_T): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let j = 0; j < n; j++) out.push(direction(...libration((2.0 * Math.PI * j) / n, e, i_deg, varpi_deg, synchrone)));
  return out;
}

export function fraction_mois(e: number, i_deg: number, varpi_deg: number, synchrone = true, rho_deg = 0.0): number {
  return fraction_vue(directions_cycle(e, i_deg, varpi_deg, synchrone), rho_deg);
}

export function fraction_annees(e: number, i_deg: number, synchrone = true, rho_deg = 0.0): number {
  const d: [number, number, number][] = [];
  for (let k = 0; k < N_OMEGA; k++) d.push(...directions_cycle(e, i_deg, (360.0 * k) / N_OMEGA, synchrone));
  return fraction_vue(d, rho_deg);
}

export function rho_diurne(_e: number): number {
  return deg(Math.asin(R_TERRE_KM / A_LUNE_KM));
}

export function projection(lat_deg: number, lon_deg: number, l_deg: number, b_deg: number): [number, number, number] {
  const la = rad(lat_deg),
    lo = rad(lon_deg - l_deg),
    b = rad(b_deg);
  return [
    Math.cos(la) * Math.sin(lo),
    Math.cos(b) * Math.sin(la) - Math.sin(b) * Math.cos(la) * Math.cos(lo),
    Math.sin(b) * Math.sin(la) + Math.cos(b) * Math.cos(la) * Math.cos(lo),
  ];
}
