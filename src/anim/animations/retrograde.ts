/**
 * Retrograde Motion : la Terre (1 ua) rattrape Mars (1,524 ua) sur leurs orbites autour du Soleil ; la ligne de visée
 * Terre → Mars se projette sur les étoiles lointaines.  Autour de l'opposition, Mars semble reculer vers l'ouest
 * (mouvement rétrograde), entre deux stations.  Orbites circulaires ; l'inclinaison réelle de l'orbite de Mars
 * (1,85°) fait apparaître une boucle.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { alea, pmod } from '../../noyau/py';
import { Animation, angle, type Coche, nombre } from '../base';

const A_MARS = 1.524;
const INCLINAISON = 1.85;
const NOEUD = 49.6;
const T0 = -0.25;

interface Positions {
  terre: [number, number];
  mars: [number, number];
  lambda: number;
  beta: number;
}

/** Terre et Mars (héliocentriques) et coordonnées géocentriques de Mars (λ, β) au temps t (années). */
export function positions(t: number, inclinee: boolean): Positions {
  const [xt, yt] = astro.position_circulaire(1.0, 1.0, t);
  const pm = astro.periode_annees(A_MARS);
  const u = (2 * Math.PI * t) / pm;
  let xm = A_MARS * Math.cos(u),
    ym = A_MARS * Math.sin(u),
    zm = 0.0;
  if (inclinee) {
    const i = (INCLINAISON * Math.PI) / 180,
      om = (NOEUD * Math.PI) / 180;
    const arg = u - om;
    xm = A_MARS * (Math.cos(om) * Math.cos(arg) - Math.sin(om) * Math.sin(arg) * Math.cos(i));
    ym = A_MARS * (Math.sin(om) * Math.cos(arg) + Math.cos(om) * Math.sin(arg) * Math.cos(i));
    zm = A_MARS * Math.sin(arg) * Math.sin(i);
  }
  const dx = xm - xt,
    dy = ym - yt,
    dz = zm;
  const lam = pmod((Math.atan2(dy, dx) * 180) / Math.PI, 360.0);
  const beta = (Math.atan2(dz, Math.hypot(dx, dy)) * 180) / Math.PI;
  return { terre: [xt, yt], mars: [xm, ym], lambda: lam, beta };
}

const ETOILES: [number, number][] = (() => {
  const u = alea(3);
  return Array.from({ length: 40 }, () => [u(), u()] as [number, number]);
})();

export class Retrograde extends Animation {
  static override ID = 'retrograde';
  static ANNEES_PAR_S = 0.12;

  c_incl!: Coche;
  c_lignes!: Coche;
  t = T0;
  trace: [number, number][] = [];
  lignes: Positions[] = [];

  override construire(): void {
    this.c_incl = this.coche('inclinaison', true);
    this.c_lignes = this.coche('lignes', true);
    this.t = T0;
    this.trace = [];
    this.lignes = [];
  }

  override etat_initial(): void {
    this.t = T0;
    this.trace = [];
    this.lignes = [];
  }

  override reglage_change(): void {
    this.trace = [];
    super.reglage_change();
  }

  override avancer(dt: number): void {
    const t1 = this.t + dt * Retrograde.ANNEES_PAR_S;
    if (t1 > -T0 + 0.05) {
      this.etat_initial();
      return;
    }
    const n = Math.max(1, Math.trunc((t1 - this.t) / 0.002));
    for (let i = 1; i <= n; i++) {
      const tt = this.t + ((t1 - this.t) * i) / n;
      const pz = positions(tt, this.c_incl.isChecked());
      this.trace.push([pz.lambda, pz.beta]);
      if (this.trace.length > 400) this.trace.shift();
    }
    if (Math.trunc(t1 / 0.04) !== Math.trunc(this.t / 0.04)) {
      this.lignes.push(positions(t1, false));
      if (this.lignes.length > 12) this.lignes.shift();
    }
    this.t = t1;
  }

  private vitesse_lambda(): number {
    const a = positions(this.t - 0.001, this.c_incl.isChecked()).lambda;
    const b = positions(this.t + 0.001, this.c_incl.isChecked()).lambda;
    return astro.mod180(b - a) / (0.002 * astro.ANNEE_JULIENNE_J);
  }

