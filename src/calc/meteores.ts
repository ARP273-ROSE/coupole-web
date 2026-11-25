/**
 * Pluies d'étoiles filantes : radiant, hauteur, taux horaire — jumeau de `coupole/modules/anim/meteores.py` de
 * Coupole (mêmes données IMO, mêmes formules, même générateur pseudo-aléatoire, donc mêmes étoiles filantes).
 */
import * as astro from './astro';
import { pmod } from '../noyau/py';

/** [clé, [mois, jour du maximum, α, δ, v∞ km/s, ZHR, r, constellation]] (ordre de Coupole). */
export const ESSAIMS: [string, [number, number, number, number, number, number, number, string]][] = [
  ['quadrantides', [1, 4, 230.0, 49.0, 41.0, 80.0, 2.1, 'bouvier']],
  ['lyrides', [4, 22, 271.0, 34.0, 49.0, 18.0, 2.1, 'lyre']],
  ['eta_aquarides', [5, 6, 338.0, -1.0, 66.0, 50.0, 2.4, 'verseau']],
  ['perseides', [8, 12, 48.0, 58.0, 59.0, 100.0, 2.2, 'persee']],
  ['orionides', [10, 21, 95.0, 16.0, 66.0, 20.0, 2.5, 'orion']],
  ['leonides', [11, 17, 152.0, 22.0, 71.0, 15.0, 2.5, 'lion']],
  ['geminides', [12, 14, 112.0, 33.0, 35.0, 150.0, 2.6, 'gemeaux']],
];
export const ANNEE = 2026;
const RAD = Math.PI / 180;

export function essaim(k: string): [number, number, number, number, number, number, number, string] {
  return ESSAIMS.find(([c]) => c === k)![1];
}

export function jour_julien(k: string, heure: number): number {
  const [mois, jour] = essaim(k);
  return astro.jour_julien(ANNEE, mois, jour) + heure / 24.0;
}

export function hauteur_radiant(k: string, heure: number, lat: number): [number, number] {
  const e = essaim(k);
  const h = astro.tsmg(jour_julien(k, heure)) - e[2];
  return astro.equatorial_vers_horizon(h, e[3], lat);
}

export function hauteur_soleil(k: string, heure: number, lat: number): number {
  const s = astro.soleil(jour_julien(k, heure));
  const h = astro.tsmg(jour_julien(k, heure)) - s.alpha;
  return astro.equatorial_vers_horizon(h, s.delta, lat)[1];
}

export function taux_horaire(k: string, h_radiant: number, m_lim = 6.5): number {
  const e = essaim(k);
  if (h_radiant <= 0) return 0.0;
  return (e[5] * Math.sin(h_radiant * RAD)) / e[6] ** (6.5 - m_lim);
}

export function culmination(k: string, lat: number): [number, number] {
  const e = essaim(k);
  const theta0 = astro.tsmg(jour_julien(k, 18.0));
  const heures = (pmod(e[2] - theta0, 360.0) / 360.985_647_366_29) * 24.0;
  return [pmod(18.0 + heures, 24.0), 90.0 - Math.abs(lat - e[3])];
}

/** Générateur de Park et Miller (16807 x mod 2³¹ − 1), exact en double précision. */
export class Aleatoire {
  static M = 2_147_483_647;
  x: number;

  constructor(graine = 12345) {
    this.x = graine % Aleatoire.M || 1;
  }

  suivant(): number {
    this.x = (16807 * this.x) % Aleatoire.M;
    return this.x / Aleatoire.M;
  }
}

export function etoiles_de_fond(n = 320, graine = 2026): [number, number, number][] {
  const g = new Aleatoire(graine);
  const out: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const alpha = 360.0 * g.suivant();
    const delta = Math.asin(2.0 * g.suivant() - 1.0) / RAD;
    out.push([alpha, delta, 1.0 + 5.0 * g.suivant() ** 0.45]);
  }
  return out;
}

export type V = [number, number, number];

export function vers_horizon(az: number, alt: number): V {
  const a = az * RAD,
    h = alt * RAD;
  return [Math.cos(h) * Math.cos(a), Math.cos(h) * Math.sin(a), Math.sin(h)];
}

export function depuis_vecteur(v: V): [number, number] {
  const [x, y, z] = v;
  return [pmod(Math.atan2(y, x) / RAD, 360.0), Math.asin(Math.max(-1.0, Math.min(1.0, z))) / RAD];
}

const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function trainee(g: Aleatoire, az_r: number, alt_r: number): [number, number, number, number, number] | null {
  const u = g.suivant(),
    w = g.suivant();
  const h0 = Math.asin(u) / RAD;
  const az0 = 360.0 * w;
  const f = 0.5 + 0.7 * g.suivant();
  if (h0 < 8.0) return null;
  const r = vers_horizon(az_r, alt_r);
  const p = vers_horizon(az0, h0);
  const c = Math.max(-1.0, Math.min(1.0, dot(r, p)));
  const d = Math.acos(c);
  if (d < 1.5 * RAD) return [az0, h0, az0, h0, d / RAD];
  const t: V = [0, 1, 2].map((i) => (p[i]! * c - r[i]!) / Math.sin(d)) as V;
  const lg = 25.0 * Math.sin(d) * f * RAD;
  const q: V = [0, 1, 2].map((i) => p[i]! * Math.cos(lg) + t[i]! * Math.sin(lg)) as V;
  const [az1, h1] = depuis_vecteur(q);
  return [az0, h0, az1, h1, d / RAD];
}

export function arc(az0: number, h0: number, az1: number, h1: number, n = 16): [number, number][] {
  const a = vers_horizon(az0, h0),
    b = vers_horizon(az1, h1);
  const c = Math.max(-1.0, Math.min(1.0, dot(a, b)));
  const om = Math.acos(c);
  if (om < 1e-9) return [[az0, h0], [az1, h1]];
  const out: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const s0 = Math.sin((1 - t) * om) / Math.sin(om),
      s1 = Math.sin(t * om) / Math.sin(om);
    out.push(depuis_vecteur([0, 1, 2].map((i) => s0 * a[i]! + s1 * b[i]!) as V));
  }
  return out;
}
