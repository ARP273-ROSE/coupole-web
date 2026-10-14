/**
 * Hammer Thrower Comparison : un lanceur de marteau qui fait tourner la boule tourne lui-même autour de leur centre de
 * masse commun, comme une étoile autour du centre de masse qu'elle partage avec sa planète.  Rayons inversement
 * proportionnels aux masses : r₁ / r₂ = m₂ / m₁.  Les deux systèmes sont simulés côte à côte.
 */
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import type { Peintre, Rect } from '../../noyau/peintre';
import { Animation, type Coche, nombre, type Reglage } from '../base';

const MARTEAU_KG = 7.26;
const RAYON_M = 2.0;

export class LanceurMarteau extends Animation {
  static override ID = 'hammerthrower';
  static override LECTURE_AU_DEPART = true;

  m_lanceur!: Reglage;
  m_marteau!: Reglage;
  rapport!: Reglage;
  c_trajets!: Coche;
  angle = 0.0;

  override construire(): void {
    this.m_lanceur = this.curseur('lanceur', 40.0, 150.0, 110.0, { dec: 0, unite: 'kg' });
    this.m_marteau = this.curseur('marteau', 1.0, 20.0, MARTEAU_KG, { dec: 2, unite: 'kg' });
    this.rapport = this.curseur('rapport', 1.0, 20.0, 6.2 / 1.2, { dec: 2 });
    this.c_trajets = this.coche('trajets', true);
    this.angle = 0.0;
  }

  override etat_initial(): void {
    this.angle = 0.0;
  }

  override avancer(dt: number): void {
    this.angle += dt * 2 * Math.PI * 0.35;
  }

  override valeurs(): [string, string][] {
    const m1 = this.m_lanceur.value(),
      m2 = this.m_marteau.value();
    const r1 = (RAYON_M * m2) / (m1 + m2);
    const q = this.rapport.value();
    return [
      [tr('anim_hammerthrower_r_lanceur'), `${nombre(r1, 3)} m`],
      [tr('anim_hammerthrower_r_boule'), `${nombre(RAYON_M - r1, 3)} m`],
      [tr('anim_hammerthrower_rapport_v'), `${nombre(r1, 3)} / ${nombre(RAYON_M - r1, 3)} = ${nombre(m2 / m1, 3)}`],
      [tr('anim_hammerthrower_r_etoile'), `${nombre(100 / (1 + q), 1)} %`],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones(rect, 2, 0.95);
    this.systeme(p, dessin.cadre(p, z[0]!, tr('anim_hammerthrower_titre_lanceur')), this.m_lanceur.value(), this.m_marteau.value(), 'lanceur');
    this.systeme(p, dessin.cadre(p, z[1]!, tr('anim_hammerthrower_titre_etoile')), this.rapport.value(), 1.0, 'etoile');
  }

  private systeme(p: Peintre, r: Rect, m1: number, m2: number, genre: string): void {
    const cx = r.cx,
      cy = r.cy + 6;
    const d = Math.min(r.w, r.h) * 0.4;
    const r1 = (d * m2) / (m1 + m2),
      r2 = (d * m1) / (m1 + m2);
    const a = this.angle;
    const x1 = cx - r1 * Math.cos(a),
      y1 = cy + r1 * Math.sin(a);
    const x2 = cx + r2 * Math.cos(a),
      y2 = cy - r2 * Math.sin(a);
    if (this.c_trajets.isChecked()) {
      p.setBrush(null);
      p.setPen(dessin.stylo(genre === 'etoile' ? 'accent1' : 'accent2', 1.0, 0.7, true));
      p.drawEllipse(cx, cy, r1, r1);
      p.setPen(dessin.stylo('equateur', 1.0, 0.7, true));
      p.drawEllipse(cx, cy, r2, r2);
    }
    p.setPen(dessin.stylo('doux', 1.5));
    p.drawLine(x1, y1, x2, y2);
    if (genre === 'lanceur') {
      dessin.disque(p, x1, y1, 16, 'accent2', 'texte');
      dessin.disque(p, x2, y2, 7, 'doux', 'texte');
      dessin.texte(p, x1, y1 - 24, tr('anim_hammerthrower_lanceur_n'), 'accent2', { fond: true });
      dessin.texte(p, x2, y2 - 16, tr('anim_hammerthrower_boule'), 'doux', { fond: true });
    } else {
      dessin.disque(p, x1, y1, 16, 'soleil');
      dessin.disque(p, x2, y2, 6, 'equateur', 'texte');
      dessin.texte(p, x1, y1 - 24, tr('anim_c_etoile'), 'accent1', { fond: true });
      dessin.texte(p, x2, y2 - 15, tr('anim_c_planete'), 'equateur', { fond: true });
    }
    p.setPen(dessin.stylo('accent3', 2.0));
    p.drawLine(cx - 6, cy, cx + 6, cy);
    p.drawLine(cx, cy - 6, cx, cy + 6);
    dessin.texte(p, cx, cy + 16, tr('anim_c_barycentre'), 'accent3', { fond: true });
  }
}
