/**
 * Aliasing in Wagon Wheels : une roue qui tourne, vue seulement à intervalles réguliers, paraît tourner moins vite,
 * s'arrêter ou même tourner à l'envers : c'est le repliement (« aliasing »).  Entre deux images la roue tourne de
 * Δθ = 360° Δt / P ; à cause de sa symétrie (n rayons), on ne voit que Δθ ramené dans ]−180°/n, 180°/n].
 */
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import type { Peintre, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import { Animation, type Choix, nombre, type Reglage } from '../base';

export function pas_apparent(periode_s: number, cadence_hz: number, rayons: number): number {
  const sym = 360.0 / rayons;
  const d = pmod(360.0 / (periode_s * cadence_hz), sym);
  return d > sym / 2 ? d - sym : d;
}

export function periode_apparente(periode_s: number, cadence_hz: number, rayons: number): number {
  const d = pas_apparent(periode_s, cadence_hz, rayons);
  if (Math.abs(d) < 1e-12) return Infinity;
  return 360.0 / (d * cadence_hz);
}

export class Repliement extends Animation {
  static override ID = 'wagonwheel';
  static override LECTURE_AU_DEPART = true;

  periode!: Reglage;
  cadence!: Reglage;
  rayons!: Choix;
  t = 0.0;
  t_image = 0.0;

  override construire(): void {
    this.periode = this.curseur('periode', 1.0, 10.0, 5.0, { dec: 2, unite: 's' });
    this.cadence = this.curseur('cadence', 0.1, 10.0, 3.0, { dec: 2, unite: 's⁻¹' });
    this.rayons = this.choix('rayons', [1, 2, 4, 8].map((n) => [`anim_wagonwheel_r_${n}`, n] as [string, number]), 1);
    this.etat_initial();
  }

  override etat_initial(): void {
    this.t = 0.0;
    this.t_image = 0.0;
  }

  override avancer(dt: number): void {
    this.t += dt;
    const pas = 1.0 / this.cadence.value();
    while (this.t - this.t_image >= pas) this.t_image += pas;
  }

  override valeurs(): [string, string][] {
    const n = this.rayons.currentData() as number;
    const pa = periode_apparente(this.periode.value(), this.cadence.value(), n);
    const d = pas_apparent(this.periode.value(), this.cadence.value(), n);
    const sens = !Number.isFinite(pa) ? tr('anim_wagonwheel_immobile') : pa > 0 ? tr('anim_wagonwheel_avant') : tr('anim_wagonwheel_arriere');
    return [
      [tr('anim_wagonwheel_vrai'), `${nombre(360.0 / (this.periode.value() * this.cadence.value()), 1)}${tr('anim_wagonwheel_par_image')}`],
      [tr('anim_wagonwheel_apparent'), `${nombre(d, 1)}${tr('anim_wagonwheel_par_image')}`],
      [tr('anim_wagonwheel_p_apparente'), Number.isFinite(pa) ? `${nombre(Math.abs(pa), 2)} s` : '∞'],
      [tr('anim_wagonwheel_sens'), sens],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones(rect, 2, 0.95);
    const n = this.rayons.currentData() as number;
    Repliement.roue(p, dessin.cadre(p, z[0]!, tr('anim_wagonwheel_titre_vraie')), (360.0 * this.t) / this.periode.value(), n);
    Repliement.roue(p, dessin.cadre(p, z[1]!, tr('anim_wagonwheel_titre_vue')), (360.0 * this.t_image) / this.periode.value(), n);
  }

  static roue(p: Peintre, r: Rect, angle: number, n: number): void {
    const cx = r.cx,
      cy = r.cy;
    const R = Math.min(r.w, r.h) * 0.4;
    p.setBrush(null);
    p.setPen(dessin.stylo('doux', 4.0));
    p.drawEllipse(cx, cy, R, R);
    for (let k = 0; k < n; k++) {
      const a = ((angle + (360.0 * k) / n) * Math.PI) / 180;
      p.setPen(dessin.stylo(k === 0 ? 'accent1' : 'doux', 3.0));
      p.drawLine(cx, cy, cx + R * Math.cos(a), cy - R * Math.sin(a));
    }
    dessin.disque(p, cx, cy, 7, 'texte');
  }
}
