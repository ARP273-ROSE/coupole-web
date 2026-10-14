/**
 * Adresses (dans le fragment, pour un site statique) :
 *   #/                         catalogue (?q=recherche&t=thème)
 *   #/a/<id>?cle=valeur&…      une animation, avec ses réglages (adresse partageable)
 *   #/apropos                  à propos
 */
import type { EtatReglages } from '../anim/base';

export type Route =
  | { page: 'catalogue'; q: string; theme: string }
  | { page: 'animation'; id: string; etat: EtatReglages }
  | { page: 'apropos' };

export function lireRoute(hash = location.hash): Route {
  const brut = hash.replace(/^#/, '');
  const [chemin = '', requete = ''] = brut.split('?', 2) as [string, string?];
  const params = new URLSearchParams(requete);
  const morceaux = chemin.split('/').filter(Boolean);
  if (morceaux[0] === 'a' && morceaux[1]) {
    const etat: EtatReglages = {};
    for (const [k, v] of params) {
      if (!/^[A-Za-z0-9_]{1,40}$/.test(k) || v.length > 80) continue;
      if (v === 'true' || v === 'false') etat[k] = v === 'true';
      else if (v !== '' && /^-?\d+(\.\d+)?(e-?\d+)?$/i.test(v)) etat[k] = Number(v);
      else etat[k] = v;
    }
    return { page: 'animation', id: decodeURIComponent(morceaux[1]), etat };
  }
  if (morceaux[0] === 'apropos') return { page: 'apropos' };
  return { page: 'catalogue', q: params.get('q') ?? '', theme: params.get('t') ?? '' };
}

export function adresseAnimation(id: string, etat: EtatReglages = {}): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(etat)) if (v !== null && v !== undefined) p.set(k, String(v));
  const q = p.toString();
  return `#/a/${encodeURIComponent(id)}${q ? '?' + q : ''}`;
}

export function adresseCatalogue(q = '', theme = ''): string {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (theme) p.set('t', theme);
  const s = p.toString();
  return '#/' + (s ? '?' + s : '');
}

/** Remplace l'adresse sans créer d'entrée d'historique ni déclencher de changement de page. */
export function remplacerAdresse(hash: string): void {
  if (location.hash === hash) return;
  try {
    history.replaceState(history.state, '', hash);
  } catch {
    /* rien */
  }
}
