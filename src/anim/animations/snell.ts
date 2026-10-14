/**
 * Snell's Law Demonstrator : un rayon passe d'un milieu à un autre et change de direction : n₁ sin θ₁ = n₂ sin θ₂.
 * Allant vers un milieu moins réfringent, au-delà de l'angle limite (sin θ_c = n₂ / n₁), il est entièrement réfléchi.
 * En plus de l'original : la part réfléchie (formules de Fresnel, lumière naturelle) et l'angle de Brewster.  Indices
 * de l'original (air 1,00, eau 1,33, huile 1,50, verre flint 1,66, zircon 1,92, diamant 2,42).
 */
import * as lumiere from '../../calc/lumiere';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, type Pt, Rect } from '../../noyau/peintre';
import { Animation, type Bouton_souris, type Choix, nombre, type Reglage } from '../base';

const MILIEUX: [string, number][] = [['air', 1.0], ['eau', 1.33], ['huile', 1.5], ['flint', 1.66], ['zircon', 1.92], ['diamant', 2.42]];
const INDICE = new Map(MILIEUX);

export class Snell extends Animation {
  static override ID = 'snellslaw';
  static override ANIMEE = false;

  m1!: Choix;
  n1!: Reglage;
  m2!: Choix;
  n2!: Reglage;
  theta!: Reglage;
  private zone: [number, number] | null = null;

  override construire(): void {
    const options = MILIEUX.map(([k]) => ['anim_snellslaw_m_' + k, k] as [string, string]);
    this.m1 = this.choix('milieu1', options, 'air');
    this.m1.activated.connect(() => this.n1.setValue(INDICE.get(this.m1.currentData() as string)!));
    this.n1 = this.curseur('n1', 1.0, 2.5, 1.0, { dec: 3 });
    this.m2 = this.choix('milieu2', options, 'eau');
    this.m2.activated.connect(() => this.n2.setValue(INDICE.get(this.m2.currentData() as string)!));
    this.n2 = this.curseur('n2', 1.0, 2.5, 1.33, { dec: 3 });
    this.theta = this.curseur('angle', 0.0, 89.9, 40.0, { dec: 1, unite: '°' });
    this.zone = null;
  }

  override valeurs(): [string, string][] {
    const n1 = this.n1.value(),
      n2 = this.n2.value(),
      t1 = this.theta.value();
    const t2 = lumiere.snell(t1, n1, n2);
    const lim = lumiere.angle_critique(n1, n2);
    const f = lumiere.fresnel(t1, n1, n2);
    const rad = Math.PI / 180;
    return [
      [tr('anim_snellslaw_t2'), t2 !== null ? `${nombre(t2, 1)}°` : tr('anim_snellslaw_totale')],
      [tr('anim_snellslaw_limite'), lim !== null ? `${nombre(lim, 1)}°` : tr('anim_snellslaw_pas_de_limite')],
      [tr('anim_snellslaw_reflechie'), `${nombre(100 * f.r, 1)} %`],
      [tr('anim_snellslaw_brewster'), `${nombre(lumiere.angle_brewster(n1, n2), 1)}°`],
      ['n₁ sin θ₁ = n₂ sin θ₂', `${nombre(n1 * Math.sin(t1 * rad), 4)} = ${t2 !== null ? nombre(n2 * Math.sin(t2 * rad), 4) : '—'}`],
    ];
  }

  override presser(pos: Pt, _bouton: Bouton_souris): boolean {
    if (this.zone !== null && pos.y < this.zone[1]) {
      this._glisse = (q) => this.tirer(q);
      this.tirer(pos);
      return true;
    }
    return false;
  }

  private tirer(pos: Pt): void {
    const [cx, cy] = this.zone!;
    this.theta.setValue(Math.max(0.0, Math.min(89.9, (Math.atan2(Math.abs(pos.x - cx), Math.max(1e-6, cy - pos.y)) * 180) / Math.PI)));
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const n1 = this.n1.value(),
      n2 = this.n2.value(),
      t1 = this.theta.value();
    const r = rect.adjusted(6, 6, -6, -6);
    const cx = r.cx,
      cy = r.cy;
    this.zone = [cx, cy];
    const teinte = (n: number): number => Math.min(0.55, 0.08 + 0.3 * (n - 1.0));
    p.fillRect(new Rect(r.left, r.top, r.w, cy - r.top), dessin.c('equateur', teinte(n1)));
    p.fillRect(new Rect(r.left, cy, r.w, r.bottom - cy), dessin.c('equateur', teinte(n2)));
    dessin.texte(p, r.left + 10, r.top + 16, `${tr('anim_snellslaw_haut')} : n₁ = ${nombre(n1, 3)}`, 'texte', { centre: false });
    dessin.texte(p, r.left + 10, r.bottom - 10, `${tr('anim_snellslaw_bas')} : n₂ = ${nombre(n2, 3)}`, 'texte', { centre: false });
    const L = Math.min(r.w / 2, r.h / 2) * 0.92;
    p.setPen(dessin.stylo('doux', 1.0, null, true));
    p.drawLine(cx, cy - L, cx, cy + L);
    const a = (t1 * Math.PI) / 180;
    const x0 = cx - L * Math.sin(a),
      y0 = cy - L * Math.cos(a);
    const f = lumiere.fresnel(t1, n1, n2);
    p.setPen(dessin.stylo('accent3', 3.0));
    p.drawLine(x0, y0, cx, cy);
    p.setPen(dessin.stylo('accent3', 2.0, 0.25 + 0.75 * f.r));
    p.drawLine(cx, cy, cx + L * Math.sin(a), cy - L * Math.cos(a));
    const t2 = lumiere.snell(t1, n1, n2);
    if (t2 !== null) {
      const b = (t2 * Math.PI) / 180;
      p.setPen(dessin.stylo('accent3', 3.0, 0.3 + 0.7 * (1 - f.r)));
      p.drawLine(cx, cy, cx + L * Math.sin(b), cy + L * Math.cos(b));
      Snell.arc(p, cx, cy, 70, -90.0, t2, 'accent1', 'θ₂');
    }
    Snell.arc(p, cx, cy, 60, 90.0, t1, 'accent2', 'θ₁');
    p.save();
    p.translate(x0, y0);
    p.rotate(90 - t1 + 180);
    p.fillRect(new Rect(-34, -7, 34, 14), dessin.c('doux'));
    p.restore();
  }

  /** Arc d'angle depuis la normale : `depart` = direction de la normale (degrés, sens trigonométrique), `etendue` = angle balayé. */
  static arc(p: Peintre, cx: number, cy: number, rayon: number, depart: number, etendue: number, cle: string, nom: string): void {
    if (Math.abs(etendue) < 0.5) return;
    p.setPen(dessin.stylo(cle, 2.0));
    p.setBrush(null);
    p.drawArc(new Rect(cx - rayon, cy - rayon, 2 * rayon, 2 * rayon), Math.trunc(depart * 16), Math.trunc(etendue * 16));
    const m = ((depart + etendue / 2) * Math.PI) / 180;
    dessin.texte(p, cx + (rayon + 14) * Math.cos(m), cy - (rayon + 14) * Math.sin(m), nom, cle);
  }
}
