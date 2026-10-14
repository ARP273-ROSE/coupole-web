/**
 * Bout en bout, sur le site construit : catalogue, recherche, filtres, ouverture de chaque animation (toile dessinée,
 * valeurs affichées, aucune erreur), réglages qui changent les valeurs et l'adresse partageable, mémoire, langue,
 * thème, à propos, hors ligne ; aucune requête vers un autre site, aucune violation de la politique de sécurité.
 * Captures d'écran dans test-results/captures/.
 */
import { expect, type Page, test } from '@playwright/test';

const ORIGINE = 'http://localhost:4173';

/**
 * WebKit dessine la liste déroulante native (<select>) avec un style en ligne interne à son ombre (shadow DOM) que la
 * politique de sécurité refuse et signale en console : message du navigateur lui-même, sans effet sur l'affichage
 * (vérifié par capture). Seul ce message précis est ignoré, et seulement sous WebKit.
 */
const WEBKIT_SELECT = /^(console|CSP): Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive/;

async function surveiller(page: Page): Promise<{ erreurs: string[]; externes: string[] }> {
  const webkit = page.context().browser()?.browserType().name() === 'webkit';
  const erreurs: string[] = [];
  const externes: string[] = [];
  page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    const ajoute = (x: string): void => {
      if (!(webkit && WEBKIT_SELECT.test(x))) erreurs.push(x);
    };
    if (m.type() === 'error') ajoute('console: ' + m.text());
    if (/Content[- ]Security[- ]Policy/i.test(m.text())) ajoute('CSP: ' + m.text());
  });
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(ORIGINE) && !u.startsWith('data:') && !u.startsWith('blob:')) externes.push(u);
  });
  return { erreurs, externes };
}

async function capture(page: Page, nom: string): Promise<void> {
  const projet = test.info().project.name;
  await page.screenshot({ path: `test-results/captures/${projet}-${nom}.png`, fullPage: false });
}

/** Nombre de couleurs différentes sur une grille de points de la toile (une toile vide n'en a qu'une). */
async function couleursToile(page: Page, selecteur = '.scene canvas'): Promise<number> {
  return page.evaluate((sel) => {
    const c = document.querySelector(sel) as HTMLCanvasElement | null;
    if (!c) return 0;
    const ctx = c.getContext('2d');
    if (!ctx) return 0;
    const { width: w, height: h } = c;
    const d = ctx.getImageData(0, 0, w, h).data;
    const vues = new Set<number>();
    for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 60)))
      for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 60))) {
        const i = (y * w + x) * 4;
        vues.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
      }
    return vues.size;
  }, selecteur);
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

test('catalogue : cartes, recherche, filtre par thème, vignettes', async ({ page }) => {
  const s = await surveiller(page);
  await page.goto('./');
  await expect(page.locator('h1')).toContainText('Le ciel');
  const cartes = page.locator('a.carte');
  const n = await cartes.count();
  expect(n).toBeGreaterThanOrEqual(1);
  await expect(page.locator('.compte')).toContainText(String(n));
  // vignettes dessinées par les animations
  await expect(page.locator('.vignette canvas.prete').first()).toBeVisible({ timeout: 15_000 });
  await capture(page, 'catalogue');
  // recherche sans accents
  await page.locator('#recherche').fill('latitude');
  await expect(page.locator('a.carte:visible')).not.toHaveCount(0);
  await page.locator('#recherche').fill('zzzzzz');
  await expect(page.locator('.vide')).toBeVisible();
  await page.locator('#recherche').fill('');
  // filtre par thème
  await page.locator('.puce').nth(1).click();
  await expect(page.locator('.puce').nth(1)).toHaveAttribute('aria-pressed', 'true');
  expect(s.erreurs).toEqual([]);
  expect(s.externes).toEqual([]);
});

