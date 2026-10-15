/**
 * Accueil : recherche globale, les 22 modules (questions, animations, fiches, tables, images ; progression), la
 * bibliothèque (« tout le contenu, comme dans ClassAction »), les modules bonus, « Mes favoris », reprise de la
 * dernière question, et les animations par thème.  Page légère : la liste des modules est un petit fichier chargé
 * ici, tout le reste est chargé à la demande (titres des ressources seulement s'il y en a en favoris).
 */
import { bilan, type Sauvegarde } from '../contenu/sauvegarde';
import { THEMES, ENTREES, disponible, PAR_ID } from '../anim/registre';
import { tr } from '../i18n/i18n';
import { langue } from '../i18n/i18n';
import { h, icone } from './dom';
import type { Page } from './page_apropos';
import * as stockage from './stockage';

interface M {
  cle: string;
  titre: { fr: string; en: string };
  affiche: boolean;
  questions: { id: string; ok: boolean; n: string; t: { fr: string; en: string } | null }[];
  animations: string[];
  fiches: string[];
  tables: string[];
  images: string[];
}

let modulesP: Promise<M[]> | null = null;
export function listeModules(): Promise<M[]> {
  modulesP ??= fetch('contenu/modules.json').then((r) => r.json()).then((j) => j.modules as M[]);
  modulesP.catch(() => (modulesP = null));
  return modulesP;
}

function compte(n: number, cle: string): HTMLElement | null {
  const un = n === 1 ? '_1' : '';
  return n ? h('span', { class: 'compte-r', title: tr(cle + '_n' + un, { n }) }, h('b', { text: String(n) }), ' ', tr(cle + '_court' + un)) : null;
}

function carteModule(m: M, i: number | null, s: Sauvegarde): HTMLElement {
  const ids = m.questions.filter((q) => q.ok).map((q) => q.id);
  const b = bilan(s, ids);
  const pc = b.total ? Math.round((100 * b.reussies) / b.total) : 0;
  const barre = h('span', { class: 'carte-progres', 'aria-hidden': 'true' });
  const rempli = h('span');
  rempli.style.width = pc + '%';
  barre.append(rempli);
  return h(
    'a',
    { class: 'carte-module', href: `#/m/${m.cle}`, 'data-module': m.cle },
    i !== null ? h('span', { class: 'numero', 'aria-hidden': 'true', text: String(i).padStart(2, '0') }) : null,
    h('span', { class: 'carte-module-titre', text: m.titre[langue()] }),
    h('span', { class: 'comptes' }, compte(m.questions.length, 'web_q'), compte(m.animations.length, 'web_a'), compte(m.fiches.length, 'web_f'), compte(m.tables.length, 'web_t'), compte(m.images.length, 'web_i')),
    b.essayees ? h('span', { class: 'visuellement-cache', text: tr('web_progres_texte', { r: b.reussies, n: b.total }) }) : null,
    barre,
  );
}

