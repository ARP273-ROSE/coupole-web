/**
 * Audit exhaustif (0.5.0), sur une combinaison moteur × format par moteur (Chromium bureau, Firefox tablette, WebKit
 * téléphone : les trois moteurs et les trois formats sont couverts) :
 *  - les 517 questions : affichage, toutes les options de chaque menu (variantes), « Montrer la réponse », indice,
 *    explication, « Valider », score enregistré (Ma progression) ;
 *  - les 94 animations : chaque réglage actionné (curseur, case, liste, bouton), toile jamais vide, adresse partageable
 *    qui redonne les mêmes valeurs après rechargement ;
 *  - toutes les fiches, tables et images (page partageable `#/r/…`), crédit visible sous chaque photographie ;
 *  - sauvegarde : export → réinitialisation → import = état identique ;
 *  - changement de langue en cours de route (question, animation) ;
 *  - hors ligne (pages déjà vues ; état « hors ligne » pour une page jamais ouverte) ;
 *  - aucune image dessinée au repos sur les pages sans animation ;
 *  - partout : aucune erreur, aucune requête vers un autre site.
 */
import { expect, type Page, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';

const ORIGINE = 'http://localhost:4173';
const WEBKIT_SELECT = /^(console|CSP): Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive/;
const BALAYAGE = ['chromium-bureau', 'firefox-tablette', 'webkit-telephone'];
const C = 'public/contenu/';
const MODULES = (JSON.parse(readFileSync(C + 'modules.json', 'utf-8')).modules as { cle: string; questions: { id: string; ok: boolean }[] }[]);
const IMAGES = (JSON.parse(readFileSync(C + 'images/images.json', 'utf-8')).images as { id: string; nature: string }[]);

/** Balayages longs : en local et dans le flux « Audit complet » (AUDIT_COMPLET=1), un format par moteur. */
function balayage(): void {
  test.skip(!BALAYAGE.includes(test.info().project.name), 'balayage exhaustif : un format par moteur');
  test.skip(!!process.env.CI && !process.env.AUDIT_COMPLET, 'balayage exhaustif : flux « Audit complet »');
}

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

async function couleursToile(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector('.scene canvas') as HTMLCanvasElement | null;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return 0;
    const { width: w, height: h } = c;
    const d = ctx.getImageData(0, 0, w, h).data;
    const vues = new Set<number>();
    for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 50)))
      for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 50))) {
        const i = (y * w + x) * 4;
        vues.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
      }
    return vues.size;
  });
}

/** Vrai dès que la condition est remplie (jusqu'à 5 s : WebKit chargé redessine parfois une image plus tard). */
async function attendre(f: () => Promise<boolean>, ms = 5000): Promise<boolean> {
  const fin = Date.now() + ms;
  for (;;) {
    if (await f()) return true;
    if (Date.now() > fin) return false;
    await new Promise((r) => setTimeout(r, 150));
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      if (!localStorage.getItem('coupole-web:langue')) localStorage.setItem('coupole-web:langue', JSON.stringify('fr'));
    } catch {
      /* rien */
    }
  });
});

