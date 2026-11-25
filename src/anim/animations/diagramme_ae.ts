/**
 * Le diagramme demi-grand axe – excentricité : familles de géocroiseurs, ceinture, lacunes de Kirkwood, petits corps
 * réels, orbite vue de dessus, paramètre de Tisserand.  Jumeau de `animations/diagramme_ae.py` de Coupole (calculs :
 * `calc/diagramme_ae.ts`).
 */
import * as ae from '../../calc/diagramme_ae';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, Pt, type Rect } from '../../noyau/peintre';
import { Animation, type Bouton_souris, type Choix, type Coche, nombre, type Reglage } from '../base';

const A_MIN = 0.3,
  A_MAX = 100.0;
const SECONDES_PAR_ORBITE = 6.0;

export function ua(x: number): string {
  return `${nombre(x, x < 10 ? 3 : x < 1000 ? 1 : 0)} ua`;
}

export class DiagrammeAE extends Animation {
  static override ID = 'aediagram';
  static override LECTURE_AU_DEPART = true;

  objet!: Choix;
  a!: Reglage;
  e!: Reglage;
  i!: Reglage;
  c_familles!: Coche;
  c_kirkwood!: Coche;
  c_objets!: Coche;
  m = 0.0;
  private applique: unknown = 'ceres';
  graphe: Axes | null = null;

  override construire(): void {
    this.objet = this.choix('objet', [['anim_aediagram_o_libre', 'libre'], ...ae.OBJETS.map(([k]) => ['anim_aediagram_o_' + k, k] as [string, string])], 'ceres');
    this.a = this.curseur('a', A_MIN, A_MAX, 2.77, { dec: 3, unite: 'ua', log: true });
    this.e = this.curseur('e', 0.0, 0.99, 0.0797, { dec: 3 });
    this.i = this.curseur('i', 0.0, 180.0, 10.6, { dec: 1, unite: '°' });
    this.c_familles = this.coche('familles', true);
    this.c_kirkwood = this.coche('kirkwood', true);
    this.c_objets = this.coche('objets', true);
    this.m = 0.0;
    this.applique = this.objet.currentData();
  }

  override reglage_change(): void {
    const k = this.objet?.currentData();
    if (this.objet && k !== this.applique) {
      this.applique = k;
      for (const [cle, a, e, i] of ae.OBJETS) {
        if (cle === k) {
          this.a.setValue(a);
          this.e.setValue(e);
          this.i.setValue(i);
        }
      }
    }
    super.reglage_change();
  }

  override avancer(dt: number): void {
    this.m = (this.m + (2.0 * Math.PI * dt) / SECONDES_PAR_ORBITE) % (2.0 * Math.PI);
  }

  override presser(pos: Pt, _b: Bouton_souris): boolean {
    if (this.graphe !== null && this.graphe.r.contains(pos)) {
      this._glisse = (q) => this.tirer(q);
      this.tirer(pos);
      return true;
    }
    return false;
  }

  private tirer(pos: Pt): void {
    const ax = this.graphe!;
    const a = ax.x_de_px(Math.max(ax.r.left, Math.min(ax.r.right, pos.x)));
    const e = ax.y_de_px(Math.max(ax.r.top, Math.min(ax.r.bottom, pos.y)));
    this.objet.setCurrentIndex(this.objet.findData('libre'));
    this.a.setValue(Math.min(A_MAX, Math.max(A_MIN, a)));
    this.e.setValue(Math.min(0.99, Math.max(0.0, e)));
  }

