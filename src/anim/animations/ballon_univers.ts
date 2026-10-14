/**
 * Balloon Universe : un ballon qui se gonfle, des galaxies collées à sa surface.  Les galaxies ne grandissent pas,
 * mais leurs distances, mesurées le long de la surface, augmentent toutes dans la même proportion : vue de n'importe
 * quelle galaxie, les autres s'éloignent à une vitesse proportionnelle à leur distance, v = H d avec
 * H = (da/dt) / a (loi de Hubble-Lemaître), et aucune n'est au centre.
 */
import LOT3 from '../../donnees/genere/lot3.json';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import type { Peintre, Rect } from '../../noyau/peintre';
import type { Pts } from '../../noyau/vec';
import { Animation, type Coche, nombre, type Reglage } from '../base';

const A_MIN = 1.0,
  A_MAX = 3.0;
/** Directions tirées comme dans Coupole (numpy, graine 9), exportées telles quelles. */
const DIRS = (LOT3 as unknown as { ballon_directions: Pts }).ballon_directions;

function argsort(t: readonly number[]): number[] {
  return t.map((_, i) => i).sort((a, b) => t[a]! - t[b]! || a - b);
}

export class BallonUnivers extends Animation {
  static override ID = 'balloon';

  a!: Reglage;
  taux!: Reglage;
  c_distances!: Coche;
  vue3d!: dessin.Vue3D;

  override construire(): void {
    this.a = this.curseur('rayon', A_MIN, A_MAX, A_MIN, { dec: 3 });
    this.taux = this.curseur('taux', 0.02, 0.5, 0.1, { dec: 3, unite: 's⁻¹' });
    this.c_distances = this.coche('distances', true);
    this.vue3d = this.vue(200.0, 25.0);
  }

  override avancer(dt: number): void {
    let a = this.a.value() + this.taux.value() * dt;
    if (a >= A_MAX) {
      a = A_MAX;
      this.arreter();
    }
    this.a.setValue(a);
  }

  /** Distances le long de la surface depuis la galaxie de référence : d = a θ. */
  distances(): number[] {
    const d0 = DIRS[0]!;
    return DIRS.map((v) => this.a.value() * Math.acos(Math.max(-1.0, Math.min(1.0, v[0]! * d0[0]! + v[1]! * d0[1]! + v[2]! * d0[2]!))));
  }

  override valeurs(): [string, string][] {
    const d = this.distances();
    const h = this.taux.value() / this.a.value();
    return [
      [tr('anim_balloon_rayon_v'), nombre(this.a.value(), 3)],
      [tr('anim_balloon_h'), `${nombre(h, 4)} s⁻¹`],
      [tr('anim_balloon_age'), `${nombre(1 / h, 1)} s`],
      [tr('anim_balloon_plus_proche'), nombre([...d].sort((x, y) => x - y)[1]!, 3)],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones(rect, 2, 0.95);
    const r = dessin.cadre(p, z[0]!, tr('anim_balloon_titre_ballon'));
    this.zone_rotative(r, this.vue3d);
    const cx = r.cx,
      cy = r.cy;
    const R = (Math.min(r.w, r.h) * 0.45 * this.a.value()) / A_MAX;
    const pe = new dessin.Peintre3D(p, this.vue3d, cx, cy, R);
    pe.contour('grille', 'arc2', 0.18);
    const { xs, ys, zs } = pe.ecran(DIRS, true);
    const taille = Math.min(r.w, r.h) * 0.011;
    for (const k of argsort(zs)) {
      const devant = zs[k]! >= 0;
      p.setPen(null);
      p.setBrush(dessin.c(k === 0 ? 'accent1' : 'accent2', devant ? 1.0 : 0.25));
      p.drawEllipse(xs[k]!, ys[k]!, taille * 1.4, taille * 0.8);
    }
    const d = this.distances();
    if (this.c_distances.isChecked()) {
      for (const k of argsort(d).slice(1, 6)) pe.courbe(dessin.arc(DIRS[0]!, DIRS[k]!, 30), 'accent1', 1.2, 0.8, { arriere: 'cache', repere_monde: true });
    }
    dessin.texte(p, xs[0]!, ys[0]! - 14, tr('anim_balloon_nous'), 'accent1', { fond: true });
    const r2 = dessin.cadre(p, z[1]!, tr('anim_balloon_titre_hubble'));
    const h = this.taux.value() / this.a.value();
    const dmax = A_MAX * Math.PI;
    const ax = new Axes(r2, 0, dmax, 0, this.taux.value() * Math.PI * 1.1, false, false, [46, 10, 10, 30]).avec(p);
    ax.fond(p, { titre_x: tr('anim_balloon_axe_d'), titre_y: tr('anim_balloon_axe_v') });
    ax.points(d.slice(1).map((x) => [x, h * x] as [number, number]), 'accent2', 3.5, 0.9);
    ax.courbe([[0, 0], [dmax, h * dmax]], 'accent1', 1.2, 0.8, true);
  }
}
