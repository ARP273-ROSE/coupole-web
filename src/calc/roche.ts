/**
 * La limite de Roche — jumeau de `coupole/modules/anim/roche.py` de Coupole (mêmes formules, mêmes nombres) : limites
 * fluide (2,44) et rigide (∛3) en R ∛(ρₚ/ρₛ), étirement de marée, allongement d'équilibre, grains d'un amas en rotation
 * d'ensemble puis orbites de Kepler (R = 1, GM = 1).
 */
export const K_FLUIDE = 2.44;
export const K_RIGIDE = 3.0 ** (1.0 / 3.0);
/** Systèmes : [clé, ρ planète, ρ satellite (kg·m⁻³), rayon de la planète (km), distance de départ (R)]. */
export const SYSTEMES: readonly [string, number, number, number, number][] = [
  ['terre_lune', 5514.0, 3344.0, 6378.1, 10.0], ['mars_phobos', 3933.0, 1876.0, 3389.5, 2.76],
  ['saturne_glace', 687.0, 920.0, 60268.0, 3.08], ['jupiter_comete', 1326.0, 500.0, 71492.0, 4.0],
];
export const R_SATELLITE = 0.16;

export type Elements = [number, number, number, number, number] | null;

export const limite = (rapport: number, modele: string): number => (modele === 'fluide' ? K_FLUIDE : K_RIGIDE) * rapport ** (1.0 / 3.0);
export const etirement = (rapport: number, d: number): number => (3.0 * rapport) / d ** 3;
export const allongement = (rapport: number, d: number): number => ((15.0 / 4.0) * rapport) / d ** 3;
export const periode = (d: number): number => 2.0 * Math.PI * d ** 1.5;

export function grains(n_couronnes = 5): [number, number][] {
  const out: [number, number][] = [];
  const pas = 1.0 / n_couronnes;
  for (let j = -n_couronnes; j <= n_couronnes; j++) {
    const y = ((j * pas * Math.sqrt(3.0)) / 2.0);
    const decal = j % 2 ? 0.5 * pas : 0.0;
    for (let i = -n_couronnes - 1; i <= n_couronnes + 1; i++) {
      const x = i * pas + decal;
      if (x * x + y * y <= 1.0 + 1e-9) out.push([x, y]);
    }
  }
  return out;
}

export function position_intact(d: number, theta: number, g: readonly [number, number], etire: number): [number, number] {
  const x = g[0] * R_SATELLITE * (1.0 + etire),
    y = (g[1] * R_SATELLITE) / Math.sqrt(1.0 + etire);
  const c = Math.cos(theta),
    s = Math.sin(theta);
  return [d * c + x * c - y * s, d * s + x * s + y * c];
}

export function elements(x: number, y: number, vx: number, vy: number): Elements {
  const r = Math.hypot(x, y);
  const v2 = vx * vx + vy * vy;
  const en = v2 / 2.0 - 1.0 / r;
  if (en >= 0.0) return null;
  const a = -1.0 / (2.0 * en);
  const rv = x * vx + y * vy;
  const ex = (v2 - 1.0 / r) * x - rv * vx;
  const ey = (v2 - 1.0 / r) * y - rv * vy;
  const e = Math.hypot(ex, ey);
  const w = e > 1e-12 ? Math.atan2(ey, ex) : 0.0;
  const h = x * vy - y * vx;
  const nu = Math.atan2(y, x) - w;
  const E = 2.0 * Math.atan2(Math.sqrt(1.0 - e) * Math.sin(nu / 2.0), Math.sqrt(1.0 + e) * Math.cos(nu / 2.0));
  const m0 = E - e * Math.sin(E);
  const n = a ** -1.5;
  return [a, e, w, m0, h > 0.0 ? n : -n];
}

export function position_kepler(el: readonly [number, number, number, number, number], t: number): [number, number] {
  const [a, e, w, m0, n] = el;
  const m = m0 + n * t;
  let E = m;
  for (let k = 0; k < 30; k++) {
    const d = (E - e * Math.sin(E) - m) / (1.0 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-13) break;
  }
  const xo = a * (Math.cos(E) - e);
  let yo = a * Math.sqrt(1.0 - e * e) * Math.sin(E);
  if (n < 0.0) yo = -yo;
  const c = Math.cos(w),
    s = Math.sin(w);
  return [c * xo - s * yo, s * xo + c * yo];
}

export function liberer(d: number, theta: number, gs: readonly [number, number][], etire: number): Elements[] {
  const om = d ** -1.5;
  return gs.map((g) => {
    const [x, y] = position_intact(d, theta, g, etire);
    return elements(x, y, -om * y, om * x);
  });
}
