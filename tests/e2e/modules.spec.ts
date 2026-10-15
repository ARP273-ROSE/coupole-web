/**
 * Bout en bout des modules (0.4.0) : accueil (22 modules), page d'un module à onglets, question (menus, choix,
 * validation, réponse qui clignote, indice, explication, ressources liées ★), fenêtres de ressources (fiche, table,
 * image, plusieurs à la fois), aperçu au survol, fil d'Ariane, recherche FR/EN, « Mes modules » (créer, ajouter,
 * réordonner, renommer, supprimer, annuler), sauvegarde (persistance, export, import, réinitialisation), accessibilité
 * élémentaire (onglets au clavier, noms accessibles).  Aucune erreur, aucune requête externe.
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

async function capture(page: Page, nom: string): Promise<void> {
  await page.screenshot({ path: `test-results/captures/${test.info().project.name}-${nom}.png`, fullPage: false });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('coupole-web:langue', JSON.stringify('fr'));
    } catch {
      /* rien */
    }
  });
});

test('accueil : 22 modules, bonus, favoris, animations par thème, recherche', async ({ page }) => {
  const s = await surveiller(page);
  await page.goto('./');
  await expect(page.locator('.grille-modules').first().locator('.carte-module')).toHaveCount(22);
  await expect(page.locator('.carte-module').first()).toContainText('Notions de base');
  await expect(page.locator('#titre-bonus')).toBeVisible();
  await expect(page.locator('.puces a').first()).toHaveAttribute('href', '#/animations');
  await capture(page, 'accueil');
  await page.locator('#recherche-globale').fill('parallaxe');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/recherche\?q=parallaxe/);
  for (const g of ['Questions', 'Animations', 'Fiches']) await expect(page.locator('.groupe-ressources h2', { hasText: g })).toBeVisible();
  await capture(page, 'recherche');
  // recherche en anglais depuis l'interface française (index FR + EN)
  await page.locator('#recherche-globale').fill('density');
  await expect(page.locator('.groupe-ressources').first()).toBeVisible();
  expect(s.erreurs).toEqual([]);
  expect(s.externes).toEqual([]);
});

test('module : onglets au clavier, questions W/G/C/D, ressources, aperçu, fenêtres', async ({ page }) => {
  const s = await surveiller(page);
  await page.goto('./#/m/intro');
  await expect(page.locator('h1')).toHaveText('Notions de base');
  await expect(page.locator('.fil a').first()).toHaveAttribute('href', '#/');
  const onglet = page.getByRole('tab', { name: /Questions/ });
  await expect(onglet).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.groupe-questions h2').first()).toHaveText('Questions générales');
  await capture(page, 'module');
  // flèches : onglet suivant
  await onglet.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Animations/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: /Fiches/ }).click();
  const fiche = page.locator('#panneau-fiches .ressource-lien').first();
  await expect(fiche).toBeVisible();
  // aperçu au survol (souris)
  if (!test.info().project.name.endsWith('telephone')) {
    await fiche.hover();
    await expect(page.locator('.bulle-apercu.visible')).toBeVisible({ timeout: 5000 });
  }
  await fiche.click();
  const fen = page.locator('.fenetre').first();
  await expect(fen).toBeVisible();
  await expect(fen.locator('math').first()).toBeAttached();
  await expect(fen.locator('svg.schema-svg').first()).toBeVisible();
  await capture(page, 'fenetre-fiche');
  // une table en plus : deux fenêtres à la fois (les fenêtres restent ouvertes quand la page change)
  await page.goto('./#/m/intro/tables');
  const table = page.locator('#panneau-tables .ressource-lien').first();
  await table.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.fenetre')).toHaveCount(2);
  await expect(page.locator('.fenetre table.table-ressource').first()).toBeVisible();
  // rouvrir la même : toujours deux
  await table.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.fenetre')).toHaveCount(2);
  // Échap ferme la fenêtre active
  await page.locator('.fenetre.active .fenetre-barre').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('.fenetre')).toHaveCount(1);
  expect(s.erreurs).toEqual([]);
  expect(s.externes).toEqual([]);
});

test('question : menus, choix, valider, réponse, indice, explication, ressources liées, suivante', async ({ page }) => {
  const s = await surveiller(page);
  await page.goto('./#/m/intro/q/ca_intro_scale');
  await expect(page.locator('#titre-question')).toHaveText('Échelle');
  await expect(page.locator('.figure-question svg')).toBeVisible();
  await expect(page.locator('.menus-question select')).toHaveCount(1);
  // choisir une mauvaise réponse puis valider
  await page.locator('.choix-item').nth(1).click();
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(page.locator('.retour-question.faux')).toContainText('la bonne réponse est A');
  await expect(page.locator('.explication')).toBeVisible();
  await capture(page, 'question-faux');
  // montrer la réponse : la bonne clignote puis reste orange
  await page.getByRole('button', { name: 'Montrer la réponse' }).click();
  await expect(page.locator('.choix-item.bonne')).toHaveCount(1);
  await expect(page.locator('.carte-question')).toHaveClass(/clignote/);
  // changer de variante : le choix de l'objet change l'énoncé
  await page.locator('.menus-question select').selectOption({ index: 1 });
  await expect(page.locator('.enonce mark.valeur')).toBeVisible();
  // ressources liées et passage à la question suivante (G1 → G2)
  await expect(page.locator('#titre-liees')).toBeVisible();
  await page.locator('.fil-question a[rel="next"]').click();
  await expect(page).toHaveURL(/ca_intro_increasingdist/);
  // la tentative est gardée : retour au module, la question 1 est « ratée »
  await page.goto('./#/m/intro');
  await expect(page.locator('.liste-questions li').first().locator('.etat-ratee')).toBeVisible();
  // et elle survit au rechargement (IndexedDB ou repli)
  await page.reload();
  await expect(page.locator('.liste-questions li').first().locator('.etat-ratee')).toBeVisible();
  expect(s.erreurs).toEqual([]);
  expect(s.externes).toEqual([]);
});

