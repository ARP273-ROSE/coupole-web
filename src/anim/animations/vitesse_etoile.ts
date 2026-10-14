/**
 * Stellar Velocity Calculator : la vitesse d'une étoile dans l'espace d'après sa vitesse radiale (effet Doppler sur Hα)
 * et sa vitesse transverse (mouvement propre et distance).  v_r = c Δλ / λ₀ (λ₀ = 656,28 nm) ; v_t = 4,740 47 μ d ;
 * v = √(v_r² + v_t²).  Réglages de l'original : λ de 655 à 657 nm, μ de 0 à 10 ″/an, d de 1 à 10 pc.
 */
import * as hr from '../../calc/hr';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, type Pt, Rect } from '../../noyau/peintre';
import { Animation, angle, type Bouton_souris, nombre, type Reglage } from '../base';

const H_ALPHA_NM = 656.28;

export class VitesseEtoile extends Animation {
  static override ID = 'stellarvel';
  static override ANIMEE = false;

  lam!: Reglage;
  mu!: Reglage;
  d!: Reglage;
  private zone: [number, number, number] | null = null;

  override construire(): void {
    this.lam = this.curseur('lambda', 655.0, 657.0, 656.5, { dec: 3, unite: 'nm' });
    this.mu = this.curseur('mu', 0.0, 10.0, 10.0, { dec: 2, unite: '″/an' });
    this.d = this.curseur('distance', 1.0, 10.0, 10.0, { dec: 2, unite: 'pc' });
    this.zone = null;
  }

  vitesses(): { vr: number; vt: number; v: number; angle: number; vr_rel: number } {
    const vr = hr.vitesse_radiale(this.lam.value(), H_ALPHA_NM);
    const vt = hr.vitesse_transverse(this.mu.value(), this.d.value());
    return { vr, vt, v: Math.hypot(vr, vt), angle: (Math.atan2(vt, vr) * 180) / Math.PI, vr_rel: hr.vitesse_radiale(this.lam.value(), H_ALPHA_NM, true) };
  }

  override valeurs(): [string, string][] {
    const v = this.vitesses();
    return [
      [tr('anim_stellarvel_vr'), `${nombre(v.vr, 2)} km/s (${tr(v.vr > 0 ? 'anim_stellarvel_eloigne' : 'anim_stellarvel_approche')})`],
      [tr('anim_stellarvel_vt'), `${nombre(v.vt, 2)} km/s`],
      [tr('anim_stellarvel_v'), `${nombre(v.v, 2)} km/s`],
      [tr('anim_stellarvel_angle'), angle(v.angle, 1)],
      [tr('anim_stellarvel_relativiste'), `${nombre(v.vr_rel, 2)} km/s`],
    ];
  }

  override presser(pos: Pt, _b: Bouton_souris): boolean {
    if (this.zone !== null) {
      const [x0, k, cy] = this.zone;
      if (Math.abs(pos.x - (x0 + k * this.d.value())) < 18 && Math.abs(pos.y - cy) < 18) {
        this._glisse = (q) => this.d.setValue((q.x - this.zone![0]) / this.zone![1]);
        return true;
      }
    }
    return false;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const v = this.vitesses();
    const x0 = rect.x + 40;
    const cy = rect.y + rect.h * 0.55;
    const k = (rect.w - 150) / 10.0;
    this.zone = [x0, k, cy];
    dessin.disque(p, x0, cy, 8, 'terre', 'texte');
    p.setPen(dessin.stylo('grille', 1.0, null, true));
    p.drawLine(x0, cy, rect.right - 20, cy);
    const xs = x0 + k * this.d.value();
    const echelle = (Math.min(rect.w, rect.h) * 0.3) / Math.max(80.0, hr.vitesse_transverse(10, 10), Math.abs(hr.vitesse_radiale(657.0, H_ALPHA_NM)));
    const lr = v.vr * echelle,
      lt = v.vt * echelle;
    const cr = v.vr > 0 ? 'accent3' : 'accent2';
    if (Math.abs(lr) > 2) dessin.fleche(p, xs, cy, xs + lr, cy, dessin.stylo(cr, 2.4), 9);
    if (lt > 2) dessin.fleche(p, xs, cy, xs, cy - lt, dessin.stylo('horizon', 2.4), 9);
    if (Math.abs(lr) > 2 || lt > 2) dessin.fleche(p, xs, cy, xs + lr, cy - lt, dessin.stylo('accent1', 2.4), 9);
    dessin.disque(p, xs, cy, 9, 'soleil', 'texte');
    dessin.police(p, 0.85);
    dessin.texte(p, xs + lr / 2, cy + 16, 'v_r', cr);
    dessin.texte(p, xs - 18, cy - lt / 2, 'v_t', 'horizon');
    dessin.texte(p, xs + lr / 2 + 16, cy - lt / 2 - 10, 'v', 'accent1');
    for (let d = 0; d < 11; d += 2) dessin.texte(p, x0 + k * d, cy + 34, `${d} pc`, 'doux');
    dessin.police(p, 1 / 0.85);
    this.spectre(p, new Rect(rect.x + 20, rect.y + 12, rect.w - 40, rect.h * 0.18));
  }

  private spectre(p: Peintre, r: Rect): void {
    const x_de = (lam: number): number => r.x + (r.w * (lam - 654.5)) / 3.0;
    p.fillRect(r, dessin.c('arc2', 0.6));
    p.setPen(dessin.stylo('nuit', 3.0));
    const xo = x_de(this.lam.value());
    p.drawLine(xo, r.y, xo, r.bottom);
    p.setPen(dessin.stylo('texte', 1.0, null, true));
    const xr = x_de(H_ALPHA_NM);
    p.drawLine(xr, r.y - 4, xr, r.bottom + 4);
    dessin.police(p, 0.8);
    dessin.texte(p, xr, r.bottom + 12, `Hα ${nombre(H_ALPHA_NM, 2)} nm`, 'doux');
    dessin.texte(p, xo, r.y - 8, `${nombre(this.lam.value(), 3)} nm`, 'texte');
    dessin.police(p, 1 / 0.8);
  }
}
