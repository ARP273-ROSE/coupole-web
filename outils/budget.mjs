/**
 * Budget de poids du site construit (dist/) :
 *  - première page (HTML, script d'entrée et ses imports statiques, feuille de style, textes du catalogue des deux
 *    langues, police préchargée) < 150 Ko compressés (gzip) ;
 *  - chaque animation dans son propre fichier, chargé à la demande.
 * Usage : node outils/budget.mjs   (après npm run build)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const LIMITE = 150 * 1024;
const gz = (f) => gzipSync(readFileSync(join(DIST, f)), { level: 9 }).length;

const html = readFileSync(join(DIST, 'index.html'), 'utf-8');
const premiers = new Set(['index.html']);
for (const m of html.matchAll(/(?:src|href)="\.?\/?([^"]+\.(?:js|css|woff2))"/g)) premiers.add(m[1]);

// imports statiques du script d'entrée (morceaux partagés chargés tout de suite)
const ajouterImports = (f) => {
  const code = readFileSync(join(DIST, f), 'utf-8');
  for (const m of code.matchAll(/(?:^|[;\s])import\s*(?:[\w${}\s,*]+from\s*)?["']\.\/([^"']+\.js)["']/g)) {
    const g = 'assets/' + m[1];
    if (!premiers.has(g)) {
      premiers.add(g);
      ajouterImports(g);
    }
  }
};
for (const f of [...premiers]) if (f.endsWith('.js')) ajouterImports(f);
const assets = readdirSync(join(DIST, 'assets'));
for (const a of assets) if (/^catalogue\.(fr|en)-.*\.js$/.test(a)) premiers.add('assets/' + a);

let total = 0;
for (const f of [...premiers].sort()) {
  const t = f.endsWith('.woff2') ? readFileSync(join(DIST, f)).length : gz(f);
  total += t;
  console.log(`${(t / 1024).toFixed(1).padStart(7)} Ko  ${f}`);
}
console.log(`${(total / 1024).toFixed(1).padStart(7)} Ko  première page (limite ${LIMITE / 1024} Ko)`);

const animations = assets.filter((a) => /\.js$/.test(a));
const sources = readdirSync('src/anim/animations').filter((f) => f.endsWith('.ts'));
const manquantes = sources.filter((s) => !animations.some((a) => a.startsWith(s.replace(/\.ts$/, '') + '-')));
console.log(`${sources.length} animations, ${sources.length - manquantes.length} dans leur propre fichier`);

let ok = true;
if (total > LIMITE) {
  console.error('ÉCHEC : la première page dépasse le budget');
  ok = false;
}
if (manquantes.length) {
  console.error('ÉCHEC : animations sans fichier propre : ' + manquantes.join(', '));
  ok = false;
}
process.exit(ok ? 0 : 1);
