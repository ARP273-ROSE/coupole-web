/**
 * Mécanique de l'animation « Le canon de Newton » (idée des Principia de Newton, 1687 ; code propre à Coupole).
 * Jumeau exact de coupole/modules/anim/canon_meca.py de Coupole : mêmes opérations dans le même ordre (cas communs :
 * tests/references/canon_cas.json, produits par outils/cas_canon.py de Coupole ; sans air, mêmes nombres au bit près).
 *
 * Un boulet est tiré du sommet d'une montagne, sur un astre sphérique et immobile.  Le mouvement est intégré par le
 * moteur de « Gravité et orbites » (gravite.ts : Yoshida d'ordre 4, pas adaptatif, collisions) : l'astre et un
 * boulet de masse nulle.  L'air, en option, freine le boulet (a = −½ ρ v |v| / B, B = m / (C_d A)), ajouté par
 * `Systeme.acc_sup`, avec un pas borné par le temps de freinage et la hauteur d'échelle ; l'impact est placé sur la
 * sphère.  Éléments de Kepler analytiques.  Constantes et sources : voir canon_meca.py (CODATA 2018, UAI 2015, DE440,
 * Archinal et al. 2018, Park et al. 2019, Daly et al. 2023, CIRA-72 / Vallado 2013, NASA Mars Fact Sheet).
 */
import { ALT_ISS as ALT_ISS_G, G, GM_LUNE, GM_TERRE, RAYONS, Systeme, type Corps } from './gravite';

export interface Astre {
  gm: number;
  r: number;
  couleur: string;
}
export const ASTRES: Readonly<Record<string, Astre>> = {
  terre: { gm: GM_TERRE, r: RAYONS['terre']!, couleur: 'terre' },
  lune: { gm: GM_LUNE, r: RAYONS['lune']!, couleur: 'lune' },
  mars: { gm: 4.2828375816e13, r: 3.3895e6, couleur: 'mars' },
  ceres: { gm: 6.262905e10, r: 4.69725e5, couleur: 'lune' },
  dimorphos: { gm: G * 4.3e9, r: 75.5, couleur: 'lune' },
};
export const NOMS_ASTRES = ['terre', 'lune', 'mars', 'ceres', 'dimorphos'] as const;

/** atmosphère terrestre : [altitude de base (m), densité (kg·m⁻³), hauteur d'échelle (m)] par tranche */
export const ATM_TERRE: readonly [number, number, number][] = (
  [
    [0, 1.225, 7.249], [25, 3.899e-2, 6.349], [30, 1.774e-2, 6.682], [40, 3.972e-3, 7.554],
    [50, 1.057e-3, 8.382], [60, 3.206e-4, 7.714], [70, 8.770e-5, 6.549], [80, 1.905e-5, 5.799],
    [90, 3.396e-6, 5.382], [100, 5.297e-7, 5.877], [110, 9.661e-8, 7.263], [120, 2.438e-8, 9.473],
    [130, 8.484e-9, 12.636], [140, 3.845e-9, 16.149], [150, 2.070e-9, 22.523], [180, 5.464e-10, 29.740],
    [200, 2.789e-10, 37.105], [250, 7.248e-11, 45.546], [300, 2.418e-11, 53.628], [350, 9.518e-12, 53.298],
    [400, 3.725e-12, 58.515], [450, 1.585e-12, 60.828], [500, 6.967e-13, 63.822], [600, 1.454e-13, 71.835],
    [700, 3.614e-14, 88.667], [800, 1.170e-14, 124.64], [900, 5.245e-15, 181.05], [1000, 3.019e-15, 268.00],
  ] as [number, number, number][]
).map(([h, r, H]) => [h * 1000.0, r, H * 1000.0] as [number, number, number]);
export const PLAFOND_TERRE = 2.5e6;
export const RHO_MARS = 0.02;
export const H_MARS = 11100.0;
export const PLAFOND_MARS = 40 * H_MARS;
export const KARMAN = 100000.0;
export const BALISTIQUE: Readonly<Record<string, number>> = { boulet: 1300.0, capsule: 350.0, satellite: 50.0 };
export const PROJECTILES = ['boulet', 'capsule', 'satellite'] as const;

