/**
 * « Le canon de Newton » : mécanique (src/calc/canon.ts) comme le bureau (tests/references/canon_cas.json, produit par
 * outils/cas_canon.py de Coupole : sans air, au bit près ; avec air, écart relatif ≤ 10⁻⁹ car exp() peut différer du
 * dernier bit), valeurs de référence de SageMath (tests/references/canon_newton_sage.json), puis l'animation :
 * préréglages, défis, flèche, clavier, zoom, cadrage, durée d'une image.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import * as C from '../../src/calc/canon';
import { CanonNewton } from '../../src/anim/animations/canon_newton';
import { choisirLangue, toutCharger } from '../../src/i18n/i18n';
import { Peintre, Pt, Rect } from '../../src/noyau/peintre';
import { fauxContexte } from './faux_canvas';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lire = (f: string): any => JSON.parse(readFileSync(join(__dirname, '..', 'references', f), 'utf8'));
const CAS = lire('canon_cas.json');
const SAGE = lire('canon_newton_sage.json');

const proche = (a: number, b: number, rel: number): boolean => Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b), 1e-300);
const num = (v: unknown): number => (v === null ? NaN : v === 'inf' ? Infinity : (v as number));

beforeAll(async () => {
  await toutCharger();
});

describe('mécanique du canon, comme le bureau', () => {
  it('éléments de Kepler identiques au bit près', () => {
    for (const c of CAS.elements) {
      const A = C.ASTRES[c.astre]!;
      const [x, y, vx, vy] = C.etat_tir(A.r, c.alt, c.v, c.angle);
      const e = C.elements(A.gm, A.r, x, y, vx, vy);
      for (const k of ['eps', 'h', 'e', 'a', 'rp', 'ra', 'T', 'ex', 'ey', 'r', 'v', 'x_lib']) {
        const a = (e as unknown as Record<string, number>)[k]!;
        const b = num(c.el[k]);
        if (Number.isNaN(b)) expect(Number.isNaN(a)).toBe(true);
        else expect(a).toBe(b);
      }
      expect(e.type).toBe(c.el.type);
    }
  });

  it('trajectoires prévues, préréglages, contextes des défis, densités', () => {
    for (const c of CAS.coniques) {
      const A = C.ASTRES[c.astre]!;
      const [x, y, vx, vy] = C.etat_tir(A.r, c.alt, c.v, c.angle);
      const e = C.elements(A.gm, A.r, x, y, vx, vy);
      const pts = C.conique(e, x, y, A.r, 4 * e.r);
      expect(pts.length).toBe(c.pts.length);
      // cos, sin, atan2, acos : le dernier bit peut différer d'un langage à l'autre
      pts.forEach((p, i) => {
        if (p === null || c.pts[i] === null) {
          expect(p).toBe(c.pts[i]);
          return;
        }
        expect(Math.abs(p[0] - c.pts[i][0])).toBeLessThan(1e-6 * e.r);
        expect(Math.abs(p[1] - c.pts[i][1])).toBeLessThan(1e-6 * e.r);
      });
    }
    for (const [cle, v] of Object.entries(CAS.prereglages)) {
      const i = cle.indexOf('_');
      expect(C.prereglage(cle.slice(i + 1), cle.slice(0, i))).toEqual(v);
    }
    for (const d of C.DEFIS) expect(C.contexte_defi(d) ?? {}).toEqual(CAS.defis[d]);
    for (const [astre, h, rho, H] of CAS.densites) {
      expect(proche(C.densite(astre, h), rho, 1e-15)).toBe(true);
      expect(C.hauteur_echelle(astre, h)).toBe(num(H));
    }
  });

  it('tirs intégrés : mêmes pas, même issue, mêmes nombres (au bit près sans air)', () => {
    for (const c of CAS.tirs) {
      const t = new C.Tir(1, c.astre, c.alt, c.v, c.angle, c.air, c.projectile);
      const tol = c.air ? 1e-9 : 0;
      c.etapes.forEach((e: Record<string, number | string>, i: number) => {
        const k = t.avancer(c.dt);
        const b = t.boulet;
        expect(k).toBe(e['pas']);
        expect(t.etat).toBe(e['etat']);
        expect(t.tours()).toBe(e['tours']);
        expect(t.x.length).toBe(e['n_trace']);
        // état : au bit près sans air ; angle balayé (atan2) et état avec air (exp) : à 10⁻⁹ près
        for (const [a, x] of [[t.t, e['t']], [b.x, e['x']], [b.y, e['y']], [b.vx, e['vx']], [b.vy, e['vy']]] as [number, number][]) {
          if (tol === 0) expect(a).toBe(x);
          else expect(Math.abs(a - x)).toBeLessThanOrEqual(tol * Math.max(Math.abs(x), 1));
        }
        expect(Math.abs(t.phi - (e['phi'] as number))).toBeLessThanOrEqual(1e-9 * Math.max(Math.abs(e['phi'] as number), 1));
        const v = C.DEFIS.map((d) => C.juger(d, t));
        v.forEach((x, j) => {
          expect(x[0]).toBe(c.verdicts[i][j][0]);
          expect(x[1]).toBe(c.verdicts[i][j][1]);
        });
      });
    }
  });
});

describe('valeurs de SageMath', () => {
  it('constantes, vitesses, préréglages, impacts', () => {
    for (const [nom, A] of Object.entries(C.ASTRES)) {
      expect(proche(A.gm, SAGE.astres[nom].gm, 1e-12)).toBe(true);
      expect(proche(A.r, SAGE.astres[nom].r, nom === 'ceres' ? 2e-7 : 1e-15)).toBe(true);
    }
    const p = C.prereglage('iss', 'terre');
    const t = new C.Tir(1, 'terre', p.altitude, p.v, 0);
    for (let i = 0; i < 40; i++) t.avancer(300);
    expect(proche(t.periode()!, SAGE.prereglages.iss.T, 1e-7)).toBe(true);
    const s = SAGE.prereglages.pied_terre;
    const q = C.prereglage('pied', 'terre');
    const u = new C.Tir(1, 'terre', q.altitude, q.v, 0);
    while (u.etat === 'vol') u.avancer(10, 1e7);
    expect(Math.abs(u.angle_balaye_deg() - s.impact_deg)).toBeLessThan(2e-4 * s.impact_deg);
    expect(proche(u.t, s.impact_s, 2e-5)).toBe(true);
    // avec l'air : comme DOP853 à 0,4 % près
    const r = SAGE.air.rentree_capsule;
    const w = new C.Tir(1, 'terre', 200e3, r.v, 0, true, 'capsule');
    while (w.etat === 'vol') w.avancer(120, 1e7);
    expect(proche(w.t, r.impact_s, 4e-3)).toBe(true);
  });
});

// ==================================================================== animation
function peindre(a: CanonNewton, w = 900, h = 640): void {
  const { ctx } = fauxContexte();
  a.peindre(new Peintre(ctx), new Rect(0, 0, w, h));
}

function nouvelle(): CanonNewton {
  const a = new CanonNewton().initialiser();
  peindre(a);
  return a;
}

function jouer(a: CanonNewton, n = 400, dt = 0.5): string {
  for (let i = 0; i < n; i++) {
    a.pas(dt);
    const v = a.verdict()[0];
    if (v === 'reussi' || v === 'echec') break;
  }
  return a.verdict()[0];
}

describe('animation', () => {
  it('feu, préréglages, recommencer, effacer (FR et EN)', () => {
    for (const lg of ['fr', 'en'] as const) {
      choisirLangue(lg);
      const a = nouvelle();
      expect(a.tirs.length).toBe(0);
      a.feu();
      expect(a.en_lecture).toBe(true);
      for (let i = 0; i < 40; i++) a.pas(0.2);
      expect(a.courant()!.etat).toBe('impact');
      for (const nom of C.PREREGLAGES) {
        a.prereglage(nom);
        for (let i = 0; i < 5; i++) a.pas(0.2);
        peindre(a);
      }
      expect(a.astre()).toBe('terre');
      expect(a.c_air.isChecked()).toBe(true);
      a.recommencer();
      expect(a.courant()!.t).toBe(0);
      a.effacer();
      expect(a.tirs.length).toBe(0);
    }
    choisirLangue('fr');
  });

  it('défis réussis et ratés', () => {
    const a = nouvelle();
    const d = a.c_defi;
    const A = C.ASTRES['terre']!;
    d.setCurrentIndex(d.findData('cercle'));
    a.r_vit['terre']!.setValue(C.v_satellisation(A.gm, A.r + 300e3) / 1000);
    a.feu();
    expect(jouer(a)).toBe('reussi');
    d.setCurrentIndex(d.findData('liberation'));
    const L = C.ASTRES['lune']!;
    a.r_vit['lune']!.setValue((C.v_liberation(L.gm, L.r + 10e3) / 1000) * 1.01);
    a.feu();
    expect(jouer(a, 2000, 1)).toBe('reussi');
    d.setCurrentIndex(d.findData('au_dessus'));
    a.r_vit['terre']!.setValue(C.v_satellisation(A.gm, A.r + 60e3) / 1000);
    a.feu();
    expect(jouer(a)).toBe('echec');
    a.r_alt['terre']!.setValue(150);
    a.r_vit['terre']!.setValue(C.v_satellisation(A.gm, A.r + 150e3) / 1000);
    a.feu();
    expect(jouer(a)).toBe('reussi');
    d.setCurrentIndex(d.findData('antipodes'));
    a.r_angle.setValue(10);
    a.r_vit['terre']!.setValue(7.93);
    a.feu();
    expect(jouer(a)).toBe('reussi');
    d.setCurrentIndex(d.findData('dimorphos'));
    expect(a.c_temps.currentData()).toBe(1000);
    a.prereglage('ras_sol');
    expect(jouer(a)).toBe('reussi');
  });

  it('flèche à tirer, clavier, zoom, recadrage', () => {
    const a = nouvelle();
    const [tx, ty] = a.bout();
    const [X, Y] = a.bouche();
    expect(a.presser(new Pt(tx, ty), 'gauche')).toBe(true);
    a.glisser(new Pt(X + 100, Y - 100), 0, 0);
    a.relacher(new Pt(X + 100, Y - 100));
    expect(Math.abs(a.r_angle.value() - 45)).toBeLessThan(0.06);
    expect(a.touche(' ', false)).toBe(true);
    expect(a.tirs.length).toBe(1);
    const v0 = a.r_vit['terre']!.value();
    expect(a.touche('ArrowUp', false)).toBe(true);
    expect(a.r_vit['terre']!.value()).toBeGreaterThan(v0);
    expect(a.touche('a', false)).toBe(false);
    const s0 = a.cam.s;
    expect(a.zoomer_vue(1.44, new Pt(450, 320))).toBe(true);
    peindre(a);
    expect(a.manuel).not.toBeNull();
    expect(proche(a.cam.s, s0 * 1.44, 1e-6)).toBe(true);
    expect(a.doubleClic(new Pt(10, 10))).toBe(true);
    expect(a.manuel).toBeNull();
  });

  it('le cadrage suit le boulet ; une image en moins de 20 ms', () => {
    const a = nouvelle();
    a.prereglage('hyperbole');
    for (let i = 0; i < 80; i++) {
      a.pas(1);
      peindre(a);
      const b = a.courant()!.boulet;
      const [X, Y] = a.versEcran(b.x, b.y);
      const r = a.panneau;
      expect(X).toBeGreaterThanOrEqual(r.x - 1);
      expect(X).toBeLessThanOrEqual(r.x + r.w + 1);
      expect(Y).toBeGreaterThanOrEqual(r.y - 1);
      expect(Y).toBeLessThanOrEqual(r.y + r.h + 1);
    }
    for (const nom of ['pied', 'ras_sol', 'ellipse', 'liberation', 'rentree', 'iss', 'ras_sol']) {
      a.prereglage(nom);
      for (let i = 0; i < 30; i++) a.pas(0.3);
    }
    let meilleur = Infinity;
    for (let k = 0; k < 6; k++) {
      const t0 = performance.now();
      for (let i = 0; i < 5; i++) peindre(a);
      meilleur = Math.min(meilleur, (performance.now() - t0) / 5);
    }
    expect(meilleur).toBeLessThan(20);
  });
});

describe('aimant des repères v₁ et v₂', () => {
  it('glisser près de v₁ ou v₂ donne la valeur exacte ; un pas du clavier en sort', async () => {
    const { Reglage } = await import('../../src/anim/base');
    const r = new Reglage('v', 'flux', 'v', 0, 16, 5, 2, 'km·s⁻¹');
    const v1 = 7.899_2, v2 = 11.171_2;
    r.poser_reperes([[v1, 'v₁', 'accent2'], [v2, 'v₂', 'accent3']]);
    r.depuisCurseur(r.pos(v1) - 1 + 0); // départ loin : on glisse depuis 5 km/s
    expect(r.value()).toBe(v1);
    r.depuisCurseur(r.pos(5)); // repart loin
    r.depuisCurseur(r.pos(v2) - 3);
    expect(r.value()).toBe(v2);
    r.depuisCurseur(r.pos(v2) + 1); // pas du clavier : quitte le repère
    expect(r.value()).not.toBe(v2);
    expect(r.aimanter(9.5)).toBe(9.5);
    expect(r.aimanter(v1 + 0.03)).toBe(v1);
  });
});

describe('aperçu d’une ellipse qui dépasse 4 rayons', () => {
  it('10,06 km·s⁻¹ à 1 km : ellipse entière, refermée sur le canon', () => {
    const A = C.ASTRES.terre!;
    const [x, y, vx, vy] = C.etat_tir(A.r, 1000, 10060, 0);
    const e = C.elements(A.gm, A.r, x, y, vx, vy);
    const pts = C.conique(e, x, y, A.r, C.limite_apercu(e));
    expect(pts.includes(null)).toBe(false);
    const fin = pts[pts.length - 1]!;
    expect(Math.hypot(fin[0] - x, fin[1] - y)).toBeLessThan(1e-3 * e.r);
  });
});
