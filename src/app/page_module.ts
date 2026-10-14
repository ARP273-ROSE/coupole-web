/**
 * Page d'un module (des 24 de ClassAction, ou personnel : « Mes modules ») : onglets Questions, Animations, Fiches,
 * Tables, Images ; questions classées Échauffement (W), Générales (G), Défis (C), Discussion (D), numérotées, avec
 * leur état (réussie, ratée, vue) ; ressources avec aperçu au survol, ouvertes en fenêtres ; bascule « ce module /
 * tous les modules » ; progression du module ; pour un module personnel : renommer, copier, supprimer, organiser
 * (ordre, retrait).
 */
import * as S from '../contenu/sauvegarde';
import { PAR_ID } from '../anim/registre';
import { langue, tr } from '../i18n/i18n';
import { annoncer, h, icone, pageIntrouvable } from './dom';
import * as contenu from './contenu';
import { barreScore, confirmer, demanderTexte, elementRessource, onglets, titreDe, titresRessources, type GenreR, menuAjouter } from './composants';
import type { Page } from './page_apropos';
import * as stockage from './stockage';

export const TYPES = ['W', 'G', 'C', 'D'] as const;
export const ONGLETS = ['questions', 'animations', 'fiches', 'tables', 'images'] as const;
export type OngletId = (typeof ONGLETS)[number];

export interface InfoQ {
  id: string;
  n: string; // numéro dans le module (W1, G3…)
  ok: boolean;
  titre: string;
  module: string; // module d'origine (premier module qui la contient)
}

/** Questions d'un module personnel : numérotées par catégorie dans leur ordre d'ajout. */
export async function questionsDe(cle: string, perso: S.MonModule | null): Promise<InfoQ[]> {
  const ms = await contenu.modules();
  if (!perso) {
    const m = ms.find((x) => x.cle === cle);
    return (m?.questions ?? []).map((q) => ({ id: q.id, n: q.n, ok: q.ok, titre: q.t ? contenu.bi(q.t) : q.id, module: cle }));
  }
  const info = new Map<string, InfoQ>();
  for (const m of ms) for (const q of m.questions) if (!info.has(q.id)) info.set(q.id, { id: q.id, n: q.n, ok: q.ok, titre: q.t ? contenu.bi(q.t) : q.id, module: m.cle });
  const rang: Record<string, number> = { W: 0, G: 0, C: 0, D: 0 };
  const out: InfoQ[] = [];
  for (const e of perso.elements) {
    if (e.genre !== 'question') continue;
    const i = info.get(e.id);
    if (!i) continue;
    const t = i.n[0]!;
    out.push({ ...i, n: t + ++rang[t]! });
  }
  return out;
}

/** Ordre de passage d'une question à l'autre : W → G → C → D, en boucle. */
export function ordreQuestions(qs: InfoQ[]): InfoQ[] {
  return TYPES.flatMap((t) => qs.filter((q) => q.n.startsWith(t) && q.ok).sort((a, b) => Number(a.n.slice(1)) - Number(b.n.slice(1))));
}

function etatIcone(s: S.Sauvegarde, id: string): HTMLElement {
  const e = S.etatQuestion(s, id);
  const sym = { jamais: '', vue: '•', reussie: '✓', ratee: '✗' }[e];
  return h('span', { class: `etat etat-${e}`, role: 'img', title: tr('web_etat_' + e), 'aria-label': tr('web_etat_' + e), text: sym });
}

