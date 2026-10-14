/**
 * Influence of Planets on the Sun : le Soleil tourne autour du centre de masse du Système solaire.  Le centre du
 * Soleil décrit une boucle compliquée, à moins de ≈ 2,2 rayons solaires du centre de masse, menée surtout par Jupiter
 * et Saturne.  Positions vraies des planètes (éléments de Standish, JPL) et masses de l'éphéméride DE440.
 */
import * as astro from '../../calc/astro';
import * as dc from '../../calc/deux_corps';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, type Rect } from '../../noyau/peintre';
import { Animation, type Coche, nombre, type Reglage } from '../base';

const PLANETES = ['mercure', 'venus', 'terre', 'mars', 'jupiter', 'saturne', 'uranus', 'neptune'];
const R_SOLEIL_UA = astro.R_SOLEIL_KM / astro.UA_KM;
const TRAINEE_ANS = 40.0;
const PAS_ANS = 0.1;

export class BarycentreSolaire extends Animation {
  static override ID = 'ca_extrasolarplanets_starwobble';
  static override LECTURE_AU_DEPART = true;

  annee!: Reglage;
  vitesse_ans!: Reglage;
  cases: Record<string, Coche> = {};
  trainee: [number, number, number][] = [];
  private cle: [string, number] | null = null;

  override construire(): void {
    this.annee = this.curseur('annee', 1800.0, 2050.0, 2026.0, { dec: 1 });
    this.vitesse_ans = this.curseur('ans_par_s', 0.1, 10.0, 2.0, { dec: 1, unite: 'a·s⁻¹', log: true });
    this.cases = {};
    for (const n of PLANETES) this.cases[n] = this.coche('p_' + n, n === 'jupiter' || n === 'saturne');
    this.trainee = [];
    this.cle = null;
  }

  choisies(): string[] {
    return PLANETES.filter((n) => this.cases[n]!.isChecked());
  }

  position(annee: number): [number, number] {
    const [x, y] = dc.soleil_barycentrique((annee - 2000.0) / 100.0, this.choisies());
    return [x / R_SOLEIL_UA, y / R_SOLEIL_UA];
  }

  private recalculer(): void {
    const a1 = this.annee.value();
    const n = Math.trunc(TRAINEE_ANS / PAS_ANS);
    const a0 = Math.max(1800.0, a1 - TRAINEE_ANS);
    this.trainee = [];
    for (let k = 0; k <= n; k++) {
      const a = a0 + PAS_ANS * k;
      if (a <= a1) this.trainee.push([a, ...this.position(a)]);
    }
    this.cle = [this.choisies().join(','), a1];
  }

  private completer(): void {
    const a1 = this.annee.value();
    const cle = this.choisies().join(',');
    const der = this.trainee[this.trainee.length - 1];
    if (this.cle === null || this.cle[0] !== cle || !der || a1 < der[0] || a1 - der[0] > TRAINEE_ANS) {
      this.recalculer();
      return;
    }
    let a = der[0];
    while (a + PAS_ANS <= a1) {
      a += PAS_ANS;
      this.trainee.push([a, ...this.position(a)]);
    }
    while (this.trainee.length && this.trainee[0]![0] < a1 - TRAINEE_ANS) this.trainee.shift();
    this.cle = [cle, a1];
  }

  override avancer(dt: number): void {
    let a = this.annee.value() + dt * this.vitesse_ans.value();
    if (a > 2050.0) a = 1800.0;
    this.annee.setValue(a);
  }

  override valeurs(): [string, string][] {
    const [x, y] = this.position(this.annee.value());
    const d = Math.hypot(x, y);
    const a = this.annee.value();
    return [
      [tr('anim_ca_extrasolarplanets_starwobble_date'), nombre(a, 1).replace(/ /g, '').replace(/ /g, '')],
      [tr('anim_ca_extrasolarplanets_starwobble_distance'), `${nombre(d, 3)} R☉ = ${nombre(d * astro.R_SOLEIL_KM, 0)} km`],
      [tr('anim_ca_extrasolarplanets_starwobble_dehors'), d > 1 ? tr('anim_oui') : tr('anim_non')],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    this.completer();
    const r = dessin.cadre(p, rect, tr('anim_ca_extrasolarplanets_starwobble_titre'));
    const cx = r.cx,
      cy = r.cy;
    const k = Math.min(r.w, r.h) / 2 / 2.6;
    p.setPen(dessin.stylo('grille', 1.0, null, true));
    p.setBrush(null);
    for (const n of [1, 2]) {
      p.drawEllipse(cx, cy, n * k, n * k);
      dessin.texte(p, cx + n * k * 0.707 + 4, cy - n * k * 0.707 - 4, `${n} R☉`, 'doux', { centre: false });
    }
    const [x, y] = this.position(this.annee.value());
    const sx = cx + x * k,
      sy = cy - y * k;
    dessin.disque(p, sx, sy, k, 'soleil', null, 0.35);
    p.setPen(dessin.stylo('soleil', 1.2));
    p.drawEllipse(sx, sy, k, k);
    if (this.trainee.length > 1) {
      p.setPen(dessin.stylo('accent1', 1.6));
      p.drawPolyline(this.trainee.map(([, tx, ty]) => new Pt(cx + tx * k, cy - ty * k)));
    }
    dessin.disque(p, sx, sy, 3.5, 'accent1');
    p.setPen(dessin.stylo('accent3', 2.0));
    p.drawLine(cx - 7, cy, cx + 7, cy);
    p.drawLine(cx, cy - 7, cx, cy + 7);
    dessin.texte(p, cx, cy + 16, tr('anim_c_barycentre'), 'accent3', { fond: true });
    dessin.texte(p, r.left + 8, r.bottom - 8, tr('anim_ca_extrasolarplanets_starwobble_trainee'), 'doux', { centre: false });
  }
}
