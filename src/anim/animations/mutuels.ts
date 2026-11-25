/**
 * Phénomènes mutuels des satellites galiléens : occultations (vues de la Terre) et éclipses (vues du Soleil) ; disques
 * vus de la Terre avec ombre et pénombre, système vu du nord, courbe de lumière de la paire.  Jumeau de
 * `animations/mutuels.py` de Coupole (calculs : `calc/mutuels.ts`).
 */
import * as mu from '../../calc/mutuels';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, type Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import { Animation, angle, type Choix, nombre, type Reglage } from '../base';

const DUREE_FENETRE_S = 12.0;
const COULEURS: Record<string, string> = { io: 'accent1', europe: 'lune', ganymede: 'ecliptique', callisto: 'meridien' };

type Cache = [string, mu.Rencontre, [number, number][], [number, number, number]];

export class Mutuels extends Animation {
  static override ID = 'mutualevents';
  static override LECTURE_AU_DEPART = true;

  actif!: Choix;
  passif!: Choix;
  genre!: Choix;
  B!: Reglage;
  phase!: Reglage;
  fx!: Reglage;
  t = 0.0;
  private cache_: Cache | null = null;

  override construire(): void {
    const opts = mu.SATELLITES.map((s) => ['anim_mutualevents_s_' + s[0], s[0]] as [string, string]);
    this.actif = this.choix('actif', opts, 'europe');
    this.passif = this.choix('passif', opts, 'io');
    this.genre = this.choix('genre', [['anim_mutualevents_g_occultation', 'occultation'], ['anim_mutualevents_g_eclipse', 'eclipse']], 'occultation');
    this.B = this.curseur('B', 0.0, 1.5, 0.1, { dec: 3, unite: '°' });
    this.phase = this.curseur('phase', 0.0, 11.0, 8.0, { dec: 1, unite: '°' });
    this.fx = this.curseur('fx', -0.95, 0.95, 0.5, { dec: 2 });
    this.t = 0.0;
    this.cache_ = null;
  }

  paire(): [string, string] {
    const a = String(this.actif.currentData());
    let p = String(this.passif.currentData());
    if (a === p) {
      const cles = mu.SATELLITES.map((s) => s[0]);
      p = cles[(cles.indexOf(a) + 1) % cles.length]!;
    }
    return [a, p];
  }

  rencontre(): [mu.Rencontre, [number, number][], [number, number, number]] {
    const [a, p] = this.paire();
    const g = String(this.genre.currentData());
    const cle = [a, p, g, this.B.value(), this.phase.value(), this.fx.value()].join('|');
    if (this.cache_ === null || this.cache_[0] !== cle) {
      const r = new mu.Rencontre(a, p, g, this.B.value(), this.phase.value(), this.fx.value());
      const c = r.courbe();
      this.cache_ = [cle, r, c, mu.resume(c)];
    }
    return [this.cache_[1], this.cache_[2], this.cache_[3]];
  }

  override avancer(dt: number): void {
    const [r] = this.rencontre();
    const T = r.demi_fenetre();
    this.t = pmod(this.t + T + (dt * 2.0 * T) / DUREE_FENETRE_S, 2.0 * T) - T;
  }

  notation(): string {
    const [a, p] = this.paire();
    return `${mu.satellite(a)[1]} ${this.genre.currentData() === 'occultation' ? 'O' : 'E'} ${mu.satellite(p)[1]}`;
  }

