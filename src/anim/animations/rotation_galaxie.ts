/**
 * Milky Way Rotational Velocity : vitesse de rotation de la Voie lactée selon la distance au centre.  Version web :
 * courbe d'un modèle de masse publié, lisse et physique — McMillan (2017, arXiv:1608.00971 ; bulbe, disques d'étoiles
 * mince et épais, gaz HI et H2, halo NFW de matière noire), calculé avec galpy — et mesures réelles avec barres
 * d'erreur : Eilers et al. (2019, ApJ 871, 120) de 5 à 25 kpc, compilation galkin (Pato & Iocco 2017) de 2 à 5 kpc.
 * La courbe képlérienne part de la masse que le modèle contient dans la sphère de rayon R.  Galaxie vue de face :
 * bras spiraux log-périodiques de Reid et al. (2019, arXiv:1910.03357, table 2), barre longue de Wegg et al. (2015, arXiv:1504.01401).
 * Données : src/donnees/genere/voie_lactee.json (outils/voie_lactee.py, vérifié par outils/voie_lactee_verif.sage).
 */
import VL from '../../donnees/genere/voie_lactee.json';
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, Pt, type Rect } from '../../noyau/peintre';
import { Animation, type Bouton_souris, type Coche, nombre, type Reglage } from '../base';
import { scientifique } from './gravitation';

interface Donnees {
  R0: number;
  modele: { R: number[]; v: number[]; bulbe: number[]; disques: number[]; halo: number[]; Rm: number[]; M: number[] };
  eilers: [number, number, number, number][];
  galkin: [number, number, number, number][];
}
const D = VL as unknown as Donnees;
const M = D.modele;

const KPC_M = astro.PC_M * 1000.0;
export const G_KPC = astro.GM_SOLEIL / (KPC_M * 1e6);
/** Distance du Soleil au centre (kpc) : celle du modèle de McMillan (2017). */
export const R_SOLEIL_KPC = D.R0;
const R_MAX = 25.0;

/** Interpolation linéaire dans une table croissante (bornée aux extrémités). */
function interpoler(xs: readonly number[], ys: readonly number[], x: number): number {
  if (x <= xs[0]!) return ys[0]! * (x / xs[0]!);
  if (x >= xs[xs.length - 1]!) return ys[ys.length - 1]!;
  let lo = 0,
    hi = xs.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (xs[m]! <= x) lo = m;
    else hi = m;
  }
  const t = (x - xs[lo]!) / (xs[hi]! - xs[lo]!);
  return ys[lo]! + t * (ys[hi]! - ys[lo]!);
}

/** Vitesse circulaire du modèle (km/s) à r kpc du centre ; `cle` : total ou une composante. */
export function vitesse(r: number, cle: 'v' | 'bulbe' | 'disques' | 'halo' = 'v'): number {
  return interpoler(M.R, M[cle], r);
}

/** Masse (M☉) que le modèle contient dans la sphère de rayon r kpc (interpolée en log au-delà de 0,5 kpc). */
export function masse_sphere(r: number): number {
  if (r <= M.Rm[0]!) return M.M[0]! * (r / M.Rm[0]!) ** 2;
  if (r >= M.Rm[M.Rm.length - 1]!) return M.M[M.M.length - 1]!;
  return Math.exp(interpoler(M.Rm, M.M.map(Math.log), r));
}

/** Masse « dynamique » v² r / G (M☉). */
export function masse(r: number): number {
  return (vitesse(r) ** 2 * r) / G_KPC;
}

/** Bras de Reid et al. (2019), table 2 : β_kink (°), R_kink (kpc), ψ< (°), ψ> (°), largeur (kpc), β tracé (°). */
const BRAS: [string, number, number, number, number, number, number, number][] = [
  ['norma', 18, 4.46, -1.0, 19.5, 0.14, -25, 54],
  ['outer', 18, 12.24, 3.0, 9.4, 0.65, -40, 110],
  ['sctcen', 23, 4.91, 14.1, 12.1, 0.23, -110, 104],
  ['sgrcar', 24, 6.04, 17.1, 1.0, 0.27, -130, 97],
  ['perseus', 40, 8.87, 10.3, 8.7, 0.35, -60, 160],
  ['local', 9, 8.26, 11.4, 11.4, 0.31, -8, 34],
  ['3kpc', 15, 3.52, -4.2, -4.2, 0.18, 15, 18],
];
/* Reid et al. (2019) ont adopté R0 = 8,15 kpc pour les bras ; ils sont tracés tels quels (écart de 0,06 kpc). */
/** Barre longue (Wegg et al. 2015) : demi-longueur 5,0 kpc, angle à la ligne de visée 28 à 33° (milieu : 30,5°). */
const BARRE_DEMI = 5.0;
const BARRE_ANGLE = 30.5;

