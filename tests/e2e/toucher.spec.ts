/**
 * Au doigt, la toile ne bloque plus la page : un doigt posé sur une scène à tourner (ou à côté des objets) laisse la
 * page défiler ; posé sur un objet (astre, poignée, flèche), il le saisit et la page ne défile pas ; deux doigts
 * tournent la scène (et pincer zoome) ; un appui long saisit la scène (contour accentué).  Décision vérifiée par des
 * événements synthétiques (Chromium et WebKit tactiles), défilement réel par le protocole de Chromium (téléphone).
 */
import { expect, type Page, test } from '@playwright/test';

declare function toucher(type: string, c: Element, id: number, x: number, y: number): Event;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // événement tactile synthétique : Touch et TouchEvent si le moteur les construit (Chromium), sinon un Event
    // annulable (WebKit de bureau) ; la toile ne lit que le nombre de doigts, qu'elle tient aussi des pointeurs
    (window as unknown as { toucher: unknown }).toucher = (type: string, c: Element, id: number, x: number, y: number): Event => {
      try {
        const t = new Touch({ identifier: id, target: c, clientX: x, clientY: y });
        return new TouchEvent(type, { touches: [t], targetTouches: [t], changedTouches: [t], bubbles: true, cancelable: true });
      } catch {
        return new Event(type, { bubbles: true, cancelable: true });
      }
    };
    localStorage.setItem('coupole-web:langue', JSON.stringify('fr'));
    localStorage.setItem('coupole-web:installation', JSON.stringify({ visites: 0, utilise: 0, plusTard: 0, jamais: true }));
  });
});

/** pointerdown puis touchstart (l'ordre des navigateurs) au point (x, y) de la toile : touchstart empêché ? */
async function poser(page: Page, x: number, y: number, id = 11): Promise<boolean> {
  return page.evaluate(
    ([x, y, id]) => {
      const c = document.querySelector('.scene canvas') as HTMLCanvasElement;
      const r = c.getBoundingClientRect();
      const X = r.left + x,
        Y = r.top + y;
      c.dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, pointerType: 'touch', isPrimary: id === 11, clientX: X, clientY: Y, bubbles: true, cancelable: true, buttons: 1 }));
      const ev = toucher('touchstart', c, id, X, Y);
      c.dispatchEvent(ev);
      return ev.defaultPrevented;
    },
    [x, y, id] as const,
  );
}

async function bouger(page: Page, x: number, y: number, id = 11): Promise<boolean> {
  return page.evaluate(
    ([x, y, id]) => {
      const c = document.querySelector('.scene canvas') as HTMLCanvasElement;
      const r = c.getBoundingClientRect();
      const X = r.left + x,
        Y = r.top + y;
      c.dispatchEvent(new PointerEvent('pointermove', { pointerId: id, pointerType: 'touch', isPrimary: id === 11, clientX: X, clientY: Y, bubbles: true, cancelable: true, buttons: 1 }));
      const ev = toucher('touchmove', c, id, X, Y);
      c.dispatchEvent(ev);
      return ev.defaultPrevented;
    },
    [x, y, id] as const,
  );
}

async function lever(page: Page, x: number, y: number, id = 11): Promise<void> {
  await page.evaluate(
    ([x, y, id]) => {
      const c = document.querySelector('.scene canvas') as HTMLCanvasElement;
      const r = c.getBoundingClientRect();
      c.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, pointerType: 'touch', isPrimary: id === 11, clientX: r.left + x, clientY: r.top + y, bubbles: true, cancelable: true }));
    },
    [x, y, id] as const,
  );
}

/** empreinte grossière de la toile (somme des pixels d'une grille) */
async function empreinte(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector('.scene canvas') as HTMLCanvasElement;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4 * 97) s += d[i]! * 3 + d[i + 1]! * 5 + d[i + 2]! * 7;
    return s;
  });
}

async function valeur(page: Page, cle: string): Promise<string> {
  return page.evaluate((c) => {
    const dt = [...document.querySelectorAll('dl.valeurs dt')].find((d) => d.textContent?.trim() === c);
    return dt?.nextElementSibling?.textContent?.trim() ?? '';
  }, cle);
}