test('toutes les questions d’un module s’affichent sans erreur (FR puis EN)', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium-bureau', 'une fois suffit');
  test.setTimeout(600_000);
  const s = await surveiller(page);
  const modules = JSON.parse(readFileSync('public/contenu/modules.json', 'utf-8')).modules as { cle: string; questions: { id: string; ok: boolean }[] }[];
  const ids = modules.flatMap((m) => m.questions.filter((q) => q.ok).map((q) => [m.cle, q.id] as const));
  const vus = new Set<string>();
  let n = 0;
  for (const [m, q] of ids) {
    if (vus.has(q)) continue;
    vus.add(q);
    await page.goto(`./#/m/${m}/q/${q}`);
    await expect(page.locator('#titre-question')).not.toBeEmpty();
    await expect(page.locator('.enonce')).not.toBeEmpty();
    n++;
  }
  expect(n).toBeGreaterThan(500);
  // quelques-unes en anglais
  await page.getByRole('button', { name: 'English' }).click();
  await page.goto('./#/m/light/q/' + ids.find(([m]) => m === 'light')![1]);
  await expect(page.locator('.actions-question')).toContainText('Show answer');
  expect(s.erreurs).toEqual([]);
});

test('Collections (ex-Mes modules) : créer, ajouter, organiser, renommer, supprimer et annuler', async ({ page }) => {
  const s = await surveiller(page);
  await page.goto('./#/m/intro/fiches');
  // ajouter une fiche à un nouveau module depuis le menu « + »
  await page.locator('#panneau-fiches .menu-boite button').first().click();
  await page.getByRole('menuitem', { name: /Nouvelle collection/ }).click();
  await expect(page.locator('.annonce', { hasText: 'ajouté à' })).toContainText('« Nouvelle collection 1 »');
  await page.goto('./#/mes-modules');
  await expect(page.locator('.mon-module')).toHaveCount(1);
  await page.locator('.mon-module-lien').first().click();
  await expect(page.locator('h1')).toHaveText('Nouvelle collection 1');
  // ajouter une animation au même module depuis un autre module
  await page.goto('./#/m/coordsmotion/animations');
  await page.locator('#panneau-animations .menu-boite button').first().click();
  await page.getByRole('menuitemcheckbox', { name: 'Nouvelle collection 1' }).click();
  await page.goto('./#/mes-modules');
  await page.locator('.mon-module-lien').first().click();
  // organiser : l'animation passe devant la fiche
  await page.getByRole('tab', { name: /Organiser/ }).click();
  const lignes = page.locator('.liste-organiser li');
  await expect(lignes).toHaveCount(2);
  await lignes.nth(1).getByRole('button', { name: 'Monter' }).click();
  await expect(lignes.first().locator('.genre')).toHaveText('Animation');
  await capture(page, 'mes-modules-organiser');
  // renommer
  await page.getByRole('button', { name: 'Renommer' }).first().click();
  await page.locator('#dlg-champ').fill('Séance du soir');
  await page.locator('dialog .bouton.principal').click();
  await expect(page.locator('h1')).toHaveText('Séance du soir');
  // supprimer puis annuler
  await page.getByRole('button', { name: 'Supprimer' }).first().click();
  await page.locator('dialog .bouton.danger').click();
  await expect(page).toHaveURL(/#\/mes-modules$/);
  await page.locator('.annonces').getByRole('button', { name: 'Annuler' }).click();
  await expect(page.locator('h1')).toHaveText('Séance du soir');
  expect(s.erreurs).toEqual([]);
});

test('Ma progression : bilan, export, import, réinitialisation avec annulation', async ({ page }) => {
  const s = await surveiller(page);
  await page.goto('./#/m/intro/q/ca_intro_scale');
  await page.locator('.choix-item').first().click();
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(page.locator('.retour-question.juste')).toBeVisible();
  await page.goto('./#/progression');
  await expect(page.locator('.chiffres')).toContainText('1 / ');
  await capture(page, 'progression');
  // export : un fichier JSON au format commun
  const tel = page.waitForEvent('download');
  await page.getByRole('button', { name: /Exporter/ }).click();
  const fichier = await (await tel).path();
  const doc = JSON.parse(readFileSync(fichier!, 'utf-8'));
  expect(doc.format).toBe('coupole-sauvegarde');
  expect(doc.questions.ca_intro_scale.tentatives[0].juste).toBe(true);
  // réinitialiser « toutes les réponses » (sans copie), puis annuler
  await page.locator('#raz-partie').selectOption('reponses');
  await page.getByRole('button', { name: 'Réinitialiser' }).click();
  await page.locator('#dlg-option').uncheck();
  await page.locator('dialog .bouton.danger').click();
  await expect(page.locator('.chiffres')).toContainText('0 / ');
  await page.locator('.annonces').getByRole('button', { name: 'Annuler' }).click();
  await expect(page.locator('.chiffres')).toContainText('1 / ');
  // import d'un fichier (remplacer) : celui exporté plus haut
  await page.locator('#import-mode').selectOption('fusionner');
  await page.locator('#import-fichier').setInputFiles(fichier!);
  await expect(page.locator('.annonce', { hasText: 'Importé' })).toBeVisible();
  expect(s.erreurs).toEqual([]);
});
