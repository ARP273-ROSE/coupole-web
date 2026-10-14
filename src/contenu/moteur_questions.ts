// @ts-nocheck — copie conforme du moteur des questions (même fichier dans Coupole, en Python) ;
// ne pas modifier ici : outils/importer_contenu.py la recopie.
/**
 * Moteur des questions de Coupole — implémentation TypeScript (aucune dépendance, navigateur ou Node ≥ 22).
 *
 * Spécification : moteur/SPEC.md.  Doit rendre exactement la même chose que l'implémentation Python de référence
 * (moteur/py/moteur_questions.py) pour la même graine : jeux communs dans moteur/references/.
 *
 * Syntaxe « effaçable » uniquement (pas d'enum, pas de namespace, pas de propriétés de paramètres) : le fichier se
 * charge tel quel dans Node (suppression des types) comme dans Vite.
 */

export const VERSION_MOTEUR = '1.0.0';

export class ErreurMoteur extends Error {}

// ===================================================================================================== hasard
export function fnv1a32(texte: string): number {
  let h = 0x811c9dc5;
  const octets = new TextEncoder().encode(texte);
  for (const o of octets) {
    h ^= o;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 : 32 bits d'état ; uniforme() = k / 2^32. */
export class Alea {
  etat: number;
  tirages = 0;
  constructor(graine: string | number) {
    this.etat = typeof graine === 'number' ? graine >>> 0 : fnv1a32(String(graine));
  }
  uint32(): number {
    this.etat = (this.etat + 0x6d2b79f5) >>> 0;
    let t = this.etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    this.tirages++;
    return (t ^ (t >>> 14)) >>> 0;
  }
  uniforme(): number {
    return this.uint32() / 4294967296;
  }
  entier(a: number, b: number): number {
    return a + Math.floor(this.uniforme() * (b - a + 1));
  }
  permutation(n: number): number[] {
    const p: number[] = [];
    for (let i = 0; i < n; i++) p.push(i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(this.uniforme() * (i + 1));
      const x = p[i];
      p[i] = p[j];
      p[j] = x;
    }
    return p;
  }
}

// ===================================================================================================== nombres
const MOINS = '−';
const ESPACE_FINE = ' ';
const EXP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '⁺',
};
const exposant = (s: string): string => s.split('').map((c) => EXP[c] ?? c).join('');

export type Langue = 'fr' | 'en';
export type Bilingue = { fr: string; en: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Valeur = any;

const estNombre = (v: unknown): v is number => typeof v === 'number';

/** Chiffres d'un entier non négatif représenté exactement par un double (quelle que soit sa taille). */
function entierExact(x: number): string {
  return BigInt(x).toString();
}

/** |x| arrondi à n décimales, demi vers le haut sur la valeur binaire exacte (Number.prototype.toFixed). */
function fixeAbs(x: number, n: number): string {
  const a = Math.abs(x);
  if (a >= 1e21) return entierExact(a) + (n > 0 ? '.' + '0'.repeat(n) : '');
  return a.toFixed(n);
}

/** [chiffres significatifs, exposant décimal] de |x| arrondi à `chiffres` chiffres (Number.prototype.toPrecision). */
function mantisseExposant(x: number, chiffres: number): [string, number] {
  if (x === 0) return ['0'.repeat(chiffres), 0];
  const s = Math.abs(x).toExponential(chiffres - 1);
  const [m, e] = s.split('e');
  return [m.replace('.', ''), parseInt(e, 10)];
}

function grouper(entier: string, langue: Langue, seuil: number): string {
  if (entier.length < seuil) return entier;
  const sep = langue === 'fr' ? ESPACE_FINE : ',';
  const morceaux: string[] = [];
  while (entier.length > 3) {
    morceaux.unshift(entier.slice(-3));
    entier = entier.slice(0, -3);
  }
  morceaux.unshift(entier);
  return morceaux.join(sep);
}

function assembler(neg: boolean, absTxt: string, langue: Langue, seuil: number, plus: boolean): string {
  let ent = absTxt;
  let dec = '';
  const k = absTxt.indexOf('.');
  if (k >= 0) {
    ent = absTxt.slice(0, k);
    dec = absTxt.slice(k + 1);
  }
  const s = grouper(ent, langue, seuil) + (dec ? (langue === 'fr' ? ',' : '.') + dec : '');
  const nul = /^[0.]*$/.test(absTxt);
  if (neg && !nul) return MOINS + s;
  if (plus && !nul) return '+' + s;
  return s;
}

/** Écriture canonique d'un nombre (String(x)). */
export function nombreJs(x: number): string {
  return String(x);
}

/** Arrondi à n décimales, demi loin de zéro, décidé sur la valeur binaire exacte. */
export function arrondi(x: number, n = 0): number {
  if (!Number.isFinite(x)) return x;
  if (n < 0) {
    const p = Math.pow(10, -n);
    const v = parseFloat(fixeAbs(x / p, 0)) * p;
    return x < 0 ? -v : v;
  }
  const v = parseFloat(fixeAbs(x, n));
  return x < 0 ? -v : v;
}

export function arrondiSig(x: number, n: number): number {
  if (x === 0 || !Number.isFinite(x)) return x;
  const [dig, e10] = mantisseExposant(x, n);
  const v = parseFloat((dig.length > 1 ? dig[0] + '.' + dig.slice(1) : dig) + 'e' + e10);
  return x < 0 ? -v : v;
}

function estBilingue(v: Valeur): v is Bilingue {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const k = Object.keys(v);
  return k.length === 2 && 'fr' in v && 'en' in v;
}

/** Rendu d'une valeur dans un gabarit.  spec : '' (auto), fN, gN, sN, eN, i, n, avec « + » en tête possible. */
export function formater(v: Valeur, spec = '', langue: Langue = 'fr'): string {
  if (v !== null && typeof v === 'object' && !Array.isArray(v) && 'fr' in v && 'en' in v) return String(v[langue]);
  if (typeof v === 'boolean') return langue === 'fr' ? (v ? 'vrai' : 'faux') : v ? 'true' : 'false';
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map((e) => formater(e, spec, langue)).join(', ');
  if (!estNombre(v)) throw new ErreurMoteur(`valeur non formatable : ${JSON.stringify(v)}`);
  const x = v;
  if (!Number.isFinite(x)) throw new ErreurMoteur('nombre non fini dans un gabarit');
  const plus = spec.startsWith('+');
  if (plus) spec = spec.slice(1);
  const neg = x < 0 || Object.is(x, -0);
  if (spec === '') {
    if (x === Math.floor(x) && Math.abs(x) < 1e15) return assembler(neg, entierExact(Math.abs(x)), langue, 5, plus);
    const [dig, e10] = mantisseExposant(x, 12);
    if (e10 < -6 || e10 >= 15) {
      spec = 'e' + String((dig.replace(/0+$/, '') || '0').length - 1);
    } else {
      const dec = Math.max(0, 11 - e10);
      let t = fixeAbs(x, dec);
      if (t.includes('.')) t = t.replace(/0+$/, '').replace(/\.$/, '');
      return assembler(neg, t, langue, 5, plus);
    }
  }
  const t = spec[0];
  const a = spec.slice(1);
  if (t === 'f' || t === 'g') return assembler(neg, fixeAbs(x, parseInt(a || '0', 10)), langue, t === 'g' ? 4 : 5, plus);
  if (t === 'i') return assembler(neg, fixeAbs(x, 0), langue, 5, plus);
  if (t === 'n') return assembler(neg, fixeAbs(x, 0), langue, 1e9, plus);
  if (t === 's') {
    const n = parseInt(a || '3', 10);
    const [dig, e10] = mantisseExposant(x, n);
    let txt: string;
    if (e10 >= n - 1) txt = dig + '0'.repeat(e10 - n + 1);
    else if (e10 >= 0) txt = dig.slice(0, e10 + 1) + '.' + dig.slice(e10 + 1);
    else txt = '0.' + '0'.repeat(-e10 - 1) + dig;
    return assembler(neg, txt, langue, 5, plus);
  }
  if (t === 'e') {
    const n = parseInt(a || '2', 10);
    const [dig, e10] = mantisseExposant(x, n + 1);
    const m = assembler(neg, dig[0] + (n > 0 ? '.' + dig.slice(1) : ''), langue, 1e9, plus);
    if (x === 0) return m;
    return m + ' × 10' + exposant(String(e10));
  }
  throw new ErreurMoteur(`format inconnu : ${spec}`);
}

// ===================================================================================================== expressions
type Jeton = [string, Valeur];
const MOTS_CLES: Record<string, string> = { et: '&&', ou: '||', non: '!' };
const estChiffre = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';
const estLettre = (c: string | undefined): boolean => c !== undefined && /[\p{L}_]/u.test(c);
const estAlnum = (c: string | undefined): boolean => c !== undefined && /[\p{L}\p{N}_]/u.test(c);

function jetons(s: string): Jeton[] {
  const out: Jeton[] = [];
  const n = s.length;
  let i = 0;
  while (i < n) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (estChiffre(c) || (c === '.' && estChiffre(s[i + 1]))) {
      let j = i;
      while (j < n && (estChiffre(s[j]) || s[j] === '.')) j++;
      if (j < n && (s[j] === 'e' || s[j] === 'E') && (estChiffre(s[j + 1]) || ((s[j + 1] === '+' || s[j + 1] === '-') && estChiffre(s[j + 2])))) {
        j += 2;
        while (j < n && estChiffre(s[j])) j++;
      }
      out.push(['nb', parseFloat(s.slice(i, j))]);
      i = j;
      continue;
    }
    if (estLettre(c)) {
      let j = i;
      while (j < n && estAlnum(s[j])) j++;
      const mot = s.slice(i, j);
      if (mot in MOTS_CLES) out.push(['op', MOTS_CLES[mot]]);
      else out.push(['id', mot]);
      i = j;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      let buf = '';
      while (j < n && s[j] !== c) {
        if (s[j] === '\\' && j + 1 < n) j++;
        buf += s[j];
        j++;
      }
      if (j >= n) throw new ErreurMoteur(`chaîne non fermée : ${s}`);
      out.push(['ch', buf]);
      i = j + 1;
      continue;
    }
    const deux = s.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||'].includes(deux)) {
      out.push(['op', deux]);
      i += 2;
      continue;
    }
    if ('+-*/%^<>!()[],.'.includes(c)) {
      out.push(['op', c]);
      i++;
      continue;
    }
    throw new ErreurMoteur(`caractère inattendu ${c} dans ${s}`);
  }
  out.push(['fin', null]);
  return out;
}

