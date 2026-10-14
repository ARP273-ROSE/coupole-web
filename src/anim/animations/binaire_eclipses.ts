/**
 * Eclipsing Binary Simulator (NAAP) : deux étoiles en orbite, vues presque par la tranche, s'éclipsent tour à tour.
 * Flux visuel = somme des disques moins la partie cachée ; brillance de surface dans le filtre V par la loi de Planck
 * et la courbe V (Landolt 1992).  Période par la 3e loi de Kepler.  46 binaires réelles avec leurs courbes de lumière
 * observées (CALEB, numérisées depuis l'original) ; sept sont « à compléter » : un paramètre y est volontairement faux.
 */
import BINAIRES from '../../donnees/genere/binaires.json';
import LOT3 from '../../donnees/genere/lot3.json';
import * as dc from '../../calc/deux_corps';
import * as lumiere from '../../calc/lumiere';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { Couleur, type Peintre, type Rect } from '../../noyau/peintre';
import { pmod, pround } from '../../noyau/py';
import { Animation, type Choix, type Coche, nombre, type Reglage } from '../base';
import { texte_duree } from './vitesse_radiale';

type Binaire = [string, number, number, number, number, number, number, number, number, number, number, string, number | null];
const D = LOT3 as unknown as { binaires: Binaire[]; binaires_a_completer: string[]; binaires_exemples: number[][] };
const EXEMPLES: Record<string, number[]> = {};
D.binaires_exemples.forEach((v, k) => (EXEMPLES[`exemple_${k + 1}`] = v));
const REELLES: Record<string, Binaire> = {};
for (const b of D.binaires) REELLES[b[0]] = b;

let courbes: Record<string, [number, number][]> | null = null;
/** {nom: [(phase, flux relatif)]} numérisés depuis les images de l'original. */
export function courbes_binaires(): Record<string, [number, number][]> {
  if (!courbes) {
    const d = BINAIRES as unknown as { unite: number; courbes: Record<string, [number, number][]> };
    const u = Number(d.unite);
    courbes = {};
    for (const [k, v] of Object.entries(d.courbes)) courbes[k] = v.map(([p, f]) => [p / u, f / u]);
  }
  return courbes;
}

const cacheBrillance = new Map<number, number>();
/** Brillance de surface dans le filtre V : Σ T_V(λ) B_λ(T) Δλ. */
export function brillance_v(t: number): number {
  let v = cacheBrillance.get(t);
  if (v === undefined) {
    v = lumiere.somme_filtre('V', (w) => lumiere.planck(w * 1e-9, t));
    if (cacheBrillance.size > 256) cacheBrillance.clear();
    cacheBrillance.set(t, v);
  }
  return v;
}

interface Modele {
  r1: number;
  r2: number;
  s1: number;
  s2: number;
  e: number;
  i: number;
  w: number;
  ph0: number;
  courbe: [number, number][];
  P: number;
  fmax: number;
}

export class BinaireEclipses extends Animation {
  static override ID = 'eclipsingbinarysim';

  prereglage!: Choix;
  m1!: Reglage;
  m2!: Reglage;
  r1!: Reglage;
  r2!: Reglage;
  t1!: Reglage;
  t2!: Reglage;
  a!: Reglage;
  e!: Reglage;
  i!: Reglage;
  w!: Reglage;
  decalage!: Reglage;
  unite!: Choix;
  c_donnees!: Coche;
  phase = 0.0;
  private cache: [string, Modele] | null = null;
  private cacheEcart: [string, number] | null = null;

