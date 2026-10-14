/**
 * Moteur d'exécution (TypeScript, sans dépendance) du modèle « spectres physiques ».
 * Même interface, nom pour nom, que moteur/spectres_physiques.py ; données : donnees/modele_spectres.json.
 *
 *   const m = new ModeleSpectres(json);
 *   m.etalonnage(t, classe)   → { teff, logg, bv, mv, rayon, logl, source, drapeaux }
 *   m.intensites(t, classe)   → { he_ii, he_i, h, metaux_ionises, metaux, molecules, ch } (0–100)
 *   m.raies(t, classe)        → [{ id, lambda, espece, famille, nom, profondeur, W, fwhm }]
 *   m.bandes(t, classe)       → [{ id, molecule, systeme, lambda_tete, degrade, eta_tete, d0 }]
 *   m.residu(t, classe, lam, familles?, resolution?)    → I/I_continu (0–1)
 *   m.spectre(t, classe, lams, familles?, resolution?)  → number[]
 *   ModeleSpectres.continu_relatif(teff, lam), m.couleur_etoile(teff), m.couleur_lambda(lam),
 *   ModeleSpectres.beta_prime(teff, lam)
 * t : type spectral numérique (O0 = 0 … M9 = 69, réel) ; classe : 'I' | 'II' | 'III' | 'IV' | 'V' ; λ en nm (air).
 */

const H_SI = 6.62607015e-34;
const C_SI = 299792458.0;
const K_SI = 1.380649e-23;
export const C2_NM_K = ((H_SI * C_SI) / K_SI) * 1e9;
const FAM_BANDES = 'molecules';
const AIRE_GAUSS = 0.5 * Math.sqrt(Math.PI / Math.log(2));
const AIRE_LORENTZ = Math.PI / 2;

export interface Etalonnage {
  teff: number;
  logg: number;
  bv: number | null;
  mv: number | null;
  rayon: number | null;
  logl: number | null;
  source: string;
  drapeaux: string[];
}
export interface Raie {
  id: number;
  lambda: number;
  espece: string;
  famille: string;
  nom: string;
  profondeur: number;
  W: number;
  fwhm: number | null;
}
export interface Bande {
  id: number;
  molecule: string;
  systeme: string;
  lambda_tete: number;
  degrade: string;
  eta_tete: number;
  d0: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Donnees = any;

function planckRel(lamNm: number, teff: number): number {
  return lamNm ** -5 / Math.expm1(C2_NM_K / (lamNm * teff));
}

function wienX(): number {
  let x = 5.0;
  for (let i = 0; i < 50; i++) {
    const f = x - 5 * (1 - Math.exp(-x));
    x -= f / (1 - 5 * Math.exp(-x));
  }
  return x;
}
export const WIEN_X = wienX();

export class ModeleSpectres {
  readonly d: Donnees;
  readonly classes: string[];
  readonly types: number[];
  private readonly _raies = new Map<number, Donnees>();
  private readonly _bandes = new Map<number, Donnees>();

  constructor(donnees: Donnees) {
    this.d = donnees;
    this.classes = donnees.classes;
    this.types = donnees.types;
    for (const r of donnees.raies) this._raies.set(r.id, r);
    for (const b of donnees.bandes) this._bandes.set(b.id, b);
  }

  private encadre(t: number): [number, number, number] {
    const tt = Math.min(Math.max(t, this.types[0]!), this.types[this.types.length - 1]!);
    const i = Math.floor(tt);
    const j = Math.min(i + 1, this.types[this.types.length - 1]!);
    return [i, j, tt - i];
  }

