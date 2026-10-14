/**
 * Chaque animation de Coupole Web rejoue le scénario de l'appli de bureau Coupole (tests/references/animations.json,
 * produit par outils/references_animations.py) : mêmes réglages (bornes, défauts, décimales, unités, libellés,
 * options), mêmes valeurs affichées au caractère près, en français et en anglais, à la création, après quelques pas,
 * après un changement de tous les réglages, après Réinitialiser.  Puis rendu sans erreur (formats téléphone, tablette,
 * bureau, deux thèmes) et souris.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import REF from '../references/animations.json';
import { type Animation, Choix, Coche, Reglage } from '../../src/anim/base';
import { charger, disponible, ENTREES } from '../../src/anim/registre';
import { choisirLangue, type Langue, toutCharger } from '../../src/i18n/i18n';
import { choisirTheme } from '../../src/noyau/dessin';
import { Peintre, Pt, Rect } from '../../src/noyau/peintre';
import { fauxContexte } from './faux_canvas';

interface RefReglage {
  cle: string;
  type: 'curseur' | 'coche' | 'choix';
  mini?: number;
  maxi?: number;
  defaut: unknown;
  valeur?: number;
  dec?: number;
  unite?: string;
  log?: boolean;
  libelle?: string;
  aide?: string;
  options?: [string, unknown][];
}
interface RefLangue {
  reglages: RefReglage[];
  etapes: [string, [string, string][]][];
}
interface RefAnim {
  animee: boolean;
  lecture_au_depart: boolean;
  changements: [string, unknown][];
  fr: RefLangue;
  en: RefLangue;
}

const R = REF as unknown as Record<string, RefAnim>;
const PAS = 0.37;
const N_PAS = 4;

/** Animations dont les valeurs dépendent d'un tirage au hasard après la création (comparées sans les étapes). */
const ALEATOIRES = new Set<string>([]);

beforeAll(async () => {
  await toutCharger();
});

function reglagesDe(a: Animation) {
  const out: RefReglage[] = [];
  for (const [cle, [w, defaut]] of a.defauts) {
    if (w instanceof Reglage)
      out.push({
        cle, type: 'curseur', mini: w.mini, maxi: w.maxi, defaut, valeur: w.value(), dec: w.dec, unite: w.unite,
        log: w.log, libelle: w.texte, aide: w.aide,
      });
    else if (w instanceof Coche) out.push({ cle, type: 'coche', defaut, libelle: w.texte, aide: w.aide });
    else if (w instanceof Choix)
      out.push({ cle, type: 'choix', defaut, options: w.options.map((o) => [o.texte, o.donnee]), aide: w.aide });
  }
  return out;
}

function scenario(a: Animation, ref: RefAnim): [string, [string, string][]][] {
  const etapes: [string, [string, string][]][] = [['creation', a.valeurs()]];
  if (ref.animee) {
    for (let i = 0; i < N_PAS; i++) a.pas(PAS);
    etapes.push(['pas', a.valeurs()]);
  }
  for (const [cle, v] of ref.changements) {
    const w = a.defauts.get(cle)?.[0];
    if (w instanceof Reglage) w.setValue(v as number);
    else if (w instanceof Coche) w.setChecked(v as boolean);
    else if (w instanceof Choix) w.setCurrentIndex(w.findData(v as never));
  }
  etapes.push(['reglages', a.valeurs()]);
  if (ref.animee) {
    for (let i = 0; i < N_PAS; i++) a.pas(PAS);
    etapes.push(['reglages_pas', a.valeurs()]);
  }
  a.reinitialiser();
  etapes.push(['reinitialiser', a.valeurs()]);
  return etapes;
}

const FORMATS: [string, number, number][] = [
  ['bureau', 800, 520],
  ['téléphone', 360, 560],
  ['tablette', 1024, 700],
  ['large', 1800, 760],
];

describe('catalogue', () => {
  it('92 animations, toutes dans les références de Coupole', () => {
    expect(ENTREES.length).toBe(92);
    for (const e of ENTREES) expect(R[e.id], e.id).toBeDefined();
  });
});

for (const e of ENTREES) {
  if (!disponible(e)) continue;
  describe(e.id, () => {
    for (const lg of ['fr', 'en'] as Langue[]) {
      it(`mêmes réglages et mêmes valeurs que Coupole (${lg})`, async () => {
        choisirLangue(lg);
        const cls = await charger(e);
        const ref = R[e.id]!;
        expect(cls.ID).toBe(e.id);
        expect(cls.ANIMEE).toBe(ref.animee);
        expect(cls.LECTURE_AU_DEPART).toBe(ref.lecture_au_depart);
        const a = new cls().initialiser();
        expect(reglagesDe(a)).toEqual(ref[lg].reglages);
        const etapes = scenario(a, ref);
        if (ALEATOIRES.has(e.id)) expect(etapes[0]).toEqual(ref[lg].etapes[0]);
        else expect(etapes).toEqual(ref[lg].etapes);
        choisirLangue('fr');
      });
    }

    it('rendu sans erreur (formats, thèmes), souris, lecture', async () => {
      const cls = await charger(e);
      for (const theme of ['sombre', 'clair'] as const) {
        choisirTheme(theme);
        for (const [, w, h] of FORMATS) {
          const a = new cls().initialiser();
          const { ctx, bilan } = fauxContexte();
          const p = new Peintre(ctx);
          const r = new Rect(0, 0, w, h);
          a.peindre(p, r);
          for (let i = 0; i < 5; i++) {
            a.battement(0.05);
            a.peindre(p, r);
          }
          // souris : appui au centre puis glissement et relâchement, puis appui en coin
          for (const [x, y] of [[w / 2, h / 2], [w * 0.3, h * 0.4], [w * 0.8, h * 0.7], [10, 10]] as [number, number][]) {
            a.presser(new Pt(x, y), 'gauche');
            a.glisser(new Pt(x + 12, y + 7), 12, 7);
            a.glisser(new Pt(x + 30, y - 5), 18, -12);
            a.relacher(new Pt(x + 30, y - 5));
            a.peindre(p, r);
          }
          a.presser(new Pt(w / 2, h / 2), 'droit');
          a.relacher(new Pt(w / 2, h / 2));
          a.peindre(p, r);
          expect(bilan.nonFinis.slice(0, 3), `${e.id} ${w}×${h} ${theme}`).toEqual([]);
          expect(bilan.traces).toBeGreaterThan(5);
        }
      }
      choisirTheme('sombre');
    });
  });
}
