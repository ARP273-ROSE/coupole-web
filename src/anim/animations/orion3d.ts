/**
 * Orion en 3D, sur le modèle de « Grande Ourse 3D » : les étoiles principales d'Orion (Bételgeuse, Bellatrix,
 * Meissa, Mintaka, Alnilam, Alnitak, Saiph, Rigel, et l'épée : Hatysa et le Trapèze de M42) à leur distance mesurée,
 * la Terre en bas, les lignes de visée, et leurs projections sur la sphère céleste où se dessine la figure familière.
 * On fait tourner la scène au glisser : de face on retrouve la constellation, de côté on voit que ses étoiles sont
 * à des profondeurs très différentes (77 à 400 pc).  La nébuleuse d'Orion (M42) et la Tête de Cheval sont posées à
 * leur place ; les nuages moléculaires Orion A et B en option.  Animation propre à Coupole (pas dans ClassAction) ;
 * données : SIMBAD, Gaia DR3, Hipparcos 2007 et articles cités (fiches au survol) ; couleur vraie (corps noir → CIE).
 * Scène fixe (pas de lecture) : elle n'est redessinée que lorsqu'on la tourne ou qu'on change un réglage.
 */
import * as astro from '../../calc/astro';
import { accentuer, couleur_etoile, rayon_disque } from '../../calc/couleur_etoile';
import * as N from '../../calc/nebuleuses_orion';
import * as O from '../../calc/orion3d';
import { langue, tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Couleur, type Peintre, type Rect } from '../../noyau/peintre';
import { linspace } from '../../noyau/py';
import { mul, type Pts } from '../../noyau/vec';
import { Animation, type Choix, type Coche, nombre } from '../base';

/** étoiles de la scène : la figure (8) et l'épée (Hatysa, θ¹ Ori C au cœur de M42) */
export const ETOILES = ['alf_ori', 'gam_ori', 'lam_ori', 'del_ori', 'eps_ori', 'zet_ori', 'kap_ori', 'bet_ori', 'iot_ori', 'tet01_ori_c'];
/** figure tracée (Stellarium, ciel « moderne »), et l'épée en tirets */
export const TRAITS: [string, string][] = [
  ['lam_ori', 'alf_ori'], ['lam_ori', 'gam_ori'], ['alf_ori', 'zet_ori'], ['gam_ori', 'del_ori'], ['del_ori', 'eps_ori'],
  ['eps_ori', 'zet_ori'], ['zet_ori', 'kap_ori'], ['del_ori', 'bet_ori'],
];
export const EPEE: [string, string][] = [['eps_ori', 'tet01_ori_c'], ['tet01_ori_c', 'iot_ori']];
/** rayon de la sphère céleste dessinée (pc) : un peu au-delà de l'étoile la plus lointaine */
export const RAYON_PC = 450;
export const PC_AL = 3.2615637772;
const CIEL = new Couleur(6, 8, 14);
/** vue de côté (la Terre en bas, Orion en haut : les profondeurs) et vue de face (depuis la Terre : la figure) */
export const VUE_COTE: readonly [number, number] = [172.5, 12];
export const VUE_FACE: readonly [number, number] = [352.5, -55];

// Repère de dessin : la direction d'Orion (α = 84°, δ = −1°) est ramenée là où la Grande Ourse se trouve dans
// « Grande Ourse 3D » (α = 187,5°, δ = 55°), l'est et le nord du ciel conservés : même mise en scène, même vue de départ.
const CENTRE_ORION = O.direction(84.0, -1.0);
const CENTRE_SCENE = astro.vecteur_equatorial(15 * 12.5, 55.0) as O.V3;

function base(c: O.V3): [O.V3, O.V3, O.V3] {
  const est = O.unitaire(O.cross([0, 0, 1], c));
  const nord = O.cross(c, est);
  return [est, nord, c];
}
const [E0, N0, C0] = base(CENTRE_ORION);
const [E1, N1, C1] = base(CENTRE_SCENE);

/** Vecteur du ciel (ICRS) → repère de la scène (rotation : Orion à la place de la Grande Ourse). */
export function scene(v: readonly number[]): O.V3 {
  const x = O.dot(v, E0);
  const y = O.dot(v, N0);
  const z = O.dot(v, C0);
  return [x * E1[0] + y * N1[0] + z * C1[0], x * E1[1] + y * N1[1] + z * C1[1], x * E1[2] + y * N1[2] + z * C1[2]];
}

