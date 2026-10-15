/**
 * Sun's Position on Horizon : l'horizon est (ou ouest) vu par l'observateur ; le point de lever (ou de coucher) du
 * Soleil glisse le long de l'horizon au fil de l'année, entre ses positions extrêmes des solstices ; aux équinoxes il
 * est plein est (ouest).  La trajectoire du Soleil coupe l'horizon sous l'angle 90° − |φ|.
 */
import { heureSolaire, type Moment } from '../../calc/maintenant';
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import { Animation, angle, type Choix, type Coche, date_du_jour, type Reglage } from '../base';

const ANNEE = 2026;
const EPS = astro.obliquite_moyenne(astro.jj_jour_de_l_annee(ANNEE, 0));

export class LeverHorizon extends Animation {
  static override ID = 'horizon';
  static JOURS_PAR_S = 20.0;

  cote!: Choix;
  lat!: Reglage;
  jour!: Reglage;
  c_trace!: Coche;

  static override TEMPS = ['jour'] as const;
  static override HEURE_SOLAIRE = true;

  /** « Maintenant » : date et heure de l'appareil (calc/maintenant.ts). */
  override maintenant(m: Moment): void {
    const [j, h] = heureSolaire(m.i, m.lon);
    void h;
    this.poser(this.jour, j);
    if (m.lat !== null) this.poser(this.lat, m.lat);
  }

  override construire(): void {
    this.cote = this.choix('cote', [['anim_horizon_est', 'est'], ['anim_horizon_ouest', 'ouest']], 'est');
    this.lat = this.curseur('latitude', -66.0, 66.0, 41.0, { dec: 1, unite: '°', cle_texte: 'anim_c_latitude' });
    this.jour = this.curseur('jour', 0.0, 364.0, 79.0, { dec: 0, cle_texte: 'anim_c_jour' });
    this.c_trace = this.coche('trace', true);
  }

  override avancer(dt: number): void {
    this.jour.setValue(pmod(this.jour.value() + dt * LeverHorizon.JOURS_PAR_S, 365.0));
  }

  private azimut(d: number): number | null {
    const az = astro.azimut_lever(d, this.lat.value());
    if (az === null) return null;
    return this.cote.currentData() === 'est' ? az : 360.0 - az;
  }

  override valeurs(): [string, string][] {
    const d = astro.soleil_jour(ANNEE, this.jour.value() + 0.5).delta;
    const az = this.azimut(d);
    const a_n = this.azimut(EPS),
      a_s = this.azimut(-EPS);
    const out: [string, string][] = [
      [tr('anim_c_date'), date_du_jour(this.jour.value())],
      [tr('anim_c_dec'), angle(d)],
      [tr('anim_horizon_azimut'), az !== null ? angle(az) : '—'],
    ];
    if (a_n !== null && a_s !== null) out.push([tr('anim_horizon_amplitude'), angle(Math.abs(a_s - a_n))]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const lat = this.lat.value();
    const est = this.cote.currentData() === 'est';
    const centre_az = est ? 90.0 : 270.0;
    const larg_deg = 100.0;
    const sol = rect.bottom - rect.h * 0.3;
    const x_de = (az: number): number => rect.cx + ((az - centre_az) / larg_deg) * rect.w;
    const y_de = (h: number): number => sol - (h / 45.0) * (sol - rect.y);
    p.fillRect(new Rect(rect.x, rect.y, rect.w, sol - rect.y), dessin.c('ciel', 0.35));
    p.fillRect(new Rect(rect.x, sol, rect.w, rect.bottom - sol), dessin.c('sol', 0.6));
    p.setPen(dessin.stylo('horizon', 2.0));
    p.drawLine(rect.x, sol, rect.right, sol);
    dessin.police(p, 0.9);
    for (const [az, cle] of [[0, 'anim_pc_n'], [45, 'NE'], [90, 'anim_pc_e'], [135, 'SE'], [180, 'anim_pc_s'], [225, 'SW'], [270, 'anim_pc_o'], [315, 'NW'], [360, 'anim_pc_n']] as [number, string][]) {
      const x = x_de(az);
      if (rect.x <= x && x <= rect.right) {
        const lab = cle.startsWith('anim_') ? tr(cle) : tr('anim_horizon_' + cle.toLowerCase());
        dessin.texte(p, x, sol + 16, lab, 'horizon');
        p.setPen(dessin.stylo('horizon', 1.0, 0.6));
        p.drawLine(x, sol, x, sol + 5);
      }
    }
    dessin.police(p, 1 / 0.9);
    if (this.c_trace.isChecked()) {
      for (const [cle, dd, coul] of [['solstice_juin', EPS, 'accent3'], ['equinoxes', 0.0, 'accent1'], ['solstice_dec', -EPS, 'accent2']] as [string, number, string][]) {
        const az = this.azimut(dd);
        if (az === null) continue;
        const x = x_de(az);
        p.setPen(dessin.stylo(coul, 1.5, 0.8, true));
        p.drawLine(x, sol, x, rect.y + 20);
        dessin.texte(p, x, rect.y + 12, tr('anim_sunpaths_' + cle), coul, { fond: true });
      }
    }
    const d = astro.soleil_jour(ANNEE, this.jour.value() + 0.5).delta;
    const az = this.azimut(d);
    if (az !== null) {
      const pts: Pt[] = [];
      const h0 = astro.angle_horaire_lever(d, lat);
      for (let k = 0; k <= 40; k++) {
        const hh = est ? -h0 + k * 1.5 : h0 - k * 1.5;
        const [a2, alt] = astro.equatorial_vers_horizon(hh, d, lat);
        pts.push(new Pt(x_de(a2), y_de(alt)));
      }
      p.setPen(dessin.stylo('soleil', 2.0, 0.8));
      for (let i = 0; i < pts.length - 1; i++) p.drawLineP(pts[i]!, pts[i + 1]!);
      dessin.disque(p, x_de(az), sol, 10, 'soleil');
      dessin.texte(p, x_de(az), sol - 24, angle(az), 'soleil', { fond: true });
    }
    dessin.police(p, 1.1, true);
    dessin.texte(p, rect.x + 12, rect.y + 40, date_du_jour(this.jour.value()), 'texte', { centre: false });
    dessin.police(p, 1 / 1.1);
  }
}
