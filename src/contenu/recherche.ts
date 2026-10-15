/**
 * Recherche bilingue — moteur commun à Coupole Web et à Coupole (bureau).
 *
 * Même logique, ligne pour ligne, que `coupole/modules/anim/classe/recherche.py` (points entiers : mêmes résultats,
 * même ordre) ; sans DOM.  Cas de parité : `tests/references/recherche_cas.json` (produits par le portage Python,
 * `outils/cas_recherche.py` de Coupole), rejoués par `tests/unit/recherche.test.ts`.
 *
 * Règles :
 * - un document = {g, id, t: {fr, en}, o: titre d'origine, k: {fr, en} mots-clés, r: {fr, en} texte, m: [modules]} ;
 *   les deux langues sont indexées ensemble (une recherche en anglais ou en français trouve le même document, qui
 *   s'affiche dans la langue de l'interface) ;
 * - normalisation : minuscules, sans accents, œ → oe, æ → ae, ß → ss ; mots = suites de lettres et de chiffres ;
 * - racine (pluriels simples FR/EN) : -aux → -al, -eux → -eu, -ies → -y, -s retiré (sauf -ss, -us, -is), puis -e
 *   final retiré et -y final → -i (plus de 3 lettres) ;
 * - mots vides et lettres isolées ignorés quand il reste autre chose (« Kepler's » → kepler) ;
 * - correspondance : même racine 10, début de mot 8 (2 lettres au moins), petite faute sur les racines (distance
 *   d'édition avec transpositions : 1 dès 4 lettres → 7, 2 dès 8 lettres → 5) × poids du champ (titre et titre
 *   d'origine 3, mots-clés 2, texte 1), meilleur champ par mot cherché ;
 * - phrase : +12 si la recherche est un titre, +6 si elle y est contenue (mots entiers) ;
 * - couverture : + ⌊6 × mots du titre trouvés / mots du titre⌋, meilleur titre ;
 * - au moins la moitié des mots trouvés (arrondi au-dessus) ; tri : mots trouvés, points, genre, identifiant.
 */

export const FORMAT = 'coupole-recherche/1';
export const ORDRE_GENRES = ['module', 'animation', 'question', 'fiche', 'table', 'image'] as const;
export type GenreDoc = (typeof ORDRE_GENRES)[number];
const POIDS = { titre: 3, cles: 2, texte: 1 } as const;
const EXACT = 10;
const DEBUT = 8;
const FAUTE1 = 7;
const FAUTE2 = 5;
const BONUS_TITRE = 12;
const BONUS_DANS_TITRE = 6;
const COUVERTURE = 6;

export const MOTS_VIDES = new Set(
  `a au aux avec ce ces cet cette d dans de des du elle en et il l la le les leur leurs ne on ou par pas pour qu que
qui sa se ses son sont sur un une y
an and are as at be by for from how in is it its of on or the this that to what when which why with`.split(/\s+/),
);

export interface Bi {
  fr: string;
  en: string;
}
export interface Doc {
  g: GenreDoc;
  id: string;
  t: Bi;
  o?: string;
  k?: Bi | string;
  r?: Bi | string;
  m?: string[];
}
export interface Resultat<D extends Doc = Doc> {
  doc: D;
  n: number;
  score: number;
  mots: string[];
}

const SEP = /[^\p{L}\p{N}]+/u;
const MOT = /[\p{L}\p{N}]+/gu;
const NOMBRE = /^[0-9]+$/;

export function normaliser(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/ß/g, 'ss');
}

export function mots(s: string): string[] {
  return normaliser(s).split(SEP).filter(Boolean);
}

export function racine(w: string): string {
  if (w.length <= 3 || NOMBRE.test(w)) return w;
  if (w.endsWith('aux') && w.length > 4) w = w.slice(0, -3) + 'al';
  else if (w.endsWith('eux') && w.length > 4) w = w.slice(0, -1);
  else if (w.endsWith('ies') && w.length > 4) w = w.slice(0, -3) + 'y';
  else if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith('y')) w = w.slice(0, -1) + 'i';
  return w;
}

/** Distance d'édition avec transpositions adjacentes (OSA) ; borne + 1 dès qu'elle dépasse la borne. */
export function distance(a: string, b: string, borne: number): number {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > borne) return borne + 1;
  let prec2: number[] | null = null;
  let prec = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    const cour = new Array<number>(lb + 1).fill(0);
    cour[0] = i;
    let mini = i;
    for (let j = 1; j <= lb; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prec[j]! + 1, cour[j - 1]! + 1, prec[j - 1]! + c);
      if (prec2 !== null && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prec2[j - 2]! + 1);
      cour[j] = v;
      if (v < mini) mini = v;
    }
    if (mini > borne) return borne + 1;
    prec2 = prec;
    prec = cour;
  }
  return prec[lb]! <= borne ? prec[lb]! : borne + 1;
}

