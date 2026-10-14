/**
 * Moon Phases and the Horizon Diagram : relier la phase de la Lune, l'heure et la position de la Lune dans le ciel.
 * Comme dans l'original, le Soleil et la Lune sont sur l'équateur céleste et occupent l'une des huit positions
 * repérées (de 3 h en 3 h) : la position du Soleil donne l'heure, l'écart entre les deux donne la phase.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import type { Peintre, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import * as scenes from '../../noyau/scenes';
import { appliquerM, mv } from '../../noyau/vec';
import { Animation, angle, type Coche, heures_minutes, type Reglage } from '../base';

const POSITIONS = 8;

export function ascension_droite(position: number): number {
  return 6.0 - 3.0 * (position - 1.0);
}

export function heure_du_soleil(position_soleil: number): number {
  return pmod(6.0 + 3.0 * (position_soleil - 1.0), 24.0);
}

export function elongation(position_soleil: number, position_lune: number): number {
  return pmod(15.0 * (ascension_droite(position_lune) - ascension_droite(position_soleil)), 360.0);
}

export class LuneHorizon extends Animation {
  static override ID = 'positionsdemonstrator';
  static override ANIMEE = false;

  vue3d!: dessin.Vue3D;
  ps!: Reglage;
  pm!: Reglage;
  lat!: Reglage;
  c_reperes!: Coche;
  c_bande!: Coche;
  c_heure!: Coche;
  c_phase!: Coche;

  override construire(): void {
    this.vue3d = this.vue(200.0, 25.0, 7.0, 89.0);
    this.ps = this.curseur('soleil', 1.0, POSITIONS, 4.0, { dec: 0 });
    this.pm = this.curseur('lune', 1.0, POSITIONS, 2.0, { dec: 0 });
    this.lat = this.curseur('latitude', -90.0, 90.0, 41.0, { dec: 1, unite: '°', cle_texte: 'anim_c_latitude' });
    this.c_reperes = this.coche('reperes', true);
    this.c_bande = this.coche('bande', false);
    this.c_heure = this.coche('heure', true);
    this.c_phase = this.coche('phase', true);
  }

  private ciel(): [number, number, number, number] {
    const lat = this.lat.value();
    const hs = -15.0 * ascension_droite(this.ps.value());
    const hm = -15.0 * ascension_droite(this.pm.value());
    const [az_s, alt_s] = astro.equatorial_vers_horizon(hs, 0.0, lat);
    const [az_m, alt_m] = astro.equatorial_vers_horizon(hm, 0.0, lat);
    return [az_s, alt_s, az_m, alt_m];
  }

  override valeurs(): [string, string][] {
    const e = elongation(this.ps.value(), this.pm.value());
    const [, alt_s, , alt_m] = this.ciel();
    const out: [string, string][] = [];
    if (this.c_heure.isChecked()) out.push([tr('anim_c_heure'), heures_minutes(heure_du_soleil(this.ps.value()))]);
    if (this.c_phase.isChecked()) out.push([tr('anim_lunar_applet_nom_phase'), tr('anim_phase_' + astro.nom_de_phase(e))]);
    out.push(
      [tr('anim_c_elongation'), angle(e <= 180 ? e : 360 - e, 0)],
      [tr('anim_lunar_applet_h_soleil'), angle(alt_s)],
      [tr('anim_lunar_applet_h_lune'), angle(alt_m)],
    );
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = rect.w > rect.h * 1.1 ? dessin.zones_principale(rect, 1, 0.7) : dessin.zones(rect, 2, 10);
    const r = dessin.cadre(p, z[0]!, tr('anim_positionsdemonstrator_ciel'));
    this.zone_rotative(r, this.vue3d);
    const rr = Math.min(r.w, r.h) * 0.42;
    const cx = r.cx,
      cy = r.cy + 6;
    const lat = this.lat.value();
    const m = astro.matrice_equatorial_vers_horizon(0.0, lat);
    const [az_s, alt_s, az_m, alt_m] = this.ciel();
    const soleil = astro.vecteur_horizon(az_s, alt_s);
    const lune = astro.vecteur_horizon(az_m, alt_m);
    const e = elongation(this.ps.value(), this.pm.value());
    const scene = (pe: dessin.Peintre3D): void => {
      if (this.c_bande.isChecked()) for (const d of [-30.0, 30.0]) pe.courbe(appliquerM(m, scenes.cercle_declinaison(d)), 'ecliptique', 1.0, 0.6);
      pe.courbe(appliquerM(m, dessin.cercle([0, 0, 1])), 'equateur', 1.6, 0.9);
      if (this.c_reperes.isChecked()) {
        for (let k = 1; k <= POSITIONS; k++) {
          const v = mv(m, astro.vecteur_equatorial(15.0 * ascension_droite(k), 0.0));
          pe.point(v, 'doux', 3.0, { repere_monde: true });
          pe.etiquette(mv(m, astro.vecteur_equatorial(15.0 * ascension_droite(k), 12.0)), String(k), 'doux', true, false);
        }
      }
      pe.point(soleil, 'soleil', 9.0, { repere_monde: true });
      pe.point(lune, 'lune', 8.0, { bord: 'doux', repere_monde: true });
    };
    scenes.sphere_locale(p, this.vue3d, cx, cy, rr, scene, alt_s > 0 ? 'ciel' : 'nuit');
    const r2 = dessin.cadre(p, z[1]!, tr('anim_positionsdemonstrator_phase'));
    if (this.c_phase.isChecked()) {
      const rl = Math.min(r2.w, r2.h) * 0.32;
      dessin.phase_lune(p, r2.cx, r2.cy - 10, rl, e);
      dessin.texte(p, r2.cx, r2.cy + rl + 6, tr('anim_phase_' + astro.nom_de_phase(e)), 'doux');
    }
    if (this.c_heure.isChecked()) {
      dessin.police(p, 1.3, true);
      dessin.texte(p, r2.cx, r2.bottom - 18, heures_minutes(heure_du_soleil(this.ps.value())));
      dessin.police(p, 1 / 1.3);
    }
  }
}
