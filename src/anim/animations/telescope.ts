/**
 * Telescope Simulator : une lunette (objectif de 4, 6 ou 8 pouces, focales de l'original) et trois oculaires (40, 20,
 * 10 mm).  Grossissement G = F / f, champ réel = champ apparent / G, pouvoir séparateur 1,22 λ / D (Rayleigh à
 * 550 nm ; Dawes : 116″ / D en mm), pouvoir collecteur (D / 7 mm)².  Mise au point : un oculaire décalé de Δ étale
 * chaque point en un disque de Δ D / F.  Objets à leur vraie taille angulaire : la Lune, Saturne, un amas globulaire.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import type { Peintre, Rect } from '../../noyau/peintre';
import { alea, gauss } from '../../noyau/py';
import { Animation, type Choix, nombre, type Reglage } from '../base';

const OBJECTIFS: Record<string, [number, number]> = { '8': [203.2, 1400.0], '6': [152.4, 1220.0], '4': [101.6, 1020.0] };
const OCULAIRES: Record<string, [number, number]> = { '40': [40.0, 44.0], '20': [20.0, 52.0], '10': [10.0, 59.0] };
const PUPILLE_MM = 7.0;
const LAMBDA_M = 550e-9;
const LUNE_DEG = ((2 * astro.R_LUNE_KM) / astro.D_LUNE_KM) * (180 / Math.PI);
const SATURNE_GLOBE_ARCSEC = ((2 * 60_268.0) / (9.5 * astro.UA_KM)) * astro.SECONDES_D_ARC_PAR_RADIAN;
const SATURNE_ANNEAUX_ARCSEC = ((2 * 136_775.0) / (9.5 * astro.UA_KM)) * astro.SECONDES_D_ARC_PAR_RADIAN;
const AMAS_DEG = 20.0 / 60.0;
const OEIL_ARCMIN = 1.0;

export interface Optique {
  D: number;
  F: number;
  fe: number;
  G: number;
  champ_reel: number;
  champ_apparent: number;
  rayleigh: number;
  dawes: number;
  collecteur: number;
}

export function optique(objectif: string, oculaire: string): Optique {
  const [d, f] = OBJECTIFS[objectif]!;
  const [fe, champ] = OCULAIRES[oculaire]!;
  const g = f / fe;
  return {
    D: d, F: f, fe, G: g, champ_reel: champ / g, champ_apparent: champ,
    rayleigh: ((1.22 * LAMBDA_M) / (d / 1000)) * astro.SECONDES_D_ARC_PAR_RADIAN, dawes: 116.0 / d,
    collecteur: (d / PUPILLE_MM) ** 2,
  };
}

/** Diamètre apparent (degrés, dans l'oculaire) du disque de flou d'une mise au point décalée de delta_mm. */
export function flou_apparent_deg(delta_mm: number, o: Optique): number {
  return ((Math.abs(delta_mm) * o.D) / o.F / o.fe) * (180 / Math.PI);
}

export class Telescope extends Animation {
  static override ID = 'telescope10';
  static override ANIMEE = false;

  objet!: Choix;
  objectif!: Choix;
  oculaire!: Choix;
  mise_au_point!: Reglage;
  etoiles: [number, number, number][] = [];
  crateres: [number, number, number][] = [];

  override construire(): void {
    this.objet = this.choix('objet', [['anim_telescope10_o_lune', 'lune'], ['anim_telescope10_o_saturne', 'saturne'], ['anim_telescope10_o_amas', 'amas']], 'lune');
    this.objectif = this.choix('objectif', ['8', '6', '4'].map((k) => ['anim_telescope10_d_' + k, k] as [string, string]), '8');
    this.oculaire = this.choix('oculaire', ['40', '20', '10'].map((k) => ['anim_telescope10_e_' + k, k] as [string, string]), '40');
    this.mise_au_point = this.curseur('mise_au_point', -3.0, 3.0, 1.0, { dec: 2, unite: 'mm' });
    const u = alea(13);
    const unif = (a: number, b: number): number => a + (b - a) * u();
    this.etoiles = [];
    for (let k = 0; k < 260; k++) {
      const r = (AMAS_DEG / 2) * Math.min(1.0, Math.abs(gauss(u, 0, 0.35)));
      const a = unif(0, 2 * Math.PI);
      this.etoiles.push([r * Math.cos(a), r * Math.sin(a), unif(0.4, 1.0)]);
    }
    const cr: [number, number, number][] = [];
    for (let k = 0; k < 40; k++) cr.push([unif(-0.8, 0.8), unif(-0.8, 0.8), unif(0.03, 0.12)]);
    this.crateres = cr.filter((c) => Math.hypot(c[0], c[1]) + c[2] < 0.97);
  }

  optique(): Optique {
    return optique(this.objectif.currentData() as string, this.oculaire.currentData() as string);
  }

