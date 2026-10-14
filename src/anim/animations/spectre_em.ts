/**
 * EM Spectrum Module : le spectre électromagnétique, des rayons gamma aux ondes radio.  Pour une longueur d'onde
 * choisie : fréquence ν = c / λ, énergie du photon E = h ν, température d'un corps noir dont le maximum tombe là
 * (Wien), domaine (bornes de l'original), et objets de taille comparable.  Constantes exactes du SI.
 */
import * as lumiere from '../../calc/lumiere';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { degrade_spectre } from '../../noyau/graphe';
import { Couleur, type Peintre, Pt, Rect } from '../../noyau/peintre';
import { Animation, type Bouton_souris, type Reglage } from '../base';
import { exposant, scientifique } from './gravitation';

const LOG_MIN = -16.0,
  LOG_MAX = 4.0;
const DOMAINES: [string, number, number, string][] = [
  ['gamma', -16.0, -12.0, 'arc1'], ['x', -12.0, -9.0, 'accent2'], ['uv', -9.0, Math.log10(4e-7), 'meridien'],
  ['visible', Math.log10(4e-7), Math.log10(7.5e-7), 'accent1'], ['ir_proche', Math.log10(7.5e-7), Math.log10(2.5e-6), 'accent3'],
  ['ir', Math.log10(2.5e-6), Math.log10(2.5e-5), 'mars'], ['micro_ondes', Math.log10(2.5e-5), -3.0, 'horizon'], ['radio', -3.0, 4.0, 'equateur'],
];
const OBJETS: [string, number][] = [
  ['noyau', 1e-14], ['atome', 1e-10], ['molecule', 1e-9], ['virus', 1e-7], ['bacterie', 1e-6], ['cellule', 1e-5], ['cheveu', 1e-4],
  ['tete_epingle', 1e-3], ['fourmi', 5e-3], ['balle', 0.1], ['humain', 1.7], ['immeuble', 100.0], ['montagne', 3000.0],
];

export class SpectreEM extends Animation {
  static override ID = 'emspectrum';
  static override ANIMEE = false;

  l!: Reglage;
  private zone: Rect | null = null;

  override construire(): void {
    this.l = this.curseur('log_lambda', LOG_MIN, LOG_MAX, Math.log10(5.5e-7), { dec: 2 });
    this.zone = null;
  }

  lam(): number {
    return 10 ** this.l.value();
  }

  objet(lam: number): [string, number] {
    let meilleur = OBJETS[0]!;
    for (const o of OBJETS) if (Math.abs(Math.log10(o[1]) - Math.log10(lam)) < Math.abs(Math.log10(meilleur[1]) - Math.log10(lam))) meilleur = o;
    return meilleur;
  }

  override valeurs(): [string, string][] {
    const lam = this.lam();
    const e = lumiere.energie_photon_j(lam);
    return [
      [tr('anim_emspectrum_domaine'), tr('anim_emspectrum_d_' + lumiere.domaine_em(lam))],
      [tr('anim_emspectrum_lambda_v'), `${scientifique(lam, 4)} m`],
      [tr('anim_emspectrum_frequence'), `${scientifique(lumiere.frequence(lam), 4)} Hz`],
      [tr('anim_emspectrum_energie'), `${scientifique(e, 4)} J = ${scientifique(e / lumiere.EV, 4)} eV`],
      [tr('anim_emspectrum_temperature'), `${scientifique(lumiere.temperature_de_pic(lam), 3)} K`],
      [tr('anim_emspectrum_objet'), tr('anim_emspectrum_o_' + this.objet(lam)[0])],
    ];
  }

  override presser(pos: Pt, _b: Bouton_souris): boolean {
    if (this.zone !== null && this.zone.adjusted(0, -10, 0, 10).contains(pos)) {
      this._glisse = (q) => this.tirer(q);
      this.tirer(pos);
      return true;
    }
    return false;
  }

