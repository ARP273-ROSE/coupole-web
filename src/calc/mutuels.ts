/**
 * Phénomènes mutuels des satellites galiléens — jumeau de `coupole/modules/anim/mutuels.py` de Coupole (mêmes
 * formules, mêmes nombres) : orbites circulaires coplanaires, Terre et Soleil à la latitude B, Soleil à l'angle de
 * phase φ ; occultation = aire commune de deux disques uniformes ; éclipse = part du disque solaire cachée par le
 * satellite actif, moyennée sur le disque éclipsé (intégrale en s, arcs de cercle, Simpson en θ).
 */
import { degrees, radians } from '../noyau/py';

export const R_JUPITER = 71_492.0;
export const R_SOLEIL = 695_700.0;
export const UA = 149_597_870.7;
export const D_JUPITER = 5.2029 * UA;
/** Satellites : [clé, numéro, a (km), rayon (km), période (j), albédo géométrique]. */
export const SATELLITES: readonly [string, number, number, number, number, number][] = [
  ['io', 1, 421_800.0, 1821.6, 1.769_138, 0.63], ['europe', 2, 671_100.0, 1560.8, 3.551_181, 0.67],
  ['ganymede', 3, 1_070_400.0, 2631.2, 7.154_553, 0.43], ['callisto', 4, 1_882_700.0, 2410.3, 16.689_017, 0.17],
];
export const N_SIMPSON = 32;
export const N_COURBE = 240;

export function satellite(cle: string): readonly [string, number, number, number, number, number] {
  return SATELLITES.find((s) => s[0] === cle)!;
}

export function aire_commune(d: number, r1: number, r2: number): number {
  if (d >= r1 + r2) return 0.0;
  if (d <= Math.abs(r1 - r2)) {
    const r = Math.min(r1, r2);
    return Math.PI * r * r;
  }
  const c1 = Math.max(-1.0, Math.min(1.0, (d * d + r1 * r1 - r2 * r2) / (2.0 * d * r1)));
  const c2 = Math.max(-1.0, Math.min(1.0, (d * d + r2 * r2 - r1 * r1) / (2.0 * d * r2)));
  const k = (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2);
  return r1 * r1 * Math.acos(c1) + r2 * r2 * Math.acos(c2) - 0.5 * Math.sqrt(Math.max(0.0, k));
}

export function flux_propre(cle: string): number {
  const s = satellite(cle);
  return s[5] * s[3] * s[3];
}

type P2 = [number, number];

export class Rencontre {
  aa: number;
  ra: number;
  na: number;
  ap: number;
  rp: number;
  np: number;
  b: number;
  psi: number;
  la0: number;
  lp0: number;

  constructor(
    public actif: string,
    public passif: string,
    public genre: string,
    b_deg: number,
    phase_deg: number,
    f_x0: number,
  ) {
    const sa = satellite(actif),
      sp = satellite(passif);
    this.aa = sa[2];
    this.ra = sa[3];
    this.na = (2.0 * Math.PI) / (sa[4] * 1440.0);
    this.ap = sp[2];
    this.rp = sp[3];
    this.np = (2.0 * Math.PI) / (sp[4] * 1440.0);
    this.b = radians(b_deg);
    this.psi = genre === 'eclipse' ? radians(phase_deg) : 0.0;
    const x0 = f_x0 * Math.min(this.aa, this.ap);
    const cote = this.aa < this.ap ? 1.0 : -1.0;
    this.la0 = this.lambda(this.aa, x0, cote);
    this.lp0 = this.lambda(this.ap, x0, cote);
  }

  private lambda(a: number, x0: number, cote: number): number {
    return Math.atan2(cote * Math.sqrt(Math.max(0.0, a * a - x0 * x0)), x0) + this.psi;
  }

  positions(t: number): [P2, P2] {
    const la = this.la0 + this.na * t,
      lp = this.lp0 + this.np * t;
    return [
      [this.aa * Math.cos(la), this.aa * Math.sin(la)],
      [this.ap * Math.cos(lp), this.ap * Math.sin(lp)],
    ];
  }

  ciel(P: P2, psi: number): [number, number, number] {
    const c = Math.cos(psi),
      s = Math.sin(psi);
    const X = c * P[0] + s * P[1],
      Y = -s * P[0] + c * P[1];
    return [X, Y * Math.sin(this.b), -Y * Math.cos(this.b)];
  }

  ombre(t: number): [number, number] {
    const [Pa, Pp] = this.positions(t);
    const [xa, ya, za] = this.ciel(Pa, this.psi);
    const [xp, yp, zp] = this.ciel(Pp, this.psi);
    return [Math.hypot(xa - xp, ya - yp), za - zp];
  }

