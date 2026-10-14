import { describe, expect, it } from 'vitest';
import { Vue3D } from '../../src/noyau/dessin';

describe('glisser une sphère', () => {
  it('le point sous le doigt suit le doigt (horizontalement et verticalement)', () => {
    for (const [az, alt] of [[0, 0], [215, 30], [100, -40]] as [number, number][]) {
      const v = new Vue3D(az, alt);
      v.rayon_px = 150;
      // point de la sphère au centre de l'image
      const d = v.d;
      const [x0, y0] = v.projeter1(d);
      v.tourner(10, 0);
      const [x1] = v.projeter1(d);
      expect(x1 * 150).toBeGreaterThan(x0 * 150 + 9);
      expect(x1 * 150).toBeLessThan(x0 * 150 + 11);
      const v2 = new Vue3D(az, alt);
      v2.rayon_px = 150;
      const e = v2.d;
      v2.tourner(0, 10);
      // vers le bas de l'écran (y écran vers le bas : la projection y diminue)
      expect(v2.projeter1(e)[1] * 150).toBeLessThan(y0 * 150 - 9);
    }
  });
});
