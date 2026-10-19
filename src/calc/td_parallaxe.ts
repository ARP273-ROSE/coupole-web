/**
 * Calculateur « Parallaxe (TP du cours) » : même démarche et mêmes formules que Coupole
 * (coupole/modules/td/parallaxe_tp.py), ellipsoïde WGS84 exact ; références communes (tests/references/
 * td_parallaxe_sage.json, SageMath ; td_parallaxe_reference.json, Python + astropy) : corde à 1 mm près.
 *
 * Le sujet : 2α = h₁ − h₂ (objet vu du même côté ; 180° − h₁ − h₂ s'il est entre les lieux), R = distance entre les
 * lieux (à la surface « avec Google Earth », ou la corde « avec EarthLocation d'astropy »), D = R / 2α.  Puis le
 * calcul exact (les deux horizons font l'angle θ) et, avec l'heure, l'éphéméride (Lune : Meeus ; ISS : TLE + SGP4).
 */
import { lunePosition, type Lune } from './lune_meeus';

export const A_WGS84 = 6378.137;
export const F_WGS84 = 1 / 298.257223563;
export const R_TERRE_MOYEN = 6371.0088;
const E2 = F_WGS84 * (2 - F_WGS84);
const RAD = Math.PI / 180;

export type V3 = [number, number, number];
const sous = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const plus = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const fois = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const pscal = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norme = (a: V3): number => Math.hypot(a[0], a[1], a[2]);

export class ErreurTP extends Error {
  constructor(public cle: string, public valeurs: Record<string, string | number> = {}) {
    super(cle);
  }
}

export interface Lieu {
  lat: number;
  lon: number;
  alt_m: number;
  h: number | null;
  az: number | null;
}

export function lieu(lat: number, lon: number, alt_m = 0, h: number | null = null, az: number | null = null): Lieu {
  return { lat, lon, alt_m, h, az };
}

// ------------------------------------------------------------------ géométrie terrestre
/** Position géocentrique (km), WGS84 (mêmes formules qu'EarthLocation.from_geodetic). */
export function ecef(lat: number, lon: number, alt_m = 0): V3 {
  const la = lat * RAD;
  const lo = lon * RAD;
  const N = A_WGS84 / Math.sqrt(1 - E2 * Math.sin(la) ** 2);
  const h = alt_m / 1000;
  return [(N + h) * Math.cos(la) * Math.cos(lo), (N + h) * Math.cos(la) * Math.sin(lo), (N * (1 - E2) + h) * Math.sin(la)];
}

/** Position géocentrique (km) → [latitude °, longitude °, hauteur km] (itération de la latitude géodésique). */
export function geodetique(P: V3): V3 {
  const [x, y, z] = P;
  const p = Math.hypot(x, y);
  const lo = Math.atan2(y, x);
  let la = Math.atan2(z, p * (1 - E2));
  let h = 0;
  for (let i = 0; i < 12; i++) {
    const N = A_WGS84 / Math.sqrt(1 - E2 * Math.sin(la) ** 2);
    h = p / Math.cos(la) - N;
    la = Math.atan2(z, p * (1 - (E2 * N) / (N + h)));
  }
  const N = A_WGS84 / Math.sqrt(1 - E2 * Math.sin(la) ** 2);
  h = Math.abs(Math.cos(la)) > 1e-9 ? p / Math.cos(la) - N : Math.abs(z) - A_WGS84 * (1 - F_WGS84);
  return [la / RAD, lo / RAD, h];
}

export function enu(lat: number, lon: number): [V3, V3, V3] {
  const la = lat * RAD;
  const lo = lon * RAD;
  return [
    [-Math.sin(lo), Math.cos(lo), 0],
    [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)],
    [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)],
  ];
}

export function direction(lat: number, lon: number, h: number, az: number): V3 {
  const [E, N, Z] = enu(lat, lon);
  const hr = h * RAD;
  const a = az * RAD;
  return plus(plus(fois(E, Math.cos(hr) * Math.sin(a)), fois(N, Math.cos(hr) * Math.cos(a))), fois(Z, Math.sin(hr)));
}

function azimutVers(o: Lieu, cible: V3): number {
  const [E, N] = enu(o.lat, o.lon);
  const v = sous(cible, ecef(o.lat, o.lon, o.alt_m));
  return (((Math.atan2(pscal(v, E), pscal(v, N)) / RAD) % 360) + 360) % 360;
}

