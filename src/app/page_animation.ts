/**
 * Page d'une animation : toile, barre de lecture, réglages, valeurs calculées, fiche (description, ce qu'il faut voir,
 * liste des réglages).  Chargée à la demande (morceau séparé) avec l'animation elle-même.
 */
import { Animation, Bouton, type EtatReglages, Reglage } from '../anim/base';
import { charger, disponible, type Entree, PAR_ID } from '../anim/registre';
import { aVoir } from '../i18n/a_voir';
import { chargerAnimations, existe, langue, tr } from '../i18n/i18n';
import { choisirTheme, type Theme } from '../noyau/dessin';
import { annoncer, h, icone } from './dom';
import { texteNombre, type Vue, vueControle } from './controles';
import * as prefs from './prefs';
import { adresseAnimation, remplacerAdresse } from './routeur';
import { Scene } from './scene';
import { enrichir, remplir } from './texte_riche';

export interface Page {
  el: HTMLElement;
  titre: string;
  detruire(): void;
  focus?: HTMLElement;
}

function themeActuel(): Theme {
  return document.documentElement.dataset.theme === 'clair' ? 'clair' : 'sombre';
}

function mouvementReduit(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export async function pageAnimation(id: string, etatAdresse: EtatReglages): Promise<Page> {
  const e = PAR_ID.get(id);
  if (!e) return pageErreur(tr('web_inconnue'));
  if (!disponible(e)) return pageErreur(tr('web_pas_encore'));
  try {
    await chargerAnimations(langue());
    const cls = await charger(e);
    return construire(e, cls, etatAdresse);
  } catch (err) {
    console.error(err);
    return pageErreur(tr('web_erreur', { erreur: err instanceof Error ? err.message : String(err) }));
  }
}

function pageErreur(message: string): Page {
  const el = h(
    'div',
    { class: 'page' },
    h('nav', { class: 'fil', 'aria-label': tr('web_retour') }, h('a', { href: '#/' }, icone('retour'), tr('web_retour'))),
    h('p', { class: 'erreur', role: 'alert', text: message }),
  );
  return { el, titre: 'Coupole Web', detruire() {} };
}

function construire(e: Entree, cls: Awaited<ReturnType<typeof charger>>, etatAdresse: EtatReglages): Page {
  choisirTheme(themeActuel());
  const memoire = prefs.etatValide(prefs.lire('reglages:' + e.id, {}));
  const depart = Object.keys(etatAdresse).length ? etatAdresse : memoire;
  const nom = tr('anim_nom_' + e.cle);

  // ------------------------------------------------------------ squelette
  const zoomTexte = h('span', { 'aria-live': 'polite' });
  const zoomRetour = h('button', { type: 'button', class: 'bouton', text: tr('web_zoom_retour') });
  const zoomInfo = h('div', { class: 'zoom-info' }, zoomTexte, zoomRetour);
  const scene = h('div', { class: 'scene' }, zoomInfo);
  const transport = h('div', { class: 'transport', role: 'toolbar', 'aria-label': nom });
  const sousScene = h('p', { class: 'aide-scene' });
  const reglages = h('div', { class: 'reglages' });
  const valeurs = h('dl', { class: 'valeurs' });
  const blocReglages = h('section', { class: 'bloc', 'aria-labelledby': 'titre-reglages' }, h('h2', { id: 'titre-reglages', text: tr('web_reglages') }), reglages);
  const blocValeurs = h('section', { class: 'bloc', 'aria-labelledby': 'titre-valeurs' }, h('h2', { id: 'titre-valeurs', text: tr('web_valeurs') }), valeurs);
  const fiche = h('section', { class: 'bloc fiche', 'aria-labelledby': 'titre-fiche' }, h('h2', { id: 'titre-fiche', text: tr('web_fiche') }));
  const descId = 'desc-anim';
  const el = h(
    'div',
    { class: 'page page-anim' },
    h(
      'nav',
      { class: 'fil', 'aria-label': tr('web_retour') },
      h('a', { href: '#/' }, icone('retour'), tr('web_retour')),
      h('span', { 'aria-hidden': 'true', text: '·' }),
      h('span', { text: tr('anim_theme_' + e.theme) }),
    ),
    h('div', { class: 'titre-anim' }, h('h1', { text: nom }), nom !== e.titre ? h('span', { class: 'origine', text: tr('web_titre_origine', { titre: e.titre }) }) : null),
    h(
      'div',
      { class: 'anim' },
      h('div', { class: 'scene-boite' }, scene, transport, sousScene),
      h('div', { class: 'panneau' }, blocReglages, blocValeurs, fiche),
    ),
  );

  // ------------------------------------------------------------ animation et toile
  const vues: Vue[] = [];
  let anim: Animation;
  let boutonLecture: HTMLButtonElement | null = null;
  const majLecture = (): void => {
    if (!boutonLecture) return;
    const lit = anim.en_lecture;
    boutonLecture.replaceChildren(icone(lit ? 'pause' : 'lecture'));
    boutonLecture.setAttribute('aria-label', tr(lit ? 'web_pause' : 'web_lecture'));
    boutonLecture.setAttribute('aria-pressed', String(lit));
    boutonLecture.title = tr(lit ? 'web_pause' : 'web_lecture');
  };
  let lignes: [HTMLElement, HTMLElement][] = [];
  const majValeurs = (): void => {
    const v = anim.valeurs();
    if (v.length !== lignes.length) {
      lignes = v.map(() => [h('dt'), h('dd')]);
      valeurs.replaceChildren(...lignes.flat());
    }
    v.forEach(([a, b], i) => {
      const [dt, dd] = lignes[i]!;
      remplir(dt, a);
      remplir(dd, b, true);
    });
    blocValeurs.hidden = v.length === 0;
  };
  const toile = new Scene(scene, {
    valeurs: majValeurs,
    lecture: majLecture,
    zoom: (k) => {
      zoomInfo.classList.toggle('visible', k > 1.001);
      zoomTexte.textContent = `${tr('web_zoom')} ${texteNombre(k, 1)}×`;
    },
  });
  zoomRetour.addEventListener('click', () => toile.zoomer(1, 0, 0, true));
  const c = toile.canvas;
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', tr('web_scene', { nom }));
  c.setAttribute('aria-describedby', descId);

  anim = new cls(depart, toile);
  anim.initialiser();
  if (anim.en_lecture && mouvementReduit()) anim.arreter();
  toile.attacher(anim);

  // ------------------------------------------------------------ barre de lecture
  for (const ctl of anim.controles) {
    if (ctl.groupe !== 'barre') continue;
    if (ctl instanceof Bouton && ctl.cle === 'lecture') {
      boutonLecture = h('button', { type: 'button', class: 'bouton icone principal' });
      boutonLecture.addEventListener('click', () => anim.basculer_lecture());
      transport.append(boutonLecture);
      majLecture();
    } else if (ctl instanceof Reglage && ctl.cle === 'vitesse') {
      const id = 'vitesse-anim';
      const r = ctl;
      const curseur = h('input', { type: 'range', id, min: 0, max: Reglage.PAS, step: 1 });
      const sortie = h('output', { for: id });
      const maj = (): void => {
        const pos = r.pos(r.value());
        curseur.value = String(pos);
        curseur.style.setProperty('--rempli', `${(pos / Reglage.PAS) * 100}%`);
        sortie.textContent = `${texteNombre(r.valeurChamp(), 2)} ×`;
        curseur.setAttribute('aria-valuetext', sortie.textContent);
      };
      curseur.addEventListener('input', () => r.depuisCurseur(Number(curseur.value)));
      curseur.title = r.aide;
      transport.append(h('div', { class: 'vitesse' }, h('label', { for: id, text: tr('web_vitesse') }), curseur, sortie));
      maj();
      vues.push({ el: curseur, detacher: r.observer(maj) });
    } else if (ctl instanceof Bouton && ctl.cle === 'reinitialiser') {
      const b = h('button', { type: 'button', class: 'bouton icone', 'aria-label': tr('web_reinitialiser'), title: ctl.aide || tr('web_reinitialiser') }, icone('reinit'));
      b.addEventListener('click', () => {
        ctl.click();
        toile.zoomer(1, 0, 0, true);
      });
      transport.append(h('span', { class: 'espace' }), b);
    }
  }
  const partager = h('button', { type: 'button', class: 'bouton icone', 'aria-label': tr('web_partager'), title: tr('web_partager') }, icone('partager'));
  partager.addEventListener('click', () => void partagerLien(e, anim));
  transport.append(partager);
  if (document.fullscreenEnabled && typeof scene.requestFullscreen === 'function') {
    const plein = h('button', { type: 'button', class: 'bouton icone', 'aria-label': tr('web_plein_ecran'), title: tr('web_plein_ecran') }, icone('plein'));
    plein.addEventListener('click', () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void scene.requestFullscreen().catch(() => {});
    });
    transport.append(plein);
  }

  // ------------------------------------------------------------ réglages
  const flux = anim.controles.filter((x) => x.groupe === 'flux');
  let groupeBoutons: HTMLElement | null = null;
  for (const ctl of flux) {
    const v = vueControle(ctl);
    vues.push(v);
    if (ctl instanceof Bouton) {
      if (!groupeBoutons) {
        groupeBoutons = h('div', { class: 'boutons-reglages' });
        reglages.append(groupeBoutons);
      }
      groupeBoutons.append(v.el);
    } else {
      groupeBoutons = null;
      reglages.append(v.el);
    }
  }
  blocReglages.hidden = flux.length === 0;

  // ------------------------------------------------------------ fiche
  const desc = h('p', { id: descId }, ...enrichir(tr('anim_desc_' + e.cle)));
  fiche.append(desc);
  const voir = aVoir(e.id, langue());
  if (voir) fiche.append(h('h3', { text: tr('web_a_voir') }), h('p', {}, ...enrichir(voir)));
  const items = flux
    .filter((x) => !(x instanceof Bouton) && 'texte' in x && (x as { texte: string }).texte)
    .map((x) => {
      const t = (x as unknown as { texte: string; aide?: string }).texte;
      const a = (x as unknown as { aide?: string }).aide ?? '';
      return h('li', {}, h('b', {}, ...enrichir(t)), ...(a ? [' — ', ...enrichir(a)] : []));
    });
  if (items.length) fiche.append(h('h3', { text: tr('web_liste_reglages') }), h('ul', {}, ...items));
  // aide propre à l'animation (jamais par-dessus le dessin) : sous la scène et dans la fiche
  const aide = aideInteraction(anim, e.cle);
  sousScene.textContent = aide;
  fiche.append(h('p', { class: 'astuce', text: aide }), h('p', { class: 'credit', text: tr('web_credit_court') }));

  // ------------------------------------------------------------ mémoire et adresse partageable
  let minuteur = 0;
  const memoriser = (): void => {
    clearTimeout(minuteur);
    minuteur = window.setTimeout(() => {
      const modifie = anim.etatModifie();
      prefs.ecrire('reglages:' + e.id, modifie);
      remplacerAdresse(adresseAnimation(e.id, modifie));
    }, 350);
  };
  for (const ctl of anim.controles) vues.push({ el, detacher: ctl.observer(memoriser) });
  if (Object.keys(etatAdresse).length) memoriser();

  // thème : la toile suit la page
  const surTheme = (): void => {
    choisirTheme(themeActuel());
    anim.rafraichir();
  };
  window.addEventListener('coupole:theme', surTheme);

  majValeurs();
  return {
    el,
    titre: `${nom} — Coupole Web`,
    focus: c,
    detruire() {
      clearTimeout(minuteur);
      anim.arreter();
      toile.detruire();
      for (const v of vues) v.detacher();
      window.removeEventListener('coupole:theme', surTheme);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    },
  };
}

