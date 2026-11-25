/**
 * Traînées de météoroïdes éjectés par une comète — jumeau de `coupole/modules/anim/trainees.py` de Coupole (mêmes
 * formules, mêmes nombres) : grains lâchés au périhélie (vitesses dans une boule de rayon Δv, générateur de Park et
 * Miller), gravité GM(1 − β) (β = 5,7 × 10⁻⁵/(ρ s), Burns, Lamy et Soter 1979), orbites de Kepler ; passages au nœud
 * comparés à ceux de la Terre (orbite képlérienne, éléments de Standish) : diagramme (Δt, Δr), activité par année.
 */
import { degrees, pmod, pround, radians } from '../noyau/py';
import { Aleatoire } from './meteores';

export const DEUX_PI = 2.0 * Math.PI;
export const K_GAUSS = 0.017_202_098_95;
export const GM = (K_GAUSS * 365.25) ** 2;
export const UA_KM = 149_597_870.7;
export const MS_EN_UA_AN = (365.25 * 86_400.0) / (UA_KM * 1000.0);
export const A_TERRE = 1.000_002_61,
  E_TERRE = 0.016_711_23;
export const VARPI_TERRE = 102.937_681_93,
  L0_TERRE = 100.464_571_66;
export const N_TERRE = 35_999.372_449_81 / 100.0;

export type Comete = [string, number, number, number, number, number | null, number, string];
export const COMETES: readonly Comete[] = [
  ['tempel_tuttle', 10.3383, 0.905_553, 162.487, 235.271, 172.5, 1998.1591, 'leonides'],
  ['swift_tuttle', 26.0921, 0.963_226, 113.454, 139.381, 152.982, 1992.9459, 'perseides'],
  ['fictive', 10.3383, 0.905_553, 162.487, 235.271, null, 1998.1591, 'fictif'],
];
export const TAILLES: readonly [string, number][] = [['cm', 1.0], ['mm', 0.1], ['dixieme', 0.01]];
export const N_GRAINS = 200;
export const ANS_APRES = 80.0;
export const EPS_R = 0.01;
export const EPS_T = 10.0;

export const beta = (rayon_cm: number, rho = 1.0): number => 5.7e-5 / (rho * rayon_cm);

export function kepler(m: number, e: number): number {
  let E = e < 0.8 ? m : Math.PI;
  for (let k = 0; k < 60; k++) {
    const d = (E - e * Math.sin(E) - m) / (1.0 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-13) break;
  }
  return E;
}

export function m_de_nu(nu: number, e: number): number {
  const E = 2.0 * Math.atan2(Math.sqrt(1.0 - e) * Math.sin(nu / 2.0), Math.sqrt(1.0 + e) * Math.cos(nu / 2.0));
  return E - e * Math.sin(E);
}

export function r_terre(lam_deg: number): number {
  const nu = radians(lam_deg - VARPI_TERRE);
  return (A_TERRE * (1.0 - E_TERRE ** 2)) / (1.0 + E_TERRE * Math.cos(nu));
}

export function date_terre(lam_deg: number, annee: number): number {
  const m = degrees(m_de_nu(radians(lam_deg - VARPI_TERRE), E_TERRE));
  const L = pmod(m + VARPI_TERRE - L0_TERRE, 360.0);
  let t = 2000.0 + L / N_TERRE;
  const an = 360.0 / N_TERRE;
  t += Math.floor((annee - t) / an) * an;
  while (t < annee) t += an;
  while (t >= annee + 1.0) t -= an;
  return t;
}

type V3 = [number, number, number];

export class Orbite {
  n: number;
  p: number;
  private mat: number[];

  constructor(
    public a: number,
    public e: number,
    public i: number,
    public o: number,
    public w: number,
    public m0: number,
    public t0: number,
    public mu = GM,
  ) {
    this.n = Math.sqrt(mu / a ** 3);
    this.p = a * (1.0 - e * e);
    const co = Math.cos(o),
      so = Math.sin(o),
      ci = Math.cos(i),
      si = Math.sin(i),
      cw = Math.cos(w),
      sw = Math.sin(w);
    this.mat = [co * cw - so * sw * ci, -co * sw - so * cw * ci, so * cw + co * sw * ci, -so * sw + co * cw * ci, sw * si, cw * si];
  }

  periode(): number {
    return DEUX_PI / this.n;
  }