/** Point d'un bras (repère : centre à l'origine, Soleil sur +y, l = 90° vers +x), en kpc. */
export function point_bras(b: (typeof BRAS)[number], beta: number): [number, number] {
  const [, bk, rk, p1, p2] = b;
  const psi = beta <= bk ? p1 : p2;
  const r = rk * Math.exp((-(beta - bk) * Math.PI) / 180 * Math.tan((psi * Math.PI) / 180));
  const a = (beta * Math.PI) / 180;
  return [r * Math.sin(a), r * Math.cos(a)];
}

export class RotationGalaxie extends Animation {
  static override ID = 'milkywayrotationalvelocity';
  static override ANIMEE = false;

  r!: Reglage;
  c_kepler!: Coche;
  c_composantes!: Coche;
  c_mesures!: Coche;
  private axes: Axes | null = null;

  override construire(): void {
    this.r = this.curseur('rayon', 0.5, R_MAX, R_SOLEIL_KPC, { dec: 2, unite: 'kpc' });
    this.c_kepler = this.coche('kepler', true);
    this.c_composantes = this.coche('web_composantes', true, 'web_mw_composantes');
    this.c_mesures = this.coche('web_mesures', true, 'web_mw_mesures');
    this.axes = null;
  }

  override valeurs(): [string, string][] {
    const r = this.r.value();
    const tour = (2 * Math.PI * r * KPC_M) / (vitesse(r) * 1000) / (astro.ANNEE_JULIENNE_J * 86400) / 1e6;
    return [
      [tr('anim_milkywayrotationalvelocity_r'), `${nombre(r, 2)} kpc (${nombre(r * 1000 * astro.PC_EN_AL, 0)} ${tr('anim_spectroparallax_al')})`],
      [tr('anim_milkywayrotationalvelocity_v'), `${nombre(vitesse(r), 1)} km/s`],
      [tr('anim_milkywayrotationalvelocity_m'), `${scientifique(masse(r))} M☉`],
      [tr('web_mw_masse_sphere'), `${scientifique(masse_sphere(r))} M☉`],
      [tr('anim_milkywayrotationalvelocity_tour'), `${nombre(tour, 0)} ${tr('anim_milkywayrotationalvelocity_ma')}`],
    ];
  }

  override presser(pos: Pt, _bouton: Bouton_souris): boolean {
    if (this.axes !== null && this.axes.r.adjusted(-10, -10, 10, 10).contains(pos)) {
      this._glisse = (q) => this.tirer(q);
      this.tirer(pos);
      return true;
    }
    return false;
  }

  private tirer(pos: Pt): void {
    this.r.setValue(this.axes!.x_de_px(pos.x));
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones_principale(rect, 1, 0.56);
    this.courbe(p, dessin.cadre(p, z[0]!, tr('anim_milkywayrotationalvelocity_titre_courbe')));
    this.galaxie(p, dessin.cadre(p, z[1]!, tr('web_mw_titre_galaxie')));
  }

