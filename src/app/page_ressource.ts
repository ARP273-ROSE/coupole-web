/** Page d'une ressource (fiche, table, image) : adresse partageable `#/r/<genre>/<id>`, modules qui la contiennent. */
import { tr } from '../i18n/i18n';
import { h, icone, pageIntrouvable } from './dom';
import * as contenu from './contenu';
import { libelleGenre, menuAjouter } from './composants';
import type { Page } from './page_apropos';

export async function pageRessource(genre: string, id: string): Promise<Page> {
  if (genre !== 'fiche' && genre !== 'table' && genre !== 'image') return erreur();
  let r: { titre: string; el: HTMLElement };
  try {
    r = await contenu.contenuRessource(genre, id);
  } catch {
    return erreur();
  }
  const ms = (await contenu.modules()).filter((m) => (m[(genre + 's') as 'fiches'] as string[]).includes(id));
  const el = h(
    'div',
    { class: 'page page-ressource' },
    h('nav', { class: 'fil', 'aria-label': tr('web_fil') }, h('a', { href: '#/' }, icone('retour'), tr('web_accueil')), ...(ms[0] ? [h('span', { 'aria-hidden': 'true', text: '›' }), h('a', { href: `#/m/${ms[0].cle}/${genre}s`, text: contenu.bi(ms[0].titre) })] : [])),
    h('header', { class: 'tete-question' }, h('span', { class: 'badge', text: libelleGenre(genre) }), h('h1', { text: r.titre }), h('span', { class: 'outils-question' }, menuAjouter({ genre, id }, r.titre))),
    h('div', { class: 'ressource-page' }, r.el),
    ms.length ? h('p', { class: 'modules-de' }, tr('web_dans_modules') + ' ', ...ms.flatMap((m, i) => [i ? ', ' : '', h('a', { href: `#/m/${m.cle}`, text: contenu.bi(m.titre) })])) : null,
  );
  return { el, titre: `${r.titre} — Coupole Web`, detruire() {} };
}

function erreur(): Page {
  return { el: pageIntrouvable(tr('web_ressource_inconnue'), tr), titre: `${tr('web_introuvable')} — Coupole Web`, detruire() {} };
}
