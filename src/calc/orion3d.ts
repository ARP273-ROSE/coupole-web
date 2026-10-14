/**
 * Géométrie d'« Orion en 3D », sans dessin (même calcul, ligne pour ligne, que orion3d.py de Coupole ; tests croisés) :
 * repère ICRS centré sur le Soleil, en parsecs ; caméra en perspective qui tourne autour d'un pivot (Orion, M42 ou la
 * Tête de Cheval) ; « dépliement » u de 0 (tout sur une sphère de rayon R0 : la figure du ciel, vue du Soleil) à 1
 * (chaque objet à sa distance).  Vue du Soleil, la perspective est la projection gnomonique du ciel (nord en haut,
 * est à gauche).
 */
import SCENE from '../donnees/genere/orion3d.json';

export type V3 = [number, number, number];
export const DEG = Math.PI / 180;
/** rayon de la sphère du ciel (dépliement nul) et distance du pivot d'Orion (choix d'affichage) */
export const R0 = 400;
/** orientation de la vue 3D d'Orion entier quand le dépliement est complet : 75° de côté, 20° au-dessus (choix d'affichage) */
export const LACET_3D = 75;
export const TANGAGE_3D = 20;

export interface EtoileOrion {
  id: string;
  nom: { fr: string; en: string };
  designation: string;
  ra: number;
  dec: number;
  V: number;
  teff: number | null;
  couleur: string | null;
  d: number;
  d_moins: number | null;
  d_plus: number | null;
  peu_fiable: boolean;
  d_affichage: number | null;
  xyz: V3;
  xyz_affichage: V3 | null;
  roles: string[];
}

