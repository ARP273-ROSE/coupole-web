/**
 * Les calculs de Coupole Web retrouvent ceux de l'appli de bureau Coupole : chaque cas de
 * tests/references/calculs.json (fonction, arguments, résultat Python) est recalculé ici ; écart relatif ≤ 1e-9
 * (absolu ≤ 1e-12 près de zéro), chaînes et booléens identiques.
 */
import { describe, expect, it } from 'vitest';
import REF from '../references/calculs.json';
import * as astro from '../../src/calc/astro';
import * as deux_corps from '../../src/calc/deux_corps';
import * as hr from '../../src/calc/hr';
import * as lumiere from '../../src/calc/lumiere';
import * as py from '../../src/noyau/py';

type Cas = [string, unknown[], unknown];

const FONCTIONS: Record<string, (...a: never[]) => unknown> = {};
for (const [prefixe, mod] of [['astro', astro], ['hr', hr], ['lumiere', lumiere], ['deux_corps', deux_corps], ['py', py]] as const)
  for (const [k, v] of Object.entries(mod)) if (typeof v === 'function') FONCTIONS[prefixe + '.' + k] = v as never;

FONCTIONS['hr.T_SOLEIL'] = () => hr.T_SOLEIL;
FONCTIONS['lumiere.constantes'] = () => [
  lumiere.SIGMA, lumiere.HC_EV_NM, lumiere.X_WIEN, lumiere.WIEN_B, lumiere.R_HYDROGENE, lumiere.E_IONISATION_EV,
];
FONCTIONS['lumiere.temps_retarde'] = ((t: number) =>
  lumiere.temps_retarde(t, (tau) => [30.0 * tau, 5.0 * Math.sin(tau)], [100.0, 20.0], 343.0)) as never;

function normaliser(x: unknown): unknown {
  if (x === 'inf') return Infinity;
  if (x === '-inf') return -Infinity;
  if (x === 'nan') return NaN;
  if (Array.isArray(x)) return x.map(normaliser);
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, normaliser(v)]));
  return x;
}

function comparer(obtenu: unknown, attendu: unknown, chemin: string, ecarts: string[]): void {
  if (typeof attendu === 'number') {
    if (typeof obtenu !== 'number') {
      ecarts.push(`${chemin} : ${String(obtenu)} au lieu de ${attendu}`);
      return;
    }
    if (Number.isNaN(attendu)) {
      if (!Number.isNaN(obtenu)) ecarts.push(`${chemin} : ${obtenu} au lieu de NaN`);
      return;
    }
    if (!Number.isFinite(attendu)) {
      if (obtenu !== attendu) ecarts.push(`${chemin} : ${obtenu} au lieu de ${attendu}`);
      return;
    }
    const ecart = Math.abs(obtenu - attendu);
    if (ecart > 1e-9 * Math.abs(attendu) && ecart > 1e-12) ecarts.push(`${chemin} : ${obtenu} au lieu de ${attendu}`);
    return;
  }
  if (Array.isArray(attendu)) {
    if (!Array.isArray(obtenu) || obtenu.length !== attendu.length) {
      ecarts.push(`${chemin} : ${JSON.stringify(obtenu)} au lieu de ${JSON.stringify(attendu)}`);
      return;
    }
    attendu.forEach((v, i) => comparer(obtenu[i], v, `${chemin}[${i}]`, ecarts));
    return;
  }
  if (attendu && typeof attendu === 'object') {
    const o = obtenu as Record<string, unknown>;
    if (!o || typeof o !== 'object') {
      ecarts.push(`${chemin} : ${String(obtenu)} au lieu d'un objet`);
      return;
    }
    for (const [k, v] of Object.entries(attendu)) comparer(o[k], v, `${chemin}.${k}`, ecarts);
    return;
  }
  if (attendu === null) {
    if (obtenu !== null && obtenu !== undefined) ecarts.push(`${chemin} : ${String(obtenu)} au lieu de null`);
    return;
  }
  if (obtenu !== attendu) ecarts.push(`${chemin} : ${String(obtenu)} au lieu de ${String(attendu)}`);
}

const PAR_FONCTION = new Map<string, Cas[]>();
for (const c of REF as Cas[]) {
  const l = PAR_FONCTION.get(c[0]) ?? [];
  l.push(c);
  PAR_FONCTION.set(c[0], l);
}

describe('calculs identiques à Coupole (Python)', () => {
  it('au moins 3 000 cas de référence', () => {
    expect((REF as Cas[]).length).toBeGreaterThanOrEqual(3000);
  });
  for (const [nom, cas] of PAR_FONCTION) {
    it(`${nom} (${cas.length} cas)`, () => {
      const f = FONCTIONS[nom];
      expect(f, `fonction ${nom} absente`).toBeTypeOf('function');
      const ecarts: string[] = [];
      for (const [, args, res] of cas) {
        const obtenu = (f as (...a: unknown[]) => unknown)(...(normaliser(args) as unknown[]));
        comparer(obtenu, normaliser(res), `${nom}(${JSON.stringify(args)})`, ecarts);
      }
      expect(ecarts.slice(0, 5)).toEqual([]);
    });
  }
});
