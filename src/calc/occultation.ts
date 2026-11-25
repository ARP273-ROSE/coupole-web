/**
 * Occultation d'une étoile par un astéroïde — jumeau de `coupole/modules/anim/occultation.py` de Coupole (mêmes
 * formules, mêmes nombres) : ombre elliptique, cordes, durées, disque de l'étoile, ellipse ajustée par moindres
 * carrés sur les extrémités des cordes, vitesse de l'ombre à l'opposition, échelle de Fresnel.
 */
import * as astro from './astro';

export const V_TERRE = Math.sqrt(astro.GM_SOLEIL / (astro.UA_KM * 1000.0)) / 1000.0;
export const KM_PAR_MAS_UA = astro.UA_KM / (648_000_000.0 / Math.PI);
export const N_ETOILE = 15;

/** Objets : [clé, diamètre 2a (km), b/a, orientation ψ (degrés), distance au Soleil r (ua)]. */
export const OBJETS: readonly [string, number, number, number, number][] = [
  ['ceinture', 100.0, 0.8, 30.0, 2.5],
  ['troyen', 21.0, 0.75, 60.0, 5.2],
  ['eris', 2326.0, 1.0, 0.0, 96.0],
];

export function vitesse_ombre(r_ua: number): number {
  return V_TERRE * (1.0 - 1.0 / Math.sqrt(r_ua));
}

export function distance_terre(r_ua: number): number {
  return r_ua - 1.0;
}

export function fresnel_km(lam_nm: number, delta_ua: number): number {
  return Math.sqrt((lam_nm * 1e-12 * delta_ua * astro.UA_KM) / 2.0);
}

export function etoile_km(theta_mas: number, delta_ua: number): number {
  return theta_mas * delta_ua * KM_PAR_MAS_UA;
}

const rad = (d: number): number => (d * Math.PI) / 180.0;

export class Ellipse {
  m11: number;
  m12: number;
  m22: number;
  constructor(
    public a: number,
    public b: number,
    public psi: number,
    public x0 = 0.0,
    public y0 = 0.0,
  ) {
    const c = Math.cos(rad(psi)),
      s = Math.sin(rad(psi));
    const ia = 1.0 / (a * a),
      ib = 1.0 / (b * b);
    this.m11 = c * c * ia + s * s * ib;
    this.m12 = c * s * (ia - ib);
    this.m22 = s * s * ia + c * c * ib;
  }

  dedans(x: number, y: number): boolean {
    const dx = x - this.x0,
      dy = y - this.y0;
    return this.m11 * dx * dx + 2.0 * this.m12 * dx * dy + this.m22 * dy * dy <= 1.0;
  }

  corde(y: number): [number, number] | null {
    const dy = y - this.y0;
    const disc = this.m11 - (dy * dy) / (this.a * this.a * this.b * this.b);
    if (disc <= 0.0) return null;
    const xc = this.x0 - (this.m12 * dy) / this.m11;
    const demi = Math.sqrt(disc) / this.m11;
    return [xc - demi, xc + demi];
  }

  contour(n = 120): [number, number][] {
    const c = Math.cos(rad(this.psi)),
      s = Math.sin(rad(this.psi));
    const out: [number, number][] = [];
    for (let k = 0; k <= n; k++) {
      const t = (2.0 * Math.PI * k) / n;
      const u = this.a * Math.cos(t),
        v = this.b * Math.sin(t);
      out.push([this.x0 + c * u - s * v, this.y0 + s * u + c * v]);
    }
    return out;
  }
}

export function grille_etoile(n = N_ETOILE): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = -1.0 + (2 * i + 1) / n,
        y = -1.0 + (2 * j + 1) / n;
      if (x * x + y * y <= 1.0) pts.push([x, y]);
    }
  }
  return pts;
}

export const GRILLE = grille_etoile();

export function fraction_cachee(el: Ellipse, x: number, y: number, r_etoile: number): number {
  if (r_etoile <= 1e-3 * el.b) return el.dedans(x, y) ? 1.0 : 0.0;
  let n = 0;
  for (const [u, v] of GRILLE) if (el.dedans(x + u * r_etoile, y + v * r_etoile)) n++;
  return n / GRILLE.length;
}

export function stations(n: number, espacement: number): number[] {
  return Array.from({ length: n }, (_, k) => (k - (n - 1) / 2.0) * espacement);
}

export type Corde = [number, number | null, number | null];

export function cordes(el: Ellipse, ys: number[]): Corde[] {
  return ys.map((y) => {
    const c = el.corde(y);
    return c ? ([y, c[0], c[1]] as Corde) : ([y, null, null] as Corde);
  });
}

export function bruiter(cs: Corde[], sigma_km: number, graine = 2024): Corde[] {
  const m = 2_147_483_647;
  let x = graine;
  return cs.map(([y, x1, x2]) => {
    if (x1 === null || x2 === null) return [y, null, null] as Corde;
    const e: number[] = [];
    for (let k = 0; k < 2; k++) {
      x = (16807 * x) % m;
      e.push((2.0 * x / m - 1.0) * Math.sqrt(3.0) * sigma_km);
    }
    return [y, x1 + e[0]!, x2 + e[1]!] as Corde;
  });
}

/** Ellipse ajustée : [x0, y0, a, b, ψ (degrés)] ou null. */
export function ajuster_ellipse(points: [number, number][]): [number, number, number, number, number] | null {
  if (points.length < 5) return null;
  const lignes = points.map(([x, y]) => [x * x, x * y, y * y, x, y]);
  const n = 5;
  let mat: number[][] = [];
  for (let i = 0; i < n; i++) {
    const ligne: number[] = [];
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (const l of lignes) s += l[i]! * l[j]!;
      ligne.push(s);
    }
    let s = 0;
    for (const l of lignes) s += l[i]!;
    ligne.push(s);
    mat.push(ligne);
  }
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(mat[r]![col]!) > Math.abs(mat[piv]![col]!)) piv = r;
    if (Math.abs(mat[piv]![col]!) < 1e-300) return null;
    [mat[col], mat[piv]] = [mat[piv]!, mat[col]!];
    mat = mat.map((ligne, r) => {
      if (r === col) return ligne;
      const f = ligne[col]! / mat[col]![col]!;
      return ligne.map((v, k) => v - f * mat[col]![k]!);
    });
  }
  const [A, B, C, D, E] = [0, 1, 2, 3, 4].map((i) => mat[i]![n]! / mat[i]![i]!) as [number, number, number, number, number];
  const det = 4.0 * A * C - B * B;
  if (det <= 0.0) return null;
  const x0 = (B * E - 2.0 * C * D) / det;
  const y0 = (B * D - 2.0 * A * E) / det;
  const k = 1.0 - (D * x0 + E * y0) / 2.0;
  if (k <= 0.0) return null;
  const tr_ = A + C,
    dif_ = Math.hypot(A - C, B);
  const l1 = (tr_ - dif_) / 2.0,
    l2 = (tr_ + dif_) / 2.0;
  if (l1 <= 0.0) return null;
  let psi = 0.5 * ((Math.atan2(B, A - C) * 180) / Math.PI) + 90.0;
  psi = ((((psi + 90.0) % 180.0) + 180.0) % 180.0) - 90.0;
  return [x0, y0, Math.sqrt(k / l1), Math.sqrt(k / l2), psi];
}
