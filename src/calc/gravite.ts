/**
 * Mécanique de l'animation « Gravité et orbites » (d'après la simulation PhET Gravity and Orbits, University of
 * Colorado Boulder ; code propre à Coupole) : N corps en gravitation newtonienne dans un plan, intégrés par le schéma
 * symplectique de Yoshida d'ordre 4 (trois « dérive – poussée » de Verlet de vitesse composées), à pas adaptatif
 * (une fraction η du temps dynamique de la paire la plus serrée).  Jumeau exact de gravite_meca.py de Coupole :
 * mêmes opérations dans le même ordre, donc mêmes nombres au bit près (cas communs : tests/references/gravite_cas.json).
 *
 * Constantes : G (CODATA 2018), GM☉ et GM⊕ nominaux (UAI 2015 B3), GM☾ (DE440), rayons nominaux (UAI 2015 B3) et de
 * la Lune (NASA), unité astronomique (UAI 2012 B2), ISS (NASA) ; vérifiées sous SageMath
 * (outils/verif_anim/gravite_orbites_verif.sage de Coupole → tests/references/gravite_orbites_sage.json).
 */

export const G = 6.6743e-11;
export const UA = 149597870700.0;
export const JOUR = 86400.0;
export const GM_SOLEIL = 1.3271244e20;
export const GM_TERRE = 3.986004e14;
export const GM_LUNE = 4.902800118e12;
export const A_LUNE = 3.844e8;
export const ALT_ISS = 415000.0;

/** masses (kg) */
export const MASSES: Readonly<Record<string, number>> = {
  soleil: GM_SOLEIL / G,
  terre: GM_TERRE / G,
  lune: GM_LUNE / G,
  iss: 419725.0,
  comete: 1e14,
};
/** rayons réels (m) ; ISS : demi-envergure (109 m) ; comète : noyau de Halley (≈ 5,5 km) */
export const RAYONS: Readonly<Record<string, number>> = {
  soleil: 6.957e8,
  terre: 6.3781e6,
  lune: 1.7374e6,
  iss: 54.5,
  comete: 5.5e3,
};
/** périodes vraies (j) : année sidérale, mois sidéral (NASA) */
export const VRAIES_J: Readonly<Record<string, number>> = { terre: 365.256363, lune: 27.321661 };

/**
 * État réel du Soleil, de la Terre et de la Lune le 1er janvier 2026 à 0 h TDB (DE440, écliptique J2000), chaque orbite
 * ramenée dans le plan de l'écliptique par une rotation autour de sa ligne des nœuds (demi-grand axe, excentricité et
 * période gardés), le tout tourné pour que la Terre parte à droite du Soleil : [x, y, vx, vy] (m, m·s⁻¹)
 * (outils/verif_anim/etat_initial_gravite.py de Coupole).  Une Lune lancée sur un cercle de Kepler prendrait, dans le
 * champ de marée du Soleil, une orbite déformée de période 27,05 à 27,81 j selon la phase de départ.
 */
export const ETAT_2026: Readonly<Record<string, readonly number[]>> = {
  soleil: [-447268.19852799166, 7.429785804638976, 7.282139173820521e-05, -0.09207872686803291],
  terre: [147103130738.3562, 7.429789767206905, -31.149223260146357, 30273.645476968926],
  lune: [147402951395.03217, -201115268.94787067, 561.2687042467766, 31187.344882943245],
};

/** coefficients de Yoshida (1990) d'ordre 4 : w₁ = 1 / (2 − ∛2), w₀ = −∛2 / (2 − ∛2) (SageMath) */
const Y_C1 = 0.6756035959798288;
const Y_C2 = -0.17560359597982883;
const Y_D1 = 1.3512071919596575;
const Y_D2 = -1.7024143839193153;
/** fraction du temps dynamique √(r³ / G(m₁ + m₂)) prise pour pas d'intégration */
export const ETA = 0.01;
/** pas d'intégration au plus par appel de avancer() (au-delà, le temps simulé prend du retard) */
export const MAX_PAS = 20000;

