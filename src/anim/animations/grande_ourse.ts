/**
 * Big Dipper 3D : les sept étoiles de la Grande Ourse sont à des distances très différentes (de 78 à 124
 * années-lumière) ; vues de la Terre, elles se projettent sur la sphère céleste en l'astérisme familier.  Tourner la
 * vue montre qu'il n'y a aucune figure dans l'espace.  Positions J2000 et distances (Hipparcos) de l'original.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import type { Peintre, Rect } from '../../noyau/peintre';
import { linspace } from '../../noyau/py';
import { mul, type Pts } from '../../noyau/vec';
import { Animation, type Coche, nombre } from '../base';

const ETOILES: [string, number, number, number, number][] = [
  ['Dubhe', 11.06215, 61.75092, 123.6, 2.5], ['Merak', 11.03068, 56.38236, 79.4, 1.2],
  ['Phecda', 11.89717, 53.69475, 83.7, 1.5], ['Megrez', 12.25709, 57.03258, 81.4, 1.2],
  ['Alioth', 12.90048, 55.95989, 80.9, 1.2], ['Mizar', 13.39875, 54.92539, 78.2, 1.1],
  ['Alkaid', 13.79235, 49.31336, 100.7, 2.3],
];
const TRAITS: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]];
const RAYON_AL = 250.0;
const CENTRE = astro.vecteur_equatorial(15 * 12.5, 55.0);

export class GrandeOurse extends Animation {
  static override ID = 'bigdipper';
  static override ANIMEE = false;

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
    return ETOILES.map((e) => [e[0], `${nombre(e[3], 1)} ± ${nombre(e[4], 1)} al`]);
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
    ETOILES.forEach(([nom, , , dist, err], k) => {
      const v = pts[k]!;
      const reel = mul(v, dist / RAYON_AL);
      if (this.c_lignes.isChecked()) pe.segment([0, 0, 0], v, 'doux', 0.8, 0.35);
      pe.segment(mul(v, (dist - err) / RAYON_AL), mul(v, (dist + err) / RAYON_AL), 'accent2', 3.0);
      pe.point(reel, 'etoile', 4.5, { bord: 'soleil', toujours: true, etiquette: this.c_noms.isChecked() ? `${nom} (${nombre(dist, 0)} al)` : null });
      if (this.c_sphere.isChecked()) pe.point(v, 'accent1', 3.0, { toujours: true });
    });
    pe.point([0, 0, 0], 'terre', 6.0, { toujours: true, etiquette: tr('anim_shadowsim_terre') });
  }
}
