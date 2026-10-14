/**
 * Daylight Simulator : carte plane de la Terre avec la zone de jour et de nuit.  Le point subsolaire est à la
 * latitude δ☉ et à la longitude où il est midi solaire vrai ; la zone éclairée glisse vers l'ouest au fil du jour
 * (15° par heure) et son contour change au fil de l'année.
 */
import * as astro from '../../calc/astro';
import { existe, tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { linspace, pmod } from '../../noyau/py';
import type { Pts } from '../../noyau/vec';
import { Animation, angle, type Bouton_souris, type Choix, type Coche, date_du_jour, heures_minutes, type Reglage } from '../base';
import { cotes, decimal, chargerCotes, globe_xyz } from './longitude_latitude';

const ANNEE = 2026;
const R = 180 / Math.PI;

/** (latitude, longitude) du point subsolaire au « jour » (fraction = temps universel). */
export function subsolaire(jour: number): [number, number] {
  const s = astro.soleil_jour(ANNEE, jour);
  const tu = pmod(jour, 1.0) * 24.0;
  const lon = -((tu - 12.0) * 15.0 + s.eqt / 4.0);
  return [s.delta, astro.mod180(lon)];
}

/** Latitude du terminateur (h = 0) pour une longitude : tan φ = −cos H / tan δ. */
export function latitude_terminateur(lon: number, dec: number, lon_ss: number): number {
  const h = (lon - lon_ss) / R;
  const d = (Math.abs(dec) > 1e-6 ? dec : 1e-6) / R;
  return Math.atan(-Math.cos(h) / Math.tan(d)) * R;
}

/** Latitude où le Soleil est à la hauteur h le long du méridien `lon`, du côté nuit du terminateur. */
export function latitude_hauteur(lon: number, dec: number, lon_ss: number, h: number): number {
  const hh = (lon - lon_ss) / R;
  const a = Math.sin(dec / R),
    b = Math.cos(dec / R) * Math.cos(hh);
  const rr = Math.hypot(a, b);
  if (rr < 1e-12 || Math.abs(Math.sin(h / R) / rr) > 1) return dec >= 0 ? -90.0 : 90.0;
  const psi = Math.atan2(b, a);
  const base = Math.asin(Math.sin(h / R) / rr);
  const sols: number[] = [];
  for (let phi of [base - psi, Math.PI - base - psi]) {
    phi = pmod(phi + Math.PI, 2 * Math.PI) - Math.PI;
    if (-Math.PI / 2 - 1e-9 <= phi && phi <= Math.PI / 2 + 1e-9) sols.push(phi * R);
  }
  if (!sols.length) return dec >= 0 ? -90.0 : 90.0;
  const ref = latitude_terminateur(lon, dec, lon_ss);
  const nuit = sols.filter((x) => (dec >= 0 ? x <= ref + 1e-9 : x >= ref - 1e-9));
  return (nuit.length ? nuit : sols)[0]!;
}

/** Tracé des côtes sur une carte plane (coupé au passage de la ligne ±180°). */
export function cotesCarte(p: Peintre, xy: (la: number, lo: number) => Pt): void {
  for (const poly of cotes() as Pts[]) {
    if (poly.length < 2) continue;
    let pts: Pt[] = [];
    let lo_avant = 0;
    poly.forEach((q, i) => {
      const la = Math.asin(Math.max(-1, Math.min(1, q[2]))) * R;
      const lo = Math.atan2(q[1], q[0]) * R;
      if (pts.length && i > 0 && Math.abs(lo - lo_avant) > 180) {
        p.drawPolyline(pts);
        pts = [];
      }
      pts.push(xy(la, lo));
      lo_avant = lo;
    });
    if (pts.length > 1) p.drawPolyline(pts);
  }
}

// ==================================================================== vue polaire
/**
 * Projection azimutale équidistante centrée sur un pôle (`pole` = 1 : Nord, −1 : Sud), jusqu'à la latitude `bord`
 * (0 : l'équateur ; −30 au Nord, +30 au Sud pour voir les tropiques).  Rend (x, y) dans le disque unité, y vers le
 * bas de l'écran ; le méridien `lon0` est en bas (Nord) ou en haut (Sud), l'est tourne dans le sens direct vu du pôle.
 */
export function projection_polaire(lat: number, lon: number, pole: 1 | -1, bord = 0, lon0 = 0): [number, number] {
  const rho = (90 - pole * lat) / (90 - pole * bord);
  const a = (lon - lon0) / R;
  return pole === 1 ? [rho * Math.sin(a), rho * Math.cos(a)] : [rho * Math.sin(a), -rho * Math.cos(a)];
}

/** Inverse de projection_polaire : (latitude, longitude) d'un point (x, y) du plan (rho > 1 : au-delà du bord). */
export function inverse_polaire(x: number, y: number, pole: 1 | -1, bord = 0, lon0 = 0): [number, number] {
  const rho = Math.hypot(x, y);
  const lat = pole * (90 - rho * (90 - pole * bord));
  const a = pole === 1 ? Math.atan2(x, y) : Math.atan2(x, -y);
  return [lat, astro.mod180(lon0 + a * R)];
}

/**
 * Contour d'une zone de nuit (h < −décalage) en vue polaire, en coordonnées du disque unité : boucle fermée autour du
 * pôle (une latitude par méridien, bornée au bord), et `interieur` : la nuit est-elle du côté du pôle ?
 */
export function nuit_polaire(dec: number, lon_ss: number, decalage: number, pole: 1 | -1, bord: number, lon0: number, n = 721): { boucle: [number, number][]; interieur: boolean } {
  const boucle: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const lo = -180 + (360 * i) / (n - 1);
    let la = decalage === 0 ? latitude_terminateur(lo, dec, lon_ss) : latitude_hauteur(lo, dec, lon_ss, -decalage);
    la = pole === 1 ? Math.max(bord, la) : Math.min(bord, la);
    boucle.push(projection_polaire(la, lo, pole, bord, lon0));
  }
  // la nuit contient le pôle Nord quand le Soleil est au sud de l'équateur (et le pôle Sud dans le cas inverse)
  return { boucle, interieur: pole === 1 ? dec < 0 : dec >= 0 };
}

