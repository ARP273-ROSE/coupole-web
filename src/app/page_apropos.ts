/** Page « À propos » : origine, licence, crédits, vie privée, liens. */
import { tr } from '../i18n/i18n';
import { h } from './dom';

export interface Page {
  el: HTMLElement;
  titre: string;
  detruire(): void;
  focus?: HTMLElement;
}

const DEPOT = 'https://github.com/ARP273-ROSE/coupole-web';
const COUPOLE = 'https://github.com/ARP273-ROSE/coupole';
const CLASSACTION = 'https://github.com/astroUNL/classaction-air-app';

function lien(href: string, texte: string): HTMLAnchorElement {
  return h('a', { href, rel: 'noopener noreferrer', target: '_blank', text: texte });
}

export function pageApropos(): Page {
  const el = h(
    'div',
    { class: 'page' },
    h(
      'article',
      { class: 'prose' },
      h('h1', { text: tr('web_apropos_titre') }),
      h('p', { text: tr('web_apropos_intro') }),
      h('h2', { text: tr('web_apropos_usage_t') }),
      h('ul', {}, ...[1, 2, 3, 4].map((i) => h('li', { text: tr('web_apropos_usage_' + i) }))),
      h('h2', { text: tr('web_apropos_modules_t') }),
      h('p', { text: tr('web_apropos_modules') }),
      h('p', { text: tr('web_apropos_sauvegarde') }),
      h('h2', { text: tr('web_apropos_origine_t') }),
      h('p', { text: tr('web_apropos_origine') }),
      h('h2', { text: tr('web_apropos_calculs_t') }),
      h('p', { text: tr('web_apropos_calculs') }),
      h('h2', { text: tr('web_apropos_vie_t') }),
      h('p', { text: tr('web_apropos_vie') }),
      h('h2', { text: tr('web_apropos_licence_t') }),
      h('p', { text: tr('web_apropos_licence') }),
      h('h2', { text: tr('web_apropos_liens_t') }),
      h(
        'ul',
        {},
        h('li', {}, lien(COUPOLE, tr('web_apropos_coupole'))),
        h('li', {}, lien(DEPOT, tr('web_apropos_depot'))),
        h('li', {}, lien(CLASSACTION, tr('web_apropos_classaction'))),
        h('li', {}, lien('https://github.com/ARP273-ROSE/Anticythere3D', tr('web_apropos_anticythere'))),
      ),
      h('p', { class: 'credit', text: tr('web_apropos_version', { v: __VERSION__ }) }),
    ),
  );
  return { el, titre: `${tr('web_apropos_titre')}`, detruire() {} };
}
