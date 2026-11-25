/**
 * Interférences et interférométrie : deux télescopes séparés d'une base B donnent des franges d'interfrange λ / B,
 * dont le contraste (la visibilité) baisse quand la source est résolue.  Jumeau de `animations/interferometrie.py`
 * de Coupole (calculs : `calc/interferometrie.ts`).
 */
import * as itf from '../../calc/interferometrie';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, Pt, Rect, rgb } from '../../noyau/peintre';
import { Animation, type Choix, type Coche, nombre, type Reglage } from '../base';
import { angle_sec } from './resolution';

const B_MIN = 0.0001,
  B_MAX = 1000.0;
const INCLINAISON = 0.2;

export function angle_mas(x: number): string {
  return angle_sec(x / 1000.0);
}

export function longueur(b: number): string {
  if (b < 0.01) return `${nombre(b * 1000.0, b < 0.001 ? 2 : 1)} mm`;
  return `${nombre(b, b < 10 ? 2 : b < 100 ? 1 : 0)} m`;
}

export class Interferometrie extends Animation {
  static override ID = 'interferometry';

  instrument!: Choix;
  base!: Reglage;
  diametre!: Reglage;
  lam!: Reglage;
  objet!: Choix;
  taille!: Reglage;
  dmag!: Reglage;
  c_balayer!: Coche;
  c_enveloppe!: Coche;
  t = 0.0;
  private instrument_applique: unknown = 'vlti_ut';
  private objet_applique: unknown = 'disque';

  override construire(): void {
    this.instrument = this.choix('instrument', [['anim_interferometry_i_libre', 'libre'], ...itf.INSTRUMENTS.map(([k]) => ['anim_interferometry_i_' + k, k] as [string, string])], 'vlti_ut');
    this.base = this.curseur('base', B_MIN, B_MAX, 130.0, { dec: 4, unite: 'm', log: true });
    this.diametre = this.curseur('diametre', 0.0001, 10.0, 8.2, { dec: 4, unite: 'm', log: true });
    this.lam = this.curseur('lambda', 350.0, 2400.0, 2200.0, { dec: 0, unite: 'nm' });
    this.objet = this.choix('objet', itf.OBJETS.map(([k]) => ['anim_interferometry_o_' + k, k] as [string, string]), 'disque');
    this.taille = this.curseur('taille', 0.1, 100.0, 5.0, { dec: 1, unite: 'mas', log: true });
    this.dmag = this.curseur('dmag', 0.0, 5.0, 0.0, { dec: 1 });
    this.c_balayer = this.coche('balayer', false);
    this.c_enveloppe = this.coche('enveloppe', true);
    this.instrument_applique = this.instrument.currentData();
    this.objet_applique = this.objet.currentData();
    this.t = 0.0;
  }

  override reglage_change(): void {
    if (this.instrument) {
      const k = this.instrument.currentData();
      if (k !== this.instrument_applique) {
        this.instrument_applique = k;
        for (const [cle, b, d] of itf.INSTRUMENTS) {
          if (cle === k) {
            this.base.setValue(b);
            this.diametre.setValue(d);
          }
        }
      }
    }
    if (this.objet) {
      const o = this.objet.currentData();
      if (o !== this.objet_applique) {
        this.objet_applique = o;
        for (const [cle, , taille, dm] of itf.OBJETS) {
          if (cle === o && cle !== 'point') {
            this.taille.setValue(taille);
            this.dmag.setValue(dm);
          }
        }
      }
    }
    super.reglage_change();
  }

  genre(): string {
    return itf.OBJETS.find(([k]) => k === this.objet.currentData())![1];
  }

  rapport(): number {
    return 10 ** (-0.4 * this.dmag.value());
  }

  v(): itf.Complexe {
    return itf.visibilite_complexe(this.genre(), this.taille.value(), this.base.value(), this.lam.value(), this.rapport());
  }

  axe_bases(): [number, number] {
    const b0 = itf.base_premier_zero(this.genre(), this.taille.value(), this.lam.value(), this.rapport());
    if (b0 === null) return [B_MIN, B_MAX];
    return [Math.max(B_MIN, b0 / 30.0), Math.min(B_MAX, b0 * 4.0)];
  }

  override avancer(dt: number): void {
    this.t += dt;
    if (this.c_balayer.isChecked()) {
      const [b0, b1] = this.axe_bases();
      const b = this.base.value() * 10 ** (0.12 * dt);
      this.base.setValue(b > b1 ? b0 : b);
    }
  }

