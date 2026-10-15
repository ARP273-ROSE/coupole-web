/**
 * Lunar Phases Simulator (NAAP) : la Lune sur son orbite (vue du dessus, le Soleil à droite), sa phase vue de la
 * Terre, et sa position dans le ciel de l'observateur selon l'heure.  Lunaison moyenne 29,53 jours.  Comme dans
 * l'original, l'orbite de la Lune est ramenée dans le plan de l'équateur céleste.
 */
import { elongationLune, heureSolaire, type Moment } from '../../calc/maintenant';
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, type Pt, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import * as scenes from '../../noyau/scenes';
import { appliquerM } from '../../noyau/vec';
import { Animation, angle, type Bouton_souris, type Choix, type Coche, heures_minutes, nombre, type Reglage } from '../base';

export const PHASES = ['nl', 'pc', 'pq', 'gc', 'pl', 'gd', 'dq', 'dc'];
export const ANGLES_PHASES: Record<string, number> = { nl: 0.0, pc: 45.0, pq: 90.0, gc: 135.0, pl: 180.0, gd: 225.0, dq: 270.0, dc: 315.0 };

function ciel(heure: number, phase: number, lat: number): { az_soleil: number; alt_soleil: number; az_lune: number; alt_lune: number } {
  const h_sol = (heure - 12.0) * 15.0;
  const h_lune = h_sol - phase;
  const [az_s, alt_s] = astro.equatorial_vers_horizon(h_sol, 0.0, lat);
  const [az_l, alt_l] = astro.equatorial_vers_horizon(h_lune, 0.0, lat);
  return { az_soleil: az_s, alt_soleil: alt_s, az_lune: az_l, alt_lune: alt_l };
}

function temps_depuis_nouvelle(phase: number, mois = astro.MOIS_SYNODIQUE_J): number {
  return (mois * pmod(phase, 360.0)) / 360.0;
}

export class PhasesLune extends Animation {
  static override ID = 'lunar_applet';
  static JOURS_PAR_S = 0.25;

  ciel3d!: dessin.Vue3D;
  phase!: Reglage;
  heure!: Reglage;
  lat!: Reglage;
  nom!: Choix;
  c_angle!: Coche;
  c_heures!: Coche;
  c_repere!: Coche;
  private orbite_rect: [Rect, number, number, number, number] | null = null;

  static override TEMPS = ['phase', 'heure', 'nom_phase'] as const;
  static override HEURE_SOLAIRE = true;

  /** « Maintenant » : date et heure de l'appareil (calc/maintenant.ts). */
  override maintenant(m: Moment): void {
    // phase réelle de la Lune (élongation) et heure solaire de l'observateur
    const [j, h] = heureSolaire(m.i, m.lon);
    void j;
    this.poser(this.phase, elongationLune(m.i.jj));
    this.poser(this.heure, h);
    if (m.lat !== null) this.poser(this.lat, m.lat);
  }

  override construire(): void {
    this.ciel3d = this.vue(200.0, 25.0, 10.0, 89.0);
    this.phase = this.curseur('phase', 0.0, 360.0, 0.0, { dec: 1, unite: '°', cle_texte: 'anim_lunar_applet_phase' });
    this.heure = this.curseur('heure', 0.0, 24.0, 12.0, { dec: 2, unite: 'h', cle_texte: 'anim_c_heure' });
    this.lat = this.curseur('latitude', -90.0, 90.0, 41.0, { dec: 1, unite: '°', cle_texte: 'anim_c_latitude' });
    this.nom = this.choix('nom_phase', PHASES.map((k) => ['anim_phase_' + k, k] as [string, string]), 'nl');
    this.nom.activated.connect(() => this.phase_choisie());
    for (const [cle, dj] of [
      ['anim_lunar_applet_j_moins', -1.0], ['anim_lunar_applet_j_plus', 1.0], ['anim_lunar_applet_h_moins', -1 / 24],
      ['anim_lunar_applet_h_plus', 1 / 24], ['anim_lunar_applet_min_moins', -1 / 1440], ['anim_lunar_applet_min_plus', 1 / 1440],
    ] as [string, number][])
      this.bouton(cle, () => this.decaler(dj));
    this.c_angle = this.coche('angle', false);
    this.c_heures = this.coche('reperes', false);
    this.c_repere = this.coche('repere', false);
    this.orbite_rect = null;
  }

