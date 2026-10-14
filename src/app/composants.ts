/**
 * Composants communs des pages de modules : élément de ressource (aperçu au survol, ouverture en fenêtre, menu
 * « Ajouter à… »), boîte de confirmation, onglets accessibles, texte riche des questions.
 */
import * as S from '../contenu/sauvegarde';
import { PAR_ID } from '../anim/registre';
import { tr } from '../i18n/i18n';
import { ajouter, annoncer, h, icone } from './dom';
import * as contenu from './contenu';
import * as fenetres from './fenetres';
import * as stockage from './stockage';
import { enrichir } from './texte_riche';

export type GenreR = 'question' | 'animation' | 'fiche' | 'table' | 'image';

// ------------------------------------------------------------------ titres
let titres: Promise<Record<'f' | 't' | 'i', Record<string, contenu.Bi>>> | null = null;
export function titresRessources(): Promise<Record<'f' | 't' | 'i', Record<string, contenu.Bi>>> {
  titres ??= contenu.charger('titres.json');
  return titres;
}

export async function titreDe(genre: GenreR, id: string): Promise<string> {
  if (genre === 'animation') {
    const e = PAR_ID.get(id);
    return e ? tr('anim_nom_' + e.cle) : id;
  }
  if (genre === 'question') {
    for (const m of await contenu.modules()) {
      const q = m.questions.find((x) => x.id === id);
      if (q?.t) return contenu.bi(q.t);
    }
    return id;
  }
  const t = await titresRessources();
  return contenu.bi(t[genre === 'fiche' ? 'f' : genre === 'table' ? 't' : 'i'][id] ?? id);
}

export function libelleGenre(g: GenreR): string {
  return tr('web_genre_' + g);
}

// ------------------------------------------------------------------ texte riche des questions
/** Énoncé, choix, explication : `**partie variable**` (mise en valeur), `$formule$`, retours à la ligne. */
export function texteQuestion(s: string | null | undefined): (string | Node)[] {
  if (!s) return [];
  const out: (string | Node)[] = [];
  s.split('\n').forEach((ligne, i) => {
    if (i) out.push(h('br'));
    for (const m of ligne.split(/(\*\*.+?\*\*)/).filter(Boolean)) {
      if (m.startsWith('**') && m.endsWith('**') && m.length > 4) out.push(h('mark', { class: 'valeur' }, ...enrichir(m.slice(2, -2))));
      else out.push(...enrichir(m));
    }
  });
  return out;
}

// ------------------------------------------------------------------ ouvrir une ressource
export function ouvrirRessource(genre: 'fiche' | 'table' | 'image', id: string, titre: string): void {
  fenetres.ouvrir(`${genre}:${id}`, titre, async () => (await contenu.contenuRessource(genre, id)).el, libelleGenre(genre));
}

// ------------------------------------------------------------------ aperçu au survol
let bulle: HTMLElement | null = null;
let minuteurBulle = 0;
let cibleBulle: HTMLElement | null = null;

function cacherBulle(): void {
  clearTimeout(minuteurBulle);
  cibleBulle = null;
  if (bulle) {
    bulle.classList.remove('visible');
    const b = bulle;
    setTimeout(() => {
      if (!b.classList.contains('visible')) b.hidden = true;
    }, 200);
  }
}

function montrerBulle(cible: HTMLElement, genre: GenreR, id: string): void {
  if (genre === 'question' || genre === 'animation') return;
  clearTimeout(minuteurBulle);
  cibleBulle = cible;
  minuteurBulle = window.setTimeout(async () => {
    const c = await contenu.apercu(genre, id);
    if (!c || cibleBulle !== cible || !document.contains(cible)) return;
    if (!bulle) {
      bulle = h('div', { class: 'bulle-apercu', role: 'tooltip', id: 'bulle-apercu', hidden: true });
      document.body.append(bulle);
    }
    bulle.replaceChildren(c);
    bulle.hidden = false;
    const r = cible.getBoundingClientRect();
    const l = 196;
    const x = Math.min(window.innerWidth - l - 8, Math.max(8, r.left));
    const y = r.bottom + 160 < window.innerHeight ? r.bottom + 6 : Math.max(8, r.top - 162);
    bulle.style.left = x + 'px';
    bulle.style.top = y + 'px';
    requestAnimationFrame(() => bulle?.classList.add('visible'));
  }, 400);
}

