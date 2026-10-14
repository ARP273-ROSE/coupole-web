/**
 * Traductions FR/EN.  Les textes des animations sont ceux de l'appli de bureau Coupole (mêmes clés, exportés par
 * outils/exporter_coupole.py) ; ceux de l'interface web sont dans ui.ts.  `tr(cle, valeurs)` : repli sur l'anglais,
 * puis sur la clé (jamais de texte vide), comme dans Coupole.
 */
import { format } from '../noyau/py';
import { UI } from './ui';
import { UI_CLASSE } from './ui_classe';

export type Langue = 'fr' | 'en';
export const LANGUES: readonly Langue[] = ['fr', 'en'];

let courante: Langue = 'fr';
const textes: Record<Langue, Record<string, string>> = { fr: {}, en: {} };
const chargees = new Set<string>();

for (const [cle, v] of [...Object.entries(UI), ...Object.entries(UI_CLASSE)]) {
  textes.fr[cle] = v[0];
  textes.en[cle] = v[1];
}

export function langue(): Langue {
  return courante;
}

export function choisirLangue(l: Langue): void {
  courante = l;
}

/** Langue du navigateur : français si l'une des langues préférées est le français, sinon anglais. */
export function langueDuNavigateur(): Langue {
  const liste = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : [];
  for (const l of liste) {
    const c = (l || '').toLowerCase().slice(0, 2);
    if (c === 'fr') return 'fr';
    if (c === 'en') return 'en';
  }
  return 'en';
}

export function ajouter(l: Langue, dico: Record<string, string>): void {
  Object.assign(textes[l], dico);
}

export function tr(cle: string, valeurs?: Record<string, string | number>): string {
  const t = textes[courante][cle] ?? textes.en[cle] ?? cle;
  return valeurs ? format(t, valeurs) : t;
}

export function existe(cle: string): boolean {
  return cle in textes[courante] || cle in textes.en;
}

/** Texte dans une langue donnée (recherche dans les deux langues). */
export function trEn(l: Langue, cle: string): string {
  return textes[l][cle] ?? textes.en[cle] ?? cle;
}

/** Textes du catalogue (noms, descriptions, thèmes) : petits, chargés au démarrage. */
export async function chargerCatalogue(l: Langue): Promise<void> {
  const k = 'catalogue.' + l;
  if (chargees.has(k)) return;
  const m = l === 'fr' ? await import('./genere/catalogue.fr.json') : await import('./genere/catalogue.en.json');
  ajouter(l, m.default as Record<string, string>);
  chargees.add(k);
}

/** Textes des animations (réglages, valeurs, étiquettes) : chargés à l'ouverture de la première animation. */
export async function chargerAnimations(l: Langue): Promise<void> {
  const k = 'anim.' + l;
  if (chargees.has(k)) return;
  const m = l === 'fr' ? await import('./genere/anim.fr.json') : await import('./genere/anim.en.json');
  ajouter(l, m.default as Record<string, string>);
  chargees.add(k);
}

/** Pour les tests (Node) : tout charger d'un coup. */
export async function toutCharger(): Promise<void> {
  for (const l of LANGUES) {
    await chargerCatalogue(l);
    await chargerAnimations(l);
  }
}
