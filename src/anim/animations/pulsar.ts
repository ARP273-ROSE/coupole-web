/**
 * Pulsar Period Simulator : un pulsar émet une impulsion à intervalles parfaitement réguliers.  S'il tourne autour d'un
 * compagnon, les impulsions émises en s'approchant de la Terre arrivent plus serrées, celles émises en s'éloignant plus
 * espacées : P (1 + v_r / c) au premier ordre (t_arrivée = t_émission + distance / c, calculé exactement).  Unités
 * réduites : la vitesse de la lumière vaut 1.
 */
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, Rect } from '../../noyau/peintre';
import { Animation, type Choix, type Coche, nombre, type Reglage } from '../base';

const C = 1.0;
const R_ORBITE = 1.0;
const D_TERRE = 9.0;
const FENETRE = 60.0;

export class Pulsar extends Animation {
  static override ID = 'pulsarPeriodSim';
  static override LECTURE_AU_DEPART = true;

  mouvement!: Choix;
  p_pulsar!: Reglage;
  p_orbite!: Reglage;
  c_couleurs!: Coche;
  t = 0.0;
  n_emis = 0;
  impulsions: [number, number, number, number, number][] = [];
  arrivees: [number, number, number][] = [];
  private derniere: number | null = null;
  private cle: string | undefined = undefined;

  override construire(): void {
    this.mouvement = this.choix('mouvement', [['anim_pulsarperiodsim_immobile', 'immobile'], ['anim_pulsarperiodsim_orbite', 'orbite']], 'orbite');
    this.p_pulsar = this.curseur('periode', 0.2, 2.0, 0.5, { dec: 2 });
    this.p_orbite = this.curseur('periode_orbite', 8.0, 60.0, 20.0, { dec: 1 });
    this.c_couleurs = this.coche('couleurs', true);
    this.etat_initial();
  }

  override etat_initial(): void {
    this.t = 0.0;
    this.n_emis = 0;
    this.impulsions = [];
    this.arrivees = [];
    this.derniere = null;
  }

  override reglage_change(): void {
    const cle = `${this.mouvement.currentData()}|${this.p_pulsar.value()}|${this.p_orbite.value()}`;
    // comme l'original en Python, la première fois compte aussi comme un changement
    if (this.cle !== cle) this.etat_initial();
    this.cle = cle;
    super.reglage_change();
  }

  position(t: number): [number, number, number] {
    if (this.mouvement.currentData() === 'immobile') return [0.0, 0.0, 0.0];
    const w = (2 * Math.PI) / this.p_orbite.value();
    const x = R_ORBITE * Math.cos(w * t),
      y = R_ORBITE * Math.sin(w * t);
    const vx = -R_ORBITE * w * Math.sin(w * t),
      vy = R_ORBITE * w * Math.cos(w * t);
    const dx = D_TERRE - x,
      dy = -y;
    const n = Math.hypot(dx, dy);
    return [x, y, -(vx * dx + vy * dy) / n];
  }

  override avancer(dt: number): void {
    this.t += dt;
    const p = this.p_pulsar.value();
    while (this.n_emis * p <= this.t) {
      const te = this.n_emis * p;
      const [x, y, vr] = this.position(te);
      this.impulsions.push([te, x, y, te + Math.hypot(D_TERRE - x, y) / C, vr]);
      this.n_emis += 1;
    }
    const restantes: [number, number, number, number, number][] = [];
    for (const imp of this.impulsions) {
      if (imp[3] <= this.t) {
        if (this.derniere !== null) this.arrivees.push([imp[3], imp[3] - this.derniere, imp[4]]);
        this.derniere = imp[3];
      } else restantes.push(imp);
    }
    this.impulsions = restantes;
    while (this.arrivees.length && this.arrivees[0]![0] < this.t - FENETRE) this.arrivees.shift();
  }

