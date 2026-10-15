/**
 * Eclipse Shadow Simulator : la Lune (et la Terre) à placer librement ; les cônes d'ombre, d'antombre et de pénombre
 * de la Terre ET de la Lune sont tracés en vraie géométrie, et le type d'éclipse est calculé avec les tailles et la
 * distance réelles de la Lune telle que placée (calc/eclipses_geo.ts : totale, annulaire, hybride, partielle,
 * pénombrale, aucune ; largeur de la bande).
 *
 * Vue de côté : le Soleil est à gauche, si loin que ses rayons sont parallèles (hors échelle) ; le long de l'axe,
 * 1 px vaut `kx` km (la distance Terre–Lune affichée est celle de la figure) ; en travers, 1 px vaut `ky` km (tailles
 * et écarts agrandis du rapport kx / ky, indiqué) : les cônes, très effilés en vrai, restent lisibles et cohérents
 * avec le calcul.  Vue 3D : orbite de la Lune inclinée de 5,145° sur le plan Terre–Soleil, ligne des nœuds, Lune
 * au-dessus ou au-dessous de l'axe ; curseurs « position sur l'orbite » et « angle Soleil – nœuds » (saisons
 * d'éclipses).  « Rejouer une éclipse » replace la Lune selon la géométrie réelle de l'éclipse choisie (JPL DE440 :
 * distance, gamma, trajectoire), dans les trois vues, l'instant la faisant avancer.
 */
import * as astro from '../../calc/astro';
import * as G from '../../calc/eclipses_geo';
import GEO from '../../donnees/genere/eclipses_geometrie.json';
import { langue, tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect, type Stylo } from '../../noyau/peintre';
import { Animation, type Bouton_souris, type Choix, type Coche, duree_hm, nombre, type Reglage } from '../base';
import { ECLIPSES_LUNE, ECLIPSES_SOLEIL, type Eclipse, format_duree } from './table_eclipses';

const INCLINAISON_LUNE = 5.145;
/** vue de côté : tailles et écarts (en travers) agrandis de ce facteur par rapport aux distances le long de l'axe */
export const AGRANDISSEMENT = 6;
const DEG = Math.PI / 180;

interface GeoEclipse {
  date: [number, number, number];
  type: string;
  jj_ut: number;
  iso: string;
  d_km: number;
  s_km: number;
  x_km: number;
  y_km: number;
  vx_kmh: number;
  vy_kmh: number;
  gamma: number;
}
const GEOMETRIE = (GEO as unknown as { eclipses: Record<string, GeoEclipse> }).eclipses;

