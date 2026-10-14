/**
 * Tidal Bulge Simulation : la Lune, le Soleil et la rotation de la Terre produisent les marées.  Vue du pôle nord : le
 * bourrelet d'eau (très exagéré) suit la marée d'équilibre statique ; flèches de la force de marée ; courbe du niveau
 * de la mer pour un observateur de l'équateur.  ζ(ψ) = (M / M⊕)(R / d)³ R (3 cos² ψ − 1) / 2.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { linspace, pmod } from '../../noyau/py';
import { Animation, type Coche, heures_minutes, nombre, type Reglage } from '../base';

const D_LUNE_M = astro.D_LUNE_KM * 1000.0;
const D_SOLEIL_M = astro.UA_KM * 1000.0;
const R = Math.PI / 180;

export function niveau(angle_point: number, elong: number, avec_soleil: boolean, decalage = 0.0): number {
  const a = angle_point - decalage;
  let h = astro.maree_equilibre(a - elong, astro.MASSE_LUNE_KG, D_LUNE_M);
  if (avec_soleil) h += astro.maree_equilibre(a, astro.MASSE_SOLEIL_KG, D_SOLEIL_M);
  return h;
}

export function type_de_maree(elong: number): string {
  const c = Math.abs(Math.cos(elong * R));
  return c > 0.92 ? 'vives' : c < 0.38 ? 'mortes' : 'moyennes';
}

export class Marees extends Animation {
  static override ID = 'tidesim';
  static JOURS_PAR_S = 0.25;

  c_soleil!: Coche;
  c_fleches!: Coche;
  decalage!: Reglage;
  exageration!: Reglage;
  t = 0.0;
  e0 = 0.0;

  override construire(): void {
    this.c_soleil = this.coche('soleil', false);
    this.c_fleches = this.coche('fleches', true);
    this.decalage = this.curseur('decalage', 0.0, 30.0, 0.0, { dec: 0, unite: '°' });
    this.exageration = this.curseur('exageration', 1.0, 10.0, 4.0, { dec: 1, unite: '×' });
    this.etat_initial();
  }

  override etat_initial(): void {
    this.t = 0.0;
    this.e0 = 0.0;
  }

  elong(): number {
    return pmod(this.e0 + (360.0 * this.t) / astro.MOIS_SYNODIQUE_J, 360.0);
  }

  heure(): number {
    return pmod(24.0 * this.t, 24.0);
  }

  angle_observateur(t: number | null = null): number {
    const h = pmod(24.0 * (t === null ? this.t : t), 24.0);
    return 15.0 * (h - 12.0);
  }

  override avancer(dt: number): void {
    this.t += dt * Marees.JOURS_PAR_S;
  }

  private niveau_obs(t: number): number {
    const e = pmod(this.e0 + (360.0 * t) / astro.MOIS_SYNODIQUE_J, 360.0);
    return niveau(this.angle_observateur(t), e, this.c_soleil.isChecked(), this.decalage.value());
  }

  override valeurs(): [string, string][] {
    const e = this.elong();
    const lune_seule = astro.maree_equilibre(0.0, astro.MASSE_LUNE_KG, D_LUNE_M) - astro.maree_equilibre(90.0, astro.MASSE_LUNE_KG, D_LUNE_M);
    const out: [string, string][] = [
      [tr('anim_c_heure'), heures_minutes(this.heure())],
      [tr('anim_lunar_applet_nom_phase'), tr('anim_phase_' + astro.nom_de_phase(e))],
      [tr('anim_tidesim_niveau'), `${nombre(100 * this.niveau_obs(this.t), 1)} cm`],
      [tr('anim_tidesim_marnage_lune'), `${nombre(100 * lune_seule, 1)} cm`],
      [tr('anim_tidesim_rapport'), nombre(astro.rapport_marees_soleil_lune(), 3)],
    ];
    if (this.c_soleil.isChecked()) out.push([tr('anim_tidesim_type'), tr('anim_tidesim_t_' + type_de_maree(e))]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const haut = rect.h * 0.7;
    this.terre(p, new Rect(rect.x, rect.y, rect.w, haut));
    this.courbe(p, dessin.cadre(p, new Rect(rect.x, rect.y + haut, rect.w, rect.h - haut), tr('anim_tidesim_courbe')));
  }

  private terre(p: Peintre, r: Rect): void {
    const cx = r.cx,
      cy = r.cy;
    const rt = Math.min(r.w, r.h) * 0.24;
    const e = this.elong();
    const avec_soleil = this.c_soleil.isChecked();
    const amp_ref = astro.maree_equilibre(0.0, astro.MASSE_LUNE_KG, D_LUNE_M) * 1.46;
    const k = (rt * 0.08 * this.exageration.value()) / amp_ref;
    const pts = linspace(0.0, 360.0, 181).map((x) => {
      const rr = rt * 1.08 + k * niveau(x, e, avec_soleil, this.decalage.value());
      return new Pt(cx + rr * Math.cos(x * R), cy - rr * Math.sin(x * R));
    });
    p.setPen(dessin.stylo('equateur', 1.4));
    p.setBrush(dessin.c('equateur', 0.35));
    p.drawPolygon(pts);
    dessin.disque(p, cx, cy, rt, 'sol');
    p.setPen(null);
    p.setBrush(dessin.c('nuit', 0.55));
    p.drawPie(new Rect(cx - rt, cy - rt, 2 * rt, 2 * rt), 90 * 16, 180 * 16);
    const o = this.angle_observateur() * R;
    dessin.disque(p, cx + rt * Math.cos(o), cy - rt * Math.sin(o), 4.5, 'accent3', 'texte');
    const dm = Math.min(r.w * 0.46, r.h * 0.46);
    const em = e * R;
    p.setPen(dessin.stylo('grille', 1.0, 0.6, true));
    p.setBrush(null);
    p.drawEllipse(cx, cy, dm, dm);
    dessin.disque(p, cx + dm * Math.cos(em), cy - dm * Math.sin(em), Math.max(6.0, rt * 0.27), 'lune');
    for (const kk of [-0.5, 0.0, 0.5])
      dessin.fleche(p, r.right - 6, cy + kk * rt * 2, r.right - 46, cy + kk * rt * 2, dessin.stylo('soleil', 1.2, avec_soleil ? 0.8 : 0.35), 6);
    if (this.c_fleches.isChecked()) this.fleches(p, cx, cy, rt, e, avec_soleil);
  }

  /** Force de marée en douze points de l'équateur : M/d³ (3 (r·u) u − r), somme Lune (+ Soleil). */
  private fleches(p: Peintre, cx: number, cy: number, rt: number, e: number, avec_soleil: boolean): void {
    const sources: [number, number][] = [[e, astro.MASSE_LUNE_KG / D_LUNE_M ** 3]];
    if (avec_soleil) sources.push([0.0, astro.MASSE_SOLEIL_KG / D_SOLEIL_M ** 3]);
    const ref = (astro.MASSE_LUNE_KG / D_LUNE_M ** 3) * 2;
    for (let x = 0; x < 360; x += 30) {
      const rv = [Math.cos(x * R), Math.sin(x * R)] as const;
      let fx = 0,
        fy = 0;
      for (const [a, c] of sources) {
        const u = [Math.cos(a * R), Math.sin(a * R)] as const;
        const d = rv[0] * u[0] + rv[1] * u[1];
        fx += c * (3 * d * u[0] - rv[0]);
        fy += c * (3 * d * u[1] - rv[1]);
      }
      fx *= (rt * 0.32) / ref;
      fy *= (rt * 0.32) / ref;
      const x0 = cx + rt * 0.72 * rv[0],
        y0 = cy - rt * 0.72 * rv[1];
      if (Math.hypot(fx, fy) > 1.5) dessin.fleche(p, x0, y0, x0 + fx, y0 - fy, dessin.stylo('accent1', 1.6), 5);
    }
  }

  private courbe(p: Peintre, r: Rect): void {
    const ts = linspace(this.t - 1.5, this.t + 1.5, 241);
    const hs = ts.map((t) => this.niveau_obs(t));
    const hmax = 0.9;
    const x0 = r.x + 30,
      x1 = r.right - 6;
    const ym = r.cy;
    const k = (r.h / 2 - 4) / hmax;
    p.setPen(dessin.stylo('grille', 1.0));
    p.drawLine(x0, ym, x1, ym);
    p.drawLine((x0 + x1) / 2, r.y, (x0 + x1) / 2, r.bottom);
    dessin.police(p, 0.75);
    for (const v of [-0.5, 0.5]) dessin.texte(p, x0 - 14, ym - k * v, nombre(v, 1), 'doux');
    dessin.texte(p, x0 - 14, r.y + 6, 'm', 'doux');
    dessin.police(p, 1 / 0.75);
    p.setPen(dessin.stylo('equateur', 1.8));
    p.setBrush(null);
    p.drawPolyline(hs.map((h, i) => new Pt(x0 + ((x1 - x0) * i) / (ts.length - 1), ym - k * h)));
    dessin.disque(p, (x0 + x1) / 2, ym - k * this.niveau_obs(this.t), 4, 'accent3');
  }
}
