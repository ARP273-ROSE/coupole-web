/** Éléments de scène partagés (transposition de scenes.py) : sphère locale, observateur, cercles du ciel. */
import * as astro from '../calc/astro';
import { tr } from '../i18n/i18n';
import * as dessin from './dessin';
import type { Peintre } from './peintre';
import { linspace } from './py';
import { appliquerM, mv, type Pts, type V3 } from './vec';

/** Étiquettes N, E, S, O sur l'horizon (repère local x = nord, y = ouest, z = zénith). */
export function points_cardinaux(pe: dessin.Peintre3D, r = 1.1, nord_sud_seulement = false): void {
  const pts: [string, number][] = [['anim_pc_n', 0.0], ['anim_pc_e', 90.0], ['anim_pc_s', 180.0], ['anim_pc_o', 270.0]];
  for (const [cle, az] of pts) {
    if (nord_sud_seulement && (az === 90.0 || az === 270.0)) continue;
    const v = astro.vecteur_horizon(az, 0.0);
    pe.etiquette([v[0] * r, v[1] * r, v[2] * r], tr(cle), 'horizon');
  }
}

/** Petit observateur debout au centre de la sphère locale. */
export function personnage(pe: dessin.Peintre3D, taille = 0.13, cle = 'texte'): void {
  pe.segment([0, 0, 0], [0, 0, taille * 0.62], cle, 2.0, 1.0, true);
  pe.segment([0, 0, taille * 0.45], [0, taille * 0.2, taille * 0.3], cle, 1.6, 1.0, true);
  pe.segment([0, 0, taille * 0.45], [0, -taille * 0.2, taille * 0.3], cle, 1.6, 1.0, true);
  const { xs, ys } = pe.ecran([0, 0, taille * 0.78], true);
  dessin.disque(pe.p, xs[0]!, ys[0]!, Math.max(2.5, pe.r * taille * 0.12), cle);
}

/** Sphère locale complète : ciel, éléments sous l'horizon, plan de l'horizon, éléments au-dessus, cardinaux. */
export function sphere_locale(
  p: Peintre, vue: dessin.Vue3D, cx: number, cy: number, r: number,
  dessiner_dessus_dessous: (pe: dessin.Peintre3D) => void, couleur_ciel: string | null = null, alpha_sol = 0.55,
  cardinaux = true, observateur = true,
): dessin.Peintre3D {
  const pe = new dessin.Peintre3D(p, vue, cx, cy, r);
  pe.contour('grille', couleur_ciel || 'ciel', 0.3);
  dessin.scene_en_deux_passes(pe, dessiner_dessus_dessous, () => pe.plan('sol', alpha_sol));
  if (cardinaux) points_cardinaux(pe);
  if (observateur) personnage(pe);
  return pe;
}

/** Parallèle de déclinaison δ dans le repère équatorial. */
export function cercle_declinaison(dec: number, n = 181): Pts {
  return dessin.cercle([0, 0, 1], 90.0 - dec, n);
}

export function cercle_horaire(ra_deg: number, dec0 = -90.0, dec1 = 90.0, n = 91): Pts {
  const a = (ra_deg * Math.PI) / 180;
  return linspace(dec0, dec1, n).map((d) => {
    const dr = (d * Math.PI) / 180;
    return [Math.cos(dr) * Math.cos(a), Math.cos(dr) * Math.sin(a), Math.sin(dr)] as V3;
  });
}

export function arc_equateur(ra0_deg: number, ra1_deg: number, dec = 0.0, n = 60): Pts {
  const d = (dec * Math.PI) / 180;
  return linspace(ra0_deg, ra1_deg, n).map((ad) => {
    const a = (ad * Math.PI) / 180;
    return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)] as V3;
  });
}

/** Écliptique dans le repère équatorial (pôle de l'écliptique en α = 18 h, δ = 90° − ε). */
export function ecliptique(eps: number, n = 181): Pts {
  const e = (eps * Math.PI) / 180;
  return dessin.cercle([0.0, -Math.sin(e), Math.cos(e)], 90.0, n, 0.0, 360.0, [1.0, 0.0, 0.0]);
}

/** Transformateur équatorial → repère local, pour new Peintre3D(…, transformer). */
export function eq_vers_local(tsl_deg: number, lat: number): (pts: Pts) => Pts {
  const m = astro.matrice_equatorial_vers_horizon(tsl_deg, lat);
  return (pts: Pts) => appliquerM(m, pts);
}

export function local_de_eq(tsl_deg: number, lat: number, ra_deg: number, dec: number): V3 {
  const m = astro.matrice_equatorial_vers_horizon(tsl_deg, lat);
  return mv(m, astro.vecteur_equatorial(ra_deg, dec));
}

/** Vecteur du repère local → [azimut depuis le nord vers l'est, hauteur]. */
export function az_alt_de_vecteur(v: readonly number[]): [number, number] {
  return [
    astro.mod((Math.atan2(-v[1]!, v[0]!) * 180) / Math.PI, 360.0),
    (Math.asin(Math.max(-1.0, Math.min(1.0, v[2]!))) * 180) / Math.PI,
  ];
}