  etat(t: number): [V3, V3] {
    const e = this.e;
    const E = kepler(pmod(this.m0 + this.n * (t - this.t0), DEUX_PI), e);
    const cE = Math.cos(E),
      sE = Math.sin(E);
    const b = Math.sqrt(1.0 - e * e);
    const xo = this.a * (cE - e),
      yo = this.a * b * sE;
    const f = (this.n * this.a) / (1.0 - e * cE);
    const vxo = -f * sE,
      vyo = f * b * cE;
    const m = this.mat;
    return [
      [m[0]! * xo + m[1]! * yo, m[2]! * xo + m[3]! * yo, m[4]! * xo + m[5]! * yo],
      [m[0]! * vxo + m[1]! * vyo, m[2]! * vxo + m[3]! * vyo, m[4]! * vxo + m[5]! * vyo],
    ];
  }

  position(t: number): V3 {
    const e = this.e;
    const E = kepler(pmod(this.m0 + this.n * (t - this.t0), DEUX_PI), e);
    const xo = this.a * (Math.cos(E) - e),
      yo = this.a * Math.sqrt(1.0 - e * e) * Math.sin(E);
    const m = this.mat;
    return [m[0]! * xo + m[1]! * yo, m[2]! * xo + m[3]! * yo, m[4]! * xo + m[5]! * yo];
  }
}

export function orbite_de(r: V3, v: V3, t: number, mu: number): Orbite | null {
  const [x, y, z] = r;
  const [vx, vy, vz] = v;
  const rn = Math.sqrt(x * x + y * y + z * z);
  const v2 = vx * vx + vy * vy + vz * vz;
  const en = v2 / 2.0 - mu / rn;
  if (en >= 0.0) return null;
  const a = -mu / (2.0 * en);
  const hx = y * vz - z * vy,
    hy = z * vx - x * vz,
    hz = x * vy - y * vx;
  const h = Math.sqrt(hx * hx + hy * hy + hz * hz);
  const i = Math.acos(Math.max(-1.0, Math.min(1.0, hz / h)));
  const o = Math.atan2(hx, -hy);
  const rv = x * vx + y * vy + z * vz;
  const ex = ((v2 - mu / rn) * x - rv * vx) / mu;
  const ey = ((v2 - mu / rn) * y - rv * vy) / mu;
  const ez = ((v2 - mu / rn) * z - rv * vz) / mu;
  const e = Math.sqrt(ex * ex + ey * ey + ez * ez);
  const nx = Math.cos(o),
    ny = Math.sin(o);
  const cw = (nx * ex + ny * ey) / e;
  const sw = (ny * ez * hx - nx * ez * hy + (nx * ey - ny * ex) * hz) / (h * e);
  const w = Math.atan2(sw, cw);
  const cnu = (ex * x + ey * y + ez * z) / (e * rn);
  let nu = Math.acos(Math.max(-1.0, Math.min(1.0, cnu)));
  if (rv < 0.0) nu = DEUX_PI - nu;
  return new Orbite(a, e, i, o, w, pmod(m_de_nu(nu, e), DEUX_PI), t, mu);
}

export function comete(cle: string): Comete {
  let c = COMETES.find((x) => x[0] === cle)!;
  if (c[5] === null) {
    const a = c[1],
      e = c[2],
      o = c[4];
    const rE = r_terre(o + 180.0);
    const w = degrees(Math.acos((1.0 - (a * (1.0 - e * e)) / rE) / e));
    c = [c[0], c[1], c[2], c[3], c[4], w, c[6], c[7]];
  }
  return c;
}

export function orbite_comete(cle: string): Orbite {
  const [, a, e, i, o, w, tp] = comete(cle);
  return new Orbite(a, e, radians(i), radians(o), radians(w!), 0.0, tp);
}

export function noeud(orb: Orbite, genre: string): [number, number, number] {
  const nu = genre === 'asc' ? -orb.w : Math.PI - orb.w;
  const r = orb.p / (1.0 + orb.e * Math.cos(nu));
  const lam = degrees(orb.o) + (genre === 'asc' ? 0.0 : 180.0);
  return [r, pmod(lam, 360.0), pmod(m_de_nu(nu, orb.e), DEUX_PI)];
}

export function noeud_terrestre(orb: Orbite): string {
  let best: [number, string] | null = null;
  for (const g of ['asc', 'desc']) {
    const [r, lam] = noeud(orb, g);
    const d = Math.abs(r - r_terre(lam));
    if (best === null || d < best[0]) best = [d, g];
  }
  return best![1];
}