  override valeurs(): [string, string][] {
    const a = this.a.value(),
      e = this.e.value();
    const t = ae.tisserand(a, e, this.i.value());
    const cr = ae.croisees(a, e);
    const p = ae.periode(a);
    return [
      [tr('anim_aediagram_v_q'), ua(ae.perihelie(a, e))],
      [tr('anim_aediagram_v_Q'), ua(ae.aphelie(a, e))],
      [tr('anim_aediagram_v_p'), tr('anim_aediagram_ans', { n: nombre(p, p < 10 ? 2 : p < 1000 ? 1 : 0) })],
      [tr('anim_aediagram_v_famille'), tr('anim_aediagram_f_' + ae.famille(a, e))],
      [tr('anim_aediagram_v_croise'), cr.length ? cr.map((k) => tr('anim_aediagram_p_' + k)).join(', ') : tr('anim_aediagram_aucune')],
      [tr('anim_aediagram_v_tisserand'), `${nombre(t, 2)} : ${tr('anim_aediagram_t_' + ae.genre_tisserand(t))}`],
      [tr('anim_aediagram_v_distance'), ua(ae.distance_soleil(a, e, this.m))],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = rect.w > rect.h * 1.1 ? dessin.zones_principale(rect, 1, 0.6) : dessin.zones(rect, 2, 10);
    this.diagramme(p, dessin.cadre(p, z[0]!, tr('anim_aediagram_t_diagramme')));
    this.orbite(p, dessin.cadre(p, z[1]!, tr('anim_aediagram_t_orbite')));
  }

  private diagramme(p: Peintre, r: Rect): void {
    const ax = new Axes(r, A_MIN, A_MAX, 0.0, 1.0, true, false, [40, 8, 10, 30]).avec(p);
    this.graphe = ax;
    ax.fond(p, { titre_x: tr('anim_aediagram_axe_a'), titre_y: tr('anim_aediagram_axe_e') });
    const n = 240;
    if (this.c_kirkwood.isChecked()) {
      for (const [pp, qq] of ae.LACUNES) ax.verticale(ae.resonance(pp, qq), 'accent3', 1.0, true);
      for (const [pp, qq] of ae.GROUPES) ax.verticale(ae.resonance(pp, qq), 'accent2', 1.0, true);
      for (const [pq, rang, cle] of [[[3, 1], 0, 'accent3'], [[2, 1], 0, 'accent3'], [[3, 2], 1, 'accent2'], [[1, 1], 1, 'accent2']] as [[number, number], number, string][]) {
        dessin.texte(p, ax.px(ae.resonance(pq[0], pq[1])), ax.r.top + 9 + 14 * rang, `${pq[0]}:${pq[1]}`, cle);
      }
    }
    if (this.c_familles.isChecked()) {
      for (const [q, cle] of [[ae.Q_APOLLO, 'accent1'], [ae.Q_GEOCROISEUR, 'accent1'], [ae.Q_MARS, 'doux']] as [number, string][]) {
        const pts: [number, number][] = [];
        for (let j = 0; j <= n; j++) {
          const a = q * (A_MAX / q) ** (j / n);
          pts.push([a, 1.0 - q / a]);
        }
        ax.courbe(pts, cle, 1.2);
      }
      const pts: [number, number][] = [];
      for (let j = 0; j <= n; j++) {
        const a = ae.Q_ATIRA / 2.0 + ((1.0 - ae.Q_ATIRA / 2.0) * j) / n;
        pts.push([a, ae.Q_ATIRA / a - 1.0]);
      }
      ax.courbe(pts, 'accent1', 1.2, 1.0, true);
      ax.verticale(1.0, 'accent1', 1.0, true);
      for (const [cle, a, e] of [['atira', 0.5, 0.06], ['aten', 0.72, 0.62], ['apollo', 2.2, 0.82], ['amor', 3.3, 0.66], ['ceinture', 2.75, 0.025], ['troyen', 5.3, 0.17], ['centaure', 14.0, 0.17], ['transneptunien', 55.0, 0.12]] as [string, number, number][]) {
        dessin.texte(p, ax.px(a), ax.py(e), tr('anim_aediagram_l_' + cle), 'doux', { fond: true });
      }
    }
    if (this.c_objets.isChecked()) for (const [, a, e] of ae.OBJETS) dessin.disque(p, ax.px(a), ax.py(e), 2.6, 'accent2');
    for (const [k, a, e] of ae.PLANETES) {
      dessin.disque(p, ax.px(a), ax.py(e), 3.6, k === 'terre' ? 'terre' : 'doux');
      dessin.texte(p, ax.px(a), ax.py(e) - 10, [...tr('anim_aediagram_p_' + k)].slice(0, 2).join(''), 'doux');
    }
    const q = new Pt(ax.px(this.a.value()), ax.py(this.e.value()));
    dessin.disque(p, q.x, q.y, 5.5, 'accent3', 'texte');
    const k = this.objet.currentData();
    if (k !== 'libre') dessin.etiquette(p, q.x, q.y, tr('anim_aediagram_o_' + String(k)), 'accent3');
  }

  private orbite(p: Peintre, r: Rect): void {
    const a = this.a.value(),
      e = this.e.value();
    const Q = ae.aphelie(a, e);
    const demi = Math.max(1.7, Q * 1.08);
    const cote = Math.min(r.w, r.h - 6);
    const k = cote / (2.0 * demi);
    const cx = Q < demi ? r.cx + 0.25 * k * a * e : r.cx;
    const cy = r.cy + 3;
    const pt = (x: number, y: number): Pt => new Pt(cx + k * x, cy - k * y);
    p.save();
    p.setClipRect(r);
    p.setBrush(null);
    for (const [kp, ap] of ae.PLANETES) {
      if (ap * k >= 2.0) {
        p.setPen(dessin.stylo(kp === 'terre' ? 'terre' : 'grille', kp === 'terre' ? 1.4 : 1.0, 0.9));
        p.drawEllipse(cx, cy, ap * k, ap * k);
        if (ap < demi) dessin.texte(p, cx, cy - ap * k - 7, tr('anim_aediagram_p_' + kp), 'doux');
      }
    }
    dessin.disque(p, cx, cy, 6.0, 'soleil');
    const b = a * Math.sqrt(1.0 - e * e);
    p.setPen(dessin.stylo('accent3', 1.8));
    p.setBrush(null);
    const c = pt(-a * e, 0.0);
    p.drawEllipse(c.x, c.y, a * k, b * k);
    const [x, y] = ae.position(a, e, this.m);
    const q = pt(x, y);
    dessin.disque(p, q.x, q.y, 4.5, 'accent3', 'texte');
    const qp = pt(ae.perihelie(a, e), 0.0);
    dessin.etiquette(p, qp.x, qp.y, 'q', 'accent3');
    p.restore();
    dessin.texte(p, r.left + 6, r.bottom - 10, tr('anim_aediagram_echelle', { d: ua(demi) }), 'doux', { centre: false, fond: true });
  }
}
