/**
 * Page d'une animation : toile, barre de lecture, réglages, valeurs calculées, fiche (description, ce qu'il faut voir,
 * liste des réglages).  Chargée à la demande (morceau séparé) avec l'animation elle-même.
 */
import { Animation, Bouton, type EtatReglages, Reglage } from '../anim/base';
import { charger, disponible, type Entree, HORS_CLASSACTION, PAR_ID } from '../anim/registre';
import { aVoir } from '../i18n/a_voir';
import { chargerAnimations, existe, langue, tr } from '../i18n/i18n';
import { choisirTheme, type Theme } from '../noyau/dessin';
import { annoncer, h, icone, pageIntrouvable } from './dom';
import { texteNombre, type Vue, vueControle } from './controles';
import * as stockage from './stockage';
import { boutonFavori } from './favoris';
import { adresseAnimation, remplacerAdresse } from './routeur';
import { Scene } from './scene';
import { FicheFlottante } from './fiche_flottante';
import { enrichir, remplir } from './texte_riche';
import { typo } from '../noyau/typo';
import * as M from '../calc/maintenant';

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
    // textes, mémoire et code de l'animation : en parallèle
    const [, , cls] = await Promise.all([chargerAnimations(langue()), stockage.pret(), charger(e)]);
    return construire(e, cls, etatAdresse);
  } catch (err) {
    console.error(err);
    return pageErreur(tr('web_erreur', { erreur: err instanceof Error ? err.message : String(err) }));
  }
}

function pageErreur(message: string): Page {
  return { el: pageIntrouvable(message, tr), titre: `${tr('web_introuvable')} — Coupole Web`, detruire() {} };
}

