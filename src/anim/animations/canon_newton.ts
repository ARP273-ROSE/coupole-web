/**
 * Le canon de Newton : l'expérience de pensée des Principia (Newton, 1687) — un canon au sommet d'une montagne tire de
 * plus en plus vite ; le boulet retombe de plus en plus loin, puis fait le tour de l'astre (satellisation), puis s'en
 * va pour toujours (libération).  Code, dessins et textes propres à Coupole.
 *
 * Mouvement intégré par src/calc/canon.ts (moteur de « Gravité et orbites » : Yoshida d'ordre 4, pas adaptatif ; air
 * en option, traînée et densité réelles).  Ergonomie : flèche à tirer (angle et vitesse d'un seul geste), repères v₁
 * et v₂ sur le curseur et autour du canon, trajectoire prévue en pointillés pendant le réglage, gros bouton « Feu ! »
 * et touche Espace, cadrage automatique qui suit le boulet (molette ou deux doigts pour zoomer, double-clic ou
 * « Recadrer » pour revenir), préréglages en un clic, tirs précédents gardés en couleurs avec leur légende, défis
 * vérifiés automatiquement.  Jumeau : canon_newton.py de Coupole (même rendu, mêmes valeurs au caractère près).
 */
import { tr } from '../../i18n/i18n';
import * as C from '../../calc/canon';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { Animation, type Bouton_souris, Bouton, type Choix, type Coche, nombre, type Reglage } from '../base';
import { sci } from './gravite_orbites';

/** couleurs des tirs successifs */
const COULEURS_TIRS = ['accent1', 'accent2', 'accent3', 'arc1', 'arc2', 'ecliptique', 'meridien', 'equateur'];
export const MAX_TIRS = 8;
const COULEUR_ASTRE: Record<string, string> = { terre: 'terre', lune: 'lune', mars: 'mars', ceres: 'lune', dimorphos: 'doux' };
/** longueur de la flèche à la vitesse maximale du curseur (fraction du plus petit côté du panneau) */
const FLECHE = 0.3;
const POINTS_TRACE = 700;
const G0 = 9.80665;

const deux = (n: number): string => String(n).padStart(2, '0');