  private phase_choisie(): void {
    this.phase.setValue(ANGLES_PHASES[this.nom.currentData() as string]!);
  }

  /** Avance le temps de `jours` : l'heure tourne, la phase progresse de 360° par lunaison. */
  decaler(jours: number): void {
    const h = this.heure.value() + jours * 24.0;
    this.heure.setValue(pmod(h, 24.0));
    this.phase.setValue(pmod(this.phase.value() + (jours * 360.0) / astro.MOIS_SYNODIQUE_J, 360.0));
  }

  override avancer(dt: number): void {
    this.decaler(dt * PhasesLune.JOURS_PAR_S);
  }

  override reglage_change(): void {
    const cle = astro.nom_de_phase(this.phase.value());
    if (this.nom.currentData() !== cle) {
      this.nom.blockSignals(true);
      this.nom.setCurrentIndex(this.nom.findData(cle));
      this.nom.blockSignals(false);
    }
    super.reglage_change();
  }

  override valeurs(): [string, string][] {
    const ph = this.phase.value();
    const t = temps_depuis_nouvelle(ph);
    const c = ciel(this.heure.value(), ph, this.lat.value());
    return [
      [tr('anim_lunar_applet_nom_phase'), tr('anim_phase_' + astro.nom_de_phase(ph))],
      [tr('anim_lunar_applet_eclairee'), `${nombre(100 * astro.fraction_eclairee(ph), 1)} %`],
      [tr('anim_lunar_applet_depuis_nouvelle'), tr('anim_lunar_applet_jh', { j: Math.trunc(t), h: Math.trunc((t - Math.trunc(t)) * 24) })],
      [tr('anim_c_heure'), heures_minutes(this.heure.value())],
      [tr('anim_lunar_applet_elongation'), angle(ph <= 180 ? ph : 360 - ph)],
      [tr('anim_lunar_applet_h_soleil'), angle(c.alt_soleil)],
      [tr('anim_lunar_applet_h_lune'), angle(c.alt_lune)],
    ];
  }

  // ------------------------------------------------------------ souris (vue de l'orbite)
  override presser(pos: Pt, bouton: Bouton_souris): boolean {
    const r = this.orbite_rect;
    if (r !== null && r[0].contains(pos)) {
      const [, cx, cy, ro] = r;
      const a = (this.phase.value() * Math.PI) / 180;
      const mx = cx + ro * Math.cos(a),
        my = cy - ro * Math.sin(a);
      this._glisse = Math.hypot(pos.x - mx, pos.y - my) < 16 ? (q) => this.tirer_lune(q) : (q) => this.tirer_terre(q);
      return true;
    }
    return super.presser(pos, bouton);
  }

  private tirer_lune(pos: Pt): void {
    const [, cx, cy] = this.orbite_rect!;
    this.phase.setValue(pmod((Math.atan2(cy - pos.y, pos.x - cx) * 180) / Math.PI, 360.0));
  }

  private tirer_terre(pos: Pt): void {
    const [, cx, cy] = this.orbite_rect!;
    const a = (Math.atan2(cy - pos.y, pos.x - cx) * 180) / Math.PI;
    this.heure.setValue(pmod(12.0 + a / 15.0, 24.0));
  }

