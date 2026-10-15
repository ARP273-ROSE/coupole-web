/**
 * Daylight Hours Explorer : durée du jour au fil de l'année pour une latitude.  À gauche, la Terre éclairée et le
 * parallèle de l'observateur partagé en arc de jour et arc de nuit ; à droite, la courbe de la durée du jour avec un
 * point à faire glisser.  Comme l'original : horizon géométrique, cos H₀ = −tan φ tan δ ; en option, le lever au bord
 * supérieur du Soleil avec la réfraction (h₀ = −0,833°).
 */
import { heureSolaire, type Moment } from '../../calc/maintenant';
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { arange, linspace, moyenne, pmod, proundn } from '../../noyau/py';
import { mul, type Pts } from '../../noyau/vec';
import { Animation, angle, type Bouton_souris, type Coche, date_du_jour, duree_hm, nombre, type Reglage } from '../base';

const ANNEE = 2026;
const JOURS_MOIS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/** Jours (0 → 364) et durée du jour (heures) à midi de chaque jour. */
export function courbe_duree(lat: number, h0 = 0.0, pas = 1.0): [number[], number[]] {
  const jours = arange(0.0, 365.0, pas);
  return [jours, jours.map((j) => astro.duree_du_jour_h(astro.soleil_jour(ANNEE, j + 0.5).delta, lat, h0))];
}

export class DureeJour extends Animation {
  static override ID = 'daylighthoursexplorer';
  static JOURS_PAR_S = 30.0;

  globe!: dessin.Vue3D;
  lat!: Reglage;
  jour!: Reglage;
  c_moyenne!: Coche;
  c_curseur!: Coche;
  c_refraction!: Coche;
  private cache: [string, [number[], number[]]] | null = null;
  private trace: Rect | null = null;

  static override TEMPS = ['jour'] as const;
  static override HEURE_SOLAIRE = true;

  /** « Maintenant » : date et heure de l'appareil (calc/maintenant.ts). */
  override maintenant(m: Moment): void {
    const [j, h] = heureSolaire(m.i, m.lon);
    void h;
    this.poser(this.jour, j);
    if (m.lat !== null) this.poser(this.lat, m.lat);
  }

  override construire(): void {
    this.globe = this.vue(60.0, 15.0);
    this.lat = this.curseur('latitude', -90.0, 90.0, 41.0, { dec: 1, unite: '°', cle_texte: 'anim_c_latitude' });
    this.jour = this.curseur('jour', 0.0, 364.0, 120.0, { dec: 0, cle_texte: 'anim_c_jour' });
    this.c_moyenne = this.coche('moyenne', false);
    this.c_curseur = this.coche('point', true);
    this.c_refraction = this.coche('refraction', false);
    this.cache = null;
    this.trace = null;
  }

  override avancer(dt: number): void {
    this.jour.setValue(pmod(this.jour.value() + dt * DureeJour.JOURS_PAR_S, 365.0));
  }

  private h0(): number {
    return this.c_refraction.isChecked() ? -0.833 : 0.0;
  }

  private courbe(): [number[], number[]] {
    const cle = `${proundn(this.lat.value(), 3)}|${this.h0()}`;
    if (this.cache === null || this.cache[0] !== cle) this.cache = [cle, courbe_duree(this.lat.value(), this.h0())];
    return this.cache[1];
  }

  override valeurs(): [string, string][] {
    const d = astro.soleil_jour(ANNEE, this.jour.value() + 0.5).delta;
    const h = astro.duree_du_jour_h(d, this.lat.value(), this.h0());
    const [, durees] = this.courbe();
    return [
      [tr('anim_c_date'), date_du_jour(this.jour.value())],
      [tr('anim_c_dec'), angle(d)],
      [tr('anim_sunmotions_duree'), duree_hm(h)],
      [tr('anim_daylighthoursexplorer_moyenne'), duree_hm(moyenne(durees))],
      [tr('anim_daylighthoursexplorer_extremes'), `${duree_hm(Math.min(...durees))} / ${duree_hm(Math.max(...durees))}`],
    ];
  }

  override presser(pos: Pt, bouton: Bouton_souris): boolean {
    if (this.trace !== null && this.trace.contains(pos)) {
      this._glisse = (q) => this.tirer(q);
      this.tirer(pos);
      return true;
    }
    return super.presser(pos, bouton);
  }

  private tirer(pos: Pt): void {
    const r = this.trace!;
    this.jour.setValue(Math.max(0.0, Math.min(364.0, ((pos.x - r.x) / r.w) * 365.0)));
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones(rect, 2, 0.75);
    this.dessinGlobe(p, dessin.cadre(p, z[0]!, tr('anim_daylighthoursexplorer_vue_globe')));
    this.dessinGraphe(p, dessin.cadre(p, z[1]!, tr('anim_daylighthoursexplorer_vue_courbe')));
  }