export function etoile(id: string): O.EtoileOrion {
  return O.DONNEES.etoiles.find((e) => e.id === id)!;
}

/** « 264,6 ± 3,1 » ou « 264,6 (−21,8/+26,2) » */
function avec_ecart(v: number, moins: number, plus: number, dec = 1): string {
  return Math.abs(moins - plus) < 0.05 ? `${nombre(v, dec)} ± ${nombre(moins, dec)}` : `${nombre(v, dec)} (−${nombre(moins, dec)}/+${nombre(plus, dec)})`;
}

export class Orion3D extends Animation {
  static override ID = 'orion3d';
  static override ANIMEE = false;
  static override FICHES = true;

  vue3d!: dessin.Vue3D;
  unite!: Choix;
  c_lignes!: Coche;
  c_noms!: Coche;
  c_sphere!: Coche;
  c_figure!: Coche;
  c_nebuleuses!: Coche;
  c_nuages!: Coche;
  c_barres!: Coche;
  c_brutes!: Coche;
  c_accent!: Coche;

  override construire(): void {
    this.vue3d = this.vue(VUE_COTE[0], VUE_COTE[1], -89.0, 89.0);
    this.bouton('anim_orion3d_b_face', () => this.regarder(VUE_FACE));
    this.bouton('anim_orion3d_b_cote', () => this.regarder(VUE_COTE));
    this.unite = this.choix('unite', [['anim_orion3d_u_al', 'al'], ['anim_orion3d_u_pc', 'pc']], 'al');
    this.c_lignes = this.coche('lignes', true);
    this.c_noms = this.coche('noms', true);
    this.c_sphere = this.coche('sphere', true);
    this.c_figure = this.coche('figure', true);
    this.c_nebuleuses = this.coche('nebuleuses', true);
    this.c_nuages = this.coche('nuages', false);
    this.c_barres = this.coche('barres', true);
    this.c_brutes = this.coche('brutes', false);
    this.c_accent = this.coche('accentuees', false);
  }

  /** Vue instantanée (aucune lecture : la scène n'est redessinée qu'une fois). */
  private regarder(v: readonly [number, number]): void {
    this.vue3d.regler(v[0], v[1]);
    this.rafraichir();
  }

  nom(e: O.EtoileOrion): string {
    if (e.id === 'tet01_ori_c') return tr('anim_orion3d_trapeze');
    return e.nom[langue()] || e.nom.fr;
  }

  /** Distance retenue (pc) : distance publiée du groupe (Alnilam, Mintaka, Meissa, Hatysa) ou mesure brute. */
  distance(e: O.EtoileOrion): number {
    return !this.c_brutes.isChecked() && e.d_affichage ? e.d_affichage : e.d;
  }

  private texteDistance(pc: number): string {
    return this.unite.currentData() === 'pc' ? `${nombre(pc, 0)} pc` : `${nombre(pc * PC_AL, 0)} ${tr('anim_fiche_al')}`;
  }

  override valeurs(): [string, string][] {
    const al = tr('anim_fiche_al');
    const out: [string, string][] = ETOILES.map((id) => {
      const e = etoile(id);
      const d = this.distance(e);
      const mesure = `${avec_ecart(e.d, e.d_moins ?? 0, e.d_plus ?? 0)} pc`;
      const v = d !== e.d ? `≈ ${nombre(d, 0)} pc · ${nombre(d * PC_AL, 0)} ${al} (${tr('anim_orion3d_mesure')} ${mesure})` : `${mesure} · ${nombre(d * PC_AL, 0)} ${al}`;
      return [this.nom(e), v];
    });
    const m42 = O.norme(N.nebuleuses()[0]!.centre);
    const tete = O.norme(O.DONNEES.primitives.tete_de_cheval.centre);
    out.push([tr('anim_orion3d_n_m42'), `${nombre(m42, 0)} pc · ${nombre(m42 * PC_AL, 0)} ${al}`]);
    out.push([tr('anim_orion3d_n_tete'), `${nombre(tete, 1)} pc · ${nombre(tete * PC_AL, 0)} ${al}`]);
    out.push([tr('anim_orion3d_v_distances'), tr(this.c_brutes.isChecked() ? 'anim_orion3d_d_brutes' : 'anim_orion3d_d_publiees')]);
    if (this.c_accent.isChecked()) out.push([tr('anim_orion3d_v_couleurs'), tr('anim_orion3d_couleurs_accentuees')]);
    return out;
  }

