/**
 * Proton-Proton Animation, CNO Cycle Animation : les réactions qui font briller le Soleil.  Quatre protons deviennent
 * un noyau d'hélium 4 ; la masse perdue devient énergie, E = Δm c².  Énergie de chaque étape calculée à partir des
 * excès de masse atomique (AME 2020) ; 26,731 MeV au total (dont une petite part emportée par les neutrinos).
 */
import LOT3 from '../../donnees/genere/lot3.json';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { floordiv, pmod } from '../../noyau/py';
import { Animation, nombre } from '../base';

const E = LOT3.exces_masse_kev as Record<string, number>;
const ME = LOT3.me_kev as number;
const NU = LOT3.neutrino_moyen_kev as Record<string, number>;
const DUREE_ETAPE = 4.0;

/** (réactifs, produits, Q en keV, neutrino emporté (keV), annihilation (keV), fois) */
export type Etape = [string[], string[], number, number, number, number];

export const ETAPES_PP: Etape[] = [
  [['p', 'p'], ['d', 'e+', 'nu'], 2 * E.p! - E.d! - 2 * ME, NU.pp!, 2 * ME, 2],
  [['d', 'p'], ['he3', 'gamma'], E.d! + E.p! - E.he3!, 0.0, 0.0, 2],
  [['he3', 'he3'], ['he4', 'p', 'p'], 2 * E.he3! - E.he4! - 2 * E.p!, 0.0, 0.0, 1],
];
export const ETAPES_CNO: Etape[] = [
  [['c12', 'p'], ['n13', 'gamma'], E.c12! + E.p! - E.n13!, 0.0, 0.0, 1],
  [['n13'], ['c13', 'e+', 'nu'], E.n13! - E.c13! - 2 * ME, NU.n13!, 2 * ME, 1],
  [['c13', 'p'], ['n14', 'gamma'], E.c13! + E.p! - E.n14!, 0.0, 0.0, 1],
  [['n14', 'p'], ['o15', 'gamma'], E.n14! + E.p! - E.o15!, 0.0, 0.0, 1],
  [['o15'], ['n15', 'e+', 'nu'], E.o15! - E.n15! - 2 * ME, NU.o15!, 2 * ME, 1],
  [['n15', 'p'], ['c12', 'he4'], E.n15! + E.p! - E.c12! - E.he4!, 0.0, 0.0, 1],
];
const NOYAUX: Record<string, [string, number, number]> = {
  p: ['¹H', 1, 1], d: ['²H', 1, 2], he3: ['³He', 2, 3], he4: ['⁴He', 2, 4], c12: ['¹²C', 6, 12],
  n13: ['¹³N', 7, 13], c13: ['¹³C', 6, 13], n14: ['¹⁴N', 7, 14], o15: ['¹⁵O', 8, 15], n15: ['¹⁵N', 7, 15],
};
const LEPTONS: Record<string, string> = { 'e+': 'e⁺', nu: 'ν', gamma: 'γ' };

/** Énergie totale libérée (keV), annihilations comprises : 4 Δ(¹H) − Δ(⁴He) = 26 731 keV. */
export function energie_totale(etapes: readonly Etape[]): number {
  let s = 0;
  for (const [, , q, , ann, n] of etapes) s += (q + ann) * n;
  return s;
}

export function energie_neutrinos(etapes: readonly Etape[]): number {
  let s = 0;
  for (const [, , , nu, , n] of etapes) s += nu * n;
  return s;
}

export function equation(etape: Etape): string {
  const nom = (k: string): string => (k in NOYAUX ? NOYAUX[k]![0] : LEPTONS[k]!);
  return `${etape[0].map(nom).join(' + ')} → ${etape[1].map(nom).join(' + ')}`;
}

abstract class Fusion extends Animation {
  static override LECTURE_AU_DEPART = true;
  abstract readonly etapes: Etape[];
  t = 0.0;

  override construire(): void {
    this.bouton('anim_fusion_suivante', () => this.suivante());
    this.etat_initial();
  }

  override etat_initial(): void {
    this.t = 0.0;
  }

  suivante(): void {
    this.t = pmod((Math.floor(this.t / DUREE_ETAPE) + 1) * DUREE_ETAPE, this.etapes.length * DUREE_ETAPE);
    this.rafraichir();
  }

  override avancer(dt: number): void {
    this.t = pmod(this.t + dt, this.etapes.length * DUREE_ETAPE);
  }

  etape(): [number, number] {
    return [Math.trunc(floordiv(this.t, DUREE_ETAPE)), pmod(this.t, DUREE_ETAPE) / DUREE_ETAPE];
  }

