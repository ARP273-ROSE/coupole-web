/**
 * Spectroscopic Parallax Simulator : la distance d'une étoile sans mesurer sa parallaxe.  Le spectre donne le type
 * spectral et la classe de luminosité ; le diagramme HR donne la magnitude absolue M ; avec la magnitude apparente m,
 * d = 10^((m − M + 5) / 5) parsecs.  Spectre, T_eff et M_V : modèle physique (src/anim/spectre_physique.ts) ; là où
 * aucune M_V n'est publiée (classes I hors O, II, IV, III de B à F), ancien étalonnage, signalé.
 */
import * as astro from '../../calc/astro';
import * as hr from '../../calc/hr';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { Animation, type Bouton_souris, type Choix, type Coche, nombre, type Reglage } from '../base';
import { couleur_etoile_teff, dessiner_bande, FAMILLES, modele, remarques } from '../spectre_physique';
import { etiquetteLum } from './diagramme_hr';

const LOG_T: [number, number] = [3.3617, 4.6812];
const LOG_L: [number, number] = [-4.0, 6.0];
const CLASSES: [string, number][] = [['I', 1], ['II', 2], ['III', 3], ['IV', 4], ['V', 5]];
const NOM_CLASSE: Record<number, string> = Object.fromEntries(CLASSES.map(([c, n]) => [n, c]));

export interface Resultat {
  log_t: number;
  log_l: number;
  M: number;
  /** vrai : M_V de l'ancien étalonnage (aucune valeur publiée pour ce type et cette classe) */
  ancien: boolean;
  source: string;
  /** ancien étalonnage : le type est dans le domaine de la courbe de l'original (sinon extrapolée, non tracée) */
  dans_domaine: boolean;
}

/**
 * Magnitude absolue M_V d'une étoile de type t et de classe n (1 = I … 5 = V) : T_eff et M_V du nouvel étalonnage
 * (Mamajek 2022 pour V, Martins 2005 / van Belle 2021 pour III, Martins 2005 pour les supergéantes O) quand ils sont
 * publiés ; sinon M_V de l'ancien étalonnage (celui de l'original : courbe de la classe au log T de l'original),
 * signalé.  La température est toujours celle du nouvel étalonnage (celle du spectre).
 */
export function magnitude_absolue(t: number, classe: number): Resultat {
  const e = modele().etalonnage(t, NOM_CLASSE[classe]!);
  const lt = Math.log10(e.teff);
  if (e.mv !== null) {
    const ll = e.logl !== null ? e.logl : hr.log_lum_de_mbol(e.mv + hr.correction_bolometrique(lt));
    return { log_t: lt, log_l: ll, M: e.mv, ancien: false, source: e.source, dans_domaine: true };
  }
  const lt0 = hr.log_temp_de_type(t);
  const ll = hr.log_lum_classe(lt0, classe);
  const [a, b] = hr.CLASSES[classe]!;
  return {
    log_t: lt, log_l: ll, M: hr.mbol_de_log_lum(ll) - hr.correction_bolometrique(lt0), ancien: true, source: '',
    dans_domaine: lt0 >= a && lt0 <= b,
  };
}

/** Intensité (0 à 100) des familles de raies au type t et à la classe (modèle physique). */
export function intensites(t: number, classe: string): Record<string, number> {
  return modele().intensites(t, classe);
}

export class ParallaxeSpectro extends Animation {
  static override ID = 'spectroparallax';
  static override ANIMEE = false;

  sp!: Reglage;
  classe!: Choix;
  echelle!: Choix;
  m!: Reglage;
  c_emission!: Coche;
  private graphe: [Rect, number, number] | null = null;

