/**
 * Mécanisme de Kozai-Lidov — jumeau de `coupole/modules/anim/kozai.py` de Coupole (mêmes formules, mêmes nombres) :
 * équations séculaires quadrupolaires d'une particule test sous forme vectorielle (e, j = √(1 − e²) n̂), en temps
 * t_K, Runge-Kutta 4 à pas égaux ; C = √(1 − e²) cos i conservé ; i critique 39,23° ; e_max = √(1 − 5/3 cos² i₀).
 */
export type V3 = [number, number, number];

export const I_CRITIQUE = (Math.acos(Math.sqrt(3.0 / 5.0)) * 180) / Math.PI;
export const JOUR_SIDERAL = 86_164.090_5;
export const ANNEE = 365.25 * 86_400.0;

/** Systèmes : [clé, M/M′, a′/a, période intérieure (années)]. */
export const SYSTEMES: readonly [string, number, number, number][] = [
  ['asteroide', 1047.348_644, 5.2026 / 2.7, 2.7 ** 1.5],
  ['satellite', 81.300_568, 384_400.0 / 26_560.0, JOUR_SIDERAL / 2.0 / ANNEE],
  ['exoplanete', 1.0, 100.0, 5.0 ** 1.5],
];

const rad = (d: number): number => (d * Math.PI) / 180.0;
const deg = (r: number): number => (r * 180.0) / Math.PI;

export function t_kozai_ans(m_sur_mp: number, ap_sur_a: number, periode_ans: number, ep = 0.0): number {
  return (m_sur_mp * ap_sur_a ** 3 * (1.0 - ep * ep) ** 1.5 * periode_ans) / (2.0 * Math.PI);
}

export function vecteurs(e: number, i_deg: number, w_deg: number, o_deg = 0.0): [V3, V3] {
  const i = rad(i_deg),
    w = rad(w_deg),
    o = rad(o_deg);
  const eh: V3 = [
    Math.cos(o) * Math.cos(w) - Math.sin(o) * Math.sin(w) * Math.cos(i),
    Math.sin(o) * Math.cos(w) + Math.cos(o) * Math.sin(w) * Math.cos(i),
    Math.sin(w) * Math.sin(i),
  ];
  const nh: V3 = [Math.sin(o) * Math.sin(i), -Math.cos(o) * Math.sin(i), Math.cos(i)];
  const g = Math.sqrt(1.0 - e * e);
  return [eh.map((x) => e * x) as V3, nh.map((x) => g * x) as V3];
}

function croix(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function derivees(ev: V3, jv: V3): [V3, V3] {
  const jz = jv[2],
    ez = ev[2];
  const jxz: V3 = [jv[1], -jv[0], 0.0];
  const exz: V3 = [ev[1], -ev[0], 0.0];
  const jxe = croix(jv, ev);
  const dj = [0, 1, 2].map((k) => 0.75 * (jz * jxz[k]! - 5.0 * ez * exz[k]!)) as V3;
  const de = [0, 1, 2].map((k) => 0.75 * (jz * exz[k]! + 2.0 * jxe[k]! - 5.0 * ez * jxz[k]!)) as V3;
  return [de, dj];
}

export function pas_rk4(ev: V3, jv: V3, h: number): [V3, V3] {
  const plus = (v: V3, d: V3, f: number): V3 => [v[0] + f * d[0], v[1] + f * d[1], v[2] + f * d[2]];
  const [a1, b1] = derivees(ev, jv);
  const [a2, b2] = derivees(plus(ev, a1, h / 2.0), plus(jv, b1, h / 2.0));
  const [a3, b3] = derivees(plus(ev, a2, h / 2.0), plus(jv, b2, h / 2.0));
  const [a4, b4] = derivees(plus(ev, a3, h), plus(jv, b3, h));
  const e2 = [0, 1, 2].map((k) => ev[k]! + (h / 6.0) * (a1[k]! + 2.0 * a2[k]! + 2.0 * a3[k]! + a4[k]!)) as V3;
  const j2 = [0, 1, 2].map((k) => jv[k]! + (h / 6.0) * (b1[k]! + 2.0 * b2[k]! + 2.0 * b3[k]! + b4[k]!)) as V3;
  return [e2, j2];
}

export const H_MAX = 0.005;

export function integrer(ev: V3, jv: V3, duree: number): [V3, V3] {
  const n = Math.max(1, Math.ceil(duree / H_MAX));
  const h = duree / n;
  for (let k = 0; k < n; k++) [ev, jv] = pas_rk4(ev, jv, h);
  return [ev, jv];
}

/** [e, i (degrés), ω (degrés, [0, 360[), Ω (degrés)]. */
export function elements(ev: V3, jv: V3): [number, number, number, number] {
  const e = Math.sqrt(ev[0] ** 2 + ev[1] ** 2 + ev[2] ** 2);
  const jn = Math.sqrt(jv[0] ** 2 + jv[1] ** 2 + jv[2] ** 2);
  const i = deg(Math.acos(Math.max(-1.0, Math.min(1.0, jv[2] / jn))));
  const o = deg(Math.atan2(jv[0], -jv[1]));
  const nx = -jv[1],
    ny = jv[0];
  const nn = Math.hypot(nx, ny);
  if (e < 1e-12 || nn < 1e-12) return [e, i, 0.0, o];
  const cos_w = (nx * ev[0] + ny * ev[1]) / (nn * e);
  const sin_w = i > 1e-9 ? ev[2] / (e * Math.sin(rad(i))) : 0.0;
  const w = ((deg(Math.atan2(sin_w, cos_w)) % 360.0) + 360.0) % 360.0;
  return [e, i, w, o];
}

export function constante_c(e: number, i_deg: number): number {
  return Math.sqrt(1.0 - e * e) * Math.cos(rad(i_deg));
}

export function energie(e: number, i_deg: number, w_deg: number): number {
  const si2 = Math.sin(rad(i_deg)) ** 2;
  return 2.0 + 3.0 * e * e - 3.0 * si2 * (1.0 - e * e + 5.0 * e * e * Math.sin(rad(w_deg)) ** 2);
}

export function e_max_circulaire(i0_deg: number): number {
  const c2 = Math.cos(rad(i0_deg)) ** 2;
  return Math.sqrt(Math.max(0.0, 1.0 - (5.0 / 3.0) * c2));
}

export function i_a_e(c: number, e: number): number {
  return deg(Math.acos(Math.max(-1.0, Math.min(1.0, c / Math.sqrt(1.0 - e * e)))));
}
