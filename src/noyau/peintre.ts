/**
 * Peintre : un QPainter réduit au-dessus de CanvasRenderingContext2D, pour que les animations de Coupole (écrites
 * pour QPainter) se transposent ligne à ligne.  Conventions de Qt reprises : stylo (couleur, épaisseur, pointillé),
 * brosse, police relative, angles de drawPie/drawArc en 1/16 de degré comptés dans le sens trigonométrique depuis
 * 3 heures, pointillés « DashLine » de 4 × 2 épaisseurs.
 */

// ==================================================================== couleur
export class Couleur {
  constructor(
    public r: number,
    public g: number,
    public b: number,
    public a = 1,
  ) {}

  static hex(h: string, alpha?: number): Couleur {
    const v = parseInt(h.slice(1), 16);
    return new Couleur((v >> 16) & 255, (v >> 8) & 255, v & 255, alpha ?? 1);
  }

  copie(): Couleur {
    return new Couleur(this.r, this.g, this.b, this.a);
  }

  alphaF(): number {
    return this.a;
  }

  setAlphaF(a: number): this {
    this.a = Math.max(0, Math.min(1, a));
    return this;
  }

  avecAlpha(a: number): Couleur {
    return new Couleur(this.r, this.g, this.b, Math.max(0, Math.min(1, a)));
  }

  /** QColor.lighter / darker (facteur en %), approché en HSV comme Qt. */
  plusClaire(f = 150): Couleur {
    const k = f / 100;
    return new Couleur(Math.min(255, this.r * k), Math.min(255, this.g * k), Math.min(255, this.b * k), this.a);
  }

