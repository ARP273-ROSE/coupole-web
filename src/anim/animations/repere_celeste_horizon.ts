/**
 * Celestial and Horizon Systems Comparison : la même sphère vue de deux façons.  En repère céleste, le pôle nord
 * céleste est en haut et l'horizon incliné ; en repère local, le zénith est en haut et l'horizon horizontal.  Le
 * passage de l'un à l'autre est une rotation d'angle 90° − φ autour de l'axe est-ouest ; « Basculer » l'anime.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import type { Peintre, Rect } from '../../noyau/peintre';
import * as scenes from '../../noyau/scenes';
import { appliquerM, type M3, mul, type Pts, type V3 } from '../../noyau/vec';
import { Animation, angle, type Reglage } from '../base';

/** Rotation autour de l'axe ouest : amène le zénith (t = 0) vers le pôle (t = 90° − φ). */
export function rotation_est_ouest(angle_deg: number): M3 {
  const a = (angle_deg * Math.PI) / 180;
  return [
    [Math.cos(a), 0.0, -Math.sin(a)],
    [0.0, 1.0, 0.0],
    [Math.sin(a), 0.0, Math.cos(a)],
  ];
}

export class RepereCelesteHorizon extends Animation {
  static override ID = 'celestialhorizon';
  static SECONDES_BASCULE = 2.0;

  vue3d!: dessin.Vue3D;
  lat!: Reglage;
  melange!: Reglage;
  private cible: number | null = null;

  override construire(): void {
    this.vue3d = this.vue(200.0, 15.0);
    this.lat = this.curseur('latitude', -90.0, 90.0, 41.0, { dec: 1, unite: '°', cle_texte: 'anim_c_latitude' });
    this.melange = this.curseur('bascule', 0.0, 1.0, 0.0, { dec: 2 });
    this.bouton('anim_celestialhorizon_basculer', () => this.basculer());
    this.cible = null;
  }

  basculer(): void {
    this.cible = this.melange.value() > 0.5 ? 0.0 : 1.0;
    if (!this.en_lecture) this.basculer_lecture();
  }

  override avancer(dt: number): void {
    if (this.cible === null) return;
    const v = this.melange.value();
    const pas = dt / RepereCelesteHorizon.SECONDES_BASCULE;
    if (Math.abs(this.cible - v) <= pas) {
      this.melange.setValue(this.cible);
      this.cible = null;
      this.basculer_lecture();
    } else this.melange.setValue(this.cible > v ? v + pas : v - pas);
  }

  override valeurs(): [string, string][] {
    const lat = this.lat.value();
    return [
      [tr('anim_latsim_hauteur_pole'), angle(Math.abs(lat))],
      [tr('anim_celestialhorizon_rotation'), angle(90 - lat)],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    this.zone_rotative(rect, this.vue3d);
    const r = Math.min(rect.w, rect.h) * 0.4;
    const lat = this.lat.value();
    const t = this.melange.value();
    const rot = rotation_est_ouest(t * (90.0 - lat));
    const conv_eq = scenes.eq_vers_local(0.0, lat);
    const loc = (pts: Pts): Pts => appliquerM(rot, pts);
    const l1 = (v: V3): V3 => loc([v])[0]!;
    const e1 = (v: V3): V3 => conv_eq([v])[0]!;
    const pe = new dessin.Peintre3D(p, this.vue3d, rect.cx, rect.cy, r);
    pe.contour('grille', 'ciel', 0.25);
    pe.courbe(loc(dessin.cercle([0, 0, 1])), 'horizon', 2.5);
    pe.courbe(loc(conv_eq(dessin.cercle([0, 0, 1]))), 'equateur', 2.0);
    pe.courbe(loc(dessin.cercle([0, -1, 0], 90, 181, 0, 360, [1, 0, 0])), 'meridien', 1.2, 0.7);
    pe.segment(l1(e1([0, 0, -1.25])), l1(e1([0, 0, 1.25])), 'equateur', 1.6);
    pe.segment(l1([0, 0, 0]), l1([0, 0, 1.0]), 'horizon', 1.2, 0.7);
    pe.etiquette(l1([0, 0, 1.12]), tr('anim_altazimuth_zenith'), 'horizon');
    pe.etiquette(l1(e1([0, 0, 1.33])), tr('anim_radecdemo_l_pnc'), 'equateur');
    for (const [cle, az] of [['anim_pc_n', 0.0], ['anim_pc_e', 90.0], ['anim_pc_s', 180.0], ['anim_pc_o', 270.0]] as [string, number][])
      pe.etiquette(l1(mul(astro.vecteur_horizon(az, 0.0), 1.1)), tr(cle), 'horizon');
    dessin.texte(p, rect.x + 12, rect.y + 20, tr(t < 0.5 ? 'anim_celestialhorizon_titre_local' : 'anim_celestialhorizon_titre_celeste'), 'texte', { centre: false });
  }
}
