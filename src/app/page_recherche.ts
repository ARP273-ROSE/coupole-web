/**
 * Recherche globale bilingue : modules, animations, questions, fiches, tables, images.  Moteur commun avec Coupole
 * (bureau) : `contenu/recherche.ts` (index FR + EN, titres d'origine de ClassAction, insensible aux accents, à la
 * casse, aux pluriels simples et aux petites fautes, classement titre > mots-clés > texte).  Les résultats sont
 * groupés par type (dans l'ordre du meilleur résultat de chaque type) et affichés dans la langue de l'interface,
 * mots trouvés surlignés ; quand la correspondance n'est que dans l'autre langue, le titre de l'autre langue suit.
 */
import { disponible, ENTREES } from '../anim/registre';
import { langue, trEn, tr, type Langue } from '../i18n/i18n';
import { Index, documentsDe, extrait, surligner, type Doc, type Resultat } from '../contenu/recherche';
import * as S from '../contenu/sauvegarde';
import { h, icone } from './dom';
import * as contenu from './contenu';
import { elementRessource, type GenreL } from './composants';
import type { Page } from './page_apropos';
import { remplacerAdresse } from './routeur';
import * as stockage from './stockage';

const PAR_GROUPE = 30;

let indexP: Promise<Index> | null = null;
/** Index commun (construit une fois, à la première recherche). */
export function index(): Promise<Index> {
  indexP ??= Promise.all([contenu.charger('recherche.json'), contenu.modules()]).then(([j, ms]) =>
    new Index(documentsDe(j.entrees, ENTREES.filter(disponible), ms, (l, k) => {
      const t = trEn(l, k);
      return t === k ? undefined : t;
    })),
  );
  indexP.catch(() => (indexP = null));
  return indexP;
}

/** Morceaux surlignés (élément <mark> pour les mots trouvés). */
export function noeudsSurlignes(texte: string, mots: Iterable<string>): (string | Node)[] {
  return surligner(texte, mots).map(([t, m]) => (m ? h('mark', { text: t }) : t));
}

function bi(v: Doc['t'] | Doc['r'], l: Langue): string {
  if (v && typeof v === 'object') return v[l] || '';
  return v ?? '';
}

