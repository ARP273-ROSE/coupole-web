/**
 * Union Seasons Demonstrator : l'original montrait un film accéléré de l'ombre d'un bâtiment, photographié à la même
 * heure pendant un an ; ici, une simulation : un bâtiment (pavé) et son ombre portée sur le sol, à la latitude et à
 * l'heure choisies, jour après jour.  La hauteur du Soleil au midi vrai vaut 90° − φ + δ.
 */
import { heureSolaire, type Moment } from '../../calc/maintenant';
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { linspace, pmod } from '../../noyau/py';
import { cross, dot, mul, norme, sub, type V3 } from '../../noyau/vec';
import { Animation, angle, type Coche, date_du_jour, heures_minutes, MOIS_JOURS, nombre, type Reglage } from '../base';

const ANNEE = 2026;
const LARGEUR = 1.6,
  PROFONDEUR = 1.0;
const R = Math.PI / 180;

interface SoleilLocal {
  az: number;
  alt: number;
  dec: number;
  eqt: number;
  heure: number;
}

export function soleil_local(jour: number, heure: number, lat: number, midi_vrai: boolean): SoleilLocal {
  const s = astro.soleil_jour(ANNEE, jour + 0.5);
  if (midi_vrai) heure = 12.0 - s.eqt / 60.0;
  const h_angle = 15.0 * (heure - 12.0) + s.eqt / 4.0;
  const [az, alt] = astro.equatorial_vers_horizon(h_angle, s.delta, lat);
  return { az, alt, dec: s.delta, eqt: s.eqt, heure };
}

/** Enveloppe convexe (chaîne monotone). */
export function enveloppe(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const croix = (o: [number, number], a: [number, number], b: [number, number]): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const bas: [number, number][] = [],
    haut: [number, number][] = [];
  for (const q of p) {
    while (bas.length >= 2 && croix(bas[bas.length - 2]!, bas[bas.length - 1]!, q) <= 0) bas.pop();
    bas.push(q);
  }
  for (const q of [...p].reverse()) {
    while (haut.length >= 2 && croix(haut[haut.length - 2]!, haut[haut.length - 1]!, q) <= 0) haut.pop();
    haut.push(q);
  }
  return [...bas.slice(0, -1), ...haut.slice(0, -1)];
}

/** Polygone (x vers l'est, y vers le nord) de l'ombre du pavé, ou null si le Soleil est couché. */
export function ombre(az: number, alt: number, hauteur = 1.0): [number, number][] | null {
  if (alt <= 0.2) return null;
  const lg = hauteur / Math.tan(alt * R);
  const dx = -lg * Math.sin(az * R),
    dy = -lg * Math.cos(az * R);
  const coins: [number, number][] = [[-LARGEUR / 2, -PROFONDEUR / 2], [LARGEUR / 2, -PROFONDEUR / 2], [LARGEUR / 2, PROFONDEUR / 2], [-LARGEUR / 2, PROFONDEUR / 2]];
  return enveloppe([...coins, ...coins.map(([x, y]) => [x + dx, y + dy] as [number, number])]);
}

export class OmbreBatiment extends Animation {
  static override ID = 'transitmovie';
  static JOURS_PAR_S = 8.0;

  vue3d!: dessin.Vue3D;
  jour!: Reglage;
  heure!: Reglage;
  lat!: Reglage;
  c_midi!: Coche;
  c_trace!: Coche;
  private courbe: [string, number[]] | null = null;

  static override TEMPS = ['jour', 'heure'] as const;
  static override HEURE_SOLAIRE = true;

  /** « Maintenant » : date et heure de l'appareil (calc/maintenant.ts). */
  override maintenant(m: Moment): void {
    const [j, h] = heureSolaire(m.i, m.lon);
    this.poser(this.jour, j);
    this.poser(this.heure, h);
    if (m.lat !== null) this.poser(this.lat, m.lat);
  }

