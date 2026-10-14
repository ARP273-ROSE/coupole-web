/**
 * Hydrogen Atom Simulator (NAAP) : un photon frappe un atome d'hydrogène.  Il n'est absorbé que si son énergie vaut
 * exactement l'écart entre le niveau de l'électron et un niveau supérieur, E = 13,598 eV (1/n² − 1/m²) ; s'il dépasse
 * l'énergie d'ionisation, l'électron est arraché ; sinon il passe.  L'atome excité retombe en émettant un photon
 * (choix équiprobable, comme l'original).  Niveaux de Bohr avec la masse réduite ; hc = 1 239,84 eV nm.
 */
import * as lumiere from '../../calc/lumiere';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { Couleur, type Peintre, Pt, type Rect } from '../../noyau/peintre';
import { alea, proundn } from '../../noyau/py';
import { Animation, type Choix, nombre, type Reglage } from '../base';

const N_MAX = 6;
const TOLERANCE_EV = 0.01;
const VOL_S = 1.2;
const ATTENTE_S = 2.5;
const RECOMBINAISON = [0.2, 0.2, 0.2, 0.2, 0.1, 0.1];
const TRANSITIONS: [number, number][] = [];
for (const a of [1, 2, 3]) for (let b = a + 1; b <= N_MAX; b++) TRANSITIONS.push([a, b]);

/** Issue d'un photon d'énergie e (eV) sur un électron au niveau n (0 : atome ionisé). */
export function evenement_photon(n: number, e: number): [string, number | null] {
  if (n === 0) return ['passe', null];
  for (let m = n + 1; m <= N_MAX; m++) if (Math.abs(e - lumiere.transition_ev(n, m)) <= TOLERANCE_EV) return ['absorbe', m];
  const seuil = -lumiere.niveau_ev(n);
  if (e >= seuil) return ['ionise', e - seuil];
  return ['passe', null];
}

interface Photon {
  e: number;
  t: number;
  sortant: boolean;
  angle: number;
  issue?: string;
}

type Val = number | string | { flottant: number };

export class AtomeHydrogene extends Animation {
  static override ID = 'hydrogenatom';
  static override LECTURE_AU_DEPART = true;

  e!: Reglage;
  transition!: Choix;
  n = 1;
  photons: Photon[] = [];
  journal: string[] = [];
  attente: number | null = null;
  t = 0.0;
  private hasard = alea(1);

  override construire(): void {
    this.e = this.curseur('energie', 0.5, 14.0, 10.2, { dec: 2, unite: 'eV' });
    this.transition = this.choix('transition', TRANSITIONS.map(([a, b]) => [`anim_hydrogenatom_t_${a}_${b}`, `${a}-${b}`] as [string, string]), '1-2');
    this.bouton('anim_hydrogenatom_tirer', () => this.tirer());
    this.bouton('anim_hydrogenatom_tirer_transition', () => this.tirer_transition());
    this.etat_initial();
  }

  override etat_initial(): void {
    this.n = 1;
    this.photons = [];
    this.journal = [];
    this.attente = null;
    this.t = 0.0;
    this.hasard = alea(1);
  }

  tirer(e: number | null = null): void {
    const ee = e === null ? this.e.value() : e;
    this.photons.push({ e: ee, t: 0.0, sortant: false, angle: 0.0 });
    this.noter('tir', { e: { flottant: ee } });
    if (!this.en_lecture) this.basculer_lecture();
  }

  tirer_transition(): void {
    const [a, b] = (this.transition.currentData() as string).split('-').map(Number) as [number, number];
    this.e.setValue(proundn(lumiere.transition_ev(a, b), 2));
    this.tirer(lumiere.transition_ev(a, b));
  }

  private noter(cle: string, v: Record<string, Val> = {}): void {
    const vals: Record<string, string | number> = {};
    for (const [k, x] of Object.entries(v)) vals[k] = typeof x === 'object' ? nombre(x.flottant, 2) : x;
    this.journal.push(tr('anim_hydrogenatom_j_' + cle, vals));
    this.journal = this.journal.slice(-6);
  }

  private emettre(e: number): void {
    this.photons.push({ e, t: 0.0, sortant: true, angle: -2.6 + 5.2 * this.hasard() });
  }

  override avancer(dt: number): void {
    this.t += dt;
    for (const ph of [...this.photons]) {
      ph.t += dt;
      if (!ph.sortant && ph.t >= VOL_S && ph.issue === undefined) {
        const [issue, x] = evenement_photon(this.n, ph.e);
        ph.issue = issue;
        if (issue === 'absorbe') {
          this.noter('absorbe', { a: this.n, b: x! });
          this.n = x!;
          this.photons.splice(this.photons.indexOf(ph), 1);
          this.attente = this.t + ATTENTE_S;
        } else if (issue === 'ionise') {
          this.noter('ionise', { a: this.n, k: { flottant: x! } });
          this.n = 0;
          this.photons.splice(this.photons.indexOf(ph), 1);
          this.attente = this.t + ATTENTE_S;
        } else this.noter('passe');
      }
      if (this.photons.includes(ph) && ph.t > 2.6 * VOL_S) this.photons.splice(this.photons.indexOf(ph), 1);
    }
    if (this.attente !== null && this.t >= this.attente) {
      this.attente = null;
      if (this.n === 0) {
        let u = this.hasard() * RECOMBINAISON.reduce((a, b) => a + b, 0);
        let m = N_MAX;
        for (let i = 0; i < N_MAX; i++) {
          u -= RECOMBINAISON[i]!;
          if (u < 0) {
            m = i + 1;
            break;
          }
        }
        this.n = m;
        this.emettre(-lumiere.niveau_ev(m));
        this.noter('recombine', { b: m });
        if (m > 1) this.attente = this.t + ATTENTE_S;
      } else if (this.n > 1) {
        const m = 1 + Math.floor(this.hasard() * (this.n - 1));
        const e = lumiere.transition_ev(m, this.n);
        this.noter('emet', { a: this.n, b: m, l: nombre(lumiere.longueur_onde_nm(e), 1) });
        this.emettre(e);
        this.n = m;
        if (m > 1) this.attente = this.t + ATTENTE_S;
      }
    }
  }

