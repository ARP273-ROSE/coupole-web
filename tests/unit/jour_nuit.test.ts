import { beforeAll, describe, expect, it } from 'vitest';
import { inverse_polaire, JourNuit, latitude_terminateur, nuit_polaire, projection_polaire } from '../../src/anim/animations/jour_nuit';
import { toutCharger } from '../../src/i18n/i18n';
import { etiquettesPosees } from '../../src/noyau/dessin';
import { Peintre, Rect } from '../../src/noyau/peintre';
import { fauxContexte } from './faux_canvas';

beforeAll(async () => {
  await toutCharger();
});

describe('vue polaire du simulateur jour-nuit', () => {
  it('projection azimutale équidistante et son inverse', () => {
    for (const pole of [1, -1] as const)
      for (const bord of [0, -pole * 30])
        for (const lon0 of [0, 37.5, -120])
          for (let lat = pole === 1 ? bord : -90; lat <= (pole === 1 ? 90 : bord); lat += 7.5)
            for (let lon = -180; lon < 180; lon += 22.5) {
              const [x, y] = projection_polaire(lat, lon, pole, bord, lon0);
              expect(Math.hypot(x, y)).toBeLessThanOrEqual(1 + 1e-12);
              const [la, lo] = inverse_polaire(x, y, pole, bord, lon0);
              expect(la).toBeCloseTo(lat, 9);
              if (Math.abs(lat) < 89.999) expect(Math.abs(((lo - lon + 540) % 360) - 180)).toBeLessThan(1e-9);
            }
    // le pôle au centre, le bord sur le cercle unité, le méridien lon0 en bas (Nord) / en haut (Sud)
    expect(projection_polaire(90, 10, 1)).toEqual([0, 0]);
    expect(Math.hypot(...projection_polaire(0, 33, 1))).toBeCloseTo(1, 12);
    expect(projection_polaire(0, 50, 1, 0, 50)[1]).toBeCloseTo(1, 12);
    expect(projection_polaire(0, 50, -1, 0, 50)[1]).toBeCloseTo(-1, 12);
    // vu du pôle Nord, l'est tourne dans le sens direct (à droite du méridien du bas)
    expect(projection_polaire(0, 90, 1)[0]).toBeGreaterThan(0.99);
  });

  it('au solstice de juin, le terminateur est tangent au cercle polaire arctique (à minuit) et antarctique', () => {
    const dec = 23.44,
      lon_ss = 30;
    let max = -90,
      lonMax = 0;
    for (let lo = -180; lo <= 180; lo += 0.25) {
      const la = latitude_terminateur(lo, dec, lon_ss);
      if (la > max) [max, lonMax] = [la, lo];
    }
    expect(max).toBeCloseTo(90 - dec, 6);
    expect(Math.abs(((lonMax - (lon_ss + 180) + 540) % 360) - 180)).toBeLessThan(0.3);
    // même chose en coordonnées projetées : la boucle touche le cercle du pôle Nord à 90° − 66,56°
    const { boucle, interieur } = nuit_polaire(dec, lon_ss, 0, 1, 0, lon_ss);
    expect(interieur).toBe(false);
    const rmin = Math.min(...boucle.map(([x, y]) => Math.hypot(x, y)));
    expect(rmin).toBeCloseTo(Math.hypot(...projection_polaire(90 - dec, 0, 1)), 4);
    // le terminateur fixe : son point le plus proche du pôle est en haut (minuit opposé à midi en bas)
    const haut = boucle.reduce((a, b) => (Math.hypot(...b) < Math.hypot(...a) ? b : a));
    expect(haut[1]).toBeLessThan(0);
    // pôle Sud : nuit polaire, la nuit contient le pôle ; boucle tangente au cercle antarctique
    const sud = nuit_polaire(dec, lon_ss, 0, -1, 0, lon_ss);
    expect(sud.interieur).toBe(true);
    expect(Math.min(...sud.boucle.map(([x, y]) => Math.hypot(x, y)))).toBeCloseTo(Math.hypot(...projection_polaire(dec - 90, 0, -1)), 4);
  });

  it('dessin des vues polaires sans erreur, toutes options, en lecture', () => {
    for (const proj of ['nord', 'sud'])
      for (const bord of [0, 30])
        for (const tournant of [false, true]) {
          const a = new JourNuit().initialiser();
          a.projection.setCurrentIndex(a.projection.findData(proj));
          a.bord.setCurrentIndex(a.bord.findData(bord));
          a.c_tournant.setChecked(tournant);
          a.c_crepuscule.setChecked(true);
          expect(a.bord.visible).toBe(true);
          const { ctx, bilan } = fauxContexte();
          const p = new Peintre(ctx);
          for (const [w, h] of [[800, 520], [360, 560]]) {
            for (const jour of [0, 79, 172, 266, 355]) {
              a.jour.setValue(jour);
              a.peindre(p, new Rect(0, 0, w, h));
              a.battement(0.3);
            }
          }
          expect(bilan.nonFinis).toEqual([]);
          expect(etiquettesPosees().length).toBeGreaterThanOrEqual(0);
        }
  });
});

import { appliquer, calotte_visible, orientation, tourner_globe, troncons } from '../../src/anim/animations/jour_nuit';
import { globe_xyz } from '../../src/anim/animations/longitude_latitude';
import { Pt } from '../../src/noyau/peintre';

