/**
 * Blackbody Curves of Melting : un clou chauffé jusqu'à la fusion puis refroidi.  Sa lumière est celle d'un corps noir
 * : loi de Planck, maximum à λ_max = b / T (Wien), puissance σ T⁴.  Le clou est dessiné à la couleur et à l'éclat que
 * donnent la loi de Planck et la vision humaine : invisible sous ≈ 800 K, rouge sombre puis orangé vers la fusion du fer.
 */
import * as lumiere from '../../calc/lumiere';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { Couleur, type Peintre, Pt, Rect } from '../../noyau/peintre';
import { Animation, type Coche, nombre, type Reglage } from '../base';
import { scientifique } from './gravitation';

const T_FROID = 300.0,
  T_FUSION = 1811.0;
const DUREE_S = 24.0;

export function temperature_du_cycle(f: number): number {
  f = Math.max(0.0, Math.min(1.0, f));
  if (f <= 0.6) return T_FROID + ((T_FUSION - T_FROID) * f) / 0.6;
  return T_FROID + (T_FUSION - T_FROID) * Math.exp(-(f - 0.6) / 0.08);
}

export function fraction_visible(t: number): number {
  let s = 0;
  for (let k = 0; k < 370; k++) s += lumiere.planck((380 + k + 0.5) * 1e-9, t);
  return (Math.PI * s * 1e-9) / lumiere.exitance(t);
}

export class ClouFondu extends Animation {
  static override ID = 'meltednail';

  t!: Reglage;
  c_echelle!: Coche;
  f = 0.0;
  private y1800 = 1;

  override construire(): void {
    this.t = this.curseur('temperature', T_FROID, 2000.0, T_FROID, { dec: 0, unite: 'K' });
    this.c_echelle = this.coche('echelle_fixe', true);
    this.f = 0.0;
    this.y1800 = lumiere.xyz((w) => lumiere.planck(w * 1e-9, T_FUSION))[1];
  }

  override etat_initial(): void {
    this.f = 0.0;
  }

  override avancer(dt: number): void {
    this.f += dt / DUREE_S;
    if (this.f >= 1.0) this.f = 0.0;
    this.t.setValue(temperature_du_cycle(this.f));
  }

  couleur_clou(t: number): Couleur {
    const base = dessin.c('grille');
    if (t < 650) return base;
    const [x, y, z] = lumiere.xyz((w) => lumiere.planck(w * 1e-9, t));
    const k = Math.min(1.0, y / this.y1800);
    const [r, g, b] = lumiere.rgb_de_xyz(x / this.y1800, y / this.y1800, z / this.y1800);
    const a = Math.min(1.0, k ** 0.35);
    return new Couleur(Math.trunc(base.r * (1 - a) + r * a), Math.trunc(base.g * (1 - a) + g * a), Math.trunc(base.b * (1 - a) + b * a));
  }

  override valeurs(): [string, string][] {
    const t = this.t.value();
    const fv = 100 * fraction_visible(t);
    return [
      [tr('anim_meltednail_temperature_v'), `${nombre(t, 0)} K (${nombre(t - 273.15, 0)} °C)`],
      [tr('anim_c_pic_wien'), `${nombre(lumiere.pic_wien_m(t) * 1e9, 0)} nm`],
      [tr('anim_c_exitance'), `${scientifique(lumiere.exitance(t))} W·m⁻²`],
      [tr('anim_meltednail_visible'), `${fv < 0.01 ? scientifique(fv) : nombre(fv, 2)} %`],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const t = this.t.value();
    const z = dessin.zones(rect, 2, 0.9);
    this.clou(p, dessin.cadre(p, z[0]!, tr('anim_meltednail_titre_clou')), t);
    const r = dessin.cadre(p, z[1]!, tr('anim_meltednail_titre_courbe'));
    const lmax = 5000.0;
    const bmax = this.c_echelle.isChecked() ? lumiere.planck(lumiere.pic_wien_m(T_FUSION), T_FUSION) : lumiere.planck(lumiere.pic_wien_m(t), t);
    const ax = new Axes(r, 0, lmax, 0, (bmax * 1.08) / 1e12).avec(p);
    ax.bande_visible(0.22);
    ax.fond(p, { titre_x: tr('anim_c_lambda_nm'), titre_y: tr('anim_c_luminance_unite') });
    const pts: [number, number][] = [];
    for (let lam = 50; lam <= Math.trunc(lmax); lam += 25) pts.push([lam, lumiere.planck(lam * 1e-9, t) / 1e12]);
    ax.remplir(pts, 'accent1', 0.18);
    ax.courbe(pts, 'accent1', 2.2);
    const lp = lumiere.pic_wien_m(t) * 1e9;
    if (lp < lmax) ax.verticale(lp, 'accent3', 1.2, true, `${nombre(lp, 0)} nm`);
  }

  private clou(p: Peintre, r: Rect, t: number): void {
    const cx = r.cx,
      cy = r.cy;
    const L = Math.min(r.w * 0.8, r.h * 1.6);
    const e = L * 0.06;
    const col = this.couleur_clou(t);
    if (t > 900) {
      for (const [k, a] of [[3.2, 0.1], [2.2, 0.16]] as [number, number][]) {
        const halo = col.copie().setAlphaF(a * Math.min(1.0, (t - 900) / 700));
        p.setPen(null);
        p.setBrush(halo);
        p.drawRoundedRect(new Rect(cx - L / 2 - k * e, cy - k * e, L + 2 * k * e, 2 * k * e), k * e, k * e);
      }
    }
    const x0 = cx - L / 2;
    const poly = [new Pt(x0 + L * 0.08, cy - e / 2), new Pt(x0 + L * 0.88, cy - e / 2), new Pt(x0 + L, cy), new Pt(x0 + L * 0.88, cy + e / 2), new Pt(x0 + L * 0.08, cy + e / 2)];
    p.setPen(dessin.stylo('doux', 1.0));
    p.setBrush(col);
    p.drawPolygon(poly);
    p.drawRoundedRect(new Rect(x0, cy - e * 2.2, L * 0.08, e * 4.4), 3, 3);
    dessin.texte(p, cx, cy + e * 4.5, `${nombre(t, 0)} K`, 'texte');
    if (t < 800) dessin.texte(p, cx, cy + e * 4.5 + 18, tr('anim_meltednail_invisible'), 'doux');
    else if (t >= T_FUSION - 1) dessin.texte(p, cx, cy + e * 4.5 + 18, tr('anim_meltednail_fusion'), 'accent3');
  }
}
