/**
 * Coupole Web : démarrage (langue, thème), en-tête, pages selon l'adresse, service worker (hors ligne, mise à jour
 * proposée).  Tout est servi par le site lui-même : aucune requête vers un autre domaine.
 */
import './styles/app.css';
import { chargerAnimations, chargerCatalogue, choisirLangue, type Langue, langue, langueDuNavigateur, LANGUES, tr } from './i18n/i18n';
import { annoncer, h, icone, pageIntrouvable } from './app/dom';
import { type Page, pageApropos } from './app/page_apropos';
import { pageCatalogue } from './app/page_catalogue';
import { pageAccueil } from './app/page_accueil';
import * as prefs from './app/prefs';
import * as stockage from './app/stockage';
import { lireRoute, type Route } from './app/routeur';
import { charger, PAR_ID } from './anim/registre';

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
  const lien = (href: string, page: string, ico: Parameters<typeof icone>[0], cle: string): HTMLAnchorElement => {
    const a = h('a', { href, 'data-page': page, title: tr(cle) }, icone(ico), h('span', { class: 'nav-texte', text: tr(cle) }));
    return a;
  };
  nav.replaceChildren(
    lien('#/', 'accueil', 'modules', 'web_nav_modules'),
    lien('#/animations', 'catalogue', 'animation', 'web_nav_catalogue'),
    lien('#/mes-modules', 'mes-modules', 'dossier', 'web_nav_mes_modules'),
    lien('#/progression', 'progression', 'progres', 'web_nav_progression'),
    lien('#/apropos', 'apropos', 'info', 'web_nav_apropos'),
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
    stockage.memoriserPreference('theme', choixTheme);
    appliquerTheme();
    majTheme();
  });
  majTheme();
  outils.replaceChildren(seg, bTheme);
}

async function changerLangue(l: Langue): Promise<void> {
  if (l === langue()) return;
  prefs.ecrire('langue', l);
  stockage.memoriserPreference('langue', l);
  await chargerCatalogue(l);
  choisirLangue(l);
  racine.lang = l;
  construireEntete();
  await afficher(lireRoute(), false);
}

// ------------------------------------------------------------------ pages
function marquerNav(route: Route): void {
  const p = route.page === 'module' || route.page === 'question' ? (route.perso ? 'mes-modules' : 'accueil') : route.page === 'animation' ? 'catalogue' : route.page;
  document.querySelectorAll<HTMLAnchorElement>('#nav a').forEach((a) => {
    const actif = a.dataset.page === p;
    if (actif) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

async function afficher(route: Route, deplacerFocus = true): Promise<void> {
  const n = ++jeton;
  let nouvelle: Page;
  if (route.page === 'animation') {
    // ouverture directe : le titre s'affiche tout de suite (même mise en page), l'animation suit
    const e = PAR_ID.get(route.id);
    if (!page)
      contenu.replaceChildren(
        h('div', { class: 'page page-anim' },
          h('nav', { class: 'fil', 'aria-label': tr('web_retour') }, h('a', { href: '#/animations' }, icone('retour'), tr('web_retour')), ...(e ? [h('span', { 'aria-hidden': 'true', text: '·' }), h('span', { text: tr('anim_theme_' + e.theme) })] : [])),
          e ? h('div', { class: 'titre-anim' }, h('h1', { text: tr('anim_nom_' + e.cle) })) : null,
          h('p', { class: 'chargement', role: 'status', text: tr('web_chargement') })));
    const m = await import('./app/page_animation');
    nouvelle = await m.pageAnimation(route.id, route.etat);
  } else if (route.page === 'apropos') nouvelle = pageApropos();
  else if (route.page === 'catalogue') nouvelle = pageCatalogue(route.q, route.theme);
  else if (route.page === 'accueil') {
    await stockage.pret();
    nouvelle = pageAccueil();
  } else {
    if (!page) contenu.replaceChildren(h('div', { class: 'page' }, h('p', { class: 'chargement', role: 'status', text: tr('web_chargement') })));
    try {
      nouvelle = await pageModules(route);
    } catch (err) {
      console.error(err);
      nouvelle = { el: pageIntrouvable(tr('web_ressource_indisponible'), tr), titre: 'Coupole Web', detruire() {} };
    }
  }
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

/** Pages des modules, questions, ressources, recherche, progression : un morceau chargé à la demande. */
async function pageModules(route: Route): Promise<Page> {
  const m = await import('./app/pages_modules');
  return m.page(route);
}

window.addEventListener('hashchange', () => void afficher(lireRoute()));
window.addEventListener('coupole:rafraichir', () => void afficher(lireRoute(), false));
// préférences importées ou effacées : thème et langue suivent la sauvegarde
window.addEventListener('coupole:preferences', () => {
  const t = stockage.preference('theme');
  choixTheme = t === 'sombre' || t === 'clair' ? t : 'auto';
  prefs.ecrire('theme', choixTheme);
  appliquerTheme();
  construireEntete();
  const l = stockage.preference('langue');
  if ((l === 'fr' || l === 'en') && l !== langue()) void changerLangue(l);
});

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
  void stockage.pret();
  // ouverture directe d'une animation : sa page, ses textes et son code se chargent en même temps que l'interface
  const r0 = lireRoute();
  if (r0.page === 'animation') {
    void import('./app/page_animation');
    void chargerAnimations(langueDepart()).catch(() => {});
    const e = PAR_ID.get(r0.id);
    if (e) void charger(e).catch(() => {});
  }
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