// ------------------------------------------------------------------ questions (une épreuve par module)
for (const m of MODULES) {
  const ids = [...new Set(m.questions.filter((q) => q.ok).map((q) => q.id))];
  if (!ids.length) continue;
  test(`questions du module ${m.cle} (${ids.length}) : variantes, réponse, indice, explication, score`, async ({ page }) => {
    balayage();
    test.setTimeout(60_000 + ids.length * 25_000);
    const s = await surveiller(page);
    await page.goto(`./#/m/${m.cle}`);
    let valides = 0;
    let variantes = 0;
    for (const id of ids) {
      await page.goto(`./#/m/${m.cle}/q/${id}`);
      const pq = page.locator(`.page-question[data-question="${id}"]`);
      await expect(pq.locator('#titre-question'), id).not.toBeEmpty();
      await expect(pq.locator('.enonce'), id).not.toBeEmpty();
      const fig = pq.locator('.figure-question:not([hidden]) > svg').first();
      if (await fig.count()) expect((await fig.boundingBox())?.height ?? 0, `${id} : figure`).toBeGreaterThan(20);
      // variantes : chaque option de chaque menu
      const menus = pq.locator('.menus-question select');
      for (let k = 0; k < (await menus.count()); k++) {
        const vals = await menus.nth(k).locator('option').evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value));
        for (const v of vals) {
          await menus.nth(k).selectOption(v);
          await expect(pq.locator('.enonce'), `${id} ${v}`).not.toBeEmpty();
          variantes++;
        }
      }
      // réponse montrée : bonne(s) réponse(s) marquée(s), explication
      const choix = pq.locator('.choix-item');
      const nChoix = await choix.count();
      await pq.locator('.actions-question .bouton[aria-pressed]').first().click();
      if (nChoix) await expect(pq.locator('.choix-item.bonne').first(), `${id} : bonne réponse`).toBeVisible();
      if ((await pq.locator('.explication').evaluate((e) => e.childElementCount)) > 0) await expect(pq.locator('.explication'), id).toBeVisible();
      await pq.locator('.actions-question .bouton[aria-pressed]').first().click();
      // indice
      const bIndice = pq.locator('.actions-question .bouton', { hasText: /indice/i });
      if (await bIndice.count()) {
        await bIndice.click();
        await expect(pq.locator('.indice'), `${id} : indice`).toBeVisible();
      }
      // valider une réponse : retour juste / faux, enregistré
      if (nChoix) {
        await choix.first().click();
        await pq.getByRole('button', { name: 'Valider' }).click();
        await expect(pq.locator('.retour-question.juste, .retour-question.faux'), id).toBeVisible();
        valides++;
      }
    }
    // score enregistré : la ligne du module dans Ma progression compte toutes les questions validées
    await page.waitForTimeout(600);
    await page.goto('./#/progression');
    const ligne = page.locator('.table-progression tbody tr', { has: page.locator(`a[href="#/m/${m.cle}"]`) });
    const [r, f] = (await ligne.locator('td.num').allTextContents()).map(Number);
    expect(r! + f!, 'tentatives enregistrées').toBe(valides);
    test.info().annotations.push({ type: 'questions', description: `${ids.length} questions, ${variantes} variantes, ${valides} validées` });
    expect(s.erreurs).toEqual([]);
    expect(s.externes).toEqual([]);
  });
}

