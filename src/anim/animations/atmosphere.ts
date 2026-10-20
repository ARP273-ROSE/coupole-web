/**
 * L'atmosphère terrestre : épaisseur traversée, absorption et réfraction (propre à Coupole ; même animation que
 * coupole/modules/anim/animations/atmosphere.py).  Quatre vues : épaisseur traversée (masse d'air), extinction et
 * rougissement, fenêtres atmosphériques (modèle de ciel de l'ESO de 0,3 à 30 µm, schéma ailleurs), réfraction
 * (rayon courbé, hauteur apparente, Soleil aplati, lever avancé, dispersion).
 */
import * as A from '../../calc/atmosphere';
import * as lumiere from '../../calc/lumiere';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { Couleur, type Peintre, Rect } from '../../noyau/peintre';
import { angle, Animation, type Choix, type Coche, nombre, type Reglage } from '../base';

const VUES = ['epaisseur', 'extinction', 'fenetres', 'refraction'];
const COULEURS_BANDES: Record<string, string> = { U: 'arc1', B: 'accent2', V: 'horizon', R: 'accent3', I: 'doux' };
const arcmin = (deg: number): string => `${nombre(deg * 60, 1)}′`;

export class Atmosphere extends Animation {
  static override ID = 'earthatmosphere';
  static override ANIMEE = false;

  vue_c!: Choix;
  h!: Reglage;
  pression!: Reglage;
  temperature!: Reglage;
  beta!: Reglage;
  latitude!: Reglage;
  exagerer!: Coche;
  private couche_y = 0;

  override construire(): void {
    this.vue_c = this.choix('vue', VUES.map((v) => ['anim_earthatmosphere_v_' + v, v] as [string, string]), 'epaisseur');
    this.h = this.curseur('hauteur', -1.0, 90.0, 20.0, { dec: 1, unite: '°' });
    this.pression = this.curseur('pression', 500.0, 1050.0, 1010.0, { dec: 0, unite: 'hPa' });
    this.temperature = this.curseur('temperature', -30.0, 40.0, 10.0, { dec: 0, unite: '°C' });
    this.beta = this.curseur('aerosols', 0.0, 0.3, 0.05, { dec: 2 });
    this.latitude = this.curseur('latitude', 0.0, 65.0, 48.8, { dec: 1, unite: '°' });
    this.exagerer = this.coche('exagerer', false);
  }

  override valeurs(): [string, string][] {
    const h = this.h.value();
    const P = this.pression.value();
    const T = this.temperature.value();
    const v = this.vue_c.currentData();
    const hv = Math.max(h, 0.0);
    const X = A.masse_air_kasten_young(hv);
    const out: [string, string][] = [
      [tr('anim_earthatmosphere_val_x_secz'), hv >= 1 ? nombre(A.masse_air_secz(hv), 3) : '—'],
      [tr('anim_earthatmosphere_val_x_ky'), nombre(X, 3)],
      [tr('anim_earthatmosphere_val_x_pickering'), nombre(A.masse_air_pickering(hv), 3)],
      [tr('anim_earthatmosphere_val_chemin'), `${nombre(A.chemin_sphere_km(hv), 1)} km`],
    ];
    if (v === 'extinction' || v === 'fenetres') {
      for (const b of ['B', 'V']) {
        const k = A.k_bande(A.BANDES[b]!, P, this.beta.value());
        out.push([tr('anim_earthatmosphere_val_dm', { b }), `${nombre(k * X, 2)} mag (k = ${nombre(k, 3)})`]);
      }
    }
    if (v === 'refraction' || v === 'epaisseur') {
      const r = A.refraction_vraie(h, P, T);
      out.push([tr('anim_earthatmosphere_val_refraction'), arcmin(r)]);
      out.push([tr('anim_earthatmosphere_val_apparente'), angle(h + r)]);
    }
    if (v === 'refraction') {
      const ap = A.aplatissement(0.0, 0.2666, P, T);
      out.push([tr('anim_earthatmosphere_val_aplatissement'), nombre(ap.rapport, 3)]);
      out.push([tr('anim_earthatmosphere_val_avance'), `${nombre(A.avance_lever_min(this.latitude.value()), 1)} min`]);
      const d = (A.refraction_lambda(h, 0.45, P, T) - A.refraction_lambda(h, 0.65, P, T)) * 3600;
      out.push([tr('anim_earthatmosphere_val_dispersion'), `${nombre(d, 2)}″`]);
    }
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const v = this.vue_c.currentData();
    if (v === 'extinction') this.extinction(p, rect);
    else if (v === 'fenetres') this.fenetres(p, rect);
    else if (v === 'refraction') this.refraction(p, rect);
    else this.epaisseur(p, rect);
  }

