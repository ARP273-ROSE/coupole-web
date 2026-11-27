/**
 * Pluies de météores (TP « Observation des météores ») — jumeau de `coupole/modules/td/meteores.py` de Coupole :
 * mêmes données (calendrier 2027 de l'IMO, pentes de Jenniskens 1994), mêmes formules, mêmes règles de la fiche IMO.
 *
 *   ZHR = N · r^(6,5 − LM) / (F · t_eff · sin h)        n = ZHR · F · sin h / r^(6,5 − LM)
 *   ZHR(λ) = ZHR_max · 10^(−B |λ − λ_max|) (deux composantes pondérées pour QUA, PER, GEM, URS) ; sans pente publiée,
 *   B = 2 / |Δλ| de chaque côté (1 % du maximum aux limites d'activité) : profil indicatif.
 *
 * Astronomie : Soleil de Meeus (astro.soleil), Lune de Meeus (lune_meeus), précession IAU 1976 et temps sidéral
 * apparent comme le planificateur de parallaxe (td_planif) ; longitude solaire J2000 = longitude apparente de Meeus
 * moins la précession générale en longitude.  Écart au bureau (ERFA) : quelques millièmes de degré.
 */
import DONNEES from '../donnees/genere/meteores_imo.json';
import { jour_julien, soleil } from './astro';
import { lunePosition } from './lune_meeus';
import { ecef, type V3 } from './td_parallaxe';
import { gast, hauteurAz, plages, precession, soleilTerre, versTerre, type Site } from './td_planif';

const RAD = Math.PI / 180;
export const SOLEIL_MAX = -12.0;
export const H_RADIANT_MIN = 20.0;
export const LUNE_NEGLIGEABLE = 0.25;
export const CHAMP_H = 60.0;
export const CHAMP_SEP = 30.0;
const PRECESSION_DEG_SIECLE = 1.396_971_37;
const JOUR_MS = 86_400_000;

export interface Pluie {
  code: string;
  nom: { fr: string; en: string };
  iau: number;
  debut: string;
  fin: string;
  max: string | null;
  lambda_max: number | null;
  alpha: number;
  delta: number;
  v: number;
  r: number;
  zhr: number;
  note_zhr: string;
  radiants?: [string, number, number][];
  profil?: [number, number, number][];
}

const DOC = DONNEES as unknown as { source: { imo: string; pentes: string }; annee_tableaux: number; pluies: Pluie[] };
export const PLUIES: readonly Pluie[] = DOC.pluies;
export const SOURCES = DOC.source;

export function pluie(code: string): Pluie {
  const p = PLUIES.find((x) => x.code === code);
  if (!p) throw new Error(code);
  return p;
}
export const variable = (p: Pluie): boolean => p.note_zhr === 'var';

const mod = (x: number, m: number): number => ((x % m) + m) % m;

// ------------------------------------------------------------------ temps
export const jjDe = (t: Date): number => t.getTime() / JOUR_MS + 2_440_587.5;
export const dateDeJj = (jj: number): Date => new Date((jj - 2_440_587.5) * JOUR_MS);

/** λ⊙ (°, équinoxe J2000) à la date julienne UTC jj (TT ≈ UTC + 69,184 s). */
export function longitudeSolaire(jj: number): number {
  const jt = jj + 69.184 / 86400;
  const t = (jt - 2_451_545.0) / 36_525.0;
  return mod(soleil(jt).lambda - PRECESSION_DEG_SIECLE * t, 360);
}

export function jjLongitude(lam: number, annee: number): number {
  const j0 = jour_julien(annee, 1, 1.0);
  let jj = j0 + mod(lam - longitudeSolaire(j0), 360) / 0.985_647;
  for (let k = 0; k < 6; k++) {
    const d = mod(lam - longitudeSolaire(jj) + 180, 360) - 180;
    jj += d / 0.985_647;
    if (Math.abs(d) < 1e-7) break;
  }
  return jj;
}

function lamDate(mmjj: string, annee: number, finDeJournee = false): number {
  const [m, j] = mmjj.split('-').map(Number) as [number, number];
  return longitudeSolaire(jour_julien(annee, m, j) + (finDeJournee ? 1 : 0));
}

interface Geometrie { l0: number; l1: number; lm: number | null; largeur: number; um: number | null; pts: [number, number, number][] }
const GEO = new Map<string, Geometrie>();

