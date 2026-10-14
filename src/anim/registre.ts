/**
 * Catalogue des 92 animations ClassAction (University of Nebraska-Lincoln Astronomy Education, Apache 2.0) et
 * chargement à la demande : chaque fichier de src/anim/animations/ devient un morceau JavaScript séparé, téléchargé
 * à l'ouverture de l'animation (ou de sa vignette).
 */
import CATALOGUE from '../donnees/genere/catalogue.json';
import type { ClasseAnimation } from './base';

export interface Entree {
  id: string;
  /** clé des textes (id en minuscules) */
  cle: string;
  theme: string;
  titre: string;
  fichier: string;
  module: string;
  classe: string;
}

const C = CATALOGUE as unknown as {
  themes: string[];
  animations: [string, string, string, string, string][];
  ordre: string[];
  lot1: string[];
};

export const THEMES: readonly string[] = C.themes;
export const LOT1: readonly string[] = C.lot1;

/** Entrées dans l'ordre du catalogue de Coupole (lots successifs). */
export const ENTREES: readonly Entree[] = C.ordre.map((id) => {
  const a = C.animations.find((x) => x[0] === id)!;
  const [module, classe] = a[4].split(':') as [string, string];
  return { id, cle: id.toLowerCase(), theme: a[1], titre: a[2], fichier: a[3], module, classe };
});

export const PAR_ID: ReadonlyMap<string, Entree> = new Map(ENTREES.map((e) => [e.id, e]));

const MODULES = import.meta.glob<Record<string, unknown>>('./animations/*.ts');

function chemin(e: Entree): string {
  return `./animations/${e.module}.ts`;
}

/** L'animation est-elle déjà transposée dans Coupole Web ? */
export function disponible(e: Entree): boolean {
  return chemin(e) in MODULES;
}

export function disponibles(): Entree[] {
  return ENTREES.filter(disponible);
}

/** Classe de l'animation (module chargé à la demande). */
export async function charger(e: Entree): Promise<ClasseAnimation> {
  const f = MODULES[chemin(e)];
  if (!f) throw new Error(`animation absente : ${e.id}`);
  const m = await f();
  const cls = m[e.classe] as ClasseAnimation | undefined;
  if (!cls) throw new Error(`classe absente : ${e.module}.${e.classe}`);
  return cls;
}
