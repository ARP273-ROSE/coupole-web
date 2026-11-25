/**
 * Rotation synchrone et libration : la Lune vue de la Terre (formations repères), l'orbite vue de dessus avec le méridien
 * repère, la courbe de libration du mois.  Jumeau de `animations/libration.py` de Coupole (calculs : `calc/libration.ts`).
 */
import * as lb from '../../calc/libration';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, Pt, type Rect } from '../../noyau/peintre';
import { degrees } from '../../noyau/py';
import { Animation, angle, type Choix, type Coche, nombre, type Reglage } from '../base';

const JOURS_PAR_SECONDE = 3.0;

export class Libration extends Animation {
  static override ID = 'libration';
  static override LECTURE_AU_DEPART = true;

  e!: Reglage;
  i!: Reglage;
  varpi!: Reglage;
  rotation!: Choix;
  c_diurne!: Coche;
  c_grille!: Coche;
  jours = 0.0;
  private cache: [string, number, number] | null = null;

  override construire(): void {
    this.e = this.curseur('e', 0.0, 0.3, lb.E_LUNE, { dec: 4 });
    this.i = this.curseur('i', 0.0, 20.0, lb.I_LUNE, { dec: 2, unite: '°' });
    this.varpi = this.curseur('varpi', 0.0, 360.0, 90.0, { dec: 0, unite: '°' });
    this.rotation = this.choix('rotation', [['anim_libration_r_synchrone', 'synchrone'], ['anim_libration_r_aucune', 'aucune']], 'synchrone');
    this.c_diurne = this.coche('diurne', true);
    this.c_grille = this.coche('grille', true);
    this.jours = 0.0;
    this.cache = null;
  }

  override avancer(dt: number): void {
    this.jours = (this.jours + dt * JOURS_PAR_SECONDE) % lb.MOIS_SIDERAL_J;
  }

  m(): number {
    return (2.0 * Math.PI * this.jours) / lb.MOIS_SIDERAL_J;
  }

  synchrone(): boolean {
    return this.rotation.currentData() === 'synchrone';
  }

  lb_(): [number, number] {
    return lb.libration(this.m(), this.e.value(), this.i.value(), this.varpi.value(), this.synchrone());
  }

  fractions(): [number, number] {
    const rho = this.c_diurne.isChecked() ? lb.rho_diurne(this.e.value()) : 0.0;
    const cle = [this.e.value(), this.i.value(), this.varpi.value(), this.synchrone(), rho].join('|');
    if (this.cache === null || this.cache[0] !== cle) {
      this.cache = [
        cle,
        lb.fraction_mois(this.e.value(), this.i.value(), this.varpi.value(), this.synchrone(), rho),
        lb.fraction_annees(this.e.value(), this.i.value(), this.synchrone(), rho),
      ];
    }
    return [this.cache[1], this.cache[2]];
  }