export const MAX_PAS_IMAGE = 2000;
export const ETA_AIR = 0.02;
export const ETA_H = 0.02;
export const SOUS_PAS = 32;
export const LOIN = 12.0;
export const TOL_CERCLE = 0.005;
export const TOL_PARABOLE = 0.005;

export function atmosphere(astre: string): boolean {
  return astre === 'terre' || astre === 'mars';
}

function tranche(h: number): [number, number, number] {
  let i = ATM_TERRE.length - 1;
  while (i > 0 && ATM_TERRE[i]![0] > h) i -= 1;
  return ATM_TERRE[i]!;
}

/** Densité de l'air (kg·m⁻³) à l'altitude h (m) ; 0 sans atmosphère ou au-dessus du plafond. */
export function densite(astre: string, h: number): number {
  if (astre === 'terre') {
    if (h > PLAFOND_TERRE) return 0.0;
    const [h0, r0, H] = tranche(h);
    return r0 * Math.exp(-(h - h0) / H);
  }
  if (astre === 'mars') {
    if (h > PLAFOND_MARS) return 0.0;
    return RHO_MARS * Math.exp(-h / H_MARS);
  }
  return 0.0;
}

/** Hauteur d'échelle locale (m) de l'air à l'altitude h ; Infinity sans air. */
export function hauteur_echelle(astre: string, h: number): number {
  if (astre === 'terre' && h <= PLAFOND_TERRE) return tranche(h)[2];
  if (astre === 'mars' && h <= PLAFOND_MARS) return H_MARS;
  return Infinity;
}

export function v_satellisation(mu: number, r: number): number {
  return Math.sqrt(mu / r);
}

export function v_liberation(mu: number, r: number): number {
  return Math.sqrt((2 * mu) / r);
}

export type Genre = 'retombe' | 'cercle' | 'ellipse' | 'parabole' | 'hyperbole';
export interface Elements {
  eps: number;
  h: number;
  e: number;
  a: number;
  rp: number;
  ra: number;
  T: number;
  type: Genre;
  ex: number;
  ey: number;
  r: number;
  v: number;
  x_lib: number;
}

/** Éléments de la conique (Kepler) passant par (x, y) à la vitesse (vx, vy) (voir canon_meca.elements). */
export function elements(mu: number, R: number, x: number, y: number, vx: number, vy: number): Elements {
  const r = Math.sqrt(x * x + y * y);
  const v2 = vx * vx + vy * vy;
  const eps = 0.5 * v2 - mu / r;
  const hz = x * vy - y * vx;
  const rv = x * vx + y * vy;
  const ex = ((v2 - mu / r) * x - rv * vx) / mu;
  const ey = ((v2 - mu / r) * y - rv * vy) / mu;
  const e = Math.sqrt(ex * ex + ey * ey);
  const p = (hz * hz) / mu;
  const rp = p / (1 + e);
  let a: number, ra: number, T: number;
  if (eps < 0) {
    a = -mu / (2 * eps);
    ra = a * (1 + e);
    T = 2 * Math.PI * Math.sqrt((a * a * a) / mu);
  } else {
    a = eps > 0 ? -mu / (2 * eps) : Infinity;
    ra = Infinity;
    T = NaN;
  }
  const x_lib = (v2 * r) / (2 * mu);
  let genre: Genre;
  if (Math.abs(x_lib - 1) < TOL_PARABOLE) genre = 'parabole';
  else if (eps > 0) genre = 'hyperbole';
  else if (e < TOL_CERCLE) genre = 'cercle';
  else genre = 'ellipse';
  const ouverte = genre === 'parabole' || genre === 'hyperbole';
  if (rp < R && (!ouverte || rv < 0)) genre = 'retombe';
  return { eps, h: hz, e, a, rp, ra, T, type: genre, ex, ey, r, v: Math.sqrt(v2), x_lib };
}

