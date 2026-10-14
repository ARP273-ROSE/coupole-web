/**
 * Recherche globale FR/EN : questions, animations, fiches, tables, images.  Saisie normalisée (minuscules, sans
 * accents) ; chaque mot est cherché comme préfixe d'un mot du titre (poids 1,5), des mots-clés (1,3) et du résumé
 * (1), dans les deux langues ; tri par nombre de mots trouvés puis par score (comme ClassAction, étendu aux
 * ressources).
 */
import { ENTREES, disponible } from '../anim/registre';
import { tr, trEn } from '../i18n/i18n';
import { h, icone } from './dom';
import * as contenu from './contenu';
import { elementRessource, type GenreR } from './composants';
import type { Page } from './page_apropos';
import { remplacerAdresse } from './routeur';

export function normaliser(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function mots(s: string): string[] {
  return normaliser(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

export interface Entree {
  g: GenreR;
  id: string;
  m: string[];
  titres: string[]; // mots normalisés du titre (FR + EN)
  cles: string[];
  resume: string[];
  t: contenu.Bi;
  r: contenu.Bi;
}

/** Score d'une entrée pour les mots cherchés : [nombre de mots trouvés, score pondéré]. */
export function noter(e: Pick<Entree, 'titres' | 'cles' | 'resume'>, cherches: string[]): [number, number] {
  let n = 0;
  let score = 0;
  for (const c of cherches) {
    let s = 0;
    if (e.titres.some((w) => w.startsWith(c))) s += 1.5;
    if (e.cles.some((w) => w.startsWith(c))) s += 1.3;
    if (e.resume.some((w) => w.startsWith(c))) s += 1;
    if (s) n++;
    score += s;
  }
  return [n, score];
}

let index: Promise<Entree[]> | null = null;
function construireIndex(): Promise<Entree[]> {
  index ??= contenu.charger('recherche.json').then((j) => {
    const out: Entree[] = [];
    const genre: Record<string, GenreR> = { q: 'question', f: 'fiche', t: 'table', i: 'image' };
    for (const e of j.entrees) {
      out.push({ g: genre[e.g]!, id: e.id, m: e.m, t: e.t, r: e.r, titres: mots(e.t.fr + ' ' + e.t.en), cles: mots(e.k.fr + ' ' + e.k.en), resume: mots(e.r.fr + ' ' + e.r.en) });
    }
    for (const a of ENTREES.filter(disponible)) {
      const t = { fr: trEn('fr', 'anim_nom_' + a.cle), en: trEn('en', 'anim_nom_' + a.cle) };
      const r = { fr: trEn('fr', 'anim_desc_' + a.cle), en: trEn('en', 'anim_desc_' + a.cle) };
      out.push({ g: 'animation', id: a.id, m: [], t, r, titres: mots(t.fr + ' ' + t.en + ' ' + a.titre), cles: mots(a.id + ' ' + trEn('fr', 'anim_theme_' + a.theme) + ' ' + trEn('en', 'anim_theme_' + a.theme)), resume: mots(r.fr + ' ' + r.en) });
    }
    return out;
  });
  return index;
}

export async function chercher(q: string): Promise<(Entree & { n: number; score: number })[]> {
  const cherches = mots(q);
  if (!cherches.length) return [];
  const idx = await construireIndex();
  return idx
    .map((e) => {
      const [n, score] = noter(e, cherches);
      return { ...e, n, score };
    })
    .filter((e) => e.n > 0)
    .sort((a, b) => b.n - a.n || b.score - a.score);
}

const ORDRE: GenreR[] = ['question', 'animation', 'fiche', 'table', 'image'];

export async function pageRecherche(q0: string): Promise<Page> {
  const champ = h('input', { type: 'search', id: 'recherche-globale', name: 'q', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search', placeholder: tr('web_recherche_globale_indice'), 'aria-label': tr('web_recherche_globale') });
  champ.value = q0;
  const compte = h('p', { class: 'compte', 'aria-live': 'polite' });
  const resultats = h('div', { class: 'resultats' });
  const ms = await contenu.modules();
  const premierModule = (id: string): string | undefined => ms.find((m) => m.questions.some((x) => x.id === id && x.ok))?.cle;
  let jeton = 0;
  const maj = async (): Promise<void> => {
    const n = ++jeton;
    const q = champ.value.trim();
    remplacerAdresse('#/recherche' + (q ? '?q=' + encodeURIComponent(q) : ''));
    const r = q ? await chercher(q) : [];
    if (n !== jeton) return;
    resultats.replaceChildren();
    compte.textContent = q ? (r.length ? tr('web_n_resultats', { n: r.length }) : tr('web_aucun_resultat', { q })) : '';
    for (const g of ORDRE) {
      const l = r.filter((e) => e.g === g && (g !== 'question' || premierModule(e.id))).slice(0, 60);
      if (!l.length) continue;
      const ul = h('ul', { class: 'liste-ressources' });
      for (const e of l) {
        const mod = g === 'question' ? premierModule(e.id) : e.m[0];
        const nomMod = mod ? contenu.bi(ms.find((m) => m.cle === mod)?.titre) : '';
        ul.append(elementRessource(g, e.id, contenu.bi(e.t), { lien: g === 'question' ? `#/m/${mod}/q/${e.id}` : undefined, sousTitre: nomMod || undefined }));
      }
      resultats.append(h('section', { class: 'groupe-ressources' }, h('h2', {}, tr('web_onglet_' + g + 's'), h('span', { class: 'nb', text: String(r.filter((e) => e.g === g).length) })), ul));
    }
  };
  let minuteur = 0;
  champ.addEventListener('input', () => {
    clearTimeout(minuteur);
    minuteur = window.setTimeout(() => void maj(), 150);
  });
  const el = h(
    'div',
    { class: 'page page-recherche' },
    h('nav', { class: 'fil', 'aria-label': tr('web_fil') }, h('a', { href: '#/' }, icone('retour'), tr('web_accueil'))),
    h('h1', { text: tr('web_recherche_titre') }),
    h('div', { class: 'recherche', role: 'search' }, icone('chercher'), champ),
    compte,
    resultats,
  );
  await maj();
  return { el, titre: `${tr('web_recherche_titre')} — Coupole Web`, focus: champ, detruire: () => clearTimeout(minuteur) };
}
