/**
 * Calculs astronomiques des animations (transposition exacte de astro.py de Coupole).
 *
 * Formules : J. Meeus, Astronomical Algorithms (2e éd., 1998) pour le jour julien, le temps sidéral (IAU 1982), la
 * position du Soleil (précision ≈ 0,01°) et l'équation du temps ; P03 / IAU 2006 pour l'obliquité moyenne ;
 * trigonométrie sphérique classique pour les changements de repère.  Vérifiées dans Coupole par SageMath ; ici par
 * tests/unit/calculs.test.ts contre les valeurs de Coupole (tests/references/calculs.json, écart ≤ 1e-9 relatif).
 *
 * Conventions : angles en degrés ; azimut compté depuis le nord vers l'est ; angle horaire H = TSL − α, positif vers
 * l'ouest ; « jour » d'une année = jours écoulés depuis le 1er janvier à 0 h TU.
 */
import { pmod } from '../noyau/py';

export const DEG = Math.PI / 180.0;
export const RAD = 180.0 / Math.PI;

// ---------------------------------------------------------------- constantes
export const UA_KM = 149_597_870.7;
export const AL_M = 9_460_730_472_580_800.0;
export const PC_M = (UA_KM * 1000.0 * 648_000.0) / Math.PI;
export const PC_EN_AL = PC_M / AL_M;
export const R_SOLEIL_KM = 695_700.0;
export const R_TERRE_KM = 6_378.137;
export const R_LUNE_KM = 1_737.4;
export const D_LUNE_KM = 384_400.0;
export const MOIS_SYNODIQUE_J = 29.530_588_861;
export const ANNEE_TROPIQUE_J = 365.242_19;
export const ANNEE_JULIENNE_J = 365.25;
export const GM_SOLEIL = 1.327_124_400_18e20;
export const ZODIAQUE_NOMS = ['psc', 'ari', 'tau', 'gem', 'cnc', 'leo', 'vir', 'lib', 'sco', 'oph', 'sgr', 'cap', 'aqr'] as const;

/** Modulo positif (math.fmod corrigé). */
export function mod(x: number, m: number): number {
  const r = x % m;
  return r < 0 ? r + m : r;
}

/** Ramène un angle dans ]-180, 180]. */
export function mod180(x: number): number {
  const r = mod(x, 360.0);
  return r > 180.0 ? r - 360.0 : r;
}

