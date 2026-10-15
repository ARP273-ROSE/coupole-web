/**
 * Catalogue des animations par thème : recherche bilingue (moteur commun : accents, pluriels, petites fautes, titres
 * d'origine), filtres par thème et « favoris », vignettes, étoile favori sur chaque carte.
 */
import { disponible, ENTREES, type Entree, THEMES } from '../anim/registre';
import { trEn, tr } from '../i18n/i18n';
import { documentsDe, Index } from '../contenu/recherche';
import { estFavori as favoriSauve } from '../contenu/sauvegarde';
import { h, icone } from './dom';
import { boutonFavori } from './favoris';
import * as stockage from './stockage';
import type { Page } from './page_apropos';
import { adresseAnimation, adresseCatalogue, remplacerAdresse } from './routeur';

let indexAnimations: Index | null = null;
let dernier: [string, Set<string>] = ['', new Set()];
/** Recherche bilingue (moteur commun) sur les animations : noms, descriptions, titres d'origine, thèmes, identifiants. */
export function correspond(e: Entree, texte: string): boolean {
  const q = texte.trim();
  if (!q) return true;
  if (dernier[0] !== q) {
    indexAnimations ??= new Index(documentsDe([], ENTREES.filter(disponible), [], (l, k) => {
      const t = trEn(l, k);
      return t === k ? undefined : t;
    }));
    dernier = [q, new Set(indexAnimations.chercher(q).map((r) => r.doc.id))];
  }
  return dernier[1].has(e.id);
}

