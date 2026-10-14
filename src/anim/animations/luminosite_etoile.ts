/**
 * Stellar Luminosity Calculator : la luminosité d'une étoile d'après son rayon et sa température.  Loi de
 * Stefan-Boltzmann L = 4π R² σ T⁴, soit L / L☉ = (R / R☉)² (T / T☉)⁴ ; température tirée du type spectral (table de
 * l'original, séquence principale).  Constantes de l'UAI : R☉ = 695 700 km, L☉ = 3,828 × 10²⁶ W, T☉ = 5 772 K.
 */
import * as hr from '../../calc/hr';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Couleur, type Peintre, type Rect } from '../../noyau/peintre';
import { Animation, nombre, type Reglage } from '../base';
import { scientifique } from './gravitation';

export class LuminositeEtoile extends Animation {
  static override ID = 'stellarlum';
  static override ANIMEE = false;

  r!: Reglage;
  sp!: Reglage;

  override construire(): void {
    this.r = this.curseur('rayon', 0.01, 100.0, 1.0, { dec: 2, unite: 'R☉', log: true });
    this.sp = this.curseur('type', 7.0, 66.0, 42.0, { dec: 1 });
  }

  grandeurs(): { r: number; t: number; l: number; w: number } {
    const r = this.r.value(),
      t = hr.temperature_de_type(this.sp.value());
    return { r, t, l: hr.luminosite_solaire(r, t), w: hr.puissance_w(r * hr.R_SOLEIL_M, t) };
  }

  override valeurs(): [string, string][] {
    const g = this.grandeurs();
    return [
      [tr('anim_stellarlum_type_v'), hr.nom_type(this.sp.value())],
      [tr('anim_stellarlum_temperature'), `${nombre(g.t, 0)} K (${nombre(g.t / hr.T_SOLEIL, 2)} T☉)`],
      [tr('anim_stellarlum_rayon_m'), `${scientifique(g.r * hr.R_SOLEIL_M)} m`],
      [tr('anim_stellarlum_lum'), `${scientifique(g.l)} L☉ = ${scientifique(g.w)} W`],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const g = this.grandeurs();
    const cx = rect.cx - rect.w * 0.12,
      cy = rect.cy;
    const rmax = Math.min(rect.w * 0.32, rect.h * 0.42);
    const taille = (r: number): number => 4 + ((rmax - 4) * (Math.log10(r) + 2)) / 4;
    p.setPen(null);
    p.setBrush(new Couleur(...hr.couleur_rvb(g.t)));
    p.drawEllipse(cx, cy, taille(g.r), taille(g.r));
    const sx = rect.right - rect.w * 0.14;
    dessin.disque(p, sx, cy, taille(1.0), new Couleur(...hr.couleur_rvb(hr.T_SOLEIL)));
    dessin.texte(p, sx, cy + taille(1.0) + 14, tr('anim_stellarlum_soleil'), 'doux');
    dessin.police(p, 1.15);
    const y = rect.bottom - 52;
    dessin.texte(p, rect.cx, y, `L / L☉ = (R / R☉)² (T / T☉)⁴ = (${nombre(g.r, 2)})² × (${nombre(g.t / hr.T_SOLEIL, 3)})⁴ = ${scientifique(g.l)}`);
    dessin.police(p, 1 / 1.15);
    dessin.texte(p, rect.cx, y + 24, `L = 4π R² σ T⁴ = ${scientifique(g.w)} W`, 'doux');
    dessin.texte(p, rect.x + 10, rect.y + 16, tr('anim_stellarlum_echelle'), 'doux', { centre: false });
  }
}
