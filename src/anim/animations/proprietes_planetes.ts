/**
 * Solar System Properties Explorer : histogrammes des propriétés des planètes (telluriques, géantes) et de Pluton :
 * distance au Soleil, période orbitale, masse, rayon, nombre de satellites, rotation, densité.  Valeurs de la NASA
 * Planetary Fact Sheet (2026), rapportées à la Terre.
 */
import LOT3 from '../../donnees/genere/lot3.json';
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, Rect } from '../../noyau/peintre';
import { Animation, type Choix, type Coche, nombre } from '../base';

type Planete = [string, number, number, number, number, number, number, number, string];
const FICHE = (LOT3 as unknown as { planetes_fiche: Planete[] }).planetes_fiche;
const TERRE = FICHE[2]!;
const PROPRIETES = ['distance', 'periode', 'masse', 'rayon', 'satellites', 'rotation', 'densite'];
const COULEURS: Record<string, string> = { tellurique: 'accent3', geante: 'accent2', naine: 'accent1' };

export function valeur(planete: Planete, prop: string): number {
  const [, masse, diam, dens, rot, dist, per, sat] = planete;
  return ({
    distance: (dist * 1e6) / astro.UA_KM, periode: per / astro.ANNEE_SIDERALE_J, masse: masse / TERRE[1], rayon: diam / TERRE[2],
    satellites: sat, rotation: rot / 24.0, densite: dens / 1000.0,
  } as Record<string, number>)[prop]!;
}

export class ProprietesPlanetes extends Animation {
  static override ID = 'solarsystemproperties';
  static override ANIMEE = false;

  prop!: Choix;
  cases: Record<string, Coche> = {};
  c_log!: Coche;

  override construire(): void {
    this.prop = this.choix('propriete', PROPRIETES.map((k) => ['anim_solarsystemproperties_p_' + k, k] as [string, string]), 'distance');
    this.cases = {};
    for (const g of ['tellurique', 'geante', 'naine']) this.cases[g] = this.coche('g_' + g, true);
    this.c_log = this.coche('log', false);
  }

  planetes(): Planete[] {
    return FICHE.filter((pl) => this.cases[pl[8]]!.isChecked());
  }

  override valeurs(): [string, string][] {
    const prop = this.prop.currentData() as string;
    return this.planetes().map((pl) => {
      const v = valeur(pl, prop);
      return [tr('anim_planete_' + pl[0]), nombre(v, prop === 'satellites' ? 0 : Math.abs(v) < 10 ? 3 : 1)];
    });
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const prop = this.prop.currentData() as string;
    const pls = this.planetes();
    const r = dessin.cadre(p, rect, `${tr('anim_solarsystemproperties_p_' + prop)} (${tr('anim_solarsystemproperties_u_' + prop)})`);
    if (!pls.length) return;
    const vals = pls.map((pl) => valeur(pl, prop));
    const log = this.c_log.isChecked() && prop !== 'rotation' && Math.min(...vals) > 0;
    let lo: number, hi: number, ax: Axes;
    if (log) {
      lo = 10 ** Math.floor(Math.log10(Math.min(...vals)));
      hi = 10 ** Math.ceil(Math.log10(Math.max(...vals)));
      ax = new Axes(r, 0, pls.length, lo, hi, false, true, [52, 10, 10, 34]).avec(p);
    } else {
      lo = Math.min(0.0, Math.min(...vals) * 1.1);
      hi = Math.max(...vals) > 0 ? Math.max(...vals) * 1.1 : 1.0;
      ax = new Axes(r, 0, pls.length, lo, hi, false, false, [52, 10, 10, 34]).avec(p);
    }
    ax.fond(p, { fmt_x: () => '', n_x: 1 });
    const base = log ? lo : 0.0;
    pls.forEach((pl, k) => {
      const v = vals[k]!;
      const x0 = ax.px(k + 0.18),
        x1 = ax.px(k + 0.82);
      const y0 = ax.py(base),
        y1 = ax.py(v);
      p.fillRect(new Rect(x0, Math.min(y0, y1), x1 - x0, Math.abs(y1 - y0)), dessin.c(COULEURS[pl[8]]!, 0.8));
      dessin.police(p, 0.85);
      dessin.texte(p, (x0 + x1) / 2, ax.r.bottom + 11, tr('anim_planete_' + pl[0]), 'texte');
      dessin.texte(p, (x0 + x1) / 2, Math.min(y0, y1) - 8, nombre(v, prop === 'satellites' ? 0 : Math.abs(v) < 10 ? 2 : 0), 'doux');
      dessin.police(p, 1 / 0.85);
    });
  }
}
