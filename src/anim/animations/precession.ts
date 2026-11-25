/**
 * La précession des équinoxes : le ciel autour du pôle de l'écliptique (étoiles polaires successives), le point vernal
 * qui recule le long du zodiaque, l'axe de la Terre qui décrit un cône.  Jumeau de `animations/precession.py` de
 * Coupole (calculs : `calc/precession.ts`).
 */
import * as pr from '../../calc/precession';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { pround } from '../../noyau/py';
import { Animation, angle, type Coche, nombre, type Reglage } from '../base';

const ANS_PAR_SECONDE = 1000.0;
const AN_MIN = -13000.0,
  AN_MAX = 15000.0;
const RAYON_CARTE = 52.0;
const ZODIAQUE = ['psc', 'ari', 'tau', 'gem', 'cnc', 'leo', 'vir', 'lib', 'sco', 'oph', 'sgr', 'cap', 'aqr'];

export function an(y: number): string {
  return String(y).replace('-', '−');
}

export function annee_texte(y: number): string {
  y = pround(y);
  if (y <= 0) return tr('anim_precession_av_jc', { a: an(y), b: an(1 - y) });
  return an(y);
}

export function nom_etoile(n: string): string {
  const k = pr.NOMS[n];
  return k ? `${tr('anim_precession_e_' + k)} (${n})` : n;
}

export class Precession extends Animation {
  static override ID = 'precession';

  annee!: Reglage;
  c_noms!: Coche;
  c_dates!: Coche;

  override construire(): void {
    this.annee = this.curseur('annee', AN_MIN, AN_MAX, 2026.0, { dec: 0 });
    this.c_noms = this.coche('noms', true);
    this.c_dates = this.coche('dates', true);
  }

  override avancer(dt: number): void {
    let y = this.annee.value() + dt * ANS_PAR_SECONDE;
    if (y > AN_MAX) y = AN_MIN + (y - AN_MAX);
    this.annee.setValue(y);
  }

