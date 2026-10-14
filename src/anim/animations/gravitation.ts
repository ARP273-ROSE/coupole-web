/**
 * Newton's Law of Gravity Calculator : la force de gravitation entre deux masses, de l'électron à la Voie lactée, à des
 * distances du proton au rayon de l'Univers observable.  F = G M₁ M₂ / R² (G CODATA 2018) et l'accélération de chaque
 * corps a = F / M.  Curseurs en puissances de dix, préréglages de l'original (valeurs actuelles), mémoire des résultats.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Rect } from '../../noyau/peintre';
import { proundn } from '../../noyau/py';
import { Animation, type Choix, nombre, type Reglage } from '../base';

const MASSES: [string, number][] = [
  ['electron', 9.109_383_7e-31], ['proton', 1.672_621_9e-27], ['pomme', 0.102], ['kilogramme', 1.0], ['personne', 72.0], ['montagne', 1e15],
  ['asteroide', 1e18], ['lune', astro.MASSE_LUNE_KG], ['mars', 6.4171e23], ['terre', astro.MASSE_TERRE_KG], ['jupiter', 1.898_19e27],
  ['soleil', astro.MASSE_SOLEIL_KG], ['voie_lactee', 1.15e42],
];
const DISTANCES: [string, number][] = [
  ['proton', 1e-15], ['atome', 1e-10], ['metre', 1.0], ['deux_metres', 2.0], ['rayon_terre', 6.371e6], ['lune', astro.D_LUNE_KM * 1e3],
  ['mars', 5.7e10], ['soleil', astro.UA_KM * 1e3], ['jupiter', 5.9e11], ['etoile', 4.0e16], ['voie_lactee', 4.7e20], ['univers', 4.4e26],
];
const LOG_M: [number, number] = [Math.log10(9.1e-31), Math.log10(1.2e42)];
const LOG_R: [number, number] = [-15.0, Math.log10(8.8e26)];
const EXPOSANTS: Record<string, string> = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

export function exposant(e: number): string {
  return String(e).split('').map((c) => EXPOSANTS[c] ?? c).join('');
}

/** « 6,67 × 10⁻¹¹ » (virgule décimale selon la langue). */
export function scientifique(x: number, chiffres = 3): string {
  if (x === 0 || !Number.isFinite(x)) return nombre(x, 0);
  let e = Math.floor(Math.log10(Math.abs(x)));
  let m = x / 10 ** e;
  if (proundn(m, chiffres - 1) >= 10) {
    m /= 10;
    e += 1;
  }
  const s = nombre(m, chiffres - 1);
  return e === 0 ? s : `${s} × 10${exposant(e)}`;
}

export function calcul(m1: number, m2: number, r: number): { F: number; a1: number; a2: number } {
  const f = astro.force_gravitation(m1, m2, r);
  return { F: f, a1: f / m1, a2: f / m2 };
}

export class Gravitation extends Animation {
  static override ID = 'gravcalc';
  static override ANIMEE = false;

  lm1!: Reglage;
  p1!: Choix;
  lm2!: Reglage;
  p2!: Choix;
  lr!: Reglage;
  pr!: Choix;
  memoire: [number, number, number, number][] = [];
  private sync = false;

  override construire(): void {
    const opt = (pref: string, t: [string, number][]): [string, string][] => [['anim_gravcalc_libre', ''], ...t.map(([k]) => [pref + k, k] as [string, string])];
    this.lm1 = this.curseur('m1', ...LOG_M, Math.log10(0.102), { dec: 3, unite: 'log kg', rafraichir: false });
    this.p1 = this.choix('pm1', opt('anim_gravcalc_m_', MASSES), 'pomme');
    this.lm2 = this.curseur('m2', ...LOG_M, Math.log10(astro.MASSE_TERRE_KG), { dec: 3, unite: 'log kg', rafraichir: false });
    this.p2 = this.choix('pm2', opt('anim_gravcalc_m_', MASSES), 'terre');
    this.lr = this.curseur('r', ...LOG_R, Math.log10(6.371e6), { dec: 3, unite: 'log m', rafraichir: false });
    this.pr = this.choix('pr', opt('anim_gravcalc_d_', DISTANCES), 'rayon_terre');
    this.bouton('anim_gravcalc_memoriser', () => this.memoriser());
    this.bouton('anim_gravcalc_effacer', () => this.effacer());
    this.memoire = [];
    this.sync = false;
    for (const [pr, rg, table] of [[this.p1, this.lm1, MASSES], [this.p2, this.lm2, MASSES], [this.pr, this.lr, DISTANCES]] as [Choix, Reglage, [string, number][]][]) {
      pr.activated.connect(() => this.prereglage(pr, rg, table));
      rg.valueChanged.connect(() => this.libre(pr, rg, table));
    }
  }

