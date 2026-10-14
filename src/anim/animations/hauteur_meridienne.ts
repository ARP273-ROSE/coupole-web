/**
 * Meridional Altitude Simulator : le plan du méridien vu de côté.  L'équateur céleste culmine à 90° − φ au-dessus de
 * l'horizon sud ; un astre de déclinaison δ passe au méridien à la hauteur h = 90° − φ + δ (vers le sud), ou
 * 180° − (90° − φ + δ) au nord du zénith.  Plages du Soleil (±23,44°) et de la Lune (±28,6°).
 */
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { Animation, angle, type Choix, type Coche, type Reglage } from '../base';

const EPS = 23.44;
const I_LUNE = 5.14;

/** Hauteur au passage au méridien supérieur et côté (S ou N), comme le simulateur d'origine. */
export function culmination(lat: number, dec: number): [number, 'S' | 'N'] {
  const h = 90.0 - lat + dec;
  if (h > 90.0) return [180.0 - h, 'N'];
  if (h < -90.0) return [-180.0 - h, 'N'];
  return [h, 'S'];
}

export class HauteurMeridienne extends Animation {
  static override ID = 'meridaltdiagram';
  static override ANIMEE = false;

  lat!: Reglage;
  dec!: Reglage;
  objet!: Choix;
  c_soleil!: Coche;
  c_lune!: Coche;

  override construire(): void {
    this.lat = this.curseur('latitude', -90.0, 90.0, 41.0, { dec: 1, unite: '°', cle_texte: 'anim_c_latitude' });
    this.dec = this.curseur('dec', -90.0, 90.0, 23.5, { dec: 1, unite: '°', cle_texte: 'anim_c_dec' });
    this.objet = this.choix('objet', [
      ['anim_meridaltdiagram_etoile', 'etoile'], ['anim_meridaltdiagram_soleil', 'soleil'], ['anim_meridaltdiagram_lune', 'lune'],
      ['anim_meridaltdiagram_planete', 'planete'], ['anim_meridaltdiagram_aucun', 'aucun'],
    ], 'soleil');
    this.c_soleil = this.coche('plage_soleil', false);
    this.c_lune = this.coche('plage_lune', false);
  }

  override valeurs(): [string, string][] {
    const lat = this.lat.value(),
      dec = this.dec.value();
    const [h, cote] = culmination(lat, dec);
    let formule = `90° − ${angle(lat)} + ${dec < 0 ? `(${angle(dec)})` : angle(dec)} = ${angle(90 - lat + dec)}`;
    if (cote === 'N') formule = `180° − (${formule.slice(0, formule.lastIndexOf(' = '))}) = ${angle(h)}`;
    const out: [string, string][] = [
      [tr('anim_meridaltdiagram_hauteur'), `${angle(h)} (${tr(cote === 'S' ? 'anim_pc_s' : 'anim_pc_n')})`],
      [tr('anim_meridaltdiagram_formule'), formule],
      [tr('anim_meridaltdiagram_eq'), angle(90 - Math.abs(lat))],
    ];
    if (h < 0) out.push([tr('anim_meridaltdiagram_remarque'), tr('anim_meridaltdiagram_jamais')]);
    return out;
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const lat = this.lat.value(),
      dec = this.dec.value();
    const cx = rect.cx,
      cy = rect.bottom - rect.h * 0.2;
    const rr = Math.min(rect.w * 0.42, rect.h * 0.68);
    p.setPen(dessin.stylo('horizon', 2.5));
    p.drawLine(cx - rr * 1.1, cy, cx + rr * 1.1, cy);
    p.setPen(dessin.stylo('grille', 1.2));
    p.setBrush(dessin.c('ciel', 0.2));
    p.drawPie(new Rect(cx - rr, cy - rr, 2 * rr, 2 * rr), 0, 180 * 16);
    dessin.texte(p, cx - rr * 1.05, cy + 16, tr('anim_pc_s'), 'horizon');
    dessin.texte(p, cx + rr * 1.05, cy + 16, tr('anim_pc_n'), 'horizon');
    dessin.texte(p, cx, cy - rr - 12, tr('anim_altazimuth_zenith'), 'doux');
    const point = (h_sud: number): Pt => {
      const a = ((180.0 - h_sud) * Math.PI) / 180;
      return new Pt(cx + rr * Math.cos(a), cy - rr * Math.sin(a));
    };
    const arc = (h1: number, h2: number, coul: string, ep: number, alpha = 1.0): void => {
      const a1 = Math.min(h1, h2),
        a2 = Math.max(h1, h2);
      p.setPen(dessin.stylo(coul, ep, alpha));
      p.setBrush(null);
      p.drawArc(new Rect(cx - rr, cy - rr, 2 * rr, 2 * rr), Math.trunc((180 - a2) * 16), Math.trunc((a2 - a1) * 16));
    };
    const eq = 90.0 - lat;
    if (this.c_lune.isChecked()) arc(eq - EPS - I_LUNE, eq + EPS + I_LUNE, 'lune', 10, 0.35);
    if (this.c_soleil.isChecked()) arc(eq - EPS, eq + EPS, 'soleil', 6, 0.5);
    const pole = point(lat >= 0 ? 180.0 - lat : -lat);
    p.setPen(dessin.stylo('equateur', 1.6));
    p.drawLine(cx, cy, pole.x, pole.y);
    const q = point(eq);
    p.setPen(dessin.stylo('equateur', 2.0, null, true));
    p.drawLine(cx, cy, q.x, q.y);
    dessin.texte(p, q.x - 10, q.y - 12, tr('anim_radecdemo_l_equateur_celeste'), 'equateur', { fond: true });
    dessin.texte(p, pole.x, pole.y - 12, tr(lat >= 0 ? 'anim_radecdemo_l_pnc' : 'anim_radecdemo_l_psc'), 'equateur', { fond: true });
    p.setPen(dessin.stylo('accent1', 1.5));
    p.setBrush(null);
    const r2 = rr * 0.25;
    p.drawArc(new Rect(cx - r2, cy - r2, 2 * r2, 2 * r2), Math.trunc((180 - eq) * 16), Math.trunc(eq * 16));
    dessin.texte(p, cx - r2 * 1.35, cy - r2 * 0.5, angle(eq), 'accent1', { fond: true });
    if (this.objet.currentData() !== 'aucun') {
      const hs = eq + dec;
      const o = point(hs);
      p.setPen(dessin.stylo('texte', 1.0, 0.6, true));
      p.drawLine(cx, cy, o.x, o.y);
      const cle = ({ etoile: 'etoile', soleil: 'soleil', lune: 'lune', planete: 'mars' } as Record<string, string>)[this.objet.currentData() as string]!;
      dessin.disque(p, o.x, o.y, 9, cle, 'fond');
      arc(eq, hs, 'arc2', 3.0);
      const [h] = culmination(lat, dec);
      dessin.texte(p, o.x, o.y - 18, `h = ${angle(h)}`, 'texte', { fond: true });
    }
    dessin.texte(p, rect.x + 10, rect.y + 18, 'h = 90° − φ + δ', 'texte', { centre: false });
  }
}
