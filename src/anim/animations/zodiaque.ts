/**
 * Ecliptic (Zodiac) Simulator : le Soleil au centre, la Terre sur son orbite, et la bande des constellations
 * traversées par l'écliptique.  Limites officielles des constellations (UAI) : 13 constellations dont Ophiuchus ; les
 * « signes » astrologiques sont des secteurs de 30° comptés depuis l'équinoxe.
 */
import { heureSolaire, type Moment } from '../../calc/maintenant';
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import type { Peintre, Rect } from '../../noyau/peintre';
import { linspace, pmod } from '../../noyau/py';
import { dot, type V3 } from '../../noyau/vec';
import { Animation, angle, type Coche, date_du_jour, type Reglage } from '../base';

const ANNEE = 2026;
const SIGNES = ['ari', 'tau', 'gem', 'cnc', 'leo', 'vir', 'lib', 'sco', 'sgr', 'cap', 'aqr', 'psc'];

/** Point du plan de l'écliptique (repère direct x = point vernal), longitude λ. */
function ecl(lam: number, r = 1.0, z = 0.0): V3 {
  const a = (lam * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a), z];
}

export class Zodiaque extends Animation {
  static override ID = 'zodiac';
  static JOURS_PAR_S = 20.0;

  vue3d!: dessin.Vue3D;
  jour!: Reglage;
  c_signes!: Coche;

  static override TEMPS = ['jour'] as const;
  static override HEURE_SOLAIRE = true;

  /** « Maintenant » : date et heure de l'appareil (calc/maintenant.ts). */
  override maintenant(m: Moment): void {
    const [j, h] = heureSolaire(m.i, m.lon);
    void h;
    this.poser(this.jour, j);
  }

  override construire(): void {
    this.vue3d = this.vue(206.0, 30.0, 0.0, 50.0);
    this.jour = this.curseur('jour', 0.0, 364.0, 0.0, { dec: 0, cle_texte: 'anim_c_jour' });
    this.c_signes = this.coche('signes', false);
  }

  override avancer(dt: number): void {
    this.jour.setValue(pmod(this.jour.value() + dt * Zodiaque.JOURS_PAR_S, 365.0));
  }

  override valeurs(): [string, string][] {
    const lam = astro.soleil_jour(ANNEE, this.jour.value() + 0.5).lambda;
    return [
      [tr('anim_c_date'), date_du_jour(this.jour.value())],
      [tr('anim_seasonsim_lambda'), angle(lam)],
      [tr('anim_zodiac_derriere'), tr('anim_cst_' + astro.constellation_du_soleil(lam))],
      [tr('anim_zodiac_minuit'), tr('anim_cst_' + astro.constellation_du_soleil(lam + 180.0))],
      [tr('anim_zodiac_signe'), tr('anim_cst_' + SIGNES[pmod(Math.trunc(Math.floor(lam / 30)), 12)])],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    this.zone_rotative(rect, this.vue3d);
    const r = Math.min(rect.w * 0.45, rect.h * 0.55);
    const cx = rect.cx,
      cy = rect.cy + 10;
    const pe = new dessin.Peintre3D(p, this.vue3d, cx, cy, r);
    const lam = astro.soleil_jour(ANNEE, this.jour.value() + 0.5).lambda;
    const lim = [...astro.LIMITES_ZODIAQUE_2026].sort((a, b) => a[1] - b[1]);
    const devant = astro.constellation_du_soleil(lam);
    const minuit = astro.constellation_du_soleil(lam + 180.0);

    const bande = (passe_avant: boolean): void => {
      lim.forEach(([cle, l0], i) => {
        let l1 = lim[(i + 1) % lim.length]![1];
        if (l1 < l0) l1 += 360.0;
        const ls = linspace(l0, l1, 24);
        const mil = (l0 + l1) / 2;
        const av = dot(ecl(mil), this.vue3d.d) >= 0;
        if (av !== passe_avant) return;
        const coul = cle === devant ? 'soleil' : cle === minuit ? 'accent2' : 'grille';
        for (const [z, a] of [[0.12, 0.9], [-0.12, 0.9]] as [number, number][])
          pe.courbe(ls.map((l) => ecl(l, 1.0, z)), coul, 1.6, a, { arriere: 'normal', profondeur: false });
        pe.segment(ecl(l0, 1.0, -0.12), ecl(l0, 1.0, 0.12), 'grille', 1.2);
        pe.etiquette(ecl(mil, 1.0, 0.0), tr('anim_cst_' + cle), coul !== 'grille' ? coul : 'texte');
      });
    };

    bande(false);
    pe.plan('sphere', 0.25, 0.62, 'grille');
    if (this.c_signes.isChecked()) {
      for (let k = 0; k < 12; k++) {
        pe.segment(ecl(30 * k, 0.62), ecl(30 * k, 0.9), 'ecliptique', 1.0, 0.7);
        pe.etiquette(ecl(30 * k + 15, 0.78), tr('anim_cst_' + SIGNES[k]), 'ecliptique');
      }
    }
    const terre = ecl(lam + 180.0, 0.55);
    pe.courbe(linspace(0, 360, 121).map((l) => ecl(l, 0.55)), 'grille', 1.2, 1.0, { arriere: 'normal', profondeur: false });
    pe.segment(terre, ecl(lam, 1.0), 'soleil', 1.5, 0.7);
    pe.segment(terre, ecl(lam + 180.0, 1.0), 'accent2', 1.2, 0.6);
    const o = pe.ecran([0, 0, 0]);
    dessin.disque(p, o.xs[0]!, o.ys[0]!, Math.max(7.0, r * 0.06), 'soleil');
    pe.point(terre, 'terre', Math.max(5.0, r * 0.03));
    bande(true);
    dessin.police(p, 1.1, true);
    dessin.texte(p, rect.x + 12, rect.y + 22, date_du_jour(this.jour.value()), 'texte', { centre: false });
    dessin.police(p, 1 / 1.1);
  }
}
