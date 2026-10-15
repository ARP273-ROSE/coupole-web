/**
 * Gravité et orbites : d'après la simulation PhET « Gravity and Orbits » (PhET Interactive Simulations, University of
 * Colorado Boulder, https://phet.colorado.edu) — idée et fonctions reprises ; code, dessins et textes propres à Coupole
 * (aucune partie de PhET).  Le Soleil, la Terre, la Lune, la station spatiale (et une comète) en gravitation
 * newtonienne, intégrés par src/calc/gravite.ts (Yoshida d'ordre 4, pas adaptatif, constantes officielles).
 *
 * Deux vues : « Modèle » (astres agrandis, distance Terre–Lune agrandie, pour lire) et « À l'échelle » (tailles et
 * distances vraies : vus du Soleil, la Terre et la Lune ne font qu'un point), avec un passage en douceur de l'une à
 * l'autre (rayons et écart Terre–Lune interpolés en logarithme).  Flèches de force (bleues) et de vitesse (vertes),
 * trajectoires, grille avec échelle, ruban de mesure, gravité coupable, masses, astres déplaçables, vitesses à tirer,
 * temps en jours terrestres, pas à pas et retour, périodes mesurées comparées aux vraies, énergie et moment cinétique,
 * et la trajectoire de la Lune vue du Soleil (toujours tournée vers lui).  Jumeau : gravite_orbites.py de Coupole.
 */
import { tr } from '../../i18n/i18n';
import * as g from '../../calc/gravite';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { fixe } from '../../noyau/py';
import { Animation, type Bouton_souris, type Choix, type Coche, nombre, type Reglage } from '../base';

type Sc = g.Scenario;

interface Conf {
  /** distance caractéristique (m) : elle occupe 0,44 × le plus petit côté */
  D: number;
  /** centre de la vue (m, sur l'axe x) */
  ox: number;
  /** secondes simulées par seconde (vitesse 1×) */
  rythme: number;
  pasTrace: number;
  maxTrace: number;
  /** rayon dessiné en vue « Modèle », en fraction de la demi-largeur de vue */
  rmod: Record<string, number>;
  /** corps de référence (échelles des flèches, ruban) */
  ref: string;
  /** distances en ua (sinon en km) */
  ua: boolean;
}

const UA = g.UA;
const CONF: Record<Sc, Conf> = {
  soleil_terre: { D: UA, ox: 0, rythme: 10 * g.JOUR, pasTrace: 0.5 * g.JOUR, maxTrace: 1500, rmod: { soleil: 0.14, terre: 0.055 }, ref: 'terre', ua: true },
  soleil_terre_lune: { D: UA, ox: 0, rythme: 5 * g.JOUR, pasTrace: 0.05 * g.JOUR, maxTrace: 8000, rmod: { soleil: 0.14, terre: 0.055, lune: 0.028 }, ref: 'terre', ua: true },
  terre_lune: { D: g.A_LUNE, ox: 0, rythme: g.JOUR, pasTrace: 0.02 * g.JOUR, maxTrace: 3000, rmod: { terre: 0.16, lune: 0.06 }, ref: 'lune', ua: false },
  terre_iss: { D: g.RAYONS.terre! + g.ALT_ISS, ox: 0, rythme: 180, pasTrace: 10, maxTrace: 1500, rmod: { terre: g.RAYONS.terre! / (g.RAYONS.terre! + g.ALT_ISS), iss: 0.06 }, ref: 'iss', ua: false },
  libre: { D: 1.6 * UA, ox: 0.9 * UA, rythme: 10 * g.JOUR, pasTrace: 0.1 * g.JOUR, maxTrace: 8000, rmod: { soleil: 0.1, terre: 0.045, lune: 0.024, comete: 0.03 }, ref: 'terre', ua: true },
};
/** écart Terre–Lune dessiné en vue « Modèle » : ECART_LUNE ua (agrandi ×78) */
const ECART_LUNE = 0.2;
/** couleurs des corps */
const COULEUR: Record<string, string> = { soleil: 'soleil', terre: 'terre', lune: 'lune', iss: 'texte', comete: 'accent2' };
/** points dessinés au plus par trace (encart : 240) ; traits de 1 px (voie rapide de Qt au bureau) */
const MAX_POINTS = 600;
/** durée du passage d'une vue à l'autre (s) */
const DUREE_TRANSITION = 0.9;

