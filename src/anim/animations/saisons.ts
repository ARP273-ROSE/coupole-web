/**
 * Seasons Simulator (NAAP) : géométrie de la Terre et du Soleil au fil de l'année.  Vue orbitale (axe de la Terre
 * fixe dans l'espace), Terre vue de côté ou depuis le Soleil (point subsolaire, latitude de l'observateur), et, pour
 * l'observateur, l'angle des rayons à midi ou l'étalement d'un faisceau sur le sol.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { linspace, pmod } from '../../noyau/py';
import { add, mul, sub, type V3 } from '../../noyau/vec';
import { Animation, angle, type Choix, type Coche, date_du_jour, duree_hm, heures_minutes, nombre, type Reglage } from '../base';

const ANNEE = 2026;

interface Etat {
  soleil: astro.Soleil;
  h_midi: number;
  duree: number;
  etalement: number;
  eps: number;
}

function etat(jour: number, lat: number): Etat {
  const s = astro.soleil_jour(ANNEE, jour + 0.5);
  const h_midi = astro.hauteur_culmination(s.delta, lat);
  return {
    soleil: s,
    h_midi,
    duree: astro.duree_du_jour_h(s.delta, lat, -0.833),
    etalement: h_midi > 0.5 ? 1.0 / Math.sin((h_midi * Math.PI) / 180) : Infinity,
    eps: astro.obliquite_moyenne(astro.jj_jour_de_l_annee(ANNEE, jour)),
  };
}

export class Saisons extends Animation {
  static override ID = 'eclipticsimulator';
  static JOURS_PAR_S = 20.0;

  orbite!: dessin.Vue3D;
  jour!: Reglage;
  lat!: Reglage;
  vue_terre!: Choix;
  observ!: Choix;
  c_subsolaire!: Coche;
  c_etiquettes!: Coche;

  override construire(): void {
    this.orbite = this.vue(270.0, 30.0, 0.0, 89.0);
    this.jour = this.curseur('jour', 0.0, 364.0, 40.0, { dec: 0, cle_texte: 'anim_c_jour' });
    this.lat = this.curseur('latitude', -90.0, 90.0, 10.0, { dec: 1, unite: '°', cle_texte: 'anim_c_latitude' });
    this.vue_terre = this.choix('vue_terre', [['anim_eclipticsimulator_cote', 'cote'], ['anim_eclipticsimulator_soleil', 'soleil']], 'cote');
    this.observ = this.choix('observateur', [['anim_eclipticsimulator_angle', 'angle'], ['anim_eclipticsimulator_faisceau', 'faisceau']], 'angle');
    this.c_subsolaire = this.coche('subsolaire', true);
    this.c_etiquettes = this.coche('etiquettes', false);
  }

  override avancer(dt: number): void {
    this.jour.setValue(pmod(this.jour.value() + dt * Saisons.JOURS_PAR_S, 365.0));
  }

  override valeurs(): [string, string][] {
    const e = etat(this.jour.value(), this.lat.value());
    const s = e.soleil;
    const out: [string, string][] = [
      [tr('anim_c_date'), date_du_jour(this.jour.value())],
      [tr('anim_c_dec'), angle(s.delta)],
      [tr('anim_c_ra'), heures_minutes(s.alpha / 15.0)],
      [tr('anim_eclipticsimulator_h_midi'), angle(e.h_midi)],
      [tr('anim_sunmotions_duree'), duree_hm(e.duree)],
    ];
    if (Number.isFinite(e.etalement)) out.push([tr('anim_eclipticsimulator_etalement'), `× ${nombre(e.etalement, 2)}`]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const e = etat(this.jour.value(), this.lat.value());
    const z = dessin.zones_principale(rect, 2);
    this.dessinOrbite(p, dessin.cadre(p, z[0]!, tr('anim_eclipticsimulator_vue_orbite')), e);
    this.dessinTerre(p, dessin.cadre(p, z[1]!, tr('anim_eclipticsimulator_vue_terre')), e);
    const titre = this.observ.currentData() === 'angle' ? 'anim_eclipticsimulator_vue_angle' : 'anim_eclipticsimulator_vue_faisceau';
    this.dessinObservateur(p, dessin.cadre(p, z[2]!, tr(titre)), e);
  }

  /** Repère écliptique (x = point vernal) ; la Terre est à la longitude λ☉ + 180°. */
  private dessinOrbite(p: Peintre, r: Rect, e: Etat): void {
    this.zone_rotative(r, this.orbite);
    const ray = Math.min(r.w, r.h) * 0.42;
    const cx = r.cx,
      cy = r.cy;
    const pe = new dessin.Peintre3D(p, this.orbite, cx, cy, ray);
    pe.plan('sphere', 0.35, 1.0, 'grille');
    pe.courbe(dessin.cercle([0, 0, 1]), 'grille', 1.2, 1.0, { arriere: 'normal', profondeur: false });
    const lam = e.soleil.lambda;
    const terre = astro.vecteur_horizon(-(lam + 180.0), 0.0);
    if (this.c_etiquettes.isChecked()) {
      for (const [cle, l] of [['anim_eclipticsimulator_mars', 0], ['anim_eclipticsimulator_juin', 90], ['anim_eclipticsimulator_sept', 180], ['anim_eclipticsimulator_dec', 270]] as [string, number][])
        pe.etiquette(mul(astro.vecteur_horizon(-(l + 180.0), 0.0), 1.18), tr(cle), 'doux');
    }
    const o = pe.ecran([0, 0, 0]);
    dessin.disque(p, o.xs[0]!, o.ys[0]!, Math.max(6.0, ray * 0.09), 'soleil');
    pe.segment([0, 0, 0], mul(terre, 0.88), 'soleil', 2.0, 0.8);
    const eps = (e.eps * Math.PI) / 180;
    const axe: V3 = [0.0, Math.sin(eps), Math.cos(eps)];
    const t = pe.ecran(terre);
    const rt = Math.max(5.0, ray * 0.07);
    dessin.disque(p, t.xs[0]!, t.ys[0]!, rt, 'terre');
    pe.segment(sub(terre, mul(axe, 0.15)), add(terre, mul(axe, 0.15)), 'texte', 2.0);
    pe.etiquette(add(terre, mul(axe, 0.2)), tr('anim_pc_n'), 'doux');
  }

  /** Terre vue de côté (le Soleil à gauche) ou depuis le Soleil ; latitude de l'observateur et point subsolaire. */
  private dessinTerre(p: Peintre, r: Rect, e: Etat): void {
    const d = e.soleil.delta;
    const lat = this.lat.value();
    const ray = Math.min(r.w, r.h) * 0.36;
    const cx = r.cx,
      cy = r.cy;
    const de_cote = this.vue_terre.currentData() === 'cote';
    const rad = Math.PI / 180;
    p.save();
    p.translate(cx, cy);
    dessin.disque(p, 0, 0, ray, 'terre');
    if (de_cote) {
      p.setBrush(dessin.c('nuit', 0.65));
      p.setPen(null);
      p.drawPie(new Rect(-ray, -ray, 2 * ray, 2 * ray), -90 * 16, 180 * 16);
      p.rotate(-d);
      for (const [l, cle] of [[0, 'equateur'], [23.44, 'grille'], [-23.44, 'grille'], [66.56, 'grille'], [-66.56, 'grille']] as [number, string][]) {
        const y = -ray * Math.sin(l * rad);
        const x = ray * Math.cos(l * rad);
        p.setPen(dessin.stylo(cle, l === 0 ? 1.4 : 1.0));
        p.drawLine(-x, y, x, y);
      }
      const y = -ray * Math.sin(lat * rad);
      const x = ray * Math.cos(lat * rad);
      p.setPen(dessin.stylo('accent3', 2.2));
      p.drawLine(-x, y, x, y);
      dessin.disque(p, -x, y, 5, 'accent3');
      p.setPen(dessin.stylo('texte', 2.0));
      p.drawLine(0, -ray * 1.25, 0, ray * 1.25);
      dessin.texte(p, 0, -ray * 1.33, tr('anim_pc_n'), 'doux');
      p.rotate(d);
      if (this.c_subsolaire.isChecked()) dessin.disque(p, -ray, 0, 5, 'soleil', 'fond');
      for (const k of [-0.6, -0.3, 0.0, 0.3, 0.6])
        dessin.fleche(p, -ray * 2.2, k * ray, k === 0 ? -ray * 1.1 : -ray * Math.sqrt(1 - k * k) - 6, k * ray, dessin.stylo('soleil', 1.4, 0.8), 6);
    } else {
      const sd = Math.sin(d * rad),
        cd = Math.cos(d * rad);
      for (const [l, cle] of [[0, 'equateur'], [23.44, 'grille'], [-23.44, 'grille'], [66.56, 'grille'], [-66.56, 'grille'], [lat, 'accent3']] as [number, string][]) {
        const t = linspace(-Math.PI, Math.PI, 121);
        const cl = Math.cos(l * rad),
          sl = Math.sin(l * rad);
        p.setPen(dessin.stylo(cle, cle === 'accent3' ? 2.2 : 1.2));
        const pts: Pt[] = [];
        for (const ti of t) {
          const x = cl * Math.sin(ti);
          const prof = cl * Math.cos(ti) * cd + sl * sd;
          const yy = -(sl * cd - cl * Math.cos(ti) * sd);
          if (prof >= 0) pts.push(new Pt(ray * x, ray * yy));
        }
        if (pts.length > 1) p.drawPolyline(pts);
      }
      const yp = -ray * cd;
      p.setPen(dessin.stylo('texte', 2.0));
      p.drawLine(0, yp, 0, yp - ray * 0.25 * cd);
      if (this.c_subsolaire.isChecked()) dessin.disque(p, 0, 0, 5, 'soleil', 'fond');
    }
    p.restore();
  }

  private dessinObservateur(p: Peintre, r: Rect, e: Etat): void {
    const h = e.h_midi;
    const cx = r.cx,
      base = r.bottom - r.h * 0.22;
    const larg = r.w * 0.8;
    p.setPen(dessin.stylo('horizon', 2.5));
    p.drawLine(cx - larg / 2, base, cx + larg / 2, base);
    if (this.observ.currentData() === 'angle') {
      const lon = Math.min(r.w, r.h) * 0.55;
      const hr = (Math.max(h, 0.0) * Math.PI) / 180;
      const sens = this.lat.value() >= e.soleil.delta ? -1 : 1;
      const x1 = cx + sens * lon * Math.cos(hr);
      const y1 = base - lon * Math.sin(hr);
      if (h > 0) {
        dessin.fleche(p, x1, y1, cx, base, dessin.stylo('soleil', 2.5), 10);
        dessin.disque(p, x1, y1, 9, 'soleil');
      }
      p.setPen(dessin.stylo('accent1', 1.5));
      p.setBrush(null);
      const rr = lon * 0.3;
      const debut = sens < 0 ? 180 : 0;
      p.drawArc(new Rect(cx - rr, base - rr, 2 * rr, 2 * rr), debut * 16, Math.trunc(sens * Math.max(h, 0) * 16));
      dessin.texte(p, cx + sens * rr * 1.5, base - 14, angle(h), 'accent1');
      dessin.texte(p, cx - larg / 2 + 10, base + 14, tr(sens < 0 ? 'anim_pc_s' : 'anim_pc_n'), 'doux');
    } else {
      const w = Math.min(r.w, r.h) * 0.18;
      const et = Number.isFinite(e.etalement) ? e.etalement : 50;
      const sol = Math.min(larg, w * et);
      const hr = (Math.max(h, 1.0) * Math.PI) / 180;
      const dx = Math.cos(hr),
        dy = Math.sin(hr);
      const hauteur = r.h * 0.55;
      p.setPen(null);
      p.setBrush(dessin.c('soleil', 0.35));
      const a = new Pt(cx - sol / 2, base);
      const b = new Pt(cx + sol / 2, base);
      p.drawPolygon([a, b, new Pt(b.x - dx * hauteur, b.y - dy * hauteur), new Pt(a.x - dx * hauteur, a.y - dy * hauteur)]);
      p.setPen(dessin.stylo('soleil', 3.0));
      p.drawLineP(a, b);
      dessin.texte(p, cx, base + 16, tr('anim_eclipticsimulator_surface', { x: nombre(et, 2) }), 'texte');
    }
  }
}
