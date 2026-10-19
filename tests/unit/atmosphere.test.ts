/** « L'atmosphère terrestre » : formules contre SageMath (références communes avec l'appli de bureau). */
import { describe, expect, test } from 'vitest';
import * as A from '../../src/calc/atmosphere';
import SAGE from '../references/atmosphere_sage.json';

const proche = (a: number, b: number, rel = 1e-12): void => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.abs(b) + 1e-15);

describe('atmosphère', () => {
  test.each(SAGE.masse_air)('masse d’air h = $h', (c) => {
    if (c.secz !== null) proche(A.masse_air_secz(c.h), c.secz);
    proche(A.masse_air_kasten_young(c.h), c.kasten_young);
    proche(A.masse_air_pickering(c.h), c.pickering);
    proche(A.chemin_sphere_km(c.h), c.chemin_km, 1e-10);
  });
  test.each(SAGE.bandes)('extinction $bande $P', (c) => {
    proche(A.tau_rayleigh(c.lambda, c.P), c.tau_r);
    proche(A.k_bande(c.lambda, c.P), c.k);
  });
  test.each(SAGE.refraction)('réfraction $h $P $T', (c) => {
    proche(A.refraction_apparente(c.h, c.P, c.T), c.bennett);
    proche(A.refraction_vraie(c.h, c.P, c.T), c.saemundsson);
  });
  test('Ciddor, aplatissement, lever', () => {
    for (const c of SAGE.ciddor) proche(A.indice_ciddor(c.lambda), c.n_moins_1);
    for (const c of SAGE.aplatissement) proche(A.aplatissement(0, 0.2666, c.P, c.T).rapport, c.rapport, 1e-10);
    for (const c of SAGE.avance) proche(A.avance_lever_min(c.lat), c.minutes, 1e-9);
    expect(A.transmission_eso().lambda_um.length).toBeGreaterThan(300);
  });
});
