import { unite } from './typographie';

/**
 * Règle typographique appliquée aux textes affichés par les animations (typo.py de Coupole, mêmes cas de référence :
 * tests/references/typographie_reference.json), sur le formateur commun aux ressources et aux applis (typographie.ts :
 * unite, nombre, sci, normaliser, controle ; cas : tests/references/typographie_cas.json) : unités à la manière SI (m·s⁻¹, km·s⁻¹, m·s⁻², W·m⁻², g·cm⁻³, J·K⁻¹…
 * — jamais « m/s »), signe moins typographique (−, U+2212), puissances de dix en exposant (10⁻¹¹, jamais « 10^-11 » ni
 * « e-11 »).
 *  - typo(s) corrige un texte affiché (filet de sécurité : les sources sont déjà écrites ainsi) ;
 *  - interdit(s) dit si un texte affiché enfreint la règle (tests de toutes les animations).
 */
export const MOINS = '−';
const EXPOSANTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '⁺',
};

/** unités composées (barre oblique → exposants négatifs), du plus long au plus court */
export const UNITES: [string, string][] = [
  ['km/s/Mpc', unite('km s-1 Mpc-1')],
  ['m/s²', unite('m s-2')], ['m/s2', unite('m s-2')],
  ['km/s', unite('km s-1')], ['m/s', unite('m s-1')],
  ['W/m²', unite('W m-2')], ['W/m2', unite('W m-2')],
  ['g/cm³', unite('g cm-3')], ['g/cm3', unite('g cm-3')],
  ['kg/m³', unite('kg m-3')], ['kg/m3', unite('kg m-3')],
  ['J/K', unite('J K-1')],
  ['ph/s', unite('ph s-1')],
  ['ans/s', unite('a s-1')], ['years/s', unite('a s-1')],
  ['″/an', unite('″ a-1')], ['″/yr', unite('″ a-1')],
];
const echapper = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RE_UNITES = new RegExp('(?<![A-Za-z])(' + UNITES.map(([u]) => echapper(u)).join('|') + ')(?![A-Za-z0-9])', 'g');
const TABLE_UNITES = new Map(UNITES);
/** « - » utilisé comme signe moins : en début de texte ou après un espace, une parenthèse, un signe, devant un chiffre */
const RE_MOINS = /(^|[\s(\[{=:;,≈~<>±→])-(?=\.?\d)/g;
const RE_PUISSANCE = /10\^([-+]?\d+)/g;

const INTERDITS: RegExp[] = [
  /(?<![A-Za-z])(?:k?m|W|g|kg|J|ph|ans|years|″)\s?\/\s?(?:s|m|cm|K|an|yr)(?![A-Za-z])/,
  /\/s(?![A-Za-z])/,
  /10\^/,
  /\d[eE][-+]?\d/,
  /(^|[\s(\[{=:;,≈~<>±→])-(?=\.?\d)/,
];

/** Le texte selon la règle typographique : unités SI, signe moins, puissances de dix. */
export function typo(s: string): string {
  if (!s) return s;
  return s
    .replace(RE_UNITES, (_m, u: string) => TABLE_UNITES.get(u)!)
    .replace(RE_PUISSANCE, (_m, e: string) => '10' + [...e].map((c) => EXPOSANTS[c] ?? c).join(''))
    .replace(RE_MOINS, (_m, a: string) => a + MOINS);
}

/** Vrai si le texte contient « m/s », « /s », « 10^ », « e-11 » ou un « - » utilisé comme signe moins. */
export function interdit(s: string): boolean {
  return !!s && INTERDITS.some((r) => r.test(s));
}
