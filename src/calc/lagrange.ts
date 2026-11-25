/**
 * Les points de Lagrange (problème restreint des trois corps, circulaire et plan) — jumeau de
 * `coupole/modules/anim/lagrange.py` de Coupole (mêmes formules, mêmes nombres).  Repère tournant, unités a et
 * période 2π ; grand corps en (−μ, 0), petit en (1 − μ, 0) ; Ω = (x² + y²)/2 + (1 − μ)/r₁ + μ/r₂.
 */
export const MU_ROUTH = (1.0 - Math.sqrt(23.0 / 27.0)) / 2.0;
export const UA = 149_597_870.7;

/** Systèmes : [clé, μ, a (km)]. */
export const SYSTEMES: readonly [string, number, number][] = [
  ['soleil_terre', 1.0 / (1.0 + 328_900.56), UA],
  ['terre_lune', 1.0 / (1.0 + 81.300_568), 384_400.0],
  ['soleil_jupiter', 1.0 / (1.0 + 1047.348_644), 5.2026 * UA],
  ['pluton_charon', 0.1218 / 1.1218, 19_596.0],
];

export type Etat = [number, number, number, number];
export type Etat3 = [number, number, number, number, number, number];
export type EtatQ = Etat | Etat3;

export function omega(mu: number, x: number, y: number): number {
  const r1 = Math.sqrt((x + mu) ** 2 + y * y);
  const r2 = Math.sqrt((x - 1.0 + mu) ** 2 + y * y);
  return 0.5 * (x * x + y * y) + (1.0 - mu) / r1 + mu / r2;
}

export function gradient(mu: number, x: number, y: number): [number, number] {
  const dx1 = x + mu,
    dx2 = x - 1.0 + mu;
  const r1 = Math.sqrt(dx1 * dx1 + y * y);
  const r2 = Math.sqrt(dx2 * dx2 + y * y);
  const k1 = (1.0 - mu) / (r1 * r1 * r1),
    k2 = mu / (r2 * r2 * r2);
  return [x - k1 * dx1 - k2 * dx2, y - k1 * y - k2 * y];
}

function bissection(f: (x: number) => number, a: number, b: number, n = 200): number {
  let fa = f(a);
  for (let k = 0; k < n; k++) {
    const m = 0.5 * (a + b);
    const fm = f(m);
    if (fm > 0.0 === fa > 0.0) {
      a = m;
      fa = fm;
    } else b = m;
  }
  return 0.5 * (a + b);
}

const CACHE_POINTS = new Map<number, Record<'L1' | 'L2' | 'L3' | 'L4' | 'L5', [number, number]>>();

/** Positions des cinq points (mises en cache par μ : elles servent plusieurs fois par image). */
export function points_lagrange(mu: number): Record<'L1' | 'L2' | 'L3' | 'L4' | 'L5', [number, number]> {
  let r = CACHE_POINTS.get(mu);
  if (!r) {
    r = calculer_points(mu);
    CACHE_POINTS.set(mu, r);
  }
  return r;
}

function calculer_points(mu: number): Record<'L1' | 'L2' | 'L3' | 'L4' | 'L5', [number, number]> {
  const f = (x: number): number => gradient(mu, x, 0.0)[0];
  const eps = 1e-12;
  const x1 = bissection(f, -mu + eps, 1.0 - mu - eps);
  const x2 = bissection(f, 1.0 - mu + eps, 2.0);
  const x3 = bissection(f, -2.0, -mu - eps);
  const h = Math.sqrt(3.0) / 2.0;
  return { L1: [x1, 0.0], L2: [x2, 0.0], L3: [x3, 0.0], L4: [0.5 - mu, h], L5: [0.5 - mu, -h] };
}

export function jacobi(mu: number, x: number, y: number, vx: number, vy: number): number {
  return 2.0 * omega(mu, x, y) - vx * vx - vy * vy;
}

export function rayon_hill(mu: number): number {
  return (mu / 3.0) ** (1.0 / 3.0);
}

export function derivees(mu: number, s: Etat): Etat {
  const [x, y, vx, vy] = s;
  const [gx, gy] = gradient(mu, x, y);
  return [vx, vy, gx + 2.0 * vy, gy - 2.0 * vx];
}

export function pas_rk4(mu: number, s: Etat, h: number): Etat {
  const plus = (a: Etat, d: Etat, f: number): Etat => [a[0] + f * d[0], a[1] + f * d[1], a[2] + f * d[2], a[3] + f * d[3]];
  const k1 = derivees(mu, s);
  const k2 = derivees(mu, plus(s, k1, h / 2.0));
  const k3 = derivees(mu, plus(s, k2, h / 2.0));
  const k4 = derivees(mu, plus(s, k3, h));
  return [0, 1, 2, 3].map((i) => s[i]! + (h / 6.0) * (k1[i]! + 2.0 * k2[i]! + 2.0 * k3[i]! + k4[i]!)) as Etat;
}

