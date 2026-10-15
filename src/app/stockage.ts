/**
 * Stockage de la sauvegarde dans le navigateur : IndexedDB (base « coupole-web », magasin « etat », clé
 * « sauvegarde »), avec repli sur localStorage quand IndexedDB est absent ou refusé (navigation privée, réglages du
 * navigateur…).  Tout est protégé (try/catch) : une mémoire indisponible ne casse jamais le site ; rien ne part
 * vers un serveur.
 *
 * La sauvegarde vit en mémoire (`doc()`), les changements sont écrits au plus tard 400 ms après (et tout de suite
 * quand la page est cachée ou quittée).  Première ouverture en 0.4.0 : les anciennes clés « coupole-web:… »
 * (réglages des animations, thème, langue) sont reprises (migration de la version 0).
 */
import * as S from '../contenu/sauvegarde';

const BASE = 'coupole-web';
const MAGASIN = 'etat';
const CLE = 'sauvegarde';
const CLE_LS = 'coupole-web:sauvegarde';
const PREFIXE = 'coupole-web:';

export const APPLICATION = 'coupole-web/' + (typeof __VERSION__ === 'string' ? __VERSION__ : '0');

let courant: S.Sauvegarde = S.vide(APPLICATION);
let support: 'indexeddb' | 'localstorage' | 'aucun' = 'aucun';
let pretP: Promise<S.Sauvegarde> | null = null;
let minuteur = 0;
const abonnes = new Set<() => void>();

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    try {
      if (typeof indexedDB === 'undefined') return ko(new Error('pas d’IndexedDB'));
      const r = indexedDB.open(BASE, 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(MAGASIN)) r.result.createObjectStore(MAGASIN);
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error ?? new Error('IndexedDB'));
      r.onblocked = () => ko(new Error('IndexedDB bloquée'));
    } catch (e) {
      ko(e);
    }
  });
}

