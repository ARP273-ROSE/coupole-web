/**
 * Dessin des animations (transposition de dessin.py de Coupole) : projection orthographique d'une sphère, couleurs
 * selon le thème, tracés en deux passes (sous puis sur un plan) et petits outils.
 *
 * Le repère « monde » d'une vue est direct : pour une sphère locale x = nord, y = ouest, z = zénith ; pour une sphère
 * céleste x = point vernal, y = 6 h, z = pôle nord.  Le point de vue est donné par son azimut (compté comme l'azimut
 * astronomique, depuis +x vers −y) et sa hauteur au-dessus du plan xy.
 */
import { Couleur, type Degrade, type Peintre, Pt, Rect, type Stylo } from './peintre';
import { linspace } from './py';
import { cross, dot, norme, type Pts, type V3 } from './vec';

export const DEG = Math.PI / 180;

export const PALETTES = {
  sombre: {
    fond: '#1B1F26', texte: '#D9DDE2', doux: '#A3ABB6', grille: '#4A525E', sphere: '#2A3240',
    ciel: '#2C4A6B', sol: '#3E5B3A', horizon: '#7FA36F', equateur: '#6FA8DC', ecliptique: '#E8A85C',
    meridien: '#C9A0DC', soleil: '#FFD25A', lune: '#D8D8D0', terre: '#4F86C6', mars: '#E07050',
    etoile: '#FFFFFF', accent1: '#F2C14E', accent2: '#7CC4E8', accent3: '#F28C8C',
    ombre: '#000000', nuit: '#0E1218', arc1: '#A99BFF', arc2: '#FF8F87',
    umbra: '#05070A', penombre: '#9AA6B6',
  },
  clair: {
    fond: '#FBFBF8', texte: '#2E333B', doux: '#646C77', grille: '#C9CED4', sphere: '#E6ECF2',
    ciel: '#BFD7EE', sol: '#A9C79B', horizon: '#4E7A3E', equateur: '#2F6FAF', ecliptique: '#C2701C',
    meridien: '#8A4FA6', soleil: '#C08400', lune: '#8C8C84', terre: '#2F6FAF', mars: '#B8452C',
    etoile: '#2E333B', accent1: '#B07A00', accent2: '#1F7AA6', accent3: '#B5403C',
    ombre: '#000000', nuit: '#5A6270', arc1: '#4B3FC9', arc2: '#C0392B',
    umbra: '#1B1F26', penombre: '#5A6270',
  },
} as const;

export type Theme = keyof typeof PALETTES;
export type CleCouleur = keyof (typeof PALETTES)['sombre'];

let themeCourant: Theme = 'sombre';
export function theme(): Theme {
  return themeCourant;
}
export function choisirTheme(t: Theme): void {
  themeCourant = t;
}

const cache = new Map<string, Couleur>();
/** Couleur d'une clé de la palette du thème courant (alpha facultatif). */
export function c(cle: CleCouleur | string, alpha?: number | null): Couleur {
  const k = themeCourant + cle;
  let base = cache.get(k);
  if (!base) {
    const hex = (PALETTES[themeCourant] as Record<string, string>)[cle];
    base = hex ? Couleur.hex(hex) : Couleur.hex('#FF00FF');
    cache.set(k, base);
  }
  const col = base.copie();
  if (alpha !== undefined && alpha !== null) col.setAlphaF(alpha);
  return col;
}

export type CouleurOuCle = string | Couleur;

function couleurDe(x: CouleurOuCle, alpha?: number | null): Couleur {
  if (typeof x === 'string') return c(x, alpha);
  const col = x.copie();
  if (alpha !== undefined && alpha !== null) col.setAlphaF(alpha);
  return col;
}

export function stylo(cle: CouleurOuCle, epaisseur = 1.5, alpha: number | null = null, pointille = false): Stylo {
  return { couleur: couleurDe(cle, alpha), epaisseur, pointille, bout: 'round', jointure: 'round' };
}

/** Change la taille relative (et la graisse) de la police du peintre, comme dessin.police. */
export function police(p: Peintre, taille_relative = 1.0, gras = false): void {
  const f = p.font();
  f.taille = Math.max(8, f.taille * taille_relative);
  f.gras = gras;
  p.setFont(f);
}

export interface OptionsTexte {
  centre?: boolean;
  alpha?: number | null;
  fond?: boolean;
}

