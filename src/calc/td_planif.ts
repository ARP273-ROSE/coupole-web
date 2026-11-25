/**
 * Planificateur du TP de parallaxe : jumeau de Coupole (coupole/modules/td/planif.py).  Pour deux lieux, les créneaux
 * où l'ISS (TLE + SGP4) ou la Lune (Meeus, comme erfa.moon98) est visible des deux à la fois, classés par la même
 * note.  Soleil : Meeus chap. 25 ; ombre de la Terre cylindrique ; étoiles de repère : Yale Bright Star Catalogue
 * (V ≤ 5,5), précessées de J2000 à la date (IAU 1976) pour être comparées à la Lune vraie de la date.
 * Références communes : tests/references/td_planif_reference.json (sortie de Coupole, contrôlée par skyfield).
 */
import { lunePosition } from './lune_meeus';
import { soleil } from './astro';
import { ecef, enu, type V3 } from './td_parallaxe';

const RAD = Math.PI / 180;
const R_EQ = 6378.137;
const UA_KM = 149597870.7;
const R_LUNE = 1737.4;
const MAG_ISS_1000 = -1.8;
export const JOURS_MAX = { iss: 14, lune: 400, tendance: 90 } as const;
/** Dérive mesurée d'un TLE de l'ISS (≈ 3,8 s par jour d'âge) ; la marge affichée en vaut le double (comme Coupole). */
export const DERIVE_TLE_S_PAR_JOUR = 3.8;

export class ErreurPlanif extends Error {
  constructor(public cle: string, public valeurs: Record<string, string | number> = {}) {
    super(cle);
  }
}

export interface Site { lat: number; lon: number; alt_m: number; nom: string }

export interface Criteres {
  cible: 'iss' | 'lune';
  debut: Date;
  jours: number;
  h_min: number;
  soleil_max: number;
  etoile_mag_max: number;
  etoile_sep_max: number;
  phase_max: number;
  pas_s: number;
  max_resultats: number;
  tendance: boolean;
}

export function criteres(cible: 'iss' | 'lune', debut: Date, autres: Partial<Criteres> = {}): Criteres {
  return { cible, debut, jours: cible === 'iss' ? 7 : 60, h_min: 20, soleil_max: -6, etoile_mag_max: 4.5, etoile_sep_max: 5,
    phase_max: 0.95, pas_s: 0, max_resultats: 40, tendance: false, ...autres };
}

export interface Etoile { nom: string; V: number; sep1: number; sep2: number; delta_arcmin: number; ideal_arcmin: number }
export interface Point { t: Date; h1: number; az1: number; h2: number; az2: number }

export interface Creneau {
  cible: 'iss' | 'lune';
  debut: Date; fin: Date; meilleur: Date;
  note: number;
  h: [number, number]; az: [number, number]; distance_km: [number, number]; soleil: [number, number];
  parallaxe_deg: number; ecart_plan_deg: number; entre: boolean;
  erreur_sujet_pct: number | null;
  vitesse_deg_s: number; synchro_s: number;
  magnitude: number[]; altitude_km: number | null; phase: number | null;
  etoile: Etoile | null;
  etoiles_proches: { nom: string; V: number; sep: number }[];
  trace: Point[];
  remarques: string[];
  marge_s: number;
}

export interface Resultat {
  cible: 'iss' | 'lune';
  creneaux: Creneau[];
  nombre_total: number;
  base_km: number;
  age_tle_j: number | null;
  debut: Date; fin: Date;
  source: string;
  sites: [Site, Site];
  alertes: string[];
  tendance: boolean;
}

// ------------------------------------------------------------------ vecteurs
const sous = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const ps = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const fois = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const vect = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export function angle(u: V3, v: V3): number {
  return Math.acos(Math.max(-1, Math.min(1, ps(u, v) / (nrm(u) * nrm(v))))) / RAD;
}

function hauteurAz(s: Site, v: V3): [number, number, number] {
  const [E, N, Z] = enu(s.lat, s.lon);
  const d = nrm(v);
  const h = Math.asin(Math.max(-1, Math.min(1, ps(v, Z) / d))) / RAD;
  const az = ((Math.atan2(ps(v, E), ps(v, N)) / RAD) % 360 + 360) % 360;
  return [h, az, d];
}