// ------------------------------------------------------------------ élément de ressource
export interface OptionsElement {
  etoile?: boolean;
  sousTitre?: string;
  lien?: string; // adresse (questions, animations)
  retirer?: () => void; // dans un module personnel
}

export function elementRessource(genre: GenreR, id: string, titre: string, o: OptionsElement = {}): HTMLElement {
  const li = h('li', { class: 'ressource', 'data-genre': genre, 'data-id': id });
  const contenuLien = [o.etoile ? h('span', { class: 'etoile', 'aria-label': tr('web_liee'), title: tr('web_liee'), text: '★' }) : null, h('span', { class: 'ressource-titre', text: titre }), o.sousTitre ? h('span', { class: 'ressource-sous', text: o.sousTitre }) : null];
  let action: HTMLElement;
  if (genre === 'animation' || genre === 'question') action = h('a', { class: 'ressource-lien', href: o.lien ?? (genre === 'animation' ? `#/a/${encodeURIComponent(id)}` : '#/') }, ...contenuLien);
  else {
    action = h('button', { type: 'button', class: 'ressource-lien', 'aria-haspopup': 'dialog' }, ...contenuLien);
    action.addEventListener('click', () => {
      cacherBulle();
      ouvrirRessource(genre, id, titre);
    });
    action.setAttribute('aria-describedby', 'bulle-apercu');
  }
  action.addEventListener('pointerenter', (ev) => {
    if ((ev as PointerEvent).pointerType === 'mouse') montrerBulle(action, genre, id);
  });
  action.addEventListener('pointerleave', cacherBulle);
  action.addEventListener('pointerdown', cacherBulle);
  action.addEventListener('focus', () => montrerBulle(action, genre, id));
  action.addEventListener('blur', cacherBulle);
  li.append(action);
  if (o.retirer) {
    const b = h('button', { type: 'button', class: 'bouton icone discret petit', 'aria-label': tr('web_retirer_de', { titre }), title: tr('web_retirer') }, icone('fermer'));
    b.addEventListener('click', o.retirer);
    li.append(b);
  } else li.append(menuAjouter({ genre, id }, titre));
  return li;
}

