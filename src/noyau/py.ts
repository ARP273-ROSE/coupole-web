/**
 * Petits équivalents des opérations de Python dont la sémantique diffère de JavaScript : modulo du signe du
 * diviseur, division entière, arrondi au pair le plus proche (round), linspace, etc.  Les calculs de Coupole Web
 * suivent exactement ceux de l'appli de bureau ; ces fonctions évitent les écarts subtils (arrondis, signes).
 */

/** x % m de Python (résultat du signe de m). */
export function pmod(x: number, m: number): number {
  const r = x % m;
  return r !== 0 && (r < 0) !== (m < 0) ? r + m : r;
}

/** x // m de Python. */
export function floordiv(x: number, m: number): number {
  return Math.floor(x / m);
}

/** math.fmod (signe du dividende) : c'est le % de JavaScript. */
export function fmod(x: number, m: number): number {
  return x % m;
}

/** round(x) de Python 3 : au pair le plus proche en cas d'égalité exacte. */
export function pround(x: number): number {
  if (!Number.isFinite(x)) return x;
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/** round(x, n) de Python (n entier, éventuellement négatif), sur la représentation décimale exacte du flottant. */
export function proundn(x: number, n: number): number {
  if (n >= 0) return Number(fixe(x, n));
  if (!Number.isFinite(x) || Math.abs(x) >= 1e21) return x;
  const k = -n;
  const neg = x < 0;
  const exact = Math.abs(x).toFixed(100);
  const [ent, frac] = exact.split('.') as [string, string];
  const e = ent.padStart(k + 1, '0');
  const garde = e.slice(0, e.length - k);
  const reste = e.slice(e.length - k) + frac;
  let monter = false;
  const premier = reste.charCodeAt(0) - 48;
  if (premier > 5) monter = true;
  else if (premier === 5) monter = /[1-9]/.test(reste.slice(1)) || (garde.charCodeAt(garde.length - 1) - 48) % 2 === 1;
  let v = Number(garde) + (monter ? 1 : 0);
  v *= 10 ** k;
  return neg ? -v : v;
}

/** int(x) de Python pour un flottant : troncature vers zéro. */
export function pint(x: number): number {
  return Math.trunc(x);
}

/**
 * x formaté avec `dec` décimales comme '{:.{dec}f}'.format(x) de Python : arrondi correct de la valeur binaire exacte,
 * égalités au pair (Python) et non « vers le haut » (toFixed).
 */
export function fixe(x: number, dec: number): string {
  if (!Number.isFinite(x)) return String(x);
  const neg = x < 0 || Object.is(x, -0);
  const a = Math.abs(x);
  if (a >= 1e21) return (neg ? '-' : '') + a.toFixed(dec);
  // développement décimal exact (un double a au plus 1074 chiffres après la virgule ; toFixed va jusqu'à 100)
  const exact = a.toFixed(100);
  const [ent, frac] = exact.split('.') as [string, string];
  const garde = frac.slice(0, dec);
  const reste = frac.slice(dec);
  let monter = false;
  const premier = reste.charCodeAt(0) - 48;
  if (premier > 5) monter = true;
  else if (premier === 5) {
    const apres = reste.slice(1);
    if (/[1-9]/.test(apres)) monter = true;
    else {
      // égalité exacte (à 100 chiffres près ; au-delà, un double qui n'est pas une égalité exacte aurait des
      // chiffres non nuls avant la 100e décimale dès que dec ≤ 20)
      const dernier = dec > 0 ? garde.charCodeAt(dec - 1) - 48 : ent.charCodeAt(ent.length - 1) - 48;
      monter = dernier % 2 === 1;
    }
  }
  let chiffres = ent + garde;
  if (monter) {
    const t = chiffres.split('');
    let i = t.length - 1;
    for (; i >= 0; i--) {
      if (t[i] === '9') t[i] = '0';
      else {
        t[i] = String.fromCharCode(t[i]!.charCodeAt(0) + 1);
        break;
      }
    }
    chiffres = (i < 0 ? '1' : '') + t.join('');
  }
  const e = chiffres.slice(0, chiffres.length - dec) || '0';
  const f = chiffres.slice(chiffres.length - dec);
  const s = dec > 0 ? e + '.' + f : e;
  return (neg ? '-' : '') + s;
}

/** '%d' % x de Python pour un flottant : troncature. */
export function pd(x: number): string {
  return String(Math.trunc(x));
}

/** '%02d' % x */
export function pd02(x: number): string {
  const t = Math.trunc(x);
  const s = String(Math.abs(t)).padStart(2, '0');
  return t < 0 ? '-' + s : s;
}

/** numpy.linspace(a, b, n). */
export function linspace(a: number, b: number, n: number): number[] {
  if (n === 1) return [a];
  const out = new Array<number>(n);
  const pas = (b - a) / (n - 1);
  for (let i = 0; i < n; i++) out[i] = a + i * pas;
  out[n - 1] = b;
  return out;
}

/** range(a, b, pas) de Python. */
export function range(a: number, b?: number, pas = 1): number[] {
  if (b === undefined) {
    b = a;
    a = 0;
  }
  const out: number[] = [];
  if (pas > 0) for (let i = a; i < b; i += pas) out.push(i);
  else for (let i = a; i > b; i += pas) out.push(i);
  return out;
}

/** numpy.arange(a, b, pas) (flottants). */
export function arange(a: number, b: number, pas = 1): number[] {
  const n = Math.max(0, Math.ceil((b - a) / pas));
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = a + i * pas;
  return out;
}

export function somme(t: readonly number[]): number {
  let s = 0;
  for (const v of t) s += v;
  return s;
}

export function moyenne(t: readonly number[]): number {
  return t.length ? somme(t) / t.length : NaN;
}

export function borne(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}

/** math.copysign */
export function copysign(x: number, s: number): number {
  return s < 0 || Object.is(s, -0) ? -Math.abs(x) : Math.abs(x);
}

/** Remplace {nom} par les valeurs (comme str.format de Python avec des noms simples). */
export function format(texte: string, valeurs: Record<string, string | number>): string {
  return texte.replace(/\{(\w+)\}/g, (m, k: string) => (k in valeurs ? String(valeurs[k]) : m));
}

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export function radians(x: number): number {
  return x * DEG;
}

export function degrees(x: number): number {
  return x * RAD;
}

/** Générateur pseudo-aléatoire reproductible (mulberry32), pour les tirages des animations. */
export function alea(graine = 0x9e3779b9): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** random.gauss(mu, sigma) à partir d'un générateur uniforme (Box-Muller). */
export function gauss(u: () => number, mu = 0, sigma = 1): number {
  let a = u();
  while (a <= 1e-300) a = u();
  const b = u();
  return mu + sigma * Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
}