  etalonnage(t: number, classe: string): Etalonnage {
    const [i, j, w] = this.encadre(t);
    const a = this.d.etalonnage[classe][i];
    const b = this.d.etalonnage[classe][j];
    const out: Donnees = {};
    for (const k of ['teff', 'logg', 'bv', 'mv', 'rayon', 'logl']) {
      const va = a[k] ?? null;
      const vb = b[k] ?? null;
      if (va === null || vb === null) out[k] = w === 0 ? va : w === 1 ? vb : null;
      else if (k === 'teff') out[k] = 10 ** ((1 - w) * Math.log10(va) + w * Math.log10(vb));
      else out[k] = (1 - w) * va + w * vb;
    }
    out.source = w < 0.5 ? a.source : b.source;
    out.drapeaux = w > 0 && w < 1 ? [...new Set([...a.drapeaux, ...b.drapeaux])].sort() : [...(w === 0 ? a : b).drapeaux];
    return out as Etalonnage;
  }

  intensites(t: number, classe: string): Record<string, number> {
    const [i, j, w] = this.encadre(t);
    const tab = this.d.intensites_familles[classe];
    const out: Record<string, number> = {};
    for (const f of Object.keys(tab)) out[f] = (1 - w) * tab[f][i] + w * tab[f][j];
    return out;
  }

  raies(t: number, classe: string): Raie[] {
    const [i, j, w] = this.encadre(t);
    const fi = new Map<number, number[]>(this.d.forces[classe][i].map((x: number[]) => [x[0], x.slice(1)]));
    const fj = new Map<number, number[]>(this.d.forces[classe][j].map((x: number[]) => [x[0], x.slice(1)]));
    const ids = [...new Set([...fi.keys(), ...fj.keys()])].sort((p, q) => p - q);
    const out: Raie[] = [];
    for (const id of ids) {
      const a = fi.get(id) ?? [0, 0, null];
      const b = fj.get(id) ?? [0, 0, null];
      const fw = b[2] === null ? a[2] : a[2] === null ? b[2] : (1 - w) * (a[2] as number) + w * (b[2] as number);
      const d0 = (1 - w) * (a[0] as number) + w * (b[0] as number);
      const W = (1 - w) * (a[1] as number) + w * (b[1] as number);
      if (W <= 0) continue;
      const r = this._raies.get(id);
      out.push({ id, lambda: r.lambda_air_nm, espece: r.espece, famille: r.famille, nom: r.nom, profondeur: d0, W, fwhm: fw ?? null });
    }
    return out;
  }

  bandes(t: number, classe: string): Bande[] {
    const [i, j, w] = this.encadre(t);
    const fi = new Map<number, number[]>(this.d.forces_bandes[classe][i].map((x: number[]) => [x[0], x.slice(1)]));
    const fj = new Map<number, number[]>(this.d.forces_bandes[classe][j].map((x: number[]) => [x[0], x.slice(1)]));
    const ids = [...new Set([...fi.keys(), ...fj.keys()])].sort((p, q) => p - q);
    const out: Bande[] = [];
    for (const id of ids) {
      const a = fi.get(id);
      const b = fj.get(id);
      const eta = (1 - w) * (a ? a[0]! : 0) + w * (b ? b[0]! : 0);
      const d0 = a === undefined || b === undefined ? (a ?? b)![1]! : (1 - w) * a[1]! + w * b[1]!;
      if (eta <= 0) continue;
      const bd = this._bandes.get(id);
      out.push({ id, molecule: bd.molecule, systeme: bd.systeme, lambda_tete: bd.lambda_tete_air_nm, degrade: bd.degrade, eta_tete: eta, d0 });
    }
    return out;
  }

  static beta_prime(teff: number, lam: number): number {
    const t0 = teff * (0.75 * (2 / 3)) ** 0.25;
    const t1 = teff * (0.75 * (1 + 2 / 3)) ** 0.25;
    const b0 = planckRel(lam, t0);
    const b1 = planckRel(lam, t1);
    return ((2 / 3) * (b1 - b0)) / b0;
  }

