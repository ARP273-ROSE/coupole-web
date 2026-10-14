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
  const methodes: Record<string, (...a: unknown[]) => unknown> = {
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
