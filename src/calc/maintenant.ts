/**
 * « Maintenant » et « En direct » : l'instant de l'appareil pour les animations qui dépendent de la date et de
 * l'heure.  Même logique, ligne pour ligne, que `coupole/modules/anim/maintenant.py` (bureau) ; cas de parité :
 * `tests/references/maintenant_cas.json`.
 *
 * Aucune erreur de fuseau ni d'heure d'été :
 * - l'instant vient de `Date.now()` (temps universel absolu) ; les calculs se font en TU (jour julien) ;
 * - l'heure locale ne sert qu'à l'affichage, par le fuseau IANA de l'appareil
 *   (`Intl.DateTimeFormat().resolvedOptions().timeZone`) : « 09:20 heure de Paris (UTC+2) · 07:20 TU » ;
 * - une animation réglée en heure solaire reçoit l'heure solaire moyenne TU + longitude / 15 (longitude de « Ma
 *   position », demandée explicitement, sinon méridien du fuseau HORS heure d'été) ;
 * - le « jour » des animations est l'indice 0–364 d'une année de 365 jours (le 29 février compte comme le 28).
 */

export const MOIS_JOURS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export type Parties = [number, number, number, number, number, number]; // année, mois, jour, heure, minute, seconde

export interface Instant {
  ms: number;
  tz: string;
  decalage: number; // minutes, heure locale − TU, à cet instant (heure d'été comprise)
  decalage_standard: number; // minutes, hors heure d'été
  local: Parties;
  tu: Parties;
  jj: number;
}

/**
 * Ce que reçoit une animation : l'instant, la longitude retenue pour l'heure solaire (« Ma position » si elle a été
 * demandée, sinon méridien du fuseau) et la latitude de « Ma position » (null sinon : la position réglée reste).
 */
export interface Moment {
  i: Instant;
  lon: number;
  lat: number | null;
  position: boolean;
}

export function moment(i: Instant, position: { lat: number; lon: number } | null = null): Moment {
  return position ? { i, lon: position.lon, lat: position.lat, position: true } : { i, lon: meridienDuFuseau(i), lat: null, position: false };
}

export function fuseauLocal(): string {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (z && zoneValide(z)) return z;
  } catch {
    /* rien */
  }
  return 'UTC';
}

const FORMATS = new Map<string, Intl.DateTimeFormat>();
function format(tz: string): Intl.DateTimeFormat {
  let f = FORMATS.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    FORMATS.set(tz, f);
  }
  return f;
}

export function zoneValide(tz: string): boolean {
  try {
    format(tz);
    return true;
  } catch {
    return false;
  }
}

export function jourJulienMs(ms: number): number {
  return ms / 86_400_000.0 + 2_440_587.5;
}

function parties(ms: number, tz: string): Parties {
  const s = Math.floor(ms / 1000) * 1000;
  if (tz === 'UTC') {
    const d = new Date(s);
    return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()];
  }
  const p: Record<string, number> = {};
  for (const x of format(tz).formatToParts(new Date(s))) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return [p.year!, p.month!, p.day!, p.hour! % 24, p.minute!, p.second!];
}

export function decalageMinutes(ms: number, tz: string): number {
  const [a, mo, j, h, mi, s] = parties(ms, tz);
  const loc = Date.UTC(a, mo - 1, j, h, mi, s);
  return Math.round((loc - Math.floor(ms / 1000) * 1000) / 60000);
}

/** Décalage hors heure d'été : le plus petit des décalages du 1er janvier et du 1er juillet de l'année. */
export function decalageStandard(ms: number, tz: string): number {
  const an = parties(ms, 'UTC')[0];
  return Math.min(decalageMinutes(Date.UTC(an, 0, 1, 12), tz), decalageMinutes(Date.UTC(an, 6, 1, 12), tz));
}

export function instant(ms: number, tz: string): Instant {
  if (!zoneValide(tz)) tz = 'UTC';
  return { ms, tz, decalage: decalageMinutes(ms, tz), decalage_standard: decalageStandard(ms, tz), local: parties(ms, tz), tu: parties(ms, 'UTC'), jj: jourJulienMs(ms) };
}

export function maintenant(): Instant {
  return instant(Date.now(), fuseauLocal());
}

// ------------------------------------------------------------------ jours, heures
/** Indice 0–364 (année de 365 jours ; 29 février → 28 février). */
export function jourIndex(mois: number, jour: number): number {
  let s = 0;
  for (let i = 0; i < mois - 1; i++) s += MOIS_JOURS[i]!;
  return s + Math.min(jour, MOIS_JOURS[mois - 1]!) - 1;
}

export function heureDecimale(p: Parties): number {
  return p[3] + p[4] / 60.0 + p[5] / 3600.0;
}

/** Jour (indice) + fraction du jour en TU (jour-nuit). */
export function jourTU(i: Instant): number {
  return jourIndex(i.tu[1], i.tu[2]) + heureDecimale(i.tu) / 24.0;
}

