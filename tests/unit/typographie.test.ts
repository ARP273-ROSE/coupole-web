/**
 * Règle typographique (demande de l'utilisateur, 14/10/2026) : unités SI à exposants négatifs (m·s⁻¹, jamais « m/s »),
 * signe moins typographique, puissances de dix en exposant, milliers à espace fine insécable, formules à délimiteurs et
 * racines extensibles, indices de plusieurs lettres en romain.  Formateur commun aux ressources et aux applis
 * (typographie.ts, cas typographie_cas.json) et règle des animations (typo.ts, cas typographie_reference.json), les
 * mêmes qu'au bureau ; puis aucun texte affiché des 95 animations (valeurs, réglages, aides, textes de l'interface,
 * « Ce qu'il faut voir », textes dessinés sur la toile) n'enfreint la règle.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import REF from '../references/typographie_reference.json';
import CAS from '../references/typographie_cas.json';
import ANIM from '../references/animations.json';
import { interdit, typo } from '../../src/noyau/typo';
import * as T from '../../src/noyau/typographie';
import { nombre } from '../../src/noyau/format';
import { charger, disponible, ENTREES } from '../../src/anim/registre';
import { choisirLangue, type Langue, toutCharger } from '../../src/i18n/i18n';
import ANIM_FR from '../../src/i18n/genere/anim.fr.json';
import ANIM_EN from '../../src/i18n/genere/anim.en.json';
import CAT_FR from '../../src/i18n/genere/catalogue.fr.json';
import CAT_EN from '../../src/i18n/genere/catalogue.en.json';
import { aVoir } from '../../src/i18n/a_voir';
import { decouper } from '../../src/app/texte_riche';
import { analyser, dessinerFormule, dimensionsFormule, type Noeud } from '../../src/noyau/formule';
import { Peintre, Rect } from '../../src/noyau/peintre';
import { fauxContexte } from './faux_canvas';
import { Choix, Coche, Reglage } from '../../src/anim/base';

type Etapes = [string, [string, string][]][];
type RefAnim = Record<string, { fr: { etapes: Etapes; reglages: Record<string, unknown>[] }; en: { etapes: Etapes; reglages: Record<string, unknown>[] } }>;

beforeAll(async () => {
  await toutCharger();
});

/** Fautes typographiques d'un texte affiché : contrôle commun sur ses parties hors formules, et règle des animations. */
function fautes(s: string, lg: Langue, valeur = false): string[] {
  // licences et versions citées telles quelles (« CC BY 4.0 », « Apache License 2.0 ») : pas des nombres décimaux
  const texte = decouper(s.replace(/CC BY 4\.0|License 2\.0/g, ''), valeur).filter(([g]) => g === 'texte').map(([, t]) => t).join(' ');
  return [...T.controle(texte, lg), ...(interdit(texte) ? ['règle des animations'] : [])];
}

describe('formateur commun (mêmes cas que le bureau et les ressources)', () => {
  it('unite, nombre, sci, controle', () => {
    for (const [a, b] of CAS.unite as [string, string][]) expect(T.unite(a)).toBe(b);
    for (const [[x, lg, d], b] of CAS.nombre as [[number, 'fr' | 'en', number], string][]) expect(T.nombre(x, lg, d)).toBe(b);
    for (const [[x, lg, c], b] of CAS.sci as [[number, 'fr' | 'en', number], string][]) expect(T.sci(x, lg, c)).toBe(b);
    for (const [[t, lg], n] of CAS.controle as [[string, 'fr' | 'en'], number][]) expect(T.controle(t, lg).length > 0, t).toBe(n > 0);
  });
  it.each(REF.typo as [string, string][])('typo « %s »', (a, b) => expect(typo(a)).toBe(b));
  it.each(REF.interdits as [string, boolean][])('interdit « %s » : %s', (a, b) => expect(interdit(a)).toBe(b));
  it('nombre() des animations : signe moins typographique, virgule décimale en français', () => {
    choisirLangue('fr');
    expect(nombre(-3.25, 2)).toBe('−3,25');
    expect(nombre(-0.001, 1)).toBe('0,0');
    choisirLangue('en');
    expect(nombre(-12345.6, 1)).toBe('−12\u202f345.6');
    choisirLangue('fr');
  });
});

