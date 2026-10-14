/**
 * Milky Way Rotational Velocity : vitesse de rotation de la Voie lactée selon la distance au centre, et masse contenue
 * dans le cercle de rayon R : M = v² R / G.  La courbe reste presque plate loin du centre : si toute la masse était au
 * centre, v décroîtrait comme 1/√R (courbe képlérienne).  C'est un indice de matière noire.  Courbe : partie centrale
 * de l'original (R < 4 kpc), puis mesures de Gaia (v = 229 − 1,7 (R − 8,122) km/s de 5 à 25 kpc).
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, Pt, type Rect } from '../../noyau/peintre';
import { Animation, type Bouton_souris, type Coche, nombre, type Reglage } from '../base';
import { scientifique } from './gravitation';

const KPC_M = astro.PC_M * 1000.0;
export const G_KPC = astro.GM_SOLEIL / (KPC_M * 1e6);
export const R_SOLEIL_KPC = 8.122;
const R_MAX = 25.0;
const DEPART: [number, number] = [7.75, 0.0];
const BEZIER: [number, number, number, number][] = [
  [15.9, -134.3, 20.7, -219.8], [21.5, -233.1, 34.7, -222.9], [49.1, -211.7, 59.0, -196.2],
  [69.2, -180.0, 86.8, -183.2], [95.9, -184.8, 110.0, -201.5],
];
const SX = 0.055_031_446_540_880_505,
  SY = -1.107_011_070_110_701_2;

function table_interne(): [number, number][] {
  let [x0, y0] = DEPART;
  const pts: [number, number][] = [[0.0, 0.0]];
  for (const [cx, cy, ax, ay] of BEZIER) {
    for (let k = 1; k < 41; k++) {
      const t = k / 40;
      const x = (1 - t) ** 2 * x0 + 2 * t * (1 - t) * cx + t * t * ax;
      const y = (1 - t) ** 2 * y0 + 2 * t * (1 - t) * cy + t * t * ay;
      pts.push([x * SX, y * SY]);
    }
    x0 = ax;
    y0 = ay;
  }
  return pts;
}

const INTERNE = table_interne();
const RS = INTERNE.map(([r]) => r);

function bisect_left(a: readonly number[], x: number): number {
  let lo = 0,
    hi = a.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (a[m]! < x) lo = m + 1;
    else hi = m;
  }
  return lo;
}

export function v_eilers(r: number): number {
  return 229.0 - 1.7 * (r - R_SOLEIL_KPC);
}

export function v_interne(r: number): number {
  const i = Math.max(1, Math.min(RS.length - 1, bisect_left(RS, r)));
  const [r0, v0] = INTERNE[i - 1]!;
  const [r1, v1] = INTERNE[i]!;
  return r1 > r0 ? v0 + ((v1 - v0) * (r - r0)) / (r1 - r0) : v1;
}

/** Vitesse circulaire (km/s) à r kpc du centre. */
export function vitesse(r: number): number {
  if (r >= 5.0) return v_eilers(r);
  if (r <= 4.0) return v_interne(r);
  const f = r - 4.0;
  return (1 - f) * v_interne(r) + f * v_eilers(r);
}

/** Masse (M☉) contenue dans la sphère de rayon r kpc : v² r / G. */
export function masse(r: number): number {
  return (vitesse(r) ** 2 * r) / G_KPC;
}

export class RotationGalaxie extends Animation {
  static override ID = 'milkywayrotationalvelocity';
  static override ANIMEE = false;

  r!: Reglage;
  c_kepler!: Coche;
  private axes: Axes | null = null;

  override construire(): void {
    this.r = this.curseur('rayon', 0.5, R_MAX, R_SOLEIL_KPC, { dec: 2, unite: 'kpc' });
    this.c_kepler = this.coche('kepler', true);
    this.axes = null;
  }

