/**
 * Calculateurs de TD (0.6.2) : rubrique dans la navigation, calculateur « Parallaxe (TP du cours) » : exemple ISS
 * et Lune, pas-à-pas, dessin, saisie fautive dite, export du détail ; aucune erreur dans la console.
 */
import { expect, test } from '@playwright/test';

test('Parallaxe (TP du cours) : exemple, pas-à-pas, dessin, export', async ({ page }, info) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));
  page.on('console', (m) => {
    // WebKit signale en console les styles de ses propres listes déroulantes refusés par la politique de sécurité
    // (sans effet sur l'affichage, comme dans site.spec.ts)
    if (m.type() === 'error' && !/celestrak|Refused to apply a stylesheet/i.test(m.text())) erreurs.push(m.text());
  });
  await page.goto('./#/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('./#/td');
  await expect(page.locator('h1')).toHaveText(/Calculateurs de TD|Course calculators/);
  await page.locator('a.carte-td').first().click();
  await expect(page).toHaveURL(/#\/td\/parallaxe/);
  await page.getByRole('button', { name: /^(Exemple|Example)$/ }).click();
  const etapes = page.locator('.td-etapes li');
  await expect(etapes).toHaveCount(6);
  await expect(etapes.nth(4)).toContainText(/419,99|419\.99/);
  const pixels = await page.locator('canvas.td-schema').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    const vus = new Set<number>();
    for (let i = 0; i < d.length; i += 4 * 97) vus.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
    return vus.size;
  });
  expect(pixels).toBeGreaterThan(8);
  await page.screenshot({ path: `test-results/captures/td-iss-${info.project.name}.png`, fullPage: true });
  await page.locator('#td-cible').selectOption('lune');
  await page.getByRole('button', { name: /^(Exemple|Example)$/ }).click();
  await expect(page.locator('.td-etapes li')).toHaveCount(7);
  await expect(page.locator('.td-etapes')).toContainText(/Meeus/);
  const telechargement = page.waitForEvent('download');
  await page.getByRole('button', { name: /Exporter le détail|Export the details/ }).click();
  expect((await telechargement).suggestedFilename()).toBe('parallaxe_tp.csv');
  await page.locator('#td-p1').fill('48°61′ N 2 E');
  await page.getByRole('button', { name: /^(Calculer|Calculate)$/ }).click();
  await expect(page.locator('.td-etat')).toContainText('≥ 60');
  expect(erreurs).toEqual([]);
});
