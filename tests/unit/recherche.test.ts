/**
 * Recherche bilingue : parité avec le moteur Python de Coupole (bureau).  Les cas (tests/references/recherche_cas.json)
 * sont produits par `outils/cas_recherche.py` de Coupole : fonctions unitaires, petit corpus inventé (résultats
 * complets), et vrais contenus (817 documents : l'index est reconstruit ici avec les données du site et doit donner
 * exactement les mêmes 8 premiers résultats et les mêmes points).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as R from '../../src/contenu/recherche';
import { ENTREES, disponible } from '../../src/anim/registre';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CAS: any = JSON.parse(readFileSync(join(__dirname, '..', 'references', 'recherche_cas.json'), 'utf8'));
const C = join(__dirname, '..', '..', 'public', 'contenu');
const lire = (...p: string[]) => JSON.parse(readFileSync(join(C, ...p), 'utf-8'));
const G = join(__dirname, '..', '..', 'src', 'i18n', 'genere');
const TEXTES = { fr: JSON.parse(readFileSync(join(G, 'catalogue.fr.json'), 'utf8')), en: JSON.parse(readFileSync(join(G, 'catalogue.en.json'), 'utf8')) } as Record<'fr' | 'en', Record<string, string>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resume = (r: R.Resultat) => ({ g: r.doc.g, id: r.doc.id, n: r.n, score: r.score, mots: r.mots });

function indexReel(): R.Index {
  const docs = R.documentsDe(lire('recherche.json').entrees, ENTREES.filter(disponible), lire('modules.json').modules, (l, k) => TEXTES[l][k]);
  return new R.Index(docs);
}

describe('recherche : fonctions unitaires identiques au bureau', () => {
  const U = CAS.unitaires;
  it('normaliser, mots, racine, termes, distance', () => {
    for (const [a, b] of U.normaliser) expect(R.normaliser(a), a).toBe(b);
    for (const [a, b] of U.mots) expect(R.mots(a), a).toEqual(b);
    for (const [a, b] of U.racine) expect(R.racine(a), a).toBe(b);
    for (const [a, b] of U.termes) expect(R.termes(a), a).toEqual(b);
    for (const [a, b, k, d] of U.distance) expect(R.distance(a, b, k), `${a}/${b}`).toBe(d);
  });
  it('surligner, extrait', () => {
    for (const [t, mots, attendu] of U.surligner) expect(R.surligner(t, mots)).toEqual(attendu);
    for (const [t, mots, l, attendu] of U.extrait) expect(R.extrait(t, mots, l)).toBe(attendu);
  });
});

describe('recherche : résultats identiques au bureau', () => {
  it('petit corpus : tous les résultats, points et mots trouvés', () => {
    const idx = new R.Index(CAS.corpus.documents);
    for (const [q, attendu] of CAS.corpus.requetes) expect(idx.chercher(q).map(resume), q).toEqual(attendu);
  });

  it('vrais contenus : mêmes 8 premiers résultats (ordre, points, mots)', () => {
    const idx = indexReel();
    expect(idx.docs.length).toBe(CAS.reel.documents);
    expect(idx.vocab.size).toBe(CAS.reel.vocabulaire);
    for (const [q, attendu] of CAS.reel.requetes) expect(idx.chercher(q, 8).map(resume), q).toEqual(attendu);
  });
});

describe('recherche : comportement attendu', () => {
  const idx = indexReel();
  const premiers = (q: string, g: string, n = 3) => idx.chercher(q).filter((r) => r.doc.g === g).slice(0, n).map((r) => r.doc.id);

  it('anglais ou français, même document', () => {
    expect(premiers('seasons', 'animation')).toContain('eclipticsimulator');
    expect(premiers('saisons', 'animation')).toContain('eclipticsimulator');
    expect(premiers('Kepler’s third law', 'animation', 1)).toEqual(['keplers_third']);
    expect(premiers('troisième loi de Kepler', 'animation', 1)).toEqual(['keplers_third']);
    expect(premiers('antikythera', 'animation', 1)).toEqual(['antikythera']);
    expect(premiers('anticythère', 'animation', 1)).toEqual(['antikythera']);
    expect(premiers('Introductory Concepts', 'module', 1)).toEqual(['intro']);
    expect(premiers('notions de base', 'module', 1)).toEqual(['intro']);
  });

  it('accents, casse, pluriels, petites fautes', () => {
    for (const q of ['Rétrograde', 'retrograde', 'RETROGRADES', 'retrogarde']) expect(premiers(q, 'animation', 1), q).toEqual(['retrograde']);
    expect(premiers('kirchoff', 'fiche', 1)).toEqual(premiers('kirchhoff', 'fiche', 1));
    expect(premiers('galaxy', 'module', 2)).toContain('galaxies');
    expect(idx.chercher('xqzwv')).toEqual([]);
  });

  it('titre avant mots-clés avant texte', () => {
    const r = idx.chercher('wien');
    expect(r[0]!.doc.id).toBe('light_blackbody_wien');
  });

  it('rapide : 50 recherches en moins de 2 s', () => {
    const t = performance.now();
    for (let i = 0; i < 50; i++) idx.chercher(['seasons', 'kepler third law', 'paralaxe', 'galaxies', 'phases de la lune'][i % 5]!);
    expect(performance.now() - t).toBeLessThan(2000);
  });
});
