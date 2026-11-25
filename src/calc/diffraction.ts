/**
 * Diffraction par une pupille circulaire (avec obstruction centrale) et pouvoir de résolution — jumeau de
 * `coupole/modules/anim/diffraction.py` de Coupole (mêmes formules, mêmes approximations de J₁ et de I₀, mêmes
 * nombres).  Tache d'Airy I(v) = [2 J₁(v)/v − ε² 2 J₁(εv)/(εv)]² / (1 − ε²)², v = π D θ / λ ; premier anneau noir
 * à 1,22 λ / D (critère de Rayleigh) ; pose longue : tache convoluée par une gaussienne de largeur = seeing.
 */
export const SEC_PAR_RAD = 648_000.0 / Math.PI;
export const V1 = 3.831_705_970_207_512;
export const RAYLEIGH = V1 / Math.PI;
export const FWHM_AIRY = 1.028_993_969_962_188;
export const GAUSS_FWHM = 2.0 * Math.sqrt(2.0 * Math.log(2.0));

/** Instruments proposés : [clé, diamètre en m, obstruction centrale ε]. */
export const INSTRUMENTS: readonly [string, number, number][] = [
  ['oeil', 0.007, 0.0],
  ['lunette80', 0.08, 0.0],
  ['sc200', 0.2032, 0.34],
  ['m1', 1.0, 0.0],
  ['hubble', 2.4, 0.33],
  ['vlt', 8.2, 0.14],
  ['elt', 39.3, 0.0],
];

/** Fonction de Bessel J₁ (Numerical Recipes, bessj1). */
export function j1(x: number): number {
  const ax = Math.abs(x);
  if (ax < 8.0) {
    const y = x * x;
    const a1 = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1 + y * (-2972611.439 + y * (15704.4826 + y * -30.16036606)))));
    const a2 = 144725228442.0 + y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
    return a1 / a2;
  }
  const z = 8.0 / ax;
  const y = z * z;
  const xx = ax - 2.356194491;
  const a1 = 1.0 + y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * -0.240337019e-6)));
  const a2 = 0.04687499995 + y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
  const r = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * a1 - z * Math.sin(xx) * a2);
  return x < 0 ? -r : r;
}

/** I₀(x) e^(−|x|) (Numerical Recipes, bessi0, sans l'exponentielle). */
export function i0e(x: number): number {
  const ax = Math.abs(x);
  if (ax < 3.75) {
    const y = (x / 3.75) ** 2;
    return (1.0 + y * (3.5156229 + y * (3.0899424 + y * (1.2067492 + y * (0.2659732 + y * (0.360768e-1 + y * 0.45813e-2)))))) * Math.exp(-ax);
  }
  const y = 3.75 / ax;
  return (
    (0.39894228 + y * (0.1328592e-1 + y * (0.225319e-2 + y * (-0.157565e-2 + y * (0.916281e-2 + y * (-0.2057706e-1 + y * (0.2635537e-1 + y * (-0.1647633e-1 + y * 0.392377e-2)))))))) /
    Math.sqrt(ax)
  );
}

function amplitude(v: number, eps: number): number {
  if (Math.abs(v) < 1e-9) return 1.0;
  let a = (2.0 * j1(v)) / v;
  if (eps > 0) {
    const ev = eps * v;
    a -= eps * eps * (Math.abs(ev) > 1e-9 ? (2.0 * j1(ev)) / ev : 1.0);
  }
  return a / (1.0 - eps * eps);
}

/** Intensité de la tache d'Airy (1 au centre) à v = π D θ / λ. */
export function airy(v: number, eps = 0.0): number {
  const a = amplitude(v, eps);
  return a * a;
}

/** Premier zéro de l'amplitude (v). */
export function premier_zero(eps = 0.0): number {
  let a = 0.5,
    b = 0.5;
  let fa = amplitude(a, eps);
  while (b < 12.0) {
    b = a + 0.05;
    const fb = amplitude(b, eps);
    if (fa > 0 && fb <= 0) break;
    a = b;
    fa = fb;
  }
  for (let k = 0; k < 80; k++) {
    const m = 0.5 * (a + b);
    if (amplitude(m, eps) > 0) a = m;
    else b = m;
  }
  return 0.5 * (a + b);
}

export function theta_v(d_m: number, lam_nm: number): number {
  return ((lam_nm * 1e-9) / (Math.PI * d_m)) * SEC_PAR_RAD;
}

export function rayleigh_arcsec(d_m: number, lam_nm: number): number {
  return ((RAYLEIGH * lam_nm * 1e-9) / d_m) * SEC_PAR_RAD;
}

export function diametre_turbulence(seeing: number, lam_nm: number): number {
  return (RAYLEIGH * lam_nm * 1e-9) / (seeing / SEC_PAR_RAD);
}

/** Profil radial d'une étoile (tabulé, interpolé), 1 au centre. */
export class Profil {
  static N = 240;
  tv: number;
  t1: number;
  sigma: number;
  r_max: number;
  mode: 'airy' | 'gauss' | 'convolution';
  pas: number;
  table: number[];