function geometrie(code: string): Geometrie {
  let g = GEO.get(code);
  if (g) return g;
  const p = pluie(code);
  const an = DOC.annee_tableaux;
  const l0 = lamDate(p.debut, an);
  const l1 = lamDate(p.fin, an, true);
  const lm = p.lambda_max;
  const u = (lam: number): number => mod(lam - l0 + 30, 360) - 30;
  let pts = (p.radiants ?? []).map(([d, a, de]) => [u(lamDate(d, an)), a, de] as [number, number, number]);
  pts.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
  if (pts.length) {
    const a0 = pts[0]![1];
    pts = pts.map(([x, a, de]) => [x, a0 + mod(a - a0 + 180, 360) - 180, de]);
  }
  g = { l0, l1, lm, largeur: mod(l1 - l0, 360), um: lm !== null ? u(lm) : null, pts };
  GEO.set(code, g);
  return g;
}
export const geometrieDe = geometrie;

export function actif(code: string, lam: number): boolean {
  const g = geometrie(code);
  return mod(lam - g.l0, 360) <= g.largeur;
}

export function radiant(code: string, lam: number): [number, number] {
  const p = pluie(code);
  const pts = geometrie(code).pts;
  if (!pts.length) return [p.alpha, p.delta];
  if (pts.length === 1) return [mod(pts[0]![1], 360), pts[0]![2]];
  const x = mod(lam - geometrie(code).l0 + 30, 360) - 30;
  let i = 0;
  while (i < pts.length - 2 && x > pts[i + 1]![0]) i++;
  const [x0, a0, d0] = pts[i]!;
  const [x1, a1, d1] = pts[i + 1]!;
  const f = (x - x0) / (x1 - x0);
  return [mod(a0 + f * (a1 - a0), 360), d0 + f * (d1 - d0)];
}

export function zhr(code: string, lam: number, zhrMax: number | null = null): number {
  const p = pluie(code);
  const g = geometrie(code);
  if (!actif(code, lam)) return 0;
  const zm = zhrMax ?? p.zhr;
  if (g.um === null) return zm;
  const dl = mod(lam - g.l0 + 30, 360) - 30 - g.um;
  if (p.profil?.length) {
    const tot = p.profil.reduce((s, c) => s + c[0], 0);
    return (zm * p.profil.reduce((s, c) => s + c[0] * 10 ** (-(dl < 0 ? c[1] : c[2]) * Math.abs(dl)), 0)) / tot;
  }
  const cote = dl < 0 ? g.um : g.largeur - g.um;
  return zm * 10 ** ((-2 * Math.abs(dl)) / Math.max(cote, 0.5));
}

export const pentePubliee = (code: string): boolean => !!pluie(code).profil?.length || geometrie(code).um === null;

export function tauxAttendu(z: number, h: number, lm = 6.5, f = 1, r = 2.5): number {
  return h <= 0 ? 0 : (z * f * Math.sin(h * RAD)) / r ** (6.5 - lm);
}

// ------------------------------------------------------------------ positions
function direction(alpha: number, delta: number): V3 {
  const a = alpha * RAD;
  const d = delta * RAD;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}

/** Direction J2000 → repère terrestre à l'instant t (précession puis temps sidéral apparent). */
function versTerreJ2000(u: V3, t: Date): V3 {
  const P = precession(t);
  const w: V3 = [0, 1, 2].map((k) => P[k]![0]! * u[0] + P[k]![1]! * u[1] + P[k]![2]! * u[2]) as V3;
  return versTerre(w, gast(t));
}

export function hauteurAzDe(site: Site, alpha: number, delta: number, t: Date): [number, number] {
  const [h, az] = hauteurAz(site, versTerreJ2000(direction(alpha, delta), t));
  return [h, az];
}

export function hauteurRadiant(site: Site, code: string, t: Date): number {
  const [a, d] = radiant(code, longitudeSolaire(jjDe(t)));
  return hauteurAzDe(site, a, d, t)[0];
}

export function fractionLune(t: Date): number {
  const s = soleilTerre(t);
  const l = lunePosition(t).terrestre;
  const c = (s[0] * l[0] + s[1] * l[1] + s[2] * l[2]) / (Math.hypot(...s) * Math.hypot(...l));
  return (1 - c) / 2;
}

