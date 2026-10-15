/**
 * Installer Coupole Web comme une application, proprement et sans harceler.
 *  - Chrome, Edge, Opera, Samsung Internet (Android et ordinateur) : l'invite du navigateur (`beforeinstallprompt`)
 *    est captée au démarrage, puis déclenchée au clic sur « Installer » (bannière discrète ou bouton de l'en-tête) ;
 *  - Safari sur iPhone et iPad (pas d'API) : fiche illustrée « Partager → Sur l'écran d'accueil » ; Safari 17+ sur
 *    macOS : « Fichier → Ajouter au Dock » ; Firefox Android : menu ⋮ → « Installer » ;
 *  - Firefox pour ordinateur et autres : pas de proposition spontanée ; la page « À propos → Installer
 *    l'application » explique ce qui est possible.
 * Règles (installation_regles.ts) : après la 2ᵉ visite ou 30 s d'utilisation ; « Plus tard » = 30 jours ; « Ne plus
 * proposer » ; rien si déjà installée (display-mode standalone, navigator.standalone).
 */
import { tr } from '../i18n/i18n';
import { ajouter, annoncer, h, icone } from './dom';
import * as prefs from './prefs';
import { doitProposer, ETAT_VIDE, etatValide, type EtatInstallation, plateforme, type Plateforme, proposable, SECONDES_USAGE } from './installation_regles';

interface InviteInstallation extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const CLE = 'installation';
let invite: InviteInstallation | null = null;
const abonnes = new Set<() => void>();
let banniere: HTMLElement | null = null;

function signaler(): void {
  for (const f of abonnes) f();
}

