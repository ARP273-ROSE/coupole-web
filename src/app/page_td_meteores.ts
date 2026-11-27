/**
 * Calculateur « Pluies de météores » (#/td/meteores) : jumeau du panneau de Coupole (td/gui_meteores.py) — lieu et
 * réglages à gauche ; onglets Calendrier, Une nuit (graphique et détail), Campagne (meilleures nuits, agenda .ics,
 * CSV) et Réduction (ZHR, indice r).  Calcul : src/calc/td_meteores.ts.
 */
import { CoordonneeIllisible, lireAltitude, lirePosition } from '../calc/coordonnees';
import * as M from '../calc/td_meteores';
import type { Site } from '../calc/td_planif';
import { tr } from '../i18n/i18n';
import { onglets } from './composants';
import { h, icone } from './dom';
import type { Page } from './page_apropos';
import { boutonLieu } from './page_td';

const CLE_MEMOIRE = 'coupole-td-meteores';
const COULEURS = ['#e0803a', '#3a9be0', '#4caf50', '#b05fd0', '#d0b030'];

const en = (): boolean => document.documentElement.lang === 'en';
const nombre = (x: number | null | undefined, c = 1): string => {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  const s = (Math.abs(x) < 0.5 * 10 ** -c ? 0 : x).toFixed(c).replace('-', '−');
  return en() ? s : s.replace('.', ',');
};
const nomDe = (x: { nom: { fr: string; en: string } }): string => (en() ? x.nom.en : x.nom.fr);
const esc = (s: string): string => s.replace(/[&<>"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[x]!);

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

function telecharger(nom: string, contenu: string, type: string): void {
  const a = h('a', {});
  a.download = nom;
  a.href = URL.createObjectURL(new Blob([contenu], { type }));
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function lireJour(s: string): [number, number, number] {
  const m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$/.exec(s);
  if (!m) throw new CoordonneeIllisible('mt_err_date', { texte: s });
  return [+m[1]!, +m[2]!, +m[3]!];
}

export function lireInstant(s: string, locale: boolean): Date {
  const m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})\s*$/.exec(s);
  if (!m) throw new CoordonneeIllisible('mt_err_date', { texte: s });
  const v = [+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!] as const;
  return locale ? new Date(...v) : new Date(Date.UTC(...v));
}

export function lireMagnitudes(s: string): Record<number, number> {
  const out: Record<number, number> = {};
  for (const morceau of s.replace(/[,;]/g, ' ').split(/\s+/).filter(Boolean)) {
    const m = /^([+−-]?\d+):(\d+)$/.exec(morceau);
    if (!m) throw new CoordonneeIllisible('mt_r_mags_aide');
    const k = Number(m[1]!.replace('−', '-'));
    out[k] = (out[k] ?? 0) + Number(m[2]);
  }
  return out;
}

const aujourdhui = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function pageMeteores(): Page {
  const memo = lire<Record<string, string>>(CLE_MEMOIRE, {});
  const garder = (cle: string, v: string): void => {
    memo[cle] = v;
    ecrire(CLE_MEMOIRE, memo);
  };
  const champs: Record<string, HTMLInputElement> = {};
  const champ = (cle: string, libelle: string, aide: string, indice: string, attrs: Record<string, string> = {}, memoriser = true): HTMLElement => {
    const i = h('input', { type: 'text', id: 'mt-' + cle, autocomplete: 'off', spellcheck: 'false', placeholder: indice ? tr(indice) : '', title: tr(aide), ...attrs });
    i.value = (memoriser ? memo[cle] : undefined) ?? attrs.value ?? '';
    if (memoriser) i.addEventListener('change', () => garder(cle, i.value));
    champs[cle] = i;
    return h('label', { class: 'td-champ', for: 'mt-' + cle }, h('span', { text: libelle }), i);
  };
  const nombreChamp = (cle: string, libelle: string, aide: string, defaut: number, min: number, max: number, pas: number, memoriser = true): HTMLElement =>
    champ(cle, libelle, aide, '', { type: 'number', min: String(min), max: String(max), step: String(pas), value: String(defaut) }, memoriser);
  const v = (k: string): number => Number(champs[k]!.value);
  const locale = h('input', { type: 'checkbox', id: 'mt-locale', title: tr('mt_locale_aide') });
  locale.checked = memo.locale === '1';
  const etat = h('p', { class: 'td-etat', role: 'status', 'aria-live': 'polite' });
  const bExemple = h('button', { type: 'button', class: 'bouton', text: tr('pl_exemple'), title: tr('pl_exemple_aide') });

  const formulaire = h('div', { class: 'td-formulaire' },
    h('fieldset', { class: 'td-lieu' }, h('legend', { text: tr('mt_lieu') }),
      champ('nom', tr('pl_nom'), 'pl_nom_aide', 'pl_nom_indice'),
      champ('p', tr('td_p'), 'td_p_aide', 'td_p_indice'),
      champ('alt', tr('td_alt'), 'td_alt_aide', 'td_alt_indice'),
      boutonLieu(1, () => champs.p!, () => champs.alt!, () => champs.nom!)),
    h('div', { class: 'td-sigmas' },
      nombreChamp('lm', tr('mt_lm'), 'mt_lm_aide', 6.0, 2, 7.5, 0.1),
      nombreChamp('f', tr('mt_f'), 'mt_f_aide', 1.0, 0.1, 1, 0.05)),
    h('label', { class: 'pl-case', for: 'mt-locale' }, locale, h('span', { text: tr('mt_locale') })),
    h('div', { class: 'td-boutons' }, bExemple), etat);

  const site = (obligatoire = true): Site | null => {
    const txt = champs.p!.value;
    if (!txt.trim()) {
      if (obligatoire) throw new CoordonneeIllisible('mt_err_lieu');
      return null;
    }
    const p = lirePosition(txt);
    return { lat: p.lat, lon: p.lon, alt_m: lireAltitude(champs.alt!.value), nom: champs.nom!.value.trim() };
  };
  const probleme = (e: unknown): void => {
    etat.textContent = e instanceof CoordonneeIllisible ? tr(e.cle, e.valeurs) : String(e).slice(0, 200);
  };
  const fmt = (x: Date, o: Intl.DateTimeFormatOptions, utc = true): string => {
    const s = new Intl.DateTimeFormat(en() ? 'en-GB' : 'fr-FR', { ...o, ...(locale.checked ? {} : { timeZone: 'UTC' }) }).format(x);
    return !locale.checked && utc && o.hour ? s + ' UTC' : s;
  };
  const heure = (x: Date): string => fmt(x, { hour: '2-digit', minute: '2-digit', hour12: false });
  const jourMois = (x: Date): string => fmt(x, { day: '2-digit', month: '2-digit' });

  // ------------------------------------------------------------------ calendrier
  const annee = h('input', { type: 'number', id: 'mt-annee', min: '1900', max: '2100', step: '1', title: tr('mt_annee_aide') });
  const now = new Date();
  annee.value = String(now.getFullYear() + (now.getMonth() === 11 ? 1 : 0));
  const tCal = h('table', { class: 'pl-tableau', title: tr('mt_calendrier_aide') });
  let cal: M.LigneCalendrier[] = [];
  let choisiCal = -1;
  const bNuitMax = h('button', { type: 'button', class: 'bouton', text: tr('mt_voir_nuit') });
  const panCal = h('div', {},
    h('div', { class: 'td-boutons' }, h('label', { class: 'td-champ', for: 'mt-annee' }, h('span', { text: tr('mt_annee') }), annee), bNuitMax),
    h('div', { class: 'pl-defile' }, tCal), h('p', { class: 'td-etat', text: tr('mt_sources') }));

  function calendrier(): void {
    let s: Site | null = null;
    try {
      s = site(false);
    } catch {
      s = null;
    }
    const a = Math.round(Number(annee.value));
    if (!(a >= 1900 && a <= 2100)) return;
    cal = M.calendrier(a, s);
    tCal.replaceChildren(h('thead', {}, h('tr', {}, ...['mt_col_pluie', 'mt_col_activite', 'mt_col_max', 'mt_col_zhr', 'mt_col_r', 'mt_col_v', 'mt_col_radiant', 'mt_col_culm', 'mt_col_lune']
      .map((k) => h('th', { scope: 'col', text: tr(k) })))));
    const corps = h('tbody', {});
    cal.forEach((e, i) => {
      const z = e.note_zhr === 'var' ? tr('mt_zhr_var') : e.note_zhr === '+' ? tr('mt_zhr_plus', { z: e.zhr }) : String(e.zhr);
      const culm = e.culmination === undefined ? '—' : e.culmination > 0 ? nombre(e.culmination, 0) + '°' : tr('mt_jamais');
      const ligne = h('tr', { tabindex: '0', class: i === choisiCal ? 'choisi' : '', 'data-code': e.code },
        h('td', { text: `${nomDe(e)} (${e.code})` }), h('td', { text: `${jourMois(e.debut)} – ${jourMois(e.fin)}` }),
        h('td', { text: e.max ? fmt(e.max, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '—' }),
        h('td', { class: 'nb', text: z }), h('td', { class: 'nb', text: nombre(e.r, 1) }), h('td', { class: 'nb', text: String(e.v) }),
        h('td', { text: `${nombre(e.alpha, 0)}°, ${nombre(e.delta, 0)}°` }), h('td', { class: 'nb', text: culm }),
        h('td', { class: 'nb', text: e.lune === undefined ? '—' : Math.round(100 * e.lune) + ' %' }));
      const choisir = (): void => {
        choisiCal = i;
        for (const x of corps.children) x.classList.toggle('choisi', x === ligne);
      };
      ligne.addEventListener('click', choisir);
      ligne.addEventListener('dblclick', () => {
        choisir();
        nuitDuMax();
      });
      ligne.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          choisir();
          nuitDuMax();
        } else if (ev.key === ' ') {
          ev.preventDefault();
          choisir();
        }
      });
      corps.append(ligne);
    });
    tCal.append(corps);
  }

  // ------------------------------------------------------------------ une nuit
  const choixPluie = h('select', { id: 'mt-pluie', title: tr('mt_nuit_pluie') },
    h('option', { value: '', text: tr('mt_pluie_toutes') }), ...M.PLUIES.map((p) => h('option', { value: p.code, text: `${nomDe(p)} (${p.code})` })));
  const bNuit = h('button', { type: 'button', class: 'bouton principal', text: tr('mt_calculer') });
  const toile = h('canvas', { class: 'pl-ciel mt-graphe', role: 'img', 'aria-label': tr('mt_graphe_aide') });
  const dNuit = h('div', { class: 'td-detail' });
  let N: M.Nuit | null = null;
  const panNuit = h('div', {},
    h('div', { class: 'td-sigmas' }, champ('nuit', tr('mt_nuit_date'), 'mt_nuit_date_aide', 'mt_nuit_indice', { value: aujourdhui() }, false),
      h('label', { class: 'td-champ', for: 'mt-pluie' }, h('span', { text: tr('mt_nuit_pluie') }), choixPluie),
      nombreChamp('zhr', tr('mt_zhr_force'), 'mt_zhr_force_aide', 0, 0, 10000, 1, false)),
    h('div', { class: 'td-boutons' }, bNuit), toile, dNuit);

  function calculerNuit(): void {
    try {
      const s = site()!;
      const jour = lireJour(champs.nuit!.value);
      const code = choixPluie.value;
      const force: Record<string, number> = code && v('zhr') > 0 ? { [code]: v('zhr') } : {};
      N = M.nuit(s, jour, v('lm'), v('f'), code ? [code] : null, 5, force);
      etat.textContent = '';
      montrerNuit();
    } catch (e) {
      probleme(e);
    }
  }

  function montrerNuit(): void {
    dessiner();
    dNuit.replaceChildren();
    if (!N) return;
    const p = (html: string): HTMLElement => {
      const x = h('p', {});
      x.innerHTML = html;
      return x;
    };
    dNuit.append(h('h2', { text: tr('mt_n_titre', { date: fmt(N.debut, { day: '2-digit', month: '2-digit', year: 'numeric' }) }) }));
    dNuit.append(p(N.nuit ? tr('mt_n_noire', { debut: esc(heure(M.instant(N, N.nuit[0]))), fin: esc(heure(M.instant(N, N.nuit[1]))) }) : tr('mt_n_pas_nuit')));
    dNuit.append(p(tr('mt_n_lune', { p: Math.round(100 * N.lune_frac) }) + tr(N.lune_frac <= M.LUNE_NEGLIGEABLE ? 'mt_n_lune_ok' : 'mt_n_lune_ko')));
    if (!N.pluies.length) dNuit.append(p(tr('mt_n_aucune')));
    for (const x of N.pluies) {
      let s: string;
      if (x.meilleur === null || x.attendu <= 0) s = tr('mt_n_pluie_rien', { nom: esc(nomDe(x)) });
      else {
        const i = x.meilleur;
        s = tr('mt_n_pluie', { nom: esc(nomDe(x)), n: nombre(x.attendu, 0), heures: nombre(x.heures, 1),
          taux: nombre(x.taux[i]!, x.taux[i]! >= 10 ? 0 : 1), heure: esc(heure(M.instant(N, i))), h: nombre(x.h[i]!, 0),
          z: nombre(x.zhr[i]!, x.zhr[i]! >= 10 ? 0 : 1) });
        if (x.champ) s += ' ' + tr('mt_n_champ', { az: nombre(x.champ[0], 0), h: nombre(x.champ[1], 0) });
      }
      if (x.variable) s += tr('mt_n_var');
      dNuit.append(p(s));
    }
    dNuit.append(h('p', {}, h('i', { text: tr('mt_n_conseil') })), h('p', {}, h('small', { text: tr('mt_sources') })));
  }

  function dessiner(): void {
    const r = toile.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(320, Math.round(r.width || 640));
    const hh = Math.max(220, Math.round(r.height || 280));
    toile.width = w * dpr;
    toile.height = hh * dpr;
    const c = toile.getContext('2d');
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    dessinerNuit(c, w, hh, N, locale.checked);
  }

  // ------------------------------------------------------------------ campagne
  const bCamp = h('button', { type: 'button', class: 'bouton principal', text: tr('mt_chercher') });
  const bIcs = h('button', { type: 'button', class: 'bouton', text: tr('mt_ics'), disabled: true });
  const bCsv = h('button', { type: 'button', class: 'bouton', text: tr('mt_csv'), disabled: true });
  const tCamp = h('table', { class: 'pl-tableau', title: tr('mt_campagne_aide') });
  let camp: M.LigneCampagne[] = [];
  let campSite: Site | null = null;
  const panCamp = h('div', {},
    h('div', { class: 'td-sigmas' }, champ('du', tr('mt_du'), 'mt_du_aide', 'mt_nuit_indice', {}, false),
      champ('au', tr('mt_au'), 'mt_au_aide', 'mt_nuit_indice', {}, false),
      nombreChamp('min', `${tr('mt_min')} (${tr('mt_unite_met')})`, 'mt_min_aide', 20, 1, 1000, 1)),
    h('div', { class: 'td-boutons' }, bCamp, bIcs, bCsv), h('div', { class: 'pl-defile' }, tCamp));

  async function chercher(): Promise<void> {
    let s: Site;
    let du: [number, number, number];
    let au: [number, number, number];
    try {
      s = site()!;
      if (champs.du!.value.trim()) du = lireJour(champs.du!.value);
      else {
        const d = new Date();
        du = [d.getFullYear(), d.getMonth() + 1, d.getDate()];
      }
      au = champs.au!.value.trim() ? lireJour(champs.au!.value) : [du[0] + (du[1] > 8 ? 1 : 0), 8, 31];
    } catch (e) {
      probleme(e);
      return;
    }
    bCamp.setAttribute('disabled', '');
    etat.textContent = tr('mt_en_cours');
    await new Promise((r) => setTimeout(r, 30));
    try {
      camp = M.campagne(s, du, au, v('lm'), v('f'), v('min'));
      campSite = s;
      remplirCampagne();
      bIcs.disabled = bCsv.disabled = !camp.length;
      const f = (x: [number, number, number]): string => `${String(x[2]).padStart(2, '0')}/${String(x[1]).padStart(2, '0')}/${x[0]}`;
      etat.textContent = camp.length ? tr('mt_c_fini', { n: new Set(camp.map((x) => x.nuit)).size, debut: f(du), fin: f(au) }) : tr('mt_c_aucun');
    } finally {
      bCamp.removeAttribute('disabled');
    }
  }

  function remplirCampagne(): void {
    tCamp.replaceChildren();
    if (!camp.length) return;
    tCamp.append(h('thead', {}, h('tr', {}, ...['mt_col_nuit', 'mt_col_pluie', 'mt_col_attendus', 'mt_col_heures', 'mt_col_meilleur', 'mt_col_taux', 'mt_col_hr', 'mt_col_lune', 'mt_col_note']
      .map((k) => h('th', { scope: 'col', text: tr(k) })))));
    const corps = h('tbody', {});
    for (const x of camp) {
      const [a, m, j] = x.nuit.split('-');
      const ligne = h('tr', { tabindex: '0' },
        h('td', { text: `${j}/${m}/${a}` }), h('td', { text: `${nomDe(x)} (${x.code})` }), h('td', { class: 'nb', text: nombre(x.attendu, 0) }),
        h('td', { class: 'nb', text: nombre(x.heures, 1) }), h('td', { text: heure(x.meilleur) }), h('td', { class: 'nb', text: nombre(x.taux_max, 0) }),
        h('td', { class: 'nb', text: nombre(x.h_radiant, 0) + '°' }), h('td', { class: 'nb', text: Math.round(100 * x.lune) + ' %' }),
        h('td', { class: 'nb', text: String(x.note) }));
      const ouvrir = (): void => {
        champs.nuit!.value = x.nuit;
        choixPluie.value = x.code;
        allerA('nuit');
        calculerNuit();
      };
      ligne.addEventListener('dblclick', ouvrir);
      ligne.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') ouvrir();
      });
      corps.append(ligne);
    }
    tCamp.append(corps);
  }

  // ------------------------------------------------------------------ réduction
  const choixRed = h('select', { id: 'mt-rpluie', title: tr('mt_nuit_pluie') }, ...M.PLUIES.map((p) => h('option', { value: p.code, text: `${nomDe(p)} (${p.code})` })));
  choixRed.value = memo.rpluie ?? 'GEM';
  const bRed = h('button', { type: 'button', class: 'bouton principal', text: tr('mt_r_calculer') });
  const bR = h('button', { type: 'button', class: 'bouton', text: tr('mt_r_r_calc') });
  const lZhr = h('div', { class: 'td-detail', role: 'status' });
  const lR = h('p', { class: 'td-etat' });
  const panRed = h('div', {},
    h('p', { text: tr('mt_r_intro') }),
    h('label', { class: 'td-champ', for: 'mt-rpluie' }, h('span', { text: tr('mt_r_pluie') }), choixRed),
    h('div', { class: 'td-sigmas' }, champ('rdeb', tr('mt_r_debut'), 'mt_r_heure_aide', 'pl_debut_indice', {}, false),
      champ('rfin', tr('mt_r_fin'), 'mt_r_heure_aide', 'pl_debut_indice', {}, false),
      nombreChamp('pause', `${tr('mt_r_pause')} (${tr('mt_unite_min')})`, 'mt_r_pause_aide', 0, 0, 600, 1, false)),
    h('div', { class: 'td-sigmas' }, nombreChamp('n', tr('mt_r_n'), 'mt_r_n_aide', 0, 0, 100000, 1, false),
      nombreChamp('r', tr('mt_r_r'), 'mt_r_r_aide', M.pluie(choixRed.value).r, 1.2, 5, 0.01, false)),
    h('div', { class: 'td-boutons' }, bRed), lZhr,
    champ('mags', tr('mt_r_mags'), 'mt_r_mags_aide', 'mt_r_mags_indice', {}, false),
    h('div', { class: 'td-boutons' }, bR), lR);

  function reduire(): void {
    try {
      const s = site()!;
      const t0 = lireInstant(champs.rdeb!.value, locale.checked);
      const t1 = lireInstant(champs.rfin!.value, locale.checked);
      const tEff = ((t1.getTime() - t0.getTime()) / 60_000 - v('pause')) / 60;
      const hr = M.hauteurRadiant(s, choixRed.value, new Date((t0.getTime() + t1.getTime()) / 2));
      let r: M.Reduction;
      try {
        r = M.reduction(v('n'), tEff, v('lm'), v('f'), v('r'), hr);
      } catch (e) {
        lZhr.textContent = tr((e as Error).message);
        return;
      }
      let html: string;
      if (r.zhr === null) html = tr('mt_r_couche');
      else {
        const fa = r.facteurs!;
        html = tr('mt_r_resultat', { z: nombre(r.zhr, 1), e: nombre(r.err, 1), t: nombre(tEff, 2), h: nombre(hr, 1) }) + '<br>' +
          tr('mt_r_facteurs', { t: nombre(fa.temps, 2), f: nombre(fa.champ, 2), lm: nombre(fa.lm, 2), h: nombre(fa.hauteur, 2) });
      }
      for (const a of r.alertes) html += '<br><b>' + esc(tr(a)) + '</b>';
      lZhr.innerHTML = html;
      etat.textContent = '';
    } catch (e) {
      probleme(e);
    }
  }

  function estimerR(): void {
    let c: Record<number, number>;
    try {
      c = lireMagnitudes(champs.mags!.value);
    } catch (e) {
      lR.textContent = e instanceof CoordonneeIllisible ? tr(e.cle) : String(e);
      return;
    }
    const r = M.indicePopulation(c, v('lm'));
    if (r.r === null) {
      lR.textContent = tr('mt_r_indice_aucun');
      return;
    }
    lR.textContent = tr('mt_r_indice', { r: nombre(r.r, 2), liste: r.rapports.map(([, x]) => nombre(x, 2)).join(', ') });
    champs.r!.value = r.r.toFixed(2);
  }

  // ------------------------------------------------------------------ assemblage
  const blocs: Record<string, HTMLElement> = { calendrier: panCal, nuit: panNuit, campagne: panCamp, reduction: panRed };
  const ongletActif = memo.onglet && memo.onglet in blocs ? memo.onglet : 'calendrier';
  const barre = onglets(Object.keys(blocs).map((id) => ({ id: 'mt-' + id, libelle: tr('mt_onglet_' + id), remplir: (p: HTMLElement) => {
    p.append(blocs[id]!);
    if (id === 'nuit') setTimeout(() => dessiner(), 0);
  } })), 'mt-' + ongletActif, (id) => garder('onglet', id.slice(3)), tr('td_calc_meteores'));
  const allerA = (id: string): void => (barre.querySelector(`#onglet-mt-${id}`) as HTMLButtonElement).click();

  const el = h('div', { class: 'page page-td' },
    h('nav', { class: 'fil', 'aria-label': tr('web_retour') }, h('a', { href: '#/td' }, icone('retour'), tr('web_nav_td'))),
    h('h1', { text: tr('td_calc_meteores') }), h('p', { class: 'chapo', text: tr('mt_intro') }),
    h('div', { class: 'td-grille' }, formulaire, h('div', { class: 'td-resultats' }, barre)));

  function nuitDuMax(): void {
    const e = cal[choisiCal];
    if (!e?.max) return;
    // la nuit « du soir » : un maximum au petit matin appartient à la nuit de la veille (heure locale du navigateur)
    const t = new Date(e.max.getTime() - 12 * 3_600_000);
    champs.nuit!.value = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    choixPluie.value = e.code;
    allerA('nuit');
    calculerNuit();
  }

  bExemple.addEventListener('click', () => {
    for (const [k, x] of Object.entries({ nom: 'Paris', p: '48.8366 N, 2.3360 E', alt: '67' })) {
      champs[k]!.value = x;
      garder(k, x);
    }
    calendrier();
  });
  champs.p!.addEventListener('change', () => calendrier());
  annee.addEventListener('change', () => calendrier());
  locale.addEventListener('change', () => {
    garder('locale', locale.checked ? '1' : '0');
    calendrier();
    if (N) montrerNuit();
    remplirCampagne();
  });
  bNuitMax.addEventListener('click', nuitDuMax);
  bNuit.addEventListener('click', calculerNuit);
  bCamp.addEventListener('click', () => void chercher());
  bIcs.addEventListener('click', () => camp.length && telecharger('meteores_nuits.ics', M.ics(camp, campSite?.nom ?? ''), 'text/calendar'));
  bCsv.addEventListener('click', () => camp.length && telecharger('meteores_nuits.csv', '﻿' + M.csv(camp), 'text/csv'));
  choixRed.addEventListener('change', () => {
    garder('rpluie', choixRed.value);
    champs.r!.value = String(M.pluie(choixRed.value).r);
  });
  bRed.addEventListener('click', reduire);
  bR.addEventListener('click', estimerR);
  const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => dessiner()) : null;
  obs?.observe(toile);
  calendrier();
  return { el, titre: tr('td_calc_meteores') + ' — Coupole Web', detruire: () => obs?.disconnect(), focus: champs.p };
}

