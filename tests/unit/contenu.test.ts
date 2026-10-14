/**
 * Contenus (questions, fiches, tables, schémas, images, modules) : intégrité des données importées, moteur des
 * questions identique à la référence Python, schémas sans recouvrement, règle typographique sur tous les textes.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { instancier, jsonCanonique, variantes } from '../../src/contenu/moteur_questions';
import { recouvrements, rendre } from '../../src/contenu/schema_svg';
import { controle } from '../../src/noyau/typographie';
import { ENTREES } from '../../src/anim/registre';

const C = join(__dirname, '..', '..', 'public', 'contenu');
const lire = (...p: string[]) => JSON.parse(readFileSync(join(C, ...p), 'utf-8'));
const MODULES = lire('modules.json').modules as any[];
const MACROS = lire('q', 'macros.json').macros;
const QUESTIONS = new Map<string, any>();
for (const f of readdirSync(join(C, 'q'))) {
  if (!f.endsWith('.json') || ['macros.json', 'couleurs.json', 'images.json'].includes(f)) continue;
  for (const q of lire('q', f).questions) QUESTIONS.set(q.id, q);
}
const LG = ['fr', 'en'] as const;

/** Tous les textes d'un objet bilingue (récursif), par langue. */
const NON_AFFICHES = /^(liens|modules|sources|source|schemas|mots_cles|classaction|statut|questions|animations|fiches|tables|images|verifie|dimensions|octets)$/;
function textes(v: unknown, lg: 'fr' | 'en', out: string[] = [], cle = ''): string[] {
  if (NON_AFFICHES.test(cle)) return out;
  if (typeof v === 'string') {
    if (!/^(id|ref|fichier|url|source_url|licence_url|format|type|t|genre|cle|lien|statut|nature|fond|trait|couleur|ancre|base|mathml|html|resume_html|legende_html|correction_html|notes_html|src)$/.test(cle)) out.push(v);
  } else if (Array.isArray(v)) for (const x of v) textes(x, lg, out, cle);
  else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('fr' in o && 'en' in o && Object.keys(o).length === 2) textes(o[lg], lg, out, cle);
    else for (const [k, x] of Object.entries(o)) textes(x, lg, out, k);
  }
  return out;
}

describe('modules', () => {
  it('22 modules affichés, 2 bonus, ressources existantes', () => {
    expect(MODULES.length).toBe(24);
    expect(MODULES.filter((m) => m.affiche).length).toBe(22);
    const anims = new Set(ENTREES.map((e) => e.id));
    for (const m of MODULES) {
      for (const a of m.animations) expect(anims.has(a), `${m.cle} : animation ${a}`).toBe(true);
      for (const f of m.fiches) expect(existsSync(join(C, 'fiches', f + '.json')), `${m.cle} : fiche ${f}`).toBe(true);
      for (const t of m.tables) expect(existsSync(join(C, 'tables', t + '.json')), `${m.cle} : table ${t}`).toBe(true);
      for (const q of m.questions) {
        expect(q.n).toMatch(/^[WGCD]\d+$/);
        if (q.ok) expect(QUESTIONS.has(q.id), q.id).toBe(true);
      }
    }
  });

  it('ressources liées (★) : toutes existent', () => {
    const rel = lire('relevant.json').questions as Record<string, Record<string, [string, string][]>>;
    const anims = new Set(ENTREES.map((e) => e.id));
    const images = new Set((lire('images', 'images.json').images as any[]).map((i) => i.id));
    for (const [q, r] of Object.entries(rel)) {
      for (const [a] of r.animations ?? []) expect(anims.has(a), `${q} → ${a}`).toBe(true);
      for (const [f] of r.fiches ?? []) expect(existsSync(join(C, 'fiches', f + '.json')), `${q} → ${f}`).toBe(true);
      for (const [t] of r.tables ?? []) expect(existsSync(join(C, 'tables', t + '.json')), `${q} → ${t}`).toBe(true);
      for (const [i] of r.images ?? []) expect(images.has(i), `${q} → ${i}`).toBe(true);
    }
  });
});

