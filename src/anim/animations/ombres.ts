/**
 * Eclipse Shadow Simulator : Terre et Lune à déplacer à la souris, avec leurs cônes d'ombre et de pénombre, tracés
 * par les tangentes communes au Soleil et au corps (géométrie de l'original).  Le type d'éclipse produit est indiqué.
 * Un encart donne les proportions réelles d'une éclipse centrale de Lune (méthode d'Aristarque).
 */
import * as astro from '../../calc/astro';
import { langue, tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { Animation, type Bouton_souris, type Choix, type Coche, duree_hm, nombre, type Reglage } from '../base';
import { ECLIPSES_LUNE, ECLIPSES_SOLEIL, type Eclipse, format_duree, verifier } from './table_eclipses';

const R_SOLEIL = 60.0,
  R_TERRE = 22.0,
  R_LUNE = 9.0;
/** Marge à gauche du Soleil : il est dessiné en entier. */
const MARGE_SOLEIL = 8.0;
const INCLINAISON_LUNE = 5.145;

/** Date d'une éclipse de la table, dans la langue courante. */
function date_eclipse(e: Eclipse): string {
  const d = new Date(Date.UTC(e[0], e[1] - 1, e[2]));
  return d.toLocaleDateString(langue() === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export interface Rejeu {
  solaire: boolean;
  e: Eclipse;
  /** écart (km) entre le centre de la Lune (ou l'axe de son ombre) et l'axe de l'ombre (ou le centre de la Terre), nord > 0 */
  y_km: number;
  /** pente de la trajectoire (vers le nord si > 0) */
  pente: number;
  ru_km: number;
  rp_km: number;
  /** demi-longueur du trajet montré (km) */
  demi_km: number;
}

/**
 * Géométrie d'une éclipse de la table, en proportions réelles.  L'écart à l'axe vient de l'argument de latitude moyen
 * de la Lune (Meeus) : y = D sin(5,145°) sin F ; il est ramené dans le domaine compatible avec le type de la table
 * (les éléments moyens ne sont qu'approchés).
 */
export function rejeu(cle: string): Rejeu | null {
  const solaire = cle[0] === 'S';
  const e = (solaire ? ECLIPSES_SOLEIL : ECLIPSES_LUNE)[Number(cle.slice(1))];
  if (!e) return null;
  const v = verifier(e, solaire);
  const sinF = Math.sin((v.F * Math.PI) / 180);
  let y = astro.D_LUNE_KM * Math.sin((INCLINAISON_LUNE * Math.PI) / 180) * sinF;
  const cosF = Math.cos((v.F * Math.PI) / 180);
  const pente = Math.tan((INCLINAISON_LUNE * Math.PI) / 180) * (cosF >= 0 ? 1 : -1) * 0.92;
  const RL = astro.R_LUNE_KM,
    RT = astro.R_TERRE_KM;
  let ru: number, rp: number;
  const borne = (a: number, b: number): void => {
    const s = y >= 0 ? 1 : -1;
    y = s * Math.max(a, Math.min(b, Math.abs(y)));
  };
  const type = e[3];
  if (!solaire) {
    const o = astro.eclipse_de_lune();
    ru = o.rayon_ombre_km!;
    rp = o.rayon_penombre_km!;
    if (type === 'total') borne(0, (ru - RL) * 0.9);
    else if (type === 'partial') borne(ru - RL + 150, ru + RL - 150);
    else borne(ru + RL + 150, rp + RL - 150);
    return { solaire, e, y_km: y, pente, ru_km: ru, rp_km: rp, demi_km: (rp + RL) * 1.08 };
  }
  const c = astro.cones_ombre(astro.R_SOLEIL_KM, RL, astro.UA_KM);
  const x = astro.D_LUNE_KM - RT;
  rp = c.rayon_penombre(x);
  // l'ombre (totale) ou l'anti-ombre (annulaire) : son rayon dépend de la distance de la Lune, qui varie de ±5 %
  ru = type === 'total' ? 70 : type === 'hybrid' ? 15 : -90;
  if (type === 'partial') borne(RT + 200, RT + rp - 200);
  else borne(0, RT * 0.95);
  return { solaire, e, y_km: y, pente, ru_km: ru, rp_km: rp, demi_km: (RT + rp) * 1.12 };
}

/** Points des cônes d'ombre et de pénombre d'un disque (ox, oy, r_objet) éclairé par (sx, sy, r_source). */
export function geometrie(sx: number, sy: number, ox: number, oy: number, r_source: number, r_objet: number, loin = 3000.0) {
  const d = Math.hypot(ox - sx, oy - sy);
  const ang = Math.atan2(oy - sy, ox - sx);
  const ca = Math.cos(ang),
    sa = Math.sin(ang);
  const rep = (x: number, y: number): Pt => new Pt(sx + ca * x - sa * y, sy + sa * x + ca * y);
  const s_a = Math.min(0.999, (r_source + r_objet) / d);
  const a = Math.asin(s_a);
  const x2 = d - r_objet * s_a,
    y2 = r_objet * Math.cos(a);
  const x3 = r_source / s_a;
  const x4 = loin,
    y4 = (loin - x3) * Math.tan(a);
  const s_b = (r_source - r_objet) / d;
  const b = Math.asin(s_b);
  const x6 = d + r_objet * s_b,
    y6 = r_objet * Math.cos(b);
  const x7 = d + r_objet / s_b;
  const y8 = (loin - x7) * Math.tan(b);
  return {
    penombre: [rep(x2, y2), rep(x4, y4), rep(x4, -y4), rep(x2, -y2)],
    ombre: [rep(x6, y6), rep(x7, 0), rep(x6, -y6)],
    antiombre: [rep(x7, 0), rep(loin, y8), rep(loin, -y8)],
    axe: [ca, sa],
    d,
    sommet: x7 - d,
    k_ombre: s_b,
    k_penombre: (r_source + r_objet) / d,
  };
}

/** Ombre portée par l'objet sur la cible : 'totale', 'annulaire', 'partielle', 'penombre' ou ''. */
export function type_eclipse(sx: number, sy: number, ox: number, oy: number, r_objet: number, cx: number, cy: number, r_cible: number): string {
  const d = Math.hypot(ox - sx, oy - sy);
  const ux = (ox - sx) / d,
    uy = (oy - sy) / d;
  const x = (cx - ox) * ux + (cy - oy) * uy;
  if (x <= 0) return '';
  const dist = Math.abs(-(cx - ox) * uy + (cy - oy) * ux);
  const k_u = (R_SOLEIL - r_objet) / d;
  const k_p = (R_SOLEIL + r_objet) / d;
  const ru = r_objet - x * k_u;
  const rp = r_objet + x * k_p;
  if (dist - r_cible >= rp) return '';
  if (ru > 0) {
    if (dist + r_cible <= ru) return 'totale';
    if (dist - r_cible < ru) return 'partielle';
    return 'penombre';
  }
  if (dist < -ru - r_cible) return 'annulaire';
  return dist - r_cible < -ru ? 'partielle' : 'penombre';
}

export class OmbresEclipse extends Animation {
  static override ID = 'shadowsim';
  static override ANIMEE = false;

  terre: [number, number] | null = null;
  lune: [number, number] | null = null;
  c_reel!: Coche;
  rejouer!: Choix;
  instant!: Reglage;
  private rect: Rect | null = null;

  override construire(): void {
    this.terre = null;
    this.lune = null;
    this.c_reel = this.coche('reel', true);
    const options: [string, string][] = [['anim_shadowsim_libre', 'libre']];
    const toutes: [Eclipse, string, boolean][] = [
      ...ECLIPSES_SOLEIL.map((e, i) => [e, 'S' + i, true] as [Eclipse, string, boolean]),
      ...ECLIPSES_LUNE.map((e, i) => [e, 'L' + i, false] as [Eclipse, string, boolean]),
    ];
    toutes.sort((a, b) => a[0][0] - b[0][0] || a[0][1] - b[0][1] || a[0][2] - b[0][2]);
    for (const [e, cle, sol] of toutes)
      options.push([`${date_eclipse(e)} · ${tr(sol ? 'anim_shadowsim_soleil' : 'anim_shadowsim_lune_t')}, ${tr('anim_eclipsetable_t_' + e[3])}`, cle]);
    this.rejouer = this.choix('rejouer', options, 'libre');
    this.instant = this.curseur('instant', -1.0, 1.0, 0.0, { dec: 2 });
    this.instant.setVisible(false);
    this.rejouer.currentIndexChanged.connect(() => {
      this.instant.setVisible(this.rejouer.currentData() !== 'libre');
      this.instant.setValue(0.0);
    });
    this.rect = null;
  }

  rejeu(): Rejeu | null {
    const k = this.rejouer.currentData() as string;
    return k === 'libre' ? null : rejeu(k);
  }

  override etat_initial(): void {
    this.terre = null;
    this.lune = null;
  }

  private positions(rect: Rect): [Pt, Pt] {
    if (this.terre === null) {
      this.terre = [0.55, 0.5];
      this.lune = [0.8, 0.5];
    }
    const t = new Pt(rect.x + this.terre[0] * rect.w, rect.y + this.terre[1] * rect.h);
    const lu = new Pt(rect.x + this.lune![0] * rect.w, rect.y + this.lune![1] * rect.h);
    return [t, lu];
  }

  override presser(pos: Pt, _bouton: Bouton_souris): boolean {
    if (this.rect === null) return false;
    const [t, lu] = this.positions(this.rect);
    for (const [nom, q, r] of [['lune', lu, R_LUNE], ['terre', t, R_TERRE]] as ['lune' | 'terre', Pt, number][]) {
      if (Math.hypot(pos.x - q.x, pos.y - q.y) <= r + 6) {
        this._glisse = (pp) => this.tirer(nom, pp);
        return true;
      }
    }
    return false;
  }

  private tirer(nom: 'lune' | 'terre', pos: Pt): void {
    const r = this.rect!;
    let x = (pos.x - r.x) / r.w;
    let y = (pos.y - r.y) / r.h;
    const sx = (R_SOLEIL + MARGE_SOLEIL) / r.w;
    x = Math.max(sx + (R_SOLEIL + 30) / r.w, Math.min(0.98, x));
    y = Math.max(0.02, Math.min(0.98, y));
    this[nom] = [x, y];
  }

  private eclipses(): [string, string] {
    const r = this.rect;
    if (r === null) return ['', ''];
    const [t, lu] = this.positions(r);
    const sx = r.x + R_SOLEIL + MARGE_SOLEIL,
      sy = r.cy;
    const lunaire = type_eclipse(sx, sy, t.x, t.y, R_TERRE, lu.x, lu.y, R_LUNE);
    const solaire = type_eclipse(sx, sy, lu.x, lu.y, R_LUNE, t.x, t.y, R_TERRE);
    return [lunaire, solaire];
  }

  override valeurs(): [string, string][] {
    const [lunaire, solaire] = this.eclipses();
    const e = astro.eclipse_de_lune();
    const out: [string, string][] = [
      [tr('anim_shadowsim_lunaire'), tr('anim_shadowsim_' + (lunaire || 'aucune'))],
      [tr('anim_shadowsim_solaire'), tr('anim_shadowsim_' + (solaire || 'aucune'))],
    ];
    if (this.c_reel.isChecked())
      out.push(
        [tr('anim_shadowsim_rayon_ombre'), `${nombre(e.rayon_ombre_km!, 0)} km (${nombre(e.ombre_en_diametres_lunaires!, 2)} × ${tr('anim_shadowsim_diam_lune')})`],
        [tr('anim_shadowsim_longueur_ombre'), `${nombre(e.longueur_ombre_km!, 0)} km`],
        [tr('anim_shadowsim_totalite'), duree_hm(e.totalite_h!)],
        [tr('anim_shadowsim_phase_ombre'), duree_hm(e.ombre_totale_h!)],
      );
    const rj = this.rejeu();
    if (rj) {
      out.push(
        [tr('anim_shadowsim_rejouee'), `${date_eclipse(rj.e)} · ${tr(rj.solaire ? 'anim_shadowsim_soleil' : 'anim_shadowsim_lune_t')}, ${tr('anim_eclipsetable_t_' + rj.e[3])}`],
        [tr('anim_eclipsetable_grandeur'), nombre(rj.e[5], 3)],
        [tr('anim_eclipsetable_duree'), format_duree(rj.e[6])],
        [tr('anim_shadowsim_ecart'), `${nombre(Math.abs(rj.y_km), 0)} km ${tr(rj.y_km >= 0 ? 'anim_pc_n' : 'anim_pc_s')}`],
      );
    }
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const rj = this.rejeu();
    const reel = this.c_reel.isChecked() || rj !== null;
    const principal = new Rect(rect.x, rect.y, rect.w, rect.h * (reel ? 0.72 : 1.0));
    this.rect = principal;
    const [t, lu] = this.positions(principal);
    const sx = principal.x + R_SOLEIL + MARGE_SOLEIL,
      sy = principal.cy;
    p.save();
    p.setClipRect(principal);
    for (const [ox, oy, r] of [[t.x, t.y, R_TERRE], [lu.x, lu.y, R_LUNE]] as [number, number, number][]) {
      const g = geometrie(sx, sy, ox, oy, R_SOLEIL, r);
      p.setPen(dessin.stylo('grille', 0.8, 0.6));
      p.setBrush(dessin.c('penombre', 0.22));
      p.drawPolygon(g.penombre);
      p.setBrush(dessin.c('umbra', 0.85));
      p.drawPolygon(g.ombre);
      p.setPen(dessin.stylo('grille', 1.0, 0.8, true));
      const a = g.antiombre;
      p.drawLineP(a[0]!, a[1]!);
      p.drawLineP(a[0]!, a[2]!);
    }
    dessin.disque(p, sx, sy, R_SOLEIL, 'soleil');
    dessin.disque(p, t.x, t.y, R_TERRE, 'terre', 'texte');
    dessin.disque(p, lu.x, lu.y, R_LUNE, 'lune', 'texte');
    p.restore();
    dessin.texte(p, t.x, t.y - R_TERRE - 10, tr('anim_shadowsim_terre'), 'texte', { fond: true });
    dessin.texte(p, lu.x, lu.y - R_LUNE - 10, tr('anim_shadowsim_lune'), 'texte', { fond: true });
    dessin.police(p, 0.85);
    dessin.texte(p, principal.x + 8, principal.bottom - 10, tr('anim_shadowsim_aide_souris'), 'doux', { centre: false });
    dessin.police(p, 1 / 0.85);
    const bas = new Rect(rect.x, principal.bottom, rect.w, rect.h - principal.h);
    if (rj) this.rejouerEclipse(p, bas, rj);
    else if (reel) this.aristarque(p, bas);
  }

  /** L'éclipse choisie dans la table, en proportions réelles ; l'instant fait avancer la Lune ou son ombre. */
  private rejouerEclipse(p: Peintre, r0: Rect, rj: Rejeu): void {
    const r = dessin.cadre(p, r0, tr(rj.solaire ? 'anim_shadowsim_titre_soleil' : 'anim_shadowsim_titre_lune', { date: date_eclipse(rj.e) }));
    const RL = astro.R_LUNE_KM,
      RT = astro.R_TERRE_KM;
    const demi_h = Math.max(rj.rp_km + (rj.solaire ? 0 : RL), RT) * 1.08 + Math.abs(rj.y_km);
    const k = Math.min(r.w / (2 * rj.demi_km), r.h / (2 * demi_h));
    const cx = r.cx,
      cy = r.cy;
    const t = this.instant.value();
    // la Lune va d'ouest en est : vers la gauche dans le ciel (éclipse de Lune), vers l'est sur la carte (de Soleil)
    const sens = rj.solaire ? 1 : -1;
    const pos = (u: number): Pt => new Pt(cx + sens * u * rj.demi_km * k * 0.9, cy - (rj.y_km + rj.pente * u * rj.demi_km * 0.9) * k);
    p.save();
    p.setClipRect(r);
    p.setPen(dessin.stylo('doux', 1.0, 0.7, true));
    p.drawLineP(pos(-1), pos(1));
    dessin.fleche(p, pos(0.82).x, pos(0.82).y, pos(1).x, pos(1).y, dessin.stylo('doux', 1.2, 0.8), 7);
    if (!rj.solaire) {
      dessin.disque(p, cx, cy, rj.rp_km * k, 'penombre', null, 0.25);
      dessin.disque(p, cx, cy, rj.ru_km * k, 'umbra', null, 0.88);
      for (const u of [-1, 1]) {
        const q = pos(u);
        p.setPen(dessin.stylo('lune', 1.0, 0.5));
        p.setBrush(null);
        p.drawEllipse(q.x, q.y, RL * k, RL * k);
      }
      const q = pos(t);
      dessin.disque(p, q.x, q.y, RL * k, 'lune', 'texte');
      // la partie de la Lune dans l'ombre
      p.save();
      const ch = new Path2D();
      ch.ellipse(q.x, q.y, RL * k, RL * k, 0, 0, 2 * Math.PI);
      p.setClipPath(ch);
      dessin.disque(p, cx, cy, rj.ru_km * k, 'arc2', null, 0.55);
      p.restore();
    } else {
      dessin.disque(p, cx, cy, RT * k, 'terre', 'texte');
      const q = pos(t);
      p.save();
      const ch = new Path2D();
      ch.ellipse(cx, cy, RT * k, RT * k, 0, 0, 2 * Math.PI);
      p.setClipPath(ch);
      dessin.disque(p, q.x, q.y, rj.rp_km * k, 'umbra', null, 0.35);
      if (rj.ru_km > 0) dessin.disque(p, q.x, q.y, Math.max(2.5, rj.ru_km * k), 'umbra', null, 0.95);
      p.restore();
      p.setPen(dessin.stylo('penombre', 1.0, 0.8, true));
      p.setBrush(null);
      p.drawEllipse(q.x, q.y, rj.rp_km * k, rj.rp_km * k);
      if (rj.ru_km < 0) {
        p.setPen(dessin.stylo('accent1', 1.4));
        p.drawEllipse(q.x, q.y, Math.max(3, -rj.ru_km * k), Math.max(3, -rj.ru_km * k));
      }
    }
    p.restore();
    dessin.police(p, 0.85);
    dessin.texte(p, r.left + 4, r.bottom - 4, tr('anim_shadowsim_note'), 'doux', { centre: false });
    dessin.texte(p, r.right - 14, r.top + 12, tr('anim_pc_n') + ' ↑', 'doux');
    dessin.police(p, 1 / 0.85);
  }

  /** Traversée centrale de l'ombre de la Terre par la Lune, proportions réelles. */
  private aristarque(p: Peintre, r0: Rect): void {
    const r = dessin.cadre(p, r0, tr('anim_shadowsim_titre_reel'));
    const e = astro.eclipse_de_lune();
    const rp = e.rayon_penombre_km!,
      ru = e.rayon_ombre_km!;
    const k = Math.min((r.h * 0.42) / rp, (r.w * 0.2) / rp);
    const cx = r.x + r.w * 0.35,
      cy = r.cy;
    dessin.disque(p, cx, cy, rp * k, 'penombre', null, 0.25);
    dessin.disque(p, cx, cy, ru * k, 'umbra', null, 0.9);
    const rl = astro.R_LUNE_KM * k;
    for (const dx of [-(ru + astro.R_LUNE_KM), -(ru - astro.R_LUNE_KM), 0.0, ru - astro.R_LUNE_KM, ru + astro.R_LUNE_KM]) {
      p.setPen(dessin.stylo('lune', 1.2));
      p.setBrush(dessin.c('lune', 0.15));
      p.drawEllipse(cx + dx * k, cy, rl, rl);
    }
    const x = r.x + r.w * 0.62;
    dessin.texte(p, x, r.y + 14, tr('anim_shadowsim_rapport', { x: nombre(e.ombre_en_diametres_lunaires!, 2) }), 'texte', { centre: false });
    dessin.texte(p, x, r.y + 34, tr('anim_shadowsim_duree_tot', { d: duree_hm(e.totalite_h!) }), 'texte', { centre: false });
  }
}
