/**
 * Occultation d'une étoile par un astéroïde : l'ombre balaie les observateurs, chacun mesure une corde (durée =
 * corde / vitesse), les cordes donnent la taille et la forme (ellipse ajustée).  Jumeau de
 * `animations/occultation.py` de Coupole (calculs : `calc/occultation.ts`).
 */
import * as oc from '../../calc/occultation';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { Animation, type Choix, type Coche, nombre, type Reglage } from '../base';

const DUREE_PASSAGE = 8.0;

export function km(x: number): string {
  if (x < 1.0) return `${nombre(x * 1000.0, 0)} m`;
  return `${nombre(x, x < 100 ? 1 : 0)} km`;
}

export class Occultation extends Animation {
  static override ID = 'occultation';
  static override LECTURE_AU_DEPART = true;

  objet!: Choix;
  diametre!: Reglage;
  forme!: Reglage;
  orientation!: Reglage;
  distance!: Reglage;
  n_stations!: Reglage;
  espacement!: Reglage;
  decalage!: Reglage;
  etoile!: Reglage;
  sigma!: Reglage;
  c_vraie!: Coche;
  c_ajuster!: Coche;
  t: number | null = null;
  private objet_applique: unknown = 'ceinture';

  override construire(): void {
    this.objet = this.choix('objet', [...oc.OBJETS.map(([k]) => ['anim_occultation_o_' + k, k] as [string, string]), ['anim_occultation_o_libre', 'libre']], 'ceinture');
    this.diametre = this.curseur('diametre', 1.0, 5000.0, 100.0, { dec: 1, unite: 'km', log: true });
    this.forme = this.curseur('forme', 0.3, 1.0, 0.8, { dec: 2 });
    this.orientation = this.curseur('orientation', -90.0, 90.0, 30.0, { dec: 0, unite: '°' });
    this.distance = this.curseur('distance', 1.5, 100.0, 2.5, { dec: 1, unite: 'ua', log: true });
    this.n_stations = this.curseur('stations', 1.0, 11.0, 7.0, { dec: 0 });
    this.espacement = this.curseur('espacement', 0.1, 1000.0, 15.0, { dec: 1, unite: 'km', log: true });
    this.decalage = this.curseur('decalage', -1.0, 1.0, 0.1, { dec: 2 });
    this.etoile = this.curseur('etoile', 0.0, 50.0, 0.1, { dec: 2, unite: 'mas' });
    this.sigma = this.curseur('sigma', 0.0, 1.0, 0.1, { dec: 2, unite: 's' });
    this.c_vraie = this.coche('vraie', true);
    this.c_ajuster = this.coche('ajuster', true);
    this.objet_applique = this.objet.currentData();
    this.t = null;
  }

  override reglage_change(): void {
    if (this.objet) {
      const k = this.objet.currentData();
      if (k !== this.objet_applique) {
        this.objet_applique = k;
        for (const [cle, d, f, psi, r] of oc.OBJETS) {
          if (cle === k) {
            this.diametre.setValue(d);
            this.forme.setValue(f);
            this.orientation.setValue(psi);
            this.distance.setValue(r);
            this.espacement.setValue(d / 6.0);
          }
        }
      }
    }
    super.reglage_change();
  }

  ellipse(): oc.Ellipse {
    const a = this.diametre.value() / 2.0;
    return new oc.Ellipse(a, a * this.forme.value(), this.orientation.value(), 0.0, this.decalage.value() * this.diametre.value());
  }

  v(): number {
    return oc.vitesse_ombre(this.distance.value());
  }

  r_etoile(): number {
    return oc.etoile_km(this.etoile.value(), oc.distance_terre(this.distance.value())) / 2.0;
  }

  ys(): number[] {
    return oc.stations(Math.round(this.n_stations.value()), this.espacement.value());
  }

  t_max(): number {
    return ((1.4 * this.diametre.value()) / 2.0 + 2.0 * this.r_etoile()) / this.v();
  }

  instant(): number {
    return this.t === null ? -this.t_max() : this.t;
  }

  override avancer(dt: number): void {
    const tm = this.t_max();
    const t = this.instant() + (dt * 2.0 * tm) / DUREE_PASSAGE;
    this.t = t > tm ? -tm : t;
  }