function construire(e: Entree, cls: Awaited<ReturnType<typeof charger>>, etatAdresse: EtatReglages): Page {
  choisirTheme(themeActuel());
  const memoire = stockage.reglagesAnimation(e.id);
  const depart = Object.keys(etatAdresse).length ? etatAdresse : memoire;
  const nom = tr('anim_nom_' + e.cle);
  const hors = HORS_CLASSACTION.get(e.id);

  // ------------------------------------------------------------ squelette
  const zoomTexte = h('span', { 'aria-live': 'polite' });
  const zoomRetour = h('button', { type: 'button', class: 'bouton', text: tr('web_zoom_retour') });
  const zoomInfo = h('div', { class: 'zoom-info' }, zoomTexte, zoomRetour);
  const scene = h('div', { class: 'scene' }, zoomInfo);
  const transport = h('div', { class: 'transport', role: 'toolbar', 'aria-label': nom });
  const sousScene = h('p', { class: 'aide-scene' });
  const credits = h('p', { class: 'credits-images', hidden: true });
  const reglages = h('div', { class: 'reglages' });
  const valeurs = h('dl', { class: 'valeurs' });
  const blocReglages = h('section', { class: 'bloc', 'aria-labelledby': 'titre-reglages' }, h('h2', { id: 'titre-reglages', text: tr('web_reglages') }), reglages);
  const blocValeurs = h('section', { class: 'bloc', 'aria-labelledby': 'titre-valeurs' }, h('h2', { id: 'titre-valeurs', text: tr('web_valeurs') }), valeurs);
  const fiche = h('section', { class: 'bloc fiche', 'aria-labelledby': 'titre-fiche' }, h('h2', { id: 'titre-fiche', text: tr('web_fiche') }));
  const descId = 'desc-anim';
  const el = h(
    'div',
    { class: 'page page-anim', 'data-anim': e.id },
    h(
      'nav',
      { class: 'fil', 'aria-label': tr('web_retour') },
      h('a', { href: '#/animations' }, icone('retour'), tr('web_retour')),
      h('span', { 'aria-hidden': 'true', text: '·' }),
      h('span', { text: tr('anim_theme_' + e.theme) }),
    ),
    h('div', { class: 'titre-anim' }, h('h1', { text: nom }), boutonFavori('animation', e.id, nom),
      hors ? h('span', { class: 'origine', text: tr(`anim_${e.cle}_adapte`) })
        : nom !== e.titre ? h('span', { class: 'origine', text: tr('web_titre_origine', { titre: e.titre }) }) : null),
    h(
      'div',
      { class: 'anim' },
      h('div', { class: 'scene-boite' }, scene, transport, sousScene, credits),
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
      remplir(dt, typo(a));
      remplir(dd, typo(b), true);
    });
    blocValeurs.hidden = v.length === 0;
  };
  const carte = new FicheFlottante(scene);
  // crédits des images posées dans la scène (texte mot pour mot, lien actif), mis à jour quand ils changent
  let signatureCredits = '';
  const majCredits = (): void => {
    const cr = anim.credits_visibles();
    const sig = JSON.stringify(cr);
    if (sig === signatureCredits) return;
    signatureCredits = sig;
    credits.replaceChildren(
      ...cr.flatMap(([texte, lien], i) => [
        i ? ' · ' : '',
        h('a', { href: lien, rel: 'noopener noreferrer', target: '_blank', text: texte }),
      ]),
    );
    credits.hidden = cr.length === 0;
  };
  // bloc « Maintenant » (créé plus bas, une fois l'animation construite ; la lecture peut démarrer avant)
  let maintenant: ReturnType<typeof blocMaintenant> = null;
  const toile = new Scene(scene, {
    valeurs: majValeurs,
    lecture: () => {
      majLecture();
      // lecture relancée : le temps de l'animation reprend la main
      if (anim?.en_lecture) maintenant?.arreterDirect();
    },
    rendu: majCredits,
    fiche: (c) => (c ? carte.suivre(c) : carte.cacher()),
    zoom: (k) => {
      zoomInfo.classList.toggle('visible', k > 1.001);
      zoomTexte.textContent = `${tr('web_zoom')} ${texteNombre(k, 1)}×`;
    },
  });
  zoomRetour.addEventListener('click', () => toile.zoomer(1, 0, 0, true));
  const c = toile.canvas;
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', tr('web_scene', { nom }));
  toile.libelle = tr('web_scene', { nom });
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
  // iPad, iPhone : un réglage qui garde le focus après un geste au doigt ou au stylet (menu déroulant surtout) fait
  // que le toucher suivant sur la toile sert seulement à le fermer ; on rend donc le focus après un tel réglage (au
  // clavier, le focus reste où il est)
  let dernierPointeur = 'mouse';
  const panneau = el.querySelector<HTMLElement>('.panneau');
  panneau?.addEventListener('pointerdown', (ev) => (dernierPointeur = ev.pointerType), true);
  panneau?.addEventListener('keydown', () => (dernierPointeur = 'clavier'), true);
  panneau?.addEventListener(
    'change',
    (ev) => {
      const t = ev.target as HTMLElement;
      if ((dernierPointeur === 'touch' || dernierPointeur === 'pen') && t.matches('select, input[type="range"], input[type="number"], input[type="text"]')) setTimeout(() => t.blur(), 0);
    },
    true,
  );

  // ------------------------------------------------------------ « Maintenant », « En direct », « Ma position »
  maintenant = blocMaintenant(anim, cls as unknown as typeof Animation);
  if (maintenant) el.querySelector('.panneau')?.prepend(maintenant.el);

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
  // lien croisé vers l'application complète d'où vient l'animation (hors ClassAction)
  if (hors) fiche.append(h('p', { class: 'lien-croise' }, h('a', { href: hors[1], rel: 'noopener noreferrer', target: '_blank', text: tr(`anim_${e.cle}_lien`) }), ' ↗'));
  fiche.append(h('p', { class: 'astuce', text: aide }), h('p', { class: 'credit', text: hors ? tr(`anim_${e.cle}_adapte`) : tr('web_credit_court') }));

  // ------------------------------------------------------------ mémoire et adresse partageable
  let minuteur = 0;
  let enAttente = false;
  const ecrireReglages = (): Record<string, number | boolean | string | null> => {
    enAttente = false;
    const modifie = anim.etatModifie() as Record<string, number | boolean | string | null>;
    stockage.memoriserReglages(e.id, modifie);
    return modifie;
  };
  const memoriser = (): void => {
    // « En direct » : l'heure change chaque seconde, rien à mémoriser
    if (maintenant?.applique()) return;
    clearTimeout(minuteur);
    enAttente = true;
    minuteur = window.setTimeout(() => {
      const r = ecrireReglages();
      // l'adresse n'est réécrite que si l'on est encore sur cette animation (sinon on écraserait la page suivante)
      if (location.hash.split('?')[0] === `#/a/${encodeURIComponent(e.id)}`) remplacerAdresse(adresseAnimation(e.id, r));
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
      // un réglage changé juste avant de quitter la page est gardé quand même
      if (enAttente) ecrireReglages();
      maintenant?.detruire();
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
  if ((a.constructor as typeof Animation).FICHES) parties.push(tr('anim_aide_fiche'));
  parties.push(tr('web_aide_zoom'), tr(a.nb_vues > 0 ? 'web_aide_clavier_tourner' : 'web_aide_clavier'));
  return parties.join(' ');
}

// ==================================================================== « Maintenant »
/** Position de « Ma position » : gardée en mémoire pendant la visite seulement (jamais écrite ni envoyée). */
let positionSession: { lat: number; lon: number } | null = null;

function texteLonLat(v: number, pos: string, neg: string): string {
  return `${texteNombre(Math.abs(v), 1)}° ${v >= 0 ? pos : neg}`;
}

/**
 * Bloc « Date et heure » des animations qui dépendent de la date : « Maintenant » (instant de l'appareil, sans erreur
 * de fuseau ni d'heure d'été : calc/maintenant.ts), « En direct » (mise à jour toutes les secondes ou minutes, sans
 * rendu continu ; s'arrête dès qu'on touche un réglage de date ou qu'on relance la lecture), « Ma position »
 * (géolocalisation demandée explicitement, gardée pendant la visite).
 */
function blocMaintenant(anim: Animation, C: typeof Animation): { el: HTMLElement; applique: () => boolean; arreterDirect: () => void; detruire: () => void } | null {
  if (anim.maintenant === Animation.prototype.maintenant) return null;
  const lg = langue();
  const texte = h('p', { class: 'heure-maintenant', 'aria-live': 'polite' });
  const note = h('p', { class: 'aide' });
  const bMaintenant = h('button', { type: 'button', class: 'bouton' }, icone('horloge'), tr('web_maintenant'));
  const bDirect = h('button', { type: 'button', class: 'bouton', 'aria-pressed': 'false' }, icone('direct'), tr('web_en_direct'));
  const obs = anim.observateur();
  const bPosition = obs.lat || obs.lon ? h('button', { type: 'button', class: 'bouton discret' }, icone('position'), tr('web_ma_position')) : null;
  let applique = false;
  let direct = 0;
  const appliquer = (annoncer_ = false): void => {
    const i = M.maintenant();
    applique = true;
    try {
      if (anim.en_lecture) anim.arreter();
      anim.maintenant(M.moment(i, positionSession));
    } finally {
      applique = false;
    }
    anim.rafraichir();
    texte.setAttribute('aria-live', annoncer_ ? 'polite' : 'off');
    texte.textContent = `${M.texteDate(i, lg)} · ${M.texteHeure(i, lg)}`;
    const p = positionSession;
    const lon = p ? p.lon : M.meridienDuFuseau(i);
    note.textContent = p
      ? tr('web_position_retenue', { lat: texteLonLat(p.lat, 'N', 'S'), lon: texteLonLat(p.lon, lg === 'fr' ? 'E' : 'E', lg === 'fr' ? 'O' : 'W') })
      : C.HEURE_SOLAIRE ? tr('web_heure_solaire_fuseau', { lon: texteLonLat(lon, 'E', lg === 'fr' ? 'O' : 'W') }) : '';
    note.hidden = !note.textContent;
  };
  const arreterDirect = (): void => {
    if (!direct) return;
    clearInterval(direct);
    direct = 0;
    bDirect.setAttribute('aria-pressed', 'false');
    texte.setAttribute('aria-live', 'polite');
  };
  bMaintenant.addEventListener('click', () => {
    arreterDirect();
    appliquer(true);
  });
  bDirect.addEventListener('click', () => {
    if (direct) return arreterDirect();
    appliquer(true);
    direct = window.setInterval(() => appliquer(false), C.PAS_DIRECT * 1000);
    bDirect.setAttribute('aria-pressed', 'true');
  });
  bPosition?.addEventListener('click', () => {
    if (!('geolocation' in navigator)) return void annoncer(tr('web_position_indisponible'));
    bPosition.setAttribute('aria-busy', 'true');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        bPosition.removeAttribute('aria-busy');
        positionSession = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        appliquer(true);
      },
      (err) => {
        bPosition.removeAttribute('aria-busy');
        annoncer(tr(err.code === 1 ? 'web_position_refusee' : 'web_position_indisponible'));
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600_000 },
    );
  });
  // un réglage de date touché (par l'utilisateur, pas par « En direct ») : on s'arrête
  const detacher: (() => void)[] = [];
  for (const ctl of anim.controles) {
    const cle = (ctl as { cle?: string }).cle;
    if (cle && C.TEMPS.includes(cle)) detacher.push(ctl.observer(() => (applique ? undefined : arreterDirect())));
  }
  // boutons de l'animation qui déplacent le temps (Anticythère : « + 1 lunaison »…)
  const surBouton = (ev: Event): void => {
    if (direct && (ev.target as HTMLElement).closest('.reglages button')) arreterDirect();
  };
  document.addEventListener('click', surBouton, true);
  const el = h(
    'section',
    { class: 'bloc bloc-maintenant', 'aria-labelledby': 'titre-maintenant' },
    h('h2', { id: 'titre-maintenant', text: tr('web_date_heure') }),
    h('div', { class: 'actions-maintenant' }, bMaintenant, bDirect, bPosition),
    texte,
    note,
  );
  note.hidden = true;
  return {
    el,
    applique: () => applique,
    arreterDirect,
    detruire() {
      arreterDirect();
      for (const d of detacher) d();
      document.removeEventListener('click', surBouton, true);
    },
  };
}
