/**
 * « Gravité et orbites » de bout en bout (3 moteurs × 3 formats) : la recherche « gravity and orbits » la trouve en
 * premier, le module Renaissance la propose ; glisser la Terre sans avoir donné le focus à la toile (souris ou doigt),
 * lecture, période mesurée, vue « à l'échelle » atteinte en douceur puis plus aucune image au repos, durée d'une image.
 * Aucune erreur, aucune requête externe.
 */
import { expect, type Page, test } from '@playwright/test';

const ORIGINE = 'http://localhost:4173';
const WEBKIT_SELECT = /^(console|CSP): Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive/;

async function surveiller(page: Page): Promise<{ erreurs: string[]; externes: string[] }> {
  const webkit = page.context().browser()?.browserType().name() === 'webkit';
  const erreurs: string[] = [];
  const externes: string[] = [];
  page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    const x = (m.type() === 'error' ? 'console: ' : '') + m.text();
    if ((m.type() === 'error' || /Content[- ]Security[- ]Policy/i.test(m.text())) && !(webkit && WEBKIT_SELECT.test(x))) erreurs.push(x);
  });
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(ORIGINE) && !u.startsWith('data:') && !u.startsWith('blob:')) externes.push(u);
  });
  return { erreurs, externes };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('coupole-web:langue')) localStorage.setItem('coupole-web:langue', JSON.stringify('fr'));
    localStorage.setItem('coupole-web:installation', JSON.stringify({ visites: 0, utilise: 0, plusTard: 0, jamais: true }));
    const w = window as unknown as { __raf: number };
    w.__raf = 0;
    const o = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (f) => {
      w.__raf++;
      return o(f);
    };
  });
});

async function valeur(page: Page, cle: string): Promise<string> {
  return page.evaluate((c) => {
    const dts = [...document.querySelectorAll('dl.valeurs dt')];
    const dt = dts.find((d) => d.textContent?.trim() === c);
    return dt?.nextElementSibling?.textContent?.trim() ?? '';
  }, cle);
}

/** Position de la Terre (scénario Soleil et Terre) en pixels de la page, d'après le panneau posé (data-titres). */
async function terre(page: Page): Promise<{ x: number; y: number }> {
  const toile = page.locator('.scene canvas');
  await expect.poll(async () => (await toile.getAttribute('data-titres')) ?? '').toContain('Modèle');
  const t = JSON.parse((await toile.getAttribute('data-titres'))!)[0];
  const bb = (await toile.boundingBox())!;
  const [px, py, pw, ph] = t.panneau as number[];
  const hTitre = (t.boite as number[])[3]! / 0.95;
  const r = { x: px + 8, y: py + 10 + hTitre, w: pw - 16, h: ph - 18 - hTitre };
  const L = 0.44 * Math.min(r.w, r.h);
  return { x: bb.x + r.x + r.w / 2 + L * 0.999997, y: bb.y + r.y + r.h / 2 };
}

test('recherche « gravity and orbits » : l’animation en premier ; module Renaissance', async ({ page }) => {
  const s = await surveiller(page);
  await page.goto('./#/recherche?q=gravity%20and%20orbits');
  const premier = page.locator('.groupe-ressources[data-genre="animation"] a').first();
  await expect(premier).toContainText('Gravité et orbites');
  await page.goto('./#/m/renaissance/animations');
  await expect(page.locator('a[href*="#/a/gravityorbits"]').first()).toBeVisible();
  expect(s.erreurs).toEqual([]);
  expect(s.externes).toEqual([]);
});

test('glisser la Terre (sans focus préalable), lecture, période, vue à l’échelle, repos', async ({ page, browserName }) => {
  const s = await surveiller(page);
  await page.goto('./#/a/gravityorbits');
  const toile = page.locator('.scene canvas');
  await expect.poll(() => valeur(page, 'Distance Terre–Soleil')).toMatch(/^1,0000 ua/);
  // le focus est ailleurs (champ de la vitesse) : le glisser doit marcher quand même
  await page.getByRole('button', { name: 'Réinitialiser' }).first().focus();
  const p = await terre(page);
  const mobile = !!test.info().project.use.hasTouch;
  if (mobile && browserName !== 'firefox') {
    // doigt : appui, glisser, relâcher (événements de pointeur tactiles)
    await toile.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: p.x, clientY: p.y, isPrimary: true, buttons: 1 });
    for (let i = 1; i <= 6; i++) await toile.dispatchEvent('pointermove', { pointerId: 7, pointerType: 'touch', clientX: p.x - 6 * i, clientY: p.y, isPrimary: true, buttons: 1 });
    await toile.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: p.x - 36, clientY: p.y, isPrimary: true });
  } else {
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(p.x - 6 * i, p.y);
    await page.mouse.up();
  }
  await expect.poll(() => valeur(page, 'Distance Terre–Soleil')).not.toMatch(/^1,0000 ua/);
  // « Réinitialiser » puis lecture à vitesse ×10 : la Terre fait un tour, période ≈ 365,26 j
  await page.goto('./#/a/gravityorbits?vitesse=10');
  await expect.poll(() => valeur(page, 'Distance Terre–Soleil')).toMatch(/^1,0000 ua/);
  await page.getByRole('button', { name: 'Lecture' }).first().click();
  await expect.poll(() => valeur(page, 'Période mesurée (Terre)'), { timeout: 30_000 }).toMatch(/^365,2\d j/);
  await expect.poll(() => toile.getAttribute('data-ms'), { timeout: 30_000 }).not.toBeNull();
  const ms = Number((await toile.getAttribute('data-ms'))!.split(' ')[0]);
  test.info().annotations.push({ type: 'durée de rendu (ms)', description: String(ms) });
  // ≤ 5 ms par image (Chromium, en local) ; en intégration continue (rendu logiciel) : garde-fou ×5
  expect(ms).toBeLessThan((browserName === 'chromium' ? 5 : 15) * (process.env.CI ? 5 : 1));
  await page.getByRole('button', { name: 'Pause' }).first().click();
  // vue à l'échelle : la Terre et la Lune ne font qu'un point ; passage en douceur, puis plus aucune image
  await page.getByRole('combobox', { name: /Scénario/ }).selectOption({ label: 'Soleil, Terre et Lune' });
  await page.getByRole('combobox', { name: /^Vue/ }).selectOption({ label: 'À l’échelle' });
  await expect.poll(async () => (await toile.getAttribute('aria-label')) ?? '').toContain('À l’échelle');
  // le passage (0,9 s, plus long sur une machine chargée) se termine, puis plus aucune image n'est demandée
  const images = async (ms: number): Promise<number> => {
    const r0 = await page.evaluate(() => (window as unknown as { __raf: number }).__raf);
    await page.waitForTimeout(ms);
    return (await page.evaluate(() => (window as unknown as { __raf: number }).__raf)) - r0;
  };
  await expect.poll(() => images(600), { timeout: 20_000, intervals: [0] }).toBeLessThanOrEqual(1);
  expect(await images(1200)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `test-results/captures/${test.info().project.name}-gravite-echelle.png` });
  expect(s.erreurs).toEqual([]);
  expect(s.externes).toEqual([]);
});