  private epaisseur(p: Peintre, rect: Rect): void {
    const haut = new Rect(rect.x, rect.y, rect.w, rect.h * 0.62);
    const bas = new Rect(rect.x, haut.bottom, rect.w, rect.h - haut.h);
    const r = dessin.cadre(p, haut, tr('anim_earthatmosphere_t_coupe'));
    const h = Math.max(this.h.value(), 0.0);
    const agr = 25.0;
    const R = A.R_TERRE_KM;
    const Ld = A.chemin_sphere_km(0.0, A.H_ECHELLE_KM * agr);
    const k = Math.min((r.w * 0.47) / Ld, (r.h * 0.8) / (A.H_ECHELLE_KM * agr * 2.4));
    const ox = r.cx;
    const oy = r.bottom - 18;
    const cy = oy + R * k;
    p.save();
    p.setClipRect(r);
    const couches: [string, number, string][] = [['anim_earthatmosphere_c_meso', 85.0, 'nuit'], ['anim_earthatmosphere_c_strato', 50.0, 'arc1'], ['anim_earthatmosphere_c_tropo', 12.0, 'accent2']];
    for (const [, z, couleur] of couches) {
      const zz = (z / 85.0) * A.H_ECHELLE_KM * agr * 2.2;
      p.setPen(dessin.stylo('doux', 0.8, 0.6));
      p.setBrush(dessin.c(couleur, 0.1));
      const rr = (R + zz) * k;
      p.drawEllipse(ox, cy, rr, rr);
    }
    p.setPen(dessin.stylo('accent3', 1.4, null, true));
    p.setBrush(null);
    const rh = (R + A.H_ECHELLE_KM * agr) * k;
    p.drawEllipse(ox, cy, rh, rh);
    this.couche_y = cy - rh;
    p.setPen(dessin.stylo('horizon', 1.5));
    p.setBrush(dessin.c('horizon', 0.35));
    p.drawEllipse(ox, cy, R * k, R * k);
    const L = A.chemin_sphere_km(h, A.H_ECHELLE_KM * agr);
    const a = h * (Math.PI / 180);
    const ex = ox - L * k * Math.cos(a);
    const ey = oy - L * k * Math.sin(a);
    p.setPen(dessin.stylo('soleil', 3.0));
    p.drawLine(ex, ey, ox, oy);
    p.setPen(dessin.stylo('soleil', 1.2, 0.6, true));
    p.drawLine(ex, ey, ex - 60 * Math.cos(a), ey - 60 * Math.sin(a));
    p.restore();
    dessin.disque(p, ox, oy, 4, 'texte');
    dessin.etiquette(p, (ex + ox) / 2, (ey + oy) / 2, tr('anim_earthatmosphere_e_trajet', { l: nombre(A.chemin_sphere_km(h), 0), x: nombre(A.masse_air_sphere(h), 2) }), 'soleil');
    for (const [cle, z] of couches) {
      const zz = (z / 85.0) * A.H_ECHELLE_KM * agr * 2.2;
      dessin.etiquette(p, r.left + 70, oy - zz * k, tr(cle), 'doux');
    }
    dessin.etiquette(p, r.right - 160, this.couche_y + 6, tr('anim_earthatmosphere_e_couche'), 'accent3');
    dessin.police(p, 0.8);
    dessin.texte(p, r.right - 150, r.top + 16, tr('anim_earthatmosphere_e_agrandie', { k: Math.trunc(agr) }), 'doux');
    dessin.police(p, 1 / 0.8);
    const r2 = dessin.cadre(p, bas, tr('anim_earthatmosphere_t_masse'));
    const ax = new Axes(r2, 0.0, 90.0, 0.0, 40.0, false, false, [40, 6, 12, 22]).avec(p);
    ax.fond(p, { titre_x: `${tr('anim_earthatmosphere_hauteur')} (°)`, titre_y: 'X', n_x: 9, n_y: 4 });
    const hs = Array.from({ length: 360 }, (_, i) => (i + 1) * 0.25);
    const fns: [(x: number) => number, string, number][] = [[A.masse_air_secz, 'doux', 1.2], [A.masse_air_kasten_young, 'accent1', 2.2], [A.masse_air_pickering, 'accent2', 1.4], [(x) => A.masse_air_sphere(x), 'accent3', 1.4]];
    for (const [f, cle, ep] of fns) ax.courbe(hs.map((x) => [x, Math.min(40.0, f(x))] as [number, number]), cle, ep);
    ax.verticale(h, 'soleil', 1.2, true, `X = ${nombre(A.masse_air_kasten_young(h), 2)}`);
    dessin.police(p, 0.8);
    let y = r2.top + 14;
    for (const [cle, nom] of [['doux', 'sec z'], ['accent1', 'Kasten & Young'], ['accent2', 'Pickering'], ['accent3', tr('anim_earthatmosphere_sphere')]] as [string, string][]) {
      dessin.texte(p, ax.r.right - 70, y, nom, cle);
      y += 14;
    }
    dessin.police(p, 1 / 0.8);
  }

