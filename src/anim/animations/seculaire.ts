/**
 * Précession séculaire d'une orbite qui croise celle de la Terre : sous l'effet des planètes géantes, la ligne des
 * apsides d'un géocroiseur avance et sa ligne des nœuds recule ; ses nœuds passent tour à tour sur l'orbite terrestre.
 * Jumeau de `animations/seculaire.py` de Coupole (calculs : `calc/seculaire.ts`).
 */
import * as sc from '../../calc/seculaire';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, type Rect } from '../../noyau/peintre';
import { degrees, pround, radians } from '../../noyau/py';
import { Animation, angle, type Choix, nombre, type Reglage } from '../base';
import { an } from './precession';

const DUREE_TOUR_OMEGA_S = 30.0;
const SEUIL_PHA = 0.05;

export class Seculaire extends Animation {
  static override ID = 'secularprecession';
  static override LECTURE_AU_DEPART = true;

  objet!: Choix;
  a!: Reglage;
  e!: Reglage;
  i!: Reglage;
  o0!: Reglage;
  w0!: Reglage;
  t = 0.0;
  private objet_: unknown = 'apollo';
  private table_: [string, number[]] | null = null;

  override construire(): void {
    this.objet = this.choix('objet', sc.OBJETS.map(([k]) => ['anim_secularprecession_o_' + k, k] as [string, string]), 'apollo');
    this.a = this.curseur('a', 0.6, 3.0, 1.47, { dec: 2, unite: 'ua' });
    this.e = this.curseur('e', 0.0, 0.95, 0.56, { dec: 3 });
    this.i = this.curseur('i', 0.0, 40.0, 6.35, { dec: 2, unite: '°' });
    this.o0 = this.curseur('o0', 0.0, 360.0, 35.5, { dec: 1, unite: '°' });
    this.w0 = this.curseur('w0', 0.0, 360.0, 286.0, { dec: 1, unite: '°' });
    this.bouton('anim_secularprecession_aujourdhui', () => this.aujourdhui());
    this.bouton('anim_secularprecession_suivant', () => this.suivant());
    this.objet_ = this.objet.currentData();
    this.table_ = null;
    this.t = 0.0;
  }

  aujourdhui(): void {
    this.t = 0.0;
    this.rafraichir();
  }

  suivant(): void {
    const A = this.freq();
    const c = sc.croisements(this.a.value(), this.e.value(), this.w0.value(), A, this.t + 1e-6, this.t + Math.PI / A + 1.0);
    if (c.length) this.t = c[0]![0];
    this.rafraichir();
  }

  override reglage_change(): void {
    if (this.objet && this.w0) {
      const k = this.objet.currentData();
      if (k !== this.objet_) {
        this.objet_ = k;
        for (const [cle, a, e, i, o, w] of sc.OBJETS) {
          if (cle === k) {
            for (const [r, v] of [[this.a, a], [this.e, e], [this.i, i], [this.o0, o], [this.w0, w]] as [Reglage, number][]) r.setValue(v);
          }
        }
        this.t = 0.0;
      }
    }
    super.reglage_change();
  }

  freq(): number {
    return sc.frequence(this.a.value());
  }

  periode(): number {
    return (2.0 * Math.PI) / this.freq();
  }

  override avancer(dt: number): void {
    this.t = (this.t + (dt * this.periode()) / 2.0 / DUREE_TOUR_OMEGA_S) % this.periode();
  }

  etat(): [number, number, number] {
    return sc.angles(this.w0.value(), this.o0.value(), this.freq(), this.t);
  }

  table(): number[] {
    const cle = [this.a.value(), this.e.value(), this.i.value()].join('|');
    if (this.table_ === null || this.table_[0] !== cle) this.table_ = [cle, sc.table_moid(this.a.value(), this.e.value(), this.i.value())];
    return this.table_[1];
  }

