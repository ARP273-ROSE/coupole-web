/**
 * Calculateur « Planificateur de parallaxe » (#/td/planif) : jumeau du panneau de Coupole (td/gui_planif.py) —
 * deux lieux → créneaux classés (tableau), ciel des deux lieux (toile), détail, exports CSV et agenda .ics.
 * Calcul : src/calc/td_planif.ts.  TLE : CelesTrak, sinon ARISS, sinon le cache (même clé que le calculateur
 * « Parallaxe (TP du cours) »).
 */
import { CoordonneeIllisible, lireAltitude, lirePosition } from '../calc/coordonnees';
import * as P from '../calc/td_planif';
import { tr } from '../i18n/i18n';
import { h, icone } from './dom';
import type { Page } from './page_apropos';

const CLE_MEMOIRE = 'coupole-td-planif';
const CLE_TLE = 'coupole-td-tle';
export const URLS_TLE = ['https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE', 'https://live.ariss.org/iss.txt'];
const COULEURS = ['#e0803a', '#3a9be0'];

const nombre = (x: number | null | undefined, c = 1): string => {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  const s = x.toFixed(c).replace('-', '−');
  return document.documentElement.lang === 'en' ? s : s.replace('.', ',');
};

function lire<T>(cle: string, defaut: T): T {
  try {
    const v = localStorage.getItem(cle);
    return v === null ? defaut : (JSON.parse(v) as T);
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

export function epoqueTle(l: string[]): Date | null {
  const m = /^1 .{16}(\d{2})(\d{3}\.\d+)/.exec(l.find((x) => x.startsWith('1 ')) ?? '');
  if (!m) return null;
  const a = Number(m[1]) + (Number(m[1]) < 57 ? 2000 : 1900);
  return new Date(Date.UTC(a, 0, 1) + (Number(m[2]) - 1) * 86_400_000);
}

/** TLE de l'ISS : CelesTrak, puis ARISS (CelesTrak répond parfois 503), puis le cache. */
export async function tleISS(): Promise<string> {
  let derniere: unknown = null;
  for (const url of URLS_TLE) {
    const arret = new AbortController();
    const minuteur = setTimeout(() => arret.abort(), 8000);
    try {
      const r = await fetch(url, { cache: 'no-store', signal: arret.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const l = (await r.text()).split(/\r?\n/).map((x) => x.trim()).filter((x) => /^[12] /.test(x));
      if (l.length < 2 || l[0]!.slice(2, 7) !== '25544') throw new Error('TLE');
      const texte = l.slice(0, 2).join('\n');
      ecrire(CLE_TLE, { l: texte, recupere: Date.now() });
      return texte;
    } catch (e) {
      derniere = e;
    } finally {
      clearTimeout(minuteur);
    }
  }
  const c = lire<unknown>(CLE_TLE, null);
  if (typeof c === 'string' && c) return c;
  if (c && typeof (c as { l?: unknown }).l === 'string') return (c as { l: string }).l;
  throw derniere instanceof Error ? derniere : new Error('TLE');
}

function telecharger(nom: string, contenu: string, type: string): void {
  const a = h('a', {});
  a.download = nom;
  a.href = URL.createObjectURL(new Blob([contenu], { type }));
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function pagePlanif(): Page {
  const memo = lire<Record<string, string>>(CLE_MEMOIRE, {});
  const garder = (cle: string, v: string): void => {
    memo[cle] = v;
    ecrire(CLE_MEMOIRE, memo);
  };
  const champs: Record<string, HTMLInputElement> = {};
  const champ = (cle: string, libelle: string, aide: string, indice: string, attrs: Record<string, string> = {}): HTMLElement => {
    const i = h('input', { type: 'text', id: 'pl-' + cle, autocomplete: 'off', spellcheck: 'false', placeholder: indice ? tr(indice) : '', title: tr(aide), ...attrs });
    i.value = memo[cle] ?? attrs.value ?? '';
    i.addEventListener('change', () => garder(cle, i.value));
    champs[cle] = i;
    return h('label', { class: 'td-champ', for: 'pl-' + cle }, h('span', { text: libelle }), i);
  };
  const cible = h('select', { id: 'pl-cible', title: tr('pl_cible_aide') },
    h('option', { value: 'iss', text: tr('td_cible_iss') }), h('option', { value: 'lune', text: tr('td_cible_lune') }));
  cible.value = memo.cible ?? 'iss';
  const lieu = (n: number): HTMLElement => h('fieldset', { class: 'td-lieu' }, h('legend', { text: tr('pl_lieu', { n }) }),
    champ('nom' + n, tr('pl_nom'), 'pl_nom_aide', 'pl_nom_indice'),
    champ('p' + n, tr('td_p'), 'td_p_aide', 'td_p_indice'),
    champ('alt' + n, tr('td_alt'), 'td_alt_aide', 'td_alt_indice'));
  const nombreChamp = (cle: string, libelle: string, aide: string, defaut: number, min: number, max: number, pas: number): HTMLElement =>
    champ(cle, libelle, aide, '', { type: 'number', min: String(min), max: String(max), step: String(pas), value: String(defaut) });
  const groupeLune = h('fieldset', { class: 'td-lieu' }, h('legend', { text: tr('td_cible_lune') }),
    nombreChamp('mag', tr('pl_mag'), 'pl_mag_aide', 4.5, 0, 5.5, 0.1),
    nombreChamp('sep', tr('pl_sep') + ' (°)', 'pl_sep_aide', 5, 0.5, 15, 0.5),
    nombreChamp('phase', tr('pl_phase') + ' (%)', 'pl_phase_aide', 95, 5, 100, 1));
  const tendance = h('input', { type: 'checkbox', id: 'pl-tendance', title: tr('pl_tendance_aide') });
  tendance.checked = memo.tendance === '1';
  const caseTendance = h('label', { class: 'pl-case', for: 'pl-tendance' }, tendance, h('span', { text: tr('pl_tendance') }));
  const locale = h('input', { type: 'checkbox', id: 'pl-locale', title: tr('pl_locale_aide') });
  locale.checked = memo.locale === '1';
  const bChercher = h('button', { type: 'button', class: 'bouton principal', text: tr('pl_chercher'), title: tr('pl_chercher_aide') });
  const bExemple = h('button', { type: 'button', class: 'bouton', text: tr('pl_exemple'), title: tr('pl_exemple_aide') });
  const bCsv = h('button', { type: 'button', class: 'bouton', text: tr('pl_csv'), title: tr('pl_csv_aide'), disabled: true });
  const bIcs = h('button', { type: 'button', class: 'bouton', text: tr('pl_ics'), title: tr('pl_ics_aide'), disabled: true });
  const etat = h('p', { class: 'td-etat', role: 'status' });
  const tableau = h('table', { class: 'pl-tableau', title: tr('pl_tableau_aide') });
  const toile = h('canvas', { class: 'pl-ciel', role: 'img', 'aria-label': tr('pl_ciel_aide') });
  const detail = h('div', { class: 'td-detail', title: tr('pl_detail_aide') });
  let res: P.Resultat | null = null;
  let choisi = 0;

  const formulaire = h('div', { class: 'td-formulaire' },
    h('label', { class: 'td-champ' }, h('span', { text: tr('pl_cible') }), cible),
    lieu(1), lieu(2),
    champ('debut', tr('pl_debut'), 'pl_debut_aide', 'pl_debut_indice'),
    h('div', { class: 'td-sigmas' },
      nombreChamp('jours', tr('pl_jours') + ' (' + tr('pl_unite_j') + ')', 'pl_jours_aide', 7, 0.5, 400, 0.5),
      nombreChamp('hmin', tr('pl_hmin') + ' (°)', 'pl_hmin_aide', 20, 0, 85, 1),
      nombreChamp('soleil', tr('pl_soleil') + ' (°)', 'pl_soleil_aide', -6, -18, 0, 1)),
    groupeLune, caseTendance,
    h('label', { class: 'pl-case', for: 'pl-locale' }, locale, h('span', { text: tr('pl_locale') })),
    h('div', { class: 'td-boutons' }, bChercher, bExemple, bCsv, bIcs), etat);
  const el = h('div', { class: 'page page-td' },
    h('nav', { class: 'fil', 'aria-label': tr('web_retour') }, h('a', { href: '#/td' }, icone('retour'), tr('web_nav_td'))),
    h('h1', { text: tr('td_calc_planif') }), h('p', { class: 'chapo', text: tr('pl_intro') }),
    h('div', { class: 'td-grille' }, formulaire, h('div', { class: 'td-resultats' }, h('div', { class: 'pl-defile' }, tableau), toile, detail)));

  const majCible = (): void => {
    groupeLune.hidden = cible.value !== 'lune';
    caseTendance.hidden = cible.value === 'lune';
    champs.jours!.max = String(P.JOURS_MAX[cible.value === 'lune' ? 'lune' : tendance.checked ? 'tendance' : 'iss']);
  };
  cible.addEventListener('change', () => {
    garder('cible', cible.value);
    majCible();
  });
  majCible();
  tendance.addEventListener('change', () => {
    garder('tendance', tendance.checked ? '1' : '0');
    majCible();
  });
  locale.addEventListener('change', () => {
    garder('locale', locale.checked ? '1' : '0');
    remplir();
  });
  bExemple.addEventListener('click', () => {
    const ex: Record<string, string> = { nom1: 'Paris', p1: '48.8366 N, 2.3360 E', alt1: '67', nom2: 'Lyon', p2: '45.7597 N, 4.8422 E', alt2: '170' };
    for (const [k, v] of Object.entries(ex)) {
      champs[k]!.value = v;
      garder(k, v);
    }
  });
  bChercher.addEventListener('click', () => void chercher());
  bCsv.addEventListener('click', () => res && telecharger('parallaxe_creneaux.csv', '﻿' + P.csv(res), 'text/csv'));
  bIcs.addEventListener('click', () => res && telecharger('parallaxe_creneaux.ics', P.ics(res), 'text/calendar'));
  const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => dessiner()) : null;
  obs?.observe(toile);

  const t = (x: Date, avecDate: boolean, avecHeure = true): string => {
    const loc = locale.checked;
    const o: Intl.DateTimeFormatOptions = { ...(avecDate ? { day: '2-digit', month: '2-digit', year: 'numeric' } : {}),
      ...(avecHeure ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false } : {}), ...(loc ? {} : { timeZone: 'UTC' }) };
    const s = new Intl.DateTimeFormat(document.documentElement.lang === 'en' ? 'en-GB' : 'fr-FR', o).format(x);
    return loc || !avecHeure ? s : s + ' UTC';
  };

  function lireDebut(): Date {
    const s = champs.debut!.value.trim();
    if (!s) return new Date();
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(s);
    if (!m) throw new CoordonneeIllisible('pl_err_debut', { texte: s });
    return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +(m[4] ?? 0), +(m[5] ?? 0)));
  }

  async function chercher(): Promise<void> {
    let sites: [P.Site, P.Site];
    let c: P.Criteres;
    try {
      const s = [1, 2].map((n) => {
        const txt = champs['p' + n]!.value;
        if (!txt.trim()) throw new CoordonneeIllisible('pl_err_lieux');
        const p = lirePosition(txt);
        return { lat: p.lat, lon: p.lon, alt_m: lireAltitude(champs['alt' + n]!.value), nom: champs['nom' + n]!.value.trim() };
      });
      sites = [s[0]!, s[1]!];
      const v = (k: string): number => Number(champs[k]!.value);
      const cb = cible.value === 'lune' ? 'lune' : 'iss';
      c = P.criteres(cb, lireDebut(), { jours: v('jours'), h_min: v('hmin'), soleil_max: v('soleil'), etoile_mag_max: v('mag'),
        etoile_sep_max: v('sep'), phase_max: v('phase') / 100, tendance: cb === 'iss' && tendance.checked });
    } catch (e) {
      etat.textContent = e instanceof CoordonneeIllisible ? tr(e.cle, e.valeurs) : String(e).slice(0, 200);
      return;
    }
    bChercher.setAttribute('disabled', '');
    etat.textContent = tr('pl_en_cours');
    await new Promise((r) => setTimeout(r, 30));          // laisser s'afficher « Recherche en cours… »
    try {
      const cat = await P.etoiles();
      if (c.cible === 'iss') {
        let texte = '';
        try {
          texte = await tleISS();
        } catch (e) {
          etat.textContent = tr('pl_err_tle', { erreur: String(e).slice(0, 120) });
          return;
        }
        const l = texte.split('\n');
        const sat = await import('../calc/sgp4');
        const rec = sat.twoline2satrec(l[0]!, l[1]!);
        res = P.chercherISS(sites[0], sites[1], c, (x) => {
          const p = sat.propagate(rec, x);
          if (!p || !p.position || typeof p.position === 'boolean') return null;
          const g = sat.eciToEcf(p.position, sat.gstime(x));
          return [g.x, g.y, g.z];
        }, epoqueTle(l));
      } else {
        res = P.chercherLune(sites[0], sites[1], c, cat);
      }
      choisi = 0;
      remplir();
      bCsv.disabled = bIcs.disabled = !res.creneaux.length;
      if (!res.creneaux.length) {
        etat.textContent = tr('pl_aucun');
        return;
      }
      etat.textContent = [tr('pl_fini', { n: res.nombre_total, debut: t(res.debut, true, false), fin: t(res.fin, true, false),
        base: nombre(res.base_km, 1), source: res.source }), ...res.alertes.map((a) => tr(a))].join(' ');
    } finally {
      bChercher.removeAttribute('disabled');
    }
  }

  function remplir(): void {
    tableau.replaceChildren();
    detail.replaceChildren();
    if (!res) return dessiner();
    const tete = h('tr', {}, ...['pl_col_date', 'pl_col_heure', 'pl_col_note', 'pl_col_h', 'pl_col_mesure', 'pl_col_sujet', 'pl_col_infos']
      .map((k) => h('th', { scope: 'col', text: tr(k) })));
    tableau.append(h('thead', {}, tete));
    const corps = h('tbody', {});
    res.creneaux.forEach((c, i) => {
      const mesure = c.cible === 'iss' ? nombre(c.parallaxe_deg, 1) + '°' : `Δφ ${nombre(c.etoile!.delta_arcmin, 2)}′ (${c.etoile!.nom})`;
      const ligne = h('tr', { tabindex: '0', class: i === choisi ? 'choisi' : '', 'aria-selected': i === choisi ? 'true' : 'false' },
        h('td', { text: t(c.meilleur, true, false) }), h('td', { text: c.marge_s > 120 ? `${t(c.meilleur, false).replace(/:\d\d( UTC)?$/, '$1')} ± ${Math.round(c.marge_s / 60)} min` : t(c.meilleur, false) }), h('td', { class: 'nb', text: String(Math.round(c.note)) }),
        h('td', { text: `${nombre(c.h[0], 0)}° / ${nombre(c.h[1], 0)}°` }), h('td', { text: mesure }),
        h('td', { class: 'nb', text: c.erreur_sujet_pct === null ? '—' : nombre(c.erreur_sujet_pct, 1) + ' %' }),
        h('td', { text: c.remarques.map((k) => tr(k)).join(', ') }));
      const choisir = (): void => {
        choisi = i;
        for (const x of corps.children) {
          x.classList.toggle('choisi', x === ligne);
          x.setAttribute('aria-selected', x === ligne ? 'true' : 'false');
        }
        montrer();
      };
      ligne.addEventListener('click', choisir);
      ligne.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          choisir();
        }
      });
      corps.append(ligne);
    });
    tableau.append(corps);
    montrer();
  }

  function noms(): [string, string] {
    return [0, 1].map((k) => res?.sites[k]!.nom || tr('pl_lieu', { n: k + 1 })) as [string, string];
  }

  function montrer(): void {
    dessiner();
    detail.replaceChildren();
    const c = res?.creneaux[choisi];
    if (!c) return;
    const n = noms();
    const p = (html: string): HTMLElement => {
      const x = h('p', {});
      x.innerHTML = html;
      return x;
    };
    const esc = (s: string): string => s.replace(/[&<>"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[x]!);
    detail.append(h('h2', { text: tr('pl_d_titre_' + c.cible, { date: t(c.meilleur, true, false) }) }),
      p(tr('pl_d_creneau', { debut: esc(t(c.debut, false)), fin: esc(t(c.fin, false)), meilleur: esc(t(c.meilleur, false)), note: String(Math.round(c.note)) })));
    const ul = h('ul', {});
    for (const k of [0, 1]) {
      let li = tr('pl_d_lieu', { nom: esc(n[k]!), h: nombre(c.h[k], 1), az: nombre(c.az[k], 1), d: nombre(c.distance_km[k], 0), s: nombre(c.soleil[k], 1) });
      if (c.magnitude.length) li += tr('pl_d_mag', { m: nombre(c.magnitude[k], 1) });
      const x = h('li', {}, h('span', { class: 'pl-pt' + (k + 1), text: '●' }), ' ');
      const texte = h('span', {});
      texte.innerHTML = li;
      x.append(texte);
      ul.append(x);
    }
    detail.append(ul);
    if (c.cible === 'iss') {
      detail.append(p(tr('pl_d_parallaxe', { p: nombre(c.parallaxe_deg, 2), alt: nombre(c.altitude_km, 0) })),
        p(tr('pl_d_plan', { e: nombre(c.ecart_plan_deg, 1), ou: tr(c.entre ? 'pl_d_entre' : 'pl_d_cote') })),
        p(c.erreur_sujet_pct === null ? tr('pl_d_sujet_na') : tr('pl_d_sujet', { e: nombre(c.erreur_sujet_pct, 1) })),
        p(tr('pl_d_synchro_iss', { v: nombre(c.vitesse_deg_s, 2), s: nombre(c.synchro_s, 2) })));
      if (c.marge_s > 120) {
        const m = h('p', {}, h('b', { text: tr('pl_d_marge', { m: String(Math.round(c.marge_s / 60)), a: nombre(c.marge_s / (2 * P.DERIVE_TLE_S_PAR_JOUR), 0) }) }));
        detail.append(m);
      }
      if (c.etoiles_proches.length) {
        detail.append(p(tr('pl_d_etoiles', { liste: c.etoiles_proches.map((x) => `${esc(x.nom)} (${nombre(x.V, 1)}, ${nombre(x.sep, 1)}°)`).join(', ') })));
      }
    } else {
      const s = c.etoile!;
      detail.append(p(tr('pl_d_phase', { p: nombre(100 * c.phase!, 0) })),
        p(tr('pl_d_etoile', { nom: esc(s.nom), V: nombre(s.V, 1), p1: nombre(s.sep1, 3), p2: nombre(s.sep2, 3), d: nombre(s.delta_arcmin, 2), i: nombre(s.ideal_arcmin, 2) })));
      if (c.erreur_sujet_pct !== null) detail.append(p(tr('pl_d_sujet_lune', { e: nombre(c.erreur_sujet_pct, 1) })));
      detail.append(p(tr('pl_d_synchro_lune', { s: nombre(c.synchro_s, 0) })));
    }
    if (c.remarques.length) detail.append(p(tr('pl_d_remarques', { liste: c.remarques.map((k) => tr(k)).join(', ') })));
    const fin = h('p', {}, h('i', { text: tr('pl_d_conseil') }));
    detail.append(fin);
  }

  function dessiner(): void {
    const r = toile.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(320, Math.round(r.width || 640));
    const hh = Math.max(220, Math.round(r.height || 280));
    toile.width = w * dpr;
    toile.height = hh * dpr;
    const p = toile.getContext('2d');
    if (!p) return;
    p.setTransform(dpr, 0, 0, dpr, 0, 0);
    dessinerCiel(p, w, hh, res?.creneaux[choisi] ?? null, noms());
  }

  setTimeout(() => dessiner(), 0);
  return { el, titre: tr('td_calc_planif') + ' — Coupole Web', detruire: () => obs?.disconnect(), focus: champs.p1 };
}

/** Deux ciels côte à côte (projection azimutale équidistante : zénith au centre, horizon au bord), comme Coupole. */
export function dessinerCiel(p: CanvasRenderingContext2D, w: number, hh: number, c: P.Creneau | null, noms: [string, string]): void {
  const s = getComputedStyle(document.documentElement);
  const texte = s.getPropertyValue('--texte').trim() || '#e6e9ed';
  const fond = s.getPropertyValue('--surface-2').trim() || '#20252d';
  p.clearRect(0, 0, w, hh);
  const r = Math.max(Math.min(w / 4, hh / 2) - 22, 30);
  const xy = (cx: number, cy: number, h: number, az: number): [number, number] => {
    const rr = (r * (90 - h)) / 90;
    return [cx + rr * Math.sin((az * Math.PI) / 180), cy - rr * Math.cos((az * Math.PI) / 180)];
  };
  p.font = '13px system-ui, sans-serif';
  p.textAlign = 'center';
  p.textBaseline = 'middle';
  for (const n of [0, 1]) {
    const cx = w * (0.25 + 0.5 * n);
    const cy = hh / 2 + 8;
    p.fillStyle = fond;
    p.strokeStyle = texte;
    p.lineWidth = 1;
    p.setLineDash([]);
    p.beginPath();
    p.arc(cx, cy, r, 0, 2 * Math.PI);
    p.fill();
    p.stroke();
    p.globalAlpha = 0.3;
    p.setLineDash([4, 4]);
    for (const h of [30, 60]) {
      p.beginPath();
      p.arc(cx, cy, (r * (90 - h)) / 90, 0, 2 * Math.PI);
      p.stroke();
    }
    p.globalAlpha = 1;
    p.setLineDash([]);
    p.fillStyle = texte;
    for (const [cle, az] of [['pl_N', 0], ['pl_E', 90], ['pl_S', 180], ['pl_O', 270]] as const) {
      const [x, y] = xy(cx, cy, -6, az);
      p.fillText(tr(cle), x, y);
    }
    p.fillText(noms[n]!, cx, 9);
    if (!c || !c.trace.length) continue;
    p.strokeStyle = COULEURS[n]!;
    p.lineWidth = 2;
    p.beginPath();
    let premier = true;
    for (const q of c.trace) {
      const [hq, aq] = n === 0 ? [q.h1, q.az1] : [q.h2, q.az2];
      if (hq < 0) {
        premier = true;
        continue;
      }
      const [x, y] = xy(cx, cy, hq, aq);
      if (premier) p.moveTo(x, y);
      else p.lineTo(x, y);
      premier = false;
    }
    p.stroke();
    const [x, y] = xy(cx, cy, c.h[n]!, c.az[n]!);
    p.fillStyle = COULEURS[n]!;
    p.beginPath();
    p.arc(x, y, 5, 0, 2 * Math.PI);
    p.fill();
  }
}
