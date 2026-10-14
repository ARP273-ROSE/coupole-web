/**
 * Planet Formation Temperatures Plot : la température de la nébuleuse solaire décroissait avec la distance au Soleil.
 * Selon la température, chaque substance était gazeuse ou solide : métaux et silicates condensent près du Soleil
 * (planètes telluriques), glaces d'eau, d'ammoniac et de méthane au-delà de la « ligne des glaces » (planètes
 * géantes).  Modèle de l'original : loi de puissance passant par 600 K à 1 ua et 175 K à 5,2 ua,
 * T = 600 K × (d / 1 ua)^−0,747 ; températures de condensation de l'original.
 */
import LOT3 from '../../donnees/genere/lot3.json';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, Rect } from '../../noyau/peintre';
import { Animation, nombre, type Reglage } from '../base';

const D = LOT3 as unknown as {
  condensation_k: [string, number][];
  formation_terre: [number, number];
  formation_jupiter: [number, number];
  distances_ua: [string, number][];
};
const [D0, T0] = D.formation_terre;
const [D1, T1] = D.formation_jupiter;
export const PENTE = Math.log(T0 / T1) / Math.log(D1 / D0);

export function temperature(d_ua: number): number {
  return T0 * (d_ua / D0) ** -PENTE;
}

export function distance(t: number): number {
  return D0 * (T0 / t) ** (1 / PENTE);
}

export class TemperaturesFormation extends Animation {
  static override ID = 'formationtemps';
  static override ANIMEE = false;

  t!: Reglage;

  override construire(): void {
    this.t = this.curseur('temperature', 20.0, 2000.0, 175.0, { dec: 0, unite: 'K', log: true });
  }

  override valeurs(): [string, string][] {
    const t = this.t.value();
    const solides = D.condensation_k.filter(([, tc]) => t <= tc).map(([n]) => tr('anim_formationtemps_s_' + n));
    return [
      [tr('anim_formationtemps_distance'), `${nombre(distance(t), 2)} ${tr('anim_c_ua')}`],
      [tr('anim_formationtemps_solides'), solides.join(', ') || tr('anim_c_aucun')],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = rect.w >= 640 ? dessin.zones_principale(rect, 1, 0.62) : dessin.zones(rect, 2, 10.0);
    const r = dessin.cadre(p, z[0]!, tr('anim_formationtemps_titre'));
    const ax = new Axes(r, 0.1, 50.0, 20.0, 2000.0, true, true, [50, 10, 12, 30]).avec(p);
    ax.fond(p, { titre_x: tr('anim_formationtemps_axe_d'), titre_y: tr('anim_formationtemps_axe_t') });
    const pts: [number, number][] = [];
    for (let k = 0; k < 136; k++) {
      const d = 0.1 * 10 ** (k / 50);
      pts.push([d, temperature(d)]);
    }
    ax.courbe(pts, 'accent1', 2.5);
    dessin.police(p, 0.85);
    for (const [nom, d] of D.distances_ua) {
      const t = temperature(d);
      ax.points([[d, t]], 'equateur', 5, 1.0);
      dessin.texte(p, ax.px(d) + 6, ax.py(t) - 10, tr('anim_planete_' + nom), 'texte', { centre: false });
    }
    dessin.police(p, 1 / 0.85);
    const t = this.t.value();
    ax.horizontale(t, 'accent3', 1.2, true);
    ax.verticale(distance(t), 'accent3', 1.2, true);
    ax.points([[distance(t), t]], 'accent3', 7, 1.0);
    const rt = dessin.cadre(p, z[1]!, tr('anim_formationtemps_titre_etats'));
    const n = D.condensation_k.length;
    const h = rt.h / n;
    dessin.police(p, 0.9);
    D.condensation_k.forEach(([nom, tc], k) => {
      const y = rt.top + k * h;
      const solide = t <= tc;
      p.fillRect(new Rect(rt.left, y + 2, rt.w, h - 4), dessin.c(solide ? 'accent2' : 'grille', 0.25));
      dessin.texte(p, rt.left + 6, y + h / 2 + 4, `${tr('anim_formationtemps_s_' + nom)} (${Math.trunc(tc)} K)`, 'texte', { centre: false });
      const etat = tr(solide ? 'anim_formationtemps_solide' : 'anim_formationtemps_gaz');
      dessin.texte(p, rt.right - 6 - p.fontMetrics().horizontalAdvance(etat), y + h / 2 + 4, etat, solide ? 'accent2' : 'doux', { centre: false });
    });
    dessin.police(p, 1 / 0.9);
  }
}
