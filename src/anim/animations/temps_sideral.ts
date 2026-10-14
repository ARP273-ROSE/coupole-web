/**
 * Sidereal and Solar Time Simulator : la Terre tourne sur elle-même en parcourant son orbite.  Le temps solaire suit
 * le Soleil, le temps sidéral les étoiles : en une année de N jours solaires, la Terre fait N + 1 tours par rapport
 * aux étoiles, d'où un jour sidéral de 86 400 × N / (N + 1) s.  Origine (comme l'original) : à midi solaire de
 * l'équinoxe de mars, le temps sidéral vaut 0 h.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Rect } from '../../noyau/peintre';
import { pd02, pmod, pround } from '../../noyau/py';
import { Animation, type Choix, heures_minutes, nombre } from '../base';

const ANNEES: [string, number][] = [
  ['anim_siderealsolartime_simple', 365.0], ['anim_siderealsolartime_julienne', 365.25], ['anim_siderealsolartime_tropique', astro.ANNEE_TROPIQUE_J],
];
const MIDI = 0.5;

/** Temps sidéral (heures) au temps solaire t (jours depuis minuit de l'équinoxe). */
export function temps_sideral_h(t_jours: number, annee: number): number {
  return 24.0 * pmod(((t_jours - MIDI) * (annee + 1.0)) / annee, 1.0);
}

/** Prochain instant (jours) ≥ t où le temps sidéral vaut ts_h. */
export function temps_solaire_pour_sideral(ts_h: number, t_jours: number, annee: number): number {
  const k = (annee + 1.0) / annee;
  const actuel = temps_sideral_h(t_jours, annee);
  return t_jours + pmod(ts_h - actuel, 24.0) / 24.0 / k;
}

export class TempsSideral extends Animation {
  static override ID = 'siderealSolarTime';
  static JOURS_PAR_S = 0.1;

  annee!: Choix;
  t = MIDI;

  override construire(): void {
    this.annee = this.choix('annee', ANNEES, 365.0);
    this.t = MIDI;
    for (const [cle, h] of [['anim_siderealsolartime_minuit', 0.0], ['anim_siderealsolartime_lever', 6.0], ['anim_siderealsolartime_midi', 12.0], ['anim_siderealsolartime_coucher', 18.0]] as [string, number][])
      this.bouton(cle, () => this.solaire(h));
    for (const h of [0, 6, 12, 18]) this.bouton(`anim_siderealsolartime_ts${h}`, () => this.sideral(h));
    this.bouton('anim_siderealsolartime_plus1_sol', () => this.ajouter(1.0));
    this.bouton('anim_siderealsolartime_plus10_sol', () => this.ajouter(10.0));
    this.bouton('anim_siderealsolartime_plus1_sid', () => this.ajouter(this.jour_sideral()));
    this.bouton('anim_siderealsolartime_plus10_sid', () => this.ajouter(10 * this.jour_sideral()));
    ['equinoxe_mars', 'solstice_juin', 'equinoxe_sept', 'solstice_dec'].forEach((cle, i) => this.bouton('anim_sunsrays_' + cle, () => this.saison(i)));
  }

  private n(): number {
    return Number(this.annee.currentData());
  }

  private jour_sideral(): number {
    return this.n() / (this.n() + 1.0);
  }

  private ajouter(jours: number): void {
    this.t += jours;
    this.rafraichir();
  }

  private solaire(h: number): void {
    const base = Math.floor(this.t);
    let cible = base + h / 24.0;
    if (cible < this.t - 1e-9) cible += 1.0;
    this.t = cible;
    this.rafraichir();
  }

  private sideral(h: number): void {
    this.t = temps_solaire_pour_sideral(h, this.t + 1e-9, this.n());
    this.rafraichir();
  }

  private saison(k: number): void {
    const n = this.n();
    const cycles = Math.floor(this.t / n);
    const heure = pmod(this.t, 1.0);
    this.t = cycles * n + pround((k * n) / 4.0) + heure;
    this.rafraichir();
  }

  override etat_initial(): void {
    this.t = MIDI;
  }

  override avancer(dt: number): void {
    this.t += dt * TempsSideral.JOURS_PAR_S;
  }

