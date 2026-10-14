/**
 * « Mes modules » : collections personnelles de questions, animations, fiches, tables et images.  Créer, ouvrir,
 * renommer, copier, supprimer (avec annulation) ; on ajoute du contenu depuis n'importe quelle page par le bouton
 * « + » (menu « Ajouter à… »), on organise dans l'onglet « Organiser » du module.
 */
import * as S from '../contenu/sauvegarde';
import { tr } from '../i18n/i18n';
import { annoncer, h, icone } from './dom';
import { confirmer, demanderTexte } from './composants';
import type { Page } from './page_apropos';
import * as stockage from './stockage';

export async function pageMesModules(nouveau: boolean): Promise<Page> {
  await stockage.pret();
  const s = stockage.doc();
  const liste = h('ul', { class: 'liste-mes-modules' });
  const creer = h('button', { type: 'button', class: 'bouton principal' }, icone('plus'), tr('web_creer_module'));

  const remplir = (): void => {
    liste.replaceChildren();
    if (!s.mes_modules.length) {
      liste.append(h('li', { class: 'vide', text: tr('web_mes_modules_vide') }));
      return;
    }
    for (const m of s.mes_modules) {
      const n = (g: S.Genre): number => m.elements.filter((e) => e.genre === g).length;
      const renommer = h('button', { type: 'button', class: 'bouton icone discret', 'aria-label': tr('web_renommer_x', { nom: m.nom }), title: tr('web_renommer') }, icone('crayon'));
      const copier = h('button', { type: 'button', class: 'bouton icone discret', 'aria-label': tr('web_copier_x', { nom: m.nom }), title: tr('web_copier') }, icone('copier'));
      const suppr = h('button', { type: 'button', class: 'bouton icone discret danger', 'aria-label': tr('web_supprimer_x', { nom: m.nom }), title: tr('web_supprimer') }, icone('poubelle'));
      renommer.addEventListener('click', async () => {
        const v = await demanderTexte(tr('web_renommer_module'), m.nom, tr('web_renommer'));
        if (v && S.renommerModule(s, m.id, v)) {
          stockage.modifie();
          remplir();
        }
      });
      copier.addEventListener('click', () => {
        S.creerModule(s, S.nomLibre(s, tr('web_copie_de', { nom: m.nom })), m.elements);
        stockage.modifie();
        remplir();
      });
      suppr.addEventListener('click', async () => {
        const r = await confirmer(tr('web_supprimer_module_q', { nom: m.nom }), tr('web_supprimer_module_texte'), tr('web_supprimer'));
        if (!r.ok) return;
        const i = s.mes_modules.indexOf(m);
        S.supprimerModule(s, m.id);
        stockage.modifie();
        remplir();
        annoncer(tr('web_module_supprime', { nom: m.nom }), { libelle: tr('web_defaire'), faire: () => { s.mes_modules.splice(i, 0, m); stockage.modifie(); remplir(); } }, 8000);
      });
      const detail = [
        [n('question'), 'web_q'], [n('animation'), 'web_a'], [n('fiche'), 'web_f'], [n('table'), 'web_t'], [n('image'), 'web_i'],
      ].filter(([k]) => k).map(([k, c]) => `${k} ${tr(c + '_court')}`).join(' · ');
      liste.append(
        h('li', { class: 'mon-module' },
          h('a', { href: `#/mm/${m.id}`, class: 'mon-module-lien' }, h('span', { class: 'ressource-titre', text: m.nom }), h('span', { class: 'ressource-sous', text: detail || tr('web_vide') })),
          h('span', { class: 'outils-ligne' }, renommer, copier, suppr)),
      );
    }
  };
  creer.addEventListener('click', async () => {
    const v = await demanderTexte(tr('web_nom_nouveau_module'), S.nomLibre(s, tr('web_nouveau_module'), true), tr('web_creer'));
    if (!v) return;
    const m = S.creerModule(s, v);
    stockage.modifie();
    location.hash = `#/mm/${m.id}`;
  });
  remplir();
  const el = h(
    'div',
    { class: 'page page-mes-modules' },
    h('nav', { class: 'fil', 'aria-label': tr('web_fil') }, h('a', { href: '#/' }, icone('retour'), tr('web_accueil'))),
    h('h1', { text: tr('web_mes_modules') }),
    h('p', { class: 'sous-titre', text: tr('web_mes_modules_texte') }),
    h('div', { class: 'actions-module' }, creer, h('a', { class: 'bouton discret', href: '#/progression' }, icone('echange'), tr('web_exporter_importer'))),
    liste,
  );
  if (nouveau) setTimeout(() => creer.click(), 50);
  return { el, titre: `${tr('web_mes_modules')} — Coupole Web`, detruire() {} };
}
