/**
 * Longitude/Latitude Demonstrator : globe interactif, côtes, villes, équateur, méridien d'origine, ligne de
 * changement de date ; un point à déplacer dont la latitude et la longitude s'affichent (décimal ou sexagésimal).
 */
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import type { Peintre, Pt, Rect } from '../../noyau/peintre';
import { copysign, linspace, pd02, pround } from '../../noyau/py';
import { mul, type Pts, type V3 } from '../../noyau/vec';
import { Animation, type Bouton_souris, type Choix, type Coche, nombre, type Reglage } from '../base';

// Villes du simulateur d'origine (latitude, longitude en degrés et minutes)
const VILLES: [string, number, number, number, number][] = [
  ['buenos_aires', -34, 20, -58, 30], ['lima', -12, 6, -76, 55], ['casablanca', 33, 32, -7, 41],
  ['monrovia', 6, 20, -10, 46], ['sao_paulo', -23, 34, -46, 38], ['lincoln', 40, 49, -96, 40],
  ['bagdad', 33, 14, 44, 22], ['greenwich', 51, 40, 0, 0], ['singapour', 1, 22, 103, 45],
  ['la_havane', 23, 8, -82, 23], ['canberra', -35, 18, 149, 8], ['calcutta', 22, 32, 88, 22],
  ['pekin', 39, 55, 116, 23], ['reykjavik', 64, 9, -21, 58], ['mourmansk', 68, 59, 33, 8],
  ['washington', 38, 53, -77, 2], ['barrow', 71, 17, -156, 47], ['moscou', 55, 45, 37, 37],
  ['le_cap', -33, 55, 18, 27], ['mcmurdo', -77, 51, 166, 40],
];

// Ligne de changement de date (tracé simplifié de l'original), (latitude, longitude)
const LIGNE_DATE: [number, number][] = [
  [90, 180], [75, 180], [72, -169], [65.5, -169], [64, -175], [50.5, 167], [48, 180], [2, 180],
  [0, -179], [0, -165], [-3, -165], [-3, -160], [2, -160], [2, -162], [5, -162], [5, -154],
  [-8, -151], [-12, -151], [-12, -157], [-9, -157], [-9, -178], [-15, -175.5], [-44.75, -175.5],
  [-51.5, 180], [-90, 180],
];

let cotesCache: Pts[] | null = null;
let cotesPromesse: Promise<void> | null = null;

/**
 * Côtes (Natural Earth 1:50m simplifié) chargées à la demande, dans leur propre fichier : rend une promesse tenue une
 * fois les côtes prêtes (l'animation se redessine alors).
 */
export function chargerCotes(): Promise<void> {
  cotesPromesse ??= import('../../donnees/genere/cotes.json').then((m) => {
    const doc = (m.default ?? m) as unknown as { polygones: [number, number][][] };
    cotesCache = doc.polygones.map((poly) => poly.map((q) => globe_xyz(q[1], q[0])));
  });
  return cotesPromesse;
}

/** Polygones des côtes → points de la sphère unité ; vide tant qu'ils ne sont pas chargés (voir chargerCotes). */
export function cotes(): Pts[] {
  return cotesCache ?? [];
}

