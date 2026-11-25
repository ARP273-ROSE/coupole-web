/**
 * Cratère d'impact : lois d'échelle de Collins, Melosh et Marcus (2005) — jumeau de `coupole/modules/anim/cratere.py`
 * de Coupole (mêmes formules, mêmes nombres).  SI sauf mention.
 */
import { radians } from '../noyau/py';
export const G_TERRE = 9.81;
export const MT_J = 4.18e15;
export const D_C_KM = 3.2;
export const D_TC_MAX_SIMPLE_KM = 2.56;
export const K_ROCHE = 1.161;

export const IMPACTEURS: readonly [string, number][] = [['glace', 1000.0], ['poreux', 1500.0], ['rocheux', 3000.0], ['fer', 8000.0]];
export const CIBLES: readonly [string, number, number][] = [['sedimentaire', 2500.0, K_ROCHE], ['cristalline', 2750.0, K_ROCHE]];
/** Exemples : [clé, L (m), v (km/s), θ (°), impacteur, cible]. */
export const EXEMPLES: readonly [string, number, number, number, string, string][] = [
  ['cours', 1500.0, 20.0, 45.0, 'rocheux', 'sedimentaire'],
  ['meteor_crater', 50.0, 12.0, 45.0, 'fer', 'sedimentaire'],
  ['chicxulub', 10000.0, 20.0, 45.0, 'rocheux', 'sedimentaire'],
];

export interface Cratere {
  transitoire: number;
  prof_transitoire: number;
  final: number;
  profondeur: number;
  rempart: number;
  breche: number;
  genre: 'simple' | 'complexe';
}

export const masse = (L: number, rho_i: number): number => (Math.PI / 6.0) * rho_i * L ** 3;
export const energie = (L: number, rho_i: number, v: number): number => 0.5 * masse(L, rho_i) * v * v;

export function transitoire(L: number, v: number, theta_deg: number, rho_i: number, rho_t: number, k = K_ROCHE, g = G_TERRE): number {
  return k * (rho_i / rho_t) ** (1.0 / 3.0) * L ** 0.78 * v ** 0.44 * g ** -0.22 * Math.sin(radians(theta_deg)) ** (1.0 / 3.0);
}

export function cratere(L: number, v: number, theta_deg: number, rho_i: number, rho_t: number, k = K_ROCHE): Cratere {
  const dtc = transitoire(L, v, theta_deg, rho_i, rho_t, k);
  const ptc = dtc / (2.0 * Math.sqrt(2.0));
  if (dtc <= D_TC_MAX_SIMPLE_KM * 1000.0) {
    const dfr = 1.25 * dtc;
    const hfr = (0.07 * dtc ** 4) / dfr ** 3;
    const vbr = 0.032 * dfr ** 3;
    const tbr = (2.8 * vbr * (ptc + hfr)) / (ptc * dfr * dfr);
    return { transitoire: dtc, prof_transitoire: ptc, final: dfr, profondeur: ptc + hfr - tbr, rempart: hfr, breche: tbr, genre: 'simple' };
  }
  const dfr = ((1.17 * (dtc / 1000.0) ** 1.13) / D_C_KM ** 0.13) * 1000.0;
  const hfr = (0.07 * dtc ** 4) / dfr ** 3;
  return { transitoire: dtc, prof_transitoire: ptc, final: dfr, profondeur: 0.4 * (dfr / 1000.0) ** 0.3 * 1000.0, rempart: hfr, breche: 0.0, genre: 'complexe' };
}

export const recurrence_ans = (e_mt: number): number => 109.0 * e_mt ** 0.78;

/** Altitude (m) du profil schématique du cratère final à la distance x (m) du centre. */
export function profil(c: Cratere, x: number): number {
  const R = c.final / 2.0;
  const h = c.rempart,
    d = c.profondeur;
  const ax = Math.abs(x);
  if (ax >= R) return h * (R / ax) ** 3;
  const fond = h - d;
  if (c.genre === 'complexe') {
    const r0 = R / 3.0;
    if (ax <= r0) return fond;
    const u = (ax - r0) / (R - r0);
    return fond + d * u * u;
  }
  const u = ax / R;
  return fond + d * u * u;
}
