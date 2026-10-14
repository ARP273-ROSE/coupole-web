/**
 * Moteur « spectres physiques » (src/calc/spectres_physiques.ts) : il reproduit à 10⁻⁹ près les 100 cas de référence
 * (5 classes × 20 types) produits par le moteur Python de Coupole (même API, nom pour nom), plus quelques contrôles
 * physiques (G2 V = 5 770 K, ordre des pics He II < He I < H < TiO, couleurs).
 */
import { describe, expect, it } from 'vitest';
import DONNEES from '../../src/donnees/genere/modele_spectres.json';
import FINES from '../../src/donnees/genere/intensites_fines.json';
import REF from '../references/spectres_physiques.json';
import { ModeleSpectres } from '../../src/calc/spectres_physiques';

const m = new ModeleSpectres(DONNEES, FINES);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ref = REF as any;
const TOL = 1e-9;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function proche(a: any, b: any, chemin: string, err: string[]): void {
  if (b !== null && typeof b === 'object' && !Array.isArray(b)) {
    for (const k of Object.keys(b)) proche(a?.[k], b[k], `${chemin}.${k}`, err);
  } else if (Array.isArray(b)) {
    if (!Array.isArray(a) || a.length !== b.length) err.push(`${chemin}: longueur ${a?.length} ≠ ${b.length}`);
    else b.forEach((y, k) => proche(a[k], y, `${chemin}[${k}]`, err));
  } else if (typeof b === 'number' && typeof a === 'number') {
    if (Math.abs(a - b) > Math.max(1e-12, TOL * Math.abs(b))) err.push(`${chemin}: ${a} ≠ ${b}`);
  } else if (a !== b && !(a === undefined && b === null)) err.push(`${chemin}: ${a} ≠ ${b}`);
}

describe('moteur des spectres physiques', () => {
  it('reproduit les 100 cas de référence du moteur Python (10⁻⁹)', () => {
    const err: string[] = [];
    for (const c of ref.cas) {
      const t = c.type;
      const cl = c.classe;
      const e = m.etalonnage(t, cl);
      const r = m.raies(t, cl);
      const b = m.bandes(t, cl);
      const got = {
        etalonnage: e, intensites: m.intensites(t, cl), n_raies: r.length,
        raies_fortes: [...r].sort((p, q) => q.W - p.W).slice(0, 6), n_bandes: b.length, bandes_premieres: b.slice(0, 3),
        spectre: m.spectre(t, cl, ref.lambdas), spectre_r0p3: m.spectre(t, cl, ref.lambdas, null, 0.3),
        spectre_h_seul: m.spectre(t, cl, ref.lambdas, ['h']),
        spectre_sans_molecules: m.spectre(t, cl, ref.lambdas, ['he_ii', 'he_i', 'h', 'metaux_ionises', 'metaux']),
        couleur_etoile: m.couleur_etoile(e.teff),
        continu: [400, 500, 600, 700].map((l) => ModeleSpectres.continu_relatif(e.teff, l)),
        beta_prime_500: ModeleSpectres.beta_prime(e.teff, 500),
      };
      const attendu = { ...c };
      delete attendu.type;
      delete attendu.classe;
      proche(got, attendu, `${cl}${t}`, err);
    }
    for (const [l, rgb] of Object.entries(ref.couleur_lambda)) proche(m.couleur_lambda(Number(l)), rgb, `couleur_lambda[${l}]`, err);
    expect(err.slice(0, 20)).toEqual([]);
    expect(ref.cas.length).toBe(100);
  });

  it('G2 V = 5 770 K (Mamajek 2022) et ordre des pics en classe V', () => {
    expect(m.etalonnage(42, 'V').teff).toBeCloseTo(5770, 6);
    const pic = (f: string): number => {
      let tm = 0;
      for (let t = 0; t <= 69; t++) if (m.intensites(t, 'V')[f]! > m.intensites(tm, 'V')[f]!) tm = t;
      return tm;
    };
    expect(pic('he_ii')).toBeLessThan(pic('he_i'));
    expect(pic('he_i')).toBeLessThan(pic('h'));
    expect(pic('h')).toBeLessThan(pic('molecules'));
  });

  it('courbes lisses : aucun saut de plus de 30 points entre deux types voisins, valeurs finies', () => {
    for (const cl of ['I', 'III', 'V']) {
      for (const f of ['he_ii', 'he_i', 'h', 'metaux_ionises', 'metaux', 'molecules', 'ch']) {
        let avant: number | null = null;
        for (let t = 0; t <= 69; t += 0.25) {
          const v = m.intensites(t, cl)[f]!;
          expect(Number.isFinite(v)).toBe(true);
          if (avant !== null) expect(Math.abs(v - avant), `${cl} ${f} ${t}`).toBeLessThan(30);
          avant = v;
        }
      }
    }
  });
});
