/**
 * Les éléments d'une orbite : a, e, i, Ω, ω et le temps (anomalie moyenne) ; vue en 3D (équateur, point vernal,
 * nœuds, apsides, angles dessinés), trace au sol et orbite dans son plan.  Jumeau de
 * `animations/elements_orbite.py` de Coupole (calculs : `calc/elements_orbitaux.ts`).
 */
import * as eo from '../../calc/elements_orbitaux';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import type { Pts, V3 } from '../../noyau/vec';
import { Animation, angle, type Choix, type Coche, nombre, type Reglage } from '../base';
import { cotesCarte } from './jour_nuit';
import { chargerCotes } from './longitude_latitude';

const ORBITES_PAR_S = 0.1;
const RAD = Math.PI / 180;

export function duree(t_s: number): string {
  const t = Math.max(0.0, t_s);
  if (t < 3600.0) {
    const tot = Math.round(t);
    return tr('anim_orbitalelements_d_ms', { m: Math.floor(tot / 60), s: String(tot % 60).padStart(2, '0') });
  }
  if (t < 4 * 86400.0) {
    const tot = Math.round(t / 60.0);
    return tr('anim_orbitalelements_d_hm', { h: Math.floor(tot / 60), m: String(tot % 60).padStart(2, '0') });
  }
  return tr('anim_orbitalelements_d_j', { j: nombre(t / 86400.0, 1) });
}

const mul = (v: readonly number[], k: number): V3 => [v[0]! * k, v[1]! * k, v[2]! * k];
const add = (a: readonly number[], b: readonly number[]): V3 => [a[0]! + b[0]!, a[1]! + b[1]!, a[2]! + b[2]!];
const cross = (a: readonly number[], b: readonly number[]): V3 => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];

export class ElementsOrbite extends Animation {
  static override ID = 'orbitalelements';
  static override LECTURE_AU_DEPART = true;

  vue3d!: dessin.Vue3D;
  orbite!: Choix;
  a!: Reglage;
  e!: Reglage;
  i!: Reglage;
  om!: Reglage;
  w!: Reglage;
  c_angles!: Coche;
  c_plan!: Coche;
  c_trace!: Coche;
  t = 0.0;
  private applique: unknown = 'libre';

  override construire(): void {
    this.vue3d = this.vue(20.0, 38.0);
    this.orbite = this.choix('orbite', [['anim_orbitalelements_o_libre', 'libre'], ...eo.ORBITES.map(([k]) => ['anim_orbitalelements_o_' + k, k] as [string, string])], 'libre');
    this.a = this.curseur('a', 6600.0, 100000.0, 18000.0, { dec: 0, unite: 'km', log: true });
    this.e = this.curseur('e', 0.0, 0.95, 0.3, { dec: 3 });
    this.i = this.curseur('i', 0.0, 180.0, 40.0, { dec: 1, unite: '°' });
    this.om = this.curseur('noeud', 0.0, 360.0, 45.0, { dec: 1, unite: '°' });
    this.w = this.curseur('perigee', 0.0, 360.0, 60.0, { dec: 1, unite: '°' });
    this.c_angles = this.coche('angles', true);
    this.c_plan = this.coche('plan', true);
    this.c_trace = this.coche('trace', true);
    this.applique = this.orbite.currentData();
    this.etat_initial();
    this.attendre(chargerCotes());
  }

  override etat_initial(): void {
    this.t = 0.0;
  }

  override reglage_change(): void {
    if (this.orbite) {
      const k = this.orbite.currentData();
      if (k !== this.applique) {
        this.applique = k;
        const o = eo.ORBITES.find(([c]) => c === k);
        if (o) {
          const [a, e, i, om, w] = o[1];
          this.a.setValue(a);
          this.e.setValue(e);
          this.i.setValue(i);
          this.om.setValue(om);
          this.w.setValue(w);
          this.t = 0.0;
        }
      }
    }
    super.reglage_change();
  }

  elements(): [number, number, number, number, number] {
    return [this.a.value(), this.e.value(), this.i.value(), this.om.value(), this.w.value()];
  }

  anomalie_moyenne(): number {
    return pmod((360.0 * this.t) / eo.periode_s(this.a.value()), 360.0);
  }

  override avancer(dt: number): void {
    this.t += dt * ORBITES_PAR_S * eo.periode_s(this.a.value());
  }

