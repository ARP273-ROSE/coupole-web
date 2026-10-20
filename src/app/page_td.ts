/**
 * Rubrique « Calculateurs de TD » (#/td) et calculateur « Parallaxe (TP du cours) » (#/td/parallaxe) : mêmes textes
 * (exportés de Coupole), mêmes formules (src/calc/td_parallaxe.ts) et même dessin que l'appli de bureau.
 */
import { CoordonneeIllisible, lireAltitude, lireAngle, lirePosition } from '../calc/coordonnees';
import * as T from '../calc/td_parallaxe';
import { chargerTD, langue, tr } from '../i18n/i18n';
import { h, icone } from './dom';
import type { Page } from './page_apropos';

export const CALCULATEURS: readonly [string, string][] = [['parallaxe', 'td_calc_parallaxe']];
const CLE_MEMOIRE = 'coupole-td-parallaxe';
const CLE_TLE = 'coupole-td-tle';
const URL_TLE = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';

const nombre = (x: number | null | undefined, c = 1): string => {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  return new Intl.NumberFormat(langue() === 'fr' ? 'fr-FR' : 'en-GB', { minimumFractionDigits: c, maximumFractionDigits: c }).format(x).replace(/ /g, ' ');
};

function lire<T>(cle: string, defaut: T): T {
  try {
    const v = localStorage.getItem(cle);
    return v ? (JSON.parse(v) as T) : defaut;
  } catch {
    return defaut;
  }
}

function ecrire(cle: string, v: unknown): void {
  try {
    localStorage.setItem(cle, JSON.stringify(v));
  } catch {
    /* navigation privée : rien n'est gardé */
  }
}

export async function pageTD(id: string): Promise<Page> {
  await chargerTD(langue());
  if (id === 'parallaxe') return pageParallaxe();
  const liste = h('div', { class: 'grille-td' },
    ...CALCULATEURS.map(([i, cle]) => h('a', { class: 'carte carte-td', href: '#/td/' + i },
      h('h2', { text: tr(cle) }), h('p', { text: tr(cle + '_aide') }))));
  const el = h('div', { class: 'page page-td' }, h('h1', { text: tr('web_nav_td') }), h('p', { class: 'chapo', text: tr('td_rubrique_intro') }), liste);
  return { el, titre: tr('web_nav_td') + ' — Coupole Web', detruire() {} };
}

// ------------------------------------------------------------------ calculateur Parallaxe
interface Champs {
  [cle: string]: HTMLInputElement;
}

