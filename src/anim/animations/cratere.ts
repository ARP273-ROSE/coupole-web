/**
 * Cratère d'impact : cavité transitoire qui se creuse puis s'effondre en cratère simple ou complexe (lois d'échelle
 * de Collins, Melosh et Marcus, 2005).  Jumeau de `animations/cratere.py` de Coupole (calculs : `calc/cratere.ts`).
 */
import * as cr from '../../calc/cratere';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, Pt, type Rect } from '../../noyau/peintre';
import { Animation, type Choix, nombre, type Reglage } from '../base';

const DUREE = 6.0;
const EXPOSANTS: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };

export function scientifique(x: number, dec = 2): string {
  if (x >= 0.01 && x < 1e4) return nombre(x, dec);
  let n = Math.floor(Math.log10(x));
  let m = x / 10 ** n;
  if (Number(m.toFixed(dec)) >= 10.0) {
    n += 1;
    m /= 10.0;
  }
  return `${nombre(m, dec)} × 10${String(n).split('').map((c) => EXPOSANTS[c] ?? c).join('')}`;
}

export function longueur(m: number): string {
  if (m < 1000.0) return `${nombre(m, 0)} m`;
  return `${nombre(m / 1000.0, m < 1e4 ? 2 : 1)} km`;
}

export function phases(t: number): [number, number, number] {
  const rampe = (a: number, b: number): number => Math.min(1.0, Math.max(0.0, (t - a) / (b - a)));
  return [rampe(0.0, 1.0), rampe(1.0, 2.2), rampe(2.6, 3.6)];
}

export class Cratere extends Animation {
  static override ID = 'impactcrater';
  static override LECTURE_AU_DEPART = true;

  exemple!: Choix;
  L!: Reglage;
  v!: Reglage;
  theta!: Reglage;
  impacteur!: Choix;
  cible!: Choix;
  t = 0.0;
  private applique: unknown = 'cours';

  override construire(): void {
    this.exemple = this.choix('exemple', [['anim_impactcrater_x_libre', 'libre'], ...cr.EXEMPLES.map(([k]) => ['anim_impactcrater_x_' + k, k] as [string, string])], 'cours');
    this.L = this.curseur('L', 10.0, 20000.0, 1500.0, { dec: 0, unite: 'm', log: true });
    this.v = this.curseur('v', 11.0, 72.0, 20.0, { dec: 1, unite: 'km·s⁻¹' });
    this.theta = this.curseur('theta', 5.0, 90.0, 45.0, { dec: 0, unite: '°' });
    this.impacteur = this.choix('impacteur', cr.IMPACTEURS.map(([k]) => ['anim_impactcrater_i_' + k, k] as [string, string]), 'rocheux');
    this.cible = this.choix('cible', cr.CIBLES.map(([k]) => ['anim_impactcrater_c_' + k, k] as [string, string]), 'sedimentaire');
    this.t = 0.0;
    this.applique = this.exemple.currentData();
  }

  override reglage_change(): void {
    const k = this.exemple?.currentData();
    if (this.exemple && k !== this.applique) {
      this.applique = k;
      for (const [cle, L, v, th, imp, cib] of cr.EXEMPLES) {
        if (cle === k) {
          this.L.setValue(L);
          this.v.setValue(v);
          this.theta.setValue(th);
          this.impacteur.setCurrentIndex(this.impacteur.findData(imp));
          this.cible.setCurrentIndex(this.cible.findData(cib));
        }
      }
      this.t = 0.0;
    }
    super.reglage_change();
  }

  override avancer(dt: number): void {
    this.t = (this.t + dt) % DUREE;
  }

  parametres(): [number, number, number, number, number, number] {
    const rho_i = cr.IMPACTEURS.find(([k]) => k === this.impacteur.currentData())![1];
    const c = cr.CIBLES.find(([k]) => k === this.cible.currentData())!;
    return [this.L.value(), this.v.value() * 1000.0, this.theta.value(), rho_i, c[1], c[2]];
  }

