/**
 * 0.6.0 de bout en bout : recherche bilingue (EN ou FR, quel que soit l'affichage), favoris (étoile partout, accueil,
 * page « Mes favoris », filtres, clavier, aria-pressed, sauvegarde commune version 2, réinitialisation partielle),
 * bibliothèque (présentation de ClassAction : onglets par type, rangés par module, filtres), collections au second
 * plan.  Aucune erreur, aucune requête externe.
 */
import { expect, type Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

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
    // pas de bannière d'installation dans ces tests (elle a les siens)
    localStorage.setItem('coupole-web:installation', JSON.stringify({ visites: 0, utilise: 0, plusTard: 0, jamais: true }));
  });
});

test('recherche bilingue : anglais dans l’interface française, et l’inverse ; surlignage ; groupes par type', async ({ page }) => {
  const s = await surveiller(page);
  await page.goto('./#/recherche?q=seasons');
  const anims = page.locator('.groupe-ressources[data-genre="animation"]');
  await expect(anims.locator('.ressource-titre', { hasText: 'Simulateur des saisons (NAAP)' })).toBeVisible();
  // correspondance seulement dans l'autre langue : le titre anglais suit, mot surligné
  await expect(anims.locator('li[data-id="eclipticsimulator"] .autre-langue mark')).toHaveText('Seasons');
  await page.locator('#recherche-globale').fill('Kepler’s third law');
  await expect(page.locator('.groupe-ressources[data-genre="animation"] li').first()).toContainText('Troisième loi de Kepler');
  await expect(page.locator('.groupe-ressources[data-genre="fiche"] li', { hasText: 'Les lois de Kepler' })).toBeVisible();
  await expect(page.locator('.groupe-ressources[data-genre="animation"] li').first().locator('mark').first()).toHaveText('Kepler');
  // petites fautes, accents, pluriels
  await page.locator('#recherche-globale').fill('paralaxe');
  await expect(page.locator('.groupe-ressources[data-genre="animation"]')).toBeVisible();
  await page.locator('#recherche-globale').fill('Rétrogrades');
  await expect(page.locator('.groupe-ressources[data-genre="animation"] li').first()).toContainText('rétrograde');
  // modules aussi
  await page.locator('#recherche-globale').fill('Introductory Concepts');
  await expect(page.locator('.groupe-ressources[data-genre="module"] li').first()).toContainText('Notions de base');
  // interface anglaise, recherche en français
  await page.getByRole('button', { name: 'EN – English' }).click();
  await page.goto('./#/recherche?q=saisons');
  await expect(page.locator('.groupe-ressources[data-genre="animation"] .ressource-titre', { hasText: 'Seasons Simulator (NAAP)' })).toBeVisible();
  await expect(page.locator('li[data-id="eclipticsimulator"] .autre-langue')).toContainText('In French');
  expect(s.erreurs).toEqual([]);
  expect(s.externes).toEqual([]);
});

test('catalogue : recherche bilingue tolérante et filtre « favoris »', async ({ page }) => {
  const s = await surveiller(page);
  await page.goto('./#/animations?q=seasns');
  await expect(page.locator('.carte-boite:visible .carte-titre', { hasText: 'Simulateur des saisons (NAAP)' })).toBeVisible();
  await page.locator('#recherche').fill('');
  const etoile = page.locator('.carte-boite', { hasText: 'Troisième loi de Kepler' }).locator('.bouton-favori');
  await expect(etoile).toHaveAttribute('aria-pressed', 'false');
  await etoile.click();
  await expect(etoile).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.puce-favoris').click();
  await expect(page.locator('.carte-boite:visible')).toHaveCount(1);
  expect(s.erreurs).toEqual([]);
});

