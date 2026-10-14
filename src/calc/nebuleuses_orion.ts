/**
 * Volumes légers de la nébuleuse d'Orion (M42) et d'IC 434 / Tête de Cheval pour « Orion en 3D » : nuages de
 * particules pré-calculés (même suite pseudo-aléatoire, mêmes formules et mêmes arrondis que nebuleuses_orion.py de
 * Coupole ; test croisé sur tests/references/nebuleuses_orion.json), posés à leur position exacte et agrandis ×AGRANDI
 * autour de leur centre (avec leurs étoiles excitatrices) pour être visibles à l'échelle de la constellation.
 *
 * Géométrie publiée (données « Orion 3D », structures_orion.json) :
 *  - M42 : modèle en « cloque » (blister) : θ¹ Ori C à 0,2 pc devant le front d'ionisation (Wen & O'Dell 1995 ;
 *    O'Dell et al. 2009), couche émissive de 0,13 pc (Wen & O'Dell 1995), front en bol z(r) = −0,2 (1 − (r/R)²) pc,
 *    R = 3,725 pc (66′ à 388 pc, SIMBAD), paroi du nuage moléculaire OMC-1 derrière le front, Voile 1 à 3 pc devant
 *    (O'Dell et al. 2009, fig. 5), Barre d'Orion à sa position SIMBAD ; forme au-delà de ≈ 0,5 pc schématique.
 *  - IC 434 et la Tête de Cheval : σ Ori « à la même distance » (387,5 pc, Schaefer et al. 2016 ; Gerin et al. 2009),
 *    bord d'Orion B vu par la tranche, pilier de 0,68 × 0,45 pc (6′ × 4′, SIMBAD) et 0,1 pc d'épaisseur (Gerin et al.
 *    2009), NGC 2023 à sa position SIMBAD ; profondeur et étendue d'IC 434 non publiées : schématiques.
 * Repère local (pc) : x vers l'est, y vers le nord (dans le plan du ciel), z vers l'observateur.
 */
import * as O from './orion3d';

export const AGRANDI = 12;
export const VERSION = 1;

export type Genre = 'gaz' | 'poussiere';
export interface Particule {
  /** position (pc, repère ICRS centré sur le Soleil), taille agrandie comprise */
  p: O.V3;
  /** rayon du sprite (pc, agrandi) */
  r: number;
  rvb: [number, number, number];
  alpha: number;
  genre: Genre;
}
export interface EtoileNeb {
  id: string;
  p: O.V3;
}
export interface Nebuleuse {
  id: 'm42' | 'ic434';
  centre: O.V3;
  particules: Particule[];
  etoiles: EtoileNeb[];
  /** points remarquables (fiches) : position agrandie */
  reperes: { fiche: string; p: O.V3 }[];
}