  override construire(): void {
    this.prereglage = this.choix('systeme', [
      ...Object.keys(EXEMPLES).map((k) => ['anim_eclipsingbinarysim_' + k, k] as [string, string]),
      ...Object.keys(REELLES).map((n) => ['anim_eclipsingbinarysim_s_' + n.toLowerCase().replace(/ /g, '_'), n] as [string, string]),
    ], 'exemple_1');
    this.prereglage.activated.connect(() => this.appliquer());
    this.m1 = this.curseur('m1', 0.1, 15.0, 1.0, { dec: 2, unite: 'M☉' });
    this.m2 = this.curseur('m2', 0.1, 15.0, 1.0, { dec: 2, unite: 'M☉' });
    this.r1 = this.curseur('r1', 0.05, 25.0, 1.0, { dec: 3, unite: 'R☉', log: true });
    this.r2 = this.curseur('r2', 0.05, 25.0, 1.0, { dec: 3, unite: 'R☉', log: true });
    this.t1 = this.curseur('t1', 2500.0, 35000.0, 6000.0, { dec: 0, unite: 'K', log: true });
    this.t2 = this.curseur('t2', 2500.0, 35000.0, 6000.0, { dec: 0, unite: 'K', log: true });
    this.a = this.curseur('a', 1.0, 100.0, 6.0, { dec: 2, unite: 'R☉', log: true });
    this.e = this.curseur('e', 0.0, 0.7, 0.0, { dec: 3 });
    this.i = this.curseur('i', 0.0, 90.0, 90.0, { dec: 2, unite: '°' });
    this.w = this.curseur('omega', 0.0, 360.0, 0.0, { dec: 1, unite: '°' });
    this.decalage = this.curseur('decalage', -0.5, 0.5, 0.0, { dec: 3 });
    this.unite = this.choix('unite', [['anim_eclipsingbinarysim_u_flux', 'flux'], ['anim_eclipsingbinarysim_u_mag', 'mag']], 'flux');
    this.c_donnees = this.coche('donnees', true);
    this.phase = 0.0;
  }

  private appliquer(): void {
    const k = this.prereglage.currentData() as string;
    let m1: number, m2: number, a: number, r1: number, r2: number, t1: number, t2: number, i: number, w: number, e: number;
    if (k in EXEMPLES) [m1, m2, a, r1, r2, t1, t2, i, w, e] = EXEMPLES[k] as [number, number, number, number, number, number, number, number, number, number];
    else [, m1, m2, a, r1, r2, t1, t2, i, w, e] = REELLES[k]!;
    this.a.setValue(a);
    for (const [reg, v] of [[this.m1, m1], [this.m2, m2], [this.r1, r1 * a], [this.r2, r2 * a], [this.t1, t1], [this.t2, t2], [this.e, e], [this.i, i], [this.w, w], [this.decalage, 0.0]] as [Reglage, number][]) reg.setValue(v);
    this.rafraichir();
  }

  override etat_initial(): void {
    this.phase = 0.0;
  }

  override avancer(dt: number): void {
    this.phase = pmod(this.phase + dt / 10.0, 1.0);
  }

  modele(): Modele {
    const a = this.a.value();
    const cle = [this.m1, this.m2, this.r1, this.r2, this.t1, this.t2, this.a, this.e, this.i, this.w].map((r) => r.value()).join('|');
    if (this.cache && this.cache[0] === cle) return this.cache[1];
    const r1 = this.r1.value() / a,
      r2 = this.r2.value() / a;
    const s1 = brillance_v(Math.trunc(pround(this.t1.value()))),
      s2 = brillance_v(Math.trunc(pround(this.t2.value())));
    const e = this.e.value(),
      i = this.i.value(),
      w = this.w.value();
    const ph0 = dc.phase_conjonction(e, w);
    const fmax = Math.PI * (r1 * r1 * s1 + r2 * r2 * s2);
    const courbe: [number, number][] = [];
    for (let x = 0; x <= 400; x++) courbe.push([x / 400, dc.flux_deux_disques(ph0 + x / 400, r1, r2, s1, s2, e, i, w) / fmax]);
    const m: Modele = { r1, r2, s1, s2, e, i, w, ph0, courbe, P: dc.periode_s(a * dc.R_SOLEIL_M, this.m1.value() * dc.M_SOLEIL_KG, this.m2.value() * dc.M_SOLEIL_KG), fmax };
    this.cache = [cle, m];
    return m;
  }

  flux_a(m: Modele, phase: number): number {
    return dc.flux_deux_disques(m.ph0 + phase, m.r1, m.r2, m.s1, m.s2, m.e, m.i, m.w) / m.fmax;
  }

  donnees(): [number, number][] | null {
    return this.c_donnees.isChecked() ? (courbes_binaires()[this.prereglage.currentData() as string] ?? null) : null;
  }

  /** Écart quadratique moyen entre le modèle et les mesures (flux relatif). */
  ecart(m: Modele, pts: [number, number][], nom: string): number {
    const d = this.decalage.value();
    const cle = `${this.cache![0]}|${d}|${nom}`;
    if (!this.cacheEcart || this.cacheEcart[0] !== cle) {
      let s = 0;
      for (const [ph, f] of pts) s += (this.flux_a(m, ph + d) - f) ** 2;
      this.cacheEcart = [cle, Math.sqrt(s / pts.length)];
    }
    return this.cacheEcart[1];
  }