  private extinction(p: Peintre, rect: Rect): void {
    const P = this.pression.value();
    const beta = this.beta.value();
    const h = Math.max(this.h.value(), 0.0);
    const X = A.masse_air_kasten_young(h);
    const gauche = new Rect(rect.x, rect.y, rect.w * 0.66, rect.h);
    const droite = new Rect(gauche.right, rect.y, rect.w - gauche.w, rect.h);
    const r = dessin.cadre(p, gauche, tr('anim_earthatmosphere_t_tau'));
    const ax = new Axes(r, 0.3, 1.0, 0.0, 1.2, false, false, [40, 6, 12, 22]).avec(p);
    ax.bande_visible(0.15, 380.0, 750.0, 0.001);
    ax.fond(p, { titre_x: 'λ (µm)', titre_y: 'τ', n_x: 7, n_y: 4 });
    const ls = Array.from({ length: 141 }, (_, i) => 0.3 + i * 0.005);
    ax.courbe(ls.map((l) => [l, A.tau_rayleigh(l, P)] as [number, number]), 'accent2', 1.4);
    ax.courbe(ls.map((l) => [l, A.tau_aerosols(l, beta)] as [number, number]), 'doux', 1.4);
    ax.courbe(ls.map((l) => [l, A.tau_ozone(l)] as [number, number]), 'arc1', 1.4);
    ax.courbe(ls.map((l) => [l, A.tau_total(l, P, beta)] as [number, number]), 'accent1', 2.4);
    for (const [b, l] of Object.entries(A.BANDES)) ax.verticale(l, COULEURS_BANDES[b]!, 1.2, true, `${b} : k = ${nombre(A.k_bande(l, P, beta), 2)}`);
    dessin.police(p, 0.8);
    let yy = r.top + 14;
    for (const [cle, nom] of [['accent1', tr('anim_earthatmosphere_total')], ['accent2', 'Rayleigh ∝ λ⁻⁴'], ['doux', tr('anim_earthatmosphere_aerosols')], ['arc1', tr('anim_earthatmosphere_ozone')]] as [string, string][]) {
      dessin.texte(p, ax.r.right - 90, yy, nom, cle);
      yy += 14;
    }
    dessin.police(p, 1 / 0.8);
    const r2 = dessin.cadre(p, droite, tr('anim_earthatmosphere_t_soleil'));
    const flux = (w: number): number => lumiere.valeur('soleil', w, 'v') * Math.exp(-X * A.tau_total(w / 1000.0, P, beta));
    const y0 = lumiere.xyz((w) => lumiere.valeur('soleil', w, 'v'))[1];
    const [x, y, z] = lumiere.xyz(flux);
    const rgb = lumiere.rgb_de_xyz(x / Math.max(y, 1e-12), 1.0, z / Math.max(y, 1e-12));
    const cx = r2.cx;
    const cyy = r2.top + r2.h * 0.38;
    const rr = Math.min(r2.w, r2.h) * 0.22;
    p.setPen(dessin.stylo('doux', 1.0));
    p.setBrush(new Couleur(rgb[0]!, rgb[1]!, rgb[2]!));
    p.drawEllipse(cx, cyy, rr, rr);
    dessin.etiquette(p, cx, cyy + rr + 14, tr('anim_earthatmosphere_e_transmis', { t: nombre((100 * y) / y0, 0), x: nombre(X, 2) }), 'texte');
    dessin.etiquette(p, cx, r2.bottom - 22, tr('anim_earthatmosphere_e_rougit'), 'doux');
  }

