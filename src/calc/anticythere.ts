/**
 * La machine d'Anticythère : nombres de dents, trains, rapports EXACTS, tenon et fente, sorties des cadrans,
 * implantation des arbres, inscriptions des cadrans, astronomie de calage.  Adapté d'Anticythere3D, du même auteur
 * (anticythere/kinematics.py, layout.py, dialface.py, astro.py) : mêmes nombres, mêmes formules, mêmes tests.
 *
 * Sources des données : Freeth et al., Nature 444 (2006) 587–591 et notes supplémentaires (nombres de dents) ;
 * Freeth, Jones, Steele, Bitsakis, Nature 454 (2008) 614–617 (calendriers, Jeux, éclipses) ; Freeth et al.,
 * Scientific Reports 11:5821 (2021) (le Cosmos : relations de période des planètes) ; Meeus, Astronomical Algorithms,
 * 2e éd., ch. 7, 25, 47, 54.
 *
 * Convention : `t` = tours de la grande roue b1 depuis l'époque de calage (J2000) ; 1 tour de b1 = 1 année tropique.
 * Angles en TOURS (1 = un tour complet), convertis en degrés à l'affichage.  Sans DOM : testable dans Node.
 */

export const TROPICAL_YEAR = 365.24219;
export const SYNODIC_MONTH = 29.530588853;

