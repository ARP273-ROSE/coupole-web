/**
 * Driving Through Snow : en voiture sous la neige, les flocons semblent tous jaillir d'un même point devant soi.  Leur
 * vitesse par rapport à la voiture est la même pour tous ; en perspective, des trajectoires parallèles convergent vers
 * un point de fuite.  C'est le « radiant » d'une pluie d'étoiles filantes.  Le radiant est à l'angle
 * arctan(v_neige / v_voiture) au-dessus de l'horizon.  Réglages de l'original : champ 110°, vitesse 20, visibilité 100.
 */
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, type Rect, rgb } from '../../noyau/peintre';
import { alea } from '../../noyau/py';
import { Animation, type Coche, nombre, type Reglage } from '../base';

const N = 1800;
const LARGEUR = 60.0,
  HAUTEUR = 40.0,
  PROFONDEUR = 120.0,
  PRES = 1.0;

export class Neige extends Animation {
  static override ID = 'drivingthroughsnow';
  static override LECTURE_AU_DEPART = true;

  v_voiture!: Reglage;
  v_neige!: Reglage;
  champ!: Reglage;
  visibilite!: Reglage;
  c_radiant!: Coche;
  x = new Float64Array(N);
  y = new Float64Array(N);
  z = new Float64Array(N);

  override construire(): void {
    this.v_voiture = this.curseur('voiture', 0.0, 60.0, 20.0, { dec: 1 });
    this.v_neige = this.curseur('neige', 0.0, 20.0, 1.0, { dec: 1 });
    this.champ = this.curseur('champ', 30.0, 130.0, 110.0, { dec: 0, unite: '°' });
    this.visibilite = this.curseur('visibilite', 20.0, 120.0, 100.0, { dec: 0 });
    this.c_radiant = this.coche('radiant', true);
    this.etat_initial();
  }

  override etat_initial(): void {
    const u = alea(5);
    for (let k = 0; k < N; k++) {
      this.x[k] = -LARGEUR + 2 * LARGEUR * u();
      this.y[k] = PRES + (PROFONDEUR - PRES) * u();
      this.z[k] = -HAUTEUR + 2 * HAUTEUR * u();
    }
  }

  override avancer(dt: number): void {
    const vv = this.v_voiture.value() * dt,
      vn = this.v_neige.value() * dt;
    for (let k = 0; k < N; k++) {
      this.y[k]! -= vv;
      this.z[k]! -= vn;
      if (this.y[k]! < PRES) this.y[k]! += PROFONDEUR - PRES;
      if (this.z[k]! < -HAUTEUR) this.z[k]! += 2 * HAUTEUR;
    }
  }

  /** Hauteur du radiant au-dessus de l'horizon (degrés). */
  angle_radiant(): number {
    return (Math.atan2(this.v_neige.value(), this.v_voiture.value()) * 180) / Math.PI;
  }

  override valeurs(): [string, string][] {
    return [[tr('anim_drivingthroughsnow_radiant_v'), `${nombre(this.angle_radiant(), 1)}°`]];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const r = rect.adjusted(6, 6, -6, -6);
    p.fillRect(r, rgb(6, 8, 12));
    const cx = r.cx,
      cy = r.cy;
    const f = r.w / 2 / Math.tan((this.champ.value() * Math.PI) / 360);
    const vis = this.visibilite.value();
    const lots: Pt[][] = [[], [], []];
    for (let k = 0; k < N; k++) {
      const x = this.x[k]!,
        y = this.y[k]!,
        z = this.z[k]!;
      const sx = cx + (f * x) / y,
        sy = cy - (f * z) / y;
      const lum = 1.0 - Math.sqrt(x * x + y * y + z * z) / vis;
      if (!(lum > 0 && sx >= r.left && sx < r.right && sy >= r.top && sy < r.bottom)) continue;
      const i = lum < 0.33 ? 0 : lum < 0.66 ? 1 : lum < 1.01 ? 2 : -1;
      if (i >= 0) lots[i]!.push(new Pt(sx, sy));
    }
    p.save();
    p.setClipRect(r);
    const bornes: [number, number][] = [[0.0, 0.33], [0.33, 0.66], [0.66, 1.01]];
    bornes.forEach(([a, b], k) => {
      if (!lots[k]!.length) return;
      const g = Math.trunc(90 + (165 * (a + b)) / 2);
      p.setPen(dessin.stylo(rgb(g, g, g), 1.0 + k));
      p.drawPoints(lots[k]!);
    });
    if (this.c_radiant.isChecked() && this.v_voiture.value() > 0) {
      const ry = cy - (f * this.v_neige.value()) / this.v_voiture.value();
      if (r.top < ry && ry < r.bottom) {
        p.setPen(dessin.stylo('accent3', 1.5));
        p.setBrush(null);
        p.drawEllipse(cx, ry, 9, 9);
        dessin.texte(p, cx, ry - 18, tr('anim_drivingthroughsnow_radiant'), 'accent3', { fond: true });
      }
    }
    p.restore();
  }
}
