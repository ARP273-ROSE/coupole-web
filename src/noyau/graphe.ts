/** Petit traceur de graphes (transposition de graphe.py) : axes linéaires ou logarithmiques, courbes, bandes. */
import { couleur_longueur_onde } from '../calc/couleurs';
import * as dessin from './dessin';
import { nombre } from './format';
import { Couleur, type Degrade, type Peintre, Pt, Rect } from './peintre';
import { pround } from './py';

/** Pas de graduation « rond » (1, 2, 5 × 10ᵏ) donnant environ n graduations. */
export function pas_lisible(etendue: number, n = 5): number {
  if (etendue <= 0) return 1.0;
  const brut = etendue / n;
  const e = Math.floor(Math.log10(brut));
  for (const m of [1, 2, 5, 10]) if (m * 10 ** e >= brut) return m * 10 ** e;
  return 10 ** (e + 1);
}

const EXPOSANTS: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

export interface OptionsFond {
  titre_x?: string;
  titre_y?: string;
  grille?: boolean;
  dec_x?: number | null;
  dec_y?: number | null;
  fmt_x?: ((v: number) => string) | null;
  fmt_y?: ((v: number) => string) | null;
  n_x?: number;
  n_y?: number;
}

/** Rectangle de tracé : x0..x1, y0..y1 en coordonnées de données (logarithmiques si demandé). */
export class Axes {
  cadre: Rect;
  r: Rect;
  p!: Peintre;

  constructor(
    rect: Rect,
    public x0: number,
    public x1: number,
    public y0: number,
    public y1: number,
    public xlog = false,
    public ylog = false,
    marges: [number, number, number, number] = [46, 12, 14, 30],
  ) {
    const [g, h, d, b] = marges;
    this.cadre = rect.copie();
    this.r = new Rect(rect.x + g, rect.y + h, Math.max(10.0, rect.w - g - d), Math.max(10.0, rect.h - h - b));
  }

  private t(v: number, a: number, b: number, log: boolean): number {
    if (log) {
      v = Math.max(v, 1e-300);
      return (Math.log10(v) - Math.log10(a)) / (Math.log10(b) - Math.log10(a));
    }
    return b !== a ? (v - a) / (b - a) : 0.0;
  }

  px(x: number): number {
    return this.r.left + this.r.w * this.t(x, this.x0, this.x1, this.xlog);
  }

  py(y: number): number {
    return this.r.bottom - this.r.h * this.t(y, this.y0, this.y1, this.ylog);
  }

  pt(x: number, y: number): Pt {
    return new Pt(this.px(x), this.py(y));
  }

  x_de_px(X: number): number {
    const t = (X - this.r.left) / this.r.w;
    if (this.xlog) return 10 ** (Math.log10(this.x0) + t * (Math.log10(this.x1) - Math.log10(this.x0)));
    return this.x0 + t * (this.x1 - this.x0);
  }

  y_de_px(Y: number): number {
    const t = (this.r.bottom - Y) / this.r.h;
    if (this.ylog) return 10 ** (Math.log10(this.y0) + t * (Math.log10(this.y1) - Math.log10(this.y0)));
    return this.y0 + t * (this.y1 - this.y0);
  }

  /** Associe le peintre (à appeler avant les tracés) ; rend this. */
  avec(p: Peintre): this {
    this.p = p;
    return this;
  }

  fond(p: Peintre, o: OptionsFond = {}): void {
    const { titre_x = '', titre_y = '', grille = true, dec_x = null, dec_y = null, fmt_x = null, fmt_y = null, n_x = 6, n_y = 5 } = o;
    p.save();
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(dessin.c('sphere', 0.15));
    p.drawRect(this.r);
    dessin.police(p, 0.85);
    const gx = Axes.graduations(this.x0, this.x1, this.xlog, n_x);
    const gy = Axes.graduations(this.y0, this.y1, this.ylog, n_y);
    if (grille) {
      p.setPen(dessin.stylo('grille', 0.6, 0.5));
      const segs: [number, number, number, number][] = [];
      for (const v of gx) segs.push([Math.round(this.px(v)) + 0.5, this.r.top, Math.round(this.px(v)) + 0.5, this.r.bottom]);
      for (const v of gy) segs.push([this.r.left, Math.round(this.py(v)) + 0.5, this.r.right, Math.round(this.py(v)) + 0.5]);
      p.drawLines(segs);
    }
    for (const v of gx) dessin.texte(p, this.px(v), this.r.bottom + 11, fmt_x ? fmt_x(v) : Axes.etiq(v, this.xlog, dec_x), 'doux');
    for (const v of gy) {
      const Y = this.py(v);
      const s = fmt_y ? fmt_y(v) : Axes.etiq(v, this.ylog, dec_y);
      const fm = p.fontMetrics();
      dessin.texte(p, this.r.left - 4 - fm.horizontalAdvance(s), Y + fm.ascent() / 2 - 1, s, 'doux', { centre: false });
    }
    if (titre_x) dessin.texte(p, this.r.cx, this.r.bottom + 24, titre_x, 'doux');
    if (titre_y) {
      p.save();
      p.translate(this.cadre.x + 9, this.r.cy);
      p.rotate(-90);
      dessin.texte(p, 0, 0, titre_y, 'doux');
      p.restore();
    }
    dessin.police(p, 1 / 0.85);
    p.restore();
  }