  private couleur(e: O.EtoileOrion): Couleur {
    let c = couleur_etoile(e.teff ?? 5772);
    if (this.c_accent.isChecked()) c = accentuer(c);
    return new Couleur(c[0], c[1], c[2]);
  }

  override doubleClic(): boolean {
    this.vue3d.reinitialiser();
    this.rafraichir();
    return true;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    // ciel nocturne dans les deux thèmes : les couleurs physiques des nébuleuses et des étoiles ressortent
    const themeAvant = dessin.theme();
    dessin.choisirTheme('sombre');
    try {
      p.fillRect(rect, CIEL);
      this.scene3d(p, rect);
    } finally {
      dessin.choisirTheme(themeAvant);
    }
  }

  private court = false;

  private scene3d(p: Peintre, rect: Rect): void {
    this.court = rect.w < 600;
    this.zone_rotative(rect, this.vue3d);
    const dir = new Map(ETOILES.map((id) => {
      const e = etoile(id);
      return [id, scene(O.direction(e.ra, e.dec))];
    }));
    const reel = (id: string): O.V3 => mul(dir.get(id)!, this.distance(etoile(id)) / RAYON_PC) as O.V3;
    // toute la scène (la Terre, les étoiles à leur distance, le ciel) cadrée dans la toile, quelle que soit sa forme
    const tous: number[][] = [[0, 0, 0], ...dir.values(), ...ETOILES.map(reel)];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const v of tous) {
      const [x, y] = this.vue3d.projeter1(v);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const marge = 46;
    const r = Math.max(10, Math.min((rect.w - 2 * marge) / Math.max(1e-6, x1 - x0), (rect.h - 2 * marge) / Math.max(1e-6, y1 - y0)));
    const cx = rect.cx - (r * (x1 + x0)) / 2;
    const cy = rect.cy + (r * (y1 + y0)) / 2;
    this.vue3d.rayon_px = r;
    const pe = new dessin.Peintre3D(p, this.vue3d, cx, cy, r);
    const plat = { arriere: 'normal' as const, profondeur: false };

    // sphère céleste : quadrillage d'Orion (δ = −10°, 0°, +10° ; α = 5 h, 5 h 30, 6 h), figure et épée projetées
    if (this.c_sphere.isChecked()) {
      for (const dec of [-10, 0, 10]) pe.courbe(linspace(73, 95, 30).map((ra) => scene(O.direction(ra, dec))) as Pts, 'grille', 1.0, 1.0, plat);
      for (const ra of [75, 82.5, 90]) pe.courbe(linspace(-14, 14, 30).map((dec) => scene(O.direction(ra, dec))) as Pts, 'grille', 1.0, 1.0, plat);
      for (const [a, b] of TRAITS) pe.courbe(dessin.arc(dir.get(a)!, dir.get(b)!, 10), 'accent1', 1.6, 1.0, plat);
      for (const [a, b] of EPEE) pe.courbe(dessin.arc(dir.get(a)!, dir.get(b)!, 6), 'accent1', 1.0, 0.7, plat);
    }
    // place réservée pour les étiquettes : étoiles, projections, Terre
    for (const v of [...ETOILES.map(reel), ...(this.c_sphere.isChecked() ? [...dir.values()] : []), [0, 0, 0]]) {
      const e = pe.ecran(v);
      dessin.reserver(p, e.xs[0]!, e.ys[0]!, 7);
    }
    // nuages moléculaires (option) : squelettes publiés d'Orion A et B (Zucker et al. 2021), traits transparents
    if (this.c_nuages.isChecked()) {
      for (const [cle, fiche, n] of [['orion_a', 'orion:orion_a', 'anim_orion3d_n_orion_a'], ['orion_b', 'orion:orion_b', 'anim_orion3d_n_orion_b']] as const) {
        const pts = (O.DONNEES.primitives[cle].points as number[][]).map((P) => mul(scene(P), 1 / RAYON_PC)) as Pts;
        pe.courbe(pts, new Couleur(130, 150, 200), 9, 0.22, plat);
        pe.courbe(pts, new Couleur(130, 150, 200), 3, 0.45, plat);
        const m = pts[Math.floor(pts.length / 2)]!;
        const q = pe.ecran(m);
        this.survolable(p, fiche, q.xs[0]!, q.ys[0]!, 10, 40);
        if (this.c_noms.isChecked()) dessin.etiquette(p, q.xs[0]!, q.ys[0]!, tr(n), 'doux', 8);
      }
    }
    // figure dans l'espace : les mêmes traits entre les étoiles à leur distance (rien ne les relie vraiment)
    if (this.c_figure.isChecked()) {
      for (const [a, b] of TRAITS) pe.segment(reel(a), reel(b), 'accent1', 1.0, 0.45);
      for (const [a, b] of EPEE) pe.segment(reel(a), reel(b), 'accent1', 0.8, 0.3);
    }
    // M42 et la Tête de Cheval : petites formes légères à leur place
    const noms: [number, number, string, number][] = [];
    if (this.c_nebuleuses.isChecked()) this.nebuleuses(p, pe, r, noms);
    // étoiles : ligne de visée, barre d'erreur, disque en couleur vraie, projection sur la sphère
    ETOILES.forEach((id) => {
      const e = etoile(id);
      const v = dir.get(id)!;
      const d = this.distance(e);
      if (this.c_lignes.isChecked()) pe.segment([0, 0, 0], this.c_sphere.isChecked() ? v : mul(v, d / RAYON_PC), 'doux', 0.8, 0.35);
      // barre d'erreur de la mesure affichée (une étoile placée à la distance de son groupe n'en a pas : sa mesure
      // propre, très incertaine, est dans les valeurs et dans sa fiche)
      if (this.c_barres.isChecked() && d === e.d && e.d_moins !== null && e.d_plus !== null) {
        pe.segment(mul(v, (e.d - e.d_moins) / RAYON_PC), mul(v, (e.d + e.d_plus) / RAYON_PC), 'accent2', 3.0);
      }
      const rayon = id === 'tet01_ori_c' ? 3.2 : rayon_disque(e.V, 0, 6, 2.6, 7.5);
      const q = pe.point(reel(id), this.couleur(e), rayon, { bord: 'grille', toujours: true });
      if (q) this.survolable(p, 'orion:' + id, q[0], q[1], Math.max(7, rayon + 2), e.V);
      // toile étroite : le nom seul (la distance est dans les valeurs et dans la fiche)
      if (q && this.c_noms.isChecked()) noms.push([q[0], q[1], this.court ? this.nom(e) : `${this.nom(e)} (${this.texteDistance(d)})`, rayon + 4]);
      if (this.c_sphere.isChecked()) pe.point(v, 'accent1', 2.6, { toujours: true });
    });
    const t = pe.point([0, 0, 0], 'terre', 6.0, { toujours: true });
    // étiquettes lisibles : police plus grande et grasse, cartouche contrasté, sans chevauchement
    p.save();
    dessin.police(p, 1.08, true);
    for (const [xx, yy, s, ecart] of noms) dessin.etiquette(p, xx, yy, s, 'texte', ecart);
    if (t) dessin.etiquette(p, t[0], t[1], tr('anim_shadowsim_terre'), 'texte', 9);
    p.restore();
    // légende : couleur des étoiles, agrandissement des nébuleuses (seule leur taille est agrandie)
    dessin.texte(p, rect.x + 10, rect.y + rect.h - 12, tr('anim_orion3d_legende'), 'doux', { centre: false });
    if (this.c_nebuleuses.isChecked()) dessin.texte(p, rect.x + 10, rect.y + rect.h - 30, tr('anim_orion3d_agrandi', { k: N.AGRANDI }), 'doux', { centre: false });
  }

