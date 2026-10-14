/**
 * Formules : un petit analyseur pour les formules écrites en texte simple dans les textes de Coupole
 * (« F = G M₁ M₂ / R² », « b = √(a² − c²) », « f₀ / (1 − v_r / c) »…), qui les rend en MathML Core (fractions
 * empilées, exposants, indices, radicaux, variables en italique) pour les pages, et sur la toile pour les animations.
 *
 * Grammaire (du moins au plus liant) : relation (= ∝ ≈ < > ≤ ≥) ; somme (+ − ±) ; quotient (« a b / c d » :
 * tout le produit de gauche sur tout le produit de droite) ; produit (juxtaposition, × ·) ; facteur avec exposants
 * (²³⁴⁻ⁿ… ou ^x) et indices (₀₁₂… ou _x) ; primaire : nombre, identificateur, (…), √facteur, fonction.
 */
import { type Peintre, FAMILLE } from './peintre';

export type Noeud =
  | { t: 'rangee'; e: Noeud[] }
  | { t: 'id'; v: string }
  | { t: 'nb'; v: string }
  | { t: 'op'; v: string }
  | { t: 'frac'; n: Noeud; d: Noeud }
  | { t: 'sup'; b: Noeud; s: Noeud }
  | { t: 'sub'; b: Noeud; s: Noeud }
  | { t: 'subsup'; b: Noeud; i: Noeud; s: Noeud }
  | { t: 'racine'; e: Noeud }
  | { t: 'paren'; e: Noeud; o: string; f: string };