  override construire(): void {
    this.sp = this.curseur('type', 0.0, 69.0, 42.0, { dec: 0 });
    this.classe = this.choix('classe', CLASSES.map(([c, n]) => ['anim_spectroparallax_c_' + c, n] as [string, number]), 5);
    this.m = this.curseur('m', -5.0, 15.0, 1.0, { dec: 2 });
    this.c_emission = this.coche('emission', false);
    this.echelle = this.choix('echelle', [['anim_spectrum010_e_pedago', 'pedagogique'], ['anim_spectrum010_e_realiste', 'realiste']], 'pedagogique', 'anim_spectrum010_echelle');
    this.graphe = null;
  }

  private cl(): string {
    return NOM_CLASSE[this.classe.currentData() as number]!;
  }

  resultat(): Resultat & { d: number } {
    const r = magnitude_absolue(this.sp.value(), this.classe.currentData() as number);
    return { ...r, d: astro.distance_du_module(this.m.value() - r.M) };
  }

  override valeurs(): [string, string][] {
    const r = this.resultat();
    const out: [string, string][] = [
      [tr('anim_spectroparallax_type_c'), `${hr.nom_type(this.sp.value())} ${this.cl()}`],
      [tr('anim_stellarlum_temperature'), `${nombre(10 ** r.log_t, 0)} K`],
      [tr('anim_spectroparallax_lum'), `${nombre(10 ** r.log_l, r.log_l < 1 ? 3 : 0)} L☉`],
      [tr('anim_spectroparallax_M'), nombre(r.M, 2)],
      [tr('anim_spectroparallax_module'), nombre(this.m.value() - r.M, 2)],
      [tr('anim_spectroparallax_distance'), `${nombre(r.d, r.d < 1000 ? 1 : 0)} pc (${nombre(r.d * astro.PC_EN_AL, 0)} ${tr('anim_spectroparallax_al')})`],
      [tr('anim_spectroparallax_raies'), this.description()],
      [tr('anim_spectroparallax_etalonnage'), r.ancien ? tr('anim_spectroparallax_ancien') : r.source],
    ];
    const rq = remarques(this.sp.value(), this.cl()).filter((x) => !r.ancien || x !== tr('spectres_d_interpole'));
    if (rq.length) out.push([tr('anim_spectrum010_remarque'), rq.join(' ; ')]);
    out.push([tr('anim_spectrum010_echelle_v'), tr(this.echelle.currentData() === 'pedagogique' ? 'anim_spectrum010_e_pedago_v' : 'anim_spectrum010_e_realiste_v')]);
    return out;
  }

  private description(): string {
    const parts: string[] = [];
    const it = intensites(this.sp.value(), this.cl());
    for (const famille of [...FAMILLES, 'ch']) {
      const v = it[famille]!;
      if (v >= 1) {
        const q = v < 20 ? 'tf' : v < 40 ? 'f' : v < 60 ? 'm' : v < 85 ? 'F' : 'tF';
        parts.push(tr('anim_spectroparallax_q_' + q, { f: tr('anim_spectroparallax_f_' + famille) }));
      }
    }
    return parts.join(', ');
  }

  override presser(pos: Pt, _b: Bouton_souris): boolean {
    if (this.graphe !== null && this.graphe[0].contains(pos)) {
      this._glisse = (q) => this.tirer(q);
      this.tirer(pos);
      return true;
    }
    return false;
  }

  /** Le doigt choisit une température sur l'axe : le type de la classe choisie qui l'a. */
  private tirer(pos: Pt): void {
    const [, x0, x1] = this.graphe!;
    if (!Number.isFinite(pos.x) || !(x1 > x0)) return;
    const lt = LOG_T[1] - ((LOG_T[1] - LOG_T[0]) * (Math.max(x0, Math.min(x1, pos.x)) - x0)) / (x1 - x0);
    const T = 10 ** lt;
    const m = modele();
    const cl = this.cl();
    let meilleur = 0;
    let ecart = Infinity;
    for (let t = 0; t <= 69; t++) {
      const d = Math.abs(Math.log10(m.etalonnage(t, cl).teff) - Math.log10(T));
      if (d < ecart) {
        ecart = d;
        meilleur = t;
      }
    }
    this.sp.setValue(meilleur);
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const haut = rect.h * 0.7;
    this.diagramme(p, dessin.cadre(p, new Rect(rect.x, rect.y, rect.w, haut), tr('anim_spectroparallax_diagramme')));
    this.spectre(p, dessin.cadre(p, new Rect(rect.x, rect.y + haut, rect.w, rect.h - haut), tr('anim_spectroparallax_spectre')));
  }

