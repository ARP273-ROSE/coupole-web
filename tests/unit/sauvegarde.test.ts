/**
 * Sauvegarde commune web / bureau : parité avec le portage Python (cas de tests/references/sauvegarde_cas.json, rejoués
 * aussi par tests/test_classe_sauvegarde.py de Coupole), aller-retour export → import, migration de l'ancien format.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as S from '../../src/contenu/sauvegarde';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CAS: { genre: string; entree: any; sortie: any }[] = JSON.parse(readFileSync(join(__dirname, '..', 'references', 'sauvegarde_cas.json'), 'utf8')).cas;
const ex = (s: S.Sauvegarde | null): string | null => (s === null ? null : S.exporter(s));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rejouer(c: { genre: string; entree: any }): unknown {
  const e = c.entree;
  switch (c.genre) {
    case 'migrer':
      return ex(S.migrer(e.brut, e.application));
    case 'importer':
      return ex(S.importer(e.texte, 'app'));
    case 'fusionner':
      return ex(S.fusionner(e.a, e.b));
    case 'reinitialiser':
      return ex(S.reinitialiser(e.s, e.partie));
    case 'bilan':
      return S.bilan(e.s, e.questions);
    case 'etat':
      return S.etatQuestion(e.s, e.qid);
    case 'reglages':
      return JSON.stringify(S.reglagesValides(e.entree));
    case 'operations': {
      const s = S.migrer(e.depart)!;
      const res: unknown[] = [];
      for (const o of e.operations) {
        const f: Record<string, () => unknown> = {
          creer: () => S.creerModule(s, o.nom, o.elements, o.id, o.quand),
          nom_libre: () => S.nomLibre(s, o.base, o.numeroter),
          renommer: () => S.renommerModule(s, o.id, o.nom, o.quand),
          ajouter: () => S.ajouterElement(s, o.id, o.element, o.quand),
          deplacer: () => S.deplacerElement(s, o.id, o.de, o.vers, o.quand),
          retirer: () => S.retirerElement(s, o.id, o.element, o.quand),
          supprimer: () => S.supprimerModule(s, o.id),
          marquer: () => S.marquer(s, o.qid, o.champ, o.v),
          etat: () => S.etatQuestion(s, o.qid),
          tentative: () => S.noterTentative(s, o.qid, o.t),
          bilan: () => S.bilan(s, o.questions),
          est_favori: () => S.estFavori(s, o.genre, o.id),
          ajouter_favori: () => S.ajouterFavori(s, o.genre, o.id, o.quand),
          retirer_favori: () => S.retirerFavori(s, o.genre, o.id),
          basculer_favori: () => S.basculerFavori(s, o.genre, o.id, o.quand),
        };
        const r = f[o.op]!();
        res.push(r === undefined ? null : JSON.parse(JSON.stringify(r)));
      }
      return { resultats: res, final: S.exporter(s) };
    }
  }
  throw new Error(c.genre);
}

describe('sauvegarde', () => {
  it('mêmes résultats que le portage Python (bureau)', () => {
    expect(CAS.length).toBeGreaterThan(30);
    CAS.forEach((c, k) => expect(rejouer(c), `cas ${k} (${c.genre})`).toEqual(c.sortie));
  });

  it('aller-retour exporter → importer', () => {
    for (const c of CAS) if (c.genre === 'migrer' && c.sortie !== null) expect(S.exporter(S.importer(c.sortie, JSON.parse(c.sortie).application)!)).toBe(c.sortie);
  });

  it('ancien format (clés « coupole-web:… ») : réglages et préférences repris', () => {
    const s = S.migrer({ version: 0, reglages: { kepler: { e: 0.5, x: NaN, mauvais_nom$: 1 } }, theme: 'clair', langue: 'en' })!;
    expect(s.animations.kepler!.reglages).toEqual({ e: 0.5 });
    expect(s.preferences).toEqual({ theme: 'clair', langue: 'en' });
  });

  it('version future refusée (rien n’est écrasé), document abîmé toléré', () => {
    expect(S.migrer({ format: S.FORMAT, version: 99 })).toBeNull();
    const s = S.migrer({ format: S.FORMAT, version: 1, questions: { ok: { tentatives: [{ juste: true, reponse: ['A'] }] }, 'mauvais id !': {} }, mes_modules: 'x' })!;
    expect(Object.keys(s.questions)).toEqual(['ok']);
    expect(s.mes_modules).toEqual([]);
    expect(S.importer('pas du json')).toBeNull();
  });

  it('Mes modules : créer, copier, renommer, ajouter, réordonner, retirer, supprimer', () => {
    const s = S.vide();
    const m = S.creerModule(s, S.nomLibre(s, 'Nouveau module', true), [], 'mm_a', '2026-10-14T10:00:00Z');
    expect(m.nom).toBe('Nouveau module 1');
    expect(S.ajouterElement(s, 'mm_a', { genre: 'question', id: 'q1' })).toBe(true);
    expect(S.ajouterElement(s, 'mm_a', { genre: 'question', id: 'q1' })).toBe(false);
    S.ajouterElement(s, 'mm_a', { genre: 'fiche', id: 'f1' });
    S.ajouterElement(s, 'mm_a', { genre: 'animation', id: 'kepler' });
    expect(S.deplacerElement(s, 'mm_a', 2, 0)).toBe(true);
    expect(m.elements.map((e) => e.id)).toEqual(['kepler', 'q1', 'f1']);
    expect(S.renommerModule(s, 'mm_a', '  Séance  ')).toBe(true);
    expect(m.nom).toBe('Séance');
    expect(S.nomLibre(s, 'Séance')).toBe('Séance (2)');
    expect(S.retirerElement(s, 'mm_a', { genre: 'fiche', id: 'f1' })).toBe(true);
    expect(S.supprimerModule(s, 'mm_a')).toBe(true);
    expect(s.mes_modules).toEqual([]);
  });
});
