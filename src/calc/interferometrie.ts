/**
 * Interférences et interférométrie — jumeau de `coupole/modules/anim/interferometrie.py` de Coupole (mêmes formules,
 * mêmes nombres).  Franges d'interfrange λ / B, prises dans la tache d'Airy d'une ouverture (1,22 λ / d) ;
 * visibilité = module de la transformée de Fourier de la source à la fréquence B / λ (Zernike et van Cittert) :
 * point V = 1 ; disque |2 J₁(x)/x|, x = π θ B / λ ; couple |1 + r e^(−2iπ B ρ/λ)| / (1 + r).
 * Les nombres complexes sont des couples [partie réelle, partie imaginaire].
 */
import { RAYLEIGH, SEC_PAR_RAD, airy, j1 } from './diffraction';
import { rgb_de_xyz, xyz } from './lumiere';

export const MAS_PAR_RAD = SEC_PAR_RAD * 1000.0;
export type Complexe = [number, number];

/** Instruments : [clé, base B (m), diamètre d'une ouverture d (m)] (ordre de Coupole). */
export const INSTRUMENTS: readonly [string, number, number][] = [
  ['young', 0.0005, 0.0001],
  ['michelson', 6.1, 0.15],
  ['vlti_ut', 130.0, 8.2],
  ['vlti_at', 200.0, 1.8],
  ['chara', 331.0, 1.0],
];

/** Objets : [clé, genre, taille (mas), Δm]. */
export const OBJETS: readonly [string, string, number, number][] = [
  ['point', 'point', 0.0, 0.0],
  ['disque', 'disque', 5.0, 0.0],
  ['couple', 'couple', 20.0, 0.0],
  ['betelgeuse', 'disque', 47.0, 0.0],
  ['sirius', 'disque', 6.0, 0.0],
  ['capella', 'couple', 56.0, 0.1],
];

export const module_c = (z: Complexe): number => Math.hypot(z[0], z[1]);
/** Argument, comme cmath.phase de Python (π pour un réel négatif). */
export const phase_c = (z: Complexe): number => Math.atan2(z[1], z[0]);

export function rad_de_mas(x: number): number {
  return x / MAS_PAR_RAD;
}

export function interfrange_mas(b_m: number, lam_nm: number): number {
  return ((lam_nm * 1e-9) / b_m) * MAS_PAR_RAD;
}

export function resolution_mas(d_m: number, lam_nm: number): number {
  return ((RAYLEIGH * lam_nm * 1e-9) / d_m) * MAS_PAR_RAD;
}

export function visibilite_complexe(genre: string, taille_mas: number, b_m: number, lam_nm: number, rapport = 1.0): Complexe {
  const u = b_m / (lam_nm * 1e-9);
  const t = rad_de_mas(taille_mas);
  if (genre === 'disque') {
    const x = Math.PI * t * u;
    return [x < 1e-8 ? 1.0 : (2.0 * j1(x)) / x, 0.0];
  }
  if (genre === 'couple') {
    const a = -2.0 * Math.PI * u * t;
    return [(1.0 + rapport * Math.cos(a)) / (1.0 + rapport), (rapport * Math.sin(a)) / (1.0 + rapport)];
  }
  return [1.0, 0.0];
}

export function visibilite(genre: string, taille_mas: number, b_m: number, lam_nm: number, rapport = 1.0): number {
  return module_c(visibilite_complexe(genre, taille_mas, b_m, lam_nm, rapport));
}

export function base_premier_zero(genre: string, taille_mas: number, lam_nm: number, _rapport = 1.0): number | null {
  if (taille_mas <= 0.0) return null;
  const lam = lam_nm * 1e-9;
  if (genre === 'disque') return (RAYLEIGH * lam) / rad_de_mas(taille_mas);
  if (genre === 'couple') return lam / (2.0 * rad_de_mas(taille_mas));
  return null;
}

export function intensite(alpha_mas: number, b_m: number, d_m: number, lam_nm: number, v: Complexe): number {
  const lam = lam_nm * 1e-9;
  const a = rad_de_mas(alpha_mas);
  const env = airy((Math.PI * d_m * a) / lam);
  return 0.5 * env * (1.0 + module_c(v) * Math.cos((2.0 * Math.PI * b_m * a) / lam - phase_c(v)));
}

export function champ_coupe(b_m: number, d_m: number, lam_nm: number): number {
  return Math.min(1.3 * resolution_mas(d_m, lam_nm), 6.0 * interfrange_mas(b_m, lam_nm));
}

export function coupe(b_m: number, d_m: number, lam_nm: number, v: Complexe, n = 401): [number[], number[], number] {
  const demi = champ_coupe(b_m, d_m, lam_nm);
  const xs = Array.from({ length: n }, (_, k) => -demi + (2.0 * demi * k) / (n - 1));
  return [xs, xs.map((x) => intensite(x, b_m, d_m, lam_nm, v)), demi];
}

export const SEUIL_RESOLU = 0.9;

export function verdict(genre: string, taille_mas: number, d_m: number, lam_nm: number, v: number): string {
  if (genre === 'point' || taille_mas <= 0.0) return 'v_ponctuelle';
  if (taille_mas >= resolution_mas(d_m, lam_nm)) return 'v_seul';
  return v < SEUIL_RESOLU ? 'v_interferometre' : 'v_non_resolue';
}

// ------------------------------------------------------------------ anneaux de Newton
/**
 * Lentille plan-convexe (rayon de courbure R) sur une lame : lame d'épaisseur e(r) = r²/(2R) ; en réflexion
 * I = (1 − cos(4π n e / λ))/2 (centre noir, anneaux sombres à √(kλR/n)), en transmission la figure complémentaire.
 */
export const N_ANNEAUX = 12;

export const epaisseur_nm = (r_mm: number, R_m: number): number => ((r_mm * 1e-3) ** 2 / (2.0 * R_m)) * 1e9;

export function newton_e(e_nm: number, lam_nm: number, n: number, cote: string): number {
  const i = (1.0 - Math.cos((4.0 * Math.PI * n * e_nm) / lam_nm)) / 2.0;
  return cote === 'reflexion' ? i : 1.0 - i;
}

export const newton = (r_mm: number, R_m: number, lam_nm: number, n: number, cote = 'reflexion'): number => newton_e(epaisseur_nm(r_mm, R_m), lam_nm, n, cote);

export function rayon_sombre(k: number, R_m: number, lam_nm: number, n: number, cote = 'reflexion'): number {
  const kk = cote === 'reflexion' ? k : k - 0.5;
  return Math.sqrt((kk * lam_nm * 1e-9 * R_m) / n) * 1e3;
}

let Y_BLANC: number | null = null;

export function couleur_blanche(r_mm: number, R_m: number, n: number, cote = 'reflexion'): [number, number, number] {
  const e = epaisseur_nm(r_mm, R_m);
  if (Y_BLANC === null) Y_BLANC = xyz(() => 1.0)[1];
  const yw = Y_BLANC;
  const [x, y, z] = xyz((w) => newton_e(e, w, n, cote));
  return rgb_de_xyz(x / yw, y / yw, z / yw);
}

