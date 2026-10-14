/**
 * Eclipse Table : les éclipses de Soleil et de Lune de 2015 à 2044 (table de l'original), placées selon l'année et la
 * date dans l'année.  Elles se rangent en bandes obliques : les saisons d'éclipses reviennent tous les 173,3 jours et
 * avancent d'environ 19 jours par an.  Chaque éclipse est vérifiée (phase moyenne et argument de latitude, Meeus).
 */
import ECLIPSES from '../../donnees/genere/eclipses.json';
import * as astro from '../../calc/astro';
import { langue, tr } from '../../i18n/i18n';
import * as dessin from '../../noyau/dessin';
import { type Peintre, Pt, Rect } from '../../noyau/peintre';
import { Animation, type Bouton_souris, type Coche, MOIS_JOURS, nombre } from '../base';

type Eclipse = [number, number, number, string, number, number, string, string];
const E = ECLIPSES as unknown as {
  soleil: Eclipse[];
  lune: Eclipse[];
  lieux_fr: Record<string, string>;
  directions_fr: Record<string, string>;
  types_zone_fr: Record<string, string>;
};
const SOLEIL = E.soleil,
  LUNE = E.lune;

const AN0 = 2015,
  AN1 = 2045;
const LIMITE_F = (Math.asin(0.36) * 180) / Math.PI;
const DEMI_SAISON_J = LIMITE_F / (360.0 / astro.ANNEE_DRACONITIQUE_J);

function lieu_fr(x: string): string {
  x = x.trim();
  if (x in E.lieux_fr) return E.lieux_fr[x]!;
  const dirs = Object.keys(E.directions_fr).sort((a, b) => b.length - a.length);
  for (const d of dirs) if (x.startsWith(d + ' ') && x.slice(d.length + 1) in E.lieux_fr) return `${E.lieux_fr[x.slice(d.length + 1)]} (${E.directions_fr[d]})`;
  return x;
}

/** Zones de visibilité dans la langue demandée (anglais : texte d'origine corrigé). */
export function zones(texte: string, l: string = 'en'): string {
  if (l !== 'fr') return texte;
  const i = texte.indexOf('(');
  const principal = i >= 0 ? texte.slice(0, i) : texte;
  const central = i >= 0 ? texte.slice(i + 1) : '';
  let out = principal.split(',').filter((x) => x.trim()).map(lieu_fr).join(', ');
  if (central) {
    const c = central.replace(/\)+$/, '');
    const j = c.indexOf(':');
    const genre = (j >= 0 ? c.slice(0, j) : c).trim();
    const lieux = j >= 0 ? c.slice(j + 1) : '';
    out += ` (${E.types_zone_fr[genre] ?? genre} : ${lieux.split(',').filter((x) => x.trim()).map(lieu_fr).join(', ')})`;
  }
  return out;
}

export function fraction_d_annee(annee: number, mois: number, jour: number): number {
  const jj = astro.jour_julien(annee, mois, jour);
  const j0 = astro.jour_julien(annee, 1, 1);
  return (jj - j0) / (astro.jour_julien(annee + 1, 1, 1) - j0);
}

export function verifier(e: Eclipse, solaire: boolean): { k: number; ecart_j: number; F: number; sinF: number } {
  const jj = astro.jour_julien(e[0], e[1], e[2], 12.0);
  const k = astro.phase_la_plus_proche(jj, !solaire);
  const f = astro.argument_latitude_lune(k);
  return { k, ecart_j: astro.phase_moyenne_jde(k) - jj, F: f, sinF: Math.abs(Math.sin((f * Math.PI) / 180)) };
}

/** « 02m47s » → « 2 min 47 s » ; « 03h29m (00h05m) » → « 3 h 29 min (totalité : 0 h 05 min) ». */
export function format_duree(s: string): string {
  if (s.trim() === '' || s.trim() === '-') return '—';
  const un = (x: string): string => {
    const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(x.trim());
    if (!m) return x;
    const [, h, mi, se] = m;
    if (h !== undefined) return `${Number(h)} h ${mi || '00'} min`;
    return `${Number(mi || 0)} min ${se || '00'} s`;
  };
  const i = s.indexOf('(');
  const principal = i >= 0 ? s.slice(0, i) : s;
  const tot = i >= 0 ? s.slice(i + 1) : '';
  let out = un(principal);
  if (tot) out += ` (${tr('anim_eclipsetable_totalite')} : ${un(tot.replace(/\)+$/, ''))})`;
  return out;
}