/** Distance à la surface de l'ellipsoïde (Vincenty 1975), km. */
export function geodesiqueKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a = A_WGS84;
  const f = F_WGS84;
  const b = a * (1 - f);
  const L = (lon2 - lon1) * RAD;
  const U1 = Math.atan((1 - f) * Math.tan(lat1 * RAD));
  const U2 = Math.atan((1 - f) * Math.tan(lat2 * RAD));
  const [sU1, cU1, sU2, cU2] = [Math.sin(U1), Math.cos(U1), Math.sin(U2), Math.cos(U2)];
  let lam = L;
  let ss = 0, cs = 0, sig = 0, c2a = 0, c2sm = 0;
  let converge = false;
  for (let i = 0; i < 200; i++) {
    const sl = Math.sin(lam);
    const cl = Math.cos(lam);
    ss = Math.hypot(cU2 * sl, cU1 * sU2 - sU1 * cU2 * cl);
    if (ss === 0) return 0;
    cs = sU1 * sU2 + cU1 * cU2 * cl;
    sig = Math.atan2(ss, cs);
    const sa = (cU1 * cU2 * sl) / ss;
    c2a = 1 - sa * sa;
    c2sm = c2a ? cs - (2 * sU1 * sU2) / c2a : 0;
    const C = (f / 16) * c2a * (4 + f * (4 - 3 * c2a));
    const prec = lam;
    lam = L + (1 - C) * f * sa * (sig + C * ss * (c2sm + C * cs * (-1 + 2 * c2sm * c2sm)));
    if (Math.abs(lam - prec) < 1e-13) {
      converge = true;
      break;
    }
  }
  if (!converge) {
    const c = Math.sin(lat1 * RAD) * Math.sin(lat2 * RAD) + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.cos(L);
    return R_TERRE_MOYEN * Math.acos(Math.max(-1, Math.min(1, c)));
  }
  const u2 = (c2a * (a * a - b * b)) / (b * b);
  const A = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
  const B = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
  const ds = B * ss * (c2sm + (B / 4) * (cs * (-1 + 2 * c2sm * c2sm) - (B / 6) * c2sm * (-3 + 4 * ss * ss) * (-3 + 4 * c2sm * c2sm)));
  return b * A * (sig - ds);
}

export interface Geometrie {
  corde_km: number;
  surface_km: number;
  ecart_corde_surface_km: number;
  fleche_km: number;
  fleche_approchee_km: number;
  corde_sol_km: number;
  profondeur_deg: [number, number];
  angle_centre_deg: number;
  r1: V3;
  r2: V3;
  az_1_vers_2: number;
  az_2_vers_1: number;
}

export function geometrieBase(o1: Lieu, o2: Lieu): Geometrie {
  const r1 = ecef(o1.lat, o1.lon, o1.alt_m);
  const r2 = ecef(o2.lat, o2.lon, o2.alt_m);
  const v = sous(r2, r1);
  const R = norme(v);
  const s = geodesiqueKm(o1.lat, o1.lon, o2.lat, o2.lon);
  const s1 = ecef(o1.lat, o1.lon, 0);
  const s2 = ecef(o2.lat, o2.lon, 0);
  const fleche = R > 0 ? -geodetique(fois(plus(s1, s2), 0.5))[2] : 0;
  const corde0 = norme(sous(s2, s1));
  const prof: [number, number] = [0, 0];
  ([[o1, v], [o2, fois(v, -1)]] as [Lieu, V3][]).forEach(([o, w], k) => {
    const Z = enu(o.lat, o.lon)[2];
    prof[k] = R > 0 ? Math.asin(Math.max(-1, Math.min(1, pscal(w, Z) / R))) / RAD : 0;
  });
  const Z1 = enu(o1.lat, o1.lon)[2];
  const Z2 = enu(o2.lat, o2.lon)[2];
  return {
    corde_km: R, surface_km: s, ecart_corde_surface_km: s - R, fleche_km: fleche,
    fleche_approchee_km: (corde0 * corde0) / (8 * R_TERRE_MOYEN), corde_sol_km: corde0, profondeur_deg: prof,
    angle_centre_deg: Math.acos(Math.max(-1, Math.min(1, pscal(Z1, Z2)))) / RAD, r1, r2,
    az_1_vers_2: azimutVers(o1, r2), az_2_vers_1: azimutVers(o2, r1),
  };
}

