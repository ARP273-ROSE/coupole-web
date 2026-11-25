/**
 * Traînées de météoroïdes éjectés par une comète : un nuage de grains à chaque passage, étiré le long de l'orbite ;
 * diagramme (Δt, Δr) au nœud pour l'année en cours, activité année par année.  Jumeau de `animations/trainees.py` de
 * Coupole (calculs : `calc/trainees.ts`).
 */
import * as tn from '../../calc/trainees';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, Rect } from '../../noyau/peintre';
import { pmod, pround } from '../../noyau/py';
import { Animation, type Choix, date_du_jour, nombre, type Reglage } from '../base';
import { an } from './precession';

const DUREE_S = 40.0;
const COULEURS = ['accent2', 'accent1', 'accent3', 'arc1', 'arc2', 'meridien', 'ecliptique', 'equateur'];
const DT_MAX = 200.0;
const DR_MAX = 0.02;

function signe(x: number, dec: number): string {
  return (x > 0 ? '+' : '') + nombre(x, dec);
}

export class Trainees extends Animation {
  static override ID = 'meteoroidtrails';
  static override LECTURE_AU_DEPART = true;

  comete!: Choix;
  dv!: Reglage;
  taille!: Choix;
  cadrage!: Choix;
  t = 0.0;
  private essaim_: [string, tn.Essaim, Map<number, number>] | null = null;
  private ecarts_: [tn.Essaim, number, [number, number, number][]] | null = null;

  override construire(): void {
    this.comete = this.choix('comete', tn.COMETES.map((c) => ['anim_meteoroidtrails_c_' + c[0], c[0]] as [string, string]), 'tempel_tuttle');
    this.dv = this.curseur('dv', 1.0, 50.0, 10.0, { dec: 1, unite: 'm·s⁻¹', log: true });
    this.taille = this.choix('taille', tn.TAILLES.map(([k]) => ['anim_meteoroidtrails_t_' + k, k] as [string, string]), 'mm');
    this.cadrage = this.choix('cadrage', [['anim_meteoroidtrails_v_interieur', 'interieur'], ['anim_meteoroidtrails_v_orbite', 'orbite']], 'interieur');
    this.bouton('anim_meteoroidtrails_relancer', () => this.relancer());
    this.essaim_ = null;
    this.ecarts_ = null;
    this.t = tn.fenetre(String(this.comete.currentData()))[0];
  }

  relancer(): void {
    this.t = tn.fenetre(String(this.comete.currentData()))[0];
    this.rafraichir();
  }

  essaim(): [tn.Essaim, Map<number, number>] {
    const c = String(this.comete.currentData());
    const cle = [c, this.dv.value(), this.taille.currentData()].join('|');
    if (this.essaim_ === null || this.essaim_[0] !== cle) {
      const [a0, a1] = tn.fenetre(c);
      const e = new tn.Essaim(c, this.dv.value(), String(this.taille.currentData()), a0, a1);
      this.essaim_ = [cle, e, e.activite(a0, a1)];
      this.ecarts_ = null;
      if (!(a0 <= this.t && this.t <= a1 + 1.0)) this.t = a0;
    }
    return [this.essaim_[1], this.essaim_[2]];
  }

  annee(): number {
    return Math.floor(this.t);
  }

  ecarts(): [number, number, number][] {
    const [e] = this.essaim();
    const y = this.annee();
    if (this.ecarts_ === null || this.ecarts_[0] !== e || this.ecarts_[1] !== y) this.ecarts_ = [e, y, e.ecarts(y)];
    return this.ecarts_[2];
  }

  override avancer(dt: number): void {
    const [a0, a1] = tn.fenetre(String(this.comete.currentData()));
    const span = a1 + 1.0 - a0;
    this.t = a0 + pmod(this.t - a0 + (dt * span) / DUREE_S, span);
  }