// ---------------------------------------------------------------- temps
/** Jour julien d'une date du calendrier grégorien (Meeus, chap. 7). */
export function jour_julien(annee: number, mois: number, jour: number, heure = 0.0): number {
  if (mois <= 2) {
    annee -= 1;
    mois += 12;
  }
  const a = Math.floor(annee / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.trunc(365.25 * (annee + 4716)) + Math.trunc(30.6001 * (mois + 1)) + jour + heure / 24.0 + b - 1524.5;
}

/** Jour julien du « jour » `jour` de l'année (0 = 1er janvier à 0 h TU). */
export function jj_jour_de_l_annee(annee: number, jour: number): number {
  return jour_julien(annee, 1, 1.0) + jour;
}

export function siecles_j2000(jj: number): number {
  return (jj - 2_451_545.0) / 36_525.0;
}

/** Temps sidéral moyen de Greenwich, en degrés (IAU 1982, Meeus éq. 12.4) ; jj en TU. */
export function tsmg(jj: number): number {
  const t = siecles_j2000(jj);
  return mod(280.460_618_37 + 360.985_647_366_29 * (jj - 2_451_545.0) + 0.000_387_933 * t * t - t ** 3 / 38_710_000.0, 360.0);
}

/** Durée du jour sidéral (secondes de temps solaire moyen) pour une année de `annee_jours` jours solaires. */
export function jour_sideral_s(annee_jours = ANNEE_TROPIQUE_J): number {
  return (86_400.0 * annee_jours) / (annee_jours + 1.0);
}

// ---------------------------------------------------------------- obliquité, Soleil
/** Obliquité moyenne de l'écliptique (P03, IAU 2006), en degrés. */
export function obliquite_moyenne(jj = 2_451_545.0): number {
  const t = siecles_j2000(jj);
  const s = 84_381.406 - 46.836_769 * t - 0.000_183_1 * t ** 2 + 0.002_003_4 * t ** 3 - 5.76e-7 * t ** 4 - 4.34e-8 * t ** 5;
  return s / 3600.0;
}

export interface Soleil {
  lambda: number;
  alpha: number;
  delta: number;
  distance: number;
  eqt: number;
  L0: number;
  M: number;
}

/** Position apparente du Soleil (Meeus, chap. 25, précision ≈ 0,01°) et équation du temps (minutes). */
export function soleil(jj: number): Soleil {
  const t = siecles_j2000(jj);
  const l0 = mod(280.466_46 + 36_000.769_83 * t + 0.000_303_2 * t * t, 360.0);
  const m = mod(357.529_11 + 35_999.050_29 * t - 0.000_153_7 * t * t, 360.0);
  const e = 0.016_708_634 - 0.000_042_037 * t - 0.000_000_126_7 * t * t;
  const mr = m * DEG;
  const c =
    (1.914_602 - 0.004_817 * t - 0.000_014 * t * t) * Math.sin(mr) +
    (0.019_993 - 0.000_101 * t) * Math.sin(2 * mr) +
    0.000_289 * Math.sin(3 * mr);
  const vraie = l0 + c;
  const nu = m + c;
  const r = (1.000_001_018 * (1 - e * e)) / (1 + e * Math.cos(nu * DEG));
  const omega = 125.04 - 1_934.136 * t;
  const lam = vraie - 0.005_69 - 0.004_78 * Math.sin(omega * DEG);
  const eps = obliquite_moyenne(jj) + 0.002_56 * Math.cos(omega * DEG);
  const alpha = mod(Math.atan2(Math.cos(eps * DEG) * Math.sin(lam * DEG), Math.cos(lam * DEG)) * RAD, 360.0);
  const delta = Math.asin(Math.sin(eps * DEG) * Math.sin(lam * DEG)) * RAD;
  const dpsi = -0.004_78 * Math.sin(omega * DEG);
  const eqt = mod180(l0 - 0.005_718_3 - alpha + dpsi * Math.cos(eps * DEG)) * 4.0;
  return { lambda: mod(lam, 360.0), alpha, delta, distance: r, eqt, L0: l0, M: m };
}

export function soleil_jour(annee: number, jour: number): Soleil {
  return soleil(jj_jour_de_l_annee(annee, jour));
}

// ---------------------------------------------------------------- repères
/** (λ, β) → (α, δ), degrés. */
export function ecliptique_vers_equatorial(lam: number, beta: number, eps: number): [number, number] {
  const l = lam * DEG,
    b = beta * DEG,
    e = eps * DEG;
  const sd = Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l);
  const a = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  return [mod(a * RAD, 360.0), Math.asin(Math.max(-1.0, Math.min(1.0, sd))) * RAD];
}

/** (angle horaire H, déclinaison δ, latitude φ) → (azimut depuis le nord vers l'est, hauteur), degrés. */
export function equatorial_vers_horizon(h: number, dec: number, lat: number): [number, number] {
  const hr = h * DEG,
    d = dec * DEG,
    p = lat * DEG;
  const sh = Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(hr);
  const az = Math.atan2(-Math.cos(d) * Math.sin(hr), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.cos(hr) * Math.sin(p));
  return [mod(az * RAD, 360.0), Math.asin(Math.max(-1.0, Math.min(1.0, sh))) * RAD];
}

/** (azimut, hauteur, latitude) → (angle horaire H, déclinaison), degrés. */
export function horizon_vers_equatorial(az: number, alt: number, lat: number): [number, number] {
  const a = az * DEG,
    h = alt * DEG,
    p = lat * DEG;
  const sd = Math.sin(p) * Math.sin(h) + Math.cos(p) * Math.cos(h) * Math.cos(a);
  const ha = Math.atan2(-Math.cos(h) * Math.sin(a), Math.sin(h) * Math.cos(p) - Math.cos(h) * Math.cos(a) * Math.sin(p));
  return [mod(ha * RAD, 360.0), Math.asin(Math.max(-1.0, Math.min(1.0, sd))) * RAD];
}

