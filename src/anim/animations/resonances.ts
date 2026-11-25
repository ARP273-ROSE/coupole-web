/**
 * Résonances et chaos : un astéroïde et son jumeau sous l'effet du Soleil et de Jupiter ; figures fermées des
 * résonances dans le repère tournant, demi-grand axe au fil du temps, écart des jumeaux (chaos).  Jumeau de
 * `animations/resonances.py` de Coupole (calculs : `calc/resonances.ts`, `calc/lagrange.ts`).
 */
import * as lg from '../../calc/lagrange';
import * as rs from '../../calc/resonances';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, Pt, type Rect } from '../../noyau/peintre';
import { Animation, type Choix, type Coche, nombre, type Reglage } from '../base';

const VITESSE = 2.0 * Math.PI;
const PAS_TRACE = 0.1;
const N_TRACE = 8000;
const FENETRE = 60.0;
const EXPOSANTS: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };

export function scientifique(x: number): string {
  if (x < 1e4) return nombre(x, x >= 100 ? 0 : 1);
  let n = Math.floor(Math.log10(x));
  let m = x / 10 ** n;
  if (Number(m.toFixed(2)) >= 10.0) {
    n += 1;
    m /= 10.0;
  }
  return `${nombre(m, 2)} × 10${String(n).split('').map((c) => EXPOSANTS[c] ?? c).join('')}`;
}

type Point = [number, number, number];

export class Resonances extends Animation {
  static override ID = 'resonances';
  static override LECTURE_AU_DEPART = true;

  cas!: Choix;
  a!: Reglage;
  e!: Reglage;
  phi!: Reglage;
  masse!: Choix;
  repere!: Choix;
  c_jumeau!: Coche;
  s1: lg.Etat = [0, 0, 0, 0];
  s2: lg.Etat = [0, 0, 0, 0];
  t = 0.0;
  trace1: Point[] = [];
  trace2: Point[] = [];
  histoire: [number, number, number, number][] = [];
  collision = false;
  private cas_applique: unknown = 'hilda';
  private cle_: string | null = null;

  override construire(): void {
    this.cas = this.choix('cas', rs.CAS.map(([k]) => ['anim_resonances_c_' + k, k] as [string, string]), 'hilda');
    this.a = this.curseur('a', 1.8, 6.0, 3.97, { dec: 3, unite: 'ua' });
    this.e = this.curseur('e', 0.0, 0.9, 0.15, { dec: 2 });
    this.phi = this.curseur('phi', 0.0, 360.0, 0.0, { dec: 0, unite: '°' });
    this.masse = this.choix('masse', [['anim_resonances_m_reelle', 'reelle'], ['anim_resonances_m_x10', 'x10']], 'reelle');
    this.repere = this.choix('repere', [['anim_resonances_r_tournant', 'tournant'], ['anim_resonances_r_fixe', 'fixe']], 'tournant');
    this.c_jumeau = this.coche('jumeau', true);
    this.bouton('anim_resonances_relancer', () => this.recommencer());
    this.cas_applique = this.cas.currentData();
    this.cle_ = null;
    this.recommencer();
  }

  mu(): number {
    return rs.MU_JUPITER * (this.masse.currentData() === 'x10' ? 10.0 : 1.0);
  }

  private cle(): string {
    return [this.a.value(), this.e.value(), this.phi.value(), this.masse.currentData()].join('|');
  }

  recommencer(): void {
    const mu = this.mu();
    this.s1 = rs.etat_initial(this.a.value(), this.e.value(), this.phi.value(), mu);
    this.s2 = rs.jumeau(this.s1);
    this.t = 0.0;
    this.trace1 = [[0.0, this.s1[0], this.s1[1]]];
    this.trace2 = [[0.0, this.s2[0], this.s2[1]]];
    const [a, e] = rs.elements(this.s1, mu);
    this.histoire = [[0.0, a, e, rs.ecart(this.s1, this.s2)]];
    this.collision = false;
    this.cle_ = this.cle();
    this.rafraichir();
  }

