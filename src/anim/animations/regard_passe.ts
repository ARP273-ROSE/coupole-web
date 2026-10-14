/**
 * Lookback Time Simulator : la lumière met du temps à nous parvenir ; regarder loin, c'est regarder dans le passé.  Une
 * étoile à d années-lumière explose l'année T : on ne voit l'explosion que l'année T + d.  Années historiques sans
 * année zéro, comme l'original (frise de 8000 av. J.-C. à 10 000).  Exemples réels : la supernova de 1054 (nébuleuse
 * du Crabe, ≈ 6 500 années-lumière) et SN 1006 (≈ 7 100 années-lumière).
 */
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Rect } from '../../noyau/peintre';
import { pround } from '../../noyau/py';
import { Animation, type Choix, nombre, type Reglage } from '../base';

const AN_MIN = -7999,
  AN_MAX = 10000;
const EXEMPLES: Record<string, [number, number]> = { crabe: [1054, 6500.0], sn1006: [1006, 7100.0] };

/** Année astronomique → « 1054 apr. J.-C. » / « 5447 av. J.-C. » (pas d'année zéro). */
export function annee_texte(a0: number): string {
  const a = pround(a0);
  if (a > 0) return tr('anim_lookbacktimesim_ap', { a });
  return tr('anim_lookbacktimesim_av', { a: 1 - a });
}

/** La lumière parcourt une année-lumière par an. */
export function annee_observee(annee_explosion: number, distance_al: number): number {
  return annee_explosion + distance_al;
}

export class RegardPasse extends Animation {
  static override ID = 'lookbacktimesim';

  exemple!: Choix;
  distance!: Reglage;
  explosion!: Reglage;
  vitesse_ans!: Reglage;
  annee = 0.0;
  private cle: string | undefined = undefined;

  override construire(): void {
    this.exemple = this.choix('exemple', [['anim_lookbacktimesim_libre', 'libre'], ['anim_lookbacktimesim_crabe', 'crabe'], ['anim_lookbacktimesim_sn1006', 'sn1006']], 'libre');
    this.exemple.activated.connect(() => this.choisirExemple());
    this.distance = this.curseur('distance', 100.0, 9000.0, 3000.0, { dec: 0, unite: tr('anim_spectroparallax_al') });
    this.explosion = this.curseur('explosion', AN_MIN, 9000.0, 1200.0, { dec: 0 });
    this.vitesse_ans = this.curseur('vitesse_ans', 50.0, 3000.0, 600.0, { dec: 0, unite: tr('anim_c_ans') + '/s', log: true });
    this.etat_initial();
  }

  private choisirExemple(): void {
    const k = this.exemple.currentData() as string;
    if (k in EXEMPLES) {
      const [vu, d] = EXEMPLES[k]!;
      this.distance.setValue(d);
      this.explosion.setValue(vu - d);
      this.etat_initial();
      this.rafraichir();
    }
  }

  override etat_initial(): void {
    this.annee = this.explosion.value() - 500.0;
  }

  override reglage_change(): void {
    const cle = `${this.distance.value()}|${this.explosion.value()}`;
    // comme l'original : le premier appel compte toujours comme un changement
    if (this.cle !== cle) this.etat_initial();
    this.cle = cle;
    super.reglage_change();
  }

  override avancer(dt: number): void {
    this.annee += dt * this.vitesse_ans.value();
    if (this.annee >= AN_MAX) {
      this.annee = AN_MAX;
      this.arreter();
    }
  }

