/** Vecteurs 3D (tableaux [x, y, z]) et listes de points : l'équivalent des tableaux numpy (N, 3) de Coupole. */
export type V3 = [number, number, number];
export type Pts = V3[];

export function v3(x: number, y: number, z: number): V3 {
  return [x, y, z];
}

export function dot(a: readonly number[], b: readonly number[]): number {
  return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
}

export function cross(a: readonly number[], b: readonly number[]): V3 {
  return [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
}

export function norme(a: readonly number[]): number {
  return Math.hypot(a[0]!, a[1]!, a[2]!);
}

export function unitaire(a: readonly number[]): V3 {
  const n = norme(a);
  return [a[0]! / n, a[1]! / n, a[2]! / n];
}

export function add(a: readonly number[], b: readonly number[]): V3 {
  return [a[0]! + b[0]!, a[1]! + b[1]!, a[2]! + b[2]!];
}

export function sub(a: readonly number[], b: readonly number[]): V3 {
  return [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
}

export function mul(a: readonly number[], k: number): V3 {
  return [a[0]! * k, a[1]! * k, a[2]! * k];
}

export function neg(a: readonly number[]): V3 {
  return [-a[0]!, -a[1]!, -a[2]!];
}

/** Combinaison linéaire Σ kᵢ vᵢ. */
export function comb(...termes: [number, readonly number[]][]): V3 {
  let x = 0,
    y = 0,
    z = 0;
  for (const [k, v] of termes) {
    x += k * v[0]!;
    y += k * v[1]!;
    z += k * v[2]!;
  }
  return [x, y, z];
}

export type M3 = [V3, V3, V3];

/** m @ v */
export function mv(m: readonly (readonly number[])[], v: readonly number[]): V3 {
  return [dot(m[0]!, v), dot(m[1]!, v), dot(m[2]!, v)];
}

/** pts @ m.T (chaque point transformé par m). */
export function appliquerM(m: readonly (readonly number[])[], pts: readonly (readonly number[])[]): Pts {
  return pts.map((p) => mv(m, p));
}

export function echelle(pts: readonly (readonly number[])[], k: number): Pts {
  return pts.map((p) => mul(p, k));
}

/** Matrice de rotation d'angle a (degrés) autour de l'axe x, y ou z (sens direct). */
export function rotation(axe: 'x' | 'y' | 'z', deg: number): M3 {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a),
    s = Math.sin(a);
  if (axe === 'x')
    return [
      [1, 0, 0],
      [0, c, -s],
      [0, s, c],
    ];
  if (axe === 'y')
    return [
      [c, 0, s],
      [0, 1, 0],
      [-s, 0, c],
    ];
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}

export function mm(a: M3, b: M3): M3 {
  const r: M3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) r[i]![j] = a[i]![0]! * b[0]![j]! + a[i]![1]! * b[1]![j]! + a[i]![2]! * b[2]![j]!;
  return r;
}

export function transposee(a: readonly (readonly number[])[]): M3 {
  return [
    [a[0]![0]!, a[1]![0]!, a[2]![0]!],
    [a[0]![1]!, a[1]![1]!, a[2]![1]!],
    [a[0]![2]!, a[1]![2]!, a[2]![2]!],
  ];
}
