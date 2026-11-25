/**
 * Le transfert de Hohmann : deux poussées et une demi-ellipse entre deux orbites circulaires ; bilan des vitesses,
 * durée, angle de phase et fenêtres de tir.  Jumeau de `animations/hohmann.py` de Coupole (calculs :
 * `calc/hohmann.ts`).
 */
import * as hm from '../../calc/hohmann';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { Animation, angle, type Choix, type Coche, nombre } from '../base';
import { duree } from './elements_orbite';

const DUREE_TRANSFERT_S = 6.0;
const COULEURS: Record<string, string> = {
  terre: 'terre', mars: 'mars', venus: 'arc2', jupiter: 'ecliptique', lune: 'lune', geo_sat: 'accent3', iss: 'accent3', leo: 'accent1',
};
const DEG = 180 / Math.PI;

export function signe(x: number, dec = 3): string {
  return (x >= 0 ? '+' : '') + nombre(x, dec);
}

type Donnees = [number, number, number, string, string, string, number, hm.Bilan];

export class Hohmann extends Animation {
  static override ID = 'hohmann';
  static override LECTURE_AU_DEPART = true;

  scenario!: Choix;
  c_auto!: Coche;
  c_fantome!: Coche;
  t = 0.0;
  t_depart: number | null = null;
  theta_depart = 0.0;
  private sc: unknown = 'terre_mars';

  override construire(): void {
    this.scenario = this.choix('scenario', hm.SCENARIOS.map(([k]) => ['anim_hohmann_s_' + k, k] as [string, string]), 'terre_mars');
    this.c_auto = this.coche('auto', true);
    this.c_fantome = this.coche('fantome', true);
    this.bouton('anim_hohmann_lancer', () => this.lancer());
    this.bouton('anim_hohmann_recommencer', () => this.recommencer());
    this.sc = this.scenario.currentData();
    this.etat_initial();
  }

  override etat_initial(): void {
    this.t = 0.0;
    this.t_depart = null;
    this.theta_depart = 0.0;
  }

  recommencer(): void {
    this.etat_initial();
    this.rafraichir();
  }

  override reglage_change(): void {
    if (this.scenario) {
      const k = this.scenario.currentData();
      if (k !== this.sc) {
        this.sc = k;
        this.etat_initial();
      }
    }
    super.reglage_change();
  }

  donnees(): Donnees {
    const [mu, r1, r2, dep, arr, cible, avance] = hm.SCENARIOS.find(([k]) => k === this.scenario.currentData())![1];
    return [mu, r1, r2, dep, arr, cible, avance, hm.bilan(mu, r1, r2)];
  }

  angles(t: number): [number, number] {
    const [, , , , , , avance, b] = this.donnees();
    return [b.n1 * t, avance / DEG + b.n2 * t];
  }

  etape(): 'attente' | 'transfert' | 'arrive' {
    if (this.t_depart === null) return 'attente';
    const b = this.donnees()[7];
    return this.t < this.t_depart + b.t ? 'transfert' : 'arrive';
  }

  lancer(): void {
    if (this.t_depart === null) {
      this.t_depart = this.t;
      this.theta_depart = this.angles(this.t)[0];
      this.rafraichir();
    }
  }

  override avancer(dt: number): void {
    const b = this.donnees()[7];
    const dtp = (dt * b.t) / DUREE_TRANSFERT_S;
    if (this.t_depart === null && this.c_auto.isChecked()) {
      const tw = this.t + hm.attente_fenetre(b, this.avance_actuelle());
      if (tw <= this.t + dtp) {
        this.t_depart = tw;
        this.theta_depart = this.angles(tw)[0];
      }
    }
    this.t += dtp;
  }

  avance_actuelle(): number {
    const [a1, a2] = this.angles(this.t);
    const x = (a2 - a1) * DEG + 180.0;
    return ((x % 360) + 360) % 360 - 180.0;
  }

  vaisseau(): [number, number] {
    const [, r1, r2, , , , , b] = this.donnees();
    const e = this.etape();
    if (e === 'attente') return [r1, this.angles(this.t)[0]];
    if (e === 'transfert') return hm.position_transfert(b, r1, r2, this.theta_depart, this.t - this.t_depart!);
    return [r2, this.theta_depart + Math.PI + b.n2 * (this.t - this.t_depart! - b.t)];
  }