  // ------------------------------------------------------------ dessin
  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones_principale(rect, 2);
    this.dessinOrbite(p, dessin.cadre(p, z[0]!, tr('anim_lunar_applet_vue_orbite')));
    this.dessinPhase(p, dessin.cadre(p, z[1]!, tr('anim_lunar_applet_vue_phase')));
    this.dessinCiel(p, dessin.cadre(p, z[2]!, tr('anim_lunar_applet_vue_ciel')));
  }

  private dessinOrbite(p: Peintre, r: Rect): void {
    const cx = r.cx,
      cy = r.cy;
    const ro = Math.min(r.w, r.h) * 0.38;
    const rt = ro * 0.22;
    this.orbite_rect = [r.copie(), cx, cy, ro, rt];
    for (const k of [-0.8, -0.4, 0.0, 0.4, 0.8]) {
      const y = cy + k * ro;
      dessin.fleche(p, r.right - 6, y, r.right - ro * 0.35, y, dessin.stylo('soleil', 1.3, 0.7), 6);
    }
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(null);
    p.drawEllipse(cx, cy, ro, ro);
    dessin.disque(p, cx, cy, rt, 'terre');
    p.setPen(null);
    p.setBrush(dessin.c('nuit', 0.7));
    p.drawPie(new Rect(cx - rt, cy - rt, 2 * rt, 2 * rt), 90 * 16, 180 * 16);
    if (this.c_heures.isChecked()) {
      dessin.police(p, 0.75);
      for (let hh = 0; hh < 24; hh += 3) {
        const a = ((hh - 12) * 15 * Math.PI) / 180;
        dessin.texte(p, cx + rt * 1.55 * Math.cos(a), cy - rt * 1.55 * Math.sin(a), `${hh} h`, 'doux');
      }
      dessin.police(p, 1 / 0.75);
    }
    const a = ((this.heure.value() - 12.0) * 15.0 * Math.PI) / 180;
    const ox = cx + rt * Math.cos(a),
      oy = cy - rt * Math.sin(a);
    p.setPen(dessin.stylo('accent3', 2.5));
    p.drawLine(ox, oy, ox + 0.6 * rt * Math.cos(a), oy - 0.6 * rt * Math.sin(a));
    p.setPen(dessin.stylo('horizon', 1.5));
    p.drawLine(ox - 0.7 * rt * Math.sin(a), oy - 0.7 * rt * Math.cos(a), ox + 0.7 * rt * Math.sin(a), oy + 0.7 * rt * Math.cos(a));
    const ph = (this.phase.value() * Math.PI) / 180;
    const mx = cx + ro * Math.cos(ph),
      my = cy - ro * Math.sin(ph);
    const rl = Math.max(5.0, rt * 0.45);
    dessin.disque(p, mx, my, rl, 'nuit');
    p.setBrush(dessin.c('lune'));
    p.setPen(null);
    p.drawPie(new Rect(mx - rl, my - rl, 2 * rl, 2 * rl), -90 * 16, 180 * 16);
    if (this.c_repere.isChecked()) dessin.disque(p, mx - rl * 0.8 * Math.cos(ph), my + rl * 0.8 * Math.sin(ph), 2.2, 'accent3');
    if (this.c_angle.isChecked()) {
      p.setPen(dessin.stylo('accent1', 1.5));
      p.drawLine(cx, cy, mx, my);
      p.drawLine(cx, cy, cx + ro * 0.6, cy);
      const rr = ro * 0.45;
      p.drawArc(new Rect(cx - rr, cy - rr, 2 * rr, 2 * rr), 0, Math.trunc(this.phase.value() * 16));
      dessin.texte(p, cx + rr * 0.8 * Math.cos(ph / 2), cy - rr * 0.8 * Math.sin(ph / 2), angle(this.phase.value(), 0), 'accent1');
    }
  }

  private dessinPhase(p: Peintre, r: Rect): void {
    const rr = Math.min(r.w, r.h) * 0.36;
    const cx = r.cx,
      cy = r.cy - 8;
    dessin.phase_lune(p, cx, cy, rr, this.phase.value());
    if (this.c_repere.isChecked()) dessin.disque(p, cx, cy, 3, 'accent3');
    dessin.texte(p, cx, cy + rr + 16, tr('anim_phase_' + astro.nom_de_phase(this.phase.value())), 'texte');
    dessin.texte(p, cx, cy + rr + 34, `${nombre(100 * astro.fraction_eclairee(this.phase.value()), 1)} %`, 'doux');
  }

  private dessinCiel(p: Peintre, r: Rect): void {
    this.zone_rotative(r, this.ciel3d);
    const rr = Math.min(r.w, r.h) * 0.4;
    const cx = r.cx,
      cy = r.cy + 4;
    const lat = this.lat.value();
    const c = ciel(this.heure.value(), this.phase.value(), lat);
    const soleil = astro.vecteur_horizon(c.az_soleil, c.alt_soleil);
    const lune = astro.vecteur_horizon(c.az_lune, c.alt_lune);
    const jour = c.alt_soleil > 0;
    const m = astro.matrice_equatorial_vers_horizon(0.0, lat);
    const scene = (pe: dessin.Peintre3D): void => {
      pe.courbe(appliquerM(m, dessin.cercle([0, 0, 1])), 'equateur', 1.2, 0.8);
      pe.point(soleil, 'soleil', 8.0);
      pe.point(lune, 'lune', 7.0, { bord: 'doux' });
    };
    scenes.sphere_locale(p, this.ciel3d, cx, cy, rr, scene, jour ? 'ciel' : 'nuit');
  }
}