  private fenetres(p: Peintre, rect: Rect): void {
    const d = A.transmission_eso();
    const haut = new Rect(rect.x, rect.y, rect.w, rect.h * 0.42);
    const bas = new Rect(rect.x, haut.bottom, rect.w, rect.h - haut.h);
    const r = dessin.cadre(p, haut, tr('anim_earthatmosphere_t_fenetres'));
    const ax = new Axes(r, 1e-6, 1e9, 0.0, 1.05, true, false, [40, 8, 30, 22]).avec(p);
    ax.fond(p, { titre_x: 'λ (µm)', titre_y: '', n_y: 2 });
    dessin.police(p, 0.75);
    for (const [cle, a, b, tt] of A.DOMAINES) {
      ax.remplir([[a, tt], [b, tt]], 'doux', 0.35);
      dessin.etiquette(p, ax.px(Math.sqrt(a * b)), ax.r.top + 12, tr('anim_earthatmosphere_d_' + cle), 'doux');
    }
    dessin.police(p, 1 / 0.75);
    const pts = d.lambda_um.map((l, i) => [l, d.total[i]!] as [number, number]);
    ax.remplir(pts, 'accent1', 0.5);
    ax.bande_visible(0.25, 380.0, 750.0, 0.001);
    dessin.etiquette(p, ax.px(3e5), ax.py(0.5), tr('anim_earthatmosphere_e_radio'), 'texte');
    dessin.etiquette(p, ax.px(1e-3), ax.py(0.5), tr('anim_earthatmosphere_e_espace'), 'texte');
    const r2 = dessin.cadre(p, bas, tr('anim_earthatmosphere_t_fenetres_zoom'));
    const ax2 = new Axes(r2, 0.3, 30.0, 0.0, 1.05, true, false, [40, 8, 30, 22]).avec(p);
    ax2.bande_visible(0.18, 380.0, 750.0, 0.001);
    ax2.fond(p, { titre_x: 'λ (µm)', titre_y: tr('anim_earthatmosphere_transmission'), n_y: 4 });
    const X = A.masse_air_kasten_young(Math.max(this.h.value(), 0.0));
    ax2.remplir(pts, 'accent1', 0.3);
    ax2.courbe(pts, 'accent1', 1.2);
    ax2.courbe(pts.map(([l, tt]) => [l, tt ** X] as [number, number]), 'accent3', 1.0);
    for (const [nom, l] of [['U', 0.36], ['V', 0.55], ['I', 0.8], ['J', 1.25], ['H', 1.65], ['K', 2.2], ['L', 3.5], ['M', 4.8], ['N', 10.0], ['Q', 20.0]] as [string, number][]) ax2.verticale(l, 'horizon', 0.8, true, nom);
    for (const [nom, l] of [['H₂O', 1.4], ['H₂O', 1.9], ['H₂O', 6.3], ['CO₂', 15.0], ['O₃', 9.6], ['CO₂', 4.3]] as [string, number][]) dessin.etiquette(p, ax2.px(l), ax2.py(0.06), nom, 'accent2');
    dessin.police(p, 0.75);
    dessin.texte(p, ax2.r.right - 120, ax2.r.top + 28, tr('anim_earthatmosphere_e_x', { x: nombre(X, 2) }), 'accent3');
    dessin.texte(p, r2.cx, r2.bottom - 6, tr('anim_earthatmosphere_source_eso'), 'doux');
    dessin.police(p, 1 / 0.75);
  }

