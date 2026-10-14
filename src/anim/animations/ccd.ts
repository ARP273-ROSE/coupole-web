/**
 * CCD Simulator : un capteur CCD est une grille de « seaux » (pixels) qui recueillent les photons pendant la pose ;
 * chaque photon libère un électron.  À la lecture, les charges glissent ligne par ligne vers un registre, puis case
 * par case vers un amplificateur qui les mesure une à une : on reconstruit l'image.  Les photons arrivent au hasard
 * (loi de Poisson) : un pixel qui reçoit N photons en moyenne fluctue de √N.  Grille de 4 × 5 comme l'original.
 */
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Rect, rgb } from '../../noyau/peintre';
import { alea, gauss, pround } from '../../noyau/py';
import { Animation, nombre, type Reglage } from '../base';

const LIGNES = 4,
  COLONNES = 5;
const PUITS = 10_000;
const PAS_LECTURE_S = 0.35;

type Mode = 'repos' | 'pose' | 'lecture' | 'fini';

/** Tirage de Poisson (Knuth pour les petites moyennes, approximation normale au-delà de 50). */
export function poisson(u: () => number, lam: number): number {
  if (lam <= 0) return 0;
  if (lam > 50) return Math.max(0, Math.trunc(pround(gauss(u, lam, Math.sqrt(lam)))));
  const l = Math.exp(-lam);
  let k = 0,
    p = 1.0;
  for (;;) {
    p *= u();
    if (p <= l) return k;
    k += 1;
  }
}

/** Photons par seconde attendus dans le pixel (i, j) : fond du ciel + étoile (profil gaussien, largeur 0,8 pixel). */
export function taux(i: number, j: number, etoile: number, ciel: number): number {
  const di = i - 1.4,
    dj = j - 2.1;
  return ciel + (etoile * Math.exp(-(di * di + dj * dj) / (2 * 0.8 ** 2))) / (2 * Math.PI * 0.8 ** 2);
}

export class CCD extends Animation {
  static override ID = 'buckets';

  pose!: Reglage;
  etoile!: Reglage;
  ciel!: Reglage;
  private hasard = alea(17);
  private pluie = alea(23);
  charges: number[][] = [];
  registre: ([number, number] | null)[] = [];
  lues: (number | null)[][] = [];
  mode: Mode = 'repos';
  t_pose = 0.0;
  t_lecture = 0.0;
  lignes_descendues = 0;
  dans_registre: number | null = null;

  override construire(): void {
    this.pose = this.curseur('pose', 1.0, 60.0, 10.0, { dec: 0, unite: 's' });
    this.etoile = this.curseur('etoile', 0.0, 5000.0, 1500.0, { dec: 0, unite: 'ph/s' });
    this.ciel = this.curseur('ciel', 0.0, 200.0, 20.0, { dec: 0, unite: 'ph/s' });
    this.bouton('anim_buckets_poser', () => this.poser());
    this.bouton('anim_buckets_lire', () => this.lire());
    this.etat_initial();
  }

  override etat_initial(): void {
    this.hasard = alea(17);
    this.pluie = alea(23);
    this.charges = Array.from({ length: LIGNES }, () => new Array<number>(COLONNES).fill(0.0));
    this.registre = new Array<[number, number] | null>(COLONNES).fill(null);
    this.lues = Array.from({ length: LIGNES }, () => new Array<number | null>(COLONNES).fill(null));
    this.mode = 'repos';
    this.t_pose = 0.0;
    this.t_lecture = 0.0;
    this.lignes_descendues = 0;
    this.dans_registre = null;
  }

  poser(): void {
    this.etat_initial();
    this.mode = 'pose';
    if (!this.en_lecture) this.basculer_lecture();
  }

  lire(): void {
    if (this.mode === 'pose' || this.mode === 'repos') {
      this.mode = 'lecture';
      this.t_lecture = 0.0;
      if (!this.en_lecture) this.basculer_lecture();
    }
  }

  override avancer(dt: number): void {
    if (this.mode === 'pose') {
      const reste = this.pose.value() - this.t_pose;
      const h = Math.min(dt * 2.0, reste);
      for (let i = 0; i < LIGNES; i++)
        for (let j = 0; j < COLONNES; j++)
          this.charges[i]![j] = Math.min(PUITS, this.charges[i]![j]! + poisson(this.hasard, taux(i, j, this.etoile.value(), this.ciel.value()) * h));
      this.t_pose += h;
      if (this.t_pose >= this.pose.value() - 1e-9) {
        this.mode = 'lecture';
        this.t_lecture = 0.0;
      }
    } else if (this.mode === 'lecture') {
      this.t_lecture += dt;
      while (this.t_lecture >= PAS_LECTURE_S && this.mode === 'lecture') {
        this.t_lecture -= PAS_LECTURE_S;
        this.pas_lecture();
      }
    }
  }

