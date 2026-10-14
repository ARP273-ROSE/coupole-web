/**
 * Epicycles Demo : trois corps, le jaune au centre, le bleu et le rouge sur des orbites circulaires (périodes selon
 * la 3e loi de Kepler).  Vu en gardant fixe le jaune (héliocentrique), le bleu (géocentrique : le rouge décrit des
 * boucles, comme un épicycle) ou le rouge.  Les deux descriptions prédisent exactement les mêmes positions relatives.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import type { Peintre, Rect } from '../../noyau/peintre';
import { Animation, type Choix, nombre } from '../base';

const R2 = 85.0,
  R3 = 200.0;
const SEGMENTS = 120;
const PAS = 0.025;

type Pos = Record<number, [number, number]>;

function positions(t: number, centre: number): Pos {
  return astro.epicycles(t, R2, R3, centre) as unknown as Pos;
}

export class Epicycles extends Animation {
  static override ID = 'pathtracer';
  static PERIODES_PAR_S = 0.5;

  centre!: Choix;
  t = 0.0;
  traces: Record<number, [number, number][]> = { 1: [], 2: [], 3: [] };

  override construire(): void {
    this.centre = this.choix('centre', [['anim_pathtracer_jaune', 1], ['anim_pathtracer_bleu', 2], ['anim_pathtracer_rouge', 3]], 1);
    this.t = 0.0;
    this.traces = { 1: [], 2: [], 3: [] };
  }

  override reglage_change(): void {
    for (const k of [1, 2, 3]) this.traces[k] = [];
    super.reglage_change();
  }

  override etat_initial(): void {
    this.t = 0.0;
    for (const k of [1, 2, 3]) this.traces[k] = [];
  }

  override avancer(dt: number): void {
    const t1 = this.t + dt * Epicycles.PERIODES_PAR_S;
    const n = Math.max(1, Math.trunc((t1 - this.t) / PAS));
    for (let i = 1; i <= n; i++) {
      const pos = positions(this.t + ((t1 - this.t) * i) / n, this.centre.currentData() as number);
      for (const k of [1, 2, 3]) {
        const tr_ = this.traces[k]!;
        tr_.push(pos[k]!);
        if (tr_.length > SEGMENTS) tr_.shift();
      }
    }
    this.t = t1;
  }

  override valeurs(): [string, string][] {
    const p3 = (R3 / R2) ** 1.5;
    return [
      [tr('anim_pathtracer_temps'), nombre(this.t, 2)],
      [tr('anim_pathtracer_periode_rouge'), nombre(p3, 3)],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const cx = rect.cx,
      cy = rect.cy;
    const k = (Math.min(rect.w, rect.h) * 0.47) / (R2 + R3);
    const centre = this.centre.currentData() as number;
    const pos = positions(this.t, centre);
    const o = pos[1]!;
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(null);
    for (const r of [R2, R3]) p.drawEllipse(cx + k * o[0], cy - k * o[1], r * k, r * k);
    const couleurs: Record<number, string> = { 1: 'soleil', 2: 'accent2', 3: 'accent3' };
    for (const cle of [1, 2, 3]) {
      const pts = this.traces[cle]!;
      const n = pts.length;
      for (let i = 1; i < n; i++) {
        p.setPen(dessin.stylo(couleurs[cle]!, 1.4, i / n));
        p.drawLine(cx + k * pts[i - 1]![0], cy - k * pts[i - 1]![1], cx + k * pts[i]![0], cy - k * pts[i]![1]);
      }
    }
    for (const [cle, rr] of [[1, 11], [2, 7], [3, 8]] as [number, number][]) {
      const [x, y] = pos[cle]!;
      dessin.disque(p, cx + k * x, cy - k * y, rr, couleurs[cle]!);
    }
    const noms = ['anim_pathtracer_jaune', 'anim_pathtracer_bleu', 'anim_pathtracer_rouge'];
    dessin.texte(p, rect.x + 12, rect.y + 20, tr('anim_pathtracer_vu_depuis', { corps: tr(noms[centre - 1]!) }), 'texte', { centre: false });
  }
}