/** Demi-arc diurne H₀ (degrés) ; 180 si circumpolaire, 0 si jamais levé. */
export function angle_horaire_lever(dec: number, lat: number, h0 = 0.0): number {
  const p = lat * DEG,
    d = dec * DEG;
  const den = Math.cos(p) * Math.cos(d);
  if (Math.abs(den) < 1e-12) return Math.sin(p) * Math.sin(d) > Math.sin(h0 * DEG) ? 180.0 : 0.0;
  const c = (Math.sin(h0 * DEG) - Math.sin(p) * Math.sin(d)) / den;
  if (c <= -1.0) return 180.0;
  if (c >= 1.0) return 0.0;
  return Math.acos(c) * RAD;
}

export function duree_du_jour_h(dec: number, lat: number, h0 = 0.0): number {
  return (2.0 * angle_horaire_lever(dec, lat, h0)) / 15.0;
}

/** Azimut du lever, ou null si l'astre ne se lève ni ne se couche. */
export function azimut_lever(dec: number, lat: number, h0 = 0.0): number | null {
  const h = angle_horaire_lever(dec, lat, h0);
  if (h <= 0.0 || h >= 180.0) return null;
  return equatorial_vers_horizon(-h, dec, lat)[0];
}

export function hauteur_culmination(dec: number, lat: number): number {
  return 90.0 - Math.abs(lat - dec);
}

export interface Plages {
  circumpolaire: [number, number] | null;
  lever_coucher: [number, number] | null;
  jamais: [number, number] | null;
}

export function plages_declinaison(lat: number): Plages {
  const c = 90.0 - Math.abs(lat);
  if (Math.abs(lat) < 1e-9) return { circumpolaire: null, lever_coucher: [-90.0, 90.0], jamais: null };
  if (c < 1e-9) {
    const nord = lat > 0;
    return {
      circumpolaire: nord ? [0.0, 90.0] : [-90.0, 0.0],
      lever_coucher: null,
      jamais: nord ? [-90.0, 0.0] : [0.0, 90.0],
    };
  }
  if (lat > 0) return { circumpolaire: [c, 90.0], lever_coucher: [-c, c], jamais: [-90.0, -c] };
  return { circumpolaire: [-90.0, -c], lever_coucher: [-c, c], jamais: [c, 90.0] };
}

// ---------------------------------------------------------------- vecteurs
export type Vec = [number, number, number];

/** Repère local direct (x = nord, y = ouest, z = zénith). */
export function vecteur_horizon(az: number, alt: number): Vec {
  const a = az * DEG,
    h = alt * DEG;
  return [Math.cos(h) * Math.cos(a), -Math.cos(h) * Math.sin(a), Math.sin(h)];
}

/** Repère équatorial direct (x = point vernal, y = α 6 h, z = pôle nord céleste). */
export function vecteur_equatorial(ra_deg: number, dec: number): Vec {
  const a = ra_deg * DEG,
    d = dec * DEG;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}

/** Matrice 3×3 (lignes) qui envoie un vecteur équatorial dans le repère local (nord, ouest, zénith). */
export function matrice_equatorial_vers_horizon(tsl_deg: number, lat: number): [Vec, Vec, Vec] {
  const t = tsl_deg * DEG,
    p = lat * DEG;
  const ct = Math.cos(t),
    st = Math.sin(t);
  const x0 = [-Math.sin(p), 0.0, Math.cos(p)];
  const e = [0.0, -1.0, 0.0];
  const pole = [Math.cos(p), 0.0, Math.sin(p)];
  const m: [Vec, Vec, Vec] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    m[i]![0] = x0[i]! * ct - e[i]! * st;
    m[i]![1] = x0[i]! * st + e[i]! * ct;
    m[i]![2] = pole[i]!;
  }
  return m;
}

export function appliquer(m: readonly (readonly number[])[], v: readonly number[]): Vec {
  return [
    m[0]![0]! * v[0]! + m[0]![1]! * v[1]! + m[0]![2]! * v[2]!,
    m[1]![0]! * v[0]! + m[1]![1]! * v[1]! + m[1]![2]! * v[2]!,
    m[2]![0]! * v[0]! + m[2]![1]! * v[1]! + m[2]![2]! * v[2]!,
  ];
}

