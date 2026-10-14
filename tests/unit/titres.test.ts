/** Mise en page des titres de panneaux : jamais plus larges que leur panneau. */
import { describe, expect, it } from 'vitest';
import { mettreEnPageTitre, titreCourt } from '../../src/noyau/dessin';

const mesure = (s: string): number => s.length * 7;

describe('titres de panneaux', () => {
  it('forme courte : sans parenthèses, puis sans sous-titre', () => {
    expect(titreCourt('Système de Copernic (vu du nord)')).toBe('Système de Copernic');
    expect(titreCourt('Système de Ptolémée : épicycle sur le déférent')).toBe('Système de Ptolémée');
    expect(titreCourt('Vénus au télescope (taille apparente à l’échelle)')).toBe('Vénus au télescope');
    expect(titreCourt('Sans rien')).toBe('Sans rien');
  });
  it('entier, sur deux lignes, court, ou coupé par « … » ; toujours dans la largeur', () => {
    const t = 'Vénus au télescope (taille apparente à l’échelle)';
    expect(mettreEnPageTitre(t, 1000, false, mesure)).toEqual({ lignes: [t], abrege: false });
    const deux = mettreEnPageTitre(t, 200, true, mesure);
    expect(deux.lignes.length).toBe(2);
    expect(deux.abrege).toBe(false);
    expect(deux.lignes.join(' ')).toBe(t);
    expect(mettreEnPageTitre(t, 140, false, mesure)).toEqual({ lignes: ['Vénus au télescope'], abrege: true });
    const coupe = mettreEnPageTitre(t, 70, false, mesure);
    expect(coupe.abrege).toBe(true);
    expect(coupe.lignes[0]!.endsWith('…')).toBe(true);
    for (const l of [0, 7, 30, 60, 100, 150, 220, 400])
      for (const n of [true, false])
        for (const x of mettreEnPageTitre(t, l, n, mesure).lignes) expect(mesure(x) <= Math.max(l, 7)).toBe(true);
  });
});