/** 1 ou 2 (lieu suspect), 0 (l'un ou l'autre), null : latitude et longitude probablement échangées. */
export function inversionProbable(o1: Lieu, o2: Lieu): number | null {
  const base = (a: Lieu, b: Lieu): number => norme(sous(ecef(a.lat, a.lon), ecef(b.lat, b.lon)));
  if (base(o1, o2) < 3000) return null;
  const ok = ([[o1, o2], [o2, o1]] as [Lieu, Lieu][])
    .map(([a, b], k) => (Math.abs(a.lon) <= 90 && base(lieu(a.lon, a.lat), b) < 1500 ? k + 1 : 0))
    .filter((k) => k);
  return ok.length === 0 ? null : ok.length === 1 ? ok[0]! : 0;
}

// ------------------------------------------------------------------ calculs
export interface Sujet {
  deux_alpha_deg: number;
  deux_alpha_rad: number;
  alpha_deg: number;
  D_km: number;
  entre: boolean;
}

export function calculSujet(R_km: number, h1: number, h2: number, entre = false): Sujet {
  const deux_alpha = entre ? 180 - h1 - h2 : Math.abs(h1 - h2);
  if (deux_alpha <= 0) throw new ErreurTP('td_err_parallaxe_nulle');
  const rad = deux_alpha * RAD;
  return { deux_alpha_deg: deux_alpha, deux_alpha_rad: rad, alpha_deg: deux_alpha / 2, D_km: R_km / rad, entre };
}

export function trianguler(O1: V3, u1: V3, O2: V3, u2: V3): { M: V3; d1: number; d2: number; ecart: number } {
  u1 = fois(u1, 1 / norme(u1));
  u2 = fois(u2, 1 / norme(u2));
  const w = sous(O2, O1);
  const c = pscal(u1, u2);
  const b1 = pscal(w, u1);
  const b2 = pscal(w, u2);
  const det = -1 + c * c;
  if (Math.abs(det) < 1e-18) throw new ErreurTP('td_err_derriere');
  const d1 = (-b1 + c * b2) / det;
  const d2 = (b2 - c * b1) / det;
  const P1 = plus(O1, fois(u1, d1));
  const P2 = plus(O2, fois(u2, d2));
  return { M: fois(plus(P1, P2), 0.5), d1, d2, ecart: norme(sous(P1, P2)) };
}

export interface Exact {
  avec_azimuts: boolean;
  configuration: string;
  az_utilises: [number, number];
  distances_km: [number, number];
  distance_geo_km: number;
  altitude_km: number;
  sous_point: [number, number];
  ecart_droites_km: number;
  parallaxe_vraie_deg: number;
  M: V3;
}

export function calculExact(o1: Lieu, o2: Lieu, configuration = 'entre', g = geometrieBase(o1, o2)): Exact {
  if (o1.h === null || o2.h === null) throw new ErreurTP('td_err_hauteurs');
  const avec = o1.az !== null && o2.az !== null;
  let az1: number, az2: number;
  if (avec) [az1, az2] = [o1.az!, o2.az!];
  else if (configuration === 'entre') [az1, az2] = [g.az_1_vers_2, g.az_2_vers_1];
  else if (o1.h >= o2.h) [az1, az2] = [(g.az_1_vers_2 + 180) % 360, g.az_2_vers_1];
  else [az1, az2] = [g.az_1_vers_2, (g.az_2_vers_1 + 180) % 360];
  const u1 = direction(o1.lat, o1.lon, o1.h, az1);
  const u2 = direction(o2.lat, o2.lon, o2.h, az2);
  const t = trianguler(g.r1, u1, g.r2, u2);
  if (t.d1 <= 0 || t.d2 <= 0) throw new ErreurTP('td_err_derriere');
  const [la, lo, H] = geodetique(t.M);
  const p = Math.acos(Math.max(-1, Math.min(1, pscal(u1, u2) / (norme(u1) * norme(u2))))) / RAD;
  return {
    avec_azimuts: avec, configuration: avec ? 'azimuts' : configuration, az_utilises: [az1, az2],
    distances_km: [t.d1, t.d2], distance_geo_km: norme(t.M), altitude_km: H, sous_point: [la, lo],
    ecart_droites_km: t.ecart, parallaxe_vraie_deg: p, M: t.M,
  };
}