  override construire(): void {
    this.vue3d = this.vue(160.0, 35.0, 5.0, 89.0);
    this.jour = this.curseur('jour', 0.0, 364.0, 282.0, { dec: 0, cle_texte: 'anim_c_jour' });
    this.heure = this.curseur('heure', 6.0, 18.0, 13.0, { dec: 2, unite: 'h', cle_texte: 'anim_c_heure' });
    this.lat = this.curseur('latitude', -66.0, 66.0, 40.8, { dec: 1, unite: '°', cle_texte: 'anim_c_latitude' });
    this.c_midi = this.coche('midi', false);
    this.c_trace = this.coche('trace', true);
    this.courbe = null;
  }

  override avancer(dt: number): void {
    this.jour.setValue(pmod(this.jour.value() + dt * OmbreBatiment.JOURS_PAR_S, 365.0));
  }

  private soleil(jour: number | null = null): SoleilLocal {
    return soleil_local(jour === null ? this.jour.value() : jour, this.heure.value(), this.lat.value(), this.c_midi.isChecked());
  }

  override valeurs(): [string, string][] {
    const s = this.soleil();
    const out: [string, string][] = [
      [tr('anim_c_date'), date_du_jour(this.jour.value())],
      [tr('anim_c_heure'), heures_minutes(s.heure)],
      [tr('anim_transitmovie_dec'), angle(s.dec)],
      [tr('anim_c_hauteur'), angle(s.alt)],
      [tr('anim_c_azimut'), angle(s.az)],
    ];
    if (s.alt > 0.2) out.push([tr('anim_transitmovie_longueur'), nombre(1.0 / Math.tan(s.alt * R), 2)]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const haut = rect.h * 0.74;
    this.scene(p, dessin.cadre(p, new Rect(rect.x, rect.y, rect.w, haut), tr('anim_transitmovie_scene')));
    this.annee(p, dessin.cadre(p, new Rect(rect.x, rect.y + haut, rect.w, rect.h - haut), tr('anim_transitmovie_graphe')));
  }

  private scene(p: Peintre, r: Rect): void {
    this.zone_rotative(r, this.vue3d);
    const v = this.vue3d;
    const cx = r.cx,
      cy = r.cy + r.h * 0.08;
    const k = Math.min(r.w, r.h) * 0.17;
    const s = this.soleil();
    const ecran = (pts: readonly (readonly number[])[]): [Pt[], number[]] => {
      const q: Pt[] = [],
        d: number[] = [];
      for (const a of pts) {
        const [x, y, z] = v.projeter1([a[1]!, -a[0]!, a[2]!]);
        q.push(new Pt(cx + k * x, cy - k * y));
        d.push(z);
      }
      return [q, d];
    };
    const [solPts] = ecran([[-3.2, -3.2, 0], [3.2, -3.2, 0], [3.2, 3.2, 0], [-3.2, 3.2, 0]]);
    p.setPen(dessin.stylo('horizon', 1.0));
    p.setBrush(dessin.c('sol', 0.75));
    p.drawPolygon(solPts);
    for (const [lab, pos] of [['anim_pc_n', [0, 3.6, 0]], ['anim_pc_s', [0, -3.6, 0]], ['anim_pc_e', [3.6, 0, 0]], ['anim_pc_o', [-3.6, 0, 0]]] as [string, V3][]) {
      const [q] = ecran([pos]);
      dessin.texte(p, q[0]!.x, q[0]!.y, tr(lab), 'horizon');
    }
    if (this.c_trace.isChecked()) {
      const pts: V3[] = [];
      for (const h of linspace(4.0, 20.0, 97)) {
        const ss = soleil_local(this.jour.value(), h, this.lat.value(), false);
        if (ss.alt > 3.0) {
          const lg = 1.0 / Math.tan(ss.alt * R);
          const x = LARGEUR / 2 - lg * Math.sin(ss.az * R);
          const y = PROFONDEUR / 2 - lg * Math.cos(ss.az * R);
          if (Math.abs(x) < 3.2 && Math.abs(y) < 3.2) pts.push([x, y, 0.0]);
        }
      }
      if (pts.length > 1) {
        const [q] = ecran(pts);
        p.setPen(dessin.stylo('accent1', 1.2, 0.7, true));
        p.setBrush(null);
        p.drawPolyline(q);
      }
    }
    const poly = ombre(s.az, s.alt);
    if (poly !== null) {
      const [q] = ecran(poly.map(([x, y]) => [x, y, 0.0]));
      p.setPen(null);
      p.setBrush(dessin.c('ombre', 0.45));
      p.drawPolygon(q);
    }
    const lx = LARGEUR / 2,
      ly = PROFONDEUR / 2;
    const b: [number, number][] = [[-lx, -ly], [lx, -ly], [lx, ly], [-lx, ly]];
    const faces: V3[][] = [0, 1, 2, 3].map((i) => [[...b[i]!, 0], [...b[(i + 1) % 4]!, 0], [...b[(i + 1) % 4]!, 1], [...b[i]!, 1]] as V3[]);
    faces.push(b.map((c) => [...c, 1] as V3));
    const soleil_vec: V3 = [Math.sin(s.az * R) * Math.cos(s.alt * R), Math.cos(s.az * R) * Math.cos(s.alt * R), Math.sin(s.alt * R)];
    const triees: [number, Pt[], boolean][] = faces.map((f) => {
      const [q, d] = ecran(f);
      let n = cross(sub(f[1]!, f[0]!), sub(f[2]!, f[0]!));
      n = mul(n, 1 / norme(n));
      const centre: V3 = [0, 1, 2].map((i) => f.reduce((acc, c) => acc + c[i]!, 0) / f.length) as V3;
      if (dot(centre, n) < 0) n = mul(n, -1);
      const eclairee = s.alt > 0 && dot(n, soleil_vec) > 0;
      return [d.reduce((a, x) => a + x, 0) / d.length, q, eclairee];
    });
    triees.sort((a, b2) => a[0] - b2[0]);
    for (const [, q, eclairee] of triees) {
      p.setPen(dessin.stylo('grille', 1.0));
      p.setBrush(dessin.c(eclairee ? 'lune' : 'penombre', eclairee ? 0.95 : 0.7));
      p.drawPolygon(q);
    }
    if (s.alt > 0) {
      const [q] = ecran([mul(soleil_vec, 2.9)]);
      dessin.disque(p, q[0]!.x, q[0]!.y, 9, 'soleil');
    }
  }

  /** Hauteur du Soleil à cette heure (ou au midi vrai) tout au long de l'année. */
  private annee(p: Peintre, r: Rect): void {
    const x0 = r.x + 30,
      x1 = r.right - 6,
      y0 = r.y + 4,
      y1 = r.bottom - 14;
    const cle = `${this.heure.value()}|${this.lat.value()}|${this.c_midi.isChecked()}`;
    if (this.courbe === null || this.courbe[0] !== cle) {
      const hs: number[] = [];
      for (let j = 0; j < 366; j += 3) hs.push(soleil_local(j, this.heure.value(), this.lat.value(), this.c_midi.isChecked()).alt);
      this.courbe = [cle, hs];
    }
    const hs = this.courbe[1];
    const hmin = Math.min(-5.0, Math.min(...hs)),
      hmax = Math.max(90.0, Math.max(...hs));
    const xy = (j: number, h: number): Pt => new Pt(x0 + ((x1 - x0) * j) / 365.0, y1 - ((y1 - y0) * (h - hmin)) / (hmax - hmin));
    p.setPen(dessin.stylo('grille', 1.0, 0.6));
    dessin.police(p, 0.7);
    for (const h of [0, 30, 60, 90]) {
      const q = xy(0, h);
      p.drawLine(x0, q.y, x1, q.y);
      dessin.texte(p, x0 - 14, q.y, `${h}°`, 'doux');
    }
    for (let mo = 1; mo < 13; mo += 2) {
      let j = 0;
      for (let i = 0; i < mo - 1; i++) j += MOIS_JOURS[i]!;
      dessin.texte(p, xy(j + 15, 0).x, y1 + 8, tr(`anim_mois_court_${mo}`), 'doux');
    }
    dessin.police(p, 1 / 0.7);
    p.setPen(dessin.stylo('soleil', 1.6));
    p.setBrush(null);
    p.drawPolyline(hs.map((h, i) => xy(3 * i, h)));
    const s = this.soleil();
    dessin.disque(p, xy(this.jour.value(), s.alt).x, xy(this.jour.value(), s.alt).y, 4.5, 'accent3', 'texte');
  }
}