export async function pageModule(cle: string, onglet: string, perso: boolean): Promise<Page> {
  await stockage.pret();
  const s = stockage.doc();
  const mm = perso ? S.trouverModule(s, cle) ?? null : null;
  const m = perso ? null : await contenu.module(cle);
  if ((perso && !mm) || (!perso && !m)) {
    return { el: pageIntrouvable(tr('web_module_inconnu'), tr), titre: `${tr('web_introuvable')} — Coupole Web`, detruire() {} };
  }
  const titre = mm ? mm.nom : contenu.bi(m!.titre);
  const base = perso ? `#/mm/${cle}` : `#/m/${cle}`;
  const qs = await questionsDe(cle, mm);
  const ids = (g: GenreR): string[] => (mm ? mm.elements.filter((e) => e.genre === g).map((e) => e.id) : (m![(g + 's') as 'fiches'] as string[]));
  const anims = ids('animation').filter((a) => PAR_ID.has(a));
  const fiches = ids('fiche');
  const tables = ids('table');
  const imgs = ids('image');
  const titres = await titresRessources();

  // ------------------------------------------------------------ en-tête
  const bil = S.bilan(s, qs.filter((q) => q.ok).map((q) => q.id));
  const actions = h('div', { class: 'actions-module' });
  if (!perso) {
    const copier = h('button', { type: 'button', class: 'bouton' }, icone('copier'), tr('web_copier_module'));
    copier.addEventListener('click', () => {
      const els: S.Element[] = [
        ...qs.map((q) => ({ genre: 'question' as const, id: q.id })),
        ...anims.map((id) => ({ genre: 'animation' as const, id })),
        ...fiches.map((id) => ({ genre: 'fiche' as const, id })),
        ...tables.map((id) => ({ genre: 'table' as const, id })),
        ...imgs.map((id) => ({ genre: 'image' as const, id })),
      ];
      const n = S.creerModule(s, S.nomLibre(s, tr('web_copie_de', { nom: titre })), els);
      stockage.modifie();
      location.hash = `#/mm/${n.id}`;
      annoncer(tr('web_module_copie', { nom: n.nom }));
    });
    actions.append(copier);
  } else {
    const renommer = h('button', { type: 'button', class: 'bouton' }, icone('crayon'), tr('web_renommer'));
    renommer.addEventListener('click', async () => {
      const v = await demanderTexte(tr('web_renommer_module'), mm!.nom, tr('web_renommer'));
      if (v && S.renommerModule(s, cle, v)) {
        stockage.modifie();
        h1.textContent = v;
        document.title = `${v} — Coupole Web`;
      }
    });
    const copier = h('button', { type: 'button', class: 'bouton' }, icone('copier'), tr('web_copier'));
    copier.addEventListener('click', () => {
      const n = S.creerModule(s, S.nomLibre(s, tr('web_copie_de', { nom: mm!.nom })), mm!.elements);
      stockage.modifie();
      location.hash = `#/mm/${n.id}`;
    });
    const supprimer = h('button', { type: 'button', class: 'bouton danger' }, icone('poubelle'), tr('web_supprimer'));
    supprimer.addEventListener('click', async () => {
      const r = await confirmer(tr('web_supprimer_module_q', { nom: mm!.nom }), tr('web_supprimer_module_texte'), tr('web_supprimer'));
      if (!r.ok) return;
      const copie = JSON.parse(JSON.stringify(mm));
      S.supprimerModule(s, cle);
      stockage.modifie();
      location.hash = '#/mes-modules';
      annoncer(tr('web_module_supprime', { nom: copie.nom }), { libelle: tr('web_defaire'), faire: () => { s.mes_modules.push(copie); stockage.modifie(); location.hash = `#/mm/${copie.id}`; } }, 8000);
    });
    actions.append(renommer, copier, supprimer);
  }
  if (qs.length) {
    const raz = h('button', { type: 'button', class: 'bouton discret' }, icone('reinit'), tr('web_reinit_progression'));
    raz.addEventListener('click', async () => {
      const r = await confirmer(tr('web_reinit_module_q', { nom: titre }), tr('web_reinit_module_texte'), tr('web_effacer'), { libelle: tr('web_exporter_avant'), coche: true });
      if (!r.ok) return;
      if (r.option) stockage.telecharger(s, '-avant-effacement');
      const avant = JSON.parse(JSON.stringify(s));
      stockage.remplacer(S.reinitialiser(s, { partie: 'module', id: cle, questions: qs.map((q) => q.id) }));
      annoncer(tr('web_progression_effacee'), { libelle: tr('web_defaire'), faire: () => stockage.remplacer(S.migrer(avant)!) }, 8000);
      window.dispatchEvent(new Event('coupole:rafraichir'));
    });
    actions.append(raz);
  }
  const h1 = h('h1', { text: titre });
  const tete = h(
    'header',
    { class: 'tete-module' },
    h('nav', { class: 'fil', 'aria-label': tr('web_fil') }, h('a', { href: '#/' }, icone('retour'), tr('web_accueil')), h('span', { 'aria-hidden': 'true', text: '›' }), perso ? h('a', { href: '#/mes-modules', text: tr('web_mes_modules') }) : h('span', { text: tr('web_modules') })),
    h1,
    !perso && m!.original && m!.original !== titre ? h('p', { class: 'origine', text: tr('web_titre_origine', { titre: m!.original }) }) : null,
    qs.length ? barreScore(bil) : null,
    actions,
  );

  // ------------------------------------------------------------ onglets
  let portee: 'module' | 'tous' = 'module';
  const panneaux: Partial<Record<OngletId, HTMLElement>> = {};
  const listeQuestions = (p: HTMLElement): void => {
    p.replaceChildren();
    if (!qs.length) {
      p.append(h('p', { class: 'vide', text: tr(perso ? 'web_perso_vide' : 'web_module_sans_questions') }));
      return;
    }
    for (const t of TYPES) {
      const l = qs.filter((q) => q.n.startsWith(t));
      if (!l.length) continue;
      const ol = h('ol', { class: 'liste-questions' });
      for (const q of l) {
        const lien = q.ok ? `${base}/q/${q.id}` : undefined;
        const li = elementRessource('question', q.id, q.titre, { lien, sousTitre: q.n, retirer: perso ? () => retirer({ genre: 'question', id: q.id }) : undefined });
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
      p.append(h('section', { class: 'groupe-questions' }, h('h2', { text: tr('web_type_' + t) }), ol));
    }
  };
  const retirer = (e: S.Element): void => {
    if (mm && S.retirerElement(s, cle, e)) {
      stockage.modifie();
      void majPanneaux();
    }
  };
  const listeRessources = async (p: HTMLElement, g: 'animation' | 'fiche' | 'table' | 'image', liste: string[]): Promise<void> => {
    p.replaceChildren();
    if (!perso) {
      const bascule = h('div', { class: 'segmente petite', role: 'group', 'aria-label': tr('web_portee') });
      for (const v of ['module', 'tous'] as const) {
        const b = h('button', { type: 'button', 'aria-pressed': String(portee === v), text: tr(v === 'module' ? 'web_ce_module' : 'web_tous_modules') });
        b.addEventListener('click', () => {
          portee = v;
          void majPanneaux();
        });
        bascule.append(b);
      }
      p.append(bascule);
    }
    const titreR = (id: string): string => (g === 'animation' ? (PAR_ID.has(id) ? tr('anim_nom_' + PAR_ID.get(id)!.cle) : id) : contenu.bi(titres[g === 'fiche' ? 'f' : g === 'table' ? 't' : 'i'][id] ?? id));
    const ul = (ids2: string[]): HTMLElement =>
      h('ul', { class: 'liste-ressources' }, ...ids2.map((id) => elementRessource(g, id, titreR(id), { retirer: perso ? () => retirer({ genre: g, id }) : undefined, sousTitre: g === 'animation' && PAR_ID.get(id) ? tr('anim_theme_' + PAR_ID.get(id)!.theme) : undefined })));
    if (portee === 'tous' && !perso) {
      for (const x of await contenu.modules()) {
        const l = (x[(g + 's') as 'fiches'] as string[]).filter((id) => g !== 'animation' || PAR_ID.has(id));
        if (l.length) p.append(h('section', { class: 'groupe-ressources' }, h('h2', { text: contenu.bi(x.titre) }), ul(l)));
      }
      return;
    }
    if (!liste.length) {
      const vide = h('p', { class: 'vide' }, tr('web_rien_' + g));
      if (!perso) {
        const b = h('button', { type: 'button', class: 'lien', text: tr('web_voir_tous_modules') });
        b.addEventListener('click', () => {
          portee = 'tous';
          void majPanneaux();
        });
        vide.append(' ', b);
      }
      p.append(vide);
      return;
    }
    p.append(ul(liste));
  };
  const majPanneaux = async (): Promise<void> => {
    if (panneaux.questions) listeQuestions(panneaux.questions);
    if (panneaux.animations) await listeRessources(panneaux.animations, 'animation', ids('animation').filter((a) => PAR_ID.has(a)));
    if (panneaux.fiches) await listeRessources(panneaux.fiches, 'fiche', ids('fiche'));
    if (panneaux.tables) await listeRessources(panneaux.tables, 'table', ids('table'));
    if (panneaux.images) await listeRessources(panneaux.images, 'image', ids('image'));
    if (organiser) remplirOrganiser(organiser);
  };
  let organiser: HTMLElement | null = null;
  const remplirOrganiser = (p: HTMLElement): void => {
    organiser = p;
    p.replaceChildren();
    if (!mm!.elements.length) {
      p.append(h('p', { class: 'vide', text: tr('web_perso_vide') }));
      return;
    }
    const ol = h('ol', { class: 'liste-organiser' });
    mm!.elements.forEach((e, i) => {
      const nom = h('span', { class: 'ressource-titre', text: e.id });
      void titreDe(e.genre, e.id).then((t) => (nom.textContent = t));
      const haut = h('button', { type: 'button', class: 'bouton icone discret petit', 'aria-label': tr('web_monter'), title: tr('web_monter'), disabled: i === 0 }, icone('haut'));
      const bas = h('button', { type: 'button', class: 'bouton icone discret petit', 'aria-label': tr('web_descendre'), title: tr('web_descendre'), disabled: i === mm!.elements.length - 1 }, icone('bas'));
      const ret = h('button', { type: 'button', class: 'bouton icone discret petit', 'aria-label': tr('web_retirer'), title: tr('web_retirer') }, icone('fermer'));
      const deplacer = (vers: number): void => {
        if (S.deplacerElement(s, cle, i, vers)) {
          stockage.modifie();
          void majPanneaux().then(() => (organiser?.querySelectorAll<HTMLButtonElement>('.liste-organiser li')[vers]?.querySelector<HTMLButtonElement>(vers < i ? 'button:not([disabled])' : 'button:nth-of-type(2):not([disabled])') ?? organiser?.querySelector<HTMLButtonElement>('button'))?.focus());
        }
      };
      haut.addEventListener('click', () => deplacer(i - 1));
      bas.addEventListener('click', () => deplacer(i + 1));
      ret.addEventListener('click', () => retirer(e));
      const li = h('li', { draggable: 'true', 'data-i': i }, h('span', { class: 'poignee', 'aria-hidden': 'true', text: '⋮⋮' }), h('span', { class: 'genre', text: tr('web_genre_' + e.genre) }), nom, h('span', { class: 'outils-ligne' }, haut, bas, ret));
      li.addEventListener('dragstart', (ev) => ev.dataTransfer?.setData('text/plain', String(i)));
      li.addEventListener('dragover', (ev) => ev.preventDefault());
      li.addEventListener('drop', (ev) => {
        ev.preventDefault();
        const de = Number(ev.dataTransfer?.getData('text/plain'));
        if (Number.isInteger(de) && S.deplacerElement(s, cle, de, i)) {
          stockage.modifie();
          void majPanneaux();
        }
      });
      ol.append(li);
    });
    p.append(h('p', { class: 'aide', text: tr('web_organiser_aide') }), ol);
  };

  const liste: Parameters<typeof onglets>[0] = [
    { id: 'questions', libelle: tr('web_onglet_questions'), nombre: qs.length, remplir: (p) => listeQuestions((panneaux.questions = p)) },
    { id: 'animations', libelle: tr('web_onglet_animations'), nombre: anims.length, remplir: (p) => listeRessources((panneaux.animations = p), 'animation', anims) },
    { id: 'fiches', libelle: tr('web_onglet_fiches'), nombre: fiches.length, remplir: (p) => listeRessources((panneaux.fiches = p), 'fiche', fiches) },
    { id: 'tables', libelle: tr('web_onglet_tables'), nombre: tables.length, remplir: (p) => listeRessources((panneaux.tables = p), 'table', tables) },
    { id: 'images', libelle: tr('web_onglet_images'), nombre: imgs.length, remplir: (p) => listeRessources((panneaux.images = p), 'image', imgs) },
  ];
  if (perso) liste.push({ id: 'organiser', libelle: tr('web_onglet_organiser'), nombre: mm!.elements.length, remplir: (p) => remplirOrganiser(p) });
  const bloc = onglets(liste, onglet || 'questions', (id) => history.replaceState(history.state, '', `${base}/${id}`), tr('web_contenu_module'));

  if (!perso) {
    s.modules[cle] = { derniere_question: s.modules[cle]?.derniere_question ?? null, visite: S.maintenant() };
    stockage.modifie();
  }
  const el = h('div', { class: 'page page-module', 'data-module': cle, lang: langue() }, tete, bloc);
  return { el, titre: `${titre} — Coupole Web`, detruire() {} };
}

export { menuAjouter };