// ------------------------------------------------------------------ éphémérides
export interface EphLieu {
  distance_km: number;
  h_deg: number;
  h_refraction_deg?: number;
  az_deg: number;
  vitesse_h_deg_s?: number;
}

export interface Ephemeride {
  source: 'meeus' | 'tle';
  distance_geo_km?: number;
  altitude_km?: number;
  age_jours?: number;
  sous_point?: [number, number];
  vitesse_h_deg_s?: number;
  lieux: EphLieu[];
}

/** Réfraction (Saemundsson, 1986) pour une hauteur vraie, degrés. */
export function refractionVraie(h: number): number {
  h = Math.max(-1, h);
  return Math.max(0, 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * RAD)) / 60;
}

function altaz(o: Lieu, X: V3): EphLieu {
  const [E, N, Z] = enu(o.lat, o.lon);
  const v = sous(X, ecef(o.lat, o.lon, o.alt_m));
  const d = norme(v);
  return { distance_km: d, h_deg: Math.asin(pscal(v, Z) / d) / RAD, az_deg: (((Math.atan2(pscal(v, E), pscal(v, N)) / RAD) % 360) + 360) % 360 };
}

/** Lune vue des deux lieux (Meeus, comme erfa.moon98, + nutation : ≈ 10″ et quelques km). */
export function ephemerideLune(o1: Lieu, o2: Lieu, t: Date): Ephemeride {
  const l: Lune = lunePosition(t);
  const lieux = [o1, o2].map((o) => {
    const e = altaz(o, l.terrestre);
    return { ...e, h_refraction_deg: e.h_deg + refractionVraie(e.h_deg) };
  });
  const l2 = lunePosition(new Date(t.getTime() + 60_000));
  return { source: 'meeus', distance_geo_km: norme(l.terrestre), lieux, vitesse_h_deg_s: (altaz(o1, l2.terrestre).h_deg - lieux[0]!.h_deg) / 60 };
}

export type Propagateur = (t: Date) => { X: V3; age_jours: number } | null;

export function ephemerideISS(o1: Lieu, o2: Lieu, t: Date, prop: Propagateur): Ephemeride {
  const p = prop(t);
  const p2 = prop(new Date(t.getTime() + 1000));
  if (!p || !p2) throw new ErreurTP('td_err_tle');
  const [la, lo, H] = geodetique(p.X);
  const lieux = [o1, o2].map((o) => ({ ...altaz(o, p.X), vitesse_h_deg_s: altaz(o, p2.X).h_deg - altaz(o, p.X).h_deg }));
  return { source: 'tle', altitude_km: H, sous_point: [la, lo], age_jours: p.age_jours, lieux };
}

// ------------------------------------------------------------------ tout
export interface Entrees {
  o1: Lieu;
  o2: Lieu;
  cible: 'iss' | 'lune';
  instant: Date | null;
  propagateur: Propagateur | null;
  configuration: string;
  sigma_h_deg: number;
  sigma_pos_m: number;
  sigma_t_s: number;
  notes: [string, Record<string, string | number>][];
}

export function entrees(o1: Lieu, o2: Lieu, cible: 'iss' | 'lune' = 'iss', autres: Partial<Entrees> = {}): Entrees {
  return { o1, o2, cible, instant: null, propagateur: null, configuration: '', sigma_h_deg: 0.1, sigma_pos_m: 20, sigma_t_s: 1, notes: [], ...autres };
}

export interface Resultat {
  cible: string;
  configuration: string;
  geometrie: Geometrie;
  sujet_surface: Sujet;
  sujet_corde: Sujet;
  exact: Exact | null;
  ephemeride?: Ephemeride;
  alertes: [string, Record<string, string | number>][];
  incertitudes: Incertitudes;
  lieux: [Lieu, Lieu];
}

export interface Incertitudes {
  sigma_h_effectif_deg: number;
  sujet_total_km: number;
  exact_total_km: number | null;
}