  override valeurs(): [string, string][] {
    const [k] = this.etape();
    const et = this.etapes[k]!;
    return [
      [tr('anim_fusion_etape'), `${k + 1} / ${this.etapes.length} – ${equation(et)}`],
      [tr('anim_fusion_q'), `${nombre((et[2] + et[4]) / 1000, 3)} MeV`],
      [tr('anim_fusion_total'), `${nombre(energie_totale(this.etapes) / 1000, 3)} MeV`],
      [tr('anim_fusion_neutrinos'), `${nombre(energie_neutrinos(this.etapes) / 1000, 3)} MeV`],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = rect.w >= 640 ? dessin.zones_principale(rect, 1, 0.6) : dessin.zones(rect, 2, 10.0);
    this.scene(p, dessin.cadre(p, z[0]!, tr('anim_fusion_titre_scene')));
    this.tableau(p, dessin.cadre(p, z[1]!, tr('anim_fusion_titre_etapes')));
  }

  private noyau(p: Peintre, x: number, y: number, k: string, s: number): void {
    const [sym, , a] = NOYAUX[k]!;
    const r = s * (0.7 + 0.35 * a ** (1 / 3));
    dessin.disque(p, x, y, r, a === 1 ? 'accent3' : k.startsWith('he') ? 'accent1' : 'equateur', 'texte');
    dessin.texte(p, x, y, sym, 'fond');
  }

  private lepton(p: Peintre, x: number, y: number, k: string, s: number, dx: number, dy: number): void {
    if (k === 'gamma') {
      const pts: Pt[] = [];
      const n = Math.hypot(dx, dy) || 1.0;
      const ux = dx / n,
        uy = dy / n;
      for (let i = 0; i < 25; i++) {
        const d = -i * 1.4;
        const a = 4 * Math.sin(i * 0.9);
        pts.push(new Pt(x + ux * d - uy * a, y + uy * d + ux * a));
      }
      p.setPen(dessin.stylo('accent1', 2.0));
      p.drawPolyline(pts);
      dessin.texte(p, x + 10, y - 10, 'γ', 'accent1');
    } else if (k === 'e+') {
      dessin.disque(p, x, y, s * 0.35, 'accent2', 'texte');
      dessin.texte(p, x + 12, y - 8, 'e⁺', 'accent2');
    } else {
      dessin.disque(p, x, y, s * 0.25, 'doux');
      dessin.texte(p, x + 10, y - 8, 'ν', 'doux');
    }
  }

  private scene(p: Peintre, r: Rect): void {
    const [k, f] = this.etape();
    const [reac, prod] = this.etapes[k]!;
    const cx = r.cx,
      cy = r.cy;
    const s = Math.min(r.w, r.h) / 14;
    const L = Math.min(r.w, r.h) * 0.42;
    if (f < 0.45) {
      const u = 1 - f / 0.45;
      reac.forEach((n, i) => {
        const d = reac.length > 1 ? L * u : 0.0;
        this.noyau(p, cx + (i === 0 ? -d : d), cy, n, s);
      });
    } else {
      const u = (f - 0.45) / 0.55;
      if (u < 0.15) dessin.disque(p, cx, cy, s * 2.2 * (1 - u / 0.15) + 1, 'soleil', null, 0.6);
      prod.forEach((n, i) => {
        const ang = -Math.PI / 2 + (2 * Math.PI * i) / prod.length + 0.4;
        const d = L * 0.9 * u;
        const x = cx + d * Math.cos(ang),
          y = cy + d * Math.sin(ang);
        if (n in NOYAUX) this.noyau(p, x, y, n, s);
        else this.lepton(p, x, y, n, s, Math.cos(ang), Math.sin(ang));
      });
    }
    dessin.police(p, 1.1);
    dessin.texte(p, cx, r.bottom - 12, equation(this.etapes[k]!), 'texte');
    dessin.police(p, 1 / 1.1);
  }

  private tableau(p: Peintre, r: Rect): void {
    const [k] = this.etape();
    const n = this.etapes.length;
    const h = Math.min(40.0, r.h / (n + 1.5));
    dessin.police(p, 0.9);
    this.etapes.forEach((et, i) => {
      const y = r.top + i * h;
      if (i === k) p.fillRect(new Rect(r.left, y + 2, r.w, h - 4), dessin.c('accent1', 0.18));
      const fois = et[5] > 1 ? ` (×${et[5]})` : '';
      dessin.texte(p, r.left + 6, y + h / 2 + 4, equation(et) + fois, 'texte', { centre: false });
      const q = `${nombre((et[2] + et[4]) / 1000, 3)} MeV`;
      dessin.texte(p, r.right - 6 - p.fontMetrics().horizontalAdvance(q), y + h / 2 + 4, q, 'accent1', { centre: false });
    });
    const y = r.top + n * h + 8;
    const tot = tr('anim_fusion_bilan', { e: nombre(energie_totale(this.etapes) / 1000, 3) });
    dessin.texte(p, r.left + 6, y + 10, tot, 'accent3', { centre: false });
    dessin.police(p, 1 / 0.9);
  }
}

export class FusionPP extends Fusion {
  static override ID = 'fusion01';
  readonly etapes = ETAPES_PP;
}

export class FusionCNO extends Fusion {
  static override ID = 'fusion02';
  readonly etapes = ETAPES_CNO;
}
