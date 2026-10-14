/**
 * Antipodes Explorer : un point de la Terre et son antipode (latitude −φ, longitude λ ± 180°), sur le globe et sur une
 * carte plane ; déplacement à la souris, éventuellement le long d'un parallèle ou d'un méridien, aimanté aux multiples
 * de 5°.
 */
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { pround } from '../../noyau/py';
import { Animation, type Bouton_souris, type Choix, type Coche, type Reglage } from '../base';
import { cotesCarte } from './jour_nuit';
import { cotes, decimal, globe_xyz } from './longitude_latitude';

export function antipode(lat: number, lon: number): [number, number] {
  return [-lat, lon <= 0 ? lon + 180.0 : lon - 180.0];
}

export class Antipodes extends Animation {
  static override ID = 'antipodesexplorer';
  static override ANIMEE = false;

  globe!: dessin.Vue3D;
  lat!: Reglage;
  lon!: Reglage;
  contrainte!: Choix;
  c_aimant!: Coche;
  private carte: Rect | null = null;

  override construire(): void {
    this.globe = this.vue(30.0, 20.0);
    this.lat = this.curseur('latitude', -90.0, 90.0, 48.85, { dec: 2, unite: '°', cle_texte: 'anim_c_latitude' });
    this.lon = this.curseur('longitude', -180.0, 180.0, 2.35, { dec: 2, unite: '°', cle_texte: 'anim_c_longitude' });
    this.contrainte = this.choix('contrainte', [['anim_antipodesexplorer_libre', 'libre'], ['anim_antipodesexplorer_parallele', 'parallele'], ['anim_antipodesexplorer_meridien', 'meridien']], 'libre');
    this.c_aimant = this.coche('aimant', false);
    this.carte = null;
  }

  private textes(la: number, lo: number): string {
    return `${decimal(la, tr('anim_pc_n'), tr('anim_pc_s'))}, ${decimal(lo, tr('anim_pc_e'), tr('anim_pc_o'))}`;
  }

  override valeurs(): [string, string][] {
    const la = this.lat.value(),
      lo = this.lon.value();
    const [a1, a2] = antipode(la, lo);
    return [
      [tr('anim_antipodesexplorer_point'), this.textes(la, lo)],
      [tr('anim_antipodesexplorer_antipode'), this.textes(a1, a2)],
    ];
  }

  override presser(pos: Pt, bouton: Bouton_souris): boolean {
    if (this.carte !== null && this.carte.contains(pos)) {
      this._glisse = (q) => this.tirer(q);
      this.tirer(pos);
      return true;
    }
    return super.presser(pos, bouton);
  }

  private tirer(pos: Pt): void {
    const r = this.carte!;
    let lo = ((pos.x - r.x) / r.w) * 360.0 - 180.0;
    let la = 90.0 - ((pos.y - r.y) / r.h) * 180.0;
    if (this.c_aimant.isChecked()) {
      la = 5 * pround(la / 5);
      lo = 5 * pround(lo / 5);
    }
    const c = this.contrainte.currentData();
    if (c !== 'parallele') this.lat.setValue(Math.max(-90.0, Math.min(90.0, la)));
    if (c !== 'meridien') this.lon.setValue(Math.max(-180.0, Math.min(180.0, lo)));
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones(rect, 2, 0.9);
    this.dessinerGlobe(p, dessin.cadre(p, z[0]!, tr('anim_antipodesexplorer_globe')));
    this.dessinerCarte(p, dessin.cadre(p, z[1]!, tr('anim_antipodesexplorer_carte')));
  }

  private dessinerGlobe(p: Peintre, r: Rect): void {
    this.zone_rotative(r, this.globe);
    const rr = Math.min(r.w, r.h) * 0.42;
    const pe = new dessin.Peintre3D(p, this.globe, r.cx, r.cy, rr);
    pe.contour('grille', 'terre', 0.25);
    for (const poly of cotes()) if (poly.length >= 5) pe.courbe(poly, 'doux', 1.0, 0.9, { arriere: 'cache', ferme: true });
    const la = this.lat.value(),
      lo = this.lon.value();
    const [a1, a2] = antipode(la, lo);
    pe.segment(globe_xyz(la, lo), globe_xyz(a1, a2), 'accent2', 1.5, 0.7);
    pe.point(globe_xyz(la, lo), 'soleil', 6.0, { bord: 'fond', toujours: true });
    pe.point(globe_xyz(a1, a2), 'accent3', 6.0, { bord: 'fond', toujours: true });
  }

  private dessinerCarte(p: Peintre, r: Rect): void {
    const w = Math.min(r.w, r.h * 2.0);
    const carte = new Rect(r.cx - w / 2, r.cy - w / 4, w, w / 2);
    this.carte = carte;
    const xy = (la: number, lo: number): Pt => new Pt(carte.x + ((lo + 180.0) / 360.0) * carte.w, carte.y + ((90.0 - la) / 180.0) * carte.h);
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(dessin.c('terre', 0.18));
    p.drawRect(carte);
    p.setPen(dessin.stylo('doux', 0.8, 0.8));
    cotesCarte(p, xy);
    p.setPen(dessin.stylo('grille', 0.6, 0.6));
    for (let k = -60; k < 90; k += 30) p.drawLineP(xy(k, -180), xy(k, 180));
    for (let k = -150; k < 180; k += 30) p.drawLineP(xy(-90, k), xy(90, k));
    const la = this.lat.value(),
      lo = this.lon.value();
    const [a1, a2] = antipode(la, lo);
    const q1 = xy(la, lo),
      q2 = xy(a1, a2);
    dessin.disque(p, q1.x, q1.y, 6, 'soleil', 'fond');
    dessin.disque(p, q2.x, q2.y, 6, 'accent3', 'fond');
    dessin.texte(p, q1.x, q1.y - 14, tr('anim_antipodesexplorer_point'), 'soleil', { fond: true });
    dessin.texte(p, q2.x, q2.y - 14, tr('anim_antipodesexplorer_antipode'), 'accent3', { fond: true });
  }
}