  override valeurs(): [string, string][] {
    const o = this.optique();
    return [
      [tr('anim_telescope10_g'), `× ${nombre(o.G, 1)}`],
      [tr('anim_telescope10_champ'), `${nombre(o.champ_reel, 2)}° (${nombre(o.champ_reel * 60, 0)}′)`],
      [tr('anim_telescope10_resolution'), `${nombre(o.rayleigh, 2)}″ (Dawes ${nombre(o.dawes, 2)}″)`],
      [tr('anim_telescope10_collecteur'), `× ${nombre(o.collecteur, 0)}`],
      [tr('anim_telescope10_net'), tr(Math.abs(this.mise_au_point.value()) < 0.05 ? 'anim_oui' : 'anim_non')],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones(rect, 2, 0.9);
    this.schema(p, dessin.cadre(p, z[0]!, tr('anim_telescope10_titre_lunette')));
    this.vueOculaire(p, dessin.cadre(p, z[1]!, tr('anim_telescope10_titre_vue')));
  }

  private schema(p: Peintre, r: Rect): void {
    const o = this.optique();
    const cy = r.cy;
    const x0 = r.left + 20,
      x1 = r.right - 30;
    const k = (x1 - x0) / (1400.0 + 40.0);
    const hd = (o.D / 203.2) * r.h * 0.32;
    const xf = x0 + o.F * k;
    const xo = xf + (o.fe + this.mise_au_point.value() * 8) * k * 1.0;
    p.setPen(dessin.stylo('doux', 1.5));
    p.setBrush(null);
    p.drawLine(x0, cy - hd, xf, cy - hd * 0.35);
    p.drawLine(x0, cy + hd, xf, cy + hd * 0.35);
    p.setBrush(dessin.c('accent2', 0.6));
    p.drawEllipse(x0, cy, 5, hd);
    p.drawEllipse(xo, cy, 4, 0.3 * hd);
    p.setPen(dessin.stylo('soleil', 1.2, 0.8));
    for (const s of [-1, 1]) {
      p.drawLine(x0 - 30, cy + s * hd * 0.8, x0, cy + s * hd * 0.8);
      p.drawLine(x0, cy + s * hd * 0.8, xf, cy);
      p.drawLine(xf, cy, xo, cy - (s * hd * 0.8 * (xo - xf)) / (xf - x0));
    }
    dessin.texte(p, x0 - 4, cy + hd + 16, `D = ${nombre(o.D, 1)} mm, F = ${nombre(o.F, 0)} mm`, 'doux', { centre: false });
    const s = `f = ${nombre(o.fe, 0)} mm`;
    dessin.texte(p, Math.min(xo, r.right - 4 - p.fontMetrics().horizontalAdvance(s) / 2), cy + hd * 0.3 + 16, s, 'doux');
  }

  private vueOculaire(p: Peintre, r: Rect): void {
    const o = this.optique();
    const cx = r.cx,
      cy = r.cy;
    const R = Math.min(r.w, r.h) * 0.45;
    if (!(R > 0)) return;
    const px_par_deg = R / (o.champ_apparent / 2);
    const g = o.G;
    p.save();
    const chemin = new Path2D();
    chemin.ellipse(cx, cy, R, R, 0, 0, 2 * Math.PI);
    p.setClipPath(chemin);
    p.fillRect(r, dessin.c('nuit'));
    const flou = flou_apparent_deg(this.mise_au_point.value(), o) * px_par_deg;
    const nettete = Math.max((o.rayleigh / 3600) * g * px_par_deg, (OEIL_ARCMIN / 60) * px_par_deg);
    const rayon_point = Math.max(0.8, nettete / 2 + flou / 2);
    const lum = 0.35 + 0.65 * Math.min(1.0, o.collecteur / 843.0);
    const objet = this.objet.currentData();
    if (objet === 'lune') {
      const rl = (LUNE_DEG / 2) * g * px_par_deg;
      dessin.disque(p, cx, cy, rl + flou / 2, 'lune', null, 0.5 * lum);
      dessin.disque(p, cx, cy, rl, 'lune', null, lum);
      for (const [x, y, rc] of this.crateres) {
        p.setPen(dessin.stylo('grille', Math.max(0.5, 1.5 - flou / 10), 0.8));
        p.setBrush(dessin.c('doux', 0.25));
        p.drawEllipse(cx + x * rl, cy + y * rl, rc * rl, rc * rl);
      }
    } else if (objet === 'saturne') {
      const k = (g * px_par_deg) / 3600;
      const ra = (SATURNE_ANNEAUX_ARCSEC / 2) * k,
        rg = (SATURNE_GLOBE_ARCSEC / 2) * k;
      p.setPen(dessin.stylo('accent1', Math.max(1.0, rg * 0.15 + flou / 4), lum));
      p.setBrush(null);
      p.drawEllipse(cx, cy, ra, ra * 0.38);
      dessin.disque(p, cx, cy, rg + flou / 2, 'accent1', null, lum);
    } else {
      const k = g * px_par_deg;
      p.setPen(null);
      for (const [x, y, b] of this.etoiles) {
        p.setBrush(dessin.c('etoile', b * lum * Math.min(1.0, 4.0 / (rayon_point + 1))));
        p.drawEllipse(cx + x * k, cy + y * k, rayon_point, rayon_point);
      }
    }
    p.restore();
    p.setPen(dessin.stylo('grille', 2.0));
    p.setBrush(null);
    p.drawEllipse(cx, cy, R, R);
    dessin.texte(p, cx, cy + R + 12, tr('anim_telescope10_champ_v', { c: nombre(o.champ_reel * 60, 0) }), 'doux');
  }
}