  override valeurs(): [string, string][] {
    const b = this.base.value(),
      d = this.diametre.value(),
      lam = this.lam.value();
    const g = this.genre(),
      t = this.taille.value();
    const v = this.v();
    const mv = itf.module_c(v);
    const out: [string, string][] = [
      [tr('anim_interferometry_v_frange'), angle_mas(itf.interfrange_mas(b, lam))],
      [tr('anim_interferometry_v_un_telescope'), angle_mas(itf.resolution_mas(d, lam))],
      [tr('anim_interferometry_v_gain'), `× ${nombre(b / d, b / d < 100 ? 1 : 0)}`],
      [tr('anim_interferometry_v_visibilite'), `${nombre(mv, 3)} (${nombre(100 * mv, 0)} %)`],
    ];
    if (g === 'disque') {
      out.push([tr('anim_interferometry_v_phase'), tr(v[0] < 0 ? 'anim_interferometry_retournees' : 'anim_interferometry_centrees')]);
    } else if (g === 'couple') {
      const ph = mv > 1e-12 ? (-Math.atan2(v[1], v[0]) * 180) / Math.PI : 0.0;
      out.push([tr('anim_interferometry_v_phase'), tr('anim_interferometry_decalees', { x: nombre(ph, 0) })]);
    }
    const b0 = itf.base_premier_zero(g, t, lam, this.rapport());
    if (b0 !== null) out.push([tr(g === 'disque' ? 'anim_interferometry_v_zero' : 'anim_interferometry_v_minimum'), longueur(b0)]);
    out.push([tr('anim_interferometry_v_verdict'), tr('anim_interferometry_' + itf.verdict(g, t, d, lam, mv))]);
    if (b < 0.01) out.push([tr('anim_interferometry_v_ecran'), `${nombre((lam * 1e-6) / b, 2)} mm`]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones_principale(rect, 2, 0.46);
    this.schema(p, dessin.cadre(p, z[0]!, tr('anim_interferometry_t_schema')));
    this.franges(p, dessin.cadre(p, z[1]!, tr('anim_interferometry_t_franges')));
    this.courbe_visibilite(p, dessin.cadre(p, z[2]!, tr('anim_interferometry_t_visibilite')));
  }

  private schema(p: Peintre, r: Rect): void {
    const g = this.genre();
    const w = r.w,
      h = r.h;
    const sol = r.bottom - 0.3 * h;
    const x1 = r.x + 0.18 * w,
      x2 = r.right - 0.18 * w;
    const demi_t = Math.max(6.0, Math.min(18.0, 0.05 * w));
    const sources: [number, string, boolean][] = [[INCLINAISON, 'accent1', false]];
    if (g === 'couple') sources.push([INCLINAISON + 0.12, 'accent2', true]);
    const espace = 0.11 * h;
    p.save();
    p.setClipRect(new Rect(r.x, r.y + 22, w, sol - r.y - 22));
    for (const [a, cle, pointille] of sources) {
      const ux = Math.sin(a),
        uy = Math.cos(a);
      const phase = (this.t * 0.6) % 1.0;
      for (let k = -2; k < 16; k++) {
        const s = (k + phase) * espace;
        const cx = x1 + ux * (s - 12 * espace);
        const cy = sol + uy * (s - 12 * espace);
        const lg = 1.4 * w;
        p.setPen(dessin.stylo(cle, 1.4, 0.55, pointille));
        p.drawLine(cx - uy * lg, cy + ux * lg, cx + uy * lg, cy - ux * lg);
      }
    }
    p.restore();
    const ux = Math.sin(INCLINAISON),
      uy = Math.cos(INCLINAISON);
    const delta = (x2 - x1) * ux;
    const pied = new Pt(x2 - ux * delta, sol - uy * delta);
    p.setPen(dessin.stylo('doux', 1.0, 0.8, true));
    p.drawLine(x1, sol, pied.x, pied.y);
    p.setPen(dessin.stylo('accent3', 2.2));
    p.drawLine(pied.x, pied.y, x2, sol);
    dessin.texte(p, pied.x - 52, (pied.y + sol) / 2, 'δ = B sin α', 'accent3', { fond: true });
    p.setPen(dessin.stylo('grille', 1.5));
    p.drawLine(r.x + 8, sol, r.right - 8, sol);
    for (const x of [x1, x2]) {
      p.setPen(dessin.stylo('texte', 2.0));
      p.setBrush(dessin.c('sphere', 0.9));
      p.drawPolygon([
        [x - demi_t, x + demi_t, x + demi_t * 0.45, x - demi_t * 0.45],
        [sol - 4, sol - 4, sol + 10, sol + 10],
      ]);
    }
    const yb = sol + 0.07 * h;
    p.setPen(dessin.stylo('texte', 1.2));
    dessin.fleche(p, (x1 + x2) / 2, yb, x1, yb, dessin.stylo('texte', 1.2), 6);
    dessin.fleche(p, (x1 + x2) / 2, yb, x2, yb, dessin.stylo('texte', 1.2), 6);
    dessin.texte(p, (x1 + x2) / 2, yb - 9, 'B = ' + longueur(this.base.value()), 'texte', { fond: true });
    const yr = r.bottom - 0.08 * h;
    const xc = (x1 + x2) / 2;
    p.setPen(dessin.stylo('accent1', 1.4, 0.8));
    for (const x of [x1, x2]) {
      p.drawLine(x, sol + 10, x, yr);
      p.drawLine(x, yr, xc + (x > xc ? 6 : -6), yr);
    }
    p.setPen(dessin.stylo('texte', 1.2));
    p.setBrush(dessin.c('sphere', 0.9));
    p.drawRect(new Rect(xc - 6, yr - 8, 12, 16));
    dessin.texte(p, xc, yr - 17, tr('anim_interferometry_recombinaison'), 'doux', { fond: true });
    dessin.texte(p, r.x + 14, r.y + 34, tr('anim_interferometry_vers_etoile'), 'doux', { centre: false });
  }

  private franges(p: Peintre, r: Rect): void {
    const b = this.base.value(),
      d = this.diametre.value(),
      lam = this.lam.value();
    const v = this.v();
    const [xs, ys, demi] = itf.coupe(b, d, lam, v);
    const en_sec = demi >= 1000.0;
    const k = en_sec ? 1000.0 : 1.0;
    const hb = Math.max(14.0, Math.min(40.0, 0.22 * r.h));
    const bande = new Rect(r.x + 40, r.y + 24, r.w - 46, hb);
    p.save();
    p.fillRect(bande, rgb(0, 0, 0));
    const n = xs.length;
    const bords = Array.from({ length: n + 1 }, (_, i) => Math.floor(bande.x + (i * bande.w) / n));
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, Math.min(255, Math.trunc(255 * ys[i]!)));
      if (a > 1) p.fillRect(new Rect(bords[i]!, bande.y, Math.max(1, bords[i + 1]! - bords[i]!), bande.h), rgb(255, 236, 190, a / 255));
    }
    p.restore();
    const r2 = new Rect(r.x, bande.bottom + 2, r.w, r.bottom - bande.bottom - 2);
    const ax = new Axes(r2, -demi / k, demi / k, 0.0, 1.08, false, false, [40, 6, 8, 30]).avec(p);
    const dk = Math.abs(demi / k);
    ax.fond(p, {
      titre_x: tr(en_sec ? 'anim_interferometry_axe_sec' : 'anim_interferometry_axe_mas'),
      titre_y: tr('anim_interferometry_axe_i'),
      fmt_x: (x) => nombre(x, dk >= 20 ? 0 : dk >= 2 ? 1 : 2),
    });
    if (this.c_enveloppe.isChecked()) {
      const env = xs.map((x) => 2.0 * itf.intensite(x, b, d, lam, [0, 0]));
      ax.courbe(xs.map((x, i) => [x / k, env[i]!] as [number, number]), 'doux', 1.0, 0.7, true);
      const mv = itf.module_c(v);
      for (const sg of [1.0, -1.0]) ax.courbe(xs.map((x, i) => [x / k, 0.5 * env[i]! * (1.0 + sg * mv)] as [number, number]), 'accent3', 1.0, 0.8, true);
    }
    ax.courbe(xs.map((x, i) => [x / k, ys[i]!] as [number, number]), 'accent1', 1.8);
  }

  private courbe_visibilite(p: Peintre, r: Rect): void {
    const g = this.genre(),
      t = this.taille.value(),
      lam = this.lam.value(),
      rap = this.rapport();
    const [b0, b1] = this.axe_bases();
    const ax = new Axes(r, b0, b1, 0.0, 1.05, true, false, [40, 8, 10, 30]).avec(p);
    ax.fond(p, { titre_x: tr('anim_interferometry_axe_b'), titre_y: tr('anim_interferometry_axe_v') });
    const n = 300;
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const b = b0 * (b1 / b0) ** (i / n);
      pts.push([b, itf.visibilite(g, t, b, lam, rap)]);
    }
    ax.courbe(pts, 'accent2', 2.0);
    const bz = itf.base_premier_zero(g, t, lam, rap);
    if (bz !== null && b0 <= bz && bz <= b1) ax.verticale(bz, 'doux', 1.0);
    const b = this.base.value();
    if (b0 <= b && b <= b1) {
      const vv = itf.visibilite(g, t, b, lam, rap);
      ax.verticale(b, 'accent3', 1.4, false);
      dessin.disque(p, ax.px(b), ax.py(vv), 4.5, 'accent3');
    } else {
      dessin.texte(p, b > b1 ? ax.r.right - 18 : ax.r.left + 18, ax.r.top + 10, b > b1 ? 'B →' : '← B', 'accent3', { fond: true });
    }
  }
}