  private courbe(p: Peintre, r: Rect): void {
    const ax = new Axes(r, 0, R_MAX, 0, 300, false, false, [46, 10, 12, 30]).avec(p);
    this.axes = ax;
    ax.fond(p, { titre_x: tr('anim_milkywayrotationalvelocity_axe_r'), titre_y: tr('anim_milkywayrotationalvelocity_axe_v') });
    const serie = (cle: 'v' | 'bulbe' | 'disques' | 'halo'): [number, number][] => M.R.map((x, i) => [x, M[cle][i]!] as [number, number]);
    if (this.c_composantes.isChecked()) {
      ax.courbe(serie('bulbe'), 'accent3', 1.2, 0.8, true);
      ax.courbe(serie('disques'), 'equateur', 1.2, 0.8, true);
      ax.courbe(serie('halo'), 'arc1', 1.2, 0.8, true);
    }
    ax.courbe([[0, 0], ...serie('v')], 'accent1', 2.6);
    if (this.c_mesures.isChecked()) {
      const barre = (x: number, v: number, bas: number, haut: number, cle: string): void => {
        p.setPen(dessin.stylo(cle, 1.0, 0.85));
        p.drawLine(ax.px(x), ax.py(v - bas), ax.px(x), ax.py(v + haut));
        dessin.disque(p, ax.px(x), ax.py(v), 2.6, cle);
      };
      for (const [x, v, e] of D.galkin) barre(x, v, e, e, 'accent2');
      for (const [x, v, em, ep] of D.eilers) barre(x, v, em, ep, 'texte');
    }
    const rr = this.r.value();
    if (this.c_kepler.isChecked()) {
      // la masse contenue dans la sphère de rayon R, supposée toute au centre : v = √(G M / r)
      const m = masse_sphere(rr);
      const kep: [number, number][] = [];
      for (let x = rr; x <= R_MAX + 1e-9; x += 0.1) kep.push([x, Math.sqrt((G_KPC * m) / x)]);
      ax.courbe(kep, 'accent2', 1.6, 0.9, true);
      const s = tr('anim_milkywayrotationalvelocity_k');
      dessin.texte(p, ax.px(R_MAX) - 4 - p.fontMetrics().horizontalAdvance(s), ax.py(Math.sqrt((G_KPC * m) / R_MAX)) + 14, s, 'accent2', { centre: false });
    }
    ax.verticale(R_SOLEIL_KPC, 'doux', 1.0, true, tr('anim_milkywayrotationalvelocity_soleil'));
    ax.verticale(rr, 'accent3', 1.2, true);
    ax.points([[rr, vitesse(rr)]], 'accent3', 6, 1.0);
    // légende (pas sur les petits écrans : elle cacherait les courbes)
    if (ax.r.w < 420 || ax.r.h < 240) return;
    dessin.police(p, 0.8);
    const leg: [string, string, boolean][] = [['accent1', tr('web_mw_modele'), true]];
    if (this.c_composantes.isChecked()) leg.push(['accent3', tr('web_mw_bulbe'), true], ['equateur', tr('web_mw_disques'), true], ['arc1', tr('web_mw_halo'), true]);
    if (this.c_mesures.isChecked()) leg.push(['texte', tr('web_mw_eilers'), false], ['accent2', tr('web_mw_galkin'), false]);
    let y = ax.r.bottom - 10 - 13 * (leg.length - 1);
    for (const [cle, nom, ligne] of leg) {
      const x = ax.r.left + ax.r.w * 0.45;
      if (ligne) {
        p.setPen(dessin.stylo(cle, 2.0));
        p.drawLine(x, y - 4, x + 16, y - 4);
      } else dessin.disque(p, x + 8, y - 4, 2.6, cle);
      dessin.texte(p, x + 22, y, nom, 'doux', { centre: false });
      y += 13;
    }
    dessin.police(p, 1 / 0.8);
  }

