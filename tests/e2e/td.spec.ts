/**
 * Calculateurs de TD (0.6.2) : rubrique dans la navigation, calculateur « Parallaxe (TP du cours) » : exemple ISS
 * et Lune, pas-à-pas, dessin, saisie fautive dite, export du détail ; aucune erreur dans la console.
 */
import { readFileSync } from 'node:fs';
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

test.describe('TLE', () => {
  // WebKit : les requêtes d'une page tenue par le service worker échappent à page.route ; ici on le coupe
  test.use({ serviceWorkers: 'block' });
test('ISS : TLE récupéré tout seul au calcul (CelesTrak permis par la politique de sécurité), puis hors ligne', async ({ page }) => {
  const ref = JSON.parse(readFileSync(new URL('../references/parallaxe_reference_skyfield.json', import.meta.url), 'utf-8'));
  const c = ref.iss[0];
  const instant = `${c.utc[1][0]}-${String(c.utc[1][1]).padStart(2, '0')}-${String(c.utc[1][2]).padStart(2, '0')} ${String(c.utc[1][3]).padStart(2, '0')}:${String(c.utc[1][4]).padStart(2, '0')}:${c.utc[1][5].toFixed(3).padStart(6, '0')}`;
  let appels = 0;
  let enLigne = true;
  await page.route('https://celestrak.org/**', (r) => {
    appels++;
    if (!enLigne) return r.abort('internetdisconnected');
    return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'text/plain' }, body: 'ISS (ZARYA)\n' + ref.tle.join('\n') + '\n' });
  });
  await page.goto('./#/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('./#/td/parallaxe');
  expect(appels).toBe(0); // rien n'est demandé à l'ouverture
  await page.locator('#td-cible').selectOption('iss');
  await page.getByRole('button', { name: /^(Exemple|Example)$/ }).click();
  await page.locator('#td-instant').fill(instant);
  await page.getByRole('button', { name: /^(Calculer|Calculate)$/ }).click();
  await expect(page.locator('.td-etat')).toContainText('CelesTrak');
  await expect(page.locator('.td-eph textarea')).toHaveValue(/^1 25544/);
  expect(appels).toBe(1);
  // hors ligne : le TLE gardé sert encore, aucune nouvelle requête nécessaire (il est proche de l'instant)
  enLigne = false;
  await page.reload();
  await page.locator('#td-cible').selectOption('iss');
  await page.getByRole('button', { name: /^(Exemple|Example)$/ }).click();
  await page.locator('#td-instant').fill(instant);
  await page.getByRole('button', { name: /^(Calculer|Calculate)$/ }).click();
  await expect(page.locator('.td-etat')).toContainText(/cache/);
  expect(appels).toBe(1);
});
});

test('schéma : molette, pincement aux doigts et « gesturechange » de Safari commandent le zoom', async ({ page }) => {
  await page.goto('./#/td/parallaxe');
  await page.getByRole('button', { name: /^(Exemple|Example)$/ }).click();
  const toile = page.locator('canvas.td-schema');
  const curseur = page.locator('.td-zoom input[type=range]');
  expect(await toile.evaluate((c) => getComputedStyle(c).touchAction)).toBe('pan-y');
  await expect(curseur).toHaveValue('10');
  await toile.dispatchEvent('wheel', { deltaY: -300, deltaMode: 0 });
  await expect.poll(async () => Number(await curseur.inputValue())).toBeGreaterThan(15);
  await toile.dblclick();
  await expect(curseur).toHaveValue('10');
  const bb = (await toile.boundingBox())!;
  const cx = bb.x + bb.width / 2,
    cy = bb.y + bb.height / 2;
  const pt = (type: string, id: number, x: number) =>
    toile.dispatchEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: cy, buttons: 1 });
  await pt('pointerdown', 1, cx - 20);
  await pt('pointerdown', 2, cx + 20);
  await pt('pointermove', 1, cx - 60);
  await pt('pointermove', 2, cx + 60);
  await pt('pointerup', 1, cx - 60);
  await pt('pointerup', 2, cx + 60);
  await expect(curseur).toHaveValue('30');
  await toile.dblclick();
  const empeche = await toile.evaluate((c) => {
    const geste = (type: string, scale: number): Event => {
      const e = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(e, 'scale', { value: scale });
      c.dispatchEvent(e);
      return e;
    };
    const d = geste('gesturestart', 1);
    geste('gesturechange', 4);
    geste('gestureend', 4);
    return d.defaultPrevented;
  });
  expect(empeche).toBe(true);
  await expect(curseur).toHaveValue('40');
});
