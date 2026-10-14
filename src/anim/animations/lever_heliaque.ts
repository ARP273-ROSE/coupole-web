/**
 * Heliacal Rising Simulator : le jour où une étoile redevient visible à l'aube (lever héliaque) dépend de la latitude
 * et de la position de l'étoile.  Comme l'original, une étoile est « visible » si elle est levée pendant que le Soleil
 * est à plus de 7° sous l'horizon (réglable).  Graphique de l'année : nuit, crépuscules, heures où l'étoile est levée.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, type Pt, Rect } from '../../noyau/peintre';
import { pmod, pround, proundn } from '../../noyau/py';
import * as scenes from '../../noyau/scenes';
import { appliquerM, mv } from '../../noyau/vec';
import { Animation, angle, type Bouton_souris, type Choix, type Coche, date_du_jour, heures_minutes, MOIS_JOURS, type Reglage } from '../base';

const ANNEE = 2026;
const ETOILES: [string, number, number][] = [
  ['sirius', 101.287_155 / 15, -16.716_116], ['vega', 279.234_735 / 15, 38.783_689], ['aldebaran', 68.980_163 / 15, 16.509_302],
  ['spica', 201.298_247 / 15, -11.161_319], ['antares', 247.351_915 / 15, -26.432_003], ['fomalhaut', 344.412_693 / 15, -29.622_237],
  ['arcturus', 213.9153 / 15, 19.182_409],
];

export function heure_solaire(h_soleil_deg: number, eqt_min: number): number {
  return pmod(12.0 + h_soleil_deg / 15.0 - eqt_min / 60.0, 24.0);
}

type Jour = [number | null, number | null, number | null, number | null, number, number];
const cacheAnnee = new Map<string, Jour[]>();
const cacheHeliaques = new Map<string, number[]>();

export function annee(ra_h: number, dec: number, lat: number, depression: number): Jour[] {
  const cle = `${ra_h}|${dec}|${lat}|${depression}`;
  const deja = cacheAnnee.get(cle);
  if (deja) return deja;
  const out: Jour[] = [];
  for (let j = 0; j < 365; j++) {
    const jj = astro.jj_jour_de_l_annee(ANNEE, j + 0.5);
    const s = astro.soleil(jj);
    const [ra, de] = astro.precession(ra_h * 15.0, dec, jj);
    const lig = [-depression, -0.833].map((h0) => {
      const hh = astro.angle_horaire_lever(s.delta, lat, h0);
      return hh === 0.0 || hh === 180.0 ? null : hh;
    });
    const [aube, lever] = lig.map((x) => (x === null ? null : heure_solaire(-x, s.eqt)));
    const [coucher, fin] = [...lig].reverse().map((x) => (x === null ? null : heure_solaire(x, s.eqt)));
    const passage = heure_solaire(astro.mod180(ra - s.alpha), s.eqt);
    const demi = (astro.angle_horaire_lever(de, lat, 0.0) / 15.0) * (1.0 / 1.002_737_909);
    out.push([aube!, lever!, coucher!, fin!, passage, demi]);
  }
  if (cacheAnnee.size > 16) cacheAnnee.clear();
  cacheAnnee.set(cle, out);
  return out;
}

function heliaques(ra_h: number, dec: number, lat: number, depression: number): number[] {
  const cle = `${ra_h}|${dec}|${lat}|${depression}`;
  let v = cacheHeliaques.get(cle);
  if (!v) {
    v = astro.lever_heliaque(ra_h * 15.0, dec, lat, ANNEE, depression)[0];
    if (cacheHeliaques.size > 16) cacheHeliaques.clear();
    cacheHeliaques.set(cle, v);
  }
  return v;
}

export class LeverHeliaque extends Animation {
  static override ID = 'heliacalrisingsim';
  static JOURS_PAR_S = 10.0;

  vue3d!: dessin.Vue3D;
  etoile!: Choix;
  ra!: Reglage;
  dec!: Reglage;
  lat!: Reglage;
  depression!: Reglage;
  jour!: Reglage;
  heure!: Reglage;
  c_aube!: Coche;
  private graphe: [Rect, number, number, number, number] | null = null;

  override construire(): void {
    this.vue3d = this.vue(150.0, 35.0, 7.0, 89.0);
    this.etoile = this.choix('etoile', [['anim_gravcalc_libre', ''], ...ETOILES.map(([k]) => ['anim_heliacalrisingsim_e_' + k, k] as [string, string])], 'sirius');
    this.etoile.activated.connect(() => this.choisirEtoile());
    this.ra = this.curseur('ra', 0.0, 24.0, ETOILES[0]![1], { dec: 2, unite: 'h', cle_texte: 'anim_c_ra' });
    this.dec = this.curseur('dec', -90.0, 90.0, ETOILES[0]![2], { dec: 1, unite: '°', cle_texte: 'anim_c_dec' });
    this.lat = this.curseur('latitude', -90.0, 90.0, 40.8, { dec: 1, unite: '°', cle_texte: 'anim_c_latitude' });
    this.depression = this.curseur('depression', 0.0, 18.0, 7.0, { dec: 1, unite: '°' });
    this.jour = this.curseur('jour', 0.0, 364.0, 78.0, { dec: 0, cle_texte: 'anim_c_jour' });
    this.heure = this.curseur('heure', 0.0, 24.0, 5.0, { dec: 2, unite: 'h', cle_texte: 'anim_c_heure' });
    this.c_aube = this.coche('aube', true);
    this.graphe = null;
  }

  private choisirEtoile(): void {
    for (const [k, ra, dec] of ETOILES) {
      if (k === this.etoile.currentData()) {
        this.ra.setValue(ra);
        this.dec.setValue(dec);
      }
    }
  }

  override reglage_change(): void {
    const cle = ETOILES.find(([, ra, dec]) => Math.abs(ra - this.ra.value()) < 0.006 && Math.abs(dec - this.dec.value()) < 0.06)?.[0] ?? '';
    if (this.etoile.currentData() !== cle) {
      this.etoile.blockSignals(true);
      this.etoile.setCurrentIndex(Math.max(0, this.etoile.findData(cle)));
      this.etoile.blockSignals(false);
    }
    super.reglage_change();
  }

  private cles(): [number, number, number, number] {
    return [proundn(this.ra.value(), 4), proundn(this.dec.value(), 3), proundn(this.lat.value(), 2), proundn(this.depression.value(), 2)];
  }

  private donnees(): Jour[] {
    return annee(...this.cles());
  }

  heure_effective(): number {
    if (this.c_aube.isChecked()) {
      const aube = this.donnees()[pmod(Math.trunc(this.jour.value()), 365)]![0];
      if (aube !== null) return aube;
    }
    return this.heure.value();
  }

  liste_heliaques(): number[] {
    return heliaques(...this.cles());
  }

  override avancer(dt: number): void {
    this.jour.setValue(pmod(this.jour.value() + dt * LeverHeliaque.JOURS_PAR_S, 365.0));
  }

  override valeurs(): [string, string][] {
    const j = pmod(Math.trunc(this.jour.value()), 365);
    const h = astro.visible_a_l_aube(this.ra.value() * 15.0, this.dec.value(), this.lat.value(), ANNEE, j, this.depression.value());
    const dates = this.liste_heliaques().map((x) => date_du_jour(x)).join(', ') || tr('anim_heliacalrisingsim_jamais');
    const aube = this.donnees()[j]![0];
    return [
      [tr('anim_c_date'), date_du_jour(j)],
      [tr('anim_heliacalrisingsim_aube'), aube !== null ? heures_minutes(aube) : '—'],
      [tr('anim_heliacalrisingsim_h_aube'), h !== null ? angle(h) : '—'],
      [tr('anim_heliacalrisingsim_lever'), dates],
    ];
  }

  override presser(pos: Pt, bouton: Bouton_souris): boolean {
    if (this.graphe !== null && this.graphe[0].contains(pos)) {
      this._glisse = (q) => this.tirer(q);
      this.tirer(pos);
      return true;
    }
    return super.presser(pos, bouton);
  }

  private tirer(pos: Pt): void {
    const [, x0, x1, y0, y1] = this.graphe!;
    this.jour.setValue(Math.max(0.0, Math.min(364.0, (365.0 * (pos.x - x0)) / (x1 - x0))));
    if (!this.c_aube.isChecked()) this.heure.setValue(Math.max(0.0, Math.min(24.0, (24.0 * (pos.y - y0)) / (y1 - y0))));
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = rect.w > rect.h * 1.1 ? dessin.zones_principale(rect, 1, 0.62) : dessin.zones(rect, 2, 10);
    this.dessinAnnee(p, dessin.cadre(p, z[0]!, tr('anim_heliacalrisingsim_graphe')));
    this.dessinCiel(p, dessin.cadre(p, z[1]!, tr('anim_heliacalrisingsim_ciel')));
  }

  private dessinAnnee(p: Peintre, r: Rect): void {
    const x0 = r.x + 34,
      x1 = r.right - 6,
      y0 = r.y + 4,
      y1 = r.bottom - 20;
    this.graphe = [r.copie(), x0, x1, y0, y1];
    const w = (x1 - x0) / 365.0;
    const y_de = (h: number): number => y0 + ((y1 - y0) * h) / 24.0;
    this.fond(p, x0, y0, Math.trunc(x1 - x0), Math.trunc(y1 - y0));
    dessin.police(p, 0.75);
    for (const h of [0, 6, 12, 18, 24]) {
      p.setPen(dessin.stylo('grille', 1.0, 0.5));
      p.drawLine(x0, y_de(h), x1, y_de(h));
      dessin.texte(p, x0 - 16, y_de(h), `${h} h`, 'doux');
    }
    for (let mo = 1; mo < 13; mo += 2) {
      let j = 0;
      for (let i = 0; i < mo - 1; i++) j += MOIS_JOURS[i]!;
      dessin.texte(p, x0 + (j + 15) * w, y1 + 11, tr(`anim_mois_court_${mo}`), 'doux');
    }
    dessin.police(p, 1 / 0.75);
    for (const j of this.liste_heliaques()) {
      p.setPen(dessin.stylo('accent1', 2.0));
      p.drawLine(x0 + (j + 0.5) * w, y0, x0 + (j + 0.5) * w, y1);
    }
    const jx = x0 + (this.jour.value() + 0.5) * w;
    dessin.disque(p, jx, y_de(this.heure_effective()), 5, 'accent3', 'texte');
  }

  /** Nuit noire, nuit polaire et heures où l'étoile est levée, jour par jour. */
  private fond(p: Peintre, ox: number, oy: number, larg: number, haut: number): void {
    p.save();
    p.translate(ox, oy);
    p.fillRect(new Rect(0, 0, Math.max(1, larg), Math.max(1, haut)), dessin.c('ciel', 0.55));
    const w = larg / 365.0;
    const y_de = (h: number): number => (haut * h) / 24.0;
    const nuit = dessin.c('nuit');
    const etoile = dessin.c('accent2', 0.35);
    this.donnees().forEach(([aube, lever, , fin, passage, demi], j) => {
      const x = pround(j * w);
      const w_j = Math.max(1, pround((j + 1) * w) - x);
      if (aube !== null && fin !== null) {
        const plages: [number, number][] = fin > aube ? [[0.0, aube], [fin, 24.0]] : [[fin, aube]];
        for (const [a, b] of plages) p.fillRect(new Rect(x, y_de(a), w_j, y_de(b) - y_de(a)), nuit);
      } else if (aube === null && lever === null) p.fillRect(new Rect(x, 0, w_j, haut), nuit);
      if (demi > 0) {
        const d0 = passage - demi,
          d1 = passage + demi;
        for (let [a, b] of [[d0, d1], [d0 + 24, d1 + 24], [d0 - 24, d1 - 24]] as [number, number][]) {
          a = Math.max(0.0, a);
          b = Math.min(24.0, b);
          if (b > a) p.fillRect(new Rect(x, y_de(a), w_j, y_de(b) - y_de(a)), etoile);
        }
      }
    });
    p.restore();
  }

  private dessinCiel(p: Peintre, r: Rect): void {
    this.zone_rotative(r, this.vue3d);
    const lat = this.lat.value();
    const j = this.jour.value();
    const h = this.heure_effective();
    const jj = astro.jj_jour_de_l_annee(ANNEE, j + h / 24.0);
    const tsl = astro.tsmg(jj);
    const s = astro.soleil(jj);
    const [ra, de] = astro.precession(this.ra.value() * 15.0, this.dec.value(), jj);
    const m = astro.matrice_equatorial_vers_horizon(tsl, lat);
    const soleil = mv(m, astro.vecteur_equatorial(s.alpha, s.delta));
    const etoile = mv(m, astro.vecteur_equatorial(ra, de));
    const [, h_sol] = astro.equatorial_vers_horizon(tsl - s.alpha, s.delta, lat);
    const scene = (pe: dessin.Peintre3D): void => {
      pe.courbe(appliquerM(m, scenes.cercle_declinaison(de)), 'accent2', 1.0, 0.7);
      pe.courbe(appliquerM(m, dessin.cercle([0, 0, 1])), 'equateur', 1.2, 0.8);
      pe.point(soleil, 'soleil', 8.0, { repere_monde: true });
      pe.point(etoile, 'etoile', 5.0, { bord: 'accent2', repere_monde: true });
    };
    const couleur = h_sol > 0 ? 'ciel' : h_sol < -this.depression.value() ? 'nuit' : 'grille';
    const rr = Math.min(r.w, r.h) * 0.4;
    scenes.sphere_locale(p, this.vue3d, r.cx, r.cy + 6, rr, scene, couleur);
    dessin.texte(p, r.cx, r.bottom - 10, `${date_du_jour(j)}, ${heures_minutes(h)}`, 'doux');
  }
}
