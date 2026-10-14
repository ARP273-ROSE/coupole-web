/**
 * Moon Phases With Bisectors : trouver la phase avec deux plans.  Le plan perpendiculaire à la direction du Soleil
 * coupe la Lune en une moitié éclairée et une moitié dans la nuit ; le plan perpendiculaire à la ligne Terre–Lune la
 * coupe en une moitié tournée vers la Terre et une moitié cachée.  Les deux plans font l'angle de phase.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, type Rect } from '../../noyau/peintre';
import { linspace, pmod } from '../../noyau/py';
import { add, mul, norme, type Pts, type V3 } from '../../noyau/vec';
import { Animation, angle, type Coche, nombre, type Reglage } from '../base';

const R_TERRE = 0.22,
  R_LUNE = 0.12,
  D_LUNE = 1.0;
const DEMI_PLAN = 0.34;

function vecteur(a_deg: number): V3 {
  const a = (a_deg * Math.PI) / 180;
  return [Math.cos(a), Math.sin(a), 0.0];
}

/** Carré (4 coins) du plan passant par `centre` et perpendiculaire à `normale`. */
export function plan_bissecteur(centre: readonly number[], normale: readonly number[], demi = DEMI_PLAN): Pts {
  const w: V3 = [-normale[1]!, normale[0]!, 0.0];
  const z: V3 = [0.0, 0.0, 1.0];
  const c: V3 = [centre[0]!, centre[1]!, centre[2]!];
  return [
    add(c, mul(add(w, z), demi)),
    add(c, mul(add(mul(w, -1), z), demi)),
    add(c, mul(add(mul(w, -1), mul(z, -1)), demi)),
    add(c, mul(add(w, mul(z, -1)), demi)),
  ];
}

type Objet = [number, 'corps', [Pt, number, string]] | [number, 'plan', [Pts, string]];

export class PlansBissecteurs extends Animation {
  static override ID = 'moonbisector';
  static JOURS_PAR_S = 1.5;

  vue3d!: dessin.Vue3D;
  soleil!: Reglage;
  lune!: Reglage;
  c1!: Coche;
  c2!: Coche;
  c3!: Coche;
  c4!: Coche;
  c5!: Coche;
  c6!: Coche;

  override construire(): void {
    this.vue3d = this.vue(240.0, 30.0, -89.0, 89.0);
    this.soleil = this.curseur('soleil', 0.0, 360.0, 0.0, { dec: 0, unite: '°' });
    this.lune = this.curseur('lune', 0.0, 360.0, 60.0, { dec: 0, unite: '°' });
    this.c1 = this.coche('etape1', true);
    this.c2 = this.coche('etape2', true);
    this.c3 = this.coche('etape3', true);
    this.c4 = this.coche('etape4', true);
    this.c5 = this.coche('etape5', true);
    this.c6 = this.coche('etape6', true);
    this.bouton('anim_moonbisector_dessus', () => this.changerVue(270.0, 89.0));
    this.bouton('anim_moonbisector_cote', () => this.changerVue(240.0, 30.0));
  }

  private changerVue(az: number, alt: number): void {
    this.vue3d.regler(az, alt);
    this.hote.rafraichir();
  }

  override avancer(dt: number): void {
    this.lune.setValue(pmod(this.lune.value() + (360.0 * dt * PlansBissecteurs.JOURS_PAR_S) / astro.MOIS_SYNODIQUE_J, 360.0));
  }

  elongation(): number {
    return pmod(this.lune.value() - this.soleil.value(), 360.0);
  }

