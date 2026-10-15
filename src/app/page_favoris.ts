/**
 * « Mes favoris » : tout ce qui est marqué d'une étoile (modules, animations, questions, fiches, tables, images),
 * groupé par type, filtrable par type et triable dans chaque groupe (ajout récent, ajout ancien, titre).  Les collections
 * (ex-« Mes modules ») sont au second plan : un bouton discret « Organiser en collections… ».
 */
import * as S from '../contenu/sauvegarde';
import { PAR_ID } from '../anim/registre';
import { langue, tr } from '../i18n/i18n';
import { blocEtat, h, icone } from './dom';
import * as contenu from './contenu';
import { elementRessource, titresRessources, type GenreL } from './composants';
import type { Page } from './page_apropos';
import { remplacerAdresse } from './routeur';
import * as stockage from './stockage';

export const ORDRE_FAVORIS: GenreL[] = ['module', 'animation', 'question', 'fiche', 'table', 'image'];
const TRIS = ['recent', 'ancien', 'titre'] as const;
type Tri = (typeof TRIS)[number];

export interface FavoriAffiche {
  genre: GenreL;
  id: string;
  titre: string;
  sous: string;
  lien?: string;
  ajoute: string;
  ok: boolean;
}

/** Titres, sous-titres et liens des favoris (dans la langue de l'interface), dans l'ordre d'ajout. */
export async function favorisAffiches(s: S.Sauvegarde): Promise<FavoriAffiche[]> {
  const ms = await contenu.modules();
  const titres = await titresRessources();
  const qInfo = new Map<string, { t: string; m: contenu.Module; n: string }>();
  for (const m of ms) for (const q of m.questions) if (q.ok && !qInfo.has(q.id)) qInfo.set(q.id, { t: q.t ? contenu.bi(q.t) : q.id, m, n: q.n });
  return s.favoris.map((f) => {
    const base = { genre: f.genre as GenreL, id: f.id, ajoute: f.ajoute };
    if (f.genre === 'module') {
      const m = ms.find((x) => x.cle === f.id);
      if (m) return { ...base, titre: contenu.bi(m.titre), sous: tr('web_genre_module'), lien: `#/m/${m.cle}`, ok: true };
      const mm = S.trouverModule(s, f.id);
      if (mm) return { ...base, titre: mm.nom, sous: tr('web_genre_collection'), lien: `#/mm/${mm.id}`, ok: true };
      return { ...base, titre: f.id, sous: tr('web_indisponible'), ok: false };
    }
    if (f.genre === 'animation') {
      const e = PAR_ID.get(f.id);
      return e ? { ...base, titre: tr('anim_nom_' + e.cle), sous: tr('anim_theme_' + e.theme), ok: true } : { ...base, titre: f.id, sous: tr('web_indisponible'), ok: false };
    }
    if (f.genre === 'question') {
      const q = qInfo.get(f.id);
      return q ? { ...base, titre: q.t, sous: `${contenu.bi(q.m.titre)} · ${q.n}`, lien: `#/m/${q.m.cle}/q/${f.id}`, ok: true } : { ...base, titre: f.id, sous: tr('web_indisponible'), ok: false };
    }
    const t = titres[f.genre === 'fiche' ? 'f' : f.genre === 'table' ? 't' : 'i'][f.id];
    return t ? { ...base, titre: contenu.bi(t), sous: '', ok: true } : { ...base, titre: f.id, sous: tr('web_indisponible'), ok: false };
  });
}

export function trier(l: FavoriAffiche[], tri: Tri): FavoriAffiche[] {
  const c = new Intl.Collator(langue(), { sensitivity: 'base', numeric: true });
  const r = [...l];
  if (tri === 'recent') r.reverse();
  else if (tri === 'titre') r.sort((a, b) => c.compare(a.titre, b.titre));
  return r;
}

