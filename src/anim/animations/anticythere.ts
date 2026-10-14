/**
 * La machine d'Anticythère en 3D, adaptée d'Anticythere3D (du même auteur) : mêmes nombres de dents, mêmes trains,
 * mêmes rapports exacts, même implantation des arbres, mêmes cadrans gravés (src/calc/anticythere.ts).
 *
 * Rendu sans OpenGL, en Canvas 2D : projection orthographique maison, orientation par quaternion (garde-fous : jamais
 * d'orientation non finie ou non unitaire), algorithme du peintre.  Toutes les pièces de la machine sont planes et
 * parallèles (roues, plaques, aiguilles, cadrans) : chacune est dessinée dans son plan par une transformation affine
 * exacte (projection orthographique d'un plan), et les plans sont triés le long de la visée ; les arbres sont coupés
 * en tronçons entre deux plans pour s'intercaler correctement.  Le coffret fermé est convexe : seules ses faces
 * tournées vers l'observateur sont dessinées.  Cadrans gravés : dessin vectoriel (mêmes tracés que dialface.py)
 * mis en cache dans une image dont la résolution suit le zoom (niveaux de détail) ; dentures remplacées par leur
 * cercle primitif quand une dent ferait moins de 2,5 pixels.
 */
import * as M from '../../calc/anticythere';
import { langue, tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Couleur, type Peintre, Pt, Rect } from '../../noyau/peintre';
import { pmod, pround } from '../../noyau/py';
import { Animation, angle, type Bouton_souris, type Choix, type Coche, nombre, type Reglage } from '../base';

// ==================================================================== caméra : quaternion
/** Quaternion unitaire [w, x, y, z] : rotation du repère de la machine vers le repère de vue. */
export type Quat = [number, number, number, number];
/** Matrice 3 × 3 (lignes) : axes de vue (droite, haut, vers l'observateur) exprimés dans le repère de la machine. */
export type M3 = [number, number, number, number, number, number, number, number, number];

export function q_mul(a: Quat, b: Quat): Quat {
  const [w1, x1, y1, z1] = a,
    [w2, x2, y2, z2] = b;
  return [
    w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
    w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
    w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
    w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2,
  ];
}
export function q_axe(x: number, y: number, z: number, t: number): Quat {
  const n = Math.hypot(x, y, z);
  if (!(n > 1e-12) || !Number.isFinite(t)) return [1, 0, 0, 0];
  const s = Math.sin(t / 2) / n;
  return [Math.cos(t / 2), x * s, y * s, z * s];
}
/** Quaternion valide : fini et unitaire à 1e-6 près. */
export function q_valide(q: readonly number[]): boolean {
  return q.length === 4 && q.every(Number.isFinite) && Math.abs(Math.hypot(...q) - 1) < 1e-6;
}
export function q_normer(q: Quat): Quat | null {
  const n = Math.hypot(...q);
  if (!Number.isFinite(n) || n < 1e-9) return null;
  const r = q.map((x) => x / n) as Quat;
  return q_valide(r) ? r : null;
}
export function q_matrice(q: Quat): M3 {
  const [w, x, y, z] = q;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ];
}
const DEG = Math.PI / 180;
/** Vues prédéfinies : face avant, face arrière (demi-tour autour de la verticale), trois-quarts. */
export const VUES: Record<string, Quat> = {
  avant: [1, 0, 0, 0],
  arriere: q_axe(0, 1, 0, Math.PI),
  trois_quarts: q_mul(q_axe(1, 0, 0, 24 * DEG), q_axe(0, 1, 0, -34 * DEG)),
};
/**
 * Glisser de (dx, dy) pixels : rotation « boule de commande » autour de l'axe de l'écran perpendiculaire au glisser,
 * d'angle |d| / r.  Garde-fous : entrées non finies ignorées, résultat renormé et validé, sinon l'orientation de base.
 */
export function tourner_camera(q: Quat, dx: number, dy: number, r: number, repli: Quat = VUES.avant!): Quat {
  const base = q_valide(q) ? q : repli;
  const d = Math.hypot(dx, dy);
  if (!Number.isFinite(d) || !(r > 0) || !Number.isFinite(r) || d < 1e-9) return base;
  // y écran vers le bas, y de vue vers le haut : axe = (dy, dx, 0) / d dans le repère de vue
  const n = q_normer(q_mul(q_axe(dy / d, dx / d, 0, d / r), base));
  return n ?? base;
}

// ==================================================================== couleurs
const rvb = (c: readonly number[], a = 1): Couleur => new Couleur(c[0]!, c[1]!, c[2]!, a);
const BRONZE_CLAIR: [number, number, number] = [226, 200, 140];
const BRONZE_MOYEN: [number, number, number] = [198, 168, 106];
const BRONZE_PALE: [number, number, number] = [236, 214, 160];
const GRAVE = 'rgb(74,58,30)';
const GRAVE_DOUX = 'rgb(116,96,56)';
const BOIS: [number, number, number] = [102, 69, 38];
const AIGUILLE_SOLEIL: [number, number, number] = [217, 166, 38];
const AIGUILLE_LUNE: [number, number, number] = [204, 209, 219];

/** Couleur d'un sous-ensemble : celle d'Anticythere3D en thème clair, éclaircie en thème sombre (contraste ≥ 3). */
export function couleur_sous_ensemble(sub: string, sombre: boolean): [number, number, number] {
  const c = M.COLORS[sub] ?? M.COLORS.input!;
  if (!sombre) return [...c];
  return c.map((x) => Math.round(x + (255 - x) * 0.38)) as [number, number, number];
}

// ==================================================================== géométrie des roues
const FAMILLE = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif';

/** Contour d'une roue (denture triangulaire de la machine antique), centré sur l'origine, en mm. */
export function contour_roue(n: number, module = M.MODULE): number[] {
  const rp = (module * n) / 2,
    ra = rp + 0.55 * module,
    rf = rp - 0.65 * module;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = (2 * Math.PI * i) / n,
      a1 = (2 * Math.PI * (i + 0.5)) / n;
    out.push(rf * Math.cos(a0), rf * Math.sin(a0), ra * Math.cos(a1), ra * Math.sin(a1));
  }
  return out;
}

interface Chemins {
  dents: Path2D;
  cercle: Path2D;
}
const chemins = new Map<string, Chemins>();
function polygone(path: Path2D, xy: readonly number[]): void {
  path.moveTo(xy[0]!, xy[1]!);
  for (let i = 2; i < xy.length; i += 2) path.lineTo(xy[i]!, xy[i + 1]!);
  path.closePath();
}
function cercle(path: Path2D, r: number, n = 48, sens = 1): void {
  for (let i = 0; i <= n; i++) {
    const a = (sens * 2 * Math.PI * i) / n;
    if (i === 0) path.moveTo(r * Math.cos(a), r * Math.sin(a));
    else path.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  path.closePath();
}
/** Chemins (repère de la roue, mm) : denture complète, ou cercle primitif (niveau de détail) ; roues à bras évidées. */
function chemins_roue(nom: string): Chemins {
  let c = chemins.get(nom);
  if (c) return c;
  const n = M.TEETH[nom]!;
  const rp = (M.MODULE * n) / 2;
  const dents = new Path2D(),
    cer = new Path2D();
  polygone(dents, contour_roue(n));
  cercle(cer, rp + 0.2, Math.max(24, Math.min(64, n)));
  const bras = M.SPOKED[nom];
  if (bras) {
    // roue à bras : jante (trou intérieur à 0,86 rp, sens inverse : règle pair-impair), quatre bras et un moyeu
    for (const p of [dents, cer]) {
      cercle(p, rp * 0.86, 48, -1);
      for (let k = 0; k < bras; k++) {
        const a = (2 * Math.PI * k) / bras;
        const ca = Math.cos(a),
          sa = Math.sin(a);
        const pts = [[6, -3.5], [rp * 0.87, -3.5], [rp * 0.87, 3.5], [6, 3.5]].flatMap(([u, v]) => [u! * ca - v! * sa, u! * sa + v! * ca]);
        polygone(p, pts);
      }
      cercle(p, 9, 24);
    }
  }
  c = { dents, cercle: cer };
  chemins.set(nom, c);
  return c;
}

// ==================================================================== cadrans gravés (dialface.py)
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function police(ctx: Ctx, px: number, gras = true): void {
  ctx.font = `${gras ? 700 : 400} ${Math.max(0.5, px)}px ${FAMILLE}`;
}

/** Texte le long d'un rayon, tourné pour suivre le cercle ; repère y vers le bas, angle polaire en degrés. */
function texte_anneau(ctx: Ctx, cx: number, cy: number, rayon: number, angle_deg: number, s: string, px: number, couleur: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  const rot = pmod(90.0 - angle_deg, 360.0);
  const renverse = rot > 90.0 && rot < 270.0;
  ctx.rotate((-angle_deg + 90.0 + (renverse ? 180.0 : 0.0)) * DEG);
  police(ctx, px);
  ctx.fillStyle = couleur;
  const w = ctx.measureText(s).width;
  ctx.fillText(s, -w / 2, renverse ? rayon + px * 0.8 : -rayon);
  ctx.restore();
}

function trait(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, couleur: string, e: number): void {
  ctx.strokeStyle = couleur;
  ctx.lineWidth = e;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
function rond(ctx: Ctx, cx: number, cy: number, r: number, couleur: string | null, e: number, fond: string | CanvasGradient | null = null): void {
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0, r), 0, 2 * Math.PI);
  if (fond) {
    ctx.fillStyle = fond;
    ctx.fill();
  }
  if (couleur) {
    ctx.strokeStyle = couleur;
    ctx.lineWidth = e;
    ctx.stroke();
  }
}