// ------------------------------------------------------------------ calendrier
export interface LigneCalendrier {
  code: string; nom: { fr: string; en: string }; iau: number;
  debut: Date; fin: Date; max: Date | null; lambda_max: number | null;
  zhr: number; note_zhr: string; r: number; v: number; alpha: number; delta: number; pente: boolean;
  lune?: number; culmination?: number;
}
const CAL = new Map<number, LigneCalendrier[]>();

export function calendrier(annee: number, site: Site | null = null): LigneCalendrier[] {
  let base = CAL.get(annee);
  if (!base) {
    base = PLUIES.map((p) => {
      const g = geometrie(p.code);
      const jm = g.lm !== null ? jjLongitude(g.lm, annee) : null;
      let j0 = jjLongitude(g.l0, annee);
      const ref = jm ?? j0;
      if (j0 > ref) j0 = jjLongitude(g.l0, annee - 1);
      let j1 = jjLongitude(g.l1, annee);
      if (j1 < ref) j1 = jjLongitude(g.l1, annee + 1);
      const [a, d] = radiant(p.code, g.lm ?? g.l0);
      const e: LigneCalendrier = {
        code: p.code, nom: p.nom, iau: p.iau, debut: dateDeJj(j0 + 0.5), fin: dateDeJj(j1 - 0.5),
        max: jm !== null ? dateDeJj(jm) : null, lambda_max: g.lm, zhr: p.zhr, note_zhr: p.note_zhr, r: p.r, v: p.v,
        alpha: a, delta: d, pente: pentePubliee(p.code),
      };
      if (jm !== null) e.lune = fractionLune(dateDeJj(jm));
      return e;
    });
    base.sort((x, y) => (x.max ?? x.debut).getTime() - (y.max ?? y.debut).getTime());
    CAL.set(annee, base);
  }
  return base.map((e) => (site ? { ...e, culmination: 90 - Math.abs(site.lat - e.delta) } : { ...e }));
}

// ------------------------------------------------------------------ une nuit
/** Midi solaire moyen du lieu, le jour donné (jour = « AAAA-MM-JJ » ou [a, m, j]). */
export function midiLocal(site: Site, a: number, m: number, j: number): Date {
  return new Date(Date.UTC(a, m - 1, j, 12) - (site.lon / 15) * 3_600_000);
}

export function champ(azR: number, hR: number, azL: number | null): [number, number] | null {
  if (hR < H_RADIANT_MIN) return null;
  const hr = hR * RAD;
  const hc = CHAMP_H * RAD;
  const c = (Math.cos(CHAMP_SEP * RAD) - Math.sin(hr) * Math.sin(hc)) / (Math.cos(hr) * Math.cos(hc));
  const daz = Math.acos(Math.max(-1, Math.min(1, c))) / RAD;
  const cands = [mod(azR + daz, 360), mod(azR - daz, 360)];
  if (azL !== null) cands.sort((x, y) => Math.abs(mod(y - azL + 180, 360) - 180) - Math.abs(mod(x - azL + 180, 360) - 180));
  return [cands[0]!, CHAMP_H];
}

export interface PluieNuit {
  code: string; nom: { fr: string; en: string }; alpha: number; delta: number;
  h: number[]; az: number[]; zhr: number[]; taux: number[]; utile: boolean[];
  heures: number; attendu: number; r: number; variable: boolean;
  meilleur: number | null; champ: [number, number] | null;
}
export interface Nuit {
  debut: Date; pas_s: number; soleil: number[]; lune: number[]; lune_az: number[]; lune_frac: number;
  nuit: [number, number] | null; pluies: PluieNuit[];
}
export const instant = (N: Nuit, i: number): Date => new Date(N.debut.getTime() + i * N.pas_s * 1000);

