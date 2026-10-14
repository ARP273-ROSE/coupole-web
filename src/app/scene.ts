/**
 * Toile d'une animation : rendu net (devicePixelRatio), seulement quand quelque chose bouge
 * (requestAnimationFrame), boucle d'animation en lecture (suspendue d'elle-même quand l'onglet est caché),
 * pointeurs (souris, doigt, stylet) : glisser, pincer-zoomer, molette, appui long = clic droit ; clavier.
 */
import type { Animation, Bouton_souris, Hote } from '../anim/base';
import { Peintre, Pt, Rect, reglerTaillePolice } from '../noyau/peintre';

const ZOOM_MAX = 8;
const APPUI_LONG_MS = 550;

export interface Observateur {
  rendu?(): void;
  valeurs?(): void;
  lecture?(): void;
  zoom?(k: number): void;
}

export class Scene implements Hote {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private peintre: Peintre;
  private anim: Animation | null = null;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private demande = false;
  private dernier = 0;
  private derniereMajValeurs = 0;
  private valeursEnRetard = false;
  private k = 1;
  private ox = 0;
  private oy = 0;
  private pointeurs = new Map<number, { x: number; y: number }>();
  private glisse: { id: number; x: number; y: number; x0: number; y0: number; bouge: boolean } | null = null;
  private pince: { d0: number; k0: number; mx0: number; my0: number; ox0: number; oy0: number } | null = null;
  private minuteurLong = 0;
  private obs: ResizeObserver | null = null;
  private detruite = false;
  private surVisibilite = (): void => {
    this.dernier = 0;
    if (!document.hidden) this.demander();
  };

  constructor(
    private boite: HTMLElement,
    private observateur: Observateur = {},
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.tabIndex = 0;
    boite.prepend(this.canvas);
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('canvas 2D indisponible');
    this.ctx = ctx;
    this.peintre = new Peintre(ctx);
    this.brancher();
    this.obs = new ResizeObserver(() => this.redimensionner());
    this.obs.observe(boite);
    document.addEventListener('visibilitychange', this.surVisibilite);
    this.redimensionner();
  }

  attacher(anim: Animation): void {
    this.anim = anim;
    anim.hote = this;
    this.zoomer(1, 0, 0, true);
    this.demander();
  }

  // ------------------------------------------------------------ Hote
  rafraichir(): void {
    this.valeursEnRetard = true;
    this.demander();
  }

  lectureChangee(): void {
    this.dernier = 0;
    this.observateur.lecture?.();
    this.demander();
  }

  // ------------------------------------------------------------ rendu
  private demander(): void {
    if (this.demande || this.detruite) return;
    this.demande = true;
    requestAnimationFrame((t) => this.image(t));
  }

  private image(t: number): void {
    this.demande = false;
    const a = this.anim;
    if (!a || this.detruite) return;
    if (a.en_lecture && !document.hidden) {
      const dt = this.dernier ? (t - this.dernier) / 1000 : 0;
      this.dernier = t;
      if (dt > 0) a.battement(dt);
      this.demander();
    } else this.dernier = 0;
    this.dessiner();
    // les valeurs (texte) : tout de suite à l'arrêt, une dizaine de fois par seconde en lecture
    if (this.valeursEnRetard && (!a.en_lecture || t - this.derniereMajValeurs > 100)) {
      this.valeursEnRetard = false;
      this.derniereMajValeurs = t;
      this.observateur.valeurs?.();
    }
  }

