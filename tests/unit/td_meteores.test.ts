/**
 * Pluies de météores : jumeau de Coupole (coupole/modules/td/meteores.py).  Références communes :
 * tests/references/td_meteores_reference.json (sorties du bureau, ERFA) et td_meteores_sage.json (SageMath : exemple
 * du cours, tableau de la fiche IMO, réduction, profils, longitude solaire contre les instants publiés par l'IMO).
 */
import { describe, expect, test } from 'vitest';
import * as M from '../../src/calc/td_meteores';
import REF from '../references/td_meteores_reference.json';
import SAGE from '../references/td_meteores_sage.json';

const PARIS = { lat: REF.site[0]!, lon: REF.site[1]!, alt_m: REF.site[2]!, nom: 'Paris' };
const ecartAngle = (a: number, b: number): number => Math.abs((((a - b + 180) % 360) + 360) % 360 - 180);
const jour = (s: string): [number, number, number] => s.split('-').map(Number) as [number, number, number];

describe('données et formules', () => {
  test('39 pluies de l’IMO', () => {
    expect(M.PLUIES.length).toBe(39);
    const per = M.pluie('PER');
    expect([per.lambda_max, per.alpha, per.delta, per.zhr, per.r]).toEqual([140, 48, 58, 110, 2.2]);
    expect(M.SOURCES.imo).toContain('Rendtel');
  });
  test('exemple du cours et tableau 1 de la fiche IMO (SageMath)', () => {
    expect(M.tauxAttendu(100, 50, 4.0, 1, 2.2)).toBeCloseTo(SAGE.cours.lm4, 12);
    expect(M.tauxAttendu(100, 50, 5.0, 1, 2.2)).toBeCloseTo(SAGE.cours.lm5, 12);
    for (const [h, v] of Object.entries(SAGE.imo_tableau1)) expect(M.tauxAttendu(100, Number(h), 6.5)).toBeCloseTo(v, 10);
  });
  test('réduction (SageMath)', () => {
    for (const c of SAGE.reduction) {
      const r = M.reduction(c.n, c.t, c.lm, c.f, c.r, c.h);
      expect(r.zhr!).toBeCloseTo(c.zhr, 9);
      expect(r.err!).toBeCloseTo(c.err, 9);
    }
    expect(M.reduction(5, 1, 6, 1, 2.5, 15).alertes).toEqual(['mt_alerte_h']);
    expect(M.reduction(5, 1, 6, 0.6, 2.5, 45).alertes).toEqual(['mt_alerte_f']);
    expect(() => M.reduction(5, 0, 6, 1, 2.5, 40)).toThrow('mt_err_entrees');
  });
  test('profils de Jenniskens (SageMath)', () => {
    for (const code of ['PER', 'GEM'] as const) {
      const lm = M.pluie(code).lambda_max!;
      for (const [dl, v] of Object.entries(SAGE.profils[code])) expect(M.zhr(code, lm + Number(dl))).toBeCloseTo(v, 8);
    }
  });
  test('longitude solaire : instants publiés par l’IMO', () => {
    for (const x of SAGE.longitude_solaire) {
      const lam = M.longitudeSolaire(M.jjDe(new Date(x.date)));
      expect(Math.abs(lam - x.meeus)).toBeLessThan(1e-6);
      expect(Math.abs(lam - x.imo)).toBeLessThan(0.02);
    }
  });
  test('hauteur d’une direction (SageMath, précession IAU 1976)', () => {
    for (const x of SAGE.hauteur) {
      const [h, az] = M.hauteurAzDe({ lat: x.lat, lon: x.lon, alt_m: 0, nom: '' }, x.alpha, x.delta, new Date(x.date));
      expect(Math.abs(h - x.h)).toBeLessThan(0.02);
      expect(ecartAngle(az, x.az)).toBeLessThan(0.05);
    }
  });
  test('champ conseillé et indice r (SageMath)', () => {
    for (const x of SAGE.champ) {
      const [az, h] = M.champ(x.az_r, x.h_r, null)!;
      expect(h).toBe(60);
      expect(ecartAngle(az, x.az_r + x.daz)).toBeLessThan(1e-9);
    }
    const c = SAGE.indice;
    const r = M.indicePopulation(Object.fromEntries(Object.entries(c.comptes).map(([k, v]) => [Number(k), v])), c.lm);
    expect(r.r!).toBeCloseTo(c.r, 12);
  });
});

