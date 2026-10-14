/**
 * Phase Positions Demonstrator : deux corps qu'on place librement autour du Soleil ; chacun est vu de l'autre avec la
 * phase que donne la géométrie.  Approché assez près de l'autre, un corps devient sa lune (orbite de rayon fixe).
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, type Pt, Rect } from '../../noyau/peintre';
import { Animation, angle, type Bouton_souris, type Coche, nombre } from '../base';

const DISTANCE_LUNE = 0.15;
const CAPTURE = 0.21;
const PRES_DU_SOLEIL = 0.25;
const DEPART: Record<number, [number, number]> = { 1: [0.5, 0.8], 2: [0.6, 0.2] };

/** Angle de phase de `cible` vu depuis `observateur` (Soleil à l'origine) et côté éclairé (true : droite). */
export function vu_de(cible: [number, number], observateur: [number, number]): [number, boolean] {
  const i = astro.angle_de_phase(cible, [0.0, 0.0], observateur);
  const dx = cible[0] - observateur[0],
    dy = cible[1] - observateur[1];
  return [i, -cible[0] * dy + -cible[1] * -dx >= 0];
}

export class PositionsPhases extends Animation {
  static override ID = 'phaseDemonstrator';
  static override ANIMEE = false;

  c_orbites!: Coche;
  c_phase1!: Coche;
  c_phase2!: Coche;
  pos: Record<number, [number, number]> = { 1: DEPART[1]!, 2: DEPART[2]! };
  lune: number | null = null;
  private zone: [Rect, number, number, number] | null = null;

  override construire(): void {
    this.c_orbites = this.coche('orbites', true);
    this.c_phase1 = this.coche('phase1', true);
    this.c_phase2 = this.coche('phase2', true);
    this.etat_initial();
  }

  override etat_initial(): void {
    this.pos = { 1: DEPART[1]!, 2: DEPART[2]! };
    this.lune = null;
    this.zone = null;
  }

  placer(ident: number, x: number, y: number): void {
    const autre = 3 - ident;
    x = Math.max(-0.92, Math.min(0.92, x));
    y = Math.max(-0.92, Math.min(0.92, y));
    const r = Math.hypot(x, y);
    if (r < PRES_DU_SOLEIL) {
      const a = Math.atan2(y, x);
      x = PRES_DU_SOLEIL * Math.cos(a);
      y = PRES_DU_SOLEIL * Math.sin(a);
    }
    const [ox, oy] = this.pos[autre]!;
    if (this.lune === autre) {
      const a = Math.atan2(oy - y, ox - x);
      this.pos[autre] = [x + DISTANCE_LUNE * Math.cos(a), y + DISTANCE_LUNE * Math.sin(a)];
    } else if (Math.hypot(x - ox, y - oy) < CAPTURE) {
      const a = Math.atan2(y - oy, x - ox);
      x = ox + DISTANCE_LUNE * Math.cos(a);
      y = oy + DISTANCE_LUNE * Math.sin(a);
      this.lune = ident;
    } else if (this.lune === ident) this.lune = null;
    this.pos[ident] = [x, y];
    this.rafraichir();
  }

  private nom(k: number): string {
    return tr(this.lune === k ? 'anim_phasedemonstrator_lune' : 'anim_phasedemonstrator_planete', { n: k });
  }

  override valeurs(): [string, string][] {
    const p1 = this.pos[1]!,
      p2 = this.pos[2]!;
    const [i1] = vu_de(p1, p2);
    const [i2] = vu_de(p2, p1);
    return [
      [tr('anim_phasedemonstrator_vu', { a: this.nom(1), b: this.nom(2) }), `${angle(i1)} (${nombre(100 * astro.fraction_eclairee_phase(i1), 1)} %)`],
      [tr('anim_phasedemonstrator_vu', { a: this.nom(2), b: this.nom(1) }), `${angle(i2)} (${nombre(100 * astro.fraction_eclairee_phase(i2), 1)} %)`],
      [tr('anim_phasedemonstrator_dist_soleil'), `${nombre(Math.hypot(...p1), 2)} / ${nombre(Math.hypot(...p2), 2)}`],
      [tr('anim_phasedemonstrator_dist_mutuelle'), nombre(Math.hypot(p1[0] - p2[0], p1[1] - p2[1]), 2)],
    ];
  }

