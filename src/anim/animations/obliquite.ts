/**
 * Obliquity Simulator : l'obliquité est l'angle entre l'axe de rotation d'une planète et la perpendiculaire au plan
 * de son orbite (de façon équivalente, entre l'équateur et le plan de l'orbite).
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Rect } from '../../noyau/peintre';
import { proundn } from '../../noyau/py';
import { Animation, angle, type Reglage } from '../base';

// Obliquités (degrés) : Terre calculée (IAU 2006) ; Mars 25,19° et Uranus 97,77° (fiches planétaires de la NASA)
const PLANETES: [string, number | null][] = [['terre', null], ['mars', 25.19], ['uranus', 97.77]];

export class Obliquite extends Animation {
  static override ID = 'obliquity';
  static override ANIMEE = false;

  obl!: Reglage;

  override construire(): void {
    this.obl = this.curseur('obliquite', 0.0, 180.0, 23.5, { dec: 2, unite: '°' });
    for (const [cle, val] of PLANETES)
      this.bouton('anim_obliquity_' + cle, () =>
        this.obl.setValue(val !== null ? val : proundn(astro.obliquite_moyenne(astro.jour_julien(2026, 1, 1)), 3)),
      );
  }

  override valeurs(): [string, string][] {
    const e26 = astro.obliquite_moyenne(astro.jour_julien(2026, 1, 1));
    return [
      [tr('anim_obliquity_obliquite'), angle(this.obl.value(), 2)],
      [tr('anim_obliquity_terre_j2000'), angle(astro.obliquite_moyenne(), 4)],
      [tr('anim_obliquity_terre_2026'), angle(e26, 4)],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const o = this.obl.value();
    const cx = rect.cx,
      cy = rect.cy + 10;
    const rt = Math.min(rect.w, rect.h) * 0.26;
    p.setPen(dessin.stylo('grille', 1.5));
    p.drawLine(rect.x + 20, cy, rect.right - 20, cy);
    dessin.texte(p, rect.right - 24 - p.fontMetrics().horizontalAdvance(tr('anim_obliquity_plan')), cy + 16, tr('anim_obliquity_plan'), 'doux', { centre: false });
    dessin.disque(p, cx, cy, rt, 'terre');
    p.setPen(dessin.stylo('doux', 1.5, null, true));
    p.drawLine(cx, cy - rt * 1.7, cx, cy + rt * 1.7);
    const a = (o * Math.PI) / 180;
    const dx = Math.sin(a),
      dy = -Math.cos(a);
    p.setPen(dessin.stylo('equateur', 2.0));
    p.drawLine(cx - rt * Math.cos(a), cy - rt * Math.sin(a), cx + rt * Math.cos(a), cy + rt * Math.sin(a));
    p.setPen(dessin.stylo('texte', 2.5));
    p.drawLine(cx - dx * rt * 1.6, cy - dy * rt * 1.6, cx + dx * rt * 1.6, cy + dy * rt * 1.6);
    dessin.texte(p, cx + dx * rt * 1.75, cy + dy * rt * 1.75, tr('anim_pc_n'), 'texte');
    const rr = rt * 1.25;
    p.setPen(dessin.stylo('accent1', 2.5));
    p.setBrush(null);
    p.drawArc(new Rect(cx - rr, cy - rr, 2 * rr, 2 * rr), 90 * 16, Math.trunc(-o * 16));
    const b = ((o / 2) * Math.PI) / 180;
    dessin.texte(p, cx + Math.sin(b) * rr * 1.18, cy - Math.cos(b) * rr * 1.18, angle(o, 1), 'accent1', { fond: true });
  }
}
