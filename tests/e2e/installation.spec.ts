/**
 * Installation de l'application (0.6.0) : Chromium (invite `beforeinstallprompt` simulée → bannière discrète,
 * bouton de l'en-tête, prompt() au clic, « Plus tard » 30 jours, « Ne plus proposer »), WebKit iPhone/iPad (fiche
 * illustrée « Partager → Sur l'écran d'accueil », y compris l'iPad qui se présente comme un Mac), Firefox (rien
 * de spontané, explication dans À propos), déjà installée (rien), premier usage (rien à la 1ʳᵉ visite), manifeste.
 */
import { devices, expect, test, type Page } from '@playwright/test';

const PREMIERE = { visites: 0, utilise: 0, plusTard: 0, jamais: false };
const DEUXIEME = { visites: 1, utilise: 0, plusTard: 0, jamais: false }; // la visite du test fait la 2ᵉ

async function etat(page: Page, e: object): Promise<void> {
  await page.addInitScript((x) => {
    localStorage.setItem('coupole-web:langue', JSON.stringify('fr'));
    if (!sessionStorage.getItem('etat-pose')) {
      localStorage.setItem('coupole-web:installation', JSON.stringify(x));
      sessionStorage.setItem('etat-pose', '1');
    }
  }, e);
}

/** Invite d'installation simulée (comme Chrome) : prompt() noté, choix « accepted ». */
async function simulerInvite(page: Page, choix: 'accepted' | 'dismissed' = 'accepted'): Promise<void> {
  await page.evaluate((c) => {
    const ev = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    (window as unknown as { __prompts: number }).__prompts = 0;
    ev.prompt = async () => {
      (window as unknown as { __prompts: number }).__prompts++;
    };
    ev.userChoice = Promise.resolve({ outcome: c });
    window.dispatchEvent(ev);
  }, choix);
}

