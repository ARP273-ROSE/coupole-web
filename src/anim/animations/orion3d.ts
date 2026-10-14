/**
 * Orion en 3D : la constellation telle qu'on la voit, puis « dépliée » en trois dimensions (chaque étoile à sa distance
 * mesurée) ; les nuages moléculaires Orion A et B, la nébuleuse d'Orion (M42, modèle en « blister »), la Tête de
 * Cheval, l'anneau de λ Orionis et la boucle de Barnard à leurs distances publiées ; plongée vers M42 et la Tête de
 * Cheval avec les images de l'ESO et de l'ESA/Hubble posées sur le ciel.  Animation propre à Coupole (pas dans
 * ClassAction) ; données : SIMBAD, Gaia DR3, Hipparcos 2007 et articles cités (fiches au survol).  Tout est à
 * l'échelle, sauf la taille des disques d'étoiles (selon la magnitude) ; couleur vraie (corps noir → CIE 1931).
 */
import { accentuer, couleur_etoile, rayon_disque, type RVB } from '../../calc/couleur_etoile';
import * as O from '../../calc/orion3d';
import { langue, tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Couleur, type Peintre, Pt, Rect } from '../../noyau/peintre';
import { Animation, type Choix, type Coche, nombre, type Reglage } from '../base';

/** étoiles nommées dans la vue d'ensemble (les plus brillantes de la figure, et la plus proche) */
const NOMMEES = new Set(['bet_ori', 'alf_ori', 'gam_ori', 'eps_ori', 'zet_ori', 'kap_ori', 'del_ori', 'lam_ori', 'pi_03_ori', 'iot_ori']);
/** étoiles nommées dans les plongées */
const NOMMEES_ZOOM: Record<O.Cible, Set<string>> = {
  orion: NOMMEES,
  m42: new Set(['tet01_ori_c', 'tet01_ori_a', 'tet01_ori_b', 'tet01_ori_d', 'tet02_ori_a', 'iot_ori']),
  tete: new Set(['sig_ori', 'sig_ori_e', 'sig_ori_d', 'zet_ori']),
};
const CIEL = new Couleur(4, 6, 12);
const DUREE_TRANSITION = 2.2;
const VITESSE_DEPLIEMENT = 100 / DUREE_TRANSITION;
const TOUR_PAR_S = 6;

type Images = Map<string, HTMLImageElement | null>;
const IMAGES: Images = new Map();

/** Charge une texture (une fois) ; rappel quand elle est prête.  Sans navigateur (tests), rien. */
function texture(fichier: string, pret: () => void): HTMLImageElement | null {
  if (IMAGES.has(fichier)) {
    const i = IMAGES.get(fichier)!;
    return i && i.complete && i.naturalWidth > 0 ? i : null;
  }
  if (typeof Image === 'undefined') {
    IMAGES.set(fichier, null);
    return null;
  }
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => pret();
  img.onerror = () => IMAGES.set(fichier, null);
  img.src = `orion/${fichier}`;
  IMAGES.set(fichier, img);
  return null;
}

export class Orion3D extends Animation {
  static override ID = 'orion3d';
  static override ANIMEE = true;
  static override FICHES = true;

  vue3d!: dessin.Vue3D;
  dep!: Reglage;
  cible!: Choix;
  photo!: Choix;
  c_figure!: Coche;
  c_noms!: Coche;
  c_nebuleuses!: Coche;
  c_images!: Coche;
  c_barres!: Coche;
  c_accent!: Coche;
  c_brutes!: Coche;

  /** dépliement visé par les boutons (null : aucun) ; lecture lancée par eux (s'arrête à l'arrivée) */
  private but: number | null = null;
  private lectureAuto = false;
  /** transition de caméra entre deux cibles : de → vers, k de 0 à 1 */
  private de: O.Cible = 'orion';
  private vers: O.Cible = 'orion';
  private k = 1;
  private credits: [string, string][] = [];

