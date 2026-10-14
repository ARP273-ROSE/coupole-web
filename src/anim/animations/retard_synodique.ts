/**
 * Synodic Lag : différence entre jour sidéral et jour solaire.  Après un tour complet par rapport aux étoiles (jour
 * sidéral), la Terre doit encore tourner un peu pour que le Soleil revienne au méridien (jour solaire) :
 * 1 / jour solaire = 1 / jour sidéral − 1 / année.  La rotation peut être ralentie (240 h, 1 200 h).
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import { Animation, angle, type Choix, type Coche, duree_hm, nombre } from '../base';

const ANNEE_H = astro.ANNEE_SIDERALE_J * 24.0;
const JOUR_SIDERAL_H = astro.jour_sideral_s(astro.ANNEE_SIDERALE_J) / 3600.0;
const ROTATIONS: [string, number][] = [['reel', JOUR_SIDERAL_H], ['h240', 240.0], ['h1200', 1200.0]];
const SECONDES_PAR_TOUR = 3.0;

export class RetardSynodique extends Animation {
  static override ID = 'synodiclag';

  rotation!: Choix;
  c_ombre!: Coche;
  theta = 0.0;
  phi = 0.0;
  depart: [number, number] = [0.0, 0.0];
  mode: string | null = null;
  ecoule_h = 0.0;
  private rot: unknown = undefined;

  override construire(): void {
    this.rotation = this.choix('rotation', ROTATIONS.map(([k, v]) => ['anim_synodiclag_r_' + k, v] as [string, number]), 240.0);
    this.bouton('anim_synodiclag_sideral', () => this.lancer('sideral'));
    this.bouton('anim_synodiclag_solaire', () => this.lancer('solaire'));
    this.bouton('anim_synodiclag_midi', () => this.realigner());
    this.c_ombre = this.coche('ombre', true);
    this.etat_initial();
  }

  override etat_initial(): void {
    this.theta = 0.0;
    this.phi = 0.0;
    this.depart = [0.0, 0.0];
    this.mode = null;
    this.ecoule_h = 0.0;
  }

  override reglage_change(): void {
    if (this.rot !== this.rotation.currentData()) {
      this.rot = this.rotation.currentData();
      this.realigner();
    }
    super.reglage_change();
  }

  /** Remet la Terre à midi (le méridien de l'observateur tourné vers le Soleil). */
  realigner(): void {
    this.phi = this.theta;
    this.depart = [this.theta, this.phi];
    this.ecoule_h = 0.0;
    this.mode = null;
    this.rafraichir();
  }

  lancer(mode: string): void {
    this.depart = [this.theta, this.phi];
    this.ecoule_h = 0.0;
    this.mode = mode;
    if (!this.en_lecture) this.basculer_lecture();
  }

  durees(): [number, number] {
    const rot = this.rotation.currentData() as number;
    return [rot, astro.jour_solaire(rot, ANNEE_H)];
  }

  override avancer(dt: number): void {
    const [rot, sol] = this.durees();
    let dh = (dt * rot) / SECONDES_PAR_TOUR;
    const fin = this.mode === 'sideral' ? rot : this.mode === 'solaire' ? sol : null;
    if (fin !== null && this.ecoule_h + dh >= fin) {
      dh = fin - this.ecoule_h;
      this.mode = null;
      if (this.en_lecture) this.basculer_lecture();
    }
    this.ecoule_h += dh;
    this.theta += (360.0 * dh) / ANNEE_H;
    this.phi += (360.0 * dh) / rot;
  }

  override valeurs(): [string, string][] {
    const [rot, sol] = this.durees();
    return [
      [tr('anim_synodiclag_jour_sideral'), rot < 100 ? duree_hm(rot) : `${nombre(rot, 0)} h`],
      [tr('anim_synodiclag_jour_solaire'), RetardSynodique.duree(sol)],
      [tr('anim_synodiclag_retard'), RetardSynodique.duree(sol - rot)],
      [tr('anim_synodiclag_angle_soleil'), angle(pmod(this.phi - this.theta, 360.0), 2)],
      [tr('anim_synodiclag_tour_etoiles'), angle(this.ecoule_h ? pmod(this.phi - this.depart[1], 360.0) : 0.0, 2)],
      [tr('anim_synodiclag_ecoule'), RetardSynodique.duree(this.ecoule_h)],
    ];
  }

  static duree(h: number): string {
    if (h < 1.0) return `${Math.trunc(h * 60)} min ${nombre(pmod(h * 3600, 60), 1)} s`;
    return h < 100 ? duree_hm(h) : `${nombre(h, 2)} h`;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const cx = rect.cx,
      cy = rect.cy;
    const ro = Math.min(rect.w, rect.h) * 0.36;
    const rt = Math.max(14.0, ro * 0.17);
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(null);
    p.drawEllipse(cx, cy, ro, ro);
    dessin.disque(p, cx, cy, Math.max(10.0, ro * 0.1), 'soleil');
    dessin.fleche(p, rect.right - 60, rect.y + 24, rect.right - 14, rect.y + 24, dessin.stylo('etoile', 1.4, 0.8), 7);
    dessin.texte(p, rect.right - 74, rect.y + 42, tr('anim_synodiclag_vers_etoiles'), 'doux');
    if (this.c_ombre.isChecked() && this.ecoule_h > 0) this.terre(p, cx, cy, ro, rt, this.depart[0], this.depart[1], true);
    this.terre(p, cx, cy, ro, rt, this.theta, this.phi);
  }

  private terre(p: Peintre, cx: number, cy: number, ro: number, rt: number, theta: number, phi: number, fantome = false): void {
    const t = (theta * Math.PI) / 180;
    const ex = cx + ro * Math.cos(t),
      ey = cy - ro * Math.sin(t);
    const a = fantome ? 0.35 : 1.0;
    if (!fantome) {
      p.setPen(dessin.stylo('soleil', 1.0, 0.5, true));
      p.drawLine(cx, cy, ex, ey);
    }
    dessin.disque(p, ex, ey, rt, 'terre', null, a);
    p.setPen(null);
    p.setBrush(dessin.c('nuit', 0.65 * a));
    p.drawPie(new Rect(ex - rt, ey - rt, 2 * rt, 2 * rt), Math.trunc((theta - 90) * 16), 180 * 16);
    const f = ((phi + 180.0) * Math.PI) / 180;
    dessin.fleche(p, ex, ey, ex + 1.5 * rt * Math.cos(f), ey - 1.5 * rt * Math.sin(f), dessin.stylo('accent3', 2.2, a), 7);
    if (!fantome) {
      const g = ((this.depart[1] + 180.0) * Math.PI) / 180;
      p.setPen(dessin.stylo('etoile', 1.2, 0.6, true));
      p.drawLine(ex, ey, ex + 1.9 * rt * Math.cos(g), ey - 1.9 * rt * Math.sin(g));
    }
  }
}