/** Temps sidéral apparent de Greenwich (rad), UT1 ≈ UTC, comme lune_meeus. */
function gast(t: Date): number {
  const jd = t.getTime() / 86_400_000 + 2_440_587.5;
  const T = (jd + 69.184 / 86400 - 2451545.0) / 36525;
  const Tu = (jd - 2451545.0) / 36525;
  const om = (125.04452 - 1934.136261 * T) * RAD;
  const L = (280.4665 + 36000.7698 * T) * RAD;
  const Lp = (218.3165 + 481267.8813 * T) * RAD;
  const dpsi = (-17.2 * Math.sin(om) - 1.32 * Math.sin(2 * L) - 0.23 * Math.sin(2 * Lp) + 0.21 * Math.sin(2 * om)) / 3600;
  const eps = 23.4392911 * RAD;
  const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * Tu * Tu - (Tu * Tu * Tu) / 38710000;
  return ((((gmst + dpsi * Math.cos(eps)) % 360) + 360) % 360) * RAD;
}

function versTerre(v: V3, th: number): V3 {
  const c = Math.cos(th);
  const s = Math.sin(th);
  return [c * v[0] + s * v[1], -s * v[0] + c * v[1], v[2]];
}

/** Soleil géocentrique dans le repère terrestre (km). */
function soleilTerre(t: Date): V3 {
  const jd = t.getTime() / 86_400_000 + 2_440_587.5 + 69.184 / 86400;
  const s = soleil(jd);
  const r = s.distance * UA_KM;
  const a = s.alpha * RAD;
  const d = s.delta * RAD;
  return versTerre([r * Math.cos(d) * Math.cos(a), r * Math.cos(d) * Math.sin(a), r * Math.sin(d)], gast(t));
}

/** Matrice de précession J2000 → date (IAU 1976, Lieske 1977 ; Meeus chap. 21). */
function precession(t: Date): number[][] {
  const T = (t.getTime() / 86_400_000 + 2_440_587.5 + 69.184 / 86400 - 2451545.0) / 36525;
  const z0 = ((2306.2181 + (0.30188 + 0.017998 * T) * T) * T) / 3600 * RAD;
  const z = ((2306.2181 + (1.09468 + 0.018203 * T) * T) * T) / 3600 * RAD;
  const th = ((2004.3109 - (0.42665 + 0.041833 * T) * T) * T) / 3600 * RAD;
  const [cz0, sz0, cz, sz, ct, st] = [Math.cos(z0), Math.sin(z0), Math.cos(z), Math.sin(z), Math.cos(th), Math.sin(th)];
  return [
    [cz0 * cz * ct - sz0 * sz, -sz0 * cz * ct - cz0 * sz, -cz * st],
    [cz0 * sz * ct + sz0 * cz, -sz0 * sz * ct + cz0 * cz, -sz * st],
    [cz0 * st, -sz0 * st, ct],
  ];
}

// ------------------------------------------------------------------ étoiles
export interface Catalogue { u: V3[]; V: number[]; noms: string[] }
let CATALOGUE: Catalogue | null = null;

export function poserEtoiles(liste: [number, number, number, string][]): Catalogue {
  CATALOGUE = {
    u: liste.map(([ra, de]) => [Math.cos(de * RAD) * Math.cos(ra * RAD), Math.cos(de * RAD) * Math.sin(ra * RAD), Math.sin(de * RAD)] as V3),
    V: liste.map((e) => e[2]),
    noms: liste.map((e) => e[3]),
  };
  return CATALOGUE;
}

export async function etoiles(): Promise<Catalogue> {
  if (CATALOGUE) return CATALOGUE;
  const m = await import('../donnees/genere/etoiles_v55.json');
  return poserEtoiles((m.default as unknown as { etoiles: [number, number, number, string][] }).etoiles);
}