export const H_MAX = 0.002;
export const R_CONTACT = 1e-3;

export function contact(mu: number, s: EtatQ): boolean {
  if (s.length === 6) {
    const [x, y, z] = s;
    return Math.sqrt((x + mu) ** 2 + y * y + z * z) < R_CONTACT || Math.sqrt((x - 1.0 + mu) ** 2 + y * y + z * z) < R_CONTACT;
  }
  return Math.hypot(s[0] + mu, s[1]) < R_CONTACT || Math.hypot(s[0] - 1.0 + mu, s[1]) < R_CONTACT;
}

export function omega3(mu: number, x: number, y: number, z: number): number {
  const r1 = Math.sqrt((x + mu) ** 2 + y * y + z * z);
  const r2 = Math.sqrt((x - 1.0 + mu) ** 2 + y * y + z * z);
  return 0.5 * (x * x + y * y) + (1.0 - mu) / r1 + mu / r2;
}

export function jacobi3(mu: number, x: number, y: number, z: number, vx: number, vy: number, vz: number): number {
  return 2.0 * omega3(mu, x, y, z) - vx * vx - vy * vy - vz * vz;
}

export function jacobi_etat(mu: number, s: EtatQ): number {
  return s.length === 6 ? jacobi3(mu, ...s) : jacobi(mu, ...s);
}

export function derivees3(mu: number, s: Etat3): Etat3 {
  const [x, y, z, vx, vy, vz] = s;
  const dx1 = x + mu,
    dx2 = x - 1.0 + mu;
  const r1 = Math.sqrt(dx1 * dx1 + y * y + z * z);
  const r2 = Math.sqrt(dx2 * dx2 + y * y + z * z);
  const k1 = (1.0 - mu) / (r1 * r1 * r1),
    k2 = mu / (r2 * r2 * r2);
  return [vx, vy, vz, x - k1 * dx1 - k2 * dx2 + 2.0 * vy, y - k1 * y - k2 * y - 2.0 * vx, -k1 * z - k2 * z];
}

export function pas_rk4_3(mu: number, s: Etat3, h: number): Etat3 {
  const plus = (a: Etat3, d: Etat3, f: number): Etat3 => [0, 1, 2, 3, 4, 5].map((i) => a[i]! + f * d[i]!) as Etat3;
  const k1 = derivees3(mu, s);
  const k2 = derivees3(mu, plus(s, k1, h / 2.0));
  const k3 = derivees3(mu, plus(s, k2, h / 2.0));
  const k4 = derivees3(mu, plus(s, k3, h));
  return [0, 1, 2, 3, 4, 5].map((i) => s[i]! + (h / 6.0) * (k1[i]! + 2.0 * k2[i]! + 2.0 * k3[i]! + k4[i]!)) as Etat3;
}

export function integrer<T extends EtatQ>(mu: number, s: T, duree: number): [T, boolean] {
  const n = Math.max(1, Math.ceil(duree / H_MAX));
  const h = duree / n;
  for (let k = 0; k < n; k++) {
    s = (s.length === 6 ? pas_rk4_3(mu, s as Etat3, h) : pas_rk4(mu, s as Etat, h)) as T;
    if (contact(mu, s)) return [s, true];
  }
  return [s, false];
}

/** Cas types : [clé, écart δ par défaut]. */
export const CAS: readonly [string, number][] = [
  ['tetard', 0.005],
  ['fer_a_cheval', 0.01],
  ['l1', 0.01],
  ['l2', 0.01],
  ['l3', 0.01],
  ['halo_l1', 0.01],
  ['halo_l2', 0.01],
];

export function regions(mu: number, c: number): string {
  const L = points_lagrange(mu);
  const cl = (k: 'L1' | 'L2' | 'L3' | 'L4'): number => jacobi(mu, L[k][0], L[k][1], 0.0, 0.0);
  if (c > cl('L1')) return 'r_ferme';
  if (c > Math.max(cl('L2'), cl('L3'))) return 'r_l1';
  if (c > Math.min(cl('L2'), cl('L3'))) return 'r_l2';
  if (c > cl('L4')) return 'r_l3';
  return 'r_partout';
}

