/**
 * Blackbody Curves (NAAP) : jusqu'à cinq courbes de Planck à comparer.  Pour la courbe choisie : maximum (Wien
 * λ_max = b / T), aire sous la courbe (σ T⁴ / π), couleur perçue, et magnitudes dans les filtres U, B, V, R (Landolt
 * 1992, points zéro de l'original) avec les indices de couleur.  Constantes exactes du SI.
 */
import * as lumiere from '../../calc/lumiere';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { Couleur, type Peintre, Rect } from '../../noyau/peintre';
import { pround } from '../../noyau/py';
import { Animation, type Bouton, type Choix, type Coche, nombre, type Reglage } from '../base';
import { scientifique } from './gravitation';

const COULEURS = ['accent1', 'accent2', 'accent3', 'arc1', 'horizon'];
const N_MAX = 5;
const T_DEFAUT = 6000.0;
const COULEUR_FILTRE: Record<string, string> = { U: 'arc1', B: 'accent2', V: 'horizon', R: 'accent3' };

export class CorpsNoir extends Animation {
  static override ID = 'bbexplorer';
  static override ANIMEE = false;

  choisie = 0;
  courbe!: Choix;
  t!: Reglage;
  temperatures: number[] = [];
  b_ajouter!: Bouton;
  b_retirer!: Bouton;
  lmax!: Reglage;
  echelle!: Choix;
  c_aire!: Coche;
  c_pic!: Coche;
  c_filtres!: Coche;
  private fixe: number | null = null;

  override construire(): void {
    this.choisie = 0;
    this.courbe = this.choix('courbe', Array.from({ length: N_MAX }, (_, k) => [`anim_bbexplorer_courbe_${k + 1}`, k] as [string, number]), 0);
    this.courbe.activated.connect(() => this.choisir());
    this.t = this.curseur('temperature', 3000.0, 25000.0, T_DEFAUT, { dec: 0, unite: 'K', log: true });
    this.temperatures = [this.t.value()];
    this.b_ajouter = this.bouton('anim_bbexplorer_ajouter', () => this.ajouter());
    this.b_retirer = this.bouton('anim_bbexplorer_retirer', () => this.retirer());
    this.lmax = this.curseur('lambda_max', 1000.0, 5000.0, 1000.0, { dec: 0, unite: 'nm' });
    this.echelle = this.choix('echelle', [['anim_bbexplorer_e_toutes', 'toutes'], ['anim_bbexplorer_e_choisie', 'choisie'], ['anim_bbexplorer_e_fixe', 'fixe']], 'toutes');
    this.c_aire = this.coche('aire', false);
    this.c_pic = this.coche('pic', true);
    this.c_filtres = this.coche('filtres', false);
    this.fixe = null;
    this.etat_boutons();
  }

  private etat_boutons(): void {
    const n = this.temperatures.length;
    this.b_ajouter.setEnabled(n < N_MAX);
    this.b_retirer.setEnabled(n > 1);
    for (let k = 0; k < N_MAX; k++) this.courbe.setItemEnabled(k, k < n);
  }

  private choisir(): void {
    let k = this.courbe.currentData() as number;
    if (k >= this.temperatures.length) {
      k = this.temperatures.length - 1;
      this.courbe.setCurrentIndex(k);
    }
    this.choisie = k;
    this.t.setValue(this.temperatures[k]!);
    this.rafraichir();
  }

  private ajouter(): void {
    if (this.temperatures.length < N_MAX) {
      this.temperatures.push(this.t.value());
      this.choisie = this.temperatures.length - 1;
      this.courbe.setCurrentIndex(this.choisie);
      this.etat_boutons();
      this.rafraichir();
    }
  }

  private retirer(): void {
    if (this.temperatures.length > 1) {
      this.temperatures.splice(this.choisie, 1);
      this.choisie = Math.min(this.choisie, this.temperatures.length - 1);
      this.courbe.setCurrentIndex(this.choisie);
      this.t.setValue(this.temperatures[this.choisie]!);
      this.etat_boutons();
      this.rafraichir();
    }
  }

  override etat_initial(): void {
    this.temperatures = [this.t.value()];
    this.choisie = 0;
    this.courbe.setCurrentIndex(0);
    this.fixe = null;
    this.etat_boutons();
  }

  override reglage_change(): void {
    if (this.choisie < this.temperatures.length) this.temperatures[this.choisie] = this.t.value();
    if (this.echelle.currentData() !== 'fixe') this.fixe = null;
    super.reglage_change();
  }

  override valeurs(): [string, string][] {
    const t = this.temperatures[this.choisie]!;
    const m = lumiere.magnitudes_corps_noir(t);
    const out: [string, string][] = [
      [tr('anim_bbexplorer_temperature_v'), `${nombre(t, 0)} K`],
      [tr('anim_c_pic_wien'), `${nombre(lumiere.pic_wien_m(t) * 1e9, 1)} nm`],
      [tr('anim_c_exitance'), `${scientifique(lumiere.exitance(t))} W·m⁻²`],
      [tr('anim_bbexplorer_rapport_soleil'), `× ${nombre((t / 5772.0) ** 4, 2)}`],
    ];
    if (this.c_filtres.isChecked()) out.push(['U − B', nombre(m.U! - m.B!, 2)], ['B − V', nombre(m.B! - m.V!, 2)], ['V − R', nombre(m.V! - m.R!, 2)]);
    return out;
  }

