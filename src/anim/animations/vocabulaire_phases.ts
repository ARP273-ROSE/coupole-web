/**
 * Lunar Phase Vocabulary : la Lune à chacune des phases nommées.  Un bouton par phase, ou l'animation de la lunaison
 * entière (29,53 s par défaut comme l'original : une seconde = un jour) ; le compteur donne les jours écoulés.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import type { Peintre, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import { Animation, angle, type Coche, nombre, type Reglage } from '../base';
import { ANGLES_PHASES, PHASES } from './phases_lune';

export class VocabulairePhases extends Animation {
  static override ID = 'lunar_phaser';

  periode!: Reglage;
  phase!: Reglage;
  c_bande!: Coche;
  jours = 0.0;

  override construire(): void {
    this.periode = this.curseur('periode', 5.0, 60.0, astro.MOIS_SYNODIQUE_J, { dec: 2, unite: 's' });
    this.phase = this.curseur('phase', 0.0, 360.0, 180.0, { dec: 1, unite: '°', cle_texte: 'anim_lunar_applet_phase' });
    for (const cle of PHASES) this.bouton('anim_lunar_phaser_b_' + cle, () => this.aller(cle));
    this.c_bande = this.coche('bande', true);
    this.jours = 0.0;
  }

  aller(cle: string): void {
    this.phase.setValue(ANGLES_PHASES[cle]!);
    this.jours = 0.0;
    this.rafraichir();
  }

  override etat_initial(): void {
    this.jours = 0.0;
  }

  override avancer(dt: number): void {
    const dj = (dt * astro.MOIS_SYNODIQUE_J) / this.periode.value();
    this.jours += dj;
    this.phase.setValue(pmod(this.phase.value() + (360.0 * dj) / astro.MOIS_SYNODIQUE_J, 360.0));
  }

  override valeurs(): [string, string][] {
    const ph = this.phase.value();
    return [
      [tr('anim_lunar_applet_nom_phase'), tr('anim_phase_' + astro.nom_de_phase(ph))],
      [tr('anim_lunar_applet_phase'), angle(ph)],
      [tr('anim_lunar_applet_eclairee'), `${nombre(100 * astro.fraction_eclairee(ph), 1)} %`],
      [tr('anim_lunar_phaser_age'), `${nombre((astro.MOIS_SYNODIQUE_J * ph) / 360.0, 1)} ${tr('anim_u_jours')}`],
      [tr('anim_lunar_phaser_ecoules'), `${nombre(this.jours, 1)} ${tr('anim_u_jours')}`],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const ph = this.phase.value();
    const bande = this.c_bande.isChecked();
    const haut = rect.h * (bande ? (rect.w >= 640 ? 0.74 : 0.56) : 1.0);
    const r = Math.min(rect.w, haut) * 0.36;
    const cx = rect.cx,
      cy = rect.y + haut * 0.47;
    dessin.phase_lune(p, cx, cy, r, ph);
    dessin.police(p, 1.3, true);
    dessin.texte(p, cx, cy + r + 0.07 * haut + 6, tr('anim_phase_' + astro.nom_de_phase(ph)));
    dessin.police(p, 1 / 1.3);
    if (!bande) return;
    const lignes = rect.w >= 640 ? 1 : 2;
    const par_ligne = Math.floor(PHASES.length / lignes);
    const h_ligne = (rect.h - haut) / lignes;
    const pas = rect.w / par_ligne;
    const rr = Math.min(pas * 0.33, h_ligne * 0.3);
    const courant = astro.nom_de_phase(ph);
    dessin.police(p, 0.8);
    PHASES.forEach((cle, k) => {
      const x = rect.x + pas * ((k % par_ligne) + 0.5);
      const y = rect.y + haut + h_ligne * (Math.floor(k / par_ligne) + 0.42);
      if (cle === courant) {
        p.setPen(dessin.stylo('accent1', 2.0));
        p.setBrush(null);
        p.drawEllipse(x, y, rr + 5, rr + 5);
      }
      dessin.phase_lune(p, x, y, rr, ANGLES_PHASES[cle]!);
      dessin.texte(p, x, y + rr + 14, tr('anim_phase_' + cle), cle === courant ? 'texte' : 'doux');
    });
    dessin.police(p, 1 / 0.8);
  }
}