let passages: [number, number, string][] | null = null;
/** Milieux des saisons d'éclipses : (année, fraction d'année, nœud). */
export function passages_aux_noeuds(): [number, number, string][] {
  if (passages) return passages;
  const out: [number, number, string][] = [];
  for (const [jj, nom] of astro.soleil_au_noeud(astro.jour_julien(AN0 - 1, 1, 1), astro.jour_julien(AN1 + 1, 1, 1))) {
    let an = AN0 - 1;
    while (astro.jour_julien(an + 1, 1, 1) <= jj) an += 1;
    const j0 = astro.jour_julien(an, 1, 1),
      j1 = astro.jour_julien(an + 1, 1, 1);
    out.push([an, (jj - j0) / (j1 - j0), nom]);
  }
  passages = out;
  return out;
}

export class TableEclipses extends Animation {
  static override ID = 'eclipsetable';
  static override ANIMEE = false;

  c_soleil!: Coche;
  c_lune!: Coche;
  c_saisons!: Coche;
  choisie: [string, number] = ['soleil', 25];
  private points: [number, number, string, number][] = [];

  override construire(): void {
    this.c_soleil = this.coche('soleil', true);
    this.c_lune = this.coche('lune', true);
    this.c_saisons = this.coche('saisons', true);
    this.choisie = ['soleil', 25];
    this.points = [];
  }

  override etat_initial(): void {
    this.choisie = ['soleil', 25];
  }

  override presser(pos: Pt, _b: Bouton_souris): boolean {
    let meilleur: [number, string, number] | null = null;
    for (const [x, y, genre, i] of this.points) {
      const d = Math.hypot(pos.x - x, pos.y - y);
      if (d < 14 && (meilleur === null || d < meilleur[0])) meilleur = [d, genre, i];
    }
    if (meilleur) {
      this.choisie = [meilleur[1], meilleur[2]];
      this.rafraichir();
      return true;
    }
    return false;
  }

  override valeurs(): [string, string][] {
    const [genre, i] = this.choisie;
    const e = (genre === 'soleil' ? SOLEIL : LUNE)[i]!;
    const v = verifier(e, genre === 'soleil');
    const date = langue() === 'fr' ? `${e[2]} ${tr(`anim_mois_${e[1]}`)} ${e[0]}` : `${tr(`anim_mois_${e[1]}`)} ${e[2]}, ${e[0]}`;
    return [
      [tr('anim_eclipsetable_eclipse'), tr('anim_eclipsetable_g_' + genre, { date })],
      [tr('anim_eclipsetable_type'), tr('anim_eclipsetable_t_' + e[3])],
      [tr('anim_eclipsetable_saros'), String(e[4])],
      [tr('anim_eclipsetable_grandeur'), nombre(e[5], 3)],
      [tr('anim_eclipsetable_duree'), format_duree(e[6])],
      [tr('anim_eclipsetable_zones'), zones(e[7], langue())],
      [tr('anim_eclipsetable_verif'), tr('anim_eclipsetable_verif_v', { j: nombre(v.ecart_j, 2), f: nombre(v.F, 1), s: nombre(v.sinF, 2) })],
    ];
  }