  private tirer(pos: Pt): void {
    const r = this.zone!;
    const t = Math.max(0.0, Math.min(1.0, (pos.x - r.left) / r.w));
    this.l.setValue(LOG_MIN + t * (LOG_MAX - LOG_MIN));
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const lam = this.lam();
    const ll = Math.log10(lam);
    const bande = new Rect(rect.x + 20, rect.y + 34, rect.w - 40, 34);
    this.zone = bande.copie();
    const x_de = (lg: number): number => bande.left + (bande.w * (lg - LOG_MIN)) / (LOG_MAX - LOG_MIN);
    dessin.police(p, 0.85);
    for (const [nom, a, b, cle] of DOMAINES) {
      const r = new Rect(x_de(a), bande.top, x_de(b) - x_de(a), bande.h);
      if (nom === 'visible') p.fillRect(r, degrade_spectre(r.left, r.right, r.top, 1.0, 380, 750));
      else p.fillRect(r, dessin.c(cle, 0.45));
      dessin.texte(p, r.cx, bande.top - 9 - (nom === 'visible' ? 12 : 0), tr('anim_emspectrum_c_' + nom), nom !== 'visible' ? cle : 'texte');
    }
    for (let k = Math.trunc(LOG_MIN) + 2; k < Math.trunc(LOG_MAX); k += bande.w >= 600 ? 2 : 4) dessin.texte(p, x_de(k), bande.bottom + 11, `10${exposant(k)} m`, 'doux');
    dessin.police(p, 1 / 0.85);
    const xc = x_de(ll);
    p.setPen(dessin.stylo('texte', 2.0));
    p.drawLine(xc, bande.top - 3, xc, bande.bottom + 3);
    p.setBrush(dessin.c('texte'));
    p.drawPolygon([new Pt(xc, bande.bottom + 2), new Pt(xc - 6, bande.bottom + 12), new Pt(xc + 6, bande.bottom + 12)]);
    const zone = new Rect(rect.x + 10, bande.bottom + 30, rect.w - 20, rect.bottom - bande.bottom - 40);
    const r = dessin.cadre(p, zone, tr('anim_emspectrum_titre_onde'));
    const [nom, taille] = this.objet(lam);
    const largeur_m = Math.max(3 * lam, 2.2 * taille);
    const k = r.w / largeur_m;
    const cy = r.cy;
    const amp = Math.min(r.h * 0.3, 60.0);
    const n = 400;
    const visible = 380e-9 <= lam && lam <= 780e-9;
    const col = visible ? new Couleur(...lumiere.couleur_longueur_onde(lam * 1e9)) : dessin.c(DOMAINES.find((d) => d[0] === lumiere.domaine_em(lam))![3]);
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const x = r.left + (r.w * i) / n;
      pts.push(new Pt(x, cy - amp * Math.sin((2 * Math.PI * (x - r.left)) / (k * lam))));
    }
    p.setPen(dessin.stylo(col, 2.2));
    p.drawPolyline(pts);
    const x0 = r.left + k * lam * 0.25;
    const y0 = cy - amp - 12;
    dessin.fleche(p, x0, y0, x0 + k * lam, y0, dessin.stylo('texte', 1.2), 6);
    dessin.texte(p, x0 + (k * lam) / 2, y0 - 10, 'λ', 'texte');
    const w = k * taille;
    const ox = r.right - w - 10;
    const hh = Math.min(w, r.h * 0.25);
    p.setPen(dessin.stylo('doux', 1.2));
    p.setBrush(dessin.c('sphere', 0.6));
    p.drawEllipse(new Rect(ox, cy + amp * 0.4, w, hh));
    dessin.texte(p, ox + w / 2, cy + amp * 0.4 + hh + 12, `${tr('anim_emspectrum_o_' + nom)} (≈ ${scientifique(taille, 1)} m)`, 'doux');
  }
}