export interface Texture {
  id: string;
  fichier: string;
  objet: string;
  centre_radec: [number, number];
  echelle_arcmin_px: number;
  taille_px: [number, number];
  credit: string;
  licence: string;
  page: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DONNEES = SCENE as any as {
  etoiles: EtoileOrion[];
  figure: string[][];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  primitives: Record<string, any>;
  textures: Texture[];
  /** rotation ICRS → galactique (lignes), calculée par astropy à la construction des données */
  icrs_vers_gal: number[][];
};

// ------------------------------------------------------------ vecteurs
export function dot(a: readonly number[], b: readonly number[]): number {
  return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
}
export function cross(a: readonly number[], b: readonly number[]): V3 {
  return [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
}
export function norme(a: readonly number[]): number {
  return Math.sqrt(dot(a, a));
}
export function unitaire(a: readonly number[]): V3 {
  const n = norme(a);
  return n > 0 ? [a[0]! / n, a[1]! / n, a[2]! / n] : [1, 0, 0];
}
export function comb(a: readonly number[], ka: number, b: readonly number[], kb: number): V3 {
  return [a[0]! * ka + b[0]! * kb, a[1]! * ka + b[1]! * kb, a[2]! * ka + b[2]! * kb];
}

/** Direction (vecteur unitaire ICRS) d'ascension droite ra et de déclinaison dec (degrés). */
export function direction(ra: number, dec: number): V3 {
  const a = ra * DEG;
  const d = dec * DEG;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}

/** Direction décalée de (ξ vers l'est, η vers le nord) radians dans le plan tangent en (ra, dec) (gnomonique). */
export function decaler(ra: number, dec: number, xi: number, eta: number): V3 {
  const a = ra * DEG;
  const d = dec * DEG;
  const c = direction(ra, dec);
  const est: V3 = [-Math.sin(a), Math.cos(a), 0];
  const nord: V3 = [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)];
  return unitaire([c[0] + xi * est[0] + eta * nord[0], c[1] + xi * est[1] + eta * nord[1], c[2] + xi * est[2] + eta * nord[2]]);
}

/** Interpolation douce (0 → 0, 1 → 1, dérivées nulles aux bouts). */
export function lisse(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

/** Position affichée d'un point P au dépliement u : sur sa ligne de visée, de la sphère R0 (u = 0) à sa distance. */
export function deplier(P: readonly number[], u: number): V3 {
  const r = norme(P);
  if (!(r > 0)) return [0, 0, 0];
  const k = ((1 - u) * R0) / r + u;
  return [P[0]! * k, P[1]! * k, P[2]! * k];
}

/** Centre de la figure : direction moyenne des étoiles reliées par les lignes de la constellation. */
export function centre_figure(): V3 {
  const ids = new Set(DONNEES.figure.flat());
  let s: V3 = [0, 0, 0];
  for (const e of DONNEES.etoiles) if (ids.has(e.id)) s = comb(s, 1, direction(e.ra, e.dec), 1);
  return unitaire(s);
}

// ------------------------------------------------------------ cibles de la caméra
export type Cible = 'orion' | 'm42' | 'tete';

export interface ParamCible {
  /** pivot (pc, ICRS) */
  pivot: V3;
  /** demi-champ de la vue du ciel (degrés) */
  demi_champ: number;
  /** distance de la caméra au pivot et demi-étendue montrée (pc) en vue 3D */
  d3: number;
  s3: number;
  /** pivot de la vue 3D (Orion entier : entre le Soleil et Orion, pour tout montrer) */
  pivot3: V3;
  /** lacet de la vue 3D (degrés) : de côté pour Orion entier, de biais pour les plongées (images visibles) */
  lacet3: number;
}

let CENTRE: V3 | null = null;
export function parametres_cible(c: Cible): ParamCible {
  const P = DONNEES.primitives;
  if (c === 'm42') return { pivot: P.m42_bol.sommet as V3, demi_champ: 0.55, d3: 16, s3: 6, pivot3: P.m42_bol.sommet as V3, lacet3: 55 };
  if (c === 'tete') return { pivot: P.tete_de_cheval.centre as V3, demi_champ: 0.075, d3: 9, s3: 4.6, pivot3: P.tete_de_cheval.centre as V3, lacet3: 35 };
  CENTRE ??= centre_figure();
  return { pivot: comb(CENTRE, R0, [0, 0, 0], 0), demi_champ: 18, d3: 1000, s3: 270, pivot3: comb(CENTRE, 300, [0, 0, 0], 0), lacet3: LACET_3D };
}

// ------------------------------------------------------------ caméra
export interface Camera {
  oeil: V3;
  droite: V3;
  haut: V3;
  avant: V3;
  /** focale (pixels) et centre de l'image */
  F: number;
  cx: number;
  cy: number;
  /** distance de l'œil au pivot (pc) */
  D: number;
}

/**
 * Caméra : pivot interpolé entre deux cibles (k : 0 → a, 1 → b), dépliement u, lacet et tangage du glisser (degrés),
 * image w × h.  Vue du ciel (u = 0, sans glisser) : l'œil est au Soleil.
 */
export function camera(a: Cible, b: Cible, k: number, u: number, lacet: number, tangage: number, w: number, h: number): Camera {
  const pa = parametres_cible(a);
  const pb = parametres_cible(b);
  const kk = lisse(k);
  const s = lisse(u);
  const pivotCiel = comb(pa.pivot, 1 - kk, pb.pivot, kk);
  const pivot = comb(pivotCiel, 1 - s, comb(pa.pivot3, 1 - kk, pb.pivot3, kk), s);
  const mi = Math.max(10, Math.min(w, h));
  const lg = (x: number, y: number, t: number): number => Math.exp((1 - t) * Math.log(x) + t * Math.log(y));
  // vue du ciel : œil au Soleil, focale qui montre le demi-champ ; vue 3D : œil à d3 du pivot, étendue s3 visible
  const dCiel = norme(pivotCiel);
  const fCiel = (0.5 * mi) / Math.tan(lg(pa.demi_champ, pb.demi_champ, kk) * DEG);
  const d3 = lg(pa.d3, pb.d3, kk);
  const f3 = (0.46 * mi * d3) / lg(pa.s3, pb.s3, kk);
  const D = lg(dCiel, d3, s);
  const F = lg(fCiel, f3, s);
  // repère du ciel au pivot : avant = vers le pivot, haut = nord céleste projeté, droite = avant × haut (ouest)
  const av0 = unitaire(pivotCiel);
  let ha0 = comb([0, 0, 1], 1, av0, -av0[2]);
  ha0 = norme(ha0) > 1e-9 ? unitaire(ha0) : [1, 0, 0];
  const dr0 = cross(av0, ha0);
  const l = (lacet + s * ((1 - kk) * pa.lacet3 + kk * pb.lacet3)) * DEG;
  const t = (tangage + s * TANGAGE_3D) * DEG;
  const av1 = comb(av0, Math.cos(l), dr0, Math.sin(l));
  const dr1 = comb(dr0, Math.cos(l), av0, -Math.sin(l));
  const avant = comb(av1, Math.cos(t), ha0, Math.sin(t));
  const haut = comb(ha0, Math.cos(t), av1, -Math.sin(t));
  const oeil = comb(pivot, 1, avant, -D);
  return { oeil, droite: dr1, haut, avant, F, cx: w / 2, cy: h / 2, D };
}

/** Projection d'un point (pc) : [x, y, profondeur] en pixels, ou null derrière la caméra (ou non fini). */
export function projeter(c: Camera, P: readonly number[]): V3 | null {
  const r: V3 = [P[0]! - c.oeil[0], P[1]! - c.oeil[1], P[2]! - c.oeil[2]];
  const z = dot(r, c.avant);
  if (!(z > c.D * 1e-3)) return null;
  const x = c.cx + (c.F * dot(r, c.droite)) / z;
  const y = c.cy - (c.F * dot(r, c.haut)) / z;
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y, z] : null;
}

/** Point de la coquille d'Orion (ellipsoïde de Foley et al. 2023) sur la ligne de visée d : milieu de la corde. */
export function point_coquille(d: readonly number[], icrs_vers_gal: readonly (readonly number[])[]): V3 {
  const P = DONNEES.primitives.coquille_orion;
  const ax = P.demi_axes_gal_pc as number[];
  const c = P.centre as number[];
  const dg = icrs_vers_gal.map((l) => dot(l, d));
  const cg = icrs_vers_gal.map((l) => dot(l, c));
  let num = 0;
  let den = 0;
  for (let i = 0; i < 3; i++) {
    num += (dg[i]! * cg[i]!) / ax[i]! ** 2;
    den += dg[i]! ** 2 / ax[i]! ** 2;
  }
  const t = den > 0 ? num / den : R0;
  return [d[0]! * t, d[1]! * t, d[2]! * t];
}

/** Distance (pc) retenue pour une étoile : distance d'affichage publiée (par défaut) ou mesure brute. */
export function position_etoile(e: EtoileOrion, brutes: boolean): V3 {
  return !brutes && e.xyz_affichage ? e.xyz_affichage : e.xyz;
}