  override valeurs(): [string, string][] {
    const e = this.e.value();
    const out: [string, string][] = [
      [tr('anim_hydrogenatom_niveau'), this.n ? String(this.n) : tr('anim_hydrogenatom_ionise')],
      [tr('anim_hydrogenatom_photon'), `${nombre(e, 2)} eV → λ = ${nombre(lumiere.longueur_onde_nm(e), 1)} nm`],
    ];
    if (this.n) out.push([tr('anim_hydrogenatom_e_niveau'), `${nombre(lumiere.niveau_ev(this.n), 3)} eV`]);
    if (this.journal.length) out.push([tr('anim_hydrogenatom_dernier'), this.journal[this.journal.length - 1]!]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = rect.w >= 560 ? dessin.zones_principale(rect, 1, 0.6) : dessin.zones(rect, 2, 10.0);
    this.atome(p, dessin.cadre(p, z[0]!, tr('anim_hydrogenatom_titre_atome')));
    this.niveaux(p, dessin.cadre(p, z[1]!, tr('anim_hydrogenatom_titre_niveaux')));
  }

  private couleur(e: number): Couleur {
    const lam = lumiere.longueur_onde_nm(e);
    if (380 <= lam && lam <= 750) return new Couleur(...lumiere.couleur_longueur_onde(lam));
    return dessin.c(lam < 380 ? 'arc1' : 'accent3');
  }

  private atome(p: Peintre, r: Rect): void {
    const cx = r.left + r.w * 0.4,
      cy = r.cy;
    const rmax = Math.min(r.w * 0.38, r.h * 0.46);
    const k = rmax / N_MAX ** 2;
    p.setBrush(null);
    for (let n = 1; n <= N_MAX; n++) {
      p.setPen(dessin.stylo('grille', 1.0));
      p.drawEllipse(cx, cy, k * n * n, k * n * n);
    }
    dessin.disque(p, cx, cy, 5, 'accent3');
    if (this.n) {
      const a = 0.8 + (this.t * 1.5) / this.n;
      const rr = k * this.n * this.n;
      dessin.disque(p, cx + rr * Math.cos(a), cy - rr * Math.sin(a), 5, 'accent2', 'texte');
    } else {
      const d = rmax * 1.05;
      dessin.disque(p, cx + d * 0.7, cy - d * 0.7, 5, 'accent2', 'texte');
    }
    for (const ph of this.photons) {
      const col = this.couleur(ph.e);
      const lam_px = Math.max(4.0, Math.min(30.0, (8 * lumiere.longueur_onde_nm(ph.e)) / 300));
      let x0: number, y0: number, dx: number, dy: number;
      if (ph.sortant) {
        const s = (rmax * 1.2 * ph.t) / VOL_S;
        x0 = cx + s * Math.cos(ph.angle);
        y0 = cy - s * Math.sin(ph.angle);
        dx = Math.cos(ph.angle);
        dy = -Math.sin(ph.angle);
      } else {
        const s = (r.right - 10 - cx) * (1 - ph.t / VOL_S);
        [x0, y0, dx, dy] = [cx + s, cy, -1.0, 0.0];
      }
      AtomeHydrogene.onde(p, x0, y0, dx, dy, lam_px, col);
    }
  }

  static onde(p: Peintre, x0: number, y0: number, dx: number, dy: number, lam_px: number, col: Couleur): void {
    const pts: Pt[] = [];
    const nx = -dy,
      ny = dx;
    for (let i = 0; i < 31; i++) {
      const s = -i * 1.5;
      const a = 5 * Math.sin((2 * Math.PI * s) / lam_px);
      pts.push(new Pt(x0 + dx * s + nx * a, y0 + dy * s + ny * a));
    }
    p.setPen(dessin.stylo(col, 2.0));
    p.drawPolyline(pts);
  }

  private niveaux(p: Peintre, r: Rect): void {
    const y_de = (e: number): number => r.top + 12 + (r.h - 30) * (e / -lumiere.E_IONISATION_EV);
    const x0 = r.left + 40,
      x1 = r.right - 10;
    dessin.police(p, 0.85);
    for (let n = 1; n <= N_MAX; n++) {
      const y = y_de(lumiere.niveau_ev(n));
      p.setPen(dessin.stylo(n === this.n ? 'accent2' : 'grille', n === this.n ? 2.0 : 1.0));
      p.drawLine(x0, y, x1, y);
      if (n <= 4) {
        dessin.texte(p, r.left + 4, y + 4, `n=${n}`, 'doux', { centre: false });
        const s = `${nombre(lumiere.niveau_ev(n), 2)} eV`;
        dessin.texte(p, x1 - 4 - p.fontMetrics().horizontalAdvance(s), y - 4, s, 'doux', { centre: false });
      }
    }
    const y = y_de(0.0);
    p.setPen(dessin.stylo(this.n === 0 ? 'accent3' : 'doux', 1.5, null, true));
    p.drawLine(x0, y, x1, y);
    dessin.texte(p, r.left + 4, y - 4, tr('anim_hydrogenatom_ionisation'), 'doux', { centre: false });
    dessin.police(p, 1 / 0.85);
  }
}
