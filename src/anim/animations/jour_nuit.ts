/**
 * Daylight Simulator : carte plane de la Terre avec la zone de jour et de nuit.  Le point subsolaire est à la
 * latitude δ☉ et à la longitude où il est midi solaire vrai ; la zone éclairée glisse vers l'ouest au fil du jour
 * (15° par heure) et son contour change au fil de l'année.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { linspace, pmod } from '../../noyau/py';
import type { Pts } from '../../noyau/vec';
import { Animation, angle, type Bouton_souris, type Choix, type Coche, date_du_jour, heures_minutes, type Reglage } from '../base';
import { cotes, decimal, chargerCotes } from './longitude_latitude';

const ANNEE = 2026;
const R = 180 / Math.PI;

/** (latitude, longitude) du point subsolaire au « jour » (fraction = temps universel). */
export function subsolaire(jour: number): [number, number] {
  const s = astro.soleil_jour(ANNEE, jour);
  const tu = pmod(jour, 1.0) * 24.0;
  const lon = -((tu - 12.0) * 15.0 + s.eqt / 4.0);
  return [s.delta, astro.mod180(lon)];
}

/** Latitude du terminateur (h = 0) pour une longitude : tan φ = −cos H / tan δ. */
export function latitude_terminateur(lon: number, dec: number, lon_ss: number): number {
  const h = (lon - lon_ss) / R;
  const d = (Math.abs(dec) > 1e-6 ? dec : 1e-6) / R;
  return Math.atan(-Math.cos(h) / Math.tan(d)) * R;
}

/** Latitude où le Soleil est à la hauteur h le long du méridien `lon`, du côté nuit du terminateur. */
export function latitude_hauteur(lon: number, dec: number, lon_ss: number, h: number): number {
  const hh = (lon - lon_ss) / R;
  const a = Math.sin(dec / R),
    b = Math.cos(dec / R) * Math.cos(hh);
  const rr = Math.hypot(a, b);
  if (rr < 1e-12 || Math.abs(Math.sin(h / R) / rr) > 1) return dec >= 0 ? -90.0 : 90.0;
  const psi = Math.atan2(b, a);
  const base = Math.asin(Math.sin(h / R) / rr);
  const sols: number[] = [];
  for (let phi of [base - psi, Math.PI - base - psi]) {
    phi = pmod(phi + Math.PI, 2 * Math.PI) - Math.PI;
    if (-Math.PI / 2 - 1e-9 <= phi && phi <= Math.PI / 2 + 1e-9) sols.push(phi * R);
  }
  if (!sols.length) return dec >= 0 ? -90.0 : 90.0;
  const ref = latitude_terminateur(lon, dec, lon_ss);
  const nuit = sols.filter((x) => (dec >= 0 ? x <= ref + 1e-9 : x >= ref - 1e-9));
  return (nuit.length ? nuit : sols)[0]!;
}

/** Tracé des côtes sur une carte plane (coupé au passage de la ligne ±180°). */
export function cotesCarte(p: Peintre, xy: (la: number, lo: number) => Pt): void {
  for (const poly of cotes() as Pts[]) {
    if (poly.length < 2) continue;
    let pts: Pt[] = [];
    let lo_avant = 0;
    poly.forEach((q, i) => {
      const la = Math.asin(Math.max(-1, Math.min(1, q[2]))) * R;
      const lo = Math.atan2(q[1], q[0]) * R;
      if (pts.length && i > 0 && Math.abs(lo - lo_avant) > 180) {
        p.drawPolyline(pts);
        pts = [];
      }
      pts.push(xy(la, lo));
      lo_avant = lo;
    });
    if (pts.length > 1) p.drawPolyline(pts);
  }
}

export class JourNuit extends Animation {
  static override ID = 'daylightsimulator';
  static HEURES_PAR_S = 1.0;
  static JOURS_PAR_S = 10.0;

  mode!: Choix;
  jour!: Reglage;
  heure!: Reglage;
  lat!: Reglage;
  lon!: Reglage;
  c_crepuscule!: Coche;
  private carte: Rect | null = null;

  override construire(): void {
    this.attendre(chargerCotes());
    this.mode = this.choix('mode', [['anim_daylightsimulator_jour', 'jour'], ['anim_daylightsimulator_annee', 'annee']], 'jour');
    this.jour = this.curseur('jour', 0.0, 364.0, 79.0, { dec: 0, cle_texte: 'anim_c_jour' });
    this.heure = this.curseur('heure', 0.0, 24.0, 12.0, { dec: 2, unite: 'h', cle_texte: 'anim_daylightsimulator_tu' });
    this.lat = this.curseur('latitude', -90.0, 90.0, 0.0, { dec: 1, unite: '°', cle_texte: 'anim_c_latitude' });
    this.lon = this.curseur('longitude', -180.0, 180.0, 0.0, { dec: 1, unite: '°', cle_texte: 'anim_c_longitude' });
    this.c_crepuscule = this.coche('crepuscule', false);
    this.carte = null;
  }