test('manifeste : id, start_url, display, couleurs, icônes 192/512 (dont maskable), captures larges et étroites', async ({ request }) => {
  const m = await (await request.get('./manifest.webmanifest')).json();
  expect(m.id).toBeTruthy();
  expect(m.start_url).toBeTruthy();
  expect(m.display).toBe('standalone');
  expect(m.theme_color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  expect(m.background_color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  for (const t of ['192x192', '512x512']) {
    expect(m.icons.some((i: { sizes: string; purpose: string }) => i.sizes === t && i.purpose === 'any')).toBe(true);
    expect(m.icons.some((i: { sizes: string; purpose: string }) => i.sizes === t && i.purpose === 'maskable')).toBe(true);
  }
  expect(m.screenshots.some((c: { form_factor: string }) => c.form_factor === 'wide')).toBe(true);
  expect(m.screenshots.some((c: { form_factor: string }) => c.form_factor === 'narrow')).toBe(true);
  for (const c of m.screenshots) {
    const [w, h] = c.sizes.split('x').map(Number);
    expect(Math.max(w, h) / Math.min(w, h)).toBeLessThanOrEqual(2.3);
    expect((await request.get('./' + c.src)).ok()).toBe(true);
  }
  for (const i of m.icons) expect((await request.get('./' + i.src)).ok()).toBe(true);
});

test.describe('Chromium : invite du navigateur', () => {
  // les formats téléphone et tablette des projets Chromium empruntent l'agent d'un iPhone / iPad : Chromium « bureau »,
  // plus un contexte Android ci-dessous
  test.beforeEach(({ browserName }, info) => test.skip(browserName !== 'chromium' || info.project.name !== 'chromium-bureau', 'beforeinstallprompt : Chromium seulement'));

  test('Android (Chrome) : bannière au-dessus de la barre de navigation, prompt() au clic', async ({ browser }) => {
    const ctx = await browser.newContext({ ...devices['Pixel 7'] });
    const page = await ctx.newPage();
    await etat(page, DEUXIEME);
    await page.goto('./');
    await expect(page.locator('.grille-modules .carte-module').first()).toBeVisible();
    await simulerInvite(page);
    const banniere = page.locator('.banniere-installation');
    await expect(banniere).toBeVisible();
    const b = await banniere.boundingBox();
    const nav = await page.locator('#nav').boundingBox();
    expect(b!.y + b!.height).toBeLessThanOrEqual(nav!.y + 1);
    await page.screenshot({ path: 'test-results/captures/android-installation.png' });
    await banniere.getByRole('button', { name: 'Installer' }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __prompts: number }).__prompts)).toBe(1);
    await ctx.close();
  });

  test('2ᵉ visite : bannière discrète, « Installer » appelle prompt(), puis plus rien', async ({ page }) => {
    await etat(page, DEUXIEME);
    await page.goto('./');
    await expect(page.locator('.grille-modules .carte-module').first()).toBeVisible();
    await expect(page.locator('.banniere-installation')).toHaveCount(0);
    await expect(page.locator('.bouton-installer')).toBeHidden();
    await simulerInvite(page);
    const banniere = page.locator('.banniere-installation');
    await expect(banniere).toBeVisible();
    await expect(banniere).toContainText('Installez Coupole');
    await expect(page.locator('.bouton-installer')).toBeVisible();
    await banniere.getByRole('button', { name: 'Installer' }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __prompts: number }).__prompts)).toBe(1);
    await expect(banniere).toHaveCount(0);
    await expect(page.locator('.bouton-installer')).toBeHidden();
  });

  test('1ʳᵉ visite : rien ; bouton de l’en-tête et page À propos quand même', async ({ page }) => {
    await etat(page, PREMIERE);
    await page.goto('./');
    await simulerInvite(page);
    await page.waitForTimeout(1800);
    await expect(page.locator('.banniere-installation')).toHaveCount(0);
    await expect(page.locator('.bouton-installer')).toBeVisible();
    await page.goto('./#/apropos?installer');
    await expect(page.locator('#installer')).toBeFocused();
    await page.locator('#installer').getByRole('button', { name: 'Installer Coupole' }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __prompts: number }).__prompts)).toBe(1);
  });

  test('« Plus tard » : mémorisé 30 jours ; « Ne plus proposer » : définitif', async ({ page }) => {
    await etat(page, DEUXIEME);
    await page.goto('./');
    await simulerInvite(page);
    await page.locator('.banniere-installation').getByRole('button', { name: 'Plus tard' }).click();
    await expect(page.locator('.banniere-installation')).toHaveCount(0);
    const e = await page.evaluate(() => JSON.parse(localStorage.getItem('coupole-web:installation')!));
    expect(Date.now() - e.plusTard).toBeLessThan(60_000);
    await page.reload();
    await simulerInvite(page);
    await page.waitForTimeout(500);
    await expect(page.locator('.banniere-installation')).toHaveCount(0);
    // 31 jours plus tard : de nouveau proposée, puis « Ne plus proposer »
    await page.evaluate(() => {
      const x = JSON.parse(localStorage.getItem('coupole-web:installation')!);
      x.plusTard = Date.now() - 31 * 24 * 3600 * 1000;
      localStorage.setItem('coupole-web:installation', JSON.stringify(x));
    });
    await page.reload();
    await simulerInvite(page);
    await page.locator('.banniere-installation').getByRole('button', { name: 'Ne plus proposer' }).click();
    await page.reload();
    await simulerInvite(page);
    await page.waitForTimeout(500);
    await expect(page.locator('.banniere-installation')).toHaveCount(0);
  });

  test('déjà installée (display-mode standalone) : ni bannière ni bouton', async ({ page }) => {
    await page.addInitScript(() => {
      const mm = window.matchMedia.bind(window);
      window.matchMedia = (q: string) => (/display-mode: standalone/.test(q) ? ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList) : mm(q));
    });
    await etat(page, DEUXIEME);
    await page.goto('./');
    await simulerInvite(page);
    await page.waitForTimeout(500);
    await expect(page.locator('.banniere-installation')).toHaveCount(0);
    await expect(page.locator('.bouton-installer')).toBeHidden();
    await page.goto('./#/apropos');
    await expect(page.locator('#installer')).toContainText('déjà Coupole installée');
  });
});

