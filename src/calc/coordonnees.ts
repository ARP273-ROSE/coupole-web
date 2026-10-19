/**
 * Lire une position géographique ou un angle écrits de N'IMPORTE QUELLE façon : mêmes règles que Coupole
 * (coupole/modules/td/coordonnees.py), mêmes cas d'essai (tests/references/td_coordonnees_cas.json).
 *
 * Angles : « 48.785 », « 48,785 », « -2.35 », « +44:13:51 », « 48°47′6″N », « 48° 47' 6" N », « 48 47 06 N »,
 * « 48d47m6s », « N 48 47 06 », « 2,45° E », « O 1,6 » (ouest), « 1.6 W », « 48°47,1′ N » (minutes décimales).
 * Position : deux angles, dans n'importe quel ordre si les lettres le disent ; sans lettre, latitude puis longitude,
 * et une latitude hors de [−90°, 90°] avec une longitude possible est une inversion certaine (corrigée, signalée).
 */

export class CoordonneeIllisible extends Error {
  constructor(public cle: string, public valeurs: Record<string, string | number> = {}) {
    super(cle);
  }
}

export interface Angle {
  valeur: number;
  genre: '' | 'lat' | 'lon';
  notes: string[];
}

export interface Position {
  lat: number;
  lon: number;
  notes: string[];
}

const LETTRES: Record<string, ['lat' | 'lon', number]> = { N: ['lat', 1], S: ['lat', -1], E: ['lon', 1], O: ['lon', -1], W: ['lon', -1] };
const NOMBRE = String.raw`\d+(?:[.,]\d+)?`;
const RE_ANGLE = new RegExp(
  String.raw`^(?<signe>[+-])?\s*(?<d>${NOMBRE})\s*(?:°|D)?` +
    String.raw`(?:\s*(?::|\s)?\s*(?<m>${NOMBRE})\s*(?:'|M)?` +
    String.raw`(?:\s*(?::|\s)?\s*(?<s>${NOMBRE})\s*(?:"|S)?)?)?$`,
);

export function normaliser(t: string): string {
  let s = (t ?? '').trim();
  const rempl: [string, string][] = [['’', "'"], ['‘', "'"], ['´', "'"], ['`', "'"], ['′', "'"], ['″', '"'], ['”', '"'], ['“', '"'], ["''", '"'], ['º', '°'], ['˚', '°'], ['−', '-'], ['–', '-'], [' ', ' '], [' ', ' ']];
  for (const [a, b] of rempl) s = s.split(a).join(b);
  return s.toUpperCase();
}

const f = (x: string | undefined): number => parseFloat((x ?? '0').replace(',', '.'));

export function lireAngle(texte: string): Angle {
  let t = normaliser(texte);
  if (!t) throw new CoordonneeIllisible('td_err_vide');
  const notes: string[] = [];
  let lettre = '';
  let m = /^([NSEOW])\s*(.*)$/.exec(t);
  if (m && !/^[NSEOW]\s*$/.test(t)) {
    lettre = m[1]!;
    t = m[2]!;
  } else {
    m = /^(.*?)\s*([NSEOW])$/.exec(t);
    if (m && m[1]) {
      t = m[1];
      lettre = m[2]!;
    }
  }
  // « 48D47M6S » : le S final est le symbole des secondes, pas le Sud, s'il suit un M
  if (lettre === 'S' && /M\s*\d+(?:[.,]\d+)?$/.test(t)) {
    t = t + 'S';
    lettre = '';
  }
  t = t.trim();
  const ma = RE_ANGLE.exec(t);
  const brut = texte.trim();
  if (!ma || !ma.groups) throw new CoordonneeIllisible('td_err_illisible', { texte: brut });
  const g = ma.groups;
  const d = f(g.d);
  const mi = f(g.m);
  const s = f(g.s);
  if (g.m !== undefined) {
    if (mi >= 60) throw new CoordonneeIllisible('td_err_minutes', { texte: brut });
    if (/[.,]/.test(g.d!)) throw new CoordonneeIllisible('td_err_illisible', { texte: brut });
    notes.push('td_n_dms');
  }
  if (g.s !== undefined && s >= 60) throw new CoordonneeIllisible('td_err_secondes', { texte: brut });
  if (t.includes(',')) notes.push('td_n_virgule');
  const v = d + mi / 60 + s / 3600;
  let signe = g.signe === '-' ? -1 : 1;
  let genre: Angle['genre'] = '';
  if (lettre) {
    const [gl, sl] = LETTRES[lettre]!;
    if (g.signe === '-') throw new CoordonneeIllisible('td_err_signe', { texte: brut });
    genre = gl;
    signe = sl;
    notes.push('td_n_lettre');
  }
  return { valeur: signe * v, genre, notes };
}