  eclairement(t: number): number {
    const [d, ell] = this.ombre(t);
    if (ell <= 0.0) return 1.0;
    const rho = R_SOLEIL / D_JUPITER;
    const Rp = this.rp;
    const s0 = Math.max(0.0, d - Rp),
      s1 = Math.min(d + Rp, this.ra + ell * rho);
    if (s1 <= s0) return 1.0;
    const ens = new Set<number>([s0, s1]);
    for (const x of [Rp - d, this.ra - ell * rho, this.ra + ell * rho]) if (s0 < x && x < s1) ens.add(x);
    const coupures = [...ens].sort((x, y) => x - y);
    const f = (s: number): number => {
      if (s <= 0.0) return 0.0;
      let arc: number;
      if (d + s <= Rp) arc = 2.0 * Math.PI * s;
      else {
        const c = Math.max(-1.0, Math.min(1.0, (s * s + d * d - Rp * Rp) / (2.0 * s * d)));
        arc = 2.0 * s * Math.acos(c);
      }
      return (arc * aire_commune(s / ell, this.ra / ell, rho)) / (Math.PI * rho * rho);
    };
    let tot = 0.0;
    for (let q = 0; q < coupures.length - 1; q++) {
      const u = coupures[q]!,
        v = coupures[q + 1]!;
      const demi = (v - u) / 2.0;
      const h = Math.PI / N_SIMPSON;
      let acc = 0.0;
      for (let k = 1; k < N_SIMPSON; k++) {
        const th = k * h;
        acc += (k % 2 ? 4.0 : 2.0) * f(u + demi * (1.0 - Math.cos(th))) * demi * Math.sin(th);
      }
      tot += (acc * h) / 3.0;
    }
    return Math.max(0.0, 1.0 - tot / (Math.PI * Rp * Rp));
  }

  flux(t: number): number {
    const fa = flux_propre(this.actif),
      fp = flux_propre(this.passif);
    if (this.genre === 'eclipse') return (fa + fp * this.eclairement(t)) / (fa + fp);
    const [Pa, Pp] = this.positions(t);
    const [xa, ya] = this.ciel(Pa, 0.0);
    const [xp, yp] = this.ciel(Pp, 0.0);
    const d = Math.hypot(xa - xp, ya - yp);
    const cache = aire_commune(d, this.ra, this.rp) / (Math.PI * this.rp * this.rp);
    return (fa + fp * (1.0 - cache)) / (fa + fp);
  }

  vitesse_relative(): number {
    const va = this.aa * this.na;
    const vp = this.ap * this.np;
    const dla = this.la0 - this.psi;
    const dlp = this.lp0 - this.psi;
    const vxa = -va * Math.sin(dla),
      vya = va * Math.cos(dla) * Math.sin(this.b);
    const vxp = -vp * Math.sin(dlp),
      vyp = vp * Math.cos(dlp) * Math.sin(this.b);
    return Math.hypot(vxa - vxp, vya - vyp);
  }

  parametre_impact(): number {
    const [Pa, Pp] = this.positions(0.0);
    return Math.abs(this.ciel(Pa, this.psi)[1] - this.ciel(Pp, this.psi)[1]);
  }

  demi_fenetre(): number {
    const [Pa, Pp] = this.positions(0.0);
    const ell = Math.abs(this.ciel(Pa, this.psi)[2] - this.ciel(Pp, this.psi)[2]);
    const taille = this.ra + this.rp + (this.genre === 'eclipse' ? (ell * R_SOLEIL) / D_JUPITER : 0.0);
    const v = this.vitesse_relative();
    return Math.min(360.0, (1.6 * taille) / Math.max(v, 1e-6));
  }

  courbe(n = N_COURBE): [number, number][] {
    const T = this.demi_fenetre();
    const out: [number, number][] = [];
    for (let k = 0; k <= n; k++) out.push([-T + (2.0 * T * k) / n, this.flux(-T + (2.0 * T * k) / n)]);
    return out;
  }

  b_limite(): number {
    const [Pa, Pp] = this.positions(0.0);
    const c = Math.cos(this.psi),
      s = Math.sin(this.psi);
    const dY = Math.abs(-s * Pa[0] + c * Pa[1] - (-s * Pp[0] + c * Pp[1]));
    const taille = this.ra + this.rp + (this.genre === 'eclipse' ? (dY * R_SOLEIL) / D_JUPITER : 0.0);
    return degrees(Math.asin(Math.min(1.0, taille / Math.max(dY, 1e-9))));
  }
}

/** [flux minimal, instant du minimum, durée (min) où le flux est sous 1]. */
export function resume(courbe: readonly [number, number][]): [number, number, number] {
  let fmin = Infinity,
    tmin = 0.0;
  for (const [t, f] of courbe) if (f < fmin || (f === fmin && t < tmin)) [fmin, tmin] = [f, t];
  const dedans = courbe.filter(([, f]) => f < 1.0 - 1e-9).map(([t]) => t);
  const duree = dedans.length ? dedans[dedans.length - 1]! - dedans[0]! : 0.0;
  return [fmin, tmin, duree];
}