export function nuit(site: Site, jour: [number, number, number], lm = 6.0, f = 1.0, codes: string[] | null = null,
  pasMin = 5.0, zhrForce: Record<string, number> = {}): Nuit {
  const t0 = midiLocal(site, ...jour);
  const n = Math.round((24 * 60) / pasMin) + 1;
  const O = ecef(site.lat, site.lon, site.alt_m);
  const T: Date[] = [];
  const hs: number[] = [];
  const hl: number[] = [];
  const azl: number[] = [];
  const P: number[][][] = [];
  const th: number[] = [];
  let frac = 0;
  for (let i = 0; i < n; i++) {
    const t = new Date(t0.getTime() + i * pasMin * 60_000);
    T.push(t);
    P.push(precession(t));
    th.push(gast(t));
    const S = soleilTerre(t);
    hs.push(hauteurAz(site, [S[0] - O[0], S[1] - O[1], S[2] - O[2]])[0]);
    const L = lunePosition(t).terrestre;
    const [h, az] = hauteurAz(site, [L[0] - O[0], L[1] - O[1], L[2] - O[2]]);
    hl.push(h);
    azl.push(az);
    if (i === Math.floor(n / 2)) frac = fractionLune(t);
  }
  const noir = hs.map((h) => h < SOLEIL_MAX);
  const pl = plages(noir);
  const luneOk = hl.map((h) => h < 0 || frac <= LUNE_NEGLIGEABLE);
  const jj0 = jjDe(t0);
  const la0 = longitudeSolaire(jj0);
  const la1 = longitudeSolaire(jj0 + ((n - 1) * pasMin) / 1440);
  const lamT = T.map((_, i) => la0 + (mod(la1 - la0, 360) * i) / (n - 1));
  const lmid = mod(lamT[Math.floor(n / 2)]!, 360);
  const out: PluieNuit[] = [];
  for (const p of PLUIES) {
    if (codes !== null && !codes.includes(p.code)) continue;
    if (codes === null && !actif(p.code, lmid)) continue;
    const zm = zhrForce[p.code] ?? null;
    const [a, d] = radiant(p.code, lmid);
    const u = direction(a, d);
    const h: number[] = [];
    const az: number[] = [];
    for (let i = 0; i < n; i++) {
      const Pm = P[i]!;
      const w: V3 = [0, 1, 2].map((k) => Pm[k]![0]! * u[0] + Pm[k]![1]! * u[1] + Pm[k]![2]! * u[2]) as V3;
      const [hh, aa] = hauteurAz(site, versTerre(w, th[i]!));
      h.push(hh);
      az.push(aa);
    }
    const z = lamT.map((x) => zhr(p.code, mod(x, 360), zm));
    const taux = z.map((x, i) => (x * f * Math.sin(Math.max(h[i]!, 0) * RAD)) / p.r ** (6.5 - lm));
    const utile = noir.map((x, i) => x && h[i]! >= H_RADIANT_MIN && luneOk[i]!);
    const nu = utile.filter(Boolean).length;
    const e: PluieNuit = {
      code: p.code, nom: p.nom, alpha: a, delta: d, h, az, zhr: z, taux, utile,
      heures: (nu * pasMin) / 60, attendu: (taux.reduce((s, x, i) => s + (utile[i] ? x : 0), 0) * pasMin) / 60,
      r: p.r, variable: variable(p) && zm === null, meilleur: null, champ: null,
    };
    if (nu) {
      let best = -1;
      let v = -1;
      for (let i = 0; i < n; i++) if (utile[i] && taux[i]! > v) { v = taux[i]!; best = i; }
      e.meilleur = best;
      e.champ = champ(az[best]!, h[best]!, hl[best]! > 0 ? azl[best]! : null);
    }
    out.push(e);
  }
  out.sort((x, y) => y.attendu - x.attendu);
  return { debut: t0, pas_s: pasMin * 60, soleil: hs, lune: hl, lune_az: azl, lune_frac: frac, nuit: pl[0] ?? null, pluies: out };
}

// ------------------------------------------------------------------ campagne
export interface LigneCampagne {
  nuit: string; code: string; nom: { fr: string; en: string }; attendu: number; heures: number; meilleur: Date;
  taux_max: number; h_radiant: number; zhr: number; lune: number; lune_levee: boolean; champ: [number, number] | null;
  note: number;
}

const iso = (a: number, m: number, j: number): string => `${a}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`;