/** Étoiles (J2000) → repère terrestre à l'instant t (précession, puis temps sidéral). */
function etoilesTerre(cat: Catalogue, idx: number[], t: Date): V3[] {
  const P = precession(t);
  const th = gast(t);
  return idx.map((i) => {
    const u = cat.u[i]!;
    const w: V3 = [ps(P[0] as V3, u), ps(P[1] as V3, u), ps(P[2] as V3, u)];
    return versTerre(w, th);
  });
}

// ------------------------------------------------------------------ base et formule du sujet
export interface Base { r1: V3; r2: V3; corde_km: number; normale: V3 | null }

export function base(s1: Site, s2: Site): Base {
  const r1 = ecef(s1.lat, s1.lon, s1.alt_m);
  const r2 = ecef(s2.lat, s2.lon, s2.alt_m);
  const n = vect(r1, r2);
  const nn = nrm(n);
  return { r1, r2, corde_km: nrm(sous(r2, r1)), normale: nn > 0 ? fois(n, 1 / nn) : null };
}

function ecartPlan(B: Base, X: V3): number {
  if (!B.normale) return 0;
  const m = fois([B.r1[0] + B.r2[0], B.r1[1] + B.r2[1], B.r1[2] + B.r2[2]], 0.5);
  const v = sous(X, m);
  return Math.asin(Math.min(1, Math.abs(ps(v, B.normale)) / nrm(v))) / RAD;
}

export function erreurSujet(B: Base, h1: number, h2: number, entre: boolean, vraie: number): number | null {
  const da = entre ? 180 - h1 - h2 : Math.abs(h1 - h2);
  if (da <= 1e-6) return null;
  return (100 * (B.corde_km / (da * RAD) - vraie)) / vraie;
}

export function magnitudeISS(d_km: number, phase_deg: number): number {
  const b = phase_deg * RAD;
  const f = (Math.sin(b) + (Math.PI - b) * Math.cos(b)) / Math.PI;
  return MAG_ISS_1000 + 5 * Math.log10(d_km / 1000) - 2.5 * Math.log10(Math.max(f, 1e-4));
}

function plages(ok: boolean[]): [number, number][] {
  const out: [number, number][] = [];
  let i = -1;
  ok.forEach((x, k) => {
    if (x && i < 0) i = k;
    if (!x && i >= 0) {
      out.push([i, k - 1]);
      i = -1;
    }
  });
  if (i >= 0) out.push([i, ok.length - 1]);
  return out;
}

function noteISS(hmin: number, ecart: number, err: number | null, par: number): number {
  const a = Math.min(Math.max((hmin - 10) / 50, 0), 1);
  const b = Math.exp(-((ecart / 12) ** 2));
  const c = Math.min(Math.max(par / 15, 0), 1);
  const e = err === null ? 0.3 : Math.exp(-((Math.abs(err) / 15) ** 2));
  return 100 * a ** 0.7 * (0.35 + 0.65 * b) * (0.4 + 0.6 * c) * (0.5 + 0.5 * e);
}

function noteLune(hmin: number, delta: number, phase: number, base_km: number): number {
  const a = Math.min(Math.max((hmin - 5) / 40, 0), 1);
  const ideal = ((base_km / 384400) * 180) / Math.PI * 60;
  const b = Math.min(Math.max(delta / Math.max(ideal, 1e-6), 0), 1);
  const c = 1 - 0.5 * Math.min(Math.max(phase, 0), 1);
  return 100 * a ** 0.6 * (0.2 + 0.8 * b) * c;
}

// ------------------------------------------------------------------ ISS
export type PositionISS = (t: Date) => V3 | null;

