/**
 * Spectres sur bases physiques, communs à l'Explorateur de spectres et à la Parallaxe spectroscopique : un seul
 * modèle (src/calc/spectres_physiques.ts, données modele_spectres.json : Saha–Boltzmann sur des atmosphères ATLAS9,
 * 133 raies NIST, bandes TiO et CH), bande de spectre colorée (continu de Planck × raies, couleurs CIE 1931 → sRGB),
 * et signalement des cas extrapolés ou bornés.
 */
import DONNEES from '../donnees/genere/modele_spectres.json';
import ATMOSPHERE from '../donnees/genere/spectres_atmosphere.json';
import FINES from '../donnees/genere/intensites_fines.json';
import { couleur_etoile } from '../calc/couleur_etoile';
import { type Etalonnage, ModeleSpectres } from '../calc/spectres_physiques';
import { tr } from '../i18n/i18n';
import * as dessin from '../noyau/dessin';
import { Couleur, type Peintre, Rect } from '../noyau/peintre';

let modeleUnique: ModeleSpectres | null = null;
/** contraste pédagogique de la bande : largeur minimale des raies (nm) et exposant appliqué à I/I_continu */
export const CONTRASTE_LARGEUR = 0.8;
export const CONTRASTE_GAMMA = 3;

/** Le modèle (construit une fois). */
export function modele(): ModeleSpectres {
  if (!modeleUnique) modeleUnique = new ModeleSpectres(DONNEES, FINES);
  return modeleUnique;
}

export const FAMILLES = ['he_ii', 'he_i', 'h', 'metaux_ionises', 'metaux', 'molecules'] as const;
export const COULEURS_FAMILLES: Record<string, string> = {
  he_ii: 'arc1', he_i: 'accent2', h: 'accent3', metaux_ionises: 'accent1', metaux: 'horizon', molecules: 'terre', ch: 'mars',
};
export const LAMBDA_MIN = 380.0;
export const LAMBDA_MAX = 720.0;

/** Drapeaux de l'étalonnage (texte du modèle) → clé de texte (FR/EN). */
const DRAPEAUX: [string, string][] = [
  ['hors domaine Malkov', 'spectres_d_borne'],
  ['hors table', 'spectres_d_borne'],
  ['interpolé', 'spectres_d_interpole'],
  ['M_V via BC_V', 'spectres_d_bc_naines'],
];

const ATM = ATMOSPHERE as unknown as { classes: Record<string, number[]> };

/** Codes d'extrapolation de l'atmosphère (bit 1 : log g hors grille ATLAS9 ; bit 2 : T_eff < 3 500 K) au type t. */
export function extrapolation_atmosphere(t: number, classe: string): number {
  const tab = ATM.classes[classe];
  if (!tab) return 0;
  const tt = Math.max(0, Math.min(tab.length - 1, t));
  const i = Math.floor(tt);
  const j = Math.min(tab.length - 1, Math.ceil(tt));
  return (tab[i] ?? 0) | (tab[j] ?? 0);
}

/** Remarques à afficher (textes traduits) : étalonnage borné ou interpolé, atmosphère extrapolée. */
export function remarques(t: number, classe: string, e: Etalonnage | null = null): string[] {
  const et = e ?? modele().etalonnage(t, classe);
  const cles = new Set<string>();
  for (const d of et.drapeaux) for (const [debut, cle] of DRAPEAUX) if (d.startsWith(debut)) cles.add(cle);
  const a = extrapolation_atmosphere(t, classe);
  if (a & 1) cles.add('spectres_d_logg');
  if (a & 2) cles.add('spectres_d_froide');
  return [...cles].map((k) => tr(k));
}