/** Position et vitesse au départ : canon en (0, R + altitude), tir vers +x à angle_deg au-dessus de l'horizontale. */
export function etat_tir(R: number, altitude: number, v: number, angle_deg: number): [number, number, number, number] {
  const a = (angle_deg * Math.PI) / 180;
  return [0.0, R + altitude, v * Math.cos(a), v * Math.sin(a)];
}

/** Point du segment (x0, y0)→(x1, y1) sur le cercle de rayon R (le premier en partant de (x0, y0)). */
export function intersection(x0: number, y0: number, x1: number, y1: number, R: number): [number, number] {
  const dx = x1 - x0,
    dy = y1 - y0;
  const a = dx * dx + dy * dy;
  const b = 2 * (x0 * dx + y0 * dy);
  const c = x0 * x0 + y0 * y0 - R * R;
  const d = b * b - 4 * a * c;
  if (a === 0 || d < 0) return [x1, y1];
  let t = (-b - Math.sqrt(d)) / (2 * a);
  t = Math.max(0.0, Math.min(1.0, t));
  return [x0 + t * dx, y0 + t * dy];
}

/** Points de la trajectoire prévue sans air (voir canon_meca.conique). */
export function conique(el: Elements, x0: number, y0: number, R: number, r_lim: number, n = 240): ([number, number] | null)[] {
  const mu_h = el.h;
  const e = el.e;
  const r0 = el.r;
  if (Math.abs(mu_h) < 1e-9 * r0 * Math.max(el.v, 1e-30)) {
    const ux = x0 / r0,
      uy = y0 / r0;
    const haut = el.ra < r_lim ? el.ra : r_lim;
    const pts: [number, number][] = [[ux * r0, uy * r0], [ux * haut, uy * haut]];
    if (el.type === 'retombe') pts.push([ux * R, uy * R]);
    return pts;
  }
  const sens = mu_h > 0 ? 1.0 : -1.0;
  let ax: number, ay: number;
  if (e > 1e-12) {
    ax = el.ex / e;
    ay = el.ey / e;
  } else {
    ax = x0 / r0;
    ay = y0 / r0;
  }
  const bx = -ay * sens,
    by = ax * sens;
  const nu0 = Math.atan2(sens * (ax * y0 - ay * x0), ax * x0 + ay * y0);
  const param = r0 * (1 + e * Math.cos(nu0));
  let nu1: number;
  if (e < 1) nu1 = nu0 + 2 * Math.PI;
  else {
    const num = e > 1 ? Math.acos(-1 / e) : Math.PI;
    const c = Math.max(-1.0, Math.min(1.0, (param / r_lim - 1) / e));
    nu1 = Math.min(Math.acos(c), num - 1e-6);
    if (nu1 <= nu0) nu1 = nu0;
  }
  const pts: ([number, number] | null)[] = [];
  let prec: [number, number] | null = null;
  let dehors: [number, number] | null = null; // dernier point hors de r_lim (ellipse : on reprend au retour)
  for (let k = 0; k <= n; k++) {
    const nu = nu0 + ((nu1 - nu0) * k) / n;
    const den = 1 + e * Math.cos(nu);
    if (den <= 1e-12) break;
    const r = param / den;
    const c = Math.cos(nu),
      s = Math.sin(nu);
    const x = r * (c * ax + s * bx);
    const y = r * (c * ay + s * by);
    if (r < R) {
      if (prec !== null) pts.push(intersection(prec[0], prec[1], x, y, R));
      break;
    }
    if (r > r_lim) {
      if (e >= 1) {
        pts.push([x, y]);
        break;
      }
      if (prec !== null) {
        // sortie du cadre : point de sortie, puis coupure
        pts.push([x, y]);
        pts.push(null);
        prec = null;
      }
      dehors = [x, y];
      continue;
    }
    if (prec === null && dehors !== null) pts.push(dehors); // retour dans le cadre
    dehors = null;
    pts.push([x, y]);
    prec = [x, y];
  }
  return pts;
}