/** Date d'une éclipse de la table, dans la langue courante. */
function date_eclipse(e: Eclipse): string {
  const d = new Date(Date.UTC(e[0], e[1] - 1, e[2]));
  return d.toLocaleDateString(langue() === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export interface Rejeu {
  cle: string;
  solaire: boolean;
  e: Eclipse;
  g: GeoEclipse;
  /** demi-durée montrée (heures), de part et d'autre du maximum */
  demi_h: number;
}

/** Éclipse de la table (clé « S<i> » ou « L<i> ») et sa géométrie réelle (DE440), ou null. */
export function rejeu(cle: string): Rejeu | null {
  const solaire = cle[0] === 'S';
  const e = (solaire ? ECLIPSES_SOLEIL : ECLIPSES_LUNE)[Number(cle.slice(1))];
  const g = GEOMETRIE[cle];
  if (!e || !g) return null;
  const v = Math.max(1, Math.hypot(g.vx_kmh, g.vy_kmh));
  const delta = Math.abs(g.gamma) * G.R_TERRE_KM;
  const x = Math.sqrt(Math.max(0, g.d_km ** 2 - delta ** 2));
  const rayon = solaire ? G.R_TERRE_KM + G.eclipseSoleil(-x, 0, g.s_km).penombre_km : G.eclipseLune(x, 0, g.s_km).penombre_km + G.R_LUNE_KM;
  return { cle, solaire, e, g, demi_h: (rayon * 1.08) / v };
}

/** Position de la Lune (km, repère de la Terre : x vers l'opposé du Soleil, y nord, z est) à l'instant u ∈ [−1, 1]. */
export function lune_rejeu(rj: Rejeu, u: number): [number, number, number] {
  const dt = u * rj.demi_h;
  const est = rj.g.x_km + rj.g.vx_kmh * dt;
  const nord = rj.g.y_km + rj.g.vy_kmh * dt;
  const delta = Math.hypot(est, nord);
  const le_long = Math.sqrt(Math.max(0, rj.g.d_km ** 2 - delta ** 2));
  return [rj.solaire ? -le_long : le_long, nord, est];
}

export interface Types {
  soleil: G.EclipseSoleil;
  lune: G.EclipseLune;
  distance_km: number;
  delta_km: number;
}

/** Types d'éclipse pour une Lune en (x, y, z) km par rapport à la Terre. */
export function types(x: number, y: number, z: number, d_soleil = G.UA_KM): Types {
  const delta = Math.hypot(y, z);
  return { soleil: G.eclipseSoleil(x, delta, d_soleil), lune: G.eclipseLune(x, delta, d_soleil), distance_km: Math.hypot(x, y, z), delta_km: delta };
}

export class OmbresEclipse extends Animation {
  static override ID = 'shadowsim';
  static override ANIMEE = false;

  /** Terre : position dans la vue de côté (fraction) ; Lune : km par rapport à la Terre */
  terre: [number, number] = [0.42, 0.5];
  lune: [number, number, number] = [G.D_LUNE_KM, 0, 0];
  c_reel!: Coche;
  c_3d!: Coche;
  position!: Reglage;
  noeuds!: Reglage;
  rejouer!: Choix;
  instant!: Reglage;
  vue3d!: dessin.Vue3D;
  private cote: Rect | null = null;
  private echelle: [number, number] = [G.D_LUNE_KM / 186, G.D_LUNE_KM / 186 / AGRANDISSEMENT]; // avant le premier dessin

  override construire(): void {
    this.vue3d = this.vue(215.0, 22.0, -80.0, 85.0);
    this.c_reel = this.coche('reel', true);
    this.c_3d = this.coche('vue3d', true);
    this.position = this.curseur('position', 0.0, 360.0, 180.0, { dec: 0, unite: '°' });
    this.noeuds = this.curseur('noeuds', 0.0, 360.0, 0.0, { dec: 0, unite: '°' });
    const orbite = (): void => {
      if (this.rejeu()) return;
      const d = Math.hypot(...this.lune) || G.D_LUNE_KM;
      this.lune = G.positionOrbite(d, this.position.value(), this.noeuds.value(), INCLINAISON_LUNE);
    };
    this.position.valueChanged.connect(orbite);
    this.noeuds.valueChanged.connect(orbite);
    const options: [string, string][] = [['anim_shadowsim_libre', 'libre']];
    const toutes: [Eclipse, string, boolean][] = [
      ...ECLIPSES_SOLEIL.map((e, i) => [e, 'S' + i, true] as [Eclipse, string, boolean]),
      ...ECLIPSES_LUNE.map((e, i) => [e, 'L' + i, false] as [Eclipse, string, boolean]),
    ];
    toutes.sort((a, b) => a[0][0] - b[0][0] || a[0][1] - b[0][1] || a[0][2] - b[0][2]);
    for (const [e, cle, sol] of toutes)
      options.push([`${date_eclipse(e)} · ${tr(sol ? 'anim_shadowsim_soleil' : 'anim_shadowsim_lune_t')}, ${tr('anim_eclipsetable_t_' + e[3])}`, cle]);
    this.rejouer = this.choix('rejouer', options, 'libre');
    this.instant = this.curseur('instant', -1.0, 1.0, 0.0, { dec: 2 });
    this.instant.setVisible(false);
    this.rejouer.currentIndexChanged.connect(() => {
      const rj = this.rejeu();
      this.instant.setVisible(rj !== null);
      this.instant.setValue(0.0);
      // en quittant le rejeu, on retrouve le placement libre (la Lune reste où l'éclipse l'avait mise)
      if (rj) this.lune = lune_rejeu(rj, 0);
    });
    this.instant.valueChanged.connect(() => {
      const rj = this.rejeu();
      if (rj) this.lune = lune_rejeu(rj, this.instant.value());
    });
    // réglages repris d'une adresse partagée (ou de la mémoire) : posés sans signal → on place la Lune d'après eux
    const rj = this.rejeu();
    this.instant.setVisible(rj !== null);
    if (rj) this.lune = lune_rejeu(rj, this.instant.value());
    else if (this.position.value() !== 180 || this.noeuds.value() !== 0)
      this.lune = G.positionOrbite(G.D_LUNE_KM, this.position.value(), this.noeuds.value(), INCLINAISON_LUNE);
  }

  rejeu(): Rejeu | null {
    const k = this.rejouer.currentData() as string;
    return k === 'libre' ? null : rejeu(k);
  }

  override etat_initial(): void {
    this.terre = [0.42, 0.5];
    this.lune = G.positionOrbite(G.D_LUNE_KM, this.position?.value() ?? 180, this.noeuds?.value() ?? 0, INCLINAISON_LUNE);
  }

  /** Types d'éclipse pour la position actuelle (distance du Soleil de l'éclipse rejouée, sinon 1 ua). */
  etat(): Types {
    const rj = this.rejeu();
    return types(this.lune[0], this.lune[1], this.lune[2], rj ? rj.g.s_km : G.UA_KM);
  }

  // ------------------------------------------------------------ souris
  private ecran(r: Rect): { ex: number; ey: number; lx: number; ly: number; kx: number; ky: number; rt: number; rl: number } {
    const [kx, ky] = this.echelle;
    const ex = r.x + this.terre[0] * r.w,
      ey = r.y + this.terre[1] * r.h;
    return { ex, ey, lx: ex + this.lune[0] / kx, ly: ey - this.lune[1] / ky, kx, ky, rt: G.R_TERRE_KM / ky, rl: G.R_LUNE_KM / ky };
  }

  override presser(pos: Pt, b: Bouton_souris): boolean {
    const r = this.cote;
    if (r !== null && r.contains(pos) && !this.rejeu()) {
      const e = this.ecran(r);
      if (Math.hypot(pos.x - e.lx, pos.y - e.ly) <= Math.max(e.rl, 10) + 8) {
        this._glisse = (q) => this.tirerLune(q);
        return true;
      }
      if (Math.hypot(pos.x - e.ex, pos.y - e.ey) <= e.rt + 6) {
        this._glisse = (q) => this.tirerTerre(q);
        return true;
      }
    }
    return super.presser(pos, b);
  }

  private tirerLune(pos: Pt): void {
    const r = this.cote!;
    const e = this.ecran(r);
    const px = Math.max(r.x + 4, Math.min(r.right - 4, pos.x));
    const py = Math.max(r.y + 4, Math.min(r.bottom - 4, pos.y));
    let dx = px - e.ex,
      dy = py - e.ey;
    // jamais dans la Terre
    const min = e.rt + e.rl + 2;
    const d = Math.hypot(dx, dy);
    if (d < min) {
      const ux = d > 1e-6 ? dx / d : 1,
        uy = d > 1e-6 ? dy / d : 0;
      dx = ux * min;
      dy = uy * min;
    }
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    this.lune = [dx * e.kx, -dy * e.ky, 0];
  }

  private tirerTerre(pos: Pt): void {
    const r = this.cote!;
    const x = Math.max(0.2, Math.min(0.8, (pos.x - r.x) / r.w));
    const y = Math.max(0.12, Math.min(0.88, (pos.y - r.y) / r.h));
    if (Number.isFinite(x) && Number.isFinite(y)) this.terre = [x, y];
  }

  // ------------------------------------------------------------ valeurs
  override valeurs(): [string, string][] {
    const t = this.etat();
    const s = t.soleil,
      l = t.lune;
    const km = (v: number): string => nombre(Math.round(v), 0);
    const dir = this.lune[1] >= 0 ? tr('anim_shadowsim_nord') : tr('anim_shadowsim_sud');
    const d = t.distance_km;
    const cle_d = d < G.PERIGEE_MIN_KM ? 'anim_shadowsim_dist_moins' : d > G.APOGEE_MAX_KM ? 'anim_shadowsim_dist_plus' : 'anim_shadowsim_dist_dans';
    const soleil = s.type === 'aucune' ? tr('anim_shadowsim_aucune') : tr('anim_shadowsim_s_' + s.type, { l: km(s.largeur_km) });
    const lune = l.type === 'aucune' ? tr('anim_shadowsim_aucune') : tr('anim_shadowsim_l_' + l.type);
    const out: [string, string][] = [
      [tr('anim_shadowsim_solaire'), soleil],
      [tr('anim_shadowsim_lunaire'), lune],
      [tr('anim_shadowsim_distance'), tr(cle_d, { d: km(d), p: km(G.PERIGEE_MIN_KM), a: km(G.APOGEE_MAX_KM) })],
      [tr('anim_shadowsim_ecart'), tr('anim_shadowsim_ecart_val', { r: nombre(Math.abs(this.lune[1]) / G.R_TERRE_KM, 2), km: km(Math.abs(this.lune[1])), dir })],
    ];
    if (Math.abs(this.lune[2]) > 1) out.push([tr('anim_shadowsim_hors_plan'), `${km(Math.abs(this.lune[2]))} km`]);
    out.push([tr('anim_shadowsim_echelle'), tr('anim_shadowsim_echelle_val', { k: nombre(AGRANDISSEMENT, 0) })]);
    const rj = this.rejeu();
    if (rj) {
      const jj = rj.g.jj_ut + (this.instant.value() * rj.demi_h) / 24;
      const h = (((jj + 0.5) % 1) + 1) % 1;
      const hm = `${String(Math.floor(h * 24)).padStart(2, '0')}:${String(Math.floor(((h * 24) % 1) * 60)).padStart(2, '0')}`;
      out.push(
        [tr('anim_shadowsim_rejouee'), `${date_eclipse(rj.e)} · ${tr(rj.solaire ? 'anim_shadowsim_soleil' : 'anim_shadowsim_lune_t')}, ${tr('anim_eclipsetable_t_' + rj.e[3])}`],
        [tr('anim_shadowsim_instant_ut'), `${hm} ${tr('anim_shadowsim_tu')}`],
        [tr('anim_shadowsim_gamma'), nombre(rj.g.gamma, 4)],
        [tr('anim_eclipsetable_grandeur'), nombre(rj.e[5], 3)],
        [tr('anim_eclipsetable_duree'), format_duree(rj.e[6])],
      );
    } else if (this.c_reel.isChecked()) {
      const e = astro.eclipse_de_lune();
      out.push(
        [tr('anim_shadowsim_rayon_ombre'), `${nombre(e.rayon_ombre_km!, 0)} km (${nombre(e.ombre_en_diametres_lunaires!, 2)} × ${tr('anim_shadowsim_diam_lune')})`],
        [tr('anim_shadowsim_longueur_ombre'), `${nombre(e.longueur_ombre_km!, 0)} km`],
        [tr('anim_shadowsim_totalite'), duree_hm(e.totalite_h!)],
        [tr('anim_shadowsim_phase_ombre'), duree_hm(e.ombre_totale_h!)],
      );
    }
    return out;
  }

  // ------------------------------------------------------------ dessin
  override dessiner(p: Peintre, rect: Rect): void {
    const rj = this.rejeu();
    const encart = this.c_reel.isChecked() || rj !== null;
    // l'éclipse rejouée, vue de face, a besoin d'un peu plus de place que l'encart d'Aristarque
    const haut = new Rect(rect.x, rect.y, rect.w, rect.h * (rj ? 0.6 : encart ? 0.7 : 1.0));
    const avec3d = this.c_3d.isChecked();
    const large = haut.w > haut.h * 1.25;
    let cote = haut,
      r3d: Rect | null = null;
    if (avec3d) {
      if (large) {
        cote = new Rect(haut.x, haut.y, haut.w * 0.62, haut.h);
        r3d = new Rect(haut.x + haut.w * 0.62, haut.y, haut.w * 0.38, haut.h);
      } else {
        cote = new Rect(haut.x, haut.y, haut.w, haut.h * 0.58);
        r3d = new Rect(haut.x, haut.y + haut.h * 0.58, haut.w, haut.h * 0.42);
      }
    }
    this.vueDeCote(p, cote);
    if (r3d) this.vueOrbite(p, r3d);
    const bas = new Rect(rect.x, haut.bottom, rect.w, rect.h - haut.h);
    if (rj) this.rejouerEclipse(p, bas, rj);
    else if (encart) this.aristarque(p, bas);
  }

  /** Vue de côté : Soleil à gauche (hors échelle), Terre, Lune et leurs cônes en vraie géométrie (deux échelles). */
  private vueDeCote(p: Peintre, r0: Rect): void {
    const r = dessin.cadre(p, r0, tr('anim_shadowsim_titre_cote'));
    this.cote = r;
    // 384 400 km = 30 % de la largeur ; en travers, AGRANDISSEMENT fois plus grand (Terre de 0,03 × largeur de rayon)
    const kx = G.D_LUNE_KM / (r.w * 0.3);
    this.echelle = [kx, kx / AGRANDISSEMENT];
    const e = this.ecran(r);
    const t = this.etat();
    const ds = this.rejeu()?.g.s_km ?? G.UA_KM;
    p.save();
    p.setClipRect(r);
    // le Soleil, très loin à gauche : un bord de disque et des rayons parallèles
    const rs = r.h * 0.9;
    dessin.disque(p, r.x - rs + 16, r.cy, rs, 'soleil');
    p.setPen(dessin.stylo('soleil', 0.8, 0.25));
    for (let k = -3; k <= 3; k++) p.drawLine(r.x + 20, r.cy + (k * r.h) / 8, r.right, r.cy + (k * r.h) / 8);
    // cônes : la pénombre, puis l'ombre et l'antombre, de la Terre puis de la Lune (axes parallèles à Soleil–Terre)
    const cone = (ox: number, oy: number, rkm: number, d_sm: number, couleur_ombre: string): void => {
      const ku = (G.R_SOLEIL_KM - rkm) / d_sm,
        kp = (G.R_SOLEIL_KM + rkm) / d_sm;
      const fin = r.right - ox;
      if (fin <= 0) return;
      const xkm = fin * e.kx;
      const rp_fin = (rkm + xkm * kp) / e.ky;
      p.setPen(dessin.stylo('grille', 0.8, 0.5));
      p.setBrush(dessin.c('penombre', 0.2));
      p.drawPolygon([new Pt(ox, oy - rkm / e.ky), new Pt(r.right, oy - rp_fin), new Pt(r.right, oy + rp_fin), new Pt(ox, oy + rkm / e.ky)]);
      const longueur = rkm / ku / e.kx; // pointe de l'ombre (px)
      p.setBrush(dessin.c(couleur_ombre, 0.85));
      if (longueur < fin) {
        p.drawPolygon([new Pt(ox, oy - rkm / e.ky), new Pt(ox + longueur, oy), new Pt(ox, oy + rkm / e.ky)]);
        // antombre : au-delà de la pointe
        const ra = ((fin - longueur) * e.kx * ku) / e.ky;
        p.setPen(dessin.stylo('accent1', 1.1, 0.85, true));
        p.setBrush(dessin.c('accent1', 0.12));
        p.drawPolygon([new Pt(ox + longueur, oy), new Pt(r.right, oy - ra), new Pt(r.right, oy + ra)]);
      } else {
        const ru_fin = (rkm - xkm * ku) / e.ky;
        p.drawPolygon([new Pt(ox, oy - rkm / e.ky), new Pt(r.right, oy - ru_fin), new Pt(r.right, oy + ru_fin), new Pt(ox, oy + rkm / e.ky)]);
      }
    };
    cone(e.ex, e.ey, G.R_TERRE_KM * G.ATMOSPHERE, ds, 'umbra');
    cone(e.lx, e.ly, G.R_LUNE_KM, ds + this.lune[0], 'umbra');
    p.setPen(dessin.stylo('doux', 0.8, 0.6, true));
    p.drawLine(r.x + 16, e.ey, r.right, e.ey);
    dessin.disque(p, e.ex, e.ey, e.rt, 'terre', 'texte');
    const horsPlan = Math.abs(this.lune[2]) > G.R_TERRE_KM;
    dessin.disque(p, e.lx, e.ly, Math.max(2.5, e.rl), 'lune', horsPlan ? null : 'texte', horsPlan ? 0.45 : null);
    p.restore();
    dessin.texte(p, e.ex, e.ey - e.rt - 10, tr('anim_shadowsim_terre'), 'texte', { fond: true });
    dessin.texte(p, e.lx, e.ly - Math.max(e.rl, 4) - 10, tr('anim_shadowsim_lune'), 'texte', { fond: true });
    dessin.police(p, 0.8);
    dessin.texte(p, r.x + 22, r.y + 12, tr('anim_shadowsim_soleil_loin'), 'doux', { centre: false, fond: true });
    const etiquette = t.soleil.type !== 'aucune' ? tr('anim_shadowsim_solaire') + ' : ' + tr('anim_shadowsim_' + t.soleil.type) : t.lune.type !== 'aucune' ? tr('anim_shadowsim_lunaire') + ' : ' + tr('anim_shadowsim_' + t.lune.type) : '';
    if (etiquette) dessin.texte(p, r.right - 8 - p.fontMetrics().horizontalAdvance(etiquette), r.y + 12, etiquette, 'accent3', { centre: false, fond: true });
    dessin.police(p, 1 / 0.8);
  }

  /** Vue 3D : plan Terre–Soleil, orbite inclinée de la Lune, ligne des nœuds, Lune au-dessus ou au-dessous de l'axe. */
  private vueOrbite(p: Peintre, r0: Rect): void {
    const r = dessin.cadre(p, r0, tr('anim_shadowsim_titre_3d'));
    this.zone_rotative(r, this.vue3d);
    const v = this.vue3d;
    const R = Math.min(r.w * 0.42, r.h * 0.4);
    const cx = r.cx,
      cy = r.cy + r.h * 0.04;
    // monde : x vers l'opposé du Soleil, y = est (hors du plan de la vue de côté), z = nord
    const proj = (x: number, y: number, z: number): [number, number, number] => {
      const q = v.projeter1([x, y, z]);
      return [cx + q[0] * R, cy - q[1] * R, q[2]];
    };
    const ligne = (pts: [number, number, number][], stylo: Stylo, ferme = false): void => {
      p.setPen(stylo);
      p.setBrush(null);
      const ecran = pts.map(([x, y, z]) => {
        const q = proj(x, y, z);
        return new Pt(q[0], q[1]);
      });
      if (ferme) p.drawPolygon(ecran);
      else p.drawPolyline(ecran);
    };
    const N = 96;
    const cercle = (rayon: number, f: (a: number) => [number, number, number]): [number, number, number][] => Array.from({ length: N + 1 }, (_, k) => f((2 * Math.PI * k) / N)).map(([x, y, z]) => [x * rayon, y * rayon, z * rayon]);
    p.save();
    p.setClipRect(r);
    // plan Terre–Soleil (écliptique) : disque teinté et cercle
    const plan = cercle(1.18, (a) => [Math.cos(a), Math.sin(a), 0]);
    p.setPen(dessin.stylo('grille', 0.8, 0.6));
    p.setBrush(dessin.c('ecliptique', 0.07));
    p.drawPolygon(plan.map(([x, y, z]) => new Pt(...(proj(x, y, z).slice(0, 2) as [number, number]))));
    // axe Soleil–Terre, Soleil à l'infini (flèche « vers le Soleil »)
    ligne([[-1.35, 0, 0], [1.35, 0, 0]], dessin.stylo('soleil', 1.0, 0.7, true));
    const s0 = proj(-1.3, 0, 0),
      s1 = proj(-1.05, 0, 0);
    dessin.fleche(p, s1[0], s1[1], s0[0], s0[1], dessin.stylo('soleil', 1.4), 7);
    dessin.texte(p, s0[0], s0[1] - 12, tr('anim_shadowsim_vers_soleil'), 'soleil', { fond: true });
    // orbite de la Lune : inclinée de i autour de la ligne des nœuds (angle Ω depuis la direction du Soleil)
    const rj = this.rejeu();
    const om = (rj ? 0 : this.noeuds.value()) * DEG;
    const inc = INCLINAISON_LUNE * DEG;
    // nœud ascendant n (dans le plan), direction du mouvement m (inclinée de i vers le nord) : même convention que
    // positionOrbite (angle compté depuis la direction du Soleil)
    const n: [number, number, number] = [-Math.cos(om), Math.sin(om), 0];
    const m: [number, number, number] = [Math.sin(om) * Math.cos(inc), Math.cos(om) * Math.cos(inc), Math.sin(inc)];
    const orb = cercle(1, (a) => [n[0] * Math.cos(a) + m[0] * Math.sin(a), n[1] * Math.cos(a) + m[1] * Math.sin(a), n[2] * Math.cos(a) + m[2] * Math.sin(a)]);
    if (!rj) ligne(orb, dessin.stylo('lune', 1.3, 0.85));
    // ligne des nœuds
    ligne([[n[0] * 1.12, n[1] * 1.12, 0], [-n[0] * 1.12, -n[1] * 1.12, 0]], dessin.stylo('meridien', 1.0, 0.9, true));
    const na = proj(n[0] * 1.12, n[1] * 1.12, 0);
    dessin.police(p, 0.8);
    dessin.texte(p, na[0], na[1] + 12, tr('anim_shadowsim_noeud_asc'), 'meridien', { fond: true });
    dessin.police(p, 1 / 0.8);
    // Terre
    const t0 = proj(0, 0, 0);
    dessin.disque(p, t0[0], t0[1], Math.max(5, R * 0.07), 'terre', 'texte');
    // Lune : position réelle ramenée au rayon de l'orbite dessinée
    const d = Math.hypot(...this.lune) || 1;
    const [lx, ly, lz] = [this.lune[0] / d, this.lune[2] / d, this.lune[1] / d];
    const l3 = proj(lx, ly, lz),
      l0 = proj(lx, ly, 0);
    p.setPen(dessin.stylo(lz >= 0 ? 'accent2' : 'accent3', 1.4));
    p.drawLine(l0[0], l0[1], l3[0], l3[1]);
    dessin.disque(p, l3[0], l3[1], Math.max(3.5, R * 0.035), 'lune', 'texte');
    p.restore();
    const ec = Math.abs(this.lune[1]) / G.R_TERRE_KM;
    dessin.police(p, 0.85);
    dessin.texte(p, r.x + 8, r.bottom - 26, tr('anim_shadowsim_orbite_lune'), 'lune', { centre: false });
    dessin.texte(p, r.x + 8, r.bottom - 10, tr('anim_shadowsim_decalage_3d', { r: nombre(ec, 2), dir: this.lune[1] >= 0 ? tr('anim_shadowsim_nord') : tr('anim_shadowsim_sud') }), 'texte', { centre: false });
    dessin.police(p, 1 / 0.85);
  }

  /** L'éclipse choisie, vue de face (plan fondamental, vraie géométrie DE440) ; l'instant fait avancer la Lune. */
  private rejouerEclipse(p: Peintre, r0: Rect, rj: Rejeu): void {
    const r = dessin.cadre(p, r0, tr(rj.solaire ? 'anim_shadowsim_titre_soleil' : 'anim_shadowsim_titre_lune', { date: date_eclipse(rj.e) }));
    const RL = G.R_LUNE_KM,
      RT = G.R_TERRE_KM;
    const [x0, y0] = [lune_rejeu(rj, -1), lune_rejeu(rj, 1)];
    const t = this.etat();
    const rp = rj.solaire ? t.soleil.penombre_km : t.lune.penombre_km;
    const portee = Math.max(Math.abs(x0[2]), Math.abs(y0[2]), Math.abs(x0[1]), Math.abs(y0[1])) + Math.max(rp + RL, RT) * 1.05;
    const k = Math.min(r.w / (2 * portee), r.h / (2 * (Math.max(Math.abs(x0[1]), Math.abs(y0[1])) + Math.max(rp + RL, RT) * 1.1)));
    const cx = r.cx,
      cy = r.cy;
    // carte (Soleil) : est à droite ; ciel (Lune) : est à gauche, comme vu de la Terre
    const sens = rj.solaire ? 1 : -1;
    const pos = (u: number): Pt => {
      const q = lune_rejeu(rj, u);
      return new Pt(cx + sens * q[2] * k, cy - q[1] * k);
    };
    const u = this.instant.value();
    p.save();
    p.setClipRect(r);
    p.setPen(dessin.stylo('doux', 1.0, 0.7, true));
    p.drawLineP(pos(-1), pos(1));
    dessin.fleche(p, pos(0.82).x, pos(0.82).y, pos(1).x, pos(1).y, dessin.stylo('doux', 1.2, 0.8), 7);
    if (!rj.solaire) {
      dessin.disque(p, cx, cy, t.lune.penombre_km * k, 'penombre', null, 0.25);
      dessin.disque(p, cx, cy, t.lune.ombre_km * k, 'umbra', null, 0.88);
      for (const v of [-1, 1]) {
        const q = pos(v);
        p.setPen(dessin.stylo('lune', 1.0, 0.5));
        p.setBrush(null);
        p.drawEllipse(q.x, q.y, RL * k, RL * k);
      }
      const q = pos(u);
      dessin.disque(p, q.x, q.y, RL * k, 'lune', 'texte');
      p.save();
      const ch = new Path2D();
      ch.ellipse(q.x, q.y, RL * k, RL * k, 0, 0, 2 * Math.PI);
      p.setClipPath(ch);
      dessin.disque(p, cx, cy, t.lune.ombre_km * k, 'arc2', null, 0.55);
      p.restore();
    } else {
      dessin.disque(p, cx, cy, RT * k, 'terre', 'texte');
      const q = pos(u);
      p.save();
      const ch = new Path2D();
      ch.ellipse(cx, cy, RT * k, RT * k, 0, 0, 2 * Math.PI);
      p.setClipPath(ch);
      dessin.disque(p, q.x, q.y, t.soleil.penombre_km * k, 'umbra', null, 0.35);
      if (t.soleil.ombre_surface_km > 0) dessin.disque(p, q.x, q.y, Math.max(2.5, t.soleil.ombre_surface_km * k), 'umbra', null, 0.95);
      p.restore();
      p.setPen(dessin.stylo('penombre', 1.0, 0.8, true));
      p.setBrush(null);
      p.drawEllipse(q.x, q.y, t.soleil.penombre_km * k, t.soleil.penombre_km * k);
      if (t.soleil.ombre_surface_km < 0) {
        p.setPen(dessin.stylo('accent1', 1.4));
        p.drawEllipse(q.x, q.y, Math.max(3, -t.soleil.ombre_surface_km * k), Math.max(3, -t.soleil.ombre_surface_km * k));
      }
    }
    p.restore();
    dessin.police(p, 0.85);
    dessin.texte(p, r.left + 4, r.bottom - 4, tr('anim_shadowsim_note'), 'doux', { centre: false });
    dessin.texte(p, r.right - 14, r.top + 12, tr('anim_pc_n') + ' ↑', 'doux');
    dessin.police(p, 1 / 0.85);
  }

  /** Traversée centrale de l'ombre de la Terre par la Lune, proportions réelles. */
  private aristarque(p: Peintre, r0: Rect): void {
    const r = dessin.cadre(p, r0, tr('anim_shadowsim_titre_reel'));
    const e = astro.eclipse_de_lune();
    const rp = e.rayon_penombre_km!,
      ru = e.rayon_ombre_km!;
    const k = Math.min((r.h * 0.42) / rp, (r.w * 0.2) / rp);
    const cx = r.x + r.w * 0.35,
      cy = r.cy;
    dessin.disque(p, cx, cy, rp * k, 'penombre', null, 0.25);
    dessin.disque(p, cx, cy, ru * k, 'umbra', null, 0.9);
    const rl = astro.R_LUNE_KM * k;
    for (const dx of [-(ru + astro.R_LUNE_KM), -(ru - astro.R_LUNE_KM), 0.0, ru - astro.R_LUNE_KM, ru + astro.R_LUNE_KM]) {
      p.setPen(dessin.stylo('lune', 1.2));
      p.setBrush(dessin.c('lune', 0.15));
      p.drawEllipse(cx + dx * k, cy, rl, rl);
    }
    const x = r.x + r.w * 0.62;
    dessin.texte(p, x, r.y + 14, tr('anim_shadowsim_rapport', { x: nombre(e.ombre_en_diametres_lunaires!, 2) }), 'texte', { centre: false });
    dessin.texte(p, x, r.y + 34, tr('anim_shadowsim_duree_tot', { d: duree_hm(e.totalite_h!) }), 'texte', { centre: false });
  }
}