// ---------------------------------------------------------------- Kepler
/** Anomalie excentrique E (radians) telle que E − e sin E = M (Newton, départ de Danby). */
export function resoudre_kepler(m_rad: number, e: number): number {
  const m = m_rad % (2 * Math.PI);
  let ee = m + 0.85 * e * (Math.sin(m) >= 0 ? 1 : -1);
  for (let i = 0; i < 50; i++) {
    const f = ee - e * Math.sin(ee) - m;
    const d = f / (1 - e * Math.cos(ee));
    ee -= d;
    if (Math.abs(d) < 1e-15) break;
  }
  return ee;
}

/** 3e loi de Kepler en unités solaires : P² = a³ / M. */
export function periode_annees(a_ua: number, masse_soleils = 1.0): number {
  return Math.sqrt(a_ua ** 3 / masse_soleils);
}

export interface PointOrbite {
  x: number;
  y: number;
  r: number;
  nu: number;
  E: number;
  v: number;
}

export function orbite(a_ua: number, e: number, fraction: number): PointOrbite {
  const m = 2 * Math.PI * pmod(fraction, 1.0);
  const ee = resoudre_kepler(m, e);
  const x = a_ua * (Math.cos(ee) - e);
  const y = a_ua * Math.sqrt(1 - e * e) * Math.sin(ee);
  const r = Math.hypot(x, y);
  const nu = mod(Math.atan2(y, x) * RAD, 360.0);
  const v = Math.sqrt(GM_SOLEIL * (2.0 / (r * UA_KM * 1000.0) - 1.0 / (a_ua * UA_KM * 1000.0))) / 1000.0;
  return { x, y, r, nu, E: mod(ee * RAD, 360.0), v };
}

export function aire_balayee(a_ua: number, e: number, f0: number, f1: number): number {
  return Math.PI * a_ua * a_ua * Math.sqrt(1 - e * e) * (f1 - f0);
}

// ---------------------------------------------------------------- distances stellaires
export function parsecs_de_parallaxe(p_arcsec: number): number {
  return 1.0 / p_arcsec;
}

export function module_de_distance(d_pc: number): number {
  return 5.0 * Math.log10(d_pc) - 5.0;
}

export function distance_du_module(mu: number): number {
  return 10.0 ** ((mu + 5.0) / 5.0);
}

// ---------------------------------------------------------------- ombres et éclipses
export interface Cones {
  longueur_ombre: number;
  demi_angle_ombre: number;
  demi_angle_penombre: number;
  rayon_ombre: (x: number) => number;
  rayon_penombre: (x: number) => number;
}

export function cones_ombre(r_source: number, r_objet: number, distance: number): Cones {
  const k_u = (r_source - r_objet) / distance;
  const k_p = (r_source + r_objet) / distance;
  return {
    longueur_ombre: k_u > 0 ? r_objet / k_u : Infinity,
    demi_angle_ombre: Math.asin(Math.min(1.0, k_u)) * RAD,
    demi_angle_penombre: Math.asin(Math.min(1.0, k_p)) * RAD,
    rayon_ombre: (x) => r_objet - x * k_u,
    rayon_penombre: (x) => r_objet + x * k_p,
  };
}

export function eclipse_de_lune(
  d_lune_km = D_LUNE_KM, d_soleil_km = UA_KM, r_terre = R_TERRE_KM, r_lune = R_LUNE_KM, r_soleil = R_SOLEIL_KM,
  mois_j = MOIS_SYNODIQUE_J,
): Record<string, number> {
  const c = cones_ombre(r_soleil, r_terre, d_soleil_km);
  const ru = c.rayon_ombre(d_lune_km),
    rp = c.rayon_penombre(d_lune_km);
  const v = (2 * Math.PI * d_lune_km) / (mois_j * 24.0);
  return {
    rayon_ombre_km: ru,
    rayon_penombre_km: rp,
    ombre_en_diametres_lunaires: ru / r_lune,
    longueur_ombre_km: c.longueur_ombre,
    vitesse_kmh: v,
    totalite_h: Math.max(0.0, (2 * (ru - r_lune)) / v),
    ombre_totale_h: (2 * (ru + r_lune)) / v,
    penombre_h: (2 * (rp + r_lune)) / v,
  };
}

