/**
 * Sun Motions Demonstrator : le Soleil sur la sphère locale.  Course diurne (parallèle de déclinaison), culmination
 * au méridien, changements au fil de l'année ; écliptique, mois, ombre de l'observateur, analemme.  Temps solaire
 * moyen du lieu ; Soleil de Meeus (0,01°) ; le ciel tourne avec le temps sidéral local.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Couleur, type Peintre, type Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import * as scenes from '../../noyau/scenes';
import { appliquerM, mul, mv, type Pts, type V3 } from '../../noyau/vec';
import { Animation, angle, type Choix, type Coche, date_du_jour, duree_hm, heures_minutes, nombre, type Reglage } from '../base';

export const ANNEE = 2026;
const JOURS_MOIS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

export interface EtatSoleil {
  jj: number;
  soleil: astro.Soleil;
  tsl: number;
  H: number;
  az: number;
  alt: number;
  H0: number;
  midi: number;
  lever: number | null;
  coucher: number | null;
  duree: number;
  culmination: number;
}

/** Pour le « jour » (0 = 1er janvier 0 h, fraction = temps solaire moyen local) : position du Soleil, etc. */
export function etat_soleil(jour: number, lat: number, annee = ANNEE): EtatSoleil {
  const jj = astro.jj_jour_de_l_annee(annee, jour);
  const s = astro.soleil(jj);
  const tsl = astro.tsmg(jj);
  const h = astro.mod180(tsl - s.alpha);
  const [az, alt] = astro.equatorial_vers_horizon(h, s.delta, lat);
  const h0 = astro.angle_horaire_lever(s.delta, lat, -0.833);
  const midi = 12.0 - s.eqt / 60.0;
  const ok = 0 < h0 && h0 < 180;
  return {
    jj, soleil: s, tsl, H: h, az, alt, H0: h0, midi,
    lever: ok ? midi - h0 / 15.0 : null, coucher: ok ? midi + h0 / 15.0 : null,
    duree: (2 * h0) / 15.0, culmination: astro.hauteur_culmination(s.delta, lat),
  };
}

export class MouvementsSoleil extends Animation {
  static override ID = 'sunmotions';
  static JOURS_PAR_S = 0.125;
  static PAS_JOURS_PAR_S = 15.0;

  vue3d!: dessin.Vue3D;
  lat!: Reglage;
  jour!: Reglage;
  heure!: Reglage;
  mode!: Choix;
  c_dec!: Coche;
  c_ecl!: Coche;
  c_mois!: Coche;
  c_dessous!: Coche;
  c_ombre!: Coche;
  c_analemme!: Coche;

  override construire(): void {
    this.vue3d = this.vue(215.0, 35.0, 5.0, 89.0);
    this.lat = this.curseur('latitude', -90.0, 90.0, 40.8, { dec: 1, unite: '°', cle_texte: 'anim_c_latitude' });
    this.jour = this.curseur('jour', 0.0, 364.0, 146.0, { dec: 0, cle_texte: 'anim_c_jour' });
    this.heure = this.curseur('heure', 0.0, 24.0, 12.0, { dec: 2, unite: 'h', cle_texte: 'anim_c_heure' });
    this.mode = this.choix('mode', [['anim_sunmotions_continu', 'continu'], ['anim_sunmotions_boucle', 'boucle'], ['anim_sunmotions_pas', 'pas']], 'continu');
    this.c_dec = this.coche('parallele', true);
    this.c_ecl = this.coche('ecliptique', true);
    this.c_mois = this.coche('mois', false);
    this.c_dessous = this.coche('dessous', true);
    this.c_ombre = this.coche('ombre', true);
    this.c_analemme = this.coche('analemme', false);
  }

  private jourDecimal(): number {
    return this.jour.value() + this.heure.value() / 24.0;
  }

  override avancer(dt: number): void {
    const mode = this.mode.currentData();
    if (mode === 'pas') {
      this.jour.setValue(pmod(this.jour.value() + dt * MouvementsSoleil.PAS_JOURS_PAR_S, 365.0));
      return;
    }
    let h = this.heure.value() + dt * MouvementsSoleil.JOURS_PAR_S * 24.0;
    if (mode === 'boucle') {
      this.heure.setValue(pmod(h, 24.0));
      return;
    }
    if (h >= 24.0) {
      this.jour.setValue(pmod(this.jour.value() + Math.trunc(Math.floor(h / 24.0)), 365.0));
      h = pmod(h, 24.0);
    }
    this.heure.setValue(h);
  }

