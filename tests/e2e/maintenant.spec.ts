/**
 * « Maintenant », « En direct », « Ma position » (0.6.0) et glisser toujours actif sur la toile.
 * Fuseaux émulés (timezoneId) et horloge figée (page.clock) : changement d'heure du 25 octobre 2026 à Paris, fuseaux
 * exotiques (Auckland +13, St John's −2:30, Katmandou +5:45), jour de l'an.  Glisser : après avoir touché un réglage,
 * fait défiler le panneau, ou laissé un doigt « perdu » (pointeur jamais relâché), la vue tourne toujours.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';

async function ouvrir(browser: Browser, tz: string, iso: string, h = '#/a/daylightsimulator', geo = false): Promise<Page> {
  const ctx = await browser.newContext({ timezoneId: tz, viewport: { width: 1280, height: 900 }, ...(geo ? { geolocation: { latitude: -36.85, longitude: 174.76 }, permissions: ['geolocation'] } : {}) });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(iso) });
  await page.addInitScript(() => {
    localStorage.setItem('coupole-web:langue', JSON.stringify('fr'));
    localStorage.setItem('coupole-web:installation', JSON.stringify({ visites: 0, utilise: 0, plusTard: 0, jamais: true }));
  });
  await page.goto('./' + h);
  await expect(page.getByRole('button', { name: 'Maintenant' })).toBeVisible({ timeout: 20_000 });
  return page;
}

const champ = (page: Page, libelle: string) => page.locator('.reglage', { has: page.locator('label', { hasText: libelle }) }).locator('input[type="text"]');

test.describe('Maintenant : fuseaux et heures d’été', () => {
  test.beforeEach(({ browserName }, info) => test.skip(!info.project.name.endsWith('bureau'), `un format par moteur (${browserName})`));

  test('Paris, 25 octobre 2026 : 02:59 (UTC+2) puis, en direct, 02:00 (UTC+1) ; le TU ne saute pas', async ({ browser }) => {
    const page = await ouvrir(browser, 'Europe/Paris', '2026-10-25T00:59:30Z');
    await page.getByRole('button', { name: 'Maintenant' }).click();
    await expect(page.locator('.heure-maintenant')).toHaveText('25 octobre 2026 · 02:59 heure de Paris (UTC+2) · 00:59 TU');
    await expect(champ(page, 'Jour de l’année')).toHaveValue('297');
    await expect(champ(page, 'Temps universel')).toHaveValue('0,99');
    await page.getByRole('button', { name: 'En direct' }).click();
    await expect(page.getByRole('button', { name: 'En direct' })).toHaveAttribute('aria-pressed', 'true');
    await page.clock.runFor(45_000);
    await expect(page.locator('.heure-maintenant')).toHaveText('25 octobre 2026 · 02:00 heure de Paris (UTC+1) · 01:00 TU');
    await expect(champ(page, 'Temps universel')).toHaveValue(/^1,0[01]$/);
    // un réglage de date touché : « En direct » s'arrête
    await champ(page, 'Jour de l’année').fill('100');
    await champ(page, 'Jour de l’année').press('Enter');
    await expect(page.getByRole('button', { name: 'En direct' })).toHaveAttribute('aria-pressed', 'false');
    await page.context().close();
  });

  for (const [tz, attendu] of [
    ['Pacific/Auckland', '15 octobre 2026 · 20:20 heure d’Auckland (UTC+13) · 07:20 TU'],
    ['America/St_Johns', '15 octobre 2026 · 04:50 heure de St Johns (UTC−2:30) · 07:20 TU'],
    ['Asia/Kathmandu', /^15 octobre 2026 · 13:05 heure de Kath?mandu \(UTC\+5:45\) · 07:20 TU$/],
  ] as const) {
    test(`fuseau exotique : ${tz}`, async ({ browser }) => {
      const page = await ouvrir(browser, tz, '2026-10-15T07:20:00Z');
      await page.getByRole('button', { name: 'Maintenant' }).click();
      await expect(page.locator('.heure-maintenant')).toHaveText(attendu);
      // le simulateur jour-nuit est en TU, quel que soit le fuseau
      await expect(champ(page, 'Temps universel')).toHaveValue('7,33');
      await page.context().close();
    });
  }

  test('jour de l’an à Paris (pas encore à Londres) ; heure solaire au méridien du fuseau', async ({ browser }) => {
    const page = await ouvrir(browser, 'Europe/Paris', '2026-12-31T23:30:00Z', '#/a/sunmotions');
    await page.getByRole('button', { name: 'Maintenant' }).click();
    await expect(page.locator('.heure-maintenant')).toHaveText('1 janvier 2027 · 00:30 heure de Paris (UTC+1) · 23:30 TU');
    // heure solaire moyenne au méridien du fuseau (15° E) : TU + 1 h, sans l'heure d'été
    await expect(champ(page, 'Jour de l’année')).toHaveValue('0');
    await expect(page.locator('.bloc-maintenant .aide')).toContainText('15,0° E');
    await page.context().close();
  });

  test('« Ma position » : seulement sur demande ; heure solaire à la longitude de l’appareil', async ({ browser }) => {
    const page = await ouvrir(browser, 'Pacific/Auckland', '2026-10-15T07:20:00Z', '#/a/sunmotions', true);
    await page.getByRole('button', { name: 'Maintenant' }).click();
    await expect(page.locator('.bloc-maintenant .aide')).toContainText('méridien du fuseau (180,0° E)');
    await expect(champ(page, 'Latitude')).toHaveValue('40,8');
    await page.getByRole('button', { name: 'Ma position' }).click();
    await expect(page.locator('.bloc-maintenant .aide')).toContainText('36,9° S, 174,8° E');
    await expect(champ(page, 'Latitude')).toHaveValue(/^[−-]36,9$/);
    await page.context().close();
  });

  test('Anticythère et barycentre : « Maintenant » règle la date', async ({ browser }) => {
    const page = await ouvrir(browser, 'Europe/Paris', '2026-10-15T07:20:00Z', '#/a/ca_extrasolarplanets_starwobble');
    await page.getByRole('button', { name: 'Maintenant' }).click();
    await expect(page.locator('.reglage input[type="text"]').first()).toHaveValue(/^2026,[78]$/);
    await page.goto('./#/a/antikythera');
    await page.getByRole('button', { name: 'Maintenant' }).click();
    await expect(page.locator('.valeurs')).toContainText('2026');
    await page.context().close();
  });
});

// ------------------------------------------------------------------ glisser toujours actif
async function empreinte(page: Page): Promise<number> {
  return page.locator('.scene canvas').first().evaluate((c: HTMLCanvasElement) => {
    const d = c.toDataURL();
    let h = 0;
    for (let i = 0; i < d.length; i += 5) h = (h * 31 + d.charCodeAt(i)) | 0;
    return h;
  });
}

test('glisser sur le globe : après un réglage touché, le panneau défilé, un doigt perdu — la vue tourne toujours', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('coupole-web:langue', JSON.stringify('fr'));
    localStorage.setItem('coupole-web:installation', JSON.stringify({ visites: 0, utilise: 0, plusTard: 0, jamais: true }));
  });
  await page.goto('./#/a/daylightsimulator');
  const toile = page.locator('.scene canvas').first();
  await expect(toile).toBeVisible();
  await page.waitForTimeout(800);
  // un doigt seul fait défiler la page ; le globe se tourne à deux doigts ou après un appui long (300 ms) ; le
  // pincement reste à la scène (« pinch-zoom » le donnait au navigateur : zoom inerte sur iPad, 0.6.3)
  expect(await toile.evaluate((c) => getComputedStyle(c).touchAction)).toBe('pan-y');
  /** Glisser au doigt après un appui long (événements de pointeur « touch ») : n'importe quel moteur. */
  const glisserDoigt = async (id: number, relacher = true): Promise<void> => {
    await toile.evaluate(async (c, [id, rel]) => {
      // centre de la toile là où elle est maintenant (la page a pu défiler)
      const r = c.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const ev = (t: string, dx: number) => new PointerEvent(t, { pointerId: id as number, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x + dx, clientY: y, buttons: t === 'pointerup' ? 0 : 1 });
      c.dispatchEvent(ev('pointerdown', 0));
      await new Promise((f) => setTimeout(f, 400));
      for (let k = 1; k <= 8; k++) c.dispatchEvent(ev('pointermove', k * 12));
      if (rel) c.dispatchEvent(ev('pointerup', 96));
    }, [id, relacher] as const);
    // WebKit dessine l'image suivante un peu plus tard
    await page.waitForTimeout(900);
  };
  // 1. un réglage touché (liste « Animation », puis curseur de latitude), la toile n'a plus le focus
  await page.locator('.panneau select').first().selectOption({ index: 0 });
  await page.locator('.panneau input[type="range"]').nth(2).focus();
  await expect(toile).not.toBeFocused();
  // (sur téléphone, le réglage a fait défiler la page : on revient à la toile sans lui donner le focus)
  await toile.evaluate((c) => c.scrollIntoView({ block: 'center' }));
  const b2 = (await toile.boundingBox())!;
  const [mx, my] = [b2.x + b2.width / 2, b2.y + Math.min(b2.height / 2, 300)];
  let avant = await empreinte(page);
  await page.mouse.move(mx, my);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(mx + k * 12, my + k * 4);
  await page.mouse.up();
  await page.waitForTimeout(900);
  await expect.poll(() => empreinte(page), { timeout: 5000 }).not.toBe(avant);
  // 2. le panneau (ou la page) a défilé
  await page.evaluate(() => {
    window.scrollBy(0, 300);
    document.querySelector('.panneau')?.scrollBy(0, 300);
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  avant = await empreinte(page);
  await glisserDoigt(11);
  await expect.poll(() => empreinte(page), { timeout: 5000 }).not.toBe(avant);
  // 3. un doigt « perdu » (jamais relâché : geste avalé par le système), puis un nouveau geste
  await glisserDoigt(21, false);
  avant = await empreinte(page);
  await glisserDoigt(22);
  await expect.poll(() => empreinte(page), { timeout: 5000 }).not.toBe(avant);
});