test.describe('WebKit : iPhone et iPad (pas d’API)', () => {
  test.skip(({ browserName }) => browserName !== 'webkit', 'Safari seulement');

  test('iPhone / iPad : fiche illustrée « Partager → Sur l’écran d’accueil »', async ({ page }, info) => {
    test.skip(info.project.name === 'webkit-bureau', 'téléphone et tablette');
    await etat(page, DEUXIEME);
    await page.goto('./');
    const banniere = page.locator('.banniere-installation');
    await expect(banniere).toBeVisible();
    await banniere.getByRole('button', { name: 'Comment installer' }).click();
    const fiche = page.locator('dialog.fiche-installation');
    await expect(fiche).toBeVisible();
    await expect(fiche).toContainText('Touchez le bouton Partager');
    await expect(fiche).toContainText('Sur l’écran d’accueil');
    await expect(fiche.locator('.etape-icone svg')).toHaveCount(3);
    await page.screenshot({ path: `test-results/captures/${info.project.name}-installation-ios.png` });
    await fiche.getByRole('button', { name: 'Fermer' }).click();
    await expect(fiche).toHaveCount(0);
  });

  test('iPadOS qui se présente comme un Mac (écran tactile) : fiche iOS aussi', async ({ browser }) => {
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
      viewport: { width: 1024, height: 1366 },
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.addInitScript(() => Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 }));
    await etat(page, DEUXIEME);
    await page.goto('./');
    await page.locator('.banniere-installation').getByRole('button', { name: 'Comment installer' }).click();
    await expect(page.locator('dialog.fiche-installation')).toContainText('Sur iPhone et iPad');
    await ctx.close();
  });

  test('Safari macOS 17+ : « Fichier → Ajouter au Dock »', async ({ browser }) => {
    const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15' });
    const page = await ctx.newPage();
    await page.addInitScript(() => Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 }));
    await etat(page, DEUXIEME);
    await page.goto('./');
    await page.locator('.bouton-installer').click();
    await expect(page.locator('dialog.fiche-installation')).toContainText('Ajouter au Dock');
    await ctx.close();
  });

  test('déjà sur l’écran d’accueil (navigator.standalone) : rien', async ({ page }, info) => {
    test.skip(info.project.name === 'webkit-bureau', 'téléphone et tablette');
    await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
    await etat(page, DEUXIEME);
    await page.goto('./');
    await page.waitForTimeout(2000);
    await expect(page.locator('.banniere-installation')).toHaveCount(0);
    await expect(page.locator('.bouton-installer')).toBeHidden();
  });
});

test.describe('Firefox', () => {
  test.beforeEach(({ browserName }, info) => test.skip(browserName !== 'firefox' || info.project.name !== 'firefox-bureau', 'Firefox seulement (contextes propres)'));

  test('ordinateur : pas de proposition, explication dans À propos', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await etat(page, DEUXIEME);
    await page.goto('./');
    await page.waitForTimeout(2000);
    await expect(page.locator('.banniere-installation')).toHaveCount(0);
    await expect(page.locator('.bouton-installer')).toBeHidden();
    await page.goto('./#/apropos?installer');
    await expect(page.locator('#installer')).toContainText('Firefox pour ordinateur ne sait pas installer');
    await ctx.close();
  });

  test('Android : bannière, puis menu ⋮ → « Installer »', async ({ browser }) => {
    const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0', viewport: { width: 412, height: 860 } });
    const page = await ctx.newPage();
    await etat(page, DEUXIEME);
    await page.goto('./');
    await page.locator('.banniere-installation').getByRole('button', { name: 'Comment installer' }).click();
    await expect(page.locator('dialog.fiche-installation')).toContainText('Touchez « Installer »');
    await ctx.close();
  });
});