  override valeurs(): [string, string][] {
    const b = this.donnees()[7];
    const kms = 'km·s⁻¹';
    const out: [string, string][] = [
      [tr('anim_hohmann_v_dv1'), `${signe(b.dv1)} ${kms} (${nombre(b.v1, 3)} → ${nombre(b.vd, 3)})`],
      [tr('anim_hohmann_v_dv2'), `${signe(b.dv2)} ${kms} (${nombre(b.va, 3)} → ${nombre(b.v2, 3)})`],
      [tr('anim_hohmann_v_dv'), `${nombre(b.dv, 3)} ${kms}`],
      [tr('anim_hohmann_v_duree'), duree(b.t)],
      [tr('anim_hohmann_v_phase'), angle(b.phase, 1)],
      [tr('anim_hohmann_v_synodique'), duree(b.synodique)],
    ];
    const e = this.etape();
    if (e === 'attente') {
      out.push([tr('anim_hohmann_v_avance'), angle(this.avance_actuelle(), 1)]);
      out.push([tr('anim_hohmann_v_etat'), tr('anim_hohmann_e_attente', { d: duree(hm.attente_fenetre(b, this.avance_actuelle())) })]);
    } else if (e === 'transfert') {
      out.push([tr('anim_hohmann_v_etat'), tr('anim_hohmann_e_transfert', { d: duree(this.t - this.t_depart!) })]);
    } else {
      const ecart = this.ecart();
      if (Math.abs(ecart) < 2.0) out.push([tr('anim_hohmann_v_etat'), tr('anim_hohmann_e_reussi')]);
      else out.push([tr('anim_hohmann_v_etat'), tr(ecart > 0 ? 'anim_hohmann_e_rate_avance' : 'anim_hohmann_e_rate_retard', { x: angle(Math.abs(ecart), 1) })]);
    }
    return out;
  }

  ecart(): number {
    const b = this.donnees()[7];
    const [a1, a2] = this.angles(this.t_depart!);
    return hm.ecart_rendez_vous(b, (a2 - a1) * DEG);
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones_principale(rect, 1, 0.68);
    this.orbites(p, dessin.cadre(p, z[0]!, tr('anim_hohmann_t_orbites')));
    this.vitesses(p, dessin.cadre(p, z[1]!, tr('anim_hohmann_t_vitesses')));
  }