  override valeurs(): [string, string][] {
    const r = this.r.value();
    const tour = (2 * Math.PI * r * KPC_M) / (vitesse(r) * 1000) / (astro.ANNEE_JULIENNE_J * 86400) / 1e6;
    return [
      [tr('anim_milkywayrotationalvelocity_r'), `${nombre(r, 2)} kpc (${nombre(r * 1000 * astro.PC_EN_AL, 0)} ${tr('anim_spectroparallax_al')})`],
      [tr('anim_milkywayrotationalvelocity_v'), `${nombre(vitesse(r), 1)} km/s`],
      [tr('anim_milkywayrotationalvelocity_m'), `${scientifique(masse(r))} M☉`],
      [tr('anim_milkywayrotationalvelocity_tour'), `${nombre(tour, 0)} ${tr('anim_milkywayrotationalvelocity_ma')}`],
    ];
  }

  override presser(pos: Pt, _bouton: Bouton_souris): boolean {
    if (this.axes !== null && this.axes.r.adjusted(-10, -10, 10, 10).contains(pos)) {
      this._glisse = (q) => this.tirer(q);
      this.tirer(pos);
      return true;
    }
    return false;
  }

  private tirer(pos: Pt): void {
    this.r.setValue(this.axes!.x_de_px(pos.x));
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones_principale(rect, 1, 0.62);
    const r = dessin.cadre(p, z[0]!, tr('anim_milkywayrotationalvelocity_titre_courbe'));
    const ax = new Axes(r, 0, R_MAX, 0, 300, false, false, [46, 10, 12, 30]).avec(p);
    this.axes = ax;
    ax.fond(p, { titre_x: tr('anim_milkywayrotationalvelocity_axe_r'), titre_y: tr('anim_milkywayrotationalvelocity_axe_v') });
    const courbe: [number, number][] = [];
    for (let x = 0; x <= Math.trunc(R_MAX * 10); x++) courbe.push([x / 10, vitesse(x / 10)]);
    ax.courbe(courbe, 'accent1', 2.5);
    const rr = this.r.value();
    if (this.c_kepler.isChecked()) {
      const v0 = vitesse(rr);
      const kep: [number, number][] = [];
      for (let x = Math.trunc(rr * 10); x <= Math.trunc(R_MAX * 10); x++) kep.push([x / 10, v0 * Math.sqrt(rr / (x / 10))]);
      ax.courbe(kep, 'accent2', 1.6, 0.9, true);
      const s = tr('anim_milkywayrotationalvelocity_k');
      dessin.texte(p, ax.px(R_MAX) - 4 - p.fontMetrics().horizontalAdvance(s), ax.py(v0 * Math.sqrt(rr / R_MAX)) - 8, s, 'accent2', { centre: false });
    }
    ax.verticale(R_SOLEIL_KPC, 'doux', 1.0, true, tr('anim_milkywayrotationalvelocity_soleil'));
    ax.verticale(rr, 'accent3', 1.2, true);
    ax.points([[rr, vitesse(rr)]], 'accent3', 6, 1.0);
    this.galaxie(p, dessin.cadre(p, z[1]!, tr('anim_milkywayrotationalvelocity_titre_galaxie')));
  }

  private galaxie(p: Peintre, r: Rect): void {
    const cx = r.cx,
      cy = r.cy;
    const k = (Math.min(r.w, r.h) * 0.46) / R_MAX;
    for (let i = 0; i < 2; i++) {
      const pts: Pt[] = [];
      for (let n = 0; n < 120; n++) {
        const t = (n / 119) * 3.6;
        const rr = 2.0 * Math.exp(0.33 * t) * k;
        const a = t + Math.PI * i;
        pts.push(new Pt(cx + rr * Math.cos(a), cy - rr * Math.sin(a)));
      }
      p.setPen(dessin.stylo('equateur', 6.0, 0.25));
      p.drawPolyline(pts);
    }
    dessin.disque(p, cx, cy, 2.5 * k, 'soleil', null, 0.5);
    p.setPen(dessin.stylo('accent3', 1.5, null, true));
    p.setBrush(null);
    p.drawEllipse(cx, cy, this.r.value() * k, this.r.value() * k);
    dessin.disque(p, cx + R_SOLEIL_KPC * k, cy, 4, 'accent1', 'texte');
    dessin.texte(p, cx + R_SOLEIL_KPC * k, cy + 14, tr('anim_milkywayrotationalvelocity_soleil'), 'accent1', { fond: true });
  }
}
