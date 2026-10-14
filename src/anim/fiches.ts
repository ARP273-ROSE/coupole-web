/**
 * Fiches au survol (étoiles et nébuleuses) : chargées à la demande (morceau séparé), la première fois qu'une fiche est
 * demandée.  Chaque valeur porte sa source (SIMBAD, Gaia DR3, Hipparcos 2007, article) ; schéma :
 * fiche.schema.json du jeu de données d'Orion en 3D.  Même fichier que l'application de bureau.
 */

export interface Valeur {
  valeur: unknown;
  source?: string;
  incertitude?: number | null;
  moins?: number | null;
  plus?: number | null;
  n?: number;
  note?: string | null;
}

export interface Alternative {
  d: number;
  moins?: number;
  plus?: number;
  ref?: string;
  note?: string;
}

export interface Distance {
  pc?: number;
  pc_moins?: number;
  pc_plus?: number;
  al?: number;
  al_moins?: number;
  al_plus?: number;
  niveau?: string;
  methode?: string;
  source?: string;
  peu_fiable?: boolean;
  pourquoi?: string;
  affichage_suggere?: { pc: number; al?: number; pourquoi?: string } | null;
  alternatives?: Alternative[];
}

export interface Fiche {
  id: string;
  categorie: 'etoile' | 'nebuleuse';
  noms: { fr: string; en: string; source?: string };
  designations?: string[];
  type?: { fr?: string; en?: string; source?: string };
  type_spectral?: Valeur;
  V?: Valeur;
  B_V?: Valeur;
  M_V?: Valeur;
  distance?: Distance;
  teff?: Valeur;
  rayon_Rsun?: Valeur;
  luminosite_log_Lsun?: Valeur;
  taille_arcmin?: Valeur;
  taille_pc?: Valeur;
  longueur_pc?: Record<string, unknown>;
  diametre_deg?: Record<string, unknown>;
  arc_deg?: Record<string, unknown>;
  age?: Record<string, unknown>;
  etoiles_excitatrices?: string[];
  couleur?: string;
}

interface Donnees {
  fiches: Record<string, Fiche>;
  animations: Record<string, Record<string, string>>;
}

let donnees: Donnees | null = null;
let promesse: Promise<void> | null = null;

/** Charge les fiches (une fois) ; sans effet si déjà chargées. */
export function charger_fiches(): Promise<void> {
  if (donnees) return Promise.resolve();
  if (!promesse)
    promesse = import('../donnees/genere/fiches.json').then((m) => {
      donnees = (m.default ?? m) as unknown as Donnees;
    });
  return promesse;
}

/** Fiche d'identifiant id (null si inconnue ou pas encore chargée). */
export function fiche(id: string): Fiche | null {
  return donnees?.fiches[id] ?? null;
}

/** Toutes les fiches chargées (tests). */
export function toutes_les_fiches(): Readonly<Record<string, Fiche>> {
  return donnees?.fiches ?? {};
}