describe('moteur des questions', () => {
  it('identique à la référence Python (empreintes des instances)', () => {
    const ref = JSON.parse(readFileSync(join(__dirname, '..', 'references', 'questions', 'banque_empreintes.json'), 'utf-8'));
    let n = 0;
    for (const c of ref.cas) {
      const q = QUESTIONS.get(c.id);
      if (!q) continue;
      const inst = instancier(q, { graine: c.graine, parametres: c.parametres, langue: c.langue, macros: MACROS, hasardParametres: !!c.hasard_parametres });
      const h = createHash('sha256').update(jsonCanonique(inst)).digest('hex');
      expect(h, `${c.id} ${c.graine} ${c.langue} ${JSON.stringify(c.parametres)}`).toBe(c.sha256);
      n++;
    }
    expect(n).toBeGreaterThan(1000);
  });

  it('toutes les variantes de toutes les questions s’instancient (FR, EN), bonnes réponses parmi les choix', () => {
    let n = 0;
    for (const q of QUESTIONS.values()) {
      for (const v of variantes(q).slice(0, 12)) {
        for (const lg of LG) {
          const i = instancier(q, { graine: '7', parametres: v, langue: lg, macros: MACROS });
          if (q.forme === 'qcm') {
            expect(i.bonnes.length, q.id).toBeGreaterThan(0);
            for (const b of i.bonnes) expect(i.choix.map((c: any) => c.id)).toContain(b);
          }
          n++;
        }
      }
    }
    expect(n).toBeGreaterThan(800);
  });

  it('règle typographique : textes affichés des questions (toutes variantes, FR et EN)', () => {
    const fautes: string[] = [];
    for (const q of QUESTIONS.values()) {
      for (const v of variantes(q).slice(0, 12)) {
        for (const lg of LG) {
          const i = instancier(q, { graine: '3', parametres: v, langue: lg, macros: MACROS });
          const t = [i.titre, i.enonce, i.indice, i.explication, ...i.elements_de_reponse, ...i.choix.map((c: any) => c.texte)].filter((x) => typeof x === 'string');
          for (const s of t) {
            const pb = interditsStricts(s.replace(/\*\*/g, ''));
            if (pb.length) fautes.push(`${q.id} (${lg}) : ${pb.join(', ')} — ${s.slice(0, 80)}`);
          }
        }
      }
    }
    expect(fautes.slice(0, 20)).toEqual([]);
  });
});

/** Règle stricte exigée partout : « m/s », « 10^ », « e-11 », « - » comme moins (hors formules $…$). */
export function interditsStricts(s: string): string[] {
  const t = s.replace(/\$[^$]*\$/g, ' ');
  const pb: string[] = [];
  if (/(?<![\p{L}])(k?m|cm|g|W|J|K|pc|kpc|Mpc)\s?\/\s?(s|s²|m²|m³|cm³|K|Mpc)(?![\p{L}])/u.test(t)) pb.push('unité à barre oblique');
  if (/10\^/.test(t)) pb.push('« 10^ »');
  if (/\d[eE][−+-]?\d/.test(t)) pb.push('« e-11 »');
  if (/(?<![\p{L}\p{N}_\-–])-\s?\d/u.test(t) || /\d\s-\s\d/.test(t)) pb.push('« - » comme moins');
  return pb;
}

describe('fiches, tables, images, schémas', () => {
  const fiches = readdirSync(join(C, 'fiches')).map((f) => lire('fiches', f));
  const tables = readdirSync(join(C, 'tables')).map((f) => lire('tables', f));
  const schemas = readdirSync(join(C, 'schemas')).map((f) => lire('schemas', f));
  const images = lire('images', 'images.json').images as any[];

  it('comptes', () => {
    expect(fiches.length).toBeGreaterThanOrEqual(110);
    expect(tables.length).toBeGreaterThanOrEqual(14);
    expect(schemas.length).toBeGreaterThanOrEqual(109);
    expect(images.length).toBeGreaterThanOrEqual(58);
  });

  it('chaque photo a son fichier, son crédit et sa licence', () => {
    for (const i of images) {
      if (i.nature !== 'photo') continue;
      expect(existsSync(join(C, 'images', i.id + '.webp')), i.id).toBe(true);
      expect(String(i.credit?.fr ?? i.credit ?? '').length, i.id).toBeGreaterThan(3);
      expect(String(i.licence ?? '').length, i.id).toBeGreaterThan(3);
    }
  });

  it('règle typographique (textes des fiches, tables, schémas, images ; FR et EN)', () => {
    const fautes: string[] = [];
    for (const [nom, l] of [['fiche', fiches], ['table', tables], ['schéma', schemas], ['image', images]] as const) {
      for (const o of l) for (const lg of LG) for (const s of textes(o, lg)) {
        const pb = [...interditsStricts(s), ...controle(s, lg).filter((x) => !/milliers|virgule|point décimal|« x »/.test(x))];
        if (pb.length) fautes.push(`${nom} ${o.id} (${lg}) : ${pb.join(', ')} — ${s.slice(0, 70)}`);
      }
    }
    expect(fautes.slice(0, 20)).toEqual([]);
  });

  it('schémas : rendu FR et EN sans recouvrement (estimation des chasses)', () => {
    const pb: string[] = [];
    for (const s of schemas) for (const lg of LG) for (const x of recouvrements(s, lg)) pb.push(`${s.id} (${lg}) : ${x}`);
    expect(pb).toEqual([]);
  });

  it('schémas : SVG bien formé, cadre de vue qui contient tous les textes', () => {
    for (const s of schemas) {
      for (const lg of LG) {
        const r = rendre(s, lg);
        expect(r.svg.startsWith('<svg')).toBe(true);
        const [x, y, l, h] = r.vue;
        for (const g of r.geo) if (g.boite) {
          expect(g.boite[0] >= x - 0.5 && g.boite[2] <= x + l + 0.5, `${s.id} ${g.txt}`).toBe(true);
          expect(g.boite[1] >= y - 0.5 && g.boite[3] <= y + h + 0.5, `${s.id} ${g.txt}`).toBe(true);
        }
      }
    }
  });
});
