/**
 * La précession des équinoxes — jumeau de `coupole/modules/anim/precession.py` de Coupole (mêmes formules, mêmes
 * nombres) : pôle céleste qui tourne autour du pôle de l'écliptique à ε = 23,44° en 25 772 ans (p = 5 028,796 195″ par
 * siècle, UAI 2006), écliptique fixe, obliquité constante, mouvements propres négligés.
 */
import { degrees, pmod, radians } from '../noyau/py';

export const P_ARCSEC_SIECLE = 5028.796_195;
export const P_DEG_AN = P_ARCSEC_SIECLE / 3600.0 / 100.0;
export const PERIODE_ANS = 360.0 / P_DEG_AN;
export const EPS = 84381.406 / 3600.0;
export const LIMITES_2026: readonly [string, number][] = [
  ['ari', 29.05], ['tau', 53.779], ['gem', 90.503], ['cnc', 118.351], ['leo', 138.402], ['vir', 174.214], ['lib', 218.172],
  ['sco', 241.424], ['oph', 248.001], ['sgr', 266.601], ['cap', 300.02], ['aqr', 327.852], ['psc', 352.013],
];

/** Étoiles boréales brillantes : [Bayer, α (°), δ (°), V] (J2000, Yale Bright Star Catalogue, arrondis). */
export const ETOILES: readonly [string, number, number, number][] = [
  ['α Lyr', 279.24, 38.79, 0.0], ['α Aur', 79.17, 45.99, 0.1], ['β Gem', 116.32, 28.03, 1.1],
  ['α Cyg', 310.36, 45.28, 1.2], ['β Tau', 81.57, 28.61, 1.6], ['ε UMa', 193.51, 55.96, 1.8],
  ['α Per', 51.08, 49.86, 1.8], ['α UMa', 165.93, 61.75, 1.8], ['η UMa', 206.88, 49.31, 1.9],
  ['β Aur', 89.88, 44.95, 1.9], ['α Gem', 113.65, 31.89, 2.0], ['α UMi', 37.98, 89.26, 2.0],
  ['α And', 2.1, 29.09, 2.1], ['β And', 17.43, 35.62, 2.1], ['β UMi', 222.68, 74.16, 2.1],
  ['β Per', 47.04, 40.96, 2.1], ['γ Cyg', 305.56, 40.26, 2.2], ['α Cas', 10.13, 56.54, 2.2],
  ['γ Dra', 269.15, 51.49, 2.2], ['γ1 And', 30.98, 42.33, 2.3], ['β Cas', 2.3, 59.15, 2.3],
  ['ζ UMa', 200.98, 54.93, 2.3], ['β UMa', 165.46, 56.38, 2.4], ['β Peg', 345.95, 28.08, 2.4],
  ['γ UMa', 178.46, 53.69, 2.4], ['α Cep', 319.65, 62.59, 2.4], ['ε Cyg', 311.56, 33.97, 2.5],
  ['γ Cas', 14.18, 60.72, 2.5], ['θ Aur', 89.93, 37.21, 2.6], ['δ Cas', 21.46, 60.23, 2.7],
  ['ι Aur', 74.25, 33.17, 2.7], ['η Dra', 246.0, 61.51, 2.7], ['β Dra', 262.61, 52.3, 2.8],
  ['ζ Her', 250.32, 31.61, 2.8], ['ζ Per', 58.53, 31.88, 2.9], ['δ Cyg', 296.24, 45.13, 2.9],
  ['ε Per', 59.46, 40.01, 2.9], ['α2 CVn', 194.0, 38.32, 2.9], ['γ Per', 46.2, 53.51, 2.9],
  ['η Peg', 340.75, 30.22, 2.9], ['ε Aur', 75.49, 43.82, 3.0], ['β Tri', 32.39, 34.99, 3.0],
  ['δ Per', 55.73, 47.79, 3.0], ['ψ UMa', 167.42, 44.5, 3.0], ['γ Boo', 218.02, 38.31, 3.0],
  ['μ UMa', 155.58, 41.5, 3.0], ['γ UMi', 230.18, 71.83, 3.0], ['δ Dra', 288.14, 67.66, 3.1],
  ['α Lyn', 140.26, 34.39, 3.1], ['ι UMa', 134.8, 48.04, 3.1], ['π Her', 258.76, 36.81, 3.2],
  ['η Aur', 76.63, 41.23, 3.2], ['θ UMa', 143.2, 51.67, 3.2], ['ζ Dra', 257.2, 65.71, 3.2],
  ['ζ Cyg', 318.23, 30.23, 3.2], ['γ Cep', 354.83, 77.63, 3.2], ['β Cep', 322.17, 70.56, 3.2],
  ['γ Lyr', 284.74, 32.69, 3.2], ['δ And', 9.83, 30.86, 3.3], ['ι Dra', 231.23, 58.97, 3.3],
  ['α Dra', 211.1, 64.38, 3.6], ['ι Her', 264.87, 46.01, 3.8], ['κ Dra', 188.37, 69.79, 3.9],
  ['τ Her', 244.93, 46.31, 3.9],
];
export const NOMS: Record<string, string> = {
  'α UMi': 'polaris', 'α Lyr': 'vega', 'α Dra': 'thuban', 'α Cyg': 'deneb', 'β UMi': 'kochab', 'α Cep': 'alderamin',
  'γ Cep': 'errai', 'ι Her': 'iota_her', 'δ Cyg': 'delta_cyg', 'α Aur': 'capella',
};

