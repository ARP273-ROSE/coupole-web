/**
 * « Le canon de Newton » de bout en bout (3 moteurs × 3 formats) : la recherche le trouve, le module Renaissance le
 * propose ; gros bouton « Feu ! » dans la barre, touche Espace, repères v₁ et v₂ sous le curseur de vitesse, flèche
 * tirée à la souris ou au doigt, préréglage en un clic, défi réussi, zoom à la molette puis recadrage ; fiche et
 * question liées.  Aucune erreur, aucune requête externe.
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
  });
});

async function valeur(page: Page, cle: string): Promise<string> {
  return page.evaluate((c) => {
    const dts = [...document.querySelectorAll('dl.valeurs dt')];
    const dt = dts.find((d) => d.textContent?.trim().startsWith(c));
    return dt?.nextElementSibling?.textContent?.trim() ?? '';
  }, cle);
}

async function poignees(page: Page): Promise<{ bout: { x: number; y: number }; bouche: { x: number; y: number } }> {
  const toile = page.locator('.scene canvas');
  await toile.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await expect.poll(async () => (await toile.getAttribute('data-poignees')) ?? '').not.toBe('');
  const [[bx, by], [cx, cy]] = JSON.parse((await toile.getAttribute('data-poignees'))!) as number[][];
  const bb = (await toile.boundingBox())!;
  return { bout: { x: bb.x + bx!, y: bb.y + by! }, bouche: { x: bb.x + cx!, y: bb.y + cy! } };
}

test('recherche et module : le canon de Newton est trouvé et proposé', async ({ page }) => {
  const s = await surveiller(page);
  await page.goto('./#/recherche?q=canon%20de%20newton');
  await expect(page.locator('.groupe-ressources[data-genre="animation"] a').first()).toContainText('canon de Newton');
  await page.goto('./#/m/renaissance/animations');
  await expect(page.locator('a[href*="#/a/newtoncannon"]').first()).toBeVisible();
  await page.goto('./#/r/fiche/renaissance_canon_newton');
  await expect(page.locator('#contenu h1').first()).toContainText('canon de Newton');
  await page.goto('./#/m/renaissance/q/co_renaissance_canon_liberation');
  await expect(page.locator('#contenu')).toContainText('multiplier');
  expect(s.erreurs).toEqual([]);
  expect(s.externes).toEqual([]);
});

test('Feu, Espace, repères, flèche, préréglage, défi, zoom', async ({ page }) => {
  test.setTimeout(180_000);
  const s = await surveiller(page);
  await page.goto('./#/a/newtoncannon');
  await expect.poll(() => valeur(page, 'À l’altitude du canon')).toContain('v₁ = 7,84');
  // repères v₁ et v₂ sous le curseur de vitesse
  const reperes = page.locator('.reglage:not([hidden]) .reperes .repere');
  await expect(reperes).toHaveCount(2);
  await expect(reperes.first()).toHaveText('v₁');
  // gros bouton « Feu ! » dans la barre
  const feu = page.locator('.transport .bouton.geste');
  await expect(feu).toHaveText('Feu !');
  await feu.click();
  await expect.poll(() => valeur(page, 'Tir 1'), { timeout: 20_000 }).toMatch(/impact/);
  // Espace sur la toile : deuxième tir
  await page.locator('.scene canvas').focus();
  await page.keyboard.press('Space');
  await expect.poll(() => valeur(page, 'Tir 2')).not.toBe('');
  // la flèche : glisser son bout règle angle et vitesse
  const { bout, bouche } = await poignees(page);
  const mobile = !!test.info().project.use.hasTouch;
  const cible = { x: bouche.x + 60, y: bouche.y - 60 };
  if (mobile && test.info().project.name.startsWith('chromium')) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bout.x, y: bout.y }] });
    for (let k = 1; k <= 8; k++)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: bout.x + ((cible.x - bout.x) * k) / 8, y: bout.y + ((cible.y - bout.y) * k) / 8 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(bout.x, bout.y);
    await page.mouse.down();
    await page.mouse.move(cible.x, cible.y, { steps: 8 });
    await page.mouse.up();
  }
  await expect.poll(() => valeur(page, 'Tir réglé')).toMatch(/angle 4[45],\d°/);
  // préréglage en un clic : orbite de l'ISS, période 92,87 min
  await page.getByRole('button', { name: 'Orbite de l’ISS' }).click();
  await expect.poll(() => valeur(page, 'Période (3ᵉ loi de Kepler)')).toContain('92,87 min');
  // défi « Satellite de Dimorphos » : un tour au ras du sol, accéléré ×1 000
  await page.locator('select').filter({ hasText: 'Satellite de Dimorphos' }).selectOption({ label: 'Satellite de Dimorphos' });
  await page.getByRole('button', { name: 'Tour au ras du sol' }).click();
  await expect.poll(() => valeur(page, 'Défi'), { timeout: 90_000 }).toContain('Réussi');
  // molette : zoom manuel, double-clic : recadrage automatique
  const toile = page.locator('.scene canvas');
  if (!mobile) {
    const bb = (await toile.boundingBox())!;
    const avant = await toile.getAttribute('data-poignees');
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.wheel(0, -400);
    await expect.poll(() => toile.getAttribute('data-poignees')).not.toBe(avant);
    await page.getByRole('button', { name: 'Recadrer' }).click();
  }
  expect(s.erreurs).toEqual([]);
  expect(s.externes).toEqual([]);
});
