/**
 * Captures d'écran du manifeste (public/screenshots/*.webp) : la boîte d'installation « riche » de Chrome les montre
 * (une large pour l'ordinateur, une étroite pour le téléphone).
 * Usage : npm run build && npm run preview &  node outils/captures_manifeste.mjs   (puis conversion WebP, voir bas)
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const B = 'http://localhost:4173/';
const vues = [
  ['large-accueil', '#/', 1280, 800, 1, 'sombre'],
  ['large-bibliotheque', '#/bibliotheque/animations', 1280, 800, 1, 'sombre'],
  ['etroite-accueil', '#/', 360, 740, 2, 'sombre'],
  ['etroite-animation', '#/a/eclipticsimulator', 360, 740, 2, 'sombre'],
];
const b = await chromium.launch();
for (const [nom, h, w, ht, dpr, theme] of vues) {
  const ctx = await b.newContext({ viewport: { width: w, height: ht }, deviceScaleFactor: dpr, serviceWorkers: 'block' });
  await ctx.addInitScript((t) => {
    localStorage.setItem('coupole-web:langue', '"fr"');
    localStorage.setItem('coupole-web:theme', JSON.stringify(t));
    localStorage.setItem('coupole-web:installation', JSON.stringify({ visites: 0, utilise: 0, plusTard: 0, jamais: true }));
  }, theme);
  const p = await ctx.newPage();
  await p.goto(B + h);
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `public/screenshots/${nom}.png` });
  await ctx.close();
}
await b.close();
execFileSync('python3', ['-c', `
from PIL import Image
from pathlib import Path
for p in Path('public/screenshots').glob('*.png'):
    Image.open(p).convert('RGB').save(p.with_suffix('.webp'), 'WEBP', quality=72, method=6)
    p.unlink()
`]);