function pageParallaxe(): Page {
  const memo = lire<Record<string, string>>(CLE_MEMOIRE, {});
  const champs: Champs = {};
  const champ = (cle: string, aide: string, indice: string): HTMLElement => {
    const i = h('input', { type: 'text', id: 'td-' + cle, autocomplete: 'off', spellcheck: 'false', placeholder: tr(indice), title: tr(aide) });
    i.value = memo[cle] ?? '';
    i.addEventListener('change', () => {
      memo[cle] = i.value;
      ecrire(CLE_MEMOIRE, memo);
    });
    champs[cle] = i;
    return h('label', { class: 'td-champ', for: 'td-' + cle }, h('span', { text: tr(aide.replace(/_aide$/, '')) }), i);
  };
  const cible = h('select', { id: 'td-cible', title: tr('td_cible_aide') },
    h('option', { value: 'iss', text: tr('td_cible_iss') }), h('option', { value: 'lune', text: tr('td_cible_lune') }));
  cible.value = memo.cible ?? 'iss';
  const conf = h('select', { id: 'td-conf', title: tr('td_conf_aide') },
    h('option', { value: '', text: tr('td_conf_auto') }), h('option', { value: 'entre', text: tr('td_conf_entre') }),
    h('option', { value: 'meme_cote', text: tr('td_conf_meme') }));
  const lieu = (n: number): HTMLElement => h('fieldset', { class: 'td-lieu' }, h('legend', { text: tr('td_lieu', { n }) }),
    champ('p' + n, 'td_p_aide', 'td_p_indice'), champ('alt' + n, 'td_alt_aide', 'td_alt_indice'),
    champ('h' + n, 'td_h_aide', 'td_h_indice'), champ('az' + n, 'td_az_aide', 'td_az_indice'));
  const instant = champ('instant', 'td_instant_aide', 'td_instant_indice');
  const bMaintenant = h('button', { type: 'button', class: 'bouton', text: tr('td_maintenant'), title: tr('td_maintenant_aide') });
  const sigmaH = h('input', { type: 'number', step: '0.01', min: '0', value: '0.1', title: tr('td_sigma_h_aide') });
  const sigmaPos = h('input', { type: 'number', step: '1', min: '0', value: '20', title: tr('td_sigma_pos_aide') });
  const sigmaT = h('input', { type: 'number', step: '0.1', min: '0', value: '1', title: tr('td_sigma_t_aide') });
  const tle = h('textarea', { rows: 2, placeholder: tr('td_tle_indice'), title: tr('td_tle_aide'), spellcheck: 'false' });
  const bTle = h('button', { type: 'button', class: 'bouton', text: tr('td_tle_recuperer'), title: tr('td_tle_recuperer_aide') });
  const bCalculer = h('button', { type: 'button', class: 'bouton principal', text: tr('td_calculer'), title: tr('td_calculer_aide') });
  const bExemple = h('button', { type: 'button', class: 'bouton', text: tr('td_exemple'), title: tr('td_exemple_aide') });
  const bExporter = h('button', { type: 'button', class: 'bouton', text: tr('td_exporter'), title: tr('td_exporter_aide'), disabled: true });
  const etat = h('p', { class: 'td-etat', role: 'status', 'aria-live': 'polite' });
  const toile = h('canvas', { class: 'td-schema', role: 'img', 'aria-label': tr('td_schema_aide') });
  const zoom = h('input', { type: 'range', min: '10', max: '600', value: '10', title: tr('td_zoom_aide'), 'aria-label': tr('td_zoom') });
  const detail = h('div', { class: 'td-detail' });
  let res: T.Resultat | null = null;

  const formulaire = h('div', { class: 'td-formulaire' },
    h('label', { class: 'td-champ' }, h('span', { text: tr('td_cible') }), cible),
    h('label', { class: 'td-champ' }, h('span', { text: tr('td_conf') }), conf),
    lieu(1), lieu(2),
    h('div', { class: 'td-ligne' }, instant, bMaintenant),
    h('div', { class: 'td-sigmas' },
      h('label', { class: 'td-champ' }, h('span', { text: tr('td_sigma_h') + ' (°)' }), sigmaH),
      h('label', { class: 'td-champ' }, h('span', { text: tr('td_sigma_pos') + ' (m)' }), sigmaPos),
      h('label', { class: 'td-champ' }, h('span', { text: tr('td_sigma_t') + ' (s)' }), sigmaT)),
    h('fieldset', { class: 'td-eph' }, h('legend', { text: tr('td_eph') }), h('p', { text: tr('web_td_eph') }), bTle, tle),
    h('div', { class: 'td-boutons' }, bCalculer, bExemple, bExporter), etat);
  const el = h('div', { class: 'page page-td' },
    h('nav', { class: 'fil', 'aria-label': tr('web_retour') }, h('a', { href: '#/td' }, icone('retour'), tr('web_nav_td'))),
    h('h1', { text: tr('td_calc_parallaxe') }), h('p', { class: 'chapo', text: tr('td_p_intro') }),
    h('div', { class: 'td-grille' }, formulaire, h('div', { class: 'td-resultats' }, toile, h('label', { class: 'td-zoom' }, tr('td_zoom'), zoom), detail)));

  bMaintenant.addEventListener('click', () => {
    champs.instant!.value = new Date().toISOString().slice(0, 19).replace('T', ' ');
  });
  bExemple.addEventListener('click', () => {
    const ex = T.exemple(cible.value === 'lune' ? 'lune' : 'iss');
    for (const [k, v] of Object.entries(ex)) if (champs[k]) champs[k]!.value = v;
    etat.textContent = tr('td_exemple_fictif');
    calculer();
  });
  bTle.addEventListener('click', () => void recupererTle());
  bCalculer.addEventListener('click', () => calculer());
  bExporter.addEventListener('click', () => exporter());
  zoom.addEventListener('input', () => dessiner());
  zoomAuxDoigts(toile, zoom, () => dessiner());
  const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => dessiner()) : null;
  obs?.observe(toile);

  /** TLE du cache : { lignes, récupéré le (ms) } (l'ancien format, le texte seul, est encore lu). */
  function tleEnCache(): { l: string; recupere: number } | null {
    const c = lire<unknown>(CLE_TLE, null);
    if (typeof c === 'string') return c ? { l: c, recupere: 0 } : null;
    if (c && typeof (c as { l?: unknown }).l === 'string') return c as { l: string; recupere: number };
    return null;
  }

  async function telechargerTle(): Promise<string> {
    const arret = new AbortController();
    const minuteur = setTimeout(() => arret.abort(), 8000);
    try {
      const r = await fetch(URL_TLE, { cache: 'no-store', signal: arret.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const l = (await r.text()).split(/\r?\n/).map((x) => x.trim()).filter((x) => /^[12] /.test(x));
      if (l.length < 2) throw new Error('TLE');
      const texte = l.slice(0, 2).join('\n');
      ecrire(CLE_TLE, { l: texte, recupere: Date.now() });
      return texte;
    } finally {
      clearTimeout(minuteur);
    }
  }

  /**
   * TLE pour l'instant donné, sans rien demander : celui du cache s'il est à moins de 1,5 jour de l'instant (ou
   * récupéré il y a moins de 6 h), sinon celui du jour chez CelesTrak (le plus proche qu'une source libre sans compte
   * puisse donner), sinon le cache, sinon rien (hors ligne : le calcul se fait sans éphéméride).
   */
  async function tleAuto(t: Date): Promise<{ texte: string; source: 'cache' | 'celestrak' | ''; erreur: string }> {
    const c = tleEnCache();
    const proche = (x: string): number => {
      const e = epoque(x.split('\n'));
      return e ? Math.abs(t.getTime() - e.getTime()) / 86_400_000 : Infinity;
    };
    if (c && (proche(c.l) <= 1.5 || Date.now() - c.recupere < 6 * 3_600_000)) return { texte: c.l, source: 'cache', erreur: '' };
    try {
      const n = await telechargerTle();
      if (!c || proche(n) <= proche(c.l)) return { texte: n, source: 'celestrak', erreur: '' };
      return { texte: c.l, source: 'cache', erreur: '' };
    } catch (err) {
      return c ? { texte: c.l, source: 'cache', erreur: '' } : { texte: '', source: '', erreur: String(err).slice(0, 120) };
    }
  }

  /** Le TLE du champ a-t-il été saisi (ou collé) par l'utilisateur ? (un TLE posé tout seul n'en est pas un) */
  const tleSaisi = (): boolean => tle.value.trim() !== '' && tle.value !== (tle.dataset.pose ?? '');

  function poserTle(texte: string, source: string): void {
    tle.value = texte;
    tle.dataset.pose = texte;
    const l = texte.split('\n');
    etatTle = tr('td_tle_recu', { date: epoque(l)?.toISOString().slice(0, 16).replace('T', ' ') ?? '—', age: nombre(age(l), 1), source: tr('td_tle_source_' + source) });
  }

  let etatTle = '';

  async function recupererTle(): Promise<void> {
    bTle.setAttribute('disabled', '');
    try {
      let texte = '';
      let source: 'cache' | 'celestrak' = 'celestrak';
      try {
        texte = await telechargerTle();
      } catch (err) {
        const c = tleEnCache();
        if (!c) {
          etat.textContent = tr('td_tle_aucun', { erreur: String(err).slice(0, 120) });
          return;
        }
        texte = c.l;
        source = 'cache';
      }
      poserTle(texte, source);
      etat.textContent = etatTle;
    } finally {
      bTle.removeAttribute('disabled');
    }
  }


  function epoque(l: string[]): Date | null {
    const m = /^1 .{16}(\d{2})(\d{3}\.\d+)/.exec(l.find((x) => x.startsWith('1 ')) ?? '');
    if (!m) return null;
    const a = Number(m[1]) + (Number(m[1]) < 57 ? 2000 : 1900);
    return new Date(Date.UTC(a, 0, 1) + (Number(m[2]) - 1) * 86_400_000);
  }

  function age(l: string[]): number {
    const e = epoque(l);
    const t = lireInstant() ?? new Date();
    return e ? Math.abs(t.getTime() - e.getTime()) / 86_400_000 : NaN;
  }

  function lireInstant(): Date | null {
    const t = champs.instant!.value.trim();
    if (!t) return null;
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}(?:[.,]\d+)?))?/.exec(t);
    if (!m) throw new CoordonneeIllisible('td_err_instant', { texte: t });
    return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, 0) + parseFloat((m[6] ?? '0').replace(',', '.')) * 1000);
  }

  async function propagateur(): Promise<T.Propagateur | null> {
    const l = tle.value.split(/\r?\n/).filter((x) => /^[12] /.test(x.trim())).map((x) => x.trim());
    if (l.length < 2) return null;
    const sat = await import('../calc/sgp4');
    const rec = sat.twoline2satrec(l[0]!, l[1]!);
    const ep = epoque(l);
    return (t: Date) => {
      const p = sat.propagate(rec, t);
      if (!p || !p.position || typeof p.position === 'boolean') return null;
      const g = sat.eciToEcf(p.position, sat.gstime(t));
      return { X: [g.x, g.y, g.z], age_jours: ep ? (t.getTime() - ep.getTime()) / 86_400_000 : 0 };
    };
  }

  function calculer(): void {
    memo.cible = cible.value;
    for (const [k, i] of Object.entries(champs)) memo[k] = i.value;
    ecrire(CLE_MEMOIRE, memo);
    let e: T.Entrees;
    try {
      const lieux: T.Lieu[] = [];
      const notes: [string, Record<string, string | number>][] = [];
      for (const n of [1, 2]) {
        const p = lirePosition(champs['p' + n]!.value);
        for (const x of p.notes) if (x.startsWith('td_a_')) notes.push([x, { n }]);
        const hv = champs['h' + n]!.value.trim();
        const az = champs['az' + n]!.value.trim();
        if (!hv) throw new CoordonneeIllisible('td_err_h', { n });
        lieux.push(T.lieu(p.lat, p.lon, lireAltitude(champs['alt' + n]!.value), lireAngle(hv).valeur, az ? ((lireAngle(az).valeur % 360) + 360) % 360 : null));
      }
      e = T.entrees(lieux[0]!, lieux[1]!, cible.value === 'lune' ? 'lune' : 'iss', {
        instant: lireInstant(), configuration: conf.value, notes,
        sigma_h_deg: Number(sigmaH.value) || 0, sigma_pos_m: Number(sigmaPos.value) || 0, sigma_t_s: Number(sigmaT.value) || 0,
      });
    } catch (err) {
      if (err instanceof CoordonneeIllisible) {
        etat.textContent = tr(err.cle, err.valeurs);
        return;
      }
      throw err;
    }
    void (async () => {
      etatTle = '';
      if (e.cible === 'iss' && e.instant) {
        if (!tleSaisi()) {
          etat.textContent = tr('td_tle_recherche');
          const r = await tleAuto(e.instant);
          if (r.texte) poserTle(r.texte, r.source);
          else etatTle = tr('td_tle_aucun', { erreur: r.erreur });
        }
        e.propagateur = await propagateur();
      }
      try {
        res = T.calculer(e);
      } catch (err) {
        etat.textContent = err instanceof T.ErreurTP ? tr(err.cle, err.valeurs) : String(err);
        return;
      }
      afficher(e, res);
      bExporter.removeAttribute('disabled');
      etat.textContent = tr('td_calcul_fait') + (etatTle ? ' ' + etatTle : '');
    })();
  }

  function afficher(e: T.Entrees, r: T.Resultat): void {
    const ol = h('ol', { class: 'td-etapes' }, ...etapes(e, r).map(([t, x]) => h('li', {}, h('b', { text: t }), h('br'), x)));
    detail.replaceChildren(...r.alertes.map(([a, v]) => h('p', { class: 'td-alerte', text: '⚠ ' + tr(a, v) })), ol);
    dessiner();
  }

  function exporter(): void {
    if (!res) return;
    const lignes = texteExport(res);
    const a = document.createElement('a');
    a.download = 'parallaxe_tp.csv';
    a.href = URL.createObjectURL(new Blob(['﻿' + lignes], { type: 'text/csv' }));
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    etat.textContent = tr('td_exporte', { chemin: a.download });
  }

  function dessiner(): void {
    const r = toile.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(320, Math.round(r.width || 640));
    const hh = Math.max(260, Math.round(r.height || 360));
    toile.width = w * dpr;
    toile.height = hh * dpr;
    const p = toile.getContext('2d');
    if (!p) return;
    p.setTransform(dpr, 0, 0, dpr, 0, 0);
    dessinerSchema(p, w, hh, res, Number(zoom.value) / 10);
  }

  if (memo.p1 && memo.h1 && memo.p2 && memo.h2) setTimeout(() => calculer(), 0);
  else setTimeout(() => dessiner(), 0);
  return { el, titre: tr('td_calc_parallaxe') + ' — Coupole Web', detruire: () => obs?.disconnect(), focus: champs.p1 };
}

