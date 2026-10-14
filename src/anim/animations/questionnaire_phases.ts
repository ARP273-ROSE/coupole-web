/**
 * Lunar Phase Quizzer : la vue habituelle de l'orbite lunaire, en cachant au choix l'aspect de la Lune, sa position
 * sur l'orbite ou la direction du Soleil.  On répond (curseur de phase, ou en faisant glisser la Lune ou la lumière du
 * Soleil) puis on affiche la réponse ; l'animation dit si la réponse donne la même phase nommée.
 */
import * as astro from '../../calc/astro';
import { tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, type Pt, Rect } from '../../noyau/peintre';
import { alea, pmod } from '../../noyau/py';
import { Animation, angle, type Bouton, type Bouton_souris, type Choix, type Reglage } from '../base';

const MODES = ['apparence', 'lune', 'soleil'];

/** Élongation de la Lune : angle, vu de la Terre, de la direction du Soleil à celle de la Lune. */
export function elongation(angle_lune: number, angle_soleil: number): number {
  return pmod(angle_lune - angle_soleil, 360.0);
}

export function meme_phase(e1: number, e2: number): boolean {
  return astro.nom_de_phase(e1) === astro.nom_de_phase(e2);
}

export class QuestionnairePhases extends Animation {
  static override ID = 'lunarphasequizzer';
  static override ANIMEE = false;

  mode!: Choix;
  reponse!: Reglage;
  b_reponse: Bouton | null = null;
  lune = 45.0;
  soleil = 0.0;
  devine: Record<string, number> = { lune: 135.0, soleil: 180.0 };
  montree = false;
  private hasard = alea((Date.now() & 0xffffffff) >>> 0);
  private schema: [Rect, number, number, number] | null = null;

  override construire(): void {
    this.mode = this.choix('mode', MODES.map((m) => ['anim_lunarphasequizzer_m_' + m, m] as [string, string]), 'apparence');
    this.reponse = this.curseur('reponse', 0.0, 360.0, 180.0, { dec: 0, unite: '°' });
    this.bouton('anim_lunarphasequizzer_nouvelle', () => this.nouvelle_question());
    this.b_reponse = this.bouton('anim_lunarphasequizzer_montrer', () => this.basculer_reponse());
    this.schema = null;
    this.etat_initial();
  }

  override etat_initial(): void {
    this.lune = 45.0;
    this.soleil = 0.0;
    this.devine = { lune: 135.0, soleil: 180.0 };
    this.montree = false;
    this.b_reponse?.setText(tr('anim_lunarphasequizzer_montrer'));
  }

  nouvelle_question(): void {
    this.lune = 15 * Math.floor(this.hasard() * 24) * 1.0;
    this.soleil = 15 * Math.floor(this.hasard() * 24) * 1.0;
    this.devine = { lune: pmod(this.lune + 120.0, 360.0), soleil: pmod(this.soleil + 120.0, 360.0) };
    this.montree = false;
    this.b_reponse!.setText(tr('anim_lunarphasequizzer_montrer'));
    this.rafraichir();
  }

  basculer_reponse(): void {
    this.montree = !this.montree;
    this.b_reponse!.setText(tr(this.montree ? 'anim_lunarphasequizzer_cacher' : 'anim_lunarphasequizzer_montrer'));
    this.rafraichir();
  }

  reponse_donnee(): number {
    const m = this.mode.currentData();
    if (m === 'apparence') return this.reponse.value();
    if (m === 'lune') return elongation(this.devine.lune!, this.soleil);
    return elongation(this.lune, this.devine.soleil!);
  }

  override valeurs(): [string, string][] {
    const vraie = elongation(this.lune, this.soleil);
    const out: [string, string][] = [
      [tr('anim_lunarphasequizzer_question'), tr('anim_lunarphasequizzer_m_' + this.mode.currentData())],
      [tr('anim_lunarphasequizzer_votre'), tr('anim_phase_' + astro.nom_de_phase(this.reponse_donnee()))],
    ];
    if (this.montree) {
      const ok = meme_phase(vraie, this.reponse_donnee());
      out.push(
        [tr('anim_lunarphasequizzer_vraie'), `${tr('anim_phase_' + astro.nom_de_phase(vraie))} (${angle(vraie, 0)})`],
        [tr('anim_lunarphasequizzer_verdict'), tr(ok ? 'anim_lunarphasequizzer_juste' : 'anim_lunarphasequizzer_faux')],
      );
    }
    return out;
  }