// ==================================================================== globe 3D
/** Matrice 3 × 3 (lignes) : repère terrestre → repère de vue (X à droite, Y en haut, Z vers l'observateur). */
export type M3 = [number, number, number, number, number, number, number, number, number];

/** Vue centrée sur (lat, lon), nord en haut : lignes = est, nord, verticale du point central. */
export function orientation(lat: number, lon: number): M3 {
  const la = lat / R,
    lo = lon / R;
  return [
    -Math.sin(lo), Math.cos(lo), 0,
    -Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la),
    Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la),
  ];
}

export function appliquer(m: M3, p: readonly number[]): [number, number, number] {
  return [m[0] * p[0]! + m[1] * p[1]! + m[2] * p[2]!, m[3] * p[0]! + m[4] * p[1]! + m[5] * p[2]!, m[6] * p[0]! + m[7] * p[1]! + m[8] * p[2]!];
}

function produit(a: M3, b: M3): M3 {
  const o = new Array<number>(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) o[3 * i + j]! += a[3 * i + k]! * b[3 * k + j]!;
  return o as M3;
}

/** Rotation d'angle t autour de l'axe unitaire k (formule de Rodrigues). */
export function rotation(k: readonly number[], t: number): M3 {
  const [x, y, z] = k as [number, number, number];
  const c = Math.cos(t),
    s = Math.sin(t),
    u = 1 - c;
  return [c + x * x * u, x * y * u - z * s, x * z * u + y * s, y * x * u + z * s, c + y * y * u, y * z * u - x * s, z * x * u - y * s, z * y * u + x * s, c + z * z * u];
}

