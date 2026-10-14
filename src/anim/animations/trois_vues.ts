/**
 * Three Views Simulator : la phase dépend du point de vue.  La Lune sur son orbite (vue de dessus, le Soleil loin à
 * droite) est montrée vue de la Terre, vue du Soleil (toujours pleine) et vue d'un point quelconque de l'espace.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, type Pt, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import { Animation, angle, type Bouton_souris, nombre, type Reglage } from '../base';

/** Observateur lointain dans la direction ψ vu de la Lune : angle de phase et côté éclairé (true : à droite). */
export function vue_depuis(psi: number): [number, boolean] {
  const r = (psi * Math.PI) / 180;
  const i = astro.angle_de_phase([0.0, 0.0], [1.0, 0.0], [Math.cos(r), Math.sin(r)]);
  return [i, Math.sin(r) < 0];
}

export function psi_de_la_terre(elongation: number): number {
  return pmod(elongation + 180.0, 360.0);
}

export class TroisVues extends Animation {
  static override ID = 'moonphases';
  static JOURS_PAR_S = 2.0;

  phase!: Reglage;
  psi!: Reglage;
  private dessusGeo: [Rect, number, number, number, number, number, number, number] | null = null;

  override construire(): void {
    this.phase = this.curseur('phase', 0.0, 360.0, 45.0, { dec: 1, unite: '°', cle_texte: 'anim_lunar_applet_phase' });
    this.psi = this.curseur('psi', 0.0, 360.0, 270.0, { dec: 1, unite: '°' });
    this.dessusGeo = null;
  }

  override avancer(dt: number): void {
    this.phase.setValue(pmod(this.phase.value() + (360.0 * dt * TroisVues.JOURS_PAR_S) / astro.MOIS_SYNODIQUE_J, 360.0));
  }

  private points_de_vue(): Record<string, [number, boolean]> {
    const e = this.phase.value();
    return { terre: vue_depuis(psi_de_la_terre(e)), soleil: vue_depuis(0.0), libre: vue_depuis(this.psi.value()) };
  }

  override valeurs(): [string, string][] {
    const v = this.points_de_vue();
    const out: [string, string][] = [];
    for (const cle of ['terre', 'soleil', 'libre']) {
      const [i] = v[cle]!;
      out.push([tr('anim_moonphases_vu_' + cle), `${angle(i)} (${nombre(100 * astro.fraction_eclairee_phase(i), 1)} %)`]);
    }
    out.push([tr('anim_lunar_applet_nom_phase'), tr('anim_phase_' + astro.nom_de_phase(this.phase.value()))]);
    return out;
  }

  override presser(pos: Pt, bouton: Bouton_souris): boolean {
    const g = this.dessusGeo;
    if (g !== null && g[0].contains(pos)) {
      const [, , , , , , ox, oy] = g;
      this._glisse = Math.hypot(pos.x - ox, pos.y - oy) < 16 ? (q) => this.tirer_oeil(q) : (q) => this.tirer_lune(q);
      this._glisse(pos);
      return true;
    }
    return super.presser(pos, bouton);
  }

  private tirer_lune(pos: Pt): void {
    const [, cx, cy] = this.dessusGeo!;
    this.phase.setValue(pmod((Math.atan2(cy - pos.y, pos.x - cx) * 180) / Math.PI, 360.0));
  }

  private tirer_oeil(pos: Pt): void {
    const [, , , , mx, my] = this.dessusGeo!;
    this.psi.setValue(pmod((Math.atan2(my - pos.y, pos.x - mx) * 180) / Math.PI, 360.0));
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones_principale(rect, 3, 0.58);
    this.orbite(p, dessin.cadre(p, z[0]!, tr('anim_moonphases_vue_dessus')));
    const v = this.points_de_vue();
    ['terre', 'soleil', 'libre'].forEach((cle, k) => {
      const r = dessin.cadre(p, z[k + 1]!, tr('anim_moonphases_vu_' + cle));
      const [i, droite] = v[cle]!;
      const rr = Math.min(r.w, r.h) * 0.38;
      dessin.disque_phase(p, r.cx, r.cy, rr, i, droite ? 0.0 : 180.0);
    });
  }

  private orbite(p: Peintre, r: Rect): void {
    const cx = r.cx - r.w * 0.08,
      cy = r.cy;
    const ro = Math.min(r.w * 0.8, r.h) * 0.36;
    for (const k of [-0.8, -0.4, 0.0, 0.4, 0.8]) {
      const y = cy + k * ro;
      dessin.fleche(p, r.right - 4, y, r.right - ro * 0.4, y, dessin.stylo('soleil', 1.3, 0.7), 6);
    }
    dessin.texte(p, r.right - ro * 0.22, r.y + 12, tr('anim_moonphases_vers_soleil'), 'soleil');
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(null);
    p.drawEllipse(cx, cy, ro, ro);
    const rt = ro * 0.16;
    dessin.disque(p, cx, cy, rt, 'terre');
    p.setPen(null);
    p.setBrush(dessin.c('nuit', 0.7));
    p.drawPie(new Rect(cx - rt, cy - rt, 2 * rt, 2 * rt), 90 * 16, 180 * 16);
    const e = (this.phase.value() * Math.PI) / 180;
    const mx = cx + ro * Math.cos(e),
      my = cy - ro * Math.sin(e);
    const rl = Math.max(6.0, rt * 0.5);
    dessin.disque(p, mx, my, rl, 'nuit');
    p.setBrush(dessin.c('lune'));
    p.drawPie(new Rect(mx - rl, my - rl, 2 * rl, 2 * rl), -90 * 16, 180 * 16);
    const ps = (this.psi.value() * Math.PI) / 180;
    const d_o = ro * 0.55;
    const ox = mx + d_o * Math.cos(ps),
      oy = my - d_o * Math.sin(ps);
    p.setPen(dessin.stylo('accent2', 1.2, 0.7, true));
    p.drawLine(ox, oy, mx, my);
    p.setPen(dessin.stylo('accent3', 1.0, 0.5, true));
    p.drawLine(cx, cy, mx, my);
    dessin.disque(p, ox, oy, 7, 'accent2', 'texte');
    dessin.texte(p, ox, oy - 16, tr('anim_basketball_oeil'), 'accent2', { fond: true });
    this.dessusGeo = [r.copie(), cx, cy, ro, mx, my, ox, oy];
  }
}