// ------------------------------------------------------------ couleurs
function lineaire(v: number): number {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function srgb(v: number): number {
  const x = Math.max(0, Math.min(1, v));
  return Math.round(255 * (x > 0.0031308 ? 1.055 * x ** (1 / 2.4) - 0.055 : 12.92 * x));
}

const LIN_LAMBDA = new Map<number, [number, number, number]>();
/** Couleur CIE d'une longueur d'onde en lumière linéaire (pour l'éclairer d'une intensité). */
function couleur_lineaire(lam: number): [number, number, number] {
  const k = Math.round(lam * 10);
  let c = LIN_LAMBDA.get(k);
  if (!c) {
    const [r, g, b] = modele().couleur_lambda(k / 10);
    c = [lineaire(r), lineaire(g), lineaire(b)];
    LIN_LAMBDA.set(k, c);
  }
  return c;
}

/** Couleur d'une longueur d'onde éclairée à l'intensité i (0–1, lumière linéaire). */
export function couleur_eclairee(lam: number, i: number): Couleur {
  const [r, g, b] = couleur_lineaire(lam);
  const k = Math.max(0, i);
  return new Couleur(srgb(r * k), srgb(g * k), srgb(b * k));
}

/** Couleur d'une étoile de température teff (corps noir → CIE 1931 → sRGB), la même dans toutes les animations. */
export function couleur_etoile_teff(teff: number): Couleur {
  const [r, g, b] = couleur_etoile(teff);
  return new Couleur(r, g, b);
}

// ------------------------------------------------------------ bande de spectre
export type ModeSpectre = 'continu' | 'emission' | 'absorption';

interface Echantillons {
  cle: string;
  couleurs: Couleur[];
}
let cache: Echantillons | null = null;
let cache2: Echantillons | null = null;

/**
 * Couleurs des n colonnes d'une bande de spectre (λ de LAMBDA_MIN à LAMBDA_MAX) : continu de Planck à T_eff,
 * multiplié par I/I_continu (raies et bandes moléculaires des familles choisies) en absorption.  Les raies sont élargies
 * à la largeur d'une colonne au moins (largeur équivalente conservée) pour rester visibles.  Mis en cache (deux
 * dernières bandes).
 */
export function colonnes(t: number, classe: string, mode: ModeSpectre, familles: readonly string[] | null, n: number, contraste = false): Couleur[] {
  const cle = `${t}|${classe}|${mode}|${familles ? familles.join(',') : '*'}|${n}|${contraste}`;
  if (cache?.cle === cle) return cache.couleurs;
  if (cache2?.cle === cle) {
    [cache, cache2] = [cache2, cache];
    return cache!.couleurs;
  }
  const m = modele();
  const teff = m.etalonnage(t, classe).teff;
  const pas = (LAMBDA_MAX - LAMBDA_MIN) / n;
  const lams = Array.from({ length: n }, (_, k) => LAMBDA_MIN + (k + 0.5) * pas);
  // contraste pédagogique : raies élargies (résolution de CONTRASTE_LARGEUR nm) et approfondies (I/I_c)^CONTRASTE_GAMMA
  const resol = contraste ? Math.max(0.25, 1.2 * pas, CONTRASTE_LARGEUR) : Math.max(0.25, 1.2 * pas);
  let res = mode === 'absorption' ? m.spectre(t, classe, lams, familles ? [...familles] : null, resol) : null;
  if (res && contraste) res = res.map((x) => Math.max(0, x) ** CONTRASTE_GAMMA);
  const couleurs = lams.map((lam, k) => {
    const i = ModeleSpectres.continu_relatif(teff, lam) * (res ? Math.max(0, res[k]!) : 1);
    return couleur_eclairee(lam, Number.isFinite(i) ? i : 0);
  });
  cache2 = cache;
  cache = { cle, couleurs };
  return couleurs;
}

/**
 * Dessine la bande de spectre dans r : continu (mode « continu »), continu et raies d'absorption (« absorption ») ou
 * raies d'émission sur fond noir (« emission »).  Les graduations (nm) sont dessinées sous la bande si `graduer`.
 */
export function dessiner_bande(
  p: Peintre, r: Rect, t: number, classe: string, mode: ModeSpectre, familles: readonly string[] | null, graduer = true, contraste = false, note = true,
): void {
  if (!(r.w > 2) || !(r.h > 2)) return;
  p.save();
  p.setPen(null);
  p.fillRect(r, new Couleur(8, 8, 10));
  if (mode === 'emission') {
    const m = modele();
    const raies = m.raies(t, classe).filter((x) => familles === null || familles.includes(x.famille));
    const pmax = Math.max(1e-6, ...raies.map((x) => x.profondeur));
    const kx = r.w / (LAMBDA_MAX - LAMBDA_MIN);
    for (const x of raies) {
      if (x.lambda < LAMBDA_MIN || x.lambda > LAMBDA_MAX) continue;
      const a = Math.min(1, Math.max(0.12, x.profondeur / pmax));
      const largeur = Math.max(1.6, (x.fwhm ?? 0) * kx, contraste ? CONTRASTE_LARGEUR * kx : 0);
      const col = couleur_eclairee(x.lambda, 1).setAlphaF(a);
      p.fillRect(new Rect(r.left + (x.lambda - LAMBDA_MIN) * kx - largeur / 2, r.top, largeur, r.h), col);
    }
  } else {
    const n = Math.max(60, Math.min(720, Math.round(r.w)));
    const cols = colonnes(t, classe, mode, familles, n, contraste);
    const w = r.w / n;
    for (let k = 0; k < n; k++) p.fillRect(new Rect(r.left + k * w, r.top, w + 0.6, r.h), cols[k]!);
  }
  p.setPen(dessin.stylo('grille', 1.0));
  p.setBrush(null);
  p.drawRect(r);
  p.restore();
  if (graduer) {
    dessin.police(p, 0.8);
    const pasGrad = r.w < 300 ? 100 : 50;
    for (let lam = 400; lam <= 700; lam += pasGrad)
      dessin.texte(p, r.left + (r.w * (lam - LAMBDA_MIN)) / (LAMBDA_MAX - LAMBDA_MIN), r.bottom + 10, `${lam} nm`, 'doux');
    dessin.police(p, 1 / 0.8);
  }
  // le contraste pédagogique est dit à l'écran (jamais une échelle trompeuse sans le dire)
  if (contraste && note && mode !== 'continu') {
    dessin.police(p, 0.8);
    dessin.texte(p, r.left, r.bottom + (graduer ? 26 : 10), tr('anim_spectrum010_contraste_note'), 'accent1', { centre: false });
    dessin.police(p, 1 / 0.8);
  }
}