  private pas_lecture(): void {
    if (this.registre.every((c) => c === null)) {
      if (this.lignes_descendues >= LIGNES) {
        this.mode = 'fini';
        return;
      }
      this.registre = this.charges[LIGNES - 1]!.map((q, j) => [j, q] as [number, number]);
      this.dans_registre = LIGNES - 1 - this.lignes_descendues;
      this.charges = [new Array<number>(COLONNES).fill(0.0), ...this.charges.slice(0, LIGNES - 1)];
      this.lignes_descendues += 1;
    } else {
      const dernier = this.registre[this.registre.length - 1];
      if (dernier) {
        const [col, q] = dernier;
        this.lues[this.dans_registre!]![col] = Math.trunc(q);
      }
      this.registre = [null, ...this.registre.slice(0, -1)];
    }
  }

  override valeurs(): [string, string][] {
    const lues = this.lues.flat().filter((v) => v !== null);
    const out: [string, string][] = [
      [tr('anim_buckets_etat'), tr('anim_buckets_m_' + this.mode)],
      [tr('anim_buckets_t_pose'), `${nombre(this.t_pose, 1)} s`],
    ];
    let attendu = 0;
    for (let i = 0; i < LIGNES; i++) for (let j = 0; j < COLONNES; j++) attendu += taux(i, j, this.etoile.value(), this.ciel.value());
    attendu *= this.pose.value();
    out.push([tr('anim_buckets_attendu'), `${nombre(attendu, 0)} e⁻ (± ${nombre(Math.sqrt(attendu), 0)})`]);
    if (lues.length) out.push([tr('anim_buckets_lus'), `${lues.length} / ${LIGNES * COLONNES}`]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones(rect, 2, 0.95);
    const r = dessin.cadre(p, z[0]!, tr('anim_buckets_titre_ccd'));
    const cw = Math.min(r.w / (COLONNES + 1.6), r.h / (LIGNES + 2.4));
    const x0 = r.left + (r.w - cw * (COLONNES + 1.2)) / 2;
    const y0 = r.top + 6;
    for (let i = 0; i < LIGNES; i++)
      for (let j = 0; j < COLONNES; j++) CCD.seau(p, new Rect(x0 + j * cw, y0 + i * cw, cw * 0.9, cw * 0.9), this.charges[i]![j]!);
    const yr = y0 + LIGNES * cw + cw * 0.3;
    for (let j = 0; j < COLONNES; j++) {
      const c = this.registre[j];
      CCD.seau(p, new Rect(x0 + j * cw, yr, cw * 0.9, cw * 0.9), c ? c[1] : 0.0, c ? 'accent2' : 'grille');
    }
    dessin.texte(p, x0 + (COLONNES * cw) / 2, yr + cw * 1.05, tr('anim_buckets_registre'), 'doux');
    const xa = x0 + COLONNES * cw + cw * 0.15;
    dessin.disque(p, xa + cw * 0.35, yr + cw * 0.45, cw * 0.35, 'accent1', 'texte');
    dessin.texte(p, xa + cw * 0.35, yr - 10, tr('anim_buckets_ampli'), 'accent1');
    if (this.mode === 'pose') {
      p.setPen(dessin.stylo('equateur', 1.0, 0.6));
      for (let k = 0; k < 40; k++) {
        const x = x0 + this.pluie() * COLONNES * cw;
        const y = y0 + this.pluie() * LIGNES * cw;
        p.drawLine(x, y, x - 2, y - 7);
      }
    }
    const r2 = dessin.cadre(p, z[1]!, tr('anim_buckets_titre_image'));
    const cw2 = Math.min(r2.w / (COLONNES + 0.4), r2.h / (LIGNES + 0.4));
    const x2 = r2.left + (r2.w - cw2 * COLONNES) / 2;
    const mx = Math.max(...(this.lues.flat().filter((v) => v !== null) as number[]), 1);
    dessin.police(p, 0.85);
    for (let i = 0; i < LIGNES; i++)
      for (let j = 0; j < COLONNES; j++) {
        const v = this.lues[i]![j];
        const q = new Rect(x2 + j * cw2, r2.top + i * cw2, cw2 - 2, cw2 - 2);
        if (v === null || v === undefined) {
          p.fillRect(q, dessin.c('sphere', 0.4));
          continue;
        }
        const g = Math.trunc(255 * (v / mx) ** 0.5);
        p.fillRect(q, rgb(g, g, g));
        const fm = p.fontMetrics();
        const t = nombre(v, 0);
        p.setPen(v >= PUITS ? rgb(200, 40, 40) : g > 140 ? rgb(15, 15, 15) : rgb(240, 240, 240));
        p.drawText(q.cx - fm.horizontalAdvance(t) / 2, q.cy + fm.ascent() / 2 - 1, t);
      }
    dessin.police(p, 1 / 0.85);
  }

  static seau(p: Peintre, q: Rect, charge: number, cle = 'doux'): void {
    p.setPen(dessin.stylo(cle, 1.2));
    p.setBrush(null);
    p.drawRect(q);
    const f = Math.min(1.0, charge / PUITS);
    if (f > 0) p.fillRect(new Rect(q.left + 1, q.bottom - f * q.h, q.w - 2, f * q.h), dessin.c(f >= 1 ? 'accent3' : 'equateur', 0.75));
  }
}
