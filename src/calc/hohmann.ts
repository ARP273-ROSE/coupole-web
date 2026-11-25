/**
 * Transfert de Hohmann entre deux orbites circulaires coplanaires — jumeau de
 * `coupole/modules/anim/hohmann_meca.py` de Coupole (mêmes formules, mêmes nombres).
 */
import * as astro from './astro';

export const MU_TERRE = astro.GM_TERRE / 1e9;
export const MU_SOLEIL = astro.GM_SOLEIL / 1e9;
export const R_T = astro.R_TERRE_KM;
export const UA = astro.UA_KM;

/** Scénarios : [clé, [μ, r₁, r₂, départ, arrivée, cible, avance initiale en degrés]] (ordre de Coupole). */
export const SCENARIOS: [string, [number, number, number, string, string, string, number]][] = [
  ['leo_geo', [MU_TERRE, R_T + 200.0, 42_164.0, 'leo', 'geo', 'geo_sat', 150.0]],
  ['leo_iss', [MU_TERRE, R_T + 200.0, R_T + 417.0, 'leo', 'iss', 'iss', 40.0]],
  ['terre_lune', [MU_TERRE, R_T + 200.0, astro.D_LUNE_KM, 'leo', 'lune', 'lune', 160.0]],
  ['terre_mars', [MU_SOLEIL, UA, 1.523_679 * UA, 'terre', 'mars', 'mars', 150.0]],
  ['terre_venus', [MU_SOLEIL, UA, 0.723_332 * UA, 'terre', 'venus', 'venus', 150.0]],
  ['terre_jupiter', [MU_SOLEIL, UA, 5.202_6 * UA, 'terre', 'jupiter', 'jupiter', 40.0]],
];

export function mod2pi(x: number): number {
  return x - 2.0 * Math.PI * Math.floor(x / (2.0 * Math.PI));
}

const pmod360 = (x: number): number => ((x % 360) + 360) % 360;
const DEG = 180 / Math.PI;

export interface Bilan {
  mu: number;
  a: number;
  e: number;
  v1: number;
  v2: number;
  vd: number;
  va: number;
  dv1: number;
  dv2: number;
  dv: number;
  t: number;
  n1: number;
  n2: number;
  phase: number;
  synodique: number;
}

export function bilan(mu: number, r1: number, r2: number): Bilan {
  const a = 0.5 * (r1 + r2);
  const v1 = Math.sqrt(mu / r1),
    v2 = Math.sqrt(mu / r2);
  const vd = Math.sqrt(mu * (2.0 / r1 - 1.0 / a));
  const va = Math.sqrt(mu * (2.0 / r2 - 1.0 / a));
  const t = Math.PI * Math.sqrt(a ** 3 / mu);
  const n1 = Math.sqrt(mu / r1 ** 3),
    n2 = Math.sqrt(mu / r2 ** 3);
  const phase = pmod360((Math.PI - n2 * t) * DEG + 180.0) - 180.0;
  return {
    mu, a, e: Math.abs(r2 - r1) / (r2 + r1), v1, v2, vd, va, dv1: vd - v1, dv2: v2 - va,
    dv: Math.abs(vd - v1) + Math.abs(v2 - va), t, n1, n2, phase, synodique: (2.0 * Math.PI) / Math.abs(n1 - n2),
  };
}

export function attente_fenetre(b: Bilan, avance_deg: number): number {
  const d0 = avance_deg / DEG,
    phi = b.phase / DEG;
  if (b.n2 > b.n1) return mod2pi(phi - d0) / (b.n2 - b.n1);
  return mod2pi(d0 - phi) / (b.n1 - b.n2);
}

export function position_transfert(b: Bilan, r1: number, r2: number, theta_depart: number, dt: number): [number, number] {
  const { a, e } = b;
  const n = Math.sqrt(b.mu / a ** 3);
  const haut = r2 >= r1;
  const m = n * dt + (haut ? 0.0 : Math.PI);
  const ee = astro.resoudre_kepler(m, e);
  const nu = 2.0 * Math.atan2(Math.sqrt(1.0 + e) * Math.sin(ee / 2.0), Math.sqrt(1.0 - e) * Math.cos(ee / 2.0));
  const r = a * (1.0 - e * Math.cos(ee));
  const perigee = haut ? theta_depart : theta_depart + Math.PI;
  return [r, perigee + nu];
}

export function ecart_rendez_vous(b: Bilan, avance_au_depart_deg: number): number {
  const x = avance_au_depart_deg + b.n2 * b.t * DEG - 180.0;
  return pmod360(x + 180.0) - 180.0;
}