  override valeurs(): [string, string][] {
    const e = this.elongation();
    const m = mul(vecteur(this.lune.value()), D_LUNE);
    const i = astro.angle_de_phase(m, add(m, mul(vecteur(this.soleil.value()), 100)), [0.0, 0.0, 0.0]);
    return [
      [tr('anim_lunar_applet_nom_phase'), tr('anim_phase_' + astro.nom_de_phase(e))],
      [tr('anim_moonbisector_angle_plans'), angle(i, 0)],
      [tr('anim_c_eclairee'), `${nombre(100 * astro.fraction_eclairee_phase(i), 1)} %`],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = rect.w > rect.h * 1.1 ? dessin.zones_principale(rect, 1, 0.68) : dessin.zones(rect, 2, 10);
    this.espace(p, dessin.cadre(p, z[0]!, tr('anim_moonbisector_espace')));
    const r = dessin.cadre(p, z[1]!, tr('anim_moonbisector_disque'));
    if (this.c6.isChecked()) dessin.phase_lune(p, r.cx, r.cy, Math.min(r.w, r.h) * 0.34, this.elongation());
  }

  private espace(p: Peintre, r: Rect): void {
    this.zone_rotative(r, this.vue3d);
    const cx = r.cx,
      cy = r.cy;
    const k = Math.min(r.w, r.h) * 0.36;
    const v = this.vue3d;
    const s = vecteur(this.soleil.value());
    const m = mul(vecteur(this.lune.value()), D_LUNE);
    const tm = mul(m, 1 / norme(m));
    const ecran = (pt: readonly number[]): [Pt, number] => {
      const [x, y, d] = v.projeter1(pt);
      return [new Pt(cx + k * x, cy - k * y), d];
    };
    const orbite = linspace(0, 2 * Math.PI, 121).map((t) => ecran([Math.cos(t) * D_LUNE, Math.sin(t) * D_LUNE, 0])[0]);
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(null);
    p.drawPolyline(orbite);
    if (this.c1.isChecked()) {
      for (const c of [[0, 0, 0], m] as V3[]) {
        const [a] = ecran(add(c, mul(s, 0.42)));
        const [b] = ecran(add(c, mul(s, 0.72)));
        dessin.fleche(p, b.x, b.y, a.x, a.y, dessin.stylo('soleil', 1.6), 7);
      }
    }
    if (this.c4.isChecked()) {
      const [a] = ecran([0, 0, 0]);
      const [b] = ecran(m);
      p.setPen(dessin.stylo('accent2', 1.4, null, true));
      p.drawLineP(a, b);
    }
    const objets: Objet[] = [];
    const profondeurMoyenne = (q: Pts): number => q.reduce((acc, pt) => acc + v.projeter1(pt)[2], 0) / q.length;
    for (const [centre, rayon, cle] of [[[0.0, 0.0, 0.0], R_TERRE, 'terre'], [m, R_LUNE, 'lune']] as [V3, number, string][]) {
      const [pt, d] = ecran(centre);
      objets.push([d, 'corps', [pt, rayon, cle]]);
      if (this.c2.isChecked()) {
        const q = plan_bissecteur(centre, s, rayon * 1.7);
        objets.push([profondeurMoyenne(q), 'plan', [q, 'soleil']]);
      }
      if (this.c5.isChecked()) {
        const q = plan_bissecteur(centre, tm, rayon * 1.7);
        objets.push([profondeurMoyenne(q), 'plan', [q, 'accent2']]);
      }
    }
    objets.sort((a, b) => a[0] - b[0]);
    for (const o of objets) {
      if (o[1] === 'corps') {
        const [pt, rayon, cle] = o[2];
        const pe = new dessin.Peintre3D(p, v, pt.x, pt.y, k * rayon);
        dessin.disque(p, pt.x, pt.y, k * rayon, cle);
        if (this.c3.isChecked()) dessin.hemisphere_nuit(pe, s, 'nuit', 0.75);
      } else {
        const [q, cle] = o[2];
        p.setPen(dessin.stylo(cle, 1.2, 0.9));
        p.setBrush(dessin.c(cle, 0.22));
        p.drawPolygon(q.map((pt) => ecran(pt)[0]));
      }
    }
  }
}
