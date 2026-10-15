/**
 * « Maintenant » : parité avec le bureau (tests/references/maintenant_cas.json, produit par le portage Python avec
 * zoneinfo) : 15 instants × 11 fuseaux — passages à l'heure d'été et d'hiver (Paris, New York, Auckland), décalages
 * exotiques (St John's −2:30/−3:30, Katmandou +5:45, Chatham +12:45/+13:45, Lord Howe ±30 min), jour de l'an, 29 février.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as M from '../../src/calc/maintenant';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const C: any = JSON.parse(readFileSync(join(__dirname, '..', 'references', 'maintenant_cas.json'), 'utf8'));
const proche = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));

describe('maintenant : identique au bureau, fuseaux et heures d’été compris', () => {
  it(`${C.cas.length} instants × fuseaux`, () => {
    for (const c of C.cas) {
      const i = M.instant(c.ms, c.tz);
      const ctx = `${c.iso} ${c.tz}`;
      expect(i.tz, ctx).toBe(c.tz_retenu);
      expect(i.decalage, ctx).toBe(c.decalage);
      expect(i.decalage_standard, ctx).toBe(c.decalage_standard);
      expect(i.local, ctx).toEqual(c.local);
      expect(i.tu, ctx).toEqual(c.tu);
      expect(proche(i.jj, c.jj), ctx).toBe(true);
      expect(M.jourIndex(i.local[1], i.local[2]), ctx).toBe(c.jour_local);
      expect(proche(M.jourTU(i), c.jour_tu), ctx).toBe(true);
      expect(M.meridienDuFuseau(i), ctx).toBe(c.meridien);
      const [j, h] = M.heureSolaire(i, M.meridienDuFuseau(i));
      expect(j, ctx).toBe(c.solaire_meridien[0]);
      expect(proche(h, c.solaire_meridien[1]), ctx).toBe(true);
      const [j2, h2] = M.heureSolaire(i, 2.35);
      expect([j2, Math.round(h2 * 1e6)], ctx).toEqual([c.solaire_paris[0], Math.round(c.solaire_paris[1] * 1e6)]);
      expect(proche(M.tslHeures(i.jj, 2.35), c.tsl_paris, 1e-9), ctx).toBe(true);
      expect(proche(M.anneeDecimale(i), c.annee_decimale, 1e-12), ctx).toBe(true);
      expect(proche(M.elongationLune(i.jj), c.elongation_lune, 1e-9), ctx).toBe(true);
      expect(M.texteHeure(i, 'fr'), ctx).toBe(c.texte_fr);
      expect(M.texteHeure(i, 'en'), ctx).toBe(c.texte_en);
      expect(M.texteDate(i, 'fr'), ctx).toBe(c.date_fr);
      expect(M.texteDate(i, 'en'), ctx).toBe(c.date_en);
    }
  });
  it('libellés de décalage et indices de jour', () => {
    for (const [m, t] of C.libelles) expect(M.libelleDecalage(m)).toBe(t);
    for (const [mo, j, k] of C.jours) expect(M.jourIndex(mo, j)).toBe(k);
  });
  it('changement d’heure du 25 octobre 2026 à Paris : 02:59:59 (UTC+2) puis 02:00:00 (UTC+1)', () => {
    const a = M.instant(Date.UTC(2026, 9, 25, 0, 59, 59), 'Europe/Paris');
    const b = M.instant(Date.UTC(2026, 9, 25, 1, 0, 0), 'Europe/Paris');
    expect(M.texteHeure(a, 'fr')).toBe('02:59 heure de Paris (UTC+2) · 00:59 TU');
    expect(M.texteHeure(b, 'fr')).toBe('02:00 heure de Paris (UTC+1) · 01:00 TU');
    // l'heure solaire (méridien du fuseau, 15° E) ne saute pas : elle avance d'une seconde
    expect(M.heureSolaire(b, M.meridienDuFuseau(b))[1] - M.heureSolaire(a, M.meridienDuFuseau(a))[1]).toBeCloseTo(1 / 3600, 9);
  });
  it('fuseaux exotiques', () => {
    const t = Date.UTC(2026, 9, 15, 7, 20);
    expect(M.texteHeure(M.instant(t, 'Pacific/Auckland'), 'fr')).toBe('20:20 heure d’Auckland (UTC+13) · 07:20 TU');
    expect(M.texteHeure(M.instant(t, 'America/St_Johns'), 'en')).toBe('04:50 St Johns time (UTC−2:30) · 07:20 UT');
    expect(M.texteHeure(M.instant(t, 'Asia/Kathmandu'), 'fr')).toBe('13:05 heure de Kathmandu (UTC+5:45) · 07:20 TU');
  });
});