  static graduations(a: number, b: number, log: boolean, n: number): number[] {
    const lo = Math.min(a, b),
      hi = Math.max(a, b);
    if (log) {
      const out: number[] = [];
      for (let k = Math.floor(Math.log10(lo)); k <= Math.ceil(Math.log10(hi)); k++) {
        const v = 10.0 ** k;
        if (lo * 0.999 <= v && v <= hi * 1.001) out.push(v);
      }
      if (out.length <= 2) {
        for (let k = Math.floor(Math.log10(lo)); k <= Math.ceil(Math.log10(hi)); k++)
          for (const m of [2, 5]) {
            const v = m * 10.0 ** k;
            if (lo * 0.999 <= v && v <= hi * 1.001) out.push(v);
          }
      }
      return out.sort((x, y) => x - y);
    }
    const s = pas_lisible(hi - lo, n);
    let v = Math.ceil(lo / s - 1e-9) * s;
    const out: number[] = [];
    while (v <= hi + 1e-9 * s) {
      out.push(Math.abs(v) < 1e-12 * s ? 0.0 : v);
      v += s;
    }
    return out;
  }

  static etiq(v: number, log: boolean, dec: number | null): string {
    if (log) {
      if (v >= 1e5 || v < 1e-3) {
        const e = Math.trunc(pround(Math.log10(v)));
        const m = v / 10 ** e;
        const exp = String(e).split('').map((ch) => EXPOSANTS[ch] ?? ch).join('');
        return Math.abs(m - 1) < 1e-6 ? `10${exp}` : `${nombre(m, 0)}×10${exp}`;
      }
      const d = v >= 1 ? 0 : Math.trunc(Math.ceil(-Math.log10(v)));
      return nombre(v, d);
    }
    if (dec === null || dec === undefined) dec = Math.abs(v) >= 10 || v === Math.trunc(v) ? 0 : Math.abs(v) >= 1 ? 1 : 2;
    return nombre(v, dec);
  }

  /** Points (x, y) de données → tableaux de pixels (les y non finis sont omis). */
  polygone(pts: readonly (readonly [number, number])[]): [number[], number[]] {
    const r = this.r;
    let fx: (x: number) => number, fy: (y: number) => number;
    if (this.xlog) {
      const lx0 = Math.log10(this.x0),
        lx1 = Math.log10(this.x1);
      fx = (x) => r.left + (r.w * (Math.log10(Math.max(x, 1e-300)) - lx0)) / (lx1 - lx0);
    } else {
      const ax = r.w / (this.x1 - this.x0),
        bx = r.left - (r.w * this.x0) / (this.x1 - this.x0);
      fx = (x) => ax * x + bx;
    }
    if (this.ylog) {
      const ly0 = Math.log10(this.y0),
        ly1 = Math.log10(this.y1);
      fy = (y) => r.bottom - (r.h * (Math.log10(Math.max(y, 1e-300)) - ly0)) / (ly1 - ly0);
    } else {
      const ay = -r.h / (this.y1 - this.y0),
        by = r.bottom + (r.h * this.y0) / (this.y1 - this.y0);
      fy = (y) => ay * y + by;
    }
    const xs: number[] = [],
      ys: number[] = [];
    for (const [x, y] of pts) {
      if (!Number.isFinite(y)) continue;
      xs.push(fx(x));
      ys.push(fy(y));
    }
    return [xs, ys];
  }

  courbe(pts: readonly (readonly [number, number])[], cle: dessin.CouleurOuCle = 'accent1', epaisseur = 2.0, alpha = 1.0, pointille = false, couper = true): void {
    const poly = this.polygone(pts);
    const p = this.p;
    p.save();
    if (couper) p.setClipRect(this.r.adjusted(-1, -1, 1, 1));
    p.setPen(dessin.stylo(cle, epaisseur, alpha, pointille));
    p.setBrush(null);
    p.drawPolyline(poly);
    p.restore();
  }

  remplir(pts0: readonly (readonly [number, number])[], couleur: dessin.CouleurOuCle, alpha = 0.3, base: number | null = null): void {
    const b = base === null ? this.y0 : base;
    const pts = pts0.filter(([, y]) => Number.isFinite(y));
    if (!pts.length) return;
    const poly = this.polygone([[pts[0]![0], b], ...pts, [pts[pts.length - 1]![0], b]]);
    const p = this.p;
    p.save();
    p.setClipRect(this.r);
    p.setPen(null);
    const col = typeof couleur === 'string' ? dessin.c(couleur, alpha) : couleur.copie().setAlphaF(alpha);
    p.setBrush(col);
    p.drawPolygon(poly);
    p.restore();
  }

