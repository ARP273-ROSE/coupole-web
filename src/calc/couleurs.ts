/** Couleur approchée d'une raie monochromatique (380–780 nm), pour le dessin des spectres (lumiere.py de Coupole). */
export function couleur_longueur_onde(lam_nm: number): [number, number, number] {
  if (lam_nm < 380 || lam_nm > 780) return [120, 120, 120];
  let r: number, g: number, b: number;
  if (lam_nm < 440) [r, g, b] = [(440 - lam_nm) / 60, 0.0, 1.0];
  else if (lam_nm < 490) [r, g, b] = [0.0, (lam_nm - 440) / 50, 1.0];
  else if (lam_nm < 510) [r, g, b] = [0.0, 1.0, (510 - lam_nm) / 20];
  else if (lam_nm < 580) [r, g, b] = [(lam_nm - 510) / 70, 1.0, 0.0];
  else if (lam_nm < 645) [r, g, b] = [1.0, (645 - lam_nm) / 65, 0.0];
  else [r, g, b] = [1.0, 0.0, 0.0];
  let f = 1.0;
  if (lam_nm < 420) f = 0.3 + (0.7 * (lam_nm - 380)) / 40;
  else if (lam_nm > 700) f = 0.3 + (0.7 * (780 - lam_nm)) / 80;
  return [r, g, b].map((v) => arrondi(255 * (v * f) ** 0.8)) as [number, number, number];
}

function arrondi(x: number): number {
  const fl = Math.floor(x);
  const d = x - fl;
  if (d > 0.5) return fl + 1;
  if (d < 0.5) return fl;
  return fl % 2 === 0 ? fl : fl + 1;
}