type Noeud = Valeur[];

class Analyseur {
  s: string;
  j: Jeton[];
  k = 0;
  constructor(s: string) {
    this.s = s;
    this.j = jetons(s);
  }
  voir(): Jeton {
    return this.j[this.k];
  }
  prendre(op?: string): Jeton {
    const t = this.j[this.k];
    if (op !== undefined && !(t[0] === 'op' && t[1] === op)) throw new ErreurMoteur(`« ${op} » attendu dans ${this.s}`);
    this.k++;
    return t;
  }
  est(...ops: string[]): boolean {
    const t = this.voir();
    return t[0] === 'op' && ops.includes(t[1]);
  }
  tout(): Noeud {
    const e = this.ou();
    if (this.voir()[0] !== 'fin') throw new ErreurMoteur(`fin attendue dans ${this.s}`);
    return e;
  }
  ou(): Noeud {
    let e = this.et();
    while (this.est('||')) {
      this.prendre();
      e = ['ou', e, this.et()];
    }
    return e;
  }
  et(): Noeud {
    let e = this.non();
    while (this.est('&&')) {
      this.prendre();
      e = ['et', e, this.non()];
    }
    return e;
  }
  non(): Noeud {
    if (this.est('!')) {
      this.prendre();
      return ['non', this.non()];
    }
    return this.comp();
  }
  comp(): Noeud {
    let e = this.somme();
    if (this.est('==', '!=', '<', '<=', '>', '>=')) {
      const op = this.prendre()[1];
      e = ['cmp', op, e, this.somme()];
    }
    return e;
  }
  somme(): Noeud {
    let e = this.produit();
    while (this.est('+', '-')) {
      const op = this.prendre()[1];
      e = ['bin', op, e, this.produit()];
    }
    return e;
  }
  produit(): Noeud {
    let e = this.unaire();
    while (this.est('*', '/', '%')) {
      const op = this.prendre()[1];
      e = ['bin', op, e, this.unaire()];
    }
    return e;
  }
  unaire(): Noeud {
    if (this.est('-')) {
      this.prendre();
      return ['neg', this.unaire()];
    }
    if (this.est('+')) {
      this.prendre();
      return this.unaire();
    }
    return this.puiss();
  }
  puiss(): Noeud {
    let e = this.postfixe();
    if (this.est('^')) {
      this.prendre();
      e = ['bin', '^', e, this.unaire()];
    }
    return e;
  }
  postfixe(): Noeud {
    let e = this.primaire();
    for (;;) {
      if (this.est('.')) {
        this.prendre();
        const t = this.prendre();
        if (t[0] !== 'id') throw new ErreurMoteur(`nom attendu après « . » dans ${this.s}`);
        e = ['champ', e, t[1]];
      } else if (this.est('[')) {
        this.prendre();
        const i = this.ou();
        this.prendre(']');
        e = ['index', e, i];
      } else if (this.est('(') && e[0] === 'nom') {
        this.prendre();
        const args: Noeud[] = [];
        if (!this.est(')')) {
          args.push(this.ou());
          while (this.est(',')) {
            this.prendre();
            args.push(this.ou());
          }
        }
        this.prendre(')');
        e = ['appel', e[1], args];
      } else return e;
    }
  }
  primaire(): Noeud {
    const t = this.prendre();
    if (t[0] === 'nb' || t[0] === 'ch') return ['lit', t[1]];
    if (t[0] === 'id') {
      if (t[1] === 'vrai' || t[1] === 'true') return ['lit', true];
      if (t[1] === 'faux' || t[1] === 'false') return ['lit', false];
      if (t[1] === 'nul' || t[1] === 'null') return ['lit', null];
      return ['nom', t[1]];
    }
    if (t[0] === 'op' && t[1] === '(') {
      const e = this.ou();
      this.prendre(')');
      return e;
    }
    if (t[0] === 'op' && t[1] === '[') {
      const elts: Noeud[] = [];
      if (!this.est(']')) {
        elts.push(this.ou());
        while (this.est(',')) {
          this.prendre();
          elts.push(this.ou());
        }
      }
      this.prendre(']');
      return ['liste', elts];
    }
    throw new ErreurMoteur(`expression invalide : ${this.s}`);
  }
}