  /**
   * M42 et IC 434 / Tête de Cheval en volume : particules pré-calculées (géométrie publiée, taille agrandie ×AGRANDI),
   * projetées puis dessinées de l'arrière vers l'avant ; gaz ionisé en mélange additif, poussière opaque.  Sprites
   * dégradés préparés une fois par couleur : coût mesuré < 2 ms par image (test de rendu).
   */
  private nebuleuses(p: Peintre, pe: dessin.Peintre3D, echelle: number, noms: [number, number, string, number][]): void {
    const ctx = p.ctx;
    const ps = particulesScene();
    const ecr = pe.ecran(ps.pts);
    const ordre = ps.ordre;
    for (let i = 0; i < ordre.length; i++) ordre[i] = i;
    ordre.sort((a, b) => ecr.zs[a]! - ecr.zs[b]!);
    const k = echelle / RAYON_PC;
    // vue de face (depuis la Terre), les nuages agrandis masqueraient la figure : ils s'estompent
    const face = Math.max(0, -O.dot(this.vue3d.d, CENTRE_SCENE));
    const voile = 1 - 0.65 * face * face;
    ctx.save();
    // changements d'état du contexte seulement quand ils servent (ils coûtent plus que le dessin d'un sprite)
    let mode = '';
    let alpha = -1;
    for (const i of ordre) {
      const q = ps.liste[i]!;
      const x = ecr.xs[i]!;
      const y = ecr.ys[i]!;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const rp = Math.max(1.2, q.r * k);
      const m = q.genre === 'gaz' ? 'lighter' : 'source-over';
      if (m !== mode) ctx.globalCompositeOperation = mode = m;
      const a = q.alpha * voile;
      if (a !== alpha) ctx.globalAlpha = alpha = a;
      const im = sprite(q.rvb);
      if (im) ctx.drawImage(im, x - rp, y - rp, 2 * rp, 2 * rp);
      else {
        ctx.fillStyle = `rgb(${q.rvb.join(',')})`;
        ctx.beginPath();
        ctx.arc(x, y, rp * 0.6, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    ctx.restore();
    // étoiles excitatrices (Trapèze, σ Ori) et repères à fiche
    for (const n of N.nebuleuses()) {
      for (const e of n.etoiles) {
        const et = O.DONNEES.etoiles.find((x) => x.id === e.id)!;
        const q = pe.point(mul(scene(e.p), 1 / RAYON_PC), this.couleur(et), e.id === 'sig_ori' ? 3.4 : 2.2, { toujours: true });
        if (q) this.survolable(p, 'orion:' + e.id, q[0], q[1], 6, 30);
        if (q && e.id === 'sig_ori' && this.c_noms.isChecked()) noms.push([q[0], q[1], this.nom(et), 6]);
      }
      for (const rp of n.reperes) {
        const q = pe.ecran(mul(scene(rp.p), 1 / RAYON_PC));
        this.survolable(p, rp.fiche, q.xs[0]!, q.ys[0]!, rp.fiche === 'orion:m42' ? 16 : 9, 20);
      }
      if (this.c_noms.isChecked()) {
        const c = pe.ecran(mul(scene(n.centre), 1 / RAYON_PC));
        const nom = this.court ? (n.id === 'm42' ? 'M42' : 'IC 434') : tr(n.id === 'm42' ? 'anim_orion3d_n_m42' : 'anim_orion3d_n_ic434');
        noms.push([c.xs[0]!, c.ys[0]!, this.court ? nom : `${nom} (${this.texteDistance(O.norme(n.centre))})`, 16]);
      }
    }
  }
}

/** Particules des deux nébuleuses dans le repère de la scène (calculées une fois). */
let PS: { liste: N.Particule[]; pts: Pts; ordre: number[] } | null = null;
function particulesScene(): NonNullable<typeof PS> {
  if (!PS) {
    const liste = N.nebuleuses().flatMap((n) => n.particules);
    PS = { liste, pts: liste.map((q) => mul(scene(q.p), 1 / RAYON_PC)) as Pts, ordre: new Array<number>(liste.length) };
  }
  return PS;
}

const SPRITES = new Map<string, HTMLCanvasElement | OffscreenCanvas>();
/** Disque dégradé (couleur pleine au centre → transparent au bord), préparé une fois par couleur. */
function sprite(rvb: [number, number, number]): CanvasImageSource | null {
  const k = rvb.join(',');
  let s = SPRITES.get(k);
  if (!s) {
    if (typeof OffscreenCanvas === 'undefined' && typeof document === 'undefined') return null;
    s = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(48, 48) : document.createElement('canvas');
    s.width = 48;
    s.height = 48;
    const c = s.getContext('2d') as CanvasRenderingContext2D;
    const g = c.createRadialGradient(24, 24, 0, 24, 24, 24);
    g.addColorStop(0, `rgba(${k},1)`);
    g.addColorStop(0.45, `rgba(${k},0.55)`);
    g.addColorStop(1, `rgba(${k},0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, 48, 48);
    SPRITES.set(k, s);
  }
  return s as CanvasImageSource;
}