export type Issue = 'vol' | 'impact' | 'libere';

/** Un tir : son système (astre + boulet), sa trace, son issue. */
export class Tir {
  n: number;
  astre: string;
  altitude: number;
  v: number;
  angle: number;
  air: boolean;
  projectile: string;
  mu: number;
  R: number;
  k_air: number;
  r0: number;
  el0: Elements;
  sys: Systeme;
  etat: Issue = 'vol';
  t_fin = NaN;
  phi = 0.0;
  private theta: number;
  x: number[];
  y: number[];
  h_min: number;
  v_max: number;
  /** couleur du dessin (posée par l'animation) */
  couleur = 'accent1';

  constructor(n: number, astre: string, altitude: number, v: number, angle: number, air = false, projectile = 'boulet') {
    const A = ASTRES[astre]!;
    this.n = n;
    this.astre = astre;
    this.altitude = altitude;
    this.v = v;
    this.angle = angle;
    this.air = Boolean(air) && atmosphere(astre);
    this.projectile = projectile;
    this.mu = A.gm;
    this.R = A.r;
    this.k_air = 0.5 / (BALISTIQUE[projectile] ?? BALISTIQUE['boulet']!);
    const [x, y, vx, vy] = etat_tir(this.R, altitude, v, angle);
    this.r0 = this.R + altitude;
    this.el0 = elements(this.mu, this.R, x, y, vx, vy);
    const planete: Corps = { nom: astre, m: this.mu / G, x: 0.0, y: 0.0, vx: 0.0, vy: 0.0, rayon: this.R, primaire: -1, actif: true };
    const boulet: Corps = { nom: 'boulet', m: 0.0, x, y, vx, vy, rayon: 0.0, primaire: 0, actif: true };
    this.sys = new Systeme([planete, boulet], 1e30);
    this.sys.maxTrace = 2;
    if (this.air) this.sys.acc_sup = (cs, ax, ay) => this.frottement(cs, ax, ay);
    this.theta = Math.atan2(y, x);
    this.x = [x];
    this.y = [y];
    this.h_min = altitude;
    this.v_max = v;
  }

  private frottement(cs: Corps[], ax: number[], ay: number[]): void {
    const b = cs[1]!;
    if (!b.actif) return;
    const h = Math.sqrt(b.x * b.x + b.y * b.y) - this.R;
    const rho = densite(this.astre, h);
    if (rho <= 0) return;
    const v = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    const k = this.k_air * rho * v;
    ax[1] = ax[1]! - k * b.vx;
    ay[1] = ay[1]! - k * b.vy;
  }

  /** Accélération de freinage de l'air (m·s⁻²) en ce moment. */
  freinage(): number {
    if (!this.air) return 0.0;
    const b = this.boulet;
    const h = Math.sqrt(b.x * b.x + b.y * b.y) - this.R;
    const v2 = b.vx * b.vx + b.vy * b.vy;
    return this.k_air * densite(this.astre, h) * v2;
  }

  get boulet(): Corps {
    return this.sys.corps[1]!;
  }

  get t(): number {
    return this.etat !== 'vol' && Number.isFinite(this.t_fin) ? this.t_fin : this.sys.t;
  }

  rayon(): number {
    const b = this.boulet;
    return Math.sqrt(b.x * b.x + b.y * b.y);
  }

  vitesse(): number {
    const b = this.boulet;
    return Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  }

  elements(): Elements {
    const b = this.boulet;
    return elements(this.mu, this.R, b.x, b.y, b.vx, b.vy);
  }

  tours(): number {
    return this.sys.tours(1);
  }

  periode(): number | null {
    return this.sys.periode(1);
  }

