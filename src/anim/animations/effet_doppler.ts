/**
 * Doppler Shift Demonstrator : une source émet des ondes (crêtes = cercles qui s'élargissent à la vitesse c de l'onde)
 * en se déplaçant ; l'observateur (qu'on fait glisser) reçoit les crêtes plus serrées quand la source s'approche.  Le
 * signal reçu est calculé exactement par le temps retardé τ : |observateur − source(τ)| = c (t − τ) ; la fréquence
 * reçue vaut f₀ dτ/dt = f₀ / (1 − v_r / c) (ondes dans un milieu au repos, comme le son).
 */
import * as lumiere from '../../calc/lumiere';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { pmod } from '../../noyau/py';
import { Animation, type Bouton_souris, type Coche, nombre, type Reglage } from '../base';

const L = 100.0,
  H = 60.0;
const C_ONDE = 15.0;
const F0 = 1.5;
const A = 36.0;
const FENETRE_S = 6.0;

type Echantillon = [number, number | null, number | null];

export class EffetDoppler extends Animation {
  static override ID = 'dopplershift';
  static override LECTURE_AU_DEPART = true;

  v!: Reglage;
  dir!: Reglage;
  c_emission!: Coche;
  c_trace!: Coche;
  obs: [number, number] = [80.0, 12.0];
  t = 0.0;
  historique: Echantillon[] = [];
  emissions: [number, number | null][] = [];
  private zone: [Rect, number] | null = null;
  private cle: string | undefined = undefined;

  override construire(): void {
    this.v = this.curseur('vitesse', 0.0, 0.9, 0.5, { dec: 2 });
    this.dir = this.curseur('direction', 0.0, 180.0, 0.0, { dec: 0, unite: '°' });
    this.c_emission = this.coche('emission', true);
    this.c_trace = this.coche('trajectoire', false);
    this.obs = [80.0, 12.0];
    this.zone = null;
    this.etat_initial();
  }

  override etat_initial(): void {
    this.t = 0.0;
    this.historique = [];
    this.emissions = this.c_emission.isChecked() ? [[0.0, null]] : [];
  }

  override reglage_change(): void {
    const on = this.c_emission.isChecked();
    const der = this.emissions[this.emissions.length - 1];
    if (der && der[1] === null && !on) this.emissions[this.emissions.length - 1] = [der[0], this.t];
    else if (on && (!der || der[1] !== null)) this.emissions.push([this.t, null]);
    const cle = `${this.v.value()}|${this.dir.value()}`;
    // comme l'original en Python, la première fois compte aussi comme un changement (getattr y rendait la méthode
    // homonyme de la classe de base, jamais égale à la clé) : on repart d'un temps propre
    if (this.cle !== cle) {
      this.t = 0.0;
      this.historique = [];
      this.emissions = on ? [[0.0, null]] : [];
    }
    this.cle = cle;
    super.reglage_change();
  }

  /** Source : va-et-vient à vitesse constante v c le long de la direction choisie, autour du centre. */
  position(t: number): [number, number] {
    const v = this.v.value() * C_ONDE;
    const d = (this.dir.value() * Math.PI) / 180;
    let s: number;
    if (v <= 0) s = 0.0;
    else {
      const u = pmod((v * t) / (4 * A), 1.0);
      s = A * (u < 0.25 ? 4 * u : u < 0.75 ? 2 - 4 * u : 4 * u - 4);
    }
    return [L / 2 + s * Math.cos(d), H / 2 + s * Math.sin(d)];
  }

  vitesse_source(t: number): [number, number] {
    const h = 1e-4;
    const [x0, y0] = this.position(t - h);
    const [x1, y1] = this.position(t + h);
    return [(x1 - x0) / (2 * h), (y1 - y0) / (2 * h)];
  }

  emet(t: number): boolean {
    return this.emissions.some(([a, b]) => a <= t && (b === null || t < b));
  }

  retard(t: number): number {
    return lumiere.temps_retarde(t, (tau) => this.position(tau), this.obs, C_ONDE, -1e6);
  }

  recu(t: number): [number | null, number] {
    const tau = this.retard(t);
    return [this.emet(tau) && tau >= 0 ? Math.sin(2 * Math.PI * F0 * tau) : null, tau];
  }

  override avancer(dt: number): void {
    const t0 = this.t;
    this.t = this.t + dt;
    const n = Math.max(1, Math.trunc(Math.ceil(dt * 150)));
    for (let i = 1; i <= n; i++) {
      const t = t0 + (dt * i) / n;
      const [s] = this.recu(t);
      this.historique.push([t, this.emet(t) ? Math.sin(2 * Math.PI * F0 * t) : null, s]);
    }
    while (this.historique.length && this.historique[0]![0] < this.t - FENETRE_S) this.historique.shift();
  }