/** Mots cherchés : sans mots vides ni lettres isolées s'il reste autre chose ; sans doublon. */
export function termes(q: string): string[] {
  const tous = mots(q);
  const utiles = tous.filter((w) => !MOTS_VIDES.has(w) && (w.length > 1 || NOMBRE.test(w)));
  const out: string[] = [];
  for (const w of utiles.length ? utiles : tous) if (!out.includes(w)) out.push(w);
  return out;
}

function bi(v: Bi | string | undefined | null, lg: 'fr' | 'en'): string {
  if (v && typeof v === 'object') return String(v[lg] || '');
  return v == null ? '' : String(v);
}

function ordre(g: string): number {
  const i = (ORDRE_GENRES as readonly string[]).indexOf(g);
  return i < 0 ? ORDRE_GENRES.length : i;
}

export class Index<D extends Doc = Doc> {
  readonly docs: D[];
  /** mot normalisé → [racine, poids du meilleur champ par numéro de document] */
  readonly vocab = new Map<string, [string, Map<number, number>]>();
  private readonly titres: string[][][] = [];

  constructor(docs: D[]) {
    this.docs = [...docs];
    this.docs.forEach((d, n) => {
      const champs: [keyof typeof POIDS, string][] = [
        ['titre', [bi(d.t, 'fr'), bi(d.t, 'en'), String(d.o || '')].join(' ')],
        ['cles', [bi(d.k, 'fr'), bi(d.k, 'en')].join(' ')],
        ['texte', [bi(d.r, 'fr'), bi(d.r, 'en')].join(' ')],
      ];
      for (const [champ, texte] of champs) {
        const p = POIDS[champ];
        for (const w of mots(texte)) {
          let e = this.vocab.get(w);
          if (!e) {
            e = [racine(w), new Map()];
            this.vocab.set(w, e);
          }
          if ((e[1].get(n) ?? 0) < p) e[1].set(n, p);
        }
      }
      this.titres.push([bi(d.t, 'fr'), bi(d.t, 'en'), String(d.o || '')].filter(Boolean).map((x) => mots(x)));
    });
  }

  /** [(mot de l'index, points)] pour un mot cherché. */
  correspondances(terme: string): [string, number][] {
    const r = racine(terme);
    const num = NOMBRE.test(terme);
    const borne = num || terme.length < 4 ? 0 : terme.length < 8 ? 1 : 2;
    const out: [string, number][] = [];
    for (const [w, [rw]] of this.vocab) {
      let pts = 0;
      if (rw === r) pts = EXACT;
      else if (terme.length >= 2 && w.startsWith(terme)) pts = DEBUT;
      else if (borne) {
        const d = distance(r, rw, borne);
        pts = d > borne ? 0 : d === 1 ? FAUTE1 : FAUTE2;
      }
      if (pts) out.push([w, pts]);
    }
    return out;
  }

  /** Résultats triés (mots : mots normalisés de l'index trouvés, pour surligner). */
  chercher(q: string, limite = 0): Resultat<D>[] {
    const ts = termes(q);
    if (!ts.length) return [];
    const parDoc = new Map<number, [number[], Set<string>]>();
    ts.forEach((t, k) => {
      for (const [w, pts] of this.correspondances(t)) {
        for (const [n, poids] of this.vocab.get(w)![1]) {
          let e = parDoc.get(n);
          if (!e) {
            e = [new Array<number>(ts.length).fill(0), new Set()];
            parDoc.set(n, e);
          }
          if (pts * poids > e[0][k]!) e[0][k] = pts * poids;
          e[1].add(w);
        }
      }
    });
    const minimum = Math.floor((ts.length + 1) / 2);
    const phrase = mots(q).join(' ');
    const res: Resultat<D>[] = [];
    for (const [n, [points, trouves]] of parDoc) {
      const nb = points.filter((p) => p).length;
      if (nb < minimum) continue;
      let score = points.reduce((a, b) => a + b, 0);
      const titres = this.titres[n]!.map((t) => t.join(' '));
      if (titres.some((t) => t === phrase)) score += BONUS_TITRE;
      else if (phrase && titres.some((t) => (' ' + t + ' ').includes(' ' + phrase + ' '))) score += BONUS_DANS_TITRE;
      score += Math.max(0, ...this.titres[n]!.filter((t) => t.length).map((t) => Math.floor((COUVERTURE * t.filter((w) => trouves.has(w)).length) / t.length)));
      res.push({ doc: this.docs[n]!, n: nb, score, mots: [...trouves].sort() });
    }
    res.sort((a, b) => b.n - a.n || b.score - a.score || ordre(a.doc.g) - ordre(b.doc.g) || (a.doc.id < b.doc.id ? -1 : a.doc.id > b.doc.id ? 1 : 0));
    return limite ? res.slice(0, limite) : res;
  }
}

