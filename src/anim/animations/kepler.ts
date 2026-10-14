/**
 * Planetary Orbit Simulator (NAAP) : une planète fictive autour du Soleil selon les lois de Kepler.  1re loi :
 * ellipse dont le Soleil occupe un foyer ; 2e loi : aires balayées égales en temps égaux ; 3e loi : P² = a³ (P en
 * années, a en ua).  Vitesse par la relation de vis-viva.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, type Rect } from '../../noyau/peintre';
import { linspace } from '../../noyau/py';
import { Animation, type Choix, type Coche, nombre, type Reglage } from '../base';

// Orbites du Système solaire de l'original (a en ua, e)
export const PLANETES: [string, number, number][] = [
  ['mercure', 0.387, 0.206], ['venus', 0.723, 0.007], ['terre', 1.0, 0.017], ['mars', 1.524, 0.093],
  ['jupiter', 5.203, 0.048], ['saturne', 9.54, 0.056], ['uranus', 19.18, 0.047], ['neptune', 30.06, 0.009],
  ['pluton', 39.44, 0.249],
];

export class OrbiteKepler extends Animation {
  static override ID = 'kepler';
  static PERIODES_PAR_S = 0.1;

  a!: Reglage;
  e!: Reglage;
  choix_planete!: Choix;
  c_centre!: Coche;
  c_foyer!: Coche;
  c_axes!: Coche;
  c_rayon!: Coche;
  c_vitesse!: Coche;
  c_systeme!: Coche;
  balayage!: Reglage;
  c_balayer!: Coche;
  f = 0.0;
  aires: [number, number][] = [];
  private debut_balayage: number | null = null;
  private orbite_balayee: [number, number] | null = null;

  override construire(): void {
    this.a = this.curseur('a', 0.1, 50.0, 1.0, { dec: 3, unite: 'ua', log: true });
    this.e = this.curseur('e', 0.0, 0.7, 0.017, { dec: 3 });
    this.choix_planete = this.choix('planete', [['anim_kepler_aucune', ''], ...PLANETES.map(([n]) => ['anim_planete_' + n, n] as [string, string])], '');
    this.choix_planete.activated.connect(() => this.planete());
    this.c_centre = this.coche('centre', false);
    this.c_foyer = this.coche('foyer_vide', false);
    this.c_axes = this.coche('axes', false);
    this.c_rayon = this.coche('rayon', true);
    this.c_vitesse = this.coche('vitesse', false);
    this.c_systeme = this.coche('systeme', false);
    this.balayage = this.curseur('balayage', 0.02, 0.5, 0.125, { dec: 3, cle_texte: 'anim_kepler_balayage' });
    this.c_balayer = this.coche('balayer', false);
    this.bouton('anim_kepler_effacer', () => this.effacer());
    this.f = 0.0;
    this.aires = [];
    this.debut_balayage = null;
  }

  private planete(): void {
    const n = this.choix_planete.currentData();
    for (const [nom, a, e] of PLANETES) {
      if (nom === n) {
        this.e.setValue(e);
        this.a.setValue(a);
      }
    }
  }

  private effacer(): void {
    this.aires = [];
    this.debut_balayage = null;
    this.rafraichir();
  }

  override etat_initial(): void {
    this.f = 0.0;
    this.effacer();
  }

  override reglage_change(): void {
    const cle: [number, number] = [this.a.value(), this.e.value()];
    const avant = this.orbite_balayee ?? cle;
    if (avant[0] !== cle[0] || avant[1] !== cle[1]) {
      this.aires = [];
      this.debut_balayage = null;
    }
    this.orbite_balayee = cle;
    super.reglage_change();
  }

  override avancer(dt: number): void {
    const f1 = this.f + dt * OrbiteKepler.PERIODES_PAR_S;
    if (this.c_balayer.isChecked()) {
      if (this.debut_balayage === null) this.debut_balayage = this.f;
      const s = this.balayage.value();
      while (f1 - this.debut_balayage >= s) {
        this.aires.push([this.debut_balayage, this.debut_balayage + s]);
        this.aires = this.aires.slice(-8);
        this.debut_balayage += 2 * s;
      }
    } else this.debut_balayage = null;
    this.f = f1;
  }

  override valeurs(): [string, string][] {
    const a = this.a.value(),
      e = this.e.value();
    const o = astro.orbite(a, e, this.f);
    const p = astro.periode_annees(a);
    const out: [string, string][] = [
      [tr('anim_kepler_periode'), `${nombre(p, 3)} ${tr('anim_u_annees')}`],
      [tr('anim_kepler_b'), `${nombre(a * Math.sqrt(1 - e * e), 3)} ua`],
      [tr('anim_kepler_peri_aphe'), `${nombre(a * (1 - e), 3)} / ${nombre(a * (1 + e), 3)} ua`],
      [tr('anim_kepler_r'), `${nombre(o.r, 3)} ua`],
      [tr('anim_kepler_v'), `${nombre(o.v, 2)} km/s`],
      [tr('anim_kepler_temps'), `${nombre(this.f * p, 3)} ${tr('anim_u_annees')}`],
    ];
    if (this.aires.length) {
      const [f0, f1] = this.aires[this.aires.length - 1]!;
      out.push([tr('anim_kepler_aire'), `${nombre(astro.aire_balayee(a, e, f0, f1), 4)} ua² (${nombre(100 * (f1 - f0), 1)} %)`]);
    }
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const a = this.a.value(),
      e = this.e.value();
    const b = a * Math.sqrt(1 - e * e);
    const c = a * e;
    let echelle = Math.min((rect.w - 40) / (2 * a), (rect.h - 40) / (2 * b));
    if (this.c_systeme.isChecked()) echelle = Math.min(echelle, (Math.min(rect.w, rect.h) - 40) / (2 * 1.15 * Math.max(a * (1 + e), 1.0)));
    const cx = rect.cx - c * echelle,
      cy = rect.cy;
    const fx = cx + c * echelle;
    const ecr = (x: number, y: number): Pt => new Pt(fx + x * echelle, cy - y * echelle);
    if (this.c_systeme.isChecked()) {
      for (const [, ap, ep] of PLANETES) {
        const pts = linspace(0, 2 * Math.PI, 181).map((t) => ecr(ap * (Math.cos(t) - ep), ap * Math.sqrt(1 - ep * ep) * Math.sin(t)));
        p.setPen(dessin.stylo('grille', 1.0, 0.7));
        p.setBrush(null);
        p.drawPolyline(pts);
      }
    }
    for (const [f0, f1] of this.aires) {
      const pts = [ecr(0, 0)];
      for (const f of linspace(f0, f1, 40)) {
        const o = astro.orbite(a, e, f);
        pts.push(ecr(o.x, o.y));
      }
      p.setPen(null);
      p.setBrush(dessin.c('accent2', 0.35));
      p.drawPolygon(pts);
    }
    p.setPen(dessin.stylo('texte', 1.6));
    p.setBrush(null);
    p.drawPolyline(linspace(0, 2 * Math.PI, 241).map((x) => ecr(a * (Math.cos(x) - e), b * Math.sin(x))));
    if (this.c_axes.isChecked()) {
      p.setPen(dessin.stylo('accent1', 1.5));
      p.drawLineP(ecr(-c - a, 0), ecr(-c + a, 0));
      p.drawLineP(ecr(-c, -b), ecr(-c, b));
      dessin.texte(p, ecr(-c + a / 2, 0).x, ecr(0, 0).y - 10, 'a', 'accent1');
      dessin.texte(p, ecr(-c, b / 2).x + 10, ecr(-c, b / 2).y, 'b', 'accent1');
    }
    if (this.c_centre.isChecked()) {
      const q = ecr(-c, 0);
      dessin.disque(p, q.x, q.y, 3, 'accent1');
    }
    if (this.c_foyer.isChecked()) {
      const q = ecr(-2 * c, 0);
      p.setPen(dessin.stylo('accent1', 1.5));
      p.setBrush(null);
      p.drawEllipse(q.x, q.y, 4, 4);
    }
    const o = astro.orbite(a, e, this.f);
    const q = ecr(o.x, o.y);
    if (this.c_rayon.isChecked()) {
      p.setPen(dessin.stylo('accent2', 1.4));
      p.drawLineP(ecr(0, 0), q);
    }
    if (this.c_vitesse.isChecked()) {
      const o2 = astro.orbite(a, e, this.f + 1e-4);
      const dx = o2.x - o.x,
        dy = o2.y - o.y;
      const n = Math.hypot(dx, dy) || 1;
      const longueur = (0.25 * a * echelle * o.v) / astro.orbite(a, e, 0.0).v;
      dessin.fleche(p, q.x, q.y, q.x + (dx / n) * longueur, q.y - (dy / n) * longueur, dessin.stylo('accent3', 2.0), 8);
    }
    dessin.disque(p, fx, cy, 9, 'soleil');
    dessin.disque(p, q.x, q.y, 6, 'terre', 'texte');
  }
}