  extremes(): [number, number] {
    const p = this.p_pulsar.value();
    if (this.mouvement.currentData() === 'immobile') return [p, p];
    const v = (2 * Math.PI * R_ORBITE) / this.p_orbite.value();
    return [p * (1 - v / C), p * (1 + v / C)];
  }

  override valeurs(): [string, string][] {
    const [mini, maxi] = this.extremes();
    const out: [string, string][] = [
      [tr('anim_pulsarperiodsim_p_vraie'), nombre(this.p_pulsar.value(), 3)],
      [tr('anim_pulsarperiodsim_v_c'), nombre(maxi / this.p_pulsar.value() - 1, 3)],
      [tr('anim_pulsarperiodsim_prevu'), `${nombre(mini, 3)} – ${nombre(maxi, 3)}`],
    ];
    if (this.arrivees.length) {
      const iv = this.arrivees.map((a) => a[1]);
      out.push([tr('anim_pulsarperiodsim_mesure'), `${nombre(Math.min(...iv), 3)} – ${nombre(Math.max(...iv), 3)}`]);
    }
    return out;
  }

  private couleur(vr: number): string {
    if (!this.c_couleurs.isChecked() || this.mouvement.currentData() === 'immobile') return 'accent1';
    return vr > 0 ? 'accent3' : 'accent2';
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const haut = new Rect(rect.x, rect.y, rect.w, rect.h * 0.5);
    const r = dessin.cadre(p, haut, tr('anim_pulsarperiodsim_titre_scene'));
    const k = Math.min(r.w / (D_TERRE + 3.0), r.h / 2.8);
    const ox = r.left + 1.5 * k,
      oy = r.cy;
    if (this.mouvement.currentData() === 'orbite') {
      p.setPen(dessin.stylo('grille', 1.0, null, true));
      p.setBrush(null);
      p.drawEllipse(ox, oy, R_ORBITE * k, R_ORBITE * k);
    }
    const [x, y] = this.position(this.t);
    for (const [te, xe, ye, ta, v] of this.impulsions) {
      const f = (this.t - te) / (ta - te);
      const px = ox + (xe + (D_TERRE - xe) * f) * k,
        py = oy - ye * (1 - f) * k;
      p.setPen(dessin.stylo(this.couleur(v), 2.5));
      p.drawLine(px, py - 6, px, py + 6);
    }
    dessin.disque(p, ox + x * k, oy - y * k, 6, 'accent1', 'texte');
    dessin.texte(p, ox + x * k, oy - y * k - 14, tr('anim_pulsarperiodsim_pulsar'), 'accent1', { fond: true });
    dessin.disque(p, ox + D_TERRE * k, oy, 9, 'terre', 'texte');
    dessin.texte(p, ox + D_TERRE * k, oy + 20, tr('anim_planete_terre'), 'doux');
    const r2 = dessin.cadre(p, new Rect(rect.x, haut.bottom, rect.w, rect.h - haut.h), tr('anim_pulsarperiodsim_titre_graphe'));
    const [mini, maxi] = this.extremes();
    const marge = 0.15 * Math.max(maxi - mini, 0.1 * this.p_pulsar.value());
    const t1 = Math.max(this.t, FENETRE);
    const ax = new Axes(r2, t1 - FENETRE, t1, mini - marge, maxi + marge, false, false, [48, 8, 10, 26]).avec(p);
    ax.fond(p, { titre_x: tr('anim_pulsarperiodsim_axe_t'), titre_y: tr('anim_pulsarperiodsim_axe_i'), dec_y: 2 });
    ax.horizontale(this.p_pulsar.value(), 'doux', 1.0, true, tr('anim_pulsarperiodsim_p_vraie'));
    const groupes = new Map<string, [number, number][]>();
    for (const [ta, iv, v] of this.arrivees) {
      const c = this.couleur(v);
      if (!groupes.has(c)) groupes.set(c, []);
      groupes.get(c)!.push([ta, iv]);
    }
    for (const [cle, pts] of groupes) ax.points(pts, cle, 2.6, 1.0);
  }
}
