/**
 * Transit Simulator (NAAP) : une planète passe devant son étoile et en masque une petite partie.  Profondeur (R_p /
 * R_*)² (disques uniformes, aire de recouvrement exacte), durée selon la taille de l'orbite et l'inclinaison, période
 * par la 3e loi de Kepler.  Mesures simulées avec du bruit.  Planètes réelles : NASA Exoplanet Archive (2026).
 */
import LOT3 from '../../donnees/genere/lot3.json';
import * as dc from '../../calc/deux_corps';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, Rect } from '../../noyau/peintre';
import { alea, gauss } from '../../noyau/py';
import { Animation, type Choix, type Coche, nombre, type Reglage } from '../base';
import { texte_duree } from './vitesse_radiale';

type Transit = [string, number, number, number, number, number, number, number, number, number | null];
const D = LOT3 as unknown as { transits: Transit[]; transits_exemples: Transit[] };
const PREREGLAGES: Record<string, Transit> = { a: D.transits_exemples[0]!, b: D.transits_exemples[1]! };
for (const t of D.transits) PREREGLAGES[t[0]] = t;

interface Systeme {
  P: number;
  r1: number;
  r2: number;
  e: number;
  i: number;
  w: number;
  ph0: number;
  duree: number;
  courbe: [number, number][];
  profondeur: number;
}

export class Transits extends Animation {
  static override ID = 'transitsimulator';

  prereglage!: Choix;
  mp!: Reglage;
  rp!: Reglage;
  ms!: Reglage;
  rs!: Reglage;
  a!: Reglage;
  e!: Reglage;
  i!: Reglage;
  w!: Reglage;
  bruit!: Reglage;
  n_mesures!: Reglage;
  c_courbe!: Coche;
  phase = 0.0;
  private mesuresCache: [number, number][] | null = null;
  private cache: [string, Systeme] | null = null;

  override construire(): void {
    this.prereglage = this.choix('systeme', [
      ['anim_transitsimulator_s_a', 'a'], ['anim_transitsimulator_s_b', 'b'],
      ...D.transits.map((t) => ['anim_transitsimulator_s_' + t[0].toLowerCase().replace(/ /g, '_').replace(/-/g, '_'), t[0]] as [string, string]),
    ], 'HD 209458 b');
    this.prereglage.activated.connect(() => this.appliquer());
    this.mp = this.curseur('masse_planete', 0.001, 15.0, 0.73, { dec: 3, unite: 'M♃', log: true });
    this.rp = this.curseur('rayon_planete', 0.05, 2.5, 1.39, { dec: 3, unite: 'R♃', log: true });
    this.ms = this.curseur('masse_etoile', 0.1, 3.0, 1.23, { dec: 3, unite: 'M☉' });
    this.rs = this.curseur('rayon_etoile', 0.1, 4.0, 1.19, { dec: 3, unite: 'R☉' });
    this.a = this.curseur('a', 0.01, 2.0, 0.048_57, { dec: 5, unite: 'ua', log: true });
    this.e = this.curseur('e', 0.0, 0.6, 0.0, { dec: 3 });
    this.i = this.curseur('i', 75.0, 90.0, 86.71, { dec: 2, unite: '°' });
    this.w = this.curseur('omega', 0.0, 360.0, 90.0, { dec: 1, unite: '°' });
    this.bruit = this.curseur('bruit', 0.0, 0.01, 0.002, { dec: 4 });
    this.n_mesures = this.curseur('mesures', 0.0, 1000.0, 200.0, { dec: 0 });
    this.c_courbe = this.coche('courbe', true);
    this.phase = 0.0;
    this.mesuresCache = null;
  }

  private appliquer(): void {
    const t = PREREGLAGES[this.prereglage.currentData() as string]!;
    const [, mp, rp, ms, rs, a0, e, i, w, periode] = t;
    let a = a0;
    if (periode) a = dc.demi_grand_axe_m(periode * dc.JOUR_S, ms * dc.M_SOLEIL_KG, mp * dc.M_JUPITER_KG) / dc.UA_M;
    for (const [reg, v] of [[this.mp, mp], [this.rp, rp], [this.ms, ms], [this.rs, rs], [this.a, a], [this.e, e], [this.i, i], [this.w, w]] as [Reglage, number][]) reg.setValue(v);
    this.phase = 0.0;
    this.rafraichir();
  }

  override etat_initial(): void {
    this.phase = 0.0;
    this.mesuresCache = null;
  }

  override reglage_change(): void {
    this.mesuresCache = null;
    super.reglage_change();
  }

  systeme(): Systeme {
    const cle = [this.mp, this.rp, this.ms, this.rs, this.a, this.e, this.i, this.w].map((r) => r.value()).join('|');
    if (this.cache && this.cache[0] === cle) return this.cache[1];
    const a_m = this.a.value() * dc.UA_M;
    const m1 = this.ms.value() * dc.M_SOLEIL_KG,
      m2 = this.mp.value() * dc.M_JUPITER_KG;
    const r1 = (this.rs.value() * dc.R_SOLEIL_M) / a_m,
      r2 = (this.rp.value() * dc.R_JUPITER_M) / a_m;
    const e = this.e.value(),
      i = this.i.value(),
      w = this.w.value();
    const ph0 = dc.phase_conjonction(e, w);
    const s: Systeme = { P: dc.periode_s(a_m, m1, m2), r1, r2, e, i, w, ph0, duree: dc.duree_transit(ph0, r1, r2, e, i, w, 2000), courbe: [], profondeur: 0 };
    const h = Transits.fenetre(s);
    for (let k = 0; k < 301; k++) {
      const x = -h + (2 * h * k) / 300;
      s.courbe.push([x, Transits.flux_relatif(s, ph0 + x)]);
    }
    s.profondeur = 1 - Math.min(...s.courbe.map(([, f]) => f));
    this.cache = [cle, s];
    return s;
  }

