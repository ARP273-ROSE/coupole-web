/**
 * Favoris : bouton étoile (bascule accessible, aria-pressed) pour tout atelier — module, animation, question, fiche,
 * table, image — dans les listes, les fiches et les pages.  Tous les boutons d'un même atelier restent d'accord
 * (une seule source : la sauvegarde commune, `favoris`).
 */
import * as S from '../contenu/sauvegarde';
import { tr } from '../i18n/i18n';
import { annoncer, h, icone } from './dom';
import * as stockage from './stockage';

export type GenreF = S.GenreFavori;

function etat(b: HTMLButtonElement): void {
  const on = S.estFavori(stockage.doc(), b.dataset.genre!, b.dataset.id!);
  if (b.getAttribute('aria-pressed') === String(on) && b.firstElementChild) return;
  b.setAttribute('aria-pressed', String(on));
  b.replaceChildren(icone(on ? 'etoile_pleine' : 'etoile'));
  if (b.dataset.libelle) b.append(h('span', { class: 'libelle-favori', text: tr(on ? 'web_favori_oui' : 'web_favori_non') }));
  b.title = tr(on ? 'web_favori_retirer' : 'web_favori_ajouter');
}

let abonne = false;
function suivre(): void {
  if (abonne || typeof document === 'undefined') return;
  abonne = true;
  stockage.abonner(() => document.querySelectorAll<HTMLButtonElement>('button.bouton-favori').forEach(etat));
}

/**
 * Bouton « favori » : `titre` sert au nom accessible (« Favori : Lois de Kepler ») ; `libelle` affiche « Favori »
 * à côté de l'étoile (en-têtes de pages).
 */
export function boutonFavori(genre: GenreF, id: string, titre: string, o: { libelle?: boolean; petit?: boolean } = {}): HTMLButtonElement {
  suivre();
  const b = h('button', {
    type: 'button',
    class: 'bouton-favori bouton ' + (o.libelle ? 'discret' : 'icone discret') + (o.petit ? ' petit' : ''),
    'data-genre': genre,
    'data-id': id,
    'data-libelle': o.libelle ? '1' : null,
    'aria-label': tr('web_favori_nom', { titre }),
  });
  etat(b);
  b.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const s = stockage.doc();
    const on = S.basculerFavori(s, genre, id);
    stockage.modifie();
    etat(b);
    annoncer(tr(on ? 'web_favori_ajoute' : 'web_favori_retire', { titre }));
  });
  return b;
}

export function estFavori(genre: string, id: string): boolean {
  return S.estFavori(stockage.doc(), genre, id);
}
