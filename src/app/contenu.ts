/**
 * Accès aux contenus (public/contenu/, chargés à la demande et gardés en mémoire ; le service worker les garde pour
 * le hors-ligne) et mise en page DOM des ressources : fiches (HTML + MathML), tables, images (crédit et licence),
 * schémas (SVG en ligne dessiné par contenu/schema_svg.ts), figures des questions (contenu/figure_svg.ts).
 */
import { mathml } from '../noyau/formule';
import { figureSvg, aDesCotes, type Cotes, type Jetons } from '../contenu/figure_svg';
import { mesureReelle, rendre as rendreSchema } from '../contenu/schema_svg';
import { langue, tr } from '../i18n/i18n';
import { h } from './dom';
import { enrichir } from './texte_riche';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type J = any;
export type Bi = { fr: string; en: string };
export type GenreRessource = 'fiche' | 'table' | 'image' | 'animation' | 'question';

export const BASE = 'contenu/';
const cache = new Map<string, Promise<J>>();

export function charger(chemin: string): Promise<J> {
  let p = cache.get(chemin);
  if (!p) {
    p = fetch(BASE + chemin, { credentials: 'same-origin' }).then((r) => {
      if (!r.ok) throw new Error(`${chemin} : ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(chemin));
    cache.set(chemin, p);
  }
  return p;
}

export function bi(v: unknown): string {
  if (v && typeof v === 'object') return String((v as Bi)[langue()] ?? (v as Bi).en ?? '');
  return String(v ?? '');
}

export function theme(): 'clair' | 'sombre' {
  return document.documentElement.dataset.theme === 'clair' ? 'clair' : 'sombre';
}

// ------------------------------------------------------------------ données
export interface ModuleQ {
  id: string;
  n: string;
  f: string;
  ok: boolean;
  t: Bi | null;
}
export interface Module {
  cle: string;
  titre: Bi;
  original: string;
  affiche: boolean;
  bonus: boolean;
  questions: ModuleQ[];
  animations: string[];
  fiches: string[];
  tables: string[];
  images: string[];
}

export async function modules(): Promise<Module[]> {
  return (await charger('modules.json')).modules as Module[];
}

export async function module(cle: string): Promise<Module | undefined> {
  return (await modules()).find((m) => m.cle === cle);
}

export async function question(id: string): Promise<J | undefined> {
  const ms = await modules();
  for (const m of ms) {
    const e = m.questions.find((q) => q.id === id && q.ok);
    if (e) return ((await charger(`q/${e.f}.json`)).questions as J[]).find((q) => q.id === id);
  }
  return undefined;
}

export async function macros(): Promise<J> {
  return (await charger('q/macros.json')).macros;
}

export async function jetons(): Promise<Jetons> {
  return (await charger('q/couleurs.json')).jetons as Jetons;
}

export async function images(): Promise<Map<string, J>> {
  const l = (await charger('images/images.json')).images as J[];
  return new Map(l.map((i) => [i.id, i]));
}

export async function liees(qid: string): Promise<Record<string, [string, string][]>> {
  return (await charger('relevant.json')).questions[qid] ?? {};
}

export async function ressource(genre: 'fiche' | 'table', id: string): Promise<J> {
  return charger(`${genre}s/${id}.json`);
}

let cotesP: Promise<Cotes> | null = null;
export function cotes(): Promise<Cotes> {
  cotesP ??= import('../donnees/genere/cotes.json').then((m) => ((m.default ?? m) as unknown as { polygones: Cotes }).polygones);
  return cotesP;
}

// ------------------------------------------------------------------ HTML de confiance (texte + MathML des ressources)
const MATHML = 'http://www.w3.org/1998/Math/MathML';
const BALISES_HTML = new Set(['b', 'i', 'em', 'strong', 'sub', 'sup', 'br', 'span', 'small', 'code']);
const BALISES_MATH = new Set(['math', 'mrow', 'mi', 'mn', 'mo', 'mfrac', 'msup', 'msub', 'msubsup', 'msqrt', 'mroot', 'mtext', 'mspace', 'mover', 'munder', 'munderover', 'mmultiscripts', 'mprescripts', 'none', 'mpadded', 'mstyle', 'semantics']);
const ATTRS_MATH = new Set(['display', 'alttext', 'mathvariant', 'fence', 'stretchy', 'symmetric', 'width', 'lspace', 'rspace', 'accent', 'linethickness', 'separator']);
const PARSEUR = typeof DOMParser !== 'undefined' ? new DOMParser() : null;

/** Noeuds d'un fragment HTML de confiance, nettoyés (liste blanche de balises et d'attributs). */
export function html(s: string): Node[] {
  if (!PARSEUR || !s) return s ? [document.createTextNode(s)] : [];
  const doc = PARSEUR.parseFromString(`<body>${s}</body>`, 'text/html');
  const copier = (n: Node): Node | null => {
    if (n.nodeType === Node.TEXT_NODE) return document.createTextNode(n.textContent ?? '');
    if (n.nodeType !== Node.ELEMENT_NODE) return null;
    const e = n as Element;
    const nom = e.localName;
    let x: Element;
    if (e.namespaceURI === MATHML || BALISES_MATH.has(nom)) {
      if (!BALISES_MATH.has(nom)) return document.createTextNode(e.textContent ?? '');
      x = document.createElementNS(MATHML, nom);
      for (const a of Array.from(e.attributes)) if (ATTRS_MATH.has(a.name)) x.setAttribute(a.name, a.value);
    } else if (BALISES_HTML.has(nom)) x = document.createElement(nom);
    else return document.createTextNode(e.textContent ?? '');
    for (const c of Array.from(e.childNodes)) {
      const y = copier(c);
      if (y) x.append(y);
    }
    return x;
  };
  return Array.from(doc.body.childNodes).map(copier).filter((x): x is Node => x !== null);
}

// ------------------------------------------------------------------ SVG
function analyserSvg(svg: string): SVGSVGElement | null {
  if (!PARSEUR || !svg) return null;
  const doc = PARSEUR.parseFromString(svg, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return null;
  const el = document.importNode(doc.documentElement, true) as unknown as SVGSVGElement;
  // formules des schémas : MathML posé dans son foreignObject (alignement par classes, taille par le CSSOM)
  el.querySelectorAll('foreignObject[data-formule]').forEach((fo) => {
    const d = document.createElement('div');
    d.className = `fo fo-${fo.getAttribute('data-ancre') ?? 'm'} fo-b-${fo.getAttribute('data-base') ?? 'milieu'}`;
    d.style.fontSize = (fo.getAttribute('data-taille') ?? '16') + 'px';
    d.style.color = fo.getAttribute('data-couleur') ?? 'inherit';
    d.append(mathml(fo.getAttribute('data-formule') ?? ''));
    fo.append(d);
  });
  // textes riches des figures : **valeur** et $formule$
  el.querySelectorAll('foreignObject[data-riche]').forEach((fo) => {
    const d = document.createElement('div');
    const anc = fo.getAttribute('data-ancre') ?? 'start';
    d.className = `fo-riche fo-${anc === 'start' ? 'g' : anc === 'end' ? 'd' : 'm'}`;
    d.style.fontSize = (fo.getAttribute('data-taille') ?? '14') + 'px';
    d.style.color = fo.getAttribute('data-couleur') ?? 'inherit';
    if (fo.hasAttribute('data-gras')) d.style.fontWeight = '700';
    if (fo.hasAttribute('data-italique')) d.style.fontStyle = 'italic';
    const valeur = fo.getAttribute('data-valeur') ?? '';
    for (const ligne of (fo.getAttribute('data-riche') ?? '').split('\n')) {
      const p = document.createElement('div');
      for (const m of ligne.split(/(\*\*.+?\*\*)/).filter(Boolean)) {
        if (m.startsWith('**') && m.endsWith('**') && m.length > 4) {
          const b = document.createElement('b');
          b.style.color = valeur;
          b.append(...enrichir(m.slice(2, -2)));
          p.append(b);
        } else p.append(...enrichir(m));
      }
      d.append(p);
    }
    fo.append(d);
  });
  return el;
}

export async function schema(id: string): Promise<SVGSVGElement | null> {
  const s = await charger(`schemas/${id}.json`);
  const r = rendreSchema(s, langue(), { theme: theme(), mesure: mesureReelle });
  return analyserSvg(r.svg);
}

export interface Figure {
  el: SVGSVGElement | null;
}

let imagesQ: Promise<Record<string, J>> | null = null;
/** Photographies libres des questions (id → {fichier, credit, licence…}). */
export function imagesQuestions(): Promise<Record<string, J>> {
  imagesQ ??= charger('q/images.json')
    .then((j) => Object.fromEntries((j.images as J[]).map((i) => [i.id, i])))
    .catch(() => ({}));
  return imagesQ;
}

/** Identifiants des images posées dans une figure développée. */
export function refsImages(fig: J, out: Set<string> = new Set()): Set<string> {
  if (!fig || typeof fig !== 'object') return out;
  if (Array.isArray(fig)) for (const x of fig) refsImages(x, out);
  else {
    if (fig.type === 'image' && fig.ref) out.add(String(fig.ref));
    for (const v of Object.values(fig)) if (v && typeof v === 'object') refsImages(v, out);
  }
  return out;
}

export async function figure(fig: J, o: { reponse?: boolean; indice?: boolean; bonnes?: string[]; libelle?: string }): Promise<SVGSVGElement | null> {
  if (!fig) return null;
  const j = await jetons();
  const c = aDesCotes(fig) ? await cotes() : null;
  const im = refsImages(fig).size ? await imagesQuestions() : {};
  return analyserSvg(figureSvg(fig, { theme: theme(), jetons: j, reponse: o.reponse, indice: o.indice, bonnes: o.bonnes, cotes: c, images: im, base: BASE + 'q/' }, o.libelle ?? ''));
}

/** Crédits (obligatoires pour les licences CC BY) des photographies d'une figure de question. */
export async function creditsFigure(fig: J): Promise<HTMLElement | null> {
  const refs = [...refsImages(fig)];
  if (!refs.length) return null;
  const im = await imagesQuestions();
  const l = refs.map((r) => im[r]).filter(Boolean);
  if (!l.length) return null;
  return h('p', { class: 'credit-image' }, ...l.flatMap((i: J, k: number) => [
    k ? ' · ' : '',
    `${bi(i.titre)} — ${tr('web_credit')} ${i.credit} (`,
    i.licence_url ? h('a', { href: i.licence_url, rel: 'noopener noreferrer license', target: '_blank', text: i.licence }) : String(i.licence ?? ''),
    ')',
  ]));
}

// ------------------------------------------------------------------ ressources
function texteRiche(t: unknown): (string | Element)[] {
  return enrichir(bi(t));
}

async function blocSchema(ref: string): Promise<HTMLElement> {
  const fig = h('figure', { class: 'schema' });
  try {
    const s = await charger(`schemas/${ref}.json`);
    const svg = await schema(ref);
    if (svg) fig.append(svg);
    fig.append(h('figcaption', { text: bi(s.titre) }));
  } catch {
    fig.append(h('p', { class: 'erreur', text: tr('web_ressource_indisponible') }));
  }
  return fig;
}

export async function blocImage(i: J, compacte = false): Promise<HTMLElement> {
  if (i.nature === 'schema') {
    const f = h('div', { class: 'image-schemas' });
    for (const s of i.schemas ?? []) f.append(await blocSchema(s));
    if (!compacte && i.legende) f.append(h('p', { class: 'legende' }, ...texteRiche(i.legende)));
    return f;
  }
  if (i.nature === 'table') {
    const t = await ressource('table', i.table);
    return blocTable(t);
  }
  const [l, hh] = (i.dimensions as [number, number] | undefined) ?? [800, 600];
  const img = h('img', { src: `${BASE}images/${i.id}.webp`, alt: bi(i.alt ?? i.titre), width: l, height: hh, loading: 'lazy', decoding: 'async' });
  const credit = h(
    'p',
    { class: 'credit-image' },
    h('span', { text: tr('web_credit') + ' ' + bi(i.credit) + ' — ' }),
    i.licence_url ? h('a', { href: i.licence_url, rel: 'noopener noreferrer license', target: '_blank', text: bi(i.licence) }) : bi(i.licence),
    i.source_url ? ' · ' : '',
    i.source_url ? h('a', { href: i.source_url, rel: 'noopener noreferrer', target: '_blank', text: tr('web_source') }) : '',
  );
  return h('figure', { class: 'photo' }, img, compacte ? null : i.legende ? h('figcaption', {}, ...texteRiche(i.legende)) : null, credit);
}

export function blocTable(t: J): HTMLElement {
  const lg = langue();
  const table = h('table', { class: 'table-ressource' });
  table.append(h('caption', { text: bi(t.titre) }));
  const thead = h('thead', {}, h('tr', {}, ...t.colonnes.map((c: J) => h('th', { scope: 'col', class: c.align === 'd' ? 'num' : '' }, ...enrichir(bi(c.titre))))));
  const tbody = h('tbody');
  for (const l of t.lignes) {
    const tr2 = h('tr');
    t.colonnes.forEach((c: J, k: number) => {
      const v = l.cellules[c.cle];
      const txt = v === null || v === undefined ? '—' : bi(v);
      const cel = h(k === 0 ? 'th' : 'td', { class: c.align === 'd' ? 'num' : '', ...(k === 0 ? { scope: 'row' } : {}) }, ...enrichir(txt));
      tr2.append(cel);
    });
    if (l.source?.length || l.note) tr2.title = [l.note ? bi(l.note) : '', l.source?.length ? tr('web_sources') + ' : ' + l.source.join(', ') : ''].filter(Boolean).join(' — ');
    tbody.append(tr2);
  }
  table.append(thead, tbody);
  const boite = h('div', { class: 'table-boite', tabindex: 0, role: 'region', 'aria-label': bi(t.titre) }, table);
  const out = h('div', { class: 'table-ressource-bloc' }, boite);
  for (const f of t.formules ?? []) out.append(h('div', { class: 'formule-bloc' }, ...html(f.mathml?.[lg] ?? '')));
  for (const n of t.notes_html ?? []) out.append(h('p', { class: 'note' }, ...html(n[lg] ?? '')));
  if (t.origine?.correction) out.append(h('details', { class: 'correction' }, h('summary', { text: tr('web_ce_qui_a_change') }), h('p', {}, ...texteRiche(t.origine.correction))));
  return out;
}

export async function blocFiche(f: J): Promise<HTMLElement> {
  const lg = langue();
  const a = h('article', { class: 'fiche-ressource' });
  a.append(h('p', { class: 'resume' }, ...html(f.resume_html?.[lg] ?? bi(f.resume))));
  const imgs = await images();
  for (const b of f.blocs) {
    switch (b.type) {
      case 'definition':
        a.append(h('p', {}, ...html(b.html?.[lg] ?? bi(b.texte))));
        break;
      case 'formule':
      case 'reaction':
        a.append(h('div', { class: 'formule-bloc' }, ...html(b.mathml?.[lg] ?? ''), b.legende_html || b.legende ? h('p', { class: 'legende' }, ...html(b.legende_html?.[lg] ?? bi(b.legende))) : null));
        break;
      case 'schema':
        a.append(await blocSchema(b.ref));
        break;
      case 'image': {
        const i = imgs.get(b.ref);
        if (i) a.append(await blocImage(i));
        break;
      }
      case 'ordres_de_grandeur':
        a.append(h('section', { class: 'ordres' }, h('h3', { text: tr('web_ordres_grandeur') }), h('ul', {}, ...b.items.map((x: J) => h('li', {}, ...html(x.html?.[lg] ?? bi(x.texte)))))));
        break;
      case 'piege':
        a.append(h('aside', { class: 'piege', 'aria-label': tr('web_piege') }, h('strong', { text: tr('web_piege') + ' ' }), ...html(b.html?.[lg] ?? bi(b.texte))));
        break;
      case 'plus':
        a.append(h('aside', { class: 'plus' }, h('strong', { text: tr('web_pour_aller_plus_loin') + ' ' }), ...html(b.html?.[lg] ?? bi(b.texte))));
        break;
    }
  }
  if (f.origine?.correction) a.append(h('details', { class: 'correction' }, h('summary', { text: tr('web_ce_qui_a_change') }), h('p', {}, ...html(f.origine.correction_html?.[lg] ?? bi(f.origine.correction)))));
  if (f.sources?.length) {
    const src = await charger('sources.json');
    a.append(
      h('details', { class: 'sources' }, h('summary', { text: tr('web_sources') }),
        h('ul', {}, ...f.sources.map((k: string) => {
          const s = src[k];
          if (!s) return h('li', { text: k });
          return h('li', {}, s.auteurs ? s.auteurs + ', ' : '', h('cite', { text: s.titre }), s.ref ? ', ' + s.ref : '', s.url ? ' — ' : '', s.url ? h('a', { href: s.url, rel: 'noopener noreferrer', target: '_blank', text: new URL(s.url).hostname }) : '');
        }))),
    );
  }
  return a;
}

/** Contenu d'une ressource (fiche, table, image) prêt à poser dans une fenêtre. */
export async function contenuRessource(genre: 'fiche' | 'table' | 'image', id: string): Promise<{ titre: string; el: HTMLElement }> {
  if (genre === 'image') {
    const i = (await images()).get(id);
    if (!i) throw new Error(id);
    return { titre: bi(i.titre), el: h('div', { class: 'ressource-image' }, await blocImage(i)) };
  }
  const r = await ressource(genre, id);
  return { titre: bi(r.titre), el: genre === 'fiche' ? await blocFiche(r) : blocTable(r) };
}

/** Aperçu au survol (≤ 180 × 140 px) : titre + résumé + premier schéma ; 4 lignes d'une table ; image réduite. */
export async function apercu(genre: GenreRessource, id: string): Promise<HTMLElement | null> {
  try {
    if (genre === 'fiche') {
      const f = await ressource('fiche', id);
      const b = f.blocs.find((x: J) => x.type === 'schema');
      const svg = b ? await schema(b.ref) : null;
      return h('div', { class: 'apercu-contenu' }, svg, h('p', { class: 'apercu-resume', text: bi(f.resume) }));
    }
    if (genre === 'table') {
      const t = await ressource('table', id);
      const mini = { ...t, lignes: t.lignes.slice(0, 4), formules: [], notes_html: [], origine: null };
      return h('div', { class: 'apercu-contenu apercu-table' }, blocTable(mini));
    }
    if (genre === 'image') {
      const i = (await images()).get(id);
      if (!i) return null;
      if (i.nature === 'photo') return h('div', { class: 'apercu-contenu' }, h('img', { src: `${BASE}images/${i.id}.webp`, alt: '', width: 176, height: 120 }));
      if (i.nature === 'schema' && i.schemas?.[0]) return h('div', { class: 'apercu-contenu' }, await schema(i.schemas[0]));
    }
  } catch {
    return null;
  }
  return null;
}