  override valeurs(): [string, string][] {
    const t_sn = this.explosion.value(),
      d = this.distance.value();
    const vu = annee_observee(t_sn, d);
    return [
      [tr('anim_lookbacktimesim_maintenant'), annee_texte(this.annee)],
      [tr('anim_lookbacktimesim_explose'), annee_texte(t_sn)],
      [tr('anim_lookbacktimesim_vue'), annee_texte(vu)],
      [tr('anim_lookbacktimesim_ce_qu_il_voit'), tr(this.annee >= vu ? 'anim_lookbacktimesim_voit_sn' : 'anim_lookbacktimesim_voit_etoile')],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const t_sn = this.explosion.value(),
      d = this.distance.value();
    const haut = new Rect(rect.x, rect.y, rect.w, rect.h * 0.62);
    const r = dessin.cadre(p, haut, tr('anim_lookbacktimesim_titre_scene'));
    const x_etoile = r.left + 40;
    const x_obs = r.right - 50;
    const k = (x_obs - x_etoile) / Math.max(d, 1.0);
    const cy = r.cy + 10;
    if (this.annee >= t_sn) {
      const rr = (this.annee - t_sn) * k;
      p.save();
      p.setClipRect(r);
      p.setPen(dessin.stylo('accent1', 2.0, 0.8));
      p.setBrush(null);
      p.drawEllipse(x_etoile, cy, rr, rr);
      p.restore();
      dessin.disque(p, x_etoile, cy, 14, 'accent3', null, 0.5);
      dessin.disque(p, x_etoile, cy, 6, 'accent1');
    } else dessin.disque(p, x_etoile, cy, 8, 'soleil');
    dessin.texte(p, x_etoile, cy + 26, tr('anim_c_etoile'), 'doux');
    dessin.disque(p, x_obs, cy, 9, 'accent2', 'texte');
    dessin.texte(p, x_obs, cy + 26, tr('anim_c_observateur'), 'doux');
    const vu = this.annee >= annee_observee(t_sn, d);
    const bx = x_obs - 20,
      by = r.top + 34;
    p.setPen(dessin.stylo('doux', 1.0));
    p.setBrush(dessin.c('sphere', 0.6));
    p.drawEllipse(bx, by, 30, 22);
    if (vu) {
      dessin.disque(p, bx, by, 9, 'accent3', null, 0.6);
      dessin.disque(p, bx, by, 4, 'accent1');
    } else dessin.disque(p, bx, by, 4, 'soleil');
    dessin.texte(p, (x_etoile + x_obs) / 2, cy - 14, `${nombre(d, 0)} ${tr('anim_spectroparallax_al')}`, 'doux');
    const r2 = dessin.cadre(p, new Rect(rect.x, haut.bottom, rect.w, rect.h - haut.h), tr('anim_lookbacktimesim_titre_frise'));
    const y = r2.cy;
    const x_de = (a: number): number => r2.left + 10 + ((r2.w - 20) * (a - AN_MIN)) / (AN_MAX - AN_MIN);
    p.setPen(dessin.stylo('doux', 2.0));
    p.drawLine(x_de(AN_MIN), y, x_de(AN_MAX), y);
    dessin.police(p, 0.8);
    const pas = r2.w >= 700 ? 2000 : r2.w >= 420 ? 4000 : 6000;
    for (let a = -8000; a <= 10000; a += pas) {
      const aa = a > 0 ? a : a < 0 ? a + 1 : 1;
      p.drawLine(x_de(aa), y - 4, x_de(aa), y + 4);
      dessin.texte(p, x_de(aa), y + 15, annee_texte(aa), 'doux');
    }
    dessin.police(p, 1 / 0.8);
    for (const [a, cle, nom] of [
      [t_sn, 'accent3', 'anim_lookbacktimesim_m_explosion'],
      [annee_observee(t_sn, d), 'accent1', 'anim_lookbacktimesim_m_vue'],
    ] as [number, string, string][]) {
      if (AN_MIN <= a && a <= AN_MAX) {
        dessin.disque(p, x_de(a), y, 5, cle);
        dessin.texte(p, x_de(a), y - 14, tr(nom), cle, { fond: true });
      }
    }
    const xc = x_de(Math.max(AN_MIN, Math.min(AN_MAX, this.annee)));
    p.setPen(dessin.stylo('texte', 2.0));
    p.drawLine(xc, y - 22, xc, y + 6);
  }
}