/** √(x² + y²) calculé comme au bureau (Math.hypot et math.hypot n'arrondissent pas pareil). */
function norme(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/** x en écriture scientifique (« 2,65 × 10³³ »), mêmes arrondis que nombre(). */
export function sci(x: number, chiffres = 3): string {
  if (x === 0 || !Number.isFinite(x)) return nombre(x, 0);
  let e = Math.floor(Math.log10(Math.abs(x)));
  const mant = (k: number): number => (k >= 0 ? x / 10 ** k : x * 10 ** -k);
  let m = mant(e);
  if (Number(fixe(Math.abs(m), chiffres - 1)) >= 10) {
    e += 1;
    m = mant(e);
  }
  const t = nombre(m, chiffres - 1);
  if (e === 0) return t;
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const ex = (e < 0 ? '⁻' : '') + [...String(Math.abs(e))].map((ch) => SUP[Number(ch)]).join('');
  return `${t} × 10${ex}`;
}

export class GraviteOrbites extends Animation {
  static override ID = 'gravityorbits';

  c_scenario!: Choix;
  c_mode!: Choix;
  m_soleil!: Reglage;
  m_terre!: Reglage;
  m_lune!: Reglage;
  c_force!: Coche;
  c_vitesse!: Coche;
  c_traces!: Coche;
  c_grille!: Coche;
  c_ruban!: Coche;
  c_gravite!: Coche;
  c_lune_soleil!: Coche;

  sys = new g.Systeme();
  sc: Sc = 'soleil_terre';
  /** état au dernier départ (« Retour ») */
  depart: { corps: g.Corps[]; t: number } | null = null;
  /** 1 : vue « Modèle », 0 : « À l'échelle » ; tCible : vue visée (passage en douceur) */
  tMode = 1;
  tCible = 1;
  private transitionEnCours = false;
  /** échelles des flèches : px par newton (propre à chaque corps), px par m·s⁻¹ (commune), en fraction de L */
  kF: number[] = [];
  kV = 0;
  /** ruban de mesure : ses deux bouts (m) */
  ruban: [number, number, number, number] = [0, 0, 0, 0];
  /** un objet est tenu (le temps est suspendu) */
  saisi = false;
  /** vue de la dernière image (souris) */
  private cam = { cx: 0, cy: 0, s: 1, L: 1, ox: 0 };

  override construire(): void {
    this.c_scenario = this.choix('scenario', g.SCENARIOS.map((s) => [`anim_gravityorbits_sc_${s}`, s]), 'soleil_terre');
    this.c_mode = this.choix('mode', [['anim_gravityorbits_mode_modele', 'modele'], ['anim_gravityorbits_mode_echelle', 'echelle']], 'modele');
    this.m_soleil = this.curseur('masse_soleil', 0.5, 2.0, 1.0, { dec: 2, unite: 'M☉' });
    this.m_terre = this.curseur('masse_terre', 0.5, 2.0, 1.0, { dec: 2, unite: 'M⊕' });
    this.m_lune = this.curseur('masse_lune', 0.5, 2.0, 1.0, { dec: 2, unite: 'M☾' });
    this.c_force = this.coche('force', true);
    this.c_vitesse = this.coche('vecteurs_vitesse', false);
    this.c_traces = this.coche('traces', true);
    this.c_grille = this.coche('grille', false);
    this.c_ruban = this.coche('ruban', false);
    this.c_gravite = this.coche('gravite', true);
    this.c_lune_soleil = this.coche('lune_soleil', false);
    this.bouton('anim_gravityorbits_pas', () => this.pas(0.1));
    this.bouton('anim_gravityorbits_retour', () => this.retour());
    this.bouton('anim_gravityorbits_effacer', () => {
      this.sys.effacerTraces();
      this.rafraichir();
    });
    this.c_scenario.currentIndexChanged.connect(() => this.charger());
    this.c_mode.currentIndexChanged.connect(() => this.changerVue());
    for (const r of [this.m_soleil, this.m_terre, this.m_lune]) r.valueChanged.connect(() => this.appliquerMasses());
    this.c_gravite.toggled.connect((b) => {
      this.sys.gravite = b;
      this.sys.remesurer();
    });
    this.tMode = this.tCible = this.c_mode.currentData() === 'echelle' ? 0 : 1;
    this.charger();
  }

  override etat_initial(): void {
    this.charger();
    this.tMode = this.tCible = this.c_mode.currentData() === 'echelle' ? 0 : 1;
  }

  // ------------------------------------------------------------ état
  /** Charge le scénario choisi (masses des curseurs, gravité de la case). */
  charger(): void {
    this.sc = (this.c_scenario.currentData() as Sc) ?? 'soleil_terre';
    this.depart = null;
    const cf = CONF[this.sc];
    const cs = g.scenario(this.sc);
    this.sys = new g.Systeme([], cf.pasTrace);
    this.sys.maxTrace = cf.maxTrace;
    this.sys.gravite = this.c_gravite.isChecked();
    // échelles des flèches au départ (masses nominales, avec gravité)
    const ax: number[] = [];
    const ay: number[] = [];
    g.accelerations(cs, true, ax, ay);
    const L = 1.0;
    this.kF = cs.map((c, i) => {
      const f = c.m * Math.hypot(ax[i]!, ay[i]!);
      return f > 0 ? (0.22 * L) / f : 0;
    });
    const ref = cs.find((c) => c.nom === cf.ref)!;
    this.kV = (0.3 * L) / Math.hypot(ref.vx, ref.vy);
    // ruban : du primaire du corps de référence à lui
    const p = ref.primaire >= 0 ? cs[ref.primaire]! : cs[0]!;
    this.ruban = [p.x, p.y, ref.x, ref.y];
    this.sys.charger(cs);
    this.masses();
    this.sys.remesurer();
    this.sys.effacerTraces();
    this.depart = this.sys.instantane();
    // curseurs de masse utiles au scénario
    const noms = new Set(cs.map((c) => c.nom));
    this.m_soleil.setVisible(noms.has('soleil'));
    this.m_terre.setVisible(noms.has('terre'));
    this.m_lune.setVisible(noms.has('lune'));
    this.c_lune_soleil.setVisible(this.sys.trio !== null);
    this.rafraichir();
  }

  /** Masses des curseurs appliquées aux corps. */
  private masses(): void {
    const f: Record<string, number> = { soleil: this.m_soleil.value(), terre: this.m_terre.value(), lune: this.m_lune.value() };
    for (const c of this.sys.corps) c.m = g.MASSES[c.nom]! * (f[c.nom] ?? 1.0);
    if (this.depart) for (const c of this.depart.corps) c.m = g.MASSES[c.nom]! * (f[c.nom] ?? 1.0);
  }

  private appliquerMasses(): void {
    this.masses();
    this.sys.remesurer();
    this.rafraichir();
  }

  retour(): void {
    if (this.depart) {
      this.sys.restaurer(this.depart);
      this.masses();
      this.sys.remesurer();
      this.sys.effacerTraces();
    }
    this.rafraichir();
  }

  override basculer_lecture(): void {
    if (!this.en_lecture) this.depart = this.sys.instantane();
    super.basculer_lecture();
  }

  override avancer(dt: number): void {
    if (this.saisi) return;
    this.sys.avancer(dt * CONF[this.sc].rythme);
  }

  /** Passage en douceur vers la vue choisie (aucune image de plus une fois arrivé). */
  private changerVue(): void {
    this.tCible = this.c_mode.currentData() === 'echelle' ? 0 : 1;
    const raf = (globalThis as { requestAnimationFrame?: (f: (t: number) => void) => number }).requestAnimationFrame;
    if (!raf) {
      this.tMode = this.tCible;
      this.rafraichir();
      return;
    }
    if (this.transitionEnCours) return;
    this.transitionEnCours = true;
    let avant = 0;
    const image = (t: number): void => {
      const dt = avant ? Math.min(0.25, (t - avant) / 1000) : 0;
      avant = t;
      const pas = dt / DUREE_TRANSITION;
      if (this.tMode < this.tCible) this.tMode = Math.min(this.tCible, this.tMode + pas);
      else this.tMode = Math.max(this.tCible, this.tMode - pas);
      this.rafraichir();
      if (this.tMode !== this.tCible) raf(image);
      else this.transitionEnCours = false;
    };
    raf(image);
  }

  // ------------------------------------------------------------ géométrie de la vue
  /** facteur d'agrandissement de l'écart d'un satellite (Lune autour de la Terre, vue « Modèle ») */
  private ecart(): number {
    if (!this.sys.trio) return 1;
    const kmod = (ECART_LUNE * UA) / g.A_LUNE;
    return Math.exp(this.lisse() * Math.log(kmod));
  }

  /** tMode adouci (départ et arrivée lents) */
  private lisse(): number {
    const t = this.tMode;
    return t * t * (3 - 2 * t);
  }

  /** satellite dessiné agrandi autour de son primaire ? */
  private satellite(i: number): number {
    const c = this.sys.corps[i]!;
    return this.sys.trio && c.nom === 'lune' ? c.primaire : -1;
  }

  private versEcran(x: number, y: number): [number, number] {
    const v = this.cam;
    return [v.cx + (x - v.ox) * v.s, v.cy - y * v.s];
  }

  private versMonde(X: number, Y: number): [number, number] {
    const v = this.cam;
    return [v.ox + (X - v.cx) / v.s, -(Y - v.cy) / v.s];
  }

  /** position dessinée (m) du corps i */
  private posDessin(i: number): [number, number] {
    const c = this.sys.corps[i]!;
    const p = this.satellite(i);
    if (p < 0) return [c.x, c.y];
    const q = this.sys.corps[p]!;
    const k = this.ecart();
    return [q.x + k * (c.x - q.x), q.y + k * (c.y - q.y)];
  }

  /** rayon dessiné (px) */
  private rayon(i: number): number {
    const c = this.sys.corps[i]!;
    const v = this.cam;
    const reel = c.rayon * v.s;
    const mod = (CONF[this.sc].rmod[c.nom] ?? 0.03) * v.L;
    const t = this.lisse();
    return Math.max(1.5, Math.exp((1 - t) * Math.log(Math.max(reel, 1e-9)) + t * Math.log(mod)));
  }

  private nom(n: string): string {
    return tr('anim_gravityorbits_n_' + n);
  }

  // ------------------------------------------------------------ souris
  override presser(pos: Pt, _bouton: Bouton_souris): boolean {
    const cs = this.sys.corps;
    // bout d'une flèche de vitesse
    if (this.c_vitesse.isChecked()) {
      for (let i = cs.length - 1; i >= 0; i--) {
        if (!cs[i]!.actif) continue;
        const [bx, by] = this.versEcran(...this.posDessin(i));
        const [tx, ty] = this.boutVitesse(i, bx, by);
        if (Math.hypot(tx - bx, ty - by) > this.rayon(i) + 4 && Math.hypot(pos.x - tx, pos.y - ty) <= 10) {
          this.tenir((q) => {
            const c = this.sys.corps[i]!;
            const [x0, y0] = this.versEcran(...this.posDessin(i));
            const k = this.kV * this.cam.L;
            c.vx = (q.x - x0) / k;
            c.vy = -(q.y - y0) / k;
          });
          return true;
        }
      }
    }
    // bouts du ruban
    if (this.c_ruban.isChecked()) {
      for (const b of [0, 2]) {
        const [X, Y] = this.versEcran(this.ruban[b]!, this.ruban[b + 1]!);
        if (Math.hypot(pos.x - X, pos.y - Y) <= 10) {
          this.tenir((q) => {
            const [x, y] = this.versMonde(q.x, q.y);
            this.ruban[b] = x;
            this.ruban[b + 1] = y;
          }, false);
          return true;
        }
      }
    }
    // astres (les petits d'abord)
    const ordre = cs.map((_, i) => i).sort((a, b) => this.rayon(a) - this.rayon(b));
    for (const i of ordre) {
      if (!cs[i]!.actif) continue;
      const [X, Y] = this.versEcran(...this.posDessin(i));
      if (Math.hypot(pos.x - X, pos.y - Y) <= Math.max(this.rayon(i), 9)) {
        this.tenir((q) => this.deplacer(i, q));
        return true;
      }
    }
    return false;
  }

  /** Saisie d'un objet : le temps est suspendu jusqu'au relâcher ; `etat` : l'état des corps change. */
  private tenir(f: (q: Pt) => void, etat = true): void {
    this.saisi = true;
    this.modifie = etat;
    this._glisse = f;
  }

  private modifie = false;

  override relacher(pos: Pt): void {
    super.relacher(pos);
    if (this.saisi && this.modifie) {
      this.sys.remesurer();
      this.sys.effacerTraces();
      this.depart = this.sys.instantane();
    }
    this.saisi = false;
    this.modifie = false;
    this.rafraichir();
  }

  /** Déplace le corps i sous le pointeur ; ses satellites (Lune, ISS) le suivent. */
  private deplacer(i: number, q: Pt): void {
    const cs = this.sys.corps;
    const c = cs[i]!;
    let [x, y] = this.versMonde(q.x, q.y);
    const p = this.satellite(i);
    if (p >= 0) {
      const k = this.ecart();
      x = cs[p]!.x + (x - cs[p]!.x) / k;
      y = cs[p]!.y + (y - cs[p]!.y) / k;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const dx = x - c.x,
      dy = y - c.y;
    c.x = x;
    c.y = y;
    for (const s of cs) {
      if (s !== c && s.primaire === i && (s.nom === 'lune' || s.nom === 'iss')) {
        s.x += dx;
        s.y += dy;
      }
    }
  }

  private boutVitesse(i: number, bx: number, by: number): [number, number] {
    const c = this.sys.corps[i]!;
    const k = this.kV * this.cam.L;
    let dx = c.vx * k,
      dy = -c.vy * k;
    const lmax = 0.9 * this.cam.L;
    const l = Math.hypot(dx, dy);
    if (l > lmax) {
      dx *= lmax / l;
      dy *= lmax / l;
    }
    return [bx + dx, by + dy];
  }

  // ------------------------------------------------------------ valeurs
  private distance(d: number): string {
    if (CONF[this.sc].ua && d >= 0.02 * UA)
      return `${nombre(d / UA, 4)} ${tr('anim_gravityorbits_ua')} (${tr('anim_gravityorbits_millions_km', { n: nombre(d / 1e9, 1) })})`;
    return `${nombre(d / 1000, 0)} km`;
  }

  private duree(s: number, nom: string): string {
    if (nom === 'iss') return `${nombre(s / 60, 1)} min`;
    return `${nombre(s / g.JOUR, nom === 'comete' ? 1 : 2)} ${tr('anim_gravityorbits_j')}`;
  }

  override valeurs(): [string, string][] {
    const sys = this.sys;
    const cs = sys.corps;
    const out: [string, string][] = [];
    const jours = tr('anim_gravityorbits_jours', { n: nombre(sys.t / g.JOUR, this.sc === 'terre_iss' ? 4 : 1) });
    out.push([tr('anim_gravityorbits_v_temps'), this.sc === 'terre_iss' ? `${tr('anim_gravityorbits_minutes', { n: nombre(sys.t / 60, 1) })} (${jours})` : jours]);
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i]!;
      if (c.primaire < 0 || !c.actif || !cs[c.primaire]!.actif) continue;
      const p = cs[c.primaire]!;
      const a = this.nom(c.nom),
        b = this.nom(p.nom);
      out.push([tr('anim_gravityorbits_v_distance', { a, b }), this.distance(norme(c.x - p.x, c.y - p.y))]);
      out.push([tr('anim_gravityorbits_v_vitesse', { a, b }), `${nombre(norme(c.vx - p.vx, c.vy - p.vy) / 1000, 2)} km·s⁻¹`]);
      if (!sys.gravite) continue;
      const T = sys.periode(i);
      let ref: string;
      let Tv: number;
      if (c.nom in g.VRAIES_J) {
        Tv = g.VRAIES_J[c.nom]! * g.JOUR;
        ref = tr('anim_gravityorbits_v_vraie', { t: `${nombre(g.VRAIES_J[c.nom]!, 3)} ${tr('anim_gravityorbits_j')}` });
      } else {
        // période de Kepler de l'orbite de départ (demi-grand axe tiré de l'énergie du couple)
        Tv = this.kepler(i);
        ref = tr('anim_gravityorbits_v_kepler', { t: this.duree(Tv, c.nom) });
      }
      out.push([
        tr('anim_gravityorbits_v_periode', { a }),
        T === null
          ? `— (${tr('anim_gravityorbits_v_attente')}) · ${ref}`
          : `${this.duree(T, c.nom)} · ${ref} · ${tr('anim_gravityorbits_v_ecart', { e: nombre((100 * Math.abs(T - Tv)) / Tv, 2) })}`,
      ]);
    }
    if (sys.gravite) {
      const [de, dl] = sys.derives();
      out.push([tr('anim_gravityorbits_v_energie'), `${sci(g.energie(cs), 4)} J · ${tr('anim_gravityorbits_v_derive', { d: sci(de, 1) })}`]);
      out.push([tr('anim_gravityorbits_v_moment'), sci(dl, 1)]);
    } else out.push([tr('anim_gravityorbits_v_gravite'), tr('anim_gravityorbits_v_gravite_coupee')]);
    if (this.c_ruban.isChecked()) {
      const [x0, y0, x1, y1] = this.ruban;
      out.push([tr('anim_gravityorbits_v_ruban'), this.distance(norme(x1 - x0, y1 - y0))]);
    }
    if (this.c_lune_soleil.isChecked() && sys.trio && sys.courbures.length) {
      const a = nombre(sys.courbureMin, 2),
        b = nombre(sys.courbureMax, 2);
      out.push([tr('anim_gravityorbits_v_courbure'), tr(sys.courbureMin > 0 ? 'anim_gravityorbits_v_courbure_val' : 'anim_gravityorbits_v_courbure_neg', { a, b })]);
    }
    for (const k of sys.collisions) out.push([tr('anim_gravityorbits_v_collision'), tr('anim_gravityorbits_v_collision_val', { a: this.nom(k.corps), b: this.nom(k.sur) })]);
    if (this.tCible === 1) out.push([tr('anim_gravityorbits_v_dessin'), this.agrandi()]);
    return out;
  }

  /** Période de Kepler (s) du corps i autour de son primaire, d'après l'état de départ (énergie du couple). */
  private kepler(i: number): number {
    const d = this.depart ?? this.sys.instantane();
    const c = d.corps[i]!;
    const p = d.corps[c.primaire]!;
    const mu = g.G * (c.m + p.m);
    const r = norme(c.x - p.x, c.y - p.y);
    const v2 = (c.vx - p.vx) * (c.vx - p.vx) + (c.vy - p.vy) * (c.vy - p.vy);
    const a = 1 / (2 / r - v2 / mu);
    return a > 0 ? 2 * Math.PI * Math.sqrt((a * a * a) / mu) : NaN;
  }

  /** « astres ×N ; distance Terre–Lune ×K » (rapports du dessin « Modèle » au vrai, indépendants de la toile). */
  private agrandi(): string {
    const cf = CONF[this.sc];
    const k = (cf.rmod[cf.ref] ?? 0.03) * (cf.D / g.RAYONS[cf.ref]!);
    const n = nombre(k, k < 10 ? 1 : 0);
    if (this.sc === 'terre_iss') return tr('anim_gravityorbits_agrandi_iss', { k: n });
    if (!this.sys.trio) return tr('anim_gravityorbits_agrandi_astres', { k: n });
    return tr('anim_gravityorbits_agrandi', { k: n, l: nombre((ECART_LUNE * UA) / g.A_LUNE, 0) });
  }

  // ------------------------------------------------------------ dessin
  override dessiner(p: Peintre, rect: Rect): void {
    const titre = tr(this.tCible === 1 ? 'anim_gravityorbits_titre_modele' : 'anim_gravityorbits_titre_echelle');
    const r = dessin.cadre(p, rect, titre);
    const cf = CONF[this.sc];
    const L = 0.44 * Math.min(r.w, r.h);
    this.cam = { cx: r.cx, cy: r.cy, s: L / cf.D, L, ox: cf.ox };
    p.save();
    p.setClipRect(r);
    if (this.c_grille.isChecked()) this.grille(p, r);
    if (this.c_traces.isChecked()) this.traces(p);
    this.corps(p);
    if (this.c_ruban.isChecked()) this.dessinerRuban(p);
    p.restore();
    // temps écoulé (en haut à droite) et mentions
    const sys = this.sys;
    const jours = tr('anim_gravityorbits_jours', { n: nombre(sys.t / g.JOUR, this.sc === 'terre_iss' ? 3 : 1) });
    const s = this.sc === 'terre_iss' ? `${tr('anim_gravityorbits_minutes', { n: nombre(sys.t / 60, 1) })} = ${jours}` : jours;
    const w = p.fontMetrics().horizontalAdvance(s);
    dessin.texte(p, r.right - w - 6, r.top + 14, s, 'texte', { centre: false, fond: true });
    if (!sys.gravite) dessin.texte(p, r.cx, r.top + 14, tr('anim_gravityorbits_sans_gravite'), 'accent3', { fond: true });
    if (this.tCible === 1) {
      dessin.police(p, 0.85);
      const m = this.agrandi();
      const wm = p.fontMetrics().horizontalAdvance(m);
      dessin.texte(p, r.right - wm - 6, r.top + 34, m, 'doux', { centre: false });
      dessin.police(p, 1 / 0.85);
    }
    if (this.c_lune_soleil.isChecked() && sys.trio) this.encart(p, r);
  }

  private grille(p: Peintre, r: Rect): void {
    const cf = CONF[this.sc];
    const s = this.cam.s;
    const pas = (cf.ua ? [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5].map((x) => x * UA) : [1, 2, 5, 10, 20, 50, 100, 200, 500].flatMap((m) => [m * 1e3, m * 1e6]).sort((a, b) => a - b))
      .find((x) => x * s >= Math.max(36, 0.22 * this.cam.L)) ?? cf.D;
    const lignes: [number, number, number, number][] = [];
    const [x0] = this.versMonde(r.left, 0);
    const [x1] = this.versMonde(r.right, 0);
    for (let k = Math.ceil(x0 / pas); k <= Math.floor(x1 / pas); k++) {
      const [X] = this.versEcran(k * pas, 0);
      lignes.push([X, r.top, X, r.bottom]);
    }
    const [, y0] = this.versMonde(0, r.bottom);
    const [, y1] = this.versMonde(0, r.top);
    for (let k = Math.ceil(y0 / pas); k <= Math.floor(y1 / pas); k++) {
      const [, Y] = this.versEcran(0, k * pas);
      lignes.push([r.left, Y, r.right, Y]);
    }
    p.setPen(dessin.stylo('grille', 0.7, 0.55));
    p.drawLines(lignes);
    const d = cf.ua ? `${nombre(pas / UA, pas / UA < 0.1 ? 2 : pas / UA < 1 ? 2 : 0)} ${tr('anim_gravityorbits_ua')}` : `${nombre(pas / 1000, 0)} km`;
    dessin.police(p, 0.85);
    dessin.texte(p, r.left + 6, r.bottom - 6, tr('anim_gravityorbits_carreau', { d }), 'doux', { centre: false, fond: true });
    dessin.police(p, 1 / 0.85);
  }

  private traces(p: Peintre): void {
    const sys = this.sys;
    const k = this.ecart();
    for (let i = 0; i < sys.corps.length; i++) {
      const t = sys.traces[i];
      if (!t || t.x.length < 2) continue;
      const sat = this.satellite(i) >= 0;
      const n = t.x.length;
      const pasD = Math.max(1, Math.ceil(n / MAX_POINTS));
      const xs: number[] = [];
      const ys: number[] = [];
      for (let j = 0; j < n; j += pasD) this.pointTrace(t, j, sat, k, xs, ys);
      if ((n - 1) % pasD) this.pointTrace(t, n - 1, sat, k, xs, ys);
      p.setPen(dessin.stylo(COULEUR[sys.corps[i]!.nom] ?? 'texte', 1.0, 0.55));
      p.drawPolyline([xs, ys]);
    }
  }

  private pointTrace(t: g.Trace, j: number, sat: boolean, k: number, xs: number[], ys: number[]): void {
    const x = sat ? t.px[j]! + k * (t.x[j]! - t.px[j]!) : t.x[j]!;
    const y = sat ? t.py[j]! + k * (t.y[j]! - t.py[j]!) : t.y[j]!;
    const [X, Y] = this.versEcran(x, y);
    xs.push(X);
    ys.push(Y);
  }

  private corps(p: Peintre): void {
    const sys = this.sys;
    const cs = sys.corps;
    const pos = cs.map((_, i) => this.versEcran(...this.posDessin(i)));
    const ray = cs.map((_, i) => this.rayon(i));
    // le Soleil d'abord (lumière des sphères), puis les autres
    const ordre = cs.map((_, i) => i).sort((a, b) => (cs[a]!.nom === 'soleil' ? -1 : 0) - (cs[b]!.nom === 'soleil' ? -1 : 0));
    for (const i of ordre) {
      const c = cs[i]!;
      if (!c.actif) continue;
      const [X, Y] = pos[i]!;
      const rr = ray[i]!;
      // astre réduit à un point (à l'échelle) : un anneau discret aide à le trouver
      if (rr < 3) {
        p.setPen(dessin.stylo(COULEUR[c.nom] ?? 'texte', 1.0, 0.45));
        p.setBrush(null);
        p.drawEllipse(X, Y, 7, 7);
      }
      if (c.nom === 'iss') this.station(p, X, Y, rr);
      else if (c.nom === 'comete') this.comete(p, X, Y, rr, cs);
      else dessin.disque(p, X, Y, rr, COULEUR[c.nom] ?? 'texte');
    }
    // flèches
    const L = this.cam.L;
    if (this.c_force.isChecked() && sys.gravite) {
      const ax: number[] = [];
      const ay: number[] = [];
      g.accelerations(cs, true, ax, ay);
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i]!;
        if (!c.actif || !this.kF[i]) continue;
        let dx = c.m * ax[i]! * this.kF[i]! * L,
          dy = -c.m * ay[i]! * this.kF[i]! * L;
        const l = Math.hypot(dx, dy);
        if (!(l >= 2)) continue;
        if (l > 0.9 * L) {
          dx *= (0.9 * L) / l;
          dy *= (0.9 * L) / l;
        }
        const [X, Y] = pos[i]!;
        dessin.fleche(p, X, Y, X + dx, Y + dy, dessin.stylo('equateur', 2.2), 8);
      }
    }
    if (this.c_vitesse.isChecked()) {
      for (let i = 0; i < cs.length; i++) {
        if (!cs[i]!.actif) continue;
        const [X, Y] = pos[i]!;
        const [tx, ty] = this.boutVitesse(i, X, Y);
        if (Math.hypot(tx - X, ty - Y) < 2) continue;
        dessin.fleche(p, X, Y, tx, ty, dessin.stylo('horizon', 2.2), 8);
        if (Math.hypot(tx - X, ty - Y) > ray[i]! + 4) {
          p.setPen(dessin.stylo('horizon', 1.4));
          p.setBrush(null);
          p.drawEllipse(tx, ty, 6, 6);
        }
      }
    }
    // étiquettes : la Terre et la Lune confondues à l'échelle n'en ont qu'une
    const trio = sys.trio;
    let confondues = false;
    if (trio && cs[trio[1]]!.actif && cs[trio[2]]!.actif) {
      const [a, b] = [pos[trio[1]]!, pos[trio[2]]!];
      confondues = Math.hypot(a[0] - b[0], a[1] - b[1]) < Math.max(ray[trio[1]]!, ray[trio[2]]!) + 3;
    }
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i]!;
      if (!c.actif) continue;
      if (confondues && trio && i === trio[2]) continue;
      const nom = confondues && trio && i === trio[1] ? this.nom('terre_lune') : this.nom(c.nom);
      const [X, Y] = pos[i]!;
      const rr = ray[i]!;
      if (rr > 0.6 * this.cam.L) continue; // la Terre qui remplit la vue (ISS à l'échelle) : pas d'étiquette dessus
      dessin.etiquette(p, X + rr * 0.6, Y - rr * 0.6, nom, COULEUR[c.nom] === 'texte' ? 'texte' : COULEUR[c.nom]!, 6);
    }
  }

  /** La station spatiale : un module et deux ailes de panneaux solaires (un point si elle est minuscule). */
  private station(p: Peintre, x: number, y: number, r: number): void {
    if (r < 4) {
      dessin.disque(p, x, y, Math.max(r, 1.5), 'texte');
      return;
    }
    p.setPen(dessin.stylo('texte', 1.0));
    p.setBrush(dessin.c('doux'));
    p.drawRect(new Rect(x - r * 0.35, y - r * 0.18, r * 0.7, r * 0.36));
    p.setBrush(dessin.c('equateur', 0.85));
    p.drawRect(new Rect(x - r, y - r * 0.32, r * 0.55, r * 0.64));
    p.drawRect(new Rect(x + r * 0.45, y - r * 0.32, r * 0.55, r * 0.64));
    dessin.reserver(p, x, y, r);
  }

  /** La comète : noyau et queue opposée au Soleil, d'autant plus longue qu'elle en est proche. */
  private comete(p: Peintre, x: number, y: number, r: number, cs: readonly g.Corps[]): void {
    const s = cs.find((c) => c.nom === 'soleil' && c.actif);
    const c = cs.find((k) => k.nom === 'comete')!;
    if (s && this.sys.gravite) {
      const dx = c.x - s.x,
        dy = c.y - s.y;
      const d = Math.hypot(dx, dy);
      const l = Math.min(0.5, 0.12 * (UA / d) ** 2) * this.cam.L;
      if (d > 0 && l > 3) {
        p.setPen(dessin.stylo('accent2', Math.max(1.2, r * 0.8), 0.45));
        p.drawLine(x, y, x + (dx / d) * l, y - (dy / d) * l);
      }
    }
    dessin.disque(p, x, y, r, 'accent2');
  }

  private dessinerRuban(p: Peintre): void {
    const [x0, y0, x1, y1] = this.ruban;
    const [A, B] = [this.versEcran(x0, y0), this.versEcran(x1, y1)];
    p.setPen(dessin.stylo('accent1', 2.0));
    p.drawLine(A[0], A[1], B[0], B[1]);
    p.setBrush(dessin.c('accent1', 0.35));
    for (const [X, Y] of [A, B]) p.drawEllipse(X, Y, 6, 6);
    dessin.texte(p, (A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - 12, this.distance(Math.hypot(x1 - x0, y1 - y0)), 'accent1', { fond: true });
  }

  /**
   * Encart « Lune vue du Soleil » : vraie trajectoire héliocentrique de la Lune et de la Terre sur les 60 derniers
   * jours (même échelle en x et en y : les deux chemins se confondent, sans boucle), et le rapport des courbures
   * Lune / Terre au cours du temps : toujours positif, donc toujours tourné vers le Soleil.
   */
  private encart(p: Peintre, r: Rect): void {
    const sys = this.sys;
    const [is, it, il] = sys.trio!;
    const ts = sys.traces[is]!,
      tt = sys.traces[it]!,
      tl = sys.traces[il]!;
    const etroit = r.w < 420;
    const w = etroit ? r.w : Math.max(200, 0.42 * r.w);
    const h = Math.max(130, (etroit ? 0.46 : 0.44) * r.h);
    const R = new Rect(r.right - w, r.bottom - h, w, h);
    p.save();
    p.setPen(null);
    p.setBrush(dessin.c('fond', 0.94));
    p.drawRoundedRect(R.adjusted(3, 3, -3, -3), 10, 10);
    p.restore();
    const ri = dessin.cadre(p, R, tr('anim_gravityorbits_titre_lune_soleil'));
    const n = Math.min(ts.x.length, tt.x.length, tl.x.length);
    const N = Math.min(n, Math.ceil((60 * g.JOUR) / sys.pasTrace) + 1);
    if (N < 3) return;
    const haut = new Rect(ri.x, ri.y, ri.w, ri.h * 0.56);
    const bas = new Rect(ri.x, ri.y + ri.h * 0.6, ri.w, ri.h * 0.4);
    // repère : Soleil en bas (la Terre du milieu de la fenêtre vers le haut)
    const j0 = (k: number, t: g.Trace): number => t.x.length - N + k;
    const m = Math.floor(N / 2);
    const ex = tt.x[j0(m, tt)]! - ts.x[j0(m, ts)]!,
      ey = tt.y[j0(m, tt)]! - ts.y[j0(m, ts)]!;
    const a = Math.atan2(ey, ex);
    const ca = Math.cos(Math.PI / 2 - a),
      sa = Math.sin(Math.PI / 2 - a);
    const rot = (t: g.Trace, k: number): [number, number] => {
      const x = t.x[j0(k, t)]! - ts.x[j0(k, ts)]!,
        y = t.y[j0(k, t)]! - ts.y[j0(k, ts)]!;
      return [ca * x - sa * y, sa * x + ca * y];
    };
    const pasE = Math.max(1, Math.ceil(N / 240));
    const ks: number[] = [];
    for (let k = 0; k < N; k += pasE) ks.push(k);
    if ((N - 1) % pasE) ks.push(N - 1);
    const pl = ks.map((k) => rot(tl, k));
    const pt = ks.map((k) => rot(tt, k));
    let xmin = Infinity,
      xmax = -Infinity,
      ymin = Infinity,
      ymax = -Infinity;
    for (const [x, y] of [...pl, ...pt]) {
      xmin = Math.min(xmin, x);
      xmax = Math.max(xmax, x);
      ymin = Math.min(ymin, y);
      ymax = Math.max(ymax, y);
    }
    const k = Math.min((haut.w - 16) / Math.max(xmax - xmin, 1), (haut.h - 22) / Math.max(ymax - ymin, 1));
    const cx = haut.cx - ((xmin + xmax) / 2) * k,
      cy = haut.cy + 4 + ((ymin + ymax) / 2) * k;
    for (const [pts, cle] of [[pt, 'terre'], [pl, 'lune']] as [[number, number][], string][]) {
      p.setPen(cle === 'lune' ? dessin.stylo(cle, 1.0) : dessin.stylo(cle, 2.5, 0.5));
      p.drawPolyline([pts.map(([x]) => cx + x * k), pts.map(([, y]) => cy - y * k)]);
    }
    dessin.fleche(p, haut.cx, haut.bottom - 16, haut.cx, haut.bottom + 2, dessin.stylo('soleil', 1.6), 6);
    dessin.police(p, 0.82);
    dessin.texte(p, haut.cx + 8, haut.bottom - 4, tr('anim_gravityorbits_vers_soleil'), 'soleil', { centre: false });
    // courbures
    const kb = sys.courbures.slice(-N).filter((_, j) => j % Math.max(1, Math.ceil(N / 240)) === 0);
    if (kb.length >= 2) {
      const hi = Math.max(1.6, ...kb),
        lo = Math.min(-0.2, ...kb);
      const Y = (v: number): number => bas.bottom - ((v - lo) / (hi - lo)) * bas.h;
      p.setPen(dessin.stylo('accent3', 1.0, 0.8, true));
      p.drawLine(bas.left, Y(0), bas.right, Y(0));
      p.setPen(dessin.stylo('grille', 0.8, 0.7));
      p.drawLine(bas.left, Y(1), bas.right, Y(1));
      p.setPen(dessin.stylo('lune', 1.0));
      p.drawPolyline([kb.map((_, j) => bas.left + (j / (kb.length - 1)) * bas.w), kb.map(Y)]);
      dessin.texte(p, bas.left + 2, Y(0) + 11, '0', 'accent3', { centre: false });
      dessin.texte(p, bas.left + 2, Y(1) - 3, '1', 'doux', { centre: false });
      dessin.texte(p, bas.left + 14, bas.top + 2, tr('anim_gravityorbits_courbure_graphe'), 'lune', { centre: false, fond: true });
    }
    dessin.police(p, 1 / 0.82);
  }
}