  override presser(pos: Pt, bouton: Bouton_souris): boolean {
    if (this.zone === null || !this.zone[0].contains(pos)) return super.presser(pos, bouton);
    const [, cx, cy, s] = this.zone;
    const meilleurs = [1, 2].map((k) => [Math.hypot(pos.x - (cx + s * this.pos[k]![0]), pos.y - (cy - s * this.pos[k]![1])), k] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (meilleurs[0]![0] < 22) {
      const k = meilleurs[0]![1];
      this._glisse = (q) => {
        const z = this.zone!;
        this.placer(k, (q.x - z[1]) / z[3], (z[2] - q.y) / z[3]);
      };
      return true;
    }
    return false;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones_principale(rect, 2, 0.6);
    this.plan(p, dessin.cadre(p, z[0]!, tr('anim_phasedemonstrator_plan')));
    [[1, 2], [2, 1]].forEach(([a, b], k) => {
      const r = dessin.cadre(p, z[k + 1]!, tr('anim_phasedemonstrator_vu', { a: this.nom(a!), b: this.nom(b!) }));
      const montrer = (a === 1 ? this.c_phase1 : this.c_phase2).isChecked();
      const rr = Math.min(r.w, r.h) * 0.36;
      if (montrer) {
        const [i, droite] = vu_de(this.pos[a!]!, this.pos[b!]!);
        dessin.disque_phase(p, r.cx, r.cy, rr, i, droite ? 0.0 : 180.0, a === 1 ? 'accent3' : 'accent2', 'nuit');
      } else {
        p.setPen(dessin.stylo('grille', 1.2, null, true));
        p.setBrush(null);
        p.drawEllipse(r.cx, r.cy, rr, rr);
        dessin.texte(p, r.cx, r.cy, '?', 'doux');
      }
    });
  }

  private plan(p: Peintre, r: Rect): void {
    const s = (Math.min(r.w, r.h) / 2) * 0.95;
    const cx = r.cx,
      cy = r.cy;
    this.zone = [r.copie(), cx, cy, s];
    const couleurs: Record<number, string> = { 1: 'accent3', 2: 'accent2' };
    if (this.c_orbites.isChecked()) {
      for (const k of [1, 2]) {
        const [x, y] = this.pos[k]!;
        p.setPen(dessin.stylo(couleurs[k]!, 1.0, 0.45));
        p.setBrush(null);
        if (this.lune === k) {
          const [ox, oy] = this.pos[3 - k]!;
          p.drawEllipse(cx + s * ox, cy - s * oy, s * DISTANCE_LUNE, s * DISTANCE_LUNE);
        } else {
          const rr = Math.hypot(x, y) * s;
          p.drawEllipse(cx, cy, rr, rr);
        }
      }
    }
    dessin.disque(p, cx, cy, Math.max(8.0, s * 0.07), 'soleil');
    for (const k of [1, 2]) {
      const [x, y] = this.pos[k]!;
      const px = cx + s * x,
        py = cy - s * y;
      const rr = Math.max(6.0, s * 0.045);
      dessin.disque(p, px, py, rr, 'nuit');
      const a = (Math.atan2(-y, -x) * 180) / Math.PI;
      p.setPen(null);
      p.setBrush(dessin.c(couleurs[k]!));
      p.drawPie(new Rect(px - rr, py - rr, 2 * rr, 2 * rr), Math.trunc((a - 90) * 16), 180 * 16);
      dessin.texte(p, px + rr + 9, py - rr - 6, String(k), couleurs[k]!, { fond: true });
    }
    dessin.texte(p, r.x + 8, r.bottom - 10, tr('anim_phasedemonstrator_glisser'), 'doux', { centre: false });
  }
}