  css(): string {
    const r = Math.round(Math.max(0, Math.min(255, this.r)));
    const g = Math.round(Math.max(0, Math.min(255, this.g)));
    const b = Math.round(Math.max(0, Math.min(255, this.b)));
    return this.a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${Math.round(this.a * 1000) / 1000})`;
  }
}

export function rgb(r: number, g: number, b: number, a = 1): Couleur {
  return new Couleur(r, g, b, a);
}

// ==================================================================== géométrie plane
export class Pt {
  constructor(
    public x: number,
    public y: number,
  ) {}
}

export function pt(x: number, y: number): Pt {
  return new Pt(x, y);
}

export class Rect {
  constructor(
    public x: number,
    public y: number,
    public w: number,
    public h: number,
  ) {}

  get left(): number {
    return this.x;
  }
  get top(): number {
    return this.y;
  }
  get right(): number {
    return this.x + this.w;
  }
  get bottom(): number {
    return this.y + this.h;
  }
  get cx(): number {
    return this.x + this.w / 2;
  }
  get cy(): number {
    return this.y + this.h / 2;
  }
  center(): Pt {
    return new Pt(this.cx, this.cy);
  }
  copie(): Rect {
    return new Rect(this.x, this.y, this.w, this.h);
  }
  /** QRectF.adjusted(dx1, dy1, dx2, dy2). */
  adjusted(a: number, b: number, c: number, d: number): Rect {
    return new Rect(this.x + a, this.y + b, this.w - a + c, this.h - b + d);
  }
  contains(p: Pt): boolean {
    return p.x >= this.x && p.x <= this.right && p.y >= this.y && p.y <= this.bottom;
  }
  /** Rectangle de même centre, de taille donnée. */
  static centre(cx: number, cy: number, w: number, h: number): Rect {
    return new Rect(cx - w / 2, cy - h / 2, w, h);
  }
}

// ==================================================================== stylo, brosse, police
export interface Stylo {
  couleur: Couleur;
  epaisseur: number;
  pointille: boolean;
  /** 'round' par défaut (dessin.stylo) ; 'square' pour un QPen brut */
  bout?: CanvasLineCap;
  jointure?: CanvasLineJoin;
}

export type Brosse = Couleur | CanvasGradient | null;

export interface Degrade {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  arrets: [number, Couleur][];
}

/** Taille de base de la police (pixels CSS), mise à jour selon la taille de la toile. */
export let TAILLE_POLICE = 13;
export function reglerTaillePolice(px: number): void {
  TAILLE_POLICE = px;
}
export const FAMILLE = "'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface Police {
  taille: number; // pixels
  gras: boolean;
}

export interface Metriques {
  horizontalAdvance(s: string): number;
  ascent(): number;
  descent(): number;
  height(): number;
}

interface Etat {
  stylo: Stylo | null;
  brosse: Brosse;
  police: Police;
}

/** Contexte minimal dont le peintre a besoin (le vrai CanvasRenderingContext2D, ou un faux pour les tests). */
export type Contexte = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export class Peintre {
  private stylo_: Stylo | null = { couleur: new Couleur(0, 0, 0), epaisseur: 1, pointille: false, bout: 'square' };
  private brosse_: Brosse = null;
  private police_: Police;
  private pile: Etat[] = [];
  private policeAppliquee = '';

  constructor(public ctx: Contexte) {
    this.police_ = { taille: TAILLE_POLICE, gras: false };
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  }

  // ------------------------------------------------------------ état
  save(): void {
    this.pile.push({ stylo: this.stylo_, brosse: this.brosse_, police: { ...this.police_ } });
    this.ctx.save();
  }

  restore(): void {
    const e = this.pile.pop();
    this.ctx.restore();
    if (e) {
      this.stylo_ = e.stylo;
      this.brosse_ = e.brosse;
      this.police_ = e.police;
      this.policeAppliquee = '';
    }
  }

  /** setPen(QPen | QColor | Qt.NoPen). */
  setPen(s: Stylo | Couleur | null): void {
    if (s instanceof Couleur) this.stylo_ = { couleur: s, epaisseur: 1, pointille: false, bout: 'square' };
    else this.stylo_ = s;
  }

  pen(): Stylo | null {
    return this.stylo_;
  }

  setBrush(b: Brosse | Degrade): void {
    if (b && !(b instanceof Couleur) && 'arrets' in b) this.brosse_ = this.degrade(b);
    else this.brosse_ = b as Brosse;
  }

  degrade(d: Degrade): CanvasGradient {
    const g = this.ctx.createLinearGradient(d.x0, d.y0, d.x1, d.y1);
    for (const [t, c] of d.arrets) g.addColorStop(Math.max(0, Math.min(1, t)), c.css());
    return g;
  }

  font(): Police {
    return { ...this.police_ };
  }

  setFont(f: Police): void {
    this.police_ = { ...f };
  }

  private appliquerPolice(): void {
    const css = `${this.police_.gras ? 600 : 400} ${Math.round(this.police_.taille * 100) / 100}px ${FAMILLE}`;
    if (css !== this.policeAppliquee) {
      this.ctx.font = css;
      this.policeAppliquee = css;
    }
  }

  fontMetrics(): Metriques {
    this.appliquerPolice();
    const t = this.police_.taille;
    return {
      horizontalAdvance: (s: string) => {
        this.appliquerPolice();
        return this.ctx.measureText(s).width;
      },
      ascent: () => t * 0.97,
      descent: () => t * 0.24,
      height: () => t * 1.21,
    };
  }

  // ------------------------------------------------------------ transformations, découpe
  translate(x: number, y: number): void {
    this.ctx.translate(x, y);
  }

  /** Rotation en degrés (sens horaire à l'écran, comme Qt). */
  rotate(deg: number): void {
    this.ctx.rotate((deg * Math.PI) / 180);
  }

  scale(sx: number, sy: number): void {
    this.ctx.scale(sx, sy);
  }

  setClipRect(r: Rect): void {
    this.ctx.beginPath();
    this.ctx.rect(r.x, r.y, r.w, r.h);
    this.ctx.clip();
  }

  setClipPath(p: Path2D): void {
    this.ctx.clip(p);
  }

  // ------------------------------------------------------------ tracés
  private avecStylo(): boolean {
    const s = this.stylo_;
    if (!s) return false;
    const ctx = this.ctx;
    ctx.strokeStyle = s.couleur.css();
    const w = s.epaisseur <= 0 ? 1 : s.epaisseur;
    ctx.lineWidth = w;
    ctx.lineCap = s.bout ?? 'round';
    ctx.lineJoin = s.jointure ?? 'round';
    if (s.pointille) {
      const u = Math.max(1, w);
      ctx.setLineDash([4 * u, 2 * u]);
    } else ctx.setLineDash([]);
    return true;
  }

  private remplir(): boolean {
    const b = this.brosse_;
    if (!b) return false;
    this.ctx.fillStyle = b instanceof Couleur ? b.css() : b;
    return true;
  }

  drawLine(x0: number, y0: number, x1: number, y1: number): void {
    if (!this.avecStylo()) return;
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  drawLineP(a: Pt, b: Pt): void {
    this.drawLine(a.x, a.y, b.x, b.y);
  }

  drawLines(segments: [number, number, number, number][]): void {
    if (!this.avecStylo() || !segments.length) return;
    const ctx = this.ctx;
    ctx.beginPath();
    for (const [a, b, c, d] of segments) {
      ctx.moveTo(a, b);
      ctx.lineTo(c, d);
    }
    ctx.stroke();
  }

  private chemin(xs: ArrayLike<number>, ys: ArrayLike<number>, debut = 0, fin = xs.length, fermer = false): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(xs[debut]!, ys[debut]!);
    for (let i = debut + 1; i < fin; i++) ctx.lineTo(xs[i]!, ys[i]!);
    if (fermer) ctx.closePath();
  }

  /** Polyligne ouverte (tableaux de x et de y, ou liste de points). */
  drawPolyline(pts: Pt[] | [number[], number[]], debut = 0, fin?: number): void {
    const [xs, ys] = Array.isArray(pts[0]) ? (pts as [number[], number[]]) : separer(pts as Pt[]);
    const f = fin ?? xs.length;
    if (f - debut < 2 || !this.avecStylo()) return;
    this.chemin(xs, ys, debut, f);
    this.ctx.stroke();
  }

  drawPolygon(pts: Pt[] | [number[], number[]]): void {
    const [xs, ys] = Array.isArray(pts[0]) ? (pts as [number[], number[]]) : separer(pts as Pt[]);
    if (xs.length < 2) return;
    this.chemin(xs, ys, 0, xs.length, true);
    if (this.remplir()) this.ctx.fill();
    if (this.avecStylo()) this.ctx.stroke();
  }

  drawPath(p: Path2D): void {
    if (this.remplir()) this.ctx.fill(p);
    if (this.avecStylo()) this.ctx.stroke(p);
  }

  /** drawEllipse(centre, rx, ry) ou drawEllipse(rect). */
  drawEllipse(cx: number | Rect, cy?: number, rx?: number, ry?: number): void {
    let x: number, y: number, a: number, b: number;
    if (cx instanceof Rect) {
      x = cx.cx;
      y = cx.cy;
      a = cx.w / 2;
      b = cx.h / 2;
    } else {
      x = cx;
      y = cy!;
      a = rx!;
      b = ry ?? rx!;
    }
    if (!(a > 0) || !(b > 0)) return;
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.ellipse(x, y, a, b, 0, 0, 2 * Math.PI);
    if (this.remplir()) ctx.fill();
    if (this.avecStylo()) ctx.stroke();
  }

  drawRect(r: Rect): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    if (this.remplir()) ctx.fill();
    if (this.avecStylo()) ctx.stroke();
  }

  drawRoundedRect(r: Rect, rx: number, ry?: number): void {
    const ctx = this.ctx;
    const rr = Math.max(0, Math.min(rx, ry ?? rx, Math.abs(r.w) / 2, Math.abs(r.h) / 2));
    ctx.beginPath();
    if (r.w <= 0 || r.h <= 0) return;
    ctx.moveTo(r.x + rr, r.y);
    ctx.arcTo(r.right, r.y, r.right, r.bottom, rr);
    ctx.arcTo(r.right, r.bottom, r.x, r.bottom, rr);
    ctx.arcTo(r.x, r.bottom, r.x, r.y, rr);
    ctx.arcTo(r.x, r.y, r.right, r.y, rr);
    ctx.closePath();
    if (this.remplir()) ctx.fill();
    if (this.avecStylo()) ctx.stroke();
  }

  fillRect(r: Rect, b: Couleur | Degrade | CanvasGradient): void {
    const ctx = this.ctx;
    if (b instanceof Couleur) ctx.fillStyle = b.css();
    else if ('arrets' in b) ctx.fillStyle = this.degrade(b);
    else ctx.fillStyle = b;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }

  private arcEllipse(r: Rect, debut16: number, etendue16: number, part: boolean): void {
    const ctx = this.ctx;
    const a0 = (-debut16 / 16) * (Math.PI / 180);
    const a1 = (-(debut16 + etendue16) / 16) * (Math.PI / 180);
    ctx.beginPath();
    if (part) ctx.moveTo(r.cx, r.cy);
    ctx.ellipse(r.cx, r.cy, Math.max(0, r.w / 2), Math.max(0, r.h / 2), 0, a0, a1, etendue16 > 0);
    if (part) ctx.closePath();
  }

  /** drawPie(rect, début, étendue) : angles en 1/16 de degré (Qt). */
  drawPie(r: Rect, debut16: number, etendue16: number): void {
    if (etendue16 === 0) return;
    this.arcEllipse(r, debut16, etendue16, true);
    if (this.remplir()) this.ctx.fill();
    if (this.avecStylo()) this.ctx.stroke();
  }

  drawArc(r: Rect, debut16: number, etendue16: number): void {
    if (etendue16 === 0 || !this.avecStylo()) return;
    this.arcEllipse(r, debut16, etendue16, false);
    this.ctx.stroke();
  }

  drawPoints(pts: Pt[]): void {
    const s = this.stylo_;
    if (!s) return;
    const w = Math.max(1, s.epaisseur);
    this.ctx.fillStyle = s.couleur.css();
    for (const p of pts) this.ctx.fillRect(p.x - w / 2, p.y - w / 2, w, w);
  }

  /** drawText(point, texte) : point = ligne de base à gauche (comme Qt). */
  drawText(x: number, y: number, s: string): void {
    const st = this.stylo_;
    if (!st) return;
    this.appliquerPolice();
    this.ctx.fillStyle = st.couleur.css();
    this.ctx.fillText(s, x, y);
  }

  drawImage(x: number, y: number, img: CanvasImageSource, w?: number, h?: number): void {
    if (w !== undefined && h !== undefined) this.ctx.drawImage(img, x, y, w, h);
    else this.ctx.drawImage(img, x, y);
  }
}

function separer(pts: Pt[]): [number[], number[]] {
  const xs = new Array<number>(pts.length);
  const ys = new Array<number>(pts.length);
  for (let i = 0; i < pts.length; i++) {
    xs[i] = pts[i]!.x;
    ys[i] = pts[i]!.y;
  }
  return [xs, ys];
}

/** Chemin (QPainterPath) à partir d'un polygone. */
export function cheminPolygone(pts: Pt[]): Path2D {
  const p = new Path2D();
  if (!pts.length) return p;
  p.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i]!.x, pts[i]!.y);
  p.closePath();
  return p;
}
