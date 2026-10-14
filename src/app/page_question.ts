/**
 * Une question (instruction par les pairs) dans son module : menus « Adapter la question » (variantes), nouveau
 * tirage, énoncé et figure, choix A, B, C…, « Valider » (tentative enregistrée), « Montrer la réponse » (la bonne
 * réponse clignote en orange puis reste orange), indice, explication, éléments de réponse (questions ouvertes),
 * ressources liées « ★ » ouvertes en fenêtres, question précédente / suivante (W → G → C → D, en boucle), plein écran.
 * Clavier : A–H choisir, Entrée valider, R réponse, I indice, N nouveau tirage, F plein écran, ← → question précédente /
 * suivante.
 */
import * as S from '../contenu/sauvegarde';
import { instancier, variantes } from '../contenu/moteur_questions';
import { PAR_ID } from '../anim/registre';
import { langue, tr } from '../i18n/i18n';
import { ajouter, annoncer, h, icone, pageIntrouvable } from './dom';
import * as contenu from './contenu';
import { elementRessource, menuAjouter, texteQuestion, titresRessources } from './composants';
import { ordreQuestions, questionsDe } from './page_module';
import type { Page } from './page_apropos';
import * as stockage from './stockage';
import { remplacerAdresse } from './routeur';

function graineNeuve(): string {
  return Math.floor(Math.random() * 1e9).toString(36);
}