/** Texte centré (ou aligné à gauche si centre: false) au point (x, y) ; `fond` : petit cartouche sous le texte. */
export function texte(p: Peintre, x: number, y: number, s: string, cle: CouleurOuCle = 'texte', o: OptionsTexte = {}): void {
  const centre = o.centre ?? true;
  const alpha = o.alpha ?? null;
  const fond = o.fond ?? false;
  const fm = p.fontMetrics();
  const w = fm.horizontalAdvance(s);
  const h = fm.height();
  const x0 = centre ? x - w / 2 : x;
  const y0 = centre ? y + fm.ascent() / 2 - 1 : y;
  if (fond) {
    p.save();
    p.setPen(null);
    p.setBrush(c('fond', 0.75));
    p.drawRoundedRect(new Rect(x0 - 3, y0 - fm.ascent() - 1, w + 6, h + 2), 4, 4);
    p.restore();
  }
  p.setPen(couleurDe(cle, alpha));
  p.drawText(x0, y0, s);
}

export function disque(
  p: Peintre, x: number, y: number, r: number, cle: CouleurOuCle = 'soleil', bord: CouleurOuCle | null = null,
  alpha: number | null = null,
): void {
  p.setBrush(couleurDe(cle, alpha));
  p.setPen(bord ? stylo(bord, 1.0) : null);
  p.drawEllipse(x, y, r, r);
}

export function fleche(p: Peintre, x0: number, y0: number, x1: number, y1: number, pen: Stylo, tete = 8.0): void {
  p.setPen(pen);
  p.drawLine(x0, y0, x1, y1);
  const a = Math.atan2(y1 - y0, x1 - x0);
  const pts = [
    new Pt(x1, y1),
    new Pt(x1 - tete * Math.cos(a - 0.4), y1 - tete * Math.sin(a - 0.4)),
    new Pt(x1 - tete * Math.cos(a + 0.4), y1 - tete * Math.sin(a + 0.4)),
  ];
  p.setBrush(pen.couleur);
  p.drawPolygon(pts);
}

/**
 * Disque de la Lune vu de la Terre pour l'angle de phase `angle` (0 nouvelle, 90 premier quartier, 180 pleine), côté
 * éclairé à droite pour 0 < angle < 180 (hémisphère nord), limbe et terminateur exacts (ellipse).
 */
export function phase_lune(
  p: Peintre, x: number, y: number, r: number, angle: number, cle_eclairee: CouleurOuCle = 'lune',
  cle_sombre: CouleurOuCle = 'nuit', rotation = 0.0,
): void {
  p.save();
  p.translate(x, y);
  p.rotate(rotation);
  p.setPen(null);
  p.setBrush(couleurDe(cle_sombre));
  p.drawEllipse(0, 0, r, r);
  const a = ((angle % 360) + 360) % 360;
  const k = Math.cos(a * DEG);
  const droite = a <= 180.0;
  const n = 64;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / n;
    pts.push(new Pt(r * Math.cos(t) * (droite ? 1 : -1), r * Math.sin(t)));
  }
  for (let i = 0; i <= n; i++) {
    const t = Math.PI / 2 - (Math.PI * i) / n;
    pts.push(new Pt(r * Math.cos(t) * k * (droite ? 1 : -1), r * Math.sin(t)));
  }
  p.setBrush(couleurDe(cle_eclairee));
  p.drawPolygon(pts);
  p.setPen(stylo('doux', 1.0, 0.6));
  p.setBrush(null);
  p.drawEllipse(0, 0, r, r);
  p.restore();
}

// ==================================================================== projection d'une sphère
/** Point de vue d'une scène 3D (projection orthographique) : azimut et hauteur en degrés, bornés. */
export class Vue3D {
  az = 0;
  alt = 0;
  d: V3 = [1, 0, 0];
  droite: V3 = [0, 1, 0];
  haut: V3 = [0, 0, 1];
  defaut: [number, number];

  constructor(
    az = 215.0,
    alt = 30.0,
    public alt_min = -89.0,
    public alt_max = 89.0,
  ) {
    this.defaut = [az, alt];
    this.regler(az, alt);
  }

  regler(az: number, alt: number): void {
    this.az = ((az % 360) + 360) % 360;
    this.alt = Math.max(this.alt_min, Math.min(this.alt_max, alt));
    const a = this.az * DEG,
      h = this.alt * DEG;
    const d: V3 = [Math.cos(h) * Math.cos(a), -Math.cos(h) * Math.sin(a), Math.sin(h)];
    let droite = cross([0, 0, 1], d);
    const n = norme(droite);
    droite = n > 1e-9 ? [droite[0] / n, droite[1] / n, droite[2] / n] : [0, 1, 0];
    this.d = d;
    this.droite = droite;
    this.haut = cross(d, droite);
  }

