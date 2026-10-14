/**
 * Textes avec formules : les formules des textes de Coupole (écrites en texte simple) sont reconnues et rendues en
 * MathML Core (voir noyau/formule.ts) ; le reste du texte est inchangé.  On reconnaît (1) les formules connues de la
 * liste ci-dessous, (2) tout ce qui est entre $…$, (3) une valeur entière qui n'est qu'une formule (« 1/S = 1/E − 1/P »).
 */
import { mathml } from '../noyau/formule';

/** Formules reconnues dans les descriptions, les aides, les libellés et les textes « Ce qu'il faut voir ». */
const FORMULES = [
  'F = G M₁ M₂ / R²', 'F = G M₁ M₂ / d²', 'F = G M₁ M₂ / R', 'H = TSL − α', 'H = LST − α', 'P² = a³ / M', 'P² = a³',
  'd = 1 / p', '1/p', 'b = √(a² − c²)', 'm₁ r₁ = m₂ r₂', 'σT⁴/π', '(σT⁴)', 'σT⁴', 'σ T⁴', 'T⁴', 'v ∝ 1/√R', '1/√R',
  'c Δλ / λ₀', 'Δλ / λ = v / c', 'Δλ / λ', 'f₀ / (1 − v_r / c)', '(R_p / R_*)²', 'H = (da/dt) / a', 'da/dt', '1 / H',
  'a × b / c²', 'a b / c²', 'a = F / M', '(F / M₁)', '(F / M₂)', 'm − M = 5 log₁₀ d − 5', 'E = Δm c²', 'v² R / G',
  'F / f', '(c / λ)', '∝ 1 / sin h', '206 265″ × d / D', '206,265″ × d / D', '2 asin(d / 2D)', 'P (1 ± v/c)',
  '∝ n²', '(1 + cos i) / 2', 'λ_max = b / T', 'e = c / a', 'L = 4π R² σ T⁴', 'L / L☉ = (R / R☉)² (T / T☉)⁴',
  'R / R☉ = √(L / L☉) / (T / T☉)²', 'v = H d', 'v = √(v_r² + v_t²)', 'v_r = c Δλ / λ₀', 'F = P / 4π d²',
  'h = 90° − φ + δ', '90° − φ + δ', 'cos H₀ = −tan φ tan δ', 'E = h ν', 'ν = c / λ', 'λ_max = b / T', '1/S = 1/E − 1/P',
  '1/S = 1/P − 1/E', '1 / S = 1 / P₁ − 1 / P₂', 'sin E = a_int / a_ext', 'P = 2π √(r³ / GM)', 'v = √(GM / r)',
  'M = v² R / G', 'n₁ sin θ₁ = n₂ sin θ₂', 'sin θ_c = n₂ / n₁', 'r₁ / r₂ = m₂ / m₁',
  'K = (2πG / P)^⅓ M_p sin i / (M_* + M_p)^⅔', 'E = 13,598 eV (1/n² − 1/m²)', 'E = 13.598 eV (1/n² − 1/m²)',
  'ζ(ψ) = (M / M⊕)(R / d)³ R (3 cos² ψ − 1) / 2', 'F = Δm c²',
].sort((a, b) => b.length - a.length);

const ECHAPPE = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MOTIF = new RegExp(`\\$([^$]+)\\$|(${FORMULES.map(ECHAPPE).join('|')})`, 'gu');

/** Morceaux d'un texte : chaînes et éléments <math>. */
export function enrichir(s: string): (string | Element)[] {
  const out: (string | Element)[] = [];
  let i = 0;
  MOTIF.lastIndex = 0;
  for (let m = MOTIF.exec(s); m; m = MOTIF.exec(s)) {
    // une formule doit être un mot entier (pas le « d / D » au milieu d'un mot)
    const avant = s[m.index - 1] ?? ' ',
      apres = s[m.index + m[0].length] ?? ' ';
    if (m.index < i) continue;
    if (!m[1] && (/[\p{L}\p{N}]/u.test(avant) || /[\p{L}\p{N}]/u.test(apres))) continue;
    // parenthèses qui entourent la formule : dans la formule (pas de retour à la ligne entre elles et elle)
    let debut = m.index,
      fin = m.index + m[0].length;
    let f = m[1] ?? m[2]!;
    if (!m[1] && s[debut - 1] === '(' && s[fin] === ')' && !f.startsWith('(')) {
      debut--;
      fin++;
      f = `(${f})`;
    }
    if (debut > i) out.push(s.slice(i, debut));
    out.push(mathml(f));
    i = fin;
  }
  if (i < s.length) out.push(s.slice(i));
  return out;
}

/** Une valeur affichée qui n'est qu'une formule (relation, radical) : rendue entière en MathML. */
const VALEUR_FORMULE = /^[\p{L}\p{N}\s₀-₉⁰-⁹⁻ⁿ½⅓⅔√()[\],.·×−+=/∝≈<>|′″°☉⊕_*]+$/u;

function estFormule(s: string): boolean {
  if (!VALEUR_FORMULE.test(s) || !/[=∝√]/.test(s)) return false;
  // un nombre suivi d'une unité (« 10,0 pc », « 33 al », « 12 h ») : c'est un résultat, pas une formule
  if (/\d\s*(?:[A-Za-z]{2,}|[hs]\b|min\b)/.test(s.replace(/log₁₀|log|sin|cos|tan/g, ''))) return false;
  if (/[\d⁰-⁹]\s*[A-Za-z]{1,3}(?:\/[A-Za-z]+)?\s*$/.test(s)) return false;
  // pas de mots de plus de trois lettres (sauf fonctions) : sinon c'est une phrase
  return !s.split(/[^\p{L}]+/u).some((w) => w.length > 3 && !['asin', 'acos', 'atan'].includes(w));
}

/** Remplit un élément avec un texte enrichi de formules (sans rien refaire si le texte n'a pas changé). */
export function remplir(el: HTMLElement, s: string, valeur = false): void {
  const e = el as HTMLElement & { _texte?: string };
  if (e._texte === s) return;
  e._texte = s;
  if (valeur && estFormule(s)) el.replaceChildren(mathml(s));
  else el.replaceChildren(...enrichir(s));
}