  dessiner(): void {
    const a = this.anim;
    if (!a || !this.w || !this.h) return;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.k, this.k);
    reglerTaillePolice(taillePolice(this.w, this.h));
    this.peintre = new Peintre(ctx);
    a.peindre(this.peintre, new Rect(0, 0, this.w, this.h));
    this.observateur.rendu?.();
  }

  private redimensionner(): void {
    const r = this.boite.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.borner();
    this.demander();
  }

  // ------------------------------------------------------------ zoom
  get zoom(): number {
    return this.k;
  }

  /** Zoom à k autour du point (x, y) de l'écran (pixels CSS de la toile). */
  zoomer(k: number, x: number, y: number, absolu = false): void {
    const nk = Math.max(1, Math.min(ZOOM_MAX, k));
    if (absolu && nk === 1) {
      this.ox = 0;
      this.oy = 0;
    } else {
      this.ox = x - ((x - this.ox) / this.k) * nk;
      this.oy = y - ((y - this.oy) / this.k) * nk;
    }
    this.k = nk;
    this.borner();
    this.observateur.zoom?.(this.k);
    this.demander();
  }

  zoomRelatif(f: number): void {
    this.zoomer(this.k * f, this.w / 2, this.h / 2);
  }

  private borner(): void {
    this.ox = Math.min(0, Math.max(this.w - this.w * this.k, this.ox));
    this.oy = Math.min(0, Math.max(this.h - this.h * this.k, this.oy));
  }

  private logique(x: number, y: number): Pt {
    return new Pt((x - this.ox) / this.k, (y - this.oy) / this.k);
  }

  // ------------------------------------------------------------ pointeurs
  private position(e: PointerEvent | WheelEvent | MouseEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private brancher(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this.bas(e));
    c.addEventListener('pointermove', (e) => this.bouge(e));
    c.addEventListener('pointerup', (e) => this.haut(e));
    c.addEventListener('pointercancel', (e) => this.haut(e));
    c.addEventListener('lostpointercapture', (e) => this.haut(e));
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const p = this.position(e);
        const unite = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
        this.zoomer(this.k * Math.exp(-e.deltaY * unite * 0.0016), p.x, p.y);
      },
      { passive: false },
    );
    c.addEventListener('dblclick', (e) => {
      const p = this.position(e);
      if (this.anim?.doubleClic(this.logique(p.x, p.y))) {
        e.preventDefault();
        return;
      }
      if (this.k !== 1) {
        e.preventDefault();
        this.zoomer(1, 0, 0, true);
      }
    });
    c.addEventListener('keydown', (e) => this.clavier(e));
  }

  private bas(e: PointerEvent): void {
    if (!this.anim) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2 && e.button !== 1) return;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* rien */
    }
    const p = this.position(e);
    this.pointeurs.set(e.pointerId, p);
    if (this.pointeurs.size === 2) {
      this.annulerGlisse();
      const [a, b] = [...this.pointeurs.values()] as [{ x: number; y: number }, { x: number; y: number }];
      this.pince = {
        d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), k0: this.k, mx0: (a.x + b.x) / 2, my0: (a.y + b.y) / 2,
        ox0: this.ox, oy0: this.oy,
      };
      return;
    }
    if (this.pointeurs.size > 2) return;
    this.canvas.focus({ preventScroll: true });
    const bouton: Bouton_souris = e.button === 2 ? 'droit' : e.button === 1 ? 'milieu' : 'gauche';
    this.glisse = { id: e.pointerId, x: p.x, y: p.y, x0: p.x, y0: p.y, bouge: false };
    this.anim.presser(this.logique(p.x, p.y), bouton);
    this.demander();
    if (e.pointerType !== 'mouse') {
      clearTimeout(this.minuteurLong);
      this.minuteurLong = window.setTimeout(() => this.appuiLong(), APPUI_LONG_MS);
    }
  }

  private appuiLong(): void {
    const g = this.glisse;
    const a = this.anim;
    if (!g || g.bouge || !a) return;
    const q = this.logique(g.x, g.y);
    a.relacher(q);
    a.presser(q, 'droit');
    a.relacher(q);
    this.glisse = null;
    navigator.vibrate?.(12);
    this.demander();
  }

  private bouge(e: PointerEvent): void {
    if (!this.pointeurs.has(e.pointerId) || !this.anim) return;
    const p = this.position(e);
    this.pointeurs.set(e.pointerId, p);
    if (this.pince && this.pointeurs.size >= 2) {
      const [a, b] = [...this.pointeurs.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
      const mx = (a.x + b.x) / 2,
        my = (a.y + b.y) / 2;
      const k = Math.max(1, Math.min(ZOOM_MAX, (this.pince.k0 * d) / this.pince.d0));
      // le point de la scène sous le milieu des doigts suit les doigts
      this.ox = mx - ((this.pince.mx0 - this.pince.ox0) / this.pince.k0) * k;
      this.oy = my - ((this.pince.my0 - this.pince.oy0) / this.pince.k0) * k;
      this.k = k;
      this.borner();
      this.observateur.zoom?.(this.k);
      this.demander();
      return;
    }
    const g = this.glisse;
    if (!g || g.id !== e.pointerId) return;
    const dx = p.x - g.x,
      dy = p.y - g.y;
    if (!dx && !dy) return;
    if (Math.hypot(p.x - g.x0, p.y - g.y0) > 8) {
      g.bouge = true;
      clearTimeout(this.minuteurLong);
    }
    g.x = p.x;
    g.y = p.y;
    this.anim.glisser(this.logique(p.x, p.y), dx / this.k, dy / this.k);
    this.demander();
  }

  private haut(e: PointerEvent): void {
    if (!this.pointeurs.has(e.pointerId)) return;
    this.pointeurs.delete(e.pointerId);
    clearTimeout(this.minuteurLong);
    if (this.pince && this.pointeurs.size < 2) {
      this.pince = null;
      return;
    }
    const g = this.glisse;
    if (g && g.id === e.pointerId) {
      this.glisse = null;
      this.anim?.relacher(this.logique(g.x, g.y));
      this.demander();
    }
  }

  private annulerGlisse(): void {
    clearTimeout(this.minuteurLong);
    if (this.glisse) {
      this.anim?.relacher(this.logique(this.glisse.x, this.glisse.y));
      this.glisse = null;
    }
  }

  // ------------------------------------------------------------ clavier
  private clavier(e: KeyboardEvent): void {
    const a = this.anim;
    if (!a) return;
    const pas = e.shiftKey ? 45 : 12;
    let fait = true;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        const vue = a._vues[0]?.[1];
        if (vue) {
          const dx = e.key === 'ArrowLeft' ? -pas : e.key === 'ArrowRight' ? pas : 0;
          const dy = e.key === 'ArrowUp' ? -pas : e.key === 'ArrowDown' ? pas : 0;
          vue.tourner(dx, dy);
          a.rafraichir();
        } else if (this.k > 1) {
          this.ox -= e.key === 'ArrowLeft' ? -40 : e.key === 'ArrowRight' ? 40 : 0;
          this.oy -= e.key === 'ArrowUp' ? -40 : e.key === 'ArrowDown' ? 40 : 0;
          this.borner();
          this.demander();
        } else fait = false;
        break;
      }
      case '+':
      case '=':
        this.zoomRelatif(1.25);
        break;
      case '-':
      case '_':
        this.zoomRelatif(0.8);
        break;
      case '0':
        this.zoomer(1, 0, 0, true);
        break;
      case ' ':
        if (a.b_lecture) a.basculer_lecture();
        else fait = false;
        break;
      default:
        fait = false;
    }
    if (fait) e.preventDefault();
  }

  detruire(): void {
    this.detruite = true;
    this.obs?.disconnect();
    document.removeEventListener('visibilitychange', this.surVisibilite);
    clearTimeout(this.minuteurLong);
    if (this.anim) {
      if (this.anim.en_lecture) this.anim.en_lecture = false;
      this.anim.hote = { rafraichir() {}, lectureChangee() {} };
    }
    this.anim = null;
  }
}

/** Taille de base du texte des animations selon la taille de la toile (12 à 15 px). */
export function taillePolice(w: number, h: number): number {
  const m = Math.min(w, h);
  return Math.max(12, Math.min(15, 12 + (m - 420) / 220));
}
