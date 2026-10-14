/**
 * Lumière et spectres (transposition de lumiere.py de Coupole) : constantes exactes du SI, lois de Planck, Wien et
 * Stefan-Boltzmann, photons, niveaux de l'hydrogène (masse réduite), Snell-Descartes et Fresnel, effet Doppler par le
 * temps retardé, couleur perçue d'un spectre (CIE 1931 corrigée Judd-Vos, sRGB IEC 61966-2-1), magnitudes U B V R.
 */
import SPECTRES from '../donnees/genere/spectres.json';
import { pround } from '../noyau/py';

export { couleur_longueur_onde } from './couleurs';

export const H = 6.626_070_15e-34;
export const C = 299_792_458.0;
export const KB = 1.380_649e-23;
export const EV = 1.602_176_634e-19;
export const SIGMA = (2 * Math.PI ** 5 * KB ** 4) / (15 * H ** 3 * C ** 2);
export const HC_EV_NM = ((H * C) / EV) * 1e9;
export const R_INFINI = 10_973_731.56816;
export const ME_SUR_MP = 1 / 1_836.152_673_43;

function racine_wien(): number {
  let x = 5.0;
  for (let i = 0; i < 60; i++) {
    const f = x - 5 * (1 - Math.exp(-x));
    x -= f / (1 - 5 * Math.exp(-x));
  }
  return x;
}

export const X_WIEN = racine_wien();
export const WIEN_B = (H * C) / (KB * X_WIEN);

// ---------------------------------------------------------------- corps noir
export function planck(lam_m: number, t: number): number {
  if (t <= 0 || lam_m <= 0) return 0.0;
  const x = (H * C) / (lam_m * KB * t);
  if (x > 700) return 0.0;
  return (2 * H * C * C) / lam_m ** 5 / Math.expm1(x);
}

export function pic_wien_m(t: number): number {
  return WIEN_B / t;
}

export function temperature_de_pic(lam_m: number): number {
  return WIEN_B / lam_m;
}

export function exitance(t: number): number {
  return SIGMA * t ** 4;
}

// ---------------------------------------------------------------- photons
export function energie_photon_j(lam_m: number): number {
  return (H * C) / lam_m;
}

export function frequence(lam_m: number): number {
  return C / lam_m;
}

export function domaine_em(lam_m: number): string {
  const bornes: [number, string][] = [
    [1e-12, 'gamma'], [1e-9, 'x'], [4e-7, 'uv'], [7.5e-7, 'visible'], [2.5e-6, 'ir_proche'], [2.5e-5, 'ir'],
    [1e-3, 'micro_ondes'],
  ];
  for (const [b, nom] of bornes) if (lam_m < b) return nom;
  return 'radio';
}

// ---------------------------------------------------------------- atome d'hydrogène
export const R_HYDROGENE = R_INFINI / (1 + ME_SUR_MP);
export const E_IONISATION_EV = (H * C * R_HYDROGENE) / EV;

export function niveau_ev(n: number): number {
  return -E_IONISATION_EV / (n * n);
}

export function transition_ev(n_bas: number, n_haut: number): number {
  return niveau_ev(n_haut) - niveau_ev(n_bas);
}

export function longueur_onde_nm(energie_ev: number): number {
  return HC_EV_NM / energie_ev;
}

export const SERIES: Record<number, string> = { 1: 'lyman', 2: 'balmer', 3: 'paschen', 4: 'brackett', 5: 'pfund' };

// ---------------------------------------------------------------- réfraction
export function snell(theta1_deg: number, n1: number, n2: number): number | null {
  const s = (n1 * Math.sin((theta1_deg * Math.PI) / 180)) / n2;
  if (Math.abs(s) > 1) return null;
  return (Math.asin(s) * 180) / Math.PI;
}

export function angle_critique(n1: number, n2: number): number | null {
  return n1 > n2 ? (Math.asin(n2 / n1) * 180) / Math.PI : null;
}

export function fresnel(theta1_deg: number, n1: number, n2: number): { rs: number; rp: number; r: number } {
  const t2 = snell(theta1_deg, n1, n2);
  if (t2 === null) return { rs: 1.0, rp: 1.0, r: 1.0 };
  const c1 = Math.cos((theta1_deg * Math.PI) / 180),
    c2 = Math.cos((t2 * Math.PI) / 180);
  const rs = ((n1 * c1 - n2 * c2) / (n1 * c1 + n2 * c2)) ** 2;
  const rp = ((n1 * c2 - n2 * c1) / (n1 * c2 + n2 * c1)) ** 2;
  return { rs, rp, r: (rs + rp) / 2 };
}

export function angle_brewster(n1: number, n2: number): number {
  return (Math.atan2(n2, n1) * 180) / Math.PI;
}