  override valeurs(): [string, string][] {
    const [a, e, i, om, w] = this.elements();
    const m = this.anomalie_moyenne();
    const s = eo.etat(a, e, i, om, w, m);
    const rp = a * (1 - e),
      ra = a * (1 + e);
    const km = tr('anim_orbitalelements_km');
    const alt = tr('anim_orbitalelements_altitude');
    const kms = 'km·s⁻¹';
    return [
      [tr('anim_orbitalelements_v_periode'), duree(eo.periode_s(a))],
      [tr('anim_orbitalelements_v_perigee'), `${nombre(rp, 0)} ${km} — ${alt} ${nombre(rp - eo.R_TERRE_KM, 0)} ${km}`],
      [tr('anim_orbitalelements_v_apogee'), `${nombre(ra, 0)} ${km} — ${alt} ${nombre(ra - eo.R_TERRE_KM, 0)} ${km}`],
      [tr('anim_orbitalelements_v_vitesses'), `${nombre(eo.vitesse(rp, a), 2)} / ${nombre(eo.vitesse(ra, a), 2)} ${kms}`],
      [tr('anim_orbitalelements_v_position'), `M = ${angle(m, 1)} — ν = ${angle(s.nu, 1)} — ${alt} ${nombre(s.r - eo.R_TERRE_KM, 0)} ${km} — v = ${nombre(s.v, 2)} ${kms}`],
      [tr('anim_orbitalelements_v_temps'), duree(this.t)],
      [tr('anim_orbitalelements_v_genre'), tr('anim_orbitalelements_g_' + eo.genre_orbite(a, e, i))],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    if (this.c_trace.isChecked()) {
      const z = dessin.zones_principale(rect, 2, 0.58);
      this.espace(p, dessin.cadre(p, z[0]!, tr('anim_orbitalelements_t_espace')));
      this.carte(p, dessin.cadre(p, z[1]!, tr('anim_orbitalelements_t_trace')));
      this.plan(p, dessin.cadre(p, z[2]!, tr('anim_orbitalelements_t_plan')));
    } else {
      const z = dessin.zones_principale(rect, 1, 0.62);
      this.espace(p, dessin.cadre(p, z[0]!, tr('anim_orbitalelements_t_espace')));
      this.plan(p, dessin.cadre(p, z[1]!, tr('anim_orbitalelements_t_plan')));
    }
  }

  private espace(p: Peintre, r: Rect): void {
    this.zone_rotative(r, this.vue3d);
    const [a, e, i, om, w] = this.elements();
    const rot = eo.rotation(i, om, w);
    const ech = Math.max(1.15 * a * (1 + e), 2.4 * eo.R_TERRE_KM);
    const rr = Math.min(r.w, r.h) * 0.44;
    const pe = new dessin.Peintre3D(p, this.vue3d, r.cx, r.cy, rr);
    const rt = eo.R_TERRE_KM / ech;
    const u = (v: readonly number[]): V3 => mul(v, 1 / ech);
    if (this.c_plan.isChecked()) pe.plan('equateur', 0.1, 1.0, 'equateur');
    const pts: Pts = Array.from({ length: 361 }, (_, k) => u(eo.point_orbite(a, e, rot, k)));
    const { xs, ys, zs, hs } = pe.ecran(pts, true);
    const cache = xs.map((x, k) => zs[k]! < 0 && Math.hypot(x - pe.cx, ys[k]! - pe.cy) < rt * rr);
    this.polyligne(p, xs, ys, cache, hs, true);
    const o = pe.ecran([0.0, 0.0, 0.0], true);
    dessin.disque(p, o.xs[0]!, o.ys[0]!, rt * rr, 'terre', 'texte');
    pe.courbe(dessin.cercle([0, 0, 1]).map((q) => mul(q, rt)), 'equateur', 1.0, 0.8, { arriere: 'cache', profondeur: false });
    pe.segment([0, 0, -1.25 * rt], [0, 0, 1.25 * rt], 'doux', 1.2, 0.9);
    this.polyligne(p, xs, ys, cache, hs, false);
    pe.segment([0, 0, 0], [1.0, 0, 0], 'accent1', 1.3, 0.9);
    pe.etiquette([1.06, 0, 0], tr('anim_orbitalelements_vernal'), 'accent1');
    const n: V3 = [Math.cos(om * RAD), Math.sin(om * RAD), 0.0];
    const na = u(eo.point_orbite(a, e, rot, -w));
    const nd = u(eo.point_orbite(a, e, rot, 180.0 - w));
    pe.segment(nd, na, 'arc1', 1.3, 0.9);
    pe.point(na, 'arc1', 4.5, { etiquette: tr('anim_orbitalelements_noeud_asc'), toujours: true });
    pe.point(nd, 'arc1', 3.5, { toujours: true });
    const per = u(eo.point_orbite(a, e, rot, 0.0));
    const apo = u(eo.point_orbite(a, e, rot, 180.0));
    if (e > 0.005) {
      pe.courbe([apo, per], 'accent3', 1.1, 0.8, { arriere: 'normal', profondeur: false });
      pe.point(per, 'accent3', 4.0, { etiquette: tr('anim_orbitalelements_perigee_m'), toujours: true });
      pe.point(apo, 'accent3', 3.5, { etiquette: tr('anim_orbitalelements_apogee_m'), toujours: true });
    }
    if (this.c_angles.isChecked()) {
      const k = Math.max(0.3, 1.25 * rt);
      if (om > 0.5) {
        const arc: Pts = Array.from({ length: 60 }, (_, j) => {
          const t = ((om * j) / 59) * RAD;
          return [k * Math.cos(t), k * Math.sin(t), 0.0] as V3;
        });
        pe.courbe(arc, 'accent1', 2.0, 1.0, { arriere: 'normal', profondeur: false });
        pe.etiquette(mul(arc[30]!, 1.18), 'Ω', 'accent1');
      }
      if (w > 0.5 && i > 0.5) {
        const kw = Math.max(1.3 * rt, Math.min(0.4, (0.8 * a * (1 - e)) / ech));
        const arc: Pts = Array.from({ length: 60 }, (_, j) => {
          const t = (-w + (w * j) / 59) * RAD;
          return eo.appliquer(rot, [kw * Math.cos(t), kw * Math.sin(t), 0.0]);
        });
        pe.courbe(arc, 'accent3', 2.0, 1.0, { arriere: 'normal', profondeur: false });
        pe.etiquette(mul(arc[30]!, 1.15), 'ω', 'accent3');
      }
      if (i > 0.5) {
        const h = eo.appliquer(rot, [0.0, 0.0, 1.0]);
        const q_eq: V3 = [-n[1], n[0], 0.0];
        const q_or = cross(h, n);
        const ki = 0.16;
        const nq = cross(n, q_eq);
        const arc: Pts = Array.from({ length: 40 }, (_, j) => {
          const t = ((i * j) / 39) * RAD;
          return add(na, mul(add(mul(q_eq, Math.cos(t)), mul(nq, Math.sin(t))), ki));
        });
        pe.courbe(arc, 'accent2', 2.0, 1.0, { arriere: 'normal', profondeur: false });
        pe.segment(na, add(na, mul(q_eq, 0.24)), 'accent2', 1.0, 0.7);
        pe.segment(na, add(na, mul(q_or, 0.24)), 'accent2', 1.0, 0.7);
        pe.etiquette(add(arc[20]!, mul(q_eq, 0.06)), 'i', 'accent2');
      }
    }
    const s = eo.etat(a, e, i, om, w, this.anomalie_moyenne());
    const sat = u(s.pos);
    const nv = Math.hypot(...s.vit);
    const bout = add(sat, mul(s.vit, 0.16 / nv));
    const e0 = pe.ecran(sat, true),
      e1 = pe.ecran(bout, true);
    dessin.fleche(p, e0.xs[0]!, e0.ys[0]!, e1.xs[0]!, e1.ys[0]!, dessin.stylo('accent2', 1.6), 7);
    pe.point(sat, 'accent1', 5.5, { bord: 'texte', etiquette: tr('anim_orbitalelements_satellite'), toujours: true });
  }

  private polyligne(p: Peintre, xs: number[], ys: number[], cache: boolean[], hs: number[], cachee: boolean): void {
    for (let k = 0; k < xs.length - 1; k++) {
      if ((cache[k]! || cache[k + 1]!) !== cachee) continue;
      const dessous = hs[k]! + hs[k + 1]! < 0;
      p.setPen(dessin.stylo('accent1', cachee ? 1.2 : 2.0, cachee ? 0.35 : 1.0, dessous));
      p.drawLine(xs[k]!, ys[k]!, xs[k + 1]!, ys[k + 1]!);
    }
  }

  private carte(p: Peintre, r: Rect): void {
    const w = Math.min(r.w - 10, (r.h - 14) * 2.0);
    const carte = new Rect(r.cx - w / 2, r.cy - w / 4, w, w / 2);
    const xy = (la: number, lo: number): Pt => new Pt(carte.x + ((lo + 180.0) / 360.0) * carte.w, carte.y + ((90.0 - la) / 180.0) * carte.h);
    p.fillRect(carte, dessin.c('terre', 0.3));
    p.save();
    p.setClipRect(carte);
    p.setPen(dessin.stylo('texte', 0.7, 0.7));
    cotesCarte(p, xy);
    p.restore();
    p.setPen(dessin.stylo('grille', 0.6, 0.6));
    for (let lo = -150; lo <= 180; lo += 30) p.drawLineP(xy(90, lo), xy(-90, lo));
    for (const la of [-60, -30, 30, 60]) p.drawLineP(xy(la, -180), xy(la, 180));
    p.setPen(dessin.stylo('equateur', 1.0, 0.9));
    p.drawLineP(xy(0, -180), xy(0, 180));
    const [a, e, i, om, w_] = this.elements();
    const t_orb = eo.periode_s(a);
    const duree_trace = Math.min(3.0 * t_orb, 2.0 * eo.JOUR_SIDERAL_S);
    const tr_ = eo.trace_au_sol(a, e, i, om, w_, 0.0, Math.max(0.0, this.t - duree_trace), this.t, 360);
    p.setPen(dessin.stylo('accent1', 1.6, 0.9));
    for (let k = 0; k < tr_.length - 1; k++) {
      const [la0, lo0] = tr_[k]!,
        [la1, lo1] = tr_[k + 1]!;
      if (Math.abs(lo1 - lo0) < 180.0) p.drawLineP(xy(la0, lo0), xy(la1, lo1));
    }
    const [la, lo] = tr_[tr_.length - 1]!;
    const q = xy(la, lo);
    dessin.disque(p, q.x, q.y, 5.0, 'accent1', 'texte');
  }

  private plan(p: Peintre, r: Rect): void {
    const [a, e, i, om, w] = this.elements();
    const b = a * Math.sqrt(1 - e * e);
    const ech = a > 0 ? Math.min((r.w - 30) / (2 * a), (r.h - 30) / (2 * b)) : 1.0;
    const xc = r.cx,
      yc = r.cy;
    const fx = xc + a * e * ech;
    const q = (nu_deg: number): Pt => {
      const nu = nu_deg * RAD;
      const rr = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
      return new Pt(fx + rr * Math.cos(nu) * ech, yc - rr * Math.sin(nu) * ech);
    };
    p.setPen(dessin.stylo('accent1', 1.8));
    p.setBrush(null);
    p.drawEllipse(xc, yc, a * ech, b * ech);
    dessin.disque(p, fx, yc, Math.max(3.0, eo.R_TERRE_KM * ech), 'terre', 'texte');
    p.setPen(dessin.stylo('accent3', 1.0, 0.8, true));
    p.drawLineP(q(180.0), q(0.0));
    p.setPen(dessin.stylo('arc1', 1.0, 0.9, true));
    p.drawLineP(q(180.0 - w), q(-w));
    dessin.texte(p, q(-w).x, q(-w).y, '☊', 'arc1', { fond: true });
    const s = eo.etat(a, e, i, om, w, this.anomalie_moyenne());
    const m = q(s.nu);
    p.setPen(dessin.stylo('accent2', 1.4));
    p.drawLine(fx, yc, m.x, m.y);
    const ra = Math.max(3.0, eo.R_TERRE_KM * ech) + 14.0;
    p.setPen(dessin.stylo('accent2', 1.6));
    p.drawArc(new Rect(fx - ra, yc - ra, 2 * ra, 2 * ra), 0, Math.trunc(16 * s.nu));
    dessin.texte(p, fx + 1.5 * ra * Math.cos((s.nu / 2) * RAD), yc - 1.5 * ra * Math.sin((s.nu / 2) * RAD), 'ν', 'accent2', { fond: true });
    dessin.disque(p, m.x, m.y, 5.0, 'accent1', 'texte');
    if (e > 0.005) dessin.texte(p, q(0.0).x - 4, q(0.0).y + 12, tr('anim_orbitalelements_perigee_m'), 'accent3');
  }
}