  override valeurs(): [string, string][] {
    const [e, act] = this.essaim();
    const c = String(this.comete.currentData());
    const [r, lam] = tn.noeud(e.comete, e.genre);
    const tE = tn.date_terre(lam, this.annee());
    const jour = (tE - Math.floor(tE)) * 365.25;
    const lachees = e.ejections.filter((tk) => tk <= this.t).length;
    let ymax = 0,
      nmax = -1;
    for (const [y, n] of act) {
      if (n > nmax) {
        ymax = y;
        nmax = n;
      }
    }
    return [
      [tr('anim_meteoroidtrails_v_essaim'), tr('anim_meteoroidtrails_e_' + tn.comete(c)[7])],
      [tr('anim_meteoroidtrails_v_date'), an(this.annee())],
      [tr('anim_meteoroidtrails_v_periode'), tr('anim_meteoroidtrails_ans', { n: nombre(e.comete.periode(), 1) })],
      [tr('anim_meteoroidtrails_v_beta'), tr('anim_meteoroidtrails_beta', { x: nombre(e.beta * 1e4, 2) })],
      [tr('anim_meteoroidtrails_v_lachees'), String(lachees)],
      [tr('anim_meteoroidtrails_v_noeud'), tr('anim_meteoroidtrails_noeud', { r: nombre(r, 4), d: signe(r - tn.r_terre(lam), 4) })],
      [tr('anim_meteoroidtrails_v_terre'), date_du_jour(jour)],
      [tr('anim_meteoroidtrails_v_filet'), String(act.get(this.annee()) ?? 0)],
      [tr('anim_meteoroidtrails_v_max'), tr('anim_meteoroidtrails_max', { an: an(ymax), n: nmax })],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones_principale(rect, 2, 0.5);
    this.vue_dessus(p, dessin.cadre(p, z[0]!, tr('anim_meteoroidtrails_t_vue')));
    this.diagramme(p, dessin.cadre(p, z[1]!, tr('anim_meteoroidtrails_t_diagramme')));
    this.activite(p, dessin.cadre(p, z[2]!, tr('anim_meteoroidtrails_t_activite')));
  }

  private vue_dessus(p: Peintre, r: Rect): void {
    const [e] = this.essaim();
    const orb = e.comete;
    const interieur = this.cadrage.currentData() === 'interieur';
    const demi = interieur ? 2.0 : orb.a * (1.0 + orb.e) * 1.05;
    const k = Math.min(r.w, r.h - 8) / (2.0 * demi);
    const cx = r.cx,
      cy = r.cy + 4;
    p.save();
    p.setClipRect(r);
    p.setBrush(null);
    p.setPen(dessin.stylo('terre', 1.4));
    p.drawEllipse(cx, cy, k, k);
    const pts: [number, number, number][] = [];
    for (let j = 0; j <= 360; j++) pts.push(orb.position(orb.t0 + (orb.periode() * j) / 360.0));
    p.setPen(dessin.stylo('doux', 1.0, 0.8, true));
    for (let j = 0; j < 360; j++) p.drawLine(cx + k * pts[j]![0], cy - k * pts[j]![1], cx + k * pts[j + 1]![0], cy - k * pts[j + 1]![1]);
    const rayon = interieur ? 1.6 : 1.2;
    e.traines.forEach(([tk, grains], n) => {
      if (tk > this.t) return;
      p.setPen(null);
      p.setBrush(dessin.c(COULEURS[n % COULEURS.length]!, 0.85));
      for (const o of grains) {
        const [x, y] = o.position(this.t);
        if (Math.abs(x) < demi * 1.2 && Math.abs(y) < demi * 1.2) p.drawEllipse(cx + k * x, cy - k * y, rayon, rayon);
      }
    });
    const [xc, yc] = orb.position(this.t);
    dessin.disque(p, cx + k * xc, cy - k * yc, 4.0, 'etoile', 'texte');
    const [xe, ye] = tn.terre(this.t);
    dessin.disque(p, cx + k * xe, cy - k * ye, 5.0, 'terre', 'texte');
    dessin.disque(p, cx, cy, 6.0, 'soleil');
    p.restore();
    dessin.texte(p, r.left + 6, r.bottom - 10, tr('anim_meteoroidtrails_legende_vue'), 'doux', { centre: false, fond: true });
  }

  private diagramme(p: Peintre, r: Rect): void {
    const ax = new Axes(r, -DT_MAX, DT_MAX, -DR_MAX, DR_MAX, false, false, [52, 8, 10, 30]).avec(p);
    ax.fond(p, { titre_x: tr('anim_meteoroidtrails_axe_dt'), titre_y: tr('anim_meteoroidtrails_axe_dr') });
    p.save();
    p.setPen(dessin.stylo('accent3', 1.2, 0.9, true));
    p.setBrush(dessin.c('accent3', 0.12));
    const x0 = ax.px(-tn.EPS_T),
      x1 = ax.px(tn.EPS_T);
    const y0 = ax.py(tn.EPS_R),
      y1 = ax.py(-tn.EPS_R);
    p.drawRect(new Rect(x0, y0, x1 - x0, y1 - y0));
    p.setPen(null);
    for (const [dt, dr, n] of this.ecarts()) {
      if (Math.abs(dt) <= DT_MAX && Math.abs(dr) <= DR_MAX) {
        p.setBrush(dessin.c(COULEURS[n % COULEURS.length]!, 0.9));
        p.drawEllipse(ax.px(dt), ax.py(dr), 2.0, 2.0);
      }
    }
    p.restore();
    dessin.disque(p, ax.px(0.0), ax.py(0.0), 5.0, 'terre', 'texte');
    dessin.texte(p, ax.r.right - 30, ax.r.top + 12, an(this.annee()), 'texte', { fond: true });
  }

  private activite(p: Peintre, r: Rect): void {
    const [e, act] = this.essaim();
    const [a0, a1] = tn.fenetre(String(this.comete.currentData()));
    const vmax = Math.max(4, ...act.values());
    const ax = new Axes(r, a0, a1 + 1.0, 0.0, vmax * 1.1, false, false, [40, 8, 10, 30]).avec(p);
    ax.fond(p, { titre_x: tr('anim_meteoroidtrails_axe_an'), titre_y: tr('anim_meteoroidtrails_axe_n'), fmt_x: (v) => an(pround(v)) });
    p.save();
    p.setPen(null);
    p.setBrush(dessin.c('accent1', 0.9));
    const larg = Math.max(1.0, ax.px(a0 + 1.0) - ax.px(a0));
    for (const [y, n] of act) if (n) p.drawRect(new Rect(ax.px(y), ax.py(n), larg, ax.py(0.0) - ax.py(n)));
    p.restore();
    for (const tk of e.ejections) dessin.disque(p, ax.px(tk), ax.py(0.0), 3.0, 'etoile', 'texte');
    ax.verticale(this.t, 'texte', 1.2, false);
  }
}
