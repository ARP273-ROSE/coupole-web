/**
 * Distance Modulus Explorer : m − M = 5 log₁₀ d − 5 (d en parsecs).  On verrouille une des trois grandeurs (M, m ou
 * d) et on fait varier les deux autres ; l'étoile se place sur une échelle logarithmique des distances (1 à 1 000 pc)
 * et son éclat dessiné suit la magnitude absolue.  Bornes des curseurs comme dans l'original.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import type { Peintre, Pt, Rect } from '../../noyau/peintre';
import { Animation, type Bouton_souris, type Choix, nombre, type Reglage } from '../base';

const D_MIN = 1.0,
  D_MAX = 1000.0;
const M_ABS: [number, number] = [-8.0, 18.0];

export class ModuleDistance extends Animation {
  static override ID = 'stellarmag';
  static override ANIMEE = false;

  verrou!: Choix;
  m!: Reglage;
  M!: Reglage;
  d!: Reglage;
  private occupe = false;
  private axe: [number, number, number] | null = null;

  override construire(): void {
    this.verrou = this.choix('verrou', [['anim_stellarmag_verrou_M', 'M'], ['anim_stellarmag_verrou_m', 'm'], ['anim_stellarmag_verrou_d', 'd']], 'M');
    this.m = this.curseur('m', -8.0, 18.0, 5.0, { dec: 1, cle_texte: 'anim_stellarmag_m' });
    this.M = this.curseur('M_abs', -8.0, 18.0, 5.0, { dec: 1, cle_texte: 'anim_stellarmag_M' });
    this.d = this.curseur('d', D_MIN, D_MAX, 10.0, { dec: 1, unite: 'pc', log: true, cle_texte: 'anim_stellarmag_d' });
    this.occupe = false;
    this.m.valueChanged.connect(() => this.bouge('m'));
    this.M.valueChanged.connect(() => this.bouge('M'));
    this.d.valueChanged.connect(() => this.bouge('d'));
    this.bornes();
    this.bouge('d');
  }

  /** Bornes dépendant du verrou (reprises de l'original) : les trois grandeurs restent compatibles. */
  private bornes(): void {
    const v = this.verrou.currentData();
    const lmax = Math.log10(D_MAX),
      lmin = Math.log10(D_MIN);
    this.occupe = true;
    if (v === 'M') {
      this.m.borner(M_ABS[0] + (-5 + 5 * lmin), M_ABS[1] + (-5 + 5 * lmax));
      this.M.borner(...M_ABS);
      this.d.borner(D_MIN, D_MAX);
    } else if (v === 'm') {
      this.m.borner(-13.0, 28.0);
      this.M.borner(...M_ABS);
      this.d.borner(D_MIN, D_MAX);
    } else {
      const mu = astro.module_de_distance(this.d.value());
      this.m.borner(M_ABS[0] + mu, M_ABS[1] + mu);
      this.M.borner(...M_ABS);
      this.d.borner(D_MIN, D_MAX);
    }
    const verrouille = v === 'M' ? this.M : v === 'm' ? this.m : this.d;
    for (const w of [this.m, this.M, this.d]) w.setEnabled(w !== verrouille);
    this.occupe = false;
  }

  override reglage_change(): void {
    if (!this.occupe && this.d !== undefined) this.bornes();
    super.reglage_change();
  }

  /** Recalcule la grandeur libre restante : m − M = 5 log d − 5. */
  private bouge(qui: string): void {
    if (this.occupe) return;
    this.occupe = true;
    const v = this.verrou.currentData();
    const mu = astro.module_de_distance(this.d.value());
    if (v === 'M') {
      if (qui === 'm') {
        this.d.setValue(Math.min(D_MAX, Math.max(D_MIN, astro.distance_du_module(this.m.value() - this.M.value()))));
        this.m.setValue(this.M.value() + astro.module_de_distance(this.d.value()));
      } else this.m.setValue(this.M.value() + mu);
    } else if (v === 'm') {
      if (qui === 'M') {
        this.d.setValue(Math.min(D_MAX, Math.max(D_MIN, astro.distance_du_module(this.m.value() - this.M.value()))));
        this.M.setValue(this.m.value() - astro.module_de_distance(this.d.value()));
      } else this.M.setValue(this.m.value() - mu);
    } else {
      if (qui === 'm') this.M.setValue(this.m.value() - mu);
      else this.m.setValue(this.M.value() + mu);
    }
    this.occupe = false;
    this.rafraichir();
  }

  override valeurs(): [string, string][] {
    const mu = astro.module_de_distance(this.d.value());
    return [
      [tr('anim_stellarmag_equation'), `${nombre(this.m.value(), 1)} − (${nombre(this.M.value(), 1)}) = ${nombre(this.m.value() - this.M.value(), 1)}`],
      [tr('anim_stellarmag_module'), `5 log₁₀(${nombre(this.d.value(), 1)}) − 5 = ${nombre(mu, 2)}`],
      [tr('anim_stellarmag_d'), `${nombre(this.d.value(), 1)} pc = ${nombre(this.d.value() * astro.PC_EN_AL, 0)} al`],
    ];
  }

  override presser(pos: Pt, _bouton: Bouton_souris): boolean {
    if (this.verrou.currentData() !== 'd' && this.axe && Math.abs(pos.y - this.axe[2]) < 30) {
      this._glisse = (q) => this.tirer(q);
      return true;
    }
    return false;
  }

  private tirer(pos: Pt): void {
    const [x0, x1] = this.axe!;
    const t = Math.max(0.0, Math.min(1.0, (pos.x - x0) / (x1 - x0)));
    this.d.setValue(10 ** (Math.log10(D_MIN) + t * (Math.log10(D_MAX) - Math.log10(D_MIN))));
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const x0 = rect.x + 50,
      x1 = rect.right - 40;
    const y = rect.cy;
    this.axe = [x0, x1, y];
    p.setPen(dessin.stylo('grille', 1.5));
    p.drawLine(x0, y, x1, y);
    dessin.disque(p, x0 - 22, y, 9, 'terre');
    dessin.texte(p, x0 - 22, y - 20, tr('anim_shadowsim_terre'), 'doux');
    for (const dd of [1, 10, 100, 1000]) {
      const x = x0 + ((x1 - x0) * Math.log10(dd)) / 3;
      p.setPen(dessin.stylo('doux', 1.0));
      p.drawLine(x, y - 6, x, y + 6);
      dessin.texte(p, x, y + 20, `${dd} pc`, 'doux');
    }
    const t = Math.log10(this.d.value()) / 3;
    const x = x0 + (x1 - x0) * t;
    const mabs = this.M.value();
    const f = (mabs - M_ABS[0]) / (M_ABS[1] - M_ABS[0]);
    const rayon = 18 * (1.2 - 0.2 * f) * 0.7 + 4;
    dessin.disque(p, x, y, rayon * 1.8, 'soleil', null, 0.12 * (1 - f) + 0.05);
    dessin.disque(p, x, y, rayon, 'etoile', null, 1.0 - 0.3 * f);
    dessin.texte(p, x, y - rayon - 14, `d = ${nombre(this.d.value(), 1)} pc`, 'accent2', { fond: true });
    dessin.police(p, 1.25, true);
    dessin.texte(p, rect.cx, rect.y + 34, 'm − M = 5 log₁₀ d − 5', 'texte');
    dessin.police(p, 1 / 1.25);
    dessin.texte(p, rect.cx, rect.y + 62, `${nombre(this.m.value(), 1)} − (${nombre(this.M.value(), 1)}) = ${nombre(this.m.value() - this.M.value(), 1)}`, 'accent1');
  }
}
