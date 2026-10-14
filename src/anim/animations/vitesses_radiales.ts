/**
 * Radial Velocity Simulator (NAAP) : la courbe de vitesse radiale d'une étoile à planète, pour une orbite quelconque,
 * avec des mesures simulées bruitées.  v_r = K [cos(ν + ω) + e cos ω], K = (2πG / P)^⅓ M_p sin i / (M_* + M_p)^⅔ /
 * √(1 − e²).  Planètes réelles : NASA Exoplanet Archive (2026) ; a tiré de la période publiée.
 */
import LOT3 from '../../donnees/genere/lot3.json';
import * as dc from '../../calc/deux_corps';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, Pt, type Rect } from '../../noyau/peintre';
import { alea, gauss, pmod } from '../../noyau/py';
import { Animation, type Choix, nombre, type Reglage } from '../base';
import { texte_duree } from './vitesse_radiale';

type Prereglage = (string | number)[];
const D = LOT3 as unknown as { vitesses_radiales: Prereglage[]; vitesses_radiales_exemples: Prereglage[] };
const PREREGLAGES: Record<string, Prereglage> = {};
for (const t of [...D.vitesses_radiales_exemples, ...D.vitesses_radiales]) PREREGLAGES[t[0] as string] = t;

export class VitessesRadiales extends Animation {
  static override ID = 'radialvelocitysimulator';

  prereglage!: Choix;
  ms!: Reglage;
  mp!: Reglage;
  a!: Reglage;
  e!: Reglage;
  i!: Reglage;
  w!: Reglage;
  bruit!: Reglage;
  n_mesures!: Reglage;
  phase = 0.0;
  private mesuresCache: [number, number][] | null = null;

  override construire(): void {
    this.prereglage = this.choix('systeme', [
      ...'abcd'.split('').map((k) => ['anim_radialvelocitysimulator_s_' + k, k] as [string, string]),
      ...D.vitesses_radiales.map((t) => ['anim_radialvelocitysimulator_s_' + (t[0] as string).toLowerCase().replace(/ /g, '_'), t[0] as string] as [string, string]),
    ], 'a');
    this.prereglage.activated.connect(() => this.appliquer());
    this.ms = this.curseur('masse_etoile', 0.1, 3.0, 1.0, { dec: 3, unite: 'M☉' });
    this.mp = this.curseur('masse_planete', 0.001, 30.0, 1.0, { dec: 3, unite: 'M♃', log: true });
    this.a = this.curseur('a', 0.01, 6.0, 1.0, { dec: 4, unite: 'ua', log: true });
    this.e = this.curseur('e', 0.0, 0.9, 0.0, { dec: 3 });
    this.i = this.curseur('i', 0.0, 90.0, 90.0, { dec: 1, unite: '°' });
    this.w = this.curseur('omega', 0.0, 360.0, 0.0, { dec: 1, unite: '°' });
    this.bruit = this.curseur('bruit', 0.0, 50.0, 3.0, { dec: 1, unite: 'm·s⁻¹' });
    this.n_mesures = this.curseur('mesures', 0.0, 200.0, 40.0, { dec: 0 });
    this.phase = 0.0;
    this.mesuresCache = null;
  }

  private appliquer(): void {
    const t = PREREGLAGES[this.prereglage.currentData() as string]!;
    let [, ms, mp, a, e, i, w] = t as [string, number, number, number, number, number, number];
    if (t.length !== 7) a = dc.demi_grand_axe_m((t[7] as number) * dc.JOUR_S, ms * dc.M_SOLEIL_KG, mp * dc.M_JUPITER_KG) / dc.UA_M;
    for (const [reg, v] of [[this.ms, ms], [this.mp, mp], [this.a, a], [this.e, e], [this.i, i], [this.w, w]] as [Reglage, number][]) reg.setValue(v);
    this.rafraichir();
  }

  override etat_initial(): void {
    this.phase = 0.0;
    this.mesuresCache = null;
  }

  override reglage_change(): void {
    this.mesuresCache = null;
    super.reglage_change();
  }

  systeme(): { P: number; K: number; e: number; i: number; w: number; q: number } {
    const m1 = this.ms.value() * dc.M_SOLEIL_KG,
      m2 = this.mp.value() * dc.M_JUPITER_KG;
    const a = this.a.value() * dc.UA_M;
    const e = this.e.value(),
      i = this.i.value(),
      w = this.w.value();
    return { P: dc.periode_s(a, m1, m2), K: dc.amplitude_k(m1, m2, a, e, i), e, i, w, q: m2 / (m1 + m2) };
  }