// ------------------------------------------------------------------ zoom du schéma au doigt, à la molette
/**
 * Le curseur « Zoom » se commande aussi sur le schéma : pincement à deux doigts (Pointer Events ; sur Safari, iPhone,
 * iPad et PWA installée, l'échelle de « gesturechange », qui tient même si WebKit annule les pointeurs), molette ou
 * pincement du pavé tactile, double-tap ou double-clic pour revenir à ×1.  Un doigt seul fait défiler la page.
 */
export function zoomAuxDoigts(toile: HTMLElement, curseur: HTMLInputElement, redessiner: () => void): void {
  const min = Number(curseur.min) || 10;
  const max = Number(curseur.max) || 600;
  const poser = (v: number): void => {
    const n = String(Math.round(Math.max(min, Math.min(max, v))));
    if (n === curseur.value) return;
    curseur.value = n;
    redessiner();
  };
  const doigts = new Map<number, [number, number]>();
  let pince: { d0: number; v0: number } | null = null;
  let safari: { v0: number } | null = null;
  const ecart = (): number => {
    const [a, b] = [...doigts.values()] as [[number, number], [number, number]];
    return Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1]));
  };
  toile.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    doigts.set(e.pointerId, [e.clientX, e.clientY]);
    if (doigts.size === 2) pince = { d0: ecart(), v0: Number(curseur.value) };
  });
  toile.addEventListener('pointermove', (e) => {
    if (!doigts.has(e.pointerId)) return;
    doigts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pince && doigts.size >= 2 && !safari) poser((pince.v0 * ecart()) / pince.d0);
  });
  const fin = (e: PointerEvent): void => {
    doigts.delete(e.pointerId);
    if (doigts.size < 2) pince = null;
  };
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) toile.addEventListener(t, fin);
  // deux doigts : ni défilement ni zoom de la page
  const bloquer = (e: TouchEvent): void => {
    if (e.cancelable && (e.touches?.length ?? 0) >= 2) e.preventDefault();
  };
  toile.addEventListener('touchstart', bloquer, { passive: false });
  toile.addEventListener('touchmove', bloquer, { passive: false });
  const geste = (e: Event): void => {
    e.preventDefault();
    const g = e as Event & { scale?: number };
    if (e.type === 'gestureend') {
      safari = null;
      return;
    }
    if (e.type === 'gesturestart' || !safari) safari = { v0: Number(curseur.value) };
    if (e.type !== 'gesturestart' && Number.isFinite(g.scale) && g.scale! > 0) poser(safari.v0 * g.scale!);
  };
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) toile.addEventListener(t, geste, { passive: false });
  toile.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const unite = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      poser(Number(curseur.value) * Math.exp(-e.deltaY * unite * 0.0025));
    },
    { passive: false },
  );
  toile.addEventListener('dblclick', () => poser(min));
}

