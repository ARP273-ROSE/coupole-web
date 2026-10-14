/**
 * Contrôles HTML des réglages d'une animation (curseur + champ numérique, interrupteur, liste, bouton, saisie),
 * construits à partir des modèles de src/anim/base.ts et synchronisés dans les deux sens.  Accessibles : libellés
 * associés, aides reliées par aria-describedby, état désactivé, clavier natif.
 */
import { enrichir } from './texte_riche';
import { Bouton, Choix, Coche, type Controle, Etiquette, Reglage, Saisie } from '../anim/base';
import { langue } from '../i18n/i18n';
import { fixe } from '../noyau/py';
import { h } from './dom';

let compteur = 0;
function ident(prefixe: string): string {
  compteur += 1;
  return `${prefixe}-${compteur}`;
}

/** Valeur du champ numérique telle qu'affichée (virgule en français, pas d'espace de milliers). */
export function texteNombre(v: number, dec: number): string {
  const s = fixe(v, dec);
  return langue() === 'fr' ? s.replace('.', ',') : s;
}

/** Lecture tolérante d'un nombre saisi (virgule ou point, espaces, signe moins typographique). */
export function lireNombre(s: string): number {
  const t = s.replace(/[\s  ]/g, '').replace('−', '-').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return NaN;
  return Number(t);
}

export interface Vue {
  el: HTMLElement;
  detacher: () => void;
}

export function vueReglage(r: Reglage): Vue {
  const id = ident('r');
  const idAide = id + '-aide';
  const curseur = h('input', {
    type: 'range', id, min: 0, max: Reglage.PAS, step: 1, 'aria-describedby': r.aide ? idAide : null,
  });
  const champ = h('input', {
    type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', 'aria-label': r.texte + (r.unite ? ` (${r.unite})` : ''),
    'aria-describedby': r.aide ? idAide : null,
  });
  const boite = h('span', { class: 'champ-nombre' }, champ, r.unite ? h('span', { class: 'unite', 'aria-hidden': 'true', text: r.unite }) : null);
  const el = h(
    'div',
    { class: 'reglage' },
    h('div', { class: 'ligne' }, h('label', { for: id }, ...enrichir(r.texte)), boite),
    curseur,
    r.aide ? h('span', { class: 'visuellement-cache', id: idAide, text: r.aide }) : null,
  );
  if (r.aide) el.title = r.aide;
  let saisieEnCours = false;
  const maj = (): void => {
    const pos = r.pos(r.value());
    curseur.value = String(pos);
    curseur.style.setProperty('--rempli', `${(pos / Reglage.PAS) * 100}%`);
    curseur.setAttribute('aria-valuetext', `${texteNombre(r.valeurChamp(), r.dec)}${r.unite ? ' ' + r.unite : ''}`);
    if (!saisieEnCours) champ.value = texteNombre(r.valeurChamp(), r.dec);
    curseur.disabled = !r.actif;
    champ.disabled = !r.actif;
    el.dataset.inactif = String(!r.actif);
    el.hidden = !r.visible;
  };
  curseur.addEventListener('input', () => r.depuisCurseur(Number(curseur.value)));
  const valider = (): void => {
    saisieEnCours = false;
    r.depuisChamp(lireNombre(champ.value));
    maj();
  };
  champ.addEventListener('focus', () => {
    saisieEnCours = true;
    champ.select();
  });
  champ.addEventListener('blur', valider);
  champ.addEventListener('change', valider);
  champ.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      valider();
      saisieEnCours = true;
    } else if (e.key === 'Escape') {
      saisieEnCours = false;
      maj();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const pas = (e.shiftKey ? 10 : 1) * 10 ** -r.dec;
      r.depuisChamp(r.valeurChamp() + (e.key === 'ArrowUp' ? pas : -pas));
      saisieEnCours = false;
      maj();
      saisieEnCours = true;
    }
  });
  maj();
  return { el, detacher: r.observer(maj) };
}

export function vueCoche(c: Coche): Vue {
  const id = ident('c');
  const idAide = id + '-aide';
  const boite = h('input', { type: 'checkbox', id, role: 'switch', 'aria-describedby': c.aide ? idAide : null });
  const el = h(
    'label',
    { class: 'interrupteur', for: id },
    h('span', {}, ...enrichir(c.texte)),
    boite,
    c.aide ? h('span', { class: 'visuellement-cache', id: idAide, text: c.aide }) : null,
  );
  if (c.aide) el.title = c.aide;
  const maj = (): void => {
    boite.checked = c.isChecked();
    boite.disabled = !c.actif;
    el.hidden = !c.visible;
  };
  boite.addEventListener('change', () => c.setChecked(boite.checked));
  maj();
  return { el, detacher: c.observer(maj) };
}

export function vueChoix(c: Choix): Vue {
  const id = ident('l');
  const idAide = id + '-aide';
  const sel = h('select', { id, 'aria-describedby': c.aide ? idAide : null });
  const el = h(
    'div',
    { class: 'reglage liste' },
    c.texte ? h('label', { for: id }, ...enrichir(c.texte)) : null,
    sel,
    c.aide ? h('span', { class: 'visuellement-cache', id: idAide, text: c.aide }) : null,
  );
  if (!c.texte) sel.setAttribute('aria-label', c.aide || c.cle);
  if (c.aide) el.title = c.aide;
  let signature = '';
  const maj = (): void => {
    const sig = c.options.map((o) => `${o.texte}\u0000${o.actif}`).join('\u0001');
    if (sig !== signature) {
      signature = sig;
      sel.replaceChildren(...c.options.map((o, i) => h('option', { value: i, text: o.texte, disabled: !o.actif })));
    }
    sel.value = String(c.currentIndex());
    sel.disabled = !c.actif;
    el.hidden = !c.visible;
  };
  sel.addEventListener('change', () => c.choisirParUtilisateur(Number(sel.value)));
  maj();
  return { el, detacher: c.observer(maj) };
}

export function vueBouton(b: Bouton): Vue {
  const el = h('button', { type: 'button', class: 'bouton', text: b.texte });
  if (b.aide) el.title = b.aide;
  const maj = (): void => {
    el.textContent = b.texte;
    el.disabled = !b.actif;
    el.hidden = !b.visible;
  };
  el.addEventListener('click', () => b.click());
  maj();
  return { el, detacher: b.observer(maj) };
}

export function vueSaisie(s: Saisie): Vue {
  const id = ident('s');
  const champ = h('input', { type: 'text', id, inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false' });
  const el = h('div', { class: 'reglage saisie' }, h('label', { for: id, text: s.texte }), champ);
  if (s.aide) el.title = s.aide;
  const maj = (): void => {
    if (document.activeElement !== champ) champ.value = s.text();
    champ.disabled = !s.actif;
    el.hidden = !s.visible;
  };
  champ.addEventListener('input', () => s.editer(champ.value));
  champ.addEventListener('blur', maj);
  maj();
  return { el, detacher: s.observer(maj) };
}

export function vueEtiquette(e: Etiquette): Vue {
  const el = h('p', { class: 'aide', text: e.texte });
  const maj = (): void => {
    el.textContent = e.texte;
    el.hidden = !e.visible;
  };
  maj();
  return { el, detacher: e.observer(maj) };
}

export function vueControle(c: Controle): Vue {
  if (c instanceof Reglage) return vueReglage(c);
  if (c instanceof Coche) return vueCoche(c);
  if (c instanceof Choix) return vueChoix(c);
  if (c instanceof Bouton) return vueBouton(c);
  if (c instanceof Saisie) return vueSaisie(c);
  return vueEtiquette(c as Etiquette);
}