  /** Galaxie vue du pôle Nord galactique, à l'échelle (disque de 25 kpc), Soleil en haut, l = 90° à droite. */
  private galaxie(p: Peintre, r: Rect): void {
    const cx = r.cx,
      cy = r.cy;
    const k = (Math.min(r.w, r.h) * 0.48) / R_MAX;
    if (!(k > 0.5)) return;
    const ecran = (x: number, y: number): Pt => new Pt(cx + x * k, cy - y * k);
    const ctx = p.ctx;
    // disque : lueur exponentielle (longueur d'échelle du disque mince de McMillan, 2,5 kpc), anneaux tous les 5 kpc
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R_MAX * k);
    const lueur = dessin.c('soleil');
    for (const t of [0, 0.08, 0.16, 0.3, 0.5, 0.75, 1]) g.addColorStop(t, lueur.avecAlpha(0.5 * Math.exp((-t * R_MAX) / 2.5 / 2.2)).css());
    p.setPen(null);
    p.setBrush(g);
    p.drawEllipse(cx, cy, R_MAX * k, R_MAX * k);
    p.setBrush(null);
    for (let a = 5; a <= 25; a += 5) {
      p.setPen(dessin.stylo('grille', 0.7, 0.6));
      p.drawEllipse(cx, cy, a * k, a * k);
    }
    // barre (schématique en épaisseur)
    p.save();
    p.translate(cx, cy);
    // angle à la ligne Soleil–centre ; l'extrémité proche est du côté l > 0
    p.rotate(-(90 - BARRE_ANGLE));
    const gb = ctx.createRadialGradient(0, 0, 0, 0, 0, BARRE_DEMI * k);
    gb.addColorStop(0, lueur.avecAlpha(0.75).css());
    gb.addColorStop(1, lueur.avecAlpha(0.15).css());
    p.setBrush(gb);
    p.setPen(null);
    p.drawEllipse(0, 0, BARRE_DEMI * k, BARRE_DEMI * k * 0.3);
    p.restore();
    // bras spiraux, avec leur largeur (1 σ de Reid et al.)
    const coul: Record<string, string> = { norma: 'arc2', outer: 'arc2', sctcen: 'accent2', sgrcar: 'arc1', perseus: 'equateur', local: 'accent1', '3kpc': 'accent3' };
    const etiquettes: [Pt, string, string][] = [];
    for (const b of BRAS) {
      const [nom, , , , , larg, b0, b1] = b;
      const trace = (de: number, a: number): Pt[] => {
        const pts: Pt[] = [];
        const pas = de <= a ? 1 : -1;
        for (let beta = de; pas > 0 ? beta <= a : beta >= a; beta += pas) {
          const [x, y] = point_bras(b, beta);
          const rr = Math.hypot(x, y);
          if (rr < 2.8 || rr > 17) break;
          pts.push(ecran(x, y));
        }
        return pts;
      };
      // partie mesurée (Reid et al. : plage d'azimut des masers), puis prolongements estompés de part et d'autre
      const mesure = trace(b0, b1);
      if (mesure.length < 2) continue;
      const prolong = nom === '3kpc' || nom === 'local' ? [] : [trace(b0, b0 - 200), trace(b1, b1 + 200)];
      for (const pts of prolong) {
        if (pts.length < 2) continue;
        p.setPen(dessin.stylo(coul[nom]!, Math.max(2.5, 4 * larg * k), 0.14));
        p.drawPolyline(pts);
        p.setPen(dessin.stylo(coul[nom]!, 1.0, 0.45, true));
        p.drawPolyline(pts);
      }
      p.setPen(dessin.stylo(coul[nom]!, Math.max(2.5, 4 * larg * k), 0.32));
      p.drawPolyline(mesure);
      p.setPen(dessin.stylo(coul[nom]!, 1.4, 0.95));
      p.drawPolyline(mesure);
      etiquettes.push([mesure[Math.floor(mesure.length * 0.62)]!, coul[nom]!, tr('web_mw_bras_' + nom)]);
    }
    // centre, Soleil, cercle du rayon choisi
    dessin.disque(p, cx, cy, 3, 'texte');
    const rr = this.r.value();
    p.setPen(dessin.stylo('accent3', 1.6, null, true));
    p.setBrush(null);
    p.drawEllipse(cx, cy, rr * k, rr * k);
    const s = ecran(0, R_SOLEIL_KPC);
    dessin.disque(p, s.x, s.y, 5, 'soleil', 'texte');
    // sens de rotation : horaire vu du pôle Nord galactique (le Soleil va vers l = 90°)
    dessin.fleche(p, s.x + 9, s.y, s.x + 34, s.y + 4, dessin.stylo('soleil', 1.6), 7);
    dessin.police(p, 0.8);
    for (const [q, cle, nom] of etiquettes) dessin.etiquette(p, q.x, q.y, nom, cle, 4);
    dessin.etiquette(p, s.x, s.y, tr('anim_milkywayrotationalvelocity_soleil'), 'soleil', 7);
    const b = ecran(-BARRE_DEMI * 0.8 * Math.sin((BARRE_ANGLE * Math.PI) / 180), -BARRE_DEMI * 0.8 * Math.cos((BARRE_ANGLE * Math.PI) / 180));
    dessin.etiquette(p, b.x, b.y, tr('web_mw_barre'), 'doux', 4);
    for (let a = 10; a <= 25; a += 5) dessin.texte(p, cx + a * k * Math.cos(-0.6), cy - a * k * Math.sin(-0.6) + 10, `${a} kpc`, 'doux');
    dessin.police(p, 1 / 0.8);
  }
}
