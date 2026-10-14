/**
 * Spectrum Explorer : spectres continu, d'émission et d'absorption.  Les raies de six familles apparaissent selon le
 * type spectral de l'étoile : intensités, longueurs d'onde et températures de l'original (classes I, III et V).
 */
import * as hr from '../../calc/hr';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes, bande_spectre } from '../../noyau/graphe';
import { type Peintre, Rect } from '../../noyau/peintre';
import { pround } from '../../noyau/py';
import { Animation, type Choix, type Coche, nombre, type Reglage } from '../base';
import { intensites, RAIES } from './parallaxe_spectro';

const FAMILLES = ['he_ii', 'he_i', 'h', 'metaux_ionises', 'metaux', 'molecules'];
const COULEURS: Record<string, string> = { he_ii: 'arc1', he_i: 'accent2', h: 'accent3', metaux_ionises: 'accent1', metaux: 'horizon', molecules: 'terre' };
const LAMBDA: [number, number] = [380.0, 720.0];
const TABLE = Array.from({ length: 70 }, (_, t) => intensites(t));

export class ExplorateurSpectres extends Animation {
  static override ID = 'spectrum010';
  static override ANIMEE = false;

  mode!: Choix;
  sp!: Reglage;
  classe!: Choix;
  cases: Record<string, Coche> = {};

  override construire(): void {
    this.mode = this.choix('mode', [['anim_spectrum010_continu', 'continu'], ['anim_spectrum010_emission', 'emission'], ['anim_spectrum010_absorption', 'absorption']], 'absorption');
    this.sp = this.curseur('type', 0.0, 69.0, 42.0, { dec: 0 });
    this.classe = this.choix('classe', [['anim_spectroparallax_c_I', 'I'], ['anim_spectroparallax_c_III', 'III'], ['anim_spectroparallax_c_V', 'V']], 'V');
    this.cases = {};
    for (const f of FAMILLES) this.cases[f] = this.coche('f_' + f, true);
    this.etat();
  }

  private etat(): void {
    const mode = this.mode.currentData();
    this.sp.setEnabled(mode === 'absorption');
    this.classe.setEnabled(mode === 'absorption');
    for (const c of Object.values(this.cases)) c.setEnabled(mode !== 'continu');
  }

  override reglage_change(): void {
    this.etat();
    super.reglage_change();
  }

  temperature(): number {
    let cl = this.classe.currentData() as string;
    const t = this.sp.value();
    if (cl === 'III' && t < 40) cl = 'V';
    return hr.temperature_de_type(t, cl);
  }

  raies(): [number, number, string][] {
    const mode = this.mode.currentData();
    if (mode === 'continu') return [];
    const it = intensites(Math.trunc(pround(this.sp.value())));
    const out: [number, number, string][] = [];
    for (const f of FAMILLES) {
      if (this.cases[f]!.isChecked()) {
        const force = mode === 'emission' ? 1.0 : it[f]! / 100.0;
        for (const lam of RAIES[f]!) out.push([lam, force, f]);
      }
    }
    return out;
  }

  override valeurs(): [string, string][] {
    const mode = this.mode.currentData() as string;
    const out: [string, string][] = [[tr('anim_spectrum010_mode_v'), tr('anim_spectrum010_' + mode)]];
    if (mode === 'absorption') {
      out.push([tr('anim_spectrum010_type_v'), `${hr.nom_type(this.sp.value())} ${this.classe.currentData()}`], [tr('anim_stellarlum_temperature'), `${nombre(this.temperature(), 0)} K`]);
      const it = intensites(Math.trunc(pround(this.sp.value())));
      const fortes = FAMILLES.filter((f) => it[f]! >= 50).map((f) => tr('anim_spectrum010_f_' + f));
      out.push([tr('anim_spectrum010_fortes'), fortes.join(', ') || tr('anim_c_aucun')]);
    }
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const mode = this.mode.currentData() as string;
    const z = dessin.zones(rect, 2, 10.0);
    const r = dessin.cadre(p, z[0]!, tr('anim_spectrum010_titre_' + mode));
    const ep = mode === 'absorption' ? ({ I: 1.5, III: 2.5, V: 3.5 } as Record<string, number>)[this.classe.currentData() as string]! : 2.5;
    const raies = this.raies().map(([lam, f]) => [lam, f, ep] as [number, number, number]);
    const bande = new Rect(r.x + 10, r.y + 6, r.w - 20, Math.max(30.0, r.h - 34));
    if (mode === 'emission') bande_spectre(p, bande, ...LAMBDA, null, raies);
    else bande_spectre(p, bande, ...LAMBDA, () => 1.0, raies, true);
    dessin.police(p, 0.85);
    for (let lam = 400; lam <= 700; lam += 50) dessin.texte(p, bande.left + (bande.w * (lam - LAMBDA[0])) / (LAMBDA[1] - LAMBDA[0]), bande.bottom + 12, `${lam} nm`, 'doux');
    dessin.police(p, 1 / 0.85);
    const r2 = dessin.cadre(p, z[1]!, tr('anim_spectrum010_titre_intensites'));
    const ax = new Axes(r2, 0, 69, 0, 105, false, false, [40, 10, 110, 26]).avec(p);
    ax.fond(p, { titre_y: tr('anim_c_intensite'), fmt_x: (v) => hr.nom_type(v), n_x: 7 });
    FAMILLES.forEach((f, i) => {
      const pts = TABLE.map((it, t) => [t, it[f]!] as [number, number]);
      const actif = this.cases[f]!.isChecked();
      ax.courbe(pts, COULEURS[f]!, actif ? 2.0 : 1.0, actif ? 1.0 : 0.35);
      dessin.texte(p, ax.r.right + 8, ax.r.top + 10 + 16 * i, tr('anim_spectrum010_f_' + f), COULEURS[f]!, { centre: false });
    });
    ax.verticale(this.sp.value(), 'texte', 1.5, false);
  }
}
