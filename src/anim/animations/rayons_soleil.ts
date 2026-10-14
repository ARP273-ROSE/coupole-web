/**
 * Sun's Rays Simulator : la Terre vue de côté, les rayons du Soleil arrivent parallèles.  Le rayon le plus direct
 * tombe à la latitude δ☉ : entre les tropiques au fil de l'année ; au-delà des cercles polaires, jour ou nuit polaire
 * autour des solstices.  Une année dure 30 s à la vitesse ×1.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import { Animation, angle, type Coche, date_du_jour, type Reglage } from '../base';

const ANNEE = 2026;
const EPS = astro.obliquite_moyenne(astro.jj_jour_de_l_annee(ANNEE, 0));
const TOLERANCE_J = 8;

/** Jours (0 = 1er janvier) des équinoxes et solstices : λ☉ = 0, 90, 180, 270° (dichotomie). */
export function jours_remarquables(annee = ANNEE): Record<string, number> {
  const out: Record<string, number> = {};
  const departs: Record<number, number> = { 0: 60.0, 90: 150.0, 180: 245.0, 270: 335.0 };
  for (const [cle, cible] of [['equinoxe_mars', 0.0], ['solstice_juin', 90.0], ['equinoxe_sept', 180.0], ['solstice_dec', 270.0]] as [string, number][]) {
    let lo = departs[cible]!;
    let hi = lo + 40.0;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (astro.mod180(astro.soleil_jour(annee, mid).lambda - cible) < 0) lo = mid;
      else hi = mid;
    }
    out[cle] = (lo + hi) / 2;
  }
  return out;
}

const REMARQUABLES = jours_remarquables();

export class RayonsSoleil extends Animation {
  static override ID = 'sunsrays';
  static JOURS_PAR_S = 365.0 / 30.0;

  jour!: Reglage;
  c_cercles!: Coche;

  override construire(): void {
    this.jour = this.curseur('jour', 0.0, 364.0, 79.0, { dec: 0, cle_texte: 'anim_c_jour' });
    this.c_cercles = this.coche('cercles', true);
  }

  override avancer(dt: number): void {
    this.jour.setValue(pmod(this.jour.value() + dt * RayonsSoleil.JOURS_PAR_S, 365.0));
  }

  private special(jour: number): [string | null, number] {
    for (const [cle, j] of Object.entries(REMARQUABLES)) if (Math.abs(jour - j) < TOLERANCE_J) return [cle, 1.0 - Math.abs(jour - j) / TOLERANCE_J];
    return [null, 0.0];
  }

  override valeurs(): [string, string][] {
    const d = astro.soleil_jour(ANNEE, this.jour.value() + 0.5).delta;
    const ns = tr(d >= 0 ? 'anim_pc_n' : 'anim_pc_s');
    const out: [string, string][] = [
      [tr('anim_c_date'), date_du_jour(this.jour.value())],
      [tr('anim_sunsrays_latitude'), `${angle(Math.abs(d), 2)} ${ns}`],
      [tr('anim_sunsrays_jour_polaire'), `${angle(90 - Math.abs(d), 2)} ${ns}`],
    ];
    const [cle] = this.special(this.jour.value());
    if (cle) out.push([tr('anim_sunsrays_moment'), tr('anim_sunsrays_' + cle)]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const d = astro.soleil_jour(ANNEE, this.jour.value() + 0.5).delta;
    const ray = Math.min(rect.w * 0.32, rect.h * 0.4);
    const cx = rect.cx + rect.w * 0.08,
      cy = rect.cy;
    for (let k = -9; k < 10; k++) {
      const y = cy + (k * ray) / 8;
      if (Math.abs(k) === 0) continue;
      const x_fin = Math.abs(y - cy) < ray ? cx - Math.sqrt(Math.max(0.0, ray * ray - (y - cy) ** 2)) : cx + ray * 1.3;
      p.setPen(dessin.stylo('soleil', 1.0, 0.45));
      p.drawLine(rect.x + 10, y, x_fin, y);
    }
    dessin.disque(p, cx, cy, ray, 'terre');
    p.setPen(null);
    p.setBrush(dessin.c('nuit', 0.7));
    p.drawPie(new Rect(cx - ray, cy - ray, 2 * ray, 2 * ray), -90 * 16, 180 * 16);
    p.save();
    p.translate(cx, cy);
    p.rotate(-d);
    const lignes: [number, string, string][] = [
      [0.0, 'equateur', 'anim_sunsrays_equateur'], [EPS, 'accent1', 'anim_sunsrays_tropique_cancer'], [-EPS, 'accent1', 'anim_sunsrays_tropique_capricorne'],
    ];
    if (this.c_cercles.isChecked())
      lignes.push([90 - EPS, 'accent2', 'anim_sunsrays_cercle_arctique'], [-(90 - EPS), 'accent2', 'anim_sunsrays_cercle_antarctique']);
    dessin.police(p, 0.8);
    for (const [l, cle, lib] of lignes) {
      const y = -ray * Math.sin((l * Math.PI) / 180);
      const x = ray * Math.cos((l * Math.PI) / 180);
      p.setPen(dessin.stylo(cle, 1.5, 0.9));
      p.drawLine(-x, y, x, y);
      dessin.texte(p, x + 6, y, tr(lib), cle, { centre: false });
    }
    dessin.police(p, 1 / 0.8);
    p.setPen(dessin.stylo('texte', 2.0));
    p.drawLine(0, -ray * 1.2, 0, ray * 1.2);
    dessin.texte(p, 0, -ray * 1.27, tr('anim_pc_n'), 'doux');
    p.restore();
    p.setPen(dessin.stylo('soleil', 3.0));
    p.drawLine(rect.x + 10, cy, cx - ray, cy);
    dessin.disque(p, cx - ray, cy, 5, 'soleil', 'fond');
    dessin.texte(p, cx - ray - 10, cy - 14, `${angle(Math.abs(d), 1)} ${tr(d >= 0 ? 'anim_pc_n' : 'anim_pc_s')}`, 'soleil', { centre: false, fond: true });
    dessin.police(p, 1.15, true);
    dessin.texte(p, rect.x + 14, rect.y + 24, date_du_jour(this.jour.value()), 'texte', { centre: false });
    const [cle, force] = this.special(this.jour.value());
    if (cle) dessin.texte(p, rect.x + 14, rect.y + 48, tr('anim_sunsrays_' + cle), 'accent1', { centre: false, alpha: Math.max(0.25, force) });
    dessin.police(p, 1 / 1.15);
  }
}