export function campagne(site: Site, debut: [number, number, number], fin: [number, number, number], lm = 6.0, f = 1.0,
  minAttendu = 5.0, codes: string[] | null = null, zhrForce: Record<string, number> = {}): LigneCampagne[] {
  const out: LigneCampagne[] = [];
  const d0 = Date.UTC(debut[0], debut[1] - 1, debut[2]);
  const d1 = Date.UTC(fin[0], fin[1] - 1, fin[2]);
  for (let d = d0; d <= d1; d += JOUR_MS) {
    const x = new Date(d);
    const jour: [number, number, number] = [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()];
    const N = nuit(site, jour, lm, f, codes, 10.0, zhrForce);
    for (const e of N.pluies) {
      if (e.attendu >= minAttendu && e.meilleur !== null) {
        const i = e.meilleur;
        out.push({
          nuit: iso(...jour), code: e.code, nom: e.nom, attendu: e.attendu, heures: e.heures, meilleur: instant(N, i),
          taux_max: e.taux[i]!, h_radiant: e.h[i]!, zhr: e.zhr[i]!, lune: N.lune_frac, lune_levee: N.lune[i]! > 0,
          champ: e.champ, note: 0,
        });
      }
    }
  }
  if (out.length) {
    const m = Math.max(...out.map((x) => x.attendu));
    for (const x of out) x.note = Math.round((100 * Math.log1p(x.attendu)) / Math.log1p(m));
  }
  return out;
}

const ics_t = (t: Date): string => t.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function ics(lignes: LigneCampagne[], siteNom = ''): string {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Coupole//Meteores//FR', 'CALSCALE:GREGORIAN'];
  for (const x of lignes) {
    const t = x.meilleur;
    L.push('BEGIN:VEVENT', `UID:${x.code}-${ics_t(t)}@coupole`, `DTSTAMP:${ics_t(new Date())}`,
      `DTSTART:${ics_t(new Date(t.getTime() - 3_600_000))}`, `DTEND:${ics_t(new Date(t.getTime() + 3_600_000))}`,
      `SUMMARY:${x.nom.fr} (${Math.round(x.attendu)} attendus)`,
      `DESCRIPTION:${siteNom} ZHR ${x.zhr.toFixed(0)}, radiant ${x.h_radiant.toFixed(0)}°, ${x.heures.toFixed(0)} h utiles, Lune ${(100 * x.lune).toFixed(0)} %`,
      'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.join('\r\n') + '\r\n';
}

export function csv(lignes: LigneCampagne[]): string {
  const L = ['nuit;code;pluie;attendus;heures_utiles;meilleur;taux_max_par_h;h_radiant_deg;zhr;lune_pct;note'];
  for (const x of lignes) {
    L.push([x.nuit, x.code, x.nom.fr, x.attendu.toFixed(0), x.heures.toFixed(1),
      x.meilleur.toISOString().slice(0, 16).replace('T', ' ') + ' UTC', x.taux_max.toFixed(0), x.h_radiant.toFixed(0),
      x.zhr.toFixed(0), (100 * x.lune).toFixed(0), String(x.note)].join(';'));
  }
  return L.join('\n') + '\n';
}

// ------------------------------------------------------------------ réduction
export interface Reduction {
  zhr: number | null; err: number | null;
  facteurs: { temps: number; champ: number; lm: number; hauteur: number } | null;
  alertes: string[];
}

export function reduction(n: number, tEff: number, lm: number, f: number, r: number, h: number): Reduction {
  if (tEff <= 0 || f <= 0) throw new Error('mt_err_entrees');
  const alertes: string[] = [];
  if (h < H_RADIANT_MIN) alertes.push('mt_alerte_h');
  if (f < 0.8) alertes.push('mt_alerte_f');
  if (h <= 0) return { zhr: null, err: null, facteurs: null, alertes };
  const fac = { temps: 1 / tEff, champ: 1 / f, lm: r ** (6.5 - lm), hauteur: 1 / Math.sin(h * RAD) };
  const z = n * fac.temps * fac.champ * fac.lm * fac.hauteur;
  return { zhr: z, err: n > 0 ? z / Math.sqrt(n) : null, facteurs: fac, alertes };
}

export function indicePopulation(comptes: Record<number, number>, lm: number): { r: number | null; rapports: [number, number][] } {
  const ms = Object.keys(comptes).map(Number);
  if (!ms.length) return { r: null, rapports: [] };
  const cum = new Map<number, number>();
  let s = 0;
  for (let m = Math.trunc(Math.min(...ms)); m <= Math.floor(lm); m++) {
    s += comptes[m] ?? 0;
    cum.set(m, s);
  }
  const rap: [number, number][] = [];
  for (const [m, c] of cum) {
    if (cum.has(m + 1) && m + 1 <= lm - 1 && c >= 3) rap.push([m, cum.get(m + 1)! / c]);
  }
  return { r: rap.length ? rap.reduce((a, [, x]) => a + x, 0) / rap.length : null, rapports: rap };
}