// ---------------------------------------------------------------- Lune
export function fraction_eclairee(elongation: number): number {
  return (1.0 - Math.cos(elongation * DEG)) / 2.0;
}

export function nom_de_phase(angle: number, tol_quartier = 5.0, tol_lune = 12.0): string {
  const a = mod(angle, 360.0);
  const bornes: [number, string][] = [
    [tol_lune, 'nl'], [90 - tol_quartier, 'pc'], [90 + tol_quartier, 'pq'], [180 - tol_lune, 'gc'],
    [180 + tol_lune, 'pl'], [270 - tol_quartier, 'gd'], [270 + tol_quartier, 'dq'], [360 - tol_lune, 'dc'],
  ];
  for (const [borne, cle] of bornes) if (a <= borne) return cle;
  return 'nl';
}

// ---------------------------------------------------------------- modèles planétaires
export function position_circulaire(a: number, periode: number, t: number, phase0_deg = 0.0): [number, number] {
  const th = phase0_deg * DEG + (2 * Math.PI * t) / periode;
  return [a * Math.cos(th), a * Math.sin(th)];
}

export function longitude_geocentrique(a_planete: number, t_annees: number, phase_planete = 0.0, phase_terre = 0.0): number {
  const [xp, yp] = position_circulaire(a_planete, periode_annees(a_planete), t_annees, phase_planete);
  const [xt, yt] = position_circulaire(1.0, 1.0, t_annees, phase_terre);
  return mod(Math.atan2(yp - yt, xp - xt) * RAD, 360.0);
}

const cacheRetro = new Map<number, Record<string, number>>();
/** Mouvement rétrograde d'une planète supérieure : durée (jours) et amplitude (degrés) de la boucle. */
export function retrogradation(a_planete: number): Record<string, number> {
  const deja = cacheRetro.get(a_planete);
  if (deja) return deja;
  const p = periode_annees(a_planete);
  const w = 2 * Math.PI * (1 - 1 / p);
  const dlam = (t: number): number => {
    const h = 1e-6;
    return mod180(longitude_geocentrique(a_planete, t + h) - longitude_geocentrique(a_planete, t - h)) / (2 * h);
  };
  let lo = 0.0,
    hi = 0.5 * ((2 * Math.PI) / w);
  let res: Record<string, number>;
  if (dlam(lo) >= 0) res = { duree_j: 0.0, amplitude: 0.0 };
  else {
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (dlam(mid) < 0) lo = mid;
      else hi = mid;
    }
    const ts = (lo + hi) / 2;
    const amp = 2 * Math.abs(mod180(longitude_geocentrique(a_planete, ts) - longitude_geocentrique(a_planete, 0.0)));
    res = { duree_j: 2 * ts * ANNEE_JULIENNE_J, amplitude: amp, demi_duree_annees: ts };
  }
  if (cacheRetro.size > 32) cacheRetro.clear();
  cacheRetro.set(a_planete, res);
  return res;
}

export const PTOLEMEE_MARS = { R: 60.0, e: 6.0, r: 39.5, apogee: 106.67, kappa0: 3.53, alpha0: 327.22, periode: 1.881 };
export const PTOLEMEE_SOLEIL = { R: 60.0, e: 2.5, apogee: 65.5, kappa0: 265.25 };

export interface Ptolemee {
  centre: [number, number];
  mars: [number, number];
  equant: [number, number];
  deferent: [number, number];
  kappa: number;
  longitude: number;
}