  reinitialiser(): void {
    this.regler(this.defaut[0], this.defaut[1]);
  }

  tourner(dx_px: number, dy_px: number, sensibilite = 0.4): void {
    this.regler(this.az - dx_px * sensibilite, this.alt + dy_px * sensibilite);
  }

  /** Projection d'un point : [x (droite), y (haut), profondeur (> 0 : devant le centre)]. */
  projeter1(p: readonly number[]): V3 {
    return [dot(p, this.droite), dot(p, this.haut), dot(p, this.d)];
  }
}

/**
 * Points d'un cercle de la sphère unité : tous les points à `angle_centre` degrés de la direction `normale` (90 :
 * grand cercle).  `origine` : direction du point d'angle 0 (projetée), sinon arbitraire.  Sens direct autour de la
 * normale.
 */
export function cercle(
  normale: readonly number[], angle_centre = 90.0, n = 181, debut = 0.0, fin = 360.0,
  origine: readonly number[] | null = null,
): Pts {
  const nn = norme(normale);
  const nrm: V3 = [normale[0]! / nn, normale[1]! / nn, normale[2]! / nn];
  const o: V3 = origine ? [origine[0]!, origine[1]!, origine[2]!] : Math.abs(nrm[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const od = dot(o, nrm);
  let u: V3 = [o[0] - nrm[0] * od, o[1] - nrm[1] * od, o[2] - nrm[2] * od];
  if (norme(u) < 1e-9) {
    u = cross(nrm, [1, 0, 0]);
    if (norme(u) < 1e-9) u = cross(nrm, [0, 1, 0]);
  }
  const nu = norme(u);
  u = [u[0] / nu, u[1] / nu, u[2] / nu];
  const w = cross(nrm, u);
  const t = linspace(debut * DEG, fin * DEG, n);
  const ca = Math.cos(angle_centre * DEG),
    sa = Math.sin(angle_centre * DEG);
  return t.map((ti) => {
    const ct = Math.cos(ti),
      st = Math.sin(ti);
    return [
      nrm[0] * ca + sa * (ct * u[0] + st * w[0]),
      nrm[1] * ca + sa * (ct * u[1] + st * w[1]),
      nrm[2] * ca + sa * (ct * u[2] + st * w[2]),
    ] as V3;
  });
}

/** Arc de grand cercle (le plus court) entre deux directions unitaires. */
export function arc(a: readonly number[], b: readonly number[], n = 60): Pts {
  const om = Math.acos(Math.max(-1.0, Math.min(1.0, dot(a, b))));
  if (om < 1e-9) return [[a[0]!, a[1]!, a[2]!], [b[0]!, b[1]!, b[2]!]];
  const t = linspace(0.0, 1.0, n);
  const so = Math.sin(om);
  return t.map((ti) => {
    const ka = Math.sin((1 - ti) * om) / so,
      kb = Math.sin(ti * om) / so;
    return [ka * a[0]! + kb * b[0]!, ka * a[1]! + kb * b[1]!, ka * a[2]! + kb * b[2]!] as V3;
  });
}

export type Arriere = 'pointille' | 'pale' | 'cache' | 'normal';

export interface OptionsCourbe {
  arriere?: Arriere;
  repere_monde?: boolean;
  ferme?: boolean;
  profondeur?: boolean;
}

export interface OptionsPoint {
  repere_monde?: boolean;
  etiquette?: string | null;
  decal?: [number, number];
  bord?: CouleurOuCle | null;
  toujours?: boolean;
}
export type Transformateur = (pts: Pts) => Pts;

interface Ecran {
  xs: number[];
  ys: number[];
  zs: number[];
  hs: number[];
}

/**
 * Dessine dans une vue : centre et rayon (pixels) de la sphère unité.  `passe` : null (tout), 'dessous' ou 'dessus'
 * (par rapport au plan z = 0 du repère monde).  Ce qui est derrière la sphère (profondeur < 0) est tracé en
 * pointillé et plus pâle.
 */
export class Peintre3D {
  passe: 'dessous' | 'dessus' | null = null;

  constructor(
    public p: Peintre,
    public vue: Vue3D,
    public cx: number,
    public cy: number,
    public r: number,
    public transformer: Transformateur | null = null,
  ) {}

  private monde(pts: Pts, repere_monde: boolean): Pts {
    if (this.transformer && !repere_monde) return this.transformer(pts);
    return pts;
  }

  /** Coordonnées écran de points : xs, ys (pixels), zs (profondeur), hs (hauteur dans le repère monde). */
  ecran(v: Pts | V3 | readonly number[], repere_monde = false): Ecran {
    const pts0: Pts = typeof v[0] === 'number' ? [[v[0] as number, v[1] as number, v[2] as number]] : (v as Pts);
    const pts = this.monde(pts0, repere_monde);
    const n = pts.length;
    const xs = new Array<number>(n),
      ys = new Array<number>(n),
      zs = new Array<number>(n),
      hs = new Array<number>(n);
    const { droite: dr, haut: ha, d } = this.vue;
    for (let i = 0; i < n; i++) {
      const q = pts[i]!;
      xs[i] = this.cx + this.r * (q[0] * dr[0] + q[1] * dr[1] + q[2] * dr[2]);
      ys[i] = this.cy - this.r * (q[0] * ha[0] + q[1] * ha[1] + q[2] * ha[2]);
      zs[i] = q[0] * d[0] + q[1] * d[1] + q[2] * d[2];
      hs[i] = q[2];
    }
    return { xs, ys, zs, hs };
  }

  private garder(haut: boolean): boolean {
    if (this.passe === null) return true;
    const dessus = this.vue.alt >= 0;
    return this.passe === 'dessus' ? haut === dessus : haut !== dessus;
  }

  /** Polyligne 3D ; `arriere` : 'pointille', 'pale', 'cache' ou 'normal' pour la partie derrière la sphère. */
  courbe(pts: Pts, couleur: CouleurOuCle, epaisseur = 1.5, alpha = 1.0, o: OptionsCourbe = {}): void {
    const arriere = o.arriere ?? 'pointille';
    const repere_monde = o.repere_monde ?? false;
    const ferme = o.ferme ?? false;
    const profondeur = o.profondeur ?? true;
    let { xs, ys, zs, hs } = this.ecran(pts, repere_monde);
    if (xs.length < 2) return;
    if (ferme) {
      xs = [...xs, xs[0]!];
      ys = [...ys, ys[0]!];
      zs = [...zs, zs[0]!];
      hs = [...hs, hs[0]!];
    }
    const nseg = xs.length - 1;
    const col = couleurDe(couleur);
    let d = 0;
    while (d < nseg) {
      const av = profondeur ? zs[d]! + zs[d + 1]! >= 0 : true;
      const ha = hs[d]! + hs[d + 1]! >= -1e-9;
      let f = d + 1;
      while (f < nseg) {
        const av2 = profondeur ? zs[f]! + zs[f + 1]! >= 0 : true;
        const ha2 = hs[f]! + hs[f + 1]! >= -1e-9;
        if (av2 !== av || ha2 !== ha) break;
        f++;
      }
      if (this.garder(ha) && (av || arriere !== 'cache')) {
        const a = av || arriere === 'normal' ? alpha : alpha * 0.45;
        const pc = col.copie().setAlphaF(Math.max(0, Math.min(1, a * col.alphaF())));
        this.p.setPen({
          couleur: pc,
          epaisseur: av ? epaisseur : Math.max(1.0, epaisseur * 0.7),
          pointille: !av && arriere === 'pointille',
          bout: 'round',
          jointure: 'round',
        });
        this.p.drawPolyline([xs, ys], d, f + 1);
      }
      d = f;
    }
  }

  point(v: readonly number[], couleur: CouleurOuCle, rayon_px = 5.0, o: OptionsPoint = {}): [number, number, boolean] | null {
    const { repere_monde = false, etiquette = null, decal = [10, -10], bord = null, toujours = false } = o;
    const { xs, ys, zs, hs } = this.ecran(v, repere_monde);
    if (!toujours && !this.garder(hs[0]! >= -1e-9)) return null;
    const av = zs[0]! >= 0;
    const col = couleurDe(couleur);
    if (!av) col.setAlphaF(col.alphaF() * 0.4);
    this.p.setPen(bord ? stylo(bord, 1.0) : null);
    this.p.setBrush(col);
    this.p.drawEllipse(xs[0]!, ys[0]!, rayon_px, rayon_px);
    if (etiquette) texte(this.p, xs[0]! + decal[0], ys[0]! + decal[1], etiquette, 'texte', { alpha: av ? 1.0 : 0.5, fond: true });
    return [xs[0]!, ys[0]!, av];
  }

  etiquette(v: readonly number[], s: string, cle: CouleurOuCle = 'texte', repere_monde = false, toujours = true): void {
    const { xs, ys, zs, hs } = this.ecran(v, repere_monde);
    if (!toujours && !this.garder(hs[0]! >= -1e-9)) return;
    texte(this.p, xs[0]!, ys[0]!, s, cle, { alpha: zs[0]! >= 0 ? 1.0 : 0.5, fond: true });
  }

  segment(
    a: readonly number[], b: readonly number[], couleur: CouleurOuCle, epaisseur = 1.5, alpha = 1.0,
    repere_monde = false,
  ): void {
    this.courbe([[a[0]!, a[1]!, a[2]!], [b[0]!, b[1]!, b[2]!]], couleur, epaisseur, alpha, {
      arriere: 'normal', repere_monde, profondeur: false,
    });
  }

  contour(cle: CouleurOuCle = 'grille', remplir: CouleurOuCle | null = 'sphere', alpha_remplir = 0.35): void {
    this.p.setPen(stylo(cle, 1.2));
    this.p.setBrush(remplir ? couleurDe(remplir, alpha_remplir) : null);
    this.p.drawEllipse(this.cx, this.cy, this.r, this.r);
  }

  /** Disque du plan z = 0 (horizon, plan de l'orbite…). */
  plan(couleur: CouleurOuCle = 'sol', alpha = 0.55, rayon = 1.0, bord: CouleurOuCle | null = 'horizon', repere_monde = true): void {
    const t = linspace(0, 2 * Math.PI, 121);
    const pts: Pts = t.map((a) => [rayon * Math.cos(a), rayon * Math.sin(a), 0]);
    const { xs, ys } = this.ecran(pts, repere_monde);
    this.p.setPen(bord ? stylo(bord, 1.2) : null);
    this.p.setBrush(couleurDe(couleur, alpha));
    this.p.drawPolygon([xs, ys]);
  }

  /** Point de la face avant de la sphère sous le pixel (x, y), dans le repère monde, ou null. */
  depuis_ecran(x: number, y: number): V3 | null {
    const u = (x - this.cx) / this.r;
    const v = -(y - this.cy) / this.r;
    const w2 = 1 - u * u - v * v;
    if (w2 < 0) return null;
    const w = Math.sqrt(w2);
    const { droite: a, haut: b, d } = this.vue;
    return [u * a[0] + v * b[0] + w * d[0], u * a[1] + v * b[1] + w * d[1], u * a[2] + v * b[2] + w * d[2]];
  }
}

/** Ombre la moitié de la sphère opposée à la direction `soleil` (repère monde). */
export function hemisphere_nuit(pe: Peintre3D, soleil: readonly number[], couleur: CouleurOuCle = 'nuit', alpha = 0.6): void {
  const ns = norme(soleil);
  const s: V3 = [soleil[0]! / ns, soleil[1]! / ns, soleil[2]! / ns];
  const d = pe.vue.d;
  let a = cross(s, d);
  pe.p.save();
  pe.p.setPen(null);
  pe.p.setBrush(couleurDe(couleur, alpha));
  if (norme(a) < 1e-6) {
    if (dot(s, d) < 0) pe.p.drawEllipse(pe.cx, pe.cy, pe.r, pe.r);
    pe.p.restore();
    return;
  }
  const na = norme(a);
  a = [a[0] / na, a[1] / na, a[2] / na];
  let b = cross(s, a);
  if (dot(b, d) < 0) b = [-b[0], -b[1], -b[2]];
  let cc = cross(d, a);
  const nc = norme(cc);
  cc = [cc[0] / nc, cc[1] / nc, cc[2] / nc];
  if (dot(cc, s) > 0) cc = [-cc[0], -cc[1], -cc[2]];
  const t = linspace(0.0, Math.PI, 61);
  const pts: Pts = [];
  for (const ti of t) {
    const co = Math.cos(ti),
      si = Math.sin(ti);
    pts.push([co * a[0] + si * b[0], co * a[1] + si * b[1], co * a[2] + si * b[2]]);
  }
  for (const ti of t) {
    const co = -Math.cos(ti),
      si = Math.sin(ti);
    pts.push([co * a[0] + si * cc[0], co * a[1] + si * cc[1], co * a[2] + si * cc[2]]);
  }
  const xs: number[] = [],
    ys: number[] = [];
  for (const q of pts) {
    const [u, v] = pe.vue.projeter1(q);
    xs.push(pe.cx + pe.r * u);
    ys.push(pe.cy - pe.r * v);
  }
  pe.p.drawPolygon([xs, ys]);
  pe.p.restore();
}

/** Appelle dessiner(pe) sous le plan, dessine le plan, puis dessiner(pe) au-dessus. */
export function scene_en_deux_passes(pe: Peintre3D, dessiner: (pe: Peintre3D) => void, plan: (() => void) | null = null): void {
  pe.passe = 'dessous';
  dessiner(pe);
  if (plan) plan();
  pe.passe = 'dessus';
  dessiner(pe);
  pe.passe = null;
}

/** Partage `rect` en n panneaux côte à côte si la place le permet, sinon les uns sous les autres (ou grille 2 × k). */
export function zones(rect: Rect, n: number, rapport_min = 0.8): Rect[] {
  const w = rect.w,
    h = rect.h;
  if (n <= 1) return [rect.copie()];
  if (w >= n * h * rapport_min) {
    const lw = w / n;
    return Array.from({ length: n }, (_, i) => new Rect(rect.x + i * lw, rect.y, lw, h));
  }
  if (n >= 3 && w >= h * 0.9) {
    const cols = 2;
    const lignes = Math.floor((n + 1) / 2);
    const lw = w / cols,
      lh = h / lignes;
    return Array.from({ length: n }, (_, i) => new Rect(rect.x + (i % cols) * lw, rect.y + Math.floor(i / cols) * lh, lw, lh));
  }
  const lh = h / n;
  return Array.from({ length: n }, (_, i) => new Rect(rect.x, rect.y + i * lh, w, lh));
}

/** Une grande zone et `n_secondaires` petites empilées à côté (ou toutes empilées si la place est haute et étroite). */
export function zones_principale(rect: Rect, n_secondaires = 2, part = 0.56): Rect[] {
  const w = rect.w,
    h = rect.h;
  if (w < h * 1.1) return zones(rect, 1 + n_secondaires, 10.0);
  const gw = w * part;
  const out = [new Rect(rect.x, rect.y, gw, h)];
  const lh = h / n_secondaires;
  for (let i = 0; i < n_secondaires; i++) out.push(new Rect(rect.x + gw, rect.y + i * lh, w - gw, lh));
  return out;
}

/** Fond arrondi d'un panneau, avec son titre en haut à gauche ; rend le rectangle utile. */
export function cadre(p: Peintre, r: Rect, titre: string | null = null): Rect {
  p.save();
  p.setPen(stylo('grille', 1.0, 0.8));
  p.setBrush(c('sphere', 0.18));
  p.drawRoundedRect(r.adjusted(3, 3, -3, -3), 10, 10);
  p.restore();
  if (titre) {
    police(p, 0.95, true);
    texte(p, r.x + 12, r.y + 8 + p.fontMetrics().ascent(), titre, 'texte', { centre: false });
    police(p, 1 / 0.95);
    return r.adjusted(8, 10 + p.fontMetrics().height(), -8, -8);
  }
  return r.adjusted(8, 8, -8, -8);
}

/**
 * Disque d'un corps vu sous l'angle de phase `i` (0 : plein, 180 : nouveau), le limbe éclairé tourné vers la direction
 * `direction_soleil` de l'écran (degrés, sens trigonométrique depuis la droite, y vers le haut).
 */
export function disque_phase(
  p: Peintre, x: number, y: number, r: number, i: number, direction_soleil = 0.0,
  cle_eclairee: CouleurOuCle = 'lune', cle_sombre: CouleurOuCle = 'nuit',
): void {
  phase_lune(p, x, y, r, 180.0 - Math.max(0.0, Math.min(180.0, i)), cle_eclairee, cle_sombre, -direction_soleil);
}

/** Petites graduations étiquetées le long d'un axe horizontal. */
export function graduations(
  p: Peintre, x0: number, x1: number, y: number, valeurs: string[], positions: number[], cle: CouleurOuCle = 'doux',
  haut = false,
): void {
  p.setPen(stylo('grille', 1.0));
  for (let i = 0; i < valeurs.length; i++) {
    const x = positions[i]!;
    if (x0 - 1 <= x && x <= x1 + 1) {
      p.drawLine(x, y, x, y + (haut ? -4 : 4));
      texte(p, x, y + (haut ? -12 : 13), valeurs[i]!, cle);
    }
  }
}

export type { Degrade };