  private prereglage(pr: Choix, rg: Reglage, table: [string, number][]): void {
    for (const [k, v] of table) {
      if (k === pr.currentData()) {
        this.sync = true;
        rg.setValue(Math.log10(v));
        this.sync = false;
      }
    }
    this.rafraichir();
  }

  private libre(pr: Choix, rg: Reglage, table: [string, number][]): void {
    if (!this.sync) {
      const cle = table.find(([, v]) => Math.abs(Math.log10(v) - rg.value()) < 5e-4)?.[0] ?? '';
      pr.blockSignals(true);
      pr.setCurrentIndex(Math.max(0, pr.findData(cle)));
      pr.blockSignals(false);
    }
    this.rafraichir();
  }

  grandeurs(): [number, number, number] {
    return ([[this.p1, this.lm1, MASSES], [this.p2, this.lm2, MASSES], [this.pr, this.lr, DISTANCES]] as [Choix, Reglage, [string, number][]][]).map(([pr, rg, table]) => {
      const exacte = table.find(([k]) => k === pr.currentData());
      return exacte ? exacte[1] : 10 ** rg.value();
    }) as [number, number, number];
  }

  memoriser(): void {
    const [m1, m2, r] = this.grandeurs();
    this.memoire = [...this.memoire, [m1, m2, r, calcul(m1, m2, r).F] as [number, number, number, number]].slice(-6);
    this.rafraichir();
  }

  effacer(): void {
    this.memoire = [];
    this.rafraichir();
  }

  override etat_initial(): void {
    this.memoire = [];
  }

  override valeurs(): [string, string][] {
    const [m1, m2, r] = this.grandeurs();
    const c = calcul(m1, m2, r);
    return [
      ['M₁', `${scientifique(m1)} kg`], ['M₂', `${scientifique(m2)} kg`], ['R', `${scientifique(r)} m`],
      [tr('anim_gravcalc_force'), `${scientifique(c.F)} N`], [tr('anim_gravcalc_a1'), `${scientifique(c.a1)} m/s²`], [tr('anim_gravcalc_a2'), `${scientifique(c.a2)} m/s²`],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const [m1, m2, r] = this.grandeurs();
    const c = calcul(m1, m2, r);
    const cx = rect.cx;
    const y = rect.y + rect.h * 0.18;
    dessin.police(p, 1.25);
    dessin.formule(p, cx, y, 'F = G M₁ M₂ / R²');
    dessin.formule(p, cx, y + 44, `= (${scientifique(astro.G_SI)}) (${scientifique(m1)}) (${scientifique(m2)}) / (${scientifique(r)})²`, 'doux');
    dessin.police(p, 1.25, true);
    dessin.texte(p, cx, y + 86, `= ${scientifique(c.F)} N`, 'accent1');
    dessin.police(p, 1 / 1.25 / 1.25);
    const yc = rect.y + rect.h * 0.55;
    const x1 = rect.x + rect.w * 0.25,
      x2 = rect.x + rect.w * 0.75;
    const r1 = 8 + ((3 * (this.lm1.value() - LOG_M[0])) / (LOG_M[1] - LOG_M[0])) * 10;
    const r2 = 8 + ((3 * (this.lm2.value() - LOG_M[0])) / (LOG_M[1] - LOG_M[0])) * 10;
    for (const [x, rr, a, sens, cle] of [[x1, r1, c.a1, 1, 'accent3'], [x2, r2, c.a2, -1, 'accent2']] as [number, number, number, number, string][]) {
      const lg = a > 0 ? Math.max(0.0, Math.min(1.0, (Math.log10(a) + 40) / 80)) * (x2 - x1) * 0.42 : 0;
      if (lg > 3) dessin.fleche(p, x + sens * rr, yc, x + sens * (rr + lg), yc, dessin.stylo(cle, 2.4), 9);
      dessin.disque(p, x, yc, rr, cle);
      dessin.texte(p, x, yc + rr + 14, `a = ${scientifique(a)} m/s²`, cle);
    }
    if (this.memoire.length) this.table(p, new Rect(rect.x + 10, rect.y + rect.h * 0.7, rect.w - 20, rect.h * 0.3 - 8));
  }

  private table(p: Peintre, r: Rect): void {
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(dessin.c('sphere', 0.2));
    p.drawRoundedRect(r, 6, 6);
    dessin.police(p, 0.8);
    const cols = ['M₁ (kg)', 'M₂ (kg)', 'R (m)', 'F (N)'];
    const lh = Math.min(18.0, r.h / (this.memoire.length + 1.5));
    cols.forEach((titre, j) => {
      const x = r.x + (r.w * (j + 0.5)) / 4;
      dessin.texte(p, x, r.y + lh * 0.8, titre, 'doux');
      this.memoire.forEach((ligne, i) => dessin.texte(p, x, r.y + lh * (i + 1.8), scientifique(ligne[j]!)));
    });
    dessin.police(p, 1 / 0.8);
  }
}