  points(pts: readonly (readonly [number, number])[], cle: dessin.CouleurOuCle = 'texte', rayon = 1.6, alpha = 0.8): void {
    const p = this.p;
    p.save();
    p.setClipRect(this.r);
    p.setPen(null);
    p.setBrush(typeof cle === 'string' ? dessin.c(cle, alpha) : cle);
    for (const [x, y] of pts) p.drawEllipse(this.px(x), this.py(y), rayon, rayon);
    p.restore();
  }

  verticale(x: number, cle: dessin.CouleurOuCle = 'accent3', epaisseur = 1.2, pointille = true, etiquette = ''): void {
    const p = this.p;
    const X = this.px(x);
    if (!(this.r.left - 1 <= X && X <= this.r.right + 1)) return;
    p.setPen(dessin.stylo(cle, epaisseur, null, pointille));
    p.drawLine(X, this.r.top, X, this.r.bottom);
    if (etiquette) dessin.texte(p, X, this.r.top + 10, etiquette, cle, { fond: true });
  }

  horizontale(y: number, cle: dessin.CouleurOuCle = 'accent3', epaisseur = 1.2, pointille = true, etiquette = ''): void {
    const p = this.p;
    const Y = this.py(y);
    if (!(this.r.top - 1 <= Y && Y <= this.r.bottom + 1)) return;
    p.setPen(dessin.stylo(cle, epaisseur, null, pointille));
    p.drawLine(this.r.left, Y, this.r.right, Y);
    if (etiquette) dessin.texte(p, this.r.right - 4 - p.fontMetrics().horizontalAdvance(etiquette), Y - 9, etiquette, cle, { centre: false, fond: true });
  }

  /** Bande colorée du spectre visible (axe x en nm × echelle). */
  bande_visible(alpha = 0.22, lam0 = 380.0, lam1 = 750.0, echelle = 1.0): void {
    const p = this.p;
    const x0 = this.px(lam0 * echelle),
      x1 = this.px(lam1 * echelle);
    if (x1 < this.r.left || x0 > this.r.right) return;
    p.save();
    p.setClipRect(this.r);
    p.setPen(null);
    p.setBrush(degrade_spectre(x0, x1, this.r.top, alpha, lam0, lam1));
    p.drawRect(new Rect(x0, this.r.top, x1 - x0, this.r.h));
    p.restore();
  }
}

/** Dégradé horizontal des couleurs du spectre de lam0 à lam1 (nm) entre les abscisses x0 et x1. */
export function degrade_spectre(
  x0: number, x1: number, y: number, alpha = 1.0, lam0 = 380.0, lam1 = 750.0,
  intensite: ((lam: number) => number) | null = null, pas_nm = 5.0,
): Degrade {
  const n = Math.max(2, Math.trunc((lam1 - lam0) / pas_nm));
  const arrets: [number, Couleur][] = [];
  for (let k = 0; k <= n; k++) {
    const lam = lam0 + ((lam1 - lam0) * k) / n;
    const [r, g, b] = couleur_longueur_onde(lam);
    if (intensite === null) arrets.push([k / n, new Couleur(r, g, b, alpha)]);
    else {
      const f = Math.max(0.0, Math.min(1.0, intensite(lam)));
      arrets.push([k / n, new Couleur(Math.trunc(r * f), Math.trunc(g * f), Math.trunc(b * f), alpha)]);
    }
  }
  return { x0, y0: y, x1, y1: y, arrets };
}

/** Bande d'un spectre visible de lam0 à lam1 nm : continuum coloré et raies brillantes ou sombres. */
export function bande_spectre(
  p: Peintre, r: Rect, lam0: number, lam1: number, intensite: ((lam: number) => number) | null = null,
  raies: readonly (readonly [number, number, number])[] = [], raies_absorption = false, pas_px = 4.0,
): void {
  p.save();
  p.setPen(null);
  p.fillRect(r, new Couleur(8, 8, 10));
  if (intensite !== null) p.fillRect(r, degrade_spectre(r.left, r.right, r.top, 1.0, lam0, lam1, intensite, pas_px));
  for (const [lam, force, ep] of raies) {
    if (lam0 <= lam && lam <= lam1) {
      const X = r.left + (r.w * (lam - lam0)) / (lam1 - lam0);
      let col: Couleur;
      if (raies_absorption) col = new Couleur(0, 0, 0, Math.max(0.0, Math.min(1.0, force)));
      else {
        const [rr, gg, bb] = couleur_longueur_onde(lam);
        col = new Couleur(rr, gg, bb, Math.max(0.0, Math.min(1.0, force)));
      }
      p.fillRect(new Rect(X - ep / 2, r.top, ep, r.h), col);
    }
  }
  p.setPen(dessin.stylo('grille', 1.0));
  p.setBrush(null);
  p.drawRect(r);
  p.restore();
}
