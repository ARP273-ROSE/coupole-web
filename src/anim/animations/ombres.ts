/**
 * Eclipse Shadow Simulator : Terre et Lune à déplacer à la souris, avec leurs cônes d'ombre et de pénombre, tracés
 * par les tangentes communes au Soleil et au corps (géométrie de l'original).  Le type d'éclipse produit est indiqué.
 * Un encart donne les proportions réelles d'une éclipse centrale de Lune (méthode d'Aristarque).
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { Animation, type Bouton_souris, type Coche, duree_hm, nombre } from '../base';

const R_SOLEIL = 60.0,
  R_TERRE = 22.0,
  R_LUNE = 9.0;

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
  private rect: Rect | null = null;

  override construire(): void {
    this.terre = null;
    this.lune = null;
    this.c_reel = this.coche('reel', true);
    this.rect = null;
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
    const sx = (r.x + R_SOLEIL * 0.4 - r.x) / r.w;
    x = Math.max(sx + (R_SOLEIL + 30) / r.w, Math.min(0.98, x));
    y = Math.max(0.02, Math.min(0.98, y));
    this[nom] = [x, y];
  }

  private eclipses(): [string, string] {
    const r = this.rect;
    if (r === null) return ['', ''];
    const [t, lu] = this.positions(r);
    const sx = r.x + R_SOLEIL * 0.4,
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
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const reel = this.c_reel.isChecked();
    const principal = new Rect(rect.x, rect.y, rect.w, rect.h * (reel ? 0.72 : 1.0));
    this.rect = principal;
    const [t, lu] = this.positions(principal);
    const sx = principal.x + R_SOLEIL * 0.4,
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
    if (reel) this.aristarque(p, new Rect(rect.x, principal.bottom, rect.w, rect.h - principal.h));
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
