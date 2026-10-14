/**
 * Galactic Redshift Simulator : le spectre d'une galaxie décalé vers le rouge.  Toutes les longueurs d'onde sont
 * multipliées par (1 + z) : les raies d'absorption glissent vers le rouge, et la lumière qui tombe dans chaque filtre
 * U, B, V, R change, donc la couleur de la galaxie.  Spectre de la galaxie elliptique M32 (Santos et al. 2002,
 * VizieR III/219), ramené au repos comme dans l'original ; filtres de Landolt (1992).  Vitesse par l'effet Doppler
 * relativiste.
 */
import * as lumiere from '../../calc/lumiere';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes, bande_spectre } from '../../noyau/graphe';
import { type Peintre, Rect } from '../../noyau/peintre';
import { Animation, type Coche, nombre, type Reglage } from '../base';

const LAMBDA: [number, number] = [250.0, 950.0];
const RAIES: [string, number][] = [['Ca K', 393.37], ['Ca H', 396.85], ['G', 430.8], ['Mg b', 517.3], ['Na D', 589.3], ['Hα', 656.28]];
const COULEURS = ['arc1', 'accent2', 'horizon', 'accent3'];

function m32(): { w0: number; pas: number; f: number[]; k: number } {
  const d = lumiere.spectres().m32!;
  return { w0: d.w0, pas: d.pas!, f: d.f as number[], k: 1.0 + (d.z_original as number) };
}

export function spectre_repos(): [number, number][] {
  const { w0, pas, f, k } = m32();
  return f.map((v, i) => [(w0 + pas * i) * k, v]);
}

/** F(λ observée) = F_repos(λ / (1 + z)) (spectre seulement décalé, comme l'original). */
export function flux_observe(z: number): (lam: number) => number {
  const { w0, pas, f, k } = m32();
  return (lam) => {
    const x = (lam / (1 + z) / k - w0) / pas;
    const i = Math.floor(x);
    if (i < 0 || i >= f.length - 1) return 0.0;
    const t = x - i;
    return f[i]! * (1 - t) + f[i + 1]! * t;
  };
}

/** Vitesse (km/s) donnant ce décalage par l'effet Doppler relativiste : v / c = ((1+z)² − 1) / ((1+z)² + 1). */
export function vitesse_relativiste(z: number): number {
  const s = (1 + z) ** 2;
  return ((lumiere.C / 1000) * (s - 1)) / (s + 1);
}

interface Filtres {
  s: Record<string, number>;
  m: Record<string, number>;
}

export class DecalageGalaxie extends Animation {
  static override ID = 'galacticredshift';
  static override ANIMEE = false;

  z!: Reglage;
  c_filtres!: Coche;
  c_raies!: Coche;
  private repos: [number, number][] = [];
  private max = 1;
  private cache = new Map<number, Filtres>();

  override construire(): void {
    this.z = this.curseur('z', 0.0, 1.0, 0.0, { dec: 3 });
    this.c_filtres = this.coche('filtres', true);
    this.c_raies = this.coche('raies', true);
    this.repos = spectre_repos().filter((_, i) => i % 10 === 0);
    this.max = Math.max(...this.repos.map(([, v]) => v));
  }

  /** Sommes Σ T F Δλ et magnitudes dans les quatre filtres pour ce décalage (mémorisées). */
  filtres(z: number): Filtres {
    let r = this.cache.get(z);
    if (r === undefined) {
      if (this.cache.size > 64) this.cache.clear();
      const f = flux_observe(z);
      const s: Record<string, number> = {},
        m: Record<string, number> = {};
      for (const n of lumiere.FILTRES) {
        s[n] = lumiere.somme_filtre(n, f);
        m[n] = s[n] > 0 ? (lumiere.spectres()['filtre_' + n]!.decalage as number) - 2.5 * Math.log10(s[n]) : Infinity;
      }
      r = { s, m };
      this.cache.set(z, r);
    }
    return r;
  }

  magnitudes(): Record<string, number> {
    return this.filtres(this.z.value()).m;
  }

