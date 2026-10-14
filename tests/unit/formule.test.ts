import { describe, expect, it } from 'vitest';
import { analyser, type Noeud } from '../../src/noyau/formule';
import { rejeu } from '../../src/anim/animations/ombres';
import { ECLIPSES_LUNE, ECLIPSES_SOLEIL } from '../../src/anim/animations/table_eclipses';
import * as astro from '../../src/calc/astro';

/** Écriture compacte d'un arbre : fractions (n)/(d), exposants ^, indices _, racines √[ ]. */
function ecrire(n: Noeud): string {
  switch (n.t) {
    case 'rangee':
      return n.e.map(ecrire).join(' ');
    case 'id':
    case 'nb':
    case 'op':
      return n.v;
    case 'frac':
      return `(${ecrire(n.n)})/(${ecrire(n.d)})`;
    case 'sup':
      return `${ecrire(n.b)}^${ecrire(n.s)}`;
    case 'sub':
      return `${ecrire(n.b)}_${ecrire(n.s)}`;
    case 'subsup':
      return `${ecrire(n.b)}_${ecrire(n.i)}^${ecrire(n.s)}`;
    case 'racine':
      return `√[${ecrire(n.e)}]`;
    case 'paren':
      return `${n.o}${ecrire(n.e)}${n.f}`;
  }
}

describe('formules', () => {
  it.each([
    ['F = G M₁ M₂ / R²', 'F = (G M_1 M_2)/(R^2)'],
    ['b = √(a² − c²)', 'b = √[a^2 − c^2]'],
    ['f₀ / (1 − v_r / c)', '(f_0)/(1 − (v_r)/(c))'],
    ['H = (da/dt) / a', 'H = ((d a)/(d t))/(a)'],
    ['(R_p / R_*)²', '((R_p)/(R_∗))^2'],
    ['m − M = 5 log₁₀ d − 5', 'm − M = 5 log_10 d − 5'],
    ['P² = a³ / M', 'P^2 = (a^3)/(M)'],
    ['206 265″ × d / D', '(206 265″ × d)/(D)'],
    ['R / R☉ = √(L / L☉) / (T / T☉)²', '(R)/(R_☉) = (√[(L)/(L_☉)])/(((T)/(T_☉))^2)'],
    ['1/S = 1/E − 1/P', '(1)/(S) = (1)/(E) − (1)/(P)'],
    ['∝ 1 / sin h', '∝ (1)/(sin h)'],
    ['F × (1/3 × 1/2) / (3)² = F × 1/18', '(F × ((1)/(3) × (1)/(2)))/((3)^2) = F × (1)/(18)'],
    ['σT⁴/π', '(σ T^4)/(π)'],
    ['v ∝ 1/√R', 'v ∝ (1)/(√[R])'],
    ['= (6,67 × 10⁻¹¹) (5,97 × 10²⁴) / (6,37 × 10⁶)²', '= ((6,67 × 10^−11) (5,97 × 10^24))/((6,37 × 10^6)^2)'],
  ])('%s', (s, attendu) => {
    expect(ecrire(analyser(s)).replace('R_☉', 'R_☉')).toBe(attendu);
  });
});

describe('éclipses rejouées', () => {
  it('chaque éclipse de la table a une trajectoire compatible avec son type', () => {
    const RL = astro.R_LUNE_KM,
      RT = astro.R_TERRE_KM;
    ECLIPSES_LUNE.forEach((e, i) => {
      const r = rejeu('L' + i)!;
      const y = Math.abs(r.y_km);
      if (e[3] === 'total') expect(y).toBeLessThan(r.ru_km - RL);
      else if (e[3] === 'partial') expect(y > r.ru_km - RL && y < r.ru_km + RL).toBe(true);
      else expect(y > r.ru_km + RL && y < r.rp_km + RL).toBe(true);
    });
    ECLIPSES_SOLEIL.forEach((e, i) => {
      const r = rejeu('S' + i)!;
      const y = Math.abs(r.y_km);
      if (e[3] === 'partial') expect(y > RT && y < RT + r.rp_km).toBe(true);
      else expect(y).toBeLessThan(RT);
    });
  });
});
