/**
 * La limite de Roche : un satellite fait de grains descend vers sa planète, se disloque sous la limite et s'étale en
 * anneau ; gros plan sur la marée, étirement rapporté à la gravité propre.  Jumeau de `animations/roche.py` de Coupole
 * (calculs : `calc/roche.ts`).
 */
import * as ro from '../../calc/roche';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, type Rect } from '../../noyau/peintre';
import { Animation, type Choix, type Coche, nombre, type Reglage } from '../base';

const VITESSE = (2.0 * Math.PI * 3.0 ** 1.5) / 2.0;
const DESCENTE = 0.25;
const D_MIN = 1.05;

export class Roche extends Animation {
  static override ID = 'roche';
  static override LECTURE_AU_DEPART = true;

  systeme!: Choix;
  rapport!: Reglage;
  d0!: Reglage;
  modele!: Choix;
  c_descente!: Coche;
  gs: [number, number][] = [];
  d = 0.0;
  theta = 0.0;
  t = 0.0;
  debris: ro.Elements[] | null = null;
  t_rupture = 0.0;
  tombes = new Set<number>();
  private sys: unknown = 'saturne_glace';
  private depart: string | null = null;

  override construire(): void {
    this.systeme = this.choix('systeme', ro.SYSTEMES.map(([k]) => ['anim_roche_s_' + k, k] as [string, string]), 'saturne_glace');
    this.rapport = this.curseur('rapport', 0.2, 5.0, 687.0 / 920.0, { dec: 3, log: true });
    this.d0 = this.curseur('d0', 1.2, 10.0, 3.08, { dec: 2 });
    this.modele = this.choix('modele', [['anim_roche_m_fluide', 'fluide'], ['anim_roche_m_rigide', 'rigide']], 'fluide');
    this.c_descente = this.coche('descente', true);
    this.bouton('anim_roche_relancer', () => this.recommencer());
    this.gs = ro.grains();
    this.sys = this.systeme.currentData();
    this.depart = null;
    this.recommencer();
  }

  private cle_depart(): string {
    return [this.d0.value(), this.rapport.value(), this.modele.currentData()].join('|');
  }

  recommencer(): void {
    this.d = this.d0.value();
    this.theta = 0.0;
    this.t = 0.0;
    this.debris = null;
    this.t_rupture = 0.0;
    this.tombes = new Set();
    this.depart = this.cle_depart();
    this.rafraichir();
  }

  override reglage_change(): void {
    if (this.systeme) {
      const k = this.systeme.currentData();
      if (k !== this.sys) {
        this.sys = k;
        for (const [cle, rm, rs_, , d0] of ro.SYSTEMES) {
          if (cle === k) {
            this.rapport.setValue(rm / rs_);
            this.d0.setValue(d0);
          }
        }
      }
    }
    if (this.depart !== null && this.depart !== this.cle_depart()) this.recommencer();
    super.reglage_change();
  }

  limite(): number {
    return ro.limite(this.rapport.value(), String(this.modele.currentData()));
  }

  etire(): number {
    return this.modele.currentData() !== 'fluide' ? 0.0 : ro.allongement(this.rapport.value(), this.d);
  }

  override avancer(dt: number): void {
    const dts = dt * VITESSE;
    this.t += dts;
    if (this.debris === null) {
      this.theta = (this.theta + dts * this.d ** -1.5) % (2.0 * Math.PI);
      if (this.c_descente.isChecked()) this.d = Math.max(D_MIN, this.d - dt * DESCENTE);
      if (this.d < this.limite()) {
        this.debris = ro.liberer(this.d, this.theta, this.gs, this.etire());
        this.t_rupture = this.t;
      }
    } else {
      this.debris.forEach((el, i) => {
        if (this.tombes.has(i) || el === null) return;
        const [x, y] = ro.position_kepler(el, this.t - this.t_rupture);
        if (x * x + y * y < 1.0) this.tombes.add(i);
      });
    }
  }

  positions(): [number, number][] {
    if (this.debris === null) return this.gs.map((g) => ro.position_intact(this.d, this.theta, g, this.etire()));
    const out: [number, number][] = [];
    this.debris.forEach((el, i) => {
      if (el !== null && !this.tombes.has(i)) out.push(ro.position_kepler(el, this.t - this.t_rupture));
    });
    return out;
  }

