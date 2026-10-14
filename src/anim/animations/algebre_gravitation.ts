/**
 * Gravity Algebra : comment la force de gravitation change quand on multiplie les masses ou la distance.  F = G M₁ M₂
 * / d² : multiplier M₁ par a, M₂ par b et d par c multiplie la force par a b / c² ; facteurs de l'original (1/3, 1/2,
 * 1, 2, 3), résultat donné en fraction exacte.
 */
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Rect } from '../../noyau/peintre';
import { Animation, type Choix } from '../base';

type Fraction = [number, number];

function pgcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function reduire(n: number, d: number): Fraction {
  const g = pgcd(n, d);
  return d < 0 ? [-n / g, -d / g] : [n / g, d / g];
}

function lire(s: string): Fraction {
  const [n, d] = s.split('/');
  return reduire(Number(n), d === undefined ? 1 : Number(d));
}

export function facteur_force(m1: Fraction, m2: Fraction, d: Fraction): Fraction {
  return reduire(m1[0] * m2[0] * d[1] * d[1], m1[1] * m2[1] * d[0] * d[0]);
}

export function texte_fraction(f: Fraction): string {
  return f[1] === 1 ? String(f[0]) : `${f[0]}/${f[1]}`;
}

const valeur = (f: Fraction): number => f[0] / f[1];
const FACTEURS: Fraction[] = [[1, 3], [1, 2], [1, 1], [2, 1], [3, 1]];

export class AlgebreGravitation extends Animation {
  static override ID = 'gravalgebra';
  static override ANIMEE = false;

  m1!: Choix;
  m2!: Choix;
  d!: Choix;

  override construire(): void {
    const options = FACTEURS.map((f) => ['anim_gravalgebra_f_' + texte_fraction(f).replace('/', '_'), texte_fraction(f)] as [string, string]);
    this.m1 = this.choix('m1', options, '1');
    this.m2 = this.choix('m2', options, '1');
    this.d = this.choix('d', options, '1');
  }

  facteurs(): [Fraction, Fraction, Fraction] {
    return [this.m1, this.m2, this.d].map((w) => lire(w.currentData() as string)) as [Fraction, Fraction, Fraction];
  }

  override valeurs(): [string, string][] {
    const [a, b, c] = this.facteurs();
    const f = facteur_force(a, b, c);
    return [
      [tr('anim_gravalgebra_calcul'), `(${texte_fraction(a)} × ${texte_fraction(b)}) / ${texte_fraction(c)}² = ${texte_fraction(f)}`],
      [tr('anim_gravalgebra_force'), tr('anim_gravalgebra_fois', { f: texte_fraction(f) })],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const [a, b, c] = this.facteurs();
    const f = facteur_force(a, b, c);
    const cx = rect.cx,
      cy = rect.y + rect.h * 0.42;
    const unite = Math.min(rect.w / 7.5, rect.h / 3.2);
    const dist = unite * 1.4 * valeur(c);
    const r1 = unite * 0.32 * valeur(a) ** (1 / 3),
      r2 = unite * 0.32 * valeur(b) ** (1 / 3);
    const x1 = cx - dist / 2,
      x2 = cx + dist / 2;
    p.setPen(dessin.stylo('grille', 1.0, null, true));
    p.drawLine(x1, cy + unite * 0.75, x2, cy + unite * 0.75);
    dessin.texte(p, cx, cy + unite * 0.75 + 12, `d × ${texte_fraction(c)}`, 'doux');
    const lf = Math.min(unite * 0.6 * valeur(f), dist / 2 - 4, unite * 2.2);
    if (lf > 2) {
      dessin.fleche(p, x1 + r1, cy, x1 + r1 + lf, cy, dessin.stylo('accent1', 3.0), 10);
      dessin.fleche(p, x2 - r2, cy, x2 - r2 - lf, cy, dessin.stylo('accent1', 3.0), 10);
    }
    dessin.disque(p, x1, cy, r1, 'accent3');
    dessin.disque(p, x2, cy, r2, 'accent2');
    dessin.texte(p, x1, cy - r1 - 12, `M₁ × ${texte_fraction(a)}`, 'accent3');
    dessin.texte(p, x2, cy - r2 - 12, `M₂ × ${texte_fraction(b)}`, 'accent2');
    const y = rect.y + rect.h * 0.8;
    dessin.police(p, 1.5, true);
    dessin.texte(p, cx, y, `F × (${texte_fraction(a)} × ${texte_fraction(b)}) / ${texte_fraction(c)}² = F × ${texte_fraction(f)}`);
    dessin.police(p, 1 / 1.5);
    dessin.texte(p, cx, y + 26, 'F = G M₁ M₂ / d²', 'doux');
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(null);
    p.drawRoundedRect(new Rect(rect.x + 10, y - 26, rect.w - 20, 66), 8, 8);
  }
}