  /** Avance de `duree` secondes au plus (pas de Yoshida un par un) ; rend le nombre de pas faits. */
  avancer(duree: number, budget = MAX_PAS_IMAGE): number {
    if (this.etat !== 'vol') return 0;
    let reste = duree;
    let k = 0;
    const s = this.sys;
    const b = s.corps[1]!;
    while (reste > 0 && k < budget) {
      let h = s.pas();
      if (this.air) {
        const a = this.freinage();
        if (a > 0) {
          const hv = (ETA_AIR * this.vitesse()) / a;
          if (hv < h) h = hv;
          const r = Math.sqrt(b.x * b.x + b.y * b.y);
          const vr = Math.abs(b.x * b.vx + b.y * b.vy) / r;
          if (vr > 0) {
            const hh = (ETA_H * hauteur_echelle(this.astre, r - this.R)) / vr;
            if (hh < h) h = hh;
          }
        }
      }
      if (h > reste) h = reste;
      if (!(h > 0)) break;
      let x0 = b.x,
        y0 = b.y;
      const vx0 = b.vx,
        vy0 = b.vy,
        t0 = s.t;
      s.avancer(h);
      k += 1;
      reste -= h;
      if (!b.actif || b.x * b.x + b.y * b.y < this.R * this.R) {
        // le pas a traversé le sol : refait en SOUS_PAS morceaux, puis impact sur la sphère
        b.x = x0;
        b.y = y0;
        b.vx = vx0;
        b.vy = vy0;
        b.actif = true;
        s.t = t0;
        const hs = h / SOUS_PAS;
        for (let i = 0; i < SOUS_PAS; i++) {
          x0 = b.x;
          y0 = b.y;
          s.avancer(hs);
          if (!b.actif || b.x * b.x + b.y * b.y < this.R * this.R) break;
          this.suivre(b.x, b.y);
          this.noter(b.x, b.y, false);
        }
        const [xi, yi] = intersection(x0, y0, b.x, b.y, this.R);
        const dx = b.x - x0,
          dy = b.y - y0;
        const d = Math.sqrt(dx * dx + dy * dy);
        const f = d > 0 ? Math.sqrt((xi - x0) * (xi - x0) + (yi - y0) * (yi - y0)) / d : 1.0;
        b.x = xi;
        b.y = yi;
        b.actif = false;
        this.etat = 'impact';
        this.t_fin = s.t - hs + f * hs;
        this.suivre(b.x, b.y);
        this.noter(b.x, b.y, true);
        this.h_min = 0.0;
        break;
      }
      this.suivre(b.x, b.y);
      this.noter(b.x, b.y, false);
      const r = Math.sqrt(b.x * b.x + b.y * b.y);
      if (r - this.R < this.h_min) this.h_min = r - this.R;
      const v = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (v > this.v_max) this.v_max = v;
      if (r > LOIN * this.r0 && b.x * b.vx + b.y * b.vy > 0) {
        const el = this.elements();
        if (el.type === 'parabole' || el.type === 'hyperbole') {
          this.etat = 'libere';
          this.t_fin = s.t;
          this.noter(b.x, b.y, true);
          break;
        }
      }
    }
    return k;
  }

  private suivre(x: number, y: number): void {
    const th = Math.atan2(y, x);
    let d = th - this.theta;
    if (d > Math.PI) d -= 2 * Math.PI;
    else if (d < -Math.PI) d += 2 * Math.PI;
    this.phi -= d;
    this.theta = th;
  }

  private noter(x: number, y: number, force: boolean): void {
    const lx = this.x[this.x.length - 1]!,
      ly = this.y[this.y.length - 1]!;
    const r = Math.sqrt(x * x + y * y);
    const seuil = 0.003 * (r > this.R ? r : this.R);
    if (force || (x - lx) * (x - lx) + (y - ly) * (y - ly) > seuil * seuil) {
      this.x.push(x);
      this.y.push(y);
      if (this.x.length > 8000) {
        const pair = this.x.length % 2 === 0;
        const dx = this.x[this.x.length - 1]!,
          dy = this.y[this.y.length - 1]!;
        this.x = this.x.filter((_, i) => i % 2 === 0);
        this.y = this.y.filter((_, i) => i % 2 === 0);
        if (pair) {
          this.x.push(dx);
          this.y.push(dy);
        }
      }
    }
  }