// ==================================================================== fractions exactes
/** Fraction exacte (entiers sûrs : les rapports de la machine restent très en deçà de 2^53). */
export class Frac {
  readonly n: number;
  readonly d: number;
  constructor(n: number, d = 1) {
    if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) throw new Error('fraction invalide');
    const g = pgcd(Math.abs(n), Math.abs(d)) || 1;
    const s = d < 0 ? -1 : 1;
    this.n = (s * n) / g;
    this.d = (s * d) / g;
  }
  mul(o: Frac): Frac {
    return new Frac(this.n * o.n, this.d * o.d);
  }
  div(o: Frac): Frac {
    return new Frac(this.n * o.d, this.d * o.n);
  }
  neg(): Frac {
    return new Frac(-this.n, this.d);
  }
  egale(o: Frac): boolean {
    return this.n === o.n && this.d === o.d;
  }
  valeur(): number {
    return this.n / this.d;
  }
  toString(): string {
    return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`;
  }
}

function pgcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

// ==================================================================== dents et trains
/** Nombres de dents relevés par tomographie (Freeth et al. 2006, 2008). */
export const TEETH: Readonly<Record<string, number>> = {
  a1: 48, b1: 223, b2: 64, b3: 32,
  c1: 38, c2: 48, d1: 24, d2: 127,
  e1: 32, e2: 32, e3: 223, e4: 188, e5: 50, e6: 50,
  f1: 53, f2: 30, g1: 54, g2: 20,
  h1: 60, h2: 15, i1: 60,
  k1: 50, k2: 50,
  l1: 38, l2: 53, m1: 96, m2: 15, m3: 27,
  n1: 53, n2: 15, o1: 60, p1: 60, p2: 12,
};

/** Chaînes (roue menante, roue menée) ; deux roues de même lettre sont solidaires du même arbre. */
export const TRAINS: Readonly<Record<string, [string, string][]>> = {
  metonic: [['b2', 'l1'], ['l2', 'm1'], ['m2', 'n1']],
  callippic: [['b2', 'l1'], ['l2', 'm1'], ['m2', 'n1'], ['n2', 'p1'], ['p2', 'o1']],
  saros: [['b2', 'l1'], ['l2', 'm1'], ['m3', 'e3'], ['e4', 'f1'], ['f2', 'g1']],
  exeligmos: [['b2', 'l1'], ['l2', 'm1'], ['m3', 'e3'], ['e4', 'f1'], ['f2', 'g1'], ['g2', 'h1'], ['h2', 'i1']],
  moon_sid: [['b2', 'c1'], ['c2', 'd1'], ['d2', 'e2']],
  carrier_e3: [['b2', 'l1'], ['l2', 'm1'], ['m3', 'e3']],
};

/** Produit exact des rapports (menante / menée) le long d'un train. */
export function train_ratio(pairs: readonly [string, string][]): Frac {
  let r = new Frac(1);
  for (const [a, b] of pairs) r = r.mul(new Frac(TEETH[a]!, TEETH[b]!));
  return r;
}

/** Rapports exacts, en tours de sortie par tour de b1 (donc par année). */
export const RATIOS: Readonly<Record<string, Frac>> = (() => {
  const r: Record<string, Frac> = {};
  for (const [k, v] of Object.entries(TRAINS)) r[k] = train_ratio(v);
  r.mean_sun = new Frac(1);
  // ligne des nœuds : rétrograde ; Freeth et al. 2021 proposent un train épicycloïdal réalisant −5/93
  r.nodes = new Frac(-5, 93);
  return r;
})();

/** Valeurs attendues (non-régression), calculées indépendamment sous SageMath. */
export const EXPECTED: Readonly<Record<string, Frac>> = {
  metonic: new Frac(5, 19), callippic: new Frac(1, 76), saros: new Frac(940, 4237),
  exeligmos: new Frac(235, 12711), moon_sid: new Frac(254, 19), carrier_e3: new Frac(477, 4237),
};

/** Erreurs du contrôle interne des rapports (liste vide si tout est juste). */
export function self_check(): string[] {
  const errs: string[] = [];
  for (const [k, v] of Object.entries(EXPECTED)) if (!RATIOS[k]!.egale(v)) errs.push(`${k}: attendu ${v}, obtenu ${RATIOS[k]}`);
  if (!RATIOS.saros!.egale(new Frac(4, 223).mul(new Frac(235, 19)))) errs.push('saros != (4/223)x(235/19)');
  if (!RATIOS.exeligmos!.div(RATIOS.saros!).egale(new Frac(1, 12))) errs.push('exeligmos/saros != 1/12');
  return errs;
}

// ==================================================================== planètes (Freeth et al. 2021)
export interface Planete {
  syn: number;
  years: number;
  inferior: boolean;
  sidereal_ratio: Frac;
  /** demi-grand axe (ua) : rapport épicycle / déférent du modèle géocentrique */
  a: number;
}
const pl = (syn: number, years: number, inferior: boolean, a: number): Planete => ({
  syn, years, inferior, a,
  // période sidérale déduite : (q + p)/q si inférieure, (q − p)/q sinon (tours par an)
  sidereal_ratio: inferior ? new Frac(years + syn, years) : new Frac(years - syn, years),
});
export const PLANETS: Readonly<Record<string, Planete>> = {
  mercury: pl(1513, 480, true, 0.387098),
  venus: pl(289, 462, true, 0.723332),
  mars: pl(133, 284, false, 1.523679),
  jupiter: pl(315, 344, false, 5.2026),
  saturn: pl(427, 442, false, 9.5549),
};
export const NOMS_PLANETES = ['mercury', 'venus', 'mars', 'jupiter', 'saturn'] as const;

// ==================================================================== tenon et fente
/** Tenon et fente des roues k1/k2 : ε = 1,1 mm entre les axes, r = 9,6 mm (tomographie) ; amplitude arcsin(ε/r). */
export class PinAndSlot {
  constructor(
    readonly eps = 1.1,
    readonly r = 9.6,
  ) {}
  get amplitude_deg(): number {
    return (Math.asin(this.eps / this.r) * 180) / Math.PI;
  }
  /** Écart angulaire (tours) : atan2(ε sin θ, r + ε cos θ), θ = angle d'entrée dans le repère du porte-satellite. */
  delta_turns(rel_turns: number): number {
    const th = 2 * Math.PI * rel_turns;
    return Math.atan2(this.eps * Math.sin(th), this.r + this.eps * Math.cos(th)) / (2 * Math.PI);
  }
  /** Rapport de vitesse instantané dθ₂/dθ₁. */
  speed_ratio(rel_turns: number): number {
    const th = 2 * Math.PI * rel_turns;
    return (this.r * (this.r + this.eps * Math.cos(th))) / (this.r ** 2 + this.eps ** 2 + 2 * this.r * this.eps * Math.cos(th));
  }
}

// ==================================================================== machine
export const GAMES = ['isthmia', 'olympia', 'nemea', 'pythia'] as const;

export interface Offsets {
  mean_sun: number;
  moon: number;
  nodes: number;
  anomaly: number;
  metonic: number;
  saros: number;
  planets: Record<string, number>;
}

export interface Outputs {
  turns: number;
  days: number;
  mean_sun: number;
  moon_mean: number;
  moon_true: number;
  moon_anomaly_deg: number;
  carrier_e3: number;
  nodes: number;
  phase_turns: number;
  phase_illum: number;
  metonic: number;
  metonic_cell: number;
  metonic_year: number;
  callippic: number;
  callippic_quarter: number;
  saros: number;
  saros_cell: number;
  exeligmos: number;
  exeligmos_sector: number;
  exeligmos_hours: number;
  games_year: number;
  games_name: string;
  /** longitudes héliocentriques moyennes (tours), comme Anticythere3D */
  planets: Record<string, number>;
}

const pmod = (x: number, m: number): number => {
  const r = x % m;
  return r !== 0 && r < 0 !== m < 0 ? r + m : r;
};

/** La machine complète, purement numérique (aucun état graphique). */
export class Mechanism {
  pin: PinAndSlot;
  offsets: Offsets;
  private _turns = 0;

  constructor(pin?: PinAndSlot, offsets?: Partial<Offsets>) {
    this.pin = pin ?? new PinAndSlot();
    this.offsets = { mean_sun: 0, moon: 0, nodes: 0, anomaly: 0, metonic: 0, saros: 0, planets: {}, ...offsets };
  }

  get turns(): number {
    return this._turns;
  }
  set turns(v: number) {
    if (Number.isFinite(v)) this._turns = v;
  }
  get days(): number {
    return this._turns * TROPICAL_YEAR;
  }
  set days(v: number) {
    if (Number.isFinite(v)) this._turns = v / TROPICAL_YEAR;
  }
  advance_days(n: number): void {
    this.days = this.days + n;
  }

  /** Rotation d'une sortie (tours), sans calage. */
  raw(name: string): number {
    return RATIOS[name]!.valeur() * this._turns;
  }

  /** Phase du tenon-fente (tours) = anomalie moyenne de la Lune (formule de Willis). */
  anomaly_phase(): number {
    return this.raw('moon_sid') - this.raw('carrier_e3') + this.offsets.anomaly;
  }

  /** Lune vraie (tours) et correction d'anomalie (degrés). */
  moon_true_turns(): [number, number] {
    const mean = this.raw('moon_sid') + this.offsets.moon;
    const d = this.pin.delta_turns(this.anomaly_phase());
    return [mean + d, d * 360.0];
  }

  outputs(): Outputs {
    const t = this._turns;
    const mean_sun = t + this.offsets.mean_sun;
    const moon_mean = this.raw('moon_sid') + this.offsets.moon;
    const [moon_true, anom_deg] = this.moon_true_turns();
    const phase = moon_true - mean_sun;
    const illum = (1.0 - Math.cos(2.0 * Math.PI * phase)) / 2.0;
    const met = this.raw('metonic') + this.offsets.metonic;
    const met_frac = pmod(met, 5.0);
    const met_cell = Math.trunc((met_frac / 5.0) * 235.0) + 1;
    const met_year = Math.trunc(pmod(met / 5.0, 1.0) * 19.0) + 1;
    const cal = this.raw('callippic');
    const cal_q = Math.trunc(pmod(cal, 1.0) * 4.0) + 1;
    const sar = this.raw('saros') + this.offsets.saros;
    const sar_cell = Math.trunc((pmod(sar, 4.0) / 4.0) * 223.0) + 1;
    const exe = this.raw('exeligmos');
    // 1e-9 : après exactement 1 Saros, (1/3 % 1)*3 = 0,999… en flottant (bogue de frontière trouvé par SageMath)
    const exe_sector = Math.trunc(pmod(exe, 1.0) * 3.0 + 1e-9) + 1;
    const exe_hours = pmod(exe_sector - 1, 3) * 8;
    const games_year = Math.trunc(pmod(t, 4.0)) + 1;
    const planets: Record<string, number> = {};
    for (const [k, d] of Object.entries(PLANETS)) planets[k] = d.sidereal_ratio.valeur() * t + (this.offsets.planets[k] ?? 0.0);
    return {
      turns: t, days: this.days, mean_sun, moon_mean, moon_true, moon_anomaly_deg: anom_deg,
      carrier_e3: this.raw('carrier_e3'), nodes: this.raw('nodes') + this.offsets.nodes,
      phase_turns: phase, phase_illum: illum, metonic: met, metonic_cell: met_cell, metonic_year: met_year,
      callippic: cal, callippic_quarter: cal_q, saros: sar, saros_cell: sar_cell, exeligmos: exe,
      exeligmos_sector: exe_sector, exeligmos_hours: exe_hours, games_year, games_name: GAMES[(games_year - 1) % 4]!,
      planets,
    };
  }

  /** Angle de rotation (tours) de CHAQUE roue (mêmes chaînes que gear_angles d'Anticythere3D). */
  gear_angles(): Record<string, number> {
    const t = this._turns;
    const T = TEETH;
    const a: Record<string, number> = {};
    a.b1 = a.b2 = t;
    a.a1 = (-t * T.b1!) / T.a1!;
    const r = t * (T.b2! / T.c1!);
    a.c1 = a.c2 = -r;
    const r2 = -r * (T.c2! / T.d1!);
    a.d1 = a.d2 = r2;
    const r3 = r2 * (T.d2! / T.e2!);
    a.e2 = a.e5 = -r3;
    const carrier = this.raw('carrier_e3');
    a.e3 = a.e4 = carrier;
    a.k1 = a.e5;
    a.k2 = a.k1 + this.pin.delta_turns(this.anomaly_phase());
    a.e6 = a.e1 = -a.k2;
    a.b3 = -a.e1;
    const m = t * (T.b2! / T.l1!);
    a.l1 = a.l2 = -m;
    const m2 = -m * (T.l2! / T.m1!);
    a.m1 = a.m2 = a.m3 = m2;
    const m3 = m2 * (T.m2! / T.n1!);
    a.n1 = a.n2 = -m3;
    const m4 = -m3 * (T.n2! / T.p1!);
    a.p1 = a.p2 = m4;
    a.o1 = -m4 * (T.p2! / T.o1!);
    const s2 = carrier * (T.e4! / T.f1!);
    a.f1 = a.f2 = -s2;
    const s3 = -s2 * (T.f2! / T.g1!);
    a.g1 = a.g2 = s3;
    const s4 = s3 * (T.g2! / T.h1!);
    a.h1 = a.h2 = -s4;
    a.i1 = -s4 * (T.h2! / T.i1!);
    return a;
  }
}

/**
 * Vitesse moyenne exacte de chaque roue, en tours par tour de b1 (par an), signée comme gear_angles() (la modulation
 * du tenon-fente, de moyenne nulle, est omise : k2, e6, e1 et b3 tournent en moyenne comme k1).
 */
export const GEAR_RATES: Readonly<Record<string, Frac>> = (() => {
  const T = TEETH;
  const F = (n: number, d = 1): Frac => new Frac(n, d);
  const r: Record<string, Frac> = {};
  r.b1 = r.b2 = F(1);
  r.a1 = F(-T.b1!, T.a1!);
  const c = F(T.b2!, T.c1!).neg();
  r.c1 = r.c2 = c;
  const d = c.neg().mul(F(T.c2!, T.d1!)).neg();
  r.d1 = r.d2 = d;
  const e = d.mul(F(T.d2!, T.e2!)).neg();
  r.e2 = r.e5 = r.k1 = r.k2 = e;
  r.e6 = r.e1 = e.neg();
  r.b3 = e;
  const car = RATIOS.carrier_e3!;
  r.e3 = r.e4 = car;
  const l = F(T.b2!, T.l1!).neg();
  r.l1 = r.l2 = l;
  const m = l.mul(F(T.l2!, T.m1!));
  r.m1 = r.m2 = r.m3 = m;
  const n = m.mul(F(T.m2!, T.n1!)).neg();
  r.n1 = r.n2 = n;
  const p = n.mul(F(T.n2!, T.p1!));
  r.p1 = r.p2 = p;
  r.o1 = p.neg().mul(F(T.p2!, T.o1!));
  const f = car.mul(F(T.e4!, T.f1!)).neg();
  r.f1 = r.f2 = f;
  const g = f.mul(F(T.f2!, T.g1!));
  r.g1 = r.g2 = g;
  const h = g.mul(F(T.g2!, T.h1!)).neg();
  r.h1 = r.h2 = h;
  r.i1 = h.mul(F(T.h2!, T.i1!));
  return r;
})();

// ==================================================================== implantation (layout.py)
export const MODULE = 1.0;
export const GEAR_THICKNESS = 2.6;
export const LEVEL_PITCH = 3.4;
export const ARBOR_RADIUS = 2.0;
export const EXPLODE_GAP = 12.0;
export const N_LEVELS = 16;

/** Position (x, y) de chaque arbre, mm : optimisation sous contraintes (SageMath + scipy) d'Anticythere3D 1.3.1. */
export const ARBORS: Readonly<Record<string, [number, number]>> = {
  K: [8.795, -30.198], a: [135.5, 0.0], b: [0.0, 0.0], c: [33.423, -38.521], d: [12.022, -67.469],
  e: [-31.976, -1.254], f: [88.145, -10.797], g: [80.0, -52.0], h: [46.569, -30.036], i: [15.326, -9.297],
  k: [10.007, -28.41], l: [21.528, 46.234], m: [91.22, 19.905], n: [80.0, 52.0], o: [13.6707, 41.0575],
  p: [48.444, 31.74],
};

/** Étage de chaque roue (1 = devant). */
export const LEVELS: Readonly<Record<string, number>> = {
  a1: 1, b1: 1, b2: 2, c1: 2, l1: 2, c2: 3, d1: 3, d2: 4, e2: 4, b3: 5, e1: 5, l2: 6, m1: 6, m2: 7, n1: 7,
  e6: 8, k2: 8, e5: 9, k1: 9, e3: 10, m3: 10, e4: 11, f1: 11, n2: 12, p1: 12, o1: 13, p2: 13, f2: 14, g1: 14,
  g2: 15, h1: 15, h2: 16, i1: 16,
};

/** Roues à bras (évidées). */
export const SPOKED: Readonly<Record<string, number>> = { b1: 4, e3: 4, e4: 4 };
export const CARRIED_BY: Readonly<Record<string, string>> = { k: 'e3', K: 'e3' };
export const MOUNTED_ON: Readonly<Record<string, string>> = { k: 'e3' };

export const ARBOR_OF: Readonly<Record<string, string>> = {
  a1: 'a', b1: 'b', b2: 'b', b3: 'b', c1: 'c', c2: 'c', d1: 'd', d2: 'd',
  e1: 'e', e2: 'e', e3: 'e', e4: 'e', e5: 'e', e6: 'e', f1: 'f', f2: 'f', g1: 'g', g2: 'g',
  h1: 'h', h2: 'h', i1: 'i', k1: 'k', k2: 'K', l1: 'l', l2: 'l', m1: 'm', m2: 'm', m3: 'm',
  n1: 'n', n2: 'n', o1: 'o', p1: 'p', p2: 'p',
};

/** Sous-ensembles fonctionnels (couleur commune). */
export const SUBSYSTEMS: Readonly<Record<string, readonly string[]>> = {
  input: ['b1', 'b2', 'a1'],
  moon: ['c1', 'c2', 'd1', 'd2', 'e2', 'e5', 'e6', 'e1', 'b3'],
  anomaly: ['k1', 'k2', 'e3', 'e4'],
  metonic: ['l1', 'l2', 'm1', 'm2', 'n1'],
  callippic: ['n2', 'p1', 'p2', 'o1'],
  saros: ['m3', 'f1', 'f2', 'g1'],
  exeligmos: ['g2', 'h1', 'h2', 'i1'],
};
export const SUBSYSTEM_KEYS = ['input', 'moon', 'anomaly', 'metonic', 'callippic', 'saros', 'exeligmos'] as const;
export const SUBSYSTEM_OF: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(SUBSYSTEMS).flatMap(([s, g]) => g.map((x) => [x, s])),
);

/** Palette des sous-ensembles (Anticythere3D : CIEDE2000 ≥ 20, daltonismes simulés), RVB 0–255. */
export const COLORS: Readonly<Record<string, [number, number, number]>> = {
  input: [0xde, 0x69, 0x10], moon: [0x0d, 0x59, 0xc1], anomaly: [0x8e, 0x17, 0x00], metonic: [0x1d, 0x95, 0x94],
  callippic: [0x78, 0x6f, 0x4c], saros: [0x84, 0x19, 0x59], exeligmos: [0xb6, 0x6c, 0xcd],
};

/** Les 17 prises (engrènements) : leurs entraxes valent m (N₁ + N₂) / 2. */
export const MESHES: readonly [string, string][] = [
  ['a1', 'b1'], ['b2', 'c1'], ['c2', 'd1'], ['d2', 'e2'], ['e5', 'k1'], ['k2', 'e6'], ['e1', 'b3'], ['b2', 'l1'],
  ['l2', 'm1'], ['m2', 'n1'], ['n2', 'p1'], ['p2', 'o1'], ['m3', 'e3'], ['e4', 'f1'], ['f2', 'g1'], ['g2', 'h1'],
  ['h2', 'i1'],
];

export function level_pitch(explode = 0.0): number {
  return LEVEL_PITCH + Math.max(0.0, Math.min(1.0, explode)) * EXPLODE_GAP;
}
/** Hauteur (mm) du plan d'un étage ; l'étage 16 reste en place, l'éclatement étire la pile. */
export function level_z(level: number, explode = 0.0): number {
  return (N_LEVELS - level) * level_pitch(explode);
}
export function front_shift(explode = 0.0): number {
  return level_z(1, explode) - level_z(1, 0.0);
}
/** Position d'un point porté par le porte-satellite e3 (axes k et K). */
export function orbit(x: number, y: number, carrier_turns: number): [number, number] {
  const [ex, ey] = ARBORS.e!;
  const a = 2.0 * Math.PI * carrier_turns;
  const dx = x - ex,
    dy = y - ey;
  const c = Math.cos(a),
    s = Math.sin(a);
  return [ex + c * dx - s * dy, ey + s * dx + c * dy];
}
/** (x, y, z) d'une roue ; (x, y) ne dépend que du porte-satellite, jamais de l'éclatement. */
export function gear_placement(name: string, explode = 0.0, carrier_turns = 0.0): [number, number, number] {
  let [x, y] = ARBORS[ARBOR_OF[name]!]!;
  const z = level_z(LEVELS[name]!, explode);
  if (ARBOR_OF[name] === 'k' || ARBOR_OF[name] === 'K') [x, y] = orbit(x, y, carrier_turns);
  return [x, y, z];
}
export function arbor_position(arbor: string, carrier_turns = 0.0): [number, number] {
  const [x, y] = ARBORS[arbor]!;
  return arbor in CARRIED_BY ? orbit(x, y, carrier_turns) : [x, y];
}
export function arbor_stub(explode = 0.0): number {
  const e = Math.max(0.0, Math.min(1.0, explode));
  return 0.6 + 0.4 * e * EXPLODE_GAP;
}
export function arbor_extent(arbor: string, explode = 0.0): [number, number] {
  const zs = Object.entries(ARBOR_OF).filter(([, a]) => a === arbor).map(([g]) => level_z(LEVELS[g]!, explode));
  const stub = arbor_stub(explode);
  return [Math.min(...zs) - stub, Math.max(...zs) + GEAR_THICKNESS + stub];
}
export const BACK_DIAL_ARBORS = ['n', 'g', 'o', 'i'];
export const FRONT_DIAL_ARBORS = ['b'];
/** Longueur DESSINÉE d'un arbre (prolongé jusqu'à son cadran s'il porte une aiguille). */
export function arbor_span(arbor: string, explode = 0.0): [number, number] {
  let [z0, z1] = arbor_extent(arbor, explode);
  if (arbor in MOUNTED_ON) {
    const zc = level_z(LEVELS[MOUNTED_ON[arbor]!]!, explode);
    z0 = Math.min(z0, zc);
    z1 = Math.max(z1, zc + GEAR_THICKNESS);
  }
  if (BACK_DIAL_ARBORS.includes(arbor)) z0 = level_z(N_LEVELS) - 8.0 - 12.0;
  if (FRONT_DIAL_ARBORS.includes(arbor)) z1 = level_z(1, explode) + 8.0 + 9.0;
  return [z0, z1];
}

export const METONIC_RADIUS = 50.0;
export const SAROS_RADIUS = 46.25;

/** Emprise réelle du mécanisme (rayons de tête, manivelle, spirales), plus une marge. */
export function mechanism_extent(margin = 14.0): [number, number, number, number] {
  const xs: number[] = [],
    ys: number[] = [];
  for (const g of Object.keys(LEVELS)) {
    const [x, y] = ARBORS[ARBOR_OF[g]!]!;
    const r = MODULE * (TEETH[g]! / 2.0 + 1.0);
    xs.push(x - r, x + r);
    ys.push(y - r, y + r);
  }
  const [ax, ay] = ARBORS.a!;
  xs.push(ax + 30.0);
  ys.push(ay - 20.0, ay + 20.0);
  for (const [arbor, rad] of [['n', METONIC_RADIUS], ['g', SAROS_RADIUS]] as [string, number][]) {
    const [x, y] = ARBORS[arbor]!;
    xs.push(x - rad, x + rad);
    ys.push(y - rad, y + rad);
  }
  return [Math.min(...xs) - margin, Math.max(...xs) + margin, Math.min(...ys) - margin, Math.max(...ys) + margin];
}
const [X0, X1, Y0, Y1] = mechanism_extent();
export const CASE_WIDTH = X1 - X0;
export const CASE_HEIGHT = Y1 - Y0;
export const CASE_CX = (X0 + X1) / 2.0;
export const CASE_CY = (Y0 + Y1) / 2.0;
export const CASE_DEPTH = (N_LEVELS + 1) * LEVEL_PITCH;

// manivelle
export const CRANK_SHAFT = 34.0;
export const CRANK_ARM = 26.0;
export const CRANK_HANDLE = 20.0;
export const CRANK_RADIUS = CRANK_ARM - 4.0;
/** tours de manivelle (roue a1) par tour de b1 = 223/48, de sens contraire */
export const CRANK_PER_TURN = -223.0 / 48.0;

// cadrans (anticythere_cadrans.sage, anticythere_cadrans2.sage)
export const FRONT_DIAL_SPAN = 244.0;
const ZOD_IN_F = 0.63,
  ZOD_OUT_F = 0.825;
export const SUN_HAND = (FRONT_DIAL_SPAN / 2.0) * ZOD_OUT_F - 3.0;
export const MOON_HAND = ((FRONT_DIAL_SPAN / 2.0) * (ZOD_IN_F + ZOD_OUT_F)) / 2.0;
export const BACK_DIAL_SPAN = Math.max(CASE_WIDTH, CASE_HEIGHT) + 12.0;
export const CALLIPPIC_RADIUS = 9.9;
export const EXELIGMOS_RADIUS = 9.2;
export const GAMES_RADIUS = 13.0;
export const GAMES_CENTER: [number, number] = [-70.0, 0.0];
/** Anneaux du Cosmos (Freeth 2021) : rayon (mm) et couleur RVB. */
export const COSMOS_RINGS: readonly [string, number, [number, number, number]][] = [
  ['moon', 26.0, [191, 199, 214]], ['mercury', 34.0, [140, 122, 107]], ['venus', 42.0, [230, 212, 158]],
  ['sun', 50.0, [255, 204, 64]], ['mars', 58.0, [199, 82, 51]], ['jupiter', 65.0, [217, 194, 158]],
  ['saturn', 72.0, [184, 158, 97]],
];
export const METONIC_CENTER = ARBORS.n!;
export const SAROS_CENTER = ARBORS.g!;

/** Plans de la façade et du dos (machine montée) : faces extérieures du coffret. */
export const Z_FRONT = level_z(1) + 16.0;
export const Z_BACK = level_z(N_LEVELS) - 18.0;

// ==================================================================== inscriptions (dialface.py)
export const ZODIAC_GREEK: readonly [string, string, string][] = [
  ['ΚΡΙΟΣ', 'Bélier', 'Aries'], ['ΤΑΥΡΟΣ', 'Taureau', 'Taurus'], ['ΔΙΔΥΜΟΙ', 'Gémeaux', 'Gemini'],
  ['ΚΑΡΚΙΝΟΣ', 'Cancer', 'Cancer'], ['ΛΕΩΝ', 'Lion', 'Leo'], ['ΠΑΡΘΕΝΟΣ', 'Vierge', 'Virgo'],
  ['ΧΗΛΑΙ', 'Balance', 'Libra'], ['ΣΚΟΡΠΙΟΣ', 'Scorpion', 'Scorpio'], ['ΤΟΞΟΤΗΣ', 'Sagittaire', 'Sagittarius'],
  ['ΑΙΓΟΚΕΡΩΣ', 'Capricorne', 'Capricorn'], ['ΥΔΡΟΧΟΟΣ', 'Verseau', 'Aquarius'], ['ΙΧΘΥΕΣ', 'Poissons', 'Pisces'],
];
export const EGYPTIAN_GREEK = ['ΘΩΘ', 'ΦΑΩΦΙ', 'ΑΘΥΡ', 'ΧΟΙΑΚ', 'ΤΥΒΙ', 'ΜΕΧΕΙΡ', 'ΦΑΜΕΝΩΘ', 'ΦΑΡΜΟΥΘΙ', 'ΠΑΧΩΝ', 'ΠΑΥΝΙ', 'ΕΠΙΦΙ', 'ΜΕΣΟΡΗ'];
export const EGYPTIAN_MONTHS = ['Thoth', 'Phaophi', 'Athyr', 'Choiak', 'Tybi', 'Mechir', 'Phamenoth', 'Pharmouthi', 'Pachon', 'Payni', 'Epiphi', 'Mesore'];
export const PARAPEGMA_LETTERS = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';
export const GAMES_GREEK = ['ΙΣΘΜΙΑ', 'ΟΛΥΜΠΙΑ', 'ΝΕΜΕΑ', 'ΠΥΘΙΑ'];
export const CORINTHIAN_MONTHS: readonly [string, string][] = [
  ['ΦΟΙΝΙΚΑΙΟΣ', 'ΦΟΙΝ'], ['ΚΡΑΝΕΙΟΣ', 'ΚΡΑΝ'], ['ΛΑΝΟΤΡΟΠΙΟΣ', 'ΛΑΝΟ'], ['ΜΑΧΑΝΕΥΣ', 'ΜΑΧΑ'],
  ['ΔΩΔΕΚΑΤΕΥΣ', 'ΔΩΔΕ'], ['ΕΥΚΛΕΙΟΣ', 'ΕΥΚΛ'], ['ΑΡΤΕΜΙΣΙΟΣ', 'ΑΡΤΕ'], ['ΨΥΔΡΕΥΣ', 'ΨΥΔΡ'],
  ['ΓΑΜΕΙΛΙΟΣ', 'ΓΑΜΕ'], ['ΑΓΡΙΑΝΙΟΣ', 'ΑΓΡΙ'], ['ΠΑΝΑΜΟΣ', 'ΠΑΝΑ'], ['ΑΠΕΛΛΑΙΟΣ', 'ΑΠΕΛ'],
];
export const GREEK_NUMERALS = ['Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ϛ', 'Ζ', 'Η', 'Θ', 'Ι', 'ΙΑ', 'ΙΒ', 'ΙΓ', 'ΙΔ', 'ΙΕ', 'ΙϚ', 'ΙΖ', 'ΙΗ', 'ΙΘ'];
/** Années de 13 mois du cycle métonique : (12k) mod 19 < 7 ; 235 = 19 × 12 + 7. */
export const EMBOLISMIC_YEARS = new Set([2, 5, 8, 10, 13, 16, 19]);
/** Cases du Saros portant un glyphe : calculées (syzygie proche d'un nœud) sur 223 mois depuis janvier 2000. */
export const SAROS_SOLAR = new Set([0, 1, 6, 7, 12, 18, 24, 30, 36, 42, 47, 48, 53, 54, 59, 65, 71, 77, 83, 88, 89, 95, 100, 106, 107, 112, 118, 124, 129, 130, 136, 141, 147, 148, 153, 159, 165, 171, 177, 182, 183, 188, 189, 194, 200, 206, 212, 218]);
export const SAROS_LUNAR = new Set([0, 6, 12, 18, 30, 35, 41, 47, 53, 59, 71, 76, 82, 88, 94, 100, 106, 112, 123, 129, 135, 141, 147, 153, 159, 164, 176, 182, 188, 194, 200, 217]);
export const EXELIGMOS_LABELS = ['0', 'Η', 'ΙϚ'];

/** Numéro de mois (0–234) où commence chacune des 19 années métoniques. */
export function metonic_year_starts(): number[] {
  const out: number[] = [];
  let mois = 0;
  for (let k = 1; k <= 19; k++) {
    out.push(mois);
    mois += EMBOLISMIC_YEARS.has(k) ? 13 : 12;
  }
  if (mois !== 235) throw new Error('cycle métonique');
  return out;
}

/** Glyphe d'éclipse de la case k du Saros (Η : Soleil, Σ : Lune), ou ''. */
export function saros_glyph(k: number): string {
  const s = SAROS_SOLAR.has(k),
    l = SAROS_LUNAR.has(k);
  return s && l ? 'ΗΣ' : s ? 'Η' : l ? 'Σ' : '';
}

// ==================================================================== astronomie de référence (astro.py)
export const J2000 = 2451545.0;
const DEG = Math.PI / 180;

/** Jour julien (UTC) ; calendrier grégorien à partir du 15 octobre 1582, julien avant ; années astronomiques. */
export function julian_day(year: number, month: number, day: number, hour = 0): number {
  let y = year,
    m = month;
  const d = day + hour / 24.0;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const gregorien = year > 1582 || (year === 1582 && (month > 10 || (month === 10 && day >= 15)));
  let b = 0;
  if (gregorien) {
    const a = Math.floor(y / 100);
    b = 2 - a + Math.floor(a / 4);
  }
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
}

/** Inverse de julian_day : [année, mois, jour, heure décimale]. */
export function from_julian_day(jd: number): [number, number, number, number] {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e) + f;
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  const di = Math.floor(day);
  return [year, month, di, (day - di) * 24.0];
}

export function centuries(jd: number): number {
  return (jd - J2000) / 36525.0;
}
export function sun_mean_longitude(jd: number): number {
  const t = centuries(jd);
  return pmod(280.46646 + 36000.76983 * t + 0.0003032 * t * t, 360.0);
}
export function sun_mean_anomaly(jd: number): number {
  const t = centuries(jd);
  return pmod(357.52911 + 35999.05029 * t - 0.0001537 * t * t, 360.0);
}
/** Longitude apparente du Soleil (degrés), équation du centre comprise. */
export function sun_longitude(jd: number): number {
  const t = centuries(jd);
  const m = sun_mean_anomaly(jd) * DEG;
  const c = (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(m) + (0.019993 - 0.000101 * t) * Math.sin(2 * m) + 0.000289 * Math.sin(3 * m);
  return pmod(sun_mean_longitude(jd) + c, 360.0);
}
export function moon_arguments(jd: number): { Lp: number; D: number; M: number; Mp: number; F: number; Omega: number } {
  const t = centuries(jd);
  return {
    Lp: pmod(218.3164477 + 481267.88123421 * t - 0.0015786 * t * t, 360.0),
    D: pmod(297.8501921 + 445267.1114034 * t - 0.0018819 * t * t, 360.0),
    M: pmod(357.5291092 + 35999.0502909 * t - 0.0001536 * t * t, 360.0),
    Mp: pmod(134.9633964 + 477198.8675055 * t + 0.0087414 * t * t, 360.0),
    F: pmod(93.272095 + 483202.0175233 * t - 0.0036539 * t * t, 360.0),
    Omega: pmod(125.0445479 - 1934.1362891 * t + 0.0020754 * t * t, 360.0),
  };
}
const MOON_TERMS: readonly [number, number, number, number, number][] = [
  [6.288774, 0, 0, 1, 0], [1.274027, 2, 0, -1, 0], [0.658314, 2, 0, 0, 0], [0.213618, 0, 0, 2, 0],
  [-0.185116, 0, 1, 0, 0], [-0.114332, 0, 0, 0, 2], [0.058793, 2, 0, -2, 0], [0.057066, 2, -1, -1, 0],
  [0.053322, 2, 0, 1, 0], [0.045758, 2, -1, 0, 0], [-0.040923, 0, 1, -1, 0], [-0.03472, 1, 0, 0, 0],
  [-0.030383, 0, 1, 1, 0], [0.015327, 2, 0, 0, -2], [-0.012528, 0, 0, 1, 2], [0.01098, 0, 0, 1, -2],
];
/** Longitude géocentrique de la Lune (degrés), 16 premiers termes de Meeus 47.A. */
export function moon_longitude(jd: number): number {
  const a = moon_arguments(jd);
  let total = 0.0;
  for (const [coef, cd, cm, cmp, cf] of MOON_TERMS) total += coef * Math.sin((cd * a.D + cm * a.M + cmp * a.Mp + cf * a.F) * DEG);
  return pmod(a.Lp + total, 360.0);
}
export function elongation(jd: number): number {
  return pmod(moon_longitude(jd) - sun_longitude(jd), 360.0);
}
export const SOLAR_LIMIT = 18.5;
export const SOLAR_CENTRAL = 15.4;
export const LUNAR_LIMIT = 12.2;
export const LUNAR_CENTRAL = 9.5;
/** Critère que la machine mécanise : syzygie proche d'un nœud (Meeus ch. 54). */
export function eclipse_possible(jd: number): { type: 'solar' | 'lunar' | null; certain: boolean; arg: number } {
  const e = elongation(jd);
  const f = pmod(moon_arguments(jd).F, 180.0);
  const dist = Math.min(f, 180.0 - f);
  const near_new = Math.min(e, 360.0 - e) < 12.0;
  const near_full = Math.abs(e - 180.0) < 12.0;
  if (near_new && dist < SOLAR_LIMIT) return { type: 'solar', certain: dist < SOLAR_CENTRAL, arg: dist };
  if (near_full && dist < LUNAR_LIMIT) return { type: 'lunar', certain: dist < LUNAR_CENTRAL, arg: dist };
  return { type: null, certain: false, arg: dist };
}
/** Décalages qui calent la machine sur le ciel à la date jd (Soleil MOYEN, Lune MOYENNE, anomalie, nœud). */
export function calibration_offsets(jd: number): Offsets {
  const a = moon_arguments(jd);
  return { mean_sun: sun_mean_longitude(jd) / 360.0, moon: a.Lp / 360.0, anomaly: a.Mp / 360.0, nodes: a.Omega / 360.0, metonic: 0.0, saros: 0.0, planets: calibrate_planets(jd) };
}
/** Longitudes héliocentriques moyennes des planètes à jd (tours), pour caler les index à l'époque. */
export function calibrate_planets(jd: number): Record<string, number> {
  const t = centuries(jd);
  const mean: Record<string, number> = {
    mercury: 252.250906 + 149472.6746358 * t, venus: 181.979801 + 58517.815676 * t, mars: 355.433 + 19141.6964471 * t,
    jupiter: 34.351519 + 3036.3027748 * t, saturn: 50.077444 + 1223.5110686 * t,
  };
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(mean)) out[k] = pmod(v, 360.0) / 360.0;
  return out;
}

/**
 * Longitude géocentrique (degrés) d'une planète d'après le modèle à épicycle du Cosmos (Freeth et al. 2021) : la
 * planète parcourt son cercle (période sidérale tirée de la relation de période), la Terre le sien (Soleil moyen
 * + 180°), rapport des rayons = demi-grand axe ; c'est ce qu'indique la petite sphère de chaque anneau.
 */
export function geocentric_longitude(name: string, helio_turns: number, mean_sun_turns: number): number {
  const a = PLANETS[name]!.a;
  const lp = 2 * Math.PI * helio_turns,
    le = 2 * Math.PI * (mean_sun_turns + 0.5);
  return pmod((Math.atan2(a * Math.sin(lp) - Math.sin(le), a * Math.cos(lp) - Math.cos(le)) * 180) / Math.PI, 360.0);
}

/** Ère de Nabonassar : 1er Thoth de l'an 1 = 26 février −746 (julien), JD 1448638 ; année vague de 365 jours. */
export const NABONASSAR_JD = 1448638;
/** Date du calendrier égyptien : [mois 0–11, ou 12 pour les cinq jours épagomènes ; jour 1–30]. */
export function egyptian_date(jd: number): [number, number] {
  const n = pmod(Math.floor(jd + 0.5 - NABONASSAR_JD), 365);
  return n < 360 ? [Math.floor(n / 30), (n % 30) + 1] : [12, n - 360 + 1];
}
/** Jour de l'année égyptienne (0–364). */
export function egyptian_day(jd: number): number {
  return pmod(Math.floor(jd + 0.5 - NABONASSAR_JD), 365);
}

// ==================================================================== lecture complète
/** Machine calée sur le ciel à J2000, comme Anticythere3D. */
export function machine_calee(): Mechanism {
  return new Mechanism(undefined, calibration_offsets(J2000));
}

export function zodiac_sign(longitude_deg: number): [number, number] {
  const lon = pmod(longitude_deg, 360.0);
  const idx = Math.floor(lon / 30.0);
  return [idx, lon - 30.0 * idx];
}
export function phase_index(elongation_turns: number): number {
  return Math.trunc(pmod(elongation_turns, 1.0) * 8.0 + 0.5) % 8;
}

/** x modulo 360, dans [0, 360[. */
export function pmod360(x: number): number {
  return pmod(x, 360.0);
}
