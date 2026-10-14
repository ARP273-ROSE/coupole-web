/**
 * Big Dipper Clock : les étoiles tournent autour de l'étoile Polaire, d'un tour par jour sidéral ; à heure fixe, elles
 * avancent d'environ 1° par jour au fil des saisons.  Ciel du nord en projection stéréographique centrée sur le pôle
 * céleste, horizon de l'observateur ; positions J2000 (SIMBAD) précessées à la date, temps sidéral IAU 1982.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { cheminPolygone, type Peintre, Pt, Rect } from '../../noyau/peintre';
import { linspace, pmod } from '../../noyau/py';
import { Animation, angle, type Coche, date_du_jour, heures_minutes, jour_de_date, type Reglage } from '../base';
import { couleur_reelle, reelle } from '../etoiles_reelles';

const ANNEE = 2026;
export const ETOILES: Record<string, [number, number, number]> = {
  dubhe: [165.93196, 61.75103, 1.79], merak: [165.46033, 56.38243, 2.37], phecda: [178.4577, 53.69476, 2.44],
  megrez: [183.8565, 57.03262, 3.32], alioth: [193.50729, 55.95982, 1.77], mizar: [200.98142, 54.92535, 2.22],
  alkaid: [206.88516, 49.31327, 1.86],
  polaire: [37.95456, 89.26411, 2.02], yildun: [263.05416, 86.58646, 4.34], eps_umi: [251.49268, 82.03726, 4.21],
  zet_umi: [236.01466, 77.79449, 4.27], eta_umi: [244.37613, 75.75534, 4.95], kochab: [222.67636, 74.1555, 2.08],
  pherkad: [230.1821, 71.83403, 3.0],
  caph: [2.29452, 59.14978, 2.27], schedar: [10.12685, 56.53733, 2.23], navi: [14.17721, 60.71674, 2.39],
  ruchbah: [21.45396, 60.23528, 2.68], segin: [28.59889, 63.6701, 3.37],
};
const FIGURES: Record<string, (string | null)[]> = {
  grande_ourse: ['dubhe', 'merak', 'phecda', 'megrez', 'alioth', 'mizar', 'alkaid', null, 'megrez', 'dubhe'],
  petite_ourse: ['polaire', 'yildun', 'eps_umi', 'zet_umi', 'kochab', 'pherkad', 'eta_umi', 'zet_umi'],
  cassiopee: ['caph', 'schedar', 'navi', 'ruchbah', 'segin'],
};
const ETIQUETTES: Record<string, string> = { grande_ourse: 'megrez', petite_ourse: 'kochab', cassiopee: 'navi', polaire: 'polaire' };
const CREPUSCULE = 7.0;
const R = Math.PI / 180;

interface Ciel {
  tsl: number;
  h_soleil: number;
  etoiles: Record<string, [number, number, number]>;
}

export function ciel(jour: number, heure: number, lat: number): Ciel {
  const jj = astro.jj_jour_de_l_annee(ANNEE, jour + heure / 24.0);
  const tsl = astro.tsmg(jj);
  const s = astro.soleil(jj);
  const [, h_sol] = astro.equatorial_vers_horizon(tsl - s.alpha, s.delta, lat);
  const etoiles: Record<string, [number, number, number]> = {};
  for (const [n, [ra, dec, mag]] of Object.entries(ETOILES)) {
    const [r, d] = astro.precession(ra, dec, jj);
    etoiles[n] = [astro.mod(tsl - r, 360.0), d, mag];
  }
  return { tsl, h_soleil: h_sol, etoiles };
}

/** Projection stéréographique centrée sur le pôle nord céleste, vue vers le nord (y vers le haut). */
export function stereo(h: number, dec: number): [number, number] {
  const r = 2 * Math.tan(((90.0 - dec) * R) / 2);
  return [-r * Math.sin(h * R), r * Math.cos(h * R)];
}

export class HorlogeGrandeOurse extends Animation {
  static override ID = 'dipperclock';
  static HEURES_PAR_S = 1.0;
  static override FICHES = true;

  jour!: Reglage;
  heure!: Reglage;
  lat!: Reglage;
  c_noms!: Coche;

  override construire(): void {
    this.jour = this.curseur('jour', 0.0, 364.0, 78.0, { dec: 0, cle_texte: 'anim_c_jour' });
    this.heure = this.curseur('heure', 0.0, 24.0, 1.2, { dec: 2, unite: 'h', cle_texte: 'anim_c_heure' });
    this.lat = this.curseur('latitude', 10.0, 90.0, 41.0, { dec: 1, unite: '°', cle_texte: 'anim_c_latitude' });
    this.c_noms = this.coche('noms', true);
    this.bouton('anim_dipperclock_maintenant', () => this.maintenant());
  }

  maintenant(): void {
    const t = new Date();
    const mois = t.getMonth() + 1;
    this.jour.setValue(Math.min(364, jour_de_date(mois, mois === 2 ? Math.min(t.getDate(), 28) : t.getDate())));
    this.heure.setValue(t.getHours() + t.getMinutes() / 60.0);
  }

