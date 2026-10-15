/**
 * « Ma progression » : scores par module, questions réussies, ratées, à revoir ; animations aux réglages gardés ;
 * sauvegarde : exporter (fichier JSON, lisible aussi par Coupole), importer (fusionner ou remplacer), réinitialiser
 * tout ou partie (une animation, un module, tous les réglages, toutes les réponses et scores, Mes modules, les
 * préférences, tout) avec confirmation, copie téléchargée avant l'effacement et « Annuler ».
 */
import * as S from '../contenu/sauvegarde';
import { PAR_ID } from '../anim/registre';
import { langue, tr } from '../i18n/i18n';
import { annoncer, h, icone } from './dom';
import * as contenu from './contenu';
import { barreScore, confirmer } from './composants';
import type { Page } from './page_apropos';
import * as stockage from './stockage';

export async function pageProgression(): Promise<Page> {
  await stockage.pret();
  const s = stockage.doc();
  const ms = await contenu.modules();
  const titreQ = new Map<string, { t: string; m: string; n: string }>();
  for (const m of ms) for (const q of m.questions) if (!titreQ.has(q.id)) titreQ.set(q.id, { t: q.t ? contenu.bi(q.t) : q.id, m: m.cle, n: q.n });

  // ------------------------------------------------------------ bilan général
  const toutes = [...titreQ.keys()].filter((id) => ms.some((m) => m.questions.some((q) => q.id === id && q.ok)));
  const b = S.bilan(s, toutes);
  const resume = h('dl', { class: 'chiffres' },
    h('div', {}, h('dt', { text: tr('web_essayees') }), h('dd', { text: `${b.essayees} / ${b.total}` })),
    h('div', {}, h('dt', { text: tr('web_reussies') }), h('dd', { text: String(b.reussies) })),
    h('div', {}, h('dt', { text: tr('web_ratees') }), h('dd', { text: String(b.ratees) })),
    h('div', {}, h('dt', { text: tr('web_a_revoir') }), h('dd', { text: String(b.a_revoir) })),
    h('div', {}, h('dt', { text: tr('web_premier_coup') }), h('dd', { text: String(b.premier_coup) })),
    h('div', {}, h('dt', { text: tr('web_tentatives') }), h('dd', { text: String(b.tentatives) })),
  );

  // ------------------------------------------------------------ par module
  const table = h('table', { class: 'table-progression' },
    h('caption', { class: 'visuellement-cache', text: tr('web_par_module') }),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: tr('web_module') }), h('th', { scope: 'col', class: 'num', text: tr('web_reussies') }), h('th', { scope: 'col', class: 'num', text: tr('web_ratees') }), h('th', { scope: 'col', class: 'num', text: tr('web_score') }), h('th', { scope: 'col', text: tr('web_progression') }))));
  const corps = h('tbody');
  for (const m of ms) {
    const ids = m.questions.filter((q) => q.ok).map((q) => q.id);
    if (!ids.length) continue;
    const x = S.bilan(s, ids);
    corps.append(h('tr', {}, h('th', { scope: 'row' }, h('a', { href: `#/m/${m.cle}`, text: contenu.bi(m.titre) })), h('td', { class: 'num', text: String(x.reussies) }), h('td', { class: 'num', text: String(x.ratees) }), h('td', { class: 'num', text: x.essayees ? x.score + ' %' : '—' }), h('td', {}, barreScore(x, true))));
  }
  table.append(corps);

  // ------------------------------------------------------------ à revoir
  const revoir = h('ul', { class: 'liste-ressources' });
  for (const id of toutes) {
    const e = S.etatQuestion(s, id);
    if (!(s.questions[id]?.a_revoir || e === 'ratee')) continue;
    const i = titreQ.get(id)!;
    revoir.append(h('li', { class: 'ressource' }, h('span', { class: `etat etat-${e}`, role: 'img', text: e === 'ratee' ? '✗' : '⚑', 'aria-label': tr('web_etat_' + e) }), h('a', { class: 'ressource-lien', href: `#/m/${i.m}/q/${id}` }, h('span', { class: 'ressource-titre', text: i.t }), h('span', { class: 'ressource-sous', text: `${contenu.bi(ms.find((m) => m.cle === i.m)!.titre)} · ${i.n}` }))));
  }
  if (!revoir.children.length) revoir.append(h('li', { class: 'vide', text: tr('web_rien_a_revoir') }));

  // ------------------------------------------------------------ animations
  const anims = h('ul', { class: 'liste-ressources' });
  for (const [id, a] of Object.entries(s.animations)) {
    const e = PAR_ID.get(id);
    if (!e) continue;
    const raz = h('button', { type: 'button', class: 'bouton icone discret petit', 'aria-label': tr('web_reinit_anim_x', { nom: tr('anim_nom_' + e.cle) }), title: tr('web_reinitialiser') }, icone('reinit'));
    raz.addEventListener('click', () => effacer({ partie: 'animation', id }, tr('web_reinit_anim_x', { nom: tr('anim_nom_' + e.cle) })));
    anims.append(h('li', { class: 'ressource' }, h('a', { class: 'ressource-lien', href: `#/a/${id}` }, h('span', { class: 'ressource-titre', text: tr('anim_nom_' + e.cle) }), h('span', { class: 'ressource-sous', text: tr('web_n_reglages', { n: Object.keys(a.reglages).length }) })), raz));
  }
  if (!anims.children.length) anims.append(h('li', { class: 'vide', text: tr('web_aucun_reglage') }));

  // ------------------------------------------------------------ sauvegarde
  const effacer = async (p: S.Partie, titre: string): Promise<void> => {
    const r = await confirmer(titre, tr('web_effacer_texte'), tr('web_effacer'), { libelle: tr('web_exporter_avant'), coche: true });
    if (!r.ok) return;
    if (r.option) stockage.telecharger(s, '-avant-effacement');
    const avant = S.migrer(JSON.parse(JSON.stringify(s)))!;
    stockage.remplacer(S.reinitialiser(s, p));
    if (p.partie === 'preferences' || p.partie === 'tout') window.dispatchEvent(new Event('coupole:preferences'));
    annoncer(tr('web_efface'), { libelle: tr('web_defaire'), faire: () => { stockage.remplacer(avant); window.dispatchEvent(new Event('coupole:preferences')); window.dispatchEvent(new Event('coupole:rafraichir')); } }, 10000);
    window.dispatchEvent(new Event('coupole:rafraichir'));
  };
  const bExporter = h('button', { type: 'button', class: 'bouton principal' }, icone('telecharger'), tr('web_exporter'));
  bExporter.addEventListener('click', () => {
    void stockage.ecrire();
    stockage.telecharger(s);
    annoncer(tr('web_exporte'));
  });
  const fichier = h('input', { type: 'file', accept: 'application/json,.json', id: 'import-fichier', class: 'visuellement-cache' });
  const modeImport = h('select', { id: 'import-mode' }, h('option', { value: 'fusionner', text: tr('web_import_fusionner') }), h('option', { value: 'remplacer', text: tr('web_import_remplacer') }));
  const bImporter = h('label', { class: 'bouton', for: 'import-fichier', tabindex: 0, role: 'button' }, icone('importer'), tr('web_importer'));
  bImporter.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      fichier.click();
    }
  });
  fichier.addEventListener('change', async () => {
    const f = fichier.files?.[0];
    fichier.value = '';
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) return void annoncer(tr('web_import_illisible'));
    const t = await f.text();
    const imp = S.importer(t, stockage.APPLICATION);
    if (!imp) return void annoncer(tr('web_import_illisible'));
    const avant = S.migrer(JSON.parse(JSON.stringify(s)))!;
    const remplacer = modeImport.value === 'remplacer';
    if (remplacer) {
      const r = await confirmer(tr('web_import_remplacer_q'), tr('web_import_remplacer_texte'), tr('web_import_remplacer'), { libelle: tr('web_exporter_avant'), coche: true });
      if (!r.ok) return;
      if (r.option) stockage.telecharger(s, '-avant-import');
    }
    stockage.remplacer(remplacer ? imp : S.fusionner(s, imp));
    window.dispatchEvent(new Event('coupole:preferences'));
    annoncer(tr('web_importe', { q: Object.keys(imp.questions).length, a: Object.keys(imp.animations).length, f: imp.favoris.length, m: imp.mes_modules.length }), { libelle: tr('web_defaire'), faire: () => { stockage.remplacer(avant); window.dispatchEvent(new Event('coupole:preferences')); window.dispatchEvent(new Event('coupole:rafraichir')); } }, 10000);
    window.dispatchEvent(new Event('coupole:rafraichir'));
  });

  // réinitialisation : choix de la partie
  const partie = h('select', { id: 'raz-partie' });
  const options: [string, string][] = [
    ['reponses', tr('web_raz_reponses')], ['reglages', tr('web_raz_reglages')], ['favoris', tr('web_raz_favoris')], ['mes_modules', tr('web_raz_mes_modules')], ['preferences', tr('web_raz_preferences')], ['tout', tr('web_raz_tout')],
  ];
  for (const m of ms) if (m.questions.some((q) => q.ok)) options.push([`module:${m.cle}`, tr('web_raz_module', { nom: contenu.bi(m.titre) })]);
  for (const id of Object.keys(s.animations)) if (PAR_ID.has(id)) options.push([`animation:${id}`, tr('web_raz_animation', { nom: tr('anim_nom_' + PAR_ID.get(id)!.cle) })]);
  for (const [v, t] of options) partie.append(h('option', { value: v, text: t }));
  const bRaz = h('button', { type: 'button', class: 'bouton danger' }, icone('poubelle'), tr('web_reinitialiser'));
  bRaz.addEventListener('click', () => {
    const v = partie.value;
    const t = partie.selectedOptions[0]?.textContent ?? '';
    let p: S.Partie;
    if (v.startsWith('module:')) {
      const m = ms.find((x) => x.cle === v.slice(7))!;
      p = { partie: 'module', id: m.cle, questions: m.questions.map((q) => q.id) };
    } else if (v.startsWith('animation:')) p = { partie: 'animation', id: v.slice(10) };
    else p = { partie: v as 'reponses' };
    void effacer(p, t + ' ?');
  });

  const support = stockage.stockage();
  const el = h(
    'div',
    { class: 'page page-progression', lang: langue() },
    h('nav', { class: 'fil', 'aria-label': tr('web_fil') }, h('a', { href: '#/' }, icone('retour'), tr('web_accueil'))),
    h('h1', { text: tr('web_ma_progression') }),
    resume,
    barreScore(b),
    h('section', { class: 'bloc', 'aria-labelledby': 't-mod' }, h('h2', { id: 't-mod', text: tr('web_par_module') }), h('div', { class: 'table-boite', tabindex: 0, role: 'region', 'aria-labelledby': 't-mod' }, table)),
    h('section', { class: 'bloc', 'aria-labelledby': 't-rev' }, h('h2', { id: 't-rev', text: tr('web_a_revoir_titre') }), revoir),
    h('section', { class: 'bloc', 'aria-labelledby': 't-anim' }, h('h2', { id: 't-anim', text: tr('web_reglages_gardes') }), anims),
    h('section', { class: 'bloc', 'aria-labelledby': 't-sauv' },
      h('h2', { id: 't-sauv', text: tr('web_sauvegarde') }),
      h('p', { text: tr('web_sauvegarde_texte_' + support) }),
      h('div', { class: 'actions-module' }, bExporter),
      h('div', { class: 'actions-module' }, h('label', { for: 'import-mode', text: tr('web_import_mode') }), modeImport, fichier, bImporter),
      h('p', { class: 'aide', text: tr('web_import_aide') }),
      h('h3', { text: tr('web_reinitialiser') }),
      h('div', { class: 'actions-module' }, h('label', { for: 'raz-partie', text: tr('web_raz_quoi') }), partie, bRaz),
    ),
  );
  return { el, titre: `${tr('web_ma_progression')} — Coupole Web`, detruire() {} };
}
