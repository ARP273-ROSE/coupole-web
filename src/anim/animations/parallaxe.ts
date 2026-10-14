/**
 * Parallax Calculator : la parallaxe annuelle p est l'angle sous lequel on voit, depuis l'étoile, le rayon de l'orbite
 * terrestre (1 ua).  Distance d = 1 / p (d en parsecs, p en secondes d'arc) ; 1 pc = 3,2616 al.  Les trois champs se
 * convertissent mutuellement ; le schéma exagère l'angle.
 */
import * as astro from '../../calc/astro';
import { langue, tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { fixe, proundn } from '../../noyau/py';
import { Animation, type Saisie } from '../base';

// Parallaxes de référence (mas) : Proxima du Centaure (Gaia DR3), Sirius et Véga (nouvelle réduction d'Hipparcos)
const EXEMPLES: [string, number][] = [['proxima', 768.0665], ['sirius', 379.21], ['vega', 130.23]];

/** n chiffres significatifs (comme Math.toSigDigits de l'original), dans la langue courante. */
export function chiffres(x: number, n = 3): string {
  if (x === 0 || !Number.isFinite(x)) return !Number.isFinite(x) ? '…' : '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  const v = proundn(x, -e + n - 1);
  const dec = Math.max(0, n - 1 - e);
  const s = fixe(v, dec);
  return langue() === 'fr' ? s.replace('.', ',') : s;
}

export function lire(texte: string): number {
  const t = texte.trim().replace(',', '.').replace(/ /g, '').replace(/ /g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t) && !/^[-+]?(inf|infinity|nan)$/i.test(t)) return NaN;
  return Number(t);
}

export class Parallaxe extends Animation {
  static override ID = 'parallaxdiag';
  static override ANIMEE = false;

  champs: Record<string, Saisie> = {};
  p = 0.5;

  override construire(): void {
    this.champs = {};
    for (const cle of ['arcsec', 'pc', 'al']) {
      const ch = this.saisie(cle, 'anim_parallaxdiag_' + cle, 'anim_parallaxdiag_' + cle + '_aide', 14);
      ch.textEdited.connect((texte) => this.saisi(cle, texte));
      this.champs[cle] = ch;
    }
    for (const [cle, mas] of EXEMPLES) this.bouton('anim_parallaxdiag_' + cle, () => this.definir_parallaxe(mas / 1000.0));
    this.p = 0.5;
    this.definir_parallaxe(0.5);
  }

  override etat_initial(): void {
    this.definir_parallaxe(0.5);
  }

  definir_parallaxe(p_arcsec: number): void {
    this.p = p_arcsec;
    this.ecrire(null);
    this.rafraichir();
  }

  private ecrire(sauf: string | null): void {
    const d = this.p > 0 ? astro.parsecs_de_parallaxe(this.p) : Infinity;
    const valeurs: Record<string, number> = { arcsec: this.p, pc: d, al: d * astro.PC_EN_AL };
    for (const [cle, ch] of Object.entries(this.champs)) if (cle !== sauf) ch.setText(chiffres(valeurs[cle]!));
  }

  private saisi(cle: string, texte: string): void {
    const x = lire(texte);
    if (!Number.isFinite(x) || x <= 0) {
      for (const [c, ch] of Object.entries(this.champs)) if (c !== cle) ch.setText('…');
      return;
    }
    this.p = cle === 'arcsec' ? x : cle === 'pc' ? 1.0 / x : astro.PC_EN_AL / x;
    this.ecrire(cle);
    this.rafraichir();
  }

  override valeurs(): [string, string][] {
    const d = this.p > 0 ? 1.0 / this.p : Infinity;
    return [
      [tr('anim_parallaxdiag_arcsec'), chiffres(this.p, 4)],
      [tr('anim_parallaxdiag_pc'), chiffres(d, 4)],
      [tr('anim_parallaxdiag_al'), chiffres(d * astro.PC_EN_AL, 4)],
      [tr('anim_parallaxdiag_ua'), chiffres((d * 648000) / Math.PI, 4)],
      [tr('anim_parallaxdiag_formule'), 'd = 1 / p'],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const cy = rect.cy;
    const sx = rect.x + rect.w * 0.18;
    const ro = Math.min(rect.h * 0.32, rect.w * 0.12);
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(null);
    p.drawEllipse(sx, cy, ro, ro);
    dessin.disque(p, sx, cy, 8, 'soleil');
    const t1 = new Pt(sx, cy - ro),
      t2 = new Pt(sx, cy + ro);
    dessin.disque(p, t1.x, t1.y, 6, 'terre');
    dessin.disque(p, t2.x, t2.y, 6, 'terre');
    const dmax = rect.right - 30 - sx;
    const d = this.p > 0 ? 1.0 / this.p : 1e9;
    const frac = Math.max(0.25, Math.min(1.0, 0.35 + 0.22 * Math.log10(Math.max(d, 0.1))));
    const ex = sx + dmax * frac;
    const e = new Pt(ex, cy);
    dessin.disque(p, ex, cy, 5, 'etoile', 'soleil');
    p.setPen(dessin.stylo('accent2', 1.5));
    p.drawLineP(t1, e);
    p.drawLineP(t2, e);
    p.setPen(dessin.stylo('doux', 1.0, null, true));
    p.drawLine(sx, cy, ex, cy);
    p.drawLineP(t1, t2);
    const a = (Math.atan2(ro, ex - sx) * 180) / Math.PI;
    const rr = Math.min(80.0, (ex - sx) * 0.4);
    p.setPen(dessin.stylo('accent1', 2.0));
    p.drawArc(new Rect(ex - rr, cy - rr, 2 * rr, 2 * rr), Math.trunc((180 - a) * 16), Math.trunc(a * 16));
    dessin.texte(p, ex - rr - 14, cy - 12, 'p', 'accent1');
    dessin.texte(p, sx - 30, cy - ro / 2, tr('anim_parallaxdiag_une_ua'), 'doux');
    dessin.texte(p, (sx + ex) / 2, cy + 16, 'd', 'doux');
    dessin.texte(p, rect.cx, rect.y + 18, tr('anim_parallaxdiag_schema'), 'doux');
  }
}
