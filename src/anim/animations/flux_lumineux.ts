/**
 * Flux Simulator : une ampoule et un détecteur qu'on éloigne.  La puissance se répartit sur des sphères de plus en plus
 * grandes : le flux reçu suit la loi de l'inverse du carré, F = P / 4π d².  Ampoules de l'original (20 à 500 W),
 * détecteur de 1 à 5 m (on peut le faire glisser).
 */
import * as hr from '../../calc/hr';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { Animation, type Bouton_souris, type Choix, type Coche, nombre, type Reglage } from '../base';

const PUISSANCES = [20, 25, 50, 100, 400, 500];
const D_MIN = 1.0,
  D_MAX = 5.0;

export class FluxLumineux extends Animation {
  static override ID = 'lightdetector';
  static override ANIMEE = false;

  puissance!: Choix;
  d!: Reglage;
  c_spheres!: Coche;
  private zone: [Rect, number, number] | null = null;

  override construire(): void {
    this.puissance = this.choix('puissance', PUISSANCES.map((w) => [`anim_lightdetector_w${w}`, w] as [string, number]), 25);
    this.d = this.curseur('distance', D_MIN, D_MAX, 1.0, { dec: 2, unite: 'm' });
    this.c_spheres = this.coche('spheres', true);
    this.zone = null;
  }

  override valeurs(): [string, string][] {
    const w = this.puissance.currentData() as number,
      d = this.d.value();
    const f = hr.flux(w, d);
    return [
      [tr('anim_lightdetector_flux'), `${nombre(f, 3)} W/m²`],
      [tr('anim_lightdetector_rapport'), `1 / ${nombre(d, 2)}² = 1 / ${nombre(d * d, 2)}`],
      [tr('anim_lightdetector_aire'), `${nombre(4 * Math.PI * d * d, 2)} m²`],
    ];
  }

  override presser(pos: Pt, _b: Bouton_souris): boolean {
    if (this.zone !== null && this.zone[0].contains(pos)) {
      this._glisse = (q) => this.tirer(q);
      this.tirer(pos);
      return true;
    }
    return false;
  }

  private tirer(pos: Pt): void {
    const [, x0, k] = this.zone!;
    this.d.setValue((pos.x - x0) / k);
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const w = this.puissance.currentData() as number,
      d = this.d.value();
    const x0 = rect.x + 50;
    const cy = rect.cy - 20;
    const k = (rect.w - 110) / D_MAX;
    this.zone = [rect.copie(), x0, k];
    const lum = 0.35 + (0.65 * Math.log10(w / 20)) / Math.log10(25);
    for (const [r, a] of [[30, 0.12], [22, 0.25]] as [number, number][]) dessin.disque(p, x0, cy, r * (0.8 + lum * 0.4), 'soleil', null, a * (0.5 + lum));
    dessin.disque(p, x0, cy, 14, 'soleil');
    dessin.texte(p, x0, cy + 40, `${w} W`, 'texte');
    if (this.c_spheres.isChecked()) {
      p.setBrush(null);
      const demi = Math.min(35.0, (Math.asin(Math.min(1.0, (cy - rect.y - 10) / (5 * k))) * 180) / Math.PI);
      for (let r = 1; r < 6; r++) {
        p.setPen(dessin.stylo('grille', 1.0, 0.8));
        p.drawArc(new Rect(x0 - r * k, cy - r * k, 2 * r * k, 2 * r * k), Math.trunc(-demi * 16), Math.trunc(2 * demi * 16));
        dessin.texte(p, x0 + r * k + 12, cy + 14, `${r} m`, 'doux');
      }
    }
    const xd = x0 + d * k;
    const cote = 0.18;
    p.setPen(null);
    p.setBrush(dessin.c('soleil', 0.18));
    p.drawPolygon([new Pt(x0, cy), new Pt(xd, cy - (cote * k) / 2), new Pt(xd, cy + (cote * k) / 2)]);
    p.setPen(dessin.stylo('texte', 1.2));
    p.setBrush(dessin.c('accent2'));
    p.drawRect(new Rect(xd - 5, cy - (cote * k) / 2, 10, cote * k));
    dessin.texte(p, xd, cy - (cote * k) / 2 - 14, tr('anim_lightdetector_detecteur'), 'accent2', { fond: true });
    const f = hr.flux(w, d);
    const gx = rect.x + 30,
      gy = rect.bottom - 34,
      gl = rect.w - 60;
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(null);
    p.drawRect(new Rect(gx, gy, gl, 12));
    const t = Math.max(0.0, Math.min(1.0, (Math.log10(f) + 2) / (Math.log10(50) + 2)));
    p.fillRect(new Rect(gx, gy, gl * t, 12), dessin.c('accent1'));
    dessin.texte(p, gx + gl / 2, gy + 26, `F = P / 4π d² = ${nombre(f, 3)} W/m²`, 'texte');
  }
}