/** Durée lisible : « 45 s », « 12 min 05 s », « 5 h 07 min », « 3,2 j ». */
export function duree(s: number): string {
  if (!Number.isFinite(s)) return '—';
  if (s < 60) return `${nombre(s, s < 10 ? 1 : 0)} s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    return `${m} min ${deux(Math.trunc(s - 60 * m))} s`;
  }
  if (s < 172800) {
    const h = Math.floor(s / 3600);
    return `${h} h ${deux(Math.trunc(Math.floor((s - 3600 * h) / 60)))} min`;
  }
  return `${nombre(s / 86400, 1)} ${tr('anim_newtoncannon_j')}`;
}

/** Période fine : minutes à deux décimales (jours au-delà de deux jours). */
export function periode(s: number | null): string {
  if (s === null || !Number.isFinite(s)) return '—';
  if (s < 172800) return `${nombre(s / 60, 2)} min`;
  return `${nombre(s / 86400, 3)} ${tr('anim_newtoncannon_j')}`;
}

/** Plus grande longueur 1, 2 ou 5 × 10ⁿ inférieure ou égale à x. */
function echelleNette(x: number): number {
  if (!(x > 0)) return 1.0;
  const e = Math.floor(Math.log10(x));
  const b = 10 ** e;
  for (const m of [5, 2, 1]) if (m * b <= x) return m * b;
  return b;
}

type TirA = C.Tir;

export class CanonNewton extends Animation {
  static override ID = 'newtoncannon';
  static override ZOOM_PROPRE = true;

  tirs: TirA[] = [];
  n_tirs = 0;
  /** cadrage manuel : px/m rapporté au plus petit côté, centre (m) ; null : automatique */
  manuel: { s: number; ox: number; oy: number } | null = null;
  cam = { cx: 0, cy: 0, s: 1, ox: 0, oy: 0, L: 1 };
  panneau = new Rect(0, 0, 1, 1);
  private apercu: { cle: string; pts: ([number, number] | null)[] } = { cle: '', pts: [] };
  private departPan: [number, number, number, number] = [0, 0, 0, 0];
  /** cadrage figé (flèche tenue) */
  fige = false;

  b_feu!: Bouton;
  c_temps!: Choix;
  c_astre!: Choix;
  r_alt: Record<string, Reglage> = {};
  r_vit: Record<string, Reglage> = {};
  r_angle!: Reglage;
  c_air!: Coche;
  c_projectile!: Choix;
  c_apercu!: Coche;
  c_defi!: Choix;

  override construire(): void {
    this.vitesse?.setVisible(false); // le temps se règle par « Temps » (×1 … ×1 000)
    this.b_feu = new Bouton('anim_newtoncannon_feu', 'barre', tr('anim_newtoncannon_feu'), () => this.feu(), tr('anim_newtoncannon_feu_aide'), true);
    this.controles.push(this.b_feu);
    this.c_temps = this.choix('temps', C.TEMPS.map((k) => [`anim_newtoncannon_t_${k}`, k]), 100);
    this.bouton('anim_newtoncannon_recommencer', () => this.recommencer());
    this.bouton('anim_newtoncannon_effacer', () => this.effacer());
    this.bouton('anim_newtoncannon_recadrer', () => this.recadrer());
    this.c_astre = this.choix('astre', C.NOMS_ASTRES.map((a) => [`anim_newtoncannon_a_${a}`, a]), 'terre');
    for (const a of C.NOMS_ASTRES) {
      const R = C.REGLAGES[a]!;
      this.r_alt[a] = this.curseur(`altitude_${a}`, R.amin, R.amax, R.a0, { dec: R.da, unite: R.na, log: true, cle_texte: 'anim_newtoncannon_altitude' });
    }
    for (const a of C.NOMS_ASTRES) {
      const R = C.REGLAGES[a]!;
      this.r_vit[a] = this.curseur(`vitesse_${a}`, 0.0, R.vmax, R.v0, { dec: R.dv, unite: R.nv, cle_texte: 'anim_newtoncannon_vitesse' });
    }
    this.r_angle = this.curseur('angle', -90.0, 90.0, 0.0, { dec: 1, unite: '°' });
    this.c_air = this.coche('air', false);
    this.c_projectile = this.choix('projectile', C.PROJECTILES.map((k) => [`anim_newtoncannon_p_${k}`, k]), 'boulet');
    this.c_apercu = this.coche('apercu', true);
    for (const nom of C.PREREGLAGES) this.bouton(`anim_newtoncannon_pr_${nom}`, () => this.prereglage(nom));
    this.c_defi = this.choix('defi', C.DEFIS.map((d) => [`anim_newtoncannon_d_${d}`, d]), 'aucun');
    this.c_astre.currentIndexChanged.connect(() => this.astreChange());
    this.c_defi.currentIndexChanged.connect(() => this.defiChange());
    this.c_air.toggled.connect(() => this.visibilites());
    for (const a of C.NOMS_ASTRES) this.r_alt[a]!.valueChanged.connect(() => this.reperes());
    this.visibilites();
    this.reperes();
  }

  // ------------------------------------------------------------ réglages
  astre(): string {
    return (this.c_astre.currentData() as string) || 'terre';
  }

  altitude_m(): number {
    const a = this.astre();
    return this.r_alt[a]!.value() * C.REGLAGES[a]!.ua;
  }

  vitesse_ms(): number {
    const a = this.astre();
    return this.r_vit[a]!.value() * C.REGLAGES[a]!.uv;
  }

  air(): boolean {
    return this.c_air.isChecked() && C.atmosphere(this.astre());
  }

  private visibilites(): void {
    const a = this.astre();
    for (const k of C.NOMS_ASTRES) {
      this.r_alt[k]!.setVisible(k === a);
      this.r_vit[k]!.setVisible(k === a);
    }
    this.c_air.setVisible(C.atmosphere(a));
    this.c_projectile.setVisible(this.air());
  }

  /** Repères v₁ et v₂ sous le curseur de vitesse de l'astre choisi (ils glissent avec l'altitude). */
  private reperes(): void {
    const a = this.astre();
    const A = C.ASTRES[a]!;
    const r0 = A.r + this.altitude_m();
    const uv = C.REGLAGES[a]!.uv;
    this.r_vit[a]!.poser_reperes([
      [C.v_satellisation(A.gm, r0) / uv, 'v₁', 'accent2'],
      [C.v_liberation(A.gm, r0) / uv, 'v₂', 'accent3'],
    ]);
  }

  private astreChange(): void {
    const a = this.astre();
    this.tirs = [];
    this.manuel = null;
    this.arreter();
    this.c_temps.setCurrentIndex(Math.max(0, this.c_temps.findData(C.REGLAGES[a]!.temps)));
    this.visibilites();
    this.reperes();
  }

  private defiChange(): void {
    const ctx = C.contexte_defi((this.c_defi.currentData() as string) || 'aucun');
    if (!ctx) {
      this.rafraichir();
      return;
    }
    this.c_astre.setCurrentIndex(Math.max(0, this.c_astre.findData(ctx.astre)));
    const a = ctx.astre;
    this.r_alt[a]!.setValue(ctx.altitude / C.REGLAGES[a]!.ua);
    this.c_air.setChecked(ctx.air);
    this.c_projectile.setCurrentIndex(Math.max(0, this.c_projectile.findData(ctx.projectile)));
    this.tirs = [];
    this.manuel = null;
    this.visibilites();
    this.reperes();
    this.rafraichir();
  }

  /** Applique un préréglage (astre, altitude, vitesse, angle, air) et tire aussitôt. */
  prereglage(nom: string): void {
    const p = C.prereglage(nom, this.astre());
    if (p.astre !== this.astre()) this.c_astre.setCurrentIndex(Math.max(0, this.c_astre.findData(p.astre)));
    const a = p.astre;
    const R = C.REGLAGES[a]!;
    this.r_alt[a]!.setValue(p.altitude / R.ua);
    this.r_vit[a]!.setValue(p.v / R.uv);
    this.r_angle.setValue(p.angle);
    this.c_air.setChecked(p.air);
    this.c_projectile.setCurrentIndex(Math.max(0, this.c_projectile.findData(p.projectile)));
    this.visibilites();
    this.reperes();
    this.feu();
  }

  override etat_initial(): void {
    this.tirs = [];
    this.n_tirs = 0;
    this.manuel = null;
    this.visibilites();
    this.reperes();
  }

  // ------------------------------------------------------------ tirs
  feu(): void {
    this.n_tirs += 1;
    const t = new C.Tir(this.n_tirs, this.astre(), this.altitude_m(), this.vitesse_ms(), this.r_angle.value(), this.air(), (this.c_projectile.currentData() as string) || 'boulet');
    t.couleur = COULEURS_TIRS[(this.n_tirs - 1) % COULEURS_TIRS.length]!;
    this.tirs.push(t);
    if (this.tirs.length > MAX_TIRS) this.tirs.shift();
    if (!this.en_lecture) this.basculer_lecture();
    this.rafraichir();
  }

  recommencer(): void {
    const d = this.tirs[this.tirs.length - 1];
    if (!d) {
      this.feu();
      return;
    }
    const t = new C.Tir(d.n, d.astre, d.altitude, d.v, d.angle, d.air, d.projectile);
    t.couleur = d.couleur;
    this.tirs[this.tirs.length - 1] = t;
    if (!this.en_lecture) this.basculer_lecture();
    this.rafraichir();
  }

  effacer(): void {
    this.tirs = [];
    this.rafraichir();
  }

  recadrer(): void {
    this.manuel = null;
    this.rafraichir();
  }

  courant(): TirA | null {
    return this.tirs[this.tirs.length - 1] ?? null;
  }

  override avancer(dt: number): void {
    const t = this.courant();
    if (!t || t.etat !== 'vol') return;
    t.avancer(dt * Number(this.c_temps.currentData() ?? 100));
  }

  // ------------------------------------------------------------ souris et clavier
  versEcran(x: number, y: number): [number, number] {
    const v = this.cam;
    return [v.cx + (x - v.ox) * v.s, v.cy - (y - v.oy) * v.s];
  }

  versMonde(X: number, Y: number): [number, number] {
    const v = this.cam;
    return [v.ox + (X - v.cx) / v.s, v.oy - (Y - v.cy) / v.s];
  }

  /** Pixels par m·s⁻¹ de la flèche. */
  kFleche(): number {
    const R = C.REGLAGES[this.astre()]!;
    return (FLECHE * this.cam.L) / (R.vmax * R.uv);
  }

  bouche(): [number, number] {
    const A = C.ASTRES[this.astre()]!;
    return this.versEcran(0.0, A.r + this.altitude_m());
  }

  bout(): [number, number] {
    const [X, Y] = this.bouche();
    const L = this.vitesse_ms() * this.kFleche();
    const a = (this.r_angle.value() * Math.PI) / 180;
    return [X + L * Math.cos(a), Y - L * Math.sin(a)];
  }

  /** Bout de la flèche (vitesse et angle) puis bouche du canon. */
  override poignees(): [number, number][] {
    return [this.bout(), this.bouche()];
  }

  override presser(pos: Pt, _b: Bouton_souris): boolean {
    const [tx, ty] = this.bout();
    const [X, Y] = this.bouche();
    if (Math.hypot(pos.x - tx, pos.y - ty) <= 20 || Math.hypot(pos.x - X, pos.y - Y) <= 14) {
      // vue figée pendant qu'on tire la flèche (sinon le cadrage suivrait la trajectoire prévue et la flèche fuirait)
      this.fige = true;
      this._glisse = (q) => this.tirerFleche(q);
      return true;
    }
    if (this.manuel) {
      this.departPan = [pos.x, pos.y, this.manuel.ox, this.manuel.oy];
      this._glisse = (q) => this.deplacerVue(q);
      return true;
    }
    return false;
  }

  private tirerFleche(q: Pt): void {
    const [X, Y] = this.bouche();
    const dx = q.x - X,
      dy = -(q.y - Y);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const a = this.astre();
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (Math.abs(ang) <= 1.5) ang = 0.0; // aimanté à l'horizontale (le tir de Newton)
    this.r_angle.setValue(Math.max(-90.0, Math.min(90.0, ang)));
    this.r_vit[a]!.setValue(this.r_vit[a]!.aimanter(Math.hypot(dx, dy) / this.kFleche() / C.REGLAGES[a]!.uv));
  }

  override relacher(pos: Pt): void {
    super.relacher(pos);
    if (this.fige) {
      this.fige = false;
      this.rafraichir();
    }
  }

  private deplacerVue(q: Pt): void {
    const [x0, y0, ox, oy] = this.departPan;
    const s = this.cam.s;
    if (this.manuel && s > 0) {
      this.manuel.ox = ox - (q.x - x0) / s;
      this.manuel.oy = oy + (q.y - y0) / s;
    }
  }

  /** Zoom de f autour du point (X, Y) de la toile : le cadrage devient manuel. */
  override zoomer_vue(f: number, pos: Pt): boolean {
    if (!(Number.isFinite(f) && f > 0)) return false;
    const v = this.cam;
    const [x, y] = this.versMonde(pos.x, pos.y);
    const s = Math.max(1e-12, v.s * f);
    this.manuel = { s: s / v.L, ox: x - (pos.x - v.cx) / s, oy: y + (pos.y - v.cy) / s };
    this.rafraichir();
    return true;
  }

  override doubleClic(_pos: Pt): boolean {
    this.recadrer();
    return true;
  }

  override touche(key: string, maj: boolean): boolean {
    const a = this.astre();
    if (key === ' ' || key === 'Enter') this.feu();
    else if (key === 'ArrowUp' || key === 'ArrowDown') {
      const r = this.r_vit[a]!;
      const pas = ((maj ? 5 : 1) * C.REGLAGES[a]!.vmax) / 200;
      r.setValue(r.value() + (key === 'ArrowUp' ? pas : -pas));
    } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const pas = maj ? 5.0 : 1.0;
      this.r_angle.setValue(this.r_angle.value() + (key === 'ArrowLeft' ? pas : -pas));
    } else if (key === '0') this.recadrer();
    else return false;
    return true;
  }

  // ------------------------------------------------------------ valeurs
  private dist(m: number): string {
    const R = C.REGLAGES[this.astre()]!;
    if (R.na === 'm') return `${nombre(m, Math.abs(m) >= 100 ? 0 : 1)} m`;
    const km = m / 1000;
    return `${nombre(km, Math.abs(km) >= 100 ? 0 : 1)} km`;
  }

  private vit(v: number, a: string | null = null): string {
    const R = C.REGLAGES[a ?? this.astre()]!;
    return `${nombre(v / R.uv, R.dv)} ${R.nv}`;
  }

  private energie(e: number): string {
    const a = this.astre();
    const [f, u] = a === 'ceres' ? [1e3, 'kJ·kg⁻¹'] : a === 'dimorphos' ? [1e-3, 'mJ·kg⁻¹'] : [1e6, 'MJ·kg⁻¹'];
    return `${nombre(e / f, 2)} ${u}`;
  }

  private tirRegle(): [[number, number], C.Elements] {
    const A = C.ASTRES[this.astre()]!;
    const [x, y, vx, vy] = C.etat_tir(A.r, this.altitude_m(), this.vitesse_ms(), this.r_angle.value());
    return [[x, y], C.elements(A.gm, A.r, x, y, vx, vy)];
  }

  override valeurs(): [string, string][] {
    const a = this.astre();
    const A = C.ASTRES[a]!;
    const r0 = A.r + this.altitude_m();
    const v1 = C.v_satellisation(A.gm, r0),
      v2 = C.v_liberation(A.gm, r0);
    const v = this.vitesse_ms();
    const out: [string, string][] = [
      [tr('anim_newtoncannon_v_reperes'), tr('anim_newtoncannon_v_reperes_val', { v1: this.vit(v1), v2: this.vit(v2) })],
      [tr('anim_newtoncannon_v_tir'), tr('anim_newtoncannon_v_tir_val', { v: this.vit(v), k1: nombre(v / v1, 2), k2: nombre(v / v2, 2), a: nombre(this.r_angle.value(), 1) + '°' })],
    ];
    const [, el] = this.tirRegle();
    out.push([tr('anim_newtoncannon_v_trajectoire'), tr('anim_newtoncannon_v_type_val', { t: tr(`anim_newtoncannon_ty_${el.type}`), e: nombre(el.e, 3) })]);
    const hp = el.rp - A.r;
    const pTxt = hp >= 0 ? this.dist(hp) : tr('anim_newtoncannon_sous_sol', { h: this.dist(hp) });
    const aTxt = Number.isFinite(el.ra) ? this.dist(el.ra - A.r) : tr('anim_newtoncannon_infini');
    out.push([tr('anim_newtoncannon_v_apsides'), `${pTxt} · ${aTxt}`]);
    if (el.type === 'cercle' || el.type === 'ellipse') out.push([tr('anim_newtoncannon_v_periode'), `${periode(el.T)} (${duree(el.T)})`]);
    out.push([tr('anim_newtoncannon_v_energie'), tr(el.eps < 0 ? 'anim_newtoncannon_lie' : 'anim_newtoncannon_libre', { e: this.energie(el.eps) })]);
    const t = this.courant();
    if (t) {
      out.push([tr('anim_newtoncannon_v_tir_n', { n: t.n }), this.bilan(t)]);
      if (t.air && t.etat === 'vol') {
        const fr = t.freinage();
        const b = t.boulet;
        const rho = C.densite(t.astre, Math.sqrt(b.x * b.x + b.y * b.y) - t.R);
        out.push([tr('anim_newtoncannon_v_freinage'), tr('anim_newtoncannon_freinage_val', { a: `${nombre(fr, 2)} m·s⁻²`, g: nombre(fr / G0, 2), r: this.densiteTxt(rho) })]);
      }
    }
    const d = (this.c_defi.currentData() as string) || 'aucun';
    if (d !== 'aucun') out.push([tr('anim_newtoncannon_v_defi'), `${tr(`anim_newtoncannon_de_${d}`)} — ${this.verdict(d, t)[1]}`]);
    return out;
  }

  private densiteTxt(rho: number): string {
    return `${rho > 0 ? sci(rho, 3) : nombre(0, 0)} kg·m⁻³`;
  }

  private bilan(t: TirA): string {
    if (t.etat === 'impact') return tr('anim_newtoncannon_impact', { t: duree(t.t), d: this.dist(t.distance_sol()), a: nombre(t.angle_balaye_deg(), 1) + '°' });
    if (t.etat === 'libere') return tr('anim_newtoncannon_libere', { d: this.dist(t.rayon()), t: duree(t.t) });
    const h = this.dist(t.rayon() - t.R);
    if (t.tours() >= 1) return tr('anim_newtoncannon_en_orbite', { n: t.tours(), T: periode(t.periode()), Tk: periode(t.el0.T), h });
    return tr('anim_newtoncannon_en_vol', { t: duree(t.t), h, v: this.vit(t.vitesse(), t.astre) });
  }

  /** [état, texte] du défi en cours pour le dernier tir. */
  verdict(d: string | null = null, t: TirA | null | undefined = undefined): [string, string] {
    const nom = d ?? ((this.c_defi.currentData() as string) || 'aucun');
    const tir = t === undefined ? this.courant() : t;
    if (!tir) return ['attente', tr('anim_newtoncannon_ve_a_tirer')];
    const [etat, cle, p] = C.juger(nom, tir);
    if (etat === 'aucun') return [etat, ''];
    const q: Record<string, string> = {};
    for (const [k, x] of Object.entries(p)) {
      if (k === 'e') q[k] = nombre(x, 3);
      else if (k === 'p') q[k] = nombre(x, 1);
      else if (k === 'h') q[k] = this.dist(x);
      else if (k === 'd') q[k] = nombre(x, 1) + '°';
    }
    if (etat === 'reussi') return [etat, tr('anim_newtoncannon_ve_reussi', { d: tr(`anim_newtoncannon_ve_${cle}`, q) })];
    return [etat, tr(`anim_newtoncannon_ve_${cle}`, q)];
  }

  // ------------------------------------------------------------ cadrage
  private apercuPts(): ([number, number] | null)[] {
    const A = C.ASTRES[this.astre()]!;
    const cle = [this.astre(), this.altitude_m(), this.vitesse_ms(), this.r_angle.value()].join('|');
    if (this.apercu.cle !== cle) {
      const [[x, y], el] = this.tirRegle();
      this.apercu = { cle, pts: C.conique(el, x, y, A.r, 4 * el.r) };
    }
    return this.apercu.pts;
  }

  private cadrer(r: Rect): void {
    const A = C.ASTRES[this.astre()]!;
    const R = A.r;
    const L = Math.min(r.w, r.h);
    if (this.fige && this.cam.L === L) return;
    this.cam.L = L;
    this.cam.cx = r.cx;
    this.cam.cy = r.cy;
    if (this.manuel) {
      this.cam.s = this.manuel.s * L;
      this.cam.ox = this.manuel.ox;
      this.cam.oy = this.manuel.oy;
      return;
    }
    // bande du haut laissée à la légende des tirs (et au temps écoulé)
    const hautL = this.tirs.length ? Math.min(0.25 * r.h, 18.0 + 15.0 * this.tirs.length) : 0.0;
    this.cam.cy = r.cy + hautL / 2;
    const r0 = R + this.altitude_m();
    let x0 = -R,
      x1 = R,
      y0 = -R,
      y1 = Math.max(R, r0);
    const pts: [number, number][] = this.c_apercu.isChecked() ? this.apercuPts().filter((q): q is [number, number] => q !== null) : [];
    const t = this.courant();
    if (t && t.astre === this.astre()) {
      const n = t.x.length;
      const pas = Math.max(1, Math.floor(n / 400));
      for (let i = 0; i < n; i += pas) pts.push([t.x[i]!, t.y[i]!]);
      const b = t.boulet;
      pts.push([b.x, b.y]);
    }
    for (const [x, y] of pts) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    const s = Math.min((0.9 * r.w) / (x1 - x0), (0.88 * (r.h - hautL)) / (y1 - y0));
    this.cam.s = s;
    this.cam.ox = (x0 + x1) / 2;
    this.cam.oy = (y0 + y1) / 2;
    // la flèche reste dans le panneau (sa longueur est en pixels)
    const [tx, ty] = this.bout();
    const [, Y] = this.bouche();
    let dy = 0.0;
    const haut = Math.min(ty, Y) - (r.top + 14);
    if (haut < 0) dy = haut;
    const bas = Math.max(ty, Y) - (r.bottom - 14);
    if (bas > 0 && dy === 0) dy = bas;
    let dx = 0.0;
    if (tx > r.right - 14) dx = tx - (r.right - 14);
    else if (tx < r.left + 14) dx = tx - (r.left + 14);
    this.cam.ox += dx / s;
    this.cam.oy -= dy / s;
  }

  // ------------------------------------------------------------ dessin
  override dessiner(p: Peintre, rect: Rect): void {
    const a = this.astre();
    const A = C.ASTRES[a]!;
    const r = dessin.cadre(p, rect, tr('anim_newtoncannon_titre', { a: tr(`anim_newtoncannon_a_${a}`) }));
    this.panneau = r.copie();
    this.cadrer(r);
    const s = this.cam.s;
    p.save();
    p.setClipRect(r);
    const [cx, cy] = this.versEcran(0.0, 0.0);
    const R = A.r * s;
    if (this.air()) {
      const ep = (a === 'terre' ? C.KARMAN : 10 * C.H_MARS) * s;
      if (ep >= 1.5) {
        p.setPen(null);
        p.setBrush(dessin.c('ciel', 0.45));
        p.drawEllipse(cx, cy, R + ep, R + ep);
      }
    }
    dessin.astre(p, cx, cy, Math.max(R, 2.0), COULEUR_ASTRE[a]!);
    this.montagne(p);
    for (const t of this.tirs) this.trace(p, t);
    if (this.c_apercu.isChecked()) this.dessinerApercu(p);
    this.canon(p);
    for (const t of this.tirs) this.boulet(p, t);
    p.restore();
    this.legende(p, r);
    this.echelle(p, r);
    this.bandeau(p, r);
  }

  private montagne(p: Peintre): void {
    const A = C.ASTRES[this.astre()]!;
    const R = A.r;
    const h = this.altitude_m();
    const s = this.cam.s;
    let demi = Math.max(1.1 * h, 9.0 / s) / R;
    demi = Math.min(demi, 0.6);
    const [X, Y] = this.versEcran(0.0, R + h);
    const pts = [new Pt(X, Y)];
    for (let k = 0; k < 9; k++) {
      const u = demi - (2 * demi * k) / 8;
      const [x, y] = this.versEcran(-R * Math.sin(u), R * Math.cos(u));
      pts.push(new Pt(x, y));
    }
    p.setPen(dessin.stylo('horizon', 1.2));
    p.setBrush(dessin.c('sol', 0.9));
    p.drawPolygon(pts);
  }

  private canon(p: Peintre): void {
    const [X, Y] = this.bouche();
    const ang = (this.r_angle.value() * Math.PI) / 180;
    const ux = Math.cos(ang),
      uy = -Math.sin(ang);
    p.setPen(dessin.stylo('texte', 5.0));
    p.drawLine(X - 4 * ux, Y - 4 * uy, X + 12 * ux, Y + 12 * uy);
    p.setPen(dessin.stylo('texte', 1.2));
    p.setBrush(dessin.c('fond'));
    p.drawEllipse(X - 2 * ux, Y + 4, 3.5, 3.5);
    const A = C.ASTRES[this.astre()]!;
    const r0 = A.r + this.altitude_m();
    const k = this.kFleche();
    for (const [v, cle, txt] of [
      [C.v_satellisation(A.gm, r0), 'accent2', 'anim_newtoncannon_v1'],
      [C.v_liberation(A.gm, r0), 'accent3', 'anim_newtoncannon_v2'],
    ] as [number, string, string][]) {
      const rr = v * k;
      p.setPen(dessin.stylo(cle, 1.2, 0.8, true));
      p.setBrush(null);
      p.drawArc(new Rect(X - rr, Y - rr, 2 * rr, 2 * rr), -20 * 16, 220 * 16);
      // étiquette sur l'arc, au premier endroit qui tient dans le panneau
      dessin.police(p, 0.82);
      const w = p.fontMetrics().horizontalAdvance(tr(txt)) / 2 + 6;
      const hh = p.fontMetrics().height();
      const pr = this.panneau;
      for (const deg of [55, 125, 90, 20, 160, -15]) {
        const ex = X + rr * Math.cos((deg * Math.PI) / 180),
          ey = Y - rr * Math.sin((deg * Math.PI) / 180);
        if (pr.left + w <= ex && ex <= pr.right - w && pr.top + hh <= ey && ey <= pr.bottom - hh) {
          dessin.texte(p, ex, ey, tr(txt), cle, { fond: true });
          break;
        }
      }
      dessin.police(p, 1 / 0.82);
    }
    const [tx, ty] = this.bout();
    if (Math.hypot(tx - X, ty - Y) > 3) dessin.fleche(p, X, Y, tx, ty, dessin.stylo('horizon', 2.6), 10);
    p.setPen(dessin.stylo('horizon', 1.6));
    p.setBrush(dessin.c('horizon', 0.3));
    p.drawEllipse(tx, ty, 7, 7);
    dessin.reserver(p, tx, ty, 8, true);
  }

  private dessinerApercu(p: Peintre): void {
    p.setPen(dessin.stylo('doux', 1.3, 0.9, true));
    p.setBrush(null);
    // null : coupure (ellipse sortie du cadre, puis retour)
    let morceau: Pt[] = [];
    for (const q of [...this.apercuPts(), null]) {
      if (q !== null) {
        const [X, Y] = this.versEcran(q[0], q[1]);
        morceau.push(new Pt(X, Y));
        continue;
      }
      if (morceau.length >= 2) p.drawPolyline(morceau);
      morceau = [];
    }
  }

  private trace(p: Peintre, t: TirA): void {
    if (t.astre !== this.astre() || t.x.length < 1) return;
    const n = t.x.length;
    const pas = Math.max(1, Math.ceil(n / POINTS_TRACE));
    const xs: number[] = [],
      ys: number[] = [];
    const ajouter = (x: number, y: number): void => {
      const [X, Y] = this.versEcran(x, y);
      xs.push(X);
      ys.push(Y);
    };
    let dernier = -1;
    for (let i = 0; i < n; i += pas) {
      ajouter(t.x[i]!, t.y[i]!);
      dernier = i;
    }
    if (dernier !== n - 1) ajouter(t.x[n - 1]!, t.y[n - 1]!);
    const b = t.boulet;
    if (t.etat === 'vol') ajouter(b.x, b.y);
    const courant = t === this.courant();
    p.setPen(dessin.stylo(t.couleur, courant ? 2.0 : 1.4, courant ? 1.0 : 0.75));
    p.setBrush(null);
    p.drawPolyline([xs, ys]);
  }

  private boulet(p: Peintre, t: TirA): void {
    if (t.astre !== this.astre()) return;
    const b = t.boulet;
    const [X, Y] = this.versEcran(b.x, b.y);
    if (t.etat === 'impact') {
      p.setPen(dessin.stylo(t.couleur, 2.0));
      for (const [dx, dy] of [[5, 5], [5, -5]] as [number, number][]) p.drawLine(X - dx, Y - dy, X + dx, Y + dy);
    } else dessin.disque(p, X, Y, t === this.courant() ? 4.5 : 3.0, t.couleur, 'fond');
  }

  private legende(p: Peintre, r: Rect): void {
    if (!this.tirs.length) return;
    dessin.police(p, 0.85);
    const fm = p.fontMetrics();
    let y = r.top + 4 + fm.ascent();
    // cartouche sous la légende : les arcs et les traces passent dessous sans gêner la lecture
    const larg = Math.max(...this.tirs.map((t) => fm.horizontalAdvance(tr('anim_newtoncannon_legende', { n: t.n, v: this.vit(t.v, t.astre), a: nombre(t.angle, 1) + '°' }))));
    p.setPen(null);
    p.setBrush(dessin.c('fond', 0.78));
    p.drawRoundedRect(new Rect(r.left + 1, r.top + 2, larg + 26, fm.height() * this.tirs.length + 4), 4, 4);
    for (const t of this.tirs) {
      const s = tr('anim_newtoncannon_legende', { n: t.n, v: this.vit(t.v, t.astre), a: nombre(t.angle, 1) + '°' });
      p.setPen(null);
      p.setBrush(dessin.c(t.couleur));
      p.drawRoundedRect(new Rect(r.left + 4, y - fm.ascent() + 2, 12, fm.ascent() - 2), 2, 2);
      dessin.texte(p, r.left + 20, y, s, t.astre === this.astre() ? 'texte' : 'doux', { centre: false });
      y += fm.height();
    }
    dessin.police(p, 1 / 0.85);
  }

  private echelle(p: Peintre, r: Rect): void {
    const s = this.cam.s;
    const lg = echelleNette((0.22 * r.w) / s);
    const w = lg * s;
    const x0 = r.left + 10,
      y0 = r.bottom - 10;
    p.setPen(dessin.stylo('texte', 1.6));
    p.drawLine(x0, y0, x0 + w, y0);
    p.drawLine(x0, y0 - 4, x0, y0 + 1);
    p.drawLine(x0 + w, y0 - 4, x0 + w, y0 + 1);
    dessin.police(p, 0.85);
    dessin.texte(p, x0 + w + 6, y0 + 4, this.dist(lg), 'texte', { centre: false });
    dessin.police(p, 1 / 0.85);
  }

  private bandeau(p: Peintre, r: Rect): void {
    const t = this.courant();
    dessin.police(p, 0.9);
    if (t) {
      const k = Number(this.c_temps.currentData() ?? 100);
      const s = tr('anim_newtoncannon_temps_ecoule', { t: duree(t.t), k: '×' + nombre(k, 0) });
      const w = p.fontMetrics().horizontalAdvance(s);
      dessin.texte(p, r.right - w - 6, r.top + 12, s, 'texte', { centre: false, fond: true });
    }
    const d = (this.c_defi.currentData() as string) || 'aucun';
    if (d !== 'aucun') {
      const [etat] = this.verdict(d, t);
      if (etat === 'reussi' || etat === 'echec') {
        const cle = etat === 'reussi' ? 'horizon' : 'accent3';
        const titre = tr(etat === 'reussi' ? 'anim_newtoncannon_reussi' : 'anim_newtoncannon_rate');
        dessin.police(p, 1.15, true);
        dessin.texte(p, r.cx, r.bottom - 34, titre, cle, { fond: true });
        dessin.police(p, 1 / 1.15);
      }
    }
    dessin.police(p, 1 / 0.9);
  }
}
