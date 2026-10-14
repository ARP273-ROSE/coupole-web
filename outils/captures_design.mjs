// Captures de chaque type de page (avant/après une passe de design) : node outils/captures_design.mjs PREFIXE (site servi sur :4173)
import { chromium } from '@playwright/test';
const PREF = process.argv[2] || 'avant';
const OUT = process.env.OUT || 'test-results/captures-design';
const B = 'http://127.0.0.1:4173/';
const pages = {
  accueil: '#/', catalogue: '#/animations', module: '#/m/intro', module_anim: '#/m/intro/animations',
  question: '#/m/intro/q/ca_intro_scale', fiche: '#/r/fiche/ancientastro_eratosthene', table: '#/r/table/densities',
  image: '#/r/image/startrails', mesmodules: '#/mes-modules', progression: '#/progression', apropos: '#/apropos',
  recherche: '#/recherche?q=parallaxe', animation: '#/a/seasonsim', anim_lourde: '#/a/orion3d', vide: '#/recherche?q=zzzzqq', erreur: '#/r/fiche/inexistante',
};
const formats = { w320: [320, 640, 2], w390: [390, 844, 2], w1440: [1440, 900, 1], w3840: [3840, 2160, 1] };
const sel = (process.env.PAGES || '').split(',').filter(Boolean);
const b = await chromium.launch();
for (const [f, [w, hh, dpr]] of Object.entries(formats)) {
  for (const theme of ['sombre', 'clair']) {
    if (f === 'w3840' && theme === 'clair') continue;
    const ctx = await b.newContext({ viewport: { width: w, height: hh }, deviceScaleFactor: dpr, colorScheme: theme === 'clair' ? 'light' : 'dark' });
    await ctx.addInitScript((t) => { localStorage.setItem('coupole-web:langue', '"fr"'); localStorage.setItem('coupole-web:theme', JSON.stringify(t)); }, theme);
    const p = await ctx.newPage();
    for (const [nom, url] of Object.entries(pages)) {
      if (sel.length && !sel.includes(nom)) continue;
      if (f === 'w3840' && !['accueil', 'module', 'question', 'animation'].includes(nom)) continue;
      await p.goto(B + url); await p.waitForTimeout(nom.startsWith('anim') ? 2500 : 900);
      await p.screenshot({ path: `${OUT}/${PREF}_${nom}_${f}_${theme}.png`, fullPage: f !== 'w3840' && f !== 'w1440' ? false : false });
    }
    await ctx.close();
  }
}
await b.close();