const CACHE_AST = new Map<string, Noeud>();
export function analyser(s: string): Noeud {
  let a = CACHE_AST.get(s);
  if (a === undefined) {
    a = new Analyseur(s).tout();
    CACHE_AST.set(s, a);
  }
  return a;
}

function num(v: Valeur, quoi = 'nombre'): number {
  if (!estNombre(v)) throw new ErreurMoteur(`${quoi} attendu, reçu ${JSON.stringify(v)}`);
  return v;
}

export function egal(a: Valeur, b: Valeur): boolean {
  if (estNombre(a) && estNombre(b)) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => egal(x, b[i]));
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return egal(ka, kb) && ka.every((k) => egal(a[k], b[k]));
  }
  return a === b;
}

function vrai(v: Valeur): boolean {
  if (typeof v === 'boolean') return v;
  throw new ErreurMoteur(`booléen attendu, reçu ${JSON.stringify(v)}`);
}

function texteBrut(e: Valeur): string {
  if (typeof e === 'string') return e;
  throw new ErreurMoteur(`texte attendu, reçu ${JSON.stringify(e)}`);
}

function joindre(liste: Valeur[], sep: Valeur): Valeur {
  if (liste.some(estBilingue) || estBilingue(sep)) {
    const r: Record<string, string> = {};
    for (const lg of ['fr', 'en'] as const) {
      r[lg] = liste.map((e) => (estBilingue(e) ? e[lg] : texteBrut(e))).join(estBilingue(sep) ? sep[lg] : sep);
    }
    return r;
  }
  return liste.map(texteBrut).join(sep);
}

function index(i: Valeur, n: number): number {
  const k = num(i, 'indice');
  if (k !== Math.floor(k) || k < 0 || k >= n) throw new ErreurMoteur(`indice hors limites : ${k} (taille ${n})`);
  return k;
}

function distincts(l: Valeur[]): boolean {
  for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) if (egal(l[i], l[j])) return false;
  return true;
}

function liste1(a: Valeur[]): Valeur[] {
  return a.length === 1 && Array.isArray(a[0]) ? a[0] : a;
}

function verifier(x: number): number {
  if (Number.isNaN(x)) throw new ErreurMoteur('domaine mathématique');
  return x;
}

const f1 = (f: (x: number) => number) => (a: Valeur) => verifier(f(num(a)));
const D = Math.PI / 180;

/** Remarque : Python lève une erreur pour sqrt/ln/asin hors domaine ; ici NaN → même erreur (verifier). */
const FONCTIONS: Record<string, (...a: Valeur[]) => Valeur> = {
  abs: f1(Math.abs),
  sqrt: f1(Math.sqrt),
  cbrt: f1((x) => Math.sign(x) * Math.pow(Math.abs(x), 1 / 3)),
  exp: f1((x) => {
    const r = Math.exp(x);
    if (!Number.isFinite(r)) throw new ErreurMoteur('exp : dépassement');
    return r;
  }),
  ln: f1((x) => {
    if (x <= 0) throw new ErreurMoteur('ln : domaine');
    return Math.log(x);
  }),
  log10: f1((x) => {
    if (x <= 0) throw new ErreurMoteur('log10 : domaine');
    return Math.log10(x);
  }),
  log2: f1((x) => {
    if (x <= 0) throw new ErreurMoteur('log2 : domaine');
    return Math.log2(x);
  }),
  floor: f1(Math.floor),
  ceil: f1(Math.ceil),
  trunc: f1(Math.trunc),
  sign: (a: Valeur) => (num(a) > 0 ? 1 : num(a) < 0 ? -1 : 0),
  sin: f1(Math.sin),
  cos: f1(Math.cos),
  tan: f1(Math.tan),
  asin: f1(Math.asin),
  acos: f1(Math.acos),
  atan: f1(Math.atan),
  atan2: (y: Valeur, x: Valeur) => Math.atan2(num(y), num(x)),
  sind: (a: Valeur) => Math.sin((num(a) * Math.PI) / 180),
  cosd: (a: Valeur) => Math.cos((num(a) * Math.PI) / 180),
  tand: (a: Valeur) => Math.tan((num(a) * Math.PI) / 180),
  asind: (a: Valeur) => (verifier(Math.asin(num(a))) * 180) / Math.PI,
  acosd: (a: Valeur) => (verifier(Math.acos(num(a))) * 180) / Math.PI,
  atand: (a: Valeur) => (Math.atan(num(a)) * 180) / Math.PI,
  atan2d: (y: Valeur, x: Valeur) => (Math.atan2(num(y), num(x)) * 180) / Math.PI,
  rad: (a: Valeur) => (num(a) * Math.PI) / 180,
  deg: (a: Valeur) => (num(a) * 180) / Math.PI,
  hypot: (a: Valeur, b: Valeur) => Math.sqrt(num(a) * num(a) + num(b) * num(b)),
  pow: (a: Valeur, b: Valeur) => puissance(num(a), num(b)),
  mod: (a: Valeur, b: Valeur) => num(a) - num(b) * Math.floor(num(a) / num(b)),
  clamp: (x: Valeur, a: Valeur, b: Valeur) => Math.min(Math.max(num(x), num(a)), num(b)),
  round: (a: Valeur, n: Valeur = 0) => arrondi(num(a), Math.trunc(num(n))),
  roundsig: (a: Valeur, n: Valeur) => arrondiSig(num(a), Math.trunc(num(n))),
  min: (...a: Valeur[]) => Math.min(...liste1(a).map((x) => num(x))),
  max: (...a: Valeur[]) => Math.max(...liste1(a).map((x) => num(x))),
  len: (l: Valeur) => l.length,
  somme: (l: Valeur[]) => {
    let s = 0;
    for (const x of l) s += num(x);
    return s;
  },
  prendre: (l: Valeur[], idx: Valeur[]) => idx.map((i) => l[index(i, l.length)]),
  joindre: (l: Valeur[], sep: Valeur = ', ') => joindre(l, sep),
  inverse: (l: Valeur[]) => [...l].reverse(),
  trier: (l: Valeur[]) => [...l].sort((a, b) => num(a) - num(b)),
  indice: (l: Valeur[], v: Valeur) => l.findIndex((x) => egal(x, v)),
  contient: (l: Valeur[], v: Valeur) => l.some((x) => egal(x, v)),
  distincts: (...a: Valeur[]) => distincts(liste1(a)),
  plage: (n: Valeur) => Array.from({ length: Math.trunc(num(n)) }, (_, k) => k),
  concat: (...a: Valeur[][]) => ([] as Valeur[]).concat(...a),
  texte: (v: Valeur, spec: Valeur = '') => ({ fr: formater(v, spec, 'fr'), en: formater(v, spec, 'en') }),
};

