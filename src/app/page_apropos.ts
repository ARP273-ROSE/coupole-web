/** Page « À propos » : installer l'application, origine, licence, crédits, vie privée, liens. */
import { tr } from '../i18n/i18n';
import { h, icone } from './dom';
import * as installation from './installation';
import type { Plateforme } from './installation_regles';

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

/** Section « Installer l'application » : état, bouton, instructions de ce navigateur puis des autres. */
function sectionInstallation(): { el: HTMLElement; detruire: () => void } {
  const etat = h('div', { class: 'installation-etat' });
  const p = installation.laPlateforme();
  const remplir = (): void => {
    etat.replaceChildren();
    if (installation.installee()) {
      etat.append(h('p', { class: 'ok', text: tr('web_installee_ici') }));
      return;
    }
    if (installation.inviteDisponible()) {
      const b = h('button', { type: 'button', class: 'bouton principal' }, icone('installer'), tr('web_installer'));
      b.addEventListener('click', () => void installation.installer());
      etat.append(b);
    }
  };
  remplir();
  const arreter = installation.suivre(remplir);
  const autres: Plateforme[] = (['chromium', 'ios', 'mac-safari', 'firefox-android', 'firefox', 'autre'] as Plateforme[]).filter((x) => x !== p);
  const el = h(
    'section',
    { id: 'installer', class: 'installation', 'aria-labelledby': 'titre-installer', tabindex: -1 },
    h('h2', { id: 'titre-installer' }, icone('installer'), tr('web_installer_titre')),
    h('p', { text: tr('web_installer_pourquoi') }),
    etat,
    h('h3', { text: installation.titreEtapes(p) }),
    installation.etapes(p),
    h('details', {}, h('summary', { text: tr('web_installer_tous') }), ...autres.flatMap((x) => [h('h3', { text: installation.titreEtapes(x) }), installation.etapes(x)])),
  );
  return { el, detruire: arreter };
}

export function pageApropos(installer = false): Page {
  const inst = sectionInstallation();
  const el = h(
    'div',
    { class: 'page' },
    h(
      'article',
      { class: 'prose' },
      h('h1', { text: tr('web_apropos_titre') }),
      h('p', { text: tr('web_apropos_intro') }),
      inst.el,
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
        h('li', {}, lien('https://phet.colorado.edu/sims/html/gravity-and-orbits/latest/gravity-and-orbits_fr.html', tr('web_apropos_phet'))),
      ),
      h('p', { class: 'credit', text: tr('web_apropos_version', { v: __VERSION__ }) }),
    ),
  );
  if (installer) setTimeout(() => inst.el.focus(), 0);
  return { el, titre: `${tr('web_apropos_titre')}`, focus: installer ? inst.el : undefined, detruire: inst.detruire };
}