  override presser(pos: Pt, bouton: Bouton_souris): boolean {
    if (this.schema === null || !this.schema[0].contains(pos)) return super.presser(pos, bouton);
    const m = this.mode.currentData() as string;
    if ((m === 'lune' || m === 'soleil') && !this.montree) {
      this._glisse = (q) => this.tirer(m, q);
      this.tirer(m, pos);
      return true;
    }
    return false;
  }

  private tirer(m: string, pos: Pt): void {
    const [, cx, cy] = this.schema!;
    this.devine[m] = pmod((Math.atan2(cy - pos.y, pos.x - cx) * 180) / Math.PI, 360.0);
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const z = rect.w > rect.h * 1.1 ? dessin.zones_principale(rect, 1, 0.62) : dessin.zones(rect, 2, 10);
    const m = this.mode.currentData() as string;
    this.orbite(p, dessin.cadre(p, z[0]!, tr('anim_lunarphasequizzer_schema')), m);
    const r = dessin.cadre(p, z[1]!, tr('anim_lunarphasequizzer_aspect'));
    const rr = Math.min(r.w, r.h) * 0.34;
    const cx = r.cx,
      cy = r.cy - 6;
    if (m === 'apparence' && !this.montree) {
      dessin.phase_lune(p, cx, cy, rr, this.reponse.value(), 'lune', 'nuit');
      dessin.texte(p, cx, cy + rr + 14, tr('anim_lunarphasequizzer_votre_reponse'), 'accent2');
    } else dessin.phase_lune(p, cx, cy, rr, elongation(this.lune, this.soleil));
    if (this.montree) {
      const ok = meme_phase(elongation(this.lune, this.soleil), this.reponse_donnee());
      dessin.police(p, 1.2, true);
      dessin.texte(p, cx, r.bottom - 14, tr(ok ? 'anim_lunarphasequizzer_juste' : 'anim_lunarphasequizzer_faux'), ok ? 'horizon' : 'accent3');
      dessin.police(p, 1 / 1.2);
    }
  }

  private orbite(p: Peintre, r: Rect, m: string): void {
    const cx = r.cx,
      cy = r.cy;
    const ro = Math.min(r.w, r.h) * 0.36;
    this.schema = [r.copie(), cx, cy, ro];
    const cache_soleil = m === 'soleil' && !this.montree;
    const cache_lune = m === 'lune' && !this.montree;
    for (const [sigma, cle, alpha] of [[this.soleil, 'soleil', 0.8], [this.devine.soleil!, 'accent2', 0.8]] as [number, string, number][]) {
      if ((cle === 'soleil' && cache_soleil) || (cle === 'accent2' && m !== 'soleil')) continue;
      const s = (sigma * Math.PI) / 180;
      const ux = Math.cos(s),
        uy = -Math.sin(s);
      const nx = -uy,
        ny = ux;
      for (const k of [-0.6, -0.3, 0.0, 0.3, 0.6]) {
        const x0 = cx + ux * ro * 1.35 + nx * k * ro,
          y0 = cy + uy * ro * 1.35 + ny * k * ro;
        dessin.fleche(p, x0, y0, x0 - ux * ro * 0.3, y0 - uy * ro * 0.3, dessin.stylo(cle, 1.3, alpha), 6);
      }
    }
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(null);
    p.drawEllipse(cx, cy, ro, ro);
    const rt = ro * 0.18;
    dessin.disque(p, cx, cy, rt, 'terre');
    const rl = Math.max(6.0, rt * 0.5);
    for (const [mu, cle] of [[this.lune, 'lune'], [this.devine.lune!, 'accent2']] as [number, string][]) {
      if ((cle === 'lune' && cache_lune) || (cle === 'accent2' && m !== 'lune')) continue;
      const a = (mu * Math.PI) / 180;
      const mx = cx + ro * Math.cos(a),
        my = cy - ro * Math.sin(a);
      dessin.disque(p, mx, my, rl, !cache_soleil ? 'nuit' : 'doux');
      if (!cache_soleil) {
        p.setPen(null);
        p.setBrush(dessin.c(cle));
        p.drawPie(new Rect(mx - rl, my - rl, 2 * rl, 2 * rl), Math.trunc((this.soleil - 90) * 16), 180 * 16);
      }
    }
    if (!cache_soleil) {
      p.setPen(null);
      p.setBrush(dessin.c('nuit', 0.7));
      p.drawPie(new Rect(cx - rt, cy - rt, 2 * rt, 2 * rt), Math.trunc((this.soleil + 90) * 16), 180 * 16);
    }
    if ((m === 'lune' || m === 'soleil') && !this.montree)
      dessin.texte(p, r.x + 8, r.bottom - 10, tr('anim_lunarphasequizzer_glisser_' + m), 'accent2', { centre: false });
  }
}