export function chercherISS(s1: Site, s2: Site, c: Criteres, iss: PositionISS, epoqueTle: Date | null): Resultat {
  const jours = Math.min(Math.max(c.jours, 0.1), c.tendance ? JOURS_MAX.tendance : JOURS_MAX.iss);
  const pas = c.pas_s || (c.tendance ? 10 : 5);
  const n = Math.floor((jours * 86400) / pas + 1e-9);
  const B = base(s1, s2);
  const O = [B.r1, B.r2];
  const S = [s1, s2];
  const w = sous(B.r2, B.r1);
  const m = fois([B.r1[0] + B.r2[0], B.r1[1] + B.r2[1], B.r1[2] + B.r2[2]], 0.5);
  const T: Date[] = [];
  const X: (V3 | null)[] = [];
  const H: [number[], number[]] = [[], []];
  const AZ: [number[], number[]] = [[], []];
  const DI: [number[], number[]] = [[], []];
  const HS: [number[], number[]] = [[], []];
  const SOL: V3[] = [];
  const ok: boolean[] = [];
  let solCache: [number, V3] = [-1e12, [0, 0, 0]];
  for (let k = 0; k < n; k++) {
    const t = new Date(c.debut.getTime() + k * pas * 1000);
    T.push(t);
    const x = iss(t);
    X.push(x);
    if (t.getTime() - solCache[0] > 60_000) solCache = [t.getTime(), soleilTerre(t)];      // le Soleil bouge peu en 1 min
    const sol = solCache[1];
    SOL.push(sol);
    let bon = x !== null;
    for (const j of [0, 1]) {
      const hs = hauteurAz(S[j]!, sous(sol, O[j]!))[0];
      HS[j].push(hs);
      if (x) {
        const [hh, az, d] = hauteurAz(S[j]!, sous(x, O[j]!));
        H[j].push(hh), AZ[j].push(az), DI[j].push(d);
        bon &&= hh >= c.h_min && hs <= c.soleil_max;
      } else {
        H[j].push(NaN), AZ[j].push(NaN), DI[j].push(NaN);
      }
    }
    if (bon && x) {
      const us = fois(sol, 1 / nrm(sol));
      const p = ps(x, us);
      bon = p > 0 || nrm(sous(x, fois(us, p))) > R_EQ;
    }
    ok.push(bon);
  }
  const out: Creneau[] = [];
  for (const [i, j] of plages(ok)) {
    let best = -1;
    let bk = i;
    const errs: (number | null)[] = [];
    for (let k = i; k <= j; k++) {
      const x = X[k]!;
      const v1 = sous(x, B.r1);
      const v2 = sous(x, B.r2);
      const entre = ps(v1, w) > 0 && ps(v2, fois(w, -1)) > 0;
      const err = erreurSujet(B, H[0][k]!, H[1][k]!, entre, nrm(sous(x, m)));
      errs.push(err);
      const nt = noteISS(Math.min(H[0][k]!, H[1][k]!), ecartPlan(B, x), err, angle(v1, v2));
      if (nt > best) {
        best = nt;
        bk = k;
      }
    }
    const x = X[bk]!;
    const v = [sous(x, B.r1), sous(x, B.r2)] as const;
    const entre = ps(v[0], w) > 0 && ps(v[1], fois(w, -1)) > 0;
    const par = angle(v[0], v[1]);
    const sol = SOL[bk]!;
    const mag = [0, 1].map((q) => magnitudeISS(DI[q as 0 | 1][bk]!, angle(sous(sol, x), fois(v[q]!, -1))));
    const xs = bk + 1 < n ? X[bk + 1] : null;
    const vit = xs ? angle(v[0], sous(xs, B.r1)) / pas : 0;
    const cr: Creneau = {
      cible: 'iss', debut: T[i]!, fin: T[j]!, meilleur: T[bk]!, note: best,
      h: [H[0][bk]!, H[1][bk]!], az: [AZ[0][bk]!, AZ[1][bk]!], distance_km: [DI[0][bk]!, DI[1][bk]!], soleil: [HS[0][bk]!, HS[1][bk]!],
      parallaxe_deg: par, ecart_plan_deg: ecartPlan(B, x), entre, erreur_sujet_pct: errs[bk - i] ?? null,
      vitesse_deg_s: vit, synchro_s: vit > 0 ? (0.01 * par) / vit : Infinity, magnitude: mag,
      altitude_km: nrm(x) - R_EQ, phase: null, etoile: null, etoiles_proches: [], trace: [], remarques: [], marge_s: 0,
    };
    if (CATALOGUE) {
      const idx = CATALOGUE.V.map((_, q) => q);
      const W = etoilesTerre(CATALOGUE, idx, T[bk]!);
      const d = fois(v[0], 1 / nrm(v[0]));
      cr.etoiles_proches = idx.map((q) => ({ q, sep: Math.acos(Math.max(-1, Math.min(1, ps(W[q]!, d)))) / RAD }))
        .filter((e) => e.sep <= 15).sort((a, b) => CATALOGUE!.V[a.q]! - CATALOGUE!.V[b.q]!).slice(0, 3)
        .map((e) => ({ nom: CATALOGUE!.noms[e.q]!, V: CATALOGUE!.V[e.q]!, sep: e.sep }));
    }
    for (let k = Math.max(i - 12, 0); k <= Math.min(j + 12, n - 1); k += 2) {
      if (X[k]) cr.trace.push({ t: T[k]!, h1: H[0][k]!, az1: AZ[0][k]!, h2: H[1][k]!, az2: AZ[1][k]! });
    }
    if (!cr.entre && cr.ecart_plan_deg < 15) cr.remarques.push('pl_r_meme_cote');
    if (cr.ecart_plan_deg >= 15) cr.remarques.push('pl_r_hors_plan');
    if (Math.max(...mag) > 1.5) cr.remarques.push('pl_r_faible');
    if (epoqueTle) {
      cr.marge_s = Math.max(30, (2 * DERIVE_TLE_S_PAR_JOUR * Math.abs(cr.meilleur.getTime() - epoqueTle.getTime())) / 86_400_000);
      if (cr.marge_s > 120) cr.remarques.push('pl_r_indicatif');
    }
    out.push(cr);
  }
  const age = epoqueTle ? (c.debut.getTime() - epoqueTle.getTime()) / 86_400_000 : null;
  return finir(out, c, B, age, 'tle', [s1, s2], jours);
}

