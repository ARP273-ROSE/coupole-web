/**
 * Les points de Lagrange : repère tournant, cinq équilibres, têtards, fers à cheval, zones interdites (constante de
 * Jacobi), rayon de Hill.  Jumeau de `animations/lagrange.py` de Coupole (calculs : `calc/lagrange.ts`).
 */
import * as lg from '../../calc/lagrange';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { Animation, type Choix, type Coche, nombre, type Reglage } from '../base';

const VITESSE = 4.0 * Math.PI;
const N_TRACE = 20000;
const PAS_TRACE = 0.05;
const N_GRILLE = 90;
const EXPOSANTS: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };

export function distance(x_a: number, a_km: number): string {
  const km = x_a * a_km;
  const s = km >= 1e6 ? nombre(km / 1e6, 2) + ' ' + tr('anim_lagrange_millions_km') : nombre(km, 0) + ' km';
  return `${nombre(x_a, 4)} a = ${s}`;
}

export function scientifique(x: number): string {
  if (x >= 0.01) return nombre(x, 5);
  const n = Math.floor(Math.log10(x));
  return `${nombre(x / 10 ** n, 3)} × 10${String(n).split('').map((c) => EXPOSANTS[c] ?? c).join('')}`;
}

type Cle = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export class Lagrange extends Animation {
  static override ID = 'lagrange';
  static override LECTURE_AU_DEPART = true;

  systeme!: Choix;
  cas!: Choix;
  delta!: Reglage;
  c_interdit!: Coche;
  c_hill!: Coche;
  s: lg.Etat = [0, 0, 0, 0];
  t = 0.0;
  trace: [number, number][] = [];
  collision = false;
  private cle: string | null = null;
  private cas_applique: unknown = 'tetard';
  private cache = new Map<boolean, [string, [number, number][]]>();

  override construire(): void {
    this.systeme = this.choix('systeme', lg.SYSTEMES.map(([k]) => ['anim_lagrange_s_' + k, k] as [string, string]), 'soleil_jupiter');
    this.cas = this.choix('cas', lg.CAS.map(([k]) => ['anim_lagrange_c_' + k, k] as [string, string]), 'tetard');
    this.delta = this.curseur('delta', -0.03, 0.03, 0.005, { dec: 4 });
    this.c_interdit = this.coche('interdit', true);
    this.c_hill = this.coche('hill', true);
    this.bouton('anim_lagrange_relancer', () => this.recommencer());
    this.cle = null;
    this.cache = new Map();
    this.cas_applique = this.cas.currentData();
    this.recommencer();
  }

  mu_a(): [number, number] {
    const [, m, a] = lg.SYSTEMES.find(([k]) => k === this.systeme.currentData())!;
    return [m, a];
  }

  private cle_depart(): string {
    return [this.systeme.currentData(), this.cas.currentData(), this.delta.value()].join('|');
  }

  recommencer(): void {
    const [mu] = this.mu_a();
    this.s = lg.depart(mu, String(this.cas.currentData()), this.delta.value());
    this.t = 0.0;
    this.trace = [[this.s[0], this.s[1]]];
    this.collision = false;
    this.cle = this.cle_depart();
    this.rafraichir();
  }

  override reglage_change(): void {
    if (this.cas) {
      const c = this.cas.currentData();
      if (c !== this.cas_applique) {
        this.cas_applique = c;
        this.delta.setValue(lg.CAS.find(([k]) => k === c)![1]);
      }
    }
    if (this.cle !== null && this.cle !== this.cle_depart()) this.recommencer();
    super.reglage_change();
  }

  override avancer(dt: number): void {
    if (this.collision) return;
    const [mu] = this.mu_a();
    const total = dt * VITESSE;
    const n = Math.max(1, Math.ceil(total / PAS_TRACE));
    for (let k = 0; k < n; k++) {
      [this.s, this.collision] = lg.integrer(mu, this.s, total / n);
      this.t += total / n;
      this.trace.push([this.s[0], this.s[1]]);
      if (this.collision) break;
    }
    if (this.trace.length > N_TRACE) this.trace.splice(0, this.trace.length - N_TRACE);
  }

  override valeurs(): [string, string][] {
    const [mu, a] = this.mu_a();
    const L = lg.points_lagrange(mu);
    const sec = 1.0 - mu;
    const c = lg.jacobi(mu, ...this.s);
    const cl = (k: Cle): number => lg.jacobi(mu, L[k][0], L[k][1], 0.0, 0.0);
    const out: [string, string][] = [
      [tr('anim_lagrange_v_mu'), scientifique(mu)],
      [tr('anim_lagrange_v_l1'), distance(sec - L.L1[0], a)],
      [tr('anim_lagrange_v_l2'), distance(L.L2[0] - sec, a)],
      [tr('anim_lagrange_v_hill'), distance(lg.rayon_hill(mu), a)],
      [tr('anim_lagrange_v_l4'), tr(mu < lg.MU_ROUTH ? 'anim_lagrange_stables' : 'anim_lagrange_instables')],
      [tr('anim_lagrange_v_c'), nombre(c, 6)],
      [tr('anim_lagrange_v_cl'), `L1 ${nombre(cl('L1'), 6)} · L2 ${nombre(cl('L2'), 6)} · L3 ${nombre(cl('L3'), 6)} · L4 ${nombre(cl('L4'), 6)}`],
      [tr('anim_lagrange_v_regions'), tr('anim_lagrange_' + lg.regions(mu, c))],
      [tr('anim_lagrange_v_temps'), tr('anim_lagrange_orbites', { n: nombre(this.t / (2.0 * Math.PI), 1) })],
    ];
    if (this.collision) out.push([tr('anim_lagrange_v_etat'), tr('anim_lagrange_contact')]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones_principale(rect, 2, 0.56);
    const [mu] = this.mu_a();
    this.carte(p, dessin.cadre(p, z[0]!, tr('anim_lagrange_t_carte')), mu, [0.0, 0.0], 1.55, true);
    const rh = lg.rayon_hill(mu);
    this.carte(p, dessin.cadre(p, z[1]!, tr('anim_lagrange_t_zoom')), mu, [1.0 - mu, 0.0], 2.6 * rh, false);
    this.potentiel(p, dessin.cadre(p, z[2]!, tr('anim_lagrange_t_potentiel')), mu);
  }

  private carte(p: Peintre, r: Rect, mu: number, centre: [number, number], demi: number, grande: boolean): void {
    const cote = Math.min(r.w, r.h - 6);
    const k = cote / (2.0 * demi);
    const cx = r.cx,
      cy = r.cy + 4;
    const pt = (x: number, y: number): Pt => new Pt(cx + k * (x - centre[0]), cy - k * (y - centre[1]));
    const c = lg.jacobi(mu, ...this.s);
    if (this.c_interdit.isChecked()) {
      const n = N_GRILLE;
      const cle = [mu, c.toFixed(12), centre.join(','), demi, cote.toFixed(1)].join('|');
      let cache = this.cache.get(grande);
      if (!cache || cache[0] !== cle) {
        const cases: [number, number][] = [];
        for (let j = 0; j < n; j++) {
          for (let i = 0; i < n; i++) {
            const x = centre[0] - demi + ((i + 0.5) * 2.0 * demi) / n;
            const y = centre[1] + demi - ((j + 0.5) * 2.0 * demi) / n;
            if (2.0 * lg.omega(mu, x, y) < c) cases.push([i, j]);
          }
        }
        cache = [cle, cases];
        this.cache.set(grande, cache);
      }
      const h = cote / n;
      const x0 = cx - cote / 2.0,
        y0 = cy - cote / 2.0;
      const coul = dessin.c('grille', 0.45);
      for (const [i, j] of cache[1]) {
        const xa = Math.floor(x0 + i * h),
          ya = Math.floor(y0 + j * h);
        p.fillRect(new Rect(xa, ya, Math.floor(x0 + (i + 1) * h) - xa, Math.floor(y0 + (j + 1) * h) - ya), coul);
      }
    }
    p.save();
    p.setClipRect(r);
    const g = pt(-mu, 0.0),
      s2 = pt(1.0 - mu, 0.0);
    dessin.disque(p, g.x, g.y, grande ? 9.0 : 4.0, 'soleil');
    dessin.disque(p, s2.x, s2.y, 5.0, 'terre');
    if (this.c_hill.isChecked()) {
      p.setBrush(null);
      p.setPen(dessin.stylo('accent2', 1.0, 0.8, true));
      p.drawEllipse(s2.x, s2.y, lg.rayon_hill(mu) * k, lg.rayon_hill(mu) * k);
    }
    const tr_ = this.trace.map(([x, y]) => pt(x, y));
    if (tr_.length >= 2) {
      p.setPen(dessin.stylo('accent1', 1.2, 0.85));
      for (let q = 0; q + 1 < tr_.length; q++) {
        const q0 = tr_[q]!,
          q1 = tr_[q + 1]!;
        if (Math.abs(q0.x - q1.x) + Math.abs(q0.y - q1.y) < 4 * cote) p.drawLine(q0.x, q0.y, q1.x, q1.y);
      }
    }
    const q = pt(this.s[0], this.s[1]);
    dessin.disque(p, q.x, q.y, 4.0, 'accent3', 'texte');
    const L = lg.points_lagrange(mu);
    for (const nom of ['L1', 'L2', 'L3', 'L4', 'L5'] as Cle[]) {
      const ql = pt(L[nom][0], L[nom][1]);
      if (r.contains(ql)) {
        p.setPen(dessin.stylo('accent2', 1.8));
        p.drawLine(ql.x - 5, ql.y - 5, ql.x + 5, ql.y + 5);
        p.drawLine(ql.x - 5, ql.y + 5, ql.x + 5, ql.y - 5);
        dessin.etiquette(p, ql.x, ql.y, nom, 'accent2');
      }
    }
    p.restore();
  }

  private potentiel(p: Peintre, r: Rect, mu: number): void {
    const L = lg.points_lagrange(mu);
    const ymin = -4.0,
      ymax = -1.3;
    const ax = new Axes(r, -1.6, 1.6, ymin, ymax, false, false, [44, 8, 10, 30]).avec(p);
    ax.fond(p, { titre_x: tr('anim_lagrange_axe_x'), titre_y: tr('anim_lagrange_axe_phi') });
    const m = 600;
    const pts: [number, number][] = [];
    for (let j = 0; j <= m; j++) {
      const x = -1.6 + (3.2 * j) / m;
      pts.push([x, Math.max(ymin - 1.0, -lg.omega(mu, x, 0.0))]);
    }
    ax.courbe(pts, 'accent2', 1.8);
    const c = lg.jacobi(mu, ...this.s);
    ax.horizontale(-c / 2.0, 'accent3', 1.2);
    for (const nom of ['L1', 'L2', 'L3'] as Cle[]) {
      const x = L[nom][0];
      const v = -lg.omega(mu, x, 0.0);
      if (ymin <= v && v <= ymax) {
        dessin.disque(p, ax.px(x), ax.py(v), 3.5, 'accent2');
        dessin.etiquette(p, ax.px(x), ax.py(v), nom, 'accent2');
      }
    }
    dessin.texte(p, ax.r.left + 6, ax.r.bottom - 10, tr('anim_lagrange_legende_pot'), 'doux', { centre: false, fond: true });
  }
}