  override valeurs(): [string, string][] {
    const m = this.modele();
    const k = this.prereglage.currentData() as string;
    const out: [string, string][] = [
      [tr('anim_c_periode'), texte_duree(m.P)],
      [tr('anim_eclipsingbinarysim_profondeur'), `${nombre(100 * (1 - Math.min(...m.courbe.map(([, f]) => f))), 1)} %`],
    ];
    const pts = courbes_binaires()[k];
    if (pts && pts.length) {
      out.push([tr('anim_eclipsingbinarysim_ecart'), nombre(this.ecart(m, pts, k), 4)]);
      if (D.binaires_a_completer.includes(k)) out.push([tr('anim_eclipsingbinarysim_a_completer'), tr('anim_oui')]);
      const typ = REELLES[k]![11];
      if (typ) out.push([tr('anim_eclipsingbinarysim_types'), typ]);
    }
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const m = this.modele();
    const z = dessin.zones(rect, 2, 10.0);
    this.vue_couple(p, dessin.cadre(p, z[0]!, tr('anim_eclipsingbinarysim_titre_vue')), m);
    const r = dessin.cadre(p, z[1]!, tr('anim_eclipsingbinarysim_titre_courbe'));
    const mag = this.unite.currentData() === 'mag';
    const pts = this.donnees();
    const fmin = Math.min(...m.courbe.map(([, f]) => f), ...(pts ? pts.map(([, f]) => f) : []));
    const fmax = Math.max(1.0, ...(pts ? pts.map(([, f]) => f) : []));
    let conv: (f: number) => number;
    let ax: Axes;
    if (mag) {
      conv = (f) => -2.5 * Math.log10(Math.max(f, 1e-6));
      const y0 = conv(fmax) - 0.05,
        y1 = conv(fmin) + 0.05;
      ax = new Axes(r, 0, 1, y1, y0, false, false, [48, 8, 10, 28]).avec(p);
      ax.fond(p, { titre_x: tr('anim_c_phase'), titre_y: tr('anim_eclipsingbinarysim_axe_mag'), dec_x: 1, dec_y: 2 });
    } else {
      conv = (f) => f;
      ax = new Axes(r, 0, 1, Math.max(0.0, fmin - 0.05), fmax + 0.03, false, false, [48, 8, 10, 28]).avec(p);
      ax.fond(p, { titre_x: tr('anim_c_phase'), titre_y: tr('anim_c_flux_relatif'), dec_x: 1, dec_y: 2 });
    }
    if (pts) ax.points(pts.map(([ph, f]) => [ph, conv(f)] as [number, number]), 'doux', 1.5, 0.75);
    const d = this.decalage.value();
    const courbe = m.courbe.map(([x, f]) => [pmod(x - d, 1.0), conv(f)] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    ax.courbe(courbe, 'accent1', 2.0);
    ax.verticale(pmod(this.phase - d, 1.0), 'accent3', 1.2, false);
  }

  private vue_couple(p: Peintre, r: Rect, m: Modele): void {
    const cx = r.cx,
      cy = r.cy;
    const [x, y, z] = dc.relative(m.ph0 + this.phase, 1.0, m.e, m.i, m.w);
    const q = this.m2.value() / (this.m1.value() + this.m2.value());
    const k = Math.min((r.w * 0.42) / (1 + m.e), (r.h * 0.45) / Math.max(0.3, Math.abs(y) + m.r2 + q * m.r1, 0.5));
    const c1 = new Couleur(...lumiere.couleur_corps_noir(Math.trunc(pround(this.t1.value()))));
    const c2 = new Couleur(...lumiere.couleur_corps_noir(Math.trunc(pround(this.t2.value()))));
    const corps: [number, number, number, number, Couleur, string][] = [
      [-q * z, -q * x, -q * y, m.r1, c1, '1'],
      [(1 - q) * z, (1 - q) * x, (1 - q) * y, m.r2, c2, '2'],
    ];
    for (const [, xx, yy, rr, col] of [...corps].sort((a, b) => a[0] - b[0])) dessin.disque(p, cx + xx * k, cy - yy * k, Math.max(1.5, rr * k), col, 'fond');
    for (const [, xx, yy, rr, , nom] of corps) dessin.texte(p, cx + xx * k, cy - yy * k - rr * k - 10, nom, 'doux');
    p.setPen(dessin.stylo('accent3', 1.5));
    p.drawLine(cx - 5, cy, cx + 5, cy);
    p.drawLine(cx, cy - 5, cx, cy + 5);
  }
}
