/**
 * Filters Simulator (NAAP) : une source de lumière, des filtres, un détecteur.  Le spectre reçu est le produit du
 * spectre de la source et des transmissions des filtres ; la couleur perçue de chaque spectre est calculée avec les
 * fonctions colorimétriques CIE 1931 (Judd-Vos) et la norme sRGB.  Sources : corps noir, gaussienne, Soleil ; filtres
 * U, B, V, R (Landolt 1992) et atmosphère, plus un filtre gaussien réglable.
 */
import * as lumiere from '../../calc/lumiere';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { Couleur, type Peintre, Rect } from '../../noyau/peintre';
import { Animation, type Choix, type Coche, nombre, type Reglage } from '../base';

const LAMBDA: [number, number] = [200.0, 1100.0];
const PAS = 5.0;
const FILTRES = ['U', 'B', 'V', 'R', 'atmosphere', 'gauss'];
const COULEURS: Record<string, string> = { U: 'arc1', B: 'accent2', V: 'horizon', R: 'accent3', atmosphere: 'doux', gauss: 'accent1' };
type Fn = (w: number) => number;

export class Filtres extends Animation {
  static override ID = 'filters';
  static override ANIMEE = false;

  source!: Choix;
  t!: Reglage;
  lc!: Reglage;
  largeur!: Reglage;
  cases: Record<string, Coche> = {};
  fc!: Reglage;
  fl!: Reglage;

  override construire(): void {
    this.source = this.choix('source', [['anim_filters_s_corps_noir', 'corps_noir'], ['anim_filters_s_gauss', 'gauss'], ['anim_filters_s_soleil', 'soleil']], 'corps_noir');
    this.t = this.curseur('temperature', 2000.0, 30000.0, 6000.0, { dec: 0, unite: 'K', log: true });
    this.lc = this.curseur('pic', 300.0, 1000.0, 600.0, { dec: 0, unite: 'nm' });
    this.largeur = this.curseur('largeur', 5.0, 300.0, 50.0, { dec: 0, unite: 'nm' });
    this.cases = {};
    for (const f of FILTRES) this.cases[f] = this.coche('f_' + f, f === 'V');
    this.fc = this.curseur('filtre_centre', 300.0, 1000.0, 450.0, { dec: 0, unite: 'nm' });
    this.fl = this.curseur('filtre_largeur', 5.0, 300.0, 40.0, { dec: 0, unite: 'nm' });
    this.etat();
  }

  private etat(): void {
    const s = this.source.currentData();
    this.t.setEnabled(s === 'corps_noir');
    this.lc.setEnabled(s === 'gauss');
    this.largeur.setEnabled(s === 'gauss');
    const g = this.cases.gauss!.isChecked();
    this.fc.setEnabled(g);
    this.fl.setEnabled(g);
  }

  override reglage_change(): void {
    this.etat();
    super.reglage_change();
  }

  source_brute(): Fn {
    const s = this.source.currentData();
    if (s === 'corps_noir') {
      const t = this.t.value();
      const ref = lumiere.planck(lumiere.pic_wien_m(t), t);
      return (w) => lumiere.planck(w * 1e-9, t) / ref;
    }
    if (s === 'gauss') {
      const c = this.lc.value(),
        sg = this.largeur.value() / 2.354_820_045;
      return (w) => Math.exp(-0.5 * ((w - c) / sg) ** 2);
    }
    const v = lumiere.spectres().soleil!.v as number[];
    const ref = Math.max(...v);
    return (w) => lumiere.valeur('soleil', w, 'v') / ref;
  }

  transmission(): Fn {
    const actifs = FILTRES.filter((f) => this.cases[f]!.isChecked());
    const c = this.fc.value(),
      sg = this.fl.value() / 2.354_820_045;
    const k: Record<string, number> = {};
    for (const f of lumiere.FILTRES) k[f] = (lumiere.spectres()['filtre_' + f]!.t_max as number) / Math.max(...lumiere.table('filtre_' + f)[2]);
    return (w) => {
      let v = 1.0;
      for (const f of actifs) {
        if (f === 'atmosphere') v *= w <= 1000 ? lumiere.valeur('atmosphere', w) : 1.0;
        else if (f === 'gauss') v *= Math.exp(-0.5 * ((w - c) / sg) ** 2);
        else v *= lumiere.valeur('filtre_' + f, w) * k[f]!;
      }
      return v;
    };
  }