  private message(): string {
    const ts = astro.retrogradation(A_MARS).demi_duree_annees!;
    if (this.t < -ts) return 'anim_retrograde_msg_est';
    if (this.t < ts) return 'anim_retrograde_msg_ouest';
    if (this.t < ts + 0.15) return 'anim_retrograde_msg_reprend';
    return 'anim_retrograde_msg_est';
  }

  override valeurs(): [string, string][] {
    const pz = positions(this.t, this.c_incl.isChecked());
    const r = astro.retrogradation(A_MARS);
    const v = this.vitesse_lambda();
    return [
      [tr('anim_retrograde_jours'), nombre(this.t * astro.ANNEE_JULIENNE_J, 0)],
      [tr('anim_retrograde_lambda'), angle(pz.lambda)],
      [tr('anim_retrograde_beta'), angle(pz.beta, 2)],
      [tr('anim_retrograde_vitesse'), `${nombre(v, 3)} °/${tr('anim_u_jour')}`],
      [tr('anim_retrograde_sens'), tr(v < 0 ? 'anim_marsorbit_retro' : 'anim_marsorbit_direct')],
      [tr('anim_retrograde_theorie'), tr('anim_retrograde_theorie_val', { j: nombre(r.duree_j!, 0), a: angle(r.amplitude!, 1) })],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const haut = new Rect(rect.x, rect.y, rect.w, rect.h * 0.62);
    const bas = new Rect(rect.x, haut.bottom, rect.w, rect.h - haut.h);
    const cx = haut.cx,
      cy = haut.bottom - 10;
    const k = Math.min(haut.w * 0.45, haut.h * 0.6) / A_MARS / 1.15;
    p.save();
    p.setClipRect(haut);
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(null);
    p.drawEllipse(cx, cy, k, k);
    p.drawEllipse(cx, cy, k * A_MARS, k * A_MARS);
    dessin.disque(p, cx, cy, 8, 'soleil');
    const pz = positions(this.t, false);
    const ecr = (x: number, y: number): Pt => new Pt(cx - k * y, cy - k * x);
    if (this.c_lignes.isChecked()) {
      this.lignes.forEach((l, i) => {
        const a = ecr(...l.terre),
          b = ecr(...l.mars);
        const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        p.setPen(dessin.stylo('mars', 1.0, 0.15 + (0.5 * (i + 1)) / this.lignes.length));
        p.drawLine(a.x, a.y, a.x + ((b.x - a.x) / d) * 2000, a.y + ((b.y - a.y) / d) * 2000);
      });
    }
    const a = ecr(...pz.terre),
      b = ecr(...pz.mars);
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    p.setPen(dessin.stylo('mars', 2.0));
    p.drawLine(a.x, a.y, a.x + ((b.x - a.x) / d) * 2000, a.y + ((b.y - a.y) / d) * 2000);
    dessin.disque(p, a.x, a.y, 6, 'terre');
    dessin.disque(p, b.x, b.y, 5, 'mars');
    p.restore();
    const r = dessin.cadre(p, bas, tr('anim_retrograde_ciel'));
    const lam0 = 0.0;
    const largeur_deg = 50.0;
    for (const [x, y] of ETOILES) dessin.disque(p, r.x + x * r.w, r.y + y * r.h, 1.2, 'etoile', null, 0.6);
    const ec = (lam: number, beta: number): Pt => {
      const dl = astro.mod180(lam - lam0);
      return new Pt(r.cx - (dl / largeur_deg) * r.w, r.cy - (beta / 6.0) * r.h * 0.45);
    };
    const pts = this.trace;
    for (let i = 1; i < pts.length; i++) {
      p.setPen(dessin.stylo('mars', 2.0, 0.3 + (0.7 * i) / pts.length));
      p.drawLineP(ec(...pts[i - 1]!), ec(...pts[i]!));
    }
    const pzi = positions(this.t, this.c_incl.isChecked());
    const q = ec(pzi.lambda, pzi.beta);
    dessin.disque(p, q.x, q.y, 5, 'mars');
    dessin.texte(p, r.x + 8, r.bottom - 8, tr('anim_pc_e'), 'doux', { centre: false });
    dessin.texte(p, r.right - 16, r.bottom - 8, tr('anim_pc_o'), 'doux', { centre: false });
    dessin.texte(p, haut.x + 12, haut.y + 20, tr(this.message()), 'texte', { centre: false, fond: true });
  }
}