/** Abonnement aux changements (invite captée, installée) : le bouton de l'en-tête et la page À propos suivent. */
export function suivre(f: () => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

export function installee(): boolean {
  try {
    if (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches || matchMedia('(display-mode: fullscreen)').matches) return true;
  } catch {
    /* rien */
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function laPlateforme(): Plateforme {
  return plateforme({ ua: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints });
}

export function inviteDisponible(): boolean {
  return invite !== null;
}

/** Installer est-il possible ici, et comment : invite du navigateur ou instructions. */
export function possible(): boolean {
  return !installee() && proposable(laPlateforme(), invite !== null);
}

function lireEtat(): EtatInstallation {
  return etatValide(prefs.lire<unknown>(CLE, ETAT_VIDE));
}

function ecrireEtat(e: EtatInstallation): void {
  prefs.ecrire(CLE, e);
}

/** Déclenche l'installation : invite du navigateur si elle existe, sinon la fiche d'instructions. */
export async function installer(): Promise<void> {
  if (invite) {
    const i = invite;
    invite = null;
    fermerBanniere();
    try {
      await i.prompt();
      const choix = await i.userChoice;
      if (choix.outcome === 'dismissed') ecrireEtat({ ...lireEtat(), plusTard: Date.now() });
    } catch {
      /* invite déjà utilisée */
    }
    signaler();
    return;
  }
  ouvrirFiche();
}

// ------------------------------------------------------------------ fiche d'instructions
/** Étapes illustrées pour une plateforme (aussi utilisées par la page À propos). */
export function etapes(p: Plateforme): HTMLElement {
  const etape = (ico: Parameters<typeof icone>[0] | null, ...t: (string | Node)[]): HTMLElement => h('li', {}, ico ? h('span', { class: 'etape-icone', 'aria-hidden': 'true' }, icone(ico)) : null, h('span', {}, ...t));
  if (p === 'ios') {
    return h('ol', { class: 'etapes-installation' },
      etape('partager_ios', h('b', { text: tr('web_installer_ios_1') }), ' ', tr('web_installer_ios_1b')),
      etape('ajouter_ecran', h('b', { text: tr('web_installer_ios_2') })),
      etape('valider', tr('web_installer_ios_3')));
  }
  if (p === 'mac-safari') return h('ol', { class: 'etapes-installation' }, etape('telecharger', h('b', { text: tr('web_installer_mac_1') })), etape('valider', tr('web_installer_mac_2')));
  if (p === 'firefox-android') return h('ol', { class: 'etapes-installation' }, etape('menu_points', tr('web_installer_firefox_android_1')), etape('ajouter_ecran', h('b', { text: tr('web_installer_firefox_android_2') })));
  if (p === 'firefox') return h('p', { text: tr('web_installer_firefox') });
  if (p === 'chromium') return h('p', { text: tr('web_installer_chrome') });
  return h('p', { text: tr('web_installer_autre') });
}

export function titreEtapes(p: Plateforme): string {
  return tr({ ios: 'web_installer_ios_titre', 'mac-safari': 'web_installer_mac_titre', 'firefox-android': 'web_installer_firefox_android_titre', firefox: 'web_installer_firefox_titre', chromium: 'web_installer_chrome_titre', autre: 'web_installer_autre_titre' }[p]);
}

function ouvrirFiche(): void {
  const p = laPlateforme();
  const d = h('dialog', { class: 'dialogue fiche-installation', 'aria-labelledby': 'fiche-installation-titre' });
  const fermer = h('button', { type: 'button', class: 'bouton principal', text: tr('web_fermer_fiche') });
  const ios = p === 'ios' && /CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
  ajouter(d, [
    h('h2', { id: 'fiche-installation-titre' }, icone('installer'), tr('web_installer_titre')),
    h('p', { class: 'sous-titre', text: titreEtapes(p) }),
    ios ? h('p', { class: 'aide', text: tr('web_installer_ios_autre') }) : null,
    etapes(p),
    h('div', { class: 'dialogue-boutons' }, h('a', { class: 'bouton discret', href: '#/apropos?installer', text: tr('web_installer_tous') }), fermer),
  ]);
  const terminer = (): void => {
    d.close();
    d.remove();
  };
  fermer.addEventListener('click', terminer);
  d.querySelector('a')!.addEventListener('click', terminer);
  d.addEventListener('cancel', (ev) => {
    ev.preventDefault();
    terminer();
  });
  document.body.append(d);
  try {
    d.showModal();
  } catch {
    d.setAttribute('open', '');
  }
  fermer.focus();
}

// ------------------------------------------------------------------ bannière discrète
function fermerBanniere(): void {
  banniere?.remove();
  banniere = null;
}

function montrerBanniere(): void {
  if (banniere || !possible()) return;
  const b = h('section', { class: 'banniere-installation', role: 'region', 'aria-label': tr('web_installer') });
  const oui = h('button', { type: 'button', class: 'bouton principal' }, icone('installer'), tr(invite ? 'web_installer_court' : 'web_installer_comment'));
  const tard = h('button', { type: 'button', class: 'bouton discret', text: tr('web_plus_tard') });
  const jamais = h('button', { type: 'button', class: 'bouton discret', text: tr('web_ne_plus_proposer') });
  oui.addEventListener('click', () => void installer());
  tard.addEventListener('click', () => {
    ecrireEtat({ ...lireEtat(), plusTard: Date.now() });
    fermerBanniere();
  });
  jamais.addEventListener('click', () => {
    ecrireEtat({ ...lireEtat(), jamais: true });
    fermerBanniere();
  });
  b.append(h('img', { src: 'icons/icone-192.png', alt: '', width: 40, height: 40 }), h('p', { text: tr('web_installer_banniere') }), h('div', { class: 'banniere-boutons' }, oui, tard, jamais));
  banniere = b;
  // dans la zone des annonces (en bas, au-dessus de la barre de navigation) : les annonces s'empilent au-dessus
  const zone = document.getElementById('annonces');
  if (zone) zone.prepend(b);
  else document.body.append(b);
}

function examiner(): void {
  if (doitProposer(lireEtat(), Date.now(), installee(), possible())) montrerBanniere();
}

// ------------------------------------------------------------------ démarrage
let demarre = false;

/** À appeler tout au début (avant l'affichage) : capte l'invite, compte la visite et le temps d'utilisation. */
export function demarrer(): void {
  if (demarre || typeof window === 'undefined') return;
  demarre = true;
  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault(); // pas de mini-barre du navigateur : notre bannière, au bon moment
    invite = ev as InviteInstallation;
    signaler();
    examiner();
  });
  window.addEventListener('appinstalled', () => {
    invite = null;
    fermerBanniere();
    annoncer(tr('web_installee'));
    signaler();
  });
  // une visite par session
  let nouvelle = true;
  try {
    nouvelle = sessionStorage.getItem('coupole-web:visite') === null;
    sessionStorage.setItem('coupole-web:visite', '1');
  } catch {
    /* rien */
  }
  if (nouvelle) ecrireEtat({ ...lireEtat(), visites: lireEtat().visites + 1 });
  // temps d'utilisation (page visible), compté par pas de 5 s jusqu'à 30 s
  let compteur = 0;
  const pas = window.setInterval(() => {
    if (document.hidden) return;
    const e = lireEtat();
    if (e.utilise >= SECONDES_USAGE) {
      clearInterval(pas);
      examiner();
      return;
    }
    ecrireEtat({ ...e, utilise: e.utilise + 5 });
    if (++compteur > 12) clearInterval(pas);
  }, 5000);
  setTimeout(examiner, 1500);
}