  override valeurs(): [string, string][] {
    const [r, , [fmin, , duree]] = this.rencontre();
    const [a, p] = this.paire();
    const T = r.demi_fenetre();
    const t = Math.max(-T, Math.min(T, this.t));
    const phrase = tr('anim_mutualevents_phrase_' + String(this.genre.currentData()), { a: tr('anim_mutualevents_s_' + a), p: tr('anim_mutualevents_s_' + p) });
    let baisse: string, duree_txt: string;
    if (duree > 0.0) {
      baisse = tr('anim_mutualevents_baisse', { pc: nombre(100.0 * (1.0 - fmin), 1), dm: nombre(-2.5 * Math.log10(fmin), 2) });
      duree_txt = tr('anim_mutualevents_min', { n: nombre(duree, 1) });
    } else {
      baisse = tr('anim_mutualevents_rien');
      duree_txt = '—';
    }
    return [
      [tr('anim_mutualevents_v_phenomene'), tr('anim_mutualevents_notation', { n: this.notation(), p: phrase })],
      [tr('anim_mutualevents_v_instant'), tr('anim_mutualevents_min', { n: nombre(t, 1) })],
      [tr('anim_mutualevents_v_eclat'), tr('anim_mutualevents_pc', { x: nombre(100.0 * r.flux(t), 1) })],
      [tr('anim_mutualevents_v_impact'), tr('anim_mutualevents_km', { n: nombre(r.parametre_impact(), 0) })],
      [tr('anim_mutualevents_v_vitesse'), tr('anim_mutualevents_kms', { n: nombre(r.vitesse_relative() / 60.0, 2) })],
      [tr('anim_mutualevents_v_duree'), duree_txt],
      [tr('anim_mutualevents_v_baisse'), baisse],
      [tr('anim_mutualevents_v_blim'), angle(r.b_limite(), 3)],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones_principale(rect, 2, 0.5);
    this.ciel(p, dessin.cadre(p, z[0]!, tr('anim_mutualevents_t_ciel')));
    this.systeme(p, dessin.cadre(p, z[1]!, tr('anim_mutualevents_t_systeme')));
    this.courbe(p, dessin.cadre(p, z[2]!, tr('anim_mutualevents_t_courbe')));
  }

  private ciel(p: Peintre, r: Rect): void {
    const [rc] = this.rencontre();
    const [a, ps] = this.paire();
    const T = rc.demi_fenetre();
    const t = Math.max(-T, Math.min(T, this.t));
    const [Pa, Pp] = rc.positions(t);
    const [xa, ya] = rc.ciel(Pa, 0.0);
    const [xp, yp] = rc.ciel(Pp, 0.0);
    const champ = 3.2 * (rc.ra + rc.rp);
    const k = Math.min(r.w, r.h - 30) / champ;
    const cx = r.cx,
      cy = r.cy + 6;
    p.save();
    p.setClipRect(r);
    const sa: [number, number] = [cx + k * (xa - xp), cy - k * (ya - yp)];
    dessin.astre(p, cx, cy, k * rc.rp, COULEURS[ps]!);
    if (this.genre.currentData() === 'eclipse') {
      const [xas, yas, zas] = rc.ciel(Pa, rc.psi);
      const [xps, yps, zps] = rc.ciel(Pp, rc.psi);
      const ell = zas - zps;
      if (ell > 0.0) {
        const rho = mu.R_SOLEIL / mu.D_JUPITER;
        const ox = cx + k * (xas - xps),
          oy = cy - k * (yas - yps);
        const chemin = new Path2D();
        chemin.ellipse(cx, cy, k * rc.rp, k * rc.rp, 0, 0, 2 * Math.PI);
        p.save();
        p.setClipPath(chemin);
        p.setPen(null);
        p.setBrush(dessin.c('penombre', 0.55));
        p.drawEllipse(ox, oy, k * (rc.ra + ell * rho), k * (rc.ra + ell * rho));
        if (rc.ra > ell * rho) {
          p.setBrush(dessin.c('umbra', 0.85));
          p.drawEllipse(ox, oy, k * (rc.ra - ell * rho), k * (rc.ra - ell * rho));
        }
        p.restore();
      }
    }
    dessin.astre(p, sa[0], sa[1], k * rc.ra, COULEURS[a]!);
    p.restore();
    dessin.etiquette(p, cx, cy - k * rc.rp, tr('anim_mutualevents_s_' + ps));
    dessin.etiquette(p, sa[0], sa[1] - k * rc.ra, tr('anim_mutualevents_s_' + a));
    dessin.texte(p, r.left + 6, r.bottom - 10, tr('anim_mutualevents_legende_ciel'), 'doux', { centre: false, fond: true });
  }

  private systeme(p: Peintre, r: Rect): void {
    const [rc] = this.rencontre();
    const [a, ps] = this.paire();
    const T = rc.demi_fenetre();
    const t = Math.max(-T, Math.min(T, this.t));
    const amax = Math.max(rc.aa, rc.ap) * 1.12;
    const k = Math.min(r.w, r.h - 12) / (2.0 * amax);
    const cx = r.cx,
      cy = r.cy + 4;
    p.save();
    p.setClipRect(r);
    p.setBrush(null);
    for (const rr of [rc.aa, rc.ap]) {
      p.setPen(dessin.stylo('grille', 1.0));
      p.drawEllipse(cx, cy, k * rr, k * rr);
    }
    dessin.astre(p, cx, cy, Math.max(3.0, k * mu.R_JUPITER), 'ecliptique');
    const [Pa, Pp] = rc.positions(t);
    for (const [cle, P] of [[a, Pa], [ps, Pp]] as [string, [number, number]][]) dessin.disque(p, cx + k * P[0], cy - k * P[1], 4.5, COULEURS[cle]!, 'texte');
    const L = (0.92 * Math.min(r.w, r.h)) / 2.0;
    dessin.fleche(p, cx, cy + 0.42 * L, cx, cy + 0.78 * L, dessin.stylo('terre', 1.6), 6.0);
    dessin.etiquette(p, cx, cy + 0.78 * L, tr('anim_mutualevents_terre'), 'terre');
    if (this.genre.currentData() === 'eclipse') {
      const s = Math.sin(rc.psi),
        c = Math.cos(rc.psi);
      const x0 = cx + 0.42 * L * s,
        y0 = cy + 0.42 * L * c;
      dessin.fleche(p, x0, y0, cx + 0.78 * L * s, cy + 0.78 * L * c, dessin.stylo('soleil', 1.6), 6.0);
      dessin.etiquette(p, cx + 0.78 * L * s, cy + 0.78 * L * c, tr('anim_mutualevents_soleil'), 'soleil');
    }
    p.restore();
  }

  private courbe(p: Peintre, r: Rect): void {
    const [rc, c, [fmin]] = this.rencontre();
    const T = rc.demi_fenetre();
    const y0 = Math.max(0.0, Math.min(0.9, fmin - 0.08));
    const ax = new Axes(r, -T, T, y0, 1.03, false, false, [44, 8, 10, 30]).avec(p);
    ax.fond(p, { titre_x: tr('anim_mutualevents_axe_t'), titre_y: tr('anim_mutualevents_axe_f') });
    ax.courbe(c, 'accent1', 1.8);
    const t = Math.max(-T, Math.min(T, this.t));
    ax.verticale(t, 'texte', 1.2, false);
    dessin.disque(p, ax.px(t), ax.py(rc.flux(t)), 4.5, 'accent3', 'texte');
  }
}