const EXPOSANTS: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁻': '−', '⁺': '+', 'ⁿ': 'n', 'ⁱ': 'i',
};
const INDICES: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '₊': '+', '₋': '−', 'ₐ': 'a', 'ₑ': 'e', 'ₒ': 'o', 'ₓ': 'x', 'ₙ': 'n', 'ₚ': 'p', 'ₛ': 's', 'ₜ': 't',
};
const MOTS = ['asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'log', 'ln', 'exp', 'max', 'min', 'TSL', 'LST', 'TU', 'UT'];
const RELATIONS = new Set(['=', '∝', '≈', '<', '>', '≤', '≥', '≠', '≡', '→']);
const LETTRE = /[A-Za-zÀ-ÖØ-öø-ÿΑ-Ωα-ωϑϕϵ☉⊕*]/u;
const SYMBOLES_DROITS = new Set(['☉', '⊕', '*']);

type Jeton = { k: 'nb' | 'id' | 'op' | 'ouv' | 'ferm' | 'sup' | 'sub' | 'racine'; v: string; esp?: boolean };

function jetons(s: string): Jeton[] {
  const out: Jeton[] = [];
  let i = 0;
  const car = [...s];
  // chaque jeton retient s'il suit une espace : « a/b » (collé) lie plus fort que « a b / c d » (espacé)
  let espace = false;
  const pousser = (j: Jeton): void => {
    j.esp = espace;
    espace = false;
    out.push(j);
  };
  while (i < car.length) {
    const c = car[i]!;
    if (c === ' ' || c === ' ' || c === ' ' || c === ' ') {
      espace = true;
      i++;
      continue;
    }
    if (/[0-9]/.test(c)) {
      // nombre : chiffres, séparateur décimal, espaces fines de milliers, unités d'angle collées (° ′ ″)
      let v = c;
      i++;
      while (i < car.length) {
        const d = car[i]!;
        if (/[0-9]/.test(d)) v += d;
        else if ((d === ',' || d === '.') && /[0-9]/.test(car[i + 1] ?? '')) v += d;
        else if ((d === ' ' || d === ' ') && /^[0-9]{3}(?![0-9])/.test(car.slice(i + 1, i + 5).join(''))) v += ' ';
        else if (d === '°' || d === '′' || d === '″') v += d;
        else break;
        i++;
      }
      pousser({ k: 'nb', v });
      continue;
    }
    if (c in EXPOSANTS) {
      let v = '';
      while (i < car.length && car[i]! in EXPOSANTS) v += EXPOSANTS[car[i++]!];
      pousser({ k: 'sup', v });
      continue;
    }
    if (c in INDICES) {
      let v = '';
      while (i < car.length && car[i]! in INDICES) v += INDICES[car[i++]!];
      pousser({ k: 'sub', v });
      continue;
    }
    if ((c === '☉' || c === '⊕') && out.length && out[out.length - 1]!.k === 'id') {
      // R☉, M⊕ : le symbole est un indice
      pousser({ k: 'sub', v: c });
      i++;
      continue;
    }
    if (c === '^' || c === '_') {
      i++;
      let v = '';
      if (car[i] === '(') {
        let n = 0;
        while (i < car.length) {
          const d = car[i++]!;
          if (d === '(') n++;
          else if (d === ')' && --n === 0) break;
          if (!(d === '(' && n === 1)) v += d;
        }
      } else if (c === '_' && /[A-Za-zα-ωΑ-Ω]/.test(car[i] ?? '') && /[A-Za-zα-ωΑ-Ω]/.test(car[i + 1] ?? '')) {
        // indice d'un mot entier (λ_max, f_obs, a_int) : un seul identificateur, en romain
        while (i < car.length && /[A-Za-zα-ωΑ-Ω]/.test(car[i]!)) v += car[i++];
      } else v = car[i++] ?? '';
      pousser({ k: c === '^' ? 'sup' : 'sub', v });
      continue;
    }
    if (c === '(' || c === '[' || c === '|' && !out.some((j) => j.k === 'ouv' && j.v === '|')) {
      pousser({ k: 'ouv', v: c });
      i++;
      continue;
    }
    if (c === ')' || c === ']' || c === '|') {
      pousser({ k: 'ferm', v: c });
      i++;
      continue;
    }
    if (c === '√') {
      pousser({ k: 'racine', v: c });
      i++;
      continue;
    }
    if (LETTRE.test(c)) {
      const reste = car.slice(i).join('');
      const mot = MOTS.find((m) => reste.startsWith(m) && !/[A-Za-z]/.test(reste[m.length] ?? ''));
      if (mot) {
        pousser({ k: 'id', v: mot });
        i += [...mot].length;
      } else {
        pousser({ k: 'id', v: c });
        i++;
      }
      continue;
    }
    pousser({ k: 'op', v: c === '-' ? '−' : c === '*' ? '×' : c });
    i++;
  }
  return out;
}

class Analyseur {
  private i = 0;
  constructor(private j: Jeton[]) {}

  private voir(): Jeton | undefined {
    return this.j[this.i];
  }

  analyser(): Noeud {
    const n = this.relation();
    // ce qui reste (rare) est ajouté tel quel
    const reste: Noeud[] = [n];
    while (this.i < this.j.length) {
      const t = this.j[this.i++]!;
      reste.push(t.k === 'nb' ? { t: 'nb', v: t.v } : t.k === 'id' ? { t: 'id', v: t.v } : { t: 'op', v: t.v });
    }
    return reste.length === 1 ? n : { t: 'rangee', e: reste };
  }

  private relation(): Noeud {
    const e: Noeud[] = [];
    if (this.voir()?.k === 'op' && RELATIONS.has(this.voir()!.v)) e.push({ t: 'op', v: this.j[this.i++]!.v });
    e.push(this.somme());
    while (this.voir()?.k === 'op' && RELATIONS.has(this.voir()!.v)) {
      e.push({ t: 'op', v: this.j[this.i++]!.v });
      if (this.debutFacteur() || this.voir()?.k === 'op') e.push(this.somme());
    }
    return e.length === 1 ? e[0]! : { t: 'rangee', e };
  }

  private somme(): Noeud {
    const e: Noeud[] = [];
    while (this.voir()?.k === 'op' && /^[−+±∓]$/.test(this.voir()!.v)) e.push({ t: 'op', v: this.j[this.i++]!.v });
    e.push(this.quotient());
    while (this.voir()?.k === 'op' && /^[−+±∓]$/.test(this.voir()!.v)) {
      e.push({ t: 'op', v: this.j[this.i++]!.v });
      if (this.debutFacteur()) e.push(this.quotient());
    }
    return e.length === 1 ? e[0]! : { t: 'rangee', e };
  }

  private quotient(): Noeud {
    let n = this.produit();
    while (this.voir()?.k === 'op' && this.voir()!.v === '/') {
      this.i++;
      if (!this.debutFacteur()) break;
      const d = this.produit();
      n = { t: 'frac', n: sansParen(n), d: sansParen(d) };
    }
    return n;
  }

  private debutFacteur(): boolean {
    const t = this.voir();
    return !!t && (t.k === 'nb' || t.k === 'id' || t.k === 'ouv' || t.k === 'racine' || (t.k === 'op' && /^[ΔΣ∂∇]$/.test(t.v)));
  }

  private colleA(k: number): boolean {
    const t = this.j[k];
    return !!t && !t.esp;
  }

  private produit(): Noeud {
    const colle: boolean[] = [this.colleA(this.i)];
    const e: Noeud[] = [this.facteur()];
    for (;;) {
      const t = this.voir();
      if (t?.k === 'op' && t.v === '/' && !t.esp && this.colleA(this.i + 1) && this.debutFacteurA(this.i + 1)) {
        // « a/b » collé : le groupe collé de gauche sur le groupe collé de droite
        this.i++;
        let k = e.length - 1;
        while (k > 0 && colle[k]) k--;
        const num = e.splice(k);
        const prem = colle.splice(k)[0] ?? false;
        const den: Noeud[] = [this.facteur()];
        while (this.debutFacteur() && this.colleA(this.i)) den.push(this.facteur());
        e.push({ t: 'frac', n: sansParen(num.length === 1 ? num[0]! : { t: 'rangee', e: num }), d: sansParen(den.length === 1 ? den[0]! : { t: 'rangee', e: den }) });
        colle.push(prem);
      } else if (t?.k === 'op' && (t.v === '×' || t.v === '·' || t.v === '⋅')) {
        this.i++;
        e.push({ t: 'op', v: t.v === '⋅' ? '·' : t.v });
        colle.push(false);
        if (this.debutFacteur()) {
          colle.push(false);
          e.push(this.facteur());
        }
      } else if (this.debutFacteur()) {
        colle.push(this.colleA(this.i));
        e.push(this.facteur());
      } else break;
    }
    return e.length === 1 ? e[0]! : { t: 'rangee', e };
  }

  private debutFacteurA(k: number): boolean {
    const t = this.j[k];
    return !!t && (t.k === 'nb' || t.k === 'id' || t.k === 'ouv' || t.k === 'racine');
  }

  private facteur(): Noeud {
    let b = this.primaire();
    for (;;) {
      const t = this.voir();
      if (t?.k === 'sub') {
        this.i++;
        const s = sousFormule(t.v);
        const u = this.voir();
        if (u?.k === 'sup') {
          this.i++;
          b = { t: 'subsup', b, i: s, s: sousFormule(u.v) };
        } else b = { t: 'sub', b, s };
      } else if (t?.k === 'sup') {
        this.i++;
        b = { t: 'sup', b, s: sousFormule(t.v) };
      } else break;
    }
    return b;
  }

  private primaire(): Noeud {
    const t = this.j[this.i++];
    if (!t) return { t: 'rangee', e: [] };
    if (t.k === 'nb') return { t: 'nb', v: t.v };
    if (t.k === 'id') {
      // fonction suivie de son argument (sin h, log₁₀ d) : l'argument est un facteur
      return { t: 'id', v: t.v };
    }
    if (t.k === 'racine') return { t: 'racine', e: sansParen(this.facteur()) };
    if (t.k === 'ouv') {
      const e = this.relation();
      const f = this.voir();
      let fe = t.v === '(' ? ')' : t.v === '[' ? ']' : '|';
      if (f?.k === 'ferm') {
        this.i++;
        fe = f.v;
      }
      return { t: 'paren', e, o: t.v, f: fe };
    }
    return { t: 'op', v: t.v };
  }
}

function sansParen(n: Noeud): Noeud {
  return n.t === 'paren' && n.o === '(' ? n.e : n;
}

function sousFormule(s: string): Noeud {
  if (/^[−+]?[0-9]+$/.test(s)) return { t: 'nb', v: s };
  if (s.length === 1 && !/[0-9]/.test(s)) return s === '*' ? { t: 'op', v: '∗' } : { t: 'id', v: s };
  // un mot (max, obs, int…) : un identificateur droit, pas un produit de lettres en italique
  if (/^[A-Za-zα-ωΑ-Ω]{2,}$/.test(s)) return { t: 'id', v: s };
  return analyser(s);
}

/** Analyse une formule écrite en texte simple. */
export function analyser(s: string): Noeud {
  return new Analyseur(jetons(s)).analyser();
}

// ==================================================================== MathML
const NS = 'http://www.w3.org/1998/Math/MathML';

function el(nom: string, enfants: (Node | string)[] = [], attrs: Record<string, string> = {}): Element {
  const e = document.createElementNS(NS, nom);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const c of enfants) e.append(c);
  return e;
}

