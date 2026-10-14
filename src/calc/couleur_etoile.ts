/**
 * Couleur vraie d'une étoile réelle, commune au web et au bureau (couleur_etoile.py de Coupole, mêmes tests sur
 * tests/references/couleurs_reference.json).  Table précalculée : corps noir de T_eff → CIE 1931 2° (CIE, CC BY-SA 4.0)
 * → sRGB (primaires W3C CSS Color 4), composante linéaire maximale = 1 ; vérifiée par SageMath.  La luminosité est
 * rendue à part (taille du disque selon la magnitude), la table ne donne que la teinte.
 */
import TABLE from '../donnees/genere/couleurs_etoiles.json';

export type RVB = [number, number, number];
const T_RGB = (TABLE as { T_rgb: number[][] }).T_rgb;
const BV_T = (TABLE as { bv_teff_naines: number[][] }).bv_teff_naines;
const LOG_T = T_RGB.map((r) => Math.log10(r[0]!));

/** Teinte sRGB (0–255) d'une étoile de température effective t (K), interpolée en log T ; t borné à [1 000, 50 000] K. */
export function couleur_etoile(t: number): RVB {
  if (!Number.isFinite(t)) t = 5772;
  const x = Math.log10(Math.min(Math.max(t, T_RGB[0]![0]!), T_RGB[T_RGB.length - 1]![0]!));
  let lo = 0;
  let hi = LOG_T.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (LOG_T[m]! <= x) lo = m;
    else hi = m;
  }
  const f = hi === lo ? 0 : (x - LOG_T[lo]!) / (LOG_T[hi]! - LOG_T[lo]!);
  const a = T_RGB[lo]!;
  const b = T_RGB[hi]!;
  return [1, 2, 3].map((k) => Math.round(a[k]! + f * (b[k]! - a[k]!))) as RVB;
}

/** T_eff (K) d'une NAINE de couleur B−V (Pecaut & Mamajek 2013) — repli quand aucune T_eff publiée n'existe. */
export function teff_de_bv(bv: number): number {
  if (bv <= BV_T[0]![0]!) return BV_T[0]![1]!;
  for (let i = 1; i < BV_T.length; i++) {
    const [x1, t1] = BV_T[i]!;
    const [x0, t0] = BV_T[i - 1]!;
    if (bv <= x1!) return x1! > x0! ? t0! + ((t1! - t0!) * (bv - x0!)) / (x1! - x0!) : t0!;
  }
  return BV_T[BV_T.length - 1]![1]!;
}

/** Rayon de disque (px) selon la magnitude V : flux ∝ 10^(−0,4 V), rayon ∝ flux^(1/4) (choix de lisibilité, borné). */
export function rayon_disque(v: number, v_ref = 0, r_ref = 4.5, r_min = 1.2, r_max = 7): number {
  if (!Number.isFinite(v)) return r_min;
  return Math.min(r_max, Math.max(r_min, r_ref * 10 ** (-0.1 * (v - v_ref))));
}

function lin(v: number): number {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function gam(x: number): number {
  return Math.round(255 * (x > 0.0031308 ? 1.055 * x ** (1 / 2.4) - 0.055 : 12.92 * x));
}

/**
 * Couleur « accentuée » pour l'enseignement (réglage explicite, jamais par défaut) : en lumière linéaire, l'écart à la
 * luminance (Y, coefficients sRGB) est multiplié par k, puis la composante maximale est ramenée à 1 et les négatives à 0.
 */
export function accentuer(c: RVB, k = 2.5): RVB {
  const l = c.map(lin) as RVB;
  const y = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
  const s = l.map((v) => Math.max(0, y + k * (v - y)));
  const m = Math.max(...s, 1e-9);
  return s.map((v) => gam(Math.min(1, v / m))) as RVB;
}

/** « #rrggbb » → [r, g, b]. */
export function rvb_hex(h: string): RVB {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