  static flux_relatif(s: Systeme, phase: number): number {
    const [x, y, z] = dc.relative(phase, 1.0, s.e, s.i, s.w);
    if (z <= 0) return 1.0;
    return 1.0 - dc.aire_recouvrement(s.r1, s.r2, Math.hypot(x, y)) / (Math.PI * s.r1 ** 2);
  }

  static fenetre(s: Systeme): number {
    return Math.min(0.5, Math.max(0.01, s.duree > 0 ? 1.5 * s.duree : 0.03));
  }

  mesures(s: Systeme): [number, number][] {
    if (this.mesuresCache === null) {
      const u = alea(7);
      const h = Transits.fenetre(s);
      const sig = this.bruit.value();
      this.mesuresCache = [];
      for (let k = 0; k < Math.trunc(this.n_mesures.value()); k++) {
        const dx = -h + 2 * h * u();
        this.mesuresCache.push([dx, Transits.flux_relatif(s, s.ph0 + dx) + gauss(u, 0.0, sig)]);
      }
    }
    return this.mesuresCache;
  }

  override avancer(dt: number): void {
    const h = Transits.fenetre(this.systeme());
    this.phase = this.phase + (dt * h) / 4.0;
    if (this.phase > h) this.phase = -h;
  }

  override valeurs(): [string, string][] {
    const s = this.systeme();
    const R = Math.PI / 180;
    const b = ((Math.cos(s.i * R) / s.r1) * (1 - s.e ** 2)) / (1 + s.e * Math.sin(s.w * R));
    const out: [string, string][] = [
      [tr('anim_c_periode'), texte_duree(s.P)],
      [tr('anim_transitsimulator_profondeur'), `${nombre(100 * s.profondeur, 3)} %`],
      [tr('anim_transitsimulator_rapport'), `(R_p / R_*)² = ${nombre(100 * (s.r2 / s.r1) ** 2, 3)} %`],
      [tr('anim_transitsimulator_duree'), s.duree ? texte_duree(s.duree * s.P) : tr('anim_transitsimulator_pas_de_transit')],
      [tr('anim_transitsimulator_b'), nombre(b, 3)],
    ];
    const pub = PREREGLAGES[this.prereglage.currentData() as string]![9];
    if (pub) out.push([tr('anim_transitsimulator_p_publiee'), `${nombre(pub, 4)} ${tr('anim_c_jours')}`]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const s = this.systeme();
    const z = dessin.zones(rect, 2, 10.0);
    this.vue_etoile(p, dessin.cadre(p, z[0]!, tr('anim_transitsimulator_titre_vue')), s);
    const r = dessin.cadre(p, z[1]!, tr('anim_transitsimulator_titre_courbe'));
    const h = Transits.fenetre(s);
    const prof = (s.r2 / s.r1) ** 2;
    const bas = 1 - Math.max(prof * 1.6, 4 * this.bruit.value(), 0.002);
    const ax = new Axes(r, -h, h, bas, 1 + Math.max(prof * 0.4, 3 * this.bruit.value(), 0.0008), false, false, [58, 8, 12, 28]).avec(p);
    ax.fond(p, { titre_x: tr('anim_transitsimulator_axe_phase'), titre_y: tr('anim_c_flux_relatif'), dec_y: prof < 0.01 ? 4 : 3, dec_x: 3 });
    if (this.n_mesures.value() > 0) ax.points(this.mesures(s), 'doux', 1.6, 0.7);
    if (this.c_courbe.isChecked()) ax.courbe(s.courbe, 'accent1', 2.0);
    ax.verticale(this.phase, 'accent3', 1.2, false);
  }

  private vue_etoile(p: Peintre, r: Rect, s: Systeme): void {
    const cx = r.cx,
      cy = r.cy;
    const k = Math.min(r.w * 0.3, r.h * 0.42) / s.r1;
    dessin.disque(p, cx, cy, s.r1 * k, 'soleil', null, 0.9);
    const pts = [-0.05, 0.05].map((d) => dc.relative(s.ph0 + d, 1.0, s.e, s.i, s.w));
    p.setPen(dessin.stylo('grille', 1.0, null, true));
    p.drawLine(cx + pts[0]![0] * k, cy - pts[0]![1] * k, cx + pts[1]![0] * k, cy - pts[1]![1] * k);
    const [x, y, zz] = dc.relative(s.ph0 + this.phase, 1.0, s.e, s.i, s.w);
    if (zz > 0 || Math.hypot(x, y) > s.r1) dessin.disque(p, cx + x * k, cy - y * k, Math.max(1.5, s.r2 * k), 'nuit', 'doux');
    dessin.texte(p, r.left + 8, r.bottom - 8, tr('anim_transitsimulator_echelle'), 'doux', { centre: false });
  }
}