export const SCENARIOS = ['soleil_terre', 'soleil_terre_lune', 'terre_lune', 'terre_iss', 'libre'] as const;
export type Scenario = (typeof SCENARIOS)[number];

export interface Corps {
  nom: string;
  m: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rayon: number;
  /** indice du corps autour duquel il tourne (−1 : aucun) */
  primaire: number;
  actif: boolean;
}

function copie(c: Corps): Corps {
  return { nom: c.nom, m: c.m, x: c.x, y: c.y, vx: c.vx, vy: c.vy, rayon: c.rayon, primaire: c.primaire, actif: c.actif };
}

/** Deux corps en orbite circulaire, barycentre au repos à l'origine : [x, y, vx, vy] de chacun. */
function deux(m1: number, m2: number, r: number): [number[], number[]] {
  const v = Math.sqrt((G * (m1 + m2)) / r);
  const x1 = (-r * m2) / (m1 + m2);
  const x2 = (r * m1) / (m1 + m2);
  const v1 = (-v * m2) / (m1 + m2);
  const v2 = (v * m1) / (m1 + m2);
  return [[x1, 0.0, 0.0, v1], [x2, 0.0, 0.0, v2]];
}

function corps(nom: string, s: number[], primaire = -1): Corps {
  return { nom, m: MASSES[nom]!, x: s[0]!, y: s[1]!, vx: s[2]!, vy: s[3]!, rayon: RAYONS[nom]!, primaire, actif: true };
}

/** Quantité de mouvement totale nulle et barycentre à l'origine. */
export function recentrer(cs: Corps[]): void {
  let mt = 0.0,
    cx = 0.0,
    cy = 0.0,
    px = 0.0,
    py = 0.0;
  for (const c of cs) if (c.actif) mt += c.m;
  for (const c of cs) if (c.actif) cx += c.m * c.x;
  for (const c of cs) if (c.actif) cy += c.m * c.y;
  for (const c of cs) if (c.actif) px += c.m * c.vx;
  for (const c of cs) if (c.actif) py += c.m * c.vy;
  cx /= mt;
  cy /= mt;
  px /= mt;
  py /= mt;
  for (const c of cs) {
    c.x -= cx;
    c.y -= cy;
    c.vx -= px;
    c.vy -= py;
  }
}

/**
 * Corps d'un scénario (masses nominales) : chaque couple part sur une orbite circulaire, le corps à +r sur l'axe x de
 * son primaire, vitesse relative √(G (m + m_primaire) / r) selon +y (sens direct) ; le Soleil, la Terre et la Lune
 * ensemble partent de leur état réel du 1er janvier 2026 (ETAT_2026) ; la comète du scénario libre part de son
 * périhélie (0,6 ua) à −x vers −y (aphélie 2,4 ua).
 */
export function scenario(nom: Scenario): Corps[] {
  const M = MASSES;
  let cs: Corps[];
  if (nom === 'soleil_terre') {
    const [a, b] = deux(M.soleil!, M.terre!, UA);
    cs = [corps('soleil', a), corps('terre', b, 0)];
  } else if (nom === 'terre_lune') {
    const [a, b] = deux(M.terre!, M.lune!, A_LUNE);
    cs = [corps('terre', a), corps('lune', b, 0)];
  } else if (nom === 'terre_iss') {
    const [a, b] = deux(M.terre!, M.iss!, RAYONS.terre! + ALT_ISS);
    cs = [corps('terre', a), corps('iss', b, 0)];
  } else {
    cs = [corps('soleil', [...ETAT_2026.soleil!]), corps('terre', [...ETAT_2026.terre!], 0), corps('lune', [...ETAT_2026.lune!], 1)];
    if (nom === 'libre') {
      const q = 0.6 * UA,
        Q = 2.4 * UA;
      const v = Math.sqrt(G * (M.soleil! + M.comete!) * (2 / q - 2 / (q + Q)));
      cs.push(corps('comete', [-q, 0.0, 0.0, -v], 0));
    }
  }
  recentrer(cs);
  return cs;
}