// ------------------------------------------------------------------ animations : chaque réglage
test('animations : chaque réglage actionné, toile jamais vide, adresse partageable fidèle', async ({ page }) => {
  balayage();
  test.setTimeout(1_800_000);
  const s = await surveiller(page);
  await page.goto('./#/animations');
  const ids = await page.locator('a.carte').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).hash.replace('#/a/', '')));
  expect(ids.length).toBe(94);
  const fautes: string[] = [];
  let reglages = 0;
  let premiere = true;
  for (const id of ids) {
    await page.goto(`./#/a/${id}`);
    const pa = page.locator(`.page-anim[data-anim="${id}"]`);
    // la première animation ouverte charge aussi le morceau des pages d'animation pendant que le service worker met
    // tout le site en cache : sur un exécuteur d'intégration continue chargé, cela dépassait parfois 30 s
    await expect(pa.locator('.scene canvas'), id).toBeVisible({ timeout: premiere ? 120_000 : 30_000 });
    premiere = false;
    await expect.poll(() => couleursToile(page), { message: id }).toBeGreaterThan(3);
    const r = pa.locator('.reglages');
    // curseurs : une touche vers la droite
    for (const c of await r.locator('input[type="range"]').all()) {
      if (!(await c.isVisible()) || (await c.isDisabled())) continue;
      await c.focus();
      await page.keyboard.press('ArrowRight');
      reglages++;
    }
    // interrupteurs : basculer
    for (const c of await r.locator('input[type="checkbox"]').all()) {
      if (await c.isDisabled()) continue;
      await c.evaluate((x) => (x as HTMLInputElement).click());
      reglages++;
    }
    // listes : option suivante
    for (const c of await r.locator('select').all()) {
      if (!(await c.isVisible()) || (await c.isDisabled())) continue;
      // option suivante parmi celles qui sont proposées (une option peut être grisée selon les autres réglages)
      const vals = await c.locator('option:not([disabled])').evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value));
      const v = await c.inputValue();
      const k = vals.indexOf(v);
      if (vals.length > 1) await c.selectOption(vals[(k + 1) % vals.length]!, { timeout: 10_000 });
      reglages++;
    }
    if (!(await attendre(async () => (await couleursToile(page)) > 3))) fautes.push(`${id} : toile vide après les réglages`);
    // pause éventuelle, puis adresse partageable : mêmes valeurs après rechargement
    const pause = pa.locator('.transport .bouton.principal[aria-pressed="true"]');
    if (await pause.count()) await pause.click();
    // l'adresse est réécrite 350 ms après le dernier changement : on attend qu'elle ne bouge plus (lire l'adresse
    // trop tôt donnait, sous WebKit, une adresse d'un réglage en retard sur les valeurs affichées)
    let url = page.url();
    for (let k = 0; k < 20; k++) {
      await page.waitForTimeout(450);
      const u = page.url();
      if (u === url) break;
      url = u;
    }
    if (/\?/.test(url) && !/[?&](t|temps|jour_courant|instant|angle_courant)=/.test(url)) {
      const avant = await pa.locator('.valeurs').textContent();
      await page.goto('about:blank');
      await page.goto(url);
      const pb = page.locator(`.page-anim[data-anim="${id}"] .valeurs`);
      await expect(page.locator(`.page-anim[data-anim="${id}"] .scene canvas`)).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(300);
      // une animation qui démarre en lecture fait avancer le temps, qui n'est pas un réglage : pas de comparaison
      const enLecture = (await page.locator(`.page-anim[data-anim="${id}"] .transport .bouton.principal[aria-pressed="true"]`).count()) > 0;
      if (!enLecture && !(await attendre(async () => (await pb.textContent()) === avant))) fautes.push(`${id} : l'adresse partageable ne redonne pas les mêmes valeurs`);
    }
    // boutons des réglages (après le contrôle de l'adresse : ils agissent sur le temps ou l'état du jeu, qui ne sont
    // pas des réglages et ne passent pas dans l'adresse)
    const r2 = page.locator(`.page-anim[data-anim="${id}"] .reglages`);
    for (const c of await r2.locator('button.bouton').all()) {
      if (!(await c.isVisible()) || (await c.isDisabled())) continue;
      await c.click();
      reglages++;
    }
    if (!(await attendre(async () => (await couleursToile(page)) > 3))) fautes.push(`${id} : toile vide après les boutons`);
  }
  test.info().annotations.push({ type: 'animations', description: `94 animations, ${reglages} réglages actionnés` });
  expect(fautes).toEqual([]);
  expect(s.erreurs).toEqual([]);
  expect(s.externes).toEqual([]);
});