export function depart(mu: number, cas: string, delta: number): EtatQ {
  if (cas === 'halo_l1' || cas === 'halo_l2') return halo(mu, cas === 'halo_l1' ? 'L1' : 'L2', delta).etat(0.0);
  const L = points_lagrange(mu);
  if (cas === 'tetard') {
    const [x, y] = L.L4;
    return [x + delta * 0.5, y + (delta * Math.sqrt(3.0)) / 2.0, 0.0, 0.0];
  }
  if (cas === 'fer_a_cheval') {
    const r = 1.0 + delta;
    return [-r, 0.0, 0.0, -(r ** -0.5 - r)];
  }
  if (cas === 'l1' || cas === 'l2' || cas === 'l3') {
    const [x, y] = L[cas.toUpperCase() as 'L1' | 'L2' | 'L3'];
    return [x + delta * 0.01, y, 0.0, 0.0];
  }
  const [x, y] = L.L4;
  return [x, y, 0.0, 0.0];
}

// ------------------------------------------------------------------ orbites de halo (Richardson 1980, 3ᵉ ordre)
export const AZ_MAX = 0.4;
export const PERIODES_J: Record<string, number> = { soleil_terre: 365.256_363, terre_lune: 27.321_662, soleil_jupiter: 4332.589, pluton_charon: 6.387_2 };

export class Halo {
  xl: number;
  gamma: number;
  dn: number;
  Ax: number;
  Az: number;
  nu: number;
  lam: number;
  k: number;
  private kk: number[];

  constructor(mu: number, point: 'L1' | 'L2', delta: number) {
    const xl = points_lagrange(mu)[point][0];
    this.xl = xl;
    const g = point === 'L1' ? 1.0 - mu - xl : xl - (1.0 - mu);
    this.gamma = g;
    const c = (n: number): number =>
      point === 'L1'
        ? (mu + (-1) ** n * (1.0 - mu) * g ** (n + 1) / (1.0 - g) ** (n + 1)) / g ** 3
        : ((-1) ** n * mu + ((-1) ** n * (1.0 - mu) * g ** (n + 1)) / (1.0 + g) ** (n + 1)) / g ** 3;
    const c2 = c(2),
      c3 = c(3),
      c4 = c(4);
    const lam = Math.sqrt((-(c2 - 2.0) + Math.sqrt((c2 - 2.0) ** 2 + 4.0 * (c2 - 1.0) * (1.0 + 2.0 * c2))) / 2.0);
    const k = (2.0 * lam) / (lam * lam + 1.0 - c2);
    const D = lam * lam - c2;
    const d1 = ((3.0 * lam * lam) / k) * (k * (6.0 * lam * lam - 1.0) - 2.0 * lam);
    const d2 = ((8.0 * lam * lam) / k) * (k * (11.0 * lam * lam - 1.0) - 2.0 * lam);
    const a21 = (3.0 * c3 * (k * k - 2.0)) / (4.0 * (1.0 + 2.0 * c2));
    const a22 = (3.0 * c3) / (4.0 * (1.0 + 2.0 * c2));
    const a23 = ((-3.0 * c3 * lam) / (4.0 * k * d1)) * (3.0 * k ** 3 * lam - 6.0 * k * (k - lam) + 4.0);
    const a24 = ((-3.0 * c3 * lam) / (4.0 * k * d1)) * (2.0 + 3.0 * k * lam);
    const b21 = ((-3.0 * c3 * lam) / (2.0 * d1)) * (3.0 * k * lam - 4.0);
    const b22 = (3.0 * c3 * lam) / d1;
    const d21 = -c3 / (2.0 * lam * lam);
    const a31 =
      ((-9.0 * lam) / (4.0 * d2)) * (4.0 * c3 * (k * a23 - b21) + k * c4 * (4.0 + k * k)) +
      ((9.0 * lam * lam + 1.0 - c2) / (2.0 * d2)) * (3.0 * c3 * (2.0 * a23 - k * b21) + c4 * (2.0 + 3.0 * k * k));
    const a32 =
      (-1.0 / d2) *
      (((9.0 * lam) / 4.0) * (4.0 * c3 * (k * a24 - b22) + k * c4) + 1.5 * (9.0 * lam * lam + 1.0 - c2) * (c3 * (k * b22 + d21 - 2.0 * a24) - c4));
    const b31 =
      (3.0 / (8.0 * d2)) *
      (8.0 * lam * (3.0 * c3 * (k * b21 - 2.0 * a23) - c4 * (2.0 + 3.0 * k * k)) +
        (9.0 * lam * lam + 1.0 + 2.0 * c2) * (4.0 * c3 * (k * a23 - b21) + k * c4 * (4.0 + k * k)));
    const b32 =
      (1.0 / d2) *
      (9.0 * lam * (c3 * (k * b22 + d21 - 2.0 * a24) - c4) + (3.0 / 8.0) * (9.0 * lam * lam + 1.0 + 2.0 * c2) * (4.0 * c3 * (k * a24 - b22) + k * c4));
    const d31 = (3.0 / (64.0 * lam * lam)) * (4.0 * c3 * a24 + c4);
    const d32 = (3.0 / (64.0 * lam * lam)) * (4.0 * c3 * (a23 - d21) + c4 * (4.0 + k * k));
    const den = 2.0 * lam * (lam * (1.0 + k * k) - 2.0 * k);
    const s1 = (1.5 * c3 * (2.0 * a21 * (k * k - 2.0) - a23 * (k * k + 2.0) - 2.0 * k * b21) - (3.0 / 8.0) * c4 * (3.0 * k ** 4 - 8.0 * k * k + 8.0)) / den;
    const s2 = (1.5 * c3 * (2.0 * a22 * (k * k - 2.0) + a24 * (k * k + 2.0) + 2.0 * k * b22 + 5.0 * d21) + (3.0 / 8.0) * c4 * (12.0 - k * k)) / den;
    const l1 = -1.5 * c3 * (2.0 * a21 + a23 + 5.0 * d21) - (3.0 / 8.0) * c4 * (12.0 - k * k) + 2.0 * lam * lam * s1;
    const l2 = 1.5 * c3 * (a24 - 2.0 * a22) + (9.0 / 8.0) * c4 + 2.0 * lam * lam * s2;
    this.dn = delta >= 0.0 ? 1.0 : -1.0;
    const Az = Math.min(Math.abs(delta) / g, AZ_MAX);
    const Ax = Math.sqrt(Math.max(0.0, (-D - l2 * Az * Az) / l1));
    this.Ax = Ax;
    this.Az = Az;
    this.nu = 1.0 + s1 * Ax * Ax + s2 * Az * Az;
    this.lam = lam;
    this.k = k;
    this.kk = [k, a21, a22, a23, a24, a31, a32, b21, b22, b31, b32, d21, d31, d32];
  }

