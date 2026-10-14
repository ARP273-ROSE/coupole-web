/**
 * Spectroscopic Parallax Simulator : la distance d'une étoile sans mesurer sa parallaxe.  Le spectre donne le type
 * spectral et la classe de luminosité ; le diagramme HR donne la magnitude absolue M ; avec la magnitude apparente m,
 * d = 10^((m − M + 5) / 5) parsecs.  Étalonnages du diagramme et intensités des raies : ceux de l'original.
 */
import * as astro from '../../calc/astro';
import * as hr from '../../calc/hr';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Couleur, type Peintre, Pt, Rect } from '../../noyau/peintre';
import { pround } from '../../noyau/py';
import { Animation, type Bouton_souris, type Choix, type Coche, nombre, type Reglage } from '../base';
import { exposant } from './gravitation';

const LOG_T: [number, number] = [3.3617, 4.6021];
const LOG_L: [number, number] = [-4.0, 6.0];
const CLASSES: [string, number][] = [['I', 1], ['II', 2], ['III', 3], ['IV', 4], ['V', 5]];
const NOM_CLASSE: Record<number, string> = Object.fromEntries(CLASSES.map(([c, n]) => [n, c]));
export const RAIES: Record<string, number[]> = {
  he_ii: [433.9, 454.2, 468.6], he_i: [402.6, 438.8, 447.1, 706.5], h: [397.0, 410.1, 434.0, 486.1, 656.3],
  metaux_ionises: [393.3, 396.8, 407.7, 417.5, 421.5, 423.3, 424.6, 426.7, 430.0, 444.4, 448.1],
  metaux: [403.2, 404.5, 432.5, 422.6, 589.0], molecules: [421.5, 430.0, 458.4, 462.5, 467.0, 469.7, 478.0],
};

/** Intensité (0 à 100) des raies de chaque famille pour le type spectral numérique t, d'après l'original. */
export function intensites(t: number): Record<string, number> {
  const f = (cond: [number, number, number][]): number => {
    for (const [b, a, c] of cond) if (t < b) return Math.max(0, Math.floor(a * t + c));
    return 0;
  };
  return {
    he_ii: f([[8, -12.5, 100]]),
    he_i: f([[8, 3.75, 70], [21, -7.7, 161.7]]),
    h: f([[7, 0, 0], [20, 7.7, -53.9], [54, -2.94, 158.7]]),
    metaux_ionises: f([[11, 0, 0], [38, 3.7, -40.7], [52, -7.14, 371.3]]),
    metaux: f([[30, 0, 0], [49, 5.26, -157.8], [62, -7.7, 477.4]]),
    molecules: t >= 50 ? Math.max(0, Math.floor(5.26 * t - 263.16)) : 0,
  };
}

export function magnitude_absolue(t: number, classe: number): { log_t: number; log_l: number; M: number; d?: number } {
  const lt = hr.log_temp_de_type(t);
  const ll = hr.log_lum_classe(lt, classe);
  return { log_t: lt, log_l: ll, M: hr.mbol_de_log_lum(ll) - hr.correction_bolometrique(lt) };
}

/** Couleur HSV → RVB (comme QColor.fromHsvF). */
export function hsv(h: number, s: number, v: number): Couleur {
  const i = Math.floor(h * 6) % 6;
  const f = h * 6 - Math.floor(h * 6);
  const p = v * (1 - s),
    q = v * (1 - f * s),
    t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i]!;
  return new Couleur(r! * 255, g! * 255, b! * 255);
}

export function couleur_raie(lam: number): Couleur {
  const h = Math.max(0.0, Math.min(1.0, (700.0 - lam) / 320.0)) * 270.0;
  return hsv(h / 360.0, 0.75, 0.95);
}

export function etiquetteLum(ll: number): string {
  return ll < 3 ? nombre(10.0 ** ll, Math.max(0, -ll)) : `10${exposant(ll)}`;
}

export class ParallaxeSpectro extends Animation {
  static override ID = 'spectroparallax';
  static override ANIMEE = false;

  sp!: Reglage;
  classe!: Choix;
  m!: Reglage;
  c_emission!: Coche;
  private graphe: [Rect, number, number] | null = null;

  override construire(): void {
    this.sp = this.curseur('type', 0.0, 69.0, 42.0, { dec: 0 });
    this.classe = this.choix('classe', CLASSES.map(([c, n]) => ['anim_spectroparallax_c_' + c, n] as [string, number]), 5);
    this.m = this.curseur('m', -5.0, 15.0, 1.0, { dec: 2 });
    this.c_emission = this.coche('emission', false);
    this.graphe = null;
  }

  resultat(): { log_t: number; log_l: number; M: number; d: number } {
    const r = magnitude_absolue(this.sp.value(), this.classe.currentData() as number);
    return { ...r, d: astro.distance_du_module(this.m.value() - r.M) };
  }

  override valeurs(): [string, string][] {
    const r = this.resultat();
    return [
      [tr('anim_spectroparallax_type_c'), `${hr.nom_type(this.sp.value())} ${NOM_CLASSE[this.classe.currentData() as number]}`],
      [tr('anim_stellarlum_temperature'), `${nombre(10 ** r.log_t, 0)} K`],
      [tr('anim_spectroparallax_lum'), `${nombre(10 ** r.log_l, r.log_l < 1 ? 3 : 0)} L☉`],
      [tr('anim_spectroparallax_M'), nombre(r.M, 2)],
      [tr('anim_spectroparallax_module'), nombre(this.m.value() - r.M, 2)],
      [tr('anim_spectroparallax_distance'), `${nombre(r.d, r.d < 1000 ? 1 : 0)} pc (${nombre(r.d * astro.PC_EN_AL, 0)} ${tr('anim_spectroparallax_al')})`],
      [tr('anim_spectroparallax_raies'), this.description()],
    ];
  }