  angle_balaye_deg(): number {
    return (this.phi * 180) / Math.PI;
  }

  /** Distance parcourue au sol depuis le pied de la montagne (m), le long du grand cercle. */
  distance_sol(): number {
    return Math.abs(this.phi) * this.R;
  }
}

// ==================================================================== réglages, préréglages, défis (communs)
export interface ReglageAstre {
  uv: number;
  nv: string;
  dv: number;
  vmax: number;
  v0: number;
  ua: number;
  na: string;
  da: number;
  amin: number;
  amax: number;
  a0: number;
  ras: number;
  temps: number;
}
export const REGLAGES: Readonly<Record<string, ReglageAstre>> = {
  terre: { uv: 1000.0, nv: 'km·s⁻¹', dv: 2, vmax: 16.0, v0: 5.0, ua: 1000.0, na: 'km', da: 0, amin: 1.0, amax: 40000.0, a0: 100.0, ras: 10.0, temps: 100 },
  lune: { uv: 1000.0, nv: 'km·s⁻¹', dv: 3, vmax: 3.5, v0: 1.0, ua: 1000.0, na: 'km', da: 1, amin: 0.1, amax: 20000.0, a0: 10.0, ras: 2.0, temps: 100 },
  mars: { uv: 1000.0, nv: 'km·s⁻¹', dv: 2, vmax: 7.5, v0: 2.5, ua: 1000.0, na: 'km', da: 0, amin: 1.0, amax: 30000.0, a0: 50.0, ras: 10.0, temps: 100 },
  ceres: { uv: 1.0, nv: 'm·s⁻¹', dv: 1, vmax: 750.0, v0: 200.0, ua: 1000.0, na: 'km', da: 1, amin: 0.1, amax: 5000.0, a0: 10.0, ras: 2.0, temps: 1000 },
  dimorphos: { uv: 0.01, nv: 'cm·s⁻¹', dv: 2, vmax: 15.0, v0: 4.0, ua: 1.0, na: 'm', da: 0, amin: 1.0, amax: 1000.0, a0: 10.0, ras: 2.0, temps: 1000 },
};
export const TEMPS = [1, 10, 100, 1000] as const;
export const PREREGLAGES = ['pied', 'ras_sol', 'iss', 'ellipse', 'liberation', 'hyperbole', 'rentree'] as const;
export const ALT_ISS = ALT_ISS_G;
export const ALT_RENTREE = 200000.0;
export const PERIGEE_RENTREE = 60000.0;

export interface Prereglage {
  astre: string;
  altitude: number;
  v: number;
  angle: number;
  air: boolean;
  projectile: string;
}

/** Réglages d'un préréglage (unités SI) pour l'astre choisi (voir canon_meca.prereglage). */
export function prereglage(nom: string, astre: string): Prereglage {
  if (nom === 'iss' || nom === 'rentree') astre = 'terre';
  const A = ASTRES[astre]!;
  const C = REGLAGES[astre]!;
  let alt = C.a0 * C.ua;
  let air = false,
    projectile = 'boulet';
  if (nom === 'ras_sol') alt = C.ras * C.ua;
  else if (nom === 'iss') alt = ALT_ISS;
  else if (nom === 'rentree') {
    alt = ALT_RENTREE;
    air = true;
    projectile = 'capsule';
  }
  const r0 = A.r + alt;
  const v1 = v_satellisation(A.gm, r0);
  const table: Record<string, number> = {
    pied: 0.3 * v1, ras_sol: v1, iss: v1, ellipse: Math.sqrt(1.5) * v1, liberation: Math.sqrt(2) * v1, hyperbole: Math.sqrt(3) * v1,
  };
  let v = table[nom]!;
  if (nom === 'rentree') {
    const rp = A.r + PERIGEE_RENTREE;
    v = v1 * Math.sqrt((2 * rp) / (r0 + rp));
  }
  return { astre, altitude: alt, v, angle: 0.0, air, projectile };
}

