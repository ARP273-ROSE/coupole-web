/**
 * Small-Angle Approximation Demonstrator : le diamètre angulaire α d'un objet de diamètre d vu à la distance D.  Pour
 * un petit angle, α (en secondes d'arc) ≈ 206 265 × d / D ; valeur exacte pour une sphère : 2 asin(d / 2D).
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, type Pt, Rect } from '../../noyau/peintre';
import { Animation, type Bouton_souris, nombre, type Reglage } from '../base';

export class PetitsAngles extends Animation {
  static override ID = 'smallangledemo';
  static override ANIMEE = false;

  d!: Reglage;
  dist!: Reglage;
  private echelle: [number, number, number] | null = null;

  override construire(): void {
    this.d = this.curseur('diametre', 1.0, 3.0, 2.0, { dec: 2 });
    this.dist = this.curseur('distance', 2.0, 60.0, 50.0, { dec: 2 });
    for (const v of [20, 30, 40, 50, 60]) this.bouton(`anim_smallangledemo_b${v}`, () => this.dist.setValue(v));
    this.echelle = null;
  }

  override valeurs(): [string, string][] {
    const r = astro.diametre_angulaire(this.d.value(), this.dist.value());
    const err = (100 * (r.petits_angles - r.sphere)) / r.sphere;
    return [
      [tr('anim_smallangledemo_approche'), `${nombre(r.petits_angles, 1)}″`],
      [tr('anim_smallangledemo_exacte'), `${nombre(r.sphere, 1)}″ (${nombre(r.sphere / 3600, 3)}°)`],
      [tr('anim_smallangledemo_erreur'), `${nombre(err, 3)} %`],
    ];
  }

  override presser(pos: Pt, _b: Bouton_souris): boolean {
    if (this.echelle !== null) {
      const [x0, cy, k] = this.echelle;
      const bx = x0 + k * this.dist.value();
      if (Math.hypot(pos.x - bx, pos.y - cy) < Math.max(14.0, (k * this.d.value()) / 2 + 4)) {
        this._glisse = (q) => this.dist.setValue((q.x - this.echelle![0]) / this.echelle![2]);
        return true;
      }
    }
    return false;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const x0 = rect.x + 40;
    const cy = rect.cy - 20;
    const k = (rect.w - 90) / 62.0;
    this.echelle = [x0, cy, k];
    const d = this.d.value(),
      dist = this.dist.value();
    const bx = x0 + k * dist,
      rb = (k * d) / 2;
    const a = Math.asin(Math.min(1.0, rb / (k * dist)));
    const lt = Math.sqrt(Math.max(0.0, (k * dist) ** 2 - rb * rb));
    const tx = x0 + lt * Math.cos(a),
      ty = lt * Math.sin(a);
    p.setPen(dessin.stylo('doux', 1.0));
    p.drawLine(x0, cy, tx, cy - ty);
    p.drawLine(x0, cy, tx, cy + ty);
    const ra = Math.min(200.0, k * dist * 0.6);
    p.setPen(dessin.stylo('accent1', 2.5));
    p.setBrush(null);
    const ad = (a * 180) / Math.PI;
    p.drawArc(new Rect(x0 - ra, cy - ra, 2 * ra, 2 * ra), Math.trunc(-ad * 16), Math.trunc(2 * ad * 16));
    dessin.texte(p, x0 + ra + 12, cy - ra * Math.sin(a) - 10, 'α', 'accent1');
    dessin.disque(p, bx, cy, Math.max(2.0, rb), 'accent2', 'texte');
    dessin.disque(p, x0, cy, 6, 'texte');
    p.setPen(dessin.stylo('grille', 1.0));
    const y = rect.bottom - 40;
    p.drawLine(x0, y, x0 + k * 60, y);
    dessin.police(p, 0.8);
    for (let v = 0; v < 61; v += 10) {
      p.drawLine(x0 + k * v, y - 4, x0 + k * v, y + 4);
      dessin.texte(p, x0 + k * v, y + 14, String(v), 'doux');
    }
    dessin.police(p, 1 / 0.8);
    dessin.formule(p, rect.cx, rect.y + 28, `α ≈ 206 265″ × d / D = ${nombre((206_264.806 * d) / dist, 1)}″`, 'texte');
  }
}
