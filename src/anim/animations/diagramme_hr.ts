/**
 * HR Explorer (NAAP) : le diagramme de Hertzsprung-Russell.  On déplace une étoile (température, luminosité) : son
 * rayon suit R / R☉ = √(L / L☉) / (T / T☉)², comparé au Soleil.  Droites d'égal rayon, classes de luminosité, et les
 * étoiles les plus proches ou les plus brillantes du ciel (données de l'original), en couleur vraie (corps noir →
 * CIE 1931 → sRGB) avec leur fiche au survol.  T☉ = 5 772 K.
 */
import ETOILES from '../../donnees/genere/etoiles.json';
import * as hr from '../../calc/hr';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Couleur, type Peintre, Pt, Rect } from '../../noyau/peintre';
import { Animation, type Bouton_souris, type Choix, type Coche, nombre, type Reglage } from '../base';
import { exposant } from './gravitation';
import { couleur_etoile } from '../../calc/couleur_etoile';
import { reelle } from '../etoiles_reelles';

/** Étiquette de luminosité d'une graduation (10^ll L☉) : nombre jusqu'à 100, puissance de 10 au-delà. */
export function etiquetteLum(ll: number): string {
  return ll < 3 ? nombre(10.0 ** ll, Math.max(0, -ll)) : `10${exposant(ll)}`;
}

type Etoile = [string, number, number, string];
const E = ETOILES as unknown as { proches: Etoile[]; brillantes: Etoile[]; communes: Etoile[] };
const LOG_T: [number, number] = [3.3617, 4.6021];
const LOG_L: [number, number] = [-4.0, 6.0];
const GROUPES = ['aucune', 'proches', 'brillantes', 'les_deux', 'communes'];
const RAYONS = [1e-4, 1e-3, 1e-2, 0.1, 1.0, 10.0, 100.0, 1000.0];

export class DiagrammeHR extends Animation {
  static override ID = 'hrexplorer';
  static override ANIMEE = false;
  static override FICHES = true;

  t!: Reglage;
  l!: Reglage;
  groupe!: Choix;
  c_sp!: Coche;
  c_classes!: Coche;
  c_rayons!: Coche;
  c_couleur!: Coche;
  private graphe: [Rect, number, number, number, number] | null = null;

  override construire(): void {
    this.t = this.curseur('temperature', 2300.0, 40000.0, 5800.0, { dec: 0, unite: 'K', log: true });
    this.l = this.curseur('luminosite', 1e-4, 1e6, 1.0, { dec: 4, unite: 'L☉', log: true });
    this.groupe = this.choix('groupe', GROUPES.map((g) => ['anim_hrexplorer_g_' + g, g] as [string, string]), 'aucune');
    this.c_sp = this.coche('sequence', true);
    this.c_classes = this.coche('classes', false);
    this.c_rayons = this.coche('rayons', true);
    this.c_couleur = this.coche('couleur_t', true);
    this.graphe = null;
  }

  rayon(): number {
    return hr.rayon_solaire(this.l.value(), this.t.value());
  }

  override valeurs(): [string, string][] {
    const r = this.rayon();
    return [
      [tr('anim_hrexplorer_temperature'), `${nombre(this.t.value(), 0)} K`],
      [tr('anim_hrexplorer_luminosite'), `${nombre(this.l.value(), this.l.value() < 1 ? 4 : 1)} L☉`],
      [tr('anim_hrexplorer_rayon'), `${nombre(r, r < 0.1 ? 4 : 2)} R☉`],
      [tr('anim_hrexplorer_formule'), 'R / R☉ = √(L / L☉) / (T / T☉)²'],
    ];
  }

  override presser(pos: Pt, _b: Bouton_souris): boolean {
    if (this.graphe !== null && this.graphe[0].contains(pos)) {
      this._glisse = (q) => this.tirer(q);
      this.tirer(pos);
      return true;
    }
    return false;
  }

  private tirer(pos: Pt): void {
    const [, x0, x1, y0, y1] = this.graphe!;
    const fx = Math.max(0.0, Math.min(1.0, (x1 - pos.x) / (x1 - x0)));
    const fy = Math.max(0.0, Math.min(1.0, (y1 - pos.y) / (y1 - y0)));
    this.t.setValue(10 ** (LOG_T[0] + fx * (LOG_T[1] - LOG_T[0])));
    this.l.setValue(10 ** (LOG_L[0] + fy * (LOG_L[1] - LOG_L[0])));
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = rect.w > rect.h * 1.1 ? dessin.zones_principale(rect, 1, 0.68) : dessin.zones(rect, 2, 10);
    this.diagramme(p, dessin.cadre(p, z[0]!, tr('anim_hrexplorer_diagramme')));
    this.comparaison(p, dessin.cadre(p, z[1]!, tr('anim_hrexplorer_comparaison')));
  }

