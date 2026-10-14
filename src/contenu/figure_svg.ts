/**
 * Rendu SVG des figures des questions, développées par le moteur (moteur/SPEC.md § 6) : y vers le bas, angles en
 * degrés dans le sens trigonométrique VU À L'ÉCRAN, épaisseur 1,5 par défaut, couleurs = jetons (thème sombre ou
 * clair) ou #rrggbb.  Même rendu que le moteur QPainter de Coupole (`classe/figure_qt.py`).
 *
 * `**…**` : partie variable mise en valeur (gras, couleur « valeur ») ; `$…$` : formule (MathML, posée ensuite dans
 * un <foreignObject data-riche>) ; `\n` : lignes de 1,2 × la taille.
 * Réponse montrée : les éléments liés à une bonne réponse (`choix`) passent en couleur « accent », plus épais, et
 * ceux qui ne s'affichent qu'avec la réponse apparaissent (classe « bonne » : clignotement orange, puis fixe).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Elt = any;
export type Jetons = Record<string, { sombre: string; clair: string }>;
export type Cotes = [number, number][][];

export interface OptionsFigure {
  theme: 'sombre' | 'clair';
  jetons: Jetons;
  reponse?: boolean;
  indice?: boolean;
  bonnes?: string[]; // identifiants des bonnes réponses (élément `choix: "B"`)
  cotes?: Cotes | null;
  images?: Record<string, { fichier: string; alt?: { fr: string; en: string } }>;
  base?: string; // préfixe des adresses d'images
  id?: string;
  /** Pour les tests : appelé pour chaque texte avec sa couleur finale et la surface dessous. */
  controle?: (texte: string, couleur: string, fond: string) => void;
}

const f3 = (x: number): string => {
  const s = (Math.round(x * 1000) / 1000).toFixed(3).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
};
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let nClip = 0;

