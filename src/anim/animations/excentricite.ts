/**
 * Eccentricity Demonstrator : les grandeurs qui définissent l'excentricité d'une ellipse.  Demi-grand axe a, distance
 * c du centre à chaque foyer, excentricité e = c / a, demi-petit axe b = √(a² − c²) ; un point qui parcourt l'ellipse
 * montre que la somme de ses distances aux deux foyers vaut toujours 2a (la méthode du jardinier).
 */
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import { Animation, type Coche, nombre, type Reglage } from '../base';

export function ellipse(a: number, c: number, t: number): { x: number; y: number; b: number; e: number; r1: number; r2: number } {
  const b = Math.sqrt(Math.max(0.0, a * a - c * c));
  const x = a * Math.cos((t * Math.PI) / 180),
    y = b * Math.sin((t * Math.PI) / 180);
  return { x, y, b, e: c / a, r1: Math.hypot(x + c, y), r2: Math.hypot(x - c, y) };
}

export class Excentricite extends Animation {
  static override ID = 'ellipsedemo';
  static DEGRES_PAR_S = 30.0;

  a!: Reglage;
  c!: Reglage;
  c_jardinier!: Coche;
  c_b!: Coche;
  t = 60.0;

  override construire(): void {
    this.a = this.curseur('a', 40.0, 100.0, 100.0, { dec: 0 });
    this.c = this.curseur('c', 0.0, 99.0, 40.0, { dec: 0 });
    this.c_jardinier = this.coche('jardinier', true);
    this.c_b = this.coche('b', false);
    this.t = 60.0;
    this.borner();
  }

  private borner(): void {
    this.c.borner(0.0, this.a.value() - 1.0);
  }

  override reglage_change(): void {
    this.borner();
    super.reglage_change();
  }

  override etat_initial(): void {
    this.t = 60.0;
  }

  override avancer(dt: number): void {
    this.t = pmod(this.t + dt * Excentricite.DEGRES_PAR_S, 360.0);
  }

  override valeurs(): [string, string][] {
    const a = this.a.value(),
      c = this.c.value();
    const g = ellipse(a, c, this.t);
    const out: [string, string][] = [
      ['a', nombre(a, 0)], ['c', nombre(c, 0)], ['b = √(a² − c²)', nombre(g.b, 2)], [tr('anim_ellipsedemo_e'), `c / a = ${nombre(g.e, 3)}`],
    ];
    if (this.c_jardinier.isChecked()) out.push([tr('anim_ellipsedemo_somme'), `${nombre(g.r1, 2)} + ${nombre(g.r2, 2)} = ${nombre(g.r1 + g.r2, 2)} = 2a`]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const a = this.a.value(),
      c = this.c.value();
    const g = ellipse(a, c, this.t);
    const k = Math.min((rect.w - 40) / 200.0, (rect.h - 70) / 200.0);
    const cx = rect.cx,
      cy = rect.cy - 10;
    const q = (x: number, y: number): Pt => new Pt(cx + k * x, cy - k * y);
    p.setPen(dessin.stylo('texte', 1.8));
    p.setBrush(null);
    p.drawEllipse(cx, cy, k * a, k * g.b);
    p.setPen(dessin.stylo('grille', 1.0, null, true));
    p.drawLineP(q(-a, 0), q(a, 0));
    for (const x of [-c, c]) dessin.disque(p, q(x, 0).x, q(x, 0).y, 4.5, 'accent1');
    dessin.disque(p, cx, cy, 2.5, 'doux');
    const ya = -g.b - 12 / k,
      yc = 10 / k;
    dessin.fleche(p, q(0, ya).x, q(0, ya).y, q(a, ya).x, q(a, ya).y, dessin.stylo('accent2', 1.4), 7);
    dessin.texte(p, q(a / 2, ya).x, q(a / 2, ya).y + 11, 'a', 'accent2');
    if (c > 0) {
      dessin.fleche(p, q(0, yc).x, q(0, yc).y, q(c, yc).x, q(c, yc).y, dessin.stylo('accent3', 1.4), 6);
      dessin.texte(p, q(c / 2, yc).x, q(c / 2, yc).y - 10, 'c', 'accent3');
    }
    if (this.c_b.isChecked()) {
      p.setPen(dessin.stylo('arc1', 1.4));
      p.drawLineP(q(0, 0), q(0, g.b));
      dessin.texte(p, q(0, g.b / 2).x + 10, q(0, g.b / 2).y, 'b', 'arc1');
    }
    if (this.c_jardinier.isChecked()) {
      const m = q(g.x, g.y);
      p.setPen(dessin.stylo('arc2', 1.4));
      p.drawLineP(q(-c, 0), m);
      p.setPen(dessin.stylo('equateur', 1.4));
      p.drawLineP(q(c, 0), m);
      dessin.disque(p, m.x, m.y, 5, 'accent1', 'texte');
    }
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(null);
    p.drawRoundedRect(new Rect(cx - 110, rect.bottom - 36, 220, 34), 8, 8);
    dessin.police(p, 1.3, true);
    dessin.texte(p, cx, rect.bottom - 19, `e = c / a = ${nombre(g.e, 3)}`);
    dessin.police(p, 1 / 1.3);
  }
}
