/**
 * Chaîne proton-proton et cycle CNO : particules légères reconnaissables et assez grandes (rayon ≥ 10 px), étiquettes
 * à taille normale qui ne se chevauchent pas (placeur commun), à tous les instants et à plusieurs tailles.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { FusionCNO, FusionPP, RAYON_MIN_LEPTON } from '../../src/anim/animations/fusion';
import { choisirLangue, toutCharger } from '../../src/i18n/i18n';
import { etiquettesPosees } from '../../src/noyau/dessin';
import { Peintre, Rect } from '../../src/noyau/peintre';
import { fauxContexte } from './faux_canvas';

beforeAll(async () => {
  await toutCharger();
});

function chevauchent(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;
}

describe('fusion : particules et étiquettes lisibles', () => {
  for (const [nom, C] of [['proton-proton', FusionPP], ['CNO', FusionCNO]] as const) {
    it(nom, () => {
      for (const lg of ['fr', 'en'] as const) {
        choisirLangue(lg);
        for (const [w, h] of [[900, 560], [420, 640], [1400, 820]] as const) {
          const a = new C().initialiser();
          a.en_lecture = false;
          let vus = 0;
          for (let t = 0; t < a.etapes.length * 4; t += 0.37) {
            a.t = t;
            a.peindre(new Peintre(fauxContexte().ctx), new Rect(0, 0, w, h));
            for (const [, , , r] of a.leptons) expect(r, `${nom} ${w}×${h} t=${t}`).toBeGreaterThanOrEqual(RAYON_MIN_LEPTON);
            vus += a.leptons.length;
            const b = etiquettesPosees();
            for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) expect(chevauchent(b[i]!, b[j]!), `${nom} ${w}×${h} t=${t.toFixed(2)}`).toBe(false);
          }
          expect(vus).toBeGreaterThan(0);
        }
      }
    });
  }
});