describe('aucun texte affiché n’enfreint la règle', () => {
  it('valeurs, réglages et aides des 95 animations (FR et EN, scénario complet)', () => {
    const f: string[] = [];
    for (const [id, r] of Object.entries(ANIM as unknown as RefAnim)) {
      for (const lg of ['fr', 'en'] as const) {
        for (const [, vals] of r[lg].etapes) for (const [a, b] of vals) for (const [s, v] of [[a, false], [b, true]] as [string, boolean][]) if (fautes(s, lg, v).length) f.push(`${id} (${lg}) : ${s} → ${fautes(s, lg, v)}`);
        for (const g of r[lg].reglages) {
          for (const k of ['libelle', 'aide', 'unite']) if (typeof g[k] === 'string' && fautes(g[k] as string, lg).length) f.push(`${id}.${k} : ${g[k]}`);
          for (const o of (g.options as [string, unknown][] | undefined) ?? []) if (fautes(o[0], lg).length) f.push(`${id} option : ${o[0]}`);
        }
      }
    }
    expect(f).toEqual([]);
  });

  it('textes de l’interface, du catalogue et « Ce qu’il faut voir »', () => {
    const f: string[] = [];
    for (const [d, lg] of [[ANIM_FR, 'fr'], [ANIM_EN, 'en'], [CAT_FR, 'fr'], [CAT_EN, 'en']] as [Record<string, string>, Langue][])
      for (const [k, v] of Object.entries(d)) if (!k.endsWith('_html') && fautes(v, lg).length) f.push(`${k} : ${fautes(v, lg)} : ${v.slice(0, 80)}`);
    for (const lg of ['fr', 'en'] as Langue[]) for (const e of ENTREES) if (fautes(aVoir(e.id, lg), lg).length) f.push(`à voir ${e.id} (${lg}) : ${fautes(aVoir(e.id, lg), lg)}`);
    expect(f).toEqual([]);
  });

  it('textes dessinés sur la toile (95 animations, réglages par défaut puis changés, FR et EN)', async () => {
    const f = new Set<string>();
    for (const lg of ['fr', 'en'] as Langue[]) {
      choisirLangue(lg);
      for (const e of ENTREES) {
        if (!disponible(e)) continue;
        const cls = await charger(e);
        const a = new cls().initialiser();
        const { ctx, bilan } = fauxContexte();
        const p = new Peintre(ctx);
        a.peindre(p, new Rect(0, 0, 900, 620));
        let k = 0;
        for (const [, [w]] of a.defauts) {
          k++;
          if (w instanceof Reglage) w.setValue(w.mini + ((k * 0.37) % 1) * (w.maxi - w.mini));
          else if (w instanceof Coche) w.setChecked(!w.isChecked());
          else if (w instanceof Choix && w.count() > 1) w.setCurrentIndex(k % w.count());
        }
        a.pas(0.4);
        a.peindre(p, new Rect(0, 0, 900, 620));
        for (const s of bilan.textes) if (interdit(s)) f.add(`${e.id} : ${s}`);
      }
    }
    choisirLangue('fr');
    expect([...f]).toEqual([]);
  });
});

/** Écriture compacte d'un arbre de formule. */
function ecrire(n: Noeud): string {
  switch (n.t) {
    case 'rangee':
      return n.e.map(ecrire).join(' ');
    case 'id':
    case 'nb':
    case 'op':
      return n.v;
    case 'frac':
      return `(${ecrire(n.n)})/(${ecrire(n.d)})`;
    case 'sup':
      return `${ecrire(n.b)}^${ecrire(n.s)}`;
    case 'sub':
      return `${ecrire(n.b)}_${ecrire(n.s)}`;
    case 'subsup':
      return `${ecrire(n.b)}_${ecrire(n.i)}^${ecrire(n.s)}`;
    case 'racine':
      return `√[${ecrire(n.e)}]`;
    case 'paren':
      return `${n.o}${ecrire(n.e)}${n.f}`;
  }
}