  /** Repère équatorial ; le Soleil dans la direction α = 0. */
  private dessinGlobe(p: Peintre, r: Rect): void {
    this.zone_rotative(r, this.globe);
    const rr = Math.min(r.w, r.h) * 0.38;
    const pe = new dessin.Peintre3D(p, this.globe, r.cx, r.cy, rr);
    const d = astro.soleil_jour(ANNEE, this.jour.value() + 0.5).delta;
    const soleil = astro.vecteur_equatorial(0.0, d);
    pe.contour('grille', 'terre', 0.55);
    dessin.hemisphere_nuit(pe, soleil);
    pe.courbe(dessin.cercle([0, 0, 1]), 'equateur', 1.2, 0.8, { arriere: 'cache' });
    const lat = Math.max(-89.5, Math.min(89.5, this.lat.value()));
    const h0 = astro.angle_horaire_lever(d, lat, this.h0());
    const hs = linspace(-180, 180, 241);
    const pts3: Pts = hs.map((h) => astro.vecteur_equatorial(-h, lat));
    const jour = hs.map((h) => Math.abs(h) <= h0);
    for (const [veut, coul, ep] of [[true, 'soleil', 3.0], [false, 'doux', 1.5]] as [boolean, string, number][]) {
      const idx: number[] = [];
      jour.forEach((j, i) => {
        if (j === veut) idx.push(i);
      });
      if (idx.length > 1) {
        let groupe: number[] = [idx[0]!];
        const groupes: number[][] = [];
        for (let k = 1; k < idx.length; k++) {
          if (idx[k]! - idx[k - 1]! > 1) {
            groupes.push(groupe);
            groupe = [];
          }
          groupe.push(idx[k]!);
        }
        groupes.push(groupe);
        for (const g of groupes) pe.courbe(g.map((i) => pts3[i]!), coul, ep, 1.0, { arriere: 'pale' });
      }
    }
    pe.segment([0, 0, 1], [0, 0, 1.18], 'texte', 2.0);
    pe.segment([0, 0, -1], [0, 0, -1.18], 'texte', 2.0);
    pe.etiquette(mul(soleil, 1.25), tr('anim_marsorbit_soleil'), 'soleil');
  }

  private dessinGraphe(p: Peintre, r: Rect): void {
    const [jours, durees] = this.courbe();
    const g = r.adjusted(44, 10, -10, -30);
    this.trace = g.copie();
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(dessin.c('sphere', 0.2));
    p.drawRect(g);
    const xy = (j: number, h: number): Pt => new Pt(g.x + (j / 365.0) * g.w, g.bottom - (h / 24.0) * g.h);
    dessin.police(p, 0.8);
    for (let h = 0; h < 25; h += 6) {
      const q = xy(0, h);
      p.setPen(dessin.stylo('grille', 0.8, 0.6));
      p.drawLineP(q, xy(365, h));
      dessin.texte(p, g.x - 20, q.y, `${h} h`, 'doux');
    }
    JOURS_MOIS.forEach((j, m) => {
      const q = xy(j, 0);
      p.setPen(dessin.stylo('grille', 0.6, 0.4));
      p.drawLineP(q, xy(j, 24));
      dessin.texte(p, xy(j + 15, 0).x, g.bottom + 12, tr(`anim_mois_court_${m + 1}`), 'doux');
    });
    dessin.police(p, 1 / 0.8);
    p.setPen(dessin.stylo('soleil', 2.2));
    p.drawPolyline(jours.map((j, i) => xy(j, durees[i]!)));
    if (this.c_moyenne.isChecked()) {
      const m = moyenne(durees);
      p.setPen(dessin.stylo('accent2', 1.5, null, true));
      p.drawLineP(xy(0, m), xy(365, m));
      dessin.texte(p, g.right - 60, xy(0, m).y - 10, duree_hm(m), 'accent2', { fond: true });
    }
    if (this.c_curseur.isChecked()) {
      const j = this.jour.value();
      const h = astro.duree_du_jour_h(astro.soleil_jour(ANNEE, j + 0.5).delta, this.lat.value(), this.h0());
      const q = xy(j, h);
      p.setPen(dessin.stylo('accent3', 1.0, 0.7, true));
      p.drawLine(q.x, g.bottom, q.x, q.y);
      dessin.disque(p, q.x, q.y, 6, 'accent3', 'fond');
      dessin.texte(p, q.x, q.y - 16, nombre(h, 1) + ' h', 'accent3', { fond: true });
    }
  }
}
