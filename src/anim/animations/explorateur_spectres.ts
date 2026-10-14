/**
 * Spectrum Explorer : spectres continu, d'émission et d'absorption d'une étoile de type spectral et de classe de
 * luminosité choisis.  Modèle physique (src/anim/spectre_physique.ts) : intensités des familles de raies calculées par
 * Saha–Boltzmann sur des atmosphères ATLAS9 (courbes lisses, une par classe), 133 raies NIST, bandes TiO et CH
 * dégradées, continu de Planck coloré (CIE 1931).  Remplace les segments de droite et les 37 raies de l'original.
 */
import * as hr from '../../calc/hr';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, Rect } from '../../noyau/peintre';
import { Animation, type Choix, type Coche, nombre, type Reglage } from '../base';
import { COULEURS_FAMILLES, dessiner_bande, FAMILLES, LAMBDA_MAX, LAMBDA_MIN, type ModeSpectre, modele, remarques } from '../spectre_physique';

/** Températures marquées sur l'axe du haut du graphe des intensités (K). */
const T_AXE = [40000, 30000, 20000, 15000, 10000, 8000, 7000, 6000, 5000, 4000, 3500, 3000];
const NOMS_H: Record<string, string> = { '656.3': 'Hα', '486.1': 'Hβ', '434.0': 'Hγ', '410.2': 'Hδ', '397.0': 'Hε', '388.9': 'H8', '383.5': 'H9' };

/** Courbes des intensités d'une classe (0 à 69 par huitième de type) : mises en cache. */
const COURBES = new Map<string, Record<string, [number, number][]>>();
function courbes(classe: string): Record<string, [number, number][]> {
  let c = COURBES.get(classe);
  if (!c) {
    const m = modele();
    c = {};
    for (const f of [...FAMILLES, 'ch']) c[f] = [];
    // 8 points par type (comme la grille fine du modèle) : courbes lisses, sans cassure
    for (let k = 0; k <= 552; k++) {
      const t = k / 8;
      const it = m.intensites(t, classe);
      for (const f of Object.keys(c)) c[f]!.push([t, it[f]!]);
    }
    COURBES.set(classe, c);
  }
  return c;
}

const TYPES_T = new Map<string, number | null>();
/** Type spectral (réel) où la classe atteint la température T, ou null (premier croisement) ; mis en cache. */
function type_de_temperature(T: number, classe: string): number | null {
  const cle = `${T}|${classe}`;
  if (!TYPES_T.has(cle)) TYPES_T.set(cle, type_de_temperature_calc(T, classe));
  return TYPES_T.get(cle)!;
}

function type_de_temperature_calc(T: number, classe: string): number | null {
  const m = modele();
  let avant = m.etalonnage(0, classe).teff;
  for (let k = 1; k <= 690; k++) {
    const t = k / 10;
    const v = m.etalonnage(t, classe).teff;
    if ((avant - T) * (v - T) <= 0 && avant !== v) return t - 0.1 + (0.1 * (avant - T)) / (avant - v);
    avant = v;
  }
  return null;
}

/** Nom court d'une raie : Hα…Hε, sinon l'espèce (Ca II, Fe I…). */
export function nom_raie(espece: string, lambda: number): string {
  return NOMS_H[lambda.toFixed(1)] ?? espece;
}

export class ExplorateurSpectres extends Animation {
  static override ID = 'spectrum010';
  static override ANIMEE = false;

  mode!: Choix;
  sp!: Reglage;
  classe!: Choix;
  echelle!: Choix;
  cases: Record<string, Coche> = {};

  override construire(): void {
    this.mode = this.choix('mode', [['anim_spectrum010_continu', 'continu'], ['anim_spectrum010_emission', 'emission'], ['anim_spectrum010_absorption', 'absorption']], 'absorption');
    this.sp = this.curseur('type', 0.0, 69.0, 42.0, { dec: 0 });
    this.classe = this.choix('classe', [['anim_spectroparallax_c_I', 'I'], ['anim_spectroparallax_c_III', 'III'], ['anim_spectroparallax_c_V', 'V']], 'V');
    this.echelle = this.choix('echelle', [['anim_spectrum010_e_pedago', 'pedagogique'], ['anim_spectrum010_e_realiste', 'realiste']], 'pedagogique');
    this.cases = {};
    for (const f of FAMILLES) this.cases[f] = this.coche('f_' + f, true);
    this.etat();
  }

  private etat(): void {
    const mode = this.mode.currentData();
    for (const c of Object.values(this.cases)) c.setEnabled(mode !== 'continu');
  }

