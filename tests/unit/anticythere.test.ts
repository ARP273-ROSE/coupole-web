/**
 * Machine d'Anticythère : les tests du mécanisme d'Anticythere3D (tests/test_mechanism.py, du même auteur), repris à
 * l'identique, et les valeurs recalculées indépendamment sous SageMath (outils/verif_anim/anticythere_verif.sage de
 * Coupole → tests/references/anticythere_sage.json).
 */
import { describe, expect, it } from 'vitest';
import SAGE from '../references/anticythere_sage.json';
import * as A from '../../src/calc/anticythere';

const S = SAGE as unknown as {
  rapports: Record<string, string>;
  lunaisons_par_an: string;
  mois_anomalistique_j: number;
  mois_sideral_j: number;
  saros_j: number;
  exeligmos_ans: number;
  porte_satellite_ans: number;
  manivelle_jours_par_tour: number;
  planetes: Record<string, { sidereal_ratio: string; periode_ans: number }>;
  entraxes_mm: Record<string, number>;
  tenon_fente_amplitude_deg: number;
  nabonassar_jd: number;
};

describe('[1] rapports d’engrenages — exacts', () => {
  it('tous les trains donnent la valeur attendue', () => {
    expect(A.self_check()).toEqual([]);
    for (const [k, v] of Object.entries(A.EXPECTED)) expect(A.RATIOS[k]!.egale(v), k).toBe(true);
  });
  it('identiques aux rapports recalculés sous SageMath', () => {
    for (const [k, v] of Object.entries(S.rapports)) expect(A.RATIOS[k]!.toString(), k).toBe(v);
  });
  it('métonique 235/19, Saros 223, callippique 1/76, exeligmos 235/12711, Lune sidérale 254/19', () => {
    expect(A.RATIOS.moon_sid!.toString()).toBe('254/19');
    expect(A.RATIOS.moon_sid!.div(new A.Frac(1)).n - A.RATIOS.moon_sid!.d).toBe(235); // 254 − 19 = 235 lunaisons
    expect(S.lunaisons_par_an).toBe('235/19');
    expect(A.RATIOS.saros!.egale(new A.Frac(4, 223).mul(new A.Frac(235, 19)))).toBe(true);
    expect(A.RATIOS.callippic!.toString()).toBe('1/76');
    expect(A.RATIOS.exeligmos!.toString()).toBe('235/12711');
    expect(Math.abs(1 / A.RATIOS.exeligmos!.valeur() - 54.09)).toBeLessThan(0.01);
  });
});

describe('[2] porte-satellite et mois anomalistique', () => {
  it('période de e3, mois anomalistique et sidéral', () => {
    const per = 1 / A.RATIOS.carrier_e3!.valeur();
    expect(Math.abs(per - 8.8826)).toBeLessThan(0.001);
    expect(per).toBeCloseTo(S.porte_satellite_ans, 12);
    const month = A.TROPICAL_YEAR / (A.RATIOS.moon_sid!.valeur() - A.RATIOS.carrier_e3!.valeur());
    expect(Math.abs(month - 27.5533)).toBeLessThan(0.001);
    expect(Math.abs(month - 27.55455)).toBeLessThan(0.002);
    expect(month).toBeCloseTo(S.mois_anomalistique_j, 10);
    const sid = A.TROPICAL_YEAR / A.RATIOS.moon_sid!.valeur();
    expect(Math.abs(sid - 27.321266)).toBeLessThan(1e-5);
    expect(sid).toBeCloseTo(S.mois_sideral_j, 10);
  });
});

describe('[3] tenon et fente', () => {
  const p = new A.PinAndSlot();
  it('amplitude arcsin(1,1/9,6), extremum, moyenne nulle, vitesses extrêmes', () => {
    expect(Math.abs(p.amplitude_deg - 6.5796)).toBeLessThan(0.001);
    expect(p.amplitude_deg).toBeCloseTo(S.tenon_fente_amplitude_deg, 12);
    let pire = 0,
      somme = 0;
    for (let x = 0; x < 2000; x++) {
      pire = Math.max(pire, Math.abs(p.delta_turns(x / 2000)) * 360);
      somme += p.delta_turns(x / 2000);
    }
    expect(Math.abs(pire - p.amplitude_deg)).toBeLessThan(0.02);
    expect(Math.abs(somme / 2000)).toBeLessThan(1e-6);
    expect(Math.abs(p.speed_ratio(0) - 9.6 / 10.7)).toBeLessThan(1e-9);
    expect(Math.abs(p.speed_ratio(0.5) - 9.6 / 8.5)).toBeLessThan(1e-9);
  });
});

