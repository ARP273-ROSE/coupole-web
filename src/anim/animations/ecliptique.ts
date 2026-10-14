/**
 * Ecliptic Simulator : carte du ciel (ascension droite, déclinaison) avec l'équateur céleste et l'écliptique,
 * tan δ = tan ε sin α ; le Soleil la parcourt au fil de l'année, entre une date de début et une date de fin.  Vue
 * depuis l'intérieur de la sphère (α croît vers la gauche, l'est) ou depuis l'extérieur.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, type Rect } from '../../noyau/peintre';
import { linspace, pmod } from '../../noyau/py';
import { Animation, angle, type Choix, date_du_jour, heures_minutes, jour_de_date, type Reglage } from '../base';

const ANNEE = 2026;

/** Déclinaison du point de l'écliptique d'ascension droite α : tan δ = tan ε sin α. */
export function dec_ecliptique(ra_deg: number, eps: number): number {
  return (Math.atan(Math.tan((eps * Math.PI) / 180) * Math.sin((ra_deg * Math.PI) / 180)) * 180) / Math.PI;
}

export class Ecliptique extends Animation {
  static override ID = 'seasonsim';
  static JOURS_PAR_S = 30.0;

  jour!: Reglage;
  m_debut!: Choix;
  j_debut!: Reglage;
  m_fin!: Choix;
  j_fin!: Reglage;
  cote!: Choix;

  override construire(): void {
    this.jour = this.curseur('jour', 0.0, 364.0, 79.0, { dec: 0, cle_texte: 'anim_c_jour' });
    const mois: [string, number][] = [];
    for (let m = 1; m <= 12; m++) mois.push([`anim_mois_${m}`, m]);
    this.m_debut = this.choix('mois_debut', mois, 3);
    this.j_debut = this.curseur('jour_debut', 1, 31, 21, { dec: 0 });
    this.m_fin = this.choix('mois_fin', mois, 3);
    this.j_fin = this.curseur('jour_fin', 1, 31, 20, { dec: 0 });
    this.cote = this.choix('cote', [['anim_seasonsim_dedans', 'dedans'], ['anim_seasonsim_dehors', 'dehors']], 'dedans');
    this.bouton('anim_seasonsim_aller_debut', () => this.aller_debut());
  }

  private debut(): number {
    const m = this.m_debut.currentData() as number;
    return jour_de_date(m, Math.min(Math.trunc(this.j_debut.value()), m === 2 ? 28 : 31));
  }

  private fin(): number {
    const m = this.m_fin.currentData() as number;
    return jour_de_date(m, Math.min(Math.trunc(this.j_fin.value()), m === 2 ? 28 : 31));
  }

  aller_debut(): void {
    this.jour.setValue(this.debut());
  }

  override basculer_lecture(): void {
    if (!this.en_lecture && Math.abs(this.jour.value() - this.fin()) < 0.5) this.aller_debut();
    super.basculer_lecture();
  }

  /** Le Soleil avance jusqu'à la date de fin, puis l'animation s'arrête (comme l'original). */
  override avancer(dt: number): void {
    const j = this.jour.value(),
      fin = this.fin();
    const reste = pmod(fin - j, 365.0);
    const pas = dt * Ecliptique.JOURS_PAR_S;
    if (pas >= reste) {
      this.jour.setValue(fin);
      this.basculer_lecture();
      return;
    }
    this.jour.setValue(pmod(j + pas, 365.0));
  }

  override valeurs(): [string, string][] {
    const s = astro.soleil_jour(ANNEE, this.jour.value() + 0.5);
    return [
      [tr('anim_c_date'), date_du_jour(this.jour.value())],
      [tr('anim_c_ra'), heures_minutes(s.alpha / 15)],
      [tr('anim_c_dec'), angle(s.delta)],
      [tr('anim_seasonsim_lambda'), angle(s.lambda)],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const eps = astro.obliquite_moyenne(astro.jj_jour_de_l_annee(ANNEE, 0));
    const r = rect.adjusted(52, 30, -18, -40);
    const dedans = this.cote.currentData() === 'dedans';
    const x_de = (ra_deg: number): number => {
      const t = pmod(ra_deg, 360.0) / 360.0;
      return dedans ? r.right - t * r.w : r.x + t * r.w;
    };
    const y_de = (dec: number): number => r.cy - ((dec / 90.0) * r.h) / 2;

    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(dessin.c('sphere', 0.25));
    p.drawRect(r);
    dessin.police(p, 0.8);
    for (let h = 0; h < 25; h += 3) {
      const x = h < 24 ? x_de(15 * h) : dedans ? r.x : r.right;
      p.setPen(dessin.stylo('grille', 0.8, 0.7));
      p.drawLine(x, r.y, x, r.bottom);
      dessin.texte(p, x, r.bottom + 12, `${h} h`, 'doux');
    }
    for (let d = -90; d < 91; d += 30) {
      const y = y_de(d);
      p.setPen(dessin.stylo('grille', 0.8, 0.7));
      p.drawLine(r.x, y, r.right, y);
      dessin.texte(p, r.x - 26, y, angle(d, 0), 'doux');
    }
    dessin.police(p, 1 / 0.8);
    p.setPen(dessin.stylo('equateur', 2.0));
    p.drawLine(r.x, y_de(0), r.right, y_de(0));
    const pts: Pt[] = [];
    for (const a of linspace(0, 360, 361)) pts.push(new Pt(a < 360 ? x_de(a) : dedans ? r.x : r.right, y_de(dec_ecliptique(a, eps))));
    p.setPen(dessin.stylo('ecliptique', 2.2));
    p.drawPolyline(pts);
    const debut = this.debut(),
      j = this.jour.value();
    const n = Math.trunc(pmod(j - debut, 365));
    if (n > 0) {
      const seg: [number, number][] = [];
      for (let k = 0; k <= n; k++) {
        const s = astro.soleil_jour(ANNEE, debut + k + 0.5);
        seg.push([s.alpha, s.delta]);
      }
      p.setPen(dessin.stylo('soleil', 3.0, 0.7));
      for (let k = 0; k < seg.length - 1; k++) {
        const [a0, d0] = seg[k]!;
        const [a1, d1] = seg[k + 1]!;
        if (Math.abs(a1 - a0) < 180) p.drawLine(x_de(a0), y_de(d0), x_de(a1), y_de(d1));
      }
    }
    const s = astro.soleil_jour(ANNEE, j + 0.5);
    dessin.disque(p, x_de(s.alpha), y_de(s.delta), 9, 'soleil');
    dessin.texte(p, r.cx, r.y - 14, tr(dedans ? 'anim_seasonsim_titre_dedans' : 'anim_seasonsim_titre_dehors'), 'doux');
    dessin.police(p, 0.8);
    for (const [cle, lam] of [['anim_seasonsim_pv', 0.0], ['anim_seasonsim_se', 90.0], ['anim_seasonsim_pa', 180.0], ['anim_seasonsim_sh', 270.0]] as [string, number][]) {
      const [a, d] = astro.ecliptique_vers_equatorial(lam, 0.0, eps);
      const w = p.fontMetrics().horizontalAdvance(tr(cle)) / 2 + 4;
      const x = Math.min(Math.max(x_de(a), r.x + w), r.right - w);
      dessin.texte(p, x, y_de(d) + (d >= 0 ? 16 : -16), tr(cle), 'ecliptique', { fond: true });
    }
    dessin.police(p, 1 / 0.8);
  }
}