/** Réorthonormalise une matrice de rotation (Gram-Schmidt sur les lignes), contre la dérive des produits répétés. */
function orthonormer(m: M3): M3 {
  const n = (v: number[]): number[] => {
    const l = Math.hypot(v[0]!, v[1]!, v[2]!);
    return v.map((x) => x / l);
  };
  const a = n([m[0], m[1], m[2]]);
  let b = [m[3], m[4], m[5]];
  const d = a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  b = n(b.map((x, i) => x - d * a[i]!));
  const c = [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
  return [...a, ...b, ...c] as M3;
}

/**
 * Glisser de (dx, dy) pixels sur un globe de rayon r : rotation « boule de commande » autour de l'axe du plan de
 * l'écran perpendiculaire au glisser, d'angle |d| / r : le point sous le doigt suit le doigt.
 */
export function tourner_globe(m: M3, dx: number, dy: number, r: number): M3 {
  const d = Math.hypot(dx, dy);
  if (d < 1e-9) return m;
  // y écran vers le bas, Y de vue vers le haut : déplacement de vue u = (dx, −dy) ; axe k = Z × u
  const k = [dy / d, dx / d, 0];
  return orthonormer(produit(rotation(k, d / r), m));
}

/**
 * Tronçons visibles (Z ≥ 0) d'une ligne de points en repère de vue : coupée au limbe, avec le point exact où elle le
 * traverse (interpolé puis ramené sur le cercle).  Rend des listes de points (X, Y).
 */
export function troncons(pts: readonly (readonly [number, number, number])[]): [number, number][][] {
  const out: [number, number][][] = [];
  let cur: [number, number][] = [];
  const limbe = (a: readonly number[], b: readonly number[]): [number, number] => {
    const t = a[2]! / (a[2]! - b[2]!);
    const x = a[0]! + t * (b[0]! - a[0]!),
      y = a[1]! + t * (b[1]! - a[1]!);
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  };
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i]!;
    const prec = i > 0 ? pts[i - 1]! : null;
    if (q[2] >= 0) {
      if (prec && prec[2] < 0) cur.push(limbe(prec, q));
      cur.push([q[0], q[1]]);
    } else if (prec && prec[2] >= 0) {
      cur.push(limbe(prec, q));
      if (cur.length > 1) out.push(cur);
      cur = [];
    }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

/**
 * Partie visible de la calotte {p : p·s < −sin h} (nuit si h = 0, crépuscules sinon), s = direction du Soleil en
 * repère de vue : contour fermé en (X, Y) dans le disque unité, et `pair` : remplir disque moins contour.
 */
export function calotte_visible(s: readonly number[], h: number, n = 240): { forme: 'rien' | 'disque' | 'contour'; contour: [number, number][]; pair: boolean } {
  const sh = Math.sin(h / R),
    ch = Math.cos(h / R);
  // base orthonormée du plan perpendiculaire à s
  const [sx, sy, sz] = s as [number, number, number];
  const ax = Math.abs(sz) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  let e1 = [sy * ax[2]! - sz * ax[1]!, sz * ax[0]! - sx * ax[2]!, sx * ax[1]! - sy * ax[0]!];
  const l1 = Math.hypot(e1[0]!, e1[1]!, e1[2]!);
  e1 = e1.map((x) => x / l1);
  const e2 = [sy * e1[2]! - sz * e1[1]!, sz * e1[0]! - sx * e1[2]!, sx * e1[1]! - sy * e1[0]!];
  const cercle: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    const c = Math.cos(t),
      si = Math.sin(t);
    cercle.push([-sh * sx + ch * (c * e1[0]! + si * e2[0]!), -sh * sy + ch * (c * e1[1]! + si * e2[1]!), -sh * sz + ch * (c * e1[2]! + si * e2[2]!)]);
  }
  const vis = cercle.map((q) => q[2] >= 0);
  const dansCalotte = (x: number, y: number, z: number): boolean => x * sx + y * sy + z * sz < -sh;
  // contour confondu avec le limbe (Soleil face à nous ou derrière le globe), ou entièrement caché
  if (cercle.every((q) => Math.abs(q[2]) < 1e-9) || !vis.some(Boolean)) return dansCalotte(0, 0, 1) ? { forme: 'disque', contour: [], pair: false } : { forme: 'rien', contour: [], pair: false };
  if (vis.every(Boolean)) {
    // contour entier visible : la calotte est dedans si son centre (−s) est de notre côté
    return { forme: 'contour', contour: cercle.map((q) => [q[0], q[1]]), pair: -sz < 0 };
  }
  // un seul arc visible : on le parcourt depuis son début, puis on revient par le limbe du côté de la calotte
  const i0 = vis.findIndex((v, i) => v && !vis[(i - 1 + n) % n]);
  const arc: [number, number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const i = (i0 + k) % n;
    arc.push(cercle[i]!);
    if (!vis[i]) break;
  }
  arc.unshift(cercle[(i0 - 1 + n) % n]!);
  const tr = troncons(arc)[0] ?? [];
  if (tr.length < 2) return { forme: 'rien', contour: [], pair: false };
  const a = tr[tr.length - 1]!,
    b = tr[0]!;
  const ta = Math.atan2(a[1], a[0]),
    tb = Math.atan2(b[1], b[0]);
  // deux arcs de limbe possibles de a vers b : on garde celui dont le milieu est dans la calotte
  let d = tb - ta;
  while (d <= 0) d += 2 * Math.PI;
  const milieu = ta + d / 2;
  if (!dansCalotte(Math.cos(milieu), Math.sin(milieu), 0)) d -= 2 * Math.PI;
  const m = Math.max(8, Math.ceil((Math.abs(d) / (2 * Math.PI)) * 120));
  const contour: [number, number][] = [...tr];
  for (let k = 1; k < m; k++) {
    const t = ta + (d * k) / m;
    contour.push([Math.cos(t), Math.sin(t)]);
  }
  return { forme: 'contour', contour, pair: false };
}

export class JourNuit extends Animation {
  static override ID = 'daylightsimulator';
  static HEURES_PAR_S = 1.0;
  static JOURS_PAR_S = 10.0;

  mode!: Choix;
  jour!: Reglage;
  heure!: Reglage;
  lat!: Reglage;
  lon!: Reglage;
  c_crepuscule!: Coche;
  projection!: Choix;
  bord!: Choix;
  c_tournant!: Coche;
  c_axe!: Coche;
  /** orientation du globe (repère terrestre tourné → vue) */
  globe: M3 = orientation(25, -50);
  private inertie: [number, number] = [0, 0];
  private dernier = 0;
  private carte: Rect | null = null;
  /** vue polaire : centre et rayon du disque à l'écran */
  private disque: [number, number, number] | null = null;