export async function pageRecherche(q0: string): Promise<Page> {
  await stockage.pret();
  const s = stockage.doc();
  const champ = h('input', { type: 'search', id: 'recherche-globale', name: 'q', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search', placeholder: tr('web_recherche_globale_indice'), 'aria-label': tr('web_recherche_globale'), 'aria-describedby': 'aide-recherche' });
  champ.value = q0;
  const caseFavoris = h('input', { type: 'checkbox', id: 'recherche-favoris' });
  const compte = h('p', { class: 'compte', 'aria-live': 'polite' });
  const resultats = h('div', { class: 'resultats' });
  const ms = await contenu.modules();
  const okQ = new Map<string, contenu.Module>();
  for (const m of ms) for (const q of m.questions) if (q.ok && !okQ.has(q.id)) okQ.set(q.id, m);
  const l = langue();
  const autre: Langue = l === 'fr' ? 'en' : 'fr';
  const deplies = new Set<string>();

  const ligne = (r: Resultat): HTMLElement => {
    const d = r.doc;
    const titre = bi(d.t, l) || bi(d.t, autre) || d.id;
    const morceauxTitre = surligner(titre, r.mots);
    const trouveIci = morceauxTitre.some(([, m]) => m);
    let sous = '';
    let lien: string | undefined;
    if (d.g === 'question') {
      const m = okQ.get(d.id)!;
      sous = contenu.bi(m.titre);
      lien = `#/m/${m.cle}/q/${d.id}`;
    } else if (d.g === 'animation') {
      const e = ENTREES.find((x) => x.id === d.id);
      sous = e ? tr('anim_theme_' + e.theme) : '';
    } else if (d.g === 'module') {
      lien = `#/m/${d.id}`;
      sous = d.o && d.o !== titre ? tr('web_titre_origine', { titre: d.o }) : '';
    } else if (d.m?.[0]) sous = contenu.bi(ms.find((m) => m.cle === d.m![0])?.titre);
    // passage du texte (langue de l'interface), ou titre de l'autre langue / d'origine quand c'est là que ça correspond
    const ex: (string | Node)[] = [];
    const texte = bi(d.r, l);
    const titreAutre = [bi(d.t, autre), d.o ?? ''].find((t) => t && t !== titre && surligner(t, r.mots).some(([, m]) => m));
    if (!trouveIci && titreAutre) ex.push(h('span', { class: 'autre-langue', lang: titreAutre === d.o ? 'en' : autre }, ...noeudsSurlignes(tr('web_aussi_en', { titre: titreAutre }), r.mots)));
    else if (texte && surligner(texte, r.mots).some(([, m]) => m)) ex.push(...noeudsSurlignes(extrait(texte, r.mots, 150), r.mots));
    return elementRessource(d.g as GenreL, d.id, titre, { lien, sousTitre: sous || undefined, titreNoeuds: morceauxTitre.map(([t, m]) => (m ? h('mark', { text: t }) : t)), extrait: ex });
  };

  let jeton = 0;
  const maj = async (): Promise<void> => {
    const n = ++jeton;
    const q = champ.value.trim();
    remplacerAdresse('#/recherche' + (q ? '?q=' + encodeURIComponent(q) : ''), 'recherche');
    const idx = q ? await index() : null;
    if (n !== jeton) return;
    let r = idx ? idx.chercher(q).filter((x) => x.doc.g !== 'question' || okQ.has(x.doc.id)) : [];
    if (caseFavoris.checked) r = r.filter((x) => S.estFavori(s, x.doc.g, x.doc.id));
    resultats.replaceChildren();
    compte.textContent = q ? (r.length ? tr('web_n_resultats', { n: r.length }) : tr('web_aucun_resultat', { q })) : '';
    // groupes : dans l'ordre du meilleur résultat de chaque type
    const ordre: string[] = [];
    for (const x of r) if (!ordre.includes(x.doc.g)) ordre.push(x.doc.g);
    for (const g of ordre) {
      const tous = r.filter((x) => x.doc.g === g);
      const ul = h('ul', { class: 'liste-ressources' });
      const montrer = deplies.has(g) ? tous : tous.slice(0, PAR_GROUPE);
      for (const x of montrer) ul.append(ligne(x));
      const section = h('section', { class: 'groupe-ressources', 'data-genre': g }, h('h2', {}, tr('web_onglet_' + g + 's'), h('span', { class: 'nb', text: String(tous.length) })), ul);
      if (montrer.length < tous.length) {
        const plus = h('button', { type: 'button', class: 'bouton discret', text: tr('web_voir_plus', { n: tous.length - montrer.length }) });
        plus.addEventListener('click', () => {
          deplies.add(g);
          void maj().then(() => resultats.querySelector<HTMLElement>(`section[data-genre="${g}"] li:nth-child(${PAR_GROUPE + 1}) a, section[data-genre="${g}"] li:nth-child(${PAR_GROUPE + 1}) button`)?.focus());
        });
        section.append(plus);
      }
      resultats.append(section);
    }
  };
  let minuteur = 0;
  champ.addEventListener('input', () => {
    clearTimeout(minuteur);
    deplies.clear();
    minuteur = window.setTimeout(() => void maj(), 150);
  });
  caseFavoris.addEventListener('change', () => void maj());
  const el = h(
    'div',
    { class: 'page page-recherche', lang: l },
    h('nav', { class: 'fil', 'aria-label': tr('web_fil') }, h('a', { href: '#/' }, icone('retour'), tr('web_accueil'))),
    h('h1', { text: tr('web_recherche_titre') }),
    h('div', { class: 'recherche', role: 'search' }, icone('chercher'), champ),
    h('div', { class: 'barre-filtres' }, h('p', { class: 'aide', id: 'aide-recherche', text: tr('web_recherche_bilingue') }), h('p', { class: 'case' }, caseFavoris, h('label', { for: 'recherche-favoris' }, icone('etoile'), tr('web_favoris_seulement')))),
    compte,
    resultats,
  );
  await maj();
  return { el, titre: `${tr('web_recherche_titre')} — Coupole Web`, focus: champ, detruire: () => clearTimeout(minuteur) };
}
