/**
 * Captures du README (docs/captures/*.webp) depuis le site construit servi par `npm run preview`.
 * Usage : npm run build && npm run preview &  node outils/captures_readme.mjs
 * puis conversion en WebP : python3 -c "from PIL import Image; …" (ou cwebp), PNG supprimés.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const B = 'http://localhost:4173/';
const OUT = 'docs/captures';
mkdirSync(OUT, { recursive: true });
const vues = [
  ['accueil', '#/', 1280, 800, 'sombre'],
  ['question', '#/m/intro/q/ca_intro_scale', 1280, 800, 'clair'],
  ['anticythere', '#/a/antikythera', 1280, 800, 'sombre'],
  ['orion', '#/a/orion3d', 1280, 800, 'sombre'],
  ['telephone', '#/m/lunarcycles', 390, 844, 'clair'],
];
const b = await chromium.launch();
for (const [nom, h, w, ht, theme] of vues) {
  const ctx = await b.newContext({ viewport: { width: w, height: ht }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  await ctx.addInitScript((t) => {
    localStorage.setItem('coupole-web:langue', '"fr"');
    localStorage.setItem('coupole-web:theme', JSON.stringify(t));
  }, theme);
  const p = await ctx.newPage();
  await p.goto(B + h);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/${nom}.png` });
  await ctx.close();
}
await b.close();
