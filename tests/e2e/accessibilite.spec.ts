/**
 * Accessibilité (0.5.0) : axe-core (WCAG 2.2 A et AA, contraste compris) sur chaque type de page, dans les deux
 * thèmes ; navigation complète au clavier (lien d'évitement, en-tête, focus toujours visible, question au clavier) ;
 * rôles et régions annoncées (aria-live).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES: [string, string][] = [
  ['accueil', '#/'],
  ['catalogue', '#/animations'],
  ['module', '#/m/intro'],
  ['module-fiches', '#/m/intro/fiches'],
  ['question', '#/m/intro/q/ca_intro_scale'],
  ['fiche', '#/r/fiche/ancientastro_eratosthene'],
  ['table', '#/r/table/densities'],
  ['image', '#/r/image/startrails'],
  ['mes-modules', '#/mes-modules'],
  ['favoris', '#/favoris'],
  ['bibliotheque', '#/bibliotheque'],
  ['bibliotheque-images', '#/bibliotheque/images'],
  ['recherche-bilingue', '#/recherche?q=seasons'],
  ['progression', '#/progression'],
  ['recherche', '#/recherche?q=lune'],
  ['apropos', '#/apropos'],
  ['animation', '#/a/seasonsim'],
  ['animation-3d', '#/a/orion3d'],
  ['introuvable', '#/r/fiche/nexiste_pas'],
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('coupole-web:langue')) localStorage.setItem('coupole-web:langue', JSON.stringify('fr'));
  });
});

for (const theme of ['sombre', 'clair'] as const) {
  test(`axe-core : chaque type de page, thème ${theme}`, async ({ page }) => {
    // un format par moteur (les trois moteurs et les trois formats sont couverts) ; tous les projets en local
    test.skip(!!process.env.CI && !['chromium-bureau', 'firefox-tablette', 'webkit-telephone'].includes(test.info().project.name), 'un format par moteur en CI');
    test.setTimeout(240_000);
    await page.addInitScript((t) => {
      localStorage.setItem('coupole-web:langue', JSON.stringify('fr'));
      localStorage.setItem('coupole-web:theme', JSON.stringify(t));
    }, theme);
    const fautes: string[] = [];
    for (const [nom, h] of PAGES) {
      await page.goto('./' + h);
      await expect(page.locator('#contenu h1').first()).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(400);
      // contraste mesuré une fois les apparitions (fondus) terminées
      await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => null))));
      // la réponse montrée fait partie de l'état à vérifier
      if (nom === 'question') {
        await page.locator('.choix-item').nth(1).click();
        await page.getByRole('button', { name: 'Valider' }).click();
        await page.waitForTimeout(300);
      }
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).exclude('.annonces').analyze();
      for (const v of r.violations) fautes.push(`${nom} : ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')} — ${v.nodes[0]?.failureSummary?.split('\n')[1] ?? ''}`);
    }
    expect(fautes).toEqual([]);
  });
}

test('clavier : évitement, en-tête, focus toujours visible', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit ne parcourt pas les liens à la touche Tab par défaut (réglage du système)');
  await page.goto('./#/m/intro');
  await expect(page.locator('h1')).toHaveText('Notions de base');
  // premier arrêt : « Aller au contenu », visible
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Tab');
  await expect(page.locator('.evitement')).toBeFocused();
  await expect(page.locator('.evitement')).toBeInViewport();
  const invisibles: string[] = [];
  const vus = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const info = await page.evaluate(() => {
      const e = document.activeElement as HTMLElement | null;
      if (!e || e === document.body) return null;
      const cs = getComputedStyle(e);
      const visible = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
      return { nom: `${e.tagName.toLowerCase()}.${e.className}:${(e.textContent ?? '').trim().slice(0, 20)}`, visible };
    });
    if (info) {
      vus.add(info.nom);
      if (!info.visible) invisibles.push(info.nom);
    }
    await page.keyboard.press('Tab');
  }
  expect(vus.size).toBeGreaterThan(15);
  expect(invisibles).toEqual([]);
});

test('clavier : une question se joue sans souris (lettre, Entrée, R pour la réponse)', async ({ page }) => {
  await page.goto('./#/m/intro/q/ca_intro_scale');
  await expect(page.locator('#titre-question')).toHaveText('Échelle');
  await page.locator('#titre-question').click();
  await page.keyboard.press('b');
  await expect(page.locator('.choix-item[data-lettre="B"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.retour-question')).toHaveClass(/faux|juste/);
  await expect(page.locator('.retour-question')).toHaveAttribute('aria-live', 'polite');
  await page.locator('#titre-question').click();
  await page.keyboard.press('r');
  await expect(page.locator('.choix-item.bonne')).toHaveCount(1);
  // région d'annonces et régions nommées
  await expect(page.locator('#annonces')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('.choix')).toHaveAttribute('role', 'radiogroup');
});

test('animation au clavier : réglages et toile atteignables, toile nommée', async ({ page }) => {
  await page.goto('./#/a/seasonsim');
  const toile = page.locator('.scene canvas');
  await expect(toile).toBeVisible();
  expect(((await toile.getAttribute('aria-label')) ?? '').length).toBeGreaterThan(10);
  const curseur = page.locator('.reglages input[type="range"]').first();
  await curseur.focus();
  const v0 = await curseur.inputValue();
  await page.keyboard.press('ArrowRight');
  expect(await curseur.inputValue()).not.toBe(v0);
});