/** Face avant, sans l'anneau calendaire mobile : anneau du zodiaque (360 divisions, noms grecs), plage centrale. */
export function peindre_face_avant(ctx: Ctx, cx: number, cy: number, R: number, lg: string): void {
  const s = R / 0.485;
  const rzo = R * 0.825,
    rzi = R * 0.63,
    rface = R * 0.61;
  const g = ctx.createRadialGradient(cx, cy - R * 0.2, 0, cx, cy - R * 0.2, R * 1.3);
  g.addColorStop(0, 'rgb(242,222,172)');
  g.addColorStop(0.65, rvb(BRONZE_CLAIR).css());
  g.addColorStop(1, rvb(BRONZE_MOYEN).css());
  rond(ctx, cx, cy, R * 0.845, GRAVE_DOUX, s * 0.004, g);
  for (const r of [rzi, rzo]) rond(ctx, cx, cy, r, GRAVE, s * 0.0035);
  for (let d = 0; d < 360; d++) {
    const a = (90 - d) * DEG;
    let r0: number, e: number, col: string;
    if (d % 30 === 0) [r0, e, col] = [rzi, 0.0026, GRAVE];
    else if (d % 5 === 0) [r0, e, col] = [rzo - (rzo - rzi) * 0.38, 0.0014, GRAVE];
    else [r0, e, col] = [rzo - (rzo - rzi) * 0.2, 0.0008, GRAVE_DOUX];
    trait(ctx, cx + r0 * Math.cos(a), cy - r0 * Math.sin(a), cx + rzo * Math.cos(a), cy - rzo * Math.sin(a), col, s * e);
  }
  for (const [i, [grec, fr, en]] of M.ZODIAC_GREEK.entries()) {
    const a = 90 - 30 * (i + 0.5);
    texte_anneau(ctx, cx, cy, (rzi + rzo) / 2 + s * 0.01, a, grec, s * 0.017, GRAVE);
    texte_anneau(ctx, cx, cy, (rzi + rzo) / 2 - s * 0.016, a, lg === 'fr' ? fr : en, s * 0.011, GRAVE_DOUX);
    texte_anneau(ctx, cx, cy, rzi + s * 0.012, 90 - 30 * i - 2, M.PARAPEGMA_LETTERS[i % M.PARAPEGMA_LETTERS.length]!, s * 0.012, GRAVE_DOUX);
  }
  rond(ctx, cx, cy, rface, GRAVE_DOUX, s * 0.0022, rvb(BRONZE_PALE).css());
  ctx.fillStyle = 'rgba(150,170,140,0.094)';
  for (const [dx, dy, rr] of [[-0.26, -0.34, 0.1], [0.3, 0.2, 0.06], [-0.4, 0.38, 0.045]] as [number, number, number][]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * dx, cy + s * dy, s * rr, s * rr * 0.8, 0, 0, 2 * Math.PI);
    ctx.fill();
  }
}

/** Anneau calendaire égyptien (mobile) : 365 traits, mois de 30 jours nommés, 5 jours épagomènes. */
export function peindre_anneau_calendrier(ctx: Ctx, cx: number, cy: number, R: number): void {
  const s = R / 0.485;
  const ro = R,
    ri = R * 0.845;
  ctx.beginPath();
  ctx.arc(cx, cy, ro, 0, 2 * Math.PI);
  ctx.arc(cx, cy, ri, 0, 2 * Math.PI, true);
  const g = ctx.createRadialGradient(cx, cy - R * 0.2, 0, cx, cy - R * 0.2, R * 1.3);
  g.addColorStop(0, 'rgb(242,222,172)');
  g.addColorStop(0.65, rvb(BRONZE_CLAIR).css());
  g.addColorStop(1, rvb(BRONZE_MOYEN).css());
  ctx.fillStyle = g;
  ctx.fill('evenodd');
  for (const r of [ri, ro]) rond(ctx, cx, cy, r, GRAVE, s * 0.0035);
  for (let i = 0; i < 365; i++) {
    const a = (90 - (360 * i) / 365) * DEG;
    const long = i % 30 === 0;
    const r0 = long ? ri : ro - (ro - ri) * 0.42;
    trait(ctx, cx + r0 * Math.cos(a), cy - r0 * Math.sin(a), cx + ro * Math.cos(a), cy - ro * Math.sin(a), long ? GRAVE : GRAVE_DOUX, s * (long ? 0.0022 : 0.0011));
  }
  // mois de 30 jours (repères longs tous les 30 jours), puis les cinq jours épagomènes
  for (let i = 0; i < 12; i++) texte_anneau(ctx, cx, cy, (ri + ro) / 2 - s * 0.006, 90 - (360 * (30 * i + 15)) / 365, M.EGYPTIAN_GREEK[i]!, s * 0.0195, GRAVE);
  texte_anneau(ctx, cx, cy, (ri + ro) / 2 - s * 0.006, 90 - (360 * 362.5) / 365, 'Ε', s * 0.0195, GRAVE_DOUX);
}