function decouper(t: string): string[] {
  const lettres: { i: number; fin: number }[] = [];
  const re = /[NSEOW]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    if (m[0] === 'S' && /M\s*\d+(?:[.,]\d+)?\s*$/.test(t.slice(0, m.index))) continue;
    lettres.push({ i: m.index, fin: m.index + 1 });
  }
  if (lettres.length === 2) {
    if (/^\s*[NSEOW]/.test(t)) {
      const k = lettres[1]!.i;
      return [t.slice(0, k), t.slice(k)];
    }
    const k = lettres[0]!.fin;
    return [t.slice(0, k), t.slice(k).replace(/^[ ,;/]+/, '')];
  }
  for (const sep of [/\s*;\s*/, /\s*\/\s*/, /\t+/, /,\s+/, /\s{2,}/]) {
    const p = t.split(sep).filter((x) => x.trim());
    if (p.length === 2) return p;
  }
  const p = t.split(/(?<=["'°DMS])\s+(?=[+-]?\d)/).filter((x) => x.trim());
  if (p.length === 2) return p;
  const nombres = t.match(new RegExp(`[+-]?${NOMBRE}`, 'g')) ?? [];
  if (new RegExp(String.raw`^\s*(?:[+-]?${NOMBRE}\s+)*[+-]?${NOMBRE}\s*$`).test(t) && [2, 4, 6].includes(nombres.length)) {
    const k = nombres.length / 2;
    return [nombres.slice(0, k).join(' '), nombres.slice(k).join(' ')];
  }
  if (/^\s*[+-]?\d+(?:\.\d+)?\s*,\s*[+-]?\d+(?:\.\d+)?\s*$/.test(t)) return t.split(',');
  return [];
}

export function lirePosition(texte: string): Position {
  const t = normaliser(texte);
  const brut = (texte ?? '').trim();
  if (!t) throw new CoordonneeIllisible('td_err_vide');
  const morceaux = decouper(t);
  if (morceaux.length !== 2) throw new CoordonneeIllisible('td_err_deux_angles', { texte: brut });
  let a = lireAngle(morceaux[0]!);
  let b = lireAngle(morceaux[1]!);
  const notes = [...new Set([...a.notes, ...b.notes])].sort();
  if (a.genre && a.genre === b.genre) throw new CoordonneeIllisible('td_err_deux_' + a.genre, { texte: brut });
  if (a.genre === 'lon' || b.genre === 'lat') {
    [a, b] = [b, a];
    notes.push('td_n_ordre_lettres');
  }
  let lat = a.valeur;
  let lon = b.valeur;
  if (!(a.genre || b.genre) && Math.abs(lat) > 90 && Math.abs(lon) <= 90) {
    [lat, lon] = [lon, lat];
    notes.push('td_a_inversion_certaine');
  }
  if (Math.abs(lat) > 90) throw new CoordonneeIllisible('td_err_latitude', { texte: brut });
  if (Math.abs(lon) > 360) throw new CoordonneeIllisible('td_err_longitude', { texte: brut });
  if (lon > 180) {
    lon -= 360;
    notes.push('td_n_longitude_360');
  }
  return { lat, lon, notes };
}

/** « 120 », « 120 m », « 1,2 km » → mètres ; vide → 0. */
export function lireAltitude(texte: string): number {
  let t = normaliser(texte).replace(/ /g, '');
  if (!t) return 0;
  const km = t.endsWith('KM');
  t = t.replace(/(KM|M)$/, '').replace(',', '.');
  const v = Number(t);
  if (!/^[+-]?\d+(\.\d+)?$/.test(t) || !Number.isFinite(v)) throw new CoordonneeIllisible('td_err_altitude', { texte: (texte ?? '').trim() });
  return v * (km ? 1000 : 1);
}
