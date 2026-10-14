/**
 * Three Views Spectrum Demonstrator : les trois lois de Kirchhoff.  Une ampoule (corps chaud et dense) et un nuage de
 * gaz froid ; selon l'endroit d'où le télescope regarde : spectre continu, spectre de raies d'émission, ou continu
 * creusé de raies d'absorption, aux mêmes longueurs d'onde.  Raies réelles du gaz choisi (dans l'air).
 */
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { bande_spectre } from '../../noyau/graphe';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import { Animation, type Bouton_souris, type Choix, type Reglage } from '../base';

const GAZ: Record<string, number[]> = {
  hydrogene: [656.28, 486.13, 434.05, 410.17, 397.01],
  helium: [706.52, 667.82, 587.56, 501.57, 492.19, 471.31, 447.15, 388.86],
  sodium: [588.995, 589.592],
  mercure: [579.07, 576.96, 546.07, 435.83, 404.66],
};
const NUAGE: [number, number, number] = [0.0, 0.0, 1.0];
const AMPOULE: [number, number, number] = [3.2, 0.0, 0.55];
/** Rayon du cercle où se déplace le télescope : hors du halo de l'ampoule (3,2 + 2,2 × 0,55 = 4,41), tube compris. */
export const R_TELESCOPE = 5.6;
/** Longueur du tube du télescope et rayon du halo de l'ampoule (unités de la scène). */
export const L_TUBE = 0.9;
export const R_HALO = 2.2 * AMPOULE[2];
export { AMPOULE, NUAGE };

/** Distance s (≥ 0) le long de la visée (origine t, direction unitaire d) où elle entre dans le disque, ou null. */
function entree([ox, oy, r]: [number, number, number], tx: number, ty: number, dx: number, dy: number): number | null {
  const fx = tx - ox,
    fy = ty - oy;
  const b = fx * dx + fy * dy;
  const disc = b * b - (fx * fx + fy * fy - r * r);
  if (disc <= 0) return null;
  const q = Math.sqrt(disc);
  if (-b + q <= 0) return null; // tout le disque est derrière le télescope
  return Math.max(0, -b - q);
}

export interface Vue {
  /** le gaz est vu : traversé AVANT l'ampoule (ou sans ampoule sur la visée) */
  nuage: boolean;
  /** l'ampoule est sur la visée */
  ampoule: boolean;
  /** distances d'entrée le long de la visée (null : pas traversé) */
  s_nuage: number | null;
  s_ampoule: number | null;
}

/**
 * Ce que voit le télescope placé à l'angle donné sur le cercle (autour du nuage) et visant `cible` ('nuage' ou
 * 'ampoule').  L'ordre le long de la visée compte : l'ampoule est opaque, elle cache tout ce qui est derrière elle.
 * Absorption seulement si la visée traverse le gaz PUIS l'ampoule (télescope → nuage → ampoule) ; l'ampoule devant
 * le nuage donne un spectre continu.
 */
export function vue(angle_deg: number, cible: string): Vue {
  const a = (angle_deg * Math.PI) / 180;
  const tx = R_TELESCOPE * Math.cos(a),
    ty = R_TELESCOPE * Math.sin(a);
  const [cx, cy] = cible === 'nuage' ? NUAGE : AMPOULE;
  let dx = cx - tx,
    dy = cy - ty;
  const n = Math.hypot(dx, dy);
  dx /= n;
  dy /= n;
  const sa = entree(AMPOULE, tx, ty, dx, dy);
  const sn = entree(NUAGE, tx, ty, dx, dy);
  return { nuage: sn !== null && (sa === null || sn < sa), ampoule: sa !== null, s_nuage: sn, s_ampoule: sa };
}

export function type_de_spectre(v: Pick<Vue, 'nuage' | 'ampoule'>): string {
  if (v.ampoule && v.nuage) return 'absorption';
  if (v.ampoule) return 'continu';
  if (v.nuage) return 'emission';
  return 'rien';
}

export class Kirchhoff extends Animation {
  static override ID = 'threeviewsspectra';
  static override ANIMEE = false;

  angle!: Reglage;
  cible!: Choix;
  gaz!: Choix;
  private scene: [number, number, number] | null = null;

  override construire(): void {
    this.angle = this.curseur('position', 0.0, 360.0, 180.0, { dec: 0, unite: '°' });
    this.cible = this.choix('cible', [['anim_threeviewsspectra_v_nuage', 'nuage'], ['anim_threeviewsspectra_v_ampoule', 'ampoule']], 'nuage');
    this.gaz = this.choix('gaz', Object.keys(GAZ).map((g) => ['anim_threeviewsspectra_g_' + g, g] as [string, string]), 'hydrogene');
    this.scene = null;
  }

  spectre(): string {
    return type_de_spectre(vue(this.angle.value(), this.cible.currentData() as string));
  }

  override valeurs(): [string, string][] {
    return [
      [tr('anim_threeviewsspectra_spectre'), tr('anim_threeviewsspectra_s_' + this.spectre())],
      [tr('anim_threeviewsspectra_loi'), tr('anim_threeviewsspectra_l_' + this.spectre())],
    ];
  }

  override presser(pos: Pt, _b: Bouton_souris): boolean {
    if (this.scene !== null) {
      const [cx, cy, k] = this.scene;
      if (Math.hypot(pos.x - cx, pos.y - cy) > 1.5 * k) {
        this._glisse = (q) => this.tirer(q);
        this.tirer(pos);
        return true;
      }
    }
    return false;
  }

