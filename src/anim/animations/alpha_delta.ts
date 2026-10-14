/**
 * Celestial-Equatorial (RA/Dec) Demonstrator : sphère céleste avec la Terre au centre ; une étoile à placer, arcs de
 * l'ascension droite (le long de l'équateur céleste depuis le cercle horaire 0 h, vers l'est) et de la déclinaison ;
 * écliptique, pôles, équateurs à afficher.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import type { Peintre, Pt, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import * as scenes from '../../noyau/scenes';
import { mul } from '../../noyau/vec';
import { Animation, angle, type Bouton_souris, type Coche, nombre, type Reglage } from '../base';

const EPS = astro.obliquite_moyenne();

export class AlphaDelta extends Animation {
  static override ID = 'radecdemo';
  static override ANIMEE = false;

  vue3d!: dessin.Vue3D;
  ra!: Reglage;
  dec!: Reglage;
  c_est!: Coche;
  c_ecliptique!: Coche;
  c_poles_terre!: Coche;
  c_equateur!: Coche;
  c_poles_ciel!: Coche;
  c_equateur_celeste!: Coche;
  c_zero!: Coche;
  private pe: dessin.Peintre3D | null = null;

  override construire(): void {
    this.vue3d = this.vue(217.0, 32.0);
    this.ra = this.curseur('ra', 0.0, 24.0, 4.0, { dec: 2, unite: 'h', cle_texte: 'anim_c_ra' });
    this.dec = this.curseur('dec', -90.0, 90.0, 60.0, { dec: 1, unite: '°', cle_texte: 'anim_c_dec' });
    this.c_est = this.coche('est', false);
    this.c_ecliptique = this.coche('ecliptique', false);
    this.c_poles_terre = this.coche('poles_terre', false);
    this.c_equateur = this.coche('equateur', false);
    this.c_poles_ciel = this.coche('poles_ciel', false);
    this.c_equateur_celeste = this.coche('equateur_celeste', false);
    this.c_zero = this.coche('zero', false);
    this.pe = null;
  }

  override valeurs(): [string, string][] {
    const h = this.ra.value();
    return [
      [tr('anim_c_ra'), `${nombre(h, 2)} h = ${angle(15 * h)}`],
      [tr('anim_c_dec'), angle(this.dec.value())],
    ];
  }

  override presser(pos: Pt, bouton: Bouton_souris): boolean {
    if (this.pe !== null) {
      const e = astro.vecteur_equatorial(15 * this.ra.value(), this.dec.value());
      const { xs, ys, zs } = this.pe.ecran(e);
      if (zs[0]! >= 0 && Math.abs(pos.x - xs[0]!) < 14 && Math.abs(pos.y - ys[0]!) < 14) {
        this._glisse = (q) => this.deplacer(q);
        return true;
      }
    }
    return super.presser(pos, bouton);
  }

  private deplacer(pos: Pt): void {
    const v = this.pe ? this.pe.depuis_ecran(pos.x, pos.y) : null;
    if (v !== null) {
      this.ra.setValue(pmod((Math.atan2(v[1], v[0]) * 180) / Math.PI, 360.0) / 15.0);
      this.dec.setValue((Math.asin(Math.max(-1, Math.min(1, v[2]))) * 180) / Math.PI);
    }
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const r = Math.min(rect.w, rect.h) * 0.4;
    const cx = rect.cx,
      cy = rect.cy;
    this.zone_rotative(rect, this.vue3d);
    const pe = new dessin.Peintre3D(p, this.vue3d, cx, cy, r);
    this.pe = pe;
    const ra = 15 * this.ra.value(),
      dec = this.dec.value();
    pe.contour('grille', 'sphere', 0.3);
    pe.courbe(scenes.cercle_horaire(90.0, -90, 90, 91), 'grille', 1.0, 0.7);
    pe.courbe(scenes.cercle_horaire(270.0, -90, 90, 91), 'grille', 1.0, 0.7);
    pe.courbe(scenes.cercle_horaire(180.0, -90, 90, 91), 'grille', 1.0, 0.7);
    pe.courbe(dessin.cercle([0, 0, 1]), 'equateur', 2.0);
    pe.courbe(scenes.cercle_horaire(0.0), 'equateur', 2.0);
    if (this.c_ecliptique.isChecked()) {
      pe.courbe(scenes.ecliptique(EPS), 'ecliptique', 2.0);
      const [a, d] = astro.ecliptique_vers_equatorial(pmod(this.vue3d.az + 60, 360), 0, EPS);
      pe.etiquette(mul(astro.vecteur_equatorial(a, d), 1.04), tr('anim_radecdemo_l_ecliptique'), 'ecliptique');
    }
    // petite Terre au centre (équateur, axe)
    const terre = new dessin.Peintre3D(p, this.vue3d, cx, cy, r * 0.2);
    terre.contour('terre', 'terre', 0.55);
    terre.courbe(dessin.cercle([0, 0, 1]), 'equateur', 1.2);
    pe.segment([0, 0, 1], [0, 0, 1.25], 'doux', 2.0);
    pe.segment([0, 0, -1], [0, 0, -1.25], 'doux', 2.0);
    pe.segment([0, 0, 0.2], [0, 0, 1.0], 'doux', 1.0, 0.5);
    pe.courbe(scenes.cercle_horaire(ra), 'grille', 1.2);
    pe.courbe(scenes.cercle_declinaison(dec), 'grille', 1.2);
    if (ra > 1e-6) pe.courbe(scenes.arc_equateur(0.0, ra), 'arc1', 3.0);
    if (Math.abs(dec) > 1e-6) pe.courbe(scenes.cercle_horaire(ra, 0.0, dec, 60), 'arc2', 3.0);
    const etoile = astro.vecteur_equatorial(ra, dec);
    pe.point(etoile, 'etoile', 6.0, { bord: 'soleil' });
    pe.etiquette(astro.vecteur_equatorial(ra / 2, -6), `${nombre(this.ra.value(), 1)} h`, 'arc1');
    pe.etiquette(astro.vecteur_equatorial(ra + 14, dec / 2), angle(dec), 'arc2');
    if (this.c_est.isChecked()) {
      const a = mul(astro.vecteur_equatorial(pmod(-this.vue3d.az + 60, 360), 0), 1.15);
      const b = mul(astro.vecteur_equatorial(pmod(-this.vue3d.az + 75, 360), 0), 1.15);
      const e0 = pe.ecran(a),
        e1 = pe.ecran(b);
      dessin.fleche(p, e0.xs[0]!, e0.ys[0]!, e1.xs[0]!, e1.ys[0]!, dessin.stylo('accent1', 2.0));
      dessin.texte(p, e1.xs[0]! + 12, e1.ys[0]!, tr('anim_pc_e'), 'accent1');
    }
    if (this.c_poles_terre.isChecked()) {
      pe.etiquette([0, 0, 0.27], tr('anim_radecdemo_l_pole_nord'));
      pe.etiquette([0, 0, -0.27], tr('anim_radecdemo_l_pole_sud'));
    }
    if (this.c_equateur.isChecked())
      pe.etiquette(mul(astro.vecteur_equatorial(pmod(-this.vue3d.az + 34, 360), 0), 0.24), tr('anim_radecdemo_l_equateur'), 'equateur');
    if (this.c_poles_ciel.isChecked()) {
      pe.etiquette([0, 0, 1.33], tr('anim_radecdemo_l_pnc'));
      pe.etiquette([0, 0, -1.33], tr('anim_radecdemo_l_psc'));
    }
    if (this.c_equateur_celeste.isChecked())
      pe.etiquette(mul(astro.vecteur_equatorial(pmod(-this.vue3d.az + 34, 360), 0), 1.06), tr('anim_radecdemo_l_equateur_celeste'), 'equateur');
    if (this.c_zero.isChecked()) pe.etiquette(mul(astro.vecteur_equatorial(0, 35), 1.06), tr('anim_radecdemo_l_zero'), 'equateur');
  }
}