  mesures(s: { K: number; e: number; w: number }): [number, number][] {
    if (this.mesuresCache === null) {
      const u = alea(11);
      const sig = this.bruit.value();
      this.mesuresCache = [];
      for (let k = 0; k < Math.trunc(this.n_mesures.value()); k++) {
        const ph = u();
        this.mesuresCache.push([ph, dc.vitesse_radiale(ph, s.K, s.e, s.w) + gauss(u, 0.0, sig)]);
      }
    }
    return this.mesuresCache;
  }

  override avancer(dt: number): void {
    this.phase = pmod(this.phase + dt / 10.0, 1.0);
  }

  override valeurs(): [string, string][] {
    const s = this.systeme();
    const out: [string, string][] = [
      [tr('anim_c_periode'), texte_duree(s.P)],
      [tr('anim_ca_extrasolarplanets_graph_k'), `${nombre(s.K, 2)} m·s⁻¹`],
      [tr('anim_radialvelocitysimulator_msini'), `${nombre(this.mp.value() * Math.sin((s.i * Math.PI) / 180), 3)} M♃`],
    ];
    const t = PREREGLAGES[this.prereglage.currentData() as string]!;
    if (t.length === 9) out.push([tr('anim_ca_extrasolarplanets_graph_k_mesuree'), `${nombre(t[8] as number, 1)} m·s⁻¹`]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const s = this.systeme();
    const z = dessin.zones(rect, 2, 0.95);
    this.orbite(p, dessin.cadre(p, z[0]!, tr('anim_radialvelocitysimulator_titre_orbite')), s);
    const r = dessin.cadre(p, z[1]!, tr('anim_radialvelocitysimulator_titre_courbe'));
    const k = Math.max(s.K, 1e-6);
    const vmax = Math.max(k * (1 + s.e), 3 * this.bruit.value(), 1e-6);
    const ax = new Axes(r, 0, 1, -1.25 * vmax, 1.25 * vmax, false, false, [54, 8, 10, 28]).avec(p);
    ax.fond(p, { titre_x: tr('anim_c_phase'), titre_y: tr('anim_c_vitesse_radiale'), dec_x: 1 });
    ax.horizontale(0.0, 'grille', 1.0, false);
    if (this.n_mesures.value() > 0) ax.points(this.mesures(s), 'doux', 2.2, 0.8);
    const pts: [number, number][] = [];
    for (let x = 0; x <= 200; x++) pts.push([x / 200, dc.vitesse_radiale(x / 200, s.K, s.e, s.w)]);
    ax.courbe(pts, 'accent1', 2.0);
    ax.points([[this.phase, dc.vitesse_radiale(this.phase, s.K, s.e, s.w)]], 'accent3', 5, 1.0);
  }

  /** Orbite relative vue de dessus (observateur en bas), étoile au foyer. */
  private orbite(p: Peintre, r: Rect, s: { e: number; w: number; q: number }): void {
    const cx = r.cx,
      cy = r.cy - 8;
    const e = s.e,
      w = (s.w * Math.PI) / 180;
    const k = (Math.min(r.w, r.h) * 0.38) / (1 + e);
    const pts: Pt[] = [];
    for (let n = 0; n <= 120; n++) {
      const nu = (2 * Math.PI * n) / 120;
      const rr = (1 - e * e) / (1 + e * Math.cos(nu));
      pts.push(new Pt(cx + k * rr * Math.cos(nu + w), cy + k * rr * Math.sin(nu + w)));
    }
    p.setPen(dessin.stylo('equateur', 1.0, 0.7, true));
    p.setBrush(null);
    p.drawPolyline(pts);
    const nu = dc.anomalie_vraie(this.phase, e);
    const rr = (1 - e * e) / (1 + e * Math.cos(nu));
    const px = cx + k * rr * Math.cos(nu + w),
      py = cy + k * rr * Math.sin(nu + w);
    const q = Math.max(s.q, 0.02);
    dessin.disque(p, cx - (px - cx) * q, cy - (py - cy) * q, 11, 'soleil');
    dessin.disque(p, px, py, 5, 'equateur', 'texte');
    dessin.texte(p, cx, r.bottom - 8, '↓ ' + tr('anim_c_vers_observateur'), 'doux');
  }
}
