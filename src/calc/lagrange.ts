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

export function contact(mu: number, s: Etat): boolean {
  return Math.hypot(s[0] + mu, s[1]) < R_CONTACT || Math.hypot(s[0] - 1.0 + mu, s[1]) < R_CONTACT;
}

export function integrer(mu: number, s: Etat, duree: number): [Etat, boolean] {
  const n = Math.max(1, Math.ceil(duree / H_MAX));
  const h = duree / n;
  for (let k = 0; k < n; k++) {
    s = pas_rk4(mu, s, h);
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

export function depart(mu: number, cas: string, delta: number): Etat {
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
