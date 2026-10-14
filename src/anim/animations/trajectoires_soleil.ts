/**
 * Paths of the Sun : sur la sphère locale, les trajectoires diurnes du Soleil aux solstices et aux équinoxes, et
 * celle du jour choisi, avec les points de lever et de coucher.  Sun Motions Overview : construction pas à pas de la
 * sphère locale (pôles, équateur céleste, trajet des équinoxes, trajets des solstices).
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import type { Peintre, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import * as scenes from '../../noyau/scenes';
import { mul, type V3 } from '../../noyau/vec';
import { Animation, angle, type Coche, date_du_jour, duree_hm, type Reglage } from '../base';

const ANNEE = 2026;
const EPS = astro.obliquite_moyenne(astro.jj_jour_de_l_annee(ANNEE, 0));
const CHEMINS: [string, number, string][] = [['solstice_juin', EPS, 'accent3'], ['equinoxes', 0.0, 'accent1'], ['solstice_dec', -EPS, 'accent2']];

export class TrajectoiresSoleil extends Animation {
  static override ID = 'sunpaths';
  static JOURS_PAR_S = 20.0;

  vue3d!: dessin.Vue3D;
  lat!: Reglage;
  jour!: Reglage;
  c_ref!: Coche;
  c_jour!: Coche;

  override construire(): void {
    this.vue3d = this.vue(200.0, 25.0, 1.0, 89.0);
    this.lat = this.curseur('latitude', -90.0, 90.0, 41.0, { dec: 1, unite: '°', cle_texte: 'anim_c_latitude' });
    this.jour = this.curseur('jour', 0.0, 364.0, 120.0, { dec: 0, cle_texte: 'anim_c_jour' });
    this.c_ref = this.coche('reference', true);
    this.c_jour = this.coche('du_jour', true);
  }

  override avancer(dt: number): void {
    this.jour.setValue(pmod(this.jour.value() + dt * TrajectoiresSoleil.JOURS_PAR_S, 365.0));
  }

  override valeurs(): [string, string][] {
    const lat = this.lat.value();
    const d = astro.soleil_jour(ANNEE, this.jour.value() + 0.5).delta;
    const out: [string, string][] = [
      [tr('anim_c_date'), date_du_jour(this.jour.value())],
      [tr('anim_c_dec'), angle(d)],
      [tr('anim_sunmotions_duree'), duree_hm(astro.duree_du_jour_h(d, lat))],
      [tr('anim_sunmotions_culmination'), angle(astro.hauteur_culmination(d, lat))],
    ];
    const az = astro.azimut_lever(d, lat);
    if (az !== null) out.push([tr('anim_sunmotions_az_lever'), `${angle(az)} / ${angle(360 - az)}`]);
    for (const [cle, dd] of CHEMINS) out.push([tr('anim_sunpaths_duree_' + cle), duree_hm(astro.duree_du_jour_h(dd, lat))]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    this.zone_rotative(rect, this.vue3d);
    const r = Math.min(rect.w, rect.h) * 0.4;
    const cx = rect.cx,
      cy = rect.cy + 6;
    const lat = this.lat.value();
    const conv = scenes.eq_vers_local(0.0, lat);
    const c1 = (v: V3): V3 => conv([v])[0]!;
    const d = astro.soleil_jour(ANNEE, this.jour.value() + 0.5).delta;
    const chemin = (pe: dessin.Peintre3D, dd: number, coul: string, ep: number): void => {
      pe.courbe(conv(scenes.cercle_declinaison(dd, 241)), coul, ep, 1.0, { arriere: 'pale' });
      for (const signe of [-1, 1]) {
        const h0 = astro.angle_horaire_lever(dd, lat);
        if (0 < h0 && h0 < 180) pe.point(c1(astro.vecteur_equatorial(signe * h0, dd)), coul, 4.0);
      }
    };
    const scene = (pe: dessin.Peintre3D): void => {
      pe.courbe(dessin.cercle([0, -1, 0], 90, 181, 0, 180, [1, 0, 0]), 'meridien', 1.4, 1.0, { repere_monde: true });
      pe.segment(c1([0, 0, 1]), c1([0, 0, 1.2]), 'equateur', 2.0);
      if (this.c_ref.isChecked()) for (const [, dd, coul] of CHEMINS) chemin(pe, dd, coul, 2.0);
      if (this.c_jour.isChecked()) chemin(pe, d, 'soleil', 3.0);
    };
    const pe = scenes.sphere_locale(p, this.vue3d, cx, cy, r, scene);
    if (this.c_ref.isChecked()) {
      for (const [cle, dd, coul] of CHEMINS) {
        const h = astro.hauteur_culmination(dd, lat);
        if (h > 0) pe.etiquette(mul(astro.vecteur_horizon(lat >= dd ? 180.0 : 0.0, h), 1.06), tr('anim_sunpaths_' + cle), coul);
      }
    }
    dessin.police(p, 1.1, true);
    dessin.texte(p, rect.x + 12, rect.y + 22, date_du_jour(this.jour.value()), 'texte', { centre: false });
    dessin.police(p, 1 / 1.1);
  }
}

export class VueEnsembleSoleil extends Animation {
  static override ID = 'sunmotionsoverview';
  static HEURES_PAR_S = 2.0;

  vue3d!: dessin.Vue3D;
  lat!: Reglage;
  heure!: Reglage;
  etapes: Coche[] = [];

  override construire(): void {
    this.vue3d = this.vue(215.0, 25.0, 1.0, 89.0);
    this.lat = this.curseur('latitude', -90.0, 90.0, 41.0, { dec: 1, unite: '°', cle_texte: 'anim_c_latitude' });
    this.heure = this.curseur('heure', 0.0, 24.0, 12.0, { dec: 2, unite: 'h', cle_texte: 'anim_c_heure' });
    this.etapes = [1, 2, 3, 4].map((i) => this.coche(`etape${i}`, false));
  }

  override avancer(dt: number): void {
    this.heure.setValue(pmod(this.heure.value() + dt * VueEnsembleSoleil.HEURES_PAR_S, 24.0));
  }

  override valeurs(): [string, string][] {
    const lat = this.lat.value();
    const out: [string, string][] = [
      [tr('anim_latsim_hauteur_pole'), angle(Math.abs(lat))],
      [tr('anim_meridaltdiagram_eq'), angle(90 - Math.abs(lat))],
    ];
    for (const [cle, dd] of CHEMINS) out.push([tr('anim_sunpaths_duree_' + cle), duree_hm(astro.duree_du_jour_h(dd, lat))]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    this.zone_rotative(rect, this.vue3d);
    const r = Math.min(rect.w, rect.h) * 0.4;
    const cx = rect.cx,
      cy = rect.cy + 6;
    const lat = this.lat.value();
    const conv = scenes.eq_vers_local(0.0, lat);
    const c1 = (v: V3): V3 => conv([v])[0]!;
    const e = this.etapes.map((c) => c.isChecked());
    const h = (this.heure.value() - 12.0) * 15.0;
    const scene = (pe: dessin.Peintre3D): void => {
      if (e[0]) pe.segment(c1([0, 0, -1.2]), c1([0, 0, 1.2]), 'equateur', 2.0);
      if (e[1]) pe.courbe(conv(dessin.cercle([0, 0, 1])), 'equateur', 2.0);
      CHEMINS.forEach(([, dd, coul], k) => {
        if ((k === 1 && e[2]) || (k !== 1 && e[3])) {
          pe.courbe(conv(scenes.cercle_declinaison(dd, 241)), coul, 2.2, 1.0, { arriere: 'pale' });
          pe.point(c1(astro.vecteur_equatorial(-h, dd)), 'soleil', 6.0);
        }
      });
    };
    const pe = scenes.sphere_locale(p, this.vue3d, cx, cy, r, scene);
    if (e[0]) {
      pe.etiquette(c1([0, 0, 1.3]), tr('anim_radecdemo_l_pnc'), 'equateur');
      pe.etiquette(c1([0, 0, -1.3]), tr('anim_radecdemo_l_psc'), 'equateur');
    }
  }
}
