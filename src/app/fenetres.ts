/**
 * Fenêtres de ressources (fiche, table, image) : panneaux flottants non modaux, déplaçables par leur barre de titre
 * (souris, doigt, et clavier : flèches quand la barre a le focus), redimensionnables (le contenu suit), une seule
 * fenêtre par ressource (rouvrir = premier plan), plusieurs à la fois (question + fiche + table côte à côte).
 * Sur un écran étroit, la fenêtre occupe le bas de l'écran.  Échap ferme la fenêtre qui a le focus.
 */
import { tr } from '../i18n/i18n';
import { h, icone } from './dom';

interface Fen {
  el: HTMLElement;
  cle: string;
  retour: HTMLElement | null;
}

const ouvertes = new Map<string, Fen>();
let z = 50;
let decalage = 0;

function calque(): HTMLElement {
  let c = document.getElementById('fenetres');
  if (!c) {
    c = h('div', { id: 'fenetres', class: 'fenetres' });
    document.body.append(c);
  }
  return c;
}

function premierPlan(f: Fen): void {
  f.el.style.zIndex = String(++z);
  for (const x of ouvertes.values()) x.el.classList.toggle('active', x === f);
}

export function fermer(cle: string): void {
  const f = ouvertes.get(cle);
  if (!f) return;
  ouvertes.delete(cle);
  f.el.remove();
  if (f.retour && document.contains(f.retour)) f.retour.focus();
}

export function fermerTout(): void {
  for (const k of [...ouvertes.keys()]) fermer(k);
}

export function nombreOuvertes(): number {
  return ouvertes.size;
}

/**
 * Ouvre (ou ramène au premier plan) la fenêtre `cle`.  `contenu` est appelé une seule fois, à la création.
 */
export function ouvrir(cle: string, titre: string, contenu: () => Promise<HTMLElement>, genre = '', extra: HTMLElement | null = null): HTMLElement {
  const deja = ouvertes.get(cle);
  if (deja) {
    premierPlan(deja);
    deja.el.querySelector<HTMLElement>('.fenetre-barre')?.focus();
    return deja.el;
  }
  const idTitre = 'fen-' + cle.replace(/[^a-z0-9]/gi, '-');
  const bFermer = h('button', { type: 'button', class: 'bouton icone discret', 'aria-label': tr('web_fermer_fenetre', { titre }), title: tr('web_fermer') }, icone('fermer'));
  const barre = h('div', { class: 'fenetre-barre', tabindex: 0, 'aria-label': tr('web_deplacer_fenetre') }, h('span', { class: 'fenetre-genre', text: genre }), h('h2', { id: idTitre, text: titre }), extra, bFermer);
  const corps = h('div', { class: 'fenetre-corps' }, h('p', { class: 'chargement', text: tr('web_chargement') }));
  const el = h('section', { class: 'fenetre', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': idTitre, 'data-cle': cle }, barre, corps);
  const f: Fen = { el, cle, retour: document.activeElement instanceof HTMLElement ? document.activeElement : null };
  ouvertes.set(cle, f);
  calque().append(el);

  // position de départ : en cascade, dans l'écran
  const large = window.innerWidth >= 720;
  if (large) {
    const l = Math.min(560, window.innerWidth - 32);
    const hh = Math.min(window.innerHeight - 120, 640);
    const x = Math.max(16, window.innerWidth - l - 24 - (decalage % 6) * 28);
    const y = 72 + (decalage % 6) * 28;
    decalage++;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = l + 'px';
    el.style.height = hh + 'px';
  } else el.classList.add('fenetre-bas');
  premierPlan(f);

  bFermer.addEventListener('click', () => fermer(cle));
  el.addEventListener('pointerdown', () => premierPlan(f), true);
  el.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      fermer(cle);
    }
  });

  // déplacer : barre de titre (pointeur) ou flèches quand la barre a le focus
  let depart: { x: number; y: number; l: number; t: number } | null = null;
  barre.addEventListener('pointerdown', (ev) => {
    if ((ev.target as HTMLElement).closest('button') || el.classList.contains('fenetre-bas')) return;
    depart = { x: ev.clientX, y: ev.clientY, l: el.offsetLeft, t: el.offsetTop };
    barre.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });
  barre.addEventListener('pointermove', (ev) => {
    if (!depart) return;
    placer(depart.l + ev.clientX - depart.x, depart.t + ev.clientY - depart.y);
  });
  const fin = (): void => {
    depart = null;
  };
  barre.addEventListener('pointerup', fin);
  barre.addEventListener('pointercancel', fin);
  barre.addEventListener('keydown', (ev) => {
    const pas = ev.shiftKey ? 40 : 10;
    const d: Record<string, [number, number]> = { ArrowLeft: [-pas, 0], ArrowRight: [pas, 0], ArrowUp: [0, -pas], ArrowDown: [0, pas] };
    const v = d[ev.key];
    if (!v || el.classList.contains('fenetre-bas')) return;
    ev.preventDefault();
    placer(el.offsetLeft + v[0], el.offsetTop + v[1]);
  });
  const placer = (x: number, y: number): void => {
    const maxX = window.innerWidth - 80;
    const maxY = window.innerHeight - 48;
    el.style.left = Math.max(-el.offsetWidth + 80, Math.min(maxX, x)) + 'px';
    el.style.top = Math.max(56, Math.min(maxY, y)) + 'px';
  };

  void contenu()
    .then((c) => corps.replaceChildren(c))
    .catch(() => corps.replaceChildren(h('p', { class: 'erreur', role: 'alert', text: tr('web_ressource_indisponible') })));
  barre.focus({ preventScroll: true });
  return el;
}

if (typeof window !== 'undefined') {
  // une page qui change ferme les fenêtres qui n'ont plus de sens ? Non : elles restent (question suivante +
  // fiche ouverte) ; seule une fenêtre sortie de l'écran après un redimensionnement est ramenée.
  window.addEventListener('resize', () => {
    for (const f of ouvertes.values()) {
      if (window.innerWidth < 720) f.el.classList.add('fenetre-bas');
      else f.el.classList.remove('fenetre-bas');
      if (f.el.offsetLeft > window.innerWidth - 80) f.el.style.left = Math.max(16, window.innerWidth - f.el.offsetWidth - 16) + 'px';
    }
  });
}
