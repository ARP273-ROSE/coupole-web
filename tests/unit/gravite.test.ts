/**
 * « Gravité et orbites » : mécanique (src/calc/gravite.ts) au bit près comme le bureau (tests/references/gravite_cas.json,
 * produit par outils/cas_gravite.py de Coupole), contrôles physiques (périodes de la Terre et de la Lune à 0,5 % près des
 * vraies, conservation de l'énergie et du moment cinétique, mouvement rectiligne sans gravité, collision), accord avec
 * l'intégration indépendante de SageMath (tests/references/gravite_orbites_sage.json), puis l'animation : réglages,
 * glisser (astre, satellite, flèche de vitesse, ruban), retour, vues, encart, durée d'une image.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import * as g from '../../src/calc/gravite';
import { GraviteOrbites, sci } from '../../src/anim/animations/gravite_orbites';
import { choisirLangue, toutCharger } from '../../src/i18n/i18n';
import { Peintre, Pt, Rect } from '../../src/noyau/peintre';
import { titresPoses } from '../../src/noyau/dessin';
import { fauxContexte } from './faux_canvas';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lire = (f: string): any => JSON.parse(readFileSync(join(__dirname, '..', 'references', f), 'utf8'));
const CAS = lire('gravite_cas.json');
const SAGE = lire('gravite_orbites_sage.json');
const JOUR = g.JOUR;

/** float.hex() de Python → nombre */
function dehex(s: string): number {
  const m = /^(-)?0x([01])\.([0-9a-f]+)p([+-]\d+)$/.exec(s);
  if (!m) {
    if (s === '0x0.0p+0') return 0;
    if (s === '-0x0.0p+0') return -0;
    throw new Error('hex ' + s);
  }
  const mant = parseInt(m[2]!, 16) + parseInt(m[3]!, 16) / 16 ** m[3]!.length;
  const v = mant * 2 ** Number(m[4]);
  return m[1] ? -v : v;
}

beforeAll(async () => {
  await toutCharger();
});

describe('mécanique : identique au bureau, au bit près', () => {
  for (const [nom, cas] of Object.entries(CAS) as [g.Scenario, any][]) {
    it(nom, () => {
      const s = new g.Systeme(g.scenario(nom), dehex(cas.pas_trace));
      const etat = (): unknown[] => s.corps.map((c) => [c.nom, c.m, c.x, c.y, c.vx, c.vy, c.actif]);
      const attendu = (e: unknown[][]): unknown[] => e.map((c) => [c[0], ...c.slice(1, 6).map((x) => dehex(x as string)), c[6]]);
      expect(etat()).toEqual(attendu(cas.depart));
      for (const [k, e] of cas.etapes.entries()) {
        s.corps[0]!.m = g.MASSES[s.corps[0]!.nom]! * e.masse;
        if (s.gravite !== e.gravite) {
          s.gravite = e.gravite;
          s.remesurer();
        }
        s.avancer(dehex(e.duree));
        expect(s.t, `${nom} ${k} t`).toBe(dehex(e.t));
        expect(etat(), `${nom} ${k}`).toEqual(attendu(e.etat));
        expect(s.corps.map((_, i) => s.periode(i)), `${nom} ${k} périodes`).toEqual(e.periodes.map((x: string | null) => (x === null ? null : dehex(x))));
        expect(s.derives(), `${nom} ${k} dérives`).toEqual(e.derives.map(dehex));
        const kc = s.courbureLune();
        expect(kc, `${nom} ${k} courbure`).toBe(e.courbure === null ? null : dehex(e.courbure));
        expect(s.traces.map((t) => t.x.length)).toEqual(e.n_traces);
        expect(s.derniersPas).toBe(e.pas);
      }
    });
  }
});