// ------------------------------------------------------------------ contraste des textes sur les surfaces
type Mat = [number, number, number, number, number, number]; // x' = a x + c y + e ; y' = b x + d y + f
const ID: Mat = [1, 0, 0, 1, 0, 0];
const mul = (m: Mat, n: Mat): Mat => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const appl = (m: Mat, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const inv = (m: Mat): Mat | null => {
  const d = m[0] * m[3] - m[1] * m[2];
  if (!Number.isFinite(d) || Math.abs(d) < 1e-12) return null;
  return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d];
};
const rotm = (deg: number): Mat => {
  const a = (deg * Math.PI) / 180;
  return [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
};
function luminance(c: string): number | null {
  const m = /^#([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const v = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => {
    const s = x / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * v[0]! + 0.7152 * v[1]! + 0.0722 * v[2]!;
}
/** Rapport de contraste WCAG entre deux couleurs #rrggbb (null si l'une n'est pas lisible). */
export function contraste(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** Seuil sous lequel un texte de figure passe à la couleur de texte du thème opposé (WCAG, grands textes). */
export const CONTRASTE_MIN = 3;

/** La figure contient-elle une carte ou un globe (côtes à charger) ? */
export function aDesCotes(fig: Elt): boolean {
  if (!fig) return false;
  const voir = (e: Elt): boolean => e && (e.type === 'carte' || e.type === 'globe' || (e.type === 'groupe' && (e.elements ?? []).some(voir)));
  return (fig.elements ?? []).some(voir);
}

export function figureSvg(fig: Elt, o: OptionsFigure, libelle = ''): string {
  if (!fig) return '';
  const th = o.theme;
  const bonnes = new Set(o.bonnes ?? []);
  const defs: string[] = [];
  const prefixe = o.id ?? 'fq' + ++nClip;
  let n = 0;
  let mat: Mat = ID;
  const surfaces: { dedans: (x: number, y: number) => boolean; m: Mat | null; couleur: string }[] = [];
  const surface = (e: Elt, couleur: string, dedans: (x: number, y: number) => boolean): void => {
    if (couleur === 'none' || ('opacite' in e && Number(e.opacite) < 0.5)) return;
    surfaces.push({ dedans, m: inv(mat), couleur });
  };
  /** Couleur de la surface visible sous le point (x, y) du repère courant (fond de la figure à défaut). */
  const fondSous = (x: number, y: number): string => {
    const [gx, gy] = appl(mat, x, y);
    for (let i = surfaces.length - 1; i >= 0; i--) {
      const s = surfaces[i]!;
      if (!s.m) continue;
      const [lx, ly] = appl(s.m, gx, gy);
      if (s.dedans(lx, ly)) return s.couleur;
    }
    return coul(fig.fond ?? 'fond');
  };
  /** Texte lisible : si le contraste avec la surface dessous est trop faible, couleur de texte la plus lisible. */
  const lisible = (couleur: string, x: number, y: number): string => {
    const f = fondSous(x, y);
    const c = contraste(couleur, f);
    if (c === null || c >= CONTRASTE_MIN) return couleur;
    const cands = [o.jetons.avant?.sombre ?? '#f2f2f2', o.jetons.avant?.clair ?? '#1a1a1a'];
    let meilleur = couleur;
    let cm = c;
    for (const k of cands) {
      const ck = contraste(k, f) ?? 0;
      if (ck > cm) {
        cm = ck;
        meilleur = k;
      }
    }
    return meilleur;
  };
  const coul = (c: unknown): string => {
    if (c === null || c === undefined || c === 'aucune') return 'none';
    const s = String(c);
    if (s.startsWith('#')) return s;
    return o.jetons[s]?.[th] ?? o.jetons.trait?.[th] ?? '#888';
  };
  const style = (e: Elt, defautTrait = true, defautRemp: unknown = null): string => {
    const trait = 'trait' in e ? e.trait : defautTrait ? 'trait' : null;
    const remp = 'remplissage' in e ? e.remplissage : defautRemp;
    const s = [`stroke="${coul(trait)}"`, `fill="${coul(remp)}"`, `stroke-width="${f3(e.epaisseur ?? 1.5)}"`];
    if (e.tirets) s.push(`stroke-dasharray="${e.tirets.map(f3).join(' ')}"`);
    if ('opacite' in e) s.push(`opacity="${f3(e.opacite)}"`);
    s.push('stroke-linecap="round" stroke-linejoin="round"');
    return s.join(' ');
  };
  const visible = (e: Elt): boolean => {
    const a = e.afficher ?? 'toujours';
    if (a === 'reponse') return !!o.reponse;
    if (a === 'sans_reponse') return !o.reponse;
    if (a === 'indice') return !!o.indice;
    return true;
  };
  const texteRiche = (t: string): string =>
    t
      .split(/(\*\*.+?\*\*)/)
      .filter(Boolean)
      .map((m) => (m.startsWith('**') && m.endsWith('**') && m.length > 4 ? `<tspan font-weight="bold" fill="${coul('valeur')}">${esc(m.slice(2, -2))}</tspan>` : esc(m)))
      .join('');

  const elt = (e0: Elt): string => {
    if (!visible(e0)) return '';
    let e = e0;
    const t = e.type;
    let cls = '';
    if (o.reponse && e.choix !== undefined && bonnes.has(e.choix) && t !== 'groupe') {
      e = { ...e };
      if (t === 'texte') e.couleur = 'accent';
      else {
        e.trait = 'accent';
        e.epaisseur = Math.max(3, e.epaisseur ?? 1.5);
      }
      cls = ' class="bonne"';
    } else if (o.reponse && e.afficher === 'reponse') cls = ' class="bonne"';
    switch (t) {
      case 'ligne':
        return `<line${cls} x1="${f3(e.x1)}" y1="${f3(e.y1)}" x2="${f3(e.x2)}" y2="${f3(e.y2)}" ${style(e)}/>`;
      case 'fleche': {
        const tete = e.tete ?? 8;
        const a = Math.atan2(e.y2 - e.y1, e.x2 - e.x1);
        const p1 = [e.x2 - tete * Math.cos(a - 0.4), e.y2 - tete * Math.sin(a - 0.4)];
        const p2 = [e.x2 - tete * Math.cos(a + 0.4), e.y2 - tete * Math.sin(a + 0.4)];
        return (
          `<g${cls}><line x1="${f3(e.x1)}" y1="${f3(e.y1)}" x2="${f3(e.x2)}" y2="${f3(e.y2)}" ${style(e)}/>` +
          `<polygon points="${f3(e.x2)},${f3(e.y2)} ${f3(p1[0]!)},${f3(p1[1]!)} ${f3(p2[0]!)},${f3(p2[1]!)}" fill="${coul(e.trait ?? 'trait')}" stroke="none"/></g>`
        );
      }
      case 'polyligne':
      case 'polygone': {
        const pts = (e.points as number[][]).map(([x, y]) => `${f3(x!)},${f3(y!)}`).join(' ');
        if (t === 'polygone' && 'remplissage' in e) {
          const P = e.points as number[][];
          surface(e, coul(e.remplissage), (x, y) => {
            let dans = false;
            for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
              const [xi, yi] = P[i] as [number, number];
              const [xj, yj] = P[j] as [number, number];
              if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dans = !dans;
            }
            return dans;
          });
        }
        return t === 'polyligne' ? `<polyline${cls} points="${pts}" ${style(e)}/>` : `<polygon${cls} points="${pts}" ${style(e, !('remplissage' in e))}/>`;
      }
      case 'rect':
        if ('remplissage' in e) surface(e, coul(e.remplissage), (x, y) => x >= Math.min(e.x, e.x + e.l) && x <= Math.max(e.x, e.x + e.l) && y >= Math.min(e.y, e.y + e.h) && y <= Math.max(e.y, e.y + e.h));
        return `<rect${cls} x="${f3(e.x)}" y="${f3(e.y)}" width="${f3(e.l)}" height="${f3(e.h)}" rx="${f3(e.rayon ?? 0)}" ${style(e, !('remplissage' in e))}/>`;
      case 'cercle':
        if ('remplissage' in e) surface(e, coul(e.remplissage), (x, y) => (x - e.cx) ** 2 + (y - e.cy) ** 2 <= e.r ** 2);
        return `<circle${cls} cx="${f3(e.cx)}" cy="${f3(e.cy)}" r="${f3(e.r)}" ${style(e, !('remplissage' in e))}/>`;
      case 'ellipse':
        if ('remplissage' in e)
          surface(e, coul(e.remplissage), (x, y) => {
            const [u, v] = appl(rotm(e.rotation ?? 0), x - e.cx, y - e.cy);
            return (u / (e.rx || 1e-9)) ** 2 + (v / (e.ry || 1e-9)) ** 2 <= 1;
          });
        return `<ellipse${cls} cx="${f3(e.cx)}" cy="${f3(e.cy)}" rx="${f3(e.rx)}" ry="${f3(e.ry)}" transform="rotate(${f3(-(e.rotation ?? 0))} ${f3(e.cx)} ${f3(e.cy)})" ${style(e, !('remplissage' in e))}/>`;
      case 'arc': {
        const { cx, cy, r } = e;
        const a1 = e.debut;
        const a2 = e.fin;
        let ecart = Math.abs(a2 - a1) < 360 ? (((a2 - a1) % 360) + 360) % 360 : 359.999;
        if (ecart === 0) ecart = a2 !== a1 ? 359.999 : 0;
        const a2b = a1 + ecart;
        const rad = Math.PI / 180;
        const x1 = cx + r * Math.cos(a1 * rad);
        const y1 = cy - r * Math.sin(a1 * rad);
        const x2 = cx + r * Math.cos(a2b * rad);
        const y2 = cy - r * Math.sin(a2b * rad);
        const grand = ecart > 180 ? 1 : 0;
        let d = `M ${f3(x1)} ${f3(y1)} A ${f3(r)} ${f3(r)} 0 ${grand} 0 ${f3(x2)} ${f3(y2)}`;
        if (e.secteur) d = `M ${f3(cx)} ${f3(cy)} L ${f3(x1)} ${f3(y1)} A ${f3(r)} ${f3(r)} 0 ${grand} 0 ${f3(x2)} ${f3(y2)} Z`;
        return `<path${cls} d="${d}" ${style(e, !e.secteur || !('remplissage' in e))}/>`;
      }
      case 'texte': {
        const anc = ({ debut: 'start', milieu: 'middle', fin: 'end' } as Record<string, string>)[e.ancre ?? 'debut'] ?? 'start';
        const base = e.base ?? 'alphabetique';
        const lignes = String(e.texte ?? '').split('\n');
        const taille = e.taille ?? 14;
        const nl = lignes.length;
        let dy0 = 0;
        if (base === 'haut') dy0 = taille * 0.8;
        else if (base === 'milieu') dy0 = taille * 0.35 - ((nl - 1) * taille * 1.2) / 2;
        else if (base === 'bas') dy0 = -(nl - 1) * taille * 1.2 - taille * 0.2;
        const rot = e.rotation ?? 0;
        // point central approximatif du texte (pour la surface dessous)
        const largEst = Math.max(...lignes.map((l) => l.replace(/\*\*|\$/g, '').length)) * taille * 0.55;
        const cxT = e.x + (anc === 'start' ? largEst / 2 : anc === 'end' ? -largEst / 2 : 0);
        const cyT = e.y + dy0 - taille * 0.35 + ((nl - 1) * taille * 1.2) / 2;
        const couleur = cls ? coul(e.couleur ?? 'avant') : lisible(coul(e.couleur ?? 'avant'), cxT, cyT);
        // texte de la réponse (orange imposé) sur une surface peu contrastée : liseré de la couleur la plus lisible
        let halo = '';
        let fondT = fondSous(cxT, cyT);
        if (cls && (contraste(couleur, fondT) ?? 99) < CONTRASTE_MIN) {
          const cands = [o.jetons.avant?.sombre ?? '#f2f2f2', o.jetons.avant?.clair ?? '#1a1a1a'];
          fondT = cands.reduce((a, b) => ((contraste(couleur, b) ?? 0) > (contraste(couleur, a) ?? 0) ? b : a));
          halo = ` stroke="${fondT}" stroke-width="${f3(Math.max(2.5, taille * 0.22))}" stroke-linejoin="round" paint-order="stroke"`;
        }
        o.controle?.(String(e.texte ?? ''), couleur, fondT);
        if (lignes.some((l) => /\$[^$]+\$/.test(l))) {
          // ligne(s) avec formule : HTML + MathML dans un foreignObject, posé selon l'ancre et la ligne de base
          const larg = e.largeur ?? Math.max(...lignes.map((l) => l.length)) * taille * 0.62 + taille;
          const haut = nl * taille * 1.6 + taille * 0.6;
          const x0 = anc === 'start' ? e.x : anc === 'end' ? e.x - larg : e.x - larg / 2;
          const yb = e.y + dy0; // ligne de base de la première ligne
          const y0 = yb - taille * 1.15;
          const tr = rot ? ` transform="rotate(${f3(-rot)} ${f3(e.x)} ${f3(e.y)})"` : '';
          return `<foreignObject${cls} x="${f3(x0)}" y="${f3(y0)}" width="${f3(larg)}" height="${f3(haut)}"${tr} data-riche="${esc(lignes.join('\n'))}" data-ancre="${anc}" data-taille="${f3(taille)}" data-couleur="${couleur}" data-valeur="${coul('valeur')}"${e.gras ? ' data-gras="1"' : ''}${e.italique ? ' data-italique="1"' : ''}></foreignObject>`;
        }
        let attrs = `x="${f3(e.x)}" y="${f3(e.y)}" font-size="${f3(taille)}" text-anchor="${anc}" fill="${couleur}"${halo}`;
        if (e.gras) attrs += ' font-weight="bold"';
        if (e.italique) attrs += ' font-style="italic"';
        if (rot) attrs += ` transform="rotate(${f3(-rot)} ${f3(e.x)} ${f3(e.y)})"`;
        const spans = lignes.map((l, k) => `<tspan x="${f3(e.x)}" dy="${f3(k === 0 ? dy0 : taille * 1.2)}">${texteRiche(l)}</tspan>`).join('');
        return `<text${cls} ${attrs}>${spans}</text>`;
      }
      case 'carte': {
        const { x: x0, y: y0, l, h } = e;
        surface(e, coul(e.remplissage ?? 'mer'), (x, y) => x >= x0 && x <= x0 + l && y >= y0 && y <= y0 + h);
        const lo0 = e.lon_min ?? -180;
        const lo1 = e.lon_max ?? 180;
        const la0 = e.lat_min ?? -90;
        const la1 = e.lat_max ?? 90;
        const out = [`<rect x="${f3(x0)}" y="${f3(y0)}" width="${f3(l)}" height="${f3(h)}" fill="${coul(e.remplissage ?? 'mer')}"/>`];
        for (const poly of o.cotes ?? []) {
          const pts = poly.map(([lo, la]) => `${f3(x0 + ((lo - lo0) / (lo1 - lo0)) * l)},${f3(y0 + ((la1 - la) / (la1 - la0)) * h)}`).join(' ');
          out.push(`<polygon points="${pts}" fill="${coul(e.terre ?? 'sol')}" stroke="none"/>`);
        }
        const id = `${prefixe}-c${++n}`;
        defs.push(`<clipPath id="${id}"><rect x="${f3(x0)}" y="${f3(y0)}" width="${f3(l)}" height="${f3(h)}"/></clipPath>`);
        return `<g clip-path="url(#${id})">${out.join('')}</g>`;
      }
      case 'globe': {
        const { cx, cy, r } = e;
        surface(e, coul('mer'), (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2);
        const l0 = e.lon0 ?? 0;
        const p0 = e.lat0 ?? 0;
        const rad = Math.PI / 180;
        const out = [`<circle cx="${f3(cx)}" cy="${f3(cy)}" r="${f3(r)}" fill="${coul('mer')}"/>`];
        const c0 = Math.cos(p0 * rad);
        const s0 = Math.sin(p0 * rad);
        for (const poly of o.cotes ?? []) {
          const seg: string[] = [];
          for (const [lo, la] of poly) {
            const cl = Math.cos(la * rad);
            const sl = Math.sin(la * rad);
            const dl = (lo - l0) * rad;
            const z = s0 * sl + c0 * cl * Math.cos(dl);
            if (z < 0) continue;
            seg.push(`${f3(cx + r * cl * Math.sin(dl))},${f3(cy - r * (c0 * sl - s0 * cl * Math.cos(dl)))}`);
          }
          if (seg.length > 2) out.push(`<polygon points="${seg.join(' ')}" fill="${coul('sol')}" stroke="none"/>`);
        }
        out.push(`<circle cx="${f3(cx)}" cy="${f3(cy)}" r="${f3(r)}" fill="none" stroke="${coul('gris_clair')}"/>`);
        return out.join('');
      }
      case 'image': {
        const im = o.images?.[String(e.ref)];
        if (im) return `<image x="${f3(e.x)}" y="${f3(e.y)}" width="${f3(e.l)}" height="${f3(e.h)}" href="${esc((o.base ?? '') + im.fichier)}" preserveAspectRatio="xMidYMid meet"/>`;
        return `<g><rect x="${f3(e.x)}" y="${f3(e.y)}" width="${f3(e.l)}" height="${f3(e.h)}" fill="${coul('gris_fonce')}" stroke="${coul('gris')}"/></g>`;
      }
      case 'groupe': {
        const tr: string[] = [];
        if (e.translation) tr.push(`translate(${f3(e.translation[0])} ${f3(e.translation[1])})`);
        if ('rotation' in e) tr.push(`rotate(${f3(-e.rotation)})`);
        if ('echelle' in e) tr.push(`scale(${f3(e.echelle)})`);
        let attrs = tr.length ? ` transform="${tr.join(' ')}"` : '';
        if ('opacite' in e) attrs += ` opacity="${f3(e.opacite)}"`;
        const avant = mat;
        let local: Mat = ID;
        if (e.translation) local = mul(local, [1, 0, 0, 1, Number(e.translation[0]), Number(e.translation[1])]);
        if ('rotation' in e) local = mul(local, rotm(-e.rotation));
        if ('echelle' in e) local = mul(local, [Number(e.echelle), 0, 0, Number(e.echelle), 0, 0]);
        mat = mul(mat, local);
        let inner = (e.elements ?? []).map(elt).join('');
        mat = avant;
        if (e.decoupe) {
          const id = `${prefixe}-c${++n}`;
          const [x, y, l, h] = e.decoupe;
          defs.push(`<clipPath id="${id}"><rect x="${f3(x)}" y="${f3(y)}" width="${f3(l)}" height="${f3(h)}"/></clipPath>`);
          inner = `<g clip-path="url(#${id})">${inner}</g>`;
        }
        return `<g${attrs}>${inner}</g>`;
      }
    }
    return '';
  };

  const [w, h] = fig.vue as [number, number];
  const corps = (fig.elements ?? []).map(elt).join('');
  const fond = `<rect width="${f3(w)}" height="${f3(h)}" fill="${coul(fig.fond ?? 'fond')}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f3(w)} ${f3(h)}" role="img" aria-label="${esc(libelle)}" class="figure-q" font-family="Verdana, 'Inter Variable', system-ui, sans-serif">` +
    `<defs>${defs.join('')}</defs>${fond}${corps}</svg>`
  );
}