  override valeurs(): [string, string][] {
    const a = this.a.value(),
      e = this.e.value(),
      i = this.i.value();
    const A = this.freq();
    const [w, o] = this.etat();
    const [ra, rd] = sc.noeuds(a, e, w);
    const c = sc.croisements(a, e, this.w0.value(), A, this.t, this.t + Math.PI / A + 1.0);
    const prochain = c.length
      ? tr('anim_secularprecession_prochain', { an: an(pround(sc.AN_DEPART + c[0]![0])), noeud: tr('anim_secularprecession_n_' + c[0]![1]) })
      : tr('anim_secularprecession_jamais');
    return [
      [tr('anim_secularprecession_v_date'), tr('anim_secularprecession_an', { an: an(pround(sc.AN_DEPART + this.t)) })],
      [tr('anim_secularprecession_v_vitesse'), tr('anim_secularprecession_sec_an', { x: nombre(A * sc.SEC_PAR_RAD, 2) })],
      [tr('anim_secularprecession_v_tour'), tr('anim_secularprecession_ans', { n: nombre((2.0 * Math.PI) / A, 0) })],
      [tr('anim_secularprecession_v_tour_w'), tr('anim_secularprecession_ans', { n: nombre(Math.PI / A, 0) })],
      [tr('anim_secularprecession_v_angles'), tr('anim_secularprecession_deux', { a: angle(w, 1), b: angle(o, 1) })],
      [tr('anim_secularprecession_v_noeuds'), tr('anim_secularprecession_ua', { x: tr('anim_secularprecession_deux', { a: nombre(ra, 3), b: nombre(rd, 3) }) })],
      [tr('anim_secularprecession_v_moid'), tr('anim_secularprecession_ua', { x: nombre(sc.moid(a, e, i, w), 4) })],
      [tr('anim_secularprecession_v_prochain'), prochain],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones_principale(rect, 2, 0.52);
    this.vue_dessus(p, dessin.cadre(p, z[0]!, tr('anim_secularprecession_t_vue')));
    this.graphe_noeuds(p, dessin.cadre(p, z[1]!, tr('anim_secularprecession_t_noeuds')));
    this.graphe_moid(p, dessin.cadre(p, z[2]!, tr('anim_secularprecession_t_moid')));
  }

  private vue_dessus(p: Peintre, r: Rect): void {
    const a = this.a.value(),
      e = this.e.value(),
      i = this.i.value();
    const [w, o, varpi] = this.etat();
    const demi = Math.max(1.7, Math.min(a * (1.0 + e), 4.0)) * 1.08;
    const k = Math.min(r.w, r.h - 8) / (2.0 * demi);
    const cx = r.cx,
      cy = r.cy + 4;
    p.save();
    p.setClipRect(r);
    p.setBrush(null);
    p.setPen(dessin.stylo('terre', 1.6));
    p.drawEllipse(cx, cy, k, k);
    p.setPen(dessin.stylo('mars', 1.0, 0.6, true));
    p.drawEllipse(cx, cy, 1.524 * k, 1.524 * k);
    const pts = sc.orbite(a, e, i, o, w);
    for (let j = 0; j < pts.length - 1; j++) {
      const [x0, y0, z0] = pts[j]!;
      const [x1, y1] = pts[j + 1]!;
      p.setPen(z0 >= 0.0 ? dessin.stylo('accent1', 2.0) : dessin.stylo('accent1', 1.4, 0.7, true));
      p.drawLine(cx + k * x0, cy - k * y0, cx + k * x1, cy - k * y1);
    }
    const [ra, rd] = sc.noeuds(a, e, w);
    const orad = radians(o);
    const xa = ra * Math.cos(orad),
      ya = ra * Math.sin(orad);
    const xd = -rd * Math.cos(orad),
      yd = -rd * Math.sin(orad);
    p.setPen(dessin.stylo('doux', 1.0, 0.8, true));
    p.drawLine(cx + k * xa, cy - k * ya, cx + k * xd, cy - k * yd);
    dessin.disque(p, cx + k * xa, cy - k * ya, 5.0, 'accent2', 'texte');
    dessin.disque(p, cx + k * xd, cy - k * yd, 5.0, 'accent3', 'texte');
    dessin.etiquette(p, cx + k * xa, cy - k * ya, '☊');
    dessin.etiquette(p, cx + k * xd, cy - k * yd, '☋');
    const q = a * (1.0 - e);
    const vr = radians(varpi);
    dessin.fleche(p, cx, cy, cx + k * q * Math.cos(vr), cy - k * q * Math.sin(vr), dessin.stylo('accent1', 1.4), 6.0);
    dessin.disque(p, cx, cy, 6.0, 'soleil');
    p.restore();
    dessin.texte(p, r.left + 6, r.bottom - 10, tr('anim_secularprecession_legende_vue'), 'doux', { centre: false, fond: true });
  }

  private axe_t(r: Rect, y0: number, y1: number): Axes {
    return new Axes(r, 0.0, this.periode() / 1000.0, y0, y1, false, false, [44, 8, 10, 30]);
  }

  private graphe_noeuds(p: Peintre, r: Rect): void {
    const a = this.a.value(),
      e = this.e.value();
    const A = this.freq();
    const ymax = Math.min(4.0, a * (1.0 + e)) * 1.05;
    const ax = this.axe_t(r, 0.0, ymax).avec(p);
    ax.fond(p, { titre_x: tr('anim_secularprecession_axe_t'), titre_y: tr('anim_secularprecession_axe_r') });
    const T = this.periode();
    for (const [genre, cle] of [['asc', 'accent2'], ['desc', 'accent3']] as [string, string][]) {
      const pts: [number, number][] = [];
      for (let j = 0; j <= 200; j++) {
        const t = (T * j) / 200.0;
        const w = (this.w0.value() + 2.0 * degrees(A * t)) % 360.0;
        const [ra, rd] = sc.noeuds(a, e, w);
        pts.push([t / 1000.0, Math.min(genre === 'asc' ? ra : rd, ymax)]);
      }
      ax.courbe(pts, cle, 1.6);
    }
    ax.horizontale(1.0, 'terre', 1.4, false, tr('anim_secularprecession_terre'));
    for (const [t, genre] of sc.croisements(a, e, this.w0.value(), A, 0.0, T)) {
      dessin.disque(p, ax.px(t / 1000.0), ax.py(1.0), 3.5, genre === 'asc' ? 'accent2' : 'accent3');
    }
    ax.verticale(this.t / 1000.0, 'texte', 1.2, false);
  }

  private graphe_moid(p: Peintre, r: Rect): void {
    const tb = this.table();
    const ymax = Math.max(Math.max(...tb) * 1.08, 2.0 * SEUIL_PHA);
    const ax = this.axe_t(r, 0.0, ymax).avec(p);
    ax.fond(p, { titre_x: tr('anim_secularprecession_axe_t'), titre_y: tr('anim_secularprecession_axe_moid') });
    const n = tb.length - 1;
    const T = this.periode();
    const A = this.freq();
    const pts: [number, number][] = [];
    for (let j = 0; j <= 200; j++) {
      const t = (T * j) / 200.0;
      const w = (this.w0.value() + 2.0 * degrees(A * t)) % 360.0;
      const x = (w / 360.0) * n;
      const k0 = Math.min(Math.trunc(x), n - 1);
      const f = x - k0;
      pts.push([t / 1000.0, tb[k0]! * (1.0 - f) + tb[k0 + 1]! * f]);
    }
    ax.remplir(pts, 'accent1', 0.25, 0.0);
    ax.courbe(pts, 'accent1', 1.6);
    ax.horizontale(SEUIL_PHA, 'accent3', 1.0, true, tr('anim_secularprecession_pha'));
    ax.verticale(this.t / 1000.0, 'texte', 1.2, false);
  }
}