describe('physique', () => {
  it('constantes : masses et ua comme SageMath (CODATA 2018, UAI 2015 B3, DE440, NASA)', () => {
    expect(g.G).toBe(SAGE.constantes.G);
    expect(g.UA).toBe(SAGE.constantes.ua);
    for (const [k, m] of Object.entries(SAGE.constantes.masses as Record<string, number>)) expect(Math.abs(g.MASSES[k]! - m) / m, k).toBeLessThan(1e-15);
  });

  it('états initiaux comme SageMath (même recette, calcul indépendant à 120 bits)', () => {
    for (const [nom, sc] of Object.entries(SAGE.scenarios as Record<string, { etat_initial_si: [string, number, number, number, number][] }>)) {
      const cs = g.scenario(nom as g.Scenario);
      for (const [i, [n, x, y, vx, vy]] of sc.etat_initial_si.entries()) {
        const c = cs[i]!;
        expect(c.nom).toBe(n);
        for (const [a, b] of [[c.x, x], [c.y, y], [c.vx, vx], [c.vy, vy]] as [number, number][]) {
          const echelle = Math.max(Math.abs(b), (Math.abs(x) + Math.abs(y)) * 1e-6, 1);
          expect(Math.abs(a - b) / echelle, `${nom} ${n}`).toBeLessThan(1e-12);
        }
      }
    }
  });

  it('période de la Terre ≈ 365,25 j et de la Lune ≈ 27,3 j à 0,5 % près ; accord avec l’intégration de SageMath', () => {
    const verifs: [g.Scenario, number, string, number][] = [
      ['soleil_terre', 800, 'terre', 365.256363],
      ['soleil_terre_lune', 800, 'terre', 365.256363],
      ['soleil_terre_lune', 800, 'lune', 27.321661],
      ['terre_lune', 120, 'lune', 27.321661],
    ];
    for (const [sc, jours, corps, vraie] of verifs) {
      const s = new g.Systeme(g.scenario(sc), JOUR);
      for (let k = 0; k < jours; k++) s.avancer(JOUR);
      const i = s.corps.findIndex((c) => c.nom === corps);
      const T = s.periode(i)! / JOUR;
      expect(Math.abs(T - vraie) / vraie, `${sc} ${corps} ${T}`).toBeLessThan(0.005);
      const ts = SAGE.scenarios[sc].periodes_j[corps];
      expect(Math.abs(T - ts) / ts, `${sc} ${corps} Sage ${ts}`).toBeLessThan(2e-6);
    }
    // station spatiale : période de Kepler de son orbite circulaire (92,87 min), et comète (a = 1,5 ua)
    const s = new g.Systeme(g.scenario('terre_iss'), 10);
    for (let k = 0; k < 60; k++) s.avancer(600);
    expect(Math.abs(s.periode(1)! / 60 - SAGE.kepler_j.iss_min) / SAGE.kepler_j.iss_min).toBeLessThan(1e-5);
    const l = new g.Systeme(g.scenario('libre'), JOUR);
    for (let k = 0; k < 1500; k++) l.avancer(JOUR);
    expect(Math.abs(l.periode(3)! / JOUR - SAGE.scenarios.libre.periodes_j.comete) / 671).toBeLessThan(1e-5);
  });

  it('énergie et moment cinétique conservés (Soleil, Terre, Lune sur 10 ans, à vitesse ×10)', () => {
    const s = new g.Systeme(g.scenario('soleil_terre_lune'), JOUR);
    // pas d'images à vitesse maximale : 10 × 5 jours par seconde, 60 images par seconde
    const duree = (10 * 5 * JOUR) / 60;
    let pire = 0;
    for (let k = 0; k < (3650 * JOUR) / duree; k++) {
      s.avancer(duree);
      pire = Math.max(pire, s.derives()[0]);
    }
    expect(pire).toBeLessThan(1e-9);
    expect(s.derives()[1]).toBeLessThan(1e-12);
    // la Lune est toujours liée à la Terre et la courbure de sa trajectoire vue du Soleil reste positive
    expect(s.courbureMin).toBeGreaterThan(0.4);
    expect(s.courbureMax).toBeLessThan(1.6);
    expect(SAGE.lune_concave.rapport).toBeGreaterThan(2);
  });

  it('sans gravité : mouvement rectiligne uniforme', () => {
    const s = new g.Systeme(g.scenario('terre_lune'), JOUR);
    s.gravite = false;
    const l0 = { ...s.corps[1]! };
    s.avancer(5 * JOUR);
    const l1 = s.corps[1]!;
    expect(l1.vx).toBe(l0.vx);
    expect(l1.vy).toBe(l0.vy);
    expect(Math.abs(l1.x - (l0.x + l0.vx * 5 * JOUR))).toBeLessThan(1e-6);
    expect(Math.abs(l1.y - (l0.y + l0.vy * 5 * JOUR))).toBeLessThan(1e-3);
  });

  it('collision : la Lune sans vitesse tombe sur la Terre et s’y écrase, quantité de mouvement gardée', () => {
    const cs = g.scenario('terre_lune');
    cs[1]!.vx = cs[1]!.vy = 0;
    g.recentrer(cs);
    const s = new g.Systeme(cs, JOUR);
    const px = (): number => s.corps.reduce((a, c) => a + (c.actif ? c.m * c.vx : 0), 0);
    for (let k = 0; k < 10 && !s.collisions.length; k++) s.avancer(JOUR);
    expect(s.collisions.map((c) => [c.corps, c.sur])).toEqual([['lune', 'terre']]);
    expect(s.corps[1]!.actif).toBe(false);
    expect(Math.abs(px())).toBeLessThan(1e-3 * g.MASSES.lune!);
    // chute libre depuis 384 400 km : un peu moins de 5 jours
    expect(s.collisions[0]!.t / JOUR).toBeGreaterThan(4.5);
    expect(s.collisions[0]!.t / JOUR).toBeLessThan(5);
  });

  it('retour : l’état du départ revient exactement', () => {
    const s = new g.Systeme(g.scenario('soleil_terre'), JOUR);
    const e = s.instantane();
    s.avancer(100 * JOUR);
    s.restaurer(e);
    expect(s.corps.map((c) => [c.x, c.y, c.vx, c.vy])).toEqual(e.corps.map((c) => [c.x, c.y, c.vx, c.vy]));
    expect(s.t).toBe(0);
  });

  it('écriture scientifique', () => {
    choisirLangue('fr');
    expect(sci(-2.6501e33, 4)).toBe('−2,650 × 10³³');
    expect(sci(1.4e-14, 1)).toBe('1 × 10⁻¹⁴');
    expect(sci(9.96e-3, 2)).toBe('1,0 × 10⁻²');
    expect(sci(0, 1)).toBe('0');
    choisirLangue('en');
    expect(sci(3.5e8, 2)).toBe('3.5 × 10⁸');
    choisirLangue('fr');
  });
});