function puissance(x: number, y: number): number {
  const r = Math.pow(x, y);
  if (Number.isNaN(r) || (!Number.isFinite(r) && Number.isFinite(x) && Number.isFinite(y))) throw new ErreurMoteur('puissance invalide');
  return r;
}

export class Portee {
  v: Record<string, Valeur>;
  parent: Portee | null;
  constructor(valeurs?: Record<string, Valeur>, parent: Portee | null = null) {
    this.v = { ...(valeurs ?? {}) };
    this.parent = parent;
  }
  cherche(nom: string): Valeur {
    for (let p: Portee | null = this; p !== null; p = p.parent) {
      if (Object.prototype.hasOwnProperty.call(p.v, nom)) return p.v[nom];
    }
    if (nom === 'pi') return Math.PI;
    throw new ErreurMoteur(`nom inconnu : ${nom}`);
  }
  enfant(valeurs?: Record<string, Valeur>): Portee {
    return new Portee(valeurs, this);
  }
}

function ev(a: Noeud, p: Portee): Valeur {
  switch (a[0]) {
    case 'lit':
      return a[1];
    case 'nom':
      return p.cherche(a[1]);
    case 'liste':
      return a[1].map((e: Noeud) => ev(e, p));
    case 'neg':
      return -num(ev(a[1], p));
    case 'non':
      return !vrai(ev(a[1], p));
    case 'et':
      return vrai(ev(a[1], p)) && vrai(ev(a[2], p));
    case 'ou':
      return vrai(ev(a[1], p)) || vrai(ev(a[2], p));
    case 'cmp': {
      const op = a[1];
      let x = ev(a[2], p);
      let y = ev(a[3], p);
      if (op === '==') return egal(x, y);
      if (op === '!=') return !egal(x, y);
      if (!(typeof x === 'string' && typeof y === 'string')) {
        x = num(x);
        y = num(y);
      }
      return op === '<' ? x < y : op === '<=' ? x <= y : op === '>' ? x > y : x >= y;
    }
    case 'bin': {
      const op = a[1];
      const x = ev(a[2], p);
      const y = ev(a[3], p);
      if (op === '+' && (typeof x === 'string' || typeof y === 'string' || estObjet(x) || estObjet(y))) {
        if (estBilingue(x) || estBilingue(y)) {
          const r: Record<string, string> = {};
          for (const lg of ['fr', 'en'] as const) r[lg] = (estBilingue(x) ? x[lg] : texteBrut(x)) + (estBilingue(y) ? y[lg] : texteBrut(y));
          return r;
        }
        return texteBrut(x) + texteBrut(y);
      }
      const u = num(x);
      const w = num(y);
      switch (op) {
        case '+':
          return u + w;
        case '-':
          return u - w;
        case '*':
          return u * w;
        case '/':
          if (w === 0) throw new ErreurMoteur('division par zéro');
          return u / w;
        case '%':
          if (w === 0) throw new ErreurMoteur('modulo par zéro');
          return u - w * Math.floor(u / w);
        case '^':
          return puissance(u, w);
      }
      throw new ErreurMoteur(`opérateur ${op}`);
    }
    case 'champ': {
      const o = ev(a[1], p);
      if (estObjet(o) && Object.prototype.hasOwnProperty.call(o, a[2])) return o[a[2]];
      throw new ErreurMoteur(`champ inconnu : ${a[2]}`);
    }
    case 'index': {
      const o = ev(a[1], p);
      const i = ev(a[2], p);
      if (Array.isArray(o)) return o[index(i, o.length)];
      if (estObjet(o) && typeof i === 'string' && Object.prototype.hasOwnProperty.call(o, i)) return o[i];
      throw new ErreurMoteur('indexation invalide');
    }
    case 'appel': {
      const nom: string = a[1];
      const args: Noeud[] = a[2];
      if (nom === 'si') {
        if (args.length !== 3) throw new ErreurMoteur('si(condition, alors, sinon)');
        return vrai(ev(args[0], p)) ? ev(args[1], p) : ev(args[2], p);
      }
      const f = FONCTIONS[nom];
      if (f === undefined) throw new ErreurMoteur(`fonction inconnue : ${nom}`);
      return f(...args.map((x) => ev(x, p)));
    }
  }
  throw new ErreurMoteur(`nœud inconnu ${a[0]}`);
}