// ------------------------------------------------------------------ menu « Ajouter à… »
export function menuAjouter(e: S.Element, titre: string): HTMLElement {
  const bouton = h('button', { type: 'button', class: 'bouton icone discret petit', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': tr('web_ajouter_a', { titre }), title: tr('web_ajouter_mes_modules') }, icone('plus'));
  const boite = h('span', { class: 'menu-boite' }, bouton);
  let menu: HTMLElement | null = null;
  const fermerMenu = (focus = false): void => {
    menu?.remove();
    menu = null;
    bouton.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', dehors, true);
    if (focus) bouton.focus();
  };
  const dehors = (ev: Event): void => {
    if (!boite.contains(ev.target as Node)) fermerMenu();
  };
  bouton.addEventListener('click', () => {
    if (menu) return fermerMenu();
    const s = stockage.doc();
    menu = h('div', { class: 'menu', role: 'menu', 'aria-label': tr('web_ajouter_mes_modules') });
    const items: HTMLElement[] = [];
    for (const m of s.mes_modules) {
      const dedans = m.elements.some((x) => x.genre === e.genre && x.id === e.id);
      const it = h('button', { type: 'button', role: 'menuitemcheckbox', 'aria-checked': String(dedans), class: 'menu-item', text: m.nom });
      it.addEventListener('click', () => {
        if (dedans) S.retirerElement(s, m.id, e);
        else S.ajouterElement(s, m.id, e);
        stockage.modifie();
        annoncer(tr(dedans ? 'web_retire_de' : 'web_ajoute_a', { titre, module: m.nom }));
        fermerMenu(true);
      });
      items.push(it);
    }
    const nouveau = h('button', { type: 'button', role: 'menuitem', class: 'menu-item nouveau', text: tr('web_nouveau_module_avec') });
    nouveau.addEventListener('click', () => {
      const m = S.creerModule(s, S.nomLibre(s, tr('web_nouveau_module'), true), [e]);
      stockage.modifie();
      annoncer(tr('web_ajoute_a', { titre, module: m.nom }));
      fermerMenu(true);
    });
    items.push(nouveau);
    menu.append(...items);
    menu.addEventListener('keydown', (ev) => {
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        items[(i + (ev.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
      } else if (ev.key === 'Escape') {
        ev.stopPropagation();
        fermerMenu(true);
      } else if (ev.key === 'Tab') fermerMenu();
    });
    boite.append(menu);
    bouton.setAttribute('aria-expanded', 'true');
    items[0]?.focus();
    document.addEventListener('pointerdown', dehors, true);
  });
  return boite;
}

// ------------------------------------------------------------------ confirmation
export function confirmer(titre: string, texte: string, libelleOk: string, option?: { libelle: string; coche: boolean }): Promise<{ ok: boolean; option: boolean }> {
  return new Promise((fin) => {
    const d = h('dialog', { class: 'dialogue', 'aria-labelledby': 'dlg-titre' });
    const ok = h('button', { type: 'button', class: 'bouton danger', text: libelleOk });
    const annuler = h('button', { type: 'button', class: 'bouton', text: tr('web_annuler') });
    const cas = option ? h('input', { type: 'checkbox', id: 'dlg-option' }) : null;
    if (cas) cas.checked = option!.coche;
    ajouter(d, [
      h('h2', { id: 'dlg-titre', text: titre }),
      h('p', { text: texte }),
      cas ? h('p', { class: 'case' }, cas, h('label', { for: 'dlg-option', text: option!.libelle })) : null,
      h('div', { class: 'dialogue-boutons' }, annuler, ok),
    ]);
    document.body.append(d);
    const terminer = (v: boolean): void => {
      d.close();
      d.remove();
      fin({ ok: v, option: !!cas?.checked });
    };
    ok.addEventListener('click', () => terminer(true));
    annuler.addEventListener('click', () => terminer(false));
    d.addEventListener('cancel', (ev) => {
      ev.preventDefault();
      terminer(false);
    });
    try {
      d.showModal();
    } catch {
      d.setAttribute('open', '');
    }
    annuler.focus();
  });
}

export function demanderTexte(titre: string, valeur: string, libelleOk: string): Promise<string | null> {
  return new Promise((fin) => {
    const d = h('dialog', { class: 'dialogue', 'aria-labelledby': 'dlg-titre' });
    const champ = h('input', { type: 'text', id: 'dlg-champ', maxlength: 120, autocomplete: 'off' });
    champ.value = valeur;
    const ok = h('button', { type: 'submit', class: 'bouton principal', text: libelleOk });
    const annuler = h('button', { type: 'button', class: 'bouton', text: tr('web_annuler') });
    const form = h('form', { method: 'dialog' }, h('h2', { id: 'dlg-titre', text: titre }), h('p', {}, h('label', { for: 'dlg-champ', class: 'visuellement-cache', text: titre }), champ), h('div', { class: 'dialogue-boutons' }, annuler, ok));
    d.append(form);
    document.body.append(d);
    const terminer = (v: string | null): void => {
      d.close();
      d.remove();
      fin(v);
    };
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const v = champ.value.trim();
      terminer(v ? v : null);
    });
    annuler.addEventListener('click', () => terminer(null));
    d.addEventListener('cancel', (ev) => {
      ev.preventDefault();
      terminer(null);
    });
    try {
      d.showModal();
    } catch {
      d.setAttribute('open', '');
    }
    champ.select();
  });
}

// ------------------------------------------------------------------ onglets
export interface Onglet {
  id: string;
  libelle: string;
  nombre?: number;
  etoile?: boolean;
  remplir: (panneau: HTMLElement) => void | Promise<void>;
}

/** Onglets (motif ARIA « tabs ») : flèches, Début, Fin ; panneau rempli à la première ouverture. */
export function onglets(liste: Onglet[], actif: string, quandChange: (id: string) => void, nom: string): HTMLElement {
  const barre = h('div', { class: 'onglets', role: 'tablist', 'aria-label': nom });
  const panneaux = h('div', { class: 'panneaux' });
  const boutons: HTMLButtonElement[] = [];
  const remplis = new Set<string>();
  const activer = (id: string, focus = false): void => {
    for (const [i, o] of liste.entries()) {
      const b = boutons[i]!;
      const p = panneaux.children[i] as HTMLElement;
      const sel = o.id === id;
      b.setAttribute('aria-selected', String(sel));
      b.tabIndex = sel ? 0 : -1;
      p.hidden = !sel;
      if (sel) {
        if (focus) b.focus();
        if (!remplis.has(o.id)) {
          remplis.add(o.id);
          void o.remplir(p);
        }
      }
    }
  };
  for (const o of liste) {
    const b = h('button', { type: 'button', role: 'tab', id: `onglet-${o.id}`, 'aria-controls': `panneau-${o.id}`, class: 'onglet' },
      o.etoile ? h('span', { class: 'etoile', 'aria-hidden': 'true', text: '★ ' }) : null, o.libelle,
      o.nombre !== undefined ? h('span', { class: 'nb', text: String(o.nombre) }) : null);
    if (o.etoile) b.setAttribute('aria-description', tr('web_onglet_liees'));
    b.addEventListener('click', () => {
      activer(o.id);
      quandChange(o.id);
    });
    b.addEventListener('keydown', (ev) => {
      const i = liste.indexOf(o);
      let j = -1;
      if (ev.key === 'ArrowRight') j = (i + 1) % liste.length;
      else if (ev.key === 'ArrowLeft') j = (i - 1 + liste.length) % liste.length;
      else if (ev.key === 'Home') j = 0;
      else if (ev.key === 'End') j = liste.length - 1;
      if (j < 0) return;
      ev.preventDefault();
      activer(liste[j]!.id, true);
      quandChange(liste[j]!.id);
    });
    boutons.push(b);
    barre.append(b);
    panneaux.append(h('div', { role: 'tabpanel', id: `panneau-${o.id}`, 'aria-labelledby': `onglet-${o.id}`, class: 'panneau-onglet', tabindex: 0, hidden: true }));
  }
  activer(liste.some((o) => o.id === actif) ? actif : liste[0]!.id);
  return h('div', { class: 'bloc-onglets' }, barre, panneaux);
}

// ------------------------------------------------------------------ barre de progression
export function barreScore(b: S.Bilan, compacte = false): HTMLElement {
  const pc = b.total ? Math.round((100 * b.reussies) / b.total) : 0;
  const barre = h('div', { class: 'barre-score', role: 'progressbar', 'aria-label': tr('web_progression'), 'aria-valuemin': 0, 'aria-valuemax': b.total, 'aria-valuenow': b.reussies, 'aria-valuetext': tr('web_progres_texte', { r: b.reussies, n: b.total }) });
  const ok = h('span', { class: 'ok' });
  ok.style.width = pc + '%';
  const ko = h('span', { class: 'ko' });
  ko.style.width = (b.total ? Math.round((100 * b.ratees) / b.total) : 0) + '%';
  barre.append(ok, ko);
  if (compacte) return barre;
  return h('div', { class: 'score' }, barre, h('span', { class: 'score-texte', text: tr('web_progres_texte', { r: b.reussies, n: b.total }) }));
}
