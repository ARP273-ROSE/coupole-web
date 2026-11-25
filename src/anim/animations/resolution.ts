/**
 * Diffraction et pouvoir de résolution : l'image d'une étoile est une tache d'Airy de rayon 1,22 λ / D ; deux étoiles
 * plus proches se confondent (critère de Rayleigh) ; obstruction centrale, écart d'éclat, turbulence.  Jumeau de
 * `animations/resolution.py` de Coupole (calculs : `calc/diffraction.ts`).
 */
import * as dif from '../../calc/diffraction';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Axes } from '../../noyau/graphe';
import { type Peintre, Rect, rgb } from '../../noyau/peintre';
import { Animation, type Choix, type Coche, nombre, type Reglage } from '../base';

const N_IMAGE = 72;

export function angle_sec(x: number): string {
  if (x < 0.1) return `${nombre(x * 1000.0, x * 1000 < 10 ? 1 : 0)} mas`;
  return `${nombre(x, x < 1 ? 3 : x < 10 ? 2 : 1)}″`;
}

/** Éclat affiché : échelle logarithmique sur trois décades si l'image est étirée. */
export function eclat(v: number, etirer: boolean): number {
  return etirer ? Math.log10(1.0 + 1000.0 * Math.max(0.0, v)) / 3.0 : v;
}

export class Resolution extends Animation {
  static override ID = 'resolution';
  static override ANIMEE = false;

  instrument!: Choix;
  diametre!: Reglage;
  obstruction!: Reglage;
  lam!: Reglage;
  sep!: Reglage;
  dmag!: Reglage;
  seeing!: Reglage;
  c_etirer!: Coche;
  c_anneau!: Coche;
  private applique: unknown = 'libre';
  private cache: [string, dif.Profil] | null = null;

  override construire(): void {
    this.instrument = this.choix('instrument', [['anim_resolution_i_libre', 'libre'], ...dif.INSTRUMENTS.map(([k]) => ['anim_resolution_i_' + k, k] as [string, string])], 'libre');
    this.diametre = this.curseur('diametre', 0.5, 4000.0, 20.0, { dec: 1, unite: 'cm', log: true });
    this.obstruction = this.curseur('obstruction', 0.0, 0.6, 0.0, { dec: 2 });
    this.lam = this.curseur('lambda', 350.0, 2200.0, 550.0, { dec: 0, unite: 'nm' });
    this.sep = this.curseur('separation', 0.01, 20.0, 1.0, { dec: 3, unite: '″', log: true });
    this.dmag = this.curseur('dmag', 0.0, 5.0, 0.0, { dec: 1 });
    this.seeing = this.curseur('seeing', 0.0, 3.0, 0.0, { dec: 2, unite: '″' });
    this.c_etirer = this.coche('etirer', true);
    this.c_anneau = this.coche('anneau', true);
    this.applique = this.instrument.currentData();
    this.cache = null;
  }

  override reglage_change(): void {
    const k = this.instrument?.currentData();
    if (this.instrument && k !== this.applique) {
      this.applique = k;
      for (const [cle, d, e] of dif.INSTRUMENTS) {
        if (cle === k) {
          this.diametre.setValue(d * 100.0);
          this.obstruction.setValue(e);
        }
      }
    }
    super.reglage_change();
  }

  parametres(): [number, number, number, number] {
    return [this.diametre.value() / 100.0, this.lam.value(), this.obstruction.value(), this.seeing.value()];
  }

  profil(): dif.Profil {
    const pa = this.parametres();
    const cle = pa.join('|');
    if (!this.cache || this.cache[0] !== cle) this.cache = [cle, new dif.Profil(pa[0], pa[1], pa[2], pa[3])];
    return this.cache[1];
  }