export type V3 = [number, number, number];

export function ecliptique(ra_deg: number, dec_deg: number): [number, number] {
  const a = radians(ra_deg),
    d = radians(dec_deg),
    e = radians(EPS);
  const lam = Math.atan2(Math.sin(a) * Math.cos(e) + Math.tan(d) * Math.sin(e), Math.cos(a));
  const beta = Math.asin(Math.sin(d) * Math.cos(e) - Math.cos(d) * Math.sin(e) * Math.sin(a));
  return [pmod(degrees(lam), 360.0), degrees(beta)];
}

export function vecteur(lam_deg: number, beta_deg: number): V3 {
  const l = radians(lam_deg),
    b = radians(beta_deg);
  return [Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)];
}

export function pole(annee: number): [number, number] {
  return [pmod(90.0 - P_DEG_AN * (annee - 2000.0), 360.0), 90.0 - EPS];
}

export function ecart(u: V3, v: V3): number {
  const cx = u[1] * v[2] - u[2] * v[1],
    cy = u[2] * v[0] - u[0] * v[2],
    cz = u[0] * v[1] - u[1] * v[0];
  return degrees(Math.atan2(Math.sqrt(cx * cx + cy * cy + cz * cz), u[0] * v[0] + u[1] * v[1] + u[2] * v[2]));
}

const ECL: [string, number, number, number][] = ETOILES.map(([n, a, d, m]) => [n, ...ecliptique(a, d), m]);

export function etoiles_ecliptiques(): readonly [string, number, number, number][] {
  return ECL;
}

export function distance_au_pole(nom: string, annee: number): number {
  const e = ECL.find(([n]) => n === nom);
  if (!e) throw new Error(nom);
  return ecart(vecteur(e[1], e[2]), vecteur(...pole(annee)));
}

export function plus_proche(annee: number, v_max = 3.7): [string, number] {
  const p = vecteur(...pole(annee));
  let meilleur: [string, number] = ['', 180.0];
  for (const [n, l, b, m] of ECL) {
    if (m <= v_max) {
      const d = ecart(vecteur(l, b), p);
      if (d < meilleur[1]) meilleur = [n, d];
    }
  }
  return meilleur;
}

export function point_vernal(annee: number): number {
  return pmod(-P_DEG_AN * (annee - 2000.0), 360.0);
}

const TRIEES = [...LIMITES_2026].sort((a, b) => a[1] - b[1]);

export function constellation(lam_j2000: number): string {
  const lam = pmod(lam_j2000 + P_DEG_AN * 26.0, 360.0);
  let nom = LIMITES_2026[LIMITES_2026.length - 1]![0];
  for (const [cle, l0] of TRIEES) if (lam >= l0) nom = cle;
  return nom;
}

export function annee_entree(cle: string, apres: number): number {
  const j = TRIEES.findIndex(([k]) => k === cle);
  const fin = TRIEES[(j + 1) % TRIEES.length]![1];
  const lam0 = pmod(fin - P_DEG_AN * 26.0, 360.0);
  let y = 2000.0 - lam0 / P_DEG_AN;
  while (y <= apres) y += PERIODE_ANS;
  while (y - PERIODE_ANS > apres) y -= PERIODE_ANS;
  return y;
}

export function declinaison(nom: string, annee: number): number {
  return 90.0 - distance_au_pole(nom, annee);
}

export const pmod360 = (x: number): number => pmod(x, 360.0);
