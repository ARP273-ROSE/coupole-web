/**
 * Fiche flottante d'un objet désigné (survol de la souris, toucher, clavier) : petite boîte discrète posée dans la
 * scène, jamais par-dessus l'objet (à côté de lui, du côté où il y a le plus de place), et région « aria-live » qui
 * lit nom, type, distance et température.  La fiche ne capte pas la souris (le survol continue dessous).
 */
import { charger_fiches, fiche } from '../anim/fiches';
import { contenu_fiche, type LigneFiche } from '../anim/fiche_texte';
import { tr } from '../i18n/i18n';
import { h } from './dom';

export interface CibleFiche {
  fiche: string;
  /** centre et rayon de l'objet, en pixels CSS dans la scène */
  x: number;
  y: number;
  r: number;
}

/** Boîte w × h posée près d'un objet (x, y, r) dans une scène W × H : jamais sur l'objet, dans la scène si possible. */
export function placer_fiche(x: number, y: number, r: number, w: number, h: number, W: number, H: number, ecart = 10): [number, number] {
  const m = 4;
  const borne = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
  const d = r + ecart;
  // du côté où il y a le plus de place d'abord (droite/gauche puis dessous/dessus)
  const cotes: [number, number][] = [];
  const droite: [number, number] = [x + d, borne(y - h / 2, m, H - h - m)];
  const gauche: [number, number] = [x - d - w, borne(y - h / 2, m, H - h - m)];
  const dessous: [number, number] = [borne(x - w / 2, m, W - w - m), y + d];
  const dessus: [number, number] = [borne(x - w / 2, m, W - w - m), y - d - h];
  if (W - x >= x) cotes.push(droite, gauche);
  else cotes.push(gauche, droite);
  if (H - y >= y) cotes.push(dessous, dessus);
  else cotes.push(dessus, dessous);
  const recouvre = (bx: number, by: number): boolean => {
    const cx = borne(x, bx, bx + w);
    const cy = borne(y, by, by + h);
    return Math.hypot(cx - x, cy - y) < r + 2;
  };
  // chaque côté tel quel, puis ramené dans la scène ; le recouvrement de l'objet est exclu tant qu'on peut l'éviter
  const cands: [number, number][] = [...cotes, ...cotes.map(([bx, by]) => [borne(bx, m, Math.max(m, W - w - m)), borne(by, m, Math.max(m, H - h - m))] as [number, number])];
  let meilleur: [number, number] = cands[0]!;
  let cout = Infinity;
  for (const [bx, by] of cands) {
    const hors = Math.max(0, m - bx) + Math.max(0, bx + w - (W - m)) + Math.max(0, m - by) + Math.max(0, by + h - (H - m));
    const c = hors * 10 + (recouvre(bx, by) ? 1e6 : 0);
    if (c < cout) {
      cout = c;
      meilleur = [bx, by];
      if (c === 0) break;
    }
  }
  const [bx, by] = meilleur;
  return [bx, by];
}

/** Lignes d'une fiche compacte : type, magnitude, distance, température, taille, âge ; sources raccourcies. */
export function lignes_compactes(lignes: LigneFiche[]): LigneFiche[] {
  const gardees = ['anim_fiche_type', 'anim_fiche_mag_v', 'anim_fiche_distance', 'anim_fiche_distance_affichee', 'anim_fiche_teff', 'anim_fiche_taille', 'anim_fiche_age'].map((k) => tr(k));
  return lignes
    .filter((l) => gardees.includes(l.libelle))
    .map((l) => ({ ...l, source: l.source.length > 44 ? l.source.slice(0, 43).trimEnd() + '…' : l.source }));
}

export class FicheFlottante {
  el: HTMLElement;
  annonce: HTMLElement;
  private actuelle: string | null = null;
  private cible: CibleFiche | null = null;

  constructor(private scene: HTMLElement) {
    this.el = h('div', { class: 'fiche-objet', 'aria-hidden': 'true', hidden: true });
    this.annonce = h('div', { class: 'visuellement-cache', role: 'status', 'aria-live': 'polite' });
    scene.append(this.el, this.annonce);
  }

  /** Montre la fiche de la cible (null : la cache). */
  montrer(c: CibleFiche | null): void {
    this.cible = c;
    if (!c) {
      this.cacher();
      return;
    }
    const f = fiche(c.fiche);
    if (!f) {
      void charger_fiches().then(() => {
        if (this.cible?.fiche === c.fiche) this.montrer(this.cible);
      });
      return;
    }
    // petite scène (téléphone) : fiche compacte (valeurs principales, sources raccourcies)
    const compact = this.scene.clientWidth < 560 || this.scene.clientHeight < 480;
    const cle = `${c.fiche}|${compact}`;
    if (this.actuelle !== cle) {
      this.actuelle = cle;
      const t = contenu_fiche(f);
      if (compact) t.lignes = lignes_compactes(t.lignes);
      const pastille = h('span', { class: 'fo-pastille', 'aria-hidden': 'true' });
      if (t.couleur) pastille.style.setProperty('background', t.couleur);
      else pastille.hidden = true;
      const dl = h('dl');
      for (const l of t.lignes) {
        dl.append(
          h('dt', { text: l.libelle }),
          h('dd', { class: l.alerte ? 'alerte' : null }, l.valeur, l.source ? h('small', { text: l.source }) : null),
        );
      }
      this.el.replaceChildren(
        h('div', { class: 'fo-titre' }, pastille, h('span', { text: t.titre })),
        t.sous_titre ? h('div', { class: 'fo-sous-titre', text: t.sous_titre }) : '',
        dl,
      );
      this.annonce.textContent = t.resume;
      this.el.dataset.fiche = c.fiche;
    }
    this.el.hidden = false;
    this.placer();
  }

  /** Repose la fiche près de l'objet (l'objet a bougé, la scène a changé de taille). */
  placer(): void {
    const c = this.cible;
    if (!c || this.el.hidden) return;
    const W = this.scene.clientWidth;
    const H = this.scene.clientHeight;
    this.el.style.setProperty('max-width', `${Math.max(160, Math.min(300, W - 16))}px`);
    this.el.style.setProperty('max-height', `${Math.max(60, H - 8)}px`);
    const w = this.el.offsetWidth;
    const hh = this.el.offsetHeight;
    const [x, y] = placer_fiche(c.x, c.y, c.r, w, hh, W, H);
    this.el.style.setProperty('left', `${Math.round(x)}px`);
    this.el.style.setProperty('top', `${Math.round(y)}px`);
    this.el.dataset.objet = `${c.x.toFixed(1)} ${c.y.toFixed(1)} ${c.r.toFixed(1)}`;
  }

  /** Suit l'objet : nouvelle position (même fiche). */
  suivre(c: CibleFiche): void {
    if (this.cible?.fiche !== c.fiche) return this.montrer(c);
    this.cible = c;
    this.placer();
  }

  cacher(): void {
    this.cible = null;
    if (!this.el.hidden) {
      this.el.hidden = true;
      this.annonce.textContent = '';
    }
    this.actuelle = null;
    delete this.el.dataset.fiche;
  }

  get affichee(): string | null {
    return this.el.hidden ? null : this.cible?.fiche ?? null;
  }

}