describe('[4] cadrans : retour à l’origine après un cycle complet', () => {
  it('métonique, callippique, Saros, exeligmos (dont la frontière exacte de 1 Saros)', () => {
    const m = new A.Mechanism();
    m.turns = 19;
    expect(Math.abs(m.outputs().metonic - 5)).toBeLessThan(1e-9);
    m.turns = 76;
    expect(Math.abs(m.outputs().callippic - 1)).toBeLessThan(1e-9);
    const sy = (223 * 19) / 235;
    m.turns = sy;
    expect(Math.abs(m.outputs().saros - 4)).toBeLessThan(1e-9);
    expect(Math.abs(m.outputs().exeligmos - 1 / 3)).toBeLessThan(1e-9);
    expect(m.outputs().exeligmos_hours).toBe(8);
    m.turns = 2 * sy;
    expect(m.outputs().exeligmos_hours).toBe(16);
    m.turns = 3 * sy;
    expect(Math.abs(m.outputs().exeligmos - 1)).toBeLessThan(1e-9);
    expect(m.outputs().exeligmos_hours).toBe(0);
  });
  it('cases : 235 métoniques, 223 du Saros, 19 années, 4 Jeux', () => {
    const m = new A.Mechanism();
    const vues = { met: new Set<number>(), sar: new Set<number>(), an: new Set<number>(), jeux: new Set<string>() };
    for (let i = 0; i < 20000; i++) {
      m.turns = (i / 20000) * 19 * 4;
      const o = m.outputs();
      vues.met.add(o.metonic_cell);
      vues.sar.add(o.saros_cell);
      vues.an.add(o.metonic_year);
      vues.jeux.add(o.games_name);
    }
    expect(vues.met.size).toBe(235);
    expect(Math.min(...vues.met)).toBe(1);
    expect(vues.sar.size).toBe(223);
    expect(vues.an.size).toBe(19);
    expect(vues.jeux.size).toBe(4);
    expect(A.metonic_year_starts().length).toBe(19);
  });
});

describe('[5] relations de période des planètes (Freeth et al. 2021)', () => {
  const reel: Record<string, number> = { mercury: 0.2408467, venus: 0.6151973, mars: 1.8808476, jupiter: 11.862615, saturn: 29.447498 };
  for (const [k, d] of Object.entries(A.PLANETS))
    it(k, () => {
      const t = 1 / d.sidereal_ratio.valeur();
      expect(Math.abs(t / reel[k]! - 1)).toBeLessThan(1e-3);
      expect(d.sidereal_ratio.toString()).toBe(S.planetes[k]!.sidereal_ratio);
    });
});

