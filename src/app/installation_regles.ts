/**
 * Installation de l'application : règles pures (sans DOM), testées à part.
 *  - plateforme : quel navigateur, donc quelle façon d'installer ;
 *  - doitProposer : quand proposer l'installation sans harceler (après un premier usage : 2ᵉ visite ou 30 s
 *    d'utilisation ; « Plus tard » mémorisé 30 jours ; « Ne plus proposer » ; jamais si déjà installée).
 */

export type Plateforme =
  | 'chromium' // Chrome, Edge, Opera, Samsung Internet… (Android et ordinateur) : beforeinstallprompt
  | 'ios' // iPhone, iPad (y compris iPadOS qui se présente comme un Mac) : Partager → Sur l'écran d'accueil
  | 'mac-safari' // Safari 17+ sur macOS : Fichier → Ajouter au Dock
  | 'firefox-android' // menu ⋮ → Installer / Ajouter à l'écran d'accueil
  | 'firefox' // Firefox pour ordinateur : pas d'installation
  | 'autre';

export interface Navigateur {
  ua: string;
  platform?: string;
  maxTouchPoints?: number;
}

export function estIOS(n: Navigateur): boolean {
  if (/iPhone|iPad|iPod/.test(n.ua)) return true;
  // iPadOS 13+ se présente comme un Mac (« Macintosh », « MacIntel ») mais a un écran tactile
  return (/Macintosh/.test(n.ua) || n.platform === 'MacIntel') && (n.maxTouchPoints ?? 0) > 1;
}

export function plateforme(n: Navigateur): Plateforme {
  const ua = n.ua;
  if (estIOS(n)) return 'ios';
  if (/Android/.test(ua) && /Firefox\//.test(ua)) return 'firefox-android';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Chrome\/|Chromium\/|Edg\/|OPR\/|SamsungBrowser\//.test(ua)) return 'chromium';
  if (/Macintosh/.test(ua) && /Safari\//.test(ua)) {
    const v = /Version\/(\d+)/.exec(ua);
    return v && Number(v[1]) >= 17 ? 'mac-safari' : 'autre';
  }
  return 'autre';
}

export interface EtatInstallation {
  visites: number; // visites (une par session)
  utilise: number; // secondes d'utilisation (page visible), cumulées
  plusTard: number; // date (ms) du dernier « Plus tard », 0 sinon
  jamais: boolean; // « Ne plus proposer »
}

export const ETAT_VIDE: EtatInstallation = { visites: 0, utilise: 0, plusTard: 0, jamais: false };
export const DELAI_PLUS_TARD = 30 * 24 * 3600 * 1000;
export const SECONDES_USAGE = 30;

export function etatValide(v: unknown): EtatInstallation {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const n = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
  return { visites: Math.floor(n(o.visites)), utilise: n(o.utilise), plusTard: n(o.plusTard), jamais: o.jamais === true };
}

/**
 * Proposer l'installation ?  Seulement si elle est possible ici (`possible` : invite du navigateur captée pour
 * Chromium, ou plateforme à instructions : iOS, Safari macOS, Firefox Android), pas déjà installée, jamais refusée
 * définitivement, pas reportée depuis moins de 30 jours, et après un premier usage (2ᵉ visite ou 30 s).
 */
export function doitProposer(e: EtatInstallation, maintenant: number, installee: boolean, possible: boolean): boolean {
  if (installee || !possible || e.jamais) return false;
  if (e.plusTard && maintenant - e.plusTard < DELAI_PLUS_TARD) return false;
  return e.visites >= 2 || e.utilise >= SECONDES_USAGE;
}

/** Plateformes où l'on propose de soi-même l'installation (avec des instructions quand il n'y a pas d'invite). */
export function proposable(p: Plateforme, inviteCaptee: boolean): boolean {
  return inviteCaptee || p === 'ios' || p === 'mac-safari' || p === 'firefox-android';
}