function estObjet(v: Valeur): boolean {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function evaluer(expr: Valeur, p: Portee): Valeur {
  if (typeof expr === 'string') {
    const v = ev(analyser(expr), p);
    if (typeof v === 'number' && !Number.isFinite(v)) throw new ErreurMoteur(`résultat non fini : ${expr}`);
    return v;
  }
  return expr;
}

// ===================================================================================================== gabarits
type Morceau = ['txt', string] | ['expr', string, string];

function decouperGabarit(t: string): Morceau[] {
  const out: Morceau[] = [];
  const n = t.length;
  let i = 0;
  let buf = '';
  while (i < n) {
    const c = t[i];
    if (c === '{' && t[i + 1] === '{') {
      buf += '{';
      i += 2;
      continue;
    }
    if (c === '}' && t[i + 1] === '}') {
      buf += '}';
      i += 2;
      continue;
    }
    if (c === '{') {
      if (buf) {
        out.push(['txt', buf]);
        buf = '';
      }
      let j = i + 1;
      let prof = 0;
      let quote: string | null = null;
      let dp = -1;
      while (j < n) {
        const d = t[j];
        if (quote) {
          if (d === '\\') {
            j += 2;
            continue;
          }
          if (d === quote) quote = null;
        } else if (d === "'" || d === '"') quote = d;
        else if (d === '(' || d === '[') prof++;
        else if (d === ')' || d === ']') prof--;
        else if (d === ':' && prof === 0) dp = j;
        else if (d === '}' && prof === 0) break;
        j++;
      }
      if (j >= n) throw new ErreurMoteur(`accolade non fermée : ${t}`);
      if (dp >= 0) out.push(['expr', t.slice(i + 1, dp).trim(), t.slice(dp + 1, j).trim()]);
      else out.push(['expr', t.slice(i + 1, j).trim(), '']);
      i = j + 1;
      continue;
    }
    buf += c;
    i++;
  }
  if (buf) out.push(['txt', buf]);
  return out;
}

const CACHE_GAB = new Map<string, Morceau[]>();

export function gabarit(t: Valeur, p: Portee, langue: Langue): string | null {
  if (t === null || t === undefined) return null;
  const s: string = typeof t === 'object' ? t[langue] : t;
  let m = CACHE_GAB.get(s);
  if (m === undefined) {
    m = decouperGabarit(s);
    CACHE_GAB.set(s, m);
  }
  let out = '';
  for (const k of m) {
    if (k[0] === 'txt') out += k[1];
    else out += formater(ev(analyser(k[1]), p), k[2], langue);
  }
  return out;
}

// ===================================================================================================== figures
const PRIMITIVES = ['ligne', 'polyligne', 'polygone', 'rect', 'cercle', 'ellipse', 'arc', 'texte', 'fleche', 'image', 'groupe', 'carte', 'globe'];
const STYLE = ['trait', 'remplissage', 'couleur', 'tirets', 'ancre', 'base', 'gras', 'italique', 'police', 'choix', 'role',
  'pointe', 'secteur', 'lisse'];
const NUMERIQUES: Record<string, string[]> = {
  ligne: ['x1', 'y1', 'x2', 'y2'], fleche: ['x1', 'y1', 'x2', 'y2', 'tete'], rect: ['x', 'y', 'l', 'h', 'rayon'],
  cercle: ['cx', 'cy', 'r'], ellipse: ['cx', 'cy', 'rx', 'ry', 'rotation'], arc: ['cx', 'cy', 'r', 'debut', 'fin'],
  texte: ['x', 'y', 'taille', 'rotation', 'largeur'], image: ['x', 'y', 'l', 'h'], polyligne: [], polygone: [],
  carte: ['x', 'y', 'l', 'h', 'lon_min', 'lon_max', 'lat_min', 'lat_max'], globe: ['cx', 'cy', 'r', 'lon0', 'lat0'],
};
const NUM_COMMUNS = ['epaisseur', 'opacite'];
const DECIMALES_FIGURE = 3;

function r3(x: number): number {
  if (!Number.isFinite(x)) throw new ErreurMoteur('coordonnée non finie');
  const v = arrondi(x, DECIMALES_FIGURE);
  return v === 0 ? 0 : v;
}

type Elt = Record<string, Valeur>;
type Macros = Record<string, Elt>;

class Ctx {
  macros: Macros;
  langue: Langue;
  profondeur = 0;
  compte = 0;
  constructor(macros: Macros | undefined, langue: Langue) {
    this.macros = macros ?? {};
    this.langue = langue;
  }
}

const numExpr = (v: Valeur, p: Portee): number => num(evaluer(v, p), 'coordonnée');

function points(v: Valeur, p: Portee): number[][] {
  const pts: Valeur[] = typeof v === 'string' ? evaluer(v, p) : v.map((q: Valeur[]) => [evaluer(q[0], p), evaluer(q[1], p)]);
  return pts.map((q) => [num(q[0]), num(q[1])]);
}

function styles(e: Elt, p: Portee, out: Elt): void {
  for (const k of STYLE) {
    if (k in e) {
      let v = e[k];
      if (['trait', 'remplissage', 'couleur', 'choix', 'role'].includes(k) && typeof v === 'string' && v.startsWith('=')) v = evaluer(v.slice(1), p);
      out[k] = v;
    }
  }
  if ('tirets' in e && (Array.isArray(e.tirets) || typeof e.tirets === 'string')) {
    const t = typeof e.tirets === 'string' ? evaluer(e.tirets, p) : e.tirets;
    out.tirets = t.map((x: Valeur) => r3(numExpr(x, p)));
  }
  for (const k of NUM_COMMUNS) if (k in e) out[k] = r3(numExpr(e[k], p));
  if ('afficher' in e) out.afficher = e.afficher;
}

class Repere {
  x: number; y: number; l: number; h: number;
  xmin: number; xmax: number; ymin: number; ymax: number;
  xlog: boolean; ylog: boolean;
  constructor(e: Elt, p: Portee) {
    const g = (k: string, d = NaN): number => (k in e ? numExpr(e[k], p) : d);
    this.x = g('x', 0); this.y = g('y', 0); this.l = g('l'); this.h = g('h');
    this.xmin = g('xmin'); this.xmax = g('xmax'); this.ymin = g('ymin'); this.ymax = g('ymax');
    this.xlog = !!e.xlog; this.ylog = !!e.ylog;
    if ((this.xlog && (this.xmin <= 0 || this.xmax <= 0)) || (this.ylog && (this.ymin <= 0 || this.ymax <= 0))) {
      throw new ErreurMoteur('axe logarithmique : bornes positives requises');
    }
  }
  fx(v: number): number {
    if (this.xlog) {
      if (v <= 0) throw new ErreurMoteur('valeur ≤ 0 sur axe log');
      return (Math.log10(v) - Math.log10(this.xmin)) / (Math.log10(this.xmax) - Math.log10(this.xmin));
    }
    return (v - this.xmin) / (this.xmax - this.xmin);
  }
  fy(v: number): number {
    if (this.ylog) {
      if (v <= 0) throw new ErreurMoteur('valeur ≤ 0 sur axe log');
      return (Math.log10(v) - Math.log10(this.ymin)) / (Math.log10(this.ymax) - Math.log10(this.ymin));
    }
    return (v - this.ymin) / (this.ymax - this.ymin);
  }
  X(v: number): number {
    return this.x + this.fx(v) * this.l;
  }
  Y(v: number): number {
    return this.y + this.h - this.fy(v) * this.h;
  }
}

function graduations(vmin: number, vmax: number, pas: Valeur, log: boolean): number[] {
  const out: number[] = [];
  if (log) {
    const a = Math.ceil(Math.log10(vmin) - 1e-9);
    const b = Math.floor(Math.log10(vmax) + 1e-9);
    for (let k = a; k <= b; k++) out.push(Math.pow(10, k));
    return out;
  }
  if (Array.isArray(pas)) return pas.map((x) => num(x));
  const a = Math.ceil(vmin / pas - 1e-9);
  const b = Math.floor(vmax / pas + 1e-9);
  for (let k = a; k <= b; k++) out.push(k * pas);
  return out;
}

function etiquetteLog(v: number): string {
  return '10' + exposant(String(Math.round(Math.log10(v))));
}

function developper(elements: Elt[], p: Portee, ctx: Ctx, rep: Repere | null = null): Elt[] {
  const out: Elt[] = [];
  for (const e of elements) out.push(...developperUn(e, p, ctx, rep));
  return out;
}

function developperUn(e: Elt, p: Portee, ctx: Ctx, rep: Repere | null): Elt[] {
  ctx.compte++;
  if (ctx.compte > 200000) throw new ErreurMoteur('figure trop grande');
  const t = e.type;
  if ('si' in e && t !== 'si' && !vrai(evaluer(e.si, p))) return [];
  if (t === 'si') return developper(vrai(evaluer(e.condition, p)) ? e.alors ?? [] : e.sinon ?? [], p, ctx, rep);
  if (t === 'variables') throw new ErreurMoteur('« variables » doit être placé dans un bloc');
  if (t === 'bloc') {
    const q = p.enfant();
    for (const [nom, ex] of e.variables ?? []) q.v[nom] = evaluer(ex, q);
    return developper(e.elements ?? [], q, ctx, rep);
  }
  if (t === 'repeter') {
    const de = numExpr(e.de, p);
    const a = numExpr(e.a, p);
    const pas = numExpr(e.pas ?? 1, p);
    if (pas <= 0) throw new ErreurMoteur('pas ≤ 0');
    const n = Math.floor((a - de) / pas + 1e-9);
    if (n > 10000) throw new ErreurMoteur('boucle trop longue');
    const out: Elt[] = [];
    for (let k = 0; k <= n; k++) {
      const q = p.enfant({ [e.var]: de + k * pas });
      for (const [nom, ex] of e.variables ?? []) q.v[nom] = evaluer(ex, q);
      out.push(...developper(e.elements, q, ctx, rep));
    }
    return out;
  }
  if (t === 'macro') {
    const m = ctx.macros[e.nom];
    if (m === undefined) throw new ErreurMoteur(`macro inconnue : ${e.nom}`);
    ctx.profondeur++;
    if (ctx.profondeur > 20) throw new ErreurMoteur('macros trop imbriquées');
    const vals: Record<string, Valeur> = {};
    const params = e.params ?? {};
    for (const [k, d] of Object.entries(m.params ?? {})) vals[k] = k in params ? evaluer(params[k], p) : evaluer(d, new Portee());
    for (const k of Object.keys(params)) if (!(k in (m.params ?? {}))) throw new ErreurMoteur(`paramètre inconnu ${k} pour la macro ${e.nom}`);
    const q = new Portee(vals);
    for (const [nom, ex] of m.variables ?? []) q.v[nom] = evaluer(ex, q);
    const corps = developper(m.elements, q, ctx, rep);
    ctx.profondeur--;
    const g: Elt = { type: 'groupe' };
    if ('translation' in e) g.translation = [r3(numExpr(e.translation[0], p)), r3(numExpr(e.translation[1], p))];
    for (const k of ['rotation', 'echelle']) if (k in e) g[k] = r3(numExpr(e[k], p));
    styles(e, p, g);
    if (Object.keys(g).length === 1) return corps;
    g.elements = corps;
    return [g];
  }
  if (t === 'groupe') {
    const g: Elt = { type: 'groupe' };
    if ('translation' in e) g.translation = [r3(numExpr(e.translation[0], p)), r3(numExpr(e.translation[1], p))];
    for (const k of ['rotation', 'echelle']) if (k in e) g[k] = r3(numExpr(e[k], p));
    if ('decoupe' in e) g.decoupe = e.decoupe.map((v: Valeur) => r3(numExpr(v, p)));
    styles(e, p, g);
    g.elements = developper(e.elements ?? [], p, ctx, rep);
    return [g];
  }
  if (t === 'repere') return developperRepere(e, p, ctx);
  if (t === 'courbe') return developperCourbe(e, p, ctx, rep);
  if (t === 'points') {
    const pts = points(e.points, p);
    const r = numExpr(e.r ?? 3, p);
    const out: Elt[] = [];
    for (const [x, y] of pts) {
      const X = rep ? rep.X(x) : x;
      const Y = rep ? rep.Y(y) : y;
      const o: Elt = (e.forme ?? 'cercle') === 'carre'
        ? { type: 'rect', x: r3(X - r), y: r3(Y - r), l: r3(2 * r), h: r3(2 * r) }
        : { type: 'cercle', cx: r3(X), cy: r3(Y), r: r3(r) };
      styles(e, p, o);
      out.push(o);
    }
    return out;
  }
  if (!PRIMITIVES.includes(t)) throw new ErreurMoteur(`type de figure inconnu : ${t}`);
  const o: Elt = { type: t };
  for (const k of NUMERIQUES[t]) if (k in e) o[k] = numExpr(e[k], p);
  if (t === 'polyligne' || t === 'polygone') o.points = points(e.points, p);
  if (t === 'texte') o.texte = gabarit(e.texte, p, ctx.langue);
  if (t === 'image') o.ref = gabarit(e.ref, p, ctx.langue);
  if (rep !== null) versRepere(o, rep);
  for (const k of Object.keys(o)) if (typeof o[k] === 'number') o[k] = r3(o[k]);
  if ('points' in o) o.points = o.points.map(([x, y]: number[]) => [r3(x), r3(y)]);
  styles(e, p, o);
  return [o];
}

function versRepere(o: Elt, rep: Repere): void {
  const t = o.type;
  if (t === 'ligne' || t === 'fleche') {
    [o.x1, o.y1, o.x2, o.y2] = [rep.X(o.x1), rep.Y(o.y1), rep.X(o.x2), rep.Y(o.y2)];
  } else if (t === 'polyligne' || t === 'polygone') {
    o.points = o.points.map(([x, y]: number[]) => [rep.X(x), rep.Y(y)]);
  } else if (t === 'cercle' || t === 'ellipse' || t === 'arc') {
    [o.cx, o.cy] = [rep.X(o.cx), rep.Y(o.cy)];
  } else if (t === 'texte' || t === 'image') {
    [o.x, o.y] = [rep.X(o.x), rep.Y(o.y)];
  } else if (t === 'rect') {
    const x1 = rep.X(o.x);
    const y1 = rep.Y(o.y);
    const x2 = rep.X(o.x + o.l);
    const y2 = rep.Y(o.y + o.h);
    [o.x, o.y, o.l, o.h] = [Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)];
  }
}

