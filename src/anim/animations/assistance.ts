/**
 * L'assistance gravitationnelle : hyperbole du survol vue de la planète, triangle des vitesses v = V + v∞, orbites
 * autour du Soleil avant et après.  Jumeau de `animations/assistance.py` de Coupole (calculs : `calc/assistance.ts`).
 */
import { degrees } from '../../noyau/py';
import * as ga from '../../calc/assistance';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, type Rect } from '../../noyau/peintre';
import { Animation, angle, type Choix, type Coche, nombre, type Reglage } from '../base';

const DUREE = 5.0;
const N_CONIQUE = 360;

export function vitesse(v: number): string {
  return `${nombre(v, 2)} km·s⁻¹`;
}

export function conique_soleil(a_ua: number, v: ga.V2, r_max: number): ([number, number] | null)[] {
  const mu = ga.GM_SOLEIL;
  const r = a_ua * ga.UA;
  const [vt, vr] = v;
  const vx = vr,
    vy = vt;
  const v2 = vx * vx + vy * vy;
  const rv = r * vx;
  const ex = ((v2 - mu / r) * r - rv * vx) / mu;
  const ey = (-rv * vy) / mu;
  const e = Math.hypot(ex, ey);
  const w = Math.atan2(ey, ex);
  const h = r * vy;
  const p = (h * h) / mu / ga.UA;
  const out: ([number, number] | null)[] = [];
  for (let j = 0; j <= N_CONIQUE; j++) {
    const th = (2.0 * Math.PI * j) / N_CONIQUE;
    const d = 1.0 + e * Math.cos(th - w);
    const rr = d > 1e-6 ? p / d : Infinity;
    if (rr > r_max) {
      if (out.length && out[out.length - 1] !== null) out.push(null);
      continue;
    }
    out.push([rr * Math.cos(th), rr * Math.sin(th)]);
  }
  return out;
}

const COULEUR_PLANETE: Record<string, string> = { terre: 'terre', mars: 'mars', venus: 'lune', jupiter: 'ecliptique', saturne: 'soleil' };

export class Assistance extends Animation {
  static override ID = 'gravityassist';
  static override LECTURE_AU_DEPART = true;

  planete!: Choix;
  v_inf!: Reglage;
  r_p!: Reglage;
  angle!: Reglage;
  cote!: Choix;
  c_soleil!: Coche;
  t = 0.0;

  override construire(): void {
    this.planete = this.choix('planete', ga.PLANETES.map(([k]) => ['anim_gravityassist_p_' + k, k] as [string, string]), 'jupiter');
    this.v_inf = this.curseur('vinf', 1.0, 20.0, 5.6, { dec: 1, unite: 'km·s⁻¹' });
    this.r_p = this.curseur('rp', 1.02, 50.0, 5.0, { dec: 2, log: true });
    this.angle = this.curseur('angle', 0.0, 360.0, 170.0, { dec: 0, unite: '°' });
    this.cote = this.choix('cote', [['anim_gravityassist_derriere', 'derriere'], ['anim_gravityassist_devant', 'devant']], 'derriere');
    this.c_soleil = this.coche('soleil', true);
    this.t = 0.0;
  }

  override avancer(dt: number): void {
    this.t = (this.t + dt / DUREE) % 1.0;
  }

  survol(): ga.Survol {
    return ga.survol(String(this.planete.currentData()), this.v_inf.value(), this.r_p.value(), this.angle.value(), this.cote.currentData() === 'derriere');
  }

