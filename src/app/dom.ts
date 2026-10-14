/** Petits outils DOM (sans innerHTML pour le texte : tout passe par textContent). */

type Attrs = Record<string, string | number | boolean | null | undefined>;
type Enfant = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  balise: K,
  attrs: Attrs = {},
  ...enfants: (Enfant | Enfant[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(balise);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  ajouter(el, enfants);
  return el;
}

export function ajouter(el: Element, enfants: (Enfant | Enfant[])[]): void {
  for (const e of enfants.flat()) {
    if (e === null || e === undefined || e === false) continue;
    el.append(typeof e === 'string' ? document.createTextNode(e) : e);
  }
}

const PARSEUR = typeof DOMParser !== 'undefined' ? new DOMParser() : null;

/** Icône SVG (chaînes fixes du code, jamais de données externes). */
export function icone(nom: keyof typeof ICONES): SVGSVGElement {
  const doc = PARSEUR!.parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONES[nom]}</svg>`,
    'image/svg+xml',
  );
  return document.importNode(doc.documentElement, true) as unknown as SVGSVGElement;
}

export const ICONES = {
  lecture: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>',
  reinit: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  partager: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  plein: '<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>',
  chercher: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  retour: '<path d="m15 18-6-6 6-6"/>',
  soleil: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  lune: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  auto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor" stroke="none"/>',
  fermer: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  modules: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  animation: '<circle cx="12" cy="12" r="8.5"/><ellipse cx="12" cy="12" rx="8.5" ry="3.2"/><circle cx="18" cy="9" r="1.4" fill="currentColor" stroke="none"/>',
  dossier: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  progres: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  copier: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
  crayon: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  poubelle: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  haut: '<path d="m6 15 6-6 6 6"/>',
  bas: '<path d="m6 9 6 6 6-6"/>',
  valider: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  oeil: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  ampoule: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  drapeau: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  telecharger: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  importer: '<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>',
  echange: '<path d="M7 4v13M3 13l4 4 4-4"/><path d="M17 20V7M13 11l4-4 4 4"/>',
  boussole: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  nuage: '<path d="M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z"/><path d="M4 4l16 16"/>',
} as const;

/** Bloc d'état (introuvable, hors ligne, vide) : icône, titre, texte, actions ; annoncé aux lecteurs d'écran. */
export function blocEtat(o: { titre: string; texte: string; icone?: keyof typeof ICONES; alerte?: boolean; actions?: { libelle: string; href: string; principal?: boolean }[] }): HTMLElement {
  return h(
    'div',
    { class: 'etat-message', role: o.alerte ? 'alert' : null },
    h('span', { class: 'etat-icone' }, icone(o.icone ?? 'boussole')),
    h('h1', { text: o.titre }),
    h('p', { text: o.texte }),
    o.actions?.length ? h('div', { class: 'etat-actions' }, o.actions.map((a) => h('a', { class: 'bouton' + (a.principal ? ' principal' : ''), href: a.href, text: a.libelle }))) : null,
  );
}

/** Page « introuvable » ou « hors ligne » (selon la connexion) avec un retour à l'accueil et à la recherche. */
export function pageIntrouvable(texte: string, tr: (c: string) => string): HTMLElement {
  const hl = typeof navigator !== 'undefined' && navigator.onLine === false;
  return h(
    'div',
    { class: 'page' },
    blocEtat({
      alerte: true,
      icone: hl ? 'nuage' : 'boussole',
      titre: tr(hl ? 'web_hors_ligne_titre' : 'web_introuvable'),
      texte: hl ? tr('web_hors_ligne_texte') : texte,
      actions: [
        { libelle: tr('web_retour_accueil'), href: '#/', principal: true },
        { libelle: tr('web_nav_catalogue'), href: '#/animations' },
      ],
    }),
  );
}

/** Annonce passagère en bas de l'écran (lue par les lecteurs d'écran). */
export function annoncer(texte: string, action?: { libelle: string; faire: () => void }, duree = 4500): () => void {
  const zone = document.getElementById('annonces');
  if (!zone) return () => {};
  const el = h('div', { class: 'annonce' }, h('span', { text: texte }));
  if (action) {
    const b = h('button', { class: 'bouton', type: 'button', text: action.libelle });
    b.addEventListener('click', () => {
      fermer();
      action.faire();
    });
    el.append(b);
  }
  zone.append(el);
  let fini = false;
  const fermer = (): void => {
    if (fini) return;
    fini = true;
    el.remove();
  };
  if (duree > 0) setTimeout(fermer, duree);
  return fermer;
}