export function ptolemee_mars(t_annees: number, p = PTOLEMEE_MARS): Ptolemee {
  const kappa = (p.kappa0 - p.apogee) * DEG + (2 * Math.PI * t_annees) / p.periode;
  const gamma = (p.alpha0 + p.kappa0 - p.apogee) * DEG + 2 * Math.PI * t_annees;
  const e = p.e,
    rd = p.R;
  const m = -e * Math.cos(kappa) + Math.sqrt(rd * rd - e * e * Math.sin(kappa) ** 2);
  const cx = 2 * e + m * Math.cos(kappa),
    cy = m * Math.sin(kappa);
  const mx = cx + p.r * Math.cos(gamma),
    my = cy + p.r * Math.sin(gamma);
  return {
    centre: [cx, cy],
    mars: [mx, my],
    equant: [2 * e, 0.0],
    deferent: [e, 0.0],
    kappa: mod(kappa * RAD, 360.0),
    longitude: mod(Math.atan2(my, mx) * RAD + p.apogee, 360.0),
  };
}

export function ptolemee_soleil(t_annees: number, p = PTOLEMEE_SOLEIL): [number, number] {
  const k = p.kappa0 * DEG + 2 * Math.PI * t_annees;
  return [p.e + p.R * Math.cos(k), p.R * Math.sin(k)];
}

export function epicycles(t: number, r_interieur = 85.0, r_exterieur = 200.0, centre = 1): Record<string, unknown> {
  const p3 = (r_exterieur / r_interieur) ** 1.5;
  const b: [number, number] = [r_interieur * Math.cos(2 * Math.PI * t), r_interieur * Math.sin(2 * Math.PI * t)];
  const c: [number, number] = [r_exterieur * Math.cos((2 * Math.PI * t) / p3), r_exterieur * Math.sin((2 * Math.PI * t) / p3)];
  const corps: Record<number, [number, number]> = { 1: [0.0, 0.0], 2: b, 3: c };
  const o = corps[centre]!;
  const out: Record<string, unknown> = {};
  for (const k of [1, 2, 3]) out[k] = [corps[k]![0] - o[0], corps[k]![1] - o[1]];
  out.periode3 = p3;
  return out;
}

// ---------------------------------------------------------------- zodiaque
export const LIMITES_ZODIAQUE_2026: readonly [string, number][] = [
  ['ari', 29.05], ['tau', 53.779], ['gem', 90.503], ['cnc', 118.351], ['leo', 138.402], ['vir', 174.214],
  ['lib', 218.172], ['sco', 241.424], ['oph', 248.001], ['sgr', 266.601], ['cap', 300.02], ['aqr', 327.852],
  ['psc', 352.013],
];

export function constellation_du_soleil(lam: number, limites: readonly [string, number][] | null = null): string {
  const lim = limites ?? LIMITES_ZODIAQUE_2026;
  lam = mod(lam, 360.0);
  const debut = [...lim].sort((a, b) => a[1] - b[1]);
  let nom = debut[debut.length - 1]![0];
  for (const [cle, l0] of debut) if (lam >= l0) nom = cle;
  return nom;
}

// ================================================================ lot 2 : Lune, Renaissance, astronomie antique
export const G_SI = 6.674_3e-11;
export const GM_TERRE = 3.986_004_418e14;
export const MASSE_TERRE_KG = GM_TERRE / G_SI;
export const MASSE_LUNE_KG = MASSE_TERRE_KG / 81.300_568;
export const MASSE_SOLEIL_KG = GM_SOLEIL / G_SI;
export const ANNEE_SIDERALE_J = 365.256_363_004;
export const MOIS_SIDERAL_J = 27.321_661_55;
export const ANNEE_DRACONITIQUE_J = 346.620_075_883;
export const INCLINAISON_LUNE = 5.145;
export const SECONDES_D_ARC_PAR_RADIAN = 648_000.0 / Math.PI;

/** Angle de phase (degrés) d'un corps : angle, vu du corps, entre le Soleil et l'observateur. */
export function angle_de_phase(corps: readonly number[], soleil_: readonly number[], observateur: readonly number[]): number {
  const a = soleil_.map((s, i) => s - corps[i]!);
  const b = observateur.map((o, i) => o - corps[i]!);
  const na = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
  const nb = Math.sqrt(b.reduce((s, x) => s + x * x, 0));
  if (na === 0 || nb === 0) return 0.0;
  const cosi = a.reduce((s, x, i) => s + x * b[i]!, 0) / (na * nb);
  return Math.acos(Math.max(-1.0, Math.min(1.0, cosi))) * RAD;
}

export function fraction_eclairee_phase(i: number): number {
  return (1.0 + Math.cos(i * DEG)) / 2.0;
}