/** Repère terrestre direct : x = (0°, 0°), y = (0°, 90° E), z = pôle Nord. */
export function globe_xyz(lat: number, lon: number): V3 {
  const la = (lat * Math.PI) / 180,
    lo = (lon * Math.PI) / 180;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

export function globe_pts(lats: number[], lons: number[]): Pts {
  return lats.map((la, i) => globe_xyz(la, lons[i]!));
}

/** 43,6047 → « 43° 36′ 17″ N ». */
export function sexagesimal(x: number, positif: string, negatif: string): string {
  const s = x >= 0 ? positif : negatif;
  const a = Math.abs(x);
  let d = Math.trunc(a);
  let m = Math.trunc((a - d) * 60);
  let sec = (a - d - m / 60) * 3600;
  if (sec >= 59.5) {
    sec = 0.0;
    m += 1;
  }
  if (m >= 60) {
    m = 0;
    d += 1;
  }
  return `${d}° ${pd02(m)}′ ${pd02(Math.trunc(pround(sec)))}″ ${s}`;
}

export function decimal(x: number, positif: string, negatif: string): string {
  return `${nombre(Math.abs(x), 2)}° ${x >= 0 ? positif : negatif}`;
}

export class LongitudeLatitude extends Animation {
  static override ID = 'longlat';
  static override ANIMEE = false;

  globe!: dessin.Vue3D;
  lat!: Reglage;
  lon!: Reglage;
  format!: Choix;
  c_reperes!: Coche;
  c_villes!: Coche;
  private zone: dessin.Peintre3D | null = null;

  override construire(): void {
    this.attendre(chargerCotes());
    this.globe = this.vue(75.0, 25.0, -89.0, 89.0);
    this.lat = this.curseur('latitude', -90.0, 90.0, 40.8, { dec: 2, unite: '°', cle_texte: 'anim_c_latitude' });
    this.lon = this.curseur('longitude', -180.0, 180.0, -96.7, { dec: 2, unite: '°', cle_texte: 'anim_c_longitude' });
    this.format = this.choix('format', [['anim_longlat_decimal', 'd'], ['anim_longlat_sexagesimal', 's']], 'd');
    this.c_reperes = this.coche('reperes', true);
    this.c_villes = this.coche('villes', false);
    this.zone = null;
  }

  private textes(): [string, string] {
    const n = tr('anim_pc_n'),
      s = tr('anim_pc_s'),
      e = tr('anim_pc_e'),
      o = tr('anim_pc_o');
    const f = this.format.currentData() === 's' ? sexagesimal : decimal;
    return [f(this.lat.value(), n, s), f(this.lon.value(), e, o)];
  }

  override valeurs(): [string, string][] {
    const [la, lo] = this.textes();
    return [
      [tr('anim_c_latitude'), la],
      [tr('anim_c_longitude'), lo],
    ];
  }

  // ------------------------------------------------------------ souris : déplacer le point ou tourner le globe
  override presser(pos: Pt, bouton: Bouton_souris): boolean {
    const pe = this.zone;
    if (pe === null) return super.presser(pos, bouton);
    const v = pe.depuis_ecran(pos.x, pos.y);
    const point = globe_xyz(this.lat.value(), this.lon.value());
    const { xs, ys, zs } = pe.ecran(point);
    if (v !== null && zs[0]! >= 0 && Math.hypot(pos.x - xs[0]!, pos.y - ys[0]!) < 14) {
      this._glisse = (q) => this.deplacer_point(q);
      return true;
    }
    if (v !== null && bouton === 'droit') {
      this.placer(v);
      return true;
    }
    return super.presser(pos, bouton);
  }

  private placer(v: V3): void {
    this.lat.setValue((Math.asin(Math.max(-1.0, Math.min(1.0, v[2]))) * 180) / Math.PI);
    this.lon.setValue((Math.atan2(v[1], v[0]) * 180) / Math.PI);
  }

  private deplacer_point(pos: Pt): void {
    if (this.zone === null) return;
    const v = this.zone.depuis_ecran(pos.x, pos.y);
    if (v !== null) this.placer(v);
  }

  // ------------------------------------------------------------ dessin
  override dessiner(p: Peintre, rect: Rect): void {
    const r = Math.min(rect.w, rect.h) * 0.42;
    const cx = rect.cx,
      cy = rect.cy + 4;
    const pe = new dessin.Peintre3D(p, this.globe, cx, cy, r);
    this.zone = pe;
    this.zone_rotative(rect, this.globe);
    pe.contour('grille', 'terre', 0.25);
    for (let lat = -60; lat < 90; lat += 30)
      if (lat) pe.courbe(dessin.cercle([0, 0, 1], 90 - lat), 'grille', 0.8, 0.6, { arriere: 'cache' });
    for (let lon = 0; lon < 180; lon += 30)
      pe.courbe(dessin.cercle([Math.sin((lon * Math.PI) / 180), -Math.cos((lon * Math.PI) / 180), 0]), 'grille', 0.8, 0.6, { arriere: 'cache' });
    for (const poly of cotes()) pe.courbe(poly, 'doux', 1.0, 0.9, { arriere: 'cache' });
    if (this.c_reperes.isChecked()) {
      pe.courbe(dessin.cercle([0, 0, 1]), 'equateur', 2.0, 1.0, { arriere: 'cache' });
      pe.courbe(globe_pts(linspace(-90, 90, 91), new Array(91).fill(0)), 'accent1', 2.0, 1.0, { arriere: 'cache' });
      const pts: Pts = [];
      for (let i = 0; i < LIGNE_DATE.length - 1; i++) {
        const [la0, lo0] = LIGNE_DATE[i]!;
        const [la1, lo1] = LIGNE_DATE[i + 1]!;
        pts.push(...dessin.arc(globe_xyz(la0, lo0), globe_xyz(la1, lo1), 12));
      }
      pe.courbe(pts, 'accent1', 1.5, 1.0, { arriere: 'cache' });
      pe.etiquette(mul(globe_xyz(0, -this.globe.az + 25), 1.08), tr('anim_longlat_equateur'), 'equateur');
      pe.etiquette(mul(globe_xyz(45, 0), 1.1), tr('anim_longlat_greenwich'), 'accent1');
      pe.etiquette(mul(globe_xyz(30, 180), 1.1), tr('anim_longlat_ligne_date'), 'accent1');
    }
    if (this.c_villes.isChecked()) {
      for (const [cle, lad, lam, lod, lom] of VILLES) {
        const la = lad + copysign(lam / 60, lad ? lad : 1);
        const lo = lod + copysign(lom / 60, lod ? lod : 1);
        const { xs, ys, zs } = pe.ecran(globe_xyz(la, lo));
        if (zs[0]! > 0.05) {
          dessin.disque(p, xs[0]!, ys[0]!, 3.0, 'accent2');
          dessin.police(p, 0.8);
          dessin.texte(p, xs[0]! + 5, ys[0]! - 3, tr('anim_ville_' + cle), 'doux', { centre: false });
          dessin.police(p, 1 / 0.8);
        }
      }
    }
    // arcs de latitude (le long du méridien du lieu) et de longitude (le long de l'équateur)
    const la = this.lat.value(),
      lo = this.lon.value();
    pe.courbe(globe_pts(linspace(0, la, 60), new Array(60).fill(lo)), 'arc1', 3.0, 1.0, { arriere: 'pale' });
    pe.courbe(globe_pts(new Array(60).fill(0), linspace(0, lo, 60)), 'arc2', 3.0, 1.0, { arriere: 'pale' });
    pe.courbe(globe_pts(new Array(181).fill(la), linspace(-180, 180, 181)), 'grille', 1.0, 0.9, { arriere: 'cache' });
    pe.courbe(globe_pts(linspace(-90, 90, 91), new Array(91).fill(lo)), 'grille', 1.0, 0.9, { arriere: 'cache' });
    const [t_la, t_lo] = this.textes();
    pe.etiquette(mul(globe_xyz(la / 2, lo), 1.02), t_la, 'arc1');
    pe.etiquette(mul(globe_xyz(-6, lo / 2), 1.02), t_lo, 'arc2');
    pe.point(globe_xyz(la, lo), 'soleil', 6.0, { bord: 'fond' });
    dessin.police(p, 0.85);
    dessin.texte(p, rect.x + 8, rect.bottom - 10, tr('anim_longlat_souris'), 'doux', { centre: false });
    dessin.police(p, 1 / 0.85);
  }
}