test('animation : toile, valeurs, réglages, adresse partageable, mémoire', async ({ page }) => {
  const s = await surveiller(page);
  await page.goto('./#/a/longlat');
  await expect(page.locator('h1')).toHaveText('Démonstrateur longitude / latitude');
  await expect(page.locator('.valeurs dd').first()).toHaveText('40,80° N');
  await expect.poll(() => couleursToile(page)).toBeGreaterThan(20);
  await capture(page, 'longlat');
  // le champ numérique change la valeur, l'adresse garde le réglage
  const champ = page.getByRole('textbox', { name: /Latitude/ });
  await champ.fill('-33,5');
  await champ.press('Enter');
  await expect(page.locator('.valeurs dd').first()).toHaveText('33,50° S');
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('latitude=-33.5');
  // l'adresse rouvre le même état (lien partagé)
  await page.goto('./#/a/longlat?latitude=12.25&format=s');
  await page.reload();
  await expect(page.locator('.valeurs dd').first()).toHaveText('12° 15′ 00″ N');
  // réinitialiser
  await page.getByRole('button', { name: 'Réinitialiser' }).click();
  await expect(page.locator('.valeurs dd').first()).toHaveText('40,80° N');
  // glisser sur la toile (rotation du globe) sans erreur
  const toile = page.locator('.scene canvas');
  const b = (await toile.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.4, b.y + b.height * 0.45, { steps: 5 });
  await page.mouse.up();
  // zoom au clavier
  await toile.focus();
  await page.keyboard.press('+');
  await expect(page.locator('.zoom-info')).toBeVisible();
  await page.keyboard.press('0');
  await expect(page.locator('.zoom-info')).toBeHidden();
  expect(s.erreurs).toEqual([]);
  expect(s.externes).toEqual([]);
});

test('langue et thème', async ({ page }) => {
  const s = await surveiller(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('h1')).toContainText('The sky');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const avant = await page.locator('html').getAttribute('data-theme');
  const bouton = page.locator('#outils .bouton.icone');
  for (let i = 0; i < 3; i++) {
    await bouton.click();
    if ((await page.locator('html').getAttribute('data-theme')) !== avant) break;
  }
  expect(await page.locator('html').getAttribute('data-theme')).not.toBe(avant);
  await capture(page, 'catalogue-en-theme');
  await page.getByRole('button', { name: 'Français' }).click();
  await expect(page.locator('h1')).toContainText('Le ciel');
  expect(s.erreurs).toEqual([]);
});

test('à propos : licence et crédit', async ({ page }) => {
  await page.goto('./#/apropos');
  await expect(page.locator('h1')).toHaveText('À propos de Coupole Web');
  await expect(page.locator('article')).toContainText('Apache 2.0');
  await expect(page.locator('article')).toContainText('University of Nebraska-Lincoln');
  await expect(page.locator('a[href="https://github.com/ARP273-ROSE/coupole"]')).toBeVisible();
});

test('chaque animation s’ouvre, se dessine et affiche ses valeurs', async ({ page }) => {
  test.setTimeout(900_000);
  const s = await surveiller(page);
  await page.goto('./');
  let ids = await page.locator('a.carte').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).hash.replace('#/a/', '')));
  // toutes sur les formats bureau ; un échantillon régulier (une sur six) sur téléphone et tablette
  if (!test.info().project.name.endsWith('bureau')) ids = ids.filter((_, i) => i % 6 === 0);
  for (const id of ids) {
    await page.goto(`./#/a/${id}`);
    // la page de l'animation demandée (et non la précédente, encore affichée le temps du chargement)
    const pageAnim = page.locator(`.page-anim[data-anim="${id}"]`);
    await expect(pageAnim.locator('.scene canvas'), `${id} ${s.erreurs.join(' | ')} ${page.url()}`).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => couleursToile(page), { message: id }).toBeGreaterThan(3);
    const lecture = pageAnim.locator('.transport .bouton.principal');
    if (await lecture.count()) {
      await lecture.click();
      await page.waitForTimeout(150);
      await lecture.click();
    }
  }
  expect(s.erreurs).toEqual([]);
  expect(s.externes).toEqual([]);
});