describe('jumeau du bureau', () => {
  test('calendriers 2026 et 2027', () => {
    for (const [an, lignes] of Object.entries(REF.calendrier)) {
      const cal = new Map(M.calendrier(Number(an)).map((e) => [e.code, e]));
      for (const x of lignes) {
        const e = cal.get(x.code)!;
        for (const k of ['debut', 'fin', 'max'] as const) {
          if (x[k] === null) expect(e[k]).toBeNull();
          else expect(Math.abs(e[k]!.getTime() - new Date(x[k]!).getTime())).toBeLessThan(60_000);
        }
        expect(ecartAngle(e.alpha, x.alpha)).toBeLessThan(1e-6);
        if (x.lune !== null) expect(Math.abs(e.lune! - x.lune)).toBeLessThan(0.003);
      }
    }
  });
  test('radiant et ZHR tout au long de l’année', () => {
    for (const [code, lam, a, d] of REF.radiant as [string, number, number, number][]) {
      const [a2, d2] = M.radiant(code, lam);
      expect(ecartAngle(a2, a)).toBeLessThan(1e-9);
      expect(Math.abs(d2 - d)).toBeLessThan(1e-9);
    }
    for (const [code, lam, z] of REF.zhr as [string, number, number][]) expect(M.zhr(code, lam)).toBeCloseTo(z, 9);
  });
  test('trois nuits à Paris', () => {
    for (const x of REF.nuits) {
      const N = M.nuit(PARIS, jour(x.jour), 6.0, 1.0, x.codes);
      expect(Math.abs(N.debut.getTime() - new Date(x.debut).getTime())).toBeLessThan(1000);
      expect(Math.abs(N.lune_frac - x.lune_frac)).toBeLessThan(0.003);
      expect(N.nuit).toEqual(x.nuit);
      x.soleil.forEach((h, k) => expect(Math.abs(N.soleil[k * 12]! - h)).toBeLessThan(0.02));
      x.lune.forEach((h, k) => expect(Math.abs(N.lune[k * 12]! - h)).toBeLessThan(0.05));
      expect(N.pluies.map((e) => e.code)).toEqual(x.pluies.map((e) => e.code));
      N.pluies.forEach((e, k) => {
        const r = x.pluies[k]!;
        expect(Math.abs(e.attendu - r.attendu)).toBeLessThan(Math.max(0.01 * r.attendu, 0.05));
        expect(Math.abs(e.heures - r.heures)).toBeLessThanOrEqual(5 / 60 + 1e-9);
        if (r.meilleur === null) expect(e.meilleur).toBeNull();
        else expect(Math.abs(e.meilleur! - r.meilleur)).toBeLessThanOrEqual(1);
        r.h.forEach((h, j) => expect(Math.abs(e.h[j * 12]! - h)).toBeLessThan(0.02));
      });
    }
  });
  test('campagne et agenda', () => {
    const C = M.campagne(PARIS, [2026, 12, 10], [2026, 12, 16], 6.0, 1.0, 5.0);
    expect(C.map((x) => `${x.nuit} ${x.code}`)).toEqual(REF.campagne.map((x) => `${x.nuit} ${x.code}`));
    C.forEach((x, k) => {
      const r = REF.campagne[k]!;
      expect(Math.abs(x.attendu - r.attendu)).toBeLessThan(Math.max(0.01 * r.attendu, 0.05));
      expect(Math.abs(x.note - r.note)).toBeLessThanOrEqual(1);
      expect(Math.abs(x.meilleur.getTime() - new Date(r.meilleur!).getTime())).toBeLessThanOrEqual(10 * 60_000 + 1000);
    });
    const t = M.ics(C.slice(0, 2), 'Paris');
    expect(t.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(t.split('BEGIN:VEVENT').length - 1).toBe(2);
    expect(M.csv(C).split('\n')[0]).toContain('attendus');
  });
});