function versMathML(n: Noeud): Element {
  switch (n.t) {
    case 'rangee': {
      // fonctions (sin, log…) : petite espace avant, application de fonction après, comme en typographie
      const enfants: Element[] = [];
      n.e.forEach((x, k) => {
        const fonction = x.t === 'id' && MOTS.includes(x.v) || (x.t === 'sub' && x.b.t === 'id' && MOTS.includes(x.b.v));
        if (fonction && k > 0) enfants.push(el('mspace', [], { width: '0.17em' }));
        enfants.push(versMathML(x));
        if (fonction && k < n.e.length - 1) enfants.push(el('mo', ['\u2061']));
      });
      return el('mrow', enfants);
    }
    case 'id': {
      // une lettre : italique (par défaut) ; un mot, une majuscule grecque, ☉, ⊕ : droits
      const droit = [...n.v].length > 1 || /[Α-Ω]/.test(n.v) || SYMBOLES_DROITS.has(n.v);
      return el('mi', [n.v === '*' ? '∗' : n.v], droit && [...n.v].length === 1 ? { mathvariant: 'normal' } : {});
    }
    case 'nb':
      return el('mn', [n.v]);
    case 'op':
      return el('mo', [n.v]);
    case 'frac':
      return el('mfrac', [versMathML(n.n), versMathML(n.d)]);
    case 'sup':
      return el('msup', [versMathML(n.b), versMathML(n.s)]);
    case 'sub':
      return el('msub', [versMathML(n.b), versMathML(n.s)]);
    case 'subsup':
      return el('msubsup', [versMathML(n.b), versMathML(n.i), versMathML(n.s)]);
    case 'racine':
      return el('msqrt', [versMathML(n.e)]);
    case 'paren':
      return el('mrow', [el('mo', [n.o], { stretchy: 'true', symmetric: 'true' }), versMathML(n.e), el('mo', [n.f], { stretchy: 'true', symmetric: 'true' })]);
  }
}