  override valeurs(): [string, string][] {
    const s = this.survol();
    const [, rayon] = ga.planete(String(this.planete.currentData()));
    const orb = (o: ga.Orbite): string => (Number.isFinite(o.Q) ? tr('anim_gravityassist_orbite', { q: nombre(o.q, 2), Q: nombre(o.Q, 2) }) : tr('anim_gravityassist_liberee'));
    return [
      [tr('anim_gravityassist_v_V'), vitesse(s.V)],
      [tr('anim_gravityassist_v_rp'), `${nombre(s.r_p - rayon, 0)} km`],
      [tr('anim_gravityassist_v_delta'), angle(degrees(s.delta), 1)],
      [tr('anim_gravityassist_v_peri'), vitesse(s.v_peri)],
      [tr('anim_gravityassist_v_dv'), vitesse(s.dv)],
      [tr('anim_gravityassist_v_avant_apres'), `${vitesse(Math.hypot(s.v_in[0], s.v_in[1]))} → ${vitesse(Math.hypot(s.v_out[0], s.v_out[1]))}`],
      [tr('anim_gravityassist_v_gain'), (s.gain >= 0.0 ? '+' : '') + vitesse(s.gain)],
      [tr('anim_gravityassist_v_avant'), orb(s.orb_in)],
      [tr('anim_gravityassist_v_apres'), orb(s.orb_out)],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones_principale(rect, 2, 0.5);
    const s = this.survol();
    this.vue_planete(p, dessin.cadre(p, z[0]!, tr('anim_gravityassist_t_planete')), s);
    this.vitesses(p, dessin.cadre(p, z[1]!, tr('anim_gravityassist_t_vitesses')), s);
    this.vue_soleil(p, dessin.cadre(p, z[2]!, tr('anim_gravityassist_t_soleil')), s);
  }

  private vue_planete(p: Peintre, r: Rect, s: ga.Survol): void {
    const pl = String(this.planete.currentData());
    const [gm, rayon] = ga.planete(pl);
    const demi = Math.max(2.5 * s.r_p, 1.5 * s.b, 3.0 * rayon);
    const cote = Math.min(r.w, r.h - 6);
    const k = cote / (2.0 * demi);
    const cx = r.cx,
      cy = r.cy + 3;
    const pt = (x: number, y: number): Pt => new Pt(cx + k * x, cy - k * y);
    const a = s.r_p / (s.e - 1.0);
    const f_max = Math.acosh(Math.min(1e6, ((demi * 1.5) / a + 1.0) / s.e));
    p.save();
    p.setClipRect(r);
    const pts: Pt[] = [];
    for (let j = 0; j <= 200; j++) {
      const [x, y] = ga.hyperbole(s, gm, -f_max + (2.0 * f_max * j) / 200);
      pts.push(pt(x, y));
    }
    p.setPen(dessin.stylo('accent2', 1.6));
    for (let j = 0; j + 1 < pts.length; j++) p.drawLine(pts[j]!.x, pts[j]!.y, pts[j + 1]!.x, pts[j + 1]!.y);
    dessin.disque(p, cx, cy, Math.max(3.0, rayon * k), COULEUR_PLANETE[pl]!);
    const n_ = Math.sqrt(gm / a ** 3);
    const t_max = (s.e * Math.sinh(f_max) - f_max) / n_;
    const f = ga.anomalie(s, gm, (2.0 * this.t - 1.0) * t_max);
    const [hx, hy] = ga.hyperbole(s, gm, f);
    const q = pt(hx, hy);
    dessin.disque(p, q.x, q.y, 4.0, 'accent3', 'texte');
    p.restore();
    const x0 = r.left + 14,
      y0 = r.bottom - 34;
    dessin.fleche(p, x0, y0, x0 + 40, y0, dessin.stylo('accent1', 1.6));
    dessin.texte(p, x0 + 46, y0, tr('anim_gravityassist_mouvement'), 'accent1', { centre: false, fond: true });
    dessin.fleche(p, x0, y0 + 6, x0, y0 + 24, dessin.stylo('soleil', 1.6), 6.0);
    dessin.texte(p, x0 + 8, y0 + 18, tr('anim_gravityassist_vers_soleil'), 'doux', { centre: false, fond: true });
  }

  private vitesses(p: Peintre, r: Rect, s: ga.Survol): void {
    const vmax = Math.max(Math.hypot(s.v_in[0], s.v_in[1]), Math.hypot(s.v_out[0], s.v_out[1]), s.V + this.v_inf.value());
    const k = Math.min(r.w - 20, (r.h - 20) * 2.0) / (2.0 * vmax);
    const ox = r.left + r.w / 2.0 - (k * s.V) / 2.0,
      oy = r.cy + 8;
    const pt = (vx: number, vy: number): Pt => new Pt(ox + k * vx, oy - k * vy);
    const V = s.V;
    p.save();
    p.setClipRect(r);
    p.setBrush(null);
    p.setPen(dessin.stylo('grille', 1.0, 0.9, true));
    const cV = pt(V, 0.0);
    p.drawEllipse(cV.x, cV.y, k * this.v_inf.value(), k * this.v_inf.value());
    dessin.fleche(p, ox, oy, cV.x, cV.y, dessin.stylo('accent1', 2.0));
    for (const [cle, v, coul] of [['in', s.v_in, 'accent2'], ['out', s.v_out, 'accent3']] as [string, ga.V2, string][]) {
      const q = pt(v[0], v[1]);
      dessin.fleche(p, ox, oy, q.x, q.y, dessin.stylo(coul, 2.0));
      dessin.fleche(p, cV.x, cV.y, q.x, q.y, dessin.stylo(coul, 1.2, 0.7, true));
      dessin.etiquette(p, q.x, q.y, tr('anim_gravityassist_e_' + cle), coul);
    }
    const m = pt(V / 2.0, 0);
    dessin.etiquette(p, m.x, m.y, 'V', 'accent1');
    p.restore();
  }

  private vue_soleil(p: Peintre, r: Rect, s: ga.Survol): void {
    if (!this.c_soleil.isChecked()) {
      dessin.texte(p, r.cx, r.cy, tr('anim_gravityassist_cache'), 'doux');
      return;
    }
    const [, , a] = ga.planete(String(this.planete.currentData()));
    const oi = s.orb_in,
      oo = s.orb_out;
    const ext = Math.max(a, Math.min(4.0 * a, Math.max(Number.isFinite(oi.Q) ? oi.Q : 0.0, Number.isFinite(oo.Q) ? oo.Q : 0.0)));
    const demi = 1.08 * ext;
    const cote = Math.min(r.w, r.h - 6);
    const k = cote / (2.0 * demi);
    const cx = r.cx,
      cy = r.cy + 3;
    const pt = (x: number, y: number): Pt => new Pt(cx + k * x, cy - k * y);
    p.save();
    p.setClipRect(r);
    p.setBrush(null);
    p.setPen(dessin.stylo('grille', 1.0));
    p.drawEllipse(cx, cy, a * k, a * k);
    dessin.disque(p, cx, cy, 5.0, 'soleil');
    for (const [v, coul, pointille] of [[s.v_in, 'accent2', true], [s.v_out, 'accent3', false]] as [ga.V2, string, boolean][]) {
      const pts = conique_soleil(a, v, 1.5 * demi);
      p.setPen(dessin.stylo(coul, 1.6, null, pointille));
      for (let j = 0; j + 1 < pts.length; j++) {
        const q0 = pts[j],
          q1 = pts[j + 1];
        if (q0 && q1) {
          const A = pt(q0[0], q0[1]),
            B = pt(q1[0], q1[1]);
          p.drawLine(A.x, A.y, B.x, B.y);
        }
      }
    }
    const P = pt(a, 0);
    dessin.disque(p, P.x, P.y, 4.0, 'doux');
    p.restore();
    dessin.texte(p, r.left + 6, r.bottom - 10, tr('anim_gravityassist_legende_soleil'), 'doux', { centre: false, fond: true });
  }
}
