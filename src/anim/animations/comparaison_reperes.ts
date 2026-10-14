/**
 * Coordinate Systems Comparison : à gauche la sphère céleste (étoiles fixes, la Terre tourne au centre avec
 * l'observateur et son plan d'horizon), à droite le diagramme d'horizon de l'observateur (le ciel tourne).  Régions
 * circumpolaire, de lever et coucher, jamais levée ; traînées d'étoiles ; Grande Ourse, Orion, Croix du Sud.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import type { Peintre, Rect } from '../../noyau/peintre';
import { alea, linspace, pmod } from '../../noyau/py';
import * as scenes from '../../noyau/scenes';
import { mul, type Pts, type V3 } from '../../noyau/vec';
import { couleur_reelle, reelle } from '../etoiles_reelles';
import { Animation, angle, type Choix, type Coche, heures_minutes, type Reglage } from '../base';

const CONSTELLATIONS: Record<string, [[number, number][], [number, number][]]> = {
  grande_ourse: [
    [[11.06215, 61.75092], [11.03068, 56.38236], [11.89717, 53.69475], [12.25709, 57.03258], [12.90048, 55.95989], [13.39875, 54.92539], [13.79235, 49.31336]],
    [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
  ],
  orion: [
    [[5.91953, 7.40706], [5.67931, -1.94257], [5.60356, -1.20192], [5.53344, -0.29909], [5.41885, 6.3497], [5.79594, -9.6696], [5.2423, -8.20164]],
    [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [1, 5], [3, 6]],
  ],
  croix_du_sud: [
    [[12.4433, -63.09905], [12.51943, -57.11321], [12.79535, -59.68876], [12.25242, -58.74893]],
    [[0, 1], [2, 3]],
  ],
};
const TRAINEES: Record<string, number> = { aucune: 0.0, courtes: 30.0, longues: 90.0 };

type Conv = (pts: Pts) => Pts;

export class ComparaisonReperes extends Animation {
  static override ID = 'celhorcomp';
  static override FICHES = true;
  static HEURES_PAR_S = 1.0;

  celeste!: dessin.Vue3D;
  locale!: dessin.Vue3D;
  lat!: Reglage;
  tsl!: Reglage;
  duree!: Choix;
  trainees!: Choix;
  c_cons: Record<string, Coche> = {};
  c_circ!: Coche;
  c_lever!: Coche;
  c_jamais!: Coche;
  c_equateur!: Coche;
  c_zero!: Coche;
  etoiles: [number, number][] = [];
  private ecoule = 0.0;
  private hasard = alea(7);

  override construire(): void {
    this.celeste = this.vue(225.0, 20.0);
    this.locale = this.vue(200.0, 30.0, 1.0, 89.0);
    this.lat = this.curseur('latitude', -90.0, 90.0, 41.0, { dec: 1, unite: '°', cle_texte: 'anim_c_latitude' });
    this.tsl = this.curseur('tsl', 0.0, 24.0, 6.0, { dec: 2, unite: 'h', cle_texte: 'anim_c_tsl' });
    this.duree = this.choix('duree', [['anim_celhorcomp_continu', 0.0], ['anim_celhorcomp_1h', 1.0], ['anim_celhorcomp_3h', 3.0], ['anim_celhorcomp_6h', 6.0], ['anim_celhorcomp_12h', 12.0]], 0.0);
    this.trainees = this.choix('trainees', [['anim_celhorcomp_aucune', 'aucune'], ['anim_celhorcomp_courtes', 'courtes'], ['anim_celhorcomp_longues', 'longues']], 'aucune');
    this.c_cons = {};
    for (const k of Object.keys(CONSTELLATIONS)) this.c_cons[k] = this.coche(k, k === 'grande_ourse');
    this.c_circ = this.coche('circumpolaire', false);
    this.c_lever = this.coche('lever', false);
    this.c_jamais = this.coche('jamais', false);
    this.c_equateur = this.coche('equateur', true);
    this.c_zero = this.coche('zero', false);
    this.bouton('anim_celhorcomp_ajouter', () => this.ajouter_etoile());
    this.bouton('anim_celhorcomp_retirer', () => this.retirer_etoiles());
    this.etoiles = [];
    this.ecoule = 0.0;
    this.hasard = alea(7);
  }

  ajouter_etoile(): void {
    const z = -1.0 + 2.0 * this.hasard();
    this.etoiles.push([360.0 * this.hasard(), (Math.asin(z) * 180) / Math.PI]);
    this.rafraichir();
  }

  retirer_etoiles(): void {
    this.etoiles = [];
    this.rafraichir();
  }

  override etat_initial(): void {
    this.etoiles = [];
    this.ecoule = 0.0;
  }

  override basculer_lecture(): void {
    this.ecoule = 0.0;
    super.basculer_lecture();
  }

  override avancer(dt: number): void {
    let pas = dt * ComparaisonReperes.HEURES_PAR_S;
    const limite = (this.duree.currentData() as number) || 0.0;
    if (limite && this.ecoule + pas >= limite) {
      pas = limite - this.ecoule;
      this.ecoule = 0.0;
      this.tsl.setValue(pmod(this.tsl.value() + pas, 24.0));
      this.basculer_lecture();
      return;
    }
    this.ecoule += pas;
    this.tsl.setValue(pmod(this.tsl.value() + pas, 24.0));
  }

  override valeurs(): [string, string][] {
    const pl = astro.plages_declinaison(this.lat.value());
    const plage = (x: [number, number] | null): string => (x === null ? tr('anim_latsim_aucune') : `${angle(x[0])} → ${angle(x[1])}`);
    return [
      [tr('anim_c_tsl'), heures_minutes(this.tsl.value())],
      [tr('anim_latsim_circumpolaire'), plage(pl.circumpolaire)],
      [tr('anim_latsim_lever'), plage(pl.lever_coucher)],
      [tr('anim_latsim_jamais'), plage(pl.jamais)],
    ];
  }

  private objets(): [string, [number, number][], [number, number][]][] {
    const out: [string, [number, number][], [number, number][]][] = [];
    for (const [k, [etoiles, traits]] of Object.entries(CONSTELLATIONS))
      if (this.c_cons[k]!.isChecked()) out.push([k, etoiles.map(([a, d]) => [15 * a, d] as [number, number]), traits]);
    out.push(['libres', [...this.etoiles], []]);
    return out;
  }

  private bandes(pe: dessin.Peintre3D, conv: Conv, lat: number): void {
    const pl = astro.plages_declinaison(lat);
    for (const [cle, caseC, coul] of [['circumpolaire', this.c_circ, 'accent1'], ['lever_coucher', this.c_lever, 'accent2'], ['jamais', this.c_jamais, 'accent3']] as [keyof astro.Plages, Coche, string][]) {
      const b = pl[cle];
      if (caseC.isChecked() && b !== null) for (const d of linspace(b[0], b[1], 7)) pe.courbe(conv(scenes.cercle_declinaison(d, 121)), coul, 2.0, 0.55);
    }
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones(rect, 2, 0.8);
    const lat = this.lat.value(),
      tsl = 15 * this.tsl.value();
    const lon_trainee = TRAINEES[this.trainees.currentData() as string]!;
    const objets = this.objets();
    // ---------------------------------------------------------------- sphère céleste
    const r1 = dessin.cadre(p, z[0]!, tr('anim_celhorcomp_celeste'));
    this.zone_rotative(r1, this.celeste);
    const rr = Math.min(r1.w, r1.h) * 0.4;
    const pe = new dessin.Peintre3D(p, this.celeste, r1.cx, r1.cy, rr);
    pe.contour('grille', 'sphere', 0.3);
    const ident: Conv = (x) => x;
    this.bandes(pe, ident, lat);
    if (this.c_equateur.isChecked()) pe.courbe(dessin.cercle([0, 0, 1]), 'equateur', 1.8);
    if (this.c_zero.isChecked()) pe.courbe(scenes.cercle_horaire(0.0), 'equateur', 1.8);
    pe.segment([0, 0, 1], [0, 0, 1.2], 'equateur', 2.0);
    pe.segment([0, 0, -1], [0, 0, -1.2], 'equateur', 2.0);
    const zen = astro.vecteur_equatorial(tsl, lat);
    pe.courbe(dessin.cercle(zen), 'horizon', 2.0);
    pe.point(zen, 'horizon', 4.0);
    const terre = new dessin.Peintre3D(p, this.celeste, r1.cx, r1.cy, rr * 0.18);
    terre.contour('terre', 'terre', 0.6);
    terre.point(zen, 'accent3', 3.5);
    this.dessinEtoiles(pe, objets, ident, 0.0);
    pe.etiquette(mul(zen, 1.12), tr('anim_altazimuth_zenith'), 'horizon');
    // ---------------------------------------------------------------- diagramme d'horizon
    const r2 = dessin.cadre(p, z[1]!, tr('anim_celhorcomp_locale'));
    this.zone_rotative(r2, this.locale);
    const rr2 = Math.min(r2.w, r2.h) * 0.4;
    const conv = scenes.eq_vers_local(tsl, lat);
    const conv1 = (v: V3): V3 => conv([v])[0]!;
    const scene = (pe2: dessin.Peintre3D): void => {
      this.bandes(pe2, conv, lat);
      if (this.c_equateur.isChecked()) pe2.courbe(conv(dessin.cercle([0, 0, 1])), 'equateur', 1.8);
      if (this.c_zero.isChecked()) pe2.courbe(conv(scenes.cercle_horaire(0.0)), 'equateur', 1.8);
      pe2.segment(conv1([0, 0, 1]), conv1([0, 0, 1.2]), 'equateur', 2.0);
      this.dessinEtoiles(pe2, objets, conv, lon_trainee);
    };
    scenes.sphere_locale(p, this.locale, r2.cx, r2.cy + 4, rr2, scene);
  }

  private dessinEtoiles(pe: dessin.Peintre3D, objets: [string, [number, number][], [number, number][]][], conv: Conv, lon_trainee: number): void {
    for (const [nom, etoiles, traits] of objets) {
      const pts = etoiles.map(([a, d]) => astro.vecteur_equatorial(a, d));
      for (const [i, j] of traits) pe.courbe(conv(dessin.arc(pts[i]!, pts[j]!, 12)), 'accent1', 1.4, 0.8);
      etoiles.forEach(([a, d], k) => {
        if (lon_trainee > 0) pe.courbe(conv(scenes.arc_equateur(a, a + lon_trainee, d, 30)), 'etoile', 1.0, 0.45);
        // étoiles réelles des constellations : couleur vraie et fiche ; étoiles « libres » (au hasard) : couleur du thème
        const f = nom !== 'libres' ? reelle('celhorcomp', `${nom}_${k}`) : null;
        const q = pe.point(conv([pts[k]!])[0]!, (f && couleur_reelle('celhorcomp', `${nom}_${k}`)) || 'etoile', 3.0, { bord: f && dessin.theme() === 'clair' ? 'doux' : null });
        if (q && q[2] && f) this.survolable(pe.p, f.fiche, q[0], q[1], 6, k);
      });
    }
  }
}