describe('formules : délimiteurs et racines extensibles, indices en mots', () => {
  it.each([
    // la fraction de l'exposant est empilée : ses parenthèses de groupement disparaissent, comme en LaTeX
    ['d = 10^((m − M + 5)/5)', 'd = 10^(m − M + 5)/(5)'],
    ['t ≈ 10¹⁰ × (M/M☉)^(−2,5)', 't ≈ 10^10 × ((M)/(M_☉))^− 2,5'],
    ['√((1+β)/(1−β))', '√[(1 + β)/(1 − β)]'],
    ['λ_max = b / T', 'λ_max = (b)/(T)'],
    ['f_obs = f₀ / (1 − v_r / c)', 'f_obs = (f_0)/(1 − (v_r)/(c))'],
    ['sin E = a_int / a_ext', 'sin E = (a_int)/(a_ext)'],
  ])('%s', (s, attendu) => expect(ecrire(analyser(s))).toBe(attendu));

  it('les parenthèses s’étirent autour d’une fraction, la racine couvre son contenu', () => {
    const { ctx: brut } = fauxContexte();
    const echelles: number[] = [];
    // on espionne les mises à l'échelle du glyphe des parenthèses
    const ctx = new Proxy(brut, {
      get(cible, nom: string) {
        const v = (cible as unknown as Record<string, unknown>)[nom];
        if (nom === 'scale') return (x: number, y: number) => {
          echelles.push(y);
          (v as (x: number, y: number) => void)(x, y);
        };
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(cible) : v;
      },
      set(cible, nom: string, v) {
        (cible as unknown as Record<string, unknown>)[nom] = v;
        return true;
      },
    });
    const p = new Peintre(ctx);
    p.setFont({ taille: 15, gras: false });
    for (const s of ['t ≈ 10¹⁰ × (M/M☉)^(−2,5)', 'L / L☉ = (R / R☉)² (T / T☉)⁴', 'E = 13,598 eV (1/n² − 1/m²)']) {
      echelles.length = 0;
      dessinerFormule(p, 10, 40, s);
      expect(Math.max(...echelles), s).toBeGreaterThan(1.2);
    }
    const simple = dimensionsFormule(p, '√x');
    const grande = dimensionsFormule(p, '√((1+β)/(1−β))');
    expect(grande.asc + grande.desc).toBeGreaterThan(1.5 * (simple.asc + simple.desc));
    // les indices de plusieurs lettres sont des mots droits (un seul identificateur)
    const n = analyser('λ_max') as { t: string; s: { t: string; v: string } };
    expect(n.t).toBe('sub');
    expect(n.s).toEqual({ t: 'id', v: 'max' });
  });
});

describe('neutrino : la lettre grecque ν, jamais la lettre latine v', () => {
  // « e⁺ + v », « → … + v » : le neutrino écrit avec un v latin (U+0076) dans une équation de réaction
  const VLATIN = /(?:\+|→)\s*v(?:ₑ|e)?(?=\s|$|[,.;:)])/;
  it('règle : « e⁺ + v » rejeté, « e⁺ + νₑ » accepté', () => {
    expect(VLATIN.test('¹H + ¹H → ²H + e⁺ + v')).toBe(true);
    expect(VLATIN.test('¹³N → ¹³C + e⁺ + ve')).toBe(true);
    expect(VLATIN.test('¹H + ¹H → ²H + e⁺ + νₑ')).toBe(false);
    expect(VLATIN.test('v = d / t')).toBe(false);
  });
  it('équations des réactions de fusion et tous les textes des animations', async () => {
    const { ETAPES_PP, ETAPES_CNO, equation } = await import('../../src/anim/animations/fusion');
    for (const e of [...ETAPES_PP, ...ETAPES_CNO]) {
      const q = equation(e);
      expect(VLATIN.test(q), q).toBe(false);
      if (e[1].includes('nu')) expect(q).toContain('νₑ');
    }
    for (const d of [ANIM_FR, ANIM_EN, CAT_FR, CAT_EN] as Record<string, string>[]) for (const [k, v] of Object.entries(d)) expect(VLATIN.test(v), k).toBe(false);
    for (const lg of ['fr', 'en'] as const) for (const e of ENTREES) expect(VLATIN.test(aVoir(e.id, lg) ?? ''), e.id).toBe(false);
  });
});