export async function pageFavoris(genre0: string, tri0: string): Promise<Page> {
  await stockage.pret();
  const s = stockage.doc();
  let genre = (ORDRE_FAVORIS as string[]).includes(genre0) ? (genre0 as GenreL) : '';
  let tri: Tri = (TRIS as readonly string[]).includes(tri0) ? (tri0 as Tri) : 'recent';

  const puces = h('div', { class: 'puces', role: 'group', 'aria-label': tr('web_filtre_types') });
  const choixTri = h('select', { id: 'tri-favoris' });
  for (const t of TRIS) choixTri.append(h('option', { value: t, text: tr('web_tri_' + t), selected: t === tri }));
  const blocTri = h('p', { class: 'tri' }, h('label', { for: 'tri-favoris' }, icone('trier'), tr('web_trier')), choixTri);
  const liste = h('div', { class: 'liste-favoris' });
  const nCollections = s.mes_modules.length;
  const collections = h(
    'div',
    { class: 'collections-lien' },
    h('a', { class: 'bouton discret', href: '#/mes-modules' }, icone('dossier'), tr('web_organiser_collections')),
    h('span', { class: 'aide', text: nCollections === 0 ? tr('web_collections_aide_0') : nCollections === 1 ? tr('web_collections_aide_1') : tr('web_collections_aide', { n: nCollections }) }),
  );

  const remplir = async (): Promise<void> => {
    const tous = await favorisAffiches(s);
    puces.replaceChildren();
    const puce = (g: GenreL | '', texte: string, n: number): void => {
      const b = h('button', { type: 'button', class: 'puce', 'aria-pressed': String(genre === g) }, texte, h('span', { class: 'nb', text: String(n) }));
      b.addEventListener('click', () => {
        genre = genre === g ? '' : g;
        void remplir();
      });
      puces.append(b);
    };
    puce('', tr('web_tous_types'), tous.length);
    for (const g of ORDRE_FAVORIS) {
      const n = tous.filter((f) => f.genre === g).length;
      if (n) puce(g, tr('web_onglet_' + g + 's'), n);
    }
    puces.hidden = tous.length === 0;
    blocTri.hidden = tous.length === 0;
    remplacerAdresse('#/favoris' + (genre || tri !== 'recent' ? '?' + new URLSearchParams({ ...(genre ? { t: genre } : {}), ...(tri !== 'recent' ? { tri } : {}) }).toString() : ''));
    liste.replaceChildren();
    if (!tous.length) {
      liste.append(blocEtat({ titre: tr('web_favoris_vide_titre'), texte: tr('web_favoris_vide'), icone: 'etoile', actions: [{ libelle: tr('web_nav_bibliotheque'), href: '#/bibliotheque', principal: true }, { libelle: tr('web_nav_modules'), href: '#/' }] }));
      return;
    }
    const l = trier(tous, tri).filter((f) => !genre || f.genre === genre);
    // groupés par type (ordre fixe), triés dans chaque groupe
    for (const g of ORDRE_FAVORIS) {
      const lg = l.filter((f) => f.genre === g);
      if (!lg.length) continue;
      const ul = h('ul', { class: 'liste-ressources' });
      for (const f of lg) {
        const li = elementRessource(f.genre, f.id, f.titre, { lien: f.lien, sousTitre: f.sous || undefined });
        if (!f.ok) li.classList.add('a-venir');
        ul.append(li);
      }
      liste.append(h('section', { class: 'groupe-ressources', 'data-genre': g }, h('h2', {}, tr('web_onglet_' + g + 's'), h('span', { class: 'nb', text: String(lg.length) })), ul));
    }
  };
  choixTri.addEventListener('change', () => {
    tri = choixTri.value as Tri;
    void remplir();
  });
  // un favori retiré ailleurs (autre onglet de la page, fenêtre) : la liste suit
  let attente = 0;
  const desabonner = stockage.abonner(() => {
    clearTimeout(attente);
    attente = window.setTimeout(() => {
      const focus = document.activeElement as HTMLElement | null;
      const cle = focus?.closest('li')?.dataset;
      void remplir().then(() => {
        if (cle?.genre) (liste.querySelector<HTMLElement>(`li[data-genre="${cle.genre}"][data-id="${CSS.escape(cle.id ?? '')}"] .bouton-favori`) ?? liste.querySelector<HTMLElement>('.bouton-favori'))?.focus();
      });
    }, 600);
  });
  await remplir();

  const el = h(
    'div',
    { class: 'page page-favoris', lang: langue() },
    h('nav', { class: 'fil', 'aria-label': tr('web_fil') }, h('a', { href: '#/' }, icone('retour'), tr('web_accueil'))),
    h('h1', { text: tr('web_favoris') }),
    h('p', { class: 'sous-titre', text: tr('web_favoris_texte') }),
    h('div', { class: 'barre-filtres' }, puces, blocTri),
    liste,
    collections,
  );
  return {
    el,
    titre: `${tr('web_favoris')} — Coupole Web`,
    detruire() {
      clearTimeout(attente);
      desabonner();
    },
  };
}