  override avancer(dt: number): void {
    if (this.mode.currentData() === 'jour') {
      const h = this.heure.value() + dt * JourNuit.HEURES_PAR_S;
      if (h >= 24.0) this.jour.setValue(pmod(this.jour.value() + 1, 365.0));
      this.heure.setValue(pmod(h, 24.0));
    } else this.jour.setValue(pmod(this.jour.value() + dt * JourNuit.JOURS_PAR_S, 365.0));
  }

  private jourDecimal(): number {
    return this.jour.value() + this.heure.value() / 24.0;
  }

  override valeurs(): [string, string][] {
    const [dec, lon_ss] = subsolaire(this.jourDecimal());
    const h_obs = astro.mod180(this.lon.value() - lon_ss) / 15.0 + 12.0;
    const [, alt] = astro.equatorial_vers_horizon(astro.mod180(this.lon.value() - lon_ss), dec, this.lat.value());
    return [
      [tr('anim_c_date'), date_du_jour(this.jour.value()) + ', ' + heures_minutes(this.heure.value()) + ' TU'],
      [tr('anim_daylightsimulator_subsolaire'), `${decimal(dec, tr('anim_pc_n'), tr('anim_pc_s'))}, ${decimal(lon_ss, tr('anim_pc_e'), tr('anim_pc_o'))}`],
      [tr('anim_sunmotions_heure_vraie'), heures_minutes(h_obs)],
      [tr('anim_daylightsimulator_h_soleil'), angle(alt)],
    ];
  }

  override presser(pos: Pt, _b: Bouton_souris): boolean {
    if (this.carte !== null && this.carte.contains(pos)) {
      this._glisse = (q) => this.tirer(q);
      this.tirer(pos);
      return true;
    }
    return false;
  }

  private tirer(pos: Pt): void {
    const r = this.carte!;
    this.lon.setValue(Math.max(-180.0, Math.min(180.0, ((pos.x - r.x) / r.w) * 360.0 - 180.0)));
    this.lat.setValue(Math.max(-90.0, Math.min(90.0, 90.0 - ((pos.y - r.y) / r.h) * 180.0)));
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const w = Math.min(rect.w - 20, (rect.h - 20) * 2.0);
    const carte = new Rect(rect.cx - w / 2, rect.cy - w / 4, w, w / 2);
    this.carte = carte;
    const xy = (la: number, lo: number): Pt => new Pt(carte.x + ((lo + 180.0) / 360.0) * carte.w, carte.y + ((90.0 - la) / 180.0) * carte.h);
    p.fillRect(carte, dessin.c('terre', 0.35));
    p.setPen(dessin.stylo('texte', 0.8, 0.8));
    cotesCarte(p, xy);
    const [dec, lon_ss] = subsolaire(this.jourDecimal());
    const lons = linspace(-180.0, 180.0, 361);
    const couches: [number, number][] = [[0.0, 0.55]];
    if (this.c_crepuscule.isChecked()) couches.push([6.0, 0.25], [12.0, 0.2], [18.0, 0.15]);
    for (const [decalage, alpha] of couches) {
      const lats = decalage === 0.0 ? lons.map((lo) => latitude_terminateur(lo, dec, lon_ss)) : lons.map((lo) => latitude_hauteur(lo, dec, lon_ss, -decalage));
      const pole = dec >= 0 ? -90.0 : 90.0;
      const poly = [...lats.map((la, i) => xy(la, lons[i]!)), xy(pole, 180.0), xy(pole, -180.0)];
      p.setPen(null);
      p.setBrush(dessin.c('nuit', alpha));
      p.drawPolygon(poly);
    }
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(null);
    p.drawRect(carte);
    const q = xy(dec, lon_ss);
    dessin.disque(p, q.x, q.y, 8, 'soleil', 'fond');
    const o = xy(this.lat.value(), this.lon.value());
    dessin.disque(p, o.x, o.y, 5, 'accent3', 'fond');
    dessin.police(p, 1.1, true);
    dessin.texte(p, rect.x + 12, rect.y + 18, date_du_jour(this.jour.value()) + ', ' + heures_minutes(this.heure.value()) + ' TU', 'texte', { centre: false });
    dessin.police(p, 1 / 1.1);
  }
}