function developperCourbe(e: Elt, p: Portee, ctx: Ctx, rep: Repere | null): Elt[] {
  const n = Math.trunc(numExpr(e.n ?? 100, p));
  if (n < 1 || n > 5000) throw new ErreurMoteur('courbe : n hors limites');
  const segments: number[][][] = [[]];
  const essai = (f: () => number[] | null) => {
    let r: number[] | null = null;
    try {
      r = f();
    } catch (err) {
      if (!(err instanceof ErreurMoteur)) throw err;
      r = null;
    }
    if (r !== null) segments[segments.length - 1].push(r);
    else if (segments[segments.length - 1].length) segments.push([]);
  };
  if ('fonction' in e) {
    const de = numExpr(e.de, p);
    const a = numExpr(e.a, p);
    const v = e.var ?? 'x';
    const ast = analyser(e.fonction);
    const garde = 'garde' in e ? analyser(e.garde) : null;
    for (let k = 0; k <= n; k++) {
      const x = de + ((a - de) * k) / n;
      essai(() => {
        const pp = p.enfant({ [v]: x });
        const y = num(ev(ast, pp));
        if (!Number.isFinite(y)) return null;
        if (garde !== null && !vrai(ev(garde, pp))) return null;
        if (rep !== null && rep.ylog && y <= 0) return null;
        return [x, y];
      });
    }
  } else {
    const de = numExpr(e.t_de, p);
    const a = numExpr(e.t_a, p);
    const ax = analyser(e.x);
    const ay = analyser(e.y);
    const garde = 'garde' in e ? analyser(e.garde) : null;
    for (let k = 0; k <= n; k++) {
      const tt = de + ((a - de) * k) / n;
      essai(() => {
        const q = p.enfant({ t: tt });
        const x = num(ev(ax, q));
        const y = num(ev(ay, q));
        if (garde !== null && !vrai(ev(garde, q))) return null;
        return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
      });
    }
  }
  const out: Elt[] = [];
  for (let s of segments) {
    if (s.length < 2) continue;
    if (rep !== null) s = s.map(([x, y]) => [rep.X(x), rep.Y(y)]);
    const o: Elt = { type: e.ferme ? 'polygone' : 'polyligne', points: s.map(([x, y]) => [r3(x), r3(y)]) };
    styles(e, p, o);
    out.push(o);
  }
  return out;
}