/** mulberry32 (entiers non signés sur 32 bits ; identique en Python). */
export class Alea {
  private e: number;
  constructor(graine: number) {
    this.e = graine >>> 0;
  }
  u(): number {
    this.e = (this.e + 0x6d2b79f5) >>> 0;
    let t = Math.imul(this.e ^ (this.e >>> 15), this.e | 1) >>> 0;
    t = (t ^ (t + (Math.imul(t ^ (t >>> 7), t | 61) >>> 0))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

const r4 = (x: number): number => Math.round(x * 1e4) / 1e4;

/** Base locale (est, nord, vers l'observateur) au point P (ICRS). */
export function baseLocale(P: readonly number[]): [O.V3, O.V3, O.V3] {
  const vers_obs = O.unitaire([-P[0]!, -P[1]!, -P[2]!]);
  const los = O.unitaire(P);
  const est = O.unitaire(O.cross([0, 0, 1], los));
  const nord = O.cross(los, est);
  return [est, nord, vers_obs];
}

/** Décalage dans le plan du ciel (pc, est et nord) entre deux directions vues à la distance d. */
export function decalageCiel(ra0: number, dec0: number, ra: number, dec: number, d: number): [number, number] {
  return [(ra - ra0) * Math.cos(dec0 * O.DEG) * O.DEG * d, (dec - dec0) * O.DEG * d];
}

function placer(C: O.V3, b: [O.V3, O.V3, O.V3], x: number, y: number, z: number, k = AGRANDI): O.V3 {
  return [
    r4(C[0] + k * (x * b[0][0] + y * b[1][0] + z * b[2][0])),
    r4(C[1] + k * (x * b[0][1] + y * b[1][1] + z * b[2][1])),
    r4(C[2] + k * (x * b[0][2] + y * b[1][2] + z * b[2][2])),
  ];
}

function etoile(id: string): O.EtoileOrion {
  return O.DONNEES.etoiles.find((e) => e.id === id)!;
}

/** radec d'un vecteur ICRS (degrés). */
export function radec(P: readonly number[]): [number, number] {
  const n = O.norme(P);
  let ra = Math.atan2(P[1]!, P[0]!) / O.DEG;
  if (ra < 0) ra += 360;
  return [ra, Math.asin(P[2]! / n) / O.DEG];
}

// positions SIMBAD enregistrées dans les données « Orion 3D » (structures_orion.json)
export const BARRE_RADEC: [number, number] = [83.84291666666667, -5.409166666666667];
export const NGC2023_RADEC: [number, number] = [85.4078844555898, -2.2645107495667616];

export function m42(): Nebuleuse {
  const a = new Alea(42);
  const C = etoile('tet01_ori_c').xyz as O.V3;
  const b = baseLocale(C);
  const bol = O.DONNEES.primitives.m42_bol;
  const R: number = bol.rayon_pc;
  const prof = (r: number): number => -0.2 * (1 - (r / R) ** 2);
  const L: Particule[] = [];
  const ajouter = (x: number, y: number, z: number, r: number, rvb: [number, number, number], alpha: number, genre: Genre): void => {
    L.push({ p: placer(C, b, x, y, z), r: r4(r * AGRANDI), rvb, alpha: r4(alpha), genre });
  };
  // paroi du nuage moléculaire OMC-1, derrière le front
  for (let i = 0; i < 150; i++) {
    const r = 1.15 * R * Math.sqrt(a.u());
    const f = 2 * Math.PI * a.u();
    const z = prof(Math.min(r, R)) - 0.25 - 0.35 * a.u();
    ajouter(r * Math.cos(f), r * Math.sin(f), z, 0.55 + 0.45 * a.u(), [86, 60, 46], 0.38, 'poussiere');
  }
  // couche émissive (0,13 pc) devant le front en bol : [O III] au centre, Hα au bord
  for (let i = 0; i < 320; i++) {
    const r = R * a.u() ** 1.4;
    const f = 2 * Math.PI * a.u();
    const z = prof(r) + 0.13 * a.u();
    const centre = r < 0.3 * R;
    ajouter(r * Math.cos(f), r * Math.sin(f), z, 0.3 + 0.45 * a.u(), centre ? [120, 225, 215] : [255, 84, 112], (centre ? 0.3 : 0.26) * (1 - 0.5 * (r / R)), 'gaz');
  }
  // Barre d'Orion : front vu par la tranche, à sa position SIMBAD
  const d = O.norme(C);
  const [cra, cdec] = radec(C);
  const [bx, by] = decalageCiel(cra, cdec, BARRE_RADEC[0], BARRE_RADEC[1], d);
  for (let i = 0; i < 18; i++) ajouter(bx + 0.08 * (a.u() - 0.5), by + 0.08 * (a.u() - 0.5), prof(Math.hypot(bx, by)) + 0.05, 0.12, [255, 150, 120], 0.35, 'gaz');
  // Voile d'Orion, 1 à 3 pc devant le Trapèze (gaz neutre, absorbant)
  for (let i = 0; i < 90; i++) {
    const r = R * Math.sqrt(a.u());
    const f = 2 * Math.PI * a.u();
    ajouter(r * Math.cos(f), r * Math.sin(f), 1 + 2 * a.u(), 0.8 + 0.4 * a.u(), [170, 132, 96], 0.07, 'poussiere');
  }
  // le Trapèze : θ¹ Ori A, B, D autour de C (même distance que C, décalages du ciel agrandis)
  const etoiles: EtoileNeb[] = ['tet01_ori_a', 'tet01_ori_b', 'tet01_ori_d'].map((id) => {
    const e = etoile(id);
    const [x, y] = decalageCiel(cra, cdec, e.ra, e.dec, d);
    return { id, p: placer(C, b, x, y, 0) };
  });
  return { id: 'm42', centre: C, particules: L, etoiles, reperes: [{ fiche: 'orion:m42', p: placer(C, b, 0, 0, prof(0)) }] };
}

export function ic434(): Nebuleuse {
  const a = new Alea(434);
  const C = O.DONNEES.primitives.tete_de_cheval.centre as O.V3;
  const b = baseLocale(C);
  const d = O.norme(C);
  const [hra, hdec] = radec(C);
  const L: Particule[] = [];
  const ajouter = (x: number, y: number, z: number, r: number, rvb: [number, number, number], alpha: number, genre: Genre): void => {
    L.push({ p: placer(C, b, x, y, z), r: r4(r * AGRANDI), rvb, alpha: r4(alpha), genre });
  };
  // bord d'Orion B (L1630), à l'est du front : poussière
  for (let i = 0; i < 160; i++) {
    const x = 2.6 * a.u() ** 1.6;
    ajouter(x, 3.6 * (2 * a.u() - 1), 1.2 * (2 * a.u() - 1), 0.35 + 0.35 * a.u(), [62, 42, 36], 0.55, 'poussiere');
  }
  // IC 434 : gaz ionisé par σ Ori, à l'ouest du front (plus dense contre le front)
  for (let i = 0; i < 200; i++) {
    const x = -1.3 * a.u() ** 2;
    ajouter(x, 3.4 * (2 * a.u() - 1), 1.0 * (2 * a.u() - 1), 0.25 + 0.3 * a.u(), [240, 70, 96], 0.24, 'gaz');
  }
  // le pilier de la Tête de Cheval : 0,68 × 0,45 pc, 0,1 pc d'épaisseur, avancé vers σ Ori
  for (let i = 0; i < 70; i++) {
    let x: number, y: number;
    if (i < 18) {
      x = -0.3 * a.u();
      y = 0.18 * (a.u() - 0.5);
    } else {
      const f = 2 * Math.PI * a.u();
      const s = Math.sqrt(a.u());
      x = -0.62 + 0.34 * s * Math.cos(f);
      y = 0.1 + 0.225 * s * Math.sin(f);
    }
    ajouter(x, y, 0.1 * (a.u() - 0.5), 0.07 + 0.05 * a.u(), [22, 12, 12], 0.85, 'poussiere');
  }
  // NGC 2023 : nébuleuse par réflexion (lumière bleutée diffusée), à sa position SIMBAD
  const [nx, ny] = decalageCiel(hra, hdec, NGC2023_RADEC[0], NGC2023_RADEC[1], d);
  for (let i = 0; i < 30; i++) ajouter(nx + 0.35 * (a.u() - 0.5), ny + 0.35 * (a.u() - 0.5), 0.2 * (a.u() - 0.5), 0.18 + 0.12 * a.u(), [170, 195, 255], 0.16, 'gaz');
  const sig = etoile('sig_ori');
  const [sx, sy] = decalageCiel(hra, hdec, sig.ra, sig.dec, d);
  return {
    id: 'ic434',
    centre: C,
    particules: L,
    etoiles: [{ id: 'sig_ori', p: placer(C, b, sx, sy, 0) }],
    reperes: [
      { fiche: 'orion:tete_de_cheval', p: placer(C, b, -0.62, 0.1, 0) },
      { fiche: 'orion:ic434', p: placer(C, b, -0.6, 2.2, 0) },
      { fiche: 'orion:ngc2023', p: placer(C, b, nx, ny, 0) },
    ],
  };
}

let cache: Nebuleuse[] | null = null;
export function nebuleuses(): Nebuleuse[] {
  cache ??= [m42(), ic434()];
  return cache;
}
