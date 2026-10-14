/**
 * Big Dipper 3D : les sept étoiles de la Grande Ourse sont à des distances très différentes (de 81 à 123
 * années-lumière) ; vues de la Terre, elles se projettent sur la sphère céleste en l'astérisme familier.  Tourner la
 * vue montre qu'il n'y a aucune figure dans l'espace.  Positions J2000 de l'original ; distances mises à jour
 * (parallaxes adoptées par SIMBAD : Hipparcos 2007, Gaia), couleur vraie et fiche au survol de chaque étoile.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import type { Peintre, Rect } from '../../noyau/peintre';
import { linspace } from '../../noyau/py';
import { mul, type Pts } from '../../noyau/vec';
import { Animation, type Coche, nombre } from '../base';
import { couleur_reelle, reelle } from '../etoiles_reelles';

/** nom, α (h), δ (°) J2000 de l'original ; distance (al) et barres d'erreur −/+ : parallaxes adoptées par SIMBAD */
const ETOILES: [string, number, number, number, number, number][] = (
  [['Dubhe', 11.06215, 61.75092], ['Merak', 11.03068, 56.38236], ['Phecda', 11.89717, 53.69475],
    ['Megrez', 12.25709, 57.03258], ['Alioth', 12.90048, 55.95989], ['Mizar', 13.39875, 54.92539],
    ['Alkaid', 13.79235, 49.31336]] as [string, number, number][]
).map(([n, a, d]) => {
  const e = reelle('bigdipper', n)!;
  return [n, a, d, e.al!, e.al_moins!, e.al_plus!];
});

/** « 84,5 ± 2,4 » ou « 84,5 (−2,4/+2,5) » */
function avec_ecart(v: number, moins: number, plus: number): string {
  return Math.abs(moins - plus) < 0.05 ? `${nombre(v, 1)} ± ${nombre(moins, 1)}` : `${nombre(v, 1)} (−${nombre(moins, 1)}/+${nombre(plus, 1)})`;
}
const TRAITS: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]];
const RAYON_AL = 250.0;
const CENTRE = astro.vecteur_equatorial(15 * 12.5, 55.0);

export class GrandeOurse extends Animation {
  static override ID = 'bigdipper';
  static override ANIMEE = false;
  static override FICHES = true;

  vue3d!: dessin.Vue3D;
  c_lignes!: Coche;
  c_noms!: Coche;
  c_sphere!: Coche;

  override construire(): void {
    this.vue3d = this.vue(262.5, 15.0, -89.0, 89.0);
    this.c_lignes = this.coche('lignes', true);
    this.c_noms = this.coche('noms', true);
    this.c_sphere = this.coche('sphere', true);
  }

  override valeurs(): [string, string][] {
    return [...ETOILES.map((e) => [e[0], `${avec_ecart(e[3], e[4], e[5])} al`] as [string, string]), [tr('anim_bigdipper_source'), tr('anim_bigdipper_source_v')]];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    this.zone_rotative(rect, this.vue3d);
    const r = Math.min(rect.w * 0.75, rect.h * 1.1);
    const [x, y] = this.vue3d.projeter1(mul(CENTRE, 0.62));
    const cx = rect.cx - r * x;
    const cy = rect.cy + r * y;
    const pe = new dessin.Peintre3D(p, this.vue3d, cx, cy, r);
    const pts = ETOILES.map(([, a, d]) => astro.vecteur_equatorial(15 * a, d));
    const plat = { arriere: 'normal' as const, profondeur: false };
    if (this.c_sphere.isChecked()) {
      for (const dec of [50, 55, 60]) pe.courbe(dessin.cercle([0, 0, 1], 90 - dec, 361, 0, 360).slice(150, 220), 'grille', 1.0, 1.0, plat);
      for (const h of [11, 12, 13, 14]) {
        const a = (15 * h * Math.PI) / 180;
        const arcH: Pts = linspace(46, 65, 30).map((dd) => {
          const d = (dd * Math.PI) / 180;
          return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
        });
        pe.courbe(arcH, 'grille', 1.0, 1.0, plat);
      }
      for (const [i, j] of TRAITS) pe.courbe(dessin.arc(pts[i]!, pts[j]!, 10), 'accent1', 1.6, 1.0, plat);
    }
    // étiquettes placées sans chevauchement : on réserve d'abord la place de toutes les étoiles
    const reels = ETOILES.map(([, , , dist], k) => mul(pts[k]!, dist / RAYON_AL));
    for (const v of [...reels, ...(this.c_sphere.isChecked() ? pts : []), [0, 0, 0]]) {
      const e = pe.ecran(v);
      dessin.reserver(p, e.xs[0]!, e.ys[0]!, 6);
    }
    const noms: [number, number, string][] = [];
    ETOILES.forEach(([nom, , , dist, moins, plus], k) => {
      const v = pts[k]!;
      if (this.c_lignes.isChecked()) pe.segment([0, 0, 0], v, 'doux', 0.8, 0.35);
      pe.segment(mul(v, (dist - moins) / RAYON_AL), mul(v, (dist + plus) / RAYON_AL), 'accent2', 3.0);
      const q = pe.point(reels[k]!, couleur_reelle('bigdipper', nom) ?? 'etoile', 4.5, { bord: 'grille', toujours: true });
      if (q) this.survolable(p, reelle('bigdipper', nom)!.fiche, q[0], q[1], 7, k);
      if (q && this.c_noms.isChecked()) noms.push([q[0], q[1], `${nom} (${nombre(dist, 0)} al)`]);
      if (this.c_sphere.isChecked()) pe.point(v, 'accent1', 3.0, { toujours: true });
    });
    const t = pe.point([0, 0, 0], 'terre', 6.0, { toujours: true });
    for (const [x, y, s] of noms) dessin.etiquette(p, x, y, s, 'texte', 8);
    if (t) dessin.etiquette(p, t[0], t[1], tr('anim_shadowsim_terre'), 'texte', 9);
  }
}