  override reglage_change(): void {
    if (this.cas) {
      const c = this.cas.currentData();
      if (c !== this.cas_applique) {
        this.cas_applique = c;
        for (const [k, a, e, phi] of rs.CAS) {
          if (k === c) {
            this.a.setValue(a);
            this.e.setValue(e);
            this.phi.setValue(phi);
          }
        }
      }
    }
    if (this.cle_ !== null && this.cle_ !== this.cle()) this.recommencer();
    super.reglage_change();
  }

  override avancer(dt: number): void {
    if (this.collision) return;
    const mu = this.mu();
    const total = dt * VITESSE;
    const n = Math.max(1, Math.ceil(total / PAS_TRACE));
    for (let k = 0; k < n; k++) {
      [this.s1, this.s2, this.collision] = rs.avancer(mu, this.s1, this.s2, total / n);
      this.t += total / n;
      this.trace1.push([this.t, this.s1[0], this.s1[1]]);
      this.trace2.push([this.t, this.s2[0], this.s2[1]]);
      const [a, e] = rs.elements(this.s1, mu);
      this.histoire.push([this.t, a, e, rs.ecart(this.s1, this.s2)]);
      if (this.collision) break;
    }
    for (const tr_ of [this.trace1, this.trace2]) if (tr_.length > N_TRACE) tr_.splice(0, tr_.length - N_TRACE);
    const t_min = this.t - FENETRE * 2.0 * Math.PI;
    if (this.histoire[0]![0] < t_min - 10.0) this.histoire = this.histoire.filter((h) => h[0] >= t_min);
  }