test('favoris : étoile partout (clavier, aria-pressed), accueil, page « Mes favoris », tri, filtre, persistance', async ({ page }) => {
  const s = await surveiller(page);
  // un module, au clavier
  await page.goto('./#/m/intro');
  const bModule = page.locator('.actions-module .bouton-favori');
  await expect(bModule).toHaveAttribute('aria-pressed', 'false');
  await expect(bModule).toHaveAccessibleName('Favori : Notions de base');
  await bModule.focus();
  await page.keyboard.press('Space');
  await expect(bModule).toHaveAttribute('aria-pressed', 'true');
  // une fiche dans la liste du module, puis la même dans sa fenêtre : les deux étoiles restent d'accord
  await page.getByRole('tab', { name: /Fiches/ }).click();
  const ligne = page.locator('#panneau-fiches li.ressource').first();
  await ligne.locator('.bouton-favori').click();
  await expect(ligne.locator('.bouton-favori')).toHaveAttribute('aria-pressed', 'true');
  await ligne.locator('.ressource-lien').click();
  await expect(page.locator('.fenetre .bouton-favori')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.fenetre .bouton-favori').click();
  await expect(ligne.locator('.bouton-favori')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('.fenetre .bouton-favori').click();
  // une question (page) et une animation (page)
  await page.locator('.fenetre').getByRole('button', { name: /Fermer/ }).click();
  await page.goto('./#/m/intro/q/ca_intro_scale');
  await page.locator('.outils-question .bouton-favori').click();
  await page.goto('./#/a/kepler');
  await page.locator('.titre-anim .bouton-favori').click();
  await expect(page.locator('.titre-anim .bouton-favori')).toHaveAttribute('aria-pressed', 'true');
  // accueil : section « Mes favoris », le plus récent d'abord
  await page.goto('./');
  await expect(page.locator('.favoris-accueil li')).toHaveCount(4);
  await expect(page.locator('.favoris-accueil li').first()).toContainText('Simulateur d');
  // page des favoris : groupée par type, filtrable, triable
  await page.getByRole('link', { name: 'Tout voir' }).click();
  await expect(page).toHaveURL(/#\/favoris/);
  await expect(page.locator('.groupe-ressources')).toHaveCount(4);
  await page.locator('.puce', { hasText: 'Animations' }).click();
  await expect(page.locator('.groupe-ressources')).toHaveCount(1);
  await page.locator('.puce', { hasText: 'Tout' }).click();
  await page.locator('#tri-favoris').selectOption('titre');
  await expect(page).toHaveURL(/tri=titre/);
  // persistance (rechargement), puis retrait depuis la page
  await page.reload();
  await expect(page.locator('.groupe-ressources')).toHaveCount(4);
  await page.locator('.groupe-ressources[data-genre="question"] .bouton-favori').click();
  await expect(page.locator('.groupe-ressources')).toHaveCount(3);
  // collections au second plan
  await expect(page.getByRole('link', { name: 'Organiser en collections…' })).toBeVisible();
  // export : version 2 avec les favoris ; réinitialisation partielle « favoris »
  await page.goto('./#/progression');
  const tel = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Exporter/ }).click();
  const doc = JSON.parse(readFileSync((await (await tel).path())!, 'utf-8'));
  expect(doc.version).toBe(2);
  expect(doc.favoris.map((f: { genre: string }) => f.genre).sort()).toEqual(['animation', 'fiche', 'module']);
  await page.locator('#raz-partie').selectOption('favoris');
  await page.getByRole('button', { name: 'Réinitialiser' }).click();
  await page.locator('#dlg-option').uncheck();
  await page.locator('dialog .bouton.danger').click();
  await page.goto('./#/favoris');
  await expect(page.locator('.etat-message')).toContainText('Pas encore de favori');
  expect(s.erreurs).toEqual([]);
});

test('import d’une sauvegarde version 1 (Mes modules) : les modules deviennent des collections', async ({ page }) => {
  const s = await surveiller(page);
  await page.goto('./#/progression');
  const v1 = { format: 'coupole-sauvegarde', version: 1, application: 'coupole/0.7.0', modifie: '2026-10-10T10:00:00Z', preferences: {}, animations: {}, questions: {}, modules: {}, mes_modules: [{ id: 'mm_lundi', nom: 'Cours du lundi', cree: '2026-10-01T08:00:00Z', modifie: '2026-10-01T08:00:00Z', elements: [{ genre: 'animation', id: 'kepler' }] }] };
  await page.locator('#import-mode').selectOption('fusionner');
  await page.locator('#import-fichier').setInputFiles({ name: 'v1.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(v1)) });
  await expect(page.locator('.annonce', { hasText: 'Importé' })).toContainText('1 collections');
  await page.goto('./#/favoris');
  await page.getByRole('link', { name: 'Organiser en collections…' }).click();
  await expect(page.locator('.mon-module')).toContainText('Cours du lundi');
  expect(s.erreurs).toEqual([]);
});

test('bibliothèque : onglets par type, tout le contenu rangé par module, filtres module et favoris, vignettes', async ({ page }) => {
  const s = await surveiller(page);
  await page.goto('./');
  await page.locator('.carte-bibliotheque').click();
  await expect(page).toHaveURL(/#\/bibliotheque/);
  await expect(page.getByRole('tab', { name: /Questions/ })).toContainText('517');
  await expect(page.locator('#panneau-questions .groupe-biblio').first()).toContainText('Notions de base');
  // images : toutes, avec vignettes
  await page.getByRole('tab', { name: /Images/ }).click();
  await expect(page).toHaveURL(/#\/bibliotheque\/images/);
  await expect(page.locator('#panneau-images .carte-boite').first().locator('.vignette-image img, .vignette-image svg').first()).toBeVisible();
  // filtre par module
  await page.locator('#biblio-module').selectOption('lunarcycles');
  await expect(page.locator('#panneau-images .groupe-biblio')).toHaveCount(1);
  await expect(page).toHaveURL(/m=lunarcycles/);
  // une image en favori, puis « favoris seulement »
  await page.locator('#panneau-images .carte-boite .bouton-favori').first().click();
  await page.locator('#biblio-favoris').check();
  await expect(page.locator('#panneau-images .carte-boite')).toHaveCount(1);
  await expect(page.locator('.compte')).toContainText('favoris');
  // animations : vignettes dessinées par les animations
  await page.locator('#biblio-favoris').uncheck();
  await page.locator('#biblio-module').selectOption('');
  await page.getByRole('tab', { name: /Animations/ }).click();
  await expect(page.locator('#panneau-animations canvas.prete').first()).toBeVisible({ timeout: 20_000 });
  expect(s.erreurs).toEqual([]);
  expect(s.externes).toEqual([]);
});

test('catalogue quitté aussitôt : sa réécriture d’adresse différée n’empêche pas la page suivante de s’afficher', async ({ page }) => {
  // morceau des pages d'animation lent à venir (premier chargement, réseau chargé) : 1,5 s
  await page.route(/page_animation-[^/]*\.js$/, async (r) => {
    await new Promise((f) => setTimeout(f, 1500));
    await r.continue();
  });
  await page.goto('./#/animations');
  await expect(page.locator('a.carte').first()).toBeVisible();
  // dans les 300 ms où le catalogue réécrit son adresse : l'animation doit s'ouvrir quand même
  await page.evaluate(() => {
    location.hash = '#/animations?q=lune';
    location.hash = '#/a/shadowsim';
  });
  await expect(page.locator('.page-anim[data-anim="shadowsim"] .scene canvas')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(600);
  expect(new URL(page.url()).hash.split('?')[0]).toBe('#/a/shadowsim');
});

test('simulateur d’ombres : une adresse partagée « rejouer » replace la Lune comme l’éclipse rejouée', async ({ page }) => {
  await page.goto('./#/a/shadowsim?rejouer=S0');
  const v = page.locator('.page-anim[data-anim="shadowsim"] .valeurs');
  await expect(v).toContainText('Éclipse rejouée');
  // 20 mars 2015 : totale, Lune à 357 922 km (et non 384 400 km, la position par défaut)
  await expect(v).toContainText('357 922 km');
  await expect(v).not.toContainText('384 400 km');
  await page.goto('about:blank');
  await page.goto('./#/a/shadowsim?position=200');
  await expect(page.locator('.page-anim[data-anim="shadowsim"] .valeurs')).not.toContainText('(0 km)');
});