export function pageCatalogue(q0: string, theme0: string): Page {
  const entrees = ENTREES.filter(disponible);
  let q = q0;
  let theme = THEMES.includes(theme0) ? theme0 : '';
  let favorisSeuls = false;

  const champ = h('input', {
    type: 'search', id: 'recherche', name: 'q', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search',
    placeholder: tr('web_recherche_indice'), 'aria-label': tr('web_recherche'),
  });
  champ.value = q;
  const recherche = h('div', { class: 'recherche', role: 'search' }, icone('chercher'), champ, h('kbd', { 'aria-hidden': 'true', text: '/' }));
  const puces = h('div', { class: 'puces', role: 'group', 'aria-label': tr('web_filtre_themes') });
  const compte = h('p', { class: 'compte', 'aria-live': 'polite' });
  const liste = h('div', { class: 'liste-themes' });

  const parTheme = new Map<string, Entree[]>();
  for (const t of THEMES) parTheme.set(t, []);
  for (const e of entrees) parTheme.get(e.theme)?.push(e);
  const themesPresents = THEMES.filter((t) => (parTheme.get(t)?.length ?? 0) > 0);

  const boutonsTheme = new Map<string, HTMLButtonElement>();
  const ajoutePuce = (t: string, texte: string, n: number): void => {
    const b = h('button', { type: 'button', class: 'puce', 'aria-pressed': String(theme === t) }, texte, h('span', { class: 'nb', text: String(n) }));
    b.addEventListener('click', () => {
      theme = theme === t ? '' : t;
      majFiltres();
    });
    boutonsTheme.set(t, b);
    puces.append(b);
  };
  ajoutePuce('', tr('web_tous'), entrees.length);
  for (const t of themesPresents) ajoutePuce(t, tr('anim_theme_' + t), parTheme.get(t)!.length);
  const puceFavoris = h('button', { type: 'button', class: 'puce puce-favoris', 'aria-pressed': 'false' }, icone('etoile'), tr('web_favoris_seulement'));
  puceFavoris.addEventListener('click', () => {
    favorisSeuls = !favorisSeuls;
    majFiltres();
  });
  puces.append(puceFavoris);

  // cartes (créées une fois, montrées ou cachées par les filtres)
  const cartes = new Map<string, HTMLElement>();
  const sections = new Map<string, HTMLElement>();
  for (const t of themesPresents) {
    const grille = h('div', { class: 'grille' });
    const titreId = 'theme-' + t;
    const nb = h('span', { class: 'nb' });
    const section = h('section', { class: 'section-theme', 'aria-labelledby': titreId }, h('h2', { id: titreId }, tr('anim_theme_' + t), nb), grille);
    for (const e of parTheme.get(t)!) {
      const nom = tr('anim_nom_' + e.cle);
      const toile = h('canvas', { 'aria-hidden': 'true', 'data-anim': e.id, width: 320, height: 200 });
      const lien = h(
        'a',
        { class: 'carte', href: adresseAnimation(e.id) },
        h('div', { class: 'vignette' }, toile),
        h(
          'div',
          { class: 'carte-corps' },
          h('span', { class: 'etiquette-theme', text: tr('anim_theme_' + t) }),
          h('h3', { class: 'carte-titre', text: nom }),
          h('p', { class: 'carte-desc', text: tr('anim_desc_' + e.cle) }),
        ),
      );
      const carte = h('div', { class: 'carte-boite' }, lien, boutonFavori('animation', e.id, nom));
      cartes.set(e.id, carte);
      grille.append(carte);
    }
    sections.set(t, section);
    liste.append(section);
  }
  const vide = h('p', { class: 'vide' });
  liste.append(vide);

  let minuteur = 0;
  const majFiltres = (): void => {
    let total = 0;
    for (const t of themesPresents) {
      let n = 0;
      for (const e of parTheme.get(t)!) {
        const ok = (!theme || theme === t) && correspond(e, q) && (!favorisSeuls || favoriSauve(stockage.doc(), 'animation', e.id));
        cartes.get(e.id)!.hidden = !ok;
        if (ok) n++;
      }
      const s = sections.get(t)!;
      s.hidden = n === 0;
      (s.querySelector('h2 .nb') as HTMLElement).textContent = String(n);
      total += n;
    }
    for (const [t, b] of boutonsTheme) b.setAttribute('aria-pressed', String(theme === t));
    puceFavoris.setAttribute('aria-pressed', String(favorisSeuls));
    compte.textContent = total === 1 ? tr('web_resultat_1') : tr('web_resultats', { n: total });
    vide.hidden = total > 0;
    vide.textContent = tr('web_aucun', { q });
    clearTimeout(minuteur);
    minuteur = window.setTimeout(() => remplacerAdresse(adresseCatalogue(q.trim(), theme)), 300);
  };
  champ.addEventListener('input', () => {
    q = champ.value;
    majFiltres();
  });

  const el = h(
    'div',
    { class: 'page' },
    h(
      'header',
      { class: 'chapeau' },
      h('h1', {}, tr('web_catalogue_titre_1') + ' ', h('span', { class: 'accent', text: tr('web_catalogue_titre_2') })),
      h('p', { class: 'sous-titre', text: tr('web_chapeau_texte', { n: entrees.length }) }),
      recherche,
      puces,
      compte,
    ),
    liste,
  );
  majFiltres();

  const raccourci = (ev: KeyboardEvent): void => {
    const cible = ev.target as HTMLElement | null;
    if (ev.key === '/' && !(cible && /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName))) {
      ev.preventDefault();
      champ.focus();
    }
  };
  document.addEventListener('keydown', raccourci);

  // vignettes : générées par les animations elles-mêmes, à la demande (morceau séparé)
  let arreterVignettes: (() => void) | null = null;
  let detruite = false;
  const lancer = (): void => {
    void import('./vignettes').then((m) => {
      if (!detruite) arreterVignettes = m.observerVignettes(el);
    });
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(lancer, { timeout: 1200 });
  else setTimeout(lancer, 300);

  return {
    el,
    titre: tr('web_titre_site'),
    detruire() {
      detruite = true;
      clearTimeout(minuteur);
      document.removeEventListener('keydown', raccourci);
      arreterVignettes?.();
    },
  };
}