// ------------------------------------------------------------------ pas-à-pas (comme coupole/modules/td/presentation.py)
export function etapes(e: T.Entrees, r: T.Resultat): [string, string][] {
  const g = r.geometrie;
  const sc = r.sujet_corde;
  const ss = r.sujet_surface;
  const { o1, o2 } = e;
  const out: [string, string][] = [
    [tr('td_e1'), tr('td_e1_t', { h1: nombre(o1.h, 3), h2: nombre(o2.h, 3), az1: o1.az !== null ? nombre(o1.az, 2) : '—', az2: o2.az !== null ? nombre(o2.az, 2) : '—' })],
    [tr('td_e2'), tr(sc.entre ? 'td_e2_entre' : 'td_e2_t', { a: nombre(sc.deux_alpha_deg, 4), r: nombre(sc.deux_alpha_rad, 6) })],
    [tr('td_e3'), tr('td_e3_t', { s: nombre(g.surface_km, 3), c: nombre(g.corde_km, 3), e: nombre(g.ecart_corde_surface_km * 1000, 0), f: nombre(g.fleche_km * 1000, 0), fa: nombre(g.fleche_approchee_km * 1000, 0), p1: nombre(g.profondeur_deg[0], 3), p2: nombre(g.profondeur_deg[1], 3) })],
    [tr('td_e4'), tr('td_e4_t', { ds: nombre(ss.D_km, 1), dc: nombre(sc.D_km, 1), a: nombre(sc.deux_alpha_rad, 6), c: nombre(g.corde_km, 3) })],
  ];
  const x = r.exact;
  if (x) out.push([tr('td_e5'), tr('td_e5_t', { theta: nombre(g.angle_centre_deg, 4), d1: nombre(x.distances_km[0], 1), d2: nombre(x.distances_km[1], 1), dg: nombre(x.distance_geo_km, 1), alt: nombre(x.altitude_km, 2), p: nombre(x.parallaxe_vraie_deg, 4), mode: tr('td_mode_' + x.configuration) })]);
  const eph = r.ephemeride;
  if (eph) {
    const [l1, l2] = [eph.lieux[0]!, eph.lieux[1]!];
    if (r.cible === 'lune')
      out.push([tr('td_e6'), tr('td_e6_lune', { src: tr('td_src_meeus'), dg: nombre(eph.distance_geo_km, 1), d1: nombre(l1.distance_km, 1), d2: nombre(l2.distance_km, 1), h1: nombre(l1.h_deg, 3), h2: nombre(l2.h_deg, 3), hr1: nombre(l1.h_refraction_deg, 3), hr2: nombre(l2.h_refraction_deg, 3) })]);
    else out.push([tr('td_e6'), tr('td_e6_iss', { alt: nombre(eph.altitude_km, 1), age: nombre(eph.age_jours, 1), d1: nombre(l1.distance_km, 1), d2: nombre(l2.distance_km, 1), h1: nombre(l1.h_deg, 3), h2: nombre(l2.h_deg, 3) })]);
  }
  const inc = r.incertitudes;
  out.push([tr('td_e7'), tr('td_e7_t', { sh: nombre(inc.sigma_h_effectif_deg, 3), s: nombre(inc.sujet_total_km, 1), x: inc.exact_total_km !== null ? nombre(inc.exact_total_km, 1) : '—' })]);
  return out;
}