export function pageAccueil(): Page {
  const champ = h('input', { type: 'search', id: 'recherche-globale', name: 'q', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search', placeholder: tr('web_recherche_globale_indice'), 'aria-label': tr('web_recherche_globale') });
  const form = h('form', { class: 'recherche', role: 'search', action: '#/recherche' }, icone('chercher'), champ, h('kbd', { 'aria-hidden': 'true', text: '/' }));
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    location.hash = '#/recherche?q=' + encodeURIComponent(champ.value.trim());
  });
  // 22 cartes d'attente de la taille des vraies : rien ne bouge quand la liste arrive (pas de décalage de mise en page)
  const grille = h('div', { class: 'grille-modules', 'aria-busy': 'true' }, ...Array.from({ length: 22 }, () => h('div', { class: 'carte-module attente', 'aria-hidden': 'true' })));
  const bonus = h('div', { class: 'grille-modules petite' });
  const sectionBonus = h('section', { class: 'section-accueil', 'aria-labelledby': 'titre-bonus', hidden: true }, h('h2', { id: 'titre-bonus', text: tr('web_modules_bonus') }), h('p', { class: 'sous-titre', text: tr('web_modules_bonus_texte') }), bonus);
  const favoris = h('ul', { class: 'favoris-accueil' });
  const biblio = h('a', { class: 'carte-bibliotheque', href: '#/bibliotheque' },
    h('span', { class: 'carte-bibliotheque-icone', 'aria-hidden': 'true' }, icone('bibliotheque')),
    h('span', { class: 'carte-bibliotheque-titre', text: tr('web_bibliotheque_carte_titre') }),
    h('span', { class: 'carte-bibliotheque-texte' }));
  const reprise = h('div', { class: 'reprise', hidden: true });

  const themes = h('div', { class: 'puces' });
  const nAnim = ENTREES.filter(disponible).length;
  themes.append(h('a', { class: 'puce', href: '#/animations', text: tr('web_toutes_animations', { n: nAnim }) }));
  for (const t of THEMES) {
    const n = ENTREES.filter((e) => e.theme === t && disponible(e)).length;
    if (n) themes.append(h('a', { class: 'puce', href: `#/animations?t=${t}` }, tr('anim_theme_' + t), h('span', { class: 'nb', text: String(n) })));
  }

  const remplirFavoris = async (s: Sauvegarde, ms: M[]): Promise<void> => {
    const l = [...s.favoris].reverse().slice(0, 12);
    let titres: Record<string, Record<string, { fr: string; en: string }>> = {};
    if (l.some((f) => f.genre === 'fiche' || f.genre === 'table' || f.genre === 'image')) {
      titres = await fetch('contenu/titres.json').then((r) => r.json()).catch(() => ({}));
    }
    const lg = langue();
    const items: HTMLElement[] = [];
    for (const f of l) {
      let t = '';
      let href = '';
      if (f.genre === 'module') {
        const m = ms.find((x) => x.cle === f.id);
        const mm = s.mes_modules.find((x) => x.id === f.id);
        if (m) [t, href] = [m.titre[lg], `#/m/${m.cle}`];
        else if (mm) [t, href] = [mm.nom, `#/mm/${mm.id}`];
      } else if (f.genre === 'animation') {
        const e = PAR_ID.get(f.id);
        if (e) [t, href] = [tr('anim_nom_' + e.cle), `#/a/${encodeURIComponent(f.id)}`];
      } else if (f.genre === 'question') {
        const m = ms.find((x) => x.questions.some((q) => q.id === f.id && q.ok));
        const q = m?.questions.find((x) => x.id === f.id);
        if (m && q) [t, href] = [q.t ? q.t[lg] : q.id, `#/m/${m.cle}/q/${f.id}`];
      } else {
        const x = titres[f.genre === 'fiche' ? 'f' : f.genre === 'table' ? 't' : 'i']?.[f.id];
        if (x) [t, href] = [x[lg], `#/r/${f.genre}/${f.id}`];
      }
      if (!t) continue;
      items.push(h('li', {}, h('a', { class: 'favori-accueil', href }, h('span', { class: 'genre', text: tr('web_genre_' + f.genre) }), h('span', { class: 'favori-titre', text: t }))));
    }
    favoris.replaceChildren(...(items.length ? items : [h('li', { class: 'vide', text: tr('web_favoris_accueil_vide') })]));
  };

  const el = h(
    'div',
    { class: 'page accueil' },
    h(
      'header',
      { class: 'chapeau' },
      h('h1', {}, tr('web_chapeau_1') + ' ', h('span', { class: 'accent', text: tr('web_chapeau_2') })),
      h('p', { class: 'sous-titre', text: tr('web_accueil_texte') }),
      form,
      reprise,
    ),
    h('section', { class: 'section-accueil', 'aria-labelledby': 'titre-mes' }, h('div', { class: 'titre-section' }, h('h2', { id: 'titre-mes' }, icone('etoile'), tr('web_favoris')), h('a', { href: '#/favoris', text: tr('web_tout_voir') })), favoris),
    h('section', { class: 'section-accueil', 'aria-labelledby': 'titre-modules' }, h('h2', { id: 'titre-modules', text: tr('web_modules') }), grille, biblio),
    sectionBonus,
    h('section', { class: 'section-accueil', 'aria-labelledby': 'titre-themes' }, h('h2', { id: 'titre-themes', text: tr('web_animations_par_theme') }), themes),
  );

  let detruite = false;
  void Promise.all([listeModules(), stockage.pret()])
    .then(([ms, s]) => {
      if (detruite) return;
      let i = 0;
      grille.replaceChildren(...ms.filter((m) => m.affiche).map((m) => carteModule(m, ++i, s)));
      grille.removeAttribute('aria-busy');
      const b = ms.filter((m) => !m.affiche);
      bonus.replaceChildren(...b.map((m) => carteModule(m, null, s)));
      sectionBonus.hidden = b.length === 0;
      void remplirFavoris(s, ms);
      const n = (k: 'animations' | 'fiches' | 'tables' | 'images'): number => new Set(ms.flatMap((m) => m[k])).size;
      biblio.querySelector('.carte-bibliotheque-texte')!.textContent = tr('web_bibliotheque_carte_texte', { q: new Set(ms.flatMap((m) => m.questions.map((q) => q.id))).size, a: new Set(ms.flatMap((m) => m.animations).filter((a) => PAR_ID.has(a))).size, f: n('fiches'), t: n('tables'), i: n('images') });
      // reprendre là où on s'était arrêté
      const vus = Object.entries(s.modules).filter(([, v]) => v.derniere_question).sort((a, b2) => (a[1].visite < b2[1].visite ? 1 : -1));
      const d = vus[0];
      if (d) {
        const m = ms.find((x) => x.cle === d[0]);
        if (m) {
          reprise.replaceChildren(h('a', { class: 'bouton principal', href: `#/m/${m.cle}/q/${d[1].derniere_question}` }, icone('lecture'), tr('web_reprendre', { module: m.titre[langue()] })));
          reprise.hidden = false;
        }
      }
    })
    .catch(() => grille.replaceChildren(h('p', { class: 'erreur', text: tr('web_ressource_indisponible') })));

  const raccourci = (ev: KeyboardEvent): void => {
    const cible = ev.target as HTMLElement | null;
    if (ev.key === '/' && !(cible && /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName))) {
      ev.preventDefault();
      champ.focus();
    }
  };
  document.addEventListener('keydown', raccourci);
  return {
    el,
    titre: tr('web_titre_site'),
    detruire() {
      detruite = true;
      document.removeEventListener('keydown', raccourci);
    },
  };
}