  override valeurs(): [string, string][] {
    const y = this.annee.value();
    const [n, d] = pr.plus_proche(y);
    const cst = pr.constellation(pr.point_vernal(y));
    const i = ZODIAQUE.indexOf(cst);
    const suivante = ZODIAQUE[(i - 1 + ZODIAQUE.length) % ZODIAQUE.length]!;
    const y_suiv = pr.annee_entree(suivante, y);
    const decal = -pr.P_DEG_AN * (y - 2000.0);
    return [
      [tr('anim_precession_v_annee'), annee_texte(y)],
      [tr('anim_precession_v_periode'), tr('anim_precession_periode', { p: nombre(pr.PERIODE_ANS, 0), v: nombre(pr.P_ARCSEC_SIECLE / 100.0, 2) })],
      [tr('anim_precession_v_decalage'), angle(decal, 2)],
      [tr('anim_precession_v_polaire'), tr('anim_precession_a', { e: nom_etoile(n), d: angle(d, 2) })],
      [tr('anim_precession_v_polaris'), angle(pr.distance_au_pole('α UMi', y), 2)],
      [tr('anim_precession_v_vega'), angle(pr.declinaison('α Lyr', y), 1)],
      [tr('anim_precession_v_equinoxe'), tr('anim_cst_' + cst)],
      [tr('anim_precession_v_suivante'), tr('anim_precession_vers', { c: tr('anim_cst_' + suivante), a: annee_texte(y_suiv) })],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones_principale(rect, 2, 0.56);
    this.carte(p, dessin.cadre(p, z[0]!, tr('anim_precession_t_carte')));
    this.zodiaque(p, dessin.cadre(p, z[1]!, tr('anim_precession_t_zodiaque')));
    this.terre(p, dessin.cadre(p, z[2]!, tr('anim_precession_t_terre')));
  }

  private carte(p: Peintre, r: Rect): void {
    const R = 0.47 * Math.min(r.w, r.h - 8);
    const cx = r.cx,
      cy = r.cy + 4;
    const pt = (lam: number, beta: number): Pt => {
      const rr = ((90.0 - beta) / RAYON_CARTE) * R;
      const a = (lam * Math.PI) / 180;
      return new Pt(cx + rr * Math.cos(a), cy - rr * Math.sin(a));
    };
    p.save();
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(dessin.c('nuit', 0.5));
    p.drawEllipse(cx, cy, R, R);
    p.setBrush(null);
    const rp = (pr.EPS / RAYON_CARTE) * R;
    p.setPen(dessin.stylo('accent2', 1.2, 0.8, true));
    p.drawEllipse(cx, cy, rp, rp);
    dessin.etiquette(p, cx, cy, tr('anim_precession_pole_ecl'), 'doux');
    dessin.disque(p, cx, cy, 2.5, 'doux');
    if (this.c_dates.isChecked()) {
      for (let y = -10000; y <= 14000; y += 2000) {
        const q = pt(...pr.pole(y));
        dessin.disque(p, q.x, q.y, 2.2, 'accent2');
        dessin.texte(p, q.x + (q.x - cx) * 0.11, q.y + (q.y - cy) * 0.11, an(y), 'accent2');
      }
    }
    const y = this.annee.value();
    const vp = pr.vecteur(...pr.pole(y));
    for (const [n, l, b, m] of pr.etoiles_ecliptiques()) {
      if (90.0 - b > RAYON_CARTE) continue;
      const q = pt(l, b);
      dessin.disque(p, q.x, q.y, Math.max(1.2, 4.2 - 0.9 * m), 'etoile');
      if (this.c_noms.isChecked() && pr.NOMS[n] && pr.ecart(pr.vecteur(l, b), vp) > 4.0) dessin.etiquette(p, q.x, q.y, tr('anim_precession_e_' + pr.NOMS[n]), 'texte');
    }
    const q = pt(...pr.pole(y));
    const r10 = (10.0 / RAYON_CARTE) * R;
    p.setBrush(null);
    p.setPen(dessin.stylo('accent3', 1.0, 0.7, true));
    p.drawEllipse(q.x, q.y, r10, r10);
    p.setPen(dessin.stylo('accent3', 2.0));
    p.drawLine(q.x - 7, q.y, q.x + 7, q.y);
    p.drawLine(q.x, q.y - 7, q.x, q.y + 7);
    dessin.etiquette(p, q.x, q.y, tr('anim_precession_pole'), 'accent3');
    p.restore();
    if (r.h > 330) dessin.texte(p, r.left + 6, r.bottom - 10, tr('anim_precession_legende_carte'), 'doux', { centre: false, fond: true });
  }

  private zodiaque(p: Peintre, r: Rect): void {
    const x0 = r.left + 10,
      x1 = r.right - 10;
    const W = x1 - x0;
    const xc = (x0 + x1) / 2.0;
    const yb = r.cy + 6;
    const h = Math.min(34.0, r.h * 0.3);
    const vp = pr.point_vernal(this.annee.value());
    p.save();
    const lims = [...pr.LIMITES_2026].sort((a, b) => a[1] - b[1]);
    lims.forEach(([cle, l0], k) => {
      const l1 = lims[(k + 1) % lims.length]![1];
      const a0 = pr.pmod360(l0 - pr.P_DEG_AN * 26.0);
      const larg = pr.pmod360(l1 - l0);
      const rel = pr.pmod360(a0 - vp + 180.0) - 180.0;
      const xa = xc - (rel / 360.0) * W;
      const xb = xa - (larg / 360.0) * W;
      p.setPen(dessin.stylo('grille', 1.0));
      p.setBrush(dessin.c('sphere', k % 2 ? 0.5 : 0.25));
      for (const d of [-W, 0.0, W]) {
        const g = Math.max(xb + d, x0),
          dr = Math.min(xa + d, x1);
        if (dr - g > 0) {
          const rr = new Rect(g, yb - h / 2.0, dr - g, h);
          p.drawRect(rr);
          if (rr.w > 26) dessin.texte(p, rr.cx, yb, cle.charAt(0).toUpperCase() + cle.slice(1), 'doux');
        }
      }
    });
    p.setPen(dessin.stylo('accent3', 2.2));
    p.drawLine(xc, yb - h / 2.0 - 10, xc, yb + h / 2.0 + 4);
    dessin.texte(p, xc, yb - h / 2.0 - 18, tr('anim_precession_gamma'), 'accent3', { fond: true });
    p.restore();
    dessin.texte(p, r.left + 6, r.bottom - 10, tr('anim_precession_legende_zodiaque'), 'doux', { centre: false, fond: true });
  }

  private terre(p: Peintre, r: Rect): void {
    const y = this.annee.value();
    const lam_p = ((pr.pole(y)[0] - 90.0) * Math.PI) / 180;
    const eps = (pr.EPS * Math.PI) / 180;
    const R = 0.22 * Math.min(r.w, r.h);
    const cx = r.cx,
      cy = r.cy + 0.12 * r.h;
    const incl = (25.0 * Math.PI) / 180;
    const proj = (x: number, y_: number, z: number): Pt => new Pt(cx + R * x, cy - R * (z * Math.cos(incl) - y_ * Math.sin(incl)));
    const L = 2.0;
    p.save();
    p.setPen(dessin.stylo('doux', 1.0, 0.8, true));
    const a0 = proj(0, 0, -1.6),
      a1 = proj(0, 0, L + 0.3),
      a2 = proj(0, 0, L + 0.45);
    p.drawLine(a0.x, a0.y, a1.x, a1.y);
    dessin.texte(p, a2.x, a2.y, tr('anim_precession_normale'), 'doux');
    const pts: Pt[] = [];
    for (let t = 0; t <= 60; t++) {
      const u = (t / 60) * 2 * Math.PI;
      pts.push(proj(L * Math.sin(eps) * Math.cos(u), L * Math.sin(eps) * Math.sin(u), L * Math.cos(eps)));
    }
    p.setPen(dessin.stylo('accent2', 1.2, 0.8, true));
    for (let k = 0; k + 1 < pts.length; k++) p.drawLine(pts[k]!.x, pts[k]!.y, pts[k + 1]!.x, pts[k + 1]!.y);
    dessin.disque(p, cx, cy, R, 'terre');
    const tip = proj(L * Math.sin(eps) * Math.cos(lam_p), L * Math.sin(eps) * Math.sin(lam_p), L * Math.cos(eps));
    const bas = proj(-L * 0.8 * Math.sin(eps) * Math.cos(lam_p), -L * 0.8 * Math.sin(eps) * Math.sin(lam_p), -L * 0.8 * Math.cos(eps));
    p.setPen(dessin.stylo('accent3', 2.2));
    p.drawLine(bas.x, bas.y, tip.x, tip.y);
    dessin.etiquette(p, tip.x, tip.y, tr('anim_precession_axe'), 'accent3');
    p.restore();
  }
}