  override reglage_change(): void {
    this.etat();
    super.reglage_change();
  }

  private cl(): string {
    return this.classe.currentData() as string;
  }

  temperature(): number {
    return modele().etalonnage(this.sp.value(), this.cl()).teff;
  }

  /** Familles cochées (null : toutes). */
  familles(): string[] {
    return FAMILLES.filter((f) => this.cases[f]!.isChecked());
  }

  override valeurs(): [string, string][] {
    const mode = this.mode.currentData() as string;
    const t = this.sp.value();
    const cl = this.cl();
    const e = modele().etalonnage(t, cl);
    const out: [string, string][] = [
      [tr('anim_spectrum010_mode_v'), tr('anim_spectrum010_' + mode)],
      [tr('anim_spectrum010_echelle_v'), tr(this.echelle.currentData() === 'pedagogique' ? 'anim_spectrum010_e_pedago_v' : 'anim_spectrum010_e_realiste_v')],
      [tr('anim_spectrum010_type_v'), `${hr.nom_type(t)} ${cl}`],
      [tr('anim_stellarlum_temperature'), `${nombre(e.teff, 0)} K`],
      [tr('anim_spectrum010_logg'), nombre(e.logg, 2)],
    ];
    if (mode !== 'continu') {
      const it = modele().intensites(t, cl);
      const fortes = this.familles().filter((f) => it[f]! >= 50).map((f) => tr('anim_spectrum010_f_' + f));
      out.push([tr('anim_spectrum010_fortes'), fortes.join(', ') || tr('anim_c_aucun')]);
      const fam = this.familles();
      const raies = modele().raies(t, cl).filter((r) => fam.includes(r.famille)).sort((a, b) => b.W - a.W).slice(0, 3);
      out.push([tr('anim_spectrum010_principales'), raies.map((r) => `${nom_raie(r.espece, r.lambda)} ${nombre(r.lambda, 1)} nm`).join(', ') || tr('anim_c_aucun')]);
    }
    const rq = remarques(t, cl, e);
    if (rq.length) out.push([tr('anim_spectrum010_remarque'), rq.join(' ; ')]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const mode = this.mode.currentData() as ModeSpectre;
    const t = this.sp.value();
    const cl = this.cl();
    const z = dessin.zones(rect, 2, 10.0);
    const r = dessin.cadre(p, z[0]!, tr('anim_spectrum010_titre_' + mode));
    const fm = p.fontMetrics();
    const rq = remarques(t, cl);
    const basNote = rq.length ? fm.height() + 2 : 0;
    const hautNoms = mode === 'absorption' && r.h > 90 ? fm.height() * 0.85 + 4 : 0;
    const bande = new Rect(r.x + 10, r.y + 6 + hautNoms, r.w - 20, Math.max(24.0, r.h - 34 - hautNoms - basNote));
    const fam = mode === 'continu' ? [] : this.familles();
    dessiner_bande(p, bande, t, cl, mode, mode === 'continu' ? null : fam, true, this.echelle.currentData() === 'pedagogique');
    if (hautNoms) this.noms_raies(p, bande, t, cl, fam);
    if (rq.length) {
      dessin.police(p, 0.8);
      dessin.texte(p, bande.left, bande.bottom + 14 + fm.height() * 0.8, '⚠ ' + rq.join(' ; '), 'accent1', { centre: false });
      dessin.police(p, 1 / 0.8);
    }
    this.intensites(p, z[1]!, t, cl);
  }

  /** Noms des raies les plus fortes au-dessus de la bande (sans chevauchement). */
  private noms_raies(p: Peintre, bande: Rect, t: number, cl: string, fam: string[]): void {
    const raies = modele().raies(t, cl).filter((r) => fam.includes(r.famille) && r.lambda >= LAMBDA_MIN && r.lambda <= LAMBDA_MAX);
    raies.sort((a, b) => b.W - a.W);
    const n = bande.w < 360 ? 3 : bande.w < 640 ? 5 : 7;
    dessin.police(p, 0.75);
    const fm = p.fontMetrics();
    const poses: [number, number][] = [];
    for (const r of raies.slice(0, n)) {
      const x = bande.left + (bande.w * (r.lambda - LAMBDA_MIN)) / (LAMBDA_MAX - LAMBDA_MIN);
      const s = nom_raie(r.espece, r.lambda);
      const w = fm.horizontalAdvance(s) + 4;
      const g = Math.max(bande.left, Math.min(bande.right - w, x - w / 2));
      if (poses.some(([a, b]) => g < b && g + w > a)) continue;
      poses.push([g, g + w]);
      p.setPen(dessin.stylo('doux', 1.0, 0.8));
      p.drawLine(x, bande.top - 3, x, bande.top);
      dessin.texte(p, g + 2, bande.top - 5, s, 'doux', { centre: false });
    }
    dessin.police(p, 1 / 0.75);
  }

  /** Graphe des intensités des familles (0–100) en fonction du type, températures de la classe en haut. */
  private intensites(p: Peintre, zone: Rect, t: number, cl: string): void {
    const r2 = dessin.cadre(p, zone, tr('anim_spectrum010_titre_intensites'));
    dessin.police(p, 0.85);
    const fm = p.fontMetrics();
    const noms = FAMILLES.map((f) => tr('anim_spectrum010_f_' + f));
    const lmax = Math.max(...noms.map((s) => fm.horizontalAdvance(s))) + 22;
    const ligne = fm.height() + 2;
    // légende : dans la marge de droite si le graphe garde 240 px, sinon en rangées au-dessus du graphe
    const aDroite = r2.w - lmax - 50 >= 240;
    const rangees: [number, number, number][] = [];
    if (!aDroite) {
      let x = 0;
      let rangee = 0;
      FAMILLES.forEach((_, i) => {
        const w = fm.horizontalAdvance(noms[i]!) + 24;
        if (x > 0 && x + w > r2.w - 12) {
          rangee++;
          x = 0;
        }
        rangees.push([i, x, rangee]);
        x += w;
      });
    }
    const nRangees = aDroite ? 0 : Math.max(...rangees.map((q) => q[2])) + 1;
    const hautLegende = nRangees * ligne;
    const hautT = r2.h > 120 ? fm.height() + 4 : 0;
    dessin.police(p, 1 / 0.85);
    const ax = new Axes(r2, 0, 69, 0, 105, false, false, [40, 6 + hautT + hautLegende, aDroite ? lmax + 8 : 10, 26]).avec(p);
    ax.fond(p, { titre_y: tr('anim_c_intensite'), fmt_x: (v) => hr.nom_type(v), n_x: r2.w < 360 ? 4 : 7 });
    // températures de la classe choisie sur l'axe du haut
    if (hautT) {
      dessin.police(p, 0.75);
      const fmT = p.fontMetrics();
      let droite = -Infinity;
      for (const T of T_AXE) {
        const ty = type_de_temperature(T, cl);
        if (ty === null || ty < 0 || ty > 69) continue;
        const X = ax.px(ty);
        const s = `${nombre(T, 0)} K`;
        const w = fmT.horizontalAdvance(s);
        if (X - w / 2 < droite + 8 || X - w / 2 < r2.left || X + w / 2 > r2.right) continue;
        droite = X + w / 2;
        p.setPen(dessin.stylo('grille', 1.0));
        p.drawLine(X, ax.r.top - 3, X, ax.r.top);
        dessin.texte(p, X, ax.r.top - 6 - fmT.height() / 2 + 2, s, 'doux');
      }
      dessin.police(p, 1 / 0.75);
    }
    const c = courbes(cl);
    dessin.police(p, 0.85);
    FAMILLES.forEach((f, i) => {
      const actif = this.cases[f]!.isChecked();
      ax.courbe(c[f]!, COULEURS_FAMILLES[f]!, actif ? 2.0 : 1.0, actif ? 1.0 : 0.35);
      if (f === 'molecules') ax.courbe(c['ch']!, COULEURS_FAMILLES[f]!, 1.2, actif ? 0.8 : 0.3, true);
      let x: number;
      let y: number;
      if (aDroite) {
        x = ax.r.right + 8;
        y = ax.r.top + 4 + ligne * i;
      } else {
        const q = rangees.find((u) => u[0] === i)!;
        x = r2.left + 6 + q[1];
        y = r2.top + 4 + hautT + q[2] * ligne;
      }
      p.setPen(dessin.stylo(COULEURS_FAMILLES[f]!, 2.0, actif ? 1.0 : 0.35));
      p.drawLine(x, y + fm.height() / 2, x + 14, y + fm.height() / 2);
      dessin.texte(p, x + 18, y + fm.ascent(), noms[i]!, COULEURS_FAMILLES[f]!, { centre: false, alpha: actif ? 1.0 : 0.6 });
    });
    dessin.police(p, 1 / 0.85);
    ax.verticale(t, 'texte', 1.5, false);
  }
}