  private diagramme(p: Peintre, r: Rect): void {
    const x0 = r.x + 44,
      x1 = r.right - 8,
      y0 = r.y + 4,
      y1 = r.bottom - 30;
    this.graphe = [r.copie(), x0, x1, y0, y1];
    const xy = (lt: number, ll: number): Pt => new Pt(x1 - ((x1 - x0) * (lt - LOG_T[0])) / (LOG_T[1] - LOG_T[0]), y1 - ((y1 - y0) * (ll - LOG_L[0])) / (LOG_L[1] - LOG_L[0]));
    const lts = Math.log10(hr.T_SOLEIL);
    p.save();
    p.setClipRect(new Rect(x0, y0, x1 - x0, y1 - y0));
    if (this.c_rayons.isChecked()) {
      for (const rr of RAYONS) {
        const a = xy(LOG_T[0], 2 * Math.log10(rr) + 4 * (LOG_T[0] - lts));
        const b = xy(LOG_T[1], 2 * Math.log10(rr) + 4 * (LOG_T[1] - lts));
        p.setPen(dessin.stylo('horizon', 1.0, 0.5, true));
        p.drawLineP(a, b);
      }
    }
    const classes = [...(this.c_classes.isChecked() ? [1, 2, 3, 4] : []), ...(this.c_sp.isChecked() ? [5] : [])];
    for (const n of classes) {
      const [a, b] = hr.CLASSES[n]!;
      p.setPen(dessin.stylo(n === 5 ? 'arc2' : 'arc1', n === 5 ? 2.0 : 1.2, 0.85));
      p.setBrush(null);
      const pts: Pt[] = [];
      for (let i = 0; i <= 60; i++) pts.push(xy(a + ((b - a) * i) / 60, hr.log_lum_classe(a + ((b - a) * i) / 60, n)));
      p.drawPolyline(pts);
    }
    const g = this.groupe.currentData() as string;
    const couches: [Etoile[], string, string][] = ({
      aucune: [],
      proches: [[E.proches, 'accent2', 'proches'], [E.communes, 'accent3', 'communes']],
      brillantes: [[E.brillantes, 'accent1', 'brillantes'], [E.communes, 'accent3', 'communes']],
      les_deux: [[E.proches, 'accent2', 'proches'], [E.brillantes, 'accent1', 'brillantes'], [E.communes, 'accent3', 'communes']],
      communes: [[E.communes, 'accent3', 'communes']],
    } as Record<string, [Etoile[], string, string][]>)[g]!;
    const vraie = this.c_couleur.isChecked();
    for (const [etoiles, cle, groupe] of couches) {
      for (const [nom, t, mv] of etoiles) {
        const [lt, ll] = hr.position_hr(t, mv);
        const q = xy(lt, ll);
        // couleur = température (corps noir → CIE 1931) avec le contour du groupe, ou couleur du groupe
        if (vraie) dessin.disque(p, q.x, q.y, 3.0, new Couleur(...couleur_etoile(10 ** lt)), cle);
        else dessin.disque(p, q.x, q.y, 2.6, cle);
        const f = reelle('hrexplorer:' + groupe, nom);
        if (f && q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1) this.survolable(p, f.fiche, q.x, q.y, 4, mv);
      }
    }
    p.restore();
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(null);
    p.drawRect(new Rect(x0, y0, x1 - x0, y1 - y0));
    dessin.police(p, 0.72);
    for (let ll = -4; ll < 7; ll += 2) dessin.texte(p, x0 - 20, xy(LOG_T[0], ll).y, etiquetteLum(ll), 'doux');
    for (const t of [2300, 5000, 10000, 20000, 40000]) dessin.texte(p, xy(Math.log10(t), LOG_L[0]).x, y1 + 11, nombre(t, 0), 'doux');
    dessin.texte(p, (x0 + x1) / 2, y1 + 23, tr('anim_hrexplorer_axe_t'), 'doux');
    if (this.c_rayons.isChecked()) {
      for (const rr of RAYONS) {
        const q = xy(3.45, 2 * Math.log10(rr) + 4 * (3.45 - lts));
        if (y0 < q.y && q.y < y1) dessin.texte(p, q.x, q.y, `${nombre(rr, Math.max(0, -Math.trunc(Math.floor(Math.log10(rr)))))} R☉`, 'horizon', { fond: true });
      }
    }
    dessin.police(p, 1 / 0.72);
    const q = xy(Math.log10(this.t.value()), Math.log10(this.l.value()));
    p.setPen(dessin.stylo('accent3', 2.0));
    p.drawLine(q.x - 9, q.y, q.x + 9, q.y);
    p.drawLine(q.x, q.y - 9, q.x, q.y + 9);
  }

  /** Le Soleil et l'étoile côte à côte. */
  private comparaison(p: Peintre, r: Rect): void {
    const rr = this.rayon();
    const cy = r.cy;
    const place = Math.min(r.w * 0.17, r.h * 0.38);
    const k = place / Math.max(1.0, rr);
    const rs = Math.max(1.5, k),
      re = Math.max(1.5, k * rr);
    const xs = r.x + r.w * 0.26,
      xe = r.x + r.w * 0.72;
    dessin.disque(p, xs, cy, rs, new Couleur(...couleur_etoile(hr.T_SOLEIL)), 'grille');
    dessin.disque(p, xe, cy, re, new Couleur(...couleur_etoile(this.t.value())), 'grille');
    dessin.texte(p, xs, r.bottom - 26, tr('anim_stellarlum_soleil'), 'doux');
    dessin.texte(p, xe, r.bottom - 26, `${nombre(rr, rr < 0.1 ? 4 : 2)} R☉`, 'texte');
    if (k * 1.0 < 1.5 || k * rr < 1.5) dessin.texte(p, r.cx, r.bottom - 8, tr('anim_hrexplorer_hors_echelle'), 'doux');
  }
}
