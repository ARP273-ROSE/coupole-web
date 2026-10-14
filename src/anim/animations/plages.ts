/**
 * Declination Ranges Simulator : coupe de la Terre et de la sphère céleste.  À la latitude φ, l'horizon est tangent
 * à la Terre ; les étoiles de déclinaison δ > 90° − φ sont circumpolaires, celles de δ < −(90° − φ) ne se lèvent
 * jamais, les autres se lèvent et se couchent (hémisphère nord ; symétrique au sud).
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, type Pt, Rect } from '../../noyau/peintre';
import { Animation, angle, type Bouton_souris, type Coche, type Reglage } from '../base';

export class PlagesDeclinaison extends Animation {
  static override ID = 'latsim';
  static override ANIMEE = false;

  lat!: Reglage;
  c_agrandir!: Coche;
  private geo: [number, number, number] | null = null;

  override construire(): void {
    this.lat = this.curseur('latitude', -90.0, 90.0, 40.0, { dec: 1, unite: '°', cle_texte: 'anim_c_latitude' });
    this.c_agrandir = this.coche('agrandir', false);
    this.geo = null;
  }

  override valeurs(): [string, string][] {
    const pl = astro.plages_declinaison(this.lat.value());
    const plage = (x: [number, number] | null): string => (x === null ? tr('anim_latsim_aucune') : `${angle(x[0])} → ${angle(x[1])}`);
    return [
      [tr('anim_latsim_circumpolaire'), plage(pl.circumpolaire)],
      [tr('anim_latsim_lever'), plage(pl.lever_coucher)],
      [tr('anim_latsim_jamais'), plage(pl.jamais)],
      [tr('anim_latsim_hauteur_pole'), angle(Math.abs(this.lat.value()))],
    ];
  }

  override presser(pos: Pt, _bouton: Bouton_souris): boolean {
    if (this.geo !== null) {
      const [cx, cy, rt] = this.geo;
      const l = (this.lat.value() * Math.PI) / 180;
      const ox = cx + rt * Math.cos(l),
        oy = cy - rt * Math.sin(l);
      if (Math.hypot(pos.x - ox, pos.y - oy) < 18 || Math.hypot(pos.x - cx, pos.y - cy) < rt) {
        this._glisse = (q) => this.tirer(q);
        return true;
      }
    }
    return false;
  }

  private tirer(pos: Pt): void {
    const [cx, cy] = this.geo!;
    let a = (Math.atan2(cy - pos.y, pos.x - cx) * 180) / Math.PI;
    if (a > 90) a = 180 - a;
    else if (a < -90) a = -180 - a;
    this.lat.setValue(a);
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const lat = this.lat.value();
    const cx = rect.cx - rect.w * 0.1,
      cy = rect.cy;
    const rc = Math.min(rect.w * 0.36, rect.h * 0.42);
    const rt = rc * (this.c_agrandir.isChecked() ? 0.6 : 0.12);
    this.geo = [cx, cy, rt];
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(dessin.c('sphere', 0.25));
    p.drawEllipse(cx, cy, rc, rc);
    const pl = astro.plages_declinaison(lat);
    const ep = Math.max(8.0, rc * 0.06);
    for (const [cle, coul] of [['circumpolaire', 'accent1'], ['lever_coucher', 'accent2'], ['jamais', 'accent3']] as [keyof astro.Plages, string][]) {
      const x = pl[cle];
      if (x === null) continue;
      for (const cote of [0, 180]) {
        const debut = cote === 0 ? x[0] : 180 - x[1];
        p.setPen(dessin.stylo(coul, ep, 0.85));
        p.setBrush(null);
        const rr = rc + ep / 2 + 2;
        p.drawArc(new Rect(cx - rr, cy - rr, 2 * rr, 2 * rr), Math.trunc(debut * 16), Math.trunc((x[1] - x[0]) * 16));
      }
    }
    p.setPen(dessin.stylo('equateur', 1.5, null, true));
    p.drawLine(cx - rc, cy, cx + rc, cy);
    p.setPen(dessin.stylo('equateur', 2.0));
    p.drawLine(cx, cy - rc * 1.08, cx, cy + rc * 1.08);
    dessin.texte(p, cx, cy - rc * 1.14, tr('anim_radecdemo_l_pnc'), 'equateur');
    dessin.texte(p, cx, cy + rc * 1.14, tr('anim_radecdemo_l_psc'), 'equateur');
    dessin.disque(p, cx, cy, rt, 'terre', null, !this.c_agrandir.isChecked() ? 0.85 : 0.5);
    const a = (lat * Math.PI) / 180;
    const ox = cx + rt * Math.cos(a),
      oy = cy - rt * Math.sin(a);
    const tx = -Math.sin(a),
      ty = -Math.cos(a);
    p.setPen(dessin.stylo('horizon', 2.0));
    p.drawLine(cx - tx * rc, cy - ty * rc, cx + tx * rc, cy + ty * rc);
    p.setPen(dessin.stylo('horizon', 2.0, 0.6));
    p.drawLine(ox - tx * rt * 2, oy - ty * rt * 2, ox + tx * rt * 2, oy + ty * rt * 2);
    p.setPen(dessin.stylo('accent3', 2.0));
    p.drawLine(ox, oy, ox + Math.cos(a) * rt * 0.9, oy - Math.sin(a) * rt * 0.9);
    dessin.disque(p, ox, oy, 4.5, 'accent3');
    dessin.texte(p, cx + Math.cos(a) * rc * 1.07, cy - Math.sin(a) * rc * 1.07, tr('anim_altazimuth_zenith'), 'accent3', { fond: true });
    // légende : assez à gauche pour que les libellés tiennent dans la toile
    const larg = Math.max(...['anim_latsim_circumpolaire', 'anim_latsim_lever', 'anim_latsim_jamais'].map((k) => p.fontMetrics().horizontalAdvance(tr(k))));
    const x0 = Math.min(rect.right - rect.w * 0.22, rect.right - 10 - 28 - larg),
      y0 = rect.y + 30;
    [['anim_latsim_circumpolaire', 'accent1'], ['anim_latsim_lever', 'accent2'], ['anim_latsim_jamais', 'accent3']].forEach(([cle, coul], i) => {
      p.setPen(dessin.stylo(coul!, 8.0));
      p.drawLine(x0, y0 + i * 26, x0 + 20, y0 + i * 26);
      dessin.texte(p, x0 + 28, y0 + i * 26 + 4, tr(cle!), 'texte', { centre: false });
    });
    dessin.texte(p, x0, y0 + 90, `${tr('anim_c_latitude')} : ${angle(lat)}`, 'texte', { centre: false });
  }
}
