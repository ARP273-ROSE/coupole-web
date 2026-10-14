/**
 * Coupole Web : démarrage (langue, thème), en-tête, pages selon l'adresse, service worker (hors ligne, mise à jour
 * proposée).  Tout est servi par le site lui-même : aucune requête vers un autre domaine.
 */
import './styles/app.css';
import { chargerCatalogue, choisirLangue, type Langue, langue, langueDuNavigateur, LANGUES, tr } from './i18n/i18n';
import { annoncer, h, icone } from './app/dom';
import { type Page, pageApropos } from './app/page_apropos';
import { pageCatalogue } from './app/page_catalogue';
import * as prefs from './app/prefs';
import { lireRoute, type Route } from './app/routeur';

type ChoixTheme = 'auto' | 'sombre' | 'clair';

const racine = document.documentElement;
const contenu = document.getElementById('contenu')!;
let page: Page | null = null;
let jeton = 0;

// ------------------------------------------------------------------ thème
let choixTheme: ChoixTheme = ((): ChoixTheme => {
  const v = prefs.lire<string>('theme', 'auto');
  return v === 'sombre' || v === 'clair' ? v : 'auto';
})();
const clairSysteme = matchMedia('(prefers-color-scheme: light)');

function appliquerTheme(): void {
  const t = choixTheme === 'auto' ? (clairSysteme.matches ? 'clair' : 'sombre') : choixTheme;
  if (racine.dataset.theme !== t) {
    racine.dataset.theme = t;
    window.dispatchEvent(new Event('coupole:theme'));
  }
  const meta = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  meta.forEach((m) => {
    m.content = t === 'clair' ? '#F4F3EF' : '#14171C';
    m.removeAttribute('media');
  });
}
clairSysteme.addEventListener('change', appliquerTheme);
appliquerTheme();

// ------------------------------------------------------------------ langue
function langueDepart(): Langue {
  const v = prefs.lire<string>('langue', '');
  return (LANGUES as readonly string[]).includes(v) ? (v as Langue) : langueDuNavigateur();
}

// ------------------------------------------------------------------ en-tête
function construireEntete(): void {
  const nav = document.getElementById('nav')!;
  const outils = document.getElementById('outils')!;
  nav.setAttribute('aria-label', tr('web_nav'));
  nav.replaceChildren(
    h('a', { href: '#/', 'data-page': 'catalogue', text: tr('web_nav_catalogue') }),
    h('a', { href: '#/apropos', 'data-page': 'apropos', text: tr('web_nav_apropos') }),
  );
  document.querySelector('.marque')?.setAttribute('aria-label', tr('web_marque_aide'));
  const evitement = document.querySelector('.evitement');
  if (evitement) evitement.textContent = tr('web_evitement');

  const seg = h('div', { class: 'segmente', role: 'group', 'aria-label': tr('web_langue') });
  for (const l of LANGUES) {
    const b = h('button', { type: 'button', lang: l, 'aria-pressed': String(l === langue()), text: l.toUpperCase() });
    b.setAttribute('aria-label', l === 'fr' ? 'FR – Français' : 'EN – English');
    b.addEventListener('click', () => void changerLangue(l));
    seg.append(b);
  }
  const bTheme = h('button', { type: 'button', class: 'bouton icone discret' });
  const majTheme = (): void => {
    bTheme.replaceChildren(icone(choixTheme === 'auto' ? 'auto' : choixTheme === 'sombre' ? 'lune' : 'soleil'));
    const t = tr('web_theme_' + choixTheme);
    bTheme.setAttribute('aria-label', t);
    bTheme.title = t;
  };
  bTheme.addEventListener('click', () => {
    choixTheme = choixTheme === 'auto' ? 'sombre' : choixTheme === 'sombre' ? 'clair' : 'auto';
    prefs.ecrire('theme', choixTheme);
    appliquerTheme();
    majTheme();
  });
  majTheme();
  outils.replaceChildren(seg, bTheme);
}

async function changerLangue(l: Langue): Promise<void> {
  if (l === langue()) return;
  prefs.ecrire('langue', l);
  await chargerCatalogue(l);
  choisirLangue(l);
  racine.lang = l;
  construireEntete();
  await afficher(lireRoute(), false);
}

// ------------------------------------------------------------------ pages
function marquerNav(route: Route): void {
  document.querySelectorAll<HTMLAnchorElement>('#nav a').forEach((a) => {
    const actif = a.dataset.page === route.page;
    if (actif) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

async function afficher(route: Route, deplacerFocus = true): Promise<void> {
  const n = ++jeton;
  let nouvelle: Page;
  if (route.page === 'animation') {
    if (!page) contenu.replaceChildren(h('p', { class: 'page', text: tr('web_chargement') }));
    const m = await import('./app/page_animation');
    nouvelle = await m.pageAnimation(route.id, route.etat);
  } else if (route.page === 'apropos') nouvelle = pageApropos();
  else nouvelle = pageCatalogue(route.q, route.theme);
  if (n !== jeton) {
    nouvelle.detruire();
    return;
  }
  page?.detruire();
  page = nouvelle;
  contenu.replaceChildren(nouvelle.el);
  document.title = nouvelle.titre;
  marquerNav(route);
  if (deplacerFocus) {
    window.scrollTo(0, 0);
    contenu.focus({ preventScroll: true });
  }
}

window.addEventListener('hashchange', () => void afficher(lireRoute()));

// ------------------------------------------------------------------ service worker
function enregistrerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const dejaControle = !!navigator.serviceWorker.controller;
  let recharger = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recharger) location.reload();
  });
  const proposer = (sw: ServiceWorker): void => {
    annoncer(
      tr('web_maj'),
      {
        libelle: tr('web_maj_bouton'),
        faire: () => {
          recharger = true;
          sw.postMessage({ type: 'activer' });
        },
      },
      0,
    );
  };
  const enregistrer = (): void => {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((reg) => {
        if (reg.waiting && dejaControle) proposer(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const nouveau = reg.installing;
          if (!nouveau) return;
          nouveau.addEventListener('statechange', () => {
            if (nouveau.state !== 'installed') return;
            if (navigator.serviceWorker.controller) proposer(nouveau);
            else annoncer(tr('web_hors_ligne_pret'));
          });
        });
        // vérifier les mises à jour quand on revient sur l'onglet
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) void reg.update().catch(() => {});
        });
      })
      .catch(() => {});
  };
  if (document.readyState === 'complete') enregistrer();
  else window.addEventListener('load', enregistrer, { once: true });
}

// ------------------------------------------------------------------ démarrage
async function demarrer(): Promise<void> {
  const l = langueDepart();
  await chargerCatalogue(l);
  // l'autre langue sert à la recherche (noms et descriptions FR et EN)
  void chargerCatalogue(l === 'fr' ? 'en' : 'fr');
  choisirLangue(l);
  racine.lang = l;
  construireEntete();
  await afficher(lireRoute(), false);
  enregistrerServiceWorker();
}

void demarrer();