/** Élément <math> (en ligne) d'une formule écrite en texte simple ; le texte d'origine sert d'alternative. */
export function mathml(s: string): Element {
  const m = el('math', [versMathML(analyser(s))], { display: 'inline' });
  m.setAttribute('alttext', s);
  return m;
}

// ==================================================================== toile
interface Boite {
  w: number;
  asc: number;
  desc: number;
  dessiner: (p: Peintre, x: number, y: number) => void;
}

const POLICE_MATHS = `'STIX Two Math', 'Cambria Math', 'Latin Modern Math', ${FAMILLE}`;

function mesure(p: Peintre, s: string, taille: number, italique: boolean): Boite {
  const ctx = p.ctx;
  const f = `${italique ? 'italic ' : ''}${taille}px ${POLICE_MATHS}`;
  ctx.save();
  ctx.font = f;
  const w = ctx.measureText(s).width;
  ctx.restore();
  return {
    w: w + (italique ? taille * 0.06 : 0),
    asc: taille * 0.72,
    desc: taille * 0.22,
    dessiner: (pp, x, y) => {
      const c = pp.ctx;
      c.save();
      c.font = f;
      c.fillText(s, x, y);
      c.restore();
    },
  };
}

function boite(p: Peintre, n: Noeud, t: number): Boite {
  switch (n.t) {
    case 'id': {
      const droit = [...n.v].length > 1 || /[Α-Ω]/.test(n.v) || SYMBOLES_DROITS.has(n.v);
      return mesure(p, n.v === '*' ? '∗' : n.v, t, !droit);
    }
    case 'nb':
      return mesure(p, n.v, t, false);
    case 'op': {
      const espace = RELATIONS.has(n.v) || /^[−+±×∓]$/.test(n.v) ? t * 0.22 : t * 0.06;
      const b = mesure(p, n.v, t, false);
      return { w: b.w + 2 * espace, asc: b.asc, desc: b.desc, dessiner: (pp, x, y) => b.dessiner(pp, x + espace, y) };
    }
    case 'rangee': {
      const bs = n.e.map((e, k) => {
        const b = boite(p, e, t);
        const fonction = e.t === 'id' && MOTS.includes(e.v) || (e.t === 'sub' && e.b.t === 'id' && MOTS.includes(e.b.v));
        if (!fonction) return b;
        const av = k > 0 ? t * 0.17 : 0,
          ap = k < n.e.length - 1 ? t * 0.17 : 0;
        return { w: b.w + av + ap, asc: b.asc, desc: b.desc, dessiner: (pp: Peintre, x: number, y: number) => b.dessiner(pp, x + av, y) };
      });
      return {
        w: bs.reduce((s, b) => s + b.w, 0),
        asc: Math.max(t * 0.72, ...bs.map((b) => b.asc)),
        desc: Math.max(t * 0.22, ...bs.map((b) => b.desc)),
        dessiner: (pp, x, y) => {
          let xx = x;
          for (const b of bs) {
            b.dessiner(pp, xx, y);
            xx += b.w;
          }
        },
      };
    }
    case 'frac': {
      const tn = Math.max(9, t * 0.82);
      const nn = boite(p, n.n, tn),
        dd = boite(p, n.d, tn);
      const w = Math.max(nn.w, dd.w) + t * 0.3;
      const axe = t * 0.3;
      return {
        w,
        asc: axe + nn.asc + nn.desc + t * 0.12,
        desc: -axe + dd.asc + dd.desc + t * 0.12,
        dessiner: (pp, x, y) => {
          const ya = y - axe;
          nn.dessiner(pp, x + (w - nn.w) / 2, ya - t * 0.12 - nn.desc);
          dd.dessiner(pp, x + (w - dd.w) / 2, ya + t * 0.12 + dd.asc);
          const c = pp.ctx;
          c.save();
          c.lineWidth = Math.max(1, t * 0.06);
          c.strokeStyle = c.fillStyle;
          c.beginPath();
          c.moveTo(x + t * 0.08, ya);
          c.lineTo(x + w - t * 0.08, ya);
          c.stroke();
          c.restore();
        },
      };
    }
    case 'sup':
    case 'sub':
    case 'subsup': {
      const b = boite(p, n.b, t);
      const ts = Math.max(8, t * 0.68);
      const s = n.t === 'sub' ? null : boite(p, n.s, ts);
      const i = n.t === 'sup' ? null : boite(p, n.t === 'sub' ? n.s : n.i, ts);
      const w = b.w + Math.max(s?.w ?? 0, i?.w ?? 0) + t * 0.04;
      return {
        w,
        asc: Math.max(b.asc, s ? t * 0.42 + s.asc : 0),
        desc: Math.max(b.desc, i ? t * 0.2 + i.desc : 0),
        dessiner: (pp, x, y) => {
          b.dessiner(pp, x, y);
          if (s) s.dessiner(pp, x + b.w + t * 0.02, y - t * 0.42);
          if (i) i.dessiner(pp, x + b.w + t * 0.02, y + t * 0.2);
        },
      };
    }
    case 'racine': {
      const e = boite(p, n.e, t);
      const signe = t * 0.62;
      return {
        w: signe + e.w + t * 0.1,
        asc: e.asc + t * 0.16,
        desc: e.desc,
        dessiner: (pp, x, y) => {
          e.dessiner(pp, x + signe, y);
          const c = pp.ctx;
          c.save();
          c.lineWidth = Math.max(1, t * 0.06);
          c.strokeStyle = c.fillStyle;
          c.lineJoin = 'round';
          const haut = y - e.asc - t * 0.08;
          c.beginPath();
          c.moveTo(x + t * 0.04, y - t * 0.3);
          c.lineTo(x + t * 0.2, y - t * 0.36);
          c.lineTo(x + t * 0.36, y + e.desc * 0.7);
          c.lineTo(x + signe - t * 0.06, haut);
          c.lineTo(x + signe + e.w + t * 0.06, haut);
          c.stroke();
          c.restore();
        },
      };
    }
    case 'paren': {
      const e = boite(p, n.e, t);
      const o = mesure(p, n.o, t, false),
        f = mesure(p, n.f, t, false);
      const k = Math.max(1, (e.asc + e.desc) / (t * 0.95));
      return {
        w: (o.w + f.w) * Math.min(1.3, k) + e.w,
        asc: Math.max(e.asc, t * 0.72),
        desc: Math.max(e.desc, t * 0.22),
        dessiner: (pp, x, y) => {
          const c = pp.ctx;
          const milieu = y - (e.asc - e.desc) / 2;
          const echelle = (b: Boite, xx: number): void => {
            c.save();
            c.translate(xx, milieu);
            c.scale(Math.min(1.3, k), k);
            b.dessiner(pp, 0, t * 0.25);
            c.restore();
          };
          echelle(o, x);
          e.dessiner(pp, x + o.w * Math.min(1.3, k), y);
          echelle(f, x + o.w * Math.min(1.3, k) + e.w);
        },
      };
    }
  }
}

