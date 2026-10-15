/**
 * Type d'éclipse par la géométrie réelle : parité avec le bureau (tests/references/eclipses_geo_cas.json) et les 133
 * éclipses de la table (2015–2044) retrouvées à leur maximum (géométrie DE440, src/donnees/genere/eclipses_geometrie.json).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as G from '../../src/calc/eclipses_geo';
import GEO from '../../src/donnees/genere/eclipses_geometrie.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const C: any = JSON.parse(readFileSync(join(__dirname, '..', 'references', 'eclipses_geo_cas.json'), 'utf8'));
const proche = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

describe('type d’éclipse : géométrie réelle', () => {
  it('identique au bureau', () => {
    for (const [genre, nom, x, delta, attendu] of C.cas) {
      const r = genre === 'soleil' ? G.eclipseSoleil(x, delta) : G.eclipseLune(x, delta);
      expect(r.type, nom).toBe(attendu.type);
      for (const [k, v] of Object.entries(attendu)) if (typeof v === 'number') expect(proche((r as unknown as Record<string, number>)[k]!, v), `${nom} ${k}`).toBe(true);
    }
    for (const [p, n, attendu] of C.orbite) G.positionOrbite(G.D_LUNE_KM, p, n).forEach((v, i) => expect(proche(v, attendu[i]), `${p} ${n}`).toBe(true));
  });

  it('les 133 éclipses de la table, à leur maximum', () => {
    const T: Record<string, string> = { total: 'totale', annular: 'annulaire', hybrid: 'hybride', partial: 'partielle', penumbral: 'penombrale' };
    let n = 0;
    for (const [cle, e] of Object.entries(GEO.eclipses as Record<string, { type: string; gamma: number; d_km: number; s_km: number }>)) {
      const delta = Math.abs(e.gamma) * G.R_TERRE_KM;
      const x = Math.sqrt(e.d_km ** 2 - delta ** 2);
      const r = cle[0] === 'S' ? G.eclipseSoleil(-x, delta, e.s_km) : G.eclipseLune(x, delta, e.s_km);
      expect(r.type, cle).toBe(T[e.type]);
      n++;
    }
    expect(n).toBe(133);
  });

  it('cas de référence : alignement au périgée → totale, à l’apogée → annulaire, gamma 0,8 → totale, 1,3 R⊕ → partielle', () => {
    expect(G.eclipseSoleil(-G.PERIGEE_MIN_KM, 0).type).toBe('totale');
    expect(G.eclipseSoleil(-G.APOGEE_MAX_KM, 0).type).toBe('annulaire');
    expect(G.eclipseSoleil(-G.PERIGEE_MIN_KM, 0.8 * G.R_TERRE_KM).type).toBe('totale');
    expect(G.eclipseSoleil(-G.D_LUNE_KM, 1.3 * G.R_TERRE_KM).type).toBe('partielle');
    expect(G.eclipseSoleil(-G.D_LUNE_KM, 3 * G.R_TERRE_KM).type).toBe('aucune');
    // bande de totalité au périgée, éclipse centrale : ~220 km
    expect(G.eclipseSoleil(-G.PERIGEE_MIN_KM, 0).largeur_km).toBeGreaterThan(200);
    expect(G.eclipseLune(G.D_LUNE_KM, 0).type).toBe('totale');
    expect(G.eclipseLune(G.D_LUNE_KM, 0.9 * G.R_TERRE_KM).type).toBe('partielle');
    expect(G.eclipseLune(G.D_LUNE_KM, 1.1 * G.R_TERRE_KM).type).toBe('penombrale');
    expect(G.eclipseLune(G.D_LUNE_KM, 2 * G.R_TERRE_KM).type).toBe('aucune');
  });
});