/** Découpe `texte` en [morceau, surligné] : un mot est surligné si sa forme normalisée est dans `trouves`. */
export function surligner(texte: string, trouves: Iterable<string>): [string, boolean][] {
  const t = new Set(trouves);
  const out: [string, boolean][] = [];
  let i = 0;
  for (const m of texte.matchAll(MOT)) {
    if (!t.has(normaliser(m[0]))) continue;
    if (m.index! > i) out.push([texte.slice(i, m.index), false]);
    out.push([m[0], true]);
    i = m.index! + m[0].length;
  }
  if (i < texte.length) out.push([texte.slice(i), false]);
  return out;
}

/** Passage de `texte` (≈ longueur caractères) autour du premier mot trouvé, avec « … » aux coupures. */
export function extrait(texte: string, trouves: Iterable<string>, longueur = 160): string {
  if (texte.length <= longueur) return texte;
  const t = new Set(trouves);
  let debut = 0;
  for (const m of texte.matchAll(MOT)) {
    if (t.has(normaliser(m[0]))) {
      debut = Math.max(0, m.index! - Math.floor(longueur / 3));
      break;
    }
  }
  if (debut) {
    const k = texte.indexOf(' ', debut);
    debut = k >= 0 && k < debut + 20 ? k + 1 : debut;
  }
  let fin = Math.min(texte.length, debut + longueur);
  if (fin < texte.length) {
    const k = texte.lastIndexOf(' ', fin - 1);
    fin = k > debut + Math.floor(longueur / 2) ? k : fin;
  }
  return (debut ? '…' : '') + texte.slice(debut, fin).trim() + (fin < texte.length ? '…' : '');
}

// ------------------------------------------------------------------ documents (même construction qu'au bureau)
export interface EntreeIndexee {
  g: 'q' | 'f' | 't' | 'i';
  id: string;
  m: string[];
  t: Bi;
  k: Bi;
  r: Bi;
}
export interface AnimationIndexee {
  id: string;
  cle: string;
  titre: string;
  theme: string;
}
export interface ModuleIndexe {
  cle: string;
  titre: Bi;
  original?: string;
}

/**
 * Documents de la recherche (comme `contenu.documents()` au bureau) : index importé (questions, fiches, tables,
 * images), animations (noms, descriptions, titre d'origine, identifiant et thème en mots-clés), modules (titres,
 * titre d'origine).  `texte(langue, clé)` rend un texte de l'interface ou undefined.
 */
export function documentsDe(entrees: EntreeIndexee[], animations: AnimationIndexee[], modules: ModuleIndexe[], texte: (l: 'fr' | 'en', cle: string) => string | undefined): Doc[] {
  const genre = { q: 'question', f: 'fiche', t: 'table', i: 'image' } as const;
  const out: Doc[] = entrees.map((e) => ({ g: genre[e.g], id: e.id, m: e.m, t: e.t, k: e.k, r: e.r }));
  for (const a of animations) {
    const t = { fr: texte('fr', 'anim_nom_' + a.cle) ?? a.titre, en: texte('en', 'anim_nom_' + a.cle) ?? a.titre };
    const th = { fr: texte('fr', 'anim_theme_' + a.theme) ?? '', en: texte('en', 'anim_theme_' + a.theme) ?? '' };
    out.push({ g: 'animation', id: a.id, m: [], t, o: a.titre, k: { fr: a.id + ' ' + th.fr, en: th.en }, r: { fr: texte('fr', 'anim_desc_' + a.cle) ?? '', en: texte('en', 'anim_desc_' + a.cle) ?? '' } });
  }
  for (const m of modules) out.push({ g: 'module', id: m.cle, m: [m.cle], t: m.titre, o: m.original || '', k: { fr: m.cle, en: '' }, r: { fr: '', en: '' } });
  return out;
}