// ------------------------------------------------------------------ fiches, tables, images
test('toutes les fiches, tables et images s’ouvrent à leur adresse ; crédit sous chaque photographie', async ({ page }) => {
  balayage();
  test.setTimeout(900_000);
  const s = await surveiller(page);
  const fiches = readdirSync(C + 'fiches').map((f) => f.replace(/\.json$/, ''));
  const tables = readdirSync(C + 'tables').map((f) => f.replace(/\.json$/, ''));
  for (const [genre, ids] of [['fiche', fiches], ['table', tables], ['image', IMAGES.map((i) => i.id)]] as const) {
    for (const id of ids) {
      await page.goto(`./#/r/${genre}/${id}`);
      const pr = page.locator('.page-ressource h1');
      await expect(pr, `${genre} ${id}`).not.toBeEmpty();
      if (genre === 'table') await expect(page.locator('.page-ressource table').first(), id).toBeVisible();
      if (genre === 'image') {
        const nat = IMAGES.find((i) => i.id === id)!.nature;
        if (nat === 'photo') {
          await expect(page.locator('.page-ressource img').first(), id).toBeVisible();
          await expect.poll(() => page.locator('.page-ressource img').first().evaluate((i) => (i as HTMLImageElement).naturalWidth), { message: id }).toBeGreaterThan(0);
          await expect(page.locator('.page-ressource .credit-image').first(), `${id} : crédit`).toBeVisible();
        } else await expect(page.locator('.page-ressource svg').first(), id).toBeVisible();
      }
    }
  }
  // adresse inconnue : état « introuvable » avec un retour
  await page.goto('./#/r/fiche/nexiste_pas');
  await expect(page.locator('.etat-message')).toContainText('Introuvable');
  await expect(page.locator('.etat-message a[href="#/"]')).toBeVisible();
  expect(s.erreurs).toEqual([]);
  expect(s.externes).toEqual([]);
});

// ------------------------------------------------------------------ sauvegarde aller-retour
test('sauvegarde : export → tout réinitialiser → import = état identique', async ({ page }) => {
  const s = await surveiller(page);
  // un peu de tout : réponses, réglage d'animation, module personnel, préférence
  await page.goto('./#/m/intro/q/ca_intro_scale');
  await page.locator('.choix-item').nth(1).click();
  await page.getByRole('button', { name: 'Valider' }).click();
  await page.getByRole('button', { name: 'À revoir' }).click();
  await page.goto('./#/m/lunarcycles/q/' + MODULES.find((m) => m.cle === 'lunarcycles')!.questions.find((q) => q.ok)!.id);
  await expect(page.locator('.choix-item').first()).toBeVisible();
  await page.locator('.choix-item').first().click();
  await page.getByRole('button', { name: 'Valider' }).click();
  await page.goto('./#/a/longlat');
  const curseur = page.locator('.reglages input[type="range"]').first();
  await curseur.focus();
  await page.keyboard.press('ArrowRight');
  await page.goto('./#/m/intro/fiches');
  await page.locator('#panneau-fiches .menu-boite button').first().click();
  await page.getByRole('menuitem', { name: /Nouvelle collection/ }).click();
  await page.waitForTimeout(600);
  await page.goto('./#/progression');
  let brut = '';
  const exporter = async (): Promise<Record<string, unknown>> => {
    const tel = page.waitForEvent('download');
    await page.getByRole('button', { name: /^Exporter/ }).click();
    brut = readFileSync((await (await tel).path())!, 'utf-8');
    const doc = JSON.parse(brut);
    delete doc.modifie;
    delete doc.application;
    return doc;
  };
  const a = await exporter();
  const fichierA = brut;
  expect(Object.keys(a.questions as object).length).toBe(2);
  expect(Object.keys(a.animations as object).length).toBe(1);
  expect((a.mes_modules as unknown[]).length).toBe(1);
  // tout effacer
  await page.locator('#raz-partie').selectOption('tout');
  await page.locator('.bouton.danger', { hasText: 'Réinitialiser' }).click();
  await page.locator('#dlg-option').uncheck();
  await page.locator('dialog .bouton.danger').click();
  await expect(page.locator('.chiffres')).toContainText('0 / ');
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.locator('.chiffres')).toContainText('0 / ');
  // « tout » efface aussi les préférences (langue) : revenir au français
  if ((await page.locator('html').getAttribute('lang')) !== 'fr') {
    await page.getByRole('button', { name: 'Français' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  }
  await expect(page.locator('#import-mode option').first()).toHaveText(/fusionner/);
  await page.waitForTimeout(500);
  // importer (remplacer)
  // (contenu passé directement : un chemin non ASCII n'est pas transmis par Chromium)
  const fichier = { name: 'coupole-sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(fichierA, 'utf-8') };
  await page.locator('#import-mode').selectOption('remplacer');
  await page.locator('#import-fichier').setInputFiles(fichier);
  await page.locator('#dlg-option').uncheck();
  await page.locator('dialog .bouton.danger').click();
  await expect(page.locator('.annonce', { hasText: /Importé/ })).toBeVisible();
  await page.waitForTimeout(600);
  await page.reload();
  const b = await exporter();
  expect(b).toEqual(a);
  expect(s.erreurs).toEqual([]);
});

// ------------------------------------------------------------------ langue en cours de route
test('changer de langue en cours de route garde la question, sa variante et les réglages', async ({ page }) => {
  const s = await surveiller(page);
  const q = MODULES.flatMap((m) => m.questions.filter((x) => x.ok).map((x) => [m.cle, x.id] as const)).find(([, id]) => id === 'ca_intro_scale')!;
  await page.goto(`./#/m/${q[0]}/q/${q[1]}`);
  const menu = page.locator('.menus-question select').first();
  await expect(menu.locator('option').nth(1)).toBeAttached();
  const vals = await menu.locator('option').evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value));
  await menu.selectOption(vals[vals.length - 1]!);
  const url = page.url();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('.actions-question')).toContainText('Show answer');
  expect(page.url()).toBe(url);
  await expect(page.locator('.menus-question select').first()).toHaveValue(vals[vals.length - 1]!);
  await page.goto('./#/a/longlat?latitude=-33.9');
  await expect(page.locator('.valeurs dd').first()).toContainText('S');
  await page.getByRole('button', { name: 'Français' }).click();
  await expect(page.locator('.valeurs dd').first()).toContainText('33,90° S');
  expect(page.url()).toContain('latitude=-33.9');
  expect(s.erreurs).toEqual([]);
});