  private refraction(p: Peintre, rect: Rect): void {
    const P = this.pression.value();
    const T = this.temperature.value();
    const h = this.h.value();
    const gauche = new Rect(rect.x, rect.y, rect.w * 0.5, rect.h);
    const droite = new Rect(gauche.right, rect.y, rect.w - gauche.w, rect.h);
    const r = dessin.cadre(p, new Rect(gauche.x, gauche.y, gauche.w, gauche.h * 0.55), tr('anim_earthatmosphere_t_rayon'));
    const n_couches = 12;
    const ex = this.exagerer.isChecked() ? 40.0 : 1.0;
    const ox = r.left + 30;
    const oy = r.bottom - 16;
    const hauteur = r.h - 40;
    for (let i = 0; i < n_couches; i++) {
      const y = oy - (hauteur * (i + 1)) / n_couches;
      p.setPen(dessin.stylo('doux', 0.6, 0.4));
      p.drawLine(r.left + 4, y, r.right - 4, y);
      p.fillRect(new Rect(r.left + 4, y, r.w - 8, hauteur / n_couches), dessin.c('accent2', 0.25 * Math.exp(-i / 4.0)));
    }
    const R_tot = A.refraction_vraie(h, P, T) * ex;
    let ang = h + R_tot;
    const xs = [0.0];
    const ys = [0.0];
    for (let i = 0; i < n_couches; i++) {
      const part = (Math.exp(-i / 4.0) - Math.exp(-(i + 1) / 4.0)) / (1 - Math.exp(-n_couches / 4.0));
      ang -= R_tot * part;
      const a = Math.max(ang, 0.2) * (Math.PI / 180);
      xs.push(xs[xs.length - 1]! + hauteur / n_couches / Math.tan(a));
      ys.push(ys[ys.length - 1]! + hauteur / n_couches);
    }
    const kx = Math.min(1.0, (r.right - 12 - ox) / Math.max(xs[xs.length - 1]!, 1e-9));
    const chemin = new Path2D();
    chemin.moveTo(ox, oy);
    for (let i = 1; i < xs.length; i++) chemin.lineTo(ox + kx * xs[i]!, oy - ys[i]!);
    p.save();
    p.setClipRect(r);
    p.setPen(dessin.stylo('soleil', 2.2));
    p.setBrush(null);
    p.drawPath(chemin);
    const a0 = Math.max(h + R_tot, 0.2) * (Math.PI / 180);
    p.setPen(dessin.stylo('accent1', 1.2, null, true));
    const L0 = (1.2 * hauteur) / Math.tan(a0);
    p.drawLine(ox, oy, ox + kx * L0, oy - 1.2 * hauteur);
    p.restore();
    if (kx < 0.999) dessin.etiquette(p, r.cx, r.bottom - 6, tr('anim_earthatmosphere_e_comprime', { k: nombre(1 / kx, 0) }), 'doux');
    dessin.disque(p, ox, oy, 4, 'texte');
    dessin.etiquette(p, ox + 60, oy - 18, tr('anim_earthatmosphere_e_apparente'), 'accent1');
    if (this.exagerer.isChecked()) dessin.etiquette(p, r.right - 90, r.top + 14, tr('anim_earthatmosphere_e_exagere'), 'doux');
    const r2 = dessin.cadre(p, new Rect(gauche.x, gauche.y + gauche.h * 0.55, gauche.w, gauche.h * 0.45), tr('anim_earthatmosphere_t_refraction'));
    const ax = new Axes(r2, -1.0, 45.0, 0.0, 40.0, false, false, [40, 6, 12, 22]).avec(p);
    ax.fond(p, { titre_x: `${tr('anim_earthatmosphere_hauteur')} (°)`, titre_y: '′', n_x: 9, n_y: 4 });
    const hs = Array.from({ length: 185 }, (_, i) => -1.0 + i * 0.25);
    ax.courbe(hs.map((x) => [x, 60 * A.refraction_vraie(x, P, T)] as [number, number]), 'accent1', 2.0);
    ax.verticale(h, 'soleil', 1.2, true, arcmin(A.refraction_vraie(h, P, T)));
    const r3 = dessin.cadre(p, droite, tr('anim_earthatmosphere_t_soleil_couchant'));
    const ap = A.aplatissement(h, 0.2666, P, T);
    const kk = (r3.h * 0.35) / 0.6;
    const cx = r3.cx;
    const yc = Math.min(Math.max(r3.top + r3.h * 0.62 - h * kk, r3.top + r3.h * 0.4), r3.top + r3.h * 0.68);
    const hy = yc + h * kk;
    p.save();
    p.setClipRect(r3);
    if (hy < r3.bottom - 50) {
      p.setPen(dessin.stylo('horizon', 1.5));
      p.drawLine(r3.left + 8, hy, r3.right - 8, hy);
    }
    p.setPen(dessin.stylo('doux', 1.0, null, true));
    p.setBrush(null);
    p.drawEllipse(cx, yc, 0.2666 * kk, 0.2666 * kk);
    const forme = new Path2D();
    for (let i = 0; i < 73; i++) {
      const t = (2 * Math.PI * i) / 72;
      const hv = h + 0.2666 * Math.sin(t);
      const ha = hv + A.refraction_vraie(hv, P, T);
      const x = cx + 0.2666 * kk * Math.cos(t);
      const y = hy - ha * kk;
      if (i === 0) forme.moveTo(x, y);
      else forme.lineTo(x, y);
    }
    p.setPen(dessin.stylo('soleil', 1.5));
    p.setBrush(dessin.c('soleil', 0.8));
    p.drawPath(forme);
    p.restore();
    if (hy >= r3.bottom - 50) dessin.etiquette(p, cx, r3.bottom - 56, tr('anim_earthatmosphere_e_horizon_bas', { h: nombre(h, 1) }), 'doux');
    dessin.etiquette(p, cx, hy - (ap.haut_apparent + 0.05) * kk, tr('anim_earthatmosphere_e_aplati', { r: nombre(ap.rapport, 3) }), 'texte');
    dessin.etiquette(p, cx, yc + 0.35 * kk, tr('anim_earthatmosphere_e_vrai'), 'doux');
    dessin.etiquette(p, cx, r3.bottom - 34, tr('anim_earthatmosphere_e_avance', { t: nombre(A.avance_lever_min(this.latitude.value()), 1), lat: nombre(this.latitude.value(), 0) }), 'texte');
    const dd = [0.45, 0.55, 0.65].map((l) => (A.refraction_lambda(h, l, P, T) - A.refraction_lambda(h, 0.55, P, T)) * 3600);
    const x0 = r3.left + 40;
    const y0 = r3.top + 80;
    const kd = Math.min(6.0, 40.0 / Math.max(Math.abs(dd[0]!), Math.abs(dd[2]!), 1e-9));
    (['accent2', 'horizon', 'accent3'] as const).forEach((cle, i) => dessin.disque(p, x0, y0 - dd[i]! * kd, 4, cle));
    dessin.etiquette(p, x0 + 12, y0, tr('anim_earthatmosphere_e_dispersion', { d: nombre(dd[0]! - dd[2]!, 2) }), 'texte');
  }
}
