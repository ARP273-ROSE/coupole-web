/**
 * Calculateurs de TD, « Parallaxe (TP du cours) » : lecteur de coordonnées (cas communs avec l'appli de bureau),
 * géométrie et calculs contre SageMath (corde ≤ 1 mm) et contre Coupole (astropy), Lune (Meeus) contre skyfield + DE440.
 */
import { describe, expect, test } from 'vitest';
import { CoordonneeIllisible, lireAltitude, lireAngle, lirePosition } from '../../src/calc/coordonnees';
import * as T from '../../src/calc/td_parallaxe';
import { lunePosition } from '../../src/calc/lune_meeus';
import COORD from '../references/td_coordonnees_cas.json';
import CAS from '../references/td_cas.json';
import SAGE from '../references/td_parallaxe_sage.json';
import REF from '../references/td_parallaxe_reference.json';
import SKY from '../references/parallaxe_reference_skyfield.json';

type CasCoord = { type: string; texte: string; attendu?: number | number[]; erreur?: string; notes?: string[] };

describe('lecteur de coordonnées', () => {
  test.each(COORD.cas as CasCoord[])('$type « $texte »', (c) => {
    const f = c.type === 'angle' ? lireAngle : lirePosition;
    if (c.erreur) {
      let cle = '';
      try {
        f(c.texte);
      } catch (e) {
        if (e instanceof CoordonneeIllisible) cle = e.cle;
      }
      expect(cle).toBe(c.erreur);
      return;
    }
    const r = f(c.texte) as { valeur?: number; lat?: number; lon?: number; notes: string[] };
    const v = c.type === 'angle' ? [r.valeur!] : [r.lat!, r.lon!];
    const a = Array.isArray(c.attendu) ? c.attendu : [c.attendu!];
    v.forEach((x, k) => expect(x).toBeCloseTo(a[k]!, 9));
    for (const n of c.notes ?? []) expect(r.notes).toContain(n);
  });
  test('altitudes', () => {
    expect(lireAltitude('1,2 km')).toBe(1200);
    expect(lireAltitude('')).toBe(0);
    expect(() => lireAltitude('haut')).toThrow(CoordonneeIllisible);
  });
});

const lieux = (c: { o1: (number | null)[]; o2: (number | null)[] }): [T.Lieu, T.Lieu] =>
  [c.o1, c.o2].map((x) => T.lieu(x[0]!, x[1]!, x[2]!, x[3]!, x[4] ?? null)) as [T.Lieu, T.Lieu];

describe('géométrie et calculs', () => {
  const cas = new Map(CAS.cas.map((c) => [c.id, c]));
  const ref = new Map(REF.cas.map((c) => [c.id, c]));
  test.each(SAGE.cas)('$id', (s) => {
    const c = cas.get(s.id)!;
    const [o1, o2] = lieux(c as never);
    const r = T.calculer(T.entrees(o1, o2, 'iss', { configuration: c.config }));
    const g = r.geometrie;
    expect(Math.abs(g.corde_km - s.corde_km)).toBeLessThan(1e-6); // 1 mm
    expect(Math.abs(g.surface_km - s.surface_km)).toBeLessThan(1e-6);
    expect(Math.abs(g.fleche_km - s.fleche_km)).toBeLessThan(1e-6);
    expect(g.profondeur_deg[0]).toBeCloseTo(s.profondeur_deg[0]!, 9);
    expect(g.angle_centre_deg).toBeCloseTo(s.angle_centre_deg, 9);
    expect(r.configuration === 'entre').toBe(s.entre);
    expect(r.sujet_corde.D_km / s.D_corde_km).toBeCloseTo(1, 9);
    expect(r.exact!.distances_km[0] / s.distances_km[0]!).toBeCloseTo(1, 8);
    expect(Math.abs(r.exact!.altitude_km - s.altitude_km)).toBeLessThan(1e-3);
    const p = ref.get(s.id)!;
    expect(Math.abs(g.corde_km - p.corde_km)).toBeLessThan(1e-6);
    expect(r.incertitudes.sujet_total_km / p.sigma_sujet_km).toBeCloseTo(1, 5);
  });
  test('erreurs et inversion', () => {
    expect(() => T.calculSujet(100, 30, 30)).toThrow(T.ErreurTP);
    expect(T.inversionProbable(T.lieu(48.8566, 2.3522), T.lieu(4.8357, 45.764))).toBe(0);
    expect(T.inversionProbable(T.lieu(48.8566, 2.3522), T.lieu(45.764, 4.8357))).toBeNull();
  });
});

describe('Lune (Meeus) contre skyfield + DE440', () => {
  test.each(SKY.lune)('$lieu $utc', (c) => {
    const [a, mo, j, h, mi, s] = c.utc;
    const t = new Date(Date.UTC(a!, mo! - 1, j!, h!, mi!, 0) + s! * 1000);
    const o = T.lieu(c.lat, c.lon, c.alt_m);
    const e = T.ephemerideLune(o, o, t).lieux[0]!;
    // skyfield : distance « astrométrique » (temps de lumière, Terre déplacée de ≤ 36 km) ; ici géométrique
    expect(Math.abs(e.distance_km - c.distance_km)).toBeLessThan(50);
    expect(Math.abs(e.h_deg - c.h_apparente_deg)).toBeLessThan(0.02);
    expect(Math.abs(((e.az_deg - c.az_deg + 540) % 360) - 180)).toBeLessThan(0.03);
  });
  test('exemple Lune : la formule du sujet donne des milliers de km, le calcul exact la distance', () => {
    const ex = T.exemple('lune');
    const p1 = lirePosition(ex.p1!);
    const p2 = lirePosition(ex.p2!);
    const r = T.calculer(T.entrees(T.lieu(p1.lat, p1.lon, 35, 31.96731, 117.50126), T.lieu(p2.lat, p2.lon, 12, 36.41708, 116.88005), 'lune', { instant: new Date(Date.UTC(2025, 10, 3, 18, 38, 26)) }));
    expect(r.sujet_corde.D_km).toBeGreaterThan(5000);
    expect(r.sujet_corde.D_km).toBeLessThan(12000);
    expect(Math.abs(r.exact!.distances_km[0] - r.ephemeride!.lieux[0]!.distance_km) / 357936).toBeLessThan(0.003);
    expect(lunePosition(new Date(Date.UTC(2025, 10, 3, 18, 38, 26))).distance_km).toBeGreaterThan(355000);
  });
});
