/**
 * Planificateur de parallaxe : jumeau de Coupole (coupole/modules/td/planif.py).  Références communes :
 * tests/references/td_planif_reference.json (créneaux de Coupole, contrôlés par skyfield), formules contre SageMath
 * (Coupole : outils/verif_planif/verif_planif_sage.py).
 */
import { describe, expect, test } from 'vitest';
import * as P from '../../src/calc/td_planif';
import { twoline2satrec, propagate, gstime, eciToEcf } from '../../src/calc/sgp4';
import REF from '../references/td_planif_reference.json';
import ETOILES from '../../src/donnees/genere/etoiles_v55.json';

const [S1, S2] = REF.sites.map(([lat, lon, alt]) => ({ lat: lat!, lon: lon!, alt_m: alt!, nom: '' })) as [P.Site, P.Site];
const DEBUT = new Date(REF.debut);
const cat = P.poserEtoiles((ETOILES as unknown as { etoiles: [number, number, number, string][] }).etoiles);
const rec = twoline2satrec(REF.tle[0]!, REF.tle[1]!);
const iss: P.PositionISS = (t) => {
  const p = propagate(rec, t);
  if (!p || !p.position || typeof p.position === 'boolean') return null;
  const g = eciToEcf(p.position, gstime(t));
  return [g.x, g.y, g.z];
};

describe('ISS', () => {
  const r = P.chercherISS(S1, S2, P.criteres('iss', DEBUT, { jours: 7 }), iss, null);
  test('mêmes créneaux et mêmes instants que Coupole', () => {
    expect(r.creneaux.length).toBe(REF.iss.length);
    const att = new Map(REF.iss.map((x) => [new Date(x.instant).getTime(), x]));
    for (const c of r.creneaux) {
      const x = att.get(c.meilleur.getTime());
      expect(x, c.meilleur.toISOString()).toBeDefined();
      for (const n of [0, 1]) {
        expect(Math.abs(c.h[n]! - x!.skyfield_h_az[n]![0]!)).toBeLessThan(0.15);
        expect(Math.abs(c.h[n]! - x!.h[n]!)).toBeLessThan(0.05);
      }
      expect(c.entre).toBe(x!.entre);
    }
  });
  test('conditions', () => {
    for (const c of r.creneaux) {
      expect(Math.min(...c.h)).toBeGreaterThanOrEqual(20);
      expect(Math.max(...c.soleil)).toBeLessThanOrEqual(-6);
      expect(c.altitude_km!).toBeGreaterThan(300);
    }
    const c = r.creneaux[0]!;
    expect(c.entre && c.ecart_plan_deg < 5 && Math.abs(c.erreur_sujet_pct!) < 3).toBe(true);
  });
  test('exports', () => {
    const l = P.csv(r).trim().split('\n');
    expect(l.length).toBe(r.creneaux.length + 1);
    expect(P.ics(r).split('BEGIN:VEVENT').length - 1).toBe(r.creneaux.length);
  });
});

describe('Lune', () => {
  const r = P.chercherLune(S1, S2, P.criteres('lune', DEBUT, { jours: 60 }), cat);
  test('créneaux comme Coupole (même algorithme de Meeus, étoiles précessées)', () => {
    const att = new Map(REF.lune.map((x) => [new Date(x.instant).getTime(), x]));
    let communs = 0;
    for (const c of r.creneaux) {
      const x = att.get(c.meilleur.getTime());
      if (!x) continue;
      communs++;
      expect(c.etoile!.nom).toBe(x.etoile.nom);
      for (const n of [0, 1]) expect(Math.abs(c.h[n]! - x.skyfield_h[n]!)).toBeLessThan(0.02);
      expect(Math.abs(c.etoile!.delta_arcmin - x.etoile.delta_arcmin)).toBeLessThan(0.05);
      expect(Math.abs(c.phase! - x.skyfield_phase)).toBeLessThan(0.01);
    }
    expect(Math.abs(r.creneaux.length - REF.lune.length)).toBeLessThanOrEqual(1);
    expect(communs).toBeGreaterThanOrEqual(REF.lune.length - 2);
  });
});

describe('formules (SageMath)', () => {
  const B = P.base(S1, S2);
  test('corde, formule du sujet, magnitude, Δφ idéal', () => {
    expect(Math.abs(B.corde_km - 390.866461)).toBeLessThan(1e-5);
    expect(Math.abs(B.corde_km / ((180 - 66.0 - 56.9) * Math.PI / 180) - 392.207)).toBeLessThan(1e-3);
    const m: [number, number, number][] = [[450, 30, -3.3962], [1200, 90, -0.1612], [800, 120, 0.1219]];
    for (const [d, b, v] of m) expect(Math.abs(P.magnitudeISS(d, b) - v)).toBeLessThan(1e-4);
    expect(Math.abs((B.corde_km / 384400) * (180 / Math.PI) * 60 - 3.49558)).toBeLessThan(1e-5);
    expect(P.erreurSujet(B, 45, 45, false, 400)).toBeNull();
  });
});