  override construire(): void {
    this.attendre(chargerCotes());
    this.mode = this.choix('mode', [['anim_daylightsimulator_jour', 'jour'], ['anim_daylightsimulator_annee', 'annee']], 'jour');
    this.jour = this.curseur('jour', 0.0, 364.0, 79.0, { dec: 0, cle_texte: 'anim_c_jour' });
    this.heure = this.curseur('heure', 0.0, 24.0, 12.0, { dec: 2, unite: 'h', cle_texte: 'anim_daylightsimulator_tu' });
    this.lat = this.curseur('latitude', -90.0, 90.0, 0.0, { dec: 1, unite: '°', cle_texte: 'anim_c_latitude' });
    this.lon = this.curseur('longitude', -180.0, 180.0, 0.0, { dec: 1, unite: '°', cle_texte: 'anim_c_longitude' });
    this.c_crepuscule = this.coche('crepuscule', false);
    // version web : vues polaires
    this.projection = this.choix('web_projection', [['web_proj_equi', 'equi'], ['web_proj_nord', 'nord'], ['web_proj_sud', 'sud'], ['web_proj_globe', 'globe']], 'equi', 'web_projection');
    this.bord = this.choix('web_bord', [['web_bord_0', 0], ['web_bord_30', 30]], 0, 'web_bord');
    this.c_tournant = this.coche('web_tournant', false, 'web_tournant');
    this.c_axe = this.coche('web_axe', true, 'web_axe');
    const majVisibles = (): void => {
      const pr = this.projection.currentData();
      this.bord.setVisible(pr === 'nord' || pr === 'sud');
      this.c_tournant.setVisible(pr !== 'equi');
      this.c_axe.setVisible(pr === 'globe');
    };
    majVisibles();
    this.projection.currentIndexChanged.connect(majVisibles);
    this.carte = null;
    this.disque = null;
  }

  /** Pôle de la vue polaire (1 Nord, −1 Sud), ou null en projection équirectangulaire. */
  pole(): 1 | -1 | null {
    const p = this.projection.currentData();
    return p === 'nord' ? 1 : p === 'sud' ? -1 : null;
  }

  private bordLat(pole: 1 | -1): number {
    return -pole * (this.bord.currentData() as number);
  }

  private lon0(lon_ss: number): number {
    return this.c_tournant.isChecked() ? 0 : lon_ss;
  }

  override avancer(dt: number): void {
    if (this.mode.currentData() === 'jour') {
      const h = this.heure.value() + dt * JourNuit.HEURES_PAR_S;
      if (h >= 24.0) this.jour.setValue(pmod(this.jour.value() + 1, 365.0));
      this.heure.setValue(pmod(h, 24.0));
    } else this.jour.setValue(pmod(this.jour.value() + dt * JourNuit.JOURS_PAR_S, 365.0));
  }

  private jourDecimal(): number {
    return this.jour.value() + this.heure.value() / 24.0;
  }

  override valeurs(): [string, string][] {
    const [dec, lon_ss] = subsolaire(this.jourDecimal());
    const h_obs = astro.mod180(this.lon.value() - lon_ss) / 15.0 + 12.0;
    const [, alt] = astro.equatorial_vers_horizon(astro.mod180(this.lon.value() - lon_ss), dec, this.lat.value());
    return [
      [tr('anim_c_date'), date_du_jour(this.jour.value()) + ', ' + heures_minutes(this.heure.value()) + ' TU'],
      [tr('anim_daylightsimulator_subsolaire'), `${decimal(dec, tr('anim_pc_n'), tr('anim_pc_s'))}, ${decimal(lon_ss, tr('anim_pc_e'), tr('anim_pc_o'))}`],
      [tr('anim_sunmotions_heure_vraie'), heures_minutes(h_obs)],
      [tr('anim_daylightsimulator_h_soleil'), angle(alt)],
    ];
  }

  override presser(pos: Pt, b: Bouton_souris): boolean {
    if (this.projection.currentData() === 'globe') {
      if (!this.disque || Math.hypot(pos.x - this.disque[0], pos.y - this.disque[1]) > this.disque[2] * 1.08) return false;
      if (b === 'droit') {
        this.placerGlobe(pos);
        return true;
      }
      this.inertie = [0, 0];
      let avant = pos;
      this._glisse = (q) => {
        const dx = q.x - avant.x,
          dy = q.y - avant.y;
        avant = q;
        this.globe = tourner_globe(this.globe, dx, dy, this.disque![2]);
        this.inertie = [dx, dy];
        this.dernier = Date.now();
      };
      return true;
    }
    const pole = this.pole();
    if (pole !== null) {
      if (this.disque && Math.hypot(pos.x - this.disque[0], pos.y - this.disque[1]) <= this.disque[2] + 4) {
        this._glisse = (q) => this.tirerPolaire(q, pole);
        this.tirerPolaire(pos, pole);
        return true;
      }
      return false;
    }
    if (this.carte !== null && this.carte.contains(pos)) {
      this._glisse = (q) => this.tirer(q);
      this.tirer(pos);
      return true;
    }
    return false;
  }

  private tirer(pos: Pt): void {
    const r = this.carte!;
    this.lon.setValue(Math.max(-180.0, Math.min(180.0, ((pos.x - r.x) / r.w) * 360.0 - 180.0)));
    this.lat.setValue(Math.max(-90.0, Math.min(90.0, 90.0 - ((pos.y - r.y) / r.h) * 180.0)));
  }