// ------------------------------------------------------------------ Lune
export function chercherLune(s1: Site, s2: Site, c: Criteres, cat: Catalogue): Resultat {
  const jours = Math.min(Math.max(c.jours, 0.5), JOURS_MAX.lune);
  const pas = c.pas_s || 300;
  const n = Math.floor((jours * 86400) / pas + 1e-9);
  const B = base(s1, s2);
  const O = [B.r1, B.r2];
  const S = [s1, s2];
  const sel = cat.V.map((v, i) => (v <= c.etoile_mag_max ? i : -1)).filter((i) => i >= 0);
  const out: Creneau[] = [];
  interface Pas { t: Date; M: V3; h: [number, number]; az: [number, number]; d: [number, number]; hs: [number, number]; phase: number; ok: boolean }
  const P: Pas[] = [];
  for (let k = 0; k < n; k++) {
    const t = new Date(c.debut.getTime() + k * pas * 1000);
    const M = lunePosition(t).terrestre;
    const sol = soleilTerre(t);
    const h: [number, number] = [0, 0];
    const az: [number, number] = [0, 0];
    const d: [number, number] = [0, 0];
    const hs: [number, number] = [0, 0];
    for (const j of [0, 1] as const) {
      [h[j], az[j], d[j]] = hauteurAz(S[j]!, sous(M, O[j]!));
      hs[j] = hauteurAz(S[j]!, sous(sol, O[j]!))[0];
    }
    const phase = (1 - Math.cos(angle(M, sol) * RAD)) / 2;
    P.push({ t, M, h, az, d, hs, phase, ok: Math.min(...h) >= c.h_min && Math.max(...hs) <= c.soleil_max && phase <= c.phase_max });
  }
  for (const [i, j] of plages(P.map((p) => p.ok))) {
    let meilleur: { note: number; k: number; e: number; p1: number; p2: number; dl: number } | null = null;
    for (let k = i; k <= j; k++) {
      const p = P[k]!;
      const um = fois(p.M, 1 / nrm(p.M));
      const W = etoilesTerre(cat, sel, p.t);
      const u = [fois(sous(p.M, O[0]!), 1 / p.d[0]), fois(sous(p.M, O[1]!), 1 / p.d[1])];
      const rayon = [Math.asin(R_LUNE / p.d[0]) / RAD, Math.asin(R_LUNE / p.d[1]) / RAD];
      // comme Coupole : à chaque instant, l'étoile au meilleur score (Δφ, petit bonus d'éclat) ; puis l'instant à la meilleure note
      let choix: { score: number; e: number; p1: number; p2: number; dl: number } | null = null;
      sel.forEach((e, q) => {
        const wq = W[q]!;
        if (Math.acos(Math.max(-1, Math.min(1, ps(wq, um)))) / RAD > c.etoile_sep_max + 1.5) return;
        const p1 = Math.acos(Math.max(-1, Math.min(1, ps(wq, u[0]!)))) / RAD;
        const p2 = Math.acos(Math.max(-1, Math.min(1, ps(wq, u[1]!)))) / RAD;
        if (p1 > c.etoile_sep_max || p2 > c.etoile_sep_max || p1 <= rayon[0]! + 0.1 || p2 <= rayon[1]! + 0.1) return;
        const dl = Math.abs(p1 - p2) * 60;
        const score = dl * (1 + 0.08 * Math.min(Math.max(c.etoile_mag_max - cat.V[e]!, 0), 5));
        if (!choix || score > choix.score) choix = { score, e, p1, p2, dl };
      });
      if (choix) {
        const ch = choix as { score: number; e: number; p1: number; p2: number; dl: number };
        const nt = noteLune(Math.min(...p.h), ch.dl, p.phase, B.corde_km);
        if (!meilleur || nt > meilleur.note) meilleur = { note: nt, k, e: ch.e, p1: ch.p1, p2: ch.p2, dl: ch.dl };
      }
    }
    if (!meilleur) continue;
    const { note, k, e, p1, p2, dl } = meilleur;
    const p = P[k]!;
    const ps2 = P[Math.min(k + 1, n - 1)]!;
    const vit = angle(sous(p.M, O[0]!), sous(ps2.M, O[0]!)) / pas;
    const mil = fois([B.r1[0] + B.r2[0], B.r1[1] + B.r2[1], B.r1[2] + B.r2[2]], 0.5);
    const ideal = (B.corde_km / nrm(sous(p.M, mil))) * (180 / Math.PI) * 60;
    const cr: Creneau = {
      cible: 'lune', debut: P[i]!.t, fin: P[j]!.t, meilleur: p.t, note,
      h: p.h, az: p.az, distance_km: p.d, soleil: p.hs,
      parallaxe_deg: angle(sous(p.M, O[0]!), sous(p.M, O[1]!)), ecart_plan_deg: ecartPlan(B, p.M), entre: false,
      erreur_sujet_pct: dl > 0 ? 100 * (ideal / dl - 1) : null, vitesse_deg_s: vit,
      synchro_s: (0.01 * dl) / 60 / (0.55 / 3600), magnitude: [], altitude_km: null, phase: p.phase,
      etoile: { nom: cat.noms[e]!, V: cat.V[e]!, sep1: p1, sep2: p2, delta_arcmin: dl, ideal_arcmin: ideal },
      etoiles_proches: [], trace: [], remarques: [], marge_s: 0,
    };
    const a = Math.max(i - 6, 0);
    const b = Math.min(j + 6, n - 1);
    const pt = Math.max(1, Math.floor((b - a) / 60));
    for (let q = a; q <= b; q += pt) cr.trace.push({ t: P[q]!.t, h1: P[q]!.h[0], az1: P[q]!.az[0], h2: P[q]!.h[1], az2: P[q]!.az[1] });
    if (dl < 0.3 * ideal) cr.remarques.push('pl_r_lune_faible');
    if (p.phase > 0.8) cr.remarques.push('pl_r_lune_pleine');
    out.push(cr);
  }
  return finir(out, c, B, null, 'meeus', [s1, s2], jours);
}