/** Accélérations (m·s⁻²) de tous les corps actifs ; nulles sans gravité. */
export function accelerations(cs: readonly Corps[], gravite: boolean, ax: number[], ay: number[]): void {
  const n = cs.length;
  for (let i = 0; i < n; i++) {
    ax[i] = 0.0;
    ay[i] = 0.0;
  }
  if (!gravite) return;
  for (let i = 0; i < n; i++) {
    const a = cs[i]!;
    if (!a.actif) continue;
    for (let j = i + 1; j < n; j++) {
      const b = cs[j]!;
      if (!b.actif) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const r2 = dx * dx + dy * dy;
      const r = Math.sqrt(r2);
      const f = G / (r2 * r);
      ax[i] = ax[i]! + f * b.m * dx;
      ay[i] = ay[i]! + f * b.m * dy;
      ax[j] = ax[j]! - f * a.m * dx;
      ay[j] = ay[j]! - f * a.m * dy;
    }
  }
}

export function energie(cs: readonly Corps[]): number {
  let e = 0.0;
  const n = cs.length;
  for (let i = 0; i < n; i++) {
    const a = cs[i]!;
    if (!a.actif) continue;
    e += 0.5 * a.m * (a.vx * a.vx + a.vy * a.vy);
    for (let j = i + 1; j < n; j++) {
      const b = cs[j]!;
      if (!b.actif) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      e -= (G * a.m * b.m) / Math.sqrt(dx * dx + dy * dy);
    }
  }
  return e;
}

/** Moment cinétique total (kg·m²·s⁻¹) par rapport à l'origine. */
export function moment(cs: readonly Corps[]): number {
  let l = 0.0;
  for (const c of cs) if (c.actif) l += c.m * (c.x * c.vy - c.y * c.vx);
  return l;
}

interface Suivi {
  i: number;
  p: number;
  ux: number;
  uy: number;
  cPrec: number;
  sens: number;
  n: number;
  tDernier: number;
}

export interface Trace {
  x: number[];
  y: number[];
  /** position du primaire au même instant (dessin agrandi d'un satellite) */
  px: number[];
  py: number[];
}

export interface Collision {
  corps: string;
  sur: string;
  t: number;
}

/** Système de N corps : état, intégration, périodes mesurées, traces, courbure de la Lune vue du Soleil. */
export class Systeme {
  corps: Corps[] = [];
  t = 0.0;
  /** instant de départ des mesures (périodes, conservation) */
  t0 = 0.0;
  gravite = true;
  e0 = 0.0;
  l0 = 0.0;
  suivis: Suivi[] = [];
  traces: Trace[] = [];
  pasTrace = JOUR;
  tTrace = 0.0;
  maxTrace = 4000;
  collisions: Collision[] = [];
  /** rapport des courbures Lune / Terre (vues du Soleil), échantillonné avec les traces */
  courbures: number[] = [];
  courbureMin = Infinity;
  courbureMax = -Infinity;
  /** indices (Soleil, Terre, Lune) quand le scénario les a tous trois, sinon null */
  trio: [number, number, number] | null = null;
  /** pas d'intégration faits au dernier avancer() (mesures) */
  derniersPas = 0;
  private ax: number[] = [];
  private ay: number[] = [];

  constructor(cs: Corps[] = [], pasTrace = JOUR) {
    this.pasTrace = pasTrace;
    this.charger(cs);
  }

  charger(cs: Corps[]): void {
    this.corps = cs.map(copie);
    const i = (nom: string): number => this.corps.findIndex((c) => c.nom === nom);
    const s = i('soleil'),
      t = i('terre'),
      l = i('lune');
    this.trio = s >= 0 && t >= 0 && l >= 0 ? [s, t, l] : null;
    this.collisions = [];
    this.repartir();
  }

  /** Nouveau départ des mesures (après un changement de l'état par l'utilisateur) ; traces effacées. */
  repartir(): void {
    this.remesurer();
    this.effacerTraces();
  }

