/**
 * Contenu d'une fiche au survol, sans DOM : titre, désignations, lignes (libellé, valeur, source) et résumé lu par les
 * lecteurs d'écran.  Même fonction, ligne pour ligne, que fiche_texte.py de Coupole (tests croisés sur les mêmes
 * fiches) ; l'affichage (HTML ici, widget Qt au bureau) n'en fait que la mise en page.
 */
import { langue, tr } from '../i18n/i18n';
import { nombre } from '../noyau/format';
import type { Fiche, Valeur } from './fiches';

export interface LigneFiche {
  libelle: string;
  valeur: string;
  source: string;
  /** valeur incertaine (distance peu fiable) : mise en évidence */
  alerte?: boolean;
}

export interface ContenuFiche {
  titre: string;
  sous_titre: string;
  couleur: string | null;
  lignes: LigneFiche[];
  resume: string;
}

const METHODES_EN: Record<string, string> = {
  'parallaxe adoptée par SIMBAD': 'SIMBAD adopted parallax',
  'mesure dédiée': 'dedicated measurement',
  'amas (VLBA)': 'cluster (VLBA)',
  publiée: 'published',
  'SIMBAD (peu fiable)': 'SIMBAD (unreliable)',
  'Gaia DR3 (peu fiable)': 'Gaia DR3 (unreliable)',
};

