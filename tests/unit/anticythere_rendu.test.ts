/**
 * Machine d'Anticythère, rendu et interaction : caméra quaternion (garde-fous, 1 000 glissers aberrants), rendu non
 * vide et sans NaN dans toutes les vues, roue survolée ou touchée, manivelle saisie à la souris.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import * as M from '../../src/calc/anticythere';
import { Anticythere, affine_plan, fiche_roue, projeter, q_matrice, q_valide, tourner_camera, VUES } from '../../src/anim/animations/anticythere';
import { toutCharger } from '../../src/i18n/i18n';
import { choisirTheme } from '../../src/noyau/dessin';
import { Peintre, Pt, Rect } from '../../src/noyau/peintre';
import { fauxContexte } from './faux_canvas';

beforeAll(async () => {
  await toutCharger();
});

function dessine(a: Anticythere, w = 800, h = 520) {
  const { ctx, bilan } = fauxContexte();
  a.peindre(new Peintre(ctx), new Rect(0, 0, w, h));
  return bilan;
}

describe('caméra quaternion', () => {
  it('les vues prédéfinies sont des rotations ; avant = identité, arrière = demi-tour', () => {
    for (const q of Object.values(VUES)) expect(q_valide(q)).toBe(true);
    expect(q_matrice(VUES.avant!).map((x) => Math.round(x * 1e9) / 1e9)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const R = q_matrice(VUES.arriere!);
    expect(R[0]).toBeCloseTo(-1, 12);
    expect(R[8]).toBeCloseTo(-1, 12);
  });
  it('1 000 glissers aléatoires, dont des valeurs aberrantes : orientation toujours valide', () => {
    let q = VUES.trois_quarts!;
    let graine = 7;
    const hasard = (): number => ((graine = (graine * 16807) % 2147483647) / 2147483647);
    const aberrants = [NaN, Infinity, -Infinity, 1e308, -1e308, 0];
    for (let i = 0; i < 1000; i++) {
      const dx = i % 17 === 0 ? aberrants[i % 6]! : (hasard() - 0.5) * 400;
      const dy = i % 23 === 0 ? aberrants[(i + 3) % 6]! : (hasard() - 0.5) * 400;
      const r = i % 31 === 0 ? aberrants[i % 6]! : 50 + hasard() * 300;
      q = tourner_camera(q, dx, dy, r);
      expect(q_valide(q), `${i}`).toBe(true);
    }
    expect(q_valide(tourner_camera([NaN, 0, 0, 0], 10, 10, 100))).toBe(true);
  });
  it('le plan projeté est cohérent avec la projection des points', () => {
    const a = new Anticythere().initialiser();
    a.q = VUES.trois_quarts!;
    dessine(a);
    const pr = a.pr!;
    const [A, B, C, D, E, F] = affine_plan(pr, 12.5);
    const [X, Y] = projeter(pr, 30, -20, 12.5);
    expect(A * 30 + C * -20 + E).toBeCloseTo(X, 9);
    expect(B * 30 + D * -20 + F).toBeCloseTo(Y, 9);
  });
});

describe('rendu', () => {
  it('toutes les vues, ouverte ou fermée, éclatée, deux thèmes, quatre formats : non vide, sans NaN', () => {
    for (const theme of ['sombre', 'clair'] as const) {
      choisirTheme(theme);
      for (const enveloppe of [true, false])
        for (const face of ['avant', 'arriere', 'trois_quarts'])
          for (const eclatement of [0, 100])
            for (const [w, h] of [[800, 520], [360, 560], [1024, 700], [1800, 760]] as [number, number][]) {
              const a = new Anticythere({ enveloppe, face, eclatement }).initialiser();
              a.pas(0.37);
              const b = dessine(a, w, h);
              expect(b.nonFinis.slice(0, 3), `${theme} ${enveloppe} ${face} ${eclatement} ${w}`).toEqual([]);
              expect(b.traces, `${enveloppe} ${face}`).toBeGreaterThan(enveloppe ? 6 : 60);
            }
    }
    choisirTheme('sombre');
  });
  it('glisser pendant la lecture, avec des valeurs aberrantes : jamais de NaN', () => {
    const a = new Anticythere({ enveloppe: false, face: 'trois_quarts' }).initialiser();
    a.basculer_lecture();
    dessine(a);
    for (let i = 0; i < 60; i++) {
      a.presser(new Pt(400, 250), 'gauche');
      a.glisser(new Pt(420 + i, 260), i % 7 === 0 ? NaN : 20 + i, i % 11 === 0 ? Infinity : -10);
      a.battement(0.05);
      a.relacher(new Pt(420 + i, 260));
      expect(dessine(a).nonFinis).toEqual([]);
    }
    expect(q_valide(a.q)).toBe(true);
  });
});

describe('interaction', () => {
  it('survoler une roue la nomme : dents, rapport exact, fonction', () => {
    const a = new Anticythere({ enveloppe: false, face: 'avant' }).initialiser();
    dessine(a);
    // centre de b1 (étage 1, devant) : vu de face, c'est b1 ou son moyeu qui est sous le pointeur, sur un bras
    const [gx, gy, gz] = M.gear_placement('b1', 0, a.meca.raw('carrier_e3'));
    const ang = 2 * Math.PI * a.meca.gear_angles().b1!;
    const [X, Y] = projeter(a.pr!, gx + 60 * Math.cos(ang), gy + 60 * Math.sin(ang), gz + M.GEAR_THICKNESS);
    expect(a.survoler(new Pt(X, Y))).toBe(true);
    expect(a.roue).toBe('b1');
    const v = a.valeurs().at(-1)![1];
    expect(v).toBe(fiche_roue('b1'));
    expect(v).toContain('223');
    // e3 : le porte-satellite, 477/4237
    expect(fiche_roue('e3')).toContain('477/4237');
    expect(fiche_roue('o1')).toContain('1/76');
    // hors de la machine : plus de roue
    a.survoler(new Pt(2, 2));
    expect(a.roue).toBeNull();
  });
  it('toucher une roue sans glisser la désigne (doigt), toucher à côté efface la désignation', () => {
    const a = new Anticythere({ enveloppe: false, face: 'avant' }).initialiser();
    dessine(a);
    const [gx, gy, gz] = M.gear_placement('m1', 0, 0);
    const [X, Y] = projeter(a.pr!, gx - 25, gy, gz + M.GEAR_THICKNESS);
    a.presser(new Pt(X, Y), 'gauche');
    a.relacher(new Pt(X, Y));
    expect(a.roue).not.toBeNull();
    a.presser(new Pt(X, Y), 'gauche');
    a.relacher(new Pt(X, Y));
    expect(a.roue).not.toBeNull();
    a.presser(new Pt(12, 30), 'gauche');
    a.relacher(new Pt(12, 30));
    expect(a.roue).toBeNull();
  });
  it('la manivelle saisie à la souris fait avancer la machine de 78,6 jours par tour de poignée', () => {
    const a = new Anticythere().initialiser();
    dessine(a);
    const pr = a.pr!;
    const [ax, ay] = M.ARBORS.a!;
    const zp = M.Z_FRONT - 2 + M.CRANK_SHAFT + 4 + (M.CRANK_HANDLE + 6) / 2;
    const ang0 = 2 * Math.PI * a.meca.gear_angles().a1!;
    const point = (t: number): Pt => {
      const [X, Y] = projeter(pr, ax + M.CRANK_RADIUS * Math.cos(t), ay + M.CRANK_RADIUS * Math.sin(t), zp);
      return new Pt(X, Y);
    };
    expect(a.sur_manivelle(point(ang0))).toBe(true);
    const j0 = a.meca.days;
    a.presser(point(ang0), 'gauche');
    // un tour complet de poignée, en sens inverse (sens qui fait avancer la date), par petits pas
    for (let k = 1; k <= 40; k++) {
      const p = point(ang0 - (2 * Math.PI * k) / 40);
      a.glisser(p, 1, 1);
    }
    a.relacher(point(ang0));
    expect(a.meca.days - j0).toBeCloseTo((M.TROPICAL_YEAR * 48) / 223, 6);
  });
  it('lecture : un tour de manivelle par seconde ; boutons +1 lunaison, +1 an', () => {
    const a = new Anticythere().initialiser();
    const j0 = a.meca.days;
    a.pas(1.0);
    expect(a.meca.days - j0).toBeCloseTo((M.TROPICAL_YEAR * 48) / 223, 9);
    const j1 = a.jd();
    a.regler_jd(j1 + M.SYNODIC_MONTH);
    expect(a.jd() - j1).toBeCloseTo(M.SYNODIC_MONTH, 9);
    a.regler_jd(NaN);
    expect(Number.isFinite(a.jd())).toBe(true);
  });
});
