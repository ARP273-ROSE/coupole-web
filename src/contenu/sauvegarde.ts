/**
 * Sauvegarde de tout ce que l'utilisateur fait (schéma commun à Coupole Web et à Coupole, versionné) :
 * réglages de chaque animation, réponses, scores et tentatives des questions, progression par module, « Mes
 * modules », préférences.  Logique pure (sans DOM ni stockage) : mêmes fonctions, nom pour nom, dans
 * `coupole/modules/anim/classe/sauvegarde.py` ; mêmes cas de test (`tests/references/sauvegarde_cas.json`).
 *
 * Format (version 1) :
 *   { format: "coupole-sauvegarde", version: 1, application, modifie,
 *     preferences: { langue?, theme?, … },
 *     animations: { <id>: { reglages: {cle: valeur}, modifie } },
 *     questions:  { <id>: { tentatives: [{date, reponse: [ids], juste, parametres, graine}], reponse_vue, indice_vu,
 *                           a_revoir } },
 *     modules:    { <clé>: { derniere_question, visite } },
 *     mes_modules: [ { id, nom, cree, modifie, elements: [{genre, id}] } ] }
 * Version 0 (avant 0.4.0) : réglages dispersés « reglages:<id> », « theme », « langue » → `migrer`.
 */

export const FORMAT = 'coupole-sauvegarde';
export const VERSION = 1;
export const MAX_TENTATIVES = 50;
export const GENRES = ['question', 'animation', 'fiche', 'table', 'image'] as const;
export type Genre = (typeof GENRES)[number];

export type ValeurReglage = number | boolean | string | null;
export type Reglages = Record<string, ValeurReglage>;
export interface Tentative {
  date: string;
  reponse: string[];
  juste: boolean;
  parametres: Record<string, string>;
  graine: string;
}
export interface SuiviQuestion {
  tentatives: Tentative[];
  reponse_vue: boolean;
  indice_vu: boolean;
  a_revoir: boolean;
}
export interface Element {
  genre: Genre;
  id: string;
}
export interface MonModule {
  id: string;
  nom: string;
  cree: string;
  modifie: string;
  elements: Element[];
}
export interface Sauvegarde {
  format: typeof FORMAT;
  version: number;
  application: string;
  modifie: string;
  preferences: Record<string, ValeurReglage>;
  animations: Record<string, { reglages: Reglages; modifie: string }>;
  questions: Record<string, SuiviQuestion>;
  modules: Record<string, { derniere_question: string | null; visite: string }>;
  mes_modules: MonModule[];
}

const CLE = /^[A-Za-z0-9_:.\-]{1,80}$/;
const DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const EPOQUE = '1970-01-01T00:00:00Z';