export function periode_synodique(p1: number, p2: number): number {
  const d = Math.abs(1.0 / p1 - 1.0 / p2);
  return d === 0 ? Infinity : 1.0 / d;
}

export function periode_siderale(synodique: number, p_terre = 1.0, superieure = true): number {
  const inv = superieure ? 1.0 / p_terre - 1.0 / synodique : 1.0 / p_terre + 1.0 / synodique;
  return inv <= 0 ? Infinity : 1.0 / inv;
}

export function demi_grand_axe(periode: number, masse_soleils = 1.0): number {
  return (masse_soleils * periode * periode) ** (1.0 / 3.0);
}

export function force_gravitation(m1_kg: number, m2_kg: number, r_m: number): number {
  return (G_SI * m1_kg * m2_kg) / (r_m * r_m);
}

export function periode_orbite_terre(r_m: number, gm = GM_TERRE): number {
  return 2 * Math.PI * Math.sqrt(r_m ** 3 / gm);
}

export function vitesse_circulaire(r_m: number, gm = GM_TERRE): number {
  return Math.sqrt(gm / r_m);
}

export function rayon_orbite_terre(periode_s: number, gm = GM_TERRE): number {
  return ((gm * periode_s * periode_s) / (4 * Math.PI * Math.PI)) ** (1.0 / 3.0);
}

export function diametre_angulaire(d: number, distance: number): { sphere: number; segment: number; petits_angles: number } {
  const k = SECONDES_D_ARC_PAR_RADIAN;
  const sphere = 2 * Math.asin(Math.min(1.0, d / (2 * distance))) * k;
  return { sphere, segment: 2 * Math.atan(d / (2 * distance)) * k, petits_angles: (d / distance) * k };
}

export function jour_solaire(rotation: number, annee: number): number {
  return periode_synodique(rotation, annee);
}

// ---------------------------------------------------------------- Lune : phases moyennes et éclipses
export function phase_moyenne_jde(k: number): number {
  const t = k / 1236.85;
  return 2_451_550.097_66 + MOIS_SYNODIQUE_J * k + 0.000_154_37 * t * t - 0.00000015 * t ** 3 + 0.00000000073 * t ** 4;
}

export function argument_latitude_lune(k: number): number {
  const t = k / 1236.85;
  return mod(160.710_8 + 390.670_502_84 * k - 0.001_611_8 * t * t - 0.000_002_27 * t ** 3 + 0.000_000_011 * t ** 4, 360.0);
}

export function phase_la_plus_proche(jj: number, pleine: boolean): number {
  const k = (jj - 2_451_550.097_66) / MOIS_SYNODIQUE_J;
  const pl = pleine ? 1 : 0;
  return Math.floor(k) + 0.5 * pl + (k - Math.floor(k) - 0.5 * pl > 0.5 ? 1.0 : 0.0);
}

export function noeud_ascendant_lune(jj: number): number {
  const t = siecles_j2000(jj);
  return mod(125.044_547_9 - 1_934.136_289_1 * t + 0.002_075_4 * t * t + t ** 3 / 467_441.0 - t ** 4 / 60_616_000.0, 360.0);
}

/** Instants (jj) où la longitude du Soleil égale celle d'un nœud de l'orbite lunaire, entre jj0 et jj1. */
export function soleil_au_noeud(jj0: number, jj1: number): [number, string][] {
  const vitesse = 360.0 / ANNEE_DRACONITIQUE_J;
  const out: [number, string][] = [];
  let j = jj0;
  while (j < jj1 + ANNEE_DRACONITIQUE_J) {
    for (const [cible, nom] of [[0.0, 'asc'], [180.0, 'desc']] as [number, string][]) {
      let x = j + mod(cible - (soleil(j).lambda - noeud_ascendant_lune(j)), 360.0) / vitesse;
      for (let i = 0; i < 8; i++) {
        const ecart = mod180(soleil(x).lambda - noeud_ascendant_lune(x) - cible);
        x -= ecart / vitesse;
      }
      if (jj0 <= x && x <= jj1 && !out.some(([y]) => Math.abs(x - y) < 10)) out.push([x, nom]);
    }
    j += ANNEE_DRACONITIQUE_J / 2;
  }
  return out.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
}