  override valeurs(): [string, string][] {
    const [L, v, th, rho_i, rho_t, k] = this.parametres();
    const c = cr.cratere(L, v, th, rho_i, rho_t, k);
    const e = cr.energie(L, rho_i, v);
    const emt = e / cr.MT_J;
    const out: [string, string][] = [
      [tr('anim_impactcrater_v_masse'), `${scientifique(cr.masse(L, rho_i))} kg`],
      [tr('anim_impactcrater_v_energie'), tr('anim_impactcrater_energie', { j: scientifique(e), mt: scientifique(emt) })],
      [tr('anim_impactcrater_v_transitoire'), `${longueur(c.transitoire)} × ${longueur(c.prof_transitoire)}`],
      [tr('anim_impactcrater_v_final'), longueur(c.final)],
      [tr('anim_impactcrater_v_profondeur'), longueur(c.profondeur)],
      [tr('anim_impactcrater_v_genre'), tr('anim_impactcrater_g_' + c.genre)],
      [tr('anim_impactcrater_v_rapport'), nombre(c.final / L, 1)],
      [tr('anim_impactcrater_v_frequence'), tr('anim_impactcrater_tous', { n: scientifique(cr.recurrence_ans(emt)) })],
    ];
    if (L < 200.0) out.push([tr('anim_impactcrater_v_attention'), tr('anim_impactcrater_atmosphere')]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = rect.w > rect.h * 1.1 ? dessin.zones_principale(rect, 1, 0.6) : dessin.zones(rect, 2, 10);
    this.coupe(p, dessin.cadre(p, z[0]!, tr('anim_impactcrater_t_coupe')));
    this.graphe(p, dessin.cadre(p, z[1]!, tr('anim_impactcrater_t_graphe')));
  }

  private coupe(p: Peintre, r: Rect): void {
    const [L, v, th, rho_i, rho_t, kk] = this.parametres();
    const c = cr.cratere(L, v, th, rho_i, rho_t, kk);
    const [chute, creuse, effondre] = phases(this.t);
    let demi = 0.75 * c.final;
    const k_ = (r.w - 16) / (2.0 * demi);
    const x0 = r.cx;
    const y_sol = r.top + 0.42 * r.h;
    const pt = (x: number, z: number): Pt => new Pt(x0 + k_ * x, y_sol - k_ * z);
    demi = (r.w - 4) / (2.0 * k_);
    const n = 160;
    const R_tc = c.transitoire / 2.0,
      d_tc = c.prof_transitoire;
    const z_transitoire = (x: number, f: number): number => {
      const rr = R_tc * f;
      if (Math.abs(x) >= rr || rr <= 0.0) return 0.0;
      const u = x / rr;
      return -d_tc * f * (1.0 - u * u);
    };
    const prof: [number, number][] = [];
    for (let j = 0; j <= n; j++) {
      const x = -demi + (2.0 * demi * j) / n;
      const zt = z_transitoire(x, creuse ** 0.5);
      const zf = cr.profil(c, x);
      prof.push([x, creuse >= 1.0 ? (1.0 - effondre) * zt + effondre * zf : zt]);
    }
    const bas = r.bottom - 4;
    const poly = [new Pt(pt(prof[0]![0], 0).x, bas), ...prof.map(([x, z]) => pt(x, z)), new Pt(pt(prof[prof.length - 1]![0], 0).x, bas)];
    p.save();
    p.setClipRect(r);
    p.setPen(dessin.stylo('horizon', 1.6));
    p.setBrush(dessin.c('sol', 0.85));
    p.drawPolygon(poly);
    if (creuse >= 1.0 && effondre > 0.0) {
      p.setPen(dessin.stylo('accent3', 1.0, 0.8, true));
      p.setBrush(null);
      const pts: Pt[] = [];
      for (let j = 0; j <= 80; j++) {
        const x = -R_tc + (2 * R_tc * j) / 80;
        pts.push(pt(x, z_transitoire(x, 1.0)));
      }
      for (let j = 0; j + 1 < pts.length; j++) p.drawLine(pts[j]!.x, pts[j]!.y, pts[j + 1]!.x, pts[j + 1]!.y);
    }
    if (chute < 1.0) {
      const s = 1.0 - chute;
      const dist = 0.9 * demi * s;
      const ang = (th * Math.PI) / 180;
      const xi = -dist * Math.cos(ang),
        zi = dist * Math.sin(ang) + L / 2.0;
      dessin.disque(p, x0 + k_ * xi, y_sol - k_ * zi, Math.max(2.5, (k_ * L) / 2.0), 'accent1', 'texte');
    }
    p.restore();
    const y = r.bottom - 14;
    if (creuse >= 1.0 && effondre >= 1.0) {
      const xa = pt(-c.final / 2.0, 0).x,
        xb = pt(c.final / 2.0, 0).x;
      p.setPen(dessin.stylo('accent3', 1.2));
      p.drawLine(xa, y_sol - 16, xb, y_sol - 16);
      dessin.texte(p, (xa + xb) / 2.0, y_sol - 26, tr('anim_impactcrater_cote', { d: longueur(c.final) }), 'accent3', { fond: true });
    }
    dessin.texte(p, r.left + 6, y, tr('anim_impactcrater_echelle'), 'doux', { centre: false, fond: true });
  }

  private graphe(p: Peintre, r: Rect): void {
    const [L, v, th, rho_i, rho_t, k] = this.parametres();
    const ax = new Axes(r, 10.0, 20000.0, 0.1, 1000.0, true, true, [44, 8, 10, 30]).avec(p);
    ax.fond(p, { titre_x: tr('anim_impactcrater_axe_L'), titre_y: tr('anim_impactcrater_axe_D') });
    const pts: [number, number][] = [];
    for (let j = 0; j <= 120; j++) {
      const Lj = 10.0 * 2000.0 ** (j / 120);
      pts.push([Lj, cr.cratere(Lj, v, th, rho_i, rho_t, k).final / 1000.0]);
    }
    ax.courbe(pts, 'accent2', 1.8);
    ax.horizontale(cr.D_C_KM, 'doux', 1.0, true, tr('anim_impactcrater_transition'));
    const c = cr.cratere(L, v, th, rho_i, rho_t, k);
    dessin.disque(p, ax.px(L), ax.py(c.final / 1000.0), 5.0, 'accent3', 'texte');
  }
}
