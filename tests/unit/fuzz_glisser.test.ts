/**
 * Non-régression : glisser pendant la lecture (bogue du globe 3D qui devenait un disque vide).  Des glissers
 * aléatoires, rapides, avec élan, et quelques valeurs aberrantes, pendant que l'animation tourne : l'orientation
 * reste une vraie rotation finie et l'image n'est jamais vide.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JourNuit, rotation_valide, tourner_globe, orientation } from '../../src/anim/animations/jour_nuit';
import { charger, ENTREES } from '../../src/anim/registre';
import { toutCharger } from '../../src/i18n/i18n';
import { Peintre, Pt, Rect } from '../../src/noyau/peintre';
import { alea } from '../../src/noyau/py';
import { fauxContexte } from './faux_canvas';

// élan : requestAnimationFrame exécuté tout de suite (la lancée décroît et s'arrête d'elle-même)
const g = globalThis as { requestAnimationFrame?: (f: () => void) => number };
const avant = g.requestAnimationFrame;
beforeAll(async () => {
  await toutCharger();
  g.requestAnimationFrame = (f) => {
    queueMicrotask(f);
    return 0;
  };
});
afterAll(() => {
  g.requestAnimationFrame = avant;
});

describe('globe 3D : glisser pendant la lecture', () => {
  it('garde-fous : glissers aberrants sans effet, orientation invalide remplacée', () => {
    const m = orientation(10, 20);
    for (const [dx, dy, r] of [[NaN, 3, 100], [Infinity, 0, 100], [3, 4, 0], [3, 4, NaN], [0, 0, 100], [1e300, 1e300, 100]])
      expect(rotation_valide(tourner_globe(m, dx!, dy!, r!))).toBe(true);
    expect(rotation_valide(tourner_globe([NaN, 0, 0, 0, 1, 0, 0, 0, 1], 5, 5, 100))).toBe(true);
    const a = new JourNuit().initialiser();
    a.projection.setCurrentIndex(a.projection.findData('globe'));
    a.globe = [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
    const { ctx, bilan } = fauxContexte();
    a.peindre(new Peintre(ctx), new Rect(0, 0, 800, 520));
    expect(rotation_valide(a.globe)).toBe(true);
    expect(bilan.traces).toBeGreaterThan(50);
    // aucune valeur non finie n'est retenue par un réglage (donc ni affichée, ni mémorisée)
    a.heure.setValue(NaN);
    a.jour.setValue(Infinity);
    expect(Number.isFinite(a.heure.value()) && Number.isFinite(a.jour.value())).toBe(true);
  });

  it('1 000 glissers aléatoires en lecture (vitesse 4,68, terminateur tournant, axe) : rotation finie, image jamais vide', async () => {
    const u = alea(2026);
    const a = new JourNuit().initialiser();
    a.projection.setCurrentIndex(a.projection.findData('globe'));
    a.c_tournant.setChecked(true);
    a.c_axe.setChecked(true);
    if (!a.en_lecture) a.basculer_lecture();
    await a.pret;
    const { ctx, bilan } = fauxContexte();
    const p = new Peintre(ctx);
    const r = new Rect(0, 0, 880, 540);
    a.peindre(p, r);
    for (let i = 0; i < 1000; i++) {
      let x = 440 + (u() - 0.5) * 500,
        y = 270 + (u() - 0.5) * 500;
      a.presser(new Pt(x, y), u() < 0.03 ? 'droit' : 'gauche');
      const n = 1 + Math.floor(u() * 4);
      for (let k = 0; k < n; k++) {
        const dx = (u() - 0.5) * 240,
          dy = (u() - 0.5) * 240;
        x += dx;
        y += dy;
        a.glisser(new Pt(x, y), dx, dy);
        a.battement((0.016 * 4.68) / 1);
      }
      a.relacher(new Pt(x, y));
      if (i % 50 === 0) await new Promise((ok) => setTimeout(ok, 0));
      if (u() < 0.02) a.doubleClic(new Pt(x, y));
      const t0 = bilan.traces;
      a.peindre(p, r);
      expect(rotation_valide(a.globe), `glisser ${i}`).toBe(true);
      expect(bilan.traces - t0, `image ${i}`).toBeGreaterThan(100);
    }
    expect(bilan.nonFinis).toEqual([]);
  });
});

describe('les autres animations : glisser pendant la lecture', () => {
  for (const e of ENTREES) {
    it(e.id, async () => {
      const cls = await charger(e);
      const a = new cls().initialiser();
      if (!a.en_lecture) a.basculer_lecture();
      const { ctx, bilan } = fauxContexte();
      const p = new Peintre(ctx);
      const r = new Rect(0, 0, 800, 520);
      const u = alea(7);
      a.peindre(p, r);
      for (let i = 0; i < 60; i++) {
        let x = u() * 800,
          y = u() * 520;
        a.presser(new Pt(x, y), 'gauche');
        for (let k = 0; k < 3; k++) {
          const dx = (u() - 0.5) * 200,
            dy = (u() - 0.5) * 200;
          x += dx;
          y += dy;
          a.glisser(new Pt(x, y), dx, dy);
          a.battement(0.05);
        }
        a.relacher(new Pt(x, y));
        const t0 = bilan.traces;
        a.peindre(p, r);
        expect(bilan.traces - t0, `${e.id} image ${i}`).toBeGreaterThan(2);
      }
      expect(bilan.nonFinis.slice(0, 3), e.id).toEqual([]);
      for (const [, v] of a.valeurs()) expect(v, e.id).not.toMatch(/NaN|Infinity/);
    });
  }
});