async function lireIdb(): Promise<unknown> {
  const db = await ouvrir();
  try {
    return await new Promise((ok, ko) => {
      const t = db.transaction(MAGASIN, 'readonly');
      const r = t.objectStore(MAGASIN).get(CLE);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
  } finally {
    db.close();
  }
}

async function ecrireIdb(texte: string): Promise<void> {
  const db = await ouvrir();
  try {
    await new Promise<void>((ok, ko) => {
      const t = db.transaction(MAGASIN, 'readwrite');
      t.objectStore(MAGASIN).put(texte, CLE);
      t.oncomplete = () => ok();
      t.onerror = () => ko(t.error);
      t.onabort = () => ko(t.error);
    });
  } finally {
    db.close();
  }
}

function lireLs(cle: string): string | null {
  try {
    return window.localStorage.getItem(cle);
  } catch {
    return null;
  }
}

/** Anciennes clés (version 0) regroupées en un objet pour `migrer`. */
function ancienFormat(): unknown | null {
  const reglages: Record<string, unknown> = {};
  let trouve = false;
  const out: Record<string, unknown> = { version: 0, reglages };
  try {
    const ls = window.localStorage;
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (!k || !k.startsWith(PREFIXE)) continue;
      const nom = k.slice(PREFIXE.length);
      let v: unknown;
      try {
        v = JSON.parse(ls.getItem(k) ?? 'null');
      } catch {
        continue;
      }
      if (nom.startsWith('reglages:')) {
        reglages[nom.slice(9)] = v;
        trouve = true;
      } else if (nom === 'theme' || nom === 'langue') {
        out[nom] = v;
        trouve = true;
      }
    }
  } catch {
    return null;
  }
  return trouve ? out : null;
}

/** Charge la sauvegarde (une seule fois) ; ne rejette jamais. */
export function pret(): Promise<S.Sauvegarde> {
  if (pretP) return pretP;
  pretP = (async () => {
    let brut: unknown = null;
    try {
      const t = await lireIdb();
      support = 'indexeddb';
      if (typeof t === 'string') brut = JSON.parse(t);
    } catch {
      support = 'aucun';
    }
    // copie de secours écrite à la fermeture : gardée si elle est plus récente que la base
    const sec = lireLs(CLE_SECOURS);
    if (sec !== null) {
      try {
        const b = JSON.parse(sec) as { modifie?: string };
        const m0 = (brut as { modifie?: string } | null)?.modifie ?? '';
        // « >= » : les dates sont à la seconde ; la copie de secours est écrite après la dernière écriture réussie
        // (elle est effacée à chaque écriture IndexedDB), donc à égalité c'est elle la plus récente
        if (!brut || (typeof b.modifie === 'string' && b.modifie >= m0)) brut = b;
      } catch {
        /* illisible : ignorée */
      }
    }
    if (brut === null) {
      const t = lireLs(CLE_LS);
      if (t !== null) {
        try {
          brut = JSON.parse(t);
        } catch {
          brut = null;
        }
      }
      if (support === 'aucun') {
        try {
          window.localStorage.setItem(PREFIXE + 'essai', '1');
          window.localStorage.removeItem(PREFIXE + 'essai');
          support = 'localstorage';
        } catch {
          support = 'aucun';
        }
      }
    }
    if (brut === null) brut = ancienFormat();
    const s = brut === null ? S.vide(APPLICATION) : S.migrer(brut, APPLICATION);
    // une sauvegarde d'une version future n'est pas écrasée : on travaille sur une copie vide en mémoire
    courant = s ?? S.vide(APPLICATION);
    if (s === null) support = 'aucun';
    return courant;
  })();
  return pretP;
}

export function doc(): S.Sauvegarde {
  return courant;
}

export function stockage(): typeof support {
  return support;
}

/** Signale une modification : écriture différée, abonnés prévenus. */
export function modifie(): void {
  courant.modifie = S.maintenant();
  courant.application = APPLICATION;
  // le minuteur n'est pas relancé à chaque changement (sinon des changements rapprochés repousseraient l'écriture)
  if (!minuteur) minuteur = window.setTimeout(() => void ecrire(), 400);
  for (const f of abonnes) {
    try {
      f();
    } catch {
      /* un abonné défaillant n'empêche rien */
    }
  }
}

export function abonner(f: () => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

export async function ecrire(): Promise<void> {
  clearTimeout(minuteur);
  minuteur = 0;
  const texte = JSON.stringify(courant);
  if (support === 'indexeddb') {
    try {
      await ecrireIdb(texte);
      try {
        window.localStorage.removeItem(CLE_LS);
        window.localStorage.removeItem(CLE_SECOURS);
      } catch {
        /* rien */
      }
      return;
    } catch {
      support = 'localstorage';
    }
  }
  if (support === 'localstorage') {
    try {
      window.localStorage.setItem(CLE_LS, texte);
    } catch {
      /* plein ou interdit : la session continue en mémoire */
    }
  }
}

/** Remplace toute la sauvegarde (import, réinitialisation). */
export function remplacer(s: S.Sauvegarde): void {
  courant = s;
  modifie();
}

/** Page cachée ou quittée : une écriture IndexedDB pourrait ne pas aboutir ; copie synchrone de secours. */
function secours(): void {
  try {
    window.localStorage.setItem(CLE_SECOURS, JSON.stringify(courant));
  } catch {
    /* rien */
  }
  void ecrire();
}
const CLE_SECOURS = 'coupole-web:sauvegarde-secours';

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) secours();
  });
  window.addEventListener('pagehide', secours);
}

// ------------------------------------------------------------------ raccourcis
export function reglagesAnimation(id: string): S.Reglages {
  return { ...(courant.animations[id]?.reglages ?? {}) };
}

export function memoriserReglages(id: string, r: S.Reglages): void {
  const v = S.reglagesValides(r);
  if (Object.keys(v).length) courant.animations[id] = { reglages: v, modifie: S.maintenant() };
  else delete courant.animations[id];
  modifie();
}

export function preference(cle: string): S.ValeurReglage | undefined {
  return courant.preferences[cle];
}

export function memoriserPreference(cle: string, v: S.ValeurReglage): void {
  if (courant.preferences[cle] === v) return;
  courant.preferences[cle] = v;
  modifie();
}

/** Fichier JSON de la sauvegarde, proposé au téléchargement (export manuel ou automatique avant effacement). */
export function telecharger(s: S.Sauvegarde = courant, suffixe = ''): void {
  try {
    const blob = new Blob([S.exporter(s)], { type: 'application/json' });
    const a = document.createElement('a');
    const d = new Date();
    const p = (n: number): string => String(n).padStart(2, '0');
    a.download = `coupole-sauvegarde-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${suffixe}.json`;
    a.href = URL.createObjectURL(blob);
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch {
    /* rien : le navigateur refuse le téléchargement */
  }
}