test('titres des panneaux : dans leur panneau, sans recouvrement, titre complet accessible (téléphone)', async ({ page }) => {
  test.skip(!test.info().project.name.endsWith('telephone'), 'format téléphone');
  test.setTimeout(420_000);
  await page.goto('./');
  const ids = await page.locator('a.carte').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).hash.replace('#/a/', '')));
  const fautes: string[] = [];
  for (const id of ids) {
    await page.goto(`./#/a/${id}`);
    const toile = page.locator('.scene canvas');
    await expect(toile).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => couleursToile(page), { message: id }).toBeGreaterThan(3);
    // mise en page stable : deux lectures identiques à 250 ms d'écart
    let avant = '';
    await expect
      .poll(async () => {
        const v = (await toile.getAttribute('data-titres')) ?? '';
        const stable = v !== '' && v === avant;
        avant = v;
        return stable;
      }, { message: id, intervals: [250] })
      .toBe(true);
    const t = JSON.parse(avant) as { boite: number[]; panneau: number[]; complet: string; abrege: boolean }[];
    const etiquette = (await toile.getAttribute('aria-label')) ?? '';
    for (const [j, u] of t.entries()) {
      const [x, y, w, h] = u.boite as [number, number, number, number];
      const [px, py, pw, ph] = u.panneau as [number, number, number, number];
      if (x < px + 4 || x + w > px + pw - 4 || y < py || y + h > py + ph) fautes.push(`${id} : titre ${j} « ${u.complet} » hors de son panneau`);
      if (!etiquette.includes(u.complet)) fautes.push(`${id} : « ${u.complet} » absent du libellé accessible`);
      for (const v of t.slice(j + 1)) {
        const [a, b, c, d] = v.boite as [number, number, number, number];
        const ww = Math.min(x + w, a + c) - Math.max(x, a),
          hh = Math.min(y + h, b + d) - Math.max(y, b);
        if (ww > 0.5 && hh > 0.5) fautes.push(`${id} : « ${u.complet} » et « ${v.complet} » se recouvrent`);
      }
    }
    if (id === 'venusphases' || id === 'ptolemaic') await capture(page, `titres-${id}`);
  }
  expect(fautes).toEqual([]);
});

test('machine d’Anticythère : cadrans, enveloppe, faces, roue touchée, lecture, lien croisé, durée de rendu', async ({ page }) => {
  test.setTimeout(120_000);
  const s = await surveiller(page);
  await page.goto('./#/a/antikythera');
  await expect(page.locator('h1')).toHaveText('La machine d’Anticythère');
  await expect(page.locator('.titre-anim .origine')).toContainText('Anticythere3D');
  const lien = page.locator('.lien-croise a');
  await expect(lien).toHaveAttribute('href', 'https://github.com/ARP273-ROSE/Anticythere3D');
  await expect(lien).toHaveText('Application complète : Anticythere3D');
  const dd = page.locator('.valeurs dd');
  await expect(dd.first()).toHaveText('12/08/2026 (grégorien)');
  await expect(dd.nth(1)).toHaveText('Choiak 28');
  await expect.poll(() => couleursToile(page)).toBeGreaterThan(20);
  await capture(page, 'anticythere-avant');
  // +1 an : la date avance d'une année tropique
  await page.getByRole('button', { name: '+1 an' }).click();
  await expect(dd.first()).toHaveText('12/08/2027 (grégorien)');
  // face arrière
  await page.getByRole('combobox', { name: 'Vue' }).selectOption({ label: 'face arrière' });
  await expect.poll(() => couleursToile(page)).toBeGreaterThan(20);
  await capture(page, 'anticythere-arriere');
  // machine ouverte, trois-quarts : toucher la scène désigne une roue
  await page.getByRole('combobox', { name: 'Vue' }).selectOption({ label: 'trois-quarts' });
  await page.getByRole('switch', { name: 'Enveloppe' }).click();
  const toile = page.locator('.scene canvas');
  await toile.scrollIntoViewIfNeeded();
  const b = (await toile.boundingBox())!;
  const roue = dd.last();
  await expect(roue).toHaveText('survoler une roue (ou la toucher)');
  for (const [fx, fy] of [[0.5, 0.5], [0.45, 0.55], [0.55, 0.45], [0.4, 0.5]]) {
    await page.mouse.click(b.x + b.width * fx!, b.y + b.height * fy!);
    await page.waitForTimeout(300);
    if ((await roue.textContent())?.includes('dents')) break;
  }
  await expect(roue).toContainText('dents');
  await capture(page, 'anticythere-ouverte');
  // glisser fait tourner la machine, sans erreur
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.4, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => couleursToile(page)).toBeGreaterThan(20);
  // lecture : la date avance ; durée de rendu mesurée (moyenne de 15 images)
  const avant = await dd.first().textContent();
  await page.locator('.transport .bouton.principal').click();
  await expect.poll(() => dd.first().textContent(), { timeout: 20_000 }).not.toBe(avant);
  await expect.poll(() => toile.getAttribute('data-ms'), { timeout: 45_000 }).not.toBeNull();
  const ms = Number((await toile.getAttribute('data-ms'))!.split(' ')[0]);
  test.info().annotations.push({ type: 'durée de rendu (ms)', description: String(ms) });
  // garde-fou seulement : rendu logiciel, plusieurs navigateurs en parallèle (mesures propres : PROGRESSION.md)
  expect(ms).toBeLessThan(100);
  await page.locator('.transport .bouton.principal').click();
  expect(s.erreurs).toEqual([]);
  expect(s.externes).toEqual([]);
});