const EXPRESSIONS_EN: [RegExp, string][] = [
  [/médiane de (\d+) mesures SIMBAD mesFe_h/g, 'median of $1 SIMBAD mesFe_h measurements'],
  [/médiane des mesures SIMBAD mesFe_h/g, 'median of the SIMBAD mesFe_h measurements'],
  [/calculée : /g, 'computed: '],
  [/, sans extinction/g, ', no extinction'],
  [/estimée de B−V \(séquence des naines de /g, 'estimated from B−V (dwarf sequence of '],
  [/ pour d = /g, ' for d = '],
  [/ adoptée par les auteurs/g, ' adopted by the authors'],
  [/ du compagnon /g, ' of the companion '],
  [/estimée du type spectral/g, 'estimated from the spectral type'],
  [/naine de même sous-type/g, 'dwarf of the same subtype'],
  [/table révisée/g, 'revised table'],
  [/point zéro/g, 'zero point'],
  // notes et commentaires des fiches d'Orion (âges, distances) : traduits plutôt que coupés
  [/Tête \(ISF\) ; la Queue s'étend jusqu'à ≈ 470 pc/g, 'Head (ISF); the Tail extends to ≈ 470 pc'],
  [/squelette 3D \(plage /g, '3D skeleton (range '],
  [/\(moyennes/g, '(means'],
  [/mesure propre peu fiable/g, 'own measurement unreliable'],
  [/, cité par /g, ', cited by '],
  [/\(cité par /g, '(cited by '],
  [/ cité par /g, ' cited by '],
  [/\(intervalle 3σ\)/g, '(3σ interval)'],
  [/composante Aa/g, 'component Aa'],
  [/distance photométrique/g, 'photometric distance'],
  [/\(modèle, à prendre avec prudence pour une étoile brillante\)/g, '(model, to be taken with caution for a bright star)'],
  [/ONC dont le Trapèze/g, 'ONC including the Trapezium'],
  [/distance de σ Ori AB/g, 'distance of σ Ori AB'],
  [/même hypothèse que la Tête de Cheval/g, 'same assumption as the Horsehead'],
  [/vestige de supernova possible/g, 'possible supernova remnant'],
  [/rétroaction de l'amas /g, 'feedback from the cluster '],
  [/ depuis ∼/g, ' for ∼'],
  [/estimée de B−V de la composante /g, 'estimated from B−V of the component '],
  [/ via la séquence des naines de /g, ' via the dwarf sequence of '],
];

/** Texte de fiche en français → anglais (expressions connues, virgule décimale, « : » sans espace avant). */
export function traduire_en(t: string): string {
  for (const [re, v] of EXPRESSIONS_EN) t = t.replace(re, v);
  t = t.replace(/(\d),(\d)/g, '$1.$2');
  return t.replace(/ ([:;]) /g, '$1 ');
}

/** Source courte et dans la langue : en anglais, le commentaire en français qui suit la référence est retiré. */
export function source_courte(s: string | undefined | null, lg = langue()): string {
  if (!s) return '';
  let t = s.trim();
  if (lg === 'en') {
    t = traduire_en(t);
    for (const sep of [' — ', ' ; ', ' (VizieR', ', voir', ' : «', ', résumé']) {
      const i = t.indexOf(sep);
      if (i > 0) t = t.slice(0, i);
    }
  }
  return t.length > 150 ? t.slice(0, 149).trimEnd() + '…' : t;
}

function ecart(moins: number | null | undefined, plus: number | null | undefined, dec: number): string {
  if (moins == null && plus == null) return '';
  if (moins != null && plus != null && Math.abs(moins - plus) < 10 ** -dec / 2) return ` ± ${nombre(moins, dec)}`;
  return ` (−${nombre(moins ?? 0, dec)}/+${nombre(plus ?? 0, dec)})`;
}

/** Décimales lisibles pour une distance (pc ou al). */
function dec_dist(d: number): number {
  return d < 10 ? 2 : d < 100 ? 1 : 0;
}

function num(v: Valeur | undefined): number | null {
  const x = v?.valeur;
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
}

/** Contenu de la fiche dans la langue courante. */
export function contenu_fiche(f: Fiche, lg = langue()): ContenuFiche {
  const L: LigneFiche[] = [];
  const titre = f.noms[lg] || f.noms.fr;
  const des = (f.designations ?? []).filter((d) => d !== titre).slice(0, 4);
  const sous_titre = des.join(' · ');
  const type = f.type ? f.type[lg] || f.type.fr || '' : '';
  const sp = f.type_spectral && typeof f.type_spectral.valeur === 'string' ? f.type_spectral.valeur : '';
  if (type || sp)
    L.push({ libelle: tr('anim_fiche_type'), valeur: [type, sp].filter(Boolean).join(' · '), source: source_courte(f.type_spectral?.source ?? f.type?.source, lg) });
  const v = num(f.V);
  const mv = num(f.M_V);
  if (v !== null) L.push({ libelle: tr('anim_fiche_mag_v'), valeur: nombre(v, 2), source: source_courte(f.V?.source, lg) });
  if (mv !== null) L.push({ libelle: tr('anim_fiche_mag_abs'), valeur: nombre(mv, 2), source: source_courte(f.M_V?.source, lg) });
  const d = f.distance;
  if (d && typeof d.pc === 'number') {
    const dp = dec_dist(d.pc);
    let val = `${nombre(d.pc, dp)}${ecart(d.pc_moins, d.pc_plus, dp)} pc`;
    if (typeof d.al === 'number') val += ` · ${nombre(d.al, dec_dist(d.al))}${ecart(d.al_moins, d.al_plus, dec_dist(d.al))} ${tr('anim_fiche_al')}`;
    const meth = d.methode ? (lg === 'en' ? (METHODES_EN[d.methode] ?? d.methode) : d.methode) : '';
    L.push({
      libelle: tr('anim_fiche_distance'), valeur: val + (d.peu_fiable ? ` — ${tr('anim_fiche_incertaine')}` : ''),
      source: [meth, source_courte(d.source, lg)].filter(Boolean).join(' · '), alerte: !!d.peu_fiable,
    });
    if (d.affichage_suggere && typeof d.affichage_suggere.pc === 'number') {
      const s = d.affichage_suggere;
      L.push({ libelle: tr('anim_fiche_distance_affichee'), valeur: `${nombre(s.pc, dec_dist(s.pc))} pc`, source: source_courte(s.pourquoi, lg) });
    }
    const alt = (d.alternatives ?? []).filter((a) => typeof a.d === 'number').slice(0, 4);
    if (alt.length)
      L.push({
        libelle: tr('anim_fiche_autres_mesures'),
        valeur: alt.map((a) => `${nombre(a.d, dec_dist(a.d))}${ecart(a.moins, a.plus, dec_dist(a.d))} pc (${source_courte(a.ref, lg).split(/[,:(]/)[0]!.trim()})`).join(' ; '),
        source: '',
      });
  }
  const t = num(f.teff);
  if (t !== null) {
    const inc = f.teff?.incertitude;
    L.push({ libelle: tr('anim_fiche_teff'), valeur: `${nombre(t, 0)}${typeof inc === 'number' ? ` ± ${nombre(inc, 0)}` : ''} K`, source: source_courte(f.teff?.source, lg) });
  }
  const r = num(f.rayon_Rsun);
  if (r !== null) L.push({ libelle: tr('anim_fiche_rayon'), valeur: `${nombre(r, r < 10 ? 2 : 0)}${ecart(f.rayon_Rsun?.moins ?? f.rayon_Rsun?.incertitude, f.rayon_Rsun?.plus ?? f.rayon_Rsun?.incertitude, r < 10 ? 2 : 0)} R☉`, source: source_courte(f.rayon_Rsun?.source, lg) });
  const ll = num(f.luminosite_log_Lsun);
  if (ll !== null) {
    const lum = 10 ** ll;
    L.push({ libelle: tr('anim_fiche_luminosite'), valeur: `${nombre(lum, lum < 10 ? 2 : 0)} L☉`, source: source_courte(f.luminosite_log_Lsun?.source, lg) });
  }
  // nébuleuses
  const ta = f.taille_arcmin?.valeur;
  if (Array.isArray(ta) && ta.length) {
    const tp = num(f.taille_pc);
    L.push({
      libelle: tr('anim_fiche_taille'),
      valeur: ta.map((x) => `${nombre(Number(x), 0)}′`).join(' × ') + (tp !== null ? ` (${nombre(tp, 2)} pc)` : ''),
      source: source_courte(f.taille_arcmin?.source, lg),
    });
  }
  for (const [cle, unite, libelle] of [['longueur_pc', ' pc', 'anim_fiche_longueur'], ['diametre_deg', '°', 'anim_fiche_diametre'], ['arc_deg', '°', 'anim_fiche_arc']] as const) {
    const o = f[cle] as { valeur?: number; ref?: string } | undefined;
    if (o && typeof o.valeur === 'number') L.push({ libelle: tr(libelle), valeur: `${nombre(o.valeur, 0)}${unite}`, source: source_courte(o.ref, lg) });
  }
  const age = f.age as { valeur_Myr?: number; err_Myr?: number; ref?: string; note?: string } | undefined;
  if (age) {
    if (typeof age.valeur_Myr === 'number')
      L.push({ libelle: tr('anim_fiche_age'), valeur: `${nombre(age.valeur_Myr, 1)}${typeof age.err_Myr === 'number' ? ` ± ${nombre(age.err_Myr, 1)}` : ''} ${tr('anim_fiche_ma')}`, source: source_courte(age.ref, lg) });
    else if (age.note) {
      const note = lg === 'en' ? traduire_en(age.note.trim()) : age.note.trim();
      L.push({ libelle: tr('anim_fiche_age'), valeur: note.length > 150 ? note.slice(0, 149).trimEnd() + '…' : note, source: '' });
    }
  }
  if (f.etoiles_excitatrices?.length)
    L.push({ libelle: tr('anim_fiche_excitatrices'), valeur: f.etoiles_excitatrices.map((s) => s.replace(/^\* /, '').split(' (')[0]!.split(' — ')[0]!.trim()).join(', '), source: '' });
  // résumé lu à voix haute : nom, type, distance, température
  const morceaux = [titre];
  if (type) morceaux.push(type);
  if (d && typeof d.pc === 'number') morceaux.push(`${nombre(d.pc, dec_dist(d.pc))} pc`);
  if (t !== null) morceaux.push(`${nombre(t, 0)} K`);
  return { titre, sous_titre, couleur: f.couleur ?? null, lignes: L, resume: morceaux.join(', ') };
}
