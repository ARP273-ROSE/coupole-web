/**
 * Type d'une éclipse d'après la géométrie réelle (tailles et distances en km) — commun au web et au bureau.
 * Même logique, ligne pour ligne, que `coupole/modules/anim/eclipses_geo.py` ; cas de parité
 * `tests/references/eclipses_geo_cas.json` (dont les 133 éclipses de la table, retrouvées toutes avec la géométrie
 * DE440 de leur maximum).
 *
 * Rayons du Soleil parallèles à l'échelle Terre–Lune : les axes d'ombre sont parallèles à la direction Soleil–Terre.
 * `x` : position de la Lune le long de l'axe (km ; < 0 côté Soleil, > 0 derrière la Terre) ; `delta` : distance de
 * l'axe d'ombre de la Lune au centre de la Terre (Soleil), ou du centre de la Lune à l'axe d'ombre de la Terre (Lune),
 * soit |gamma| × R⊕.  Soleil : totale, annulaire, hybride (ombre et antombre selon la distance à la surface),
 * partielle (pénombre seule), aucune ; largeur de la bande = diamètre de l'ombre à la surface.  Lune : règle de
 * Danjon (rayon de la Terre + 1 %, celle des tables de la NASA) ; totale, partielle, pénombrale, aucune.
 */

export const R_SOLEIL_KM = 695_700.0;
export const R_TERRE_KM = 6_378.137;
export const R_LUNE_KM = 1_737.4;
export const UA_KM = 149_597_870.7;
export const D_LUNE_KM = 384_400.0;
export const ATMOSPHERE = 1.01;
/** distances extrêmes de la Lune (centre à centre), DE440, 1900–2100 (outils/verif_anim/geometrie_eclipses.py) */
export const PERIGEE_MIN_KM = 356_375.3;
export const APOGEE_MAX_KM = 406_711.7;

export type TypeSoleil = 'totale' | 'annulaire' | 'hybride' | 'partielle' | 'aucune';
export type TypeLune = 'totale' | 'partielle' | 'penombrale' | 'aucune';

export interface EclipseSoleil {
  type: TypeSoleil;
  ombre_km: number;
  ombre_surface_km: number;
  penombre_km: number;
  largeur_km: number;
}

export function eclipseSoleil(x: number, delta: number, d_soleil = UA_KM): EclipseSoleil {
  const d = -x;
  if (d <= 0) return { type: 'aucune', ombre_km: 0, ombre_surface_km: 0, penombre_km: 0, largeur_km: 0 };
  const d_sm = d_soleil - d;
  const ku = (R_SOLEIL_KM - R_LUNE_KM) / d_sm;
  const kp = (R_SOLEIL_KM + R_LUNE_KM) / d_sm;
  const ru = R_LUNE_KM - d * ku;
  const rp = R_LUNE_KM + d * kp;
  const ds = d - Math.sqrt(Math.max(0, R_TERRE_KM ** 2 - Math.min(delta, R_TERRE_KM) ** 2));
  const rs = R_LUNE_KM - ds * ku;
  let type: TypeSoleil;
  if (delta >= R_TERRE_KM + rp) type = 'aucune';
  else if (delta >= R_TERRE_KM + Math.abs(ru)) type = 'partielle';
  else if (rs > 0 && ru > 0) type = 'totale';
  else if (rs > 0) type = 'hybride';
  else type = 'annulaire';
  const largeur = type === 'totale' || type === 'annulaire' || type === 'hybride' ? 2 * Math.abs(rs) : 0;
  return { type, ombre_km: ru, ombre_surface_km: rs, penombre_km: rp, largeur_km: largeur };
}

export interface EclipseLune {
  type: TypeLune;
  ombre_km: number;
  penombre_km: number;
}

export function eclipseLune(x: number, delta: number, d_soleil = UA_KM): EclipseLune {
  if (x <= 0) return { type: 'aucune', ombre_km: 0, penombre_km: 0 };
  const rt = R_TERRE_KM * ATMOSPHERE;
  const ru = rt - (x * (R_SOLEIL_KM - rt)) / d_soleil;
  const rp = rt + (x * (R_SOLEIL_KM + rt)) / d_soleil;
  let type: TypeLune;
  if (delta + R_LUNE_KM <= ru) type = 'totale';
  else if (delta - R_LUNE_KM < ru) type = 'partielle';
  else if (delta - R_LUNE_KM < rp) type = 'penombrale';
  else type = 'aucune';
  return { type, ombre_km: ru, penombre_km: rp };
}

/**
 * Lune sur son orbite inclinée : [x le long de l'axe (vers l'opposé du Soleil), y (nord de l'écliptique), z (hors du
 * plan de la figure)], km.  position : angle depuis la direction du Soleil (0 : nouvelle lune, 180 : pleine lune) ;
 * noeuds : angle du nœud ascendant depuis la direction du Soleil.
 */
export function positionOrbite(d_km: number, position_deg: number, noeuds_deg: number, inclinaison_deg = 5.145): [number, number, number] {
  const r = Math.PI / 180.0;
  const u = (position_deg - noeuds_deg) * r;
  const i = inclinaison_deg * r;
  const beta = Math.asin(Math.sin(i) * Math.sin(u));
  const psi = noeuds_deg * r + Math.atan2(Math.cos(i) * Math.sin(u), Math.cos(u));
  return [-d_km * Math.cos(beta) * Math.cos(psi), d_km * Math.sin(beta), d_km * Math.cos(beta) * Math.sin(psi)];
}