test('Orion en 3D : vue du ciel, dépliement, plongée vers M42 (image et crédit), fiche au survol, durée de rendu', async ({ page }) => {
  test.setTimeout(150_000);
  const s = await surveiller(page);
  await page.goto('./#/a/orion3d');
  await expect(page.locator('h1')).toHaveText('Orion en 3D');
  await expect(page.locator('.lien-croise a')).toHaveAttribute('href', /coupole\/blob\/main\/NOTICE$/);
  const toile = page.locator('.scene canvas');
  await expect.poll(() => couleursToile(page)).toBeGreaterThan(20);
  await capture(page, 'orion-ciel');
  // fiche au clavier : Tab désigne l'étoile la plus brillante (Rigel), Échap ferme
  await toile.focus();
  await page.keyboard.press('Tab');
  const fiche = page.locator('.fiche-objet');
  await expect(fiche).toBeVisible();
  await expect(fiche).toContainText('Rigel');
  await expect(page.locator('.scene [role="status"]')).toContainText('Rigel');
  // jamais par-dessus l'objet : la boîte de la fiche ne touche pas le disque de l'étoile
  const [ox, oy, orr] = ((await fiche.getAttribute('data-objet')) ?? '0 0 0').split(' ').map(Number) as [number, number, number];
  const fb = (await fiche.boundingBox())!;
  const sb = (await page.locator('.scene').boundingBox())!;
  const cx = Math.max(fb.x - sb.x, Math.min(fb.x - sb.x + fb.width, ox));
  const cy = Math.max(fb.y - sb.y, Math.min(fb.y - sb.y + fb.height, oy));
  expect(Math.hypot(cx - ox, cy - oy)).toBeGreaterThanOrEqual(orr);
  await capture(page, 'orion-fiche');
  await page.keyboard.press('ArrowRight');
  await expect(fiche).not.toContainText('Rigel');
  await page.keyboard.press('Escape');
  await expect(fiche).toBeHidden();
  // « Vue 3D » : le dépliement va à 100 % et s'arrête seul
  await page.getByRole('button', { name: 'Vue 3D', exact: true }).click();
  // la transition avance par images (au plus 0,2 s chacune) : lente si le navigateur dessine lentement (WebKit
  // logiciel de la machine d'intégration continue)
  await expect.poll(() => page.locator('.valeurs dd').first().textContent(), { timeout: 90_000 }).toBe('en 3D');
  await expect.poll(() => couleursToile(page)).toBeGreaterThan(20);
  await capture(page, 'orion-3d');
  // durée de rendu en lecture (la scène tourne lentement)
  await page.locator('.transport .bouton.principal').click();
  await expect.poll(() => toile.getAttribute('data-ms'), { timeout: 45_000 }).not.toBeNull();
  const ms = Number((await toile.getAttribute('data-ms'))!.split(' ')[0]);
  test.info().annotations.push({ type: 'durée de rendu Orion 3D (ms)', description: String(ms) });
  expect(ms).toBeLessThan(100);
  await page.locator('.transport .bouton.principal').click();
  // plongée vers M42 : image ESO posée sur le ciel, crédit mot pour mot avec lien actif
  await page.goto('./#/a/orion3d?cible=m42');
  const credit = page.locator('.credits-images a').first();
  await expect(credit).toHaveText('Image : ESO/G. Beccari (CC BY 4.0)', { timeout: 15_000 });
  await expect(credit).toHaveAttribute('href', 'https://www.eso.org/public/images/eso1723a/');
  await expect.poll(() => couleursToile(page), { timeout: 15_000 }).toBeGreaterThan(200);
  await capture(page, 'orion-m42');
  expect(s.erreurs).toEqual([]);
  expect(s.externes).toEqual([]);
});