  override valeurs(): [string, string][] {
    const r = this.rapport.value();
    const R_km = ro.SYSTEMES.find(([k]) => k === this.systeme.currentData())![3];
    const lf = ro.limite(r, 'fluide'),
      lr = ro.limite(r, 'rigide');
    return [
      [tr('anim_roche_v_fluide'), tr('anim_roche_r_km', { r: nombre(lf, 2), km: nombre(lf * R_km, 0) })],
      [tr('anim_roche_v_rigide'), tr('anim_roche_r_km', { r: nombre(lr, 2), km: nombre(lr * R_km, 0) })],
      [tr('anim_roche_v_d'), tr('anim_roche_r_km', { r: nombre(this.d, 2), km: nombre(this.d * R_km, 0) })],
      [tr('anim_roche_v_etirement'), nombre(ro.etirement(r, this.d), 3)],
      [tr('anim_roche_v_allongement'), `${nombre(100.0 * ro.allongement(r, this.d), 1)} %`],
      [tr('anim_roche_v_etat'), this.debris === null ? tr('anim_roche_intact') : tr('anim_roche_disloque', { n: this.positions().length, m: this.gs.length })],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones_principale(rect, 2, 0.56);
    this.vue_ensemble(p, dessin.cadre(p, z[0]!, tr('anim_roche_t_vue')));
    this.gros_plan(p, dessin.cadre(p, z[1]!, tr('anim_roche_t_gros_plan')));
    this.graphe(p, dessin.cadre(p, z[2]!, tr('anim_roche_t_graphe')));
  }

  private vue_ensemble(p: Peintre, r: Rect): void {
    const demi = Math.max(this.d0.value(), ro.limite(this.rapport.value(), 'fluide')) * 1.12 + ro.R_SATELLITE;
    const cote = Math.min(r.w, r.h - 6);
    const k = cote / (2.0 * demi);
    const cx = r.cx,
      cy = r.cy + 4;
    p.save();
    p.setClipRect(r);
    p.setBrush(null);
    for (const [mod, cle] of [['fluide', 'accent3'], ['rigide', 'accent2']] as [string, string][]) {
      const lim = ro.limite(this.rapport.value(), mod);
      p.setPen(dessin.stylo(cle, 1.2, 0.8, true));
      p.drawEllipse(cx, cy, lim * k, lim * k);
    }
    const couleur = ({ terre_lune: 'terre', mars_phobos: 'mars' } as Record<string, string>)[String(this.systeme.currentData())] ?? 'ecliptique';
    dessin.disque(p, cx, cy, k, couleur);
    for (const [x, y] of this.positions()) dessin.disque(p, cx + k * x, cy - k * y, Math.max(1.5, 0.018 * k), 'lune');
    p.restore();
    dessin.texte(p, r.left + 6, r.bottom - 10, tr('anim_roche_legende_vue'), 'doux', { centre: false, fond: true });
  }

  private gros_plan(p: Peintre, r: Rect): void {
    const cx = r.cx,
      cy = r.cy + 6;
    const R = 0.3 * Math.min(r.w, r.h);
    if (this.debris !== null) {
      dessin.texte(p, cx, cy, tr('anim_roche_plus_de_satellite'), 'doux');
      return;
    }
    const et = this.etire();
    p.save();
    for (const g of this.gs) {
      const x = g[0] * (1.0 + et),
        y = g[1] / Math.sqrt(1.0 + et);
      dessin.disque(p, cx + R * x, cy - R * y, Math.max(1.5, 0.07 * R), 'lune');
    }
    const f = ro.etirement(this.rapport.value(), this.d) / 3.0;
    const L = 0.9 * R * Math.min(1.0, 3.0 * f);
    for (let ang = 0; ang < 360; ang += 45) {
      const a = (ang * Math.PI) / 180;
      const x = Math.cos(a),
        y = Math.sin(a);
      const fx = 2.0 * x,
        fy = -y;
      const x0 = cx + 1.15 * R * x,
        y0 = cy - 1.15 * R * y;
      dessin.fleche(p, x0, y0, x0 + (L * fx) / 2.0, y0 - (L * fy) / 2.0, dessin.stylo('accent3', 1.8), 6.0);
    }
    p.restore();
    dessin.texte(p, r.left + 6, r.bottom - 10, tr('anim_roche_legende_gros_plan'), 'doux', { centre: false, fond: true });
  }

  private graphe(p: Peintre, r: Rect): void {
    const ax = new Axes(r, 1.0, 10.0, 0.001, 10.0, true, true, [44, 8, 10, 30]).avec(p);
    ax.fond(p, { titre_x: tr('anim_roche_axe_d'), titre_y: tr('anim_roche_axe_rapport') });
    const rp = this.rapport.value();
    const pts: [number, number][] = [];
    for (let j = 0; j <= 100; j++) pts.push([10.0 ** (j / 100.0), ro.etirement(rp, 10.0 ** (j / 100.0))]);
    ax.courbe(pts, 'accent2', 1.8);
    ax.horizontale(1.0, 'doux', 1.0, true);
    ax.verticale(ro.limite(rp, 'rigide'), 'accent2', 1.0, true, tr('anim_roche_rigide_court'));
    ax.verticale(ro.limite(rp, 'fluide'), 'accent3', 1.0, true, tr('anim_roche_fluide_court'));
    if (this.debris === null) dessin.disque(p, ax.px(this.d), ax.py(ro.etirement(rp, this.d)), 5.0, 'accent3', 'texte');
  }
}