/** Dimensions d'une formule sur la toile (largeur, montée, descente en pixels), pour la taille de police courante. */
export function dimensionsFormule(p: Peintre, s: string): { w: number; asc: number; desc: number } {
  const b = boite(p, analyser(s), p.font().taille * 1.08);
  return { w: b.w, asc: b.asc, desc: b.desc };
}

/** Largeur d'une formule sur la toile (pixels), pour la taille de police courante. */
export function largeurFormule(p: Peintre, s: string): number {
  return boite(p, analyser(s), p.font().taille * 1.08).w;
}

/**
 * Dessine une formule sur la toile, mise en forme (fractions empilées, exposants, italiques), dans la couleur du
 * stylo courant ; (x, y) : début de la ligne de base, ou centre si `centre`.
 */
export function dessinerFormule(p: Peintre, x: number, y: number, s: string, centre = false): void {
  const t = p.font().taille * 1.08;
  const b = boite(p, analyser(s), t);
  const ctx = p.ctx;
  ctx.save();
  const stylo = p.pen();
  if (stylo) ctx.fillStyle = stylo.couleur.css();
  ctx.textBaseline = 'alphabetic';
  b.dessiner(p, centre ? x - b.w / 2 : x, centre ? y + (b.asc - b.desc) / 2 : y);
  ctx.restore();
}