/** Spirale d'Archimède graduée (dialface._spiral) : `turns` tours, `cells` cases, inscriptions case par case. */
function spirale(
  ctx: Ctx, cx: number, cy: number, s: number, turns: number, cells: number, r0: number, r1: number, titre: string,
  texte_case: ((k: number) => [string, boolean] | null) | null, forts: Set<number>, titre_dessous: boolean,
): void {
  ctx.beginPath();
  const n = 1400;
  for (let i = 0; i <= n; i++) {
    const t = (turns * 2 * Math.PI * i) / n;
    const r = r0 + ((r1 - r0) * i) / n;
    const x = cx + r * Math.cos(t - Math.PI / 2),
      y = cy - r * Math.sin(t - Math.PI / 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = GRAVE;
  ctx.lineWidth = s * 0.0032;
  ctx.stroke();
  const couloir = (r1 - r0) / turns;
  const w = couloir * 0.42;
  const dth = (turns * 2 * Math.PI) / cells;
  for (let k = 0; k < cells; k++) {
    const a = dth * k - Math.PI / 2;
    const r = r0 + ((r1 - r0) * k) / cells;
    const fort = forts.has(k);
    trait(ctx, cx + (r - w) * Math.cos(a), cy - (r - w) * Math.sin(a), cx + (r + w) * Math.cos(a), cy - (r + w) * Math.sin(a), fort ? GRAVE : GRAVE_DOUX, s * (fort ? 0.002 : 0.0009));
  }
  if (texte_case) {
    ctx.fillStyle = GRAVE;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let k = 0; k < cells; k++) {
      const v = texte_case(k);
      if (!v) continue;
      const [txt, gras] = v;
      const t = dth * (k + 0.5);
      const r = r0 + ((r1 - r0) * (k + 0.5)) / cells + couloir * 0.27;
      const arc = r * dth;
      const px = Math.min(couloir * 0.42, (arc / txt.length) * 1.45);
      if (px < 2.0) continue;
      const a = t - Math.PI / 2;
      ctx.save();
      ctx.translate(cx + r * Math.cos(a), cy - r * Math.sin(a));
      let deg = -a / DEG - 90.0;
      const m = pmod(deg, 360);
      if (m > 90 && m < 270) deg += 180;
      ctx.rotate(deg * DEG);
      police(ctx, Math.floor(px), gras);
      ctx.fillText(txt, 0, 0);
      ctx.restore();
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  police(ctx, Math.floor(s * 0.016));
  ctx.fillStyle = GRAVE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(titre, cx, cy + (titre_dessous ? r1 + s * 0.006 : -r1 - s * 0.03) + s * 0.013);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function petit_cadran(ctx: Ctx, cx: number, cy: number, s: number, rad: number, secteurs: number, etiquettes: readonly string[], titre: string, titre_dessus: boolean): void {
  rond(ctx, cx, cy, rad, GRAVE, s * 0.0026, rvb(BRONZE_PALE).css());
  for (let k = 0; k < secteurs; k++) {
    const a = (90 - (360 * k) / secteurs) * DEG;
    trait(ctx, cx, cy, cx + rad * Math.cos(a), cy - rad * Math.sin(a), GRAVE_DOUX, s * 0.0014);
  }
  ctx.fillStyle = GRAVE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  police(ctx, Math.floor(rad * 0.155));
  for (const [k, txt] of etiquettes.entries()) {
    const a = (90 - (360 * (k + 0.5)) / secteurs) * DEG;
    ctx.fillText(txt, cx + rad * 0.58 * Math.cos(a), cy - rad * 0.58 * Math.sin(a));
  }
  police(ctx, Math.floor(rad * 0.17));
  ctx.fillText(titre, cx, titre_dessus ? cy - rad * 1.33 : cy + rad * 1.33);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/**
 * Face arrière (dialface.paint_back_dial) : spirale métonique (5 tours, 235 cases, mois corinthiens, années en
 * chiffres grecs), spirale du Saros (4 tours, 223 cases, glyphes Η et Σ), cadrans callippique, de l'exeligmos et des
 * Jeux — chacun centré sur l'arbre qui porte son aiguille.  `miroir` : vue par-derrière (x inversés), comme la texture.
 */
export function peindre_face_arriere(ctx: Ctx, cx: number, cy: number, R: number, miroir = true): void {
  const s = R / 0.485;
  const ppm = s / M.BACK_DIAL_SPAN;
  const sx = miroir ? -1 : 1;
  const at = (mx: number, my: number): [number, number] => [cx + sx * (mx - M.CASE_CX) * ppm, cy - (my - M.CASE_CY) * ppm];
  const bw = M.CASE_WIDTH * ppm,
    bh = M.CASE_HEIGHT * ppm;
  const g = ctx.createRadialGradient(cx, cy - R * 0.2, 0, cx, cy - R * 0.2, R * 1.35);
  g.addColorStop(0, 'rgb(240,220,168)');
  g.addColorStop(1, rvb(BRONZE_MOYEN).css());
  ctx.fillStyle = g;
  ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
  ctx.strokeStyle = GRAVE_DOUX;
  ctx.lineWidth = s * 0.004;
  ctx.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
  const debuts = M.metonic_year_starts();
  const annee_de = new Map<number, [number, number]>();
  for (const [an, premier] of debuts.entries()) {
    const dernier = an + 1 < debuts.length ? debuts[an + 1]! : 235;
    for (let mois = premier; mois < dernier; mois++) annee_de.set(mois, [an, mois - premier]);
  }
  const case_meton = (k: number): [string, boolean] | null => {
    const [an, rang] = annee_de.get(k)!;
    if (rang === 0) return [M.GREEK_NUMERALS[an]!, true];
    if (k >= debuts[15]!) return [M.CORINTHIAN_MONTHS[rang % 12]![1], false];
    return null;
  };
  const case_saros = (k: number): [string, boolean] | null => {
    const gl = M.saros_glyph(k);
    return gl ? [gl, true] : null;
  };
  const [nx, ny] = at(...M.ARBORS.n!);
  const [gx, gy] = at(...M.ARBORS.g!);
  spirale(ctx, nx, ny, s, 5, 235, M.METONIC_RADIUS * 0.275 * ppm, M.METONIC_RADIUS * ppm, 'ΜΕΤΩΝ · 235', case_meton, new Set(debuts), false);
  spirale(ctx, gx, gy, s, 4, 223, M.SAROS_RADIUS * 0.27 * ppm, M.SAROS_RADIUS * ppm, 'ΣΑΡΟΣ · 223', case_saros, new Set([0, 56, 112, 168]), true);
  const [ox, oy] = at(...M.ARBORS.o!);
  const [ix, iy] = at(...M.ARBORS.i!);
  petit_cadran(ctx, ox, oy, s, M.CALLIPPIC_RADIUS * ppm, 4, ['Α', 'Β', 'Γ', 'Δ'], 'ΚΑΛΛΙΠΠΟΣ', true);
  petit_cadran(ctx, ix, iy, s, M.EXELIGMOS_RADIUS * ppm, 3, M.EXELIGMOS_LABELS, 'ΕΞΕΛΙΓΜΟΣ', false);
  const [jx, jy] = at(...M.GAMES_CENTER);
  petit_cadran(ctx, jx, jy, s, M.GAMES_RADIUS * ppm, 4, M.GAMES_GREEK, 'ΑΓΩΝΕΣ', false);
}

/** Envergure (mm) des images des cadrans : R = 0,485 × envergure, comme les textures d'Anticythere3D. */
const ENV_AVANT = M.FRONT_DIAL_SPAN / 2 / 0.485;
const ENV_ARRIERE = M.BACK_DIAL_SPAN;

interface Image {
  img: CanvasImageSource;
  cote: number;
}
const images = new Map<string, Image>();
/** Image d'un cadran (cache par face, langue et résolution) ; null hors navigateur (dessin vectoriel direct). */
function image_cadran(face: 'avant' | 'calendrier' | 'arriere', cote: number, lg: string): Image | null {
  if (typeof document === 'undefined' && typeof OffscreenCanvas === 'undefined') return null;
  const cle = `${face}:${cote}:${lg}`;
  let im = images.get(cle);
  if (im) return im;
  let c: HTMLCanvasElement | OffscreenCanvas;
  if (typeof OffscreenCanvas !== 'undefined') c = new OffscreenCanvas(cote, cote);
  else {
    c = document.createElement('canvas');
    c.width = c.height = cote;
  }
  const ctx = c.getContext('2d') as Ctx | null;
  if (!ctx) return null;
  const R = cote * 0.485;
  if (face === 'avant') peindre_face_avant(ctx, cote / 2, cote / 2, R, lg);
  else if (face === 'calendrier') peindre_anneau_calendrier(ctx, cote / 2, cote / 2, R);
  else peindre_face_arriere(ctx, cote / 2, cote / 2, R, true);
  im = { img: c, cote };
  for (const k of [...images.keys()]) if (k.startsWith(face + ':') && images.size > 8) images.delete(k);
  images.set(cle, im);
  return im;
}

// ==================================================================== la scène
interface Piece {
  cle: number;
  dessiner: () => void;
}

/** Repère de projection d'une image : orientation, échelle (px/mm), centre de l'écran et de la scène. */
export interface Projection {
  R: M3;
  s: number;
  cx: number;
  cy: number;
  C: [number, number, number];
}

export function projeter(pr: Projection, x: number, y: number, z: number): [number, number, number] {
  const { R, s, cx, cy, C } = pr;
  const dx = x - C[0],
    dy = y - C[1],
    dz = z - C[2];
  const vx = R[0] * dx + R[1] * dy + R[2] * dz,
    vy = R[3] * dx + R[4] * dy + R[5] * dz,
    vz = R[6] * dx + R[7] * dy + R[8] * dz;
  return [cx + s * vx, cy - s * vy, vz];
}
/** Transformation affine (a, b, c, d, e, f) qui projette le plan z = z0 de la machine (repère x, y en mm). */
export function affine_plan(pr: Projection, z0: number): [number, number, number, number, number, number] {
  const { R, s } = pr;
  const [e, f] = projeter(pr, 0, 0, z0);
  return [s * R[0], -s * R[3], s * R[1], -s * R[4], e, f];
}
/** Point de la machine sous le pixel (X, Y), dans le plan z = z0 ; null si le plan est vu par la tranche. */
export function sous_pixel(pr: Projection, X: number, Y: number, z0: number): [number, number] | null {
  const { R, s, cx, cy, C } = pr;
  const vx = (X - cx) / s,
    vy = -(Y - cy) / s;
  // point de vue (vx, vy, t) → machine : C + Rᵀ (vx, vy, t) ; on cherche t tel que z = z0
  if (Math.abs(R[8]) < 0.15) return null;
  const t = (z0 - C[2] - R[2] * vx - R[5] * vy) / R[8];
  return [C[0] + R[0] * vx + R[3] * vy + R[6] * t, C[1] + R[1] * vx + R[4] * vy + R[7] * t];
}

/** Date affichée : jour, mois, année ; calendrier julien avant le 15 octobre 1582, années av. J.-C. */
export function date_texte(jd: number): string {
  const [y, m, d] = M.from_julian_day(jd);
  const an = y <= 0 ? tr('anim_antikythera_av_jc', { a: 1 - y }) : String(y);
  const txt = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${an}`;
  return tr(jd >= 2299160.5 ? 'anim_antikythera_greg' : 'anim_antikythera_jul', { d: txt });
}

export function egypte_texte(jd: number): string {
  const [mois, jour] = M.egyptian_date(jd);
  return mois === 12 ? tr('anim_antikythera_epagomene', { j: jour }) : `${M.EGYPTIAN_MONTHS[mois]} ${jour}`;
}

export function signe_texte(lon_deg: number): string {
  // arrondi au dixième AVANT de choisir le signe : jamais « Verseau 30,0° » (c'est « Poissons 0,0° »)
  const [i, deg] = M.zodiac_sign(pround(pmod(lon_deg, 360) * 10) / 10);
  const nom = M.ZODIAC_GREEK[i]!;
  return `${langue() === 'fr' ? nom[1] : nom[2]} ${angle(deg, 1)}`;
}

const SYMBOLES: Record<string, string> = { moon: '☾', mercury: '☿', venus: '♀', sun: '☉', mars: '♂', jupiter: '♃', saturn: '♄' };
/** Date de départ : 12 août 2026 à midi (UTC), jour d'une éclipse totale de Soleil (glyphe Η du Saros). */
export const JD_DEPART = M.julian_day(2026, 8, 12, 12);

export class Anticythere extends Animation {
  static override ID = 'antikythera';
  static override ANIMEE = true;

  enveloppe!: Coche;
  eclatement!: Reglage;
  face!: Choix;
  meca = M.machine_calee();
  q: Quat = VUES.avant!;
  /** roue survolée (souris) ou touchée (doigt) */
  roue: string | null = null;
  private zone: Rect | null = null;
  pr: Projection | null = null;
  private s_fige: number | null = null;
  private decalage: [number, number] = [0, 0];
  private prise: 'manivelle' | 'vue' | null = null;
  private angle_saisie: number | null = null;
  private dernier: Pt | null = null;
  private bouge = false;
  /** durée du dernier dessin (ms), pour les mesures */
  duree_ms = 0;

  override construire(): void {
    this.enveloppe = this.coche('enveloppe', true);
    this.eclatement = this.curseur('eclatement', 0, 100, 0, { dec: 0, unite: '%' });
    this.face = this.choix('face', [['anim_antikythera_f_avant', 'avant'], ['anim_antikythera_f_arriere', 'arriere'], ['anim_antikythera_f_trois_quarts', 'trois_quarts']], 'avant');
    this.face.currentIndexChanged.connect(() => {
      this.q = VUES[this.face.currentData() as string] ?? VUES.avant!;
      this.s_fige = null;
    });
    this.bouton('anim_antikythera_aujourdhui', () => {
      const d = new Date();
      this.regler_jd(M.julian_day(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours() + d.getUTCMinutes() / 60));
    });
    this.bouton('anim_antikythera_lunaison', () => this.regler_jd(this.jd() + M.SYNODIC_MONTH));
    this.bouton('anim_antikythera_annee', () => this.regler_jd(this.jd() + M.TROPICAL_YEAR));
    this.etat_initial();
  }

  override etat_initial(): void {
    this.meca.days = JD_DEPART - M.J2000;
    this.q = VUES[this.face?.currentData() as string] ?? VUES.avant!;
    this.roue = null;
    this.s_fige = null;
  }

  jd(): number {
    return M.J2000 + this.meca.days;
  }
  regler_jd(jd: number): void {
    if (!Number.isFinite(jd)) return;
    this.meca.days = jd - M.J2000;
    this.rafraichir();
  }

  /** Lecture : la manivelle fait un tour par seconde (× vitesse), soit 48/223 d'année. */
  override avancer(dt: number): void {
    if (Number.isFinite(dt)) this.meca.turns += dt / -M.CRANK_PER_TURN;
  }

  explode(): number {
    return this.eclatement.value() / 100;
  }

  // ------------------------------------------------------------ valeurs
  override valeurs(): [string, string][] {
    const o = this.meca.outputs();
    const jd = this.jd();
    const v: [string, string][] = [];
    v.push([tr('anim_antikythera_v_date'), date_texte(jd)]);
    v.push([tr('anim_antikythera_v_egypte'), egypte_texte(jd)]);
    v.push([tr('anim_antikythera_v_soleil'), signe_texte(o.mean_sun * 360)]);
    v.push([tr('anim_antikythera_v_lune'), signe_texte(o.moon_true * 360)]);
    v.push([tr('anim_antikythera_v_phase'), tr('anim_antikythera_phase_val', { nom: tr('anim_antikythera_phase_' + M.phase_index(o.phase_turns)), pc: nombre(o.phase_illum * 100, 0) })]);
    v.push([tr('anim_antikythera_v_anomalie'), (o.moon_anomaly_deg >= 0 ? '+' : '') + angle(o.moon_anomaly_deg, 2)]);
    v.push([tr('anim_antikythera_v_noeud'), signe_texte(o.nodes * 360)]);
    v.push([tr('anim_antikythera_v_meton'), tr('anim_antikythera_meton_val', { case: o.metonic_cell, an: o.metonic_year })]);
    v.push([tr('anim_antikythera_v_callippe'), tr('anim_antikythera_callippe_val', { q: o.callippic_quarter })]);
    v.push([tr('anim_antikythera_v_jeux'), tr('anim_antikythera_jeux_' + o.games_name)]);
    const gl = M.saros_glyph(o.saros_cell - 1);
    const sv = tr('anim_antikythera_saros_val', { case: o.saros_cell });
    v.push([tr('anim_antikythera_v_saros'), gl ? tr('anim_antikythera_glyphe', { v: sv, g: gl }) : sv]);
    v.push([tr('anim_antikythera_v_exeligmos'), tr('anim_antikythera_exel_val', { h: o.exeligmos_hours })]);
    const e = M.eclipse_possible(jd);
    let et = tr(e.type === 'solar' ? 'anim_antikythera_eclipse_sol' : e.type === 'lunar' ? 'anim_antikythera_eclipse_lune' : 'anim_antikythera_eclipse_aucune');
    if (e.certain) et = tr('anim_antikythera_eclipse_certaine', { t: et });
    v.push([tr('anim_antikythera_v_eclipse'), et]);
    for (const k of M.NOMS_PLANETES) v.push([tr('anim_antikythera_v_planete', { nom: tr('anim_antikythera_pl_' + k) }), signe_texte(M.geocentric_longitude(k, o.planets[k]!, o.mean_sun))]);
    const ds = pmod(o.mean_sun * 360 - M.sun_mean_longitude(jd) + 180, 360) - 180;
    const dl = pmod(o.moon_true * 360 - M.moon_longitude(jd) + 180, 360) - 180;
    const sg = (x: number): string => (x >= 0 ? '+' : '') + angle(x, 2);
    v.push([tr('anim_antikythera_v_ecart'), tr('anim_antikythera_ecart_val', { s: sg(ds), l: sg(dl) })]);
    v.push([tr('anim_antikythera_v_manivelle'), tr('anim_antikythera_manivelle_val', { t: nombre(o.turns * -M.CRANK_PER_TURN, 1), j: nombre(o.days, 0) })]);
    v.push([tr('anim_antikythera_v_roue'), this.roue ? fiche_roue(this.roue) : tr('anim_antikythera_roue_aucune')]);
    return v;
  }

  // ------------------------------------------------------------ souris
  override presser(pos: Pt, bouton: Bouton_souris): boolean {
    if (!this.zone || !this.zone.contains(pos)) return false;
    this.dernier = pos;
    this.bouge = false;
    if (bouton === 'gauche' && this.sur_manivelle(pos)) {
      this.prise = 'manivelle';
      this.angle_saisie = this.angle_manivelle(pos);
    } else {
      this.prise = 'vue';
      if (this.pr) this.s_fige = this.pr.s;
    }
    this._glisse = () => {};
    return true;
  }

  override glisser(pos: Pt, dx: number, dy: number): void {
    if (!this.prise || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
    if (this.dernier && Math.hypot(pos.x - this.dernier.x, pos.y - this.dernier.y) > 3) this.bouge = true;
    if (this.prise === 'manivelle') {
      const a = this.angle_manivelle(pos);
      if (a !== null && this.angle_saisie !== null) {
        const d = pmod(a - this.angle_saisie + Math.PI, 2 * Math.PI) - Math.PI;
        // la poignée tourne avec a1 : un tour de poignée = 48/223 de tour de b1, en sens contraire
        if (Number.isFinite(d)) this.meca.turns += d / (2 * Math.PI) / M.CRANK_PER_TURN;
      }
      this.angle_saisie = a;
      this.rafraichir();
      return;
    }
    const r = this.zone ? Math.min(this.zone.w, this.zone.h) * 0.45 : 200;
    this.q = tourner_camera(this.q, dx, dy, r, VUES[this.face.currentData() as string] ?? VUES.avant!);
    this.hote.rafraichir();
  }

  override relacher(pos: Pt): void {
    // toucher sans glisser : la roue touchée est décrite (au doigt, il n'y a pas de survol)
    if (this.prise === 'vue' && !this.bouge) {
      // toucher une roue la désigne ; toucher à côté efface la désignation
      this.roue = this.roue_sous(pos);
      this.rafraichir();
    }
    this.prise = null;
    this.angle_saisie = null;
    this._glisse = null;
    this.s_fige = null;
    this.hote.rafraichir();
  }

  override survoler(pos: Pt): boolean {
    const r = this.roue_sous(pos);
    if (r === this.roue) return false;
    this.roue = r;
    this.rafraichir();
    return true;
  }

  override doubleClic(_pos: Pt): boolean {
    this.q = VUES[this.face.currentData() as string] ?? VUES.avant!;
    this.s_fige = null;
    this.rafraichir();
    return true;
  }

  /** Axe de la manivelle (x, y, z de la base) et hauteur du milieu de la poignée. */
  private manivelle(): { ax: number; ay: number; z0: number; zp: number; hx: number; hy: number } {
    const [ax, ay] = M.ARBORS.a!;
    const z0 = M.Z_FRONT - 2 + M.front_shift(this.explode());
    const a = 2 * Math.PI * this.meca.gear_angles().a1!;
    return { ax, ay, z0, zp: z0 + M.CRANK_SHAFT + 4 + (M.CRANK_HANDLE + 6) / 2, hx: ax + M.CRANK_RADIUS * Math.cos(a), hy: ay + M.CRANK_RADIUS * Math.sin(a) };
  }

  sur_manivelle(pos: Pt): boolean {
    const pr = this.pr;
    if (!pr || pr.R[8] < 0.05) return false;
    const m = this.manivelle();
    const [x0, y0] = projeter(pr, m.hx, m.hy, m.z0 + M.CRANK_SHAFT + 4);
    const [x1, y1] = projeter(pr, m.hx, m.hy, m.z0 + M.CRANK_SHAFT + 4 + M.CRANK_HANDLE + 6);
    const lx = x1 - x0,
      ly = y1 - y0;
    const l2 = lx * lx + ly * ly;
    const t = l2 > 1e-9 ? Math.max(0, Math.min(1, ((pos.x - x0) * lx + (pos.y - y0) * ly) / l2)) : 0;
    const d = Math.hypot(pos.x - (x0 + t * lx), pos.y - (y0 + t * ly));
    return d <= Math.max(16, 7 * pr.s);
  }

  /** Angle (radians, sens direct autour de +z) de la souris autour de l'axe de la manivelle. */
  angle_manivelle(pos: Pt): number | null {
    const pr = this.pr;
    if (!pr) return null;
    const m = this.manivelle();
    const p = sous_pixel(pr, pos.x, pos.y, m.zp);
    if (p && Math.hypot(p[0] - m.ax, p[1] - m.ay) > 1) return Math.atan2(p[1] - m.ay, p[0] - m.ax);
    const [cx, cy] = projeter(pr, m.ax, m.ay, m.zp);
    const a = Math.atan2(-(pos.y - cy), pos.x - cx);
    return pr.R[8] >= 0 ? a : -a;
  }

  /** Roue sous le pixel : la plus proche de l'observateur dont le disque contient le point (machine ouverte). */
  roue_sous(pos: Pt): string | null {
    const pr = this.pr;
    if (!pr || this.enveloppe.isChecked()) return null;
    const e = this.explode();
    const car = this.meca.raw('carrier_e3');
    let meilleur: string | null = null;
    let prof = -Infinity;
    for (const nom of Object.keys(M.LEVELS)) {
      const [gx, gy, gz] = M.gear_placement(nom, e, car);
      const z = pr.R[8] >= 0 ? gz + M.GEAR_THICKNESS : gz;
      const p = sous_pixel(pr, pos.x, pos.y, z);
      if (!p) continue;
      const rp = (M.MODULE * M.TEETH[nom]!) / 2;
      const r = Math.hypot(p[0] - gx, p[1] - gy);
      if (r > rp + 0.6) continue;
      if (M.SPOKED[nom] && r < rp * 0.86 && r > 9.5) {
        // dans l'évidement : seulement sur un bras
        const a = pmod(Math.atan2(p[1] - gy, p[0] - gx) - 2 * Math.PI * this.meca.gear_angles()[nom]!, (2 * Math.PI) / M.SPOKED[nom]!);
        const lat = Math.min(a, (2 * Math.PI) / M.SPOKED[nom]! - a) * r;
        if (lat > 3.5) continue;
      }
      const [, , vz] = projeter(pr, p[0], p[1], z);
      if (vz > prof) {
        prof = vz;
        meilleur = nom;
      }
    }
    return meilleur;
  }

  // ------------------------------------------------------------ dessin
  override dessiner(p: Peintre, rect: Rect): void {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const ferme = this.enveloppe.isChecked();
    if (!q_valide(this.q)) this.q = VUES[this.face.currentData() as string] ?? VUES.avant!;
    const R = q_matrice(this.q);
    const e = this.explode();
    const shift = M.front_shift(e);
    const titre = ferme ? (R[8] >= 0 ? 'anim_antikythera_titre_avant' : 'anim_antikythera_titre_arriere') : 'anim_antikythera_titre_ouverte';
    const r = dessin.cadre(p, rect, tr(titre));
    this.zone = r.copie();
    const zf = M.Z_FRONT + shift,
      zb = M.Z_BACK;
    const C: [number, number, number] = [M.CASE_CX, M.CASE_CY, (zf + zb) / 2];
    // échelle : le coffret entier tient dans le panneau (figée pendant qu'on fait tourner la vue)
    let s = this.s_fige;
    let dxc = this.decalage[0],
      dyc = this.decalage[1];
    if (s === null || !Number.isFinite(s)) {
      let xmin = Infinity,
        xmax = -Infinity,
        ymin = Infinity,
        ymax = -Infinity;
      const hw = M.CASE_WIDTH / 2,
        hh = M.CASE_HEIGHT / 2;
      const [ax, ay] = M.ARBORS.a!;
      const zm = M.Z_FRONT - 2 + shift + M.CRANK_SHAFT + 4 + M.CRANK_HANDLE + 6;
      // le coffret (huit coins) et la poignée de la manivelle dans toutes ses positions
      const pts: [number, number, number][] = [];
      for (const x of [M.CASE_CX - hw, M.CASE_CX + hw]) for (const y of [M.CASE_CY - hh, M.CASE_CY + hh]) for (const z of [zb, zf]) pts.push([x, y, z]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pts.push([ax + dx! * M.CRANK_RADIUS, ay + dy! * M.CRANK_RADIUS, zm]);
      for (const [x, y, z] of pts) {
        const dx = x - C[0],
          dy = y - C[1],
          dz = z - C[2];
        const vx = R[0] * dx + R[1] * dy + R[2] * dz,
          vy = R[3] * dx + R[4] * dy + R[5] * dz;
        xmin = Math.min(xmin, vx);
        xmax = Math.max(xmax, vx);
        ymin = Math.min(ymin, vy);
        ymax = Math.max(ymax, vy);
      }
      s = Math.min(r.w / (xmax - xmin), r.h / (ymax - ymin)) * 0.95;
      // centre de l'image sur le milieu de cette emprise
      dxc = -(xmin + xmax) / 2;
      dyc = -(ymin + ymax) / 2;
    }
    if (!(s > 0) || !Number.isFinite(s)) s = 1;
    if (this.s_fige === null) this.decalage = [dxc, dyc];
    const pr: Projection = { R, s, cx: r.cx + dxc * s, cy: r.cy - dyc * s, C };
    this.pr = pr;
    const ctx = p.ctx;
    const sombre = dessin.theme() === 'sombre';
    // échelle réelle à l'écran (zoom de la scène et densité de pixels compris) : niveaux de détail
    const mt = (ctx as { getTransform?: () => DOMMatrix }).getTransform?.();
    const k_ecran = mt ? Math.hypot(mt.a, mt.b) : 1;
    const px_mm = s * k_ecran;
    const k_dpr = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? Math.min(3, devicePixelRatio) : 1;

    p.save();
    p.setClipRect(r.adjusted(2, 2, -2, -2));
    const pieces: Piece[] = [];
    const sens = R[8] >= 0 ? 1 : -1;
    const ajoute = (z: number, f: () => void, ordre = 0): void => {
      pieces.push({ cle: z * sens + ordre * 1e-3, dessiner: f });
    };
    const plan = (z: number, f: () => void): void => {
      ctx.save();
      ctx.transform(...affine_plan(pr, z));
      f();
      ctx.restore();
    };
    const angles = this.meca.gear_angles();
    const o = this.meca.outputs();
    const car = o.carrier_e3;

    if (ferme) {
      this.dessiner_coffret(pr, plan, zf, zb, sombre, px_mm, o);
    } else {
      // ---- roues : face arrière (plus sombre, seulement si la vue est inclinée : de face elle est cachée) puis face
      // avant, chacune dans son plan ; dents dessinées seulement si une dent fait au moins 3 pixels CSS
      const voile = this.roue !== null;
      const dent_px = Math.PI * M.MODULE * s;
      const incline = Math.abs(R[8]) < 0.985;
      for (const nom of Object.keys(M.LEVELS)) {
        const [gx, gy, gz] = M.gear_placement(nom, e, car);
        const sub = M.SUBSYSTEM_OF[nom] ?? 'input';
        const base = couleur_sous_ensemble(sub, sombre);
        const ch = chemins_roue(nom);
        const chemin = dent_px * (px_mm / s / Math.max(1, k_dpr)) >= 3 ? ch.dents : ch.cercle;
        const rot = 2 * Math.PI * angles[nom]!;
        const survol = this.roue === nom;
        const alpha = voile && !survol ? 0.55 : 1;
        const lum = 0.78 + 0.22 * Math.abs(R[8]);
        const avant = R[8] >= 0;
        // la face cachée (derrière la roue, vue de l'observateur) d'abord, en plus sombre
        const zc = avant ? gz : gz + M.GEAR_THICKNESS,
          zv = avant ? gz + M.GEAR_THICKNESS : gz;
        // face cachée : seul son bord dépasse (de l'épaisseur de la roue, vue de biais) : une couronne de 3 mm suffit
        if (incline)
          ajoute(zc, () => plan(zc, () => {
            const rp = (M.MODULE * M.TEETH[nom]!) / 2;
            ctx.beginPath();
            ctx.arc(gx, gy, rp - 1.3, 0, 2 * Math.PI);
            ctx.strokeStyle = rvb(base.map((x) => x * lum * 0.62), alpha).css();
            ctx.lineWidth = 3;
            ctx.stroke();
          }));
        ajoute(zv, () => plan(zv, () => {
          ctx.translate(gx, gy);
          ctx.rotate(rot);
          ctx.fillStyle = rvb(base.map((x) => x * lum), alpha).css();
          ctx.fill(chemin, 'evenodd');
          ctx.strokeStyle = survol ? dessin.c('accent1').css() : rvb(base.map((x) => x * 0.55)).css();
          if (survol) {
            ctx.lineWidth = 2.2 / s;
            ctx.stroke(chemin);
          }
          // repère de rotation : un rayon, pour voir tourner la roue
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(((M.MODULE * M.TEETH[nom]!) / 2) * 0.9, 0);
          ctx.lineWidth = 1.2 / s;
          ctx.stroke();
        }));
      }
      // ---- arbres : tronçons coupés aux plans des roues qui peuvent les recouvrir (disque à moins de 20 mm de
      // l'arbre), pour que l'algorithme du peintre les intercale entre ces roues
      const gris = sombre ? [170, 174, 182] : [71, 71, 77];
      const roues = Object.keys(M.LEVELS).map((g) => [...M.gear_placement(g, e, car), (M.MODULE * M.TEETH[g]!) / 2 + 1] as [number, number, number, number]);
      for (const arbre of Object.keys(M.ARBORS)) {
        if (arbre === 'a') continue; // l'arbre de la manivelle est dessiné avec elle
        const [ax, ay] = M.arbor_position(arbre, car);
        const [z0, z1] = M.arbor_span(arbre, e);
        const coupes = new Set<number>();
        for (const [gx, gy, gz, ra] of roues) {
          if (Math.hypot(gx - ax, gy - ay) > ra + 20) continue;
          for (const z of [gz, gz + M.GEAR_THICKNESS]) if (z > z0 && z < z1) coupes.add(z);
        }
        const cuts = [z0, ...[...coupes].sort((a, b) => a - b), z1];
        for (let i = 0; i + 1 < cuts.length; i++) {
          const za = cuts[i]!,
            zc = cuts[i + 1]!;
          ajoute((za + zc) / 2, () => {
            const [x0, y0] = projeter(pr, ax, ay, za);
            const [x1, y1] = projeter(pr, ax, ay, zc);
            ctx.strokeStyle = rvb(gris).css();
            ctx.lineWidth = Math.max(1, 2 * M.ARBOR_RADIUS * s);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
          });
        }
      }
      // ---- anneau du zodiaque et spirales (repères de la façade et du dos, machine ouverte)
      ajoute(zf - 2, () => plan(zf - 2, () => {
        ctx.beginPath();
        ctx.arc(0, 0, 100.6, 0, 2 * Math.PI);
        ctx.arc(0, 0, 76.9, 0, 2 * Math.PI, true);
        ctx.fillStyle = rvb(BRONZE_CLAIR, 0.55).css();
        ctx.fill('evenodd');
        ctx.strokeStyle = GRAVE_DOUX;
        ctx.lineWidth = 0.6;
        for (let i = 0; i < 12; i++) {
          const a = (90 - 30 * i) * DEG;
          ctx.beginPath();
          ctx.moveTo(76.9 * Math.cos(a), 76.9 * Math.sin(a));
          ctx.lineTo(100.6 * Math.cos(a), 100.6 * Math.sin(a));
          ctx.stroke();
        }
      }));
      for (const [ctr, rad, tours, sub] of [[M.METONIC_CENTER, M.METONIC_RADIUS, 5, 'metonic'], [M.SAROS_CENTER, M.SAROS_RADIUS, 4, 'saros']] as [[number, number], number, number, string][]) {
        ajoute(zb + 1.2, () => plan(zb + 1.2, () => {
          ctx.beginPath();
          const r0 = rad * (tours === 5 ? 0.275 : 0.27);
          for (let i = 0; i <= 240; i++) {
            const t = (tours * 2 * Math.PI * i) / 240;
            const rr = r0 + ((rad - r0) * i) / 240;
            // vue de devant : la spirale gravée au dos (vue par-derrière) apparaît en miroir
            const x = ctr[0] - rr * Math.cos(t - Math.PI / 2),
              y = ctr[1] + rr * Math.sin(t - Math.PI / 2);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = rvb(couleur_sous_ensemble(sub, sombre), 0.8).css();
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }));
      }
      this.aiguilles(plan, ajoute, zf, zb, o, sombre);
    }
    // la manivelle sort de la façade : cachée par le coffret fermé quand on le regarde par-derrière
    if (!ferme || R[8] > -0.05) this.manivelle_pieces(pr, ajoute, sombre);

    pieces.sort((a, b) => a.cle - b.cle);
    for (const x of pieces) x.dessiner();
    p.restore();

    // ---- étiquettes (repère de l'écran, toujours à l'endroit)
    if (ferme) this.etiquettes_cosmos(p, pr, zf, o);
    else this.legende(p, r, sombre);
    if (this.roue) {
      const [gx, gy, gz] = M.gear_placement(this.roue, e, car);
      const [X, Y] = projeter(pr, gx, gy, gz + M.GEAR_THICKNESS);
      dessin.police(p, 0.9);
      dessin.etiquette(p, X, Y, `${this.roue} · ${tr('anim_antikythera_dents', { n: M.TEETH[this.roue]! })} · ${M.GEAR_RATES[this.roue]}`, 'texte');
      dessin.police(p, 1 / 0.9);
    }
    this.duree_ms = typeof performance !== 'undefined' ? performance.now() - t0 : 0;
  }

  /** Machine fermée : faces du coffret tournées vers l'observateur, cadrans gravés, aiguilles. */
  private dessiner_coffret(pr: Projection, plan: (z: number, f: () => void) => void, zf: number, zb: number, sombre: boolean, px_mm: number, o: M.Outputs): void {
    const R = pr.R;
    void sombre;
    const W = M.CASE_WIDTH,
      H = M.CASE_HEIGHT,
      X0 = M.CASE_CX - W / 2,
      Y0 = M.CASE_CY - H / 2;
    const c = this.pr_ctx!;
    // flancs : normales ±x, ±y ; visibles si leur normale regarde l'observateur (coffret convexe et opaque)
    const flancs: [number[], number[][]][] = [
      [[1, 0, 0], [[X0 + W, Y0, zb], [X0 + W, Y0 + H, zb], [X0 + W, Y0 + H, zf], [X0 + W, Y0, zf]]],
      [[-1, 0, 0], [[X0, Y0, zb], [X0, Y0 + H, zb], [X0, Y0 + H, zf], [X0, Y0, zf]]],
      [[0, 1, 0], [[X0, Y0 + H, zb], [X0 + W, Y0 + H, zb], [X0 + W, Y0 + H, zf], [X0, Y0 + H, zf]]],
      [[0, -1, 0], [[X0, Y0, zb], [X0 + W, Y0, zb], [X0 + W, Y0, zf], [X0, Y0, zf]]],
    ];
    for (const [n, coins] of flancs) {
      const nz = R[6] * n[0]! + R[7] * n[1]! + R[8] * n[2]!;
      if (nz <= 0.01) continue;
      c.beginPath();
      for (const [i, q] of coins.entries()) {
        const [X, Y] = projeter(pr, q[0]!, q[1]!, q[2]!);
        if (i === 0) c.moveTo(X, Y);
        else c.lineTo(X, Y);
      }
      c.closePath();
      c.fillStyle = rvb(BOIS.map((x) => x * (0.7 + 0.3 * nz))).css();
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.lineWidth = 1;
      c.stroke();
    }
    if (R[8] > 0.01) {
      // façade : plaque de bronze, cadran du zodiaque, anneau calendaire tourné pour que l'aiguille du Soleil
      // indique la date égyptienne (on le recalait tous les quatre ans), Cosmos, aiguilles, sphère de phase
      plan(zf, () => {
        c.fillStyle = rvb(BRONZE_MOYEN).css();
        c.fillRect(X0, Y0, W, H);
        c.strokeStyle = GRAVE_DOUX;
        c.lineWidth = 0.8;
        c.strokeRect(X0, Y0, W, H);
        this.cadran(c, 'avant', 0, 0, ENV_AVANT, 0, px_mm, false);
        const lam = (90 - 360 * o.mean_sun) * DEG; // angle polaire de l'aiguille du Soleil
        const date = (90 - (360 * (M.egyptian_day(this.jd()) + 0.5)) / 365) * DEG;
        this.cadran(c, 'calendrier', 0, 0, ENV_AVANT, lam - date, px_mm, false);
        this.cosmos_et_aiguilles(c, o);
      });
    }
    if (R[8] < -0.01) {
      plan(zb, () => {
        this.cadran(c, 'arriere', M.CASE_CX, M.CASE_CY, ENV_ARRIERE, 0, px_mm, true);
        this.aiguilles_dos(c, o);
      });
    }
  }

  private pr_ctx: Ctx | null = null;

  /** Dessine un cadran : image en cache (résolution selon le zoom) ou, hors navigateur, tracé vectoriel direct. */
  private cadran(c: Ctx, face: 'avant' | 'calendrier' | 'arriere', x: number, y: number, env: number, rot: number, px_mm: number, miroir: boolean): void {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    // repère du dessin : y vers le bas (et x inversé pour la face vue par-derrière)
    c.scale(miroir ? -1 : 1, -1);
    const voulu = env * px_mm;
    const cote = Math.min(2048, Math.max(256, 2 ** Math.ceil(Math.log2(Math.max(1, voulu)))));
    const im = image_cadran(face, cote, langue());
    if (im) c.drawImage(im.img as CanvasImageSource, -env / 2, -env / 2, env, env);
    else {
      const k = env / 600;
      c.scale(k, k);
      const R0 = 600 * 0.485;
      if (face === 'avant') peindre_face_avant(c, 0, 0, R0, langue());
      else if (face === 'calendrier') peindre_anneau_calendrier(c, 0, 0, R0);
      else peindre_face_arriere(c, 0, 0, R0, true);
    }
    c.restore();
  }

  /** Anneaux du Cosmos (longitudes géocentriques), aiguilles du Soleil et de la Lune, sphère de phase (plan de la façade). */
  private cosmos_et_aiguilles(c: Ctx, o: M.Outputs): void {
    for (const [nom, rayon, col] of M.COSMOS_RINGS) {
      c.beginPath();
      c.arc(0, 0, rayon, 0, 2 * Math.PI);
      c.strokeStyle = rvb(col, 0.85).css();
      c.lineWidth = 1.6;
      c.stroke();
      const lon = this.longitude_cosmos(nom, o);
      const a = (90 - lon) * DEG;
      c.beginPath();
      c.arc(rayon * Math.cos(a), rayon * Math.sin(a), 3.1, 0, 2 * Math.PI);
      c.fillStyle = rvb(col).css();
      c.fill();
      c.strokeStyle = 'rgba(40,40,46,0.9)';
      c.lineWidth = 0.4;
      c.stroke();
    }
    aiguille(c, (90 - 360 * o.mean_sun) * DEG, M.SUN_HAND, 3.2, AIGUILLE_SOLEIL);
    const al = (90 - 360 * o.moon_true) * DEG;
    aiguille(c, al, M.MOON_HAND, 2.4, AIGUILLE_LUNE);
    // sphère de phase, demi-argentée, sur l'aiguille de la Lune
    const bx = 82 * Math.cos(al),
      by = 82 * Math.sin(al);
    const elong = pmod(o.phase_turns * 360, 360);
    const vers_soleil = Math.atan2(Math.sin((90 - 360 * o.mean_sun) * DEG) * 97 - by, Math.cos((90 - 360 * o.mean_sun) * DEG) * 97 - bx);
    c.save();
    c.translate(bx, by);
    c.rotate(vers_soleil + (elong > 180 ? Math.PI : 0));
    sphere_phase(c, 5.5, elong);
    c.restore();
    c.beginPath();
    c.arc(0, 0, 4.2, 0, 2 * Math.PI);
    c.fillStyle = 'rgb(71,71,77)';
    c.fill();
  }

  longitude_cosmos(nom: string, o: M.Outputs): number {
    if (nom === 'sun') return pmod(o.mean_sun * 360, 360);
    if (nom === 'moon') return pmod(o.moon_true * 360, 360);
    return M.geocentric_longitude(nom, o.planets[nom]!, o.mean_sun);
  }

  /** Aiguilles du dos (plan z_b, repère de la machine) : métonique et Saros avec leur curseur, petits cadrans. */
  private aiguilles_dos(c: Ctx, o: M.Outputs): void {
    // la face est gravée pour être vue par-derrière : un point (u, v) de l'image (v vers le bas) est, dans le repère
    // de la machine, à (−u, −v) de son centre ; le curseur de l'aiguille suit le sillon de la spirale
    const spir = (ctr: [number, number], rad: number, tours: number, val: number, col: [number, number, number], r0f: number): void => {
      const t = 2 * Math.PI * pmod(val, tours);
      const r0 = rad * r0f;
      const rr = r0 + ((rad - r0) * t) / (tours * 2 * Math.PI);
      const ux = rr * Math.cos(t - Math.PI / 2),
        vy = -rr * Math.sin(t - Math.PI / 2);
      const x = ctr[0] - ux,
        y = ctr[1] - vy;
      const a = Math.atan2(y - ctr[1], x - ctr[0]);
      aiguille_xy(c, ctr[0], ctr[1], a, rad * 1.04, 2.4, col);
      c.beginPath();
      c.arc(x, y, 2.2, 0, 2 * Math.PI);
      c.fillStyle = rvb(col).css();
      c.fill();
      c.strokeStyle = 'rgba(30,30,30,0.8)';
      c.lineWidth = 0.4;
      c.stroke();
    };
    spir(M.METONIC_CENTER, M.METONIC_RADIUS, 5, o.metonic, M.COLORS.metonic!, 0.275);
    spir(M.SAROS_CENTER, M.SAROS_RADIUS, 4, o.saros, M.COLORS.saros!, 0.27);
    // petits cadrans : secteur k au centre de son secteur (sens horaire vu par-derrière, comme les graduations)
    const petit = (ctr: [number, number], rad: number, frac: number): void => {
      // secteur k au centre de son secteur : angle polaire de l'image 90° − 360° × frac, soit (u, v) = (cos, −sin),
      // donc (−cos, sin) dans le repère de la machine
      const ia = Math.PI / 2 - 2 * Math.PI * pmod(frac, 1);
      aiguille_xy(c, ctr[0], ctr[1], Math.atan2(Math.sin(ia), -Math.cos(ia)), rad * 0.92, 1.6, [71, 71, 77]);
    };
    petit(M.ARBORS.o!, M.CALLIPPIC_RADIUS, o.callippic);
    petit(M.ARBORS.i!, M.EXELIGMOS_RADIUS, o.exeligmos);
    petit(M.GAMES_CENTER, M.GAMES_RADIUS, o.turns / 4);
  }

  /** Aiguilles de la machine ouverte (façade et dos), dans leurs plans. */
  private aiguilles(plan: (z: number, f: () => void) => void, ajoute: (z: number, f: () => void, ordre?: number) => void, zf: number, zb: number, o: M.Outputs, sombre: boolean): void {
    const c = this.pr_ctx!;
    ajoute(zf + 9.5, () => plan(zf + 9.5, () => this.cosmos_et_aiguilles(c, o)));
    ajoute(zb - 2, () => plan(zb - 2, () => this.aiguilles_dos(c, o)));
  }

  /** La manivelle : arbre, bras et poignée, dans l'axe de a1 (toujours visible : c'est la seule commande). */
  private manivelle_pieces(pr: Projection, ajoute: (z: number, f: () => void, ordre?: number) => void, sombre: boolean): void {
    const c = this.pr_ctx!;
    const m = this.manivelle();
    const bois = sombre ? [190, 146, 80] : [140, 107, 51];
    const z1 = m.z0 + M.CRANK_SHAFT;
    const seg = (x0: number, y0: number, za: number, x1: number, y1: number, zc: number, larg: number, col: number[]): void => {
      ajoute((za + zc) / 2, () => {
        const [a, b] = projeter(pr, x0, y0, za);
        const [d, e] = projeter(pr, x1, y1, zc);
        c.strokeStyle = rvb(col).css();
        c.lineWidth = Math.max(1.5, larg * pr.s);
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(a, b);
        c.lineTo(d, e);
        c.stroke();
      });
    };
    const zp0 = z1 + 4,
      zp1 = zp0 + M.CRANK_HANDLE + 6;
    seg(m.ax, m.ay, m.z0, m.ax, m.ay, z1 + 2, 6.4, bois);
    seg(m.ax, m.ay, z1 + 2, m.hx, m.hy, z1 + 2, 6, bois);
    seg(m.hx, m.hy, zp0, m.hx, m.hy, zp1, 6.5, bois.map((x) => Math.min(255, x * 1.15)));
  }

  /** Symboles des planètes au bout de leur anneau (machine fermée, face avant). */
  private etiquettes_cosmos(p: Peintre, pr: Projection, zf: number, o: M.Outputs): void {
    if (pr.R[8] < 0.45) return;
    dessin.police(p, 0.85);
    for (const [nom, rayon] of M.COSMOS_RINGS) {
      const a = (90 - this.longitude_cosmos(nom, o)) * DEG;
      const [X, Y] = projeter(pr, rayon * Math.cos(a), rayon * Math.sin(a), zf + 9.5);
      dessin.reserver(p, X, Y, Math.max(2, 3.1 * pr.s));
      dessin.etiquette(p, X, Y, SYMBOLES[nom]!, 'texte', 5);
    }
    dessin.police(p, 1 / 0.85);
  }

  /** Légende des couleurs des sous-ensembles (machine ouverte). */
  private legende(p: Peintre, r: Rect, sombre: boolean): void {
    dessin.police(p, 0.82);
    const fm = p.fontMetrics();
    const h = fm.height() + 3;
    const noms = M.SUBSYSTEM_KEYS.map((k) => tr('anim_antikythera_sub_' + k));
    const w = Math.max(...noms.map((n) => fm.horizontalAdvance(n))) + 28;
    if (w + 16 > r.w * 0.6 || h * 7 + 8 > r.h * 0.6) {
      dessin.police(p, 1 / 0.82);
      return;
    }
    const x0 = r.x + 6,
      y0 = r.bottom - 7 * h - 10;
    p.save();
    p.setPen(null);
    p.setBrush(dessin.c('fond', 0.82));
    p.drawRoundedRect(new Rect(x0, y0, w + 8, 7 * h + 6), 5, 5);
    p.restore();
    for (const [i, k] of M.SUBSYSTEM_KEYS.entries()) {
      const y = y0 + 4 + i * h;
      p.setPen(null);
      p.setBrush(rvb(couleur_sous_ensemble(k, sombre)));
      p.drawRect(new Rect(x0 + 5, y + 2, 14, h - 6));
      dessin.texte(p, x0 + 24, y + fm.ascent() + 1, noms[i]!, 'texte', { centre: false });
    }
    dessin.police(p, 1 / 0.82);
  }

  override peindre(p: Peintre, r: Rect): void {
    this.pr_ctx = p.ctx as Ctx;
    super.peindre(p, r);
  }
}

/** Aiguille (repère de la façade, y vers le haut) : triangle allongé et moyeu. */
function aiguille(c: Ctx, a: number, longueur: number, larg: number, col: [number, number, number]): void {
  aiguille_xy(c, 0, 0, a, longueur, larg, col);
}
function aiguille_xy(c: Ctx, x: number, y: number, a: number, longueur: number, larg: number, col: readonly number[]): void {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.beginPath();
  c.moveTo(-6, -larg / 2);
  c.lineTo(longueur, -larg / 4);
  c.lineTo(longueur * 1.05, 0);
  c.lineTo(longueur, larg / 4);
  c.lineTo(-6, larg / 2);
  c.closePath();
  c.fillStyle = rvb(col).css();
  c.fill();
  c.strokeStyle = 'rgba(30,30,30,0.7)';
  c.lineWidth = 0.4;
  c.stroke();
  c.beginPath();
  c.arc(0, 0, 3.4, 0, 2 * Math.PI);
  c.fillStyle = 'rgb(71,71,77)';
  c.fill();
  c.restore();
}

/** Sphère demi-argentée, demi-noire : la part éclairée vue de face suit l'élongation (0 : nouvelle, 180 : pleine). */
function sphere_phase(c: Ctx, r: number, elong: number): void {
  c.beginPath();
  c.arc(0, 0, r, 0, 2 * Math.PI);
  c.fillStyle = 'rgb(28,28,32)';
  c.fill();
  const a = pmod(elong, 360);
  const k = Math.cos(a * DEG);
  c.beginPath();
  // limbe éclairé (demi-cercle du côté +x), puis terminateur (demi-ellipse de demi-axe |k| r)
  c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
  c.ellipse(0, 0, Math.abs(k) * r + 1e-6, r, 0, Math.PI / 2, -Math.PI / 2, k > 0);
  c.closePath();
  c.fillStyle = 'rgb(214,218,224)';
  c.fill();
  c.beginPath();
  c.arc(0, 0, r, 0, 2 * Math.PI);
  c.strokeStyle = 'rgba(20,20,20,0.8)';
  c.lineWidth = 0.4;
  c.stroke();
}

/** Fiche d'une roue : nom, dents, rapport exact (tours par an), sens, fonction. */
export function fiche_roue(nom: string): string {
  const r = M.GEAR_RATES[nom]!;
  const abs = r.n < 0 ? r.neg() : r;
  return tr('anim_antikythera_roue_val', {
    nom, dents: M.TEETH[nom]!, rapport: abs.toString(), sens: r.n < 0 ? tr('anim_antikythera_sens_inverse') : '',
    fonction: tr('anim_antikythera_sub_' + (M.SUBSYSTEM_OF[nom] ?? 'input')),
  });
}

export { Pt };