describe('animation', () => {
  const R = new Rect(0, 0, 900, 600);
  const peindre = (a: GraviteOrbites, r = R): void => {
    const { ctx } = fauxContexte();
    a.peindre(new Peintre(ctx), r);
  };
  const ecran = (a: GraviteOrbites, nom: string): Pt => {
    // position dessinée d'un corps : on la retrouve en cherchant l'objet saisi au clic
    const L = 0.44 * Math.min(R.w - 16, R.h - 10 - 13 * 1.21 - 8);
    void L;
    const i = a.sys.corps.findIndex((c) => c.nom === nom);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [X, Y] = (a as any).versEcran(...(a as any).posDessin(i));
    return new Pt(X, Y);
  };

  it('glisser un astre le déplace (la Lune suit la Terre), le temps est suspendu pendant la saisie', () => {
    const a = new GraviteOrbites({ scenario: 'soleil_terre_lune' }).initialiser();
    peindre(a);
    const t = { ...a.sys.corps[1]! },
      l = { ...a.sys.corps[2]! };
    const dl = [l.x - t.x, l.y - t.y];
    const p = ecran(a, 'terre');
    expect(a.presser(p, 'gauche')).toBe(true);
    a.glisser(new Pt(p.x - 40, p.y + 30), -40, 30);
    a.avancer(1);
    expect(a.sys.t).toBe(0);
    a.relacher(new Pt(p.x - 40, p.y + 30));
    const t2 = a.sys.corps[1]!,
      l2 = a.sys.corps[2]!;
    expect(t2.x).toBeLessThan(t.x);
    expect(l2.x - t2.x).toBeCloseTo(dl[0]!, 0);
    expect(l2.y - t2.y).toBeCloseTo(dl[1]!, 0);
    // « Retour » revient à cet état modifié
    const x2 = t2.x;
    a.avancer(3);
    expect(a.sys.t).toBeGreaterThan(0);
    a.retour();
    expect(a.sys.corps[1]!.x).toBe(x2);
  });

  it('tirer le bout de la flèche verte change la vitesse', () => {
    const a = new GraviteOrbites({ scenario: 'soleil_terre', vecteurs_vitesse: true }).initialiser();
    peindre(a);
    const t = a.sys.corps[1]!;
    const v0 = t.vy;
    const p = ecran(a, 'terre');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [tx, ty] = (a as any).boutVitesse(1, p.x, p.y);
    expect(a.presser(new Pt(tx, ty), 'gauche')).toBe(true);
    a.glisser(new Pt(tx, ty - 40), 0, -40);
    a.relacher(new Pt(tx, ty - 40));
    expect(a.sys.corps[1]!.vy).toBeGreaterThan(v0 * 1.2);
  });

  it('ruban de mesure : ses bouts se déplacent, il mesure la vraie distance', () => {
    const a = new GraviteOrbites({ scenario: 'terre_lune', ruban: true }).initialiser();
    peindre(a);
    const v = Object.fromEntries(a.valeurs());
    expect(v['Ruban de mesure']).toBe('384\u202f400 km');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [X, Y] = (a as any).versEcran(a.ruban[2], a.ruban[3]);
    expect(a.presser(new Pt(X, Y), 'gauche')).toBe(true);
    a.glisser(new Pt(X + 50, Y), 50, 0);
    a.relacher(new Pt(X + 50, Y));
    expect(a.ruban[2]).toBeGreaterThan(g.A_LUNE * 1.1);
  });

  it('vues : à l’échelle, la Terre et la Lune vues du Soleil ne font qu’un point ; en modèle, deux astres', () => {
    const a = new GraviteOrbites({ scenario: 'soleil_terre_lune', mode: 'echelle' }).initialiser();
    peindre(a);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = a as any;
    const [tx, ty] = b.versEcran(...b.posDessin(1));
    const [lx, ly] = b.versEcran(...b.posDessin(2));
    expect(Math.hypot(tx - lx, ty - ly)).toBeLessThan(2);
    expect(b.rayon(0)).toBeLessThan(3);
    a.c_mode.setCurrentIndex(0);
    peindre(a);
    const [tx2, ty2] = b.versEcran(...b.posDessin(1));
    const [lx2, ly2] = b.versEcran(...b.posDessin(2));
    expect(Math.hypot(tx2 - lx2, ty2 - ly2)).toBeGreaterThan(30);
    expect(b.rayon(0)).toBeGreaterThan(20);
  });

  it('chaque scénario, chaque case, en lecture : image en moins de 5 ms (moyenne), valeurs FR et EN', () => {
    for (const sc of g.SCENARIOS) {
      const a = new GraviteOrbites({ scenario: sc, vecteurs_vitesse: true, grille: true, ruban: true, lune_soleil: true }).initialiser();
      a.vitesse!.setValue(10);
      const { ctx } = fauxContexte();
      const p = new Peintre(ctx);
      // trajectoires pleines : un an (ou cent orbites de l'ISS)
      for (let k = 0; k < 200; k++) a.battement(0.2);
      // meilleure moyenne de 6 séries de 10 images (la suite tourne en parallèle : on écarte la charge passagère)
      let ms = Infinity;
      for (let serie = 0; serie < 6; serie++) {
        const t0 = performance.now();
        for (let k = 0; k < 10; k++) {
          a.battement(1 / 60);
          a.peindre(p, R);
        }
        ms = Math.min(ms, (performance.now() - t0) / 10);
      }
      expect(ms, `${sc} ${ms.toFixed(2)} ms`).toBeLessThan(process.env.CI ? 15 : 5);
      for (const lg of ['fr', 'en'] as const) {
        choisirLangue(lg);
        const v = a.valeurs();
        expect(v.length).toBeGreaterThan(3);
        for (const [k, x] of v) expect(`${k} ${x}`).not.toMatch(/undefined|NaN|anim_/);
      }
      choisirLangue('fr');
    }
  });

  it('le panneau « Lune vue du Soleil » ne recouvre jamais la scène (à côté en paysage, dessous en portrait)', () => {
    for (const sc of ['soleil_terre_lune', 'libre'] as const)
      for (const [w, h] of [[900, 600], [1800, 760], [390, 700], [300, 640], [360, 560]] as [number, number][]) {
        const a = new GraviteOrbites({ scenario: sc, lune_soleil: true }).initialiser();
        for (let k = 0; k < 20; k++) a.battement(0.2);
        peindre(a, new Rect(0, 0, w, h));
        const t = titresPoses();
        expect(t.length, `${sc} ${w}×${h}`).toBe(2);
        const [u, v] = [t[0]!.panneau, t[1]!.panneau];
        const ww = Math.min(u.x + u.w, v.x + v.w) - Math.max(u.x, v.x);
        const hh = Math.min(u.y + u.h, v.y + v.h) - Math.max(u.y, v.y);
        expect(ww > 2 && hh > 2, `${sc} ${w}×${h}`).toBe(false);
        // en portrait, dessous ; en paysage, à côté
        if (h > w * 1.15) expect(v.y).toBeGreaterThan(u.y + u.h * 0.5);
        else expect(v.x).toBeGreaterThan(u.x + u.w * 0.5);
      }
  });

  it('valeurs : période mesurée comparée à la vraie, énergie, moment, courbure', () => {
    const a = new GraviteOrbites({ scenario: 'soleil_terre_lune', lune_soleil: true }).initialiser();
    for (let k = 0; k < 80; k++) a.avancer(1); // 400 jours
    const v = Object.fromEntries(a.valeurs());
    expect(v['Période mesurée (Terre)']).toMatch(/^365,2\d j · vraie : 365,256 j · écart 0,0\d\u202f%$/);
    expect(v['Période mesurée (Lune)']).toMatch(/^27,3\d j · vraie : 27,322 j · écart 0,\d\d\u202f%$/);
    expect(v['Courbure de la Lune vue du Soleil']).toMatch(/^toujours vers le Soleil : de 0,\d\d à 1,\d\d fois celle de la Terre$/);
    expect(v['Énergie totale']).toMatch(/^−2,6\d\d × 10³³ J · variation relative \d × 10⁻[¹²³⁴⁵⁶⁷⁸⁹⁰]+$/);
  });
});
