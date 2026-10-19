/**
 * Calculs de l'animation « L'atmosphère terrestre » : mêmes formules que Coupole (coupole/modules/anim/
 * atmosphere_calc.py), vérifiées par SageMath (tests/references/atmosphere_sage.json).  Masse d'air : sec z, Kasten &
 * Young (1989), Pickering (2002), coquille sphérique de 8 km ; extinction : Rayleigh (Hansen & Travis 1974), aérosols
 * (Ångström 1929), ozone (modèle simplifié de la bande de Chappuis) ; réfraction : Bennett (1982), Sæmundsson (1986) ;
 * dispersion : indice de l'air de Ciddor (1996) ; transmission 0,3–30 µm : modèle de ciel de l'ESO (SkyCalc, Paranal).
 */
import ESO from '../donnees/genere/atmosphere_eso.json';

export const R_TERRE_KM = 6371.0;
export const H_ECHELLE_KM = 8.0;
export const BANDES: Record<string, number> = { U: 0.365, B: 0.445, V: 0.551, R: 0.658, I: 0.806 };
const DEG = Math.PI / 180;

export const masse_air_secz = (h: number): number => 1.0 / Math.sin(Math.max(h, 1e-6) * DEG);
export function masse_air_kasten_young(h: number): number {
  h = Math.max(h, 0.0);
  return 1.0 / (Math.sin(h * DEG) + 0.50572 * (h + 6.07995) ** -1.6364);
}
export function masse_air_pickering(h: number): number {
  h = Math.max(h, 0.0);
  return 1.0 / Math.sin((h + 244.0 / (165.0 + 47.0 * h ** 1.1)) * DEG);
}
export function chemin_sphere_km(h: number, H = H_ECHELLE_KM, R = R_TERRE_KM): number {
  return Math.sqrt((R + H) ** 2 - (R * Math.cos(h * DEG)) ** 2) - R * Math.sin(h * DEG);
}
export const masse_air_sphere = (h: number, H = H_ECHELLE_KM, R = R_TERRE_KM): number => chemin_sphere_km(h, H, R) / H;

export function tau_rayleigh(l: number, P = 1013.25): number {
  const l2 = l * l;
  return (0.008569 / (l2 * l2)) * (1 + 0.0113 / l2 + 0.00013 / (l2 * l2)) * (P / 1013.25);
}
export const tau_aerosols = (l: number, beta = 0.05, alpha = 1.3): number => beta * l ** -alpha;
export const tau_ozone = (l: number, dobson = 300.0): number => ((0.042 * dobson) / 300.0) * Math.exp(-0.5 * ((l - 0.6) / 0.09) ** 2);
export const tau_total = (l: number, P = 1013.25, beta = 0.05, dobson = 300.0): number => tau_rayleigh(l, P) + tau_aerosols(l, beta) + tau_ozone(l, dobson);
export const k_bande = (l: number, P = 1013.25, beta = 0.05, dobson = 300.0): number => (2.5 / Math.log(10)) * tau_total(l, P, beta, dobson);

export const facteur_pt = (P = 1010.0, T = 10.0): number => (P / 1010.0) * (283.0 / (273.0 + T));
export function refraction_apparente(h: number, P = 1010.0, T = 10.0): number {
  h = Math.max(-1.0, h);
  return (Math.max(0.0, 1.0 / Math.tan((h + 7.31 / (h + 4.4)) * DEG)) / 60.0) * facteur_pt(P, T);
}
export function refraction_vraie(h: number, P = 1010.0, T = 10.0): number {
  h = Math.max(-1.0, h);
  return (Math.max(0.0, 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * DEG)) / 60.0) * facteur_pt(P, T);
}
export function indice_ciddor(l: number): number {
  const s2 = 1.0 / (l * l);
  return (5792105.0 / (238.0185 - s2) + 167917.0 / (57.362 - s2)) * 1e-8;
}
export const refraction_lambda = (h: number, l: number, P = 1010.0, T = 10.0): number => (refraction_vraie(h, P, T) * indice_ciddor(l)) / indice_ciddor(0.55);

export function aplatissement(h: number, rayon = 0.2666, P = 1010.0, T = 10.0): { vertical_deg: number; rapport: number; bas_apparent: number; haut_apparent: number } {
  const bas = h - rayon;
  const haut = h + rayon;
  const hb = bas + refraction_vraie(bas, P, T);
  const hh = haut + refraction_vraie(haut, P, T);
  return { vertical_deg: hh - hb, rapport: (hh - hb) / (2 * rayon), bas_apparent: hb, haut_apparent: hh };
}

export function avance_lever_min(latitude: number, declinaison = 0.0, h0 = -0.5667): number {
  const p = latitude * DEG;
  const d = declinaison * DEG;
  const H = (h: number): number => {
    const c = (Math.sin(h * DEG) - Math.sin(p) * Math.sin(d)) / (Math.cos(p) * Math.cos(d));
    return Math.acos(Math.max(-1.0, Math.min(1.0, c))) / DEG;
  };
  return ((H(h0) - H(0.0)) / 15.0) * 60.0 * 0.99726957;
}

export interface Transmission {
  source: string;
  lambda_um: number[];
  total: number[];
}
export const transmission_eso = (): Transmission => ESO as unknown as Transmission;

export const DOMAINES: readonly [string, number, number, number][] = [
  ['gamma_x', 1e-6, 0.01, 0.0], ['uv_lointain', 0.01, 0.2, 0.0], ['uv_ozone', 0.2, 0.3, 0.02], ['ir_lointain', 30.0, 300.0, 0.0],
  ['submm', 300.0, 1000.0, 0.3], ['mm', 1000.0, 1e4, 0.7], ['radio', 1e4, 1e7, 1.0], ['ionosphere', 1e7, 1e9, 0.0],
];
