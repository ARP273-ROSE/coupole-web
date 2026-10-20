/**
 * Bibliothèque : la présentation d'origine de ClassAction (« showing: all images »…).  Un onglet par type —
 * Questions, Fiches, Tables, Images — montre TOUT le contenu de ce type, rangé par module dans l'ordre d'origine ;
 * filtres « module » et « favoris seulement » ; vignettes pour les images (photo ou schéma), aperçu au survol pour
 * les fiches et tables, étoile favori partout.  Les animations ont leur propre page (#/animations) : l'ancien onglet
 * Animations, qui la répétait, y renvoie.  Adresse : #/bibliotheque/<onglet>?m=<module>&f=1.
 */
import * as S from '../contenu/sauvegarde';
import { langue, tr } from '../i18n/i18n';
import { h, icone } from './dom';
import * as contenu from './contenu';
import { elementRessource, onglets, ouvrirRessource, titresRessources } from './composants';
import { boutonFavori } from './favoris';
import type { Page } from './page_apropos';
import { remplacerAdresse } from './routeur';
import * as stockage from './stockage';

const ONGLETS = ['questions', 'fiches', 'tables', 'images'] as const;
type Onglet = (typeof ONGLETS)[number];
const GENRE: Record<Onglet, 'question' | 'fiche' | 'table' | 'image'> = { questions: 'question', fiches: 'fiche', tables: 'table', images: 'image' };
const TYPES = ['W', 'G', 'C', 'D'];

function etatIcone(s: S.Sauvegarde, id: string): HTMLElement {
  const e = S.etatQuestion(s, id);
  const sym = { jamais: '', vue: '•', reussie: '✓', ratee: '✗' }[e];
  return h('span', { class: `etat etat-${e}`, role: 'img', title: tr('web_etat_' + e), 'aria-label': tr('web_etat_' + e), text: sym });
}