  override valeurs(): [string, string][] {
    const e = etat_soleil(this.jourDecimal(), this.lat.value());
    const s = e.soleil;
    const out: [string, string][] = [
      [tr('anim_c_date'), date_du_jour(this.jour.value()) + ', ' + heures_minutes(this.heure.value())],
      [tr('anim_sunmotions_heure_vraie'), heures_minutes(this.heure.value() + s.eqt / 60.0)],
      [tr('anim_c_hauteur'), angle(e.alt)],
      [tr('anim_c_azimut'), angle(e.az)],
      [tr('anim_c_ra'), heures_minutes(s.alpha / 15.0)],
      [tr('anim_c_dec'), angle(s.delta)],
      [tr('anim_siderealtimeandhourangledemo_h'), angle(e.H)],
      [tr('anim_c_tsl'), heures_minutes(e.tsl / 15.0)],
      [tr('anim_sunmotions_eqt'), `${nombre(s.eqt, 1)} min`],
      [tr('anim_sunmotions_culmination'), angle(e.culmination) + ' (' + heures_minutes(e.midi) + ')'],
    ];
    if (e.lever !== null) {
      const az_l = astro.azimut_lever(s.delta, this.lat.value(), -0.833)!;
      out.push([tr('anim_sunmotions_lever_coucher'), `${heures_minutes(e.lever)} / ${heures_minutes(e.coucher!)}`]);
      out.push([tr('anim_sunmotions_az_lever'), `${angle(az_l)} / ${angle(360 - az_l)}`]);
      out.push([tr('anim_sunmotions_duree'), duree_hm(e.duree)]);
    } else out.push([tr('anim_sunmotions_duree'), tr(e.H0 >= 180 ? 'anim_sunmotions_jour_polaire' : 'anim_sunmotions_nuit_polaire')]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const r = Math.min(rect.w, rect.h) * 0.4;
    const cx = rect.cx,
      cy = rect.cy + 6;
    this.zone_rotative(rect, this.vue3d);
    const lat = this.lat.value();
    const e = etat_soleil(this.jourDecimal(), lat);
    const s = e.soleil;
    const m = astro.matrice_equatorial_vers_horizon(e.tsl, lat);
    const eps = astro.obliquite_moyenne(e.jj);
    const soleil = mv(m, astro.vecteur_equatorial(s.alpha, s.delta));
    const jour_ciel = Math.max(0.0, Math.min(1.0, (e.alt + 6) / 16));
    const eq = (pts: Pts): Pts => appliquerM(m, pts);
    const eq1 = (v: V3): V3 => mv(m, v);

    const scene = (pe: dessin.Peintre3D): void => {
      if (pe.passe === 'dessous' && !this.c_dessous.isChecked()) return;
      pe.courbe(dessin.cercle([0, 1, 0]), 'grille', 1.0, 0.5, { repere_monde: true });
      pe.courbe(dessin.cercle([1, 0, 0]), 'grille', 1.0, 0.5, { repere_monde: true });
      pe.courbe(eq(dessin.cercle([0, 0, 1])), 'equateur', 1.6, 0.8);
      pe.courbe(eq(scenes.cercle_horaire(0.0)), 'equateur', 1.6, 0.8);
      if (this.c_ecl.isChecked()) pe.courbe(eq(scenes.ecliptique(eps)), 'ecliptique', 1.6, 0.8);
      if (this.c_dec.isChecked()) pe.courbe(eq(scenes.cercle_declinaison(s.delta)), 'soleil', 1.8, 0.8);
      if (this.c_analemme.isChecked()) {
        const pts: Pts = [];
        for (let d = 0; d < 365; d += 3) {
          const ee = etat_soleil(d + this.heure.value() / 24.0, lat);
          pts.push(astro.vecteur_horizon(ee.az, ee.alt));
        }
        pe.courbe(pts, 'accent1', 1.6, 1.0, { ferme: true });
      }
      pe.segment(eq1([0, 0, 1]), eq1([0, 0, 1.2]), 'equateur', 2.0);
      pe.segment(eq1([0, 0, -1]), eq1([0, 0, -1.2]), 'equateur', 2.0);
      pe.point(soleil, 'soleil', 9.0);
    };

    const pe = new dessin.Peintre3D(p, this.vue3d, cx, cy, r);
    const ciel = dessin.c('ciel');
    const nuit = dessin.c('nuit');
    const mel =
      jour_ciel >= 1
        ? ciel
        : jour_ciel <= 0
          ? nuit
          : new Couleur(
              Math.trunc(nuit.r + (ciel.r - nuit.r) * jour_ciel),
              Math.trunc(nuit.g + (ciel.g - nuit.g) * jour_ciel),
              Math.trunc(nuit.b + (ciel.b - nuit.b) * jour_ciel),
            );
    p.setPen(dessin.stylo('grille', 1.2));
    mel.setAlphaF(0.45);
    p.setBrush(mel);
    p.drawEllipse(cx, cy, r, r);

    const plan = (): void => {
      pe.plan('sol', 0.6);
      if (this.c_ombre.isChecked() && e.alt > 0.5) {
        const long = Math.min(0.9, 0.12 / Math.tan((e.alt * Math.PI) / 180));
        const d = mul(astro.vecteur_horizon(e.az, 0.0), -long);
        pe.segment([0, 0, 0], d, 'ombre', 4.0, 0.45, true);
      }
    };

    dessin.scene_en_deux_passes(pe, scene, plan);
    scenes.points_cardinaux(pe);
    scenes.personnage(pe);
    if (this.c_mois.isChecked()) {
      JOURS_MOIS.forEach((j, i) => {
        const ss = astro.soleil_jour(ANNEE, j + 14.0);
        const v = mul(mv(m, astro.vecteur_equatorial(ss.alpha, ss.delta)), 1.08);
        if (v[2] > -0.02 || this.c_dessous.isChecked()) pe.etiquette(v, tr(`anim_mois_court_${i + 1}`), 'ecliptique');
      });
    }
    pe.etiquette(mul(soleil, 1.15), heures_minutes(this.heure.value()), 'soleil');
  }
}
