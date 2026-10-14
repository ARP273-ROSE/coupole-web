/**
 * Ptolemaic Orbit of Mars : le modèle de l'Almageste.  La Terre au centre ; le centre du déférent est décalé ; le
 * centre de l'épicycle parcourt le déférent à vitesse angulaire constante vue du point équant en 1,881 an ; Mars
 * parcourt l'épicycle en un an.  Le Soleil tourne sur son propre cercle excentrique.  Paramètres de l'original.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, type Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import { Animation, angle, type Coche, nombre } from '../base';

const SEGMENTS = 175;
const PAS_TRACE = 0.02;

export class MarsPtolemee extends Animation {
  static override ID = 'marsorbit';
  static ANNEES_PAR_S = 0.3;
  static override LECTURE_AU_DEPART = false;

  t = 0.0;
  trace: [number, number][] = [];
  c_soleil!: Coche;
  c_cercles!: Coche;

  override construire(): void {
    this.t = 0.0;
    this.trace = [];
    this.c_soleil = this.coche('soleil', true);
    this.c_cercles = this.coche('cercles', true);
    this.remplir();
  }

  private ajouterTrace(pt: [number, number]): void {
    this.trace.push(pt);
    if (this.trace.length > SEGMENTS) this.trace.shift();
  }

  private remplir(): void {
    this.trace = [];
    const n = SEGMENTS;
    for (let i = 0; i < n; i++) this.ajouterTrace(astro.ptolemee_mars(this.t - (n - 1 - i) * PAS_TRACE).mars);
  }

  override etat_initial(): void {
    this.t = 0.0;
    this.remplir();
  }

  override avancer(dt: number): void {
    const t1 = this.t + dt * MarsPtolemee.ANNEES_PAR_S;
    const k = Math.trunc(t1 / PAS_TRACE) - Math.trunc(this.t / PAS_TRACE);
    for (let i = 1; i <= k; i++) this.ajouterTrace(astro.ptolemee_mars((Math.trunc(this.t / PAS_TRACE) + i) * PAS_TRACE).mars);
    this.t = t1;
  }

  override valeurs(): [string, string][] {
    const m = astro.ptolemee_mars(this.t);
    const lam_m = m.longitude;
    const [sx, sy] = astro.ptolemee_soleil(this.t);
    const lam_s = pmod((Math.atan2(sy, sx) * 180) / Math.PI + astro.PTOLEMEE_SOLEIL.apogee, 360.0);
    const dl = astro.mod180(astro.ptolemee_mars(this.t + 0.005).longitude - astro.ptolemee_mars(this.t - 0.005).longitude);
    return [
      [tr('anim_marsorbit_temps'), `${nombre(this.t, 2)} ${tr('anim_u_annees')}`],
      [tr('anim_marsorbit_long_mars'), angle(lam_m)],
      [tr('anim_marsorbit_long_soleil'), angle(lam_s)],
      [tr('anim_marsorbit_elongation'), angle(Math.abs(astro.mod180(lam_m - lam_s)))],
      [tr('anim_marsorbit_sens'), tr(dl < 0 ? 'anim_marsorbit_retro' : 'anim_marsorbit_direct')],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const P = astro.PTOLEMEE_MARS;
    const cx = rect.cx,
      cy = rect.cy;
    const k = (Math.min(rect.w, rect.h) * 0.46) / (P.R + P.e + P.r);
    const rot = (P.apogee * Math.PI) / 180;
    const ecr = (x: number, y: number, apogee = rot): Pt => {
      const xx = x * Math.cos(apogee) - y * Math.sin(apogee);
      const yy = x * Math.sin(apogee) + y * Math.cos(apogee);
      return new Pt(cx + k * xx, cy - k * yy);
    };
    const m = astro.ptolemee_mars(this.t);
    if (this.c_cercles.isChecked()) {
      const c = ecr(...m.deferent);
      p.setPen(dessin.stylo('grille', 1.2));
      p.setBrush(null);
      p.drawEllipse(c.x, c.y, P.R * k, P.R * k);
      const e = ecr(...m.centre);
      p.setPen(dessin.stylo('doux', 1.2));
      p.drawEllipse(e.x, e.y, P.r * k, P.r * k);
      p.drawLineP(e, ecr(...m.mars));
      const q = ecr(...m.equant);
      p.setPen(dessin.stylo('accent2', 1.0, 0.7, true));
      p.drawLineP(q, e);
      dessin.disque(p, q.x, q.y, 3, 'accent2');
      dessin.texte(p, q.x + 8, q.y + 12, tr('anim_marsorbit_equant'), 'accent2', { centre: false });
      dessin.disque(p, c.x, c.y, 2.5, 'grille');
    }
    const pts = this.trace;
    const n = pts.length;
    for (let i = 1; i < n; i++) {
      p.setPen(dessin.stylo('mars', 1.6, i / n));
      p.drawLineP(ecr(...pts[i - 1]!), ecr(...pts[i]!));
    }
    if (this.c_soleil.isChecked()) {
      const S = astro.PTOLEMEE_SOLEIL;
      const ks = ((k * 1.64) / 2.5) * (P.R / S.R);
      const [sx, sy] = astro.ptolemee_soleil(this.t);
      const a = (S.apogee * Math.PI) / 180;
      const pcx = cx + ks * (S.e * Math.cos(a)),
        pcy = cy - ks * (S.e * Math.sin(a));
      p.setPen(dessin.stylo('soleil', 1.0, 0.5));
      p.setBrush(null);
      p.drawEllipse(pcx, pcy, S.R * ks, S.R * ks);
      const xx = sx * Math.cos(a) - sy * Math.sin(a);
      const yy = sx * Math.sin(a) + sy * Math.cos(a);
      dessin.disque(p, cx + ks * xx, cy - ks * yy, 8, 'soleil');
    }
    const mp = ecr(...m.mars);
    dessin.disque(p, mp.x, mp.y, 6, 'mars');
    dessin.disque(p, cx, cy, 7, 'terre');
    dessin.texte(p, cx, cy + 16, tr('anim_shadowsim_terre'), 'doux');
    dessin.texte(p, mp.x + 10, mp.y - 10, tr('anim_marsorbit_mars'), 'mars', { centre: false });
  }
}