export function passages(orb: Orbite, t0: number, t1: number): number[] {
  const P = orb.periode();
  let k = Math.ceil((t0 - orb.t0) / P);
  const out: number[] = [];
  while (orb.t0 + k * P <= t1) {
    out.push(orb.t0 + k * P);
    k += 1;
  }
  return out;
}

export function fenetre(cle: string): [number, number] {
  const tp = comete(cle)[6];
  const P = orbite_comete(cle).periode();
  return [Math.floor(tp - Math.max(240.0, 3.5 * P)), Math.floor(tp + ANS_APRES)];
}

export function ejecter(orb: Orbite, t: number, dv_ms: number, b: number, n = N_GRAINS, graine = 1): (Orbite | null)[] {
  const g = new Aleatoire(graine);
  const [r, v] = orb.etat(t);
  const mu = GM * (1.0 - b);
  const out: (Orbite | null)[] = [];
  for (let k = 0; k < n; k++) {
    const cz = 2.0 * g.suivant() - 1.0;
    const ph = DEUX_PI * g.suivant();
    const s = dv_ms * MS_EN_UA_AN * g.suivant() ** (1.0 / 3.0);
    const sz = Math.sqrt(Math.max(0.0, 1.0 - cz * cz));
    const dv: V3 = [s * sz * Math.cos(ph), s * sz * Math.sin(ph), s * cz];
    out.push(orbite_de(r, [v[0] + dv[0], v[1] + dv[1], v[2] + dv[2]], t, mu));
  }
  return out;
}

export type Noeud = [number, number, number, number];
export type Trainee = [number, Orbite[], Noeud[]];

export class Essaim {
  comete: Orbite;
  genre: string;
  beta: number;
  ejections: number[];
  traines: Trainee[] = [];

  constructor(cle: string, dv_ms: number, taille: string, debut: number, fin: number) {
    this.comete = orbite_comete(cle);
    this.genre = noeud_terrestre(this.comete);
    const b = beta(TAILLES.find(([k]) => k === taille)![1]);
    this.beta = b;
    this.ejections = passages(this.comete, debut, fin);
    this.ejections.forEach((tk, k) => {
      const grains = ejecter(this.comete, tk, dv_ms, b, N_GRAINS, 1000 + k).filter((o): o is Orbite => o !== null);
      const noeuds: Noeud[] = grains.map((o) => {
        const [r, lam, mn] = noeud(o, this.genre);
        const tau0 = tk + pmod(mn - o.m0, DEUX_PI) / o.n;
        return [r, lam, tau0, o.periode()];
      });
      this.traines.push([tk, grains, noeuds]);
    });
  }

  ecarts(annee: number): [number, number, number][] {
    const out: [number, number, number][] = [];
    this.traines.forEach(([tk, , noeuds], k) => {
      for (const [r, lam, tau0, P] of noeuds) {
        const tE = date_terre(lam, annee);
        if (tE <= tk) continue;
        const j = Math.max(0, pround((tE - tau0) / P));
        out.push([(tau0 + j * P - tE) * 365.25, r - r_terre(lam), k]);
      }
    });
    return out;
  }

  activite(a0: number, a1: number): Map<number, number> {
    const out = new Map<number, number>();
    for (let y = a0; y <= a1; y++) out.set(y, 0);
    for (const [tk, , noeuds] of this.traines) {
      for (const [r, lam, tau0, P] of noeuds) {
        if (Math.abs(r - r_terre(lam)) >= EPS_R) continue;
        const tE0 = date_terre(lam, a0);
        const an = 360.0 / N_TERRE;
        let j = 0;
        while (tau0 + j * P <= a1 + 1.0) {
          const tau = tau0 + j * P;
          const y = pround((tau - tE0) / an);
          if (y >= 0 && y <= a1 - a0 && Math.abs(tau - (tE0 + y * an)) * 365.25 < EPS_T && tE0 + y * an > tk) out.set(a0 + y, out.get(a0 + y)! + 1);
          j += 1;
        }
      }
    }
    return out;
  }
}

export function terre(t: number): [number, number] {
  const m = radians(pmod(L0_TERRE + N_TERRE * (t - 2000.0) - VARPI_TERRE, 360.0));
  const E = kepler(m, E_TERRE);
  const nu = 2.0 * Math.atan2(Math.sqrt(1.0 + E_TERRE) * Math.sin(E / 2.0), Math.sqrt(1.0 - E_TERRE) * Math.cos(E / 2.0));
  const lam = nu + radians(VARPI_TERRE);
  const r = A_TERRE * (1.0 - E_TERRE * Math.cos(E));
  return [r * Math.cos(lam), r * Math.sin(lam)];
}