  static max_courbe(t: number, lmax: number): number {
    const lp = lumiere.pic_wien_m(t) * 1e9;
    return lumiere.planck(Math.min(lp, lmax) * 1e-9, t);
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const filtres = this.c_filtres.isChecked();
    let z: Rect[] = [];
    let r: Rect;
    if (filtres) {
      z = dessin.zones_principale(rect, 1, 0.68);
      r = dessin.cadre(p, z[0]!, tr('anim_bbexplorer_titre'));
    } else r = dessin.cadre(p, rect, tr('anim_bbexplorer_titre'));
    const lmax = this.lmax.value();
    const t_sel = this.temperatures[this.choisie]!;
    const mode = this.echelle.currentData();
    let ymax: number;
    if (mode === 'choisie') ymax = CorpsNoir.max_courbe(t_sel, lmax);
    else if (mode === 'fixe') {
      if (this.fixe === null) this.fixe = Math.max(...this.temperatures.map((t) => CorpsNoir.max_courbe(t, lmax)));
      ymax = this.fixe;
    } else ymax = Math.max(...this.temperatures.map((t) => CorpsNoir.max_courbe(t, lmax)));
    const ax = new Axes(r, 0, lmax, 0, (ymax * 1.1) / 1e12, false, false, [54, 14, 14, 30]).avec(p);
    ax.bande_visible(0.18);
    ax.fond(p, { titre_x: tr('anim_c_lambda_nm'), titre_y: tr('anim_c_luminance_unite') });
    if (filtres) {
      for (const f of lumiere.FILTRES) {
        const [w0, , tt] = lumiere.table('filtre_' + f);
        const pts: [number, number][] = [];
        for (let i = 0; i < tt.length; i += 4) pts.push([w0 + i, (tt[i]! * lumiere.planck((w0 + i) * 1e-9, t_sel)) / 1e12]);
        ax.remplir(pts, COULEUR_FILTRE[f]!, 0.35);
      }
    }
    const pas = Math.max(2.0, lmax / 220);
    this.temperatures.forEach((t, k) => {
      const pts: [number, number][] = [];
      for (let i = 1; i <= Math.trunc(lmax / pas); i++) pts.push([pas * i, lumiere.planck(pas * i * 1e-9, t) / 1e12]);
      const choisie = k === this.choisie;
      if (choisie && this.c_aire.isChecked()) ax.remplir(pts, COULEURS[k]!, 0.25);
      ax.courbe(pts, COULEURS[k]!, choisie ? 3.0 : 1.4, choisie ? 1.0 : 0.75);
    });
    if (this.c_pic.isChecked()) {
      const lp = lumiere.pic_wien_m(t_sel) * 1e9;
      ax.verticale(lp, COULEURS[this.choisie]!, 1.2, true, tr('anim_bbexplorer_pic_a', { l: nombre(lp, 1) }));
    }
    dessin.police(p, 0.9);
    const x = ax.r.right - 150,
      y = ax.r.top + 14;
    this.temperatures.forEach((t, k) => {
      const rgb = lumiere.couleur_corps_noir(Math.trunc(pround(t)));
      dessin.disque(p, x, y + 18 * k, 6, new Couleur(...rgb), COULEURS[k]!);
      dessin.texte(p, x + 12, y + 18 * k + 4, `${nombre(t, 0)} K`, COULEURS[k]!, { centre: false });
    });
    dessin.police(p, 1 / 0.9);
    if (filtres) this.barres(p, dessin.cadre(p, z[1]!, tr('anim_bbexplorer_titre_filtres')), t_sel);
  }

  /** Magnitudes U, B, V, R de la courbe choisie (barres : flux reçu dans chaque filtre, relatif au plus fort). */
  private barres(p: Peintre, r: Rect, t: number): void {
    const flux: Record<string, number> = {};
    for (const f of lumiere.FILTRES) flux[f] = lumiere.somme_filtre(f, (w) => lumiere.planck(w * 1e-9, t));
    const m = lumiere.magnitudes_corps_noir(t);
    const fmax = Math.max(...Object.values(flux));
    const n = lumiere.FILTRES.length;
    const lw = r.w / n;
    const hmax = r.h - 46;
    lumiere.FILTRES.forEach((f, k) => {
      const h = (hmax * flux[f]!) / fmax;
      const x = r.x + k * lw + lw * 0.2;
      p.fillRect(new Rect(x, r.bottom - 30 - h, lw * 0.6, h), dessin.c(COULEUR_FILTRE[f]!, 0.8));
      dessin.texte(p, x + lw * 0.3, r.bottom - 18, f, 'texte');
      dessin.texte(p, x + lw * 0.3, r.bottom - 36 - h, nombre(m[f]!, 2), 'doux');
    });
    dessin.texte(p, r.cx, r.bottom - 4, tr('anim_bbexplorer_magnitudes'), 'doux');
  }
}