  override relacher(pos: Pt): void {
    super.relacher(pos);
    // inertie légère : le globe continue un peu sur sa lancée, puis s'arrête
    if (this.projection.currentData() !== 'globe' || Date.now() - this.dernier > 80) return;
    let [vx, vy] = this.inertie;
    if (Math.hypot(vx, vy) < 1.5 || typeof requestAnimationFrame === 'undefined') return;
    const pas = (): void => {
      vx *= 0.9;
      vy *= 0.9;
      if (Math.hypot(vx, vy) < 0.3 || !this.disque || this._glisse !== null) return;
      this.globe = tourner_globe(this.globe, vx, vy, this.disque[2]);
      this.rafraichir();
      requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
  }

  override aide_supplementaire(): string {
    return tr('web_aide_globe');
  }

  override doubleClic(_pos: Pt): boolean {
    if (this.projection.currentData() !== 'globe') return false;
    const [dec, lon_ss] = subsolaire(this.jourDecimal());
    this.globe = orientation(dec, this.c_tournant.isChecked() ? lon_ss : 0);
    this.rafraichir();
    return true;
  }

  /** Rotation propre de la Terre : sans « terminateur tournant », le Soleil reste fixe dans la vue. */
  private vueGlobe(lon_ss: number): M3 {
    return this.c_tournant.isChecked() ? this.globe : produit(this.globe, rotation([0, 0, 1], -lon_ss / R));
  }

  private placerGlobe(pos: Pt): void {
    const [cx, cy, rr] = this.disque!;
    const X = (pos.x - cx) / rr,
      Y = -(pos.y - cy) / rr;
    if (X * X + Y * Y > 1) return;
    const Z = Math.sqrt(1 - X * X - Y * Y);
    const [, lon_ss] = subsolaire(this.jourDecimal());
    const m = this.vueGlobe(lon_ss);
    // inverse d'une rotation : la transposée
    const p = [m[0] * X + m[3] * Y + m[6] * Z, m[1] * X + m[4] * Y + m[7] * Z, m[2] * X + m[5] * Y + m[8] * Z];
    this.lat.setValue(Math.asin(Math.max(-1, Math.min(1, p[2]!))) * R);
    this.lon.setValue(Math.atan2(p[1]!, p[0]!) * R);
  }

  private tirerPolaire(pos: Pt, pole: 1 | -1): void {
    const [cx, cy, rr] = this.disque!;
    const [, lon_ss] = subsolaire(this.jourDecimal());
    let x = (pos.x - cx) / rr,
      y = (pos.y - cy) / rr;
    const n = Math.hypot(x, y);
    if (n > 1) {
      x /= n;
      y /= n;
    }
    const [la, lo] = inverse_polaire(x, y, pole, this.bordLat(pole), this.lon0(lon_ss));
    this.lat.setValue(Math.max(-90, Math.min(90, la)));
    this.lon.setValue(lo);
  }

  override dessiner(p: Peintre, rect: Rect): void {
    if (this.projection.currentData() === 'globe') {
      this.dessinerGlobe(p, rect);
      return;
    }
    const pole = this.pole();
    if (pole !== null) {
      this.dessinerPolaire(p, rect, pole);
      return;
    }
    this.disque = null;
    const w = Math.min(rect.w - 20, (rect.h - 20) * 2.0);
    const carte = new Rect(rect.cx - w / 2, rect.cy - w / 4, w, w / 2);
    this.carte = carte;
    const xy = (la: number, lo: number): Pt => new Pt(carte.x + ((lo + 180.0) / 360.0) * carte.w, carte.y + ((90.0 - la) / 180.0) * carte.h);
    p.fillRect(carte, dessin.c('terre', 0.35));
    p.setPen(dessin.stylo('texte', 0.8, 0.8));
    cotesCarte(p, xy);
    const [dec, lon_ss] = subsolaire(this.jourDecimal());
    const lons = linspace(-180.0, 180.0, 361);
    const couches: [number, number][] = [[0.0, 0.55]];
    if (this.c_crepuscule.isChecked()) couches.push([6.0, 0.25], [12.0, 0.2], [18.0, 0.15]);
    for (const [decalage, alpha] of couches) {
      const lats = decalage === 0.0 ? lons.map((lo) => latitude_terminateur(lo, dec, lon_ss)) : lons.map((lo) => latitude_hauteur(lo, dec, lon_ss, -decalage));
      const pole = dec >= 0 ? -90.0 : 90.0;
      const poly = [...lats.map((la, i) => xy(la, lons[i]!)), xy(pole, 180.0), xy(pole, -180.0)];
      p.setPen(null);
      p.setBrush(dessin.c('nuit', alpha));
      p.drawPolygon(poly);
    }
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(null);
    p.drawRect(carte);
    const q = xy(dec, lon_ss);
    dessin.disque(p, q.x, q.y, 8, 'soleil', 'fond');
    const o = xy(this.lat.value(), this.lon.value());
    dessin.disque(p, o.x, o.y, 5, 'accent3', 'fond');
    dessin.police(p, 1.1, true);
    dessin.texte(p, rect.x + 12, rect.y + 18, date_du_jour(this.jour.value()) + ', ' + heures_minutes(this.heure.value()) + ' TU', 'texte', { centre: false });
    dessin.police(p, 1 / 1.1);
  }

  /** Vue polaire : carte azimutale équidistante, terminateur exact, crépuscules, cercles remarquables. */
  private dessinerPolaire(p: Peintre, rect: Rect, pole: 1 | -1): void {
    this.carte = null;
    const rr = Math.min(rect.w, rect.h - 40) / 2 - 22;
    if (!(rr > 4)) return;
    const cx = rect.cx,
      cy = rect.cy + 12;
    this.disque = [cx, cy, rr];
    const bord = this.bordLat(pole);
    const [dec, lon_ss] = subsolaire(this.jourDecimal());
    const lon0 = this.lon0(lon_ss);
    const xy = (la: number, lo: number): Pt => {
      const [x, y] = projection_polaire(la, lo, pole, bord, lon0);
      return new Pt(cx + x * rr, cy + y * rr);
    };
    const dedans = (la: number): boolean => (pole === 1 ? la >= bord - 1e-9 : la <= bord + 1e-9);
    const ctx = p.ctx;
    p.save();
    const disque = new Path2D();
    disque.ellipse(cx, cy, rr, rr, 0, 0, 2 * Math.PI);
    p.setClipPath(disque);
    p.setPen(null);
    p.setBrush(dessin.c('terre', 0.35));
    p.drawEllipse(cx, cy, rr, rr);
    // grille : méridiens tous les 15° (30° marqués), parallèles tous les 15°
    for (let lo = -180; lo < 180; lo += 15) {
      p.setPen(dessin.stylo('grille', lo % 30 === 0 ? 0.9 : 0.5, lo % 30 === 0 ? 0.8 : 0.5));
      p.drawLineP(xy(pole * 90, lo), xy(bord, lo));
    }
    for (let la = -75; la <= 75; la += 15) {
      if (!dedans(la)) continue;
      const q = xy(la, 0);
      const r = Math.hypot(q.x - cx, q.y - cy);
      p.setPen(dessin.stylo('grille', la % 30 === 0 ? 0.9 : 0.5, la % 30 === 0 ? 0.8 : 0.5));
      p.setBrush(null);
      p.drawEllipse(cx, cy, r, r);
    }
    // côtes reprojetées (coupées quand elles sortent du disque)
    p.setPen(dessin.stylo('texte', 0.8, 0.8));
    for (const poly of cotes() as Pts[]) {
      let pts: Pt[] = [];
      for (const q of poly) {
        const la = Math.asin(Math.max(-1, Math.min(1, q[2]))) * R;
        const lo = Math.atan2(q[1], q[0]) * R;
        if (!dedans(la)) {
          if (pts.length > 1) p.drawPolyline(pts);
          pts = [];
          continue;
        }
        pts.push(xy(la, lo));
      }
      if (pts.length > 1) p.drawPolyline(pts);
    }
    // nuit et crépuscules : boucle autour du pôle ; la nuit est dedans ou dehors selon la saison
    const couches: [number, number][] = [[0.0, 0.55]];
    if (this.c_crepuscule.isChecked()) couches.push([6.0, 0.25], [12.0, 0.2], [18.0, 0.15]);
    for (const [decalage, alpha] of couches) {
      const { boucle, interieur } = nuit_polaire(dec, lon_ss, decalage, pole, bord, lon0);
      const ch = new Path2D();
      boucle.forEach(([x, y], i) => (i ? ch.lineTo(cx + x * rr, cy + y * rr) : ch.moveTo(cx + x * rr, cy + y * rr)));
      ch.closePath();
      if (!interieur) ch.ellipse(cx, cy, rr + 2, rr + 2, 0, 0, 2 * Math.PI);
      ctx.fillStyle = dessin.c('nuit', alpha).css();
      ctx.fill(ch, 'evenodd');
    }
    // cercles remarquables : équateur, tropiques, cercles polaires
    const eps = 23.44;
    for (const [la, cle] of [[0, 'equateur'], [eps, 'accent1'], [-eps, 'accent1'], [90 - eps, 'accent2'], [eps - 90, 'accent2']] as [number, string][]) {
      if (!dedans(la)) continue;
      const q = xy(la, 0);
      p.setPen(dessin.stylo(cle, la === 0 ? 1.6 : 1.3, 0.9, la !== 0));
      p.setBrush(null);
      p.drawEllipse(cx, cy, Math.hypot(q.x - cx, q.y - cy), Math.hypot(q.x - cx, q.y - cy));
    }
    // Soleil au zénith (s'il est dans le disque) et observateur
    if (dedans(dec)) {
      const q = xy(dec, lon_ss);
      dessin.disque(p, q.x, q.y, 8, 'soleil', 'fond');
    }
    if (dedans(this.lat.value())) {
      const o = xy(this.lat.value(), this.lon.value());
      dessin.disque(p, o.x, o.y, 5, 'accent3', 'fond');
    }
    p.restore();
    p.setPen(dessin.stylo('grille', 1.2));
    p.setBrush(null);
    p.drawEllipse(cx, cy, rr, rr);
    // longitudes au bord
    dessin.police(p, 0.8);
    for (const lo of [0, 90, 180, -90]) {
      const [x, y] = projection_polaire(bord, lo, pole, bord, lon0);
      const nom = lo === 0 ? '0°' : lo === 180 ? '180°' : `90° ${tr(lo > 0 ? 'anim_pc_e' : 'anim_pc_o')}`;
      dessin.texte(p, cx + x * (rr + 12), cy + y * (rr + 12), nom, 'doux');
    }
    dessin.police(p, 1 / 0.8);
    dessin.police(p, 1.1, true);
    dessin.texte(p, rect.x + 12, rect.y + 18, date_du_jour(this.jour.value()) + ', ' + heures_minutes(this.heure.value()) + ' TU', 'texte', { centre: false });
    dessin.police(p, 1 / 1.1);
  }

  /**
   * Globe vu de l'espace (projection orthographique) : sphère ombrée, côtes et cercles coupés au limbe, nuit et
   * crépuscules exacts (calottes de la sphère), point subsolaire, axe des pôles, flèche vers le Soleil.
   */
  private dessinerGlobe(p: Peintre, rect: Rect): void {
    this.carte = null;
    const rr = Math.min(rect.w - 70, rect.h - 70) / 2;
    if (!(rr > 4)) return;
    const cx = rect.cx,
      cy = rect.cy + 8;
    this.disque = [cx, cy, rr];
    const [dec, lon_ss] = subsolaire(this.jourDecimal());
    const m = this.vueGlobe(lon_ss);
    const vue = (la: number, lo: number): [number, number, number] => appliquer(m, globe_xyz(la, lo));
    const ecran = (q: readonly [number, number]): Pt => new Pt(cx + q[0] * rr, cy - q[1] * rr);
    const ctx = p.ctx;
    const s = vue(dec, lon_ss);
    // atmosphère fine
    const atm = ctx.createRadialGradient(cx, cy, rr * 0.98, cx, cy, rr * 1.06);
    atm.addColorStop(0, dessin.c('ciel', 0.55).css());
    atm.addColorStop(1, dessin.c('ciel', 0).css());
    p.setPen(null);
    p.setBrush(atm);
    p.drawEllipse(cx, cy, rr * 1.06, rr * 1.06);
    // sphère éclairée : dégradé centré vers le point subsolaire projeté, limbe assombri
    const base = dessin.c('terre');
    const g = ctx.createRadialGradient(cx + s[0] * rr * 0.45, cy - s[1] * rr * 0.45, rr * 0.05, cx, cy, rr);
    g.addColorStop(0, base.plusClaire(135).avecAlpha(0.55).css());
    g.addColorStop(0.6, base.avecAlpha(0.42).css());
    g.addColorStop(1, base.plusClaire(60).avecAlpha(0.6).css());
    p.setBrush(g);
    p.drawEllipse(cx, cy, rr, rr);
    p.save();
    const disque = new Path2D();
    disque.ellipse(cx, cy, rr, rr, 0, 0, 2 * Math.PI);
    p.setClipPath(disque);
    const ligne = (pts: [number, number, number][]): void => {
      for (const t of troncons(pts)) p.drawPolyline(t.map(ecran));
    };
    // graticule
    for (let lo = -180; lo < 180; lo += 15) {
      p.setPen(dessin.stylo('grille', lo % 30 === 0 ? 0.9 : 0.5, lo % 30 === 0 ? 0.8 : 0.5));
      const pts: [number, number, number][] = [];
      for (let la = -90; la <= 90; la += 3) pts.push(vue(la, lo));
      ligne(pts);
    }
    const parallele = (la: number): [number, number, number][] => {
      const pts: [number, number, number][] = [];
      for (let lo = -180; lo <= 180; lo += 3) pts.push(vue(la, lo));
      return pts;
    };
    for (let la = -75; la <= 75; la += 15) {
      if (la === 0) continue;
      p.setPen(dessin.stylo('grille', la % 30 === 0 ? 0.9 : 0.5, la % 30 === 0 ? 0.8 : 0.5));
      ligne(parallele(la));
    }
    // côtes
    p.setPen(dessin.stylo('texte', 0.8, 0.85));
    for (const poly of cotes() as Pts[]) ligne(poly.map((q) => appliquer(m, q)));
    // nuit et crépuscules
    const couches: [number, number][] = [[0.0, 0.55]];
    if (this.c_crepuscule.isChecked()) couches.push([6.0, 0.25], [12.0, 0.2], [18.0, 0.15]);
    for (const [h, alpha] of couches) {
      const c = calotte_visible(s, h);
      if (c.forme === 'rien') continue;
      const ch = new Path2D();
      if (c.forme === 'disque' || c.pair) ch.ellipse(cx, cy, rr + 1, rr + 1, 0, 0, 2 * Math.PI);
      if (c.forme === 'contour') {
        c.contour.forEach((q, i) => {
          const e = ecran(q);
          if (i) ch.lineTo(e.x, e.y);
          else ch.moveTo(e.x, e.y);
        });
        ch.closePath();
      }
      ctx.fillStyle = dessin.c('nuit', alpha).css();
      ctx.fill(ch, 'evenodd');
    }
    // côté nuit ombré façon sphère : voile qui s'épaissit vers l'antipode du Soleil
    const n = Math.hypot(s[0], s[1]);
    if (n > 1e-6) {
      const ux = s[0] / n,
        uy = -s[1] / n;
      const v = ctx.createLinearGradient(cx + ux * rr, cy + uy * rr, cx - ux * rr, cy - uy * rr);
      const nuit = dessin.c('nuit');
      v.addColorStop(0, nuit.avecAlpha(0).css());
      v.addColorStop(Math.max(0, Math.min(1, 0.5 + 0.5 * s[2])), nuit.avecAlpha(0).css());
      v.addColorStop(1, nuit.avecAlpha(0.3).css());
      p.setPen(null);
      p.setBrush(v);
      p.drawEllipse(cx, cy, rr, rr);
    }
    // cercles remarquables, étiquetés à leur point visible le plus à droite
    const eps = 23.44;
    const cercles: [number, string, string][] = [
      [0, 'equateur', 'anim_sunsrays_equateur'], [eps, 'accent1', 'anim_sunsrays_tropique_cancer'],
      [-eps, 'accent1', 'anim_sunsrays_tropique_capricorne'], [90 - eps, 'accent2', 'anim_sunsrays_cercle_arctique'],
      [eps - 90, 'accent2', 'anim_sunsrays_cercle_antarctique'],
    ];
    const etiquettes: [Pt, string, string][] = [];
    for (const [la, cle, nom] of cercles) {
      const pts = parallele(la);
      p.setPen(dessin.stylo(cle, la === 0 ? 1.6 : 1.3, 0.95, la !== 0));
      ligne(pts);
      const vis = pts.filter((q) => q[2] > 0.15);
      if (vis.length) {
        const q = vis.reduce((a, b) => (b[0] > a[0] ? b : a));
        etiquettes.push([ecran([q[0], q[1]]), cle, existe(nom) ? tr(nom) : nom]);
      }
    }
    // axe des pôles : partie cachée derrière le globe en pointillé
    if (this.c_axe.isChecked()) {
      const nn = appliquer(m, [0, 0, 1]);
      const bout = (k: number): Pt => new Pt(cx + nn[0] * rr * k, cy - nn[1] * rr * k);
      p.restore();
      for (const sgn of [1, -1]) {
        p.setPen(dessin.stylo('texte', 1.6, 0.85));
        p.drawLineP(bout(sgn), bout(sgn * 1.25));
        // à l'intérieur du disque : visible si le pôle est de notre côté
        p.setPen(dessin.stylo('texte', 1.2, 0.5, sgn * nn[2] < 0));
        p.drawLineP(bout(0), bout(sgn));
      }
      dessin.texte(p, bout(1.33).x, bout(1.33).y, tr('anim_pc_n'), 'texte');
      p.save();
      p.setClipPath(disque);
    }
    // point subsolaire et observateur
    if (s[2] >= 0) {
      const q = ecran([s[0], s[1]]);
      dessin.disque(p, q.x, q.y, 7, 'soleil', 'fond');
    }
    const o = vue(this.lat.value(), this.lon.value());
    if (o[2] >= 0) {
      const q = ecran([o[0], o[1]]);
      dessin.disque(p, q.x, q.y, 5, 'accent3', 'fond');
    }
    p.restore();
    dessin.police(p, 0.8);
    for (const [q, cle, nom] of etiquettes) dessin.etiquette(p, q.x, q.y, nom, cle, 4);
    dessin.police(p, 1 / 0.8);
    // le Soleil est hors champ : flèche au bord du globe vers sa direction
    if (n > 0.05) {
      const ux = s[0] / n,
        uy = -s[1] / n;
      const a = new Pt(cx + ux * (rr + 10), cy + uy * (rr + 10)),
        b = new Pt(cx + ux * (rr + 34), cy + uy * (rr + 34));
      dessin.fleche(p, a.x, a.y, b.x, b.y, dessin.stylo('soleil', 2.2), 8);
      dessin.texte(p, cx + ux * (rr + 48), cy + uy * (rr + 48), tr('web_globe_soleil'), 'soleil', { fond: true });
    }
    dessin.police(p, 1.1, true);
    dessin.texte(p, rect.x + 12, rect.y + 18, date_du_jour(this.jour.value()) + ', ' + heures_minutes(this.heure.value()) + ' TU', 'texte', { centre: false });
    dessin.police(p, 1 / 1.1);
  }
}