test('fiches au survol dans les animations à étoiles réelles (Grande Ourse : souris ou doigt)', async ({ page }) => {
  await page.goto('./#/a/bigdipper');
  const toile = page.locator('.scene canvas');
  await expect.poll(() => couleursToile(page)).toBeGreaterThan(20);
  await toile.focus();
  await page.keyboard.press('Tab');
  const fiche = page.locator('.fiche-objet');
  await expect(fiche).toBeVisible();
  await expect(fiche).toContainText('Distance');
  const [ox, oy] = ((await fiche.getAttribute('data-objet')) ?? '0 0 0').split(' ').map(Number) as [number, number];
  await page.keyboard.press('Escape');
  const b = (await toile.boundingBox())!;
  // la souris (ou le doigt) sur l'étoile ouvre la même fiche
  await page.mouse.click(b.x + ox, b.y + oy);
  await expect(fiche).toBeVisible();
  await expect(page.locator('.valeurs')).toContainText('al');
  await capture(page, 'grande-ourse-fiche');
});

test('spectres physiques : courbes, raies nommées, cas signalés ; parallaxe spectroscopique', async ({ page }) => {
  const s = await surveiller(page);
  await page.goto('./#/a/spectrum010');
  await expect(page.locator('.valeurs')).toContainText('5 770 K');
  await expect.poll(() => couleursToile(page)).toBeGreaterThan(40);
  await capture(page, 'spectres');
  await page.goto('./#/a/spectrum010?type=66');
  await expect(page.locator('.valeurs')).toContainText('ATLAS9');
  await page.goto('./#/a/spectroparallax?classe=2&type=30');
  await expect(page.locator('.valeurs')).toContainText('ancien étalonnage');
  await expect.poll(() => couleursToile(page)).toBeGreaterThan(40);
  await capture(page, 'parallaxe-spectro');
  expect(s.erreurs).toEqual([]);
});

test('hors ligne après la première visite', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'service worker piloté hors ligne : Chromium');
  await page.goto('./');
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  await page.reload();
  await expect(page.locator('a.carte').first()).toBeVisible();
  await context.setOffline(true);
  await page.goto('./#/a/longlat');
  await page.reload();
  await expect(page.locator('.valeurs dd').first()).toHaveText('40,80° N');
  await context.setOffline(false);
});

test('formules en MathML : fractions empilées, police mathématique', async ({ page }) => {
  await page.goto('./#/a/synodiccalculator');
  const frac = page.locator('.valeurs math mfrac').first();
  await expect(frac).toBeVisible();
  const b = (await frac.boundingBox())!;
  const ligne = await page.locator('.valeurs dt').first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  // empilée : plus haute qu'une ligne de texte
  expect(b.height).toBeGreaterThan(ligne * 1.4);
  // délimiteurs extensibles (parenthèses qui couvrent toute la hauteur d'une fraction), indices de mots en romain
  await page.goto('./#/a/gravcalc');
  await expect(page.locator('.fiche math').first()).toBeVisible();
  expect(await page.locator('math mo[stretchy="false"]').count()).toBe(0);
  // la police mathématique auto-hébergée se charge (aucune requête externe : vérifié par les autres tests)
  expect(await page.evaluate(async () => (await document.fonts.load("16px 'STIX Two Math'", '∝√')).length)).toBeGreaterThan(0);
  await capture(page, 'formules');
});

