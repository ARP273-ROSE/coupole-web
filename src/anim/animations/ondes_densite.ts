/**
 * Traffic Density Analogy : un tracteur lent sur une route ; les voitures ralentissent pour le dépasser, se serrent
 * derrière lui, puis repartent.  Le bouchon avance avec le tracteur, mais ce ne sont jamais les mêmes voitures qui le
 * forment.  Les bras spiraux d'une galaxie sont des ondes de densité du même genre.  Conservation du débit dans le
 * repère du tracteur : n_bouchon (v_lente − v_tracteur) = n (v − v_tracteur).
 */
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import { Animation, nombre, type Reglage } from '../base';

const ARRIERE = 640.0,
  AVANT = 260.0;
const ZONE = 120.0;
const ESPACEMENT = 33.0;
const LONGUEUR_VOITURE = 4.5;

/** Densité dans la zone lente / densité ailleurs (régime établi) : (v − v_t) / (v_lente − v_t). */
export function rapport_densite(v: number, v_lente: number, v_tracteur: number): number {
  return (v - v_tracteur) / (v_lente - v_tracteur);
}

function dans_zone(u: number): boolean {
  return -ZONE <= u && u < 0.0;
}

export class OndesDensite extends Animation {
  static override ID = 'trafficdensity';
  static override LECTURE_AU_DEPART = true;

  v!: Reglage;
  v_lente!: Reglage;
  v_tracteur!: Reglage;
  u: number[] = [];
  injection = 0.0;
  route = 0.0;

  override construire(): void {
    this.v = this.curseur('vitesse', 15.0, 40.0, 30.0, { dec: 1, unite: 'm·s⁻¹' });
    this.v_lente = this.curseur('lente', 4.0, 14.0, 10.0, { dec: 1, unite: 'm·s⁻¹' });
    this.v_tracteur = this.curseur('v_tracteur', 1.0, 12.0, 5.0, { dec: 1, unite: 'm·s⁻¹' });
    this.etat_initial();
  }

  override etat_initial(): void {
    const n = Math.trunc((ARRIERE + AVANT) / ESPACEMENT);
    this.u = [];
    for (let k = 0; k < n; k++) this.u.push(-ARRIERE + k * ESPACEMENT);
    this.injection = 0.0;
    this.route = 0.0;
  }

  vitesses(): [number, number, number] {
    const vt = Math.min(this.v_tracteur.value(), this.v_lente.value() - 0.5);
    return [this.v.value(), this.v_lente.value(), vt];
  }

  override avancer(dt: number): void {
    const [v, vl, vt] = this.vitesses();
    for (let i = 0; i < 4; i++) {
      const h = dt / 4;
      this.u = this.u.filter((u) => u <= AVANT).map((u) => u + ((dans_zone(u) ? vl : v) - vt) * h);
      this.injection += (v - vt) * h;
      while (this.injection >= ESPACEMENT) {
        this.injection -= ESPACEMENT;
        this.u.unshift(-ARRIERE + this.injection);
      }
      this.route = pmod(this.route + vt * h, 20.0);
    }
  }

  densites(): [number, number] {
    const dedans = this.u.filter(dans_zone).length;
    const derriere = this.u.filter((u) => -ARRIERE + 40 <= u && u < -ZONE - 40).length;
    return [dedans, derriere ? dedans / ZONE / (derriere / (ARRIERE - ZONE - 80)) : 0.0];
  }

  override valeurs(): [string, string][] {
    const [v, vl, vt] = this.vitesses();
    const [dedans, mesure] = this.densites();
    return [
      [tr('anim_trafficdensity_prevu'), `× ${nombre(rapport_densite(v, vl, vt), 2)}`],
      [tr('anim_trafficdensity_mesure'), `× ${nombre(mesure, 2)}`],
      [tr('anim_trafficdensity_dans_zone'), String(dedans)],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const r = dessin.cadre(p, rect, tr('anim_trafficdensity_titre'));
    const k = (r.w - 20) / (ARRIERE + AVANT);
    const x_de = (u: number): number => r.left + 10 + (u + ARRIERE) * k;
    const y = r.top + r.h * 0.35;
    p.fillRect(new Rect(r.left + 6, y - 22, r.w - 12, 44), dessin.c('sphere', 0.6));
    p.fillRect(new Rect(x_de(-ZONE), y - 22, ZONE * k, 44), dessin.c('accent3', 0.15));
    p.setPen(dessin.stylo('grille', 2.0));
    let u = -ARRIERE - this.route;
    const traits: [number, number, number, number][] = [];
    while (u < AVANT) {
      traits.push([x_de(u), y, x_de(u + 8), y]);
      u += 20.0;
    }
    p.drawLines(traits);
    const lv = Math.max(3.0, LONGUEUR_VOITURE * k);
    for (const uu of this.u) p.fillRect(new Rect(x_de(uu) - lv, y + 6, lv, 9), dessin.c('accent2'));
    p.fillRect(new Rect(x_de(0.0), y - 16, Math.max(6.0, 6 * k), 12), dessin.c('horizon'));
    dessin.texte(p, x_de(0.0), y - 32, tr('anim_trafficdensity_tracteur'), 'horizon', { fond: true });
    dessin.texte(p, x_de(-ZONE / 2), y + 34, tr('anim_trafficdensity_zone'), 'accent3', { fond: true });
    const yb = r.top + r.h * 0.62;
    const hb = r.bottom - yb - 6;
    const nb = 36;
    const w = (r.w - 20) / nb;
    const comptes = new Array<number>(nb).fill(0);
    for (const uu of this.u) {
      const i = Math.trunc(((uu + ARRIERE) / (ARRIERE + AVANT)) * nb);
      if (0 <= i && i < nb) comptes[i]! += 1;
    }
    const mx = Math.max(...comptes) || 1;
    comptes.forEach((c, i) => {
      const h = (hb * c) / mx;
      p.fillRect(new Rect(r.left + 10 + i * w, yb + hb - h, w - 1, h), dessin.c('accent2', 0.6));
    });
    dessin.texte(p, r.left + 10, yb - 6, tr('anim_trafficdensity_densite'), 'doux', { centre: false });
  }
}