  private static profil(dl: number, d0: number, W: number, fwhm: number | null, resolution: number): number {
    if (fwhm === null || fwhm <= 0 || d0 <= 0) return 0;
    let m = (W / (d0 * fwhm) - AIRE_GAUSS) / (AIRE_LORENTZ - AIRE_GAUSS);
    m = Math.min(1, Math.max(0, m));
    const f = resolution > 0 ? Math.sqrt(fwhm * fwhm + resolution * resolution) : fwhm;
    const d = resolution > 0 ? W / (f * ((1 - m) * AIRE_GAUSS + m * AIRE_LORENTZ)) : d0;
    const x = (2 * dl) / f;
    return d * ((1 - m) * Math.exp(-Math.log(2) * x * x) + m / (1 + x * x));
  }

  residu(t: number, classe: string, lam: number, familles: string[] | null = null, resolution = 0): number {
    return this.spectre(t, classe, [lam], familles, resolution)[0]!;
  }

  spectre(t: number, classe: string, lams: number[], familles: string[] | null = null, resolution = 0): number[] {
    const teff = this.etalonnage(t, classe).teff;
    const raies = this.raies(t, classe).filter((r) => familles === null || familles.includes(r.famille));
    const bandes = familles === null || familles.includes(FAM_BANDES) ? this.bandes(t, classe) : [];
    const out: number[] = [];
    for (const lam of lams) {
      let eta = 0;
      for (const b of bandes) {
        const dl = b.degrade === 'rouge' ? lam - b.lambda_tete : b.lambda_tete - lam;
        if (dl >= 0) eta += b.eta_tete * Math.exp(-dl / b.d0);
      }
      const bp = ModeleSpectres.beta_prime(teff, lam);
      let res = 1 - (bp * eta) / ((1 + bp) * (1 + eta));
      for (const r of raies) {
        const dl = lam - r.lambda;
        if (Math.abs(dl) < 60 * Math.max(r.fwhm ?? 0, resolution, 0.01)) res *= 1 - ModeleSpectres.profil(dl, r.profondeur, r.W, r.fwhm, resolution);
      }
      out.push(res);
    }
    return out;
  }

  static continu_relatif(teff: number, lam: number): number {
    const lamMax = C2_NM_K / (WIEN_X * teff);
    const ref = Math.min(Math.max(lamMax, 380), 720);
    return planckRel(lam, teff) / planckRel(ref, teff);
  }

  private xyzVersSrgb(X: number, Y: number, Z: number): number[] {
    const M = this.d.srgb.XYZ_vers_sRGB_lineaire as number[][];
    return [0, 1, 2].map((k) => M[k]![0]! * X + M[k]![1]! * Y + M[k]![2]! * Z);
  }

  private static gamma(v: number): number {
    return v > 0.0031308 ? 1.055 * v ** (1 / 2.4) - 0.055 : 12.92 * v;
  }

  couleur_etoile(teff: number): [number, number, number] {
    const c = this.d.cie1931_5nm;
    let X = 0;
    let Y = 0;
    let Z = 0;
    for (let k = 0; k < c.xbar.length; k++) {
      const b = planckRel(c.lambda0 + k * c.pas, teff);
      X += b * c.xbar[k];
      Y += b * c.ybar[k];
      Z += b * c.zbar[k];
    }
    const rgb = this.xyzVersSrgb(X, Y, Z).map((v) => Math.max(0, v));
    const mx = Math.max(...rgb);
    return rgb.map((v) => Math.round(255 * ModeleSpectres.gamma(v / mx))) as [number, number, number];
  }

  couleur_lambda(lam: number): [number, number, number] {
    const c = this.d.cie1931_5nm;
    const x = (lam - c.lambda0) / c.pas;
    const i = Math.min(Math.max(Math.floor(x), 0), c.xbar.length - 2);
    const w = Math.min(Math.max(x - i, 0), 1);
    const [X, Y, Z] = ['xbar', 'ybar', 'zbar'].map((k) => (1 - w) * c[k][i] + w * c[k][i + 1]);
    const rgb = this.xyzVersSrgb(X!, Y!, Z!).map((v) => Math.max(0, v));
    const mx = Math.max(...rgb);
    if (mx <= 0) return [0, 0, 0];
    return rgb.map((v) => Math.round(255 * ModeleSpectres.gamma(v / mx))) as [number, number, number];
  }
}