  constructor(
    public d: number,
    public lam: number,
    public eps = 0.0,
    public seeing = 0.0,
    r_max = 0.0,
  ) {
    this.tv = theta_v(d, lam);
    this.t1 = premier_zero(eps) * this.tv;
    const sigma = seeing / GAUSS_FWHM;
    this.sigma = sigma;
    this.r_max = r_max > 0 ? r_max : 6.0 * Math.max(this.t1, seeing);
    this.mode = seeing <= 0 ? 'airy' : sigma > 3.0 * this.t1 ? 'gauss' : 'convolution';
    const N = Profil.N;
    const pas = this.r_max / (N - 1);
    this.pas = pas;
    let brut: number[];
    if (this.mode === 'airy') brut = Array.from({ length: N }, (_, i) => airy((i * pas) / this.tv, eps));
    else if (this.mode === 'gauss') {
      const fw = Math.hypot(seeing, ((FWHM_AIRY * lam * 1e-9) / d) * SEC_PAR_RAD);
      const s = fw / GAUSS_FWHM;
      brut = Array.from({ length: N }, (_, i) => Math.exp(-0.5 * ((i * pas) / s) ** 2));
    } else brut = this.convolution(sigma);
    const m = brut[0]! > 0 ? brut[0]! : 1.0;
    this.table = brut.map((b) => b / m);
  }

  private convolution(sigma: number): number[] {
    const h = this.t1 / 30.0;
    const n = Math.floor((this.r_max + 6.0 * sigma) / h) + 2;
    const rp = Array.from({ length: n }, (_, k) => k * h);
    const pp = rp.map((x) => airy(x / this.tv, this.eps) * x);
    const s2 = sigma * sigma;
    const out: number[] = [];
    for (let i = 0; i < Profil.N; i++) {
      const r = i * this.pas;
      const k0 = Math.max(0, Math.trunc((r - 6.0 * sigma) / h)),
        k1 = Math.min(n - 1, Math.trunc((r + 6.0 * sigma) / h) + 1);
      let tot = 0.0,
        w0 = 0.0,
        wn = 0.0;
      for (let k = k0; k <= k1; k++) {
        const x = rp[k]!;
        const w = pp[k]! * Math.exp((-0.5 * (r - x) ** 2) / s2) * i0e((r * x) / s2);
        if (k === k0) w0 = w;
        if (k === k1) wn = w;
        tot += w;
      }
      out.push(((tot - 0.5 * (w0 + wn)) * h) / s2);
    }
    return out;
  }

  valeur(r: number): number {
    r = Math.abs(r);
    if (r >= this.r_max) return 0.0;
    const x = r / this.pas;
    const i = Math.floor(x);
    const f = x - i;
    if (i >= Profil.N - 1) return this.table[Profil.N - 1]!;
    return this.table[i]! * (1.0 - f) + this.table[i + 1]! * f;
  }
}

export interface Coupe {
  x: number[];
  a: number[];
  b: number[];
  somme: number[];
  creux: number | null;
  demi: number;
}

/** Coupe le long de la droite qui joint deux étoiles (même définition que Coupole). */
export function coupe(profil: Profil, sep: number, rapport = 1.0, n = 241, demi = 0.0): Coupe {
  demi = demi > 0 ? demi : Math.max(1.5 * sep, 2.6 * profil.t1, 1.6 * profil.seeing);
  const xs = Array.from({ length: n }, (_, k) => -demi + (2.0 * demi * k) / (n - 1));
  const a = xs.map((x) => profil.valeur(x + sep / 2));
  const b = xs.map((x) => rapport * profil.valeur(x - sep / 2));
  const s = a.map((u, k) => u + b[k]!);
  let ia = 0,
    ib = 0;
  for (let k = 0; k < n; k++) {
    if (Math.abs(xs[k]! + sep / 2) < Math.abs(xs[ia]! + sep / 2)) ia = k;
    if (Math.abs(xs[k]! - sep / 2) < Math.abs(xs[ib]! - sep / 2)) ib = k;
  }
  let creux: number | null = null;
  if (ib - ia >= 2) {
    const haut = Math.min(s[ia]!, s[ib]!);
    let bas = Infinity;
    for (let k = ia; k <= ib; k++) bas = Math.min(bas, s[k]!);
    if (bas < 0.999 * haut) creux = (100.0 * bas) / haut;
  }
  return { x: xs, a, b, somme: s, creux, demi };
}

export function creux_milieu(profil: Profil, sep: number): number {
  const milieu = 2.0 * profil.valeur(sep / 2);
  const pic = profil.valeur(0.0) + profil.valeur(sep);
  return (100.0 * milieu) / pic;
}

export function largeur_mi_hauteur(profil: Profil): number {
  const t = profil.table;
  for (let i = 1; i < t.length; i++) {
    if (t[i]! <= 0.5) {
      const f = (t[i - 1]! - 0.5) / (t[i - 1]! - t[i]!);
      return 2.0 * (i - 1 + f) * profil.pas;
    }
  }
  return 2.0 * profil.r_max;
}

export function verdict(sep: number, d_m: number, lam_nm: number, seeing: number): string {
  const lim = Math.max(rayleigh_arcsec(d_m, lam_nm), seeing);
  if (sep >= 1.1 * lim) return 'separees';
  if (sep >= 0.9 * lim) return 'limite';
  return 'confondues';
}
