import { describe, expect, it } from 'vitest';
import { analyser, type Noeud } from '../../src/noyau/formule';
import { lune_rejeu, rejeu, types } from '../../src/anim/animations/ombres';
import { ECLIPSES_LUNE, ECLIPSES_SOLEIL } from '../../src/anim/animations/table_eclipses';

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
  it('chaque éclipse de la table, rejouée à son maximum (géométrie DE440), a le type de la table', () => {
    const T: Record<string, string> = { total: 'totale', annular: 'annulaire', hybrid: 'hybride', partial: 'partielle', penumbral: 'penombrale' };
    for (const [table, s] of [[ECLIPSES_SOLEIL, 'S'], [ECLIPSES_LUNE, 'L']] as const)
      table.forEach((e, i) => {
        const r = rejeu(s + i)!;
        const [x, y, z] = lune_rejeu(r, 0);
        const t = types(x, y, z, r.g.s_km);
        expect(s === 'S' ? t.soleil.type : t.lune.type, `${s}${i}`).toBe(T[e[3]]);
        // au début et à la fin du trajet montré : plus d'éclipse
        for (const u of [-1, 1]) {
          const [a, b, c] = lune_rejeu(r, u);
          const f = types(a, b, c, r.g.s_km);
          expect(s === 'S' ? f.soleil.type : f.lune.type, `${s}${i} ${u}`).toBe('aucune');
        }
      });
  });
});