  override valeurs(): [string, string][] {
    const mu = this.mu();
    const [a, e] = rs.elements(this.s1, mu);
    const orbites = this.t / (2.0 * Math.PI);
    const out: [string, string][] = [[tr('anim_resonances_v_temps'), tr('anim_resonances_temps', { n: nombre(orbites, 1), ans: nombre(orbites * rs.ANNEE_JUPITER, 0) })]];
    if (Number.isFinite(a)) {
      const [[p, q], d] = rs.resonance_proche(a);
      out.push(
        [tr('anim_resonances_v_a'), `${nombre(a, 3)} ua`],
        [tr('anim_resonances_v_e'), nombre(e, 3)],
        [tr('anim_resonances_v_rapport'), nombre(rs.rapport_periodes(a), 3)],
        [tr('anim_resonances_v_proche'), tr('anim_resonances_proche', { p, q, a: nombre(rs.A_JUPITER_UA * (q / p) ** (2.0 / 3.0), 2), d: nombre(100.0 * d, 1) })],
      );
    } else out.push([tr('anim_resonances_v_a'), tr('anim_resonances_ejecte')]);
    const d = rs.ecart(this.s1, this.s2);
    out.push([tr('anim_resonances_v_ecart'), tr('anim_resonances_ecart', { km: scientifique(d * rs.A_JUPITER_UA * 149_597_870.7), f: scientifique(d / rs.DELTA0) })]);
    if (this.collision) out.push([tr('anim_resonances_v_etat'), tr('anim_resonances_collision')]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones_principale(rect, 2, 0.56);
    const titre = this.repere.currentData() === 'tournant' ? 'anim_resonances_t_tournant' : 'anim_resonances_t_fixe';
    this.vue_orbite(p, dessin.cadre(p, z[0]!, tr(titre)));
    this.demi_axe(p, dessin.cadre(p, z[1]!, tr('anim_resonances_t_a')));
    this.ecart(p, dessin.cadre(p, z[2]!, tr('anim_resonances_t_ecart')));
  }

  private vue_orbite(p: Peintre, r: Rect): void {
    const mu = this.mu();
    const fixe = this.repere.currentData() === 'fixe';
    const demi = Math.min(3.0, Math.max(1.3, (this.a.value() / rs.A_JUPITER_UA) * (1.0 + this.e.value()) * 1.1));
    const cote = Math.min(r.w, r.h - 6);
    const k = cote / (2.0 * demi);
    const cx = r.cx,
      cy = r.cy + 4;
    const pt = (t: number, x: number, y: number): Pt => {
      if (fixe) [x, y] = rs.inertiel(x, y, t);
      return new Pt(cx + k * x, cy - k * y);
    };
    p.save();
    p.setClipRect(r);
    p.setBrush(null);
    p.setPen(dessin.stylo('grille', 1.0, 0.8, true));
    p.drawEllipse(cx, cy, k, k);
    for (const [trace, cle, ep] of [[this.trace2, 'accent2', 1.0], [this.trace1, 'accent1', 1.3]] as [Point[], string, number][]) {
      if (trace === this.trace2 && !this.c_jumeau.isChecked()) continue;
      const pts = trace.map((q) => pt(...q));
      p.setPen(dessin.stylo(cle, ep, 0.85));
      for (let j = 0; j + 1 < pts.length; j++) {
        const q0 = pts[j]!,
          q1 = pts[j + 1]!;
        if (Math.abs(q0.x - q1.x) + Math.abs(q0.y - q1.y) < cote) p.drawLine(q0.x, q0.y, q1.x, q1.y);
      }
    }
    const sol = pt(this.t, -mu, 0.0);
    const jup = pt(this.t, 1.0 - mu, 0.0);
    dessin.disque(p, sol.x, sol.y, 7.0, 'soleil');
    dessin.disque(p, jup.x, jup.y, 5.0, 'ecliptique');
    dessin.etiquette(p, jup.x, jup.y, tr('anim_resonances_jupiter'), 'doux');
    if (!fixe) {
      for (const nom of ['L4', 'L5'] as const) {
        const [x, y] = lg.points_lagrange(mu)[nom];
        const q = pt(this.t, x, y);
        p.setPen(dessin.stylo('doux', 1.2));
        p.drawLine(q.x - 4, q.y - 4, q.x + 4, q.y + 4);
        p.drawLine(q.x - 4, q.y + 4, q.x + 4, q.y - 4);
      }
    }
    if (this.c_jumeau.isChecked()) {
      const q2 = pt(this.t, this.s2[0], this.s2[1]);
      dessin.disque(p, q2.x, q2.y, 3.5, 'accent2');
    }
    const q1 = pt(this.t, this.s1[0], this.s1[1]);
    dessin.disque(p, q1.x, q1.y, 4.0, 'accent3', 'texte');
    p.restore();
  }

  private demi_axe(p: Peintre, r: Rect): void {
    const t1 = Math.max(this.t, FENETRE * 2.0 * Math.PI);
    const t0 = t1 - FENETRE * 2.0 * Math.PI;
    const a0 = this.a.value();
    const ax = new Axes(r, t0 / (2.0 * Math.PI), t1 / (2.0 * Math.PI), a0 - 0.25, a0 + 0.25, false, false, [44, 8, 10, 30]).avec(p);
    ax.fond(p, { titre_x: tr('anim_resonances_axe_t'), titre_y: tr('anim_resonances_axe_a') });
    for (const [pp, qq] of rs.RESONANCES) {
      const ar = rs.A_JUPITER_UA * (qq / pp) ** (2.0 / 3.0);
      if (a0 - 0.25 < ar && ar < a0 + 0.25) ax.horizontale(ar, 'accent3', 1.0, true, `${pp}:${qq}`);
    }
    const pts = this.histoire.filter((h) => Number.isFinite(h[1])).map((h) => [h[0] / (2.0 * Math.PI), Math.min(a0 + 1.0, Math.max(a0 - 1.0, h[1]))] as [number, number]);
    if (pts.length >= 2) ax.courbe(pts, 'accent1', 1.4);
  }

  private ecart(p: Peintre, r: Rect): void {
    const t1 = Math.max(this.t, FENETRE * 2.0 * Math.PI);
    const t0 = t1 - FENETRE * 2.0 * Math.PI;
    const ax = new Axes(r, t0 / (2.0 * Math.PI), t1 / (2.0 * Math.PI), 1e-7, 100.0, false, true, [44, 8, 10, 30]).avec(p);
    ax.fond(p, { titre_x: tr('anim_resonances_axe_t'), titre_y: tr('anim_resonances_axe_ecart') });
    const pts = this.histoire.map((h) => [h[0] / (2.0 * Math.PI), Math.min(100.0, Math.max(1e-7, h[3] * rs.A_JUPITER_UA))] as [number, number]);
    if (pts.length >= 2) ax.courbe(pts, 'accent2', 1.4);
  }
}
