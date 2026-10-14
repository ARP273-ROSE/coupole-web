import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout sur le site construit (vite preview) : Chromium, Firefox et WebKit, chacun en format
 * téléphone (iPhone), tablette (iPad) et bureau.  Captures d'écran dans test-results/captures.
 */
const PORT = 4173;
const formats = {
  telephone: { ...devices['iPhone 15'] },
  tablette: { ...devices['iPad (gen 7)'] },
  bureau: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
} as const;

const moteurs = {
  chromium: devices['Desktop Chrome'],
  firefox: devices['Desktop Firefox'],
  webkit: devices['Desktop Safari'],
} as const;

const projets = [];
for (const [moteur, base] of Object.entries(moteurs)) {
  for (const [format, f] of Object.entries(formats)) {
    // Firefox ne gère pas isMobile : on garde la taille, le facteur d'échelle et le tactile
    const { defaultBrowserType: _d, ...reste } = f as Record<string, unknown>;
    const options: Record<string, unknown> = { ...base, ...reste, browserName: moteur };
    if (moteur === 'firefox') delete options.isMobile;
    projets.push({ name: `${moteur}-${format}`, use: options });
  }
}

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 3 : 6,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/resultats.json' }]],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  projects: projets,
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