  periode(): number {
    return (2.0 * Math.PI) / (this.lam * this.nu);
  }

  etat(t1: number): Etat3 {
    const [k, a21, a22, a23, a24, a31, a32, b21, b22, b31, b32, d21, d31, d32] = this.kk as [number, number, number, number, number, number, number, number, number, number, number, number, number, number];
    const Ax = this.Ax,
      Az = this.Az,
      dn = this.dn,
      g = this.gamma;
    const c1 = Math.cos(t1),
      c2_ = Math.cos(2.0 * t1),
      c3_ = Math.cos(3.0 * t1);
    const s1_ = Math.sin(t1),
      s2_ = Math.sin(2.0 * t1),
      s3_ = Math.sin(3.0 * t1);
    const ax2 = a23 * Ax * Ax - a24 * Az * Az,
      ax3 = a31 * Ax ** 3 - a32 * Ax * Az * Az;
    const by2 = b21 * Ax * Ax - b22 * Az * Az,
      by3 = b31 * Ax ** 3 - b32 * Ax * Az * Az;
    const z3 = d32 * Az * Ax * Ax - d31 * Az ** 3;
    const x = a21 * Ax * Ax + a22 * Az * Az - Ax * c1 + ax2 * c2_ + ax3 * c3_;
    const y = k * Ax * s1_ + by2 * s2_ + by3 * s3_;
    const z = dn * (Az * c1 + d21 * Ax * Az * (c2_ - 3.0) + z3 * c3_);
    const w = this.lam * this.nu;
    const vx = w * (Ax * s1_ - 2.0 * ax2 * s2_ - 3.0 * ax3 * s3_);
    const vy = w * (k * Ax * c1 + 2.0 * by2 * c2_ + 3.0 * by3 * c3_);
    const vz = w * dn * (-Az * s1_ - 2.0 * d21 * Ax * Az * s2_ - 3.0 * z3 * s3_);
    return [this.xl + g * x, g * y, g * z, g * vx, g * vy, g * vz];
  }

  courbe(n = 180): [number, number, number][] {
    const out: [number, number, number][] = [];
    for (let j = 0; j <= n; j++) {
      const e = this.etat((2.0 * Math.PI * j) / n);
      out.push([e[0], e[1], e[2]]);
    }
    return out;
  }
}

export function halo(mu: number, point: 'L1' | 'L2', delta: number): Halo {
  return new Halo(mu, point, delta);
}
