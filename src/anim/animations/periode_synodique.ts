/**
 * Synodic Period Calculator : la période sidérale P d'une planète d'après sa période synodique S, et réciproquement.
 * Planète supérieure : 1/S = 1/E − 1/P ; planète inférieure : 1/S = 1/P − 1/E, E étant l'année sidérale de la Terre.
 * L'animation montre les deux planètes repasser en conjonction au bout de S.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import type { Peintre, Rect } from '../../noyau/peintre';
import { Animation, type Choix, nombre, type Reglage } from '../base';

const PLANETES: [string, number][] = [['mercure', 87.969], ['venus', 224.701], ['mars', 686.98], ['jupiter', 4_332.589], ['saturne', 10_759.22], ['uranus', 30_685.4], ['neptune', 60_189.0]];

export class PeriodeSynodique extends Animation {
  static override ID = 'synodiccalculator';
  static ANNEES_PAR_S = 0.25;

  genre!: Choix;
  p!: Reglage;
  s!: Reglage;
  choix_planete!: Choix;
  private sync = false;
  t = 0.0;

  override construire(): void {
    this.genre = this.choix('genre', [['anim_synodiccalculator_superieure', 'sup'], ['anim_synodiccalculator_inferieure', 'inf']], 'sup');
    this.p = this.curseur('p', 0.05, 300.0, 1.8808, { dec: 4, unite: tr('anim_u_annees'), log: true, rafraichir: false });
    this.s = this.curseur('s', 0.05, 300.0, 2.135, { dec: 4, unite: tr('anim_u_annees'), log: true, rafraichir: false });
    this.choix_planete = this.choix('planete', [['anim_kepler_aucune', ''], ...PLANETES.map(([n]) => ['anim_planete_' + n, n] as [string, string])], '');
    this.choix_planete.activated.connect(() => this.planete());
    this.sync = false;
    this.p.valueChanged.connect(() => this.de_p());
    this.s.valueChanged.connect(() => this.de_s());
    this.genre.currentIndexChanged.connect(() => this.type());
    this.t = 0.0;
    this.type();
  }

  superieure(): boolean {
    return this.genre.currentData() === 'sup';
  }

  private type(): void {
    if (this.superieure()) this.p.borner(1.0005, 300.0);
    else this.p.borner(0.05, 0.9995);
    this.de_p();
  }

  private planete(): void {
    for (const [n, j] of PLANETES) {
      if (n === this.choix_planete.currentData()) {
        const per = j / astro.ANNEE_SIDERALE_J;
        this.genre.setCurrentIndex(this.genre.findData(per > 1 ? 'sup' : 'inf'));
        this.p.setValue(per);
      }
    }
  }

  private de_p(): void {
    if (this.sync) return;
    this.sync = true;
    this.s.setValue(astro.periode_synodique(this.p.value(), 1.0));
    this.sync = false;
    this.rafraichir();
  }

  private de_s(): void {
    if (this.sync) return;
    const per = astro.periode_siderale(this.s.value(), 1.0, this.superieure());
    if (Number.isFinite(per) && per > 0) {
      this.sync = true;
      this.p.setValue(per);
      this.sync = false;
    }
    this.rafraichir();
  }

  override reinitialiser(): void {
    super.reinitialiser();
    this.type();
  }

  override etat_initial(): void {
    this.t = 0.0;
  }

  override avancer(dt: number): void {
    this.t += dt * PeriodeSynodique.ANNEES_PAR_S;
  }

  override valeurs(): [string, string][] {
    const per = this.p.value();
    const s = astro.periode_synodique(per, 1.0);
    const j = astro.ANNEE_SIDERALE_J;
    return [
      [tr('anim_synodiccalculator_formule'), this.superieure() ? '1/S = 1/E − 1/P' : '1/S = 1/P − 1/E'],
      [tr('anim_synodiccalculator_p'), `${nombre(per, 4)} ${tr('anim_u_annees')} = ${nombre(per * j, 2)} ${tr('anim_u_jours')}`],
      [tr('anim_synodiccalculator_s'), `${nombre(s, 4)} ${tr('anim_u_annees')} = ${nombre(s * j, 2)} ${tr('anim_u_jours')}`],
      [tr('anim_synodiccalculator_conjonctions'), Number.isFinite(s) ? nombre(this.t / s, 2) : '—'],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const cx = rect.cx,
      cy = rect.cy;
    const per = this.p.value();
    const a = astro.demi_grand_axe(per);
    const k = (Math.min(rect.w, rect.h) * 0.44) / Math.max(1.0, a);
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(null);
    for (const r of [1.0, a]) p.drawEllipse(cx, cy, r * k, r * k);
    dessin.disque(p, cx, cy, Math.max(7.0, k * 0.08), 'soleil');
    const at = 2 * Math.PI * this.t,
      ap = (2 * Math.PI * this.t) / per;
    const tx = cx + k * Math.cos(at),
      ty = cy - k * Math.sin(at);
    const px = cx + k * a * Math.cos(ap),
      py = cy - k * a * Math.sin(ap);
    p.setPen(dessin.stylo('accent2', 1.0, 0.6, true));
    p.drawLine(cx, cy, cx + 1.15 * k * Math.max(1, a) * Math.cos(at), cy - 1.15 * k * Math.max(1, a) * Math.sin(at));
    dessin.disque(p, tx, ty, 6, 'terre', 'texte');
    dessin.disque(p, px, py, 6, 'mars', 'texte');
    dessin.texte(p, tx, ty - 14, tr('anim_planete_terre'), 'texte', { fond: true });
    dessin.texte(p, px, py - 14, tr('anim_synodiccalculator_planete_p'), 'texte', { fond: true });
  }
}