export function texteExport(r: T.Resultat): string {
  const [o1, o2] = r.lieux;
  const g = r.geometrie;
  const l: [string, number | null, string, number][] = [
    ['td_x_lat1', o1.lat, '°', 6], ['td_x_lon1', o1.lon, '°', 6], ['td_x_h1', o1.h, '°', 4],
    ['td_x_lat2', o2.lat, '°', 6], ['td_x_lon2', o2.lon, '°', 6], ['td_x_h2', o2.h, '°', 4],
    ['td_x_2alpha', r.sujet_corde.deux_alpha_deg, '°', 4], ['td_x_2alpha_rad', r.sujet_corde.deux_alpha_rad, 'rad', 6],
    ['td_x_surface', g.surface_km, 'km', 3], ['td_x_corde', g.corde_km, 'km', 3], ['td_x_fleche', g.fleche_km * 1000, 'm', 0],
    ['td_x_D_surface', r.sujet_surface.D_km, 'km', 1], ['td_x_D_corde', r.sujet_corde.D_km, 'km', 1], ['td_x_theta', g.angle_centre_deg, '°', 4],
  ];
  if (r.exact) l.push(['td_x_d1', r.exact.distances_km[0], 'km', 1], ['td_x_d2', r.exact.distances_km[1], 'km', 1], ['td_x_dgeo', r.exact.distance_geo_km, 'km', 1], ['td_x_alt', r.exact.altitude_km, 'km', 2]);
  const q = (s: string): string => (/[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
  return [[tr('td_x_grandeur'), tr('td_x_valeur'), tr('td_x_unite')], ...l.map(([k, v, u, c]) => [tr(k), nombre(v, c), u])].map((x) => x.map(q).join(';')).join('\r\n') + '\r\n';
}

// ------------------------------------------------------------------ dessin (comme la classe Schema de l'appli de bureau)
function couleurs(): Record<string, string> {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string, d: string): string => s.getPropertyValue(n).trim() || d;
  const sombre = document.documentElement.dataset.theme !== 'clair' && !(window.matchMedia?.('(prefers-color-scheme: light)').matches && document.documentElement.dataset.theme !== 'sombre');
  return {
    fond: v('--surface', '#1b1f26'), texte: v('--texte', '#e6e9ed'), doux: v('--texte-3', '#949ca8'),
    terre: sombre ? '#2c4f7c' : '#cfe0f3', bord: sombre ? '#6fa8dc' : '#3d6fb4', corde: sombre ? '#f2c14e' : '#b7791f',
    visee: sombre ? '#ef8a80' : '#c0392b', horizon: sombre ? '#8fd19e' : '#2e7d32', objet: sombre ? '#ffffff' : '#222222',
  };
}

export function dessinerSchema(p: CanvasRenderingContext2D, w: number, hh: number, res: T.Resultat | null, zoom: number): void {
  const c = couleurs();
  p.fillStyle = c.fond;
  p.fillRect(0, 0, w, hh);
  p.font = '13px system-ui, sans-serif';
  if (!res || !res.exact) {
    p.fillStyle = c.doux;
    p.textAlign = 'center';
    p.fillText(tr('td_schema_vide'), w / 2, hh / 2, w - 20);
    return;
  }
  const g = res.geometrie;
  const x = res.exact;
  const ex = T.sous(g.r2, g.r1).map((k) => k / g.corde_km) as T.V3;
  const m: T.V3 = [(g.r1[0] + g.r2[0]) / 2, (g.r1[1] + g.r2[1]) / 2, (g.r1[2] + g.r2[2]) / 2];
  const dot = (a: T.V3, b: T.V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const ey0: T.V3 = [m[0] - dot(m, ex) * ex[0], m[1] - dot(m, ex) * ex[1], m[2] - dot(m, ex) * ex[2]];
  const ny = Math.hypot(...ey0);
  const ey = ey0.map((k) => k / ny) as T.V3;
  const q = (v: T.V3): [number, number] => [dot(v, ex), dot(v, ey)];
  const [x1, y1] = q(g.r1);
  const [x2, y2] = q(g.r2);
  const [xm, ym] = q(x.M);
  const rt = ny + g.fleche_km;
  const loin = Math.hypot(xm, ym) > 3 * rt;
  const xs = [x1, x2];
  const ys = [y1, y2];
  if (!loin) {
    xs.push(xm);
    ys.push(ym);
  } else ys.push(y1 + 0.35 * Math.abs(x2 - x1) + 50);
  let cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  let cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const tout = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 50) * 1.35;
  const base = Math.max(Math.abs(x2 - x1), 1) * 1.3;
  const u = Math.min(1, Math.max(0, (zoom - 1) / 59));
  const etendue = tout * (Math.min(base, tout) / tout) ** u;
  cx += u * ((x1 + x2) / 2 - cx);
  cy += u * ((y1 + y2) / 2 - cy);
  const k = Math.min(w, hh) / etendue;
  const P = (a: number, b: number): [number, number] => [w / 2 + (a - cx) * k, hh / 2 - (b - cy) * k];
  const places: [number, number, number, number][] = [];
  const lw = 190;
  const lh = 110;
  const pts = [P(x1, y1), P(x2, y2), ...(loin ? [] : [P(xm, ym)])];
  const coins: [number, number][] = [[w - lw - 8, 8], [8, 8], [w - lw - 8, hh - lh - 8], [8, hh - lh - 8]];
  const loupe = coins.reduce((best, cn) => {
    const dist = (co: [number, number]): number => Math.min(...pts.map(([a, b]) => Math.hypot(co[0] + lw / 2 - a, co[1] + lh / 2 - b)));
    return dist(cn) > dist(best) ? cn : best;
  });
  places.push([loupe[0] - 4, loupe[1] - 4, lw + 8, lh + 8]);
  const etiquette = (px: number, py: number, texte: string, couleur: string): void => {
    const tw = p.measureText(texte).width + 6;
    const th = 18;
    let r: [number, number, number, number] = [px, py, tw, th];
    for (const [dx, dy] of [[8, -22], [8, 4], [-tw - 8, -22], [-tw - 8, 4], [-tw / 2, -30], [-tw / 2, 12], [14, -9], [-tw - 14, -9], [8, -40], [8, 22]] as [number, number][]) {
      r = [px + dx, py + dy, tw, th];
      const libre = !places.some((o) => r[0] < o[0] + o[2] && r[0] + r[2] > o[0] && r[1] < o[1] + o[3] && r[1] + r[3] > o[1]);
      if (libre && r[0] >= 0 && r[1] >= 0 && r[0] + tw <= w && r[1] + th <= hh) break;
    }
    r[0] = Math.min(Math.max(r[0], 2), w - tw - 2);
    r[1] = Math.min(Math.max(r[1], 2), hh - th - 2);
    places.push(r);
    p.globalAlpha = 0.8;
    p.fillStyle = c.fond;
    p.fillRect(r[0], r[1], r[2], r[3]);
    p.globalAlpha = 1;
    p.fillStyle = couleur;
    p.textAlign = 'left';
    p.textBaseline = 'middle';
    p.fillText(texte, r[0] + 3, r[1] + th / 2);
  };
  const ligne = (a: [number, number], b: [number, number], couleur: string, ep: number, tirets = false): void => {
    p.strokeStyle = couleur;
    p.lineWidth = ep;
    p.setLineDash(tirets ? [5, 4] : []);
    p.beginPath();
    p.moveTo(a[0], a[1]);
    p.lineTo(b[0], b[1]);
    p.stroke();
    p.setLineDash([]);
  };
  // Terre
  const centre = P(0, 0);
  p.fillStyle = c.terre;
  p.strokeStyle = c.bord;
  p.lineWidth = 1.5;
  p.beginPath();
  p.arc(centre[0], centre[1], rt * k, 0, 2 * Math.PI);
  p.fill();
  p.stroke();
  const A = P(x1, y1);
  const B = P(x2, y2);
  const M = P(xm, ym);
  for (const [[xa, ya], pt] of [[[x1, y1], A], [[x2, y2], B]] as [[number, number], [number, number]][]) {
    const n = Math.hypot(xa, ya);
    const [ux, uy] = [xa / n, ya / n];
    const L = etendue * 0.18;
    ligne(pt, P(xa + ux * L, ya + uy * L), c.doux, 1, true);
    ligne(P(xa - uy * L, ya + ux * L), P(xa + uy * L, ya - ux * L), c.horizon, 1.4);
  }
  ligne(A, B, c.corde, 2.2);
  if (loin) {
    for (const [[xa, ya], pt] of [[[x1, y1], A], [[x2, y2], B]] as [[number, number], [number, number]][]) {
      const [dx, dy] = [xm - xa, ym - ya];
      const n = Math.hypot(dx, dy);
      ligne(pt, P(xa + (dx / n) * etendue, ya + (dy / n) * etendue), c.visee, 1.8);
    }
    const t = tr('td_s_objet_loin', { d: nombre(x.distances_km[0], 0) });
    etiquette(w / 2 - p.measureText(t).width / 2, 26, t, c.visee);
  } else {
    ligne(A, M, c.visee, 1.8);
    ligne(B, M, c.visee, 1.8);
    p.fillStyle = c.objet;
    p.beginPath();
    p.arc(M[0], M[1], 4, 0, 2 * Math.PI);
    p.fill();
    etiquette(M[0], M[1], tr('td_s_D', { d: nombre(x.distances_km[0], 0) }), c.visee);
    etiquette((M[0] + A[0]) / 2, (M[1] + A[1]) / 2, '2α = ' + nombre(x.parallaxe_vraie_deg, 2) + '°', c.visee);
  }
  res.lieux.forEach((o, n) => {
    const pt = n === 0 ? A : B;
    p.fillStyle = c.visee;
    p.beginPath();
    p.arc(pt[0], pt[1], 3.5, 0, 2 * Math.PI);
    p.fill();
    etiquette(pt[0], pt[1], (n === 0 ? 'h₁ = ' : 'h₂ = ') + nombre(o.h, 3) + '°', c.texte);
  });
  etiquette((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, tr('td_s_R', { r: nombre(g.corde_km, 1) }), c.corde);
  for (const [pt, prof] of [[A, g.profondeur_deg[0]], [B, g.profondeur_deg[1]]] as [[number, number], number][])
    etiquette(pt[0], pt[1] + 16, tr('td_s_prof', { p: nombre(Math.abs(prof), 2) }), c.horizon);
  etiquette(centre[0] >= 0 && centre[0] <= w && centre[1] >= 0 && centre[1] <= hh ? centre[0] : w / 2, centre[1] >= 0 && centre[1] <= hh ? centre[1] : hh - 30, 'θ = ' + nombre(g.angle_centre_deg, 3) + '°', c.doux);
  // loupe : la flèche
  const [lx, ly] = loupe;
  p.fillStyle = c.fond;
  p.strokeStyle = c.doux;
  p.lineWidth = 1;
  p.beginPath();
  p.roundRect?.(lx, ly, lw, lh, 6);
  if (!p.roundRect) p.rect(lx, ly, lw, lh);
  p.fill();
  p.stroke();
  const f = g.fleche_km;
  const s = g.corde_sol_km;
  const kx = (0.8 * lw) / Math.max(s, 1e-9);
  const ky = (0.45 * lh) / Math.max(f, 1e-9);
  const x0 = lx + lw / 2;
  const yy0 = ly + 26;
  p.strokeStyle = c.bord;
  p.lineWidth = 1.6;
  p.beginPath();
  for (let i = 0; i <= 40; i++) {
    const uu = -s / 2 + (s * i) / 40;
    const yv = f * (1 - ((2 * uu) / s) ** 2);
    const [px, py] = [x0 + uu * kx, yy0 + (f - yv) * ky];
    if (i) p.lineTo(px, py);
    else p.moveTo(px, py);
  }
  p.stroke();
  const yc = yy0 + f * ky;
  ligne([x0 - (s / 2) * kx, yc], [x0 + (s / 2) * kx, yc], c.corde, 1.8);
  ligne([x0, yy0], [x0, yc], c.visee, 1.2, true);
  p.fillStyle = c.texte;
  p.textAlign = 'left';
  p.textBaseline = 'top';
  p.fillText(tr('td_s_loupe'), lx + 6, ly + 4, lw - 12);
  p.textAlign = 'center';
  p.fillText(tr('td_s_fleche', { f: nombre(f * 1000, 0) }), x0, yc + 6, lw - 12);
}