  override construire(): void {
    this.vue3d = this.vue(0, 0, -80, 80);
    this.dep = this.curseur('depliement', 0, 100, 0, { dec: 0, unite: '%' });
    this.bouton('anim_orion3d_b_ciel', () => this.aller(0));
    this.bouton('anim_orion3d_b_3d', () => this.aller(100));
    this.cible = this.choix('cible', [['anim_orion3d_c_orion', 'orion'], ['anim_orion3d_c_m42', 'm42'], ['anim_orion3d_c_tete', 'tete']], 'orion');
    this.photo = this.choix('image', [['anim_orion3d_i_sol', 'sol'], ['anim_orion3d_i_hubble', 'hubble']], 'sol');
    this.c_figure = this.coche('figure', true);
    this.c_noms = this.coche('noms', true);
    this.c_nebuleuses = this.coche('nebuleuses', true);
    this.c_images = this.coche('images', true);
    this.c_barres = this.coche('barres', true);
    this.c_accent = this.coche('accentuees', false);
    this.c_brutes = this.coche('brutes', false);
    this.cible.currentIndexChanged.connect(() => this.changer_cible());
    this.etat_initial();
  }

  override etat_initial(): void {
    this.but = null;
    this.lectureAuto = false;
    const c = (this.cible?.currentData() as O.Cible) ?? 'orion';
    this.de = c;
    this.vers = c;
    this.k = 1;
  }

  /** Bouton « vue du ciel » / « vue 3D » : le dépliement va vers v en ~2 s (lecture lancée au besoin). */
  private aller(v: number): void {
    this.but = v;
    if (!this.en_lecture) {
      this.lectureAuto = true;
      this.basculer_lecture();
    }
  }

  private changer_cible(): void {
    const c = this.cible.currentData() as O.Cible;
    if (c === this.vers) return;
    this.de = this.k >= 0.5 ? this.vers : this.de;
    this.vers = c;
    this.k = 0;
    if (!this.en_lecture) {
      this.lectureAuto = true;
      this.basculer_lecture();
    }
  }

  override avancer(dt: number): void {
    let bouge = false;
    if (this.but !== null) {
      const v = this.dep.value();
      const n = v < this.but ? Math.min(this.but, v + VITESSE_DEPLIEMENT * dt) : Math.max(this.but, v - VITESSE_DEPLIEMENT * dt);
      this.dep.setValue(n);
      if (n === this.but) this.but = null;
      else bouge = true;
    }
    if (this.k < 1) {
      this.k = Math.min(1, this.k + dt / DUREE_TRANSITION);
      if (this.k < 1) bouge = true;
      else this.de = this.vers;
    }
    if (!bouge && this.lectureAuto) {
      this.lectureAuto = false;
      this.arreter();
    } else if (!bouge && this.dep.value() > 0) {
      // lecture demandée : la scène tourne lentement (tourne-disque)
      this.vue3d.regler(this.vue3d.az + TOUR_PAR_S * dt, this.vue3d.alt);
    }
  }

  override basculer_lecture(): void {
    if (this.en_lecture) this.lectureAuto = false;
    super.basculer_lecture();
  }

  override doubleClic(_pos: Pt): boolean {
    this.vue3d.reinitialiser();
    this.rafraichir();
    return true;
  }

  override credits_visibles(): [string, string][] {
    return this.credits;
  }

  private u(): number {
    return Math.max(0, Math.min(1, this.dep.value() / 100));
  }

  /** Caméra de l'image courante (lacet et tangage : glisser de l'utilisateur). */
  camera(w: number, h: number): O.Camera {
    const lacet = ((this.vue3d.az + 180) % 360) - 180;
    return O.camera(this.de, this.vers, this.k, this.u(), lacet, this.vue3d.alt, w, h);
  }

  private couleur(e: O.EtoileOrion): Couleur {
    let c: RVB = couleur_etoile(e.teff ?? 5772);
    if (this.c_accent.isChecked()) c = accentuer(c);
    return new Couleur(c[0], c[1], c[2]);
  }

  private nom(e: O.EtoileOrion): string {
    return e.nom[langue()] || e.nom.fr;
  }

