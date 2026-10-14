/**
 * Vignettes du catalogue, dessinées par les animations elles-mêmes (état de départ, thème et langue courants) :
 * seulement quand la carte devient visible, une à la fois, aux moments creux, pour garder le défilement fluide.
 */
import { charger, PAR_ID } from '../anim/registre';
import { chargerAnimations, langue } from '../i18n/i18n';
import { choisirTheme, type Theme } from '../noyau/dessin';
import { Peintre, Rect, reglerTaillePolice } from '../noyau/peintre';

const LARGEUR = 440;
const HAUTEUR = 275;

function themeActuel(): Theme {
  return document.documentElement.dataset.theme === 'clair' ? 'clair' : 'sombre';
}

const attente = (): Promise<void> =>
  new Promise((ok) => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => ok(), { timeout: 400 });
    else setTimeout(ok, 16);
  });

async function dessiner(toile: HTMLCanvasElement): Promise<void> {
  const e = PAR_ID.get(toile.dataset.anim ?? '');
  if (!e) return;
  const cls = await charger(e);
  const boite = toile.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(160, Math.round(boite.width || 320));
  const hh = Math.round((w * HAUTEUR) / LARGEUR);
  toile.width = Math.round(w * dpr);
  toile.height = Math.round(hh * dpr);
  const ctx = toile.getContext('2d', { alpha: false });
  if (!ctx) return;
  choisirTheme(themeActuel());
  const k = (w * dpr) / LARGEUR;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  reglerTaillePolice(12);
  const a = new cls().initialiser();
  a.en_lecture = false;
  a.peindre(new Peintre(ctx), new Rect(0, 0, LARGEUR, HAUTEUR));
  toile.dataset.theme = themeActuel();
  toile.dataset.langue = langue();
  toile.classList.add('prete');
}

export function observerVignettes(racine: HTMLElement): () => void {
  let fini = false;
  const file: HTMLCanvasElement[] = [];
  let enCours = false;
  const traiter = async (): Promise<void> => {
    if (enCours) return;
    enCours = true;
    try {
      await chargerAnimations(langue());
      while (file.length && !fini) {
        const t = file.shift()!;
        if (!t.isConnected) continue;
        await attente();
        try {
          await dessiner(t);
        } catch (err) {
          console.warn('vignette', t.dataset.anim, err);
        }
      }
    } finally {
      enCours = false;
    }
  };
  const io = new IntersectionObserver(
    (entrees) => {
      for (const en of entrees) {
        if (!en.isIntersecting) continue;
        const t = en.target as HTMLCanvasElement;
        io.unobserve(t);
        file.push(t);
      }
      void traiter();
    },
    { rootMargin: '200px 0px' },
  );
  const toiles = [...racine.querySelectorAll<HTMLCanvasElement>('canvas[data-anim]')];
  for (const t of toiles) io.observe(t);
  // changement de thème : redessiner les vignettes déjà faites
  const surTheme = (): void => {
    for (const t of toiles) if (t.classList.contains('prete') && t.dataset.theme !== themeActuel()) file.push(t);
    void traiter();
  };
  window.addEventListener('coupole:theme', surTheme);
  return () => {
    fini = true;
    io.disconnect();
    window.removeEventListener('coupole:theme', surTheme);
  };
}