  override valeurs(): [string, string][] {
    const n = this.n();
    const js = astro.jour_sideral_s(n);
    const hh = Math.trunc(Math.floor(js / 3600));
    const mm = Math.trunc(Math.floor((js - 3600 * hh) / 60));
    const ss = js - 3600 * hh - 60 * mm;
    return [
      [tr('anim_siderealsolartime_solaire'), heures_minutes(24 * pmod(this.t, 1.0))],
      [tr('anim_siderealsolartime_sideral'), heures_minutes(temps_sideral_h(this.t, n))],
      [tr('anim_siderealsolartime_jours'), nombre(pmod(this.t, n), 2)],
      [tr('anim_siderealsolartime_duree_sid'), `${hh} h ${pd02(mm)} min ${nombre(ss, 3)} s`],
      [tr('anim_siderealsolartime_ecart'), `${nombre(86400 - js, 2)} s`],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones(rect, 2, 0.9);
    this.dessinOrbite(p, dessin.cadre(p, z[0]!, tr('anim_siderealsolartime_vue_orbite')));
    const r = dessin.cadre(p, z[1]!, tr('anim_siderealsolartime_horloges'));
    const h2 = dessin.zones(r, 2, 0.9);
    const n = this.n();
    this.horloge(p, h2[0]!, 24 * pmod(this.t, 1.0), tr('anim_siderealsolartime_solaire'), 'soleil');
    this.horloge(p, h2[1]!, temps_sideral_h(this.t, n), tr('anim_siderealsolartime_sideral'), 'accent2');
  }

  private dessinOrbite(p: Peintre, r: Rect): void {
    const n = this.n();
    const cx = r.cx,
      cy = r.cy;
    const ro = Math.min(r.w, r.h) * 0.36;
    p.setPen(dessin.stylo('grille', 1.2));
    p.setBrush(null);
    p.drawEllipse(cx, cy, ro, ro);
    dessin.disque(p, cx, cy, ro * 0.12, 'soleil');
    const jours = this.t - MIDI;
    const a_orb = (2 * Math.PI * pmod(jours, n)) / n - Math.PI / 2;
    const ex = cx + ro * Math.cos(a_orb),
      ey = cy - ro * Math.sin(a_orb);
    const rt = ro * 0.16;
    dessin.disque(p, ex, ey, rt, 'terre');
    const vers_soleil = (Math.atan2(-(cy - ey), cx - ex) * 180) / Math.PI;
    p.setPen(null);
    p.setBrush(dessin.c('nuit', 0.7));
    p.drawPie(new Rect(ex - rt, ey - rt, 2 * rt, 2 * rt), Math.trunc((vers_soleil + 90) * 16), 180 * 16);
    const a_obs = (vers_soleil * Math.PI) / 180 + 2 * Math.PI * (pmod(this.t, 1.0) - 0.5);
    const ox = ex + rt * Math.cos(a_obs),
      oy = ey - rt * Math.sin(a_obs);
    p.setPen(dessin.stylo('accent3', 2.5));
    p.drawLine(ox, oy, ox + rt * 0.9 * Math.cos(a_obs), oy - rt * 0.9 * Math.sin(a_obs));
    p.setPen(dessin.stylo('accent2', 1.2, 0.8, true));
    p.drawLine(ex, ey, ex, r.y + 8);
    dessin.texte(p, ex + 8, r.y + 16, tr('anim_siderealsolartime_etoile'), 'accent2', { centre: false });
    p.setPen(dessin.stylo('soleil', 1.2, 0.8, true));
    p.drawLine(ex, ey, cx, cy);
  }

  private horloge(p: Peintre, r: Rect, heures: number, titre: string, cle: string): void {
    const cx = r.cx,
      cy = r.cy + 8;
    const rr = Math.min(r.w, r.h) * 0.36;
    p.setPen(dessin.stylo('grille', 1.5));
    p.setBrush(dessin.c('sphere', 0.4));
    p.drawEllipse(cx, cy, rr, rr);
    dessin.police(p, 0.75);
    for (let h = 0; h < 24; h++) {
      const a = ((90 - h * 15 - 180) * Math.PI) / 180;
      p.setPen(dessin.stylo('doux', 1.0));
      p.drawLine(cx + rr * 0.9 * Math.cos(a), cy - rr * 0.9 * Math.sin(a), cx + rr * Math.cos(a), cy - rr * Math.sin(a));
      if (h % 3 === 0) dessin.texte(p, cx + rr * 0.74 * Math.cos(a), cy - rr * 0.74 * Math.sin(a), String(h), 'doux');
    }
    dessin.police(p, 1 / 0.75);
    const a = ((90 - heures * 15 - 180) * Math.PI) / 180;
    dessin.fleche(p, cx, cy, cx + rr * 0.8 * Math.cos(a), cy - rr * 0.8 * Math.sin(a), dessin.stylo(cle, 3.0), 9);
    dessin.texte(p, cx, r.y + 12, titre, cle);
    dessin.texte(p, cx, cy + rr + 14, heures_minutes(heures), 'texte');
  }
}