  /** Distance affichée (pc) de l'étoile. */
  distance(e: O.EtoileOrion): number {
    return !this.c_brutes.isChecked() && e.d_affichage ? e.d_affichage : e.d;
  }

  override valeurs(): [string, string][] {
    const u = this.u();
    const fig = new Set(O.DONNEES.figure.flat());
    const etoiles = O.DONNEES.etoiles.filter((e) => fig.has(e.id));
    const proche = etoiles.reduce((a, b) => (this.distance(b) < this.distance(a) ? b : a));
    const loin = etoiles.reduce((a, b) => (this.distance(b) > this.distance(a) ? b : a));
    const ceinture = ['zet_ori', 'eps_ori', 'del_ori'].map((id) => O.DONNEES.etoiles.find((e) => e.id === id)!);
    const al = (pc: number): string => nombre(pc * 3.2615637772, 0);
    const c = this.cible.currentData() as string;
    const out: [string, string][] = [
      [tr('anim_orion3d_v_vue'), u <= 0 ? tr('anim_orion3d_vue_ciel') : u >= 1 ? tr('anim_orion3d_vue_3d') : tr('anim_orion3d_vue_entre', { p: nombre(100 * u, 0) })],
      [tr('anim_orion3d_v_cible'), tr('anim_orion3d_c_' + c)],
      [tr('anim_orion3d_v_proche'), `${this.nom(proche)} : ${nombre(this.distance(proche), 1)} pc (${al(this.distance(proche))} ${tr('anim_fiche_al')})`],
      [tr('anim_orion3d_v_loin'), `${this.nom(loin)} : ${nombre(this.distance(loin), 0)} pc (${al(this.distance(loin))} ${tr('anim_fiche_al')})`],
      [tr('anim_orion3d_v_ceinture'), ceinture.map((e) => `${this.nom(e)} ${nombre(this.distance(e), 0)} pc`).join(' · ')],
      [tr('anim_orion3d_v_distances'), tr(this.c_brutes.isChecked() ? 'anim_orion3d_d_brutes' : 'anim_orion3d_d_publiees')],
      [tr('anim_orion3d_v_echelle'), tr('anim_orion3d_echelle')],
    ];
    if (this.c_accent.isChecked()) out.push([tr('anim_orion3d_v_couleurs'), tr('anim_orion3d_couleurs_accentuees')]);
    return out;
  }

  // ------------------------------------------------------------------------------------------------ dessin
  override dessiner(p: Peintre, rect: Rect): void {
    p.fillRect(rect, CIEL);
    this.zone_rotative(rect, this.vue3d);
    this.vue3d.rayon_px = 0.45 * Math.min(rect.w, rect.h);
    const cam = this.camera(rect.w, rect.h);
    cam.cx += rect.x;
    cam.cy += rect.y;
    const u = this.u();
    const s = O.lisse(u);
    p.save();
    p.setClipRect(rect);
    this.credits = [];
    if (this.c_nebuleuses.isChecked()) this.nebuleuses(p, cam, u, s);
    if (this.c_images.isChecked()) this.textures(p, cam, u, s, rect);
    if (this.c_nebuleuses.isChecked()) this.m42_blister(p, cam, u);
    this.etoiles(p, cam, u, s, rect);
    p.restore();
    this.legendes(p, cam, rect, s);
  }

  /** Projette un point au dépliement u. */
  private proj(cam: O.Camera, P: readonly number[], u: number): O.V3 | null {
    return O.projeter(cam, O.deplier(P, u));
  }