/** Nuit de midi à midi (on montre la nuit et une heure de part et d'autre) : hauteurs des radiants (traits), de la
 * Lune (tirets), taux attendu de la première pluie (aire, axe de droite), crépuscule en gris — comme Coupole. */
export function dessinerNuit(p: CanvasRenderingContext2D, w: number, hh: number, N: M.Nuit | null, locale: boolean): void {
  const s = getComputedStyle(document.documentElement);
  const texte = s.getPropertyValue('--texte').trim() || '#e6e9ed';
  p.clearRect(0, 0, w, hh);
  if (!N) return;
  p.font = '12px system-ui, sans-serif';
  const n = N.soleil.length;
  const nuit = N.soleil.map((x, i) => (x < 0 ? i : -1)).filter((i) => i >= 0);
  const i0 = nuit.length ? Math.max(nuit[0]! - 12, 0) : 0;
  const i1 = nuit.length ? Math.min(nuit[nuit.length - 1]! + 12, n - 1) : n - 1;
  const g = 34;
  const d = 36;
  const haut = 18;
  const bas = 40;
  const R = { x: g, y: haut, w: Math.max(w - g - d, 50), h: Math.max(hh - haut - bas, 50) };
  const X = (i: number): number => R.x + ((i - i0) / Math.max(i1 - i0, 1)) * R.w;
  const Y = (h: number): number => R.y + R.h - (Math.max(Math.min(h, 90), 0) / 90) * R.h;
  p.fillStyle = texte;
  p.globalAlpha = 0.14;
  let debut = -1;
  for (let i = i0; i <= i1; i++) {
    const clair = N.soleil[i]! >= M.SOLEIL_MAX && i < i1;
    if (clair && debut < 0) debut = i;
    else if (!clair && debut >= 0) {
      p.fillRect(X(debut), R.y, X(i) - X(debut), R.h);
      debut = -1;
    }
  }
  p.globalAlpha = 1;
  p.strokeStyle = texte;
  p.lineWidth = 1;
  p.globalAlpha = 0.35;
  p.setLineDash([2, 3]);
  p.textAlign = 'right';
  p.textBaseline = 'middle';
  for (const h of [20, 30, 60, 90]) {
    p.beginPath();
    p.moveTo(R.x, Y(h));
    p.lineTo(R.x + R.w, Y(h));
    p.stroke();
  }
  p.globalAlpha = 1;
  p.setLineDash([]);
  for (const h of [20, 30, 60, 90]) p.fillText(h + '°', R.x - 4, Y(h));
  p.strokeRect(R.x, R.y, R.w, R.h);
  // heures paires
  p.textAlign = 'center';
  p.textBaseline = 'top';
  const heureDe = (t: Date): number => (locale ? t.getHours() : t.getUTCHours());
  const t0 = M.instant(N, i0).getTime();
  const t1 = M.instant(N, i1).getTime();
  for (let t = Math.ceil(t0 / 3_600_000) * 3_600_000; t <= t1; t += 3_600_000) {
    const x = new Date(t);
    if (!locale && heureDe(x) % 2) continue;
    if (locale && (x.getMinutes() !== 0 || heureDe(x) % 2)) continue;
    const xx = X(i0 + (t - t0) / 1000 / N.pas_s);
    p.beginPath();
    p.moveTo(xx, R.y + R.h);
    p.lineTo(xx, R.y + R.h + 4);
    p.stroke();
    p.fillText(String(heureDe(x)).padStart(2, '0') + 'h', xx, R.y + R.h + 5);
  }
  // taux de la première pluie
  if (N.pluies.length) {
    const e = N.pluies[0]!;
    const tm = Math.max(...e.taux.slice(i0, i1 + 1), 1);
    const k = 10 ** Math.floor(Math.log10(tm));
    const ech = [1, 2, 5, 10].map((m) => m * k).find((x) => x >= tm)!;
    p.fillStyle = COULEURS[0]!;
    p.globalAlpha = 0.25;
    p.beginPath();
    p.moveTo(X(i0), R.y + R.h);
    for (let i = i0; i <= i1; i++) p.lineTo(X(i), R.y + R.h - ((e.utile[i] ? e.taux[i]! : 0) / ech) * R.h);
    p.lineTo(X(i1), R.y + R.h);
    p.fill();
    p.globalAlpha = 1;
    p.fillStyle = texte;
    p.textAlign = 'left';
    p.textBaseline = 'middle';
    for (const x of [0, ech / 2, ech]) p.fillText(String(x), R.x + R.w + 4, R.y + R.h - (x / ech) * R.h);
  }
  const courbe = (vals: number[], couleur: string, tirets = false): void => {
    p.strokeStyle = couleur;
    p.lineWidth = 2;
    p.setLineDash(tirets ? [6, 4] : []);
    p.beginPath();
    let dedans = false;
    for (let i = i0; i <= i1; i++) {
      if (vals[i]! > 0) {
        if (dedans) p.lineTo(X(i), Y(vals[i]!));
        else p.moveTo(X(i), Y(vals[i]!));
        dedans = true;
      } else dedans = false;
    }
    p.stroke();
    p.setLineDash([]);
  };
  courbe(N.lune, texte, true);
  const legende: [string, string | null][] = [[`${tr('mt_leg_lune')} ${Math.round(100 * N.lune_frac)} %`, null]];
  N.pluies.slice(0, COULEURS.length).forEach((e, k) => {
    courbe(e.h, COULEURS[k]!);
    legende.push([e.code, COULEURS[k]!]);
  });
  p.fillStyle = texte;
  p.textAlign = 'left';
  p.textBaseline = 'top';
  p.fillText(tr('mt_axe_h'), R.x, 2);
  p.textAlign = 'right';
  p.fillText(tr('mt_axe_taux'), R.x + R.w + d - 2, 2);
  let x = R.x;
  const y = R.y + R.h + 22;
  p.textAlign = 'left';
  for (const [nom, c] of legende) {
    p.strokeStyle = c ?? texte;
    p.setLineDash(c ? [] : [6, 4]);
    p.beginPath();
    p.moveTo(x, y + 7);
    p.lineTo(x + 16, y + 7);
    p.stroke();
    p.setLineDash([]);
    p.fillStyle = texte;
    p.fillText(nom, x + 20, y);
    x += p.measureText(nom).width + 36;
  }
}