describe('[6] astronomie de référence et calage', () => {
  it('J2000, aller-retour, équinoxe', () => {
    expect(A.julian_day(2000, 1, 1, 12)).toBe(2451545.0);
    const [y, mo, d] = A.from_julian_day(2451545.0);
    expect([y, mo, d]).toEqual([2000, 1, 1]);
    const lon = A.sun_longitude(A.julian_day(2026, 3, 20, 9 + 46 / 60));
    expect(Math.min(lon, 360 - lon)).toBeLessThan(0.2);
  });
  it('Soleil moyen exact à 0,01° de 1950 à 2050 ; Lune sous le budget physique d’erreur', () => {
    const m = A.machine_calee();
    let pireL = 0,
      pireS = 0;
    for (let an = 1950; an <= 2050; an += 5) {
      const jd = A.julian_day(an, 6, 15, 12);
      m.days = jd - A.J2000;
      const o = m.outputs();
      const dm = A.pmod360(o.moon_true * 360 - A.moon_longitude(jd) + 180) - 180;
      const ds = A.pmod360(o.mean_sun * 360 - A.sun_mean_longitude(jd) + 180) - 180;
      pireL = Math.max(pireL, Math.abs(dm));
      pireS = Math.max(pireS, Math.abs(ds));
    }
    expect(pireS).toBeLessThan(0.01);
    const termes = 1.274 + 0.658 + 0.186 + 0.114;
    const sidErr = Math.abs(365.24219 / A.RATIOS.moon_sid!.valeur() / 27.321662 - 1.0);
    const budget = termes + 50 * A.RATIOS.moon_sid!.valeur() * 360 * sidErr + 6.58 * Math.abs(Math.sin(2 * Math.PI * Math.abs(50 / 8.8826 - 50 / 8.8504)));
    expect(pireL).toBeLessThan(budget);
    expect(pireL).toBeGreaterThan(0.5);
  });
  it('calendrier égyptien : ère de Nabonassar (SageMath), année vague de 365 jours', () => {
    expect(A.NABONASSAR_JD).toBe(S.nabonassar_jd);
    expect(A.egyptian_date(A.NABONASSAR_JD)).toEqual([0, 1]);
    expect(A.egyptian_date(A.NABONASSAR_JD + 359)).toEqual([11, 30]);
    expect(A.egyptian_date(A.NABONASSAR_JD + 360)).toEqual([12, 1]);
    expect(A.egyptian_date(A.NABONASSAR_JD + 365)).toEqual([0, 1]);
    // l'époque elle-même : 26 février −746 (calendrier julien) à midi
    expect(A.julian_day(-746, 2, 26, 12)).toBe(A.NABONASSAR_JD);
    // l'année vague recule d'un jour tous les 4 ans juliens par rapport au calendrier julien
    const t1 = A.egyptian_day(A.julian_day(2000, 1, 1, 12)),
      t2 = A.egyptian_day(A.julian_day(2004, 1, 1, 12));
    expect((t2 - t1 + 365) % 365).toBe(1);
  });
});

describe('[9] implantation : entraxes', () => {
  it('17 entraxes exacts au centième de mm (SageMath : m(N₁+N₂)/2)', () => {
    let pire = 0;
    for (const [a, b] of A.MESHES) {
      const [xa, ya] = A.ARBORS[A.ARBOR_OF[a]!]!;
      const [xb, yb] = A.ARBORS[A.ARBOR_OF[b]!]!;
      const voulu = (A.MODULE * (A.TEETH[a]! + A.TEETH[b]!)) / 2;
      expect(voulu).toBe(S.entraxes_mm[`${a}-${b}`]);
      pire = Math.max(pire, Math.abs(Math.hypot(xa - xb, ya - yb) - voulu));
    }
    expect(pire).toBeLessThan(0.01);
    const [xk, yk] = A.ARBORS.k!;
    const [xK, yK] = A.ARBORS.K!;
    expect(Math.abs(Math.hypot(xk - xK, yk - yK) - (1.1 * A.MODULE) / 0.5093)).toBeLessThan(0.01);
    expect(Object.keys(A.LEVELS).length).toBe(33);
  });
  it('vitesses exactes de chaque roue = dérivée de gear_angles()', () => {
    const m = new A.Mechanism();
    m.turns = 0;
    const a0 = m.gear_angles();
    m.turns = 7;
    const a1 = m.gear_angles();
    for (const g of Object.keys(A.LEVELS)) {
      if (['k2', 'e6', 'e1', 'b3'].includes(g)) continue; // modulés par le tenon-fente (moyenne seulement)
      expect((a1[g]! - a0[g]!) / 7, g).toBeCloseTo(A.GEAR_RATES[g]!.valeur(), 10);
    }
    expect(A.GEAR_RATES.n1!.toString()).toBe('5/19');
    expect(A.GEAR_RATES.o1!.toString()).toBe('-1/76');
    expect(A.GEAR_RATES.e2!.toString()).toBe('254/19');
  });
  it('un tour de manivelle = 48/223 d’année', () => {
    expect((A.TROPICAL_YEAR / -A.CRANK_PER_TURN)).toBeCloseTo(S.manivelle_jours_par_tour, 9);
  });
});