export async function pageQuestion(cle: string, qid: string, perso: boolean, params: URLSearchParams): Promise<Page> {
  await stockage.pret();
  const s = stockage.doc();
  const mm = perso ? S.trouverModule(s, cle) ?? null : null;
  const m = perso ? null : await contenu.module(cle);
  const q = await contenu.question(qid);
  if (!q || (perso && !mm) || (!perso && !m)) {
    return { el: pageIntrouvable(tr('web_question_inconnue'), tr), titre: `${tr('web_introuvable')} — Coupole Web`, detruire() {} };
  }
  const [mac, liens, titres] = await Promise.all([contenu.macros(), contenu.liees(qid), titresRessources()]);
  const base = perso ? `#/mm/${cle}` : `#/m/${cle}`;
  const nomModule = mm ? mm.nom : contenu.bi(m!.titre);
  const qs = ordreQuestions(await questionsDe(cle, mm));
  const ici = qs.findIndex((x) => x.id === qid);
  const info = qs[ici];
  const prec = qs.length ? qs[(ici - 1 + qs.length) % qs.length] : undefined;
  const suiv = qs.length ? qs[(ici + 1) % qs.length] : undefined;

  // ------------------------------------------------------------ état de la question
  const vs = variantes(q);
  let parametres: Record<string, string> = {};
  for (const prm of q.parametres ?? []) {
    const v = params.get('p_' + prm.id);
    if (v) parametres[prm.id] = v;
  }
  let graine = params.get('g') ?? '1';
  const aleatoire = !!(q.aleatoire?.length || q.melange || q.choix_conserves !== undefined);
  let inst: ReturnType<typeof instancier>;
  let choisis = new Set<string>();
  let valide = false;
  let reponse = false;
  let indice = false;

  const calculer = (): void => {
    try {
      inst = instancier(q, { graine, parametres, langue: langue(), macros: mac });
    } catch {
      parametres = {};
      inst = instancier(q, { graine: '1', langue: langue(), macros: mac });
    }
    parametres = { ...inst.parametres };
  };
  calculer();

  // ------------------------------------------------------------ squelette
  const zoneMenus = h('div', { class: 'menus-question' });
  const enonce = h('div', { class: 'enonce' });
  const zoneFigure = h('div', { class: 'figure-question' });
  const zoneChoix = h('div', { class: 'choix', role: 'group', 'aria-label': tr('web_choix') });
  const retour = h('div', { class: 'retour-question', role: 'status', 'aria-live': 'polite' });
  const zoneIndice = h('div', { class: 'indice', hidden: true });
  const zoneExplication = h('div', { class: 'explication', hidden: true });
  const bValider = h('button', { type: 'button', class: 'bouton principal', disabled: true }, icone('valider'), tr('web_valider'));
  const bReponse = h('button', { type: 'button', class: 'bouton', 'aria-pressed': 'false' }, icone('oeil'), h('span', { text: tr('web_montrer_reponse') }));
  const aIndice = !!(q.indice || q.figure_indice || JSON.stringify(q.figure ?? {}).includes('"afficher":"indice"'));
  const bIndice = aIndice ? h('button', { type: 'button', class: 'bouton', 'aria-pressed': 'false' }, icone('ampoule'), h('span', { text: tr('web_montrer_indice') })) : null;
  const bTirage = aleatoire ? h('button', { type: 'button', class: 'bouton discret' }, icone('reinit'), tr('web_nouveau_tirage')) : null;
  const bRevoir = h('button', { type: 'button', class: 'bouton discret', 'aria-pressed': String(!!s.questions[qid]?.a_revoir) }, icone('drapeau'), tr('web_a_revoir'));
  const carte = h('section', { class: 'carte-question', 'aria-labelledby': 'titre-question' });
  const bPlein = h('button', { type: 'button', class: 'bouton icone discret', 'aria-label': tr('web_presentation'), title: tr('web_presentation') }, icone('plein'));

  const ouverte = q.forme === 'ouverte';
  const multiple = (inst!.bonnes?.length ?? 0) > 1;

  const majChoix = (): void => {
    for (const b of zoneChoix.querySelectorAll<HTMLButtonElement>('button.choix-item')) {
      const id = b.dataset.id!;
      const sel = choisis.has(id);
      b.setAttribute(multiple ? 'aria-checked' : 'aria-checked', String(sel));
      b.classList.toggle('choisi', sel);
      const bonne = inst.bonnes.includes(id);
      b.classList.toggle('bonne', (reponse || valide) && bonne);
      b.classList.toggle('fausse', valide && sel && !bonne);
    }
    bValider.disabled = choisis.size === 0 || valide;
  };

  const dessinerFigure = async (): Promise<void> => {
    const svg = await contenu.figure(inst.figure, { reponse, indice, bonnes: inst.bonnes, libelle: q.figure?.alt ? contenu.bi(q.figure.alt) : `${tr('web_figure_question')} : ${contenu.bi(q.titre)}` });
    const cr = svg ? await contenu.creditsFigure(inst.figure) : null;
    zoneFigure.replaceChildren(...(svg ? [svg] : []), ...(cr ? [cr] : []));
    zoneFigure.hidden = !svg;
    if (indice && inst.figure_indice) {
      const fi = await contenu.figure(inst.figure_indice, { reponse, indice: true, bonnes: inst.bonnes, libelle: tr('web_figure_indice') });
      if (fi) zoneIndice.append(h('div', { class: 'figure-question' }, fi));
    }
  };

  const remplir = async (): Promise<void> => {
    // menus
    zoneMenus.replaceChildren();
    for (const prm of q.parametres ?? []) {
      const id = 'menu-' + prm.id;
      const sel = h('select', { id });
      const dispo = new Set(vs.filter((v) => Object.entries(parametres).every(([k, x]) => k === prm.id || v[k] === x || !(k in v))).map((v) => v[prm.id]));
      for (const o of prm.options) {
        if (!dispo.has(o.id)) continue;
        const op = h('option', { value: o.id, text: contenu.bi(o.libelle) });
        if (parametres[prm.id] === o.id) op.selected = true;
        sel.append(op);
      }
      sel.addEventListener('change', () => {
        parametres[prm.id] = sel.value;
        nouvelleInstance();
      });
      zoneMenus.append(h('div', { class: 'menu-question' }, h('label', { for: id, text: contenu.bi(prm.libelle) }), sel));
    }
    zoneMenus.hidden = !(q.parametres ?? []).length;
    // énoncé
    enonce.replaceChildren(...texteQuestion(inst.enonce));
    // choix
    zoneChoix.replaceChildren();
    zoneChoix.className = 'choix' + (q.disposition_choix ? ' choix-' + q.disposition_choix : '');
    zoneChoix.setAttribute('role', multiple ? 'group' : 'radiogroup');
    for (const c of inst.choix) {
      const b = h('button', { type: 'button', class: 'choix-item', role: multiple ? 'checkbox' : 'radio', 'aria-checked': 'false', 'data-id': c.id, 'data-lettre': c.lettre }, h('span', { class: 'lettre', 'aria-hidden': 'true', text: c.lettre }));
      b.setAttribute('aria-label', `${c.lettre}. ${c.texte ? c.texte.replace(/\*\*|\$/g, '') : tr('web_figure_choix')}`);
      const corps = h('span', { class: 'choix-corps' });
      if (c.texte) corps.append(h('span', {}, ...texteQuestion(c.texte)));
      if (c.figure) {
        const f = await contenu.figure(c.figure, { reponse, indice, bonnes: inst.bonnes, libelle: `${tr('web_figure_choix')} ${c.lettre}` });
        if (f) corps.append(h('span', { class: 'figure-choix' }, f));
      }
      b.append(corps);
      b.addEventListener('click', () => choisir(c.id));
      zoneChoix.append(b);
    }
    zoneChoix.hidden = inst.choix.length === 0;
    // indice et explication
    zoneIndice.replaceChildren(h('h3', { text: tr('web_indice') }), ...(inst.indice ? [h('p', {}, ...texteQuestion(inst.indice))] : []));
    zoneIndice.hidden = !indice;
    zoneExplication.replaceChildren();
    if (ouverte || inst.elements_de_reponse?.length) {
      zoneExplication.append(h('h3', { text: tr('web_elements_reponse') }), h('ul', {}, ...inst.elements_de_reponse.map((t: string) => h('li', {}, ...texteQuestion(t)))));
    }
    if (inst.explication) zoneExplication.append(h('h3', { text: tr('web_explication') }), h('p', {}, ...texteQuestion(inst.explication)));
    zoneExplication.hidden = !(reponse || valide);
    await dessinerFigure();
    majChoix();
    majAdresse();
  };

  const majAdresse = (): void => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(parametres)) p.set('p_' + k, v);
    if (graine !== '1') p.set('g', graine);
    const t = p.toString();
    remplacerAdresse(`${base}/q/${qid}${t ? '?' + t : ''}`);
  };

  const nouvelleInstance = (): void => {
    calculer();
    choisis = new Set();
    valide = false;
    reponse = false;
    bReponse.setAttribute('aria-pressed', 'false');
    bReponse.querySelector('span')!.textContent = tr('web_montrer_reponse');
    retour.textContent = '';
    void remplir();
  };

  const choisir = (id: string): void => {
    if (valide) {
      valide = false;
      retour.textContent = '';
      zoneExplication.hidden = !reponse;
    }
    if (multiple) {
      if (choisis.has(id)) choisis.delete(id);
      else choisis.add(id);
    } else choisis = new Set([id]);
    majChoix();
  };

  const valider = (): void => {
    if (!choisis.size || valide) return;
    const juste = choisis.size === inst.bonnes.length && inst.bonnes.every((b: string) => choisis.has(b));
    S.noterTentative(s, qid, { date: S.maintenant(), reponse: [...choisis].sort(), juste, parametres: { ...parametres }, graine });
    s.modules[cle] = { derniere_question: qid, visite: S.maintenant() };
    if (!perso) stockage.modifie();
    else stockage.modifie();
    valide = true;
    const lettres = inst.bonnes_lettres.join(', ');
    retour.className = 'retour-question ' + (juste ? 'juste' : 'faux');
    retour.replaceChildren(icone(juste ? 'valider' : 'fermer'), h('span', { text: juste ? tr('web_juste') : tr('web_faux', { lettres }) }));
    bRevoir.setAttribute('aria-pressed', String(!!s.questions[qid]?.a_revoir));
    zoneExplication.hidden = false;
    majChoix();
  };

  const basculerReponse = (): void => {
    reponse = !reponse;
    bReponse.setAttribute('aria-pressed', String(reponse));
    bReponse.querySelector('span')!.textContent = tr(reponse ? 'web_cacher_reponse' : 'web_montrer_reponse');
    if (reponse) {
      S.marquer(s, qid, 'reponse_vue');
      stockage.modifie();
      carte.classList.remove('clignote');
      void carte.offsetWidth;
      carte.classList.add('clignote');
      annoncer(inst.bonnes_lettres.length ? tr('web_reponse_annonce', { lettres: inst.bonnes_lettres.join(', ') }) : tr('web_reponse_ouverte'));
    }
    zoneExplication.hidden = !(reponse || valide);
    majChoix();
    void dessinerFigure().then(() => {
      // figures des choix : la bonne réponse mise en valeur
      if (inst.choix.some((c: { figure?: unknown }) => c.figure)) void remplir();
    });
  };

  const basculerIndice = (): void => {
    if (!bIndice) return;
    indice = !indice;
    bIndice.setAttribute('aria-pressed', String(indice));
    bIndice.querySelector('span')!.textContent = tr(indice ? 'web_cacher_indice' : 'web_montrer_indice');
    zoneIndice.hidden = !indice;
    if (indice) {
      S.marquer(s, qid, 'indice_vu');
      stockage.modifie();
    }
    void remplir();
  };

  bValider.addEventListener('click', valider);
  bReponse.addEventListener('click', basculerReponse);
  bIndice?.addEventListener('click', basculerIndice);
  bTirage?.addEventListener('click', () => {
    graine = graineNeuve();
    nouvelleInstance();
  });
  bRevoir.addEventListener('click', () => {
    const v = !s.questions[qid]?.a_revoir;
    S.marquer(s, qid, 'a_revoir', v);
    stockage.modifie();
    bRevoir.setAttribute('aria-pressed', String(v));
  });
  bPlein.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void carte.requestFullscreen?.().catch(() => {});
  });

  // ------------------------------------------------------------ navigation
  const lienQ = (x: typeof prec, sens: 'prec' | 'suiv'): HTMLElement =>
    x ? h('a', { class: 'bouton icone discret', href: `${base}/q/${x.id}`, 'aria-label': tr(sens === 'prec' ? 'web_question_prec' : 'web_question_suiv', { n: x.n, titre: x.titre }), title: tr(sens === 'prec' ? 'web_question_prec' : 'web_question_suiv', { n: x.n, titre: x.titre }), rel: sens === 'prec' ? 'prev' : 'next' }, icone(sens === 'prec' ? 'haut' : 'bas'))
      : h('span');
  const titreQ = contenu.bi(q.titre);
  const fil = h(
    'nav',
    { class: 'fil', 'aria-label': tr('web_fil') },
    h('a', { href: '#/' }, icone('retour'), tr('web_accueil')),
    h('span', { 'aria-hidden': 'true', text: '›' }),
    h('a', { href: base, text: nomModule }),
    h('span', { 'aria-hidden': 'true', text: '›' }),
    h('span', { class: 'fil-question' }, lienQ(prec, 'prec'), lienQ(suiv, 'suiv'), h('span', { class: 'numero-q', text: info?.n ?? '' })),
  );

  // ------------------------------------------------------------ ressources liées
  const cote = h('aside', { class: 'liees', 'aria-labelledby': 'titre-liees' });
  const remplirLiees = (): void => {
    const blocs: HTMLElement[] = [];
    const nomR = (g: string, id: string): string => (g === 'animations' ? (PAR_ID.has(id) ? tr('anim_nom_' + PAR_ID.get(id)!.cle) : id) : contenu.bi(titres[g === 'fiches' ? 'f' : g === 'tables' ? 't' : 'i'][id] ?? id));
    for (const g of ['animations', 'fiches', 'tables', 'images'] as const) {
      const l = (liens[g] ?? []).filter(([id]) => g !== 'animations' || PAR_ID.has(id));
      if (!l.length) continue;
      const genre = g.slice(0, -1) as 'animation' | 'fiche' | 'table' | 'image';
      blocs.push(h('section', {}, h('h3', { text: tr('web_onglet_' + g) }), h('ul', { class: 'liste-ressources' }, ...l.map(([id, lien]) => elementRessource(genre, id, nomR(g, id), { etoile: lien !== 'mots-clés', sousTitre: lien === 'mots-clés' ? tr('web_lien_mots_cles') : undefined })))));
    }
    if (q.animation?.role) blocs.push(h('p', { class: 'role-animation' }, ...texteQuestion(contenu.bi(q.animation.role))));
    cote.replaceChildren(h('h2', { id: 'titre-liees' }, h('span', { class: 'etoile', 'aria-hidden': 'true', text: '★ ' }), tr('web_ressources_liees')), ...(blocs.length ? blocs : [h('p', { class: 'vide', text: tr('web_aucune_liee') })]));
    if (!perso && m) cote.append(h('p', { class: 'plus-module' }, h('a', { href: `${base}/fiches`, text: tr('web_toutes_ressources_module') })));
  };
  remplirLiees();

  // ------------------------------------------------------------ assemblage
  const typeQ = info?.n?.[0] ?? { warmup: 'W', general: 'G', challenge: 'C', discussion: 'D' }[q.type as string] ?? 'G';
  ajouter(carte, [
    h('header', { class: 'tete-question' },
      h('span', { class: 'badge type-' + typeQ, text: tr('web_type_' + typeQ) }),
      q.statut_reponse === 'corrigee' || q.statut_reponse === 'etablie_par_nous' ? h('span', { class: 'badge statut', text: tr('web_statut_' + q.statut_reponse) }) : null,
      h('h1', { id: 'titre-question', text: titreQ }),
      h('span', { class: 'outils-question' }, menuAjouter({ genre: 'question', id: qid }, titreQ), bPlein)),
    zoneMenus,
    enonce,
    zoneFigure,
    zoneChoix,
    h('div', { class: 'actions-question' }, ouverte ? null : bValider, bReponse, bIndice, bTirage, bRevoir),
    retour,
    zoneIndice,
    zoneExplication,
    q.correction?.length ? h('details', { class: 'correction' }, h('summary', { text: tr('web_ce_qui_a_change') }), h('ul', {}, ...q.correction.map((c: contenu.Bi) => h('li', {}, ...texteQuestion(contenu.bi(c)))))) : null,
    h('p', { class: 'credit', text: tr('web_credit_question') }),
  ]);
  const el = h('div', { class: 'page page-question', 'data-question': qid }, fil, h('div', { class: 'question-grille' }, carte, cote));

  const clavier = (ev: KeyboardEvent): void => {
    const c = ev.target as HTMLElement | null;
    if (ev.altKey || ev.ctrlKey || ev.metaKey || (c && /^(INPUT|TEXTAREA|SELECT)$/.test(c.tagName)) || document.querySelector('dialog[open]')) return;
    const k = ev.key.toLowerCase();
    const lettre = inst.choix.find((x: { lettre: string }) => x.lettre.toLowerCase() === k && k.length === 1 && k >= 'a' && k <= 'h');
    if (lettre && !(c?.closest('.fenetre'))) {
      ev.preventDefault();
      choisir(lettre.id);
      zoneChoix.querySelector<HTMLElement>(`[data-id="${lettre.id}"]`)?.focus();
    } else if (k === 'enter' && c?.classList.contains('choix-item')) {
      ev.preventDefault();
      valider();
    } else if (k === 'r' && !c?.closest('.fenetre')) basculerReponse();
    else if (k === 'i' && !c?.closest('.fenetre')) basculerIndice();
    else if (k === 'n' && bTirage && !c?.closest('.fenetre')) bTirage.click();
    else if (k === 'f' && !c?.closest('.fenetre')) bPlein.click();
    else if (ev.key === 'ArrowRight' && suiv && !c?.closest('.fenetre, .menu, [role="radiogroup"], [role="group"]')) location.hash = `${base}/q/${suiv.id}`;
    else if (ev.key === 'ArrowLeft' && prec && !c?.closest('.fenetre, .menu, [role="radiogroup"], [role="group"]')) location.hash = `${base}/q/${prec.id}`;
  };
  document.addEventListener('keydown', clavier);

  s.modules[cle] = { derniere_question: qid, visite: S.maintenant() };
  stockage.modifie();
  await remplir();
  return {
    el,
    titre: `${info?.n ?? ''} ${titreQ} — ${nomModule} — Coupole Web`.trim(),
    focus: carte.querySelector('h1') as HTMLElement,
    detruire() {
      document.removeEventListener('keydown', clavier);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    },
  };
}