  /** Lueur radiale (nébuleuse) de rayon r px. */
  private lueur(p: Peintre, x: number, y: number, r: number, c: Couleur, alpha: number): void {
    if (!(r > 0.5) || !Number.isFinite(x) || !Number.isFinite(y) || alpha <= 0.01) return;
    const g = p.ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c.avecAlpha(alpha).css());
    g.addColorStop(0.45, c.avecAlpha(alpha * 0.45).css());
    g.addColorStop(1, c.avecAlpha(0).css());
    p.setPen(null);
    p.setBrush(g);
    p.drawEllipse(x, y, r, r);
  }

  /**
   * Nuage en tube : trait épais et transparent le long d'une épine (halo puis cœur), une polyligne par morceau
   * visible, épaisseur selon la profondeur moyenne du morceau.
   */
  private tube(p: Peintre, cam: O.Camera, pts: number[][], rayon_pc: number, u: number, c: Couleur, alpha: number): O.V3[] {
    const q = pts.map((P) => this.proj(cam, P, u));
    const morceaux: O.V3[][] = [];
    let courant: O.V3[] = [];
    for (const x of [...q, null]) {
      if (x === null) {
        if (courant.length > 1) morceaux.push(courant);
        courant = [];
      } else courant.push(x);
    }
    for (const m of morceaux) {
      const z = m.reduce((s, v) => s + v[2], 0) / m.length;
      const poly = m.map((v) => new Pt(v[0], v[1]));
      for (const [k, larg] of [[2.6, alpha * 0.35], [1.0, alpha]] as const) {
        const w = Math.max(1.5, (k * 2 * cam.F * rayon_pc) / z);
        // de près (plongée), le tube serait une bande énorme sans forme publiée : il s'efface
        const f = Math.max(0, Math.min(1, (48 - w / k) / 24));
        if (f <= 0) continue;
        p.setPen({ couleur: c.avecAlpha(larg * f), epaisseur: w, pointille: false, bout: 'round', jointure: 'round' });
        p.setBrush(null);
        p.drawPolyline(poly);
      }
    }
    return q.filter((x): x is O.V3 => x !== null);
  }

  private nebuleuses(p: Peintre, cam: O.Camera, u: number, s: number): void {
    const P = O.DONNEES.primitives;
    // boucle de Barnard : arc Hα de 14° à l'est d'Orion ; en 3D, sur la coquille d'Orion (Foley et al. 2023)
    const bb = P.boucle_barnard;
    const rb = ((bb.diametre_deg as number) / 2) * O.DEG;
    const arc: O.V3[] = [];
    for (let k = 0; k <= 48; k++) {
      const pa = (-15 + (210 * k) / 48) * O.DEG;
      const d = O.decaler(bb.centre_radec[0], bb.centre_radec[1], rb * Math.sin(pa), rb * Math.cos(pa));
      const sur = O.point_coquille(d, O.DONNEES.icrs_vers_gal);
      const r = O.norme(sur);
      arc.push(O.comb(d, (1 - u) * O.R0 + u * r, [0, 0, 0], 0));
    }
    const qa = arc.map((X) => O.projeter(cam, X)).filter((x): x is O.V3 => x !== null);
    if (qa.length > 1) {
      for (const [ep, al] of [[14, 0.08], [6, 0.16], [2, 0.32]] as const) {
        p.setPen({ couleur: new Couleur(232, 80, 104, al), epaisseur: ep, pointille: false, bout: 'round', jointure: 'round' });
        p.drawPolyline(qa.map((q) => new Pt(q[0], q[1])));
      }
      this.marque(p, qa[Math.floor(qa.length * 0.3)]!, 'orion:boucle_barnard', 10, 30);
    }
    // λ Orionis : bulle H II (lueur rouge) et anneau de poussière
    const lb = P.lambda_ori_bulle;
    const ql = this.proj(cam, lb.centre, u);
    if (ql) this.lueur(p, ql[0], ql[1], (cam.F * (lb.rayon_pc as number)) / ql[2], new Couleur(220, 70, 90), 0.16);
    const anneau = this.tube(p, cam, P.lambda_ori_anneau.points, P.lambda_ori_anneau.rayon_pc, u, new Couleur(150, 118, 96), 0.22);
    if (anneau.length) this.marque(p, anneau[Math.floor(anneau.length / 4)]!, 'orion:lambda_ori', 10, 31);
    // nuages moléculaires Orion A et B
    const oa = this.tube(p, cam, P.orion_a.points, P.orion_a.rayon_pc, u, new Couleur(120, 138, 178), 0.3);
    if (oa.length) this.marque(p, oa[Math.floor(oa.length * 0.6)]!, 'orion:orion_a', 10, 32);
    const ob = this.tube(p, cam, P.orion_b.points, P.orion_b.rayon_pc, u, new Couleur(120, 138, 178), 0.26);
    if (ob.length) this.marque(p, ob[Math.floor(ob.length / 2)]!, 'orion:orion_b', 10, 33);
    // M42 (lueur), IC 434 derrière la Tête de Cheval
    const m = this.proj(cam, P.m42_bol.sommet, u);
    if (m) {
      const r = Math.max(4, (cam.F * (P.m42_bol.rayon_pc as number)) / m[2]);
      const f = 1 - this.visibilite_image(cam, u, 'm42');
      this.lueur(p, m[0], m[1], r * 1.6, new Couleur(255, 110, 140), 0.45 * f);
      this.lueur(p, m[0], m[1], r * 0.5, new Couleur(130, 230, 220), 0.35 * (1 - s * 0.5) * f);
      this.marque(p, m, 'orion:m42', Math.max(6, r), 20);
    }
    const t = this.proj(cam, P.tete_de_cheval.centre, u);
    if (t) {
      const r = Math.max(3, (cam.F * 0.9) / t[2]);
      this.lueur(p, t[0], t[1] - r * 0.3, r * 2.2, new Couleur(230, 60, 80), 0.3 * (1 - this.visibilite_image(cam, u, 'tete_de_cheval')));
      this.marque(p, t, 'orion:tete_de_cheval', Math.max(5, (cam.F * 0.4) / t[2]), 21);
    }
  }

  /** Objet à fiche (et réservation pour les étiquettes). */
  private marque(p: Peintre, q: O.V3, fiche: string, r: number, ordre: number): void {
    this.survolable(p, fiche, q[0], q[1], Math.max(5, Math.min(40, r)), ordre);
  }

  /** Part (0–1) de l'image de l'objet qui est montrée (taille à l'écran) : les lueurs dessinées s'effacent devant elle. */
  private visibilite_image(cam: O.Camera, u: number, objet: string): number {
    if (!this.c_images.isChecked()) return 0;
    const t = O.DONNEES.textures.find((x) => x.objet === objet);
    if (!t) return 0;
    const P = O.DONNEES.primitives;
    const centre = objet === 'm42' ? P.m42_bol.sommet : P.tete_de_cheval.centre;
    const e = ((t.echelle_arcmin_px * t.taille_px[0]) / 60 / 2) * O.DEG;
    const a = this.proj(cam, O.comb(O.decaler(t.centre_radec[0], t.centre_radec[1], e, 0), O.norme(centre), [0, 0, 0], 0), u);
    const b = this.proj(cam, O.comb(O.decaler(t.centre_radec[0], t.centre_radec[1], -e, 0), O.norme(centre), [0, 0, 0], 0), u);
    if (!a || !b) return 0;
    return Math.max(0, Math.min(1, (Math.hypot(a[0] - b[0], a[1] - b[1]) - 24) / 60));
  }

  /** Images posées sur le ciel (plan perpendiculaire à la ligne de visée, à la distance de l'objet). */
  private textures(p: Peintre, cam: O.Camera, u: number, s: number, rect: Rect): void {
    const P = O.DONNEES.primitives;
    const choix = this.photo.currentData() === 'hubble' ? ['m42_hubble', 'tete_de_cheval_hubble_ir'] : ['m42_vst', 'tete_de_cheval_vlt'];
    for (const t of O.DONNEES.textures) {
      if (!choix.includes(t.id)) continue;
      const centre = t.objet === 'm42' ? P.m42_bol.sommet : P.tete_de_cheval.centre;
      const dist = O.norme(centre);
      const [w, h] = t.taille_px;
      const e = (t.echelle_arcmin_px / 60) * O.DEG;
      const [ra, dec] = t.centre_radec;
      const coin = (xi: number, eta: number): O.V3 | null => this.proj(cam, O.comb(O.decaler(ra, dec, xi, eta), dist, [0, 0, 0], 0), u);
      const hg = coin((w / 2) * e, (h / 2) * e);
      const hd = coin((-w / 2) * e, (h / 2) * e);
      const bg = coin((w / 2) * e, (-h / 2) * e);
      if (!hg || !hd || !bg) continue;
      const taille = Math.hypot(hd[0] - hg[0], hd[1] - hg[1]);
      if (!(taille > 24)) continue;
      // hors de la toile : rien
      const xs = [hg[0], hd[0], bg[0], hd[0] + bg[0] - hg[0]];
      const ys = [hg[1], hd[1], bg[1], hd[1] + bg[1] - hg[1]];
      if (Math.max(...xs) < rect.left || Math.min(...xs) > rect.right || Math.max(...ys) < rect.top || Math.min(...ys) > rect.bottom) continue;
      this.credits.push([`${tr('anim_orion3d_image')} ${t.credit} (${t.licence})`, t.page]);
      const img = texture(t.fichier, () => this.rafraichir());
      if (!img) continue;
      const ctx = p.ctx;
      ctx.save();
      ctx.globalAlpha = Math.max(0.35, 1 - 0.55 * s) * Math.min(1, (taille - 24) / 60);
      ctx.transform((hd[0] - hg[0]) / w, (hd[1] - hg[1]) / w, (bg[0] - hg[0]) / h, (bg[1] - hg[1]) / h, hg[0], hg[1]);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }
  }

  /** M42 de près : front d'ionisation en bol, couche émissive, Voile, à l'échelle (modèle en « blister »). */
  private m42_blister(p: Peintre, cam: O.Camera, u: number): void {
    const P = O.DONNEES.primitives;
    const b = P.m42_bol;
    const S = b.sommet as number[];
    const ax = O.unitaire(b.axe_vers_observateur);
    const R = b.rayon_pc as number;
    const q0 = this.proj(cam, S, u);
    const s = O.lisse(u);
    if (!q0 || (cam.F * R) / q0[2] < 40 || s < 0.05) return;
    // deux vecteurs du plan du front
    const e1 = O.unitaire(O.cross(ax, [0, 0, 1]));
    const e2 = O.cross(ax, e1);
    const anneau = (rr: number, dz: number): Pt[] => {
      const out: Pt[] = [];
      for (let k = 0; k <= 48; k++) {
        const a = (2 * Math.PI * k) / 48;
        const X = O.comb(O.comb(S, 1, e1, rr * Math.cos(a)), 1, O.comb(e2, rr * Math.sin(a), ax, dz), 1);
        const q = this.proj(cam, X, u);
        if (q) out.push(new Pt(q[0], q[1]));
      }
      return out;
    };
    // front d'ionisation : z(r) = −0,2 (1 − (r/R)²) pc par rapport au plan de θ¹ Ori C (Wen & O'Dell 1995)
    for (let i = 1; i <= 5; i++) {
      const rr = (R * i) / 5;
      const pts = anneau(rr, 0.2 * (rr / R) ** 2);
      if (pts.length > 2) {
        p.setPen({ couleur: new Couleur(255, 130, 150, 0.55 * s), epaisseur: 1.2, pointille: false });
        p.setBrush(null);
        p.drawPolyline(pts);
      }
    }
    // Voile : disque à ≈ 2 pc devant le Trapèze (O'Dell et al. 2009)
    const v = P.m42_voile;
    const voile = anneau(v.rayon_pc, O.dot(O.comb(v.centre, 1, S, -1), ax));
    if (voile.length > 2) {
      p.setPen({ couleur: new Couleur(170, 190, 230, 0.6 * s), epaisseur: 1.0, pointille: true });
      p.setBrush(new Couleur(120, 140, 200, 0.07 * s));
      p.drawPolygon(voile);
    }
  }

  private etoiles(p: Peintre, cam: O.Camera, u: number, s: number, rect: Rect): void {
    const brutes = this.c_brutes.isChecked();
    const pos = new Map<string, O.V3 | null>();
    for (const e of O.DONNEES.etoiles) pos.set(e.id, this.proj(cam, O.position_etoile(e, brutes), u));
    // lignes de visée (en 3D), du Soleil à chaque étoile de la figure
    const fig = new Set(O.DONNEES.figure.flat());
    const soleil = O.projeter(cam, [0, 0, 0]);
    if (s > 0.02 && soleil) {
      p.setPen({ couleur: new Couleur(200, 210, 230, 0.12 * s), epaisseur: 0.8, pointille: false });
      for (const id of fig) {
        const q = pos.get(id);
        if (q) p.drawLine(soleil[0], soleil[1], q[0], q[1]);
      }
    }
    if (this.c_figure.isChecked()) {
      p.setPen({ couleur: new Couleur(242, 193, 78, 0.55), epaisseur: 1.3, pointille: false, bout: 'round', jointure: 'round' });
      for (const l of O.DONNEES.figure) {
        for (let i = 0; i + 1 < l.length; i++) {
          const a = pos.get(l[i]!);
          const b = pos.get(l[i + 1]!);
          if (a && b) p.drawLine(a[0], a[1], b[0], b[1]);
        }
      }
    }
    const cible = this.k >= 0.5 ? this.vers : this.de;
    // barres d'erreur le long de la ligne de visée ; mesure brute d'une distance d'affichage en tirets
    if (this.c_barres.isChecked() && u > 0.02) {
      for (const e of O.DONNEES.etoiles) {
        if (!fig.has(e.id) && !e.id.startsWith('tet01')) continue;
        const d = O.direction(e.ra, e.dec);
        if (!brutes && e.xyz_affichage) {
          const a = pos.get(e.id);
          const b = this.proj(cam, e.xyz, u);
          if (a && b) {
            p.setPen({ couleur: new Couleur(124, 196, 232, 0.6 * s), epaisseur: 1.0, pointille: true });
            p.drawLine(a[0], a[1], b[0], b[1]);
            p.setBrush(null);
            p.drawEllipse(b[0], b[1], 2.5, 2.5);
          }
        } else if (e.d_moins !== null && e.d_plus !== null) {
          const a = this.proj(cam, O.comb(d, e.d - e.d_moins, [0, 0, 0], 0), u);
          const b = this.proj(cam, O.comb(d, e.d + e.d_plus, [0, 0, 0], 0), u);
          if (a && b) {
            p.setPen({ couleur: new Couleur(124, 196, 232, (cible === 'orion' ? 0.75 : 0.45) * s), epaisseur: cible === 'orion' ? 2.4 : 1.4, pointille: false, bout: 'round' });
            p.drawLine(a[0], a[1], b[0], b[1]);
          }
        }
      }
    }
    // étoiles, de la plus lointaine à la plus proche
    const zoom = cible !== 'orion' ? 1.25 : 1;
    const ordre = O.DONNEES.etoiles.filter((e) => pos.get(e.id)).sort((a, b) => pos.get(b.id)![2] - pos.get(a.id)![2]);
    const noms: [number, number, string][] = [];
    for (const e of ordre) {
      const q = pos.get(e.id)!;
      if (q[0] < rect.left - 20 || q[0] > rect.right + 20 || q[1] < rect.top - 20 || q[1] > rect.bottom + 20) continue;
      const r = rayon_disque(e.V, 0, 5.5, 1.3, 8) * zoom;
      const c = this.couleur(e);
      if (r > 2.2) this.lueur(p, q[0], q[1], r * 2.6, c, 0.22);
      p.setPen(null);
      p.setBrush(c);
      p.drawEllipse(q[0], q[1], r, r);
      if (r >= 2) dessin.reserver(p, q[0], q[1], r + 1);
      this.survolable(p, 'orion:' + e.id, q[0], q[1], Math.max(r, 5), e.V);
      if (this.c_noms.isChecked() && NOMMEES_ZOOM[cible].has(e.id)) {
        const txt = s > 0.5 ? `${this.nom(e)} ${nombre(this.distance(e), this.distance(e) < 10 ? 1 : 0)} pc` : this.nom(e);
        noms.push([q[0], q[1], txt]);
      }
    }
    // le Soleil (en 3D)
    if (soleil && s > 0.05 && rect.contains(new Pt(soleil[0], soleil[1]))) {
      dessin.disque(p, soleil[0], soleil[1], 4.5, 'soleil');
      noms.push([soleil[0], soleil[1], tr('anim_stellarlum_soleil')]);
    }
    dessin.police(p, 0.82);
    for (const [x, y, t] of noms) dessin.etiquette(p, x, y, t, 'texte', 7);
    // nébuleuses nommées
    if (this.c_noms.isChecked() && this.c_nebuleuses.isChecked()) {
      const P = O.DONNEES.primitives;
      const lieux: [number[], string][] = cible === 'orion'
        ? [[P.m42_bol.sommet, 'anim_orion3d_n_m42'], [P.tete_de_cheval.centre, 'anim_orion3d_n_tete'], [P.orion_a.points[11], 'anim_orion3d_n_orion_a'], [P.orion_b.points[45], 'anim_orion3d_n_orion_b'], [P.lambda_ori_anneau.points[12], 'anim_orion3d_n_lambda']]
        : cible === 'm42' ? [[P.m42_bol.sommet, 'anim_orion3d_n_m42']] : [[P.tete_de_cheval.centre, 'anim_orion3d_n_tete']];
      for (const [X, cle] of lieux) {
        const q = this.proj(cam, X, u);
        if (q && rect.contains(new Pt(q[0], q[1]))) dessin.etiquette(p, q[0], q[1], tr(cle), 'accent3', 9);
      }
      if (cible === 'orion') {
        const bb = P.boucle_barnard;
        const d = O.decaler(bb.centre_radec[0], bb.centre_radec[1], ((bb.diametre_deg as number) / 2) * O.DEG, 0);
        const X = O.comb(d, (1 - u) * O.R0 + u * O.norme(O.point_coquille(d, O.DONNEES.icrs_vers_gal)), [0, 0, 0], 0);
        const q = O.projeter(cam, X);
        if (q && rect.contains(new Pt(q[0], q[1]))) dessin.etiquette(p, q[0], q[1], tr('anim_orion3d_n_barnard'), 'accent3', 9);
      }
    }
    dessin.police(p, 1 / 0.82);
  }

  /** Échelle (en 3D), crédits des images, légende des couleurs. */
  private legendes(p: Peintre, cam: O.Camera, rect: Rect, s: number): void {
    dessin.police(p, 0.78);
    const fm = p.fontMetrics();
    let y = rect.bottom - 8;
    for (const [t] of [...this.credits].reverse()) {
      dessin.texte(p, rect.left + 8, y, t, 'doux', { centre: false, fond: true });
      y -= fm.height() + 4;
    }
    if (s > 0.3) {
      // barre d'échelle à la distance du pivot
      const cible = this.k >= 0.5 ? this.vers : this.de;
      const L = cible === 'orion' ? 100 : cible === 'm42' ? 2 : 1;
      const px = (cam.F * L) / cam.D;
      if (px > 12 && px < rect.w * 0.6) {
        const x1 = rect.right - 12;
        const yb = rect.top + 14;
        p.setPen(dessin.stylo('texte', 1.6));
        p.drawLine(x1 - px, yb, x1, yb);
        p.drawLine(x1 - px, yb - 4, x1 - px, yb + 4);
        p.drawLine(x1, yb - 4, x1, yb + 4);
        dessin.texte(p, x1 - px / 2, yb + 12, tr('anim_orion3d_barre', { l: nombre(L, 0) }), 'texte', { fond: true });
      }
    }
    dessin.texte(p, rect.right - 8 - fm.horizontalAdvance(tr('anim_orion3d_legende')), rect.bottom - 8, tr('anim_orion3d_legende'), 'doux', { centre: false, fond: true });
    dessin.police(p, 1 / 0.78);
  }
}
