/**
 * Lightcurve Simulator : comment on construit la courbe de lumière d'une binaire à éclipses.  On observe le couple à
 * différents moments et l'on reporte chaque mesure à sa phase, (temps écoulé / période) modulo 1 : nuit après nuit,
 * les points dessinent la courbe.  Période de 3,65 jours comme l'original ; éclipses par l'aire de recouvrement.
 */
import * as dc from '../../calc/deux_corps';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, Rect } from '../../noyau/peintre';
import { alea, gauss, pmod } from '../../noyau/py';
import { Animation, type Coche, nombre, type Reglage } from '../base';

const PERIODE_J = 3.65;
const R1 = 0.22,
  R2 = 0.16;
const S1 = 1.0,
  S2 = 0.45;
const I_DEG = 88.0;
const JOURS_PAR_S = 0.5;

export function flux(phase: number): number {
  return dc.flux_deux_disques(phase, R1, R2, S1, S2, 0.0, I_DEG, 90.0) / (Math.PI * (R1 * R1 * S1 + R2 * R2 * S2));
}

export class CourbeLumiere extends Animation {
  static override ID = 'lightcurve';

  c_auto!: Coche;
  pas_mesure!: Reglage;
  bruit!: Reglage;
  jours = 0.0;
  points: [number, number][] = [];
  private prochaine = 0.0;
  private hasard = alea(3);

  override construire(): void {
    this.c_auto = this.coche('auto', false);
    this.pas_mesure = this.curseur('intervalle', 0.05, 2.0, 0.37, { dec: 2, unite: tr('anim_c_jours') });
    this.bruit = this.curseur('bruit', 0.0, 0.05, 0.01, { dec: 3 });
    this.bouton('anim_lightcurve_mesurer', () => this.mesurer());
    this.bouton('anim_lightcurve_effacer', () => this.effacer());
    this.etat_initial();
  }

  override etat_initial(): void {
    this.jours = 0.0;
    this.points = [];
    this.prochaine = 0.0;
    this.hasard = alea(3);
  }

  effacer(): void {
    this.points = [];
    this.rafraichir();
  }

  mesurer(): void {
    const ph = pmod(this.jours / PERIODE_J, 1.0);
    this.points.push([ph, flux(ph) + gauss(this.hasard, 0.0, this.bruit.value())]);
    this.rafraichir();
  }

  override avancer(dt: number): void {
    this.jours += dt * JOURS_PAR_S;
    if (this.c_auto.isChecked()) {
      while (this.jours >= this.prochaine) {
        const ph = pmod(this.prochaine / PERIODE_J, 1.0);
        this.points.push([ph, flux(ph) + gauss(this.hasard, 0.0, this.bruit.value())]);
        this.prochaine += this.pas_mesure.value();
      }
      if (this.points.length > 2000) this.points = this.points.slice(-2000);
    } else this.prochaine = this.jours;
  }

  override valeurs(): [string, string][] {
    const ph = pmod(this.jours / PERIODE_J, 1.0);
    return [
      [tr('anim_lightcurve_ecoule'), `${nombre(this.jours, 2)} ${tr('anim_c_jours')}`],
      [tr('anim_lightcurve_cycles'), String(Math.trunc(Math.floor(this.jours / PERIODE_J)))],
      [tr('anim_c_phase'), nombre(ph, 2)],
      [tr('anim_lightcurve_mesures'), String(this.points.length)],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const haut = new Rect(rect.x, rect.y, rect.w, rect.h * 0.42);
    const r = dessin.cadre(p, haut, tr('anim_lightcurve_titre_couple'));
    const ph = pmod(this.jours / PERIODE_J, 1.0);
    const [x, y, z] = dc.relative(ph, 1.0, 0.0, I_DEG, 90.0);
    const cx = r.cx,
      cy = r.cy;
    const k = Math.min(r.w * 0.32, r.h * 1.2);
    const q = 0.4;
    const corps: [number, number, number, number, string][] = [
      [-q * z, -q * x, -q * y, R1, 'soleil'],
      [(1 - q) * z, (1 - q) * x, (1 - q) * y, R2, 'accent3'],
    ];
    for (const [, xx, yy, rr, cle] of corps.sort((a, b) => a[0] - b[0])) dessin.disque(p, cx + xx * k, cy - yy * k, rr * k, cle, 'fond');
    const r2 = dessin.cadre(p, new Rect(rect.x, haut.bottom, rect.w, rect.h - haut.h), tr('anim_lightcurve_titre_courbe'));
    const ax = new Axes(r2, 0, 1, 0.45, 1.08, false, false, [46, 8, 10, 26]).avec(p);
    ax.fond(p, { titre_x: tr('anim_c_phase'), titre_y: tr('anim_c_flux_relatif'), dec_x: 1, dec_y: 1 });
    ax.points(this.points, 'accent2', 2.4, 0.9);
    ax.verticale(ph, 'accent3', 1.2, false);
  }
}
