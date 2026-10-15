/**
 * Adresses (dans le fragment, pour un site statique) :
 *   #/                         accueil (modules) ; #/?q=… ou #/?t=… : catalogue (anciennes adresses)
 *   #/animations?q=…&t=…       catalogue des animations (recherche, thème)
 *   #/a/<id>?cle=valeur&…      une animation, avec ses réglages (adresse partageable)
 *   #/m/<module>[/<onglet>]    un module (onglets questions, animations, fiches, tables, images)
 *   #/m/<module>/q/<question>?p_<menu>=<option>&g=<graine>   une question dans son module
 *   #/mm/<id>[/<onglet>], #/mm/<id>/q/<question>             un module personnel (« Mes modules »)
 *   #/favoris?t=<genre>&tri=<ordre>   mes favoris ; #/mes-modules : collections (ex-« Mes modules »)
 *   #/bibliotheque[/<onglet>]?m=<module>&f=1   tout le contenu d'un type, par module (présentation de ClassAction)
 *   #/mes-modules, #/progression, #/recherche?q=…, #/r/<fiche|table|image>/<id>, #/apropos[?installer]
 */
import type { EtatReglages } from '../anim/base';

export type Route =
  | { page: 'accueil' }
  | { page: 'module'; cle: string; onglet: string; perso: boolean }
  | { page: 'question'; cle: string; question: string; perso: boolean; params: URLSearchParams }
  | { page: 'mes-modules'; nouveau: boolean }
  | { page: 'favoris'; genre: string; tri: string }
  | { page: 'bibliotheque'; onglet: string; module: string; favoris: boolean }
  | { page: 'progression' }
  | { page: 'recherche'; q: string }
  | { page: 'ressource'; genre: string; id: string }
  | { page: 'catalogue'; q: string; theme: string }
  | { page: 'animation'; id: string; etat: EtatReglages }
  | { page: 'apropos'; installer: boolean };

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
  if (morceaux[0] === 'apropos') return { page: 'apropos', installer: params.has('installer') };
  const id = (x: string | undefined): string => decodeURIComponent(x ?? '').slice(0, 80);
  if ((morceaux[0] === 'm' || morceaux[0] === 'mm') && morceaux[1]) {
    const perso = morceaux[0] === 'mm';
    if (morceaux[2] === 'q' && morceaux[3]) return { page: 'question', cle: id(morceaux[1]), question: id(morceaux[3]), perso, params };
    return { page: 'module', cle: id(morceaux[1]), onglet: id(morceaux[2]), perso };
  }
  if (morceaux[0] === 'mes-modules') return { page: 'mes-modules', nouveau: params.get('nouveau') === '1' };
  if (morceaux[0] === 'progression') return { page: 'progression' };
  if (morceaux[0] === 'favoris') return { page: 'favoris', genre: (params.get('t') ?? '').slice(0, 20), tri: (params.get('tri') ?? '').slice(0, 20) };
  if (morceaux[0] === 'bibliotheque') return { page: 'bibliotheque', onglet: id(morceaux[1]), module: (params.get('m') ?? '').slice(0, 80), favoris: params.get('f') === '1' };
  if (morceaux[0] === 'recherche') return { page: 'recherche', q: (params.get('q') ?? '').slice(0, 200) };
  if (morceaux[0] === 'r' && morceaux[1] && morceaux[2]) return { page: 'ressource', genre: id(morceaux[1]), id: id(morceaux[2]) };
  if (morceaux[0] === 'animations' || params.has('q') || params.has('t')) return { page: 'catalogue', q: params.get('q') ?? '', theme: params.get('t') ?? '' };
  return { page: 'accueil' };
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
  return '#/animations' + (s ? '?' + s : '');
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
