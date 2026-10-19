/**
 * Sidereal Time and Hour Angle Demonstrator : sphère locale à la latitude φ ; le ciel tourne avec le temps sidéral
 * local (TSL).  L'angle horaire d'une étoile vaut H = TSL − α (compté vers l'ouest depuis le méridien).
 */
import { tslHeures, type Moment } from '../../calc/maintenant';
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import type { Peintre, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import * as scenes from '../../noyau/scenes';
import { appliquerM, mv, type Pts, type V3 } from '../../noyau/vec';
import { Animation, angle, type Coche, heures_minutes, nombre, type Reglage } from '../base';

/** H = TSL − α, ramené entre −12 h et +12 h (comme le simulateur d'origine). */
export function angle_horaire_h(tsl_h: number, ra_h: number): number {
  const h = pmod(tsl_h - ra_h + 24.0, 24.0);
  return h > 12.0 ? h - 24.0 : h;
}

export class AngleHoraire extends Animation {
  static override ID = 'siderealTimeAndHourAngleDemo';
  static VITESSE_H_PAR_S = 1.0;

  vue3d!: dessin.Vue3D;
  lat!: Reglage;
  tsl!: Reglage;
  ra!: Reglage;
  dec!: Reglage;
  c_arc!: Coche;

  static override TEMPS = ['tsl'] as const;

  /** « Maintenant » : date et heure de l'appareil (calc/maintenant.ts). */
  override maintenant(m: Moment): void {
    // temps sidéral local à la longitude retenue (« Ma position », sinon méridien du fuseau)
    this.poser(this.tsl, tslHeures(m.i.jj, m.lon));
    if (m.lat !== null) this.poser(this.lat, m.lat);
  }

  override construire(): void {
    this.vue3d = this.vue(160.0, 35.0, 7.0, 89.0);
    this.lat = this.curseur('latitude', -90.0, 90.0, 41.0, { dec: 1, unite: '°', cle_texte: 'anim_c_latitude' });
    this.tsl = this.curseur('tsl', 0.0, 24.0, 2.0, { dec: 2, unite: 'h', cle_texte: 'anim_c_tsl' });
    this.ra = this.curseur('ra', 0.0, 24.0, 4.0, { dec: 2, unite: 'h', cle_texte: 'anim_c_ra' });
    this.dec = this.curseur('dec', -90.0, 90.0, 30.0, { dec: 1, unite: '°', cle_texte: 'anim_c_dec' });
    this.c_arc = this.coche('arc', true); // 0.6.2 : arc de H affiché par défaut (un choix mémorisé est gardé)
  }

  override avancer(dt: number): void {
    this.tsl.setValue(pmod(this.tsl.value() + dt * AngleHoraire.VITESSE_H_PAR_S, 24.0));
  }

  override valeurs(): [string, string][] {
    const h = angle_horaire_h(this.tsl.value(), this.ra.value());
    const [az, alt] = astro.equatorial_vers_horizon(15 * h, this.dec.value(), this.lat.value());
    return [
      [tr('anim_c_tsl'), heures_minutes(this.tsl.value())],
      [tr('anim_c_ra'), heures_minutes(this.ra.value())],
      [tr('anim_siderealtimeandhourangledemo_h'), `${nombre(h, 2)} h (${angle(15 * h)})`],
      [tr('anim_c_azimut'), angle(az)],
      [tr('anim_c_hauteur'), angle(alt)],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const r = Math.min(rect.w, rect.h) * 0.4;
    const cx = rect.cx,
      cy = rect.cy + 6;
    this.zone_rotative(rect, this.vue3d);
    const lat = this.lat.value(),
      tsl = 15 * this.tsl.value();
    const ra = 15 * this.ra.value(),
      dec = this.dec.value();
    const h = angle_horaire_h(this.tsl.value(), this.ra.value());
    const m = astro.matrice_equatorial_vers_horizon(tsl, lat);
    const eq = (pts: Pts): Pts => appliquerM(m, pts);
    const eq1 = (v: V3): V3 => mv(m, v);

    const scene = (pe: dessin.Peintre3D): void => {
      pe.courbe(eq(scenes.cercle_horaire(90.0)), 'grille', 1.0, 0.6);
      pe.courbe(eq(scenes.cercle_horaire(270.0)), 'grille', 1.0, 0.6);
      pe.courbe(eq(dessin.cercle([0, 0, 1])), 'equateur', 1.5);
      pe.courbe(eq(scenes.cercle_horaire(0.0)), 'equateur', 1.5);
      pe.courbe(dessin.cercle([0, -1, 0], 90, 181, 0, 180, [1, 0, 0]), 'meridien', 2.0, 1.0, { repere_monde: true });
      pe.courbe(eq(scenes.cercle_horaire(ra)), 'grille', 1.2);
      pe.courbe(eq(scenes.cercle_declinaison(dec)), 'grille', 1.2);
      if (ra > 1e-6) pe.courbe(eq(scenes.arc_equateur(0.0, ra)), 'arc1', 3.0);
      if (Math.abs(dec) > 1e-6) pe.courbe(eq(scenes.cercle_horaire(ra, 0.0, dec, 60)), 'arc2', 3.0);
      if (this.c_arc.isChecked() && Math.abs(h) > 1e-6) pe.courbe(eq(scenes.arc_equateur(tsl, tsl - 15 * h, dec, 90)), 'accent1', 3.0);
      pe.point(eq1(astro.vecteur_equatorial(ra, dec)), 'etoile', 6.0, { bord: 'soleil' });
      pe.segment(eq1([0, 0, 1]), eq1([0, 0, 1.2]), 'equateur', 2.0);
      pe.segment(eq1([0, 0, -1]), eq1([0, 0, -1.2]), 'equateur', 2.0);
    };

    const pe = scenes.sphere_locale(p, this.vue3d, cx, cy, r, scene);
    pe.etiquette(eq1(astro.vecteur_equatorial(ra / 2, -6)), `${nombre(this.ra.value(), 1)} h`, 'arc1');
    pe.etiquette(eq1(astro.vecteur_equatorial(ra + 12, dec / 2)), angle(dec), 'arc2');
    if (this.c_arc.isChecked()) pe.etiquette(eq1(astro.vecteur_equatorial(tsl - 7.5 * h, dec + 6)), `${nombre(h, 1)} h`, 'accent1');
    pe.etiquette(eq1([0, 0, 1.28]), tr('anim_radecdemo_l_pnc'), 'equateur');
  }
}
