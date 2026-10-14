/**
 * Planetary Configurations Simulator (NAAP) : deux planètes sur des orbites circulaires coplanaires ; l'une sert
 * d'observatoire.  Les configurations reviennent à chaque période synodique S (1/S = |1/P₁ − 1/P₂|) : opposition,
 * quadratures et conjonction pour une planète supérieure ; conjonctions et plus grandes élongations (sin E = a_int /
 * a_ext) pour une planète inférieure.  L'animation peut s'arrêter ou faire une pause à chaque configuration.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import { Animation, angle, type Choix, type Coche, nombre, type Reglage } from '../base';
import { elongation_signee } from './phases_venus';

const PLANETES: [string, number][] = [['mercure', 0.387_098], ['venus', 0.723_332], ['terre', 1.000_001], ['mars', 1.523_679], ['jupiter', 5.2026], ['saturne', 9.5549]];

interface Systeme {
  S: number;
  temps: number[];
  noms: string[];
  superieure: boolean;
  elongation_max: number | null;
}

export function configurations(a_obs: number, a_cible: number): Systeme {
  const p_obs = astro.periode_annees(a_obs),
    p_cible = astro.periode_annees(a_cible);
  const s = astro.periode_synodique(p_obs, p_cible);
  const a_int = Math.min(a_obs, a_cible),
    a_ext = Math.max(a_obs, a_cible);
  const t1 = Math.acos(a_int / a_ext) / ((2 * Math.PI) / s);
  const superieure = a_cible > a_obs;
  const noms = superieure ? ['opposition', 'quadrature_est', 'conjonction', 'quadrature_ouest'] : ['conj_inf', 'elong_ouest', 'conj_sup', 'elong_est'];
  return { S: s, temps: [0.0, t1, s / 2, s - t1], noms, superieure, elongation_max: superieure ? null : (Math.asin(a_cible / a_obs) * 180) / Math.PI };
}

export function positions(a_obs: number, a_cible: number, t: number): [[number, number], [number, number]] {
  return [a_obs, a_cible].map((a) => {
    const th = (2 * Math.PI * t) / astro.periode_annees(a);
    return [a * Math.cos(th), a * Math.sin(th)];
  }) as [[number, number], [number, number]];
}

export class Configurations extends Animation {
  static override ID = 'configurationssimulator';

  a_obs!: Reglage;
  p_obs!: Choix;
  a_cible!: Reglage;
  p_cible!: Choix;
  action!: Choix;
  duree_pause!: Reglage;
  c_elong!: Coche;
  t = 0.0;
  private reprise = 0;
  private repriseActive = false;

  override construire(): void {
    const liste: [string, number][] = [['anim_gravcalc_libre', 0.0], ...PLANETES.map(([n, a]) => ['anim_planete_' + n, a] as [string, number])];
    this.a_obs = this.curseur('a_obs', 0.25, 10.0, 1.0, { dec: 3, unite: 'ua' });
    this.p_obs = this.choix('p_obs', liste, 1.000_001);
    this.a_cible = this.curseur('a_cible', 0.25, 10.0, 2.4, { dec: 3, unite: 'ua' });
    this.p_cible = this.choix('p_cible', liste, 0.0);
    this.p_obs.activated.connect(() => this.prereglage(this.p_obs, this.a_obs));
    this.p_cible.activated.connect(() => this.prereglage(this.p_cible, this.a_cible));
    this.action = this.choix('action', [['anim_configurationssimulator_continuer', 'continuer'], ['anim_configurationssimulator_arreter', 'arreter'], ['anim_configurationssimulator_pause', 'pause']], 'continuer');
    this.duree_pause = this.curseur('duree_pause', 1.0, 15.0, 5.0, { dec: 0, unite: 's' });
    this.c_elong = this.coche('elongation', true);
    this.t = 0.0;
  }

  private prereglage(combo: Choix, reglage: Reglage): void {
    if (combo.currentData()) reglage.setValue(combo.currentData() as number);
  }

  private arreterReprise(): void {
    if (this.repriseActive) clearTimeout(this.reprise);
    this.repriseActive = false;
  }

  override etat_initial(): void {
    this.t = 0.0;
    this.arreterReprise();
  }

  systeme(): Systeme {
    return configurations(this.a_obs.value(), this.a_cible.value());
  }

  /** (instant, nom) de la prochaine configuration après t. */
  prochain(t: number): [number, string] {
    const c = this.systeme();
    const s = c.S;
    if (!Number.isFinite(s)) return [Infinity, ''];
    const n = Math.floor(t / s);
    for (const k of [n, n + 1]) for (let i = 0; i < 4; i++) if (k * s + c.temps[i]! > t + 1e-12) return [k * s + c.temps[i]!, c.noms[i]!];
    return [Infinity, ''];
  }

  override avancer(dt: number): void {
    const pas = (dt * Math.min(astro.periode_annees(this.a_obs.value()), astro.periode_annees(this.a_cible.value()))) / 10.0;
    const t1 = this.t + pas;
    const [tp] = this.prochain(this.t);
    const action = this.action.currentData();
    if (action !== 'continuer' && t1 >= tp) {
      this.t = tp;
      if (this.en_lecture) this.basculer_lecture();
      if (action === 'pause') {
        this.arreterReprise();
        this.repriseActive = true;
        this.reprise = setTimeout(() => {
          this.repriseActive = false;
          if (!this.en_lecture) this.basculer_lecture();
        }, Math.trunc(this.duree_pause.value() * 1000)) as unknown as number;
      }
      return;
    }
    this.t = t1;
  }

  override basculer_lecture(): void {
    if (this.en_lecture) this.arreterReprise();
    super.basculer_lecture();
    if (this.en_lecture) this.t += 1e-9;
  }

  override valeurs(): [string, string][] {
    const c = this.systeme();
    const [obs, cible] = positions(this.a_obs.value(), this.a_cible.value(), this.t);
    const e = elongation_signee(cible, obs);
    const [tp, nom] = this.prochain(this.t);
    const out: [string, string][] = [
      [tr('anim_configurationssimulator_s'), Number.isFinite(c.S) ? `${nombre(c.S, 3)} ${tr('anim_u_annees')}` : '—'],
      [tr('anim_c_elongation'), `${angle(Math.abs(e), 1)} ${tr(e > 0 ? 'anim_est' : 'anim_ouest')}`],
      [tr('anim_configurationssimulator_temps'), `${nombre(this.t, 3)} ${tr('anim_u_annees')}`],
    ];
    if (nom)
      out.push([tr('anim_configurationssimulator_prochain'), tr('anim_configurationssimulator_dans', { nom: tr('anim_configurationssimulator_e_' + nom), j: nombre((tp - this.t) * astro.ANNEE_SIDERALE_J, 0) })]);
    if (c.elongation_max !== null) out.push([tr('anim_configurationssimulator_elong_max'), angle(c.elongation_max, 1)]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const haut = rect.h * 0.8;
    this.orbites(p, new Rect(rect.x, rect.y, rect.w, haut));
    this.frise(p, dessin.cadre(p, new Rect(rect.x, rect.y + haut, rect.w, rect.h - haut)));
  }

  private orbites(p: Peintre, r: Rect): void {
    const a1 = this.a_obs.value(),
      a2 = this.a_cible.value();
    const cx = r.cx,
      cy = r.cy;
    const k = (Math.min(r.w, r.h) * 0.46) / Math.max(a1, a2);
    const [obs, cible] = positions(a1, a2, this.t);
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(null);
    for (const a of [a1, a2]) p.drawEllipse(cx, cy, a * k, a * k);
    dessin.disque(p, cx, cy, Math.max(7.0, k * 0.06), 'soleil');
    const ox = cx + k * obs[0],
      oy = cy - k * obs[1];
    const tx = cx + k * cible[0],
      ty = cy - k * cible[1];
    if (this.c_elong.isChecked()) {
      p.setPen(dessin.stylo('accent1', 1.2, 0.8));
      p.drawLine(ox, oy, cx, cy);
      p.drawLine(ox, oy, tx, ty);
      const e = elongation_signee(cible, obs);
      const ls = (Math.atan2(-obs[1], -obs[0]) * 180) / Math.PI;
      const rr = 26.0;
      p.drawArc(new Rect(ox - rr, oy - rr, 2 * rr, 2 * rr), Math.trunc(ls * 16), Math.trunc(e * 16));
    }
    dessin.disque(p, ox, oy, 7, 'terre', 'texte');
    dessin.disque(p, tx, ty, 7, 'mars', 'texte');
    dessin.texte(p, ox, oy - 15, tr('anim_configurationssimulator_observateur'), 'texte', { fond: true });
    dessin.texte(p, tx, ty - 15, tr('anim_configurationssimulator_cible'), 'texte', { fond: true });
  }

  /** Un cycle synodique : les quatre configurations et l'instant présent. */
  private frise(p: Peintre, r: Rect): void {
    const c = this.systeme();
    const s = c.S;
    if (!Number.isFinite(s)) return;
    const x0 = r.x + 10,
      x1 = r.right - 10;
    const y = r.cy - 4;
    p.setPen(dessin.stylo('grille', 1.2));
    p.drawLine(x0, y, x1, y);
    dessin.police(p, 0.75);
    c.temps.forEach((tk, i) => {
      const x = x0 + ((x1 - x0) * tk) / s;
      dessin.disque(p, x, y, 4, 'accent2');
      const texte = tr('anim_configurationssimulator_e_' + c.noms[i]);
      const demi = p.fontMetrics().horizontalAdvance(texte) / 2 + 2;
      dessin.texte(p, Math.min(Math.max(x, x0 + demi), x1 - demi), y + (i % 2 === 0 ? 14 : -13), texte, 'doux');
    });
    dessin.police(p, 1 / 0.75);
    const x = x0 + (x1 - x0) * (pmod(this.t, s) / s);
    p.setPen(dessin.stylo('accent3', 2.0));
    p.drawLine(x, y - 9, x, y + 5);
  }
}