  private orbites(p: Peintre, r: Rect): void {
    const [mu, r1, r2, , , cible, , b] = this.donnees();
    const ech = Math.min(r.w, r.h) / 2.0 / (1.12 * Math.max(r1, r2));
    const cx = r.cx,
      cy = r.cy;
    const pt = (rad: number, th: number): Pt => new Pt(cx + rad * ech * Math.cos(th), cy - rad * ech * Math.sin(th));
    p.setBrush(null);
    p.setPen(dessin.stylo('accent2', 1.2, 0.8));
    p.drawEllipse(cx, cy, r1 * ech, r1 * ech);
    p.setPen(dessin.stylo('accent3', 1.2, 0.8));
    p.drawEllipse(cx, cy, r2 * ech, r2 * ech);
    const soleil = mu === hm.MU_SOLEIL;
    dessin.disque(p, cx, cy, soleil ? 9.0 : Math.max(4.0, hm.R_T * ech), soleil ? 'soleil' : 'terre', soleil ? null : 'texte');
    const etape = this.etape();
    const [a1, a2] = this.angles(this.t);
    const th0 = etape === 'attente' ? a1 : this.theta_depart;
    const n = 90;
    const pts = Array.from({ length: n + 1 }, (_, k) => pt(...hm.position_transfert(b, r1, r2, th0, (b.t * k) / n)));
    p.setPen(dessin.stylo('accent1', etape !== 'attente' ? 1.8 : 1.2, 0.95, etape === 'attente'));
    p.drawPolyline(pts);
    if (etape === 'attente') {
      const ra = Math.min(r1, r2) * ech * 0.55;
      const d0 = a1 * DEG;
      p.setPen(dessin.stylo('arc1', 1.6));
      p.drawArc(new Rect(cx - ra, cy - ra, 2 * ra, 2 * ra), Math.trunc(16 * d0), Math.trunc(16 * this.avance_actuelle()));
      p.setPen(dessin.stylo('arc1', 0.9, 0.7, true));
      p.drawLineP(new Pt(cx, cy), pt(r1, a1));
      p.drawLineP(new Pt(cx, cy), pt(r2, a2));
      if (this.c_fantome.isChecked()) {
        const g = pt(r2, a2 + b.n2 * b.t);
        p.setPen(dessin.stylo(COULEURS[cible]!, 1.4, 0.9, true));
        p.setBrush(null);
        p.drawEllipse(g.x, g.y, 7.0, 7.0);
        dessin.texte(p, g.x, g.y - 16, tr('anim_hohmann_fantome_m'), 'doux', { fond: true });
      }
    }
    if (soleil) {
      const q = pt(r1, a1);
      dessin.disque(p, q.x, q.y, 6.0, 'terre', 'texte');
      dessin.texte(p, q.x, q.y + 15, tr('anim_hohmann_n_terre'), 'doux', { fond: true });
    }
    const q = pt(r2, a2);
    dessin.disque(p, q.x, q.y, 6.0, COULEURS[cible]!, 'texte');
    dessin.texte(p, q.x, q.y - 15, tr('anim_hohmann_n_' + cible), 'texte', { fond: true });
    const [rv, tv] = this.vaisseau();
    const v = pt(rv, tv);
    dessin.disque(p, v.x, v.y, 4.0, 'accent1', 'texte');
    const k = (0.6 * Math.min(r.w, r.h)) / Math.max(1e-9, Math.max(Math.abs(b.dv1), Math.abs(b.dv2)) * 6.0);
    if (etape !== 'attente') this.poussee(p, pt(r1, this.theta_depart), this.theta_depart, b.dv1 * k, 'Δv₁');
    if (etape === 'arrive') {
      const ta = this.theta_depart + Math.PI;
      this.poussee(p, pt(r2, ta), ta, b.dv2 * k, 'Δv₂');
    }
  }

  private poussee(p: Peintre, q: Pt, th: number, longueur: number, nom: string): void {
    const dx = -Math.sin(th),
      dy = -Math.cos(th);
    const lg = Math.max(12.0, Math.abs(longueur)) * (longueur >= 0 ? 1 : -1);
    dessin.fleche(p, q.x, q.y, q.x + lg * dx, q.y + lg * dy, dessin.stylo('accent3', 2.2), 8);
    dessin.texte(p, q.x + lg * dx + 12, q.y + lg * dy - 10, nom, 'accent3', { fond: true });
  }

  private vitesses(p: Peintre, r: Rect): void {
    const b = this.donnees()[7];
    const lignes: [string, number, string][] = [
      ['anim_hohmann_b_v1', b.v1, 'accent2'], ['anim_hohmann_b_vd', b.vd, 'accent1'], ['anim_hohmann_b_va', b.va, 'accent1'], ['anim_hohmann_b_v2', b.v2, 'accent3'],
    ];
    const vmax = Math.max(...lignes.map((l) => l[1])) * 1.08;
    const h = r.h / (lignes.length + 1.2);
    const x0 = r.x + 8,
      larg = r.w - 16;
    lignes.forEach(([cle, v, col], k) => {
      const y = r.y + 6 + k * h;
      dessin.texte(p, x0, y + 9, tr(cle), 'doux', { centre: false });
      p.setPen(null);
      p.setBrush(dessin.c(col, 0.85));
      p.drawRoundedRect(new Rect(x0, y + 20, (larg * v) / vmax, Math.max(8.0, h * 0.32)), 3, 3);
      dessin.texte(p, x0 + 4, y + 20 + Math.max(8.0, h * 0.32) + 11, `${nombre(v, 2)} km·s⁻¹`, 'texte', { centre: false });
    });
    dessin.texte(p, x0, r.bottom - 12, tr('anim_hohmann_total', { dv: nombre(b.dv, 2) }), 'accent3', { centre: false });
  }
}