function finir(out: Creneau[], c: Criteres, B: Base, age: number | null, source: string, sites: [Site, Site], jours: number): Resultat {
  const tendance = c.tendance && c.cible === 'iss';
  if (tendance) out.sort((a, b) => a.meilleur.getTime() - b.meilleur.getTime());
  else out.sort((a, b) => b.note - a.note);
  const alertes: string[] = [];
  if (tendance) alertes.push('pl_a_tendance');
  else if (c.cible === 'iss' && age !== null && age + jours > 5) alertes.push('pl_a_tle_vieux');
  return { cible: c.cible, tendance, creneaux: out.slice(0, tendance ? Math.max(c.max_resultats, 400) : c.max_resultats), nombre_total: out.length, base_km: B.corde_km, age_tle_j: age,
    debut: c.debut, fin: new Date(c.debut.getTime() + jours * 86_400_000), source, sites, alertes };
}

// ------------------------------------------------------------------ exports
const iso = (x: Date): string => x.toISOString().replace(/\.\d{3}Z$/, 'Z');

export function csv(r: Resultat): string {
  const t = (x: Date): string => iso(x).replace('T', ' ').replace('Z', '+0000');
  const f = (x: number | null, c: number): string => (x === null || !Number.isFinite(x) ? '' : String(Math.round(x * 10 ** c) / 10 ** c));
  const l = ['cible;debut;fin;meilleur;note;h1;az1;h2;az2;d1_km;d2_km;soleil1;soleil2;parallaxe_deg;ecart_plan_deg;entre;erreur_sujet_pct;vitesse_deg_s;synchro_s;mag1;mag2;phase;etoile;V;delta_arcmin;marge_s'];
  for (const c of r.creneaux) {
    const e = c.etoile;
    l.push([c.cible, t(c.debut), t(c.fin), t(c.meilleur), f(c.note, 1), f(c.h[0], 2), f(c.az[0], 2), f(c.h[1], 2), f(c.az[1], 2),
      f(c.distance_km[0], 1), f(c.distance_km[1], 1), f(c.soleil[0], 1), f(c.soleil[1], 1), f(c.parallaxe_deg, 4), f(c.ecart_plan_deg, 2),
      c.entre ? '1' : '0', f(c.erreur_sujet_pct, 1), f(c.vitesse_deg_s, 4), f(c.synchro_s, 3),
      c.magnitude.length ? c.magnitude[0]!.toFixed(1) : '', c.magnitude.length ? c.magnitude[1]!.toFixed(1) : '',
      f(c.phase, 3), e?.nom ?? '', e ? String(e.V) : '', e ? f(e.delta_arcmin, 2) : '', c.marge_s ? String(Math.round(c.marge_s)) : ''].join(';'));
  }
  return l.join('\n') + '\n';
}