function developperRepere(e: Elt, p: Portee, ctx: Ctx): Elt[] {
  const rep = new Repere(e, p);
  const out: Elt[] = [];
  const trait = e.couleur_axes ?? 'trait';
  const taille = numExpr(e.taille_texte ?? 11, p);
  const interieur: Elt = { type: 'groupe', decoupe: [r3(rep.x), r3(rep.y), r3(rep.l), r3(rep.h)], elements: developper(e.elements ?? [], p, ctx, rep) };
  for (const axe of ['x', 'y']) {
    const pas = e['graduations_' + axe];
    if (pas === undefined || pas === null) continue;
    const pasV = Array.isArray(pas) ? pas : numExpr(pas, p);
    const log = axe === 'x' ? rep.xlog : rep.ylog;
    const [vmin, vmax] = axe === 'x' ? [rep.xmin, rep.xmax] : [rep.ymin, rep.ymax];
    if (!log && !Array.isArray(pasV) && pasV <= 0) throw new ErreurMoteur('graduation ≤ 0');
    const vals = graduations(Math.min(vmin, vmax), Math.max(vmin, vmax), pasV, log);
    if (vals.length > 200) throw new ErreurMoteur('trop de graduations');
    const spec = e['format_' + axe] ?? '';
    const etiq = e['etiquettes_' + axe] ?? true;
    for (const v of vals) {
      if (axe === 'x') {
        const X = rep.X(v);
        if (e.grille) out.push({ type: 'ligne', x1: r3(X), y1: r3(rep.y), x2: r3(X), y2: r3(rep.y + rep.h), trait: 'grille', epaisseur: 0.5 });
        out.push({ type: 'ligne', x1: r3(X), y1: r3(rep.y + rep.h), x2: r3(X), y2: r3(rep.y + rep.h + 4), trait, epaisseur: 1 });
        if (etiq) {
          const txt = log ? etiquetteLog(v) : formater(v, spec, ctx.langue);
          out.push({ type: 'texte', x: r3(X), y: r3(rep.y + rep.h + 6), texte: txt, taille: r3(taille), ancre: 'milieu', base: 'haut', couleur: trait });
        }
      } else {
        const Y = rep.Y(v);
        if (e.grille) out.push({ type: 'ligne', x1: r3(rep.x), y1: r3(Y), x2: r3(rep.x + rep.l), y2: r3(Y), trait: 'grille', epaisseur: 0.5 });
        out.push({ type: 'ligne', x1: r3(rep.x - 4), y1: r3(Y), x2: r3(rep.x), y2: r3(Y), trait, epaisseur: 1 });
        if (etiq) {
          const txt = log ? etiquetteLog(v) : formater(v, spec, ctx.langue);
          out.push({ type: 'texte', x: r3(rep.x - 6), y: r3(Y), texte: txt, taille: r3(taille), ancre: 'fin', base: 'milieu', couleur: trait });
        }
      }
    }
  }
  out.push(interieur);
  if (e.cadre ?? true) out.push({ type: 'rect', x: r3(rep.x), y: r3(rep.y), l: r3(rep.l), h: r3(rep.h), trait, epaisseur: 1.5 });
  else out.push({ type: 'polyligne', points: [[r3(rep.x), r3(rep.y)], [r3(rep.x), r3(rep.y + rep.h)], [r3(rep.x + rep.l), r3(rep.y + rep.h)]], trait, epaisseur: 1.5 });
  if ('titre_x' in e) {
    const dy = e.graduations_x !== undefined && e.graduations_x !== null && (e.etiquettes_x ?? true) ? 24 : 8;
    out.push({ type: 'texte', x: r3(rep.x + rep.l / 2), y: r3(rep.y + rep.h + dy), texte: gabarit(e.titre_x, p, ctx.langue), taille: r3(taille + 1), ancre: 'milieu', base: 'haut', couleur: trait });
  }
  if ('titre_y' in e) {
    const dx = numExpr(e.marge_titre_y ?? (e.graduations_y !== undefined && e.graduations_y !== null && (e.etiquettes_y ?? true) ? 34 : 10), p);
    out.push({ type: 'texte', x: r3(rep.x - dx), y: r3(rep.y + rep.h / 2), texte: gabarit(e.titre_y, p, ctx.langue), taille: r3(taille + 1), ancre: 'milieu', base: 'bas', rotation: 90, couleur: trait });
  }
  return out;
}

export function developperFigure(fig: Elt | null | undefined, p: Portee, langue: Langue, macros?: Macros): Elt | null {
  if (fig === null || fig === undefined) return null;
  const ctx = new Ctx(macros, langue);
  const q = p.enfant();
  for (const [nom, ex] of fig.variables ?? []) q.v[nom] = evaluer(ex, q);
  if ('si' in fig && !vrai(evaluer(fig.si, q))) return null;
  const out: Elt = { vue: [r3(numExpr(fig.vue[0], q)), r3(numExpr(fig.vue[1], q))], elements: developper(fig.elements ?? [], q, ctx) };
  if ('fond' in fig) out.fond = fig.fond;
  if ('alt' in fig) out.alt = gabarit(fig.alt, q, langue);
  return out;
}

// ===================================================================================================== instances
const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export type Question = Record<string, Valeur>;

function valeursOption(o: Elt, rang: number): Record<string, Valeur> {
  return { ...(o.valeurs ?? {}), id: o.id, rang, libelle: o.libelle };
}

function choisirParametres(q: Question, p: Portee, demandes: Record<string, string> | undefined, alea: Alea, hasard: boolean): Record<string, string> {
  const choisis: Record<string, string> = {};
  for (const prm of q.parametres ?? []) {
    const dispo: [number, Elt][] = [];
    prm.options.forEach((o: Elt, k: number) => {
      if ('si' in o && !vrai(evaluer(o.si, p))) return;
      dispo.push([k, o]);
    });
    if (!dispo.length) throw new ErreurMoteur(`aucune option disponible pour ${prm.id}`);
    let choix: [number, Elt];
    if (hasard) choix = dispo[Math.floor(alea.uniforme() * dispo.length)];
    else {
      const voulu = demandes?.[prm.id] ?? prm.defaut;
      choix = dispo.find(([, o]) => o.id === voulu) ?? dispo[0];
    }
    choisis[prm.id] = choix[1].id;
    p.v[prm.id] = valeursOption(choix[1], choix[0]);
  }
  return choisis;
}