  /** Nouveau départ des mesures (périodes, énergie, moment cinétique), traces gardées (masse changée). */
  remesurer(): void {
    this.t0 = this.t;
    this.e0 = energie(this.corps);
    this.l0 = moment(this.corps);
    this.suivis = [];
    for (let i = 0; i < this.corps.length; i++) {
      const c = this.corps[i]!;
      const p = c.primaire;
      if (p < 0 || !c.actif || !this.corps[p]!.actif) continue;
      const rx = c.x - this.corps[p]!.x;
      const ry = c.y - this.corps[p]!.y;
      const r = Math.sqrt(rx * rx + ry * ry);
      if (!(r > 0)) continue;
      this.suivis.push({ i, p, ux: rx / r, uy: ry / r, cPrec: 0.0, sens: 0, n: 0, tDernier: 0.0 });
    }
  }

  effacerTraces(): void {
    this.traces = this.corps.map(() => ({ x: [], y: [], px: [], py: [] }));
    this.courbures = [];
    this.courbureMin = Infinity;
    this.courbureMax = -Infinity;
    this.tTrace = this.t;
    this.echantillonner();
  }

  /** Pas d'intégration : η × le plus court temps dynamique des paires actives (sans gravité : le pas des traces). */
  pas(): number {
    if (!this.gravite) return this.pasTrace;
    let tmin = Infinity;
    const cs = this.corps;
    const n = cs.length;
    for (let i = 0; i < n; i++) {
      const a = cs[i]!;
      if (!a.actif) continue;
      for (let j = i + 1; j < n; j++) {
        const b = cs[j]!;
        if (!b.actif) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const r2 = dx * dx + dy * dy;
        const td = Math.sqrt((r2 * Math.sqrt(r2)) / (G * (a.m + b.m)));
        if (td < tmin) tmin = td;
      }
    }
    return tmin === Infinity ? this.pasTrace : ETA * tmin;
  }

  private deriver(h: number): void {
    for (const c of this.corps) {
      if (!c.actif) continue;
      c.x += c.vx * h;
      c.y += c.vy * h;
    }
  }

