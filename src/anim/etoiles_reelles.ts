/**
 * Étoiles réelles dessinées par les animations (Grande Ourse 3D, horloge de la Grande Ourse, lever héliaque,
 * comparaison des repères, diagramme HR) : identifiant de leur fiche au survol, T_eff et couleur vraie (corps noir →
 * CIE 1931 → sRGB, src/calc/couleur_etoile.ts), distance (al) mise à jour.  Données : SIMBAD, Gaia DR3, Hipparcos 2007
 * (requêtes du 14/10/2026) ; même fichier que l'application de bureau.
 */
import DONNEES from '../donnees/genere/etoiles_reelles.json';
import { couleur_etoile, rvb_hex } from '../calc/couleur_etoile';
import { Couleur } from '../noyau/peintre';

type Ligne = [string, number | null, string | null, number | null, number | null, number | null];
const A = (DONNEES as unknown as { animations: Record<string, Record<string, Ligne>> }).animations;

export interface EtoileReelle {
  fiche: string;
  teff: number | null;
  al: number | null;
  al_moins: number | null;
  al_plus: number | null;
}

/** L'étoile `cle` de l'animation `anim` (ex. « bigdipper », « Merak »), ou null. */
export function reelle(anim: string, cle: string): EtoileReelle | null {
  const l = A[anim]?.[cle];
  if (!l) return null;
  return { fiche: l[0], teff: l[1], al: l[3], al_moins: l[4], al_plus: l[5] };
}

/** Couleur vraie de l'étoile (T_eff publiée → corps noir → CIE), ou null si elle n'a pas de T_eff. */
export function couleur_reelle(anim: string, cle: string): Couleur | null {
  const l = A[anim]?.[cle];
  if (!l) return null;
  const [r, g, b] = l[1] !== null ? couleur_etoile(l[1]) : l[2] ? rvb_hex(l[2]) : [NaN, NaN, NaN];
  return Number.isFinite(r) ? new Couleur(r, g, b) : null;
}