  override valeurs(): [string, string][] {
    const [l, b] = this.lb_();
    const e = this.e.value();
    const [mois, annees] = this.fractions();
    const approx = degrees(2.0 * e * Math.sin(this.m()));
    const out: [string, string][] = [
      [tr('anim_libration_v_jour'), tr('anim_libration_jours', { n: nombre(this.jours, 1) })],
      [tr('anim_libration_v_l'), this.synchrone() ? `${angle(l, 2)} (2e sin M : ${angle(approx, 2)})` : angle(l, 1)],
      [tr('anim_libration_v_b'), angle(b, 2)],
      [tr('anim_libration_v_distance'), `${nombre(lb.distance(this.m(), e), 0)} km`],
      [tr('anim_libration_v_mois'), `${nombre(100.0 * mois, 1)} %`],
      [tr('anim_libration_v_annees'), `${nombre(100.0 * annees, 1)} %`],
    ];
    if (this.c_diurne.isChecked()) out.push([tr('anim_libration_v_diurne'), angle(lb.rho_diurne(e), 2)]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones_principale(rect, 2, 0.5);
    this.lune(p, dessin.cadre(p, z[0]!, tr('anim_libration_t_lune')));
    this.orbite(p, dessin.cadre(p, z[1]!, tr('anim_libration_t_orbite')));
    this.courbe(p, dessin.cadre(p, z[2]!, tr('anim_libration_t_courbe')));
  }

  private lune(p: Peintre, r: Rect): void {
    const [l, b] = this.lb_();
    const R = 0.42 * Math.min(r.w, r.h - 30);
    const cx = r.cx,
      cy = r.cy + 4;
    p.save();
    p.setPen(dessin.stylo('doux', 1.0));
    p.setBrush(dessin.c('lune', 0.55));
    p.drawEllipse(cx, cy, R, R);
    if (this.c_grille.isChecked()) {
      for (let lat = -60; lat <= 60; lat += 30) {
        const pts: [number, number][] = [];
        for (let lo = -180; lo <= 180; lo += 5) pts.push([lat, lo]);
        this.ligne(p, cx, cy, R, pts, l, b, 'grille');
      }
      for (let lo = -180; lo < 180; lo += 30) {
        const cle = lo === -90 || lo === 90 ? 'accent2' : lo === 0 ? 'accent1' : 'grille';
        const pts: [number, number][] = [];
        for (let la = -90; la <= 90; la += 5) pts.push([la, lo]);
        this.ligne(p, cx, cy, R, pts, l, b, cle);
      }
    }
    for (const [k, la, lo] of lb.FORMATIONS) {
      const [x, y, zz] = lb.projection(la, lo, l, b);
      if (zz > 0.0) {
        dessin.disque(p, cx + R * x, cy - R * y, 4.0, 'accent3');
        dessin.etiquette(p, cx + R * x, cy - R * y, tr('anim_libration_f_' + k), 'texte');
      }
    }
    p.restore();
    dessin.texte(p, cx, r.bottom - 10, tr('anim_libration_legende_lune'), 'doux', { fond: true });
  }

  private ligne(p: Peintre, cx: number, cy: number, R: number, pts: [number, number][], l: number, b: number, cle: string): void {
    p.setPen(dessin.stylo(cle, cle !== 'grille' ? 1.4 : 0.8, 0.9));
    let prec: Pt | null = null;
    for (const [la, lo] of pts) {
      const [x, y, zz] = lb.projection(la, lo, l, b);
      const q = zz >= 0.0 ? new Pt(cx + R * x, cy - R * y) : null;
      if (q !== null && prec !== null) p.drawLine(prec.x, prec.y, q.x, q.y);
      prec = q;
    }
  }

  private orbite(p: Peintre, r: Rect): void {
    const e = this.e.value();
    const m = this.m();
    const a = 1.0;
    const demi = a * (1.0 + e) * 1.25;
    const cote = Math.min(r.w, r.h - 6);
    const k = cote / (2.0 * demi);
    const cx = r.cx + (k * a * e) / 2.0,
      cy = r.cy + 3;
    const pt = (x: number, y: number): Pt => new Pt(cx + k * x, cy - k * y);
    p.save();
    p.setClipRect(r);
    p.setBrush(null);
    p.setPen(dessin.stylo('grille', 1.2));
    const bb = a * Math.sqrt(1.0 - e * e);
    const c = pt(-a * e, 0.0);
    p.drawEllipse(c.x, c.y, a * k, bb * k);
    dessin.disque(p, cx, cy, 7.0, 'terre');
    const nu = lb.anomalie_vraie(m, e);
    const d = (a * (1.0 - e * e)) / (1.0 + e * Math.cos(nu));
    const q = pt(d * Math.cos(nu), d * Math.sin(nu));
    const rl = 0.11 * cote;
    dessin.disque(p, q.x, q.y, rl, 'lune');
    p.setPen(dessin.stylo('doux', 1.0, 0.8, true));
    p.drawLine(q.x, q.y, cx, cy);
    const rot = (this.synchrone() ? m : 0.0) + Math.PI;
    p.setPen(dessin.stylo('accent1', 2.4));
    p.drawLine(q.x, q.y, q.x + rl * 1.5 * Math.cos(rot), q.y - rl * 1.5 * Math.sin(rot));
    p.restore();
    dessin.texte(p, r.left + 6, r.bottom - 10, tr('anim_libration_legende_orbite'), 'doux', { centre: false, fond: true });
  }

  private courbe(p: Peintre, r: Rect): void {
    const lim = this.synchrone() ? 10.0 : 180.0;
    const limb = Math.max(10.0, this.i.value() * 1.2);
    const ax = new Axes(r, -lim, lim, -limb, limb, false, false, [40, 8, 10, 30]).avec(p);
    ax.fond(p, { titre_x: tr('anim_libration_axe_l'), titre_y: tr('anim_libration_axe_b') });
    const pts: [number, number][] = [];
    for (let j = 0; j <= 240; j++) pts.push(lb.libration((2.0 * Math.PI * j) / 240, this.e.value(), this.i.value(), this.varpi.value(), this.synchrone()));
    if (this.synchrone()) ax.courbe(pts, 'accent2', 1.6);
    else ax.points(pts, 'accent2', 1.4);
    const [l, b] = this.lb_();
    dessin.disque(p, ax.px(l), ax.py(b), 5.0, 'accent3', 'texte');
  }
}
