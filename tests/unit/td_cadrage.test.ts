import { describe, expect, it } from 'vitest';
import { cadrage } from '../../src/app/page_td';

// Lune : ×1 montre la Terre ET la Lune ; le zoom resserre jusqu'à la base (il ne restait inerte que pour la Lune)
describe('cadrage du schéma de parallaxe', () => {
  const [x1, y1, x2, y2, xm, ym] = [-330, 6362, 330, 6362, 300, 364000];
  it('×1 : la Terre et la Lune ; ×60 : la base seule', () => {
    const [e1, , cy1] = cadrage(x1, y1, x2, y2, xm, ym, true, 1);
    const [e60, , cy60] = cadrage(x1, y1, x2, y2, xm, ym, true, 60);
    expect(Math.abs(ym - cy1)).toBeLessThan(e1 / 2);
    expect(Math.abs(cy1)).toBeLessThan(e1 / 2);
    expect(e1 / e60).toBeGreaterThan(300);
    expect(Math.abs(cy60 - y1)).toBeLessThan(e60 / 2);
  });
  it('les deux lieux restent dans le cadre à tout zoom', () => {
    for (const z of [2, 5, 20, 40]) {
      const [e, cx, cy] = cadrage(x1, y1, x2, y2, xm, ym, true, z);
      expect(Math.abs(cy - y1)).toBeLessThan(e / 2);
      expect(Math.max(Math.abs(cx - x1), Math.abs(cx - x2))).toBeLessThan(e / 2);
    }
  });
});
