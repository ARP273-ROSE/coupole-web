/**
 * Trois vues d'un spectre (threeviewsspectra) : l'ordre le long de la visée décide du spectre.  L'ampoule est opaque :
 * vue devant le nuage, elle le cache (spectre continu) ; l'absorption n'existe que si la visée traverse le gaz PUIS
 * l'ampoule.  Le classement est comparé, sur un balayage de tous les angles, à une marche le long du rayon écrite
 * indépendamment ; le télescope et son étiquette restent hors du halo de l'ampoule.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { AMPOULE, Kirchhoff, L_TUBE, NUAGE, R_HALO, R_TELESCOPE, type_de_spectre, vue } from '../../src/anim/animations/kirchhoff';
import { toutCharger } from '../../src/i18n/i18n';
import { etiquettesPosees } from '../../src/noyau/dessin';
import { Peintre, Rect } from '../../src/noyau/peintre';
import { fauxContexte } from './faux_canvas';

beforeAll(async () => {
  await toutCharger();
});

const spectre = (angle: number, cible: string): string => type_de_spectre(vue(angle, cible));

/** Marche le long du rayon par pas de 10⁻³ : le premier objet opaque arrête la visée. */
function marche(angle: number, cible: string): string {
  const a = (angle * Math.PI) / 180;
  const tx = R_TELESCOPE * Math.cos(a),
    ty = R_TELESCOPE * Math.sin(a);
  const [gx, gy] = cible === 'nuage' ? NUAGE : AMPOULE;
  const n = Math.hypot(gx - tx, gy - ty);
  const dx = (gx - tx) / n,
    dy = (gy - ty) / n;
  let gaz = false;
  for (let s = 0; s < 20; s += 1e-3) {
    const x = tx + s * dx,
      y = ty + s * dy;
    if (Math.hypot(x - AMPOULE[0], y - AMPOULE[1]) < AMPOULE[2]) return gaz ? 'absorption' : 'continu';
    if (Math.hypot(x - NUAGE[0], y - NUAGE[1]) < NUAGE[2]) gaz = true;
  }
  return gaz ? 'emission' : 'rien';
}

describe('trois vues d’un spectre : ordre le long de la visée', () => {
  it('télescope à 0°, visant le nuage : l’ampoule est devant et le cache → continu', () => {
    const v = vue(0, 'nuage');
    expect(v.ampoule && v.s_nuage !== null && v.s_ampoule! < v.s_nuage).toBe(true);
    expect(spectre(0, 'nuage')).toBe('continu');
  });
  it('télescope à 180°, visant le nuage : le gaz est devant l’ampoule → absorption', () => {
    expect(spectre(180, 'nuage')).toBe('absorption');
  });
  it('visée de l’ampoule hors du nuage → continu ; nuage seul → émission', () => {
    for (const a of [0, 30, 60, 90, 270, 300, 330]) expect(spectre(a, 'ampoule'), `${a}°`).toBe('continu');
    for (const a of [60, 90, 120, 240, 270, 300]) expect(spectre(a, 'nuage'), `${a}°`).toBe('emission');
  });
  it('balayage de tous les angles (pas de 0,25°), deux cibles : identique à la marche le long du rayon', () => {
    const ecarts: string[] = [];
    for (let i = 0; i < 1440; i++) {
      const a = i * 0.25;
      for (const c of ['nuage', 'ampoule']) {
        const s = spectre(a, c),
          m = marche(a, c);
        if (s !== m) ecarts.push(`${a}° ${c} : ${s} ≠ ${m}`);
      }
    }
    // la marche par pas finis peut manquer une tangence exacte : on tolère quelques angles rasants
    expect(ecarts.length, ecarts.slice(0, 5).join(' ; ')).toBeLessThanOrEqual(4);
  });
  it('cas partiels : l’absorption n’apparaît jamais avec le nuage derrière l’ampoule', () => {
    for (let i = 0; i < 3600; i++) {
      const v = vue(i / 10, 'nuage');
      if (type_de_spectre(v) === 'absorption') expect(v.s_nuage!).toBeLessThan(v.s_ampoule!);
      const w = vue(i / 10, 'ampoule');
      if (type_de_spectre(w) === 'absorption') expect(w.s_nuage!).toBeLessThan(w.s_ampoule!);
    }
  });
  it('le tube du télescope ne touche jamais le halo de l’ampoule', () => {
    expect(R_TELESCOPE - L_TUBE).toBeGreaterThan(AMPOULE[0] + R_HALO);
  });
  it('à 0°, l’étiquette du télescope ne chevauche ni le halo ni l’ampoule (quatre formats)', () => {
    for (const [w, h] of [[800, 520], [360, 560], [1024, 700], [1800, 760]] as [number, number][]) {
      for (const angle of [0, 5, 355, 180, 90]) {
        const a = new Kirchhoff({ position: angle }).initialiser();
        const { ctx } = fauxContexte();
        a.peindre(new Peintre(ctx), new Rect(0, 0, w, h));
        const [cx, cy, k] = (a as unknown as { scene: [number, number, number] }).scene;
        const hx = cx + AMPOULE[0] * k,
          hy = cy,
          rh = R_HALO * k;
        for (const b of etiquettesPosees()) {
          const px = Math.max(b.x, Math.min(hx, b.x + b.w)),
            py = Math.max(b.y, Math.min(hy, b.y + b.h));
          expect(Math.hypot(px - hx, py - hy), `${w}×${h} ${angle}°`).toBeGreaterThan(rh);
        }
      }
    }
  });
});