  override avancer(dt: number): void {
    let h = this.heure.value() + dt * HorlogeGrandeOurse.HEURES_PAR_S;
    if (h >= 24.0) {
      h -= 24.0;
      this.jour.setValue(pmod(this.jour.value() + 1, 365));
    }
    this.heure.setValue(h);
  }

  override valeurs(): [string, string][] {
    const c = ciel(this.jour.value(), this.heure.value(), this.lat.value());
    return [
      [tr('anim_c_date'), date_du_jour(this.jour.value())],
      [tr('anim_c_heure'), heures_minutes(this.heure.value())],
      [tr('anim_c_tsl'), heures_minutes(c.tsl / 15.0)],
      [tr('anim_lunar_applet_h_soleil'), angle(c.h_soleil)],
      [tr('anim_dipperclock_dubhe'), heures_minutes(c.etoiles.dubhe![0] / 15.0)],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const c = ciel(this.jour.value(), this.heure.value(), this.lat.value());
    const cx = rect.cx,
      cy = rect.y + rect.h * 0.46;
    const k = (Math.min(rect.w, rect.h) * 0.5) / 1.05;
    const nuit = Math.max(0.0, Math.min(1.0, -c.h_soleil / CREPUSCULE));
    p.fillRect(rect, dessin.c('ciel', 0.9 - 0.75 * nuit));
    const lat = this.lat.value();
    const q = (h: number, d: number): Pt => {
      const [x, y] = stereo(h, d);
      return new Pt(cx + k * x, cy - k * y);
    };
    const pts = linspace(-150.0, 150.0, 121).map((az) => q(...astro.horizon_vers_equatorial(pmod(az, 360.0), 0.0, lat)));
    const sol = cheminPolygone([...pts, new Pt(rect.right + 10, rect.bottom + 10), new Pt(rect.x - 10, rect.bottom + 10)]);
    p.setPen(dessin.stylo('horizon', 1.5));
    p.setBrush(dessin.c('sol', 0.95));
    p.drawPath(sol);
    const nord = q(...astro.horizon_vers_equatorial(0.0, 0.0, lat));
    dessin.texte(p, nord.x, nord.y + 14, tr('anim_pc_n'), 'horizon');
    if (nuit > 0.05) {
      const vis: Record<string, Pt> = {};
      for (const [n, [h, d]] of Object.entries(c.etoiles)) if (astro.equatorial_vers_horizon(h, d, lat)[1] > -0.5) vis[n] = q(h, d);
      p.setPen(dessin.stylo('accent2', 1.2, 0.55 * nuit));
      for (const fig of Object.values(FIGURES))
        for (let i = 0; i < fig.length - 1; i++) {
          const a = fig[i],
            b = fig[i + 1];
          if (a && b && vis[a] && vis[b]) p.drawLineP(vis[a]!, vis[b]!);
        }
      for (const [n, pt] of Object.entries(vis)) {
        // couleur vraie (corps noir à T_eff) ; un fin contour la garde visible sur un ciel clair
        const r = Math.max(1.5, 4.2 - 0.6 * c.etoiles[n]![2]);
        dessin.disque(p, pt.x, pt.y, r, couleur_reelle('dipperclock', n) ?? 'etoile', dessin.theme() === 'clair' ? 'doux' : null, nuit);
        const f = reelle('dipperclock', n);
        if (f) this.survolable(p, f.fiche, pt.x, pt.y, Math.max(5, r + 2), c.etoiles[n]![2]);
      }
      if (this.c_noms.isChecked()) {
        dessin.police(p, 0.85);
        for (const [cle, etoile] of Object.entries(ETIQUETTES))
          if (vis[etoile]) dessin.texte(p, vis[etoile]!.x + 16, vis[etoile]!.y - 12, tr('anim_dipperclock_' + cle), 'texte', { alpha: nuit });
        dessin.police(p, 1 / 0.85);
      }
    }
    this.horloge(p, new Rect(rect.right - 96, rect.y + 8, 88, 88));
  }

  /** Cadran de 24 heures (midi en haut) et aiguille des heures. */
  private horloge(p: Peintre, r: Rect): void {
    const cx = r.cx,
      cy = r.cy,
      rr = r.w / 2 - 4;
    p.setPen(dessin.stylo('grille', 1.2));
    p.setBrush(dessin.c('fond', 0.8));
    p.drawEllipse(cx, cy, rr, rr);
    dessin.police(p, 0.7);
    for (const h of [0, 6, 12, 18]) {
      const a = (90.0 - (h - 12) * 15.0) * R;
      dessin.texte(p, cx + 0.72 * rr * Math.cos(a), cy - 0.72 * rr * Math.sin(a), String(h), 'doux');
    }
    dessin.police(p, 1 / 0.7);
    const a = (90.0 - (this.heure.value() - 12.0) * 15.0) * R;
    p.setPen(dessin.stylo('accent3', 2.4));
    p.drawLine(cx, cy, cx + 0.55 * rr * Math.cos(a), cy - 0.55 * rr * Math.sin(a));
  }
}
