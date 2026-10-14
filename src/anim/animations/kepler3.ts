/**
 * Kepler's Third Law : la période d'une planète d'après son demi-grand axe, et réciproquement.  P² = a³ / M (P en
 * années, a en ua, M en masses solaires).  Graphique logarithmique : une droite de pente 3/2, où tombent les planètes.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, type Rect } from '../../noyau/peintre';
import { Animation, type Choix, nombre, type Reglage } from '../base';

const PLANETES: [string, number, number][] = [
  ['mercure', 0.387_098, 87.969], ['venus', 0.723_332, 224.701], ['terre', 1.000_001, 365.256], ['mars', 1.523_679, 686.98],
  ['jupiter', 5.2026, 4_332.589], ['saturne', 9.5549, 10_759.22], ['uranus', 19.2184, 30_685.4], ['neptune', 30.1104, 60_189.0], ['pluton', 39.48, 90_560.0],
];
const A_MIN = 0.01,
  A_MAX = 1000.0;

export class Kepler3 extends Animation {
  static override ID = 'keplers_third';
  static override ANIMEE = false;

  a!: Reglage;
  p!: Reglage;
  m!: Reglage;
  choix_planete!: Choix;
  private sync = false;

  override construire(): void {
    this.a = this.curseur('a', A_MIN, A_MAX, 1.0, { dec: 4, unite: 'ua', log: true, rafraichir: false });
    this.p = this.curseur('p', astro.periode_annees(A_MIN), astro.periode_annees(A_MAX), 1.0, { dec: 4, unite: tr('anim_u_annees'), log: true, rafraichir: false });
    this.m = this.curseur('masse', 0.1, 10.0, 1.0, { dec: 2, unite: 'M☉', log: true, rafraichir: false });
    this.choix_planete = this.choix('planete', [['anim_kepler_aucune', ''], ...PLANETES.map(([n]) => ['anim_planete_' + n, n] as [string, string])], '');
    this.choix_planete.activated.connect(() => this.planete());
    this.sync = false;
    this.a.valueChanged.connect(() => this.de_a());
    this.p.valueChanged.connect(() => this.de_p());
    this.m.valueChanged.connect(() => this.de_a());
    this.de_a();
  }

  private planete(): void {
    for (const [n, a] of PLANETES) if (n === this.choix_planete.currentData()) this.a.setValue(a);
  }

  private de_a(): void {
    if (this.sync) return;
    this.sync = true;
    this.p.setValue(astro.periode_annees(this.a.value(), this.m.value()));
    this.sync = false;
    this.rafraichir();
  }

  private de_p(): void {
    if (this.sync) return;
    this.sync = true;
    this.a.setValue(astro.demi_grand_axe(this.p.value(), this.m.value()));
    this.sync = false;
    this.rafraichir();
  }

  override reinitialiser(): void {
    super.reinitialiser();
    this.de_a();
  }

  override valeurs(): [string, string][] {
    const a = this.a.value(),
      m = this.m.value();
    const p = astro.periode_annees(a, m);
    return [
      [tr('anim_keplers_third_a'), `${nombre(a, 4)} ua`],
      [tr('anim_keplers_third_p'), `${nombre(p, 4)} ${tr('anim_u_annees')} (${nombre(p * astro.ANNEE_SIDERALE_J, 1)} ${tr('anim_u_jours')})`],
      [tr('anim_keplers_third_verif'), `P² = ${nombre(p * p, 4)} ; a³ / M = ${nombre(a ** 3 / m, 4)}`],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const x0 = rect.x + 54,
      x1 = rect.right - 14;
    const y0 = rect.y + 14,
      y1 = rect.bottom - 34;
    const la0 = Math.log10(A_MIN),
      la1 = Math.log10(A_MAX);
    const lp0 = Math.log10(astro.periode_annees(A_MIN) / 3.2),
      lp1 = Math.log10(astro.periode_annees(A_MAX) * 3.2);
    const xy = (a: number, per: number): Pt => new Pt(x0 + ((x1 - x0) * (Math.log10(a) - la0)) / (la1 - la0), y1 - ((y1 - y0) * (Math.log10(per) - lp0)) / (lp1 - lp0));
    p.setPen(dessin.stylo('grille', 1.0, 0.6));
    dessin.police(p, 0.75);
    for (let k = -2; k < 4; k++) {
      const q = xy(10.0 ** k, 1.0);
      p.drawLine(q.x, y0, q.x, y1);
      dessin.texte(p, q.x, y1 + 12, nombre(10.0 ** k, Math.max(0, -k)), 'doux');
    }
    for (let k = -3; k < 6; k++) {
      const q = xy(1.0, 10.0 ** k);
      if (y0 <= q.y && q.y <= y1) {
        p.drawLine(x0, q.y, x1, q.y);
        dessin.texte(p, x0 - 24, q.y, nombre(10.0 ** k, Math.max(0, -k)), 'doux');
      }
    }
    dessin.texte(p, (x0 + x1) / 2, y1 + 26, tr('anim_keplers_third_axe_a'), 'doux');
    dessin.texte(p, x0 + 4, y0 + 2, tr('anim_keplers_third_axe_p'), 'doux', { centre: false });
    dessin.police(p, 1 / 0.75);
    const m = this.m.value();
    p.setPen(dessin.stylo('accent2', 1.8));
    const pts: Pt[] = [];
    for (let i = 0; i <= 50; i++) {
      const a = 10 ** (la0 + ((la1 - la0) * i) / 50);
      pts.push(xy(a, astro.periode_annees(a, m)));
    }
    p.drawPolyline(pts);
    dessin.police(p, 0.8);
    for (const [n, a, pj] of PLANETES) {
      const q = xy(a, pj / astro.ANNEE_SIDERALE_J);
      dessin.disque(p, q.x, q.y, 4, n === this.choix_planete.currentData() ? 'soleil' : 'accent1');
      dessin.texte(p, q.x + 6, q.y + 11, tr('anim_planete_' + n), 'doux', { centre: false });
    }
    dessin.police(p, 1 / 0.8);
    const q = xy(this.a.value(), astro.periode_annees(this.a.value(), m));
    p.setPen(dessin.stylo('accent3', 1.0, 0.8, true));
    p.drawLine(q.x, y1, q.x, q.y);
    p.drawLine(x0, q.y, q.x, q.y);
    dessin.disque(p, q.x, q.y, 6, 'accent3', 'texte');
  }
}
