/**
 * Faux contexte 2D pour dessiner hors navigateur : chaque appel est compté, les coordonnées reçues sont vérifiées
 * (pas de NaN) ; measureText rend une largeur plausible.  Sert aux tests de rendu de toutes les animations.
 */
export interface Bilan {
  appels: number;
  traces: number;
  textes: string[];
  nonFinis: string[];
}

class FauxChemin {
  moveTo(): void {}
  lineTo(): void {}
  closePath(): void {}
  rect(): void {}
  ellipse(): void {}
  arc(): void {}
  arcTo(): void {}
  bezierCurveTo(): void {}
  quadraticCurveTo(): void {}
  addPath(): void {}
}

export function installerPath2D(): void {
  const g = globalThis as Record<string, unknown>;
  if (!g.Path2D) g.Path2D = FauxChemin;
}

export function fauxContexte(): { ctx: CanvasRenderingContext2D; bilan: Bilan } {
  installerPath2D();
  const bilan: Bilan = { appels: 0, traces: 0, textes: [], nonFinis: [] };
  const etat: Record<string, unknown> = { font: '13px sans-serif', lineWidth: 1 };
  const verifier = (nom: string, args: unknown[]): void => {
    for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) bilan.nonFinis.push(nom);
  };
  // matrice courante (a b c d e f), pile de save/restore : getTransform rend des boîtes d'étiquettes exactes
  let m = [1, 0, 0, 1, 0, 0];
  const pile: number[][] = [];
  const multiplier = (n: number[]): void => {
    const [a, b, c, d, e, f] = m as [number, number, number, number, number, number];
    const [A, B, C, D, E, F] = n as [number, number, number, number, number, number];
    m = [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f];
  };
  const methodes: Record<string, (...a: unknown[]) => unknown> = {
    save: () => {
      pile.push([...m]);
    },
    restore: () => {
      m = pile.pop() ?? [1, 0, 0, 1, 0, 0];
    },
    translate: (x: unknown, y: unknown) => multiplier([1, 0, 0, 1, x as number, y as number]),
    transform: (...a: unknown[]) => {
      verifier('transform', a);
      multiplier(a.slice(0, 6) as number[]);
    },
    scale: (x: unknown, y: unknown) => multiplier([x as number, 0, 0, y as number, 0, 0]),
    rotate: (t: unknown) => {
      const c = Math.cos(t as number),
        s = Math.sin(t as number);
      multiplier([c, s, -s, c, 0, 0]);
    },
    setTransform: (...a: unknown[]) => {
      m = a.length >= 6 ? (a.slice(0, 6) as number[]) : [1, 0, 0, 1, 0, 0];
    },
    resetTransform: () => {
      m = [1, 0, 0, 1, 0, 0];
    },
    getTransform: () => ({ a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }),
    measureText: (s: unknown) => {
      const taille = parseFloat(/([\d.]+)px/.exec(String(etat.font))?.[1] ?? '13');
      return { width: String(s).length * taille * 0.55, actualBoundingBoxAscent: taille * 0.75 };
    },
    fillText: (s: unknown, x: unknown, y: unknown) => {
      bilan.textes.push(String(s));
      verifier('fillText', [x, y]);
    },
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    stroke: () => {
      bilan.traces++;
    },
    fill: () => {
      bilan.traces++;
    },
    fillRect: (...a: unknown[]) => {
      bilan.traces++;
      verifier('fillRect', a);
    },
  };
  const ctx = new Proxy(etat, {
    get(cible, nom: string) {
      if (nom in methodes) {
        return (...a: unknown[]) => {
          bilan.appels++;
          return methodes[nom]!(...a);
        };
      }
      if (nom in cible) return cible[nom];
      return (...a: unknown[]) => {
        bilan.appels++;
        verifier(nom, a);
      };
    },
    set(cible, nom: string, v) {
      cible[nom] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, bilan };
}
