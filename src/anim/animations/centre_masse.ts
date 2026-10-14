/**
 * Center of Mass Simulator : le centre de masse de deux corps est sur le segment qui les joint, aux distances
 * r₁ = d m₂ / (m₁ + m₂) et r₂ = d m₁ / (m₁ + m₂) : plus près du plus massif (r₁ m₁ = r₂ m₂).  Réglages de l'original ;
 * on peut en plus faire tourner le couple autour de son centre de masse.
 */
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import type { Peintre, Rect } from '../../noyau/peintre';
import { Animation, type Coche, nombre, type Reglage } from '../base';

export function distances(m1: number, m2: number, d: number): [number, number] {
  return [(d * m2) / (m1 + m2), (d * m1) / (m1 + m2)];
}

export class CentreMasse extends Animation {
  static override ID = 'centerofmass';

  m1!: Reglage;
  m2!: Reglage;
  d!: Reglage;
  c_fixe!: Coche;
  angle = 0.0;

  override construire(): void {
    this.m1 = this.curseur('m1', 1.0, 10.0, 7.0, { dec: 1 });
    this.m2 = this.curseur('m2', 1.0, 10.0, 3.0, { dec: 1 });
    this.d = this.curseur('separation', 1.0, 20.0, 10.0, { dec: 1 });
    this.c_fixe = this.coche('fixe', true);
    this.angle = 0.0;
  }

  override etat_initial(): void {
    this.angle = 0.0;
  }

  override avancer(dt: number): void {
    this.angle += (dt * 2 * Math.PI) / 6.0;
  }

  override valeurs(): [string, string][] {
    const m1 = this.m1.value(),
      m2 = this.m2.value(),
      d = this.d.value();
    const [r1, r2] = distances(m1, m2, d);
    return [
      [tr('anim_centerofmass_r1'), nombre(r1, 2)],
      [tr('anim_centerofmass_r2'), nombre(r2, 2)],
      [tr('anim_centerofmass_produits'), `m₁ r₁ = ${nombre(m1 * r1, 2)} = m₂ r₂ = ${nombre(m2 * r2, 2)}`],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const r = dessin.cadre(p, rect, tr('anim_centerofmass_titre'));
    const m1 = this.m1.value(),
      m2 = this.m2.value(),
      d = this.d.value();
    const [r1, r2] = distances(m1, m2, d);
    const k = Math.min(r.w * 0.8, r.h * 1.6) / 20.0;
    let cx = r.cx;
    const cy = r.cy;
    if (!this.c_fixe.isChecked()) cx = r.cx - (d * k) / 2 + r1 * k;
    const lignes: [number, number, number, number][] = [];
    const n = Math.trunc(r.w / k / 2) + 1;
    for (let i = -n; i <= n; i++) {
      const x = cx + i * k;
      if (r.left <= x && x <= r.right) lignes.push([Math.round(x) + 0.5, r.top + 6, Math.round(x) + 0.5, r.bottom - 6]);
    }
    p.setPen(dessin.stylo('grille', 0.6, 0.5));
    p.drawLines(lignes);
    const a = this.angle;
    const x1 = cx - r1 * k * Math.cos(a),
      y1 = cy + r1 * k * Math.sin(a);
    const x2 = cx + r2 * k * Math.cos(a),
      y2 = cy - r2 * k * Math.sin(a);
    p.setPen(dessin.stylo('accent2', 2.0));
    p.drawLine(x1, y1, cx, cy);
    p.setPen(dessin.stylo('accent3', 2.0));
    p.drawLine(cx, cy, x2, y2);
    dessin.disque(p, x1, y1, 8 * m1 ** 0.37, 'accent2', 'texte');
    dessin.disque(p, x2, y2, 8 * m2 ** 0.37, 'accent3', 'texte');
    dessin.texte(p, x1, y1 - 8 * m1 ** 0.37 - 12, `m₁ = ${nombre(m1, 1)}`, 'accent2', { fond: true });
    dessin.texte(p, x2, y2 - 8 * m2 ** 0.37 - 12, `m₂ = ${nombre(m2, 1)}`, 'accent3', { fond: true });
    dessin.texte(p, (x1 + cx) / 2, (y1 + cy) / 2 + 14, `r₁ = ${nombre(r1, 2)}`, 'accent2', { fond: true });
    dessin.texte(p, (x2 + cx) / 2, (y2 + cy) / 2 + 14, `r₂ = ${nombre(r2, 2)}`, 'accent3', { fond: true });
    p.setPen(dessin.stylo('accent1', 2.0));
    p.drawLine(cx - 7, cy - 7, cx + 7, cy + 7);
    p.drawLine(cx - 7, cy + 7, cx + 7, cy - 7);
    dessin.texte(p, cx, cy + 34, tr('anim_c_barycentre'), 'accent1', { fond: true });
  }
}