async function partagerLien(e: Entree, anim: Animation): Promise<void> {
  const url = new URL(adresseAnimation(e.id, anim.etatModifie()), location.href).href;
  const titre = `${tr('anim_nom_' + e.cle)} — Coupole Web`;
  try {
    if (typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ title: titre, url });
      return;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(url);
    annoncer(tr('web_lien_copie'));
  } catch {
    remplacerAdresse(adresseAnimation(e.id, anim.etatModifie()));
    annoncer(tr('web_lien_pas_copie'));
  }
}

/** Ce que font la souris et le doigt dans cette animation précise. */
function aideInteraction(a: Animation, cle: string): string {
  const deplace = Object.getPrototypeOf(a).presser !== Animation.prototype.presser;
  const parties: string[] = [];
  if (existe('anim_' + cle + '_souris')) parties.push(tr('anim_' + cle + '_souris'));
  else if (a.nb_vues > 0) parties.push(tr(deplace ? 'web_aide_tourner_deplacer' : 'web_aide_tourner'));
  else if (deplace) parties.push(tr('web_aide_deplacer'));
  if (a.aide_supplementaire()) parties.push(a.aide_supplementaire());
  parties.push(tr('web_aide_zoom'), tr(a.nb_vues > 0 ? 'web_aide_clavier_tourner' : 'web_aide_clavier'));
  return parties.join(' ');
}
