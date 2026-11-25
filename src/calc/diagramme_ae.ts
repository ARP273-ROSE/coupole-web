/**
 * Le diagramme demi-grand axe – excentricité — jumeau de `coupole/modules/anim/diagramme_ae.py` de Coupole (mêmes
 * formules, mêmes nombres) : q = a(1 − e), Q = a(1 + e), P = a √a, familles de géocroiseurs (CNEOS) et classes
 * orbitales (SBDB), paramètre de Tisserand vis-à-vis de Jupiter, résonances a_J (q/p)^(2/3), position képlérienne.
 */
import { radians } from '../noyau/py';
export const A_JUPITER = 5.2026;

/** Planètes : [clé, a (ua), e]. */
export const PLANETES: readonly [string, number, number][] = [
  ['mercure', 0.387, 0.206], ['venus', 0.723, 0.007], ['terre', 1.0, 0.017], ['mars', 1.524, 0.093],
  ['jupiter', 5.203, 0.048], ['saturne', 9.537, 0.054], ['uranus', 19.19, 0.047], ['neptune', 30.07, 0.009],
];

/** Petits corps (base SBDB du JPL, arrondis) : [clé, a (ua), e, i (°)]. */
export const OBJETS: readonly [string, number, number, number][] = [
  ['atira', 0.741, 0.322, 25.6], ['apophis', 0.922, 0.191, 3.34], ['tk7', 0.999, 0.19, 20.9],
  ['cruithne', 0.998, 0.515, 19.8], ['bennu', 1.13, 0.204, 6.03], ['ryugu', 1.19, 0.191, 5.87],
  ['itokawa', 1.32, 0.28, 1.62], ['icare', 1.08, 0.827, 22.8], ['phaethon', 1.27, 0.89, 22.3],
  ['didymos', 1.64, 0.383, 3.41], ['toutatis', 2.54, 0.625, 0.448], ['eros', 1.46, 0.223, 10.8],
  ['encke', 2.22, 0.847, 11.3], ['vesta', 2.36, 0.0902, 7.14], ['ceres', 2.77, 0.0797, 10.6],
  ['pallas', 2.77, 0.231, 34.9], ['hygie', 3.15, 0.107, 3.83], ['tchouri', 3.46, 0.641, 7.04],
  ['hilda', 3.97, 0.138, 7.83], ['hektor', 5.28, 0.0243, 18.1], ['hidalgo', 5.73, 0.662, 42.5],
  ['chiron', 13.7, 0.38, 6.93], ['halley', 17.9, 0.968, 162.0], ['swift_tuttle', 26.1, 0.963, 113.0],
  ['pluton', 39.6, 0.252, 17.1], ['arrokoth', 44.1, 0.0356, 2.45], ['eris', 67.9, 0.438, 43.9],
];

export const Q_ATIRA = 0.983;
export const Q_APOLLO = 1.017;
export const Q_GEOCROISEUR = 1.3;
export const Q_MARS = 1.666;
export const LACUNES: readonly [number, number][] = [[3, 1], [5, 2], [7, 3], [2, 1]];
export const GROUPES: readonly [number, number][] = [[3, 2], [1, 1]];

export const perihelie = (a: number, e: number): number => a * (1.0 - e);
export const aphelie = (a: number, e: number): number => a * (1.0 + e);
export const periode = (a: number): number => a * Math.sqrt(a);

export function tisserand(a: number, e: number, i_deg: number, aj = A_JUPITER): number {
  return aj / a + 2.0 * Math.cos(radians(i_deg)) * Math.sqrt((a / aj) * (1.0 - e * e));
}

export function genre_tisserand(t: number): string {
  if (t > 3.0) return 'asteroide';
  if (t > 2.0) return 'comete_jupiter';
  return 'comete_halley';
}

export function resonance(p: number, q: number, aj = A_JUPITER): number {
  return aj * (q / p) ** (2.0 / 3.0);
}

export function famille(a: number, e: number): string {
  const q = perihelie(a, e),
    Q = aphelie(a, e);
  if (q < Q_GEOCROISEUR) {
    if (a < 1.0) return Q < Q_ATIRA ? 'atira' : 'aten';
    return q < Q_APOLLO ? 'apollo' : 'amor';
  }
  if (a < 3.2) {
    if (q < Q_MARS) return 'croiseur_mars';
    return a < 2.0 ? 'ceinture_int' : 'ceinture';
  }
  if (a < 4.6) return 'ceinture_ext';
  if (a < 5.5) return e < 0.3 ? 'troyen' : 'autre';
  if (a < 30.1) return 'centaure';
  return 'transneptunien';
}

export function croisees(a: number, e: number): string[] {
  const q = perihelie(a, e),
    Q = aphelie(a, e);
  return PLANETES.filter(([, ap]) => q < ap && ap < Q).map(([k]) => k);
}

export function kepler(m: number, e: number): number {
  m = m % (2.0 * Math.PI);
  let E = e > 0.8 ? Math.PI : m;
  for (let k = 0; k < 50; k++) {
    const d = (E - e * Math.sin(E) - m) / (1.0 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-14) break;
  }
  return E;
}

export function position(a: number, e: number, m: number): [number, number] {
  const E = kepler(m, e);
  return [a * (Math.cos(E) - e), a * Math.sqrt(1.0 - e * e) * Math.sin(E)];
}

export function distance_soleil(a: number, e: number, m: number): number {
  return a * (1.0 - e * Math.cos(kepler(m, e)));
}