  override dessiner(p: Peintre, rect: Rect): void {
    const gauche = 44,
      bas = 26;
    const x0 = rect.x + gauche,
      x1 = rect.right - 10;
    const y0 = rect.y + 10,
      y1 = rect.bottom - bas;
    const xy = (an: number, frac: number): [number, number] => [x0 + ((x1 - x0) * (an + frac - AN0)) / (AN1 - AN0), y0 + (y1 - y0) * frac];
    p.setPen(dessin.stylo('grille', 1.0));
    p.setBrush(null);
    p.drawRect(new Rect(x0, y0, x1 - x0, y1 - y0));
    dessin.police(p, 0.75);
    for (let an = AN0; an <= AN1; an += 5) {
      const [x] = xy(an, 0.0);
      p.setPen(dessin.stylo('grille', 1.0, 0.5));
      p.drawLine(x, y0, x, y1);
      dessin.texte(p, x, y1 + 12, String(an), 'doux');
    }
    for (let mo = 1; mo <= 12; mo++) {
      let s = 0;
      for (let i = 0; i < mo - 1; i++) s += MOIS_JOURS[i]!;
      const y = y0 + ((y1 - y0) * s) / 365.0;
      p.setPen(dessin.stylo('grille', 1.0, 0.25));
      p.drawLine(x0, y, x1, y);
      dessin.texte(p, x0 - 22, y + (y1 - y0) / 24, tr(`anim_mois_court_${mo}`), 'doux');
    }
    dessin.police(p, 1 / 0.75);
    if (this.c_saisons.isChecked()) this.saisons(p, xy);
    this.points = [];
    for (const [genre, donnees, coche] of [['soleil', SOLEIL, this.c_soleil], ['lune', LUNE, this.c_lune]] as [string, Eclipse[], Coche][]) {
      if (!coche.isChecked()) continue;
      donnees.forEach((e, i) => {
        const [x, y] = xy(e[0], fraction_d_annee(e[0], e[1], e[2]));
        this.points.push([x, y, genre, i]);
        this.icone(p, x, y, genre, e[3], genre === this.choisie[0] && i === this.choisie[1]);
      });
    }
  }

  /** Bandes des saisons d'éclipses : ±20,3 jours autour de chaque passage du Soleil à un nœud. */
  private saisons(p: Peintre, xy: (an: number, frac: number) => [number, number]): void {
    const demi = DEMI_SAISON_J / 365.25;
    const w = (xy(AN0 + 1, 0.0)[0] - xy(AN0, 0.0)[0]) * 0.18;
    for (const [an, frac, nom] of passages_aux_noeuds()) {
      const f0 = frac - demi,
        f1 = frac + demi;
      const morceaux: [number, number, number][] = [[an, Math.max(0.0, f0), Math.min(1.0, f1)]];
      if (f0 < 0) morceaux.push([an - 1, f0 + 1.0, 1.0]);
      if (f1 > 1) morceaux.push([an + 1, 0.0, f1 - 1.0]);
      p.setPen(null);
      p.setBrush(dessin.c(nom === 'asc' ? 'accent1' : 'accent2', 0.16));
      for (const [a, g0, g1] of morceaux) {
        if (!(AN0 <= a && a < AN1)) continue;
        const [xa, ya] = xy(a, g0),
          [xb, yb] = xy(a, g1);
        p.drawPolygon([new Pt(xa - w, ya), new Pt(xa + w, ya), new Pt(xb + w, yb), new Pt(xb - w, yb)]);
      }
    }
  }

  private icone(p: Peintre, x: number, y: number, genre: string, type_: string, choisie: boolean): void {
    const r = 5.0;
    if (choisie) {
      p.setPen(dessin.stylo('accent3', 2.0));
      p.setBrush(null);
      p.drawEllipse(x, y, r + 5, r + 5);
    }
    if (genre === 'soleil') {
      const plein = ({ total: 'nuit', annular: 'nuit', hybrid: 'nuit' } as Record<string, string>)[type_];
      dessin.disque(p, x, y, r, 'soleil');
      if (plein) dessin.disque(p, x, y, r * (type_ === 'annular' ? 0.62 : 0.9), plein);
      else dessin.disque(p, x + r * 0.45, y - r * 0.2, r * 0.8, 'nuit');
    } else {
      const couleur = ({ total: 'mars', partial: 'accent3', penumbral: 'penombre' } as Record<string, string>)[type_] ?? 'lune';
      dessin.disque(p, x, y, r, 'lune');
      dessin.disque(p, x, y, r * (type_ === 'total' ? 0.85 : 0.6), couleur);
    }
  }
}
