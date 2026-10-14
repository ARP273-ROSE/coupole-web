/**
 * Orion en 3D, fiches au survol et couleur vraie des étoiles : mêmes calculs que l'application de bureau
 * (tests/references/orion3d_reference.json, produit par Coupole : outils/verif_anim/references_etoiles.py), données
 * cohérentes (distances, directions), vue du ciel = projection gnomonique vue du Soleil, garde-fous (glissers
 * aberrants), fiche jamais par-dessus son objet, et objets à fiche dans les six animations concernées.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import REF from '../references/orion3d_reference.json';
import COULEURS from '../references/couleurs_reference.json';
import * as O from '../../src/calc/orion3d';
import { accentuer, couleur_etoile, rayon_disque } from '../../src/calc/couleur_etoile';
import { charger_fiches, toutes_les_fiches } from '../../src/anim/fiches';
import { contenu_fiche } from '../../src/anim/fiche_texte';
import { placer_fiche } from '../../src/app/fiche_flottante';
import { charger, ENTREES } from '../../src/anim/registre';
import { choisirLangue, type Langue, toutCharger } from '../../src/i18n/i18n';
import { Peintre, Pt, Rect } from '../../src/noyau/peintre';
import { fauxContexte } from './faux_canvas';
import { Choix, Coche, Reglage } from '../../src/anim/base';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = REF as any;
const proche = (a: number, b: number, tol = 1e-9): boolean => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

beforeAll(async () => {
  await toutCharger();
  await charger_fiches();
});

describe('géométrie d’Orion en 3D (mêmes nombres que le bureau)', () => {
  it('caméras et projections', () => {
    for (const c of R.cameras) {
      const cam = O.camera(...(c.args as [O.Cible, O.Cible, number, number, number, number, number, number]));
      for (const k of ['F', 'cx', 'cy', 'D'] as const) expect(proche(cam[k], c.camera[k]), `${k} ${c.args}`).toBe(true);
      for (const k of ['oeil', 'droite', 'haut', 'avant'] as const) cam[k].forEach((v, i) => expect(proche(v, c.camera[k][i], 1e-9)).toBe(true));
      const pts = O.DONNEES.etoiles.filter((_, i) => i % 7 === 0).map((e) => O.projeter(cam, O.deplier(e.xyz, c.args[3])));
      pts.forEach((q, i) => {
        const r = c.projections[i];
        if (r === null) expect(q).toBeNull();
        else q!.forEach((v, j) => expect(proche(v, r[j], 1e-8), `${c.args} ${i}`).toBe(true));
      });
    }
  });

  it('coquille d’Orion (Foley et al. 2023) : milieu de la corde', () => {
    const dirs: [number, number][] = [[80, -4], [88, 0], [85, -10], [78, 5]];
    dirs.forEach(([ra, dec], i) => O.point_coquille(O.direction(ra, dec), O.DONNEES.icrs_vers_gal).forEach((v, j) => expect(proche(v, R.coquille[i][j])).toBe(true)));
  });

  it('données : |xyz| = distance, direction = (α, δ), matrice galactique orthonormée', () => {
    for (const e of O.DONNEES.etoiles) {
      expect(Math.abs(O.norme(e.xyz) - e.d), e.id).toBeLessThan(0.02);
      const u = O.unitaire(e.xyz);
      const d = O.direction(e.ra, e.dec);
      expect(Math.acos(Math.min(1, O.dot(u, d))), e.id).toBeLessThan(1e-3);
      if (e.xyz_affichage) expect(Math.abs(O.norme(e.xyz_affichage) - e.d_affichage!)).toBeLessThan(0.02);
    }
    const M = O.DONNEES.icrs_vers_gal;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) expect(Math.abs(O.dot(M[i]!, M[j]!) - (i === j ? 1 : 0))).toBeLessThan(1e-9);
    // témoins : Rigel, Bételgeuse, Bellatrix, θ¹ Ori C, Tabit (distances retenues du jeu de données)
    const d = Object.fromEntries(O.DONNEES.etoiles.map((e) => [e.id, e.d]));
    expect(d['bet_ori']).toBeCloseTo(264.55, 2);
    expect(d['alf_ori']).toBeCloseTo(168.1, 1);
    expect(d['gam_ori']).toBeCloseTo(77.4, 1);
    expect(d['tet01_ori_c']).toBe(388);
    expect(d['pi_03_ori']).toBeCloseTo(8.07, 2);
  });

  it('vue du ciel : œil au Soleil, perspective = gnomonique (nord en haut, est à gauche)', () => {
    const cam = O.camera('orion', 'orion', 1, 0, 0, 0, 800, 600);
    expect(O.norme(cam.oeil)).toBeLessThan(1e-9);
    const P = O.direction(83, 0);
    const a = O.projeter(cam, O.comb(P, 100, [0, 0, 0], 0))!;
    const b = O.projeter(cam, O.comb(P, 700, [0, 0, 0], 0))!;
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(1e-9);
    const nord = O.projeter(cam, O.comb(O.direction(83, 5), 400, [0, 0, 0], 0))!;
    const est = O.projeter(cam, O.comb(O.direction(88, 0), 400, [0, 0, 0], 0))!;
    expect(nord[1]).toBeLessThan(a[1]);
    expect(est[0]).toBeLessThan(a[0]);
    // en 3D, deux étoiles sur des lignes de visée voisines se séparent selon leur distance
    const c3 = O.camera('orion', 'orion', 1, 1, 0, 0, 800, 600);
    const rigel = O.DONNEES.etoiles.find((e) => e.id === 'bet_ori')!;
    const tabit = O.DONNEES.etoiles.find((e) => e.id === 'pi_03_ori')!;
    const q1 = O.projeter(c3, rigel.xyz)!;
    const q2 = O.projeter(c3, tabit.xyz)!;
    expect(Math.abs(q1[0] - q2[0])).toBeGreaterThan(100);
  });
});

describe('fiches au survol', () => {
  it('toutes valides (noms, catégorie) et rendues sans valeur manquante, FR et EN', () => {
    const F = toutes_les_fiches();
    expect(Object.keys(F).length).toBeGreaterThan(300);
    for (const lg of ['fr', 'en'] as Langue[]) {
      choisirLangue(lg);
      for (const [id, f] of Object.entries(F)) {
        expect(f.id).toBe(id);
        expect(['etoile', 'nebuleuse']).toContain(f.categorie);
        expect(f.noms.fr && f.noms.en, id).toBeTruthy();
        const c = contenu_fiche(f, lg);
        const tout = JSON.stringify([c.titre, c.sous_titre, c.lignes, c.resume]);
        expect(tout, id).not.toMatch(/NaN|undefined|null/);
        expect(c.lignes.length, id).toBeGreaterThan(0);
        expect(c.resume.length).toBeGreaterThan(3);
      }
    }
    choisirLangue('fr');
  });

  it('même contenu que le bureau (FR et EN)', () => {
    for (const lg of ['fr', 'en'] as Langue[]) {
      choisirLangue(lg);
      for (const [id, attendu] of Object.entries(R.fiches[lg] as Record<string, { titre: string; sous_titre: string; lignes: { libelle: string; valeur: string; source: string }[]; resume: string }>)) {
        const c = contenu_fiche(toutes_les_fiches()[id]!, lg);
        expect(c.titre, id).toBe(attendu.titre);
        expect(c.sous_titre, id).toBe(attendu.sous_titre);
        expect(c.resume, id).toBe(attendu.resume);
        expect(c.lignes.map((l) => [l.libelle, l.valeur, l.source]), id).toEqual(attendu.lignes.map((l) => [l.libelle, l.valeur, l.source]));
      }
    }
    choisirLangue('fr');
  });

  it('la fiche n’est jamais posée sur son objet (et suit le bureau)', () => {
    for (const { entree, sortie } of R.placements as { entree: number[]; sortie: number[] }[]) {
      const [x, y, r, w, h, W, H] = entree as [number, number, number, number, number, number, number];
      const [bx, by] = placer_fiche(x, y, r, w, h, W, H);
      expect(proche(bx, sortie[0]!) && proche(by, sortie[1]!)).toBe(true);
      // quand un côté au moins laisse la place, la boîte ne touche pas l'objet
      const d = r + 10;
      const place = x + d + w <= W - 4 || x - d - w >= 4 || y + d + h <= H - 4 || y - d - h >= 4;
      if (place && w <= W - 8 && h <= H - 8) {
        const cx = Math.max(bx, Math.min(bx + w, x));
        const cy = Math.max(by, Math.min(by + h, y));
        expect(Math.hypot(cx - x, cy - y)).toBeGreaterThanOrEqual(r + 2 - 1e-9);
      }
    }
  });
});

describe('couleur vraie des étoiles', () => {
  it('table CIE : à 1 niveau près des valeurs de référence (vérifiées par SageMath)', () => {
    for (const e of (COULEURS as { etoiles: { nom: string; teff_K: number; rgb: number[] }[] }).etoiles) {
      const c = couleur_etoile(e.teff_K);
      c.forEach((v, i) => expect(Math.abs(v - e.rgb[i]!), e.nom).toBeLessThanOrEqual(1));
    }
    const [r1, g1, b1] = couleur_etoile(3600);
    expect(r1 > g1 && g1 > b1).toBe(true);
    const [r2, , b2] = couleur_etoile(12000);
    expect(b2).toBeGreaterThan(r2);
    // accentuée : plus saturée, même teinte dominante ; finie partout
    const a = accentuer(couleur_etoile(3600));
    expect(a[0] - a[2]).toBeGreaterThan(r1 - b1);
    for (const t of [NaN, -5, 0, 1e9]) expect(couleur_etoile(t).every(Number.isFinite)).toBe(true);
    expect(rayon_disque(NaN)).toBe(1.2);
  });
});

describe('animations à fiches', () => {
  const avec: [string, number][] = [['orion3d', 50], ['bigdipper', 7], ['dipperclock', 1], ['celhorcomp', 3], ['hrexplorer', 0], ['heliacalrisingsim', 0]];
  for (const [id, mini] of avec) {
    it(`${id} : objets à fiche, fiches connues, ordre du clavier`, async () => {
      const e = ENTREES.find((x) => x.id === id)!;
      const cls = await charger(e);
      expect(cls.FICHES).toBe(true);
      const a = new cls().initialiser();
      if (id === 'hrexplorer') (a.defauts.get('groupe')![0] as Choix).setCurrentIndex(3);
      if (id === 'dipperclock') (a.defauts.get('heure')![0] as Reglage).setValue(23);
      const { ctx } = fauxContexte();
      a.peindre(new Peintre(ctx), new Rect(0, 0, 900, 640));
      // lever héliaque : l'étoile n'a de fiche que du côté visible de la sphère ; on tourne la vue jusqu'à la voir
      for (let i = 0; i < 12 && !a.survolables.length && a._vues[0]; i++) {
        a._vues[0][1].tourner(60, 0, 1);
        a.peindre(new Peintre(ctx), new Rect(0, 0, 900, 640));
      }
      expect(a.survolables.length, id).toBeGreaterThanOrEqual(Math.max(1, mini));
      const F = toutes_les_fiches();
      for (const o of a.survolables) {
        expect(F[o.fiche], o.fiche).toBeDefined();
        expect([o.x, o.y, o.r].every(Number.isFinite)).toBe(true);
      }
      const ord = a.objets_ordonnes();
      for (let i = 1; i < ord.length; i++) expect(ord[i]!.ordre).toBeGreaterThanOrEqual(ord[i - 1]!.ordre);
      const o = a.survolables[0]!;
      expect(a.objet_sous(new Pt(o.x + 0.5, o.y - 0.5))?.fiche).toBeDefined();
      expect(a.objet_sous(new Pt(-500, -500))).toBeNull();
    });
  }
});

describe('Orion en 3D : garde-fous', () => {
  it('1 000 glissers aberrants, tous les réglages, transitions : jamais de valeur non finie dessinée', async () => {
    const cls = await charger(ENTREES.find((x) => x.id === 'orion3d')!);
    const a = new cls().initialiser();
    const { ctx, bilan } = fauxContexte();
    const p = new Peintre(ctx);
    const r = new Rect(0, 0, 820, 560);
    let graine = 7;
    const hasard = (): number => ((graine = (graine * 16807) % 2147483647) / 2147483647);
    const aberrants = [NaN, Infinity, -Infinity, 1e12, -1e12, 0];
    for (let i = 0; i < 1000; i++) {
      a.peindre(p, r);
      if (i % 50 === 0) {
        for (const [, [w]] of a.defauts) {
          if (w instanceof Reglage) w.setValue(w.mini + hasard() * (w.maxi - w.mini));
          else if (w instanceof Coche) w.setChecked(hasard() < 0.5);
          else if (w instanceof Choix) w.setCurrentIndex(Math.floor(hasard() * w.count()));
        }
      }
      a.presser(new Pt(hasard() * 820, hasard() * 560), 'gauche');
      const dx = i % 9 === 0 ? aberrants[i % aberrants.length]! : (hasard() - 0.5) * 300;
      const dy = i % 11 === 0 ? aberrants[(i + 3) % aberrants.length]! : (hasard() - 0.5) * 300;
      a.glisser(new Pt(hasard() * 820, hasard() * 560), dx, dy);
      a.relacher(new Pt(0, 0));
      a.pas(0.05 + hasard() * 0.3);
    }
    a.peindre(p, r);
    expect(bilan.nonFinis.slice(0, 5)).toEqual([]);
    expect(a.survolables.length).toBeGreaterThan(0);
    for (const v of a.valeurs()) expect(v[1]).not.toMatch(/NaN|Infinity|undefined/);
  });

  it('boutons « vue 3D » puis « vue du ciel » : le dépliement va et revient, la lecture s’arrête seule', async () => {
    const cls = await charger(ENTREES.find((x) => x.id === 'orion3d')!);
    const a = new cls().initialiser();
    const dep = a.defauts.get('depliement')![0] as Reglage;
    const b3d = a.controles.find((c) => c.cle === 'anim_orion3d_b_3d') as unknown as { click(): void };
    b3d.click();
    expect(a.en_lecture).toBe(true);
    for (let i = 0; i < 40 && a.en_lecture; i++) a.battement(0.1);
    expect(dep.value()).toBe(100);
    expect(a.en_lecture).toBe(false);
    (a.controles.find((c) => c.cle === 'anim_orion3d_b_ciel') as unknown as { click(): void }).click();
    for (let i = 0; i < 40 && a.en_lecture; i++) a.battement(0.1);
    expect(dep.value()).toBe(0);
  });
});
