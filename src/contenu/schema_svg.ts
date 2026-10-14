/**
 * Moteur de rendu des schémas déclaratifs (« coupole-schema/1 ») en SVG : portage de `rendu_svg.py` (implémentation
 * de référence des ressources) avec la mesure RÉELLE des textes (measureText dans le navigateur ; table de chasses
 * dans les tests) pour les marges des axes et le cadre de vue, et le même contrôle de non-recouvrement.  Le moteur
 * QPainter de Coupole (`classe/schema_qt.py`) suit ce fichier ligne à ligne.
 *
 * Repère : origine en haut à gauche, y vers le bas ; angles en degrés dans le sens trigonométrique VU À L'ÉCRAN.
 * Couleurs : jetons résolus pour le thème courant (aucun style en ligne : la politique de sécurité les interdit).
 */

export type Bi = { fr: string; en: string };
export type Lg = 'fr' | 'en';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Schema = any;
type Pt = [number, number];
export type Boite = [number, number, number, number];
export interface Geo {
  genre: 'courbe' | 'trait' | 'texte' | 'graduation' | 'titre_axe' | 'formule';
  boite?: Boite;
  pts?: Pt[];
  repere?: string | null;
  txt?: string;
  fond?: boolean;
}

export const PALETTE: Record<'clair' | 'sombre', Record<string, string>> = {
  clair: {
    fond: '#ffffff', fond2: '#eef1f5', texte: '#1d232b', trait: '#2b3440', fin: '#6b7684', grille: '#d5dbe2',
    accent: '#c2410c', accent2: '#1d4ed8', accent3: '#15803d', soleil: '#f59e0b', terre: '#2563eb', lune: '#9ca3af',
    planete: '#b45309', etoile: '#a16207', ombre: '#374151', penombre: '#9ca3af', froid: '#2563eb', chaud: '#dc2626',
    eau: '#0ea5e9',
  },
  sombre: {
    fond: '#11161c', fond2: '#1c242e', texte: '#e6eaef', trait: '#cfd6de', fin: '#8d99a6', grille: '#2f3a46',
    accent: '#fb923c', accent2: '#60a5fa', accent3: '#4ade80', soleil: '#fbbf24', terre: '#60a5fa', lune: '#cbd5e1',
    planete: '#f59e0b', etoile: '#fde68a', ombre: '#0b0f14', penombre: '#4b5563', froid: '#60a5fa', chaud: '#f87171',
    eau: '#38bdf8',
  },
};

export const POLICE = "'Inter Variable', Inter, system-ui, sans-serif";

/** Largeur estimée d'une ligne (table de chasses de rendu_svg.py) : sert sans navigateur (tests). */
export function largeurEstimee(t: string, taille: number, gras = false): number {
  let w = 0;
  for (const c of t) {
    if ('0123456789'.includes(c)) w += 0.56;
    else if (c === ' ') w += 0.28;
    else if (c === ' ' || c === ' ') w += 0.18;
    else if ("il.,;:|!'’ıjfrtI".includes(c)) w += 0.3;
    else if ('mwMWœŒ'.includes(c)) w += 0.85;
    else if ('⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺₀₁₂₃₄₅₆₇₈₉ᵣₜ'.includes(c)) w += 0.36;
    else if (c !== c.toLowerCase() && c === c.toUpperCase()) w += 0.66;
    else w += 0.55;
  }
  return w * taille * (gras ? 1.07 : 1);
}

export type Mesure = (t: string, taille: number, gras?: boolean) => number;

let ctxMesure: CanvasRenderingContext2D | null | undefined;
/** Mesure réelle (measureText, même police que le SVG) ; repli sur l'estimation hors navigateur. */
export const mesureReelle: Mesure = (t, taille, gras = false) => {
  if (ctxMesure === undefined) {
    try {
      ctxMesure = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    } catch {
      ctxMesure = null;
    }
  }
  if (!ctxMesure) return largeurEstimee(t, taille, gras);
  ctxMesure.font = `${gras ? 700 : 400} ${taille}px ${POLICE}`;
  return ctxMesure.measureText(t).width;
};