test('un doigt : la scène à tourner laisse défiler, un objet est saisi ; appui long, deux doigts', async ({ page, browserName }) => {
  test.skip(!test.info().project.use.hasTouch || browserName === 'firefox', 'doigt : Chromium et WebKit tactiles');
  // scène à tourner : la Grande Ourse en 3D
  await page.goto('./#/a/bigdipper');
  const toile = page.locator('.scene canvas');
  await expect.poll(async () => (await toile.boundingBox())?.width ?? 0).toBeGreaterThan(100);
  await page.waitForTimeout(600);
  const bb = (await toile.boundingBox())!;
  const cx = bb.width / 2,
    cy = bb.height / 2;
  expect(await poser(page, cx, cy)).toBe(false); // la page peut défiler
  expect(await bouger(page, cx, cy + 30)).toBe(false);
  await lever(page, cx, cy + 30);
  // appui long : la scène est saisie (contour), le défilement est bloqué, elle tourne
  const avant = await empreinte(page);
  expect(await poser(page, cx, cy)).toBe(false);
  await page.waitForTimeout(450);
  await expect(page.locator('.scene.saisie')).toHaveCount(1);
  expect(await bouger(page, cx + 40, cy)).toBe(true);
  await bouger(page, cx + 80, cy + 10);
  await lever(page, cx + 80, cy + 10);
  await expect(page.locator('.scene.saisie')).toHaveCount(0);
  await expect.poll(() => empreinte(page)).not.toBe(avant);
  // deux doigts : la scène tourne
  const avant2 = await empreinte(page);
  await poser(page, cx - 40, cy, 11);
  expect(await poser(page, cx + 40, cy, 12)).toBe(true);
  for (let i = 1; i <= 5; i++) {
    await bouger(page, cx - 40 + 12 * i, cy, 11);
    await bouger(page, cx + 40 + 12 * i, cy, 12);
  }
  await lever(page, cx + 20, cy, 12);
  await lever(page, cx + 100, cy, 11);
  await expect.poll(() => empreinte(page)).not.toBe(avant2);
  // aide contextuelle une seule fois
  expect(await page.evaluate(() => localStorage.getItem('coupole-web:aide-deux-doigts'))).toBe('1');

  // objet : la Terre de « Gravité et orbites » est saisie au doigt, la page ne défile pas, la Terre bouge
  await page.goto('./#/a/gravityorbits');
  await expect.poll(() => valeur(page, 'Distance Terre–Soleil')).toMatch(/^1,0000 ua/);
  const t = JSON.parse((await toile.getAttribute('data-titres'))!)[0];
  const [px, py, pw, ph] = t.panneau as number[];
  const hTitre = (t.boite as number[])[3]! / 0.95;
  const r = { x: px + 8, y: py + 10 + hTitre, w: pw - 16, h: ph - 18 - hTitre };
  const L = 0.44 * Math.min(r.w, r.h);
  const tx = r.x + r.w / 2 + L,
    ty = r.y + r.h / 2;
  expect(await poser(page, tx, ty)).toBe(true);
  expect(await bouger(page, tx - 30, ty)).toBe(true);
  await bouger(page, tx - 50, ty);
  await lever(page, tx - 50, ty);
  await expect.poll(() => valeur(page, 'Distance Terre–Soleil')).not.toMatch(/^1,0000 ua/);
  // à côté des astres, la page défile
  expect(await poser(page, r.x + 10, r.y + r.h - 10)).toBe(false);
  await lever(page, r.x + 10, r.y + r.h - 10);
});

test('défilement réel de la page en partant de la toile (Chromium, téléphone)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium' || test.info().project.name !== 'chromium-telephone', 'protocole de Chromium');
  await page.goto('./#/a/bigdipper');
  const toile = page.locator('.scene canvas');
  await expect.poll(async () => (await toile.boundingBox())?.width ?? 0).toBeGreaterThan(100);
  await page.waitForTimeout(600);
  const bb = (await toile.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const x = bb.x + bb.width / 2;
  const y0 = bb.y + bb.height * 0.7;
  const glisser = async (dy: number): Promise<void> => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - (dy * i) / 10 }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const s0 = await page.evaluate(() => window.scrollY);
  await glisser(200);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(s0 + 50);
});