  private description(): string {
    const parts: string[] = [];
    for (const [famille, v] of Object.entries(intensites(Math.trunc(this.sp.value())))) {
      if (v > 0) {
        const q = v < 20 ? 'tf' : v < 40 ? 'f' : v < 60 ? 'm' : v < 85 ? 'F' : 'tF';
        parts.push(tr('anim_spectroparallax_q_' + q, { f: tr('anim_spectroparallax_f_' + famille) }));
      }
    }
    return parts.join(', ');
  }

  override presser(pos: Pt, _b: Bouton_souris): boolean {
    if (this.graphe !== null && this.graphe[0].contains(pos)) {
      this._glisse = (q) => this.tirer(q);
      this.tirer(pos);
      return true;
    }
    return false;
  }

  private tirer(pos: Pt): void {
    const [, x0, x1] = this.graphe!;
    this.sp.setValue(pround(Math.max(0.0, Math.min(69.0, (70.0 * (pos.x - x0)) / (x1 - x0)))));
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const haut = rect.h * 0.7;
    this.diagramme(p, dessin.cadre(p, new Rect(rect.x, rect.y, rect.w, haut), tr('anim_spectroparallax_diagramme')));
    this.spectre(p, dessin.cadre(p, new Rect(rect.x, rect.y + haut, rect.w, rect.h - haut), tr('anim_spectroparallax_spectre')));
  }

  private diagramme(p: Peintre, r: Rect): void {
    const x0 = r.x + 40,
      x1 = r.right - 8,
      y0 = r.y + 4,
      y1 = r.bottom - 30;
    this.graphe = [r.copie(), x0, x1];
    const xy = (lt: number, ll: number): Pt => new Pt(x1 - ((x1 - x0) * (lt - LOG_T[0])) / (LOG_T[1] - LOG_T[0]), y1 - ((y1 - y0) * (ll - LOG_L[0])) / (LOG_L[1] - LOG_L[0]));
    p.setPen(dessin.stylo('grille', 1.0, 0.5));
    dessin.police(p, 0.72);
    for (let ll = -4; ll < 7; ll += 2) {
      const q = xy(LOG_T[0], ll);
      p.drawLine(x0, q.y, x1, q.y);
      dessin.texte(p, x0 - 18, q.y, etiquetteLum(ll), 'doux');
    }
    [...hr.LETTRES].forEach((lettre, k) => {
      const q = xy(hr.log_temp_de_type(10 * k + 5), LOG_L[0]);
      dessin.texte(p, q.x, y1 + 12, lettre, 'doux');
    });
    dessin.texte(p, (x0 + x1) / 2, y1 + 24, tr('anim_spectroparallax_axe_x'), 'doux');
    dessin.police(p, 1 / 0.72);
    for (const [, n] of CLASSES) {
      const [a, b] = hr.CLASSES[n]!;
      const pts: Pt[] = [];
      for (let i = 0; i <= 60; i++) pts.push(xy(a + ((b - a) * i) / 60, hr.log_lum_classe(a + ((b - a) * i) / 60, n)));
      const choisie = n === this.classe.currentData();
      p.setPen(dessin.stylo(choisie ? 'accent3' : 'arc1', choisie ? 2.2 : 1.0, choisie ? 1.0 : 0.6));
      p.setBrush(null);
      p.drawPolyline(pts);
      dessin.texte(p, pts[0]!.x - 12, pts[0]!.y, NOM_CLASSE[n]!, 'doux');
    }
    const res = this.resultat();
    const q = xy(res.log_t, res.log_l);
    p.setPen(dessin.stylo('accent1', 1.0, 0.7, true));
    p.drawLine(q.x, y0, q.x, y1);
    p.drawLine(x0, q.y, x1, q.y);
    dessin.disque(p, q.x, q.y, 6, new Couleur(...hr.couleur_rvb(10 ** res.log_t)), 'texte');
  }

  private spectre(p: Peintre, r: Rect): void {
    const x0 = r.x + 8,
      x1 = r.right - 8;
    const y0 = r.y + 2,
      y1 = r.bottom - 16;
    const x_de = (lam: number): number => x0 + ((x1 - x0) * (lam - 390.0)) / (710.0 - 390.0);
    const emission = this.c_emission.isChecked();
    if (!emission) {
      const arrets: [number, Couleur][] = [];
      for (let k = 0; k < 9; k++) arrets.push([k / 8, couleur_raie(390.0 + (320.0 * k) / 8)]);
      p.fillRect(new Rect(x0, y0, x1 - x0, y1 - y0), { x0, y0: 0, x1, y1: 0, arrets });
    } else p.fillRect(new Rect(x0, y0, x1 - x0, y1 - y0), dessin.c('nuit'));
    for (const [famille, v] of Object.entries(intensites(Math.trunc(this.sp.value())))) {
      if (v <= 0) continue;
      for (const lam of RAIES[famille]!) {
        if (390 <= lam && lam <= 710) {
          const c = emission ? couleur_raie(lam) : new Couleur(0, 0, 0);
          c.setAlphaF(Math.min(1.0, v / 100.0));
          p.fillRect(new Rect(x_de(lam) - 1.2, y0, 2.4, y1 - y0), c);
        }
      }
    }
    dessin.police(p, 0.72);
    for (const lam of [400, 450, 500, 550, 600, 650, 700]) dessin.texte(p, x_de(lam), y1 + 8, `${lam} nm`, 'doux');
    dessin.police(p, 1 / 0.72);
  }
}