function tirer(t: Elt, p: Portee, alea: Alea): Valeur {
  switch (t.type) {
    case 'entier':
      return alea.entier(Math.trunc(num(evaluer(t.min, p))), Math.trunc(num(evaluer(t.max, p))));
    case 'reel': {
      const a = num(evaluer(t.min, p));
      const b = num(evaluer(t.max, p));
      if ('pas' in t) {
        const pas = num(evaluer(t.pas, p));
        const n = Math.floor((b - a) / pas + 0.5);
        return a + pas * Math.floor(alea.uniforme() * (n + 1));
      }
      return a + alea.uniforme() * (b - a);
    }
    case 'choix': {
      const vals = evaluer(t.valeurs, p);
      return vals[Math.floor(alea.uniforme() * vals.length)];
    }
    case 'permutation':
      return alea.permutation(Math.trunc(num(evaluer(t.n, p))));
  }
  throw new ErreurMoteur(`tirage inconnu : ${t.type}`);
}

function idsBonnes(spec: Valeur, p: Portee): string[] {
  if (Array.isArray(spec)) return spec.flatMap((s) => idsBonnes(s, p));
  const txt = gabarit(spec, p, 'en') as string;
  return txt.replace(/,/g, ' ').split(/\s+/).filter((x) => x);
}

export type OptionsInstance = {
  graine?: string;
  parametres?: Record<string, string>;
  langue?: Langue;
  hasardParametres?: boolean;
  macros?: Macros;
  ordreOrigine?: boolean;
};

export function instancier(q: Question, opts: OptionsInstance = {}): Record<string, Valeur> {
  const graine = String(opts.graine ?? '0');
  const langue = opts.langue ?? 'fr';
  if (langue !== 'fr' && langue !== 'en') throw new ErreurMoteur('langue fr ou en');
  const alea = new Alea(graine + '|' + q.id);
  const racine = new Portee(q.donnees ?? {});
  const base = racine.enfant();
  const choisis = choisirParametres(q, base, opts.parametres, alea, !!opts.hasardParametres);
  let p = base;
  let ok = false;
  for (let essai = 0; essai <= 1000; essai++) {
    p = base.enfant();
    for (const t of q.aleatoire ?? []) p.v[t.id] = tirer(t, p, alea);
    for (const [nom, ex] of q.variables ?? []) p.v[nom] = evaluer(ex, p);
    if (!('contrainte' in q) || vrai(evaluer(q.contrainte, p))) {
      ok = true;
      break;
    }
  }
  if (!ok) throw new ErreurMoteur('contrainte jamais satisfaite (1000 essais)');
  let choix: Elt[] = (q.choix ?? []).filter((c: Elt) => !('si' in c) || vrai(evaluer(c.si, p)));
  const bonnes = q.bonne !== undefined && q.bonne !== null ? idsBonnes(q.bonne, p) : [];
  const ids = choix.map((c) => c.id);
  for (const b of bonnes) if (!ids.includes(b)) throw new ErreurMoteur(`bonne réponse ${b} absente des choix ${ids}`);
  if (q.choix_conserves !== undefined && q.choix_conserves !== null && choix.length) {
    const k = Math.trunc(num(evaluer(q.choix_conserves, p)));
    if (k < choix.length) {
      const autres = choix.filter((c) => !bonnes.includes(c.id));
      const perm = alea.permutation(autres.length);
      const garder = new Set<string>([...perm.slice(0, Math.max(0, k - bonnes.length)).map((i) => autres[i].id), ...bonnes]);
      choix = choix.filter((c) => garder.has(c.id));
    }
  }
  if (q.melange && !opts.ordreOrigine && choix.length > 1) {
    const perm = alea.permutation(choix.length);
    choix = perm.map((i) => choix[i]);
  }
  const macros = q.macros ? { ...(opts.macros ?? {}), ...q.macros } : opts.macros;
  const sortieChoix: Elt[] = choix.map((c, k) => {
    const pc = p.enfant({ lettre: LETTRES[k] });
    const sc: Elt = { id: c.id, lettre: LETTRES[k] };
    if ('texte' in c) sc.texte = gabarit(c.texte, pc, langue);
    if ('figure' in c) sc.figure = developperFigure(c.figure, pc, langue, macros);
    return sc;
  });
  const lettreDe: Record<string, string> = {};
  for (const c of sortieChoix) lettreDe[c.id] = c.lettre;
  const bonnesLettres = bonnes.map((b) => lettreDe[b]);
  const pr = p.enfant({ bonne_lettre: bonnesLettres[0] ?? '', bonnes_lettres: bonnesLettres.join(', '), lettre_de: lettreDe });
  return {
    id: q.id, graine, langue, version_moteur: VERSION_MOTEUR,
    parametres: choisis,
    valeurs: valeursExposees(q, p),
    titre: gabarit(q.titre, pr, langue),
    enonce: gabarit(q.enonce, pr, langue),
    choix: sortieChoix,
    bonnes, bonnes_lettres: bonnesLettres,
    indice: gabarit(q.indice ?? null, pr, langue),
    explication: gabarit(q.explication ?? null, pr, langue),
    elements_de_reponse: (q.elements_de_reponse ?? []).map((t: Valeur) => gabarit(t, pr, langue)),
    figure: developperFigure(q.figure, pr, langue, macros),
    figure_indice: developperFigure(q.figure_indice, pr, langue, macros),
    tirages: alea.tirages,
  };
}

function exposer(v: Valeur): Valeur {
  if (typeof v === 'number') return arrondiSig(v, 12);
  if (Array.isArray(v)) return v.map(exposer);
  if (v !== null && typeof v === 'object') {
    const o: Record<string, Valeur> = {};
    for (const k of Object.keys(v)) o[k] = exposer(v[k]);
    return o;
  }
  return v;
}

function valeursExposees(q: Question, p: Portee): Record<string, Valeur> {
  const out: Record<string, Valeur> = {};
  const noms = [...(q.aleatoire ?? []).map((t: Elt) => t.id), ...(q.variables ?? []).map((x: Valeur[]) => x[0])];
  for (const n of noms) out[n] = exposer(p.cherche(n));
  return out;
}

/** Toutes les combinaisons des menus « Adapt Question », options indisponibles exclues. */
export function variantes(q: Question): Record<string, string>[] {
  const prms: Elt[] = q.parametres ?? [];
  let res: Record<string, string>[] = [{}];
  for (const prm of prms) {
    const nouv: Record<string, string>[] = [];
    for (const r of res) {
      const p = new Portee(q.donnees ?? {}).enfant();
      for (const p2 of prms) {
        if (p2.id in r) {
          const k = p2.options.findIndex((o: Elt) => o.id === r[p2.id]);
          p.v[p2.id] = valeursOption(p2.options[k], k);
        }
      }
      prm.options.forEach((o: Elt) => {
        if ('si' in o && !vrai(evaluer(o.si, p))) return;
        nouv.push({ ...r, [prm.id]: o.id });
      });
    }
    res = nouv;
  }
  return res;
}

// ===================================================================================================== JSON canonique
/** Sérialisation identique à json_canonique (Python) : clés triées (unités UTF-16), nombres String(x). */
export function jsonCanonique(v: Valeur): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return nombreJs(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(jsonCanonique).join(',') + ']';
  const cles = Object.keys(v).sort();
  return '{' + cles.map((k) => JSON.stringify(k) + ':' + jsonCanonique(v[k])).join(',') + '}';
}
