/**
 * « Démonstrateur du temps sidéral et de l'angle horaire » (0.6.2) : encadré « Dans l'hémisphère Sud » ; ses
 * affirmations contre SageMath (tests/references/temps_sideral_sud_sage.json, produit par
 * outils/verif_anim/temps_sideral_sud_verif.sage de Coupole) et texte identique à l'appli de bureau.
 */
import { describe, expect, test } from 'vitest';
import * as astro from '../../src/calc/astro';
import { angle_horaire_h } from '../../src/anim/animations/angle_horaire';
import { encadreSud } from '../../src/i18n/a_voir';
import SAGE from '../references/temps_sideral_sud_sage.json';
import ANIM_FR from '../../src/i18n/genere/anim.fr.json';
import ANIM_EN from '../../src/i18n/genere/anim.en.json';

describe('hémisphère Sud', () => {
  test.each(SAGE.cas)('φ = $lat, δ = $dec', (c) => {
    const hs: number[] = [];
    for (let h = -120; h <= 120; h++) hs.push(astro.equatorial_vers_horizon((15 * h) / 10, c.dec, c.lat)[1]);
    expect(Math.min(...hs)).toBeCloseTo(c.h_min, 9);
    expect(Math.max(...hs)).toBeCloseTo(c.h_max, 9);
    expect(Math.min(...hs) > 0).toBe(c.circumpolaire);
    expect(c.dec < -(90 - Math.abs(c.lat))).toBe(c.circumpolaire);
    const [e] = astro.equatorial_vers_horizon(-75, c.dec, c.lat);
    const [o] = astro.equatorial_vers_horizon(75, c.dec, c.lat);
    expect(e).toBeCloseTo(c.az_lever_puis_coucher[0], 9);
    expect(o).toBeCloseTo(c.az_lever_puis_coucher[1], 9);
  });
  test('H < 0 avant la culmination', () => {
    expect(angle_horaire_h(10, 12)).toBe(-2);
    expect(angle_horaire_h(14, 12)).toBe(2);
  });
  test('encadré FR/EN', () => {
    const fr = encadreSud('siderealTimeAndHourAngleDemo', 'fr');
    expect(fr).toContain('σ Octantis (magnitude 5,4)');
    expect(fr).toContain('−56°');
    expect(Math.round(SAGE.sigma_oct.distance_pole_deg)).toBe(1);
    expect(encadreSud('siderealTimeAndHourAngleDemo', 'en')).toContain('right to left');
    expect(encadreSud('kepler', 'fr')).toBe('');
    // le même texte que l'appli de bureau, au caractère près
    expect(fr).toBe((ANIM_FR as Record<string, string>).anim_siderealtimeandhourangledemo_sud);
    expect(encadreSud('siderealTimeAndHourAngleDemo', 'en')).toBe((ANIM_EN as Record<string, string>).anim_siderealtimeandhourangledemo_sud);
  });
});
