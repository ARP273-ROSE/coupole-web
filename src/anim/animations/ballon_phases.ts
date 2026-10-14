/**
 * Basketball Phases Simulator : un ballon éclairé par une lampe, vu de plusieurs directions — l'analogie des phases de
 * la Lune.  Vue de dessus de la pièce et ballon tel que l'œil le voit.  La partie éclairée visible ne dépend que de
 * l'angle de phase i : fraction (1 + cos i) / 2.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, type Pt, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import { Animation, angle, type Bouton_souris, type Choix, type Coche, nombre, type Reglage } from '../base';
import { ANGLES_PHASES, PHASES } from './phases_lune';

/** Œil à l'angle θ autour du ballon : angle de phase, côté éclairé, élongation équivalente, nom de la phase. */
export function vue_de_l_oeil(theta: number): { i: number; a_droite: boolean; elongation: number; nom: string } {
  const t = (theta * Math.PI) / 180;
  const lampe: [number, number] = [-1.0, 0.0];
  const oeil: [number, number] = [-Math.cos(t), -Math.sin(t)];
  const i = astro.angle_de_phase([0.0, 0.0], lampe, oeil);
  const d = [-oeil[0], -oeil[1]];
  const droite = [d[1]!, -d[0]!];
  const a_droite = lampe[0] * droite[0]! + lampe[1] * droite[1]! >= 0;
  const elong = a_droite ? 180.0 - i : 180.0 + i;
  return { i, a_droite, elongation: pmod(elong, 360.0), nom: astro.nom_de_phase(elong) };
}

export class BallonPhases extends Animation {
  static override ID = 'basketball';
  static TOURS_PAR_S = 0.05;

  theta!: Reglage;
  choix_phase!: Choix;
  c_lune!: Coche;
  private piece: [Rect, number, number] | null = null;

  override construire(): void {
    this.theta = this.curseur('angle', 0.0, 360.0, 180.0, { dec: 1, unite: '°' });
    this.choix_phase = this.choix('position', PHASES.map((k) => ['anim_phase_' + k, k] as [string, string]), 'nl');
    this.choix_phase.activated.connect(() => this.phase_choisie());
    this.c_lune = this.coche('lune', true);
    this.piece = null;
  }

  private phase_choisie(): void {
    this.theta.setValue(pmod(ANGLES_PHASES[this.choix_phase.currentData() as string]! - 180.0, 360.0));
  }

  override avancer(dt: number): void {
    this.theta.setValue(pmod(this.theta.value() + 360.0 * BallonPhases.TOURS_PAR_S * dt, 360.0));
  }

  override reglage_change(): void {
    const cle = vue_de_l_oeil(this.theta.value()).nom;
    if (this.choix_phase.currentData() !== cle) {
      this.choix_phase.blockSignals(true);
      this.choix_phase.setCurrentIndex(this.choix_phase.findData(cle));
      this.choix_phase.blockSignals(false);
    }
    super.reglage_change();
  }

  override valeurs(): [string, string][] {
    const v = vue_de_l_oeil(this.theta.value());
    return [
      [tr('anim_c_angle_phase'), angle(v.i)],
      [tr('anim_c_eclairee'), `${nombre(100 * astro.fraction_eclairee_phase(v.i), 1)} %`],
      [tr('anim_basketball_cote'), tr(v.a_droite ? 'anim_basketball_droite' : 'anim_basketball_gauche')],
      [tr('anim_basketball_phase_lune'), tr('anim_phase_' + v.nom)],
    ];
  }

  override presser(pos: Pt, bouton: Bouton_souris): boolean {
    if (this.piece !== null && this.piece[0].contains(pos)) {
      this._glisse = (q) => this.tirer(q);
      this.tirer(pos);
      return true;
    }
    return super.presser(pos, bouton);
  }

  private tirer(pos: Pt): void {
    const [, cx, cy] = this.piece!;
    const a = (Math.atan2(cy - pos.y, pos.x - cx) * 180) / Math.PI;
    this.theta.setValue(pmod(a - 180.0, 360.0));
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = this.c_lune.isChecked() ? dessin.zones_principale(rect, 2, 0.55) : dessin.zones(rect, 2, 0.7);
    this.dessus(p, dessin.cadre(p, z[0]!, tr('anim_basketball_vue_dessus')));
    const v = vue_de_l_oeil(this.theta.value());
    const r1 = dessin.cadre(p, z[1]!, tr('anim_basketball_vue_oeil'));
    const rr = Math.min(r1.w, r1.h) * 0.36;
    dessin.disque_phase(p, r1.cx, r1.cy, rr, v.i, v.a_droite ? 0.0 : 180.0, 'mars', 'nuit');
    if (z.length === 3) {
      const r2 = dessin.cadre(p, z[2]!, tr('anim_basketball_vue_lune'));
      const rl = Math.min(r2.w, r2.h) * 0.32;
      dessin.phase_lune(p, r2.cx, r2.cy - 8, rl, v.elongation);
      dessin.texte(p, r2.cx, r2.cy + rl + 10, tr('anim_phase_' + v.nom), 'doux');
    }
  }

  private dessus(p: Peintre, r: Rect): void {
    const cx = r.cx,
      cy = r.cy;
    const ro = Math.min(r.w, r.h) * 0.36;
    this.piece = [r, cx, cy];
    const lx = r.x + 18;
    dessin.disque(p, lx, cy, 11, 'soleil');
    for (const k of [-0.6, -0.3, 0.0, 0.3, 0.6]) dessin.fleche(p, lx + 18, cy + k * ro * 0.8, cx - ro * 0.35, cy + k * ro * 0.5, dessin.stylo('soleil', 1.0, 0.45), 5);
    p.setPen(dessin.stylo('grille', 1.0, null, true));
    p.setBrush(null);
    p.drawEllipse(cx, cy, ro, ro);
    const rb = Math.max(8.0, ro * 0.16);
    dessin.disque(p, cx, cy, rb, 'nuit');
    p.setPen(null);
    p.setBrush(dessin.c('mars'));
    p.drawPie(new Rect(cx - rb, cy - rb, 2 * rb, 2 * rb), 90 * 16, 180 * 16);
    const t = (this.theta.value() * Math.PI) / 180;
    const ox = cx - ro * Math.cos(t),
      oy = cy + ro * Math.sin(t);
    p.setPen(dessin.stylo('accent2', 1.2, 0.7, true));
    p.drawLine(ox, oy, cx, cy);
    dessin.disque(p, ox, oy, 7, 'accent2', 'texte');
    dessin.disque(p, ox + (3 * (cx - ox)) / ro, oy + (3 * (cy - oy)) / ro, 2.5, 'fond');
    dessin.texte(p, ox, oy - 16, tr('anim_basketball_oeil'), 'accent2', { fond: true });
  }
}
