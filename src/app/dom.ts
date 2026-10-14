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
} as const;

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