// ---------------------------------------------------------------- marées
export function maree_equilibre(
  psi_deg: number, masse_kg: number, distance_m: number, r_terre_m = R_TERRE_KM * 1000.0, m_terre_kg = MASSE_TERRE_KG,
): number {
  const k = (masse_kg / m_terre_kg) * (r_terre_m / distance_m) ** 3 * r_terre_m;
  const c = Math.cos(psi_deg * DEG);
  return (k * (3 * c * c - 1)) / 2;
}

export function rapport_marees_soleil_lune(d_lune_m = D_LUNE_KM * 1000.0, d_soleil_m = UA_KM * 1000.0): number {
  return (MASSE_SOLEIL_KG / MASSE_LUNE_KG) * (d_lune_m / d_soleil_m) ** 3;
}

// ---------------------------------------------------------------- précession, lever héliaque
/** Précession rigoureuse (IAU 1976, Meeus éq. 21.2–21.4) de l'équinoxe jj0 vers jj ; degrés. */
export function precession(ra_deg: number, dec_deg: number, jj: number, jj0 = 2_451_545.0): [number, number] {
  const t0 = siecles_j2000(jj0);
  const t = (jj - jj0) / 36_525.0;
  const zeta = ((2306.2181 + 1.39656 * t0 - 0.000139 * t0 * t0) * t + (0.30188 - 0.000344 * t0) * t * t + 0.017998 * t ** 3) / 3600.0;
  const z = ((2306.2181 + 1.39656 * t0 - 0.000139 * t0 * t0) * t + (1.09468 + 0.000066 * t0) * t * t + 0.018203 * t ** 3) / 3600.0;
  const theta = ((2004.3109 - 0.8533 * t0 - 0.000217 * t0 * t0) * t - (0.42665 + 0.000217 * t0) * t * t - 0.041833 * t ** 3) / 3600.0;
  const a = ra_deg * DEG,
    d = dec_deg * DEG;
  const ze = zeta * DEG,
    th = theta * DEG;
  const aa = Math.cos(d) * Math.sin(a + ze);
  const bb = Math.cos(th) * Math.cos(d) * Math.cos(a + ze) - Math.sin(th) * Math.sin(d);
  const cc = Math.sin(th) * Math.cos(d) * Math.cos(a + ze) + Math.cos(th) * Math.sin(d);
  const ra = mod(Math.atan2(aa, bb) * RAD + z, 360.0);
  return [ra, Math.asin(Math.max(-1.0, Math.min(1.0, cc))) * RAD];
}

export function hauteur(h_deg: number, dec: number, lat: number): number {
  const s = Math.sin(lat * DEG) * Math.sin(dec * DEG) + Math.cos(lat * DEG) * Math.cos(dec * DEG) * Math.cos(h_deg * DEG);
  return Math.asin(Math.max(-1.0, Math.min(1.0, s))) * RAD;
}

export function visible_a_l_aube(
  ra_etoile: number, dec_etoile: number, lat: number, annee: number, jour: number, depression = 7.0,
): number | null {
  const jj = jj_jour_de_l_annee(annee, jour + 0.5);
  const s = soleil(jj);
  const hh = angle_horaire_lever(s.delta, lat, -depression);
  if (hh === 0.0 || hh === 180.0) return null;
  const tsl = s.alpha - hh;
  const [ra, dec] = precession(ra_etoile, dec_etoile, jj);
  return hauteur(tsl - ra, dec, lat);
}

export function lever_heliaque(
  ra_etoile: number, dec_etoile: number, lat: number, annee = 2026, depression = 7.0,
): [number[], (number | null)[]] {
  const h: (number | null)[] = [];
  for (let j = 0; j < 365; j++) h.push(visible_a_l_aube(ra_etoile, dec_etoile, lat, annee, j, depression));
  const vis = h.map((x) => x !== null && x > 0);
  const jours: number[] = [];
  for (let j = 0; j < 365; j++) if (vis[j] && !vis[(j - 1 + 365) % 365]) jours.push(j);
  return [jours, h];
}