describe('globe 3D du simulateur jour-nuit', () => {
  it('orientation : le point visé est au centre, le nord en haut, l’est à droite', () => {
    const m = orientation(40, 20);
    const c = appliquer(m, globe_xyz(40, 20));
    expect(c[0]).toBeCloseTo(0, 12);
    expect(c[1]).toBeCloseTo(0, 12);
    expect(c[2]).toBeCloseTo(1, 12);
    expect(appliquer(m, globe_xyz(41, 20))[1]).toBeGreaterThan(0);
    expect(appliquer(m, globe_xyz(40, 21))[0]).toBeGreaterThan(0);
  });

  it('glisser : le point sous le doigt suit le doigt, dans toutes les directions', () => {
    const r = 200;
    for (const [dx, dy] of [[10, 0], [0, 10], [-7, 7], [3, -9]]) {
      const m0 = orientation(10, 50);
      const m1 = tourner_globe(m0, dx, dy, r);
      const q = appliquer(m1, globe_xyz(10, 50));
      // écran : x à droite, y vers le bas ; vue : Y vers le haut
      expect(q[0] * r).toBeCloseTo(dx, 1);
      expect(-q[1] * r).toBeCloseTo(dy, 1);
    }
    // rotation pure : les longueurs sont conservées après beaucoup de glissers
    let m = orientation(0, 0);
    for (let i = 0; i < 500; i++) m = tourner_globe(m, 13, -7, 150);
    const v = appliquer(m, [0.3, -0.5, 0.81]);
    expect(Math.hypot(...v)).toBeCloseTo(Math.hypot(0.3, -0.5, 0.81), 12);
  });

  it('les lignes sont coupées exactement au limbe', () => {
    const pts: [number, number, number][] = [];
    for (let t = 0; t <= 360; t += 5) {
      const a = (t * Math.PI) / 180;
      pts.push([Math.cos(a), 0.3 * Math.sin(a), 0.95 * Math.sin(a)]);
    }
    const tr = troncons(pts.map(([x, y, z]) => {
      const l = Math.hypot(x, y, z);
      return [x / l, y / l, z / l];
    }));
    expect(tr.length).toBe(1);
    const t = tr[0]!;
    expect(Math.hypot(...t[0]!)).toBeCloseTo(1, 12);
    expect(Math.hypot(...t[t.length - 1]!)).toBeCloseTo(1, 12);
    for (const q of t) expect(Math.hypot(...q)).toBeLessThanOrEqual(1 + 1e-12);
  });

  it('nuit et crépuscules : calottes exactes', () => {
    expect(calotte_visible([0, 0, 1], 0).forme).toBe('rien');
    expect(calotte_visible([0, 0, -1], 0).forme).toBe('disque');
    // Soleil sur le côté : la nuit est la moitié opposée du disque, limitée par le terminateur (diamètre vertical)
    const c = calotte_visible([1, 0, 0], 0);
    expect(c.forme).toBe('contour');
    let aire = 0;
    c.contour.forEach((p, i) => {
      const q = c.contour[(i + 1) % c.contour.length]!;
      aire += p[0] * q[1] - q[0] * p[1];
    });
    expect(Math.abs(aire) / 2).toBeCloseTo(Math.PI / 2, 2);
    for (const p of c.contour) expect(p[0]).toBeLessThanOrEqual(1e-9);
    // terminateur incliné : les points intérieurs du contour sont sur le grand cercle p·s = 0
    const s = [0.5, 0.3, Math.sqrt(1 - 0.34)];
    const d = calotte_visible(s, 0);
    for (const [x, y] of d.contour) {
      const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
      if (z > 0.05) expect(Math.abs(x * s[0]! + y * s[1]! + z * s[2]!)).toBeLessThan(1e-9);
    }
    // crépuscule astronomique : la calotte est plus petite que la nuit
    const e = calotte_visible([1, 0, 0], 18);
    for (const [x] of e.contour) expect(x).toBeLessThanOrEqual(-Math.sin((18 * Math.PI) / 180) + 1e-9);
  });

  it('dessin du globe : toutes options, glisser, double-clic, moins de 5 ms par image', () => {
    const a = new JourNuit().initialiser();
    a.projection.setCurrentIndex(a.projection.findData('globe'));
    expect(a.c_axe.visible).toBe(true);
    expect(a.bord.visible).toBe(false);
    a.c_crepuscule.setChecked(true);
    const { ctx, bilan } = fauxContexte();
    const p = new Peintre(ctx);
    const r = new Rect(0, 0, 390, 560);
    a.peindre(p, r);
    const t0 = performance.now();
    for (let i = 0; i < 40; i++) {
      a.presser(new Pt(195, 290), 'gauche');
      a.glisser(new Pt(205, 296), 10, 6);
      a.relacher(new Pt(205, 296));
      a.jour.setValue((i * 9) % 365);
      a.c_tournant.setChecked(i % 2 === 0);
      a.peindre(p, r);
    }
    const ms = (performance.now() - t0) / 40;
    expect(ms).toBeLessThan(5);
    expect(a.doubleClic(new Pt(0, 0))).toBe(true);
    a.peindre(p, r);
    a.presser(new Pt(195, 290), 'droit');
    expect(bilan.nonFinis).toEqual([]);
  });
});
