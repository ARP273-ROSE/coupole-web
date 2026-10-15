/** Morceau des pages de modules (chargé à la demande depuis main.ts). */
import '../styles/classe.css';
import type { Route } from './routeur';
import type { Page } from './page_apropos';
import { pageModule } from './page_module';
import { pageQuestion } from './page_question';
import { pageMesModules } from './page_mes_modules';
import { pageProgression } from './page_progression';
import { pageRecherche } from './page_recherche';
import { pageRessource } from './page_ressource';
import { pageFavoris } from './page_favoris';
import { pageBibliotheque } from './page_bibliotheque';

export async function page(r: Route): Promise<Page> {
  switch (r.page) {
    case 'module':
      return pageModule(r.cle, r.onglet, r.perso);
    case 'question':
      return pageQuestion(r.cle, r.question, r.perso, r.params);
    case 'mes-modules':
      return pageMesModules(r.nouveau);
    case 'progression':
      return pageProgression();
    case 'recherche':
      return pageRecherche(r.q);
    case 'ressource':
      return pageRessource(r.genre, r.id);
    case 'favoris':
      return pageFavoris(r.genre, r.tri);
    case 'bibliotheque':
      return pageBibliotheque(r.onglet, r.module, r.favoris);
    default:
      throw new Error('page inconnue');
  }
}
