/* Service worker de Coupole Web (modèle : la liste des fichiers et la version sont écrites à la construction).
   Tout le site est mis en cache à l'installation : il fonctionne ensuite entièrement hors ligne.  Une nouvelle
   version attend que l'utilisateur accepte la mise à jour (message « activer »). */
const VERSION = '__VERSION__';
const CACHE = 'coupole-web-' + VERSION;
const FICHIERS = __FICHIERS__;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(FICHIERS.map((f) => new Request(f, { cache: 'reload' }))),
    ),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((k) => k.startsWith('coupole-web-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'activer') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // navigation : la page d'accueil en cache (l'adresse de l'animation est dans le fragment)
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('index.html', { cacheName: CACHE, ignoreVary: true }).then((r) => r || fetch(req)),
    );
    return;
  }
  e.respondWith(
    caches.match(req, { cacheName: CACHE, ignoreSearch: true, ignoreVary: true }).then(
      (r) =>
        r ||
        fetch(req).then((rep) => {
          if (rep.ok && rep.type === 'basic') {
            const copie = rep.clone();
            caches.open(CACHE).then((c) => c.put(req, copie));
          }
          return rep;
        }),
    ),
  );
});
