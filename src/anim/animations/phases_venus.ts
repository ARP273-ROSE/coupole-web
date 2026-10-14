/**
 * Phases of Venus et Ptolemaic Phases of Venus : l'aspect de Vénus au télescope, dans le système de Copernic et dans
 * celui de Ptolémée.  Chez Copernic, Vénus montre toutes les phases et sa taille apparente varie de 10″ à 60″ environ
 * — ce que Galilée a vu en 1610.  Chez Ptolémée, elle reste toujours entre la Terre et le Soleil : jamais plus qu'un
 * croissant.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, type Pt, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import { Animation, angle, type Bouton_souris, nombre, type Reglage } from '../base';
import { vu_de } from './positions_phases';

const A_VENUS = 0.723_332;
const R_VENUS_KM = 6_051.8;
const PTOLEMEE = { soleil: 290.0, deferent: 150.0, epicycle: 108.0, periode: 0.615_178 };
const R = Math.PI / 180;

/** Élongation de la planète vue de la Terre, signée : > 0 à l'est du Soleil. */
export function elongation_signee(planete: readonly number[], terre: readonly number[]): number {
  const lp = Math.atan2(planete[1]! - terre[1]!, planete[0]! - terre[0]!);
  const ls = Math.atan2(-terre[1]!, -terre[0]!);
  return astro.mod180((lp - ls) / R);
}

interface GeoVenus {
  venus: [number, number];
  terre: [number, number];
  soleil: [number, number];
  centre?: [number, number];
  distance: number;
  i: number;
  droite: boolean;
  elongation: number;
  diametre?: number;
}

export function copernic(angle_venus: number, angle_terre: number): GeoVenus {
  const v: [number, number] = [A_VENUS * Math.cos(angle_venus * R), A_VENUS * Math.sin(angle_venus * R)];
  const t: [number, number] = [Math.cos(angle_terre * R), Math.sin(angle_terre * R)];
  const d = Math.hypot(v[0] - t[0], v[1] - t[1]);
  const [i, droite] = vu_de(v, t);
  return {
    venus: v, terre: t, soleil: [0.0, 0.0], distance: d, i, droite, elongation: elongation_signee(v, t),
    diametre: 2 * (Math.asin(R_VENUS_KM / (d * astro.UA_KM)) / R) * 3600.0,
  };
}

export function ptolemee(angle_soleil: number, angle_venus: number): GeoVenus {
  const s = angle_soleil * R;
  const soleil: [number, number] = [PTOLEMEE.soleil * Math.cos(s), PTOLEMEE.soleil * Math.sin(s)];
  const c: [number, number] = [PTOLEMEE.deferent * Math.cos(s), PTOLEMEE.deferent * Math.sin(s)];
  const v: [number, number] = [c[0] + PTOLEMEE.epicycle * Math.cos(angle_venus * R), c[1] + PTOLEMEE.epicycle * Math.sin(angle_venus * R)];
  const i = astro.angle_de_phase(v, soleil, [0.0, 0.0]);
  const dx = v[0],
    dy = v[1];
  const droite = (soleil[0] - v[0]) * dy + (soleil[1] - v[1]) * -dx >= 0;
  return {
    venus: v, terre: [0.0, 0.0], soleil, centre: c, distance: Math.hypot(...v), i, droite,
    elongation: astro.mod180((Math.atan2(v[1], v[0]) - s) / R),
  };
}

abstract class Venus extends Animation {
  static ANNEES_PAR_S = 0.1;

  protected telescope(p: Peintre, r: Rect, g: GeoVenus, echelle: number): void {
    const rr = Math.min(r.w, r.h) * 0.42 * echelle;
    p.setPen(dessin.stylo('grille', 1.0, 0.5));
    p.setBrush(null);
    const m = Math.min(r.w, r.h) * 0.46;
    p.drawEllipse(r.cx, r.cy, m, m);
    dessin.disque_phase(p, r.cx, r.cy, Math.max(2.0, rr), g.i, g.droite ? 0.0 : 180.0, 'etoile', 'nuit');
  }

  protected valeurs_communes(g: GeoVenus): [string, string][] {
    const e = g.elongation;
    return [
      [tr('anim_c_elongation'), `${angle(Math.abs(e), 1)} ${tr(e > 0 ? 'anim_est' : 'anim_ouest')}`],
      [tr('anim_c_angle_phase'), angle(g.i, 1)],
      [tr('anim_c_eclairee'), `${nombre(100 * astro.fraction_eclairee_phase(g.i), 1)} %`],
    ];
  }
}

export class PhasesVenus extends Venus {
  static override ID = 'venusphases';

  av!: Reglage;
  at!: Reglage;
  private plan: [Rect, number, number, number] | null = null;

  override construire(): void {
    this.av = this.curseur('venus', 0.0, 360.0, 0.5 / R, { dec: 1, unite: '°' });
    this.at = this.curseur('terre', 0.0, 360.0, 0.0, { dec: 1, unite: '°' });
    this.plan = null;
  }

  override avancer(dt: number): void {
    const da = dt * Venus.ANNEES_PAR_S;
    this.av.setValue(pmod(this.av.value() + (360.0 * da) / A_VENUS ** 1.5, 360.0));
    this.at.setValue(pmod(this.at.value() + 360.0 * da, 360.0));
  }

