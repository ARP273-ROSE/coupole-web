/**
 * Étoiles filantes et radiant : une nuit d'observation d'une pluie d'étoiles filantes dans le ciel vu de dessous ;
 * traînées prolongées jusqu'au radiant, hauteur du radiant et taux horaire au fil de la nuit.  Jumeau de
 * `animations/radiant.py` de Coupole (calculs : `calc/meteores.ts`).
 */
import * as astro from '../../calc/astro';
import * as me from '../../calc/meteores';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { pmod, pround } from '../../noyau/py';
import { Animation, angle, type Choix, type Coche, heures_minutes, nombre, type Reglage } from '../base';

const HEURES_PAR_S = 0.25;
const TAUX_AFFICHE = 1.0 / 25.0;
const DUREE_VIE = 0.8;

export function vers_ecran(cx: number, cy: number, rr: number, az: number, alt: number): Pt {
  const r = ((90.0 - alt) / 90.0) * rr;
  const a = (az * Math.PI) / 180;
  return new Pt(cx - r * Math.sin(a), cy - r * Math.cos(a));
}

export class Radiant extends Animation {
  static override ID = 'meteorradiant';
  static override LECTURE_AU_DEPART = true;

  essaim!: Choix;
  lat!: Reglage;
  heure!: Reglage;
  mlim!: Reglage;
  c_prolonger!: Coche;
  c_etoiles!: Coche;
  fond: [number, number, number][] = [];
  alea = new me.Aleatoire(4242);
  filantes: number[][] = [];
  reservoir = 0.0;

  override construire(): void {
    this.essaim = this.choix('essaim', me.ESSAIMS.map(([k]) => ['anim_meteorradiant_e_' + k, k] as [string, string]), 'perseides');
    this.lat = this.curseur('latitude', -60.0, 70.0, 45.0, { dec: 1, unite: '°', cle_texte: 'anim_c_latitude' });
    this.heure = this.curseur('heure', 18.0, 30.0, 22.0, { dec: 2, unite: 'h' });
    this.mlim = this.curseur('mlim', 3.0, 7.0, 6.5, { dec: 1 });
    this.c_prolonger = this.coche('prolonger', true);
    this.c_etoiles = this.coche('etoiles', true);
    this.fond = me.etoiles_de_fond();
    this.etat_initial();
  }

  override etat_initial(): void {
    this.alea = new me.Aleatoire(4242);
    this.filantes = [];
    this.reservoir = 0.0;
  }

  k(): string {
    return String(this.essaim.currentData());
  }

  radiant(): [number, number] {
    return me.hauteur_radiant(this.k(), this.heure.value(), this.lat.value());
  }

  override avancer(dt: number): void {
    let h = this.heure.value() + dt * HEURES_PAR_S;
    if (h >= 30.0) h = 18.0 + pmod(h - 30.0, 12.0);
    this.heure.setValue(h);
    for (const f of this.filantes) f[0]! += dt;
    this.filantes = this.filantes.filter((f) => f[0]! < DUREE_VIE);
    const [az_r, h_r] = this.radiant();
    const hr = me.taux_horaire(this.k(), h_r, this.mlim.value());
    this.reservoir += hr * TAUX_AFFICHE * dt;
    while (this.reservoir >= 1.0) {
      this.reservoir -= 1.0;
      const t = me.trainee(this.alea, az_r, h_r);
      if (t !== null) this.filantes.push([0.0, t[0], t[1], t[2], t[3]]);
    }
  }

