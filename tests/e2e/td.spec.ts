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

test.describe('Planificateur de parallaxe', () => {
  test.use({ serviceWorkers: 'block' });
  test('ISS : CelesTrak en panne → ARISS ; créneaux, ciel, détail, agenda ; Lune', async ({ page }, info) => {
    const ref = JSON.parse(readFileSync(new URL('../references/td_planif_reference.json', import.meta.url), 'utf-8'));
    const erreurs: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !/celestrak|503|Refused to apply a stylesheet/i.test(m.text())) erreurs.push(m.text());
    });
    let ariss = 0;
    await page.route('https://celestrak.org/**', (r) => r.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: '' }));
    await page.route('https://live.ariss.org/**', (r) => {
      ariss++;
      return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'text/plain' }, body: 'ISS (ZARYA)\n' + ref.tle.join('\n') + '\n' });
    });
    await page.goto('./#/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('./#/td/planif');
    await page.getByRole('button', { name: /^(Exemple|Example)$/ }).click();
    await page.locator('#pl-debut').fill('2026-11-25');
    await page.locator('#pl-jours').fill('7');
    await page.getByRole('button', { name: /^(Chercher|Search)$/ }).click();
    await expect(page.locator('.pl-tableau tbody tr')).toHaveCount(7);
    expect(ariss).toBe(1);
    await expect(page.locator('.pl-tableau tbody tr').first()).toContainText('28/11/2026');
    await expect(page.locator('.td-detail')).toContainText(/ENTRE|BETWEEN/);
    const telechargement = page.waitForEvent('download');
    await page.getByRole('button', { name: /^(Agenda|Calendar) \(\.ics\)$/ }).click();
    expect((await telechargement).suggestedFilename()).toBe('parallaxe_creneaux.ics');
    await page.locator('.pl-tableau tbody tr').nth(2).click();
    await expect(page.locator('.pl-tableau tbody tr').nth(2)).toHaveClass(/choisi/);
    if (info.project.name.startsWith('chromium')) await page.screenshot({ path: info.outputPath('planif_iss.png'), fullPage: true });
    await page.locator('#pl-cible').selectOption('lune');
    await page.locator('#pl-jours').fill('45');
    await page.getByRole('button', { name: /^(Chercher|Search)$/ }).click();
    await expect(page.locator('.pl-tableau tbody tr').first()).toContainText('Δφ');
    expect(await page.locator('.pl-tableau tbody tr').count()).toBeGreaterThan(5);
    if (info.project.name.startsWith('chromium')) await page.screenshot({ path: info.outputPath('planif_lune.png'), fullPage: true });
    // tendance de l'ISS sur 60 jours : heures indicatives « ± n min », classement par date
    await page.locator('#pl-cible').selectOption('iss');
    await page.locator('#pl-tendance').check();
    await page.locator('#pl-jours').fill('60');
    await page.getByRole('button', { name: /^(Chercher|Search)$/ }).click();
    await expect(page.locator('.pl-tableau tbody tr').last()).toContainText(/± \d+ min/);
    expect(await page.locator('.pl-tableau tbody tr').count()).toBeGreaterThan(20);
    await expect(page.locator('.td-etat')).toContainText(/2 ou 3 jours|2 or 3 days/);
    expect(erreurs).toEqual([]);
  });
});

test.describe('Choisir un lieu', () => {
  test.use({ serviceWorkers: 'block' });
  test('carte et adresse : Nominatim et Open-Meteo simulés, clic sur la carte, champs remplis', async ({ page }, info) => {
    const erreurs: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Refused to apply a stylesheet|tile\.openstreetmap/i.test(m.text())) erreurs.push(m.text());
    });
    const requetes: string[] = [];
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mOsrq6uBwAE+gH+jTvL1gAAAABJRU5ErkJggg==', 'base64');
    await page.route('https://tile.openstreetmap.org/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: png }));
    await page.route('https://nominatim.openstreetmap.org/**', (r) => {
      requetes.push(r.request().url());
      return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
        body: JSON.stringify([{ display_name: "Observatoire, Avenue de l'Observatoire, Paris, France", name: '', lat: '48.8366', lon: '2.3360', address: { city: 'Paris' } }]) });
    });
    await page.route('https://api.open-meteo.com/**', (r) => {
      requetes.push(r.request().url());
      return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: '{"elevation":[62.0]}' });
    });
    await page.goto('./#/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('./#/td/planif');
    await page.locator('#lieu-carte-1').click();
    await expect(page.locator('.lieu-dialogue')).toBeVisible();
    expect(requetes).toEqual([]);                                   // rien n'est envoyé à l'ouverture
    await page.locator('#lieu-adresse').fill("61 avenue de l'Observatoire");
    await page.locator('.lieu-dialogue').getByRole('button', { name: /^(Chercher|Search)$/ }).click();
    await expect(page.locator('.lieu-dialogue .td-etat')).toContainText('62 m');
    await expect(page.locator('.lieu-dialogue .td-etat')).toContainText('48.83660 N, 2.33600 E');
    // un clic au centre de la carte : nouveau lieu, altitude redemandée
    const boite = await page.locator('.lieu-carte').boundingBox();
    await page.mouse.click(boite!.x + boite!.width / 2 + 40, boite!.y + boite!.height / 2);
    await expect(page.locator('.lieu-dialogue .td-etat')).not.toContainText('48.83660 N, 2.33600 E');
    await expect(page.locator('.lieu-dialogue .td-etat')).toContainText('62 m');
    // pincement à deux doigts : écarter zoome d'un cran au moins (tuiles d'un niveau plus fin), resserrer dézoome
    const niveau = (): Promise<number> => page.locator('.lieu-tuiles img').first().getAttribute('src').then((s) => Number(/org\/(\d+)\//.exec(s!)![1]));
    const pincer = (de: number, a: number): Promise<void> => page.evaluate(([de, a]) => {
      const c = document.querySelector('.lieu-carte') as HTMLElement;
      const r = c.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const ev = (t: string, id: number, dx: number): void => {
        c.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', clientX: x + dx, clientY: y, bubbles: true, isPrimary: id === 1 }));
      };
      ev('pointerdown', 1, -de);
      ev('pointerdown', 2, de);
      for (let k = 1; k <= 5; k++) {
        const d = de + ((a - de) * k) / 5;
        ev('pointermove', 1, -d);
        ev('pointermove', 2, d);
      }
      ev('pointerup', 1, -a);
      ev('pointerup', 2, a);
    }, [de, a]);
    const z0 = await niveau();
    const avant = await page.locator('.lieu-dialogue .td-etat').textContent();
    await pincer(30, 130);
    await expect.poll(niveau).toBeGreaterThan(z0);
    await pincer(130, 30);
    await expect.poll(niveau).toBe(z0);
    await expect(page.locator('.lieu-dialogue .td-etat')).toHaveText(avant!);   // un pincement ne pose pas de lieu
    if (info.project.name.startsWith('chromium')) await page.screenshot({ path: info.outputPath('lieu.png') });
    await page.getByRole('button', { name: /^(Utiliser ce lieu|Use this place)$/ }).click();
    await expect(page.locator('.lieu-dialogue')).toHaveCount(0);
    await expect(page.locator('#pl-p1')).toHaveValue(/^48\.83\d+ N, 2\.3\d+ E$/);
    await expect(page.locator('#pl-alt1')).toHaveValue('62');
    await expect(page.locator('#pl-nom1')).toHaveValue('Paris');
    expect(requetes.length).toBe(3);
    expect(erreurs).toEqual([]);
  });
});
