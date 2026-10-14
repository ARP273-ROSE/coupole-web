/**
 * Mémoire du navigateur (localStorage), toujours protégée : navigation privée, stockage plein ou interdit, données
 * abîmées… rien de tout cela ne doit casser le site.  Les valeurs relues sont validées par l'appelant.
 */
const PREFIXE = 'coupole-web:';

export function lire<T>(cle: string, defaut: T): T {
  try {
    const s = window.localStorage.getItem(PREFIXE + cle);
    if (s === null) return defaut;
    const v = JSON.parse(s) as unknown;
    return v === null || v === undefined ? defaut : (v as T);
  } catch {
    return defaut;
  }
}

export function ecrire(cle: string, valeur: unknown): void {
  try {
    window.localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur));
  } catch {
    /* stockage indisponible : on continue sans mémoire */
  }
}

export function effacer(cle: string): void {
  try {
    window.localStorage.removeItem(PREFIXE + cle);
  } catch {
    /* rien */
  }
}

/** Objet simple dont les valeurs sont des nombres finis, des booléens, des chaînes courtes ou null. */
export function etatValide(v: unknown): Record<string, number | boolean | string | null> {
  const out: Record<string, number | boolean | string | null> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (!/^[A-Za-z0-9_]{1,40}$/.test(k)) continue;
    if (typeof x === 'number' && Number.isFinite(x)) out[k] = x;
    else if (typeof x === 'boolean') out[k] = x;
    else if (typeof x === 'string' && x.length <= 80) out[k] = x;
    else if (x === null) out[k] = null;
  }
  return out;
}