  override valeurs(): [string, string][] {
    const k = this.k();
    const [mois, jour, alpha, delta, v, zhr, , cons] = me.essaim(k);
    const [, h_r] = this.radiant();
    const hr = me.taux_horaire(k, h_r, this.mlim.value());
    const [hc, hmax] = me.culmination(k, this.lat.value());
    const hs = me.hauteur_soleil(k, this.heure.value(), this.lat.value());
    const ciel = hs < -18 ? 'nuit' : hs < 0 ? 'crepuscule' : 'jour';
    return [
      [tr('anim_meteorradiant_v_maximum'), tr('anim_meteorradiant_date', { j: jour, m: tr(`anim_mois_${mois}`) })],
      [tr('anim_meteorradiant_v_radiant'), `α = ${tr('anim_meteorradiant_ad', { h: Math.floor(alpha / 15), m: String(pround(pmod(alpha, 15) * 4)).padStart(2, '0') })}, δ = ${(delta >= 0 ? '+' : '') + angle(delta, 0)} — ${tr('anim_meteorradiant_c_' + cons)}`],
      [tr('anim_meteorradiant_v_vitesse'), `${nombre(v, 0)} km·s⁻¹`],
      [tr('anim_meteorradiant_v_zhr'), nombre(zhr, 0)],
      [tr('anim_meteorradiant_v_heure'), heures_minutes(this.heure.value())],
      [tr('anim_meteorradiant_v_hauteur'), h_r > 0 ? angle(h_r, 1) : tr('anim_meteorradiant_sous_horizon', { h: angle(h_r, 1) })],
      [tr('anim_meteorradiant_v_taux'), tr('anim_meteorradiant_par_heure', { n: nombre(hr, 0) })],
      [tr('anim_meteorradiant_v_culmination'), `${heures_minutes(hc)} — ${angle(hmax, 0)}`],
      [tr('anim_meteorradiant_v_soleil'), `${angle(hs, 0)} — ${tr('anim_meteorradiant_ciel_' + ciel)}`],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones_principale(rect, 1, 0.6);
    this.ciel(p, dessin.cadre(p, z[0]!, tr('anim_meteorradiant_t_ciel')));
    this.nuit(p, dessin.cadre(p, z[1]!, tr('anim_meteorradiant_t_nuit')));
  }

  private ciel(p: Peintre, r: Rect): void {
    const rr = Math.min(r.w, r.h - 20) / 2.0 - 14;
    const cx = r.cx,
      cy = r.cy + 4;
    const k = this.k();
    const hs = me.hauteur_soleil(k, this.heure.value(), this.lat.value());
    const nuit = Math.max(0.0, Math.min(1.0, (-hs - 2.0) / 14.0));
    p.save();
    p.setPen(dessin.stylo('horizon', 1.4));
    p.setBrush(nuit < 1 ? dessin.c('ciel', 0.25 + 0.55 * (1 - nuit)) : dessin.c('nuit', 0.95));
    p.drawEllipse(cx, cy, rr, rr);
    p.restore();
    const tsl = astro.tsmg(me.jour_julien(k, this.heure.value()));
    const lat = this.lat.value();
    if (this.c_etoiles.isChecked() && nuit > 0.05) {
      p.setPen(null);
      for (const [alpha, delta, mag] of this.fond) {
        const [az, h] = astro.equatorial_vers_horizon(tsl - alpha, delta, lat);
        if (h > 0) {
          const q = vers_ecran(cx, cy, rr, az, h);
          p.setBrush(dessin.c('etoile', nuit * Math.max(0.25, 1.0 - (mag - 1.0) / 6.0)));
          const rp = Math.max(0.7, 2.4 - 0.35 * mag);
          p.drawEllipse(q.x, q.y, rp, rp);
        }
      }
    }
    if (Math.abs(lat) > 1) {
      const qp = vers_ecran(cx, cy, rr, lat > 0 ? 0.0 : 180.0, Math.abs(lat));
      dessin.texte(p, qp.x, qp.y, '+', 'doux');
    }
    const [az_r, h_r] = this.radiant();
    const qr = h_r > -1 ? vers_ecran(cx, cy, rr, az_r, h_r) : null;
    for (const [age, az0, h0, az1, h1] of this.filantes) {
      const a = Math.max(0.0, 1.0 - age! / DUREE_VIE);
      if (this.c_prolonger.isChecked() && qr !== null) {
        p.setPen(dessin.stylo('accent2', 0.9, 0.55 * a, true));
        this.arc(p, cx, cy, rr, me.arc(az_r, h_r, az0!, h0!, 24));
      }
      p.setPen(dessin.stylo('accent1', 2.2, a));
      this.arc(p, cx, cy, rr, me.arc(az0!, h0!, az1!, h1!, 8));
    }
    if (qr !== null) {
      p.setPen(dessin.stylo('accent3', 1.8));
      p.setBrush(null);
      p.drawEllipse(qr.x, qr.y, 9.0, 9.0);
      dessin.texte(p, qr.x, qr.y + 20, tr('anim_meteorradiant_radiant'), 'accent3', { fond: true });
    }
    for (const [cle, az] of [['n', 0.0], ['e', 90.0], ['s', 180.0], ['o', 270.0]] as [string, number][]) {
      const q = vers_ecran(cx, cy, rr + 10, az, 0.0);
      dessin.texte(p, q.x, q.y, tr('anim_meteorradiant_' + cle), 'doux');
    }
  }

  private arc(p: Peintre, cx: number, cy: number, rr: number, pts: [number, number][]): void {
    p.drawPolyline(pts.map(([az, h]) => vers_ecran(cx, cy, rr, az, h)));
  }

  private nuit(p: Peintre, r: Rect): void {
    const k = this.k();
    const lat = this.lat.value(),
      m = this.mlim.value();
    const zhr = me.essaim(k)[5];
    const ax = new Axes(r, 18.0, 30.0, 0.0, 90.0, false, false, [36, 8, 10, 30]).avec(p);
    const heures = Array.from({ length: 121 }, (_, i) => 18.0 + 0.1 * i);
    const hs = heures.map((h) => me.hauteur_soleil(k, h, lat));
    p.save();
    p.setPen(null);
    for (let i = 0; i < heures.length - 1; i++) {
      if (hs[i]! > -18.0) {
        p.setBrush(dessin.c('ciel', hs[i]! < 0 ? 0.35 : 0.6));
        p.drawRect(new Rect(ax.px(heures[i]!), ax.r.top, ax.px(heures[i + 1]!) - ax.px(heures[i]!) + 0.5, ax.r.h));
      }
    }
    p.restore();
    ax.fond(p, { titre_x: tr('anim_meteorradiant_axe_heure'), titre_y: tr('anim_meteorradiant_axe_hauteur'), fmt_x: (v) => `${pmod(pround(v), 24)} h` });
    const hr = heures.map((h) => me.hauteur_radiant(k, h, lat)[1]);
    ax.courbe(heures.map((h, i) => [h, Math.max(0.0, hr[i]!)] as [number, number]), 'accent3', 2.0);
    ax.courbe(heures.map((h, i) => [h, (90.0 * me.taux_horaire(k, hr[i]!, m)) / zhr] as [number, number]), 'accent1', 2.0, 1.0, true);
    ax.verticale(this.heure.value(), 'texte', 1.2, false);
    dessin.police(p, 0.85);
    (
      [
        ['anim_meteorradiant_leg_hauteur', 'accent3'],
        ['anim_meteorradiant_leg_taux', 'accent1'],
        ['anim_meteorradiant_leg_grise', 'doux'],
      ] as [string, string][]
    ).forEach(([cle, col], i) => dessin.texte(p, ax.r.left + 6, ax.r.top + 10 + 15 * i, tr(cle, { zhr: nombre(zhr, 0) }), col, { centre: false, fond: true }));
    dessin.police(p, 1 / 0.85);
  }
}
