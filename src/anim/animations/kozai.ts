/**
 * Le mécanisme de Kozai-Lidov : un perturbateur lointain échange l'excentricité et l'inclinaison d'une orbite
 * (C = √(1 − e²) cos i conservé).  Jumeau de `animations/kozai.py` de Coupole (calculs : `calc/kozai.ts`).
 */
import * as kz from '../../calc/kozai';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, type Rect } from '../../noyau/peintre';
import { Animation, angle, type Choix, type Coche, nombre, type Reglage } from '../base';

const VITESSE_TK = 2.0;
const FENETRE = 40.0;
const N_HISTOIRE = 4000;

export function annees(x: number): string {
  if (x >= 1e6) return tr('anim_kozai_millions_ans', { x: nombre(x / 1e6, 2) });
  return tr('anim_kozai_ans', { x: nombre(x, x >= 100 ? 0 : 1) });
}

type V3 = kz.V3;
const norme = (v: readonly number[]): number => Math.hypot(v[0]!, v[1]!, v[2]!);
const fois = (v: readonly number[], f: number): V3 => [v[0]! * f, v[1]! * f, v[2]! * f];
const croix = (a: readonly number[], b: readonly number[]): V3 => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];

export class Kozai extends Animation {
  static override ID = 'kozai';
  static override LECTURE_AU_DEPART = true;

  systeme!: Choix;
  i0!: Reglage;
  e0!: Reglage;
  w0!: Reglage;
  c_trace!: Coche;
  vue3d!: dessin.Vue3D;
  tau = 0.0;
  ev: V3 = [0, 0, 0];
  jv: V3 = [0, 0, 1];
  histoire: [number, number, number, number][] = [];
  e_max = 0.0;
  maxima: number[] = [];
  private s_prec: number | null = null;
  private cle: string | null = null;

  override construire(): void {
    this.systeme = this.choix('systeme', kz.SYSTEMES.map(([k]) => ['anim_kozai_s_' + k, k] as [string, string]), 'asteroide');
    this.i0 = this.curseur('i0', 0.0, 89.0, 65.0, { dec: 1, unite: '°' });
    this.e0 = this.curseur('e0', 0.001, 0.9, 0.05, { dec: 3, log: true });
    this.w0 = this.curseur('w0', 0.0, 360.0, 0.0, { dec: 0, unite: '°' });
    this.c_trace = this.coche('trace', true);
    this.bouton('anim_kozai_recommencer', () => this.recommencer());
    this.vue3d = this.vue(30.0, 25.0);
    this.cle = null;
    this.recommencer();
  }

  private cle_depart(): string {
    return [this.e0.value(), this.i0.value(), this.w0.value()].join('|');
  }

  recommencer(): void {
    this.tau = 0.0;
    [this.ev, this.jv] = kz.vecteurs(this.e0.value(), this.i0.value(), this.w0.value());
    const [e, i, w] = kz.elements(this.ev, this.jv);
    this.histoire = [[0.0, e, i, w]];
    this.e_max = e;
    this.maxima = [];
    this.s_prec = null;
    this.cle = this.cle_depart();
    this.rafraichir();
  }

  override reglage_change(): void {
    if (this.cle !== null && this.cle !== this.cle_depart()) this.recommencer();
    super.reglage_change();
  }

  override avancer(dt: number): void {
    const d = dt * VITESSE_TK;
    const tau0 = this.tau;
    [this.ev, this.jv] = kz.integrer(this.ev, this.jv, d);
    this.tau += d;
    const [e, i, w] = kz.elements(this.ev, this.jv);
    this.histoire.push([this.tau, e, i, w]);
    if (this.histoire.length > N_HISTOIRE) this.histoire.shift();
    this.e_max = Math.max(this.e_max, e);
    const [de] = kz.derivees(this.ev, this.jv);
    let s = 0;
    for (let k = 0; k < 3; k++) s += this.ev[k]! * de[k]!;
    if (this.s_prec !== null && this.s_prec > 0.0 && 0.0 >= s) this.maxima.push(tau0 + (d * this.s_prec) / (this.s_prec - s));
    this.s_prec = s;
  }

  t_k(): number {
    const [, m, ap, per] = kz.SYSTEMES.find(([k]) => k === this.systeme.currentData())!;
    return kz.t_kozai_ans(m, ap, per);
  }