// ---------------------------------------------------------------- effet Doppler
export function frequence_recue(
  f0: number, v_source: readonly number[], v_obs: readonly number[], direction: readonly number[], c: number,
): number {
  const [ux, uy] = direction as [number, number];
  return (f0 * (c - (v_obs[0]! * ux + v_obs[1]! * uy))) / (c - (v_source[0]! * ux + v_source[1]! * uy));
}

/** Instant d'émission τ ≤ t de l'onde qui atteint l'observateur fixe `obs` à l'instant t. */
export function temps_retarde(
  t: number, position_source: (tau: number) => readonly number[], obs: readonly number[], c: number, t_min = -1e9,
): number {
  const g = (tau: number): number => {
    const [x, y] = position_source(tau) as [number, number];
    return Math.hypot(obs[0]! - x, obs[1]! - y) - c * (t - tau);
  };
  let hi = t;
  if (g(hi) <= 0) return t;
  let lo = t - 1.0;
  while (g(lo) > 0 && lo > t_min) lo = t - 2 * (t - lo);
  for (let i = 0; i < 80; i++) {
    const mi = (lo + hi) / 2;
    if (g(mi) > 0) hi = mi;
    else lo = mi;
    if (hi - lo < 1e-12 * Math.max(1.0, Math.abs(t))) break;
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------- données spectrales
type TableSpectre = { w0: number; pas?: number; decalage?: number; [k: string]: unknown };
const S = SPECTRES as unknown as Record<string, TableSpectre>;

export function spectres(): Record<string, TableSpectre> {
  return S;
}

export function table(nom: string, cle = 't'): [number, number, number[]] {
  const d = S[nom]!;
  return [d.w0, d.pas ?? 1, d[cle] as number[]];
}

export function valeur(nom: string, lam_nm: number, cle = 't'): number {
  const [w0, pas, v] = table(nom, cle);
  const x = (lam_nm - w0) / pas;
  const i = Math.trunc(Math.floor(x));
  if (i < 0 || i >= v.length - 1) return i === v.length - 1 && x === v.length - 1 ? v[v.length - 1]! : 0.0;
  const f = x - i;
  return v[i]! * (1 - f) + v[i + 1]! * f;
}

export const FILTRES = ['U', 'B', 'V', 'R'] as const;

export function somme_filtre(nom: string, flux: (w: number) => number): number {
  const [w0, , t] = table('filtre_' + nom);
  let s = 0;
  for (let i = 0; i < t.length; i++) s += t[i]! * flux(w0 + i);
  return s * 1e-9;
}

export function magnitude(nom: string, flux: (w: number) => number): number {
  const s = somme_filtre(nom, flux);
  if (s <= 0) return Infinity;
  return (S['filtre_' + nom]!.decalage as number) - 2.5 * Math.log10(s);
}

export function magnitudes_corps_noir(t: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of FILTRES) out[f] = magnitude(f, (w) => planck(w * 1e-9, t));
  return out;
}

// ---------------------------------------------------------------- couleur perçue
const XYZ_VERS_RGB = [
  [3.240_479, -1.53715, -0.498_535],
  [-0.969_256, 1.875_992, 0.041_556],
  [0.055_648, -0.204_043, 1.057_311],
] as const;

export function xyz(flux: (w: number) => number): [number, number, number] {
  const d = S.cie as unknown as { w0: number; pas: number; x: number[]; y: number[]; z: number[] };
  let x = 0,
    y = 0,
    z = 0;
  for (let i = 0; i < d.x.length; i++) {
    const f = flux(d.w0 + d.pas * i);
    x += f * d.x[i]!;
    y += f * d.y[i]!;
    z += f * d.z[i]!;
  }
  return [x, y, z];
}

function gamma_srgb(u: number): number {
  u = Math.max(0.0, u);
  return u <= 0.003_130_8 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055;
}

export function rgb_de_xyz(x: number, y: number, z: number, luminosite: number | null = null): [number, number, number] {
  if (luminosite !== null && y > 0) {
    const k = luminosite / y;
    x *= k;
    y *= k;
    z *= k;
  }
  let lin = XYZ_VERS_RGB.map(([a, b, c]) => a * x + b * y + c * z);
  const m = Math.min(...lin);
  if (m < 0) lin = lin.map((v) => v - m);
  const mx = Math.max(...lin);
  if (mx > 1) lin = lin.map((v) => v / mx);
  return lin.map((v) => Math.trunc(pround(255 * gamma_srgb(v)))) as [number, number, number];
}

const cacheCN = new Map<number, [number, number, number]>();
export function couleur_corps_noir(t_arrondie: number): [number, number, number] {
  let v = cacheCN.get(t_arrondie);
  if (!v) {
    const [x, y, z] = xyz((w) => planck(w * 1e-9, t_arrondie));
    v = rgb_de_xyz(x, y, z, 0.85);
    if (cacheCN.size > 512) cacheCN.clear();
    cacheCN.set(t_arrondie, v);
  }
  return v;
}