// ------------------------------------------------------------------ hors ligne
test('hors ligne : modules et questions déjà vus ; état « hors ligne » sinon', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'service worker piloté hors ligne : Chromium');
  await page.goto('./');
  await page.evaluate(async () => !!(await navigator.serviceWorker.ready).active);
  await page.reload();
  await page.goto('./#/m/intro');
  await expect(page.locator('h1')).toHaveText('Notions de base');
  await page.goto('./#/m/intro/q/ca_intro_scale');
  await expect(page.locator('.figure-question svg')).toBeVisible();
  await page.waitForTimeout(500);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.figure-question svg')).toBeVisible();
  await page.goto('./#/m/intro');
  await expect(page.locator('h1')).toHaveText('Notions de base');
  await page.goto('./#/r/fiche/' + readdirSync(C + 'fiches').at(-1)!.replace(/\.json$/, ''));
  await expect(page.locator('.etat-message')).toContainText('Hors ligne');
  await context.setOffline(false);
});

// ------------------------------------------------------------------ rien ne se dessine au repos hors des animations
test('pages sans animation : aucune image dessinée au repos', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium-bureau', 'une fois suffit');
  await page.addInitScript(() => {
    const w = window as unknown as { __raf: number };
    w.__raf = 0;
    const o = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (f) => {
      w.__raf++;
      return o(f);
    };
  });
  const fautes: string[] = [];
  for (const h of ['#/', '#/m/intro', '#/m/intro/q/ca_intro_scale', '#/r/fiche/ancientastro_eratosthene', '#/mes-modules', '#/progression', '#/apropos', '#/recherche?q=lune']) {
    await page.goto('./' + h);
    await page.waitForTimeout(1500);
    const r0 = await page.evaluate(() => (window as unknown as { __raf: number }).__raf);
    await page.waitForTimeout(1000);
    const n = (await page.evaluate(() => (window as unknown as { __raf: number }).__raf)) - r0;
    if (n > 1) fautes.push(`${h} : ${n} images en 1 s`);
  }
  expect(fautes).toEqual([]);
});