export async function pageBibliotheque(onglet0: string, module0: string, favoris0: boolean): Promise<Page> {
  await stockage.pret();
  const s = stockage.doc();
  const ms = await contenu.modules();
  const titres = await titresRessources();
  let onglet: Onglet = (ONGLETS as readonly string[]).includes(onglet0) ? (onglet0 as Onglet) : 'questions';
  let filtreModule = ms.some((m) => m.cle === module0) ? module0 : '';
  let favorisSeuls = favoris0;

  const titreDe = (g: Onglet, id: string): string => {
    if (g === 'questions') return id;
    return contenu.bi(titres[g === 'fiches' ? 'f' : g === 'tables' ? 't' : 'i'][id] ?? id);
  };
  /** Contenu d'un onglet pour un module, filtres appliqués (ordre d'origine). */
  const elements = (m: contenu.Module, g: Onglet): string[] => {
    let ids = g === 'questions' ? m.questions.map((q) => q.id) : (m[g] as string[]);
    if (favorisSeuls) ids = ids.filter((id) => S.estFavori(s, GENRE[g], id));
    return ids;
  };
  const modulesVus = (): contenu.Module[] => ms.filter((m) => !filtreModule || m.cle === filtreModule);
  const total = (g: Onglet): number => new Set(modulesVus().flatMap((m) => elements(m, g))).size;

  // ------------------------------------------------------------ filtres
  const choixModule = h('select', { id: 'biblio-module' });
  choixModule.append(h('option', { value: '', text: tr('web_tous_les_modules') }));
  for (const m of ms) choixModule.append(h('option', { value: m.cle, text: contenu.bi(m.titre) + (m.affiche ? '' : ` (${tr('web_modules_bonus').toLowerCase()})`), selected: m.cle === filtreModule }));
  const caseFavoris = h('input', { type: 'checkbox', id: 'biblio-favoris' });
  caseFavoris.checked = favorisSeuls;
  const affichage = h('p', { class: 'compte', 'aria-live': 'polite' });

  // ------------------------------------------------------------ panneaux
  const panneaux: Partial<Record<Onglet, HTMLElement>> = {};
  let detruite = false;
  let observateurImages: IntersectionObserver | null = null;

  const vignetteImage = (id: string): HTMLElement => {
    const boite = h('div', { class: 'vignette vignette-image', 'data-image': id, 'aria-hidden': 'true' });
    observateurImages ??= new IntersectionObserver((entrees) => {
      for (const en of entrees) {
        if (!en.isIntersecting) continue;
        const b = en.target as HTMLElement;
        observateurImages?.unobserve(b);
        void contenu.apercu('image', b.dataset.image!).then((c) => {
          if (c) b.replaceChildren(c);
        });
      }
    }, { rootMargin: '200px' });
    observateurImages.observe(boite);
    return boite;
  };

  const carteImage = (id: string): HTMLElement => {
    const t = titreDe('images', id);
    const b = h('button', { type: 'button', class: 'carte', 'aria-haspopup': 'dialog' }, vignetteImage(id), h('div', { class: 'carte-corps' }, h('h3', { class: 'carte-titre', text: t })));
    b.addEventListener('click', () => ouvrirRessource('image', id, t));
    return h('div', { class: 'carte-boite', 'data-genre': 'image', 'data-id': id }, b, boutonFavori('image', id, t));
  };

  // rendu progressif : les premiers modules tout de suite, les suivants aux moments creux (page vite utilisable)
  let tour = 0;
  const remplir = (p: HTMLElement, g: Onglet): void => {
    p.replaceChildren();
    const moi = ++tour;
    const file = modulesVus().filter((m) => elements(m, g).length);
    const suite = (): void => {
      if (moi !== tour || detruite) return;
      const t0 = performance.now();
      while (file.length && (performance.now() - t0 < 12 || p.childElementCount < 2)) section(p, g, file.shift()!);
      if (file.length) (window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 30)))(suite, { timeout: 200 } as never);
    };
    if (!file.length) p.append(h('p', { class: 'vide', text: tr('web_bibliotheque_vide') }));
    else suite();
  };

  const section = (p: HTMLElement, g: Onglet, m: contenu.Module): void => {
    {
      const ids = elements(m, g);
      const titreM = contenu.bi(m.titre);
      const tete = h('h2', {}, h('a', { href: `#/m/${m.cle}`, text: titreM, title: tr('web_ouvrir_module') }), h('span', { class: 'nb', text: String(ids.length) }));
      let corps: HTMLElement;
      if (g === 'questions') {
        corps = h('div', {});
        for (const t of TYPES) {
          const qs = m.questions.filter((q) => q.n.startsWith(t) && ids.includes(q.id));
          if (!qs.length) continue;
          const ol = h('ol', { class: 'liste-questions' });
          for (const q of qs) {
            const li = elementRessource('question', q.id, q.t ? contenu.bi(q.t) : q.id, { lien: q.ok ? `#/m/${m.cle}/q/${q.id}` : undefined, sousTitre: q.n });
            li.prepend(etatIcone(s, q.id));
            if (!q.ok) {
              li.classList.add('a-venir');
              const a = li.querySelector('a');
              a?.removeAttribute('href');
              a?.setAttribute('aria-disabled', 'true');
              a?.append(h('span', { class: 'badge', text: tr('web_a_venir') }));
            }
            ol.append(li);
          }
          corps.append(h('h3', { class: 'type-questions', text: tr('web_type_' + t) }), ol);
        }
      } else if (g === 'images') corps = h('div', { class: 'grille grille-biblio' }, ...ids.map(carteImage));
      else corps = h('ul', { class: 'liste-ressources' }, ...ids.map((id) => elementRessource(GENRE[g], id, titreDe(g, id))));
      p.append(h('section', { class: 'groupe-ressources groupe-biblio', 'data-module': m.cle }, tete, corps));
    }
  };

  const maj = (refaire = true): void => {
    for (const g of ONGLETS) {
      const p = panneaux[g];
      if (p && refaire) remplir(p, g);
      const nb = el.querySelector(`#onglet-${g} .nb`);
      if (nb) nb.textContent = String(total(g));
    }
    affichage.textContent = tr('web_affichage', { quoi: tr(favorisSeuls ? 'web_affichage_favoris' : 'web_affichage_tout') + (filtreModule ? ' · ' + contenu.bi(ms.find((m) => m.cle === filtreModule)!.titre) : ''), n: total(onglet) });
    const p = new URLSearchParams();
    if (filtreModule) p.set('m', filtreModule);
    if (favorisSeuls) p.set('f', '1');
    const q = p.toString();
    remplacerAdresse(`#/bibliotheque/${onglet}${q ? '?' + q : ''}`);
  };
  choixModule.addEventListener('change', () => {
    filtreModule = choixModule.value;
    maj();
  });
  caseFavoris.addEventListener('change', () => {
    favorisSeuls = caseFavoris.checked;
    maj();
  });
  // favori retiré pendant le filtre « favoris seulement » : la liste suit (sans voler le focus)
  let attente = 0;
  const desabonner = stockage.abonner(() => {
    if (!favorisSeuls) return;
    clearTimeout(attente);
    attente = window.setTimeout(() => maj(), 800);
  });

  const bloc = onglets(
    ONGLETS.map((g) => ({ id: g, libelle: tr('web_onglet_' + g), nombre: total(g), remplir: (p: HTMLElement) => remplir((panneaux[g] = p), g) })),
    onglet,
    (id) => {
      onglet = id as Onglet;
      maj(false);
    },
    tr('web_contenu_bibliotheque'),
  );

  const el = h(
    'div',
    { class: 'page page-bibliotheque', lang: langue() },
    h('nav', { class: 'fil', 'aria-label': tr('web_fil') }, h('a', { href: '#/' }, icone('retour'), tr('web_accueil'))),
    h('h1', { text: tr('web_bibliotheque') }),
    h('p', { class: 'sous-titre', text: tr('web_bibliotheque_texte') }),
    h('div', { class: 'barre-filtres' },
      h('p', { class: 'filtre' }, h('label', { for: 'biblio-module', text: tr('web_filtre_module') }), choixModule),
      h('p', { class: 'case' }, caseFavoris, h('label', { for: 'biblio-favoris' }, icone('etoile'), tr('web_favoris_seulement')))),
    affichage,
    bloc,
  );
  maj(false);
  return {
    el,
    titre: `${tr('web_bibliotheque')} — Coupole Web`,
    detruire() {
      detruite = true;
      observateurImages?.disconnect();
      clearTimeout(attente);
      desabonner();
    },
  };
}
