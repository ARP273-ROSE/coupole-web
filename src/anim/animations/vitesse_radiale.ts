/**
 * Vitesse radiale d'une étoile à planète.  Radial Velocity Graph : la vitesse de l'étoile le long de la ligne de visée
 * trace une sinusoïde.  Extrasolar Planet Radial Velocity Demonstrator : le même mouvement vu dans le spectre, dont les
 * raies se décalent vers le bleu puis vers le rouge (Δλ / λ = v / c).  K = (2πG / P)^⅓ M_p sin i / (M_* + M_p)^⅔.
 */
import LOT3 from '../../donnees/genere/lot3.json';
import * as dc from '../../calc/deux_corps';
import * as lumiere from '../../calc/lumiere';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes, bande_spectre } from '../../noyau/graphe';
import { type Peintre, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import { Animation, type Choix, nombre, type Reglage } from '../base';

const GM = LOT3.gm_de440 as Record<string, number>;
const STANDISH = LOT3.elements_standish as unknown as Record<string, [number[], number[]]>;
const GM_TERRE_LUNE = GM.terre! * 1e9;
const SYSTEMES: Record<string, [number, number, number, number]> = {
  soleil_jupiter: [dc.M_SOLEIL_KG, (GM.jupiter! * 1e9) / dc.G, STANDISH.jupiter![0][0]! * dc.UA_M, 90.0],
  soleil_terre: [dc.M_SOLEIL_KG, GM_TERRE_LUNE / dc.G, STANDISH.terre![0][0]! * dc.UA_M, 90.0],
  '51peg': [1.07 * dc.M_SOLEIL_KG, 0.61 * dc.M_JUPITER_KG, 0.052 * dc.UA_M, 49.8],
};
const K_PUBLIEE: Record<string, number> = { '51peg': 55.77 };
const RAIES = [656.28, 589.0, 486.13, 434.05];

export function systeme(nom: string): { m1: number; m2: number; a: number; i: number; P: number; K: number } {
  const [m1, m2, a, i] = SYSTEMES[nom]!;
  return { m1, m2, a, i, P: dc.periode_s(a, m1, m2), K: dc.amplitude_k(m1, m2, a, 0.0, i) };
}

export function texte_duree(s: number): string {
  const j = s / dc.JOUR_S;
  if (j < 1) return `${nombre(j * 24, 2)} ${tr('anim_c_heures')}`;
  if (j > 700) return `${nombre(j / 365.25, 2)} ${tr('anim_c_ans')}`;
  return `${nombre(j, j < 10 ? 3 : 1)} ${tr('anim_c_jours')}`;
}

export class CourbeVitesseRadiale extends Animation {
  static override ID = 'ca_extrasolarplanets_graph';
  static override LECTURE_AU_DEPART = true;

  sys!: Choix;
  phase = 0.0;

  override construire(): void {
    this.sys = this.choix('systeme', Object.keys(SYSTEMES).map((k) => ['anim_ca_extrasolarplanets_graph_s_' + k, k] as [string, string]), 'soleil_jupiter');
    this.phase = 0.0;
  }

  override etat_initial(): void {
    this.phase = 0.0;
  }

  override avancer(dt: number): void {
    this.phase = pmod(this.phase + dt / 8.0, 1.0);
  }

  override valeurs(): [string, string][] {
    const s = systeme(this.sys.currentData() as string);
    const v = -s.K * Math.cos(2 * Math.PI * this.phase);
    const out: [string, string][] = [
      [tr('anim_c_periode'), texte_duree(s.P)],
      [tr('anim_ca_extrasolarplanets_graph_k'), `${nombre(s.K, 2)} m/s`],
      [tr('anim_ca_extrasolarplanets_graph_v'), `${nombre(v, 2)} m/s`],
    ];
    const kp = K_PUBLIEE[this.sys.currentData() as string];
    if (kp) out.push([tr('anim_ca_extrasolarplanets_graph_k_mesuree'), `${nombre(kp, 2)} m/s`]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const s = systeme(this.sys.currentData() as string);
    const z = dessin.zones(rect, 2, 0.9);
    const r = dessin.cadre(p, z[0]!, tr('anim_ca_extrasolarplanets_graph_titre_orbite'));
    const cx = r.cx,
      cy = r.cy - 10;
    const rp = Math.min(r.w, r.h) * 0.36;
    const q = s.m2 / (s.m1 + s.m2);
    const rs = Math.max(6.0, rp * q * 40);
    const a = 2 * Math.PI * this.phase;
    const sx = cx - rs * Math.cos(a),
      sy = cy + rs * Math.sin(a);
    const px = cx + rp * Math.cos(a),
      py = cy - rp * Math.sin(a);
    p.setBrush(null);
    p.setPen(dessin.stylo('equateur', 1.0, 0.6, true));
    p.drawEllipse(cx, cy, rp, rp);
    p.setPen(dessin.stylo('accent1', 1.0, 0.8, true));
    p.drawEllipse(cx, cy, rs, rs);
    const v = -s.K * Math.cos(a);
    const col = v < 0 ? 'accent2' : 'accent3';
    dessin.disque(p, sx, sy, 14, 'soleil');
    dessin.disque(p, px, py, 5, 'equateur', 'texte');
    dessin.fleche(p, sx, sy, sx, sy - (40 * v) / s.K, dessin.stylo(col, 2.0), 7);
    p.setPen(dessin.stylo('accent3', 1.5));
    p.drawLine(cx - 4, cy, cx + 4, cy);
    p.drawLine(cx, cy - 4, cx, cy + 4);
    dessin.texte(p, cx, r.bottom - 10, '↓ ' + tr('anim_c_vers_observateur'), 'doux');
    dessin.texte(p, r.left + 8, r.top + 10, tr('anim_ca_extrasolarplanets_graph_agrandie'), 'doux', { centre: false });
    const r2 = dessin.cadre(p, z[1]!, tr('anim_ca_extrasolarplanets_graph_titre_courbe'));
    const k = s.K;
    const ax = new Axes(r2, 0, 2, -1.25 * k, 1.25 * k, false, false, [52, 10, 12, 30]).avec(p);
    ax.fond(p, { titre_x: tr('anim_ca_extrasolarplanets_graph_axe_t'), titre_y: tr('anim_c_vitesse_radiale') });
    ax.horizontale(0.0, 'grille', 1.0, false);
    const pts: [number, number][] = [];
    for (let x = 0; x <= 200; x++) pts.push([x / 100, -k * Math.cos((2 * Math.PI * x) / 100)]);
    ax.courbe(pts, 'accent1', 2.0);
    for (const n of [0, 1]) ax.points([[this.phase + n, v]], col, 6, 1.0);
    dessin.texte(p, ax.r.left + 6, ax.r.top + 10, tr('anim_ca_extrasolarplanets_graph_eloigne'), 'accent3', { centre: false });
    dessin.texte(p, ax.r.left + 6, ax.r.bottom - 6, tr('anim_ca_extrasolarplanets_graph_approche'), 'accent2', { centre: false });
  }
}

export class SpectreVitesseRadiale extends Animation {
  static override ID = 'radialvelocitydemo';
  static override LECTURE_AU_DEPART = true;

  m_etoile!: Reglage;
  m_planete!: Reglage;
  a!: Reglage;
  amplification!: Reglage;
  phase = 0.0;

  override construire(): void {
    this.m_etoile = this.curseur('etoile', 0.3, 2.0, 1.0, { dec: 2, unite: 'M☉' });
    this.m_planete = this.curseur('planete', 0.01, 20.0, 1.0, { dec: 2, unite: 'M♃', log: true });
    this.a = this.curseur('a', 0.02, 6.0, 0.05, { dec: 3, unite: 'ua', log: true });
    this.amplification = this.curseur('amplification', 1.0, 100000.0, 10000.0, { dec: 0, unite: '×', log: true });
    this.phase = 0.0;
  }

  override etat_initial(): void {
    this.phase = 0.0;
  }

  override avancer(dt: number): void {
    this.phase = pmod(this.phase + dt / 8.0, 1.0);
  }

  grandeurs(): { P: number; K: number; v: number } {
    const m1 = this.m_etoile.value() * dc.M_SOLEIL_KG;
    const m2 = this.m_planete.value() * dc.M_JUPITER_KG;
    const a = this.a.value() * dc.UA_M;
    const k = dc.amplitude_k(m1, m2, a, 0.0, 90.0);
    return { P: dc.periode_s(a, m1, m2), K: k, v: -k * Math.cos(2 * Math.PI * this.phase) };
  }

  override valeurs(): [string, string][] {
    const g = this.grandeurs();
    return [
      [tr('anim_c_periode'), texte_duree(g.P)],
      [tr('anim_ca_extrasolarplanets_graph_k'), `${nombre(g.K, 2)} m/s`],
      [tr('anim_ca_extrasolarplanets_graph_v'), `${nombre(g.v, 2)} m/s`],
      [tr('anim_radialvelocitydemo_dl'), `${nombre((656.28e3 * g.v) / lumiere.C, 4)} pm`],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const g = this.grandeurs();
    const haut = new Rect(rect.x, rect.y, rect.w, rect.h * 0.62);
    const r = dessin.cadre(p, haut, tr('anim_radialvelocitydemo_titre_systeme'));
    const cx = r.cx,
      cy = r.cy - 6;
    const rp = Math.min(r.w * 0.4, r.h * 0.42);
    const q = (this.m_planete.value() * dc.M_JUPITER_KG) / (this.m_etoile.value() * dc.M_SOLEIL_KG);
    const rs = Math.max(4.0, Math.min(rp * 0.4, rp * q * 30));
    const a = 2 * Math.PI * this.phase;
    p.setBrush(null);
    p.setPen(dessin.stylo('equateur', 1.0, 0.6, true));
    p.drawEllipse(cx, cy, rp, rp);
    dessin.disque(p, cx - rs * Math.cos(a), cy + rs * Math.sin(a), 13, 'soleil');
    dessin.disque(p, cx + rp * Math.cos(a), cy - rp * Math.sin(a), 4 + 2 * Math.log10(1 + this.m_planete.value() * 10), 'equateur', 'texte');
    dessin.texte(p, cx, r.bottom - 8, '↓ ' + tr('anim_c_vers_observateur'), 'doux');
    const bas = new Rect(rect.x, haut.bottom, rect.w, rect.h - haut.h);
    const rb = dessin.cadre(p, bas, tr('anim_radialvelocitydemo_titre_spectre'));
    const bande = new Rect(rb.x + 8, rb.y + 2, rb.w - 16, Math.max(16.0, rb.h * 0.42));
    const z = (g.v / lumiere.C) * this.amplification.value();
    bande_spectre(p, bande, 420, 680, () => 1.0, RAIES.map((lam) => [lam * (1 + z), 0.85, 3.0] as [number, number, number]), true);
    const ref = new Rect(bande.left, bande.bottom + 6, bande.w, Math.max(10.0, rb.h * 0.22));
    bande_spectre(p, ref, 420, 680, () => 0.55, RAIES.map((lam) => [lam, 0.85, 2.0] as [number, number, number]), true);
    dessin.police(p, 0.8);
    dessin.texte(p, ref.cx, ref.bottom + 9, tr('anim_radialvelocitydemo_reference'), 'doux');
    dessin.police(p, 1 / 0.8);
  }
}