  override valeurs(): [string, string][] {
    const z = this.z.value();
    const m = this.magnitudes();
    return [
      ['z', nombre(z, 3)],
      [tr('anim_galacticredshift_v'), `${nombre(vitesse_relativiste(z), 0)} km/s`],
      [tr('anim_galacticredshift_halpha'), `${nombre(656.28 * (1 + z), 1)} nm`],
      ['B − V', nombre(m.B! - m.V!, 2)],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = this.z.value();
    const k = 1 + z;
    const haut = new Rect(rect.x, rect.y, rect.w, rect.h * (this.c_filtres.isChecked() ? 0.7 : 1.0));
    const r = dessin.cadre(p, haut, tr('anim_galacticredshift_titre'));
    const bande = new Rect(r.left + 52, r.top, r.w - 66, 22);
    const ax = new Axes(new Rect(r.left, bande.bottom + 4, r.w, r.h - 26), LAMBDA[0], LAMBDA[1], 0, 1.05, false, false, [52, 6, 14, 28]).avec(p);
    const f = flux_observe(z);
    const mx = this.max;
    bande_spectre(p, new Rect(ax.px(380), bande.top, ax.px(750) - ax.px(380), bande.h), 380, 750, (lam) => f(lam) / mx, [], false, 10.0);
    if (this.c_filtres.isChecked()) {
      lumiere.FILTRES.forEach((n, i) => {
        const [w0, , tt] = lumiere.table('filtre_' + n);
        const pts: [number, number][] = [];
        for (let j = 0; j < tt.length; j += 4) pts.push([w0 + j, tt[j]!]);
        ax.remplir(pts, COULEURS[i]!, 0.12);
      });
    }
    ax.fond(p, { titre_x: tr('anim_c_lambda_nm'), titre_y: tr('anim_c_flux_relatif') });
    ax.courbe(
      this.repos.filter(([lam]) => LAMBDA[0] <= lam * k && lam * k <= LAMBDA[1]).map(([lam, v]) => [lam * k, v / mx] as [number, number]),
      'accent1', 0.0,
    );
    if (this.c_raies.isChecked()) {
      dessin.police(p, 0.8);
      RAIES.forEach(([nom, lam], i) => {
        ax.verticale(lam * k, 'doux', 1.0, true);
        const X = ax.px(lam * k);
        if (ax.r.left <= X && X <= ax.r.right) dessin.texte(p, X, ax.r.top + 10 + 12 * (i % 2), nom, 'texte', { fond: true });
      });
      dessin.police(p, 1 / 0.8);
    }
    if (this.c_filtres.isChecked())
      this.barres(p, dessin.cadre(p, new Rect(rect.x, haut.bottom, rect.w, rect.h - haut.h), tr('anim_galacticredshift_titre_f')));
  }

  private barres(p: Peintre, r: Rect): void {
    const { s, m } = this.filtres(this.z.value());
    const m0 = this.filtres(0.0).m;
    const mx = Math.max(...Object.values(this.filtres(0.0).s));
    const w = r.w / 4;
    lumiere.FILTRES.forEach((n, i) => {
      const h = (r.h - 18) * Math.min(1.0, s[n]! / mx);
      const x = r.left + i * w + w * 0.15;
      p.fillRect(new Rect(x, r.bottom - 14 - h, w * 0.5, h), dessin.c(COULEURS[i]!, 0.8));
      dessin.texte(p, x + w * 0.25, r.bottom - 4, n, 'texte');
      const dm = `Δm = ${m[n]! >= m0[n]! ? '+' : ''}${nombre(m[n]! - m0[n]!, 2)}`;
      // à côté de la barre s'il y a la place, sinon au-dessus
      if (p.fontMetrics().horizontalAdvance(dm) < w * 0.5 - 8) dessin.texte(p, x + w * 0.5 + 6, r.bottom - 20, dm, 'doux', { centre: false });
      else dessin.texte(p, x + w * 0.25, Math.max(r.top + 8, r.bottom - 22 - h), dm, 'doux');
    });
  }
}