  private tirer(pos: Pt): void {
    const [cx, cy] = this.scene!;
    this.angle.setValue(pmod((Math.atan2(-(pos.y - cy), pos.x - cx) * 180) / Math.PI, 360.0));
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const haut = new Rect(rect.x, rect.y, rect.w, rect.h * 0.68);
    const r = dessin.cadre(p, haut, tr('anim_threeviewsspectra_titre_scene'));
    // le cercle du télescope (rayon 5,6) et son étiquette tiennent dans le panneau
    const k = Math.min(r.w / 13.4, r.h / 12.6);
    const cx = r.cx,
      cy = r.cy;
    this.scene = [cx, cy, k];
    p.setPen(dessin.stylo('grille', 1.0, null, true));
    p.setBrush(null);
    p.drawEllipse(cx, cy, R_TELESCOPE * k, R_TELESCOPE * k);
    const ax_ = cx + AMPOULE[0] * k,
      ay_ = cy - AMPOULE[1] * k;
    for (const [f, a] of [[R_HALO / AMPOULE[2], 0.08], [1.6, 0.15]] as [number, number][]) dessin.disque(p, ax_, ay_, AMPOULE[2] * k * f, 'soleil', null, a);
    dessin.reserver(p, ax_, ay_, R_HALO * k, true);
    dessin.disque(p, ax_, ay_, AMPOULE[2] * k, 'soleil', 'texte');
    dessin.texte(p, ax_, ay_ + AMPOULE[2] * k + 14, tr('anim_threeviewsspectra_ampoule'), 'doux');
    dessin.disque(p, cx, cy, NUAGE[2] * k, 'equateur', null, 0.28);
    p.setPen(dessin.stylo('equateur', 1.0, null, true));
    p.setBrush(null);
    p.drawEllipse(cx, cy, NUAGE[2] * k, NUAGE[2] * k);
    dessin.texte(p, cx, cy + NUAGE[2] * k + 14, tr('anim_threeviewsspectra_nuage'), 'doux');
    const a = (this.angle.value() * Math.PI) / 180;
    const tx = cx + R_TELESCOPE * k * Math.cos(a),
      ty = cy - R_TELESCOPE * k * Math.sin(a);
    const cible = this.cible.currentData() === 'nuage' ? NUAGE : AMPOULE;
    const gx = cx + cible[0] * k,
      gy = cy - cible[1] * k;
    const d = Math.hypot(gx - tx, gy - ty);
    const ux = (gx - tx) / d,
      uy = (gy - ty) / d;
    // la visée s'arrête sur l'ampoule, opaque : ce qui est derrière elle n'est pas vu
    const v = vue(this.angle.value(), this.cible.currentData() as string);
    const portee = v.s_ampoule !== null ? v.s_ampoule * k : 12 * k;
    p.setPen(dessin.stylo('accent1', 1.0, 0.7, true));
    p.drawLine(tx, ty, tx + ux * portee, ty + uy * portee);
    const nx = -uy,
      ny = ux;
    const w = 0.28 * k,
      l = L_TUBE * k;
    p.setPen(dessin.stylo('texte', 1.2));
    p.setBrush(dessin.c('accent2', 0.8));
    p.drawPolygon([new Pt(tx + nx * w, ty + ny * w), new Pt(tx + ux * l + nx * w * 1.3, ty + uy * l + ny * w * 1.3), new Pt(tx + ux * l - nx * w * 1.3, ty + uy * l - ny * w * 1.3), new Pt(tx - nx * w, ty - ny * w)]);
    // étiquette du télescope : à l'extérieur du cercle, placée sans chevauchement (le tube est réservé)
    dessin.reserver(p, tx + ux * l * 0.5, ty + uy * l * 0.5, Math.min(24, l * 0.6));
    const nom = tr('anim_threeviewsspectra_telescope');
    const fm = p.fontMetrics();
    const demi = 0.5 * (fm.horizontalAdvance(nom) + 6);
    const recul = 12 + demi * Math.abs(ux) + 0.5 * (fm.height() + 2) * Math.abs(uy);
    let lx = tx - ux * recul,
      ly = ty - uy * recul;
    // dehors, l'étiquette sortirait du panneau : elle passe au-dessus (ou au-dessous) du télescope
    if (lx - demi < r.x || lx + demi > r.right) {
      lx = Math.max(r.x + demi, Math.min(r.right - demi, tx));
      ly = ty + (ty > cy ? 1 : -1) * (0.6 * k + 4 + 0.5 * fm.height());
    }
    dessin.texte(p, lx, ly, nom, 'texte', { fond: true });
    const bas = new Rect(rect.x, haut.bottom, rect.w, rect.h - haut.h);
    const rb = dessin.cadre(p, bas, tr('anim_threeviewsspectra_titre_spectre'));
    const bande = new Rect(rb.x + 8, rb.y + 2, rb.w - 16, Math.max(16.0, rb.h - 18));
    const s = this.spectre();
    const raies = GAZ[this.gaz.currentData() as string]!.map((lam) => [lam, 1.0, 3.0] as [number, number, number]);
    if (s === 'continu') bande_spectre(p, bande, 380, 720, () => 1.0);
    else if (s === 'absorption') bande_spectre(p, bande, 380, 720, () => 1.0, raies.map(([lam, , e]) => [lam, 0.85, e] as [number, number, number]), true);
    else if (s === 'emission') bande_spectre(p, bande, 380, 720, null, raies);
    else bande_spectre(p, bande, 380, 720, null);
    dessin.police(p, 0.8);
    for (let lam = 400; lam <= 700; lam += 100) dessin.texte(p, bande.left + (bande.w * (lam - 380)) / 340, bande.bottom + 9, `${lam} nm`, 'doux');
    dessin.police(p, 1 / 0.8);
  }
}