export function calculer(e: Entrees): Resultat {
  const { o1, o2 } = e;
  if (o1.h === null || o2.h === null) throw new ErreurTP('td_err_hauteurs');
  let conf: string;
  if (o1.az !== null && o2.az !== null) {
    const d = ((((o1.az - o2.az + 180) % 360) + 360) % 360) - 180;
    conf = Math.abs(d) > 90 ? 'entre' : 'meme_cote';
  } else conf = e.configuration || 'meme_cote';
  const g = geometrieBase(o1, o2);
  if (g.corde_km < 0.01) throw new ErreurTP('td_err_meme_lieu');
  const entre = conf === 'entre';
  const alertes = [...e.notes];
  if (e.cible === 'lune' && (o1.az === null || o2.az === null)) alertes.push(['td_a_lune_azimuts', {}]);
  const k = inversionProbable(o1, o2);
  if (k !== null) alertes.push(k ? ['td_a_inversion_probable', { n: k }] : ['td_a_inversion_un_des_deux', {}]);
  let exact: Exact | null = null;
  try {
    exact = calculExact(o1, o2, conf, g);
  } catch (err) {
    alertes.push([err instanceof ErreurTP ? err.cle : 'td_err_derriere', {}]);
  }
  const r: Resultat = {
    cible: e.cible, configuration: conf, geometrie: g, sujet_surface: calculSujet(g.surface_km, o1.h, o2.h, entre),
    sujet_corde: calculSujet(g.corde_km, o1.h, o2.h, entre), exact, alertes, lieux: [o1, o2],
    incertitudes: { sigma_h_effectif_deg: 0, sujet_total_km: 0, exact_total_km: null },
  };
  if (e.instant) {
    try {
      if (e.cible === 'lune') r.ephemeride = ephemerideLune(o1, o2, e.instant);
      else if (e.propagateur) {
        r.ephemeride = ephemerideISS(o1, o2, e.instant, e.propagateur);
        if (Math.abs(r.ephemeride.age_jours ?? 0) > 3) alertes.push(['td_a_tle_ancien', { j: (r.ephemeride.age_jours ?? 0).toFixed(1) }]);
      }
    } catch (err) {
      if (err instanceof ErreurTP) alertes.push([err.cle, {}]);
      else throw err;
    }
  }
  r.incertitudes = incertitudes(e, r, conf);
  return r;
}

export function incertitudes(e: Entrees, r: Resultat, conf: string): Incertitudes {
  const { o1, o2 } = e;
  const D0 = r.sujet_corde.D_km;
  const ex0 = r.exact ? r.exact.distances_km[0] : null;
  const eph = r.ephemeride;
  const vit = eph ? Math.abs(eph.vitesse_h_deg_s ?? eph.lieux[0]?.vitesse_h_deg_s ?? 0) : 0;
  const sh = Math.hypot(e.sigma_h_deg, vit * e.sigma_t_s);
  const dl = e.sigma_pos_m / 111_320;
  const s2: number[] = [];
  const x2: number[] = [];
  const cas: [Lieu, Lieu][] = [
    [{ ...o1, h: o1.h! + sh }, o2],
    [o1, { ...o2, h: o2.h! + sh }],
    [{ ...o1, lat: o1.lat + dl, lon: o1.lon + dl }, o2],
    [o1, { ...o2, lat: o2.lat + dl, lon: o2.lon + dl }],
  ];
  for (const [a, b] of cas) {
    const g = geometrieBase(a, b);
    s2.push((calculSujet(g.corde_km, a.h!, b.h!, conf === 'entre').D_km - D0) ** 2);
    if (ex0 !== null) {
      try {
        x2.push((calculExact(a, b, conf, g).distances_km[0] - ex0) ** 2);
      } catch {
        /* configuration impossible pour ce décalage : contribution ignorée */
      }
    }
  }
  const somme = (t: number[]): number => Math.sqrt(t.reduce((a, b) => a + b, 0));
  return { sigma_h_effectif_deg: sh, sujet_total_km: somme(s2), exact_total_km: x2.length ? somme(x2) : null };
}

/** Données FICTIVES cohérentes (mêmes que l'appli de bureau). */
export function exemple(cible: 'iss' | 'lune'): Record<string, string> {
  if (cible === 'lune')
    return { cible: 'lune', p1: '48°51′23,76″ N 2°21′07,92″ E', p2: '43°17′47,40″ N 5°22′11,28″ E', alt1: '35', alt2: '12', h1: '31,96731', h2: '36,41708', az1: '117,50126', az2: '116,88005', instant: '2025-11-03 18:38:26' };
  return { cible: 'iss', p1: '48.8566, 2.3522', p2: '45.7640, 4.8357', alt1: '35', alt2: '170', h1: '62,483', h2: '33,603', az1: '14,184', az2: '346,928', instant: '' };
}

export { RAD as DEG_RAD, norme, sous };
