/**
 * Full Moon Declination Simulator : la pleine lune est à l'opposé du Soleil, donc près du point de l'écliptique opposé
 * au Soleil, à ±5,1° près.  Sa déclinaison suit à l'envers celle du Soleil : la pleine lune d'hiver monte haut dans le
 * ciel de minuit, celle d'été reste basse.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, type Rect } from '../../noyau/peintre';
import { linspace, pmod } from '../../noyau/py';
import * as scenes from '../../noyau/scenes';
import { appliquerM, type M3, mv } from '../../noyau/vec';
import { Animation, angle, type Bouton_souris, date_du_jour, MOIS_JOURS, type Reglage } from '../base';

const ANNEE = 2026;

interface PleineLune {
  soleil: astro.Soleil;
  eps: number;
  lambda: number;
  dec: number;
  dec_min: number;
  dec_max: number;
  h: number;
  h_min: number;
  h_max: number;
}

export function pleine_lune(jour: number, lat: number): PleineLune {
  const s = astro.soleil_jour(ANNEE, jour);
  const eps = astro.obliquite_moyenne(astro.jj_jour_de_l_annee(ANNEE, jour));
  const lam = pmod(s.lambda + 180.0, 360.0);
  const [, d0] = astro.ecliptique_vers_equatorial(lam, 0.0, eps);
  const ds = [-astro.INCLINAISON_LUNE, astro.INCLINAISON_LUNE].map((b) => astro.ecliptique_vers_equatorial(lam, b, eps)[1]);
  const dmin = Math.min(...ds),
    dmax = Math.max(...ds);
  return {
    soleil: s, eps, lambda: lam, dec: d0, dec_min: dmin, dec_max: dmax,
    h: astro.hauteur_culmination(d0, lat), h_min: astro.hauteur_culmination(dmin, lat), h_max: astro.hauteur_culmination(dmax, lat),
  };
}

export class PleineLuneDeclinaison extends Animation {
  static override ID = 'fullmoondec';
  static JOURS_PAR_S = 12.0;

  vue3d!: dessin.Vue3D;
  jour!: Reglage;
  lat!: Reglage;
  private graphe: [Rect, number, number] | null = null;
  private courbe: [number, PleineLune][] | null = null;

  override construire(): void {
    this.vue3d = this.vue(200.0, 20.0, 7.0, 89.0);
    this.jour = this.curseur('jour', 0.0, 364.0, 45.0, { dec: 0, unite: '', cle_texte: 'anim_c_jour' });
    this.lat = this.curseur('latitude', -90.0, 90.0, 40.8, { dec: 1, unite: '°', cle_texte: 'anim_c_latitude' });
    this.graphe = null;
    this.courbe = null;
  }

  override avancer(dt: number): void {
    this.jour.setValue(pmod(this.jour.value() + dt * PleineLuneDeclinaison.JOURS_PAR_S, 365.0));
  }

  override valeurs(): [string, string][] {
    const f = pleine_lune(this.jour.value(), this.lat.value());
    return [
      [tr('anim_c_date'), date_du_jour(this.jour.value())],
      [tr('anim_fullmoondec_dec_soleil'), angle(f.soleil.delta)],
      [tr('anim_fullmoondec_dec_lune'), `${angle(f.dec_min)} … ${angle(f.dec_max)}`],
      [tr('anim_fullmoondec_hauteur'), `${angle(f.h_min)} … ${angle(f.h_max)}`],
    ];
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
    this.jour.setValue(Math.max(0.0, Math.min(364.0, (365.0 * (pos.x - x0)) / (x1 - x0))));
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones(rect, 2, 0.8);
    this.ciel(p, dessin.cadre(p, z[0]!, tr('anim_fullmoondec_ciel')));
    this.trace(p, dessin.cadre(p, z[1]!, tr('anim_fullmoondec_graphe')));
  }

  private ciel(p: Peintre, r: Rect): void {
    this.zone_rotative(r, this.vue3d);
    const f = pleine_lune(this.jour.value(), this.lat.value());
    const lat = this.lat.value();
    const tsl = pmod(f.soleil.alpha + 180.0, 360.0);
    const m = astro.matrice_equatorial_vers_horizon(tsl, lat);
    const eps = f.eps;
    const c = Math.cos((eps * Math.PI) / 180),
      s_ = Math.sin((eps * Math.PI) / 180);
    const rot: M3 = [[1, 0, 0], [0, c, -s_], [0, s_, c]];
    const bandes = [-astro.INCLINAISON_LUNE, astro.INCLINAISON_LUNE].map((b) => appliquerM(m, appliquerM(rot, dessin.cercle([0, 0, 1], 90.0 - b, 181))));
    const soleil = mv(m, astro.vecteur_equatorial(f.soleil.alpha, f.soleil.delta));
    const [ra_l] = astro.ecliptique_vers_equatorial(f.lambda, 0.0, eps);
    const lune = mv(m, astro.vecteur_equatorial(ra_l, f.dec));
    const scene = (pe: dessin.Peintre3D): void => {
      pe.courbe(appliquerM(m, dessin.cercle([0, 0, 1])), 'equateur', 1.3, 0.8);
      pe.courbe(appliquerM(m, scenes.ecliptique(eps)), 'ecliptique', 1.3, 0.8);
      for (const b of bandes) pe.courbe(b, 'accent3', 1.0, 0.7);
      pe.point(soleil, 'soleil', 8.0, { repere_monde: true });
      pe.point(lune, 'lune', 8.0, { bord: 'doux', repere_monde: true });
    };
    const rr = Math.min(r.w, r.h) * 0.42;
    scenes.sphere_locale(p, this.vue3d, r.cx, r.cy + 6, rr, scene, 'nuit');
  }

  private trace(p: Peintre, r: Rect): void {
    const x0 = r.x + 34,
      x1 = r.right - 6;
    const y0 = r.y + 6,
      y1 = r.bottom - 22;
    this.graphe = [r.copie(), x0, x1];
    const dmax = 35.0;
    const xy = (j: number, d: number): Pt => new Pt(x0 + ((x1 - x0) * j) / 365.0, (y0 + y1) / 2 - (((y1 - y0) / 2) * d) / dmax);
    if (this.courbe === null) this.courbe = linspace(0.0, 365.0, 74).map((j) => [j, pleine_lune(j, 0.0)]);
    const cb = this.courbe;
    p.setPen(null);
    p.setBrush(dessin.c('accent3', 0.22));
    p.drawPolygon([...cb.map(([j, f]) => xy(j, f.dec_max)), ...[...cb].reverse().map(([j, f]) => xy(j, f.dec_min))]);
    p.setPen(dessin.stylo('grille', 1.0));
    for (const d of [-30, -15, 0, 15, 30]) {
      const q = xy(0, d);
      p.drawLine(x0, q.y, x1, q.y);
      dessin.police(p, 0.75);
      dessin.texte(p, x0 - 16, q.y, d ? `${d > 0 ? '+' : ''}${d}°` : '0°', 'doux');
      dessin.police(p, 1 / 0.75);
    }
    p.setPen(dessin.stylo('lune', 1.6));
    p.setBrush(null);
    p.drawPolyline(cb.map(([j, f]) => xy(j, f.dec)));
    p.setPen(dessin.stylo('soleil', 1.2, 0.6, true));
    p.drawPolyline(cb.map(([j, f]) => xy(j, f.soleil.delta)));
    dessin.police(p, 0.75);
    for (let mo = 1; mo < 13; mo += 2) {
      let j = 0;
      for (let i = 0; i < mo - 1; i++) j += MOIS_JOURS[i]!;
      dessin.texte(p, xy(j + 14, 0).x, y1 + 12, tr(`anim_mois_court_${mo}`), 'doux');
    }
    dessin.police(p, 1 / 0.75);
    const j = this.jour.value();
    const f = pleine_lune(j, this.lat.value());
    p.setPen(dessin.stylo('accent1', 1.6));
    p.drawLine(xy(j, 0).x, y0, xy(j, 0).x, y1);
    dessin.disque(p, xy(j, f.dec).x, xy(j, f.dec).y, 4.5, 'lune', 'texte');
  }
}