test('jour-nuit : vues polaires (pôle Nord, pôle Sud)', async ({ page }) => {
  const s = await surveiller(page);
  await page.goto('./#/a/daylightsimulator?projection=nord');
  await expect(page.locator('.scene canvas')).toBeVisible();
  await expect.poll(() => couleursToile(page)).toBeGreaterThan(3);
  const choix = page.getByLabel('Projection');
  await expect(choix).toBeVisible();
  await expect(page.getByLabel('Vue polaire jusqu’à')).toBeVisible();
  await capture(page, 'jour-nuit-nord');
  await choix.selectOption({ label: 'pôle Sud' });
  await expect.poll(() => page.url()).toContain('projection=sud');
  await expect.poll(() => couleursToile(page)).toBeGreaterThan(3);
  await capture(page, 'jour-nuit-sud');
  await choix.selectOption({ label: 'équirectangulaire' });
  await expect(page.getByLabel('Vue polaire jusqu’à')).toBeHidden();
  expect(s.erreurs).toEqual([]);
  expect(s.externes).toEqual([]);
});

test('jour-nuit : globe 3D qu’on fait tourner dans tous les sens', async ({ page }) => {
  const s = await surveiller(page);
  await page.goto('./#/a/daylightsimulator?projection=globe');
  const toile = page.locator('.scene canvas');
  await expect(toile).toBeVisible();
  await expect.poll(() => couleursToile(page)).toBeGreaterThan(3);
  await expect(page.getByLabel('Axe des pôles')).toBeVisible();
  const empreinte = (): Promise<string> => toile.evaluate((c: HTMLCanvasElement) => c.toDataURL().slice(-200));
  const avant = await empreinte();
  const b = (await toile.boundingBox())!;
  const cx = b.x + b.width / 2,
    cy = b.y + b.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 40, cy + 25, { steps: 5 });
  await page.mouse.up();
  await expect.poll(empreinte).not.toBe(avant);
  await capture(page, 'jour-nuit-globe');
  await toile.dblclick({ position: { x: b.width / 2, y: b.height / 2 } });
  await expect.poll(() => couleursToile(page)).toBeGreaterThan(3);
  expect(s.erreurs).toEqual([]);
  expect(s.externes).toEqual([]);
});

/** Couleurs distinctes au cœur de la toile (une image vide, ou un disque uni, en a très peu). */
async function couleursCentre(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector('.scene canvas') as HTMLCanvasElement;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    const vus = new Set<number>();
    const r = Math.min(c.width, c.height) * 0.3;
    for (let i = 0; i < 30; i++)
      for (let j = 0; j < 30; j++) {
        const x = Math.round(c.width / 2 + ((i - 15) / 15) * r),
          y = Math.round(c.height / 2 + ((j - 15) / 15) * r);
        const k = (y * c.width + x) * 4;
        vus.add((d[k]! << 16) | (d[k + 1]! << 8) | d[k + 2]!);
      }
    return vus.size;
  });
}

for (const [id, requete] of [
  ['daylightsimulator', 'vitesse=4.68&jour=80&heure=13.4&latitude=24.7&longitude=-10.4&projection=globe&tournant=true'],
  ['sunmotions', ''],
  ['configurationssimulator', ''],
] as [string, string][]) {
  test(`glisser vite pendant la lecture ne vide jamais la scène : ${id}`, async ({ page }) => {
    test.setTimeout(120_000);
    const s = await surveiller(page);
    await page.goto(`./#/a/${id}${requete ? '?' + requete : ''}`);
    const toile = page.locator('.scene canvas');
    await expect(toile).toBeVisible();
    const lecture = page.locator('.transport .bouton.principal');
    if ((await lecture.getAttribute('aria-pressed')) !== 'true') await lecture.click();
    const b = (await toile.boundingBox())!;
    const cx = b.x + b.width / 2,
      cy = b.y + b.height / 2;
    let graine = 7;
    const u = (): number => ((graine = (graine * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 40; i++) {
      const x0 = cx + (u() - 0.5) * b.width * 0.4,
        y0 = cy + (u() - 0.5) * b.height * 0.4;
      await page.mouse.move(x0, y0);
      await page.mouse.down();
      await page.mouse.move(x0 + (u() - 0.5) * 300, y0 + (u() - 0.5) * 300, { steps: 1 + (i % 3) });
      await page.mouse.up();
    }
    await page.waitForTimeout(600);
    await expect.poll(() => couleursCentre(page)).toBeGreaterThan(12);
    await capture(page, `glisser-lecture-${id}`);
    expect(s.erreurs).toEqual([]);
  });
}
