/**
 * Earth Orbit Plot : période d'un satellite de la Terre selon le rayon de son orbite (circulaire).  P = 2π √(r³ / GM),
 * v = √(GM / r).  Points remarquables : le « boulet de Newton » au ras du sol, la Station spatiale, les satellites GPS,
 * l'orbite géostationnaire (un jour sidéral) et la Lune.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, type Rect } from '../../noyau/peintre';
import { Animation, type Bouton_souris, type Choix, type Coche, duree_hm, nombre, type Reglage } from '../base';

const R_MIN = 6_378_137.0,
  R_MAX = 450_000_000.0;
const JOUR_SIDERAL_S = astro.jour_sideral_s(astro.ANNEE_SIDERALE_J);
const POINTS: [string, number][] = [['newton', R_MIN], ['iss', 6_798_000.0], ['gps', 26_560_000.0], ['geo', astro.rayon_orbite_terre(JOUR_SIDERAL_S)], ['lune', astro.D_LUNE_KM * 1000.0]];

export function texte_periode(s: number): string {
  if (s < 3 * 3600) return `${nombre(s / 60, 1)} min`;
  if (s < 86_400 * 2) return duree_hm(s / 3600);
  return `${nombre(s / 86_400, 2)} ${tr('anim_u_jours')}`;
}

export class OrbitesTerre extends Animation {
  static override ID = 'earthorbitplot';
  static override ANIMEE = false;

  r!: Reglage;
  choix_point!: Choix;
  c_log!: Coche;
  private graphe: [Rect, number, number] | null = null;

  override construire(): void {
    this.r = this.curseur('r', R_MIN / 1000, R_MAX / 1000, 42_164.0, { dec: 0, unite: 'km', log: true });
    this.choix_point = this.choix('point', [['anim_gravcalc_libre', ''], ...POINTS.map(([k]) => ['anim_earthorbitplot_p_' + k, k] as [string, string])], 'geo');
    this.choix_point.activated.connect(() => this.point());
    this.c_log = this.coche('log', false);
    this.graphe = null;
  }

  private point(): void {
    for (const [k, r] of POINTS) if (k === this.choix_point.currentData()) this.r.setValue(r / 1000.0);
  }

  rayon_m(): number {
    const exact = POINTS.find(([k]) => k === this.choix_point.currentData());
    if (exact && Math.abs(exact[1] / 1000.0 - this.r.value()) < 1.0) return exact[1];
    return this.r.value() * 1000.0;
  }

  override valeurs(): [string, string][] {
    const r = this.rayon_m();
    const out: [string, string][] = [
      [tr('anim_earthorbitplot_rayon'), `${nombre(r / 1000, 0)} km`],
      [tr('anim_earthorbitplot_altitude'), `${nombre((r - R_MIN) / 1000, 0)} km`],
      [tr('anim_earthorbitplot_periode'), texte_periode(astro.periode_orbite_terre(r))],
      [tr('anim_earthorbitplot_vitesse'), `${nombre(astro.vitesse_circulaire(r) / 1000, 3)} km·s⁻¹`],
    ];
    if (this.choix_point.currentData() === 'lune') {
      const gm = astro.GM_TERRE * (1 + astro.MASSE_LUNE_KG / astro.MASSE_TERRE_KG);
      out.push([tr('anim_earthorbitplot_lune_vraie'), texte_periode(astro.periode_orbite_terre(r, gm))]);
    }
    return out;
  }

  override presser(pos: Pt, bouton: Bouton_souris): boolean {
    if (this.graphe !== null && this.graphe[0].contains(pos)) {
      this._glisse = (q) => this.tirer(q);
      this.tirer(pos);
      return true;
    }
    return super.presser(pos, bouton);
  }

  private tirer(pos: Pt): void {
    const [, x0, x1] = this.graphe!;
    const f = Math.max(0.0, Math.min(1.0, (pos.x - x0) / (x1 - x0)));
    this.r.setValue(10 ** (Math.log10(R_MIN) + f * (Math.log10(R_MAX) - Math.log10(R_MIN))) / 1000.0);
    this.choix_point.setCurrentIndex(0);
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const x0 = rect.x + 60,
      x1 = rect.right - 16;
    const y0 = rect.y + 16,
      y1 = rect.bottom - 40;
    this.graphe = [rect.copie(), x0, x1];
    const lr0 = Math.log10(R_MIN),
      lr1 = Math.log10(R_MAX);
    const pmin = astro.periode_orbite_terre(R_MIN),
      pmax = astro.periode_orbite_terre(R_MAX);
    const log_y = this.c_log.isChecked();
    const [ly0, ly1] = log_y ? [Math.log10(pmin) - 0.1, Math.log10(pmax) + 0.1] : [0.0, pmax * 1.05];
    const xy = (r: number, per: number): Pt => {
      const x = x0 + ((x1 - x0) * (Math.log10(r) - lr0)) / (lr1 - lr0);
      const v = log_y ? Math.log10(per) : per;
      return new Pt(x, y1 - ((y1 - y0) * (v - ly0)) / (ly1 - ly0));
    };
    p.setPen(dessin.stylo('grille', 1.0, 0.6));
    dessin.police(p, 0.75);
    for (const r of [6_378e3, 1e7, 2e7, 4e7, 1e8, 2e8, 4e8]) {
      const q = xy(r, pmin);
      p.drawLine(q.x, y0, q.x, y1);
      dessin.texte(p, q.x, y1 + 12, nombre(r / 1000, 0), 'doux');
    }
    for (const j of log_y ? [1 / 24, 1 / 4, 1, 7, 28] : [7, 14, 21, 28, 35]) {
      const q = xy(R_MIN, j * 86_400);
      if (y0 <= q.y && q.y <= y1) {
        p.drawLine(x0, q.y, x1, q.y);
        dessin.texte(p, x0 - 28, q.y, nombre(j, j < 1 ? 2 : 0), 'doux');
      }
    }
    dessin.texte(p, (x0 + x1) / 2, y1 + 28, tr('anim_earthorbitplot_axe_r'), 'doux');
    dessin.texte(p, x0 + 4, y0 - 4, tr('anim_earthorbitplot_axe_p'), 'doux', { centre: false });
    dessin.police(p, 1 / 0.75);
    const pts: Pt[] = [];
    for (let i = 0; i <= 200; i++) {
      const r = 10 ** (lr0 + ((lr1 - lr0) * i) / 200);
      pts.push(xy(r, astro.periode_orbite_terre(r)));
    }
    p.setPen(dessin.stylo('accent2', 2.0));
    p.drawPolyline(pts);
    dessin.police(p, 0.8);
    POINTS.forEach(([k, r], i) => {
      const q = xy(r, astro.periode_orbite_terre(r));
      dessin.disque(p, q.x, q.y, 4, 'accent3');
      const dy = i < 2 ? -10 - 14 * (i % 2) : -10;
      dessin.texte(p, q.x + 6, q.y + dy, tr('anim_earthorbitplot_p_' + k), 'doux', { centre: false, fond: true });
    });
    dessin.police(p, 1 / 0.8);
    const r = this.rayon_m();
    const q = xy(r, astro.periode_orbite_terre(r));
    p.setPen(dessin.stylo('accent1', 1.0, 0.8, true));
    p.drawLine(q.x, y1, q.x, q.y);
    p.drawLine(x0, q.y, q.x, q.y);
    dessin.disque(p, q.x, q.y, 6, 'accent1', 'texte');
  }
}
