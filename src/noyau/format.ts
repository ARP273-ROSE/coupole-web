/** Mise en forme des nombres, angles, heures et dates, comme base.py de Coupole (mêmes arrondis). */
import { langue, tr } from '../i18n/i18n';
import { fixe, pd02, pmod, pround } from './py';

const ESPACE_FINE = ' ';

/** Nombre dans la langue courante (virgule décimale en français, espace fine pour les milliers). */
export function nombre(x: number | null | undefined, dec = 1): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  let s = fixe(x, dec);
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  const [e, f] = s.split('.') as [string, string | undefined];
  const groupes: string[] = [];
  for (let i = e.length; i > 0; i -= 3) groupes.unshift(e.slice(Math.max(0, i - 3), i));
  s = groupes.join(ESPACE_FINE) + (f !== undefined ? '.' + f : '');
  // « -0,0 » → « 0,0 »
  if (neg && Number(s.replaceAll(ESPACE_FINE, '')) !== 0) s = '-' + s;
  return langue() === 'fr' ? s.replace('.', ',') : s;
}

export function angle(x: number, dec = 1): string {
  return nombre(x, dec) + '°';
}

/** Heures décimales → « 13 h 05 » (fr) / « 13:05 » (en), modulo 24. */
export function heures_minutes(h: number, secondes = false): string {
  h = pmod(h, 24.0);
  const tot = Math.trunc(pround(h * (secondes ? 3600 : 60)));
  if (secondes) {
    let hh = Math.floor(tot / 3600);
    const reste = tot - hh * 3600;
    const mm = Math.floor(reste / 60);
    const ss = reste - mm * 60;
    hh = pmod(hh, 24);
    return langue() === 'fr' ? `${hh} h ${pd02(mm)} min ${pd02(ss)} s` : `${hh}:${pd02(mm)}:${pd02(ss)}`;
  }
  let hh = Math.floor(tot / 60);
  const mm = tot - hh * 60;
  hh = pmod(hh, 24);
  return langue() === 'fr' ? `${hh} h ${pd02(mm)}` : `${hh}:${pd02(mm)}`;
}

/** Durée en heures → « 15 h 57 min ». */
export function duree_hm(h: number): string {
  const tot = Math.trunc(pround(h * 60));
  const hh = Math.floor(tot / 60);
  const mm = tot - hh * 60;
  return tr('anim_duree_hm', { h: hh, m: pd02(mm) });
}

export const MOIS_JOURS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Jour de l'année (0 = 1er janvier, année de 365 jours) → « 21 mars » / « March 21 ». */
export function date_du_jour(jour: number): string {
  let j = Math.trunc(Math.floor(pmod(jour, 365.0)));
  let m = 0;
  while (j >= MOIS_JOURS[m]!) {
    j -= MOIS_JOURS[m]!;
    m += 1;
  }
  const nom = tr('anim_mois_' + (m + 1));
  return langue() === 'fr' ? `${j + 1} ${nom}` : `${nom} ${j + 1}`;
}

export function jour_de_date(mois: number, jour: number): number {
  let s = 0;
  for (let i = 0; i < mois - 1; i++) s += MOIS_JOURS[i]!;
  return s + jour - 1;
}