  private diagramme(p: Peintre, r: Rect): void {
    const x0 = r.x + 40,
      x1 = r.right - 8,
      y0 = r.y + 4,
      y1 = r.bottom - 30;
    this.graphe = [r.copie(), x0, x1];
    const xy = (lt: number, ll: number): Pt => new Pt(x1 - ((x1 - x0) * (lt - LOG_T[0])) / (LOG_T[1] - LOG_T[0]), y1 - ((y1 - y0) * (ll - LOG_L[0])) / (LOG_L[1] - LOG_L[0]));
    p.setPen(dessin.stylo('grille', 1.0, 0.5));
    dessin.police(p, 0.72);
    for (let ll = -4; ll < 7; ll += 2) {
      const q = xy(LOG_T[0], ll);
      p.drawLine(x0, q.y, x1, q.y);
      dessin.texte(p, x0 - 18, q.y, etiquetteLum(ll), 'doux');
    }
    const m = modele();
    [...hr.LETTRES].forEach((lettre, k) => {
      const q = xy(Math.log10(m.etalonnage(10 * k + 5, 'V').teff), LOG_L[0]);
      dessin.texte(p, q.x, y1 + 12, lettre, 'doux');
    });
    dessin.texte(p, (x0 + x1) / 2, y1 + 24, tr('anim_spectroparallax_axe_x'), 'doux');
    dessin.police(p, 1 / 0.72);
    for (const [nom, n] of CLASSES) {
      const choisie = n === this.classe.currentData();
      // nouvel étalonnage en trait plein, ancien en pointillé
      const pts = Array.from({ length: 139 }, (_, k) => magnitude_absolue(k / 2, n)).filter((u) => u.dans_domaine);
      let d = 0;
      while (d < pts.length - 1) {
        let f = d + 1;
        while (f < pts.length - 1 && pts[f]!.ancien === pts[d]!.ancien) f++;
        const morceau = pts.slice(d, f + 1).map((u) => xy(u.log_t, u.log_l));
        p.setPen(dessin.stylo(choisie ? 'accent3' : 'arc1', choisie ? 2.2 : 1.0, choisie ? 1.0 : 0.6, pts[d]!.ancien));
        p.setBrush(null);
        p.drawPolyline(morceau);
        d = f;
      }
      const fin = pts[pts.length - 1];
      if (fin) {
        const q0 = xy(fin.log_t, fin.log_l);
        dessin.etiquette(p, Math.min(x1 - 14, q0.x), q0.y, nom, choisie ? 'accent3' : 'doux', 5);
      }
    }
    const res = this.resultat();
    const q = xy(res.log_t, res.log_l);
    p.setPen(dessin.stylo('accent1', 1.0, 0.7, true));
    p.drawLine(q.x, y0, q.x, y1);
    p.drawLine(x0, q.y, x1, q.y);
    dessin.disque(p, q.x, q.y, 6, couleur_etoile_teff(10 ** res.log_t), 'texte');
  }

  private spectre(p: Peintre, r: Rect): void {
    const bande = new Rect(r.x + 8, r.y + 2, r.w - 16, Math.max(10, r.h - 18));
    dessiner_bande(p, bande, this.sp.value(), this.cl(), this.c_emission.isChecked() ? 'emission' : 'absorption', null, true, this.echelle.currentData() === 'pedagogique', false);
  }
}
