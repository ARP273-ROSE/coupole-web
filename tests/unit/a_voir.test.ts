import { describe, expect, test } from 'vitest';
import { ENTREES } from '../../src/anim/registre';
import { aVoir, idsAvecAVoir } from '../../src/i18n/a_voir';

describe('« Ce qu’il faut voir »', () => {
  test('un texte FR et EN pour chacune des 95 animations', () => {
    expect(ENTREES.length).toBe(95);
    for (const e of ENTREES) {
      expect(aVoir(e.id, 'fr').length, e.id).toBeGreaterThan(80);
      expect(aVoir(e.id, 'en').length, e.id).toBeGreaterThan(80);
    }
  });
  test('aucun texte orphelin ni en double', () => {
    const ids = idsAvecAVoir();
    expect(new Set(ids).size).toBe(ids.length);
    const connus = new Set(ENTREES.map((e) => e.id));
    for (const id of ids) expect(connus.has(id), id).toBe(true);
  });
});