export function maintenant(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function vide(application = '', date = EPOQUE): Sauvegarde {
  return { format: FORMAT, version: VERSION, application, modifie: date, preferences: {}, animations: {}, questions: {}, modules: {}, mes_modules: [] };
}

function objet(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function date(v: unknown, defaut = EPOQUE): string {
  return typeof v === 'string' && DATE.test(v) ? v : defaut;
}

function texte(v: unknown, max = 200): string | null {
  return typeof v === 'string' && v.length <= max ? v : null;
}

/** Valeurs de réglages acceptées : nombres finis, booléens, chaînes courtes, null ; clés simples. */
export function reglagesValides(v: unknown): Reglages {
  const out: Reglages = {};
  const o = objet(v);
  if (!o) return out;
  for (const k of Object.keys(o).sort()) {
    if (!/^[A-Za-z0-9_]{1,40}$/.test(k)) continue;
    const x = o[k];
    if (typeof x === 'number' && Number.isFinite(x)) out[k] = x;
    else if (typeof x === 'boolean') out[k] = x;
    else if (typeof x === 'string' && x.length <= 80) out[k] = x;
    else if (x === null) out[k] = null;
  }
  return out;
}

function tentativeValide(v: unknown): Tentative | null {
  const o = objet(v);
  if (!o) return null;
  const rep = Array.isArray(o.reponse) ? o.reponse.filter((x): x is string => typeof x === 'string' && x.length <= 40).slice(0, 26) : [];
  const prm: Record<string, string> = {};
  const p = objet(o.parametres);
  if (p) for (const k of Object.keys(p).sort()) if (CLE.test(k) && typeof p[k] === 'string' && (p[k] as string).length <= 80) prm[k] = p[k] as string;
  return {
    date: date(o.date),
    reponse: rep,
    juste: o.juste === true,
    parametres: prm,
    graine: texte(o.graine, 80) ?? '0',
  };
}

function suiviValide(v: unknown): SuiviQuestion | null {
  const o = objet(v);
  if (!o) return null;
  const t = Array.isArray(o.tentatives) ? o.tentatives.map(tentativeValide).filter((x): x is Tentative => x !== null) : [];
  t.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return {
    tentatives: t.slice(-MAX_TENTATIVES),
    reponse_vue: o.reponse_vue === true,
    indice_vu: o.indice_vu === true,
    a_revoir: o.a_revoir === true,
  };
}

function elementValide(v: unknown): Element | null {
  const o = objet(v);
  if (!o) return null;
  const g = o.genre;
  const id = texte(o.id, 80);
  if (!id || !CLE.test(id) || !(GENRES as readonly unknown[]).includes(g)) return null;
  return { genre: g as Genre, id };
}

function monModuleValide(v: unknown): MonModule | null {
  const o = objet(v);
  if (!o) return null;
  const id = texte(o.id, 80);
  const nom = texte(o.nom, 120);
  if (!id || !CLE.test(id) || nom === null) return null;
  const els: Element[] = [];
  const vus = new Set<string>();
  for (const e of Array.isArray(o.elements) ? o.elements : []) {
    const x = elementValide(e);
    if (!x) continue;
    const k = x.genre + ':' + x.id;
    if (vus.has(k)) continue;
    vus.add(k);
    els.push(x);
  }
  return { id, nom: nom.trim() || id, cree: date(o.cree), modifie: date(o.modifie), elements: els.slice(0, 2000) };
}

/**
 * Lit n'importe quelle sauvegarde (version 0 ou 1, éventuellement abîmée) et rend une sauvegarde version 1 valide :
 * ce qui est illisible est ignoré, jamais d'erreur.  Une version future est refusée (null) pour ne rien écraser.
 */
export function migrer(brut: unknown, application = ''): Sauvegarde | null {
  const o = objet(brut);
  if (!o) return vide(application);
  const version = typeof o.version === 'number' ? o.version : 0;
  if (version > VERSION) return null;
  const s = vide(application, date(o.modifie));
  if (version === 0) {
    // ancien format : { reglages: {id: {...}}, theme, langue } (clés « coupole-web:… » du navigateur, regroupées)
    const r = objet(o.reglages);
    if (r) for (const id of Object.keys(r).sort()) if (CLE.test(id)) {
      const x = reglagesValides(r[id]);
      if (Object.keys(x).length) s.animations[id] = { reglages: x, modifie: s.modifie };
    }
    for (const k of ['theme', 'langue'] as const) if (typeof o[k] === 'string') s.preferences[k] = o[k] as string;
    return s;
  }
  if (o.format !== FORMAT) return vide(application);
  const p = objet(o.preferences);
  if (p) for (const k of Object.keys(p).sort()) {
    const x = reglagesValides({ [k]: p[k] });
    if (k in x) s.preferences[k] = x[k]!;
  }
  const a = objet(o.animations);
  if (a) for (const id of Object.keys(a).sort()) {
    const e = objet(a[id]);
    if (!CLE.test(id) || !e) continue;
    s.animations[id] = { reglages: reglagesValides(e.reglages), modifie: date(e.modifie) };
  }
  const q = objet(o.questions);
  if (q) for (const id of Object.keys(q).sort()) {
    const e = suiviValide(q[id]);
    if (CLE.test(id) && e) s.questions[id] = e;
  }
  const m = objet(o.modules);
  if (m) for (const id of Object.keys(m).sort()) {
    const e = objet(m[id]);
    if (!CLE.test(id) || !e) continue;
    const dq = texte(e.derniere_question, 80);
    s.modules[id] = { derniere_question: dq && CLE.test(dq) ? dq : null, visite: date(e.visite) };
  }
  const vus = new Set<string>();
  for (const x of Array.isArray(o.mes_modules) ? o.mes_modules : []) {
    const mm = monModuleValide(x);
    if (mm && !vus.has(mm.id)) {
      vus.add(mm.id);
      s.mes_modules.push(mm);
    }
  }
  return s;
}

// ------------------------------------------------------------------ fusion (import « ajouter à mes données »)
function plusRecent(a: string, b: string): boolean {
  return b > a;
}

/** Fusionne `b` (importée) dans `a` : tentatives réunies (sans doublon), le plus récent l'emporte ailleurs. */
export function fusionner(a: Sauvegarde, b: Sauvegarde): Sauvegarde {
  const s = migrer(JSON.parse(JSON.stringify(a)))!;
  for (const [k, v] of Object.entries(b.preferences)) s.preferences[k] = v;
  for (const [id, e] of Object.entries(b.animations)) {
    const x = s.animations[id];
    if (!x || !plusRecent(e.modifie, x.modifie)) s.animations[id] = { reglages: { ...e.reglages }, modifie: e.modifie };
  }
  for (const [id, e] of Object.entries(b.questions)) {
    const x = s.questions[id];
    if (!x) {
      s.questions[id] = JSON.parse(JSON.stringify(e));
      continue;
    }
    const cles = new Set(x.tentatives.map((t) => JSON.stringify(t)));
    for (const t of e.tentatives) if (!cles.has(JSON.stringify(t))) x.tentatives.push({ ...t, reponse: [...t.reponse], parametres: { ...t.parametres } });
    x.tentatives.sort((p, q) => (p.date < q.date ? -1 : p.date > q.date ? 1 : 0));
    x.tentatives = x.tentatives.slice(-MAX_TENTATIVES);
    x.reponse_vue ||= e.reponse_vue;
    x.indice_vu ||= e.indice_vu;
    x.a_revoir ||= e.a_revoir;
  }
  for (const [id, e] of Object.entries(b.modules)) {
    const x = s.modules[id];
    if (!x || !plusRecent(e.visite, x.visite)) s.modules[id] = { ...e };
  }
  for (const m of b.mes_modules) {
    const i = s.mes_modules.findIndex((x) => x.id === m.id);
    if (i < 0) s.mes_modules.push(JSON.parse(JSON.stringify(m)));
    else if (!plusRecent(m.modifie, s.mes_modules[i]!.modifie)) s.mes_modules[i] = JSON.parse(JSON.stringify(m));
  }
  s.modifie = a.modifie > b.modifie ? a.modifie : b.modifie;
  return s;
}

// ------------------------------------------------------------------ réinitialisation « tout ou partie »
export type Partie =
  | { partie: 'animation'; id: string }
  | { partie: 'module'; id: string; questions: string[] }
  | { partie: 'reglages' }
  | { partie: 'reponses' }
  | { partie: 'mes_modules' }
  | { partie: 'preferences' }
  | { partie: 'tout' };

export function reinitialiser(s: Sauvegarde, p: Partie): Sauvegarde {
  const n = migrer(JSON.parse(JSON.stringify(s)))!;
  switch (p.partie) {
    case 'animation':
      delete n.animations[p.id];
      break;
    case 'module':
      for (const q of p.questions) delete n.questions[q];
      delete n.modules[p.id];
      break;
    case 'reglages':
      n.animations = {};
      break;
    case 'reponses':
      n.questions = {};
      n.modules = {};
      break;
    case 'mes_modules':
      n.mes_modules = [];
      break;
    case 'preferences':
      n.preferences = {};
      break;
    case 'tout':
      return vide(s.application, s.modifie);
  }
  return n;
}

// ------------------------------------------------------------------ questions et progression
export function noterTentative(s: Sauvegarde, qid: string, t: Tentative): void {
  const e = (s.questions[qid] ??= { tentatives: [], reponse_vue: false, indice_vu: false, a_revoir: false });
  e.tentatives.push(t);
  if (e.tentatives.length > MAX_TENTATIVES) e.tentatives.splice(0, e.tentatives.length - MAX_TENTATIVES);
  if (!t.juste) e.a_revoir = true;
}

export function marquer(s: Sauvegarde, qid: string, champ: 'reponse_vue' | 'indice_vu' | 'a_revoir', v = true): void {
  const e = (s.questions[qid] ??= { tentatives: [], reponse_vue: false, indice_vu: false, a_revoir: false });
  e[champ] = v;
}

export type Etat = 'jamais' | 'vue' | 'reussie' | 'ratee';

/** État d'une question : sa dernière tentative décide ; sans tentative, « vue » si la réponse a été montrée. */
export function etatQuestion(s: Sauvegarde, qid: string): Etat {
  const e = s.questions[qid];
  if (!e) return 'jamais';
  const d = e.tentatives[e.tentatives.length - 1];
  if (d) return d.juste ? 'reussie' : 'ratee';
  return e.reponse_vue || e.indice_vu ? 'vue' : 'jamais';
}

export interface Bilan {
  total: number;
  essayees: number;
  reussies: number;
  ratees: number;
  a_revoir: number;
  tentatives: number;
  score: number; // réussies / essayées, 0–100 (0 sans essai)
  premier_coup: number; // questions réussies du premier coup
}

export function bilan(s: Sauvegarde, questions: string[]): Bilan {
  const b: Bilan = { total: questions.length, essayees: 0, reussies: 0, ratees: 0, a_revoir: 0, tentatives: 0, score: 0, premier_coup: 0 };
  for (const q of questions) {
    const e = s.questions[q];
    const et = etatQuestion(s, q);
    if (et === 'reussie') b.reussies++;
    if (et === 'ratee') b.ratees++;
    if (e) {
      b.tentatives += e.tentatives.length;
      if (e.tentatives.length) b.essayees++;
      if (e.tentatives[0]?.juste) b.premier_coup++;
      if (e.a_revoir || et === 'ratee') b.a_revoir++;
    }
  }
  b.score = b.essayees ? Math.round((100 * b.reussies) / b.essayees) : 0;
  return b;
}

// ------------------------------------------------------------------ « Mes modules »
let compteur = 0;

export function nouvelId(prefixe = 'mm'): string {
  compteur = (compteur + 1) % 1296;
  const t = Date.now().toString(36);
  const h = Math.floor(Math.random() * 46656).toString(36).padStart(3, '0');
  return `${prefixe}_${t}${h}${compteur.toString(36).padStart(2, '0')}`;
}

export function creerModule(s: Sauvegarde, nom: string, elements: Element[] = [], id = nouvelId(), quand = maintenant()): MonModule {
  const m = monModuleValide({ id, nom: nom.slice(0, 120), cree: quand, modifie: quand, elements })!;
  s.mes_modules.push(m);
  return m;
}

export function trouverModule(s: Sauvegarde, id: string): MonModule | undefined {
  return s.mes_modules.find((m) => m.id === id);
}

export function renommerModule(s: Sauvegarde, id: string, nom: string, quand = maintenant()): boolean {
  const m = trouverModule(s, id);
  const n = nom.trim().slice(0, 120);
  if (!m || !n) return false;
  m.nom = n;
  m.modifie = quand;
  return true;
}

export function supprimerModule(s: Sauvegarde, id: string): boolean {
  const i = s.mes_modules.findIndex((m) => m.id === id);
  if (i < 0) return false;
  s.mes_modules.splice(i, 1);
  return true;
}

export function ajouterElement(s: Sauvegarde, id: string, e: Element, quand = maintenant()): boolean {
  const m = trouverModule(s, id);
  const x = elementValide(e);
  if (!m || !x || m.elements.some((y) => y.genre === x.genre && y.id === x.id)) return false;
  m.elements.push(x);
  m.modifie = quand;
  return true;
}

export function retirerElement(s: Sauvegarde, id: string, e: Element, quand = maintenant()): boolean {
  const m = trouverModule(s, id);
  if (!m) return false;
  const i = m.elements.findIndex((y) => y.genre === e.genre && y.id === e.id);
  if (i < 0) return false;
  m.elements.splice(i, 1);
  m.modifie = quand;
  return true;
}

export function deplacerElement(s: Sauvegarde, id: string, de: number, vers: number, quand = maintenant()): boolean {
  const m = trouverModule(s, id);
  if (!m || de < 0 || de >= m.elements.length) return false;
  const v = Math.max(0, Math.min(m.elements.length - 1, vers));
  if (v === de) return false;
  const [x] = m.elements.splice(de, 1);
  m.elements.splice(v, 0, x!);
  m.modifie = quand;
  return true;
}

/** Nom libre pour un nouveau module : « Nouveau module 1 », « Copie de X », « Copie de X (2) »… */
export function nomLibre(s: Sauvegarde, base: string, numeroter = false): string {
  const pris = new Set(s.mes_modules.map((m) => m.nom));
  if (numeroter) {
    for (let i = 1; ; i++) if (!pris.has(`${base} ${i}`)) return `${base} ${i}`;
  }
  if (!pris.has(base)) return base;
  for (let i = 2; ; i++) if (!pris.has(`${base} (${i})`)) return `${base} (${i})`;
}

// ------------------------------------------------------------------ export / import
/** Texte JSON stable (clés triées, indenté) : le même document donne le même fichier sur le web et au bureau. */
export function exporter(s: Sauvegarde): string {
  const tri = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(tri);
    const o = objet(v);
    if (!o) return v;
    const r: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) r[k] = tri(o[k]);
    return r;
  };
  return JSON.stringify(tri(s), null, 1) + '\n';
}

export function importer(texte: string, application = ''): Sauvegarde | null {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return null;
  }
  const o = objet(brut);
  if (!o || (o.format !== FORMAT && o.version !== 0 && !('reglages' in o))) return null;
  return migrer(brut, application);
}