/** [indice du jour, heure solaire moyenne] à la longitude (degrés, est positive). */
export function heureSolaire(i: Instant, longitude: number): [number, number] {
  const p = parties(i.ms + Math.round((longitude / 15.0) * 3_600_000), 'UTC');
  return [jourIndex(p[1], p[2]), heureDecimale(p)];
}

export function meridienDuFuseau(i: Instant): number {
  return i.decalage_standard / 4.0;
}

/** Temps sidéral local (heures) : TSMG (IAU 1982, Meeus 12.4) + longitude. */
export function tslHeures(jj: number, longitude: number): number {
  const t = (jj - 2_451_545.0) / 36_525.0;
  const g = 280.460_618_37 + 360.985_647_366_29 * (jj - 2_451_545.0) + 0.000_387_933 * t * t - t ** 3 / 38_710_000.0;
  return ((((g + longitude) % 360.0) + 360.0) % 360.0) / 15.0;
}

export function anneeDecimale(i: Instant): number {
  const a = i.tu[0];
  const d0 = Date.UTC(a, 0, 1);
  const d1 = Date.UTC(a + 1, 0, 1);
  return a + (i.ms - d0) / (d1 - d0);
}

/** Élongation de la Lune (degrés ; 0 = nouvelle lune, 180 = pleine lune), Meeus chap. 47 et 25 (≈ 0,3°). */
export function elongationLune(jj: number): number {
  const t = (jj - 2_451_545.0) / 36_525.0;
  const r = Math.PI / 180.0;
  const lp = 218.316_447_7 + 481_267.881_234_21 * t;
  const d = 297.850_192_1 + 445_267.111_403_4 * t;
  const m = 357.529_109_2 + 35_999.050_290_9 * t;
  const mp = 134.963_396_4 + 477_198.867_505_5 * t;
  const f = 93.272_095_0 + 483_202.017_523_3 * t;
  const lune = lp + 6.288_774 * Math.sin(mp * r) + 1.274_027 * Math.sin((2 * d - mp) * r) + 0.658_314 * Math.sin(2 * d * r)
    + 0.213_618 * Math.sin(2 * mp * r) - 0.185_116 * Math.sin(m * r) - 0.114_332 * Math.sin(2 * f * r)
    + 0.058_793 * Math.sin((2 * d - 2 * mp) * r) + 0.057_066 * Math.sin((2 * d - m - mp) * r)
    + 0.053_322 * Math.sin((2 * d + mp) * r) + 0.045_758 * Math.sin((2 * d - m) * r);
  const l0 = 280.466_46 + 36_000.769_83 * t;
  const c = (1.914_602 - 0.004_817 * t) * Math.sin(m * r) + 0.019_993 * Math.sin(2 * m * r) + 0.000_289 * Math.sin(3 * m * r);
  const soleil = l0 + c;
  return (((lune - soleil) % 360.0) + 360.0) % 360.0;
}

// ------------------------------------------------------------------ textes
/** « UTC », « UTC+2 », « UTC+5:45 », « UTC−2:30 » (signe moins typographique). */
export function libelleDecalage(minutes: number): string {
  if (minutes === 0) return 'UTC';
  const s = minutes > 0 ? '+' : '−';
  const a = Math.abs(minutes);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return 'UTC' + s + h + (m ? ':' + String(m).padStart(2, '0') : '');
}

export function ville(tz: string): string {
  return tz.split('/').pop()!.replace(/_/g, ' ');
}

function hm(p: Parties): string {
  return String(p[3]).padStart(2, '0') + ':' + String(p[4]).padStart(2, '0');
}

/** « 09:20 heure de Paris (UTC+2) · 07:20 TU » ; « 09:20 Paris time (UTC+2) · 07:20 UT ». */
export function texteHeure(i: Instant, lg: 'fr' | 'en'): string {
  if (i.tz === 'UTC' || i.tz === 'Etc/UTC' || i.tz === 'Etc/GMT') return hm(i.tu) + (lg === 'fr' ? ' TU' : ' UT');
  const v = ville(i.tz);
  const lieu = lg === 'fr' ? ('AEIOUYÉÈÎÔÂ'.includes(v.charAt(0)) && v ? 'heure d’' : 'heure de ') + v : `${v} time`;
  return `${hm(i.local)} ${lieu} (${libelleDecalage(i.decalage)}) · ${hm(i.tu)} ${lg === 'fr' ? 'TU' : 'UT'}`;
}

const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Date locale : « 25 octobre 2026 » ; « October 25, 2026 ». */
export function texteDate(i: Instant, lg: 'fr' | 'en'): string {
  const [a, m, j] = i.local;
  return lg === 'fr' ? `${j} ${MOIS_FR[m - 1]} ${a}` : `${MOIS_EN[m - 1]} ${j}, ${a}`;
}
