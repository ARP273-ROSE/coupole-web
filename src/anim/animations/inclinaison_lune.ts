/**
 * Moon Inclination : l'orbite de la Lune est inclinée de 5,1° sur l'écliptique ; à la plupart des nouvelles et
 * pleines lunes, la Lune passe au-dessus ou au-dessous de l'alignement Soleil–Terre et il n'y a pas d'éclipse.  Les
 * éclipses n'arrivent que lorsque le Soleil est près de la ligne des nœuds : deux « saisons d'éclipses » par année
 * draconitique (346,62 jours).
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import { add, dot, mul, norme, sub, type V3 } from '../../noyau/vec';
import { Animation, angle, type Coche, nombre } from '../base';

const MOIS_DRACONITIQUE_J = 1.0 / (1.0 / astro.MOIS_SYNODIQUE_J + 1.0 / astro.ANNEE_DRACONITIQUE_J);
const R_T = astro.R_TERRE_KM,
  R_L = astro.R_LUNE_KM;
const TERRE = astro.cones_ombre(astro.R_SOLEIL_KM, R_T, astro.UA_KM);
const LUNE = astro.cones_ombre(astro.R_SOLEIL_KM, R_L, astro.UA_KM - astro.D_LUNE_KM);
const OMBRE_TERRE_KM = TERRE.rayon_ombre(astro.D_LUNE_KM);
const PENOMBRE_TERRE_KM = TERRE.rayon_penombre(astro.D_LUNE_KM);
const PENOMBRE_LUNE_KM = LUNE.rayon_penombre(astro.D_LUNE_KM);
const R = Math.PI / 180;

interface Geo {
  s: number;
  F: number;
  lune: V3;
  beta: number;
  elongation: number;
  axial: number;
  ecart_km: number;
}

export function geometrie(t: number, inclinaison = astro.INCLINAISON_LUNE): Geo {
  const s = (360.0 * t) / astro.ANNEE_DRACONITIQUE_J;
  const f = (360.0 * t) / MOIS_DRACONITIQUE_J;
  const fr = f * R,
    ir = inclinaison * R;
  const lune: V3 = [Math.cos(fr), Math.sin(fr) * Math.cos(ir), Math.sin(fr) * Math.sin(ir)];
  const u: V3 = [Math.cos(s * R), Math.sin(s * R), 0.0];
  const axial = dot(lune, u);
  const ecart = norme(sub(lune, mul(u, axial))) * astro.D_LUNE_KM;
  const beta = Math.asin(lune[2]) / R;
  const elong = Math.atan2(lune[1], lune[0]) / R - s;
  return { s: pmod(s, 360.0), F: pmod(f, 360.0), lune, beta, elongation: pmod(elong, 360.0), axial, ecart_km: ecart };
}

export function eclipse(g: Geo): string | null {
  if (g.axial > 0 && g.ecart_km < R_T + PENOMBRE_LUNE_KM) return 'soleil';
  if (g.axial < 0) {
    if (g.ecart_km < OMBRE_TERRE_KM + R_L) return 'lune_ombre';
    if (g.ecart_km < PENOMBRE_TERRE_KM + R_L) return 'lune_penombre';
  }
  return null;
}

export class InclinaisonLune extends Animation {
  static override ID = 'mooninc';
  static JOURS_PAR_S = 2.5;
  static override LECTURE_AU_DEPART = true;

  vue3d!: dessin.Vue3D;
  c_plan!: Coche;
  c_orbite!: Coche;
  c_tailles!: Coche;
  t = 0.0;

  override construire(): void {
    this.vue3d = this.vue(235.0, 22.0, -60.0, 89.0);
    this.c_plan = this.coche('plan', true);
    this.c_orbite = this.coche('orbite', true);
    this.c_tailles = this.coche('tailles', false);
    this.etat_initial();
  }

  override etat_initial(): void {
    this.t = 0.0;
  }

  override avancer(dt: number): void {
    this.t += dt * InclinaisonLune.JOURS_PAR_S;
  }

  override valeurs(): [string, string][] {
    const g = geometrie(this.t);
    const e = eclipse(g);
    let sn = astro.mod180(g.s);
    if (Math.abs(sn) > 90) sn = astro.mod180(sn + 180.0);
    return [
      [tr('anim_mooninc_jours'), nombre(this.t, 1)],
      [tr('anim_lunar_applet_nom_phase'), tr('anim_phase_' + astro.nom_de_phase(g.elongation))],
      [tr('anim_mooninc_latitude'), angle(g.beta, 2)],
      [tr('anim_mooninc_soleil_noeud'), angle(Math.abs(sn), 1)],
      [tr('anim_mooninc_eclipse'), tr('anim_mooninc_e_' + (e || 'aucune'))],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const haut = rect.h * 0.8;
    const z = dessin.zones_principale(new Rect(rect.x, rect.y, rect.w, haut), 1, 0.64);
    this.espace(p, dessin.cadre(p, z[0]!, tr('anim_mooninc_vue')));
    this.depuis_soleil(p, dessin.cadre(p, z[1]!, tr('anim_mooninc_depuis_soleil')));
    this.frise(p, dessin.cadre(p, new Rect(rect.x, rect.y + haut, rect.w, rect.h - haut)));
  }

  private espace(p: Peintre, r: Rect): void {
    this.zone_rotative(r, this.vue3d);
    const g = geometrie(this.t);
    const rr = Math.min(r.w, r.h) * 0.4;
    const pe = new dessin.Peintre3D(p, this.vue3d, r.cx, r.cy, rr);
    const k = this.c_tailles.isChecked() ? 3.0 : 1.0;
    const i = astro.INCLINAISON_LUNE * R;
    const orbite = dessin.cercle([0.0, -Math.sin(i), Math.cos(i)], 90.0, 181, 0, 360, [1, 0, 0]);
    const s = g.s * R;
    const u: V3 = [Math.cos(s), Math.sin(s), 0.0];
    const scene = (pe2: dessin.Peintre3D): void => {
      if (this.c_orbite.isChecked()) pe2.courbe(orbite, 'lune', 1.4, 0.9, { arriere: 'normal', profondeur: false });
      pe2.point(g.lune, 'lune', 4.0 * k, { bord: 'doux' });
    };
    const plan = (): void => {
      if (this.c_plan.isChecked()) pe.plan('ecliptique', 0.18, 1.25, 'ecliptique');
    };
    dessin.scene_en_deux_passes(pe, scene, plan);
    pe.segment([-1.3, 0, 0], [1.3, 0, 0], 'doux', 1.0, 0.7);
    pe.etiquette([1.38, 0, 0], tr('anim_mooninc_noeud_asc'), 'doux');
    pe.etiquette([-1.38, 0, 0], tr('anim_mooninc_noeud_desc'), 'doux');
    for (const d of [-0.25, 0.0, 0.25]) {
      const n = mul([-Math.sin(s), Math.cos(s), 0.0], d);
      const a = pe.ecran(add(mul(u, 1.9), n)),
        b = pe.ecran(add(mul(u, 1.45), n));
      dessin.fleche(p, a.xs[0]!, a.ys[0]!, b.xs[0]!, b.ys[0]!, dessin.stylo('soleil', 1.4, 0.85), 6);
    }
    pe.segment([0, 0, 0], mul(u, -1.25), 'ombre', 3.0, 0.5);
    const o = pe.ecran([0, 0, 0]);
    dessin.disque(p, o.xs[0]!, o.ys[0]!, 6.0 * k, 'terre', 'texte');
  }

  /** Vue depuis le Soleil, à l'échelle : la Terre, son ombre et la Lune quand elle est près de l'alignement. */
  private depuis_soleil(p: Peintre, r: Rect): void {
    const g = geometrie(this.t);
    const cx = r.cx,
      cy = r.cy;
    const demi = 6.0 * R_T;
    const k = Math.min(r.w, r.h) / 2 / demi;
    const s = g.s * R;
    const e1: V3 = [-Math.sin(s), Math.cos(s), 0.0];
    const e2: V3 = [0.0, 0.0, 1.0];
    const lx = dot(g.lune, e1) * astro.D_LUNE_KM;
    const ly = dot(g.lune, e2) * astro.D_LUNE_KM;
    const derriere = g.axial < 0;
    for (const [rad, cle, al] of [[PENOMBRE_TERRE_KM, 'penombre', 0.25], [OMBRE_TERRE_KM, 'umbra', 0.55]] as [number, string, number][]) {
      p.setPen(dessin.stylo('grille', 1.0, 0.6, true));
      p.setBrush(dessin.c(cle, al));
      p.drawEllipse(cx, cy, rad * k, rad * k);
    }
    const lune: [number, number] = [cx + lx * k, cy - ly * k];
    const visible = Math.abs(lx) < demi * 1.3 && Math.abs(ly) < demi * 1.3;
    if (visible && derriere) dessin.disque(p, lune[0], lune[1], R_L * k, 'lune', 'doux');
    dessin.disque(p, cx, cy, R_T * k, 'terre');
    if (visible && !derriere) dessin.disque(p, lune[0], lune[1], R_L * k, 'nuit', 'lune');
    const e = eclipse(g);
    if (e) dessin.texte(p, cx, r.bottom - 12, tr('anim_mooninc_e_' + e), 'accent1', { fond: true });
  }

  /** Frise du temps : ±60 jours, saisons d'éclipses, nouvelles et pleines lunes. */
  private frise(p: Peintre, r: Rect): void {
    const x0 = r.x + 6,
      x1 = r.right - 6;
    const portee = 60.0;
    const x_de = (t: number): number => x0 + ((x1 - x0) * (t - (this.t - portee))) / (2 * portee);
    const y0 = r.y + 6,
      y1 = r.bottom - 18;
    const demi = 18.5 / (360.0 / astro.ANNEE_DRACONITIQUE_J);
    const n0 = Math.floor((this.t - portee) / (astro.ANNEE_DRACONITIQUE_J / 2)) - 1;
    for (let n = n0; n < n0 + 4; n++) {
      const tc = (n * astro.ANNEE_DRACONITIQUE_J) / 2;
      const a = Math.max(x0, x_de(tc - demi)),
        b = Math.min(x1, x_de(tc + demi));
      if (b > a) {
        p.setPen(null);
        p.setBrush(dessin.c('accent1', 0.22));
        p.drawRect(new Rect(a, y0, b - a, y1 - y0));
      }
    }
    const m0 = Math.floor((this.t - portee) / astro.MOIS_SYNODIQUE_J) - 1;
    for (let m = m0; m < m0 + 6; m++) {
      for (const [frac, cle] of [[0.0, 'nuit'], [0.5, 'lune']] as [number, string][]) {
        const x = x_de((m + frac) * astro.MOIS_SYNODIQUE_J);
        if (x0 <= x && x <= x1) dessin.disque(p, x, (y0 + y1) / 2, 5, cle, 'doux');
      }
    }
    p.setPen(dessin.stylo('accent3', 2.0));
    p.drawLine(x_de(this.t), y0 - 2, x_de(this.t), y1 + 2);
    dessin.police(p, 0.8);
    dessin.texte(p, x0, r.bottom - 6, tr('anim_mooninc_frise'), 'doux', { centre: false });
    dessin.police(p, 1 / 0.8);
  }
}
