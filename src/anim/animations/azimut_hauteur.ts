/**
 * Azimuth/Altitude Demonstrator : le repère horizontal.  Une étoile à placer (curseurs ou souris) ; arcs de l'azimut
 * (le long de l'horizon depuis le nord, vers l'est) et de la hauteur (le long du vertical de l'étoile).
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import type { Peintre, Pt, Rect } from '../../noyau/peintre';
import { linspace, pmod } from '../../noyau/py';
import * as scenes from '../../noyau/scenes';
import { add, mul, type Pts } from '../../noyau/vec';
import { Animation, angle, type Bouton_souris, type Coche, type Reglage } from '../base';

export class AzimutHauteur extends Animation {
  static override ID = 'altazimuth';
  static override ANIMEE = false;

  vue3d!: dessin.Vue3D;
  az!: Reglage;
  alt!: Reglage;
  c_zenith!: Coche;
  c_nadir!: Coche;
  c_horizon!: Coche;
  c_meridien!: Coche;
  private pe: dessin.Peintre3D | null = null;

  override construire(): void {
    this.vue3d = this.vue(200.0, 28.0, 1.0, 89.0);
    this.az = this.curseur('azimut', 0.0, 360.0, 140.0, { dec: 1, unite: '°', cle_texte: 'anim_c_azimut' });
    this.alt = this.curseur('hauteur', -90.0, 90.0, 45.0, { dec: 1, unite: '°', cle_texte: 'anim_c_hauteur' });
    this.c_zenith = this.coche('zenith', false);
    this.c_nadir = this.coche('nadir', false);
    this.c_horizon = this.coche('horizon', false);
    this.c_meridien = this.coche('meridien', false);
    this.pe = null;
  }

  override valeurs(): [string, string][] {
    return [
      [tr('anim_c_azimut'), angle(this.az.value())],
      [tr('anim_c_hauteur'), angle(this.alt.value())],
      [tr('anim_altazimuth_distance_zenithale'), angle(90.0 - this.alt.value())],
    ];
  }

  override presser(pos: Pt, bouton: Bouton_souris): boolean {
    if (this.pe !== null) {
      const v = this.pe.depuis_ecran(pos.x, pos.y);
      const etoile = astro.vecteur_horizon(this.az.value(), this.alt.value());
      const { xs, ys, zs } = this.pe.ecran(etoile);
      if (v !== null && zs[0]! >= 0 && Math.abs(pos.x - xs[0]!) < 14 && Math.abs(pos.y - ys[0]!) < 14) {
        this._glisse = (q) => this.deplacer(q);
        return true;
      }
    }
    return super.presser(pos, bouton);
  }

  private deplacer(pos: Pt): void {
    const v = this.pe ? this.pe.depuis_ecran(pos.x, pos.y) : null;
    if (v !== null) {
      const [a, h] = scenes.az_alt_de_vecteur(v);
      this.az.setValue(a);
      this.alt.setValue(h);
    }
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const r = Math.min(rect.w, rect.h) * 0.4;
    const cx = rect.cx,
      cy = rect.cy + 6;
    this.zone_rotative(rect, this.vue3d);
    const az = this.az.value(),
      alt = this.alt.value();
    const etoile = astro.vecteur_horizon(az, alt);

    const scene = (pe: dessin.Peintre3D): void => {
      pe.courbe(dessin.cercle([0, 1, 0]), 'grille', 1.0, 0.8);
      if (this.c_meridien.isChecked()) pe.courbe(dessin.cercle([0, -1, 0], 90, 181, 0, 180, [1, 0, 0]), 'meridien', 2.0);
      pe.courbe(dessin.cercle([0, 0, 1], 90.0 - alt), 'grille', 1.0);
      const v = astro.vecteur_horizon(az, 0.0);
      const vert: Pts = linspace(-90, 90, 91).map((t) => {
        const c = Math.cos((t * Math.PI) / 180),
          s = Math.sin((t * Math.PI) / 180);
        return [c * v[0], c * v[1], c * v[2] + s];
      });
      pe.courbe(vert, 'grille', 1.0);
      if (Math.abs(az) > 1e-6) pe.courbe(linspace(0, az, 90).map((a) => astro.vecteur_horizon(a, 0.0)), 'arc1', 3.0);
      if (Math.abs(alt) > 1e-6) pe.courbe(linspace(0, alt, 60).map((h) => astro.vecteur_horizon(az, h)), 'arc2', 3.0);
      pe.point(etoile, 'etoile', 6.0, { bord: 'soleil' });
      pe.segment([0, 0, 1], [0, 0, 1.18], 'doux', 2.0);
      pe.segment([0, 0, -1], [0, 0, -1.18], 'doux', 2.0);
    };

    const pe = scenes.sphere_locale(p, this.vue3d, cx, cy, r, scene);
    this.pe = pe;
    pe.etiquette(add(astro.vecteur_horizon(az / 2, 0.0), [0, 0, -0.07]), angle(az), 'arc1');
    pe.etiquette(astro.vecteur_horizon(az + 12, alt / 2), angle(alt), 'arc2');
    if (this.c_zenith.isChecked()) pe.etiquette([0, 0, 1.25], tr('anim_altazimuth_zenith'));
    if (this.c_nadir.isChecked()) pe.etiquette([0, 0, -1.25], tr('anim_altazimuth_nadir'));
    if (this.c_horizon.isChecked())
      pe.etiquette(mul(astro.vecteur_horizon(pmod(200 + 180 - this.vue3d.az, 360), 0), 0.55), tr('anim_altazimuth_plan_horizon'), 'horizon');
    if (this.c_meridien.isChecked())
      pe.etiquette(mul(astro.vecteur_horizon(180.0, 35.0), 1.04), tr('anim_altazimuth_meridien'), 'meridien');
  }
}