  frequence_recue(): [number, number, number] {
    const t = this.t;
    const h = 1e-3;
    const mesuree = (F0 * (this.retard(t + h) - this.retard(t - h))) / (2 * h);
    const tau = this.retard(t);
    const [x, y] = this.position(tau);
    const dx = this.obs[0] - x,
      dy = this.obs[1] - y;
    const n = Math.hypot(dx, dy) || 1.0;
    const [vx, vy] = this.vitesse_source(tau);
    const vr = (vx * dx + vy * dy) / n;
    return [mesuree, F0 / (1 - vr / C_ONDE), vr];
  }

  override valeurs(): [string, string][] {
    const [mes, pred, vr] = this.frequence_recue();
    return [
      [tr('anim_dopplershift_f0'), `${nombre(F0, 2)} Hz`],
      [tr('anim_dopplershift_vr'), `${nombre(vr / C_ONDE, 3)} c`],
      [tr('anim_dopplershift_f_recue'), `${nombre(mes, 3)} Hz`],
      [tr('anim_dopplershift_f_formule'), `${nombre(pred, 3)} Hz`],
    ];
  }

  override presser(pos: Pt, _b: Bouton_souris): boolean {
    if (this.zone !== null && this.zone[0].contains(pos)) {
      this._glisse = (q) => this.tirer(q);
      this.tirer(pos);
      return true;
    }
    return false;
  }

  private tirer(pos: Pt): void {
    const [r, k] = this.zone!;
    this.obs = [Math.max(1.0, Math.min(L - 1, (pos.x - r.left) / k)), Math.max(1.0, Math.min(H - 1, (pos.y - r.top) / k))];
    this.historique = [];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones_principale(rect, 2, 0.6);
    const r = dessin.cadre(p, z[0]!);
    const k = Math.min(r.w / L, r.h / H);
    const boite = new Rect(r.cx - (L * k) / 2, r.cy - (H * k) / 2, L * k, H * k);
    this.zone = [boite, k];
    p.save();
    p.setClipRect(boite);
    p.fillRect(boite, dessin.c('sphere', 0.35));
    p.setBrush(null);
    const t = this.t;
    const kmax = Math.floor(t * F0);
    const portee = Math.hypot(L, H) / C_ONDE + 1;
    p.setPen(dessin.stylo('accent2', 1.2, 0.85));
    for (let n = kmax; n > Math.max(-1, kmax - Math.trunc(portee * F0) - 1); n--) {
      const te = n / F0;
      if (!this.emet(te)) continue;
      const [x, y] = this.position(te);
      const rr = C_ONDE * (t - te) * k;
      p.drawEllipse(boite.left + x * k, boite.top + y * k, rr, rr);
    }
    if (this.c_trace.isChecked() && this.v.value() > 0) {
      const d = (this.dir.value() * Math.PI) / 180;
      p.setPen(dessin.stylo('grille', 1.0, null, true));
      p.drawLine(boite.left + (L / 2 - A * Math.cos(d)) * k, boite.top + (H / 2 - A * Math.sin(d)) * k, boite.left + (L / 2 + A * Math.cos(d)) * k, boite.top + (H / 2 + A * Math.sin(d)) * k);
    }
    p.restore();
    const [x, y] = this.position(t);
    dessin.disque(p, boite.left + x * k, boite.top + y * k, 7, 'accent1', 'texte');
    const ox = boite.left + this.obs[0] * k,
      oy = boite.top + this.obs[1] * k;
    dessin.disque(p, ox, oy, 7, 'accent3', 'texte');
    dessin.texte(p, ox, oy - 15, tr('anim_c_observateur'), 'accent3', { fond: true });
    this.signal(p, dessin.cadre(p, z[1]!, tr('anim_dopplershift_titre_emis')), 1);
    this.signal(p, dessin.cadre(p, z[2]!, tr('anim_dopplershift_titre_recu')), 2);
  }

  private signal(p: Peintre, r: Rect, i: 1 | 2): void {
    p.setPen(dessin.stylo('grille', 1.0));
    p.drawLine(r.left, r.cy, r.right, r.cy);
    if (!this.historique.length) return;
    const t1 = this.t;
    let morceau: Pt[] = [];
    p.setPen(dessin.stylo(i === 1 ? 'accent1' : 'accent3', 1.5));
    const pas = Math.max(1, Math.trunc(this.historique.length / Math.max(50.0, r.w)));
    for (let j = 0; j < this.historique.length; j += pas) {
      const e = this.historique[j]!;
      const v = e[i];
      if (v === null) {
        if (morceau.length > 1) p.drawPolyline(morceau);
        morceau = [];
        continue;
      }
      morceau.push(new Pt(r.right - (r.w * (t1 - e[0])) / FENETRE_S, r.cy - v * r.h * 0.4));
    }
    if (morceau.length > 1) p.drawPolyline(morceau);
  }
}