  override valeurs(): [string, string][] {
    const g = copernic(this.av.value(), this.at.value());
    return [[tr('anim_c_distance'), `${nombre(g.distance, 3)} ua`], ...this.valeurs_communes(g), [tr('anim_venusphases_diametre'), `${nombre(g.diametre!, 1)}″`]];
  }

  override presser(pos: Pt, bouton: Bouton_souris): boolean {
    if (this.plan !== null && this.plan[0].contains(pos)) {
      const [, cx, cy, s] = this.plan;
      const g = copernic(this.av.value(), this.at.value());
      const dv = Math.hypot(pos.x - cx - s * g.venus[0], pos.y - cy + s * g.venus[1]);
      const dt_ = Math.hypot(pos.x - cx - s * g.terre[0], pos.y - cy + s * g.terre[1]);
      const cible = dv < dt_ ? this.av : this.at;
      this._glisse = (q) => cible.setValue(pmod((Math.atan2(this.plan![2] - q.y, q.x - this.plan![1]) * 180) / Math.PI, 360.0));
      return true;
    }
    return super.presser(pos, bouton);
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones(rect, 2, 0.8);
    const r = dessin.cadre(p, z[0]!, tr('anim_venusphases_orbites'));
    const g = copernic(this.av.value(), this.at.value());
    const cx = r.cx,
      cy = r.cy;
    const s = Math.min(r.w, r.h) * 0.44;
    this.plan = [r.copie(), cx, cy, s];
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(null);
    for (const a of [A_VENUS, 1.0]) p.drawEllipse(cx, cy, a * s, a * s);
    dessin.disque(p, cx, cy, Math.max(8.0, s * 0.07), 'soleil');
    const vx = cx + s * g.venus[0],
      vy = cy - s * g.venus[1];
    const tx = cx + s * g.terre[0],
      ty = cy - s * g.terre[1];
    p.setPen(dessin.stylo('accent2', 1.0, 0.6, true));
    p.drawLine(tx, ty, vx, vy);
    dessin.disque(p, vx, vy, 7, 'etoile', 'doux');
    dessin.disque(p, tx, ty, 7, 'terre', 'texte');
    dessin.texte(p, vx, vy - 15, tr('anim_planete_venus'), 'texte', { fond: true });
    dessin.texte(p, tx, ty - 15, tr('anim_planete_terre'), 'texte', { fond: true });
    const r2 = dessin.cadre(p, z[1]!, tr('anim_venusphases_telescope'));
    this.telescope(p, r2, g, (1.0 - A_VENUS) / g.distance);
  }
}

export class PhasesVenusPtolemee extends Venus {
  static override ID = 'ptolemaic';

  t = 0.0;

  override construire(): void {
    this.t = 0.0;
  }

  override etat_initial(): void {
    this.t = 0.0;
  }

  override avancer(dt: number): void {
    this.t += dt * Venus.ANNEES_PAR_S;
  }

  private g(): GeoVenus {
    return ptolemee(360.0 * this.t, (360.0 * this.t) / PTOLEMEE.periode);
  }

  override valeurs(): [string, string][] {
    const g = this.g();
    return [
      [tr('anim_ptolemaic_temps'), `${nombre(this.t, 2)} ${tr('anim_u_annees')}`],
      ...this.valeurs_communes(g),
      [tr('anim_ptolemaic_elong_max'), angle(Math.asin(PTOLEMEE.epicycle / PTOLEMEE.deferent) / R, 1)],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones(rect, 2, 0.8);
    const r = dessin.cadre(p, z[0]!, tr('anim_ptolemaic_modele'));
    const g = this.g();
    const cx = r.cx,
      cy = r.cy;
    const s = (Math.min(r.w, r.h) * 0.46) / PTOLEMEE.soleil;
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(null);
    for (const rr of [PTOLEMEE.deferent, PTOLEMEE.soleil]) p.drawEllipse(cx, cy, rr * s, rr * s);
    const ex = cx + s * g.centre![0],
      ey = cy - s * g.centre![1];
    p.setPen(dessin.stylo('accent2', 1.0, 0.8));
    p.drawEllipse(ex, ey, PTOLEMEE.epicycle * s, PTOLEMEE.epicycle * s);
    const sx = cx + s * g.soleil[0],
      sy = cy - s * g.soleil[1];
    p.setPen(dessin.stylo('soleil', 1.0, 0.5, true));
    p.drawLine(cx, cy, sx, sy);
    dessin.disque(p, sx, sy, Math.max(8.0, s * 18), 'soleil');
    dessin.disque(p, cx, cy, 7, 'terre', 'texte');
    dessin.disque(p, ex, ey, 2.5, 'accent2');
    const vx = cx + s * g.venus[0],
      vy = cy - s * g.venus[1];
    dessin.disque(p, vx, vy, 6, 'etoile', 'doux');
    dessin.texte(p, vx, vy - 14, tr('anim_planete_venus'), 'texte', { fond: true });
    const r2 = dessin.cadre(p, z[1]!, tr('anim_venusphases_telescope'));
    this.telescope(p, r2, g, (PTOLEMEE.deferent - PTOLEMEE.epicycle) / g.distance);
  }
}