export function ics(r: Resultat): string {
  const f = (x: Date): string => iso(x).replace(/[-:]/g, '');
  const now = f(new Date());
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Coupole Web//Planificateur parallaxe//FR'];
  r.creneaux.forEach((c, k) => {
    const titre = (c.cible === 'iss' ? 'Parallaxe ISS' : 'Parallaxe Lune') + ` (${Math.round(c.note)}/100)`;
    let desc = `h1 ${c.h[0].toFixed(1)}° az1 ${c.az[0].toFixed(1)}° / h2 ${c.h[1].toFixed(1)}° az2 ${c.az[1].toFixed(1)}° ; meilleur instant ${iso(c.meilleur).slice(11, 19)} UTC`;
    if (c.marge_s > 120) desc += ` ; heure indicative à ± ${Math.round(c.marge_s / 60)} min`;
    if (c.etoile) desc += ` ; étoile ${c.etoile.nom} (V ${c.etoile.V.toFixed(1)}), Δφ ${c.etoile.delta_arcmin.toFixed(2)}′`;
    out.push('BEGIN:VEVENT', `UID:coupole-planif-${f(c.meilleur)}-${k}@coupole`, 'DTSTAMP:' + now, 'DTSTART:' + f(c.debut),
      'DTEND:' + f(new Date(c.fin.getTime() + 1000)), 'SUMMARY:' + titre, 'DESCRIPTION:' + desc.replace(/;/g, '\\;').replace(/,/g, '\\,'), 'END:VEVENT');
  });
  out.push('END:VCALENDAR');
  return out.join('\r\n') + '\r\n';
}
