/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * Service worker généré à la construction : il connaît la liste exacte des fichiers du site (tous mis en cache à
 * l'installation, hors ligne complet) et une version tirée de leur contenu (une nouvelle version → mise à jour
 * proposée à l'utilisateur).
 */
function serviceWorker(): Plugin {
  return {
    name: 'coupole-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const fichiers = new Set<string>(['./', 'index.html']);
      const h = createHash('sha256');
      for (const [nom, sortie] of Object.entries(bundle)) {
        if (nom.endsWith('.map')) continue;
        fichiers.add(nom);
        h.update(nom);
        h.update(sortie.type === 'chunk' ? sortie.code : (sortie.source as string | Uint8Array));
      }
      const publics = 'public';
      const parcourir = (d: string): void => {
        for (const n of readdirSync(d)) {
          const p = join(d, n);
          if (statSync(p).isDirectory()) parcourir(p);
          else {
            const r = relative(publics, p).split('\\').join('/');
            if (r === 'sw.js' || r.endsWith('.txt') && r !== 'robots.txt') continue;
            fichiers.add(r);
            h.update(r);
            h.update(readFileSync(p));
          }
        }
      };
      parcourir(publics);
      const version = h.digest('hex').slice(0, 12);
      const modele = readFileSync('src/sw/sw.js', 'utf-8');
      const code = modele
        .replace('__VERSION__', version)
        .replace('__FICHIERS__', JSON.stringify([...fichiers].sort()));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: code });
    },
  };
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

/**
 * Sécurité de la page construite : politique de sécurité du contenu (balise meta, aucun script ni style en ligne
 * permis) et empreintes d'intégrité (SRI, sha384) sur le script d'entrée, les préchargements et la feuille de style,
 * calculées sur les fichiers tels qu'écrits dans dist/.
 */
function securite(): Plugin {
  let sortie = 'dist';
  return {
    name: 'coupole-securite',
    apply: 'build',
    configResolved(c) {
      sortie = c.build.outDir;
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(
          '<meta charset="utf-8" />',
          `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
        );
      },
    },
    closeBundle() {
      const page = join(sortie, 'index.html');
      let html: string;
      try {
        html = readFileSync(page, 'utf-8');
      } catch {
        return;
      }
      html = html.replace(/<(script|link)([^>]*?)(src|href)="([^"]+)"([^>]*)>/g, (m, balise, avant, attr, chemin, apres) => {
        if (!/\.(js|css)$/.test(chemin) || /integrity=/.test(m) || /^https?:/.test(chemin)) return m;
        const contenu = readFileSync(join(sortie, chemin.replace(/^\.?\//, '')));
        const sri = 'sha384-' + createHash('sha384').update(contenu).digest('base64');
        const co = /crossorigin/.test(m) ? '' : ' crossorigin';
        return `<${balise}${avant}${attr}="${chemin}"${apres.replace(/\s*\/?$/, '')} integrity="${sri}"${co}>`;
      });
      writeFileSync(page, html);
    },
  };
}

const PAQUET = JSON.parse(readFileSync('package.json', 'utf-8')) as { version: string };

export default defineConfig({
  base: './',
  plugins: [securite(), serviceWorker()],
  define: { __VERSION__: JSON.stringify(PAQUET.version) },
  build: {
    target: 'es2022',
    modulePreload: { polyfill: false },
    assetsInlineLimit: 0,
    cssCodeSplit: true,
    sourcemap: false,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 400,
  },
  server: { host: '0.0.0.0', port: 5173 },
  preview: { host: '0.0.0.0', port: 4173 },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    fsModuleCache: false,
    testTimeout: 60000,
  },
});