  override valeurs(): [string, string][] {
    const [e, i, w] = kz.elements(this.ev, this.jv);
    const c = kz.constante_c(e, i);
    const tk = this.t_k();
    const out: [string, string][] = [
      [tr('anim_kozai_v_c'), tr('anim_kozai_c_conservee', { c: nombre(c, 4), c0: nombre(kz.constante_c(this.e0.value(), this.i0.value()), 4) })],
      [tr('anim_kozai_v_e'), nombre(e, 3)],
      [tr('anim_kozai_v_i'), angle(i, 1)],
      [tr('anim_kozai_v_w'), angle(w, 0)],
      [tr('anim_kozai_v_critique'), angle(kz.I_CRITIQUE, 2)],
    ];
    const em = kz.e_max_circulaire(this.i0.value());
    out.push([tr('anim_kozai_v_emax_prevue'), em > 0 ? nombre(em, 3) : tr('anim_kozai_sous_critique')]);
    out.push([tr('anim_kozai_v_emax'), tr('anim_kozai_emax_i', { e: nombre(this.e_max, 3), i: angle(kz.i_a_e(c, this.e_max), 1) })]);
    out.push([tr('anim_kozai_v_tk'), annees(tk)]);
    if (this.maxima.length >= 2) {
      const per = this.maxima[this.maxima.length - 1]! - this.maxima[this.maxima.length - 2]!;
      out.push([tr('anim_kozai_v_periode'), tr('anim_kozai_periode', { p: nombre(per, 2), a: annees(per * tk) })]);
    } else out.push([tr('anim_kozai_v_periode'), tr('anim_kozai_en_mesure')]);
    out.push([tr('anim_kozai_v_temps'), tr('anim_kozai_temps', { t: nombre(this.tau, 1), a: annees(this.tau * tk) })]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones_principale(rect, 2, 0.46);
    this.orbite(p, dessin.cadre(p, z[0]!, tr('anim_kozai_t_orbite')));
    this.temps(p, dessin.cadre(p, z[1]!, tr('anim_kozai_t_temps')));
    this.phase(p, dessin.cadre(p, z[2]!, tr('anim_kozai_t_phase')));
  }

  private orbite(p: Peintre, r: Rect): void {
    this.zone_rotative(r, this.vue3d);
    const rr = 0.42 * Math.min(r.w, r.h - 30);
    const pe = new dessin.Peintre3D(p, this.vue3d, r.cx, r.cy + 10, rr);
    pe.plan('equateur', 0.1, 1.0, 'equateur');
    pe.courbe(dessin.cercle([0, 0, 1]), 'ecliptique', 1.2, 0.8, { arriere: 'normal', profondeur: false });
    const ang = 0.6 * this.tau;
    pe.point([Math.cos(ang), Math.sin(ang), 0.0], 'arc2', 6.0, { etiquette: tr('anim_kozai_perturbateur'), toujours: true });
    const e = norme(this.ev);
    const g = norme(this.jv);
    const nh = fois(this.jv, 1 / g);
    let eh: V3;
    if (e > 1e-9) eh = fois(this.ev, 1 / e);
    else eh = Math.abs(nh[2]) < 0.999 ? croix(nh, [0, 0, 1]) : [1, 0, 0];
    eh = fois(eh, 1 / norme(eh));
    const qh = croix(nh, eh);
    const a = 0.55;
    const pts: V3[] = [];
    for (let k = 0; k <= 180; k++) {
      const nu = (2.0 * Math.PI * k) / 180;
      const rad = (a * (1.0 - e * e)) / (1.0 + e * Math.cos(nu));
      pts.push([0, 1, 2].map((c) => rad * (Math.cos(nu) * eh[c]! + Math.sin(nu) * qh[c]!)) as V3);
    }
    pe.courbe(pts, 'accent1', 2.2, 1.0, { arriere: 'pointille', profondeur: false });
    pe.point([0.0, 0.0, 0.0], 'soleil', 6.0, { toujours: true });
    if (e > 1e-3) {
      const per = fois(eh, a * (1.0 - e));
      pe.segment([0.0, 0.0, 0.0], per, 'accent3', 1.3, 0.9);
      pe.point(per, 'accent3', 3.5, { etiquette: tr('anim_kozai_periastre'), toujours: true });
    }
    pe.segment([0.0, 0.0, 0.0], fois(nh, 0.45), 'accent2', 1.6, 0.9);
    pe.etiquette(fois(nh, 0.5), tr('anim_kozai_normale'), 'accent2');
    pe.segment([0.0, 0.0, 0.0], [0.0, 0.0, 0.45], 'doux', 1.0, 0.7);
  }

  private temps(p: Peintre, r: Rect): void {
    const t1 = Math.max(FENETRE, this.tau);
    const t0 = t1 - FENETRE;
    const ax = new Axes(r, t0, t1, 0.0, 1.05, false, false, [40, 8, 10, 30]).avec(p);
    ax.fond(p, { titre_x: tr('anim_kozai_axe_t'), titre_y: tr('anim_kozai_axe_ei') });
    const em = kz.e_max_circulaire(this.i0.value());
    if (em > 0) ax.horizontale(em, 'accent1', 1.0);
    ax.horizontale(kz.I_CRITIQUE / 90.0, 'accent2', 1.0);
    const h = this.histoire.filter((x) => x[0] >= t0);
    if (h.length >= 2) {
      ax.courbe(h.map(([t, e]) => [t, e] as [number, number]), 'accent1', 2.0);
      ax.courbe(h.map(([t, , i]) => [t, i / 90.0] as [number, number]), 'accent2', 2.0);
    }
    dessin.texte(p, ax.r.left + 6, ax.r.top + 10, tr('anim_kozai_legende_temps'), 'doux', { centre: false, fond: true });
  }

  private phase(p: Peintre, r: Rect): void {
    const ax = new Axes(r, 0.0, 360.0, 0.0, 1.05, false, false, [40, 8, 10, 30]).avec(p);
    ax.fond(p, { titre_x: tr('anim_kozai_axe_w'), titre_y: tr('anim_kozai_axe_e'), fmt_x: (x) => nombre(x, 0) });
    const [e, i, w] = kz.elements(this.ev, this.jv);
    const c = kz.constante_c(e, i);
    const lim = Math.sqrt(Math.max(0.0, 1.0 - c * c));
    ax.horizontale(lim, 'doux', 1.0);
    dessin.texte(p, ax.px(180.0), ax.py(lim) - 8, tr('anim_kozai_limite'), 'doux', { fond: true });
    if (this.c_trace.isChecked()) ax.points(this.histoire.map((x) => [x[3], x[1]] as [number, number]), 'accent3', 1.3, 0.6);
    dessin.disque(p, ax.px(w), ax.py(e), 4.5, 'accent1', 'texte');
  }
}