export const DEFIS = ['aucun', 'cercle', 'liberation', 'au_dessus', 'antipodes', 'dimorphos'] as const;
export const DEFI_E = 0.02;
export const DEFI_LIB = 1.02;
export const DEFI_ANTIPODES = 3.0;

export interface Contexte {
  astre: string;
  altitude: number;
  air: boolean;
  projectile: string;
}

/** Situation de départ d'un défi ; null pour « aucun ». */
export function contexte_defi(nom: string): Contexte | null {
  const t: Record<string, Contexte> = {
    cercle: { astre: 'terre', altitude: 300000.0, air: false, projectile: 'boulet' },
    liberation: { astre: 'lune', altitude: 10000.0, air: false, projectile: 'boulet' },
    au_dessus: { astre: 'terre', altitude: 60000.0, air: true, projectile: 'satellite' },
    antipodes: { astre: 'terre', altitude: 100000.0, air: false, projectile: 'boulet' },
    dimorphos: { astre: 'dimorphos', altitude: 10.0, air: false, projectile: 'boulet' },
  };
  return t[nom] ?? null;
}

export type Verdict = ['reussi' | 'echec' | 'attente' | 'aucun', string, Record<string, number>];

/** Verdict d'un défi sur un tir (voir canon_meca.juger). */
export function juger(nom: string, tir: Tir | null): Verdict {
  if (nom === 'aucun' || tir === null) return ['aucun', '', {}];
  const el = tir.el0;
  const R = tir.R;
  if (nom === 'cercle') {
    if (el.type === 'retombe' || tir.etat === 'impact') return ['echec', 'sol', {}];
    if (el.e > DEFI_E) return ['echec', 'e', { e: el.e }];
    return tir.tours() >= 1 ? ['reussi', 'cercle', { e: el.e }] : ['attente', 'tour', {}];
  }
  if (nom === 'liberation') {
    const x = el.x_lib;
    if (x < 1 - 1e-9) return ['echec', 'lent', { p: 100 * (1 - Math.sqrt(x)) }];
    if (el.type === 'retombe' || tir.etat === 'impact') return ['echec', 'sol', {}];
    if (Math.sqrt(x) > DEFI_LIB) return ['echec', 'rapide', { p: 100 * (Math.sqrt(x) - 1) }];
    return tir.etat === 'libere' ? ['reussi', 'liberation', { p: 100 * (Math.sqrt(x) - 1) }] : ['attente', 'loin', {}];
  }
  if (nom === 'au_dessus') {
    if (tir.astre !== 'terre') return ['echec', 'astre_terre', {}];
    if (el.type === 'parabole' || el.type === 'hyperbole') return ['echec', 'ouverte', {}];
    if (el.type === 'retombe' || tir.etat === 'impact') return ['echec', 'sol_indice', {}];
    const hp = el.rp - R;
    if (hp <= KARMAN) return ['echec', 'perigee', { h: hp }];
    return tir.tours() >= 1 ? ['reussi', 'au_dessus', { h: hp }] : ['attente', 'tour', {}];
  }
  if (nom === 'antipodes') {
    if (tir.etat === 'impact') {
      const d = tir.angle_balaye_deg();
      if (Math.abs(d - 180) <= DEFI_ANTIPODES) return ['reussi', 'antipodes', { d }];
      return ['echec', 'impact', { d }];
    }
    if (el.type !== 'retombe') return ['echec', 'pas_de_chute', {}];
    return ['attente', 'chute', {}];
  }
  if (nom === 'dimorphos') {
    if (tir.astre !== 'dimorphos') return ['echec', 'astre_dimorphos', {}];
    if (tir.etat === 'impact' || el.type === 'retombe') return ['echec', 'sol', {}];
    if (el.type === 'parabole' || el.type === 'hyperbole') return ['echec', 'ouverte', {}];
    return tir.tours() >= 1 ? ['reussi', 'dimorphos', {}] : ['attente', 'tour', {}];
  }
  return ['aucun', '', {}];
}