const f2 = (v: number): string => {
  const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
};
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function couleurOnde(nm: number): string {
  let r: number, g: number, b: number;
  const w = nm;
  if (w >= 380 && w < 440) [r, g, b] = [-(w - 440) / 60, 0, 1];
  else if (w >= 440 && w < 490) [r, g, b] = [0, (w - 440) / 50, 1];
  else if (w >= 490 && w < 510) [r, g, b] = [0, 1, -(w - 510) / 20];
  else if (w >= 510 && w < 580) [r, g, b] = [(w - 510) / 70, 1, 0];
  else if (w >= 580 && w < 645) [r, g, b] = [1, -(w - 645) / 65, 0];
  else if (w >= 645 && w <= 780) [r, g, b] = [1, 0, 0];
  else return '#808080';
  const f = w < 420 ? 0.3 + (0.7 * (w - 380)) / 40 : w > 700 ? 0.3 + (0.7 * (780 - w)) / 80 : 1;
  const h = (c: number): string => (c > 0 ? Math.round(255 * (c * f) ** 0.8) : 0).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

function texteDe(v: unknown, lg: Lg): string {
  if (v && typeof v === 'object') return String((v as Bi)[lg] ?? '');
  return String(v ?? '');
}

export function nombreAxe(v: number, lg: Lg): string {
  let s = Number.isInteger(v) ? String(v) : String(v);
  if (Number.isInteger(v) && Math.abs(v) >= 10000) s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (Number.isInteger(v) && v <= -10000) s = '-' + s;
  if (lg === 'fr') s = s.replace('.', ',');
  return s.replace('-', '−');
}

export function boiteTexte(txt: string, taille: number, x: number, y: number, ancre = 'm', base = 'milieu', rot = 0, gras = false, mesure: Mesure = largeurEstimee): Boite {
  const lignes = txt.split('\n');
  const w = Math.max(...lignes.map((l) => mesure(l, taille, gras)));
  const hh = taille * 1.2 * lignes.length;
  const x0 = ancre === 'g' ? x : ancre === 'd' ? x - w : x - w / 2;
  let y0: number;
  if (lignes.length > 1 && base === 'milieu') y0 = y - hh / 2;
  else y0 = base === 'haut' ? y : base === 'bas' ? y - taille * 0.95 : y - hh / 2;
  let b: Boite = [x0, y0, x0 + w, y0 + hh];
  if (rot) {
    const a = (-rot * Math.PI) / 180;
    const pts: Pt[] = [];
    for (const px of [b[0], b[2]]) for (const py of [b[1], b[3]]) pts.push([x + (px - x) * Math.cos(a) - (py - y) * Math.sin(a), y + (px - x) * Math.sin(a) + (py - y) * Math.cos(a)]);
    b = [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
  }
  return b;
}

class Carte {
  x0: number; y0: number; l: number; h: number; ax: Schema; ay: Schema;
  constructor(r: Schema) {
    [this.x0, this.y0, this.l, this.h] = r.cadre;
    this.ax = r.x;
    this.ay = r.y;
  }
  private t(v: number, a: Schema): number {
    if (a.log) return (Math.log10(v) - Math.log10(a.min)) / (Math.log10(a.max) - Math.log10(a.min));
    return (v - a.min) / (a.max - a.min);
  }
  p(p: Pt): Pt {
    return [this.x0 + this.t(p[0], this.ax) * this.l, this.y0 + this.h - this.t(p[1], this.ay) * this.h];
  }
}

const ANCRE: Record<string, string> = { g: 'start', m: 'middle', d: 'end' };
const BASE: Record<string, string> = { haut: 'hanging', milieu: 'central', bas: 'alphabetic' };

export interface Rendu {
  svg: string; // SVG prêt à analyser (les formules sont des <foreignObject data-formule="…">)
  geo: Geo[];
  vue: Boite; // x, y, l, h
}

export interface OptionsRendu {
  theme?: 'clair' | 'sombre';
  mesure?: Mesure;
  id?: string; // préfixe des identifiants (dégradés) : unique dans la page
}

let nGrad = 0;

export function rendre(s: Schema, lg: Lg, o: OptionsRendu = {}): Rendu {
  const pal = PALETTE[o.theme ?? 'sombre'];
  const mesure = o.mesure ?? largeurEstimee;
  const c = (j: string | null | undefined): string => (j === null || j === undefined || j === 'none' ? 'none' : (pal[j] ?? (j.startsWith('#') ? j : pal.trait!)));
  const style = (st: Schema = {}): string => {
    const out = [`stroke="${c(st.trait ?? 'trait')}"`, `fill="${st.fond ? c(st.fond) : 'none'}"`, `stroke-width="${f2(st.ep ?? 1.5)}"`, 'stroke-linecap="round"', 'stroke-linejoin="round"'];
    if (st.tirets) out.push(`stroke-dasharray="${st.tirets.map(f2).join(' ')}"`);
    if (st.opacite !== undefined && st.opacite !== null) out.push(`opacity="${st.opacite}"`);
    return out.join(' ');
  };
  const tete = (de: Pt, a: Pt, st: Schema): string => {
    const ep = st.ep ?? 1.5;
    const L = 6 + 3 * ep;
    const ang = Math.atan2(a[1] - de[1], a[0] - de[0]);
    const pts: Pt[] = [a, [a[0] - L * Math.cos(ang - 0.4), a[1] - L * Math.sin(ang - 0.4)], [a[0] - L * Math.cos(ang + 0.4), a[1] - L * Math.sin(ang + 0.4)]];
    return `<polygon points="${pts.map((p) => f2(p[0]) + ',' + f2(p[1])).join(' ')}" fill="${c(st.trait ?? 'trait')}" stroke="none"/>`;
  };
  const fleches = (pts: Pt[], st: Schema): string[] => {
    const f = st.fleche;
    const out: string[] = [];
    if ((f === 'fin' || f === 'deux') && pts.length >= 2) out.push(tete(pts[pts.length - 2]!, pts[pts.length - 1]!, st));
    if ((f === 'debut' || f === 'deux') && pts.length >= 2) out.push(tete(pts[1]!, pts[0]!, st));
    return out;
  };

  const cartes = new Map<string, Carte>();
  const out: string[] = [];
  const G: Geo[] = [];
  const prefixe = o.id ?? 'sc' + ++nGrad;
  let nDef = 0;

  for (const el of s.elements as Schema[]) {
    const t = el.t;
    const m = el.repere ? cartes.get(el.repere) : undefined;
    const P = (p: Pt): Pt => (m ? m.p(p) : [p[0], p[1]]);
    const st = el.style ?? {};
    if (t === 'repere') {
      const mp = new Carte(el);
      cartes.set(el.id, mp);
      out.push(...axes(el, mp, lg, G, c, mesure));
    } else if (t === 'ligne' || t === 'poly') {
      const pts = (el.p as Pt[]).map(P);
      const pp = pts.map((p) => f2(p[0]) + ',' + f2(p[1])).join(' ');
      out.push(t === 'ligne' || !el.ferme ? `<polyline points="${pp}" ${style(st)}/>` : `<polygon points="${pp}" ${style(st)}/>`);
      out.push(...fleches(pts, st));
      G.push({ genre: el.repere && !st.tirets ? 'courbe' : 'trait', pts, repere: el.repere ?? null, fond: !!st.fond });
    } else if (t === 'cercle' || t === 'point') {
      const [x, y] = P(t === 'cercle' ? el.c : el.p);
      out.push(`<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(el.r)}" ${style(st)}/>`);
    } else if (t === 'ellipse') {
      const [x, y] = P(el.c);
      out.push(`<ellipse cx="${f2(x)}" cy="${f2(y)}" rx="${f2(el.rx)}" ry="${f2(el.ry)}" transform="rotate(${f2(-(el.rot ?? 0))} ${f2(x)} ${f2(y)})" ${style(st)}/>`);
    } else if (t === 'arc') {
      const [cx, cy] = P(el.c);
      const r = el.r;
      const a0 = (el.a0 * Math.PI) / 180;
      const a1 = (el.a1 * Math.PI) / 180;
      const p0: Pt = [cx + r * Math.cos(a0), cy - r * Math.sin(a0)];
      const p1: Pt = [cx + r * Math.cos(a1), cy - r * Math.sin(a1)];
      const grand = Math.abs(el.a1 - el.a0) % 360 > 180 ? 1 : 0;
      const balayage = el.a1 > el.a0 ? 0 : 1;
      if (Math.abs(el.a1 - el.a0) >= 360) out.push(`<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(r)}" ${style(st)}/>`);
      else {
        out.push(`<path d="M ${f2(p0[0])} ${f2(p0[1])} A ${f2(r)} ${f2(r)} 0 ${grand} ${balayage} ${f2(p1[0])} ${f2(p1[1])}" ${style(st)}/>`);
        if (st.fleche) {
          const da = el.a1 > el.a0 ? 0.05 : -0.05;
          const q: Pt = [cx + r * Math.cos(a1 - da), cy - r * Math.sin(a1 - da)];
          out.push(...fleches([q, p1], { ...st, fleche: 'fin' }));
        }
      }
    } else if (t === 'rect') {
      const [x, y] = P(el.p);
      out.push(`<rect x="${f2(x)}" y="${f2(y)}" width="${f2(el.l)}" height="${f2(el.h)}" rx="${el.rayon ?? 0}" ${style(st)}/>`);
    } else if (t === 'texte') {
      const [x, y] = P(el.p);
      const txt = texteDe(el.txt, lg);
      const taille = el.taille ?? 14;
      const attrs = [`x="${f2(x)}"`, `y="${f2(y)}"`, `font-size="${taille}"`, `text-anchor="${ANCRE[el.ancre ?? 'm']}"`, `dominant-baseline="${BASE[el.base ?? 'milieu']}"`, `fill="${c(el.couleur ?? 'texte')}"`];
      if (el.gras) attrs.push('font-weight="bold"');
      if (el.italique) attrs.push('font-style="italic"');
      if (el.rot) attrs.push(`transform="rotate(${-el.rot} ${f2(x)} ${f2(y)})"`);
      G.push({ genre: 'texte', boite: boiteTexte(txt, taille, x, y, el.ancre ?? 'm', el.base ?? 'milieu', el.rot ?? 0, !!el.gras, mesure), repere: el.repere ?? null, txt });
      const lignes = txt.split('\n');
      if (lignes.length === 1) out.push(`<text ${attrs.join(' ')}>${esc(txt)}</text>`);
      else {
        const dy = taille * 1.2;
        const y0 = (el.base ?? 'milieu') === 'milieu' ? y - (dy * (lignes.length - 1)) / 2 : y;
        out.push(`<text ${attrs.join(' ')}>${lignes.map((l, i) => `<tspan x="${f2(x)}" y="${f2(y0 + i * dy)}">${esc(l)}</tspan>`).join('')}</text>`);
      }
    } else if (t === 'formule') {
      const [x, y] = P(el.p);
      const ta = el.taille ?? 16;
      const src = texteDe(el.src, lg);
      const fw = 0.5 * ta * src.replace(/ /g, '').length + 0.25 * ta * (src.split(' ').length - 1);
      const fh = ta * (src.includes('/') ? 2.2 : 1.3);
      const an = el.ancre ?? 'm';
      const ba = el.base ?? 'milieu';
      const fx = an === 'g' ? x : an === 'd' ? x - fw : x - fw / 2;
      const fy = ba === 'haut' ? y : ba === 'bas' ? y - fh : y - fh / 2;
      G.push({ genre: 'formule', boite: [fx, fy, fx + fw, fy + fh], repere: el.repere ?? null, txt: src });
      const w = 600;
      const hh = ta * 3.2;
      const ox = an === 'g' ? x : an === 'd' ? x - w : x - w / 2;
      const oy = ba === 'haut' ? y : ba === 'bas' ? y - hh : y - hh / 2;
      out.push(
        `<foreignObject x="${f2(ox)}" y="${f2(oy)}" width="${w}" height="${f2(hh)}" data-formule="${esc(src)}" data-ancre="${an}" data-base="${ba}" data-taille="${ta}" data-couleur="${c(el.couleur ?? 'texte')}"></foreignObject>`,
      );
    } else if (t === 'spectre') {
      const [x, y] = el.p as Pt;
      const L = el.l;
      const H = el.h;
      const lmin = el.lmin;
      const lmax = el.lmax;
      const gid = `${prefixe}-g${++nDef}`;
      if ((el.fond ?? 'continu') === 'continu') {
        let stops = '';
        for (let i = 0; i <= 40; i++) stops += `<stop offset="${(i / 40).toFixed(3)}" stop-color="${couleurOnde(lmin + ((lmax - lmin) * i) / 40)}"/>`;
        out.push(`<defs><linearGradient id="${gid}">${stops}</linearGradient></defs><rect x="${f2(x)}" y="${f2(y)}" width="${f2(L)}" height="${f2(H)}" fill="url(#${gid})"/>`);
      } else out.push(`<rect x="${f2(x)}" y="${f2(y)}" width="${f2(L)}" height="${f2(H)}" fill="#000"/>`);
      for (const r of el.raies ?? []) {
        const xr = x + ((r.nm - lmin) / (lmax - lmin)) * L;
        const ep = 1.5 + 2.5 * (r.force ?? 1);
        const coul = r.genre === 'absorption' ? '#000' : couleurOnde(r.nm);
        const op = Math.min(1, 0.4 + 0.6 * (r.force ?? 1));
        out.push(`<rect x="${f2(xr - ep / 2)}" y="${f2(y)}" width="${f2(ep)}" height="${f2(H)}" fill="${coul}" opacity="${op.toFixed(2)}"/>`);
      }
    } else throw new Error(`élément de schéma inconnu : ${t}`);
  }
  const vue = cadreVue(s, G, mesure, lg);
  const titre = esc(texteDe(s.titre, lg));
  const alt = esc(texteDe(s.alt, lg));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f2(vue[0])} ${f2(vue[1])} ${f2(vue[2])} ${f2(vue[3])}" role="img" aria-label="${alt}" font-family="${esc(POLICE)}" class="schema-svg">` +
    `<title>${titre}</title>${out.join('')}</svg>`;
  return { svg, geo: G, vue };
}

const TEXTUELS = ['titre_axe', 'graduation', 'texte', 'formule'];

/** Cadre de vue : le dessin et TOUS ses textes, avec 4 unités de marge (mesure réelle des textes). */
function cadreVue(s: Schema, G: Geo[], _mesure: Mesure, _lg: Lg): Boite {
  const [l, h] = s.taille as [number, number];
  let x0 = 0, y0 = 0, x1 = l, y1 = h;
  if (Array.isArray(s.vue)) {
    // le cadre calculé à la construction (FR et EN, largeurs estimées) est le minimum : la vue ne change pas de
    // taille d'une langue à l'autre ; on l'élargit si la mesure réelle d'un texte en sort
    x0 = s.vue[0];
    y0 = s.vue[1];
    x1 = s.vue[0] + s.vue[2];
    y1 = s.vue[1] + s.vue[3];
  }
  for (const g of G) {
    if (!TEXTUELS.includes(g.genre) || !g.boite) continue;
    const b = g.boite;
    x0 = Math.min(x0, b[0] - 4);
    y0 = Math.min(y0, b[1] - 4);
    x1 = Math.max(x1, b[2] + 4);
    y1 = Math.max(y1, b[3] + 4);
  }
  return [Math.round(x0 * 10) / 10, Math.round(y0 * 10) / 10, Math.round((x1 - x0) * 10) / 10, Math.round((y1 - y0) * 10) / 10];
}

/** Écriture d'un nombre par Python (str d'un float ou d'un int) : clés des étiquettes d'axes des schémas. */
export function clesPython(v: number): string[] {
  const out = [String(v)];
  const exp = (x: number): string => x.toExponential().replace(/e([+-])(\d)$/, 'e$10$2');
  if (Number.isInteger(v) && Math.abs(v) < 1e16) out.push(v.toFixed(0), v.toFixed(0) + '.0');
  else if (Math.abs(v) >= 1e16 || (v !== 0 && Math.abs(v) < 1e-4)) out.push(exp(v));
  return out;
}

function etiquette(etiq: Record<string, unknown> | undefined, v: number): unknown {
  if (!etiq) return undefined;
  for (const k of clesPython(v)) if (k in etiq) return etiq[k];
  return undefined;
}

function axes(r: Schema, mp: Carte, lg: Lg, G: Geo[], c: (j: string) => string, mesure: Mesure): string[] {
  const out: string[] = [];
  const [x0, y0, l, h] = r.cadre as number[];
  const T_GRAD = 12;
  const T_TITRE = 13;
  let largMax = 0;
  for (const nom of ['x', 'y'] as const) {
    const a = r[nom];
    for (const v of a.grad ?? []) {
      let lab: unknown = etiquette(a.etiq, v) ?? nombreAxe(v, lg);
      lab = texteDe(lab, lg);
      const s = lab as string;
      if (nom === 'x') {
        const [X] = mp.p([v, r.y.min]);
        if (r.grille) out.push(`<line x1="${f2(X)}" y1="${f2(y0!)}" x2="${f2(X)}" y2="${f2(y0! + h!)}" stroke="${c('grille')}" stroke-width="1"/>`);
        out.push(`<line x1="${f2(X)}" y1="${f2(y0! + h!)}" x2="${f2(X)}" y2="${f2(y0! + h! + 5)}" stroke="${c('trait')}" stroke-width="1"/>`);
        out.push(`<text x="${f2(X)}" y="${f2(y0! + h! + 8)}" font-size="${T_GRAD}" text-anchor="middle" dominant-baseline="hanging" fill="${c('texte')}">${esc(s)}</text>`);
        G.push({ genre: 'graduation', boite: boiteTexte(s, T_GRAD, X, y0! + h! + 8, 'm', 'haut', 0, false, mesure), repere: r.id, txt: s });
      } else {
        const [, Y] = mp.p([r.x.min, v]);
        if (r.grille) out.push(`<line x1="${f2(x0!)}" y1="${f2(Y)}" x2="${f2(x0! + l!)}" y2="${f2(Y)}" stroke="${c('grille')}" stroke-width="1"/>`);
        out.push(`<line x1="${f2(x0! - 5)}" y1="${f2(Y)}" x2="${f2(x0!)}" y2="${f2(Y)}" stroke="${c('trait')}" stroke-width="1"/>`);
        out.push(`<text x="${f2(x0! - 8)}" y="${f2(Y)}" font-size="${T_GRAD}" text-anchor="end" dominant-baseline="central" fill="${c('texte')}">${esc(s)}</text>`);
        largMax = Math.max(largMax, mesure(s, T_GRAD));
        G.push({ genre: 'graduation', boite: boiteTexte(s, T_GRAD, x0! - 8, Y, 'd', 'milieu', 0, false, mesure), repere: r.id, txt: s });
      }
    }
  }
  if (!r.y.cache) out.push(`<line x1="${f2(x0!)}" y1="${f2(y0!)}" x2="${f2(x0!)}" y2="${f2(y0! + h!)}" stroke="${c('trait')}" stroke-width="1.5"/>`);
  if (!r.x.cache) out.push(`<line x1="${f2(x0!)}" y1="${f2(y0! + h!)}" x2="${f2(x0! + l!)}" y2="${f2(y0! + h!)}" stroke="${c('trait')}" stroke-width="1.5"/>`);
  if (r.x.titre) {
    const yt = y0! + h! + 8 + (r.x.grad?.length ? T_GRAD * 1.2 : 0) + 6;
    const tt = texteDe(r.x.titre, lg);
    out.push(`<text x="${f2(x0! + l! / 2)}" y="${f2(yt)}" font-size="${T_TITRE}" text-anchor="middle" dominant-baseline="hanging" fill="${c('texte')}">${esc(tt)}</text>`);
    G.push({ genre: 'titre_axe', boite: boiteTexte(tt, T_TITRE, x0! + l! / 2, yt, 'm', 'haut', 0, false, mesure), repere: r.id, txt: tt });
  }
  if (r.y.titre) {
    const tt = texteDe(r.y.titre, lg);
    // titre vertical à gauche de la PLUS LARGE graduation (mesurée) : jamais sur les étiquettes
    const X = x0! - 8 - largMax - 8 - T_TITRE * 0.6;
    const Y = y0! + h! / 2;
    out.push(`<text x="${f2(X)}" y="${f2(Y)}" font-size="${T_TITRE}" text-anchor="middle" dominant-baseline="central" transform="rotate(-90 ${f2(X)} ${f2(Y)})" fill="${c('texte')}">${esc(tt)}</text>`);
    G.push({ genre: 'titre_axe', boite: boiteTexte(tt, T_TITRE, X, Y, 'm', 'milieu', 90, false, mesure), repere: r.id, txt: tt });
  }
  return out;
}

function inter(a: Boite, b: Boite, marge = 1): boolean {
  return a[0] + marge < b[2] && b[0] + marge < a[2] && a[1] + marge < b[3] && b[1] + marge < a[3];
}

function segBoite(p: Pt, q: Pt, b: Boite, marge = 1): boolean {
  const [x0, y0, x1, y1] = [b[0] + marge, b[1] + marge, b[2] - marge, b[3] - marge];
  if (x0 >= x1 || y0 >= y1) return false;
  const n = Math.max(2, Math.floor(Math.hypot(q[0] - p[0], q[1] - p[1]) / 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = p[0] + (q[0] - p[0]) * t;
    const y = p[1] + (q[1] - p[1]) * t;
    if (x0 < x && x < x1 && y0 < y && y < y1) return true;
  }
  return false;
}

/**
 * Contrôle de non-recouvrement (repris de rendu_svg.recouvrements) : titres d'axes, graduations, textes et formules
 * ne se recouvrent pas ; aucune courbe pleine ne traverse un titre d'axe, une graduation ou une légende de son repère.
 */
export function recouvrements(s: Schema, lg: Lg, mesure: Mesure = largeurEstimee): string[] {
  const { geo } = rendre(s, lg, { mesure });
  const tx = geo.filter((g) => TEXTUELS.includes(g.genre));
  const pb: string[] = [];
  for (let i = 0; i < tx.length; i++)
    for (const b of tx.slice(i + 1)) if (inter(tx[i]!.boite!, b.boite!)) pb.push(`${tx[i]!.genre} « ${tx[i]!.txt!.slice(0, 30)} » recouvre ${b.genre} « ${b.txt!.slice(0, 30)} »`);
  for (const cb of geo.filter((g) => g.genre === 'courbe' && !g.fond)) {
    for (const a of tx) {
      if (a.genre === 'titre_axe' || a.genre === 'graduation' || (a.repere && a.repere === cb.repere)) {
        const pts = cb.pts!;
        let touche = false;
        for (let k = 0; k + 1 < pts.length && !touche; k++) touche = segBoite(pts[k]!, pts[k + 1]!, a.boite!);
        if (touche) {
          pb.push(`courbe du repère ${cb.repere} traverse ${a.genre} « ${a.txt!.slice(0, 30)} »`);
          break;
        }
      }
    }
  }
  return pb;
}