  private pousser(h: number): void {
    accelerations(this.corps, this.gravite, this.ax, this.ay);
    const cs = this.corps;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i]!;
      if (!c.actif) continue;
      c.vx += this.ax[i]! * h;
      c.vy += this.ay[i]! * h;
    }
  }

  /** Un pas de Yoshida d'ordre 4 (symplectique, réversible) de durée h. */
  yoshida(h: number): void {
    this.deriver(Y_C1 * h);
    this.pousser(Y_D1 * h);
    this.deriver(Y_C2 * h);
    this.pousser(Y_D2 * h);
    this.deriver(Y_C2 * h);
    this.pousser(Y_D1 * h);
    this.deriver(Y_C1 * h);
  }

  /** Fait avancer le système de `duree` secondes (pas adaptatifs). */
  avancer(duree: number): void {
    let reste = duree;
    let k = 0;
    while (reste > 0 && k < MAX_PAS) {
      let h = this.pas();
      if (h > reste) h = reste;
      if (!(h > 0)) break;
      this.yoshida(h);
      this.t += h;
      reste -= h;
      k++;
      this.apresPas(h);
    }
    this.derniersPas = k;
  }

  private apresPas(h: number): void {
    const cs = this.corps;
    // collisions (rayons réels) : le plus léger s'écrase, sa quantité de mouvement passe au plus lourd
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i]!;
      if (!a.actif) continue;
      for (let j = i + 1; j < cs.length; j++) {
        const b = cs[j]!;
        if (!b.actif || !a.actif) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const rr = a.rayon + b.rayon;
        if (dx * dx + dy * dy < rr * rr) {
          const [l, g] = a.m < b.m ? [a, b] : [b, a];
          g.vx = (g.m * g.vx + l.m * l.vx) / g.m;
          g.vy = (g.m * g.vy + l.m * l.vy) / g.m;
          l.actif = false;
          this.collisions.push({ corps: l.nom, sur: g.nom, t: this.t });
          this.e0 = energie(cs);
          this.l0 = moment(cs);
        }
      }
    }
    // périodes : passages par la direction de départ (vue du primaire), instant interpolé dans le pas
    for (const s of this.suivis) {
      const c = cs[s.i]!;
      const p = cs[s.p]!;
      if (!c.actif || !p.actif) continue;
      const rx = c.x - p.x;
      const ry = c.y - p.y;
      const cr = s.ux * ry - s.uy * rx;
      const d = s.ux * rx + s.uy * ry;
      if (s.sens === 0 && cr !== 0) s.sens = cr > 0 ? 1 : -1;
      if (d > 0 && ((s.sens > 0 && s.cPrec < 0 && cr >= 0) || (s.sens < 0 && s.cPrec > 0 && cr <= 0))) {
        const tc = this.t - h + (h * -s.cPrec) / (cr - s.cPrec);
        s.n += 1;
        s.tDernier = tc - this.t0;
      }
      s.cPrec = cr;
    }
    if (this.t >= this.tTrace) this.echantillonner();
  }

  private echantillonner(): void {
    const cs = this.corps;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i]!;
      const tr = this.traces[i];
      if (!tr || !c.actif) continue;
      const p = c.primaire >= 0 ? cs[c.primaire]! : c;
      tr.x.push(c.x);
      tr.y.push(c.y);
      tr.px.push(p.x);
      tr.py.push(p.y);
      if (tr.x.length > this.maxTrace * 1.25) {
        const k = tr.x.length - this.maxTrace;
        tr.x.splice(0, k);
        tr.y.splice(0, k);
        tr.px.splice(0, k);
        tr.py.splice(0, k);
      }
    }
    const k = this.courbureLune();
    if (k !== null) {
      this.courbures.push(k);
      if (this.courbures.length > this.maxTrace * 1.25) this.courbures.splice(0, this.courbures.length - this.maxTrace);
      if (k < this.courbureMin) this.courbureMin = k;
      if (k > this.courbureMax) this.courbureMax = k;
    }
    while (this.tTrace <= this.t) this.tTrace += this.pasTrace;
  }

  /**
   * Courbure de la trajectoire de la Lune vue du Soleil (vitesse et accélération relatives au Soleil), rapportée à
   * celle de la Terre : positive = tournée du même côté (vers le Soleil).  null sans les trois corps.
   */
  courbureLune(): number | null {
    if (!this.trio || !this.gravite) return null;
    const [s, t, l] = this.trio;
    const cs = this.corps;
    if (!cs[s]!.actif || !cs[t]!.actif || !cs[l]!.actif) return null;
    const ax: number[] = [];
    const ay: number[] = [];
    accelerations(cs, true, ax, ay);
    const k = (i: number): number => {
      const vx = cs[i]!.vx - cs[s]!.vx;
      const vy = cs[i]!.vy - cs[s]!.vy;
      const gx = ax[i]! - ax[s]!;
      const gy = ay[i]! - ay[s]!;
      const v2 = vx * vx + vy * vy;
      return (vx * gy - vy * gx) / (v2 * Math.sqrt(v2));
    };
    const kt = k(t);
    return kt !== 0 ? k(l) / kt : null;
  }

  /** Période mesurée (s) du corps i autour de son primaire, ou null avant le premier tour. */
  periode(i: number): number | null {
    const s = this.suivis.find((x) => x.i === i);
    if (!s || s.n === 0) return null;
    return s.tDernier / s.n;
  }

  /** Tours complets du corps i depuis le départ des mesures. */
  tours(i: number): number {
    return this.suivis.find((x) => x.i === i)?.n ?? 0;
  }

  /** Écarts relatifs de l'énergie et du moment cinétique depuis le départ des mesures. */
  derives(): [number, number] {
    const e = energie(this.corps);
    const l = moment(this.corps);
    return [Math.abs((e - this.e0) / this.e0), this.l0 !== 0 ? Math.abs((l - this.l0) / this.l0) : Math.abs(l)];
  }

  /** Copie de l'état (pour « Retour »). */
  instantane(): { corps: Corps[]; t: number } {
    return { corps: this.corps.map(copie), t: this.t };
  }

  restaurer(e: { corps: Corps[]; t: number }): void {
    this.corps = e.corps.map(copie);
    this.t = e.t;
    this.collisions = [];
    this.repartir();
  }
}