  tables(): [number[], number[], number[], number[]] {
    const src = this.source_brute(),
      tr_ = this.transmission();
    const n = Math.trunc((LAMBDA[1] - LAMBDA[0]) / PAS) + 1;
    const ws = Array.from({ length: n }, (_, i) => LAMBDA[0] + PAS * i);
    const s = ws.map(src);
    const t = ws.map(tr_);
    return [ws, s, t, s.map((a, i) => a * t[i]!)];
  }

  static couleur(ws: number[], vals: number[]): [number, number, number] {
    const d = new Map<number, number>();
    ws.forEach((w, i) => d.set(w, vals[i]!));
    return lumiere.xyz((w) => d.get(w) ?? 0.0);
  }

  override valeurs(): [string, string][] {
    const [ws, s, , d] = this.tables();
    const vis = ws.map((w, i) => [w, i] as [number, number]).filter(([w]) => 380 <= w && w <= 750).map(([, i]) => i);
    let fs = 0,
      fd = 0;
    for (const i of vis) fs += s[i]!;
    for (const i of vis) fd += d[i]!;
    const somme = (t: number[]): number => t.reduce((a, b) => a + b, 0);
    return [
      [tr('anim_filters_transmis'), `${nombre(fs ? (100 * fd) / fs : 0, 1)} %`],
      [tr('anim_filters_transmis_tout'), `${nombre(somme(s) ? (100 * somme(d)) / somme(s) : 0, 1)} %`],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const [ws, s, t, d] = this.tables();
    const h = rect.h / 3;
    const z = [0, 1, 2].map((i) => new Rect(rect.x, rect.y + i * h, rect.w, h));
    const xyzS = Filtres.couleur(ws, s);
    const ref = xyzS[1] || 1.0;
    this.graphe(p, z[0]!, tr('anim_filters_titre_source'), ws, s, 'accent1', xyzS, ref);
    this.graphe(p, z[1]!, tr('anim_filters_titre_filtres'), ws, t, 'accent2', null, ref, true);
    this.graphe(p, z[2]!, tr('anim_filters_titre_detecteur'), ws, d, 'accent3', Filtres.couleur(ws, d), ref);
  }

  private graphe(p: Peintre, zone: Rect, titre: string, ws: number[], vals: number[], cle: string, xyz: [number, number, number] | null, ref: number, filtres = false): void {
    const r = dessin.cadre(p, zone, titre);
    const ax = new Axes(r, LAMBDA[0], LAMBDA[1], 0, 1.05, false, false, [36, 4, 70, 22]).avec(p);
    ax.bande_visible(0.15);
    ax.fond(p, { n_y: 2, n_x: 9 });
    if (filtres) {
      for (const f of FILTRES) {
        if (this.cases[f]!.isChecked() && f !== 'atmosphere' && f !== 'gauss') {
          const [w0, , tt] = lumiere.table('filtre_' + f);
          const k = (lumiere.spectres()['filtre_' + f]!.t_max as number) / Math.max(...tt);
          const pts: [number, number][] = [];
          for (let i = 0; i < tt.length; i += 3) pts.push([w0 + i, tt[i]! * k]);
          ax.courbe(pts, COULEURS[f]!, 1.0, 0.6);
        }
      }
    }
    const pts = ws.map((w, i) => [w, vals[i]!] as [number, number]);
    ax.remplir(pts, cle, 0.25);
    ax.courbe(pts, cle, 2.0);
    if (xyz !== null) {
      const [x, y, zz] = xyz;
      const rgb = y > 0 ? lumiere.rgb_de_xyz(x / ref, y / ref, zz / ref) : [0, 0, 0];
      const pastille = new Rect(ax.r.right + 14, ax.r.top + 4, 44, 44);
      p.setPen(dessin.stylo('doux', 1.0));
      p.setBrush(new Couleur(rgb[0]!, rgb[1]!, rgb[2]!));
      p.drawRoundedRect(pastille, 6, 6);
      dessin.police(p, 0.8);
      dessin.texte(p, pastille.cx, pastille.bottom + 10, tr('anim_filters_couleur'), 'doux');
      dessin.police(p, 1 / 0.8);
    }
  }
}