  mesures(): [oc.Corde[], oc.Corde[]] {
    const cs = oc.cordes(this.ellipse(), this.ys());
    return [cs, oc.bruiter(cs, this.sigma.value() * this.v())];
  }

  ajustement(br: oc.Corde[]): [number, number, number, number, number] | null {
    const pts: [number, number][] = [];
    for (const [y, x1, x2] of br) if (x1 !== null && x2 !== null) pts.push([x1, y], [x2, y]);
    return oc.ajuster_ellipse(pts);
  }

  override valeurs(): [string, string][] {
    const v = this.v(),
      r = this.distance.value();
    const el = this.ellipse();
    const [cs, br] = this.mesures();
    const pos: number[] = [];
    for (const [, x1, x2] of cs) if (x1 !== null && x2 !== null) pos.push(x2 - x1);
    const out: [string, string][] = [
      [tr('anim_occultation_v_vitesse'), `${nombre(v, 2)} km·s⁻¹`],
      [tr('anim_occultation_v_distance'), `${nombre(oc.distance_terre(r), 2)} ua`],
      [tr('anim_occultation_v_cordes'), tr('anim_occultation_sur', { n: pos.length, N: cs.length })],
    ];
    if (pos.length) {
      const L = Math.max(...pos);
      out.push([tr('anim_occultation_v_plus_longue'), tr('anim_occultation_duree_corde', { d: nombre(L / v, 2), c: km(L) })]);
    }
    const aj = this.ajustement(br);
    const d_vrai = 2.0 * Math.sqrt(el.a * el.b);
    if (aj === null) out.push([tr('anim_occultation_v_ajustee'), tr('anim_occultation_pas_assez')]);
    else {
      out.push([tr('anim_occultation_v_ajustee'), `${km(2 * aj[2]).replace(' km', '')} × ${km(2 * aj[3])}`]);
      out.push([tr('anim_occultation_v_equivalent'), tr('anim_occultation_vrai_ajuste', { v: km(d_vrai), a: km(2.0 * Math.sqrt(aj[2] * aj[3])) })]);
    }
    out.push([tr('anim_occultation_v_erreur'), km(this.sigma.value() * v)]);
    out.push([tr('anim_occultation_v_fresnel'), km(oc.fresnel_km(550.0, oc.distance_terre(r)))]);
    const re = 2.0 * this.r_etoile();
    out.push([tr('anim_occultation_v_etoile'), km(re) + ' — ' + tr(re > 0.05 * 2.0 * el.b ? 'anim_occultation_progressive' : 'anim_occultation_franche')]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones_principale(rect, 2, 0.5);
    this.plan(p, dessin.cadre(p, z[0]!, tr('anim_occultation_t_plan')));
    this.courbes(p, dessin.cadre(p, z[1]!, tr('anim_occultation_t_courbes')));
    this.forme_reconstituee(p, dessin.cadre(p, z[2]!, tr('anim_occultation_t_forme')));
  }

  private echelle(r: Rect, ys: number[], el: oc.Ellipse): number {
    const etendue = Math.max(1.6 * el.a, Math.max(...ys.map(Math.abs)) + 0.3 * el.a, Math.abs(el.y0) + 1.2 * el.a);
    return Math.min(r.w, r.h - 20) / (2.0 * etendue);
  }

  private plan(p: Peintre, r: Rect): void {
    const el = this.ellipse();
    const ys = this.ys();
    const t = this.instant();
    const v = this.v();
    const k = this.echelle(r, ys, el);
    const cx = r.cx,
      cy = r.cy + 8;
    const xs = v * t;
    const pt = (x: number, y: number): Pt => new Pt(cx + k * x, cy - k * y);
    p.setPen(dessin.stylo('doux', 1.0, 0.6, true));
    p.drawLine(r.x + 8, cy, r.right - 8, cy);
    dessin.fleche(p, r.right - 60, r.y + 30, r.right - 20, r.y + 30, dessin.stylo('doux', 1.4), 7);
    dessin.texte(p, r.right - 40, r.y + 44, 'v', 'doux');
    const ombre = new oc.Ellipse(el.a, el.b, el.psi, xs, el.y0);
    p.setBrush(dessin.c('nuit', 0.75));
    p.setPen(dessin.stylo('accent2', 1.6));
    p.drawPolygon(ombre.contour().map(([x, y]) => pt(x, y)));
    for (const [y, x1, x2] of oc.cordes(el, ys)) {
      if (x1 === null || x2 === null) continue;
      const xr = -xs;
      if (xr < x2) {
        const a_ = Math.max(x1, xr);
        p.setPen(dessin.stylo('accent1', 2.4));
        p.drawLineP(pt(xs + a_, y), pt(xs + x2, y));
      }
    }
    const re = this.r_etoile();
    for (const y of ys) {
      const f = oc.fraction_cachee(el, -xs, y, re);
      const q = pt(0.0, y);
      if (re * k > 3.0) {
        p.setBrush(null);
        p.setPen(dessin.stylo('accent3', 1.0, 0.6));
        p.drawEllipse(q.x, q.y, re * k, re * k);
      }
      dessin.disque(p, q.x, q.y, 4.5, f < 0.5 ? 'accent3' : 'grille', 'texte');
    }
    dessin.texte(p, cx, r.bottom - 10, tr('anim_occultation_observateurs'), 'doux', { fond: true });
  }

  private courbes(p: Peintre, r: Rect): void {
    const el = this.ellipse();
    const ys = this.ys();
    const v = this.v(),
      tm = this.t_max(),
      t = this.instant();
    const re = this.r_etoile();
    const n = ys.length;
    const ax = new Axes(r, -tm, tm, -0.2, n + 0.1, false, false, [40, 8, 8, 30]).avec(p);
    ax.fond(p, {
      titre_x: tr('anim_occultation_axe_t'),
      titre_y: tr('anim_occultation_axe_flux'),
      grille: false,
      fmt_x: (x) => nombre(x, tm >= 20 ? 0 : tm >= 2 ? 1 : 2),
      fmt_y: () => '',
    });
    const m = 200;
    ys.forEach((y, i) => {
      const base = i + 0.1;
      const pts: [number, number][] = [];
      for (let j = 0; j <= m; j++) {
        const tt = -tm + (2.0 * tm * j) / m;
        pts.push([tt, base + 0.75 * (1.0 - oc.fraction_cachee(el, -v * tt, y, re))]);
      }
      ax.courbe(pts, el.corde(y) ? 'accent1' : 'doux', 1.4);
    });
    ax.verticale(t, 'accent3', 1.2);
  }

  private forme_reconstituee(p: Peintre, r: Rect): void {
    const el = this.ellipse();
    const ys = this.ys();
    const [, br] = this.mesures();
    const k = this.echelle(r, ys, el);
    const cx = r.cx,
      cy = r.cy + 8;
    const pt = (x: number, y: number): Pt => new Pt(cx + k * x, cy - k * (y - el.y0));
    const sig = this.sigma.value() * this.v();
    if (this.c_vraie.isChecked()) {
      p.setBrush(null);
      p.setPen(dessin.stylo('doux', 1.2, 0.8, true));
      p.drawPolygon(el.contour().map(([x, y]) => pt(x, y)));
    }
    for (const [y, x1, x2] of br) {
      if (x1 === null || x2 === null) {
        p.setPen(dessin.stylo('grille', 1.0, 0.8, true));
        p.drawLine(r.x + 10, pt(0, y).y, r.right - 10, pt(0, y).y);
        continue;
      }
      p.setPen(dessin.stylo('accent1', 2.2));
      p.drawLineP(pt(x1, y), pt(x2, y));
      if (sig * k > 1.0) {
        p.setPen(dessin.stylo('accent3', 1.4));
        for (const x of [x1, x2]) p.drawLineP(pt(x - sig, y), pt(x + sig, y));
      }
    }
    const aj = this.c_ajuster.isChecked() ? this.ajustement(br) : null;
    if (aj !== null) {
      const fit = new oc.Ellipse(aj[2], aj[3], aj[4], aj[0], aj[1]);
      p.setBrush(null);
      p.setPen(dessin.stylo('accent2', 1.8));
      p.drawPolygon(fit.contour().map(([x, y]) => pt(x, y)));
    }
    dessin.texte(p, cx, r.bottom - 10, tr('anim_occultation_legende_forme'), 'doux', { fond: true });
  }
}