  override valeurs(): [string, string][] {
    const [d, lam, , s] = this.parametres();
    const pr = this.profil();
    const sep = this.sep.value();
    const rapport = 10 ** (-0.4 * this.dmag.value());
    const cp = dif.coupe(pr, sep, rapport);
    const theta = dif.rayleigh_arcsec(d, lam);
    const out: [string, string][] = [
      [tr('anim_resolution_v_rayleigh'), angle_sec(theta)],
      [tr('anim_resolution_v_anneau'), angle_sec(pr.t1)],
      [tr('anim_resolution_v_fwhm'), angle_sec(dif.largeur_mi_hauteur(pr))],
      [tr('anim_resolution_v_rapport'), nombre(sep / theta, 2)],
      [tr('anim_resolution_v_creux'), cp.creux !== null ? `${nombre(cp.creux, 0)} % ${tr('anim_resolution_du_sommet')}` : tr('anim_resolution_aucun_creux')],
      [tr('anim_resolution_v_verdict'), tr('anim_resolution_' + dif.verdict(sep, d, lam, s))],
    ];
    if (s > 0) out.push([tr('anim_resolution_v_dturb'), `${nombre(100.0 * dif.diametre_turbulence(s, lam), 1)} cm`]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = dessin.zones(rect, 2, 0.75);
    this.image(p, dessin.cadre(p, z[0]!, tr('anim_resolution_t_image')));
    this.coupe(p, dessin.cadre(p, z[1]!, tr('anim_resolution_t_coupe')));
  }

  private image(p: Peintre, r: Rect): void {
    const pr = this.profil();
    const sep = this.sep.value();
    const rapport = 10 ** (-0.4 * this.dmag.value());
    const demi = dif.coupe(pr, sep, rapport, 3).demi;
    const cote = Math.max(10.0, Math.min(r.w, r.h - 26));
    const x0 = r.cx - cote / 2,
      y0 = r.y + (r.h - 26 - cote) / 2;
    p.save();
    p.fillRect(new Rect(x0, y0, cote, cote), rgb(0, 0, 0));
    const n = N_IMAGE;
    const h = cote / n;
    const vals: number[] = [];
    for (let j = 0; j < n; j++) {
      const y = ((j + 0.5 - n / 2) * 2.0 * demi) / n;
      for (let i = 0; i < n; i++) {
        const x = ((i + 0.5 - n / 2) * 2.0 * demi) / n;
        vals.push(pr.valeur(Math.hypot(x + sep / 2, y)) + rapport * pr.valeur(Math.hypot(x - sep / 2, y)));
      }
    }
    const m = Math.max(...vals) || 1.0;
    const etirer = this.c_etirer.isChecked();
    const bords = Array.from({ length: n + 1 }, (_, i) => Math.floor(x0 + i * h));
    const hauts = Array.from({ length: n + 1 }, (_, j) => Math.floor(y0 + j * h));
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const v = eclat(vals[j * n + i]! / m, etirer);
        if (v > 0.004) p.fillRect(new Rect(bords[i]!, hauts[j]!, bords[i + 1]! - bords[i]!, hauts[j + 1]! - hauts[j]!), rgb(255, 246, 225, Math.max(0, Math.min(255, Math.trunc(255 * v))) / 255));
      }
    }
    const k = cote / (2.0 * demi);
    const cx = x0 + cote / 2,
      cy = y0 + cote / 2;
    if (this.c_anneau.isChecked()) {
      p.setBrush(null);
      p.setPen(dessin.stylo('accent2', 1.0, 0.8, true));
      for (const sx of [-sep / 2, sep / 2]) if (Math.abs(sx) * k < cote) p.drawEllipse(cx + sx * k, cy, pr.t1 * k, pr.t1 * k);
    }
    p.restore();
    const cible = demi / 2;
    const e = 10 ** Math.floor(Math.log10(cible));
    const lg = Math.max(...[e, 2 * e, 5 * e].filter((m_) => m_ <= cible));
    const yb = y0 + cote + 12;
    p.setPen(dessin.stylo('texte', 2.0));
    p.drawLine(x0, yb, x0 + lg * k, yb);
    dessin.texte(p, x0 + lg * k + 8, yb + 4, angle_sec(lg), 'doux', { centre: false });
  }

  private coupe(p: Peintre, r: Rect): void {
    const pr = this.profil();
    const sep = this.sep.value();
    const rapport = 10 ** (-0.4 * this.dmag.value());
    const cp = dif.coupe(pr, sep, rapport);
    const ymax = Math.max(1.05, 1.08 * Math.max(...cp.somme));
    const ax = new Axes(r, -cp.demi, cp.demi, 0.0, ymax, false, false, [40, 6, 10, 30]).avec(p);
    ax.fond(p, { titre_x: tr('anim_resolution_axe_x'), titre_y: tr('anim_resolution_axe_y'), fmt_x: (v) => nombre(v, 2) });
    const xs = cp.x;
    ax.courbe(xs.map((x, i) => [x, cp.a[i]!] as [number, number]), 'accent2', 1.3, 0.85, true);
    ax.courbe(xs.map((x, i) => [x, cp.b[i]!] as [number, number]), 'accent3', 1.3, 0.85, true);
    ax.courbe(xs.map((x, i) => [x, cp.somme[i]!] as [number, number]), 'accent1', 2.2);
    const [d, lam] = this.parametres();
    const theta = dif.rayleigh_arcsec(d, lam);
    for (const sx of [-theta / 2, theta / 2]) if (Math.abs(sx) < cp.demi) ax.verticale(sx, 'doux', 1.0);
    dessin.texte(p, ax.px(0.0), ax.r.top + 10, tr('anim_resolution_rayleigh_ecart'), 'doux', { fond: true });
  }
}
