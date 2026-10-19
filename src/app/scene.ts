/**
 * Toile d'une animation : rendu net (devicePixelRatio), seulement quand quelque chose bouge
 * (requestAnimationFrame), boucle d'animation en lecture (suspendue d'elle-même quand l'onglet est caché),
 * pointeurs (souris, doigt, stylet) : glisser, pincer-zoomer, molette, appui long = clic droit ; clavier.
 */
import type { Animation, Bouton_souris, Hote, Survolable } from '../anim/base';
import type { CibleFiche } from './fiche_flottante';
import { titresPoses } from '../noyau/dessin';
import { Peintre, Pt, Rect, reglerTaillePolice } from '../noyau/peintre';

const ZOOM_MAX = 8;
const APPUI_LONG_MS = 550;
/** appui long qui « saisit » une scène à tourner (au doigt, hors plein écran ; un doigt seul fait défiler la page) */
const SAISIE_SCENE_MS = 300;
const CLE_AIDE_DOIGTS = 'coupole-web:aide-deux-doigts';

export interface Observateur {
  rendu?(): void;
  valeurs?(): void;
  lecture?(): void;
  zoom?(k: number): void;
  /** objet désigné (survol, toucher, clavier) : sa fiche, ou null pour la cacher */
  fiche?(c: CibleFiche | null): void;
}

type Origine = 'souris' | 'toucher' | 'clavier';

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
  private glisse: { id: number; x: number; y: number; x0: number; y0: number; bouge: boolean; pris: boolean; bouton: Bouton_souris; doigt: boolean } | null = null;
  private pince: {
    d0: number; k0: number; mx0: number; my0: number; ox0: number; oy0: number;
    /** deux doigts sur une scène à tourner : le milieu des doigts la fait tourner, l'écart zoome */
    rotation: boolean; mxp: number; myp: number;
  } | null = null;
  /** pincement mesuré par Safari (gesturechange) : il commande le zoom, les pointeurs ne gardent que la rotation */
  private gesteSafari: { k0: number; x0: number; y0: number; ox0: number; oy0: number } | null = null;
  private minuteurLong = 0;
  /**
   * Au doigt, le geste en cours manipule un objet ou la scène : la page ne défile pas (touchstart et touchmove
   * empêchés).  Sinon le défilement vertical de la page reste natif (touch-action: pan-y).
   */
  private toucherBloque = false;
  private minuteurSaisie = 0;
  /** libellé accessible de la toile (nom de l'animation) ; les titres complets des panneaux y sont ajoutés */
  libelle = '';
  private titres: { x: number; y: number; w: number; h: number; complet: string; abrege: boolean }[] = [];
  private signatureTitres = '';
  private infobulle = false;
  /** objet dont la fiche est montrée, et comment il a été désigné */
  private designe: { fiche: string; origine: Origine } | null = null;
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
    // WebKit : une boîte observée avant d'être dans la page n'est jamais signalée (toile restée 1 × 1) ; on attend
    // qu'elle soit dans la page et mise en page, puis on l'observe de nouveau et on la mesure
    let essais = 0;
    const verifier = (): void => {
      if (this.detruite) return;
      const r = this.boite.getBoundingClientRect();
      if (this.boite.isConnected && r.width > 1 && r.height > 1) {
        this.obs?.unobserve(this.boite);
        this.obs?.observe(this.boite);
        this.redimensionner();
      } else if (essais++ < 240) requestAnimationFrame(verifier);
    };
    requestAnimationFrame(verifier);
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
    if (this.w <= 1 || this.h <= 1) this.redimensionner();
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
    const t0 = performance.now();
    a.peindre(this.peintre, new Rect(0, 0, this.w, this.h));
    this.mesurer(performance.now() - t0);
    this.majTitres();
    this.suivreFiche();
    this.observateur.rendu?.();
  }

  /** Durée de rendu des images (ms) : moyenne et maximum des 15 dernières, dans data-ms (mesures, tests). */
  private durees: number[] = [];
  private mesurer(ms: number): void {
    this.durees.push(ms);
    if (this.durees.length >= 15) {
      const moy = this.durees.reduce((a, b) => a + b, 0) / this.durees.length;
      this.canvas.dataset.ms = `${moy.toFixed(2)} ${Math.max(...this.durees).toFixed(2)}`;
      this.durees = [];
    }
  }

  /**
   * Titres des panneaux : leur boîte (pixels CSS, pour l'infobulle des titres abrégés et les tests) et le texte complet
   * dans le libellé accessible de la toile.
   */
  private majTitres(): void {
    const d = this.dpr;
    this.titres = titresPoses().map((t) => ({
      x: t.boite.x / d, y: t.boite.y / d, w: t.boite.w / d, h: t.boite.h / d, complet: t.complet, abrege: t.abrege,
    }));
    const sig = JSON.stringify(this.titres.map((t) => [Math.round(t.x), Math.round(t.y), Math.round(t.w), Math.round(t.h), t.complet, t.abrege]));
    if (sig === this.signatureTitres) return;
    this.signatureTitres = sig;
    this.canvas.dataset.titres = JSON.stringify(
      titresPoses().map((t) => ({
        boite: [t.boite.x / d, t.boite.y / d, t.boite.w / d, t.boite.h / d],
        panneau: [t.panneau.x / d, t.panneau.y / d, t.panneau.w / d, t.panneau.h / d],
        complet: t.complet, lignes: t.lignes, abrege: t.abrege,
      })),
    );
    if (this.libelle) {
      const noms = [...new Set(this.titres.map((t) => t.complet))];
      this.canvas.setAttribute('aria-label', noms.length ? `${this.libelle} — ${noms.join(' ; ')}` : this.libelle);
    }
  }

  // ------------------------------------------------------------ fiche de l'objet désigné
  private versEcran(o: Survolable): CibleFiche {
    return { fiche: o.fiche, x: o.x * this.k + this.ox, y: o.y * this.k + this.oy, r: o.r * this.k };
  }

  /** Désigne un objet (ou aucun) et montre sa fiche. */
  designer(o: Survolable | null, origine: Origine = 'souris'): void {
    this.designe = o ? { fiche: o.fiche, origine } : null;
    this.canvas.dataset.fiche = o ? o.fiche : '';
    this.observateur.fiche?.(o ? this.versEcran(o) : null);
  }

  /** Après chaque image : la fiche suit son objet (qui a pu bouger), ou disparaît avec lui. */
  private suivreFiche(): void {
    const d = this.designe;
    const a = this.anim;
    if (!d || !a) return;
    const o = a.survolables.find((u) => u.fiche === d.fiche);
    if (!o) {
      this.designer(null);
      return;
    }
    this.observateur.fiche?.(this.versEcran(o));
  }

  /** Clavier : objet suivant (sens +1) ou précédent (−1) du plus brillant au plus faible ; faux au bout de la liste. */
  private objetSuivant(sens: 1 | -1, boucler: boolean): boolean {
    const a = this.anim;
    if (!a) return false;
    const liste = a.objets_ordonnes();
    if (!liste.length) return false;
    const i = this.designe ? liste.findIndex((o) => o.fiche === this.designe!.fiche) : -1;
    let j = i < 0 ? (sens > 0 ? 0 : liste.length - 1) : i + sens;
    if (j < 0 || j >= liste.length) {
      if (!boucler) {
        this.designer(null);
        return false;
      }
      j = (j + liste.length) % liste.length;
    }
    this.designer(liste[j]!, 'clavier');
    return true;
  }

  /** Infobulle du titre complet quand la souris survole un titre abrégé (rien ailleurs sur la toile). */
  private survolTitre(x: number, y: number): void {
    const t = this.titres.find((u) => u.abrege && x >= u.x && x <= u.x + u.w && y >= u.y && y <= u.y + u.h);
    if (t) {
      this.canvas.title = t.complet;
      this.infobulle = true;
    } else if (this.infobulle) {
      this.canvas.removeAttribute('title');
      this.infobulle = false;
    }
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
    // le doigt sur un objet (ou deux doigts, ou plein écran) : pas de défilement ni de zoom de la page ; ailleurs, la
    // page défile (pointerdown arrive avant touchstart : la décision est déjà prise)
    const bloquer = (e: TouchEvent): void => {
      if (e.cancelable && (this.toucherBloque || this.pince || (e.touches?.length ?? 0) >= 2 || this.pleinEcran())) e.preventDefault();
    };
    c.addEventListener('touchstart', bloquer, { passive: false });
    c.addEventListener('touchmove', bloquer, { passive: false });
    // Safari (iPhone, iPad, et PWA installée) : le pincement arrive aussi en « gesturestart / gesturechange »
    // (échelle mesurée par le système) ; on s'en sert pour le zoom, ce qui marche même si WebKit a annulé les
    // pointeurs (pointercancel) en cours de geste, et on empêche le zoom de la page entière
    const geste = (e: Event): void => {
      const g = e as Event & { scale?: number; clientX?: number; clientY?: number };
      e.preventDefault();
      if (!this.anim) return;
      if (e.type === 'gestureend') {
        this.gesteSafari = null;
        return;
      }
      const r = this.canvas.getBoundingClientRect();
      if (e.type === 'gesturestart' || !this.gesteSafari) {
        const x = Number.isFinite(g.clientX) ? g.clientX! - r.left : this.w / 2;
        const y = Number.isFinite(g.clientY) ? g.clientY! - r.top : this.h / 2;
        this.gesteSafari = { k0: this.k, x0: x, y0: y, ox0: this.ox, oy0: this.oy };
        if (e.type === 'gesturestart') return;
      }
      const s0 = this.gesteSafari;
      const echelle = Number.isFinite(g.scale) && g.scale! > 0 ? g.scale! : 1;
      const k = Math.max(1, Math.min(ZOOM_MAX, s0.k0 * echelle));
      // le point de la scène sous les doigts au départ reste sous les doigts
      this.ox = s0.x0 - ((s0.x0 - s0.ox0) / s0.k0) * k;
      this.oy = s0.y0 - ((s0.y0 - s0.oy0) / s0.k0) * k;
      this.k = k;
      this.borner();
      this.observateur.zoom?.(this.k);
      this.demander();
    };
    for (const t of ['gesturestart', 'gesturechange', 'gestureend']) c.addEventListener(t, geste, { passive: false });
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
    c.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && this.designe?.origine === 'souris') this.designer(null);
    });
    c.addEventListener('blur', () => {
      if (this.designe?.origine === 'clavier') this.designer(null);
    });
  }

  private bas(e: PointerEvent): void {
    if (!this.anim) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2 && e.button !== 1) return;
    // nouveau geste (premier doigt, souris, stylet) : tout pointeur resté en mémoire est périmé (relâché ailleurs,
    // geste avalé par le système…) ; sans ce ménage, le doigt suivant passait pour un pincement et rien ne tournait
    if (e.isPrimary && this.pointeurs.size) {
      this.pointeurs.clear();
      this.pince = null;
      this.annulerGlisse();
    }
    if (e.isPrimary) {
      this.toucherBloque = false;
      this.boite.classList.remove('saisie');
    }
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
      const mx = (a.x + b.x) / 2,
        my = (a.y + b.y) / 2;
      // deux doigts sur une scène à tourner : le milieu des doigts la fait tourner (et l'écart zoome)
      let rotation = false;
      if (e.pointerType === 'touch') {
        this.toucherBloque = true;
        this.anim.scene_tenue = false;
        if (this.anim.presser(this.logique(mx, my), 'gauche')) {
          if (this.anim.saisie_scene()) rotation = true;
          else this.anim.relacher(this.logique(mx, my));
        }
      }
      this.pince = {
        d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), k0: this.k, mx0: mx, my0: my,
        ox0: this.ox, oy0: this.oy, rotation, mxp: mx, myp: my,
      };
      return;
    }
    if (this.pointeurs.size > 2) return;
    this.canvas.focus({ preventScroll: true });
    const bouton: Bouton_souris = e.button === 2 ? 'droit' : e.button === 1 ? 'milieu' : 'gauche';
    this.glisse = { id: e.pointerId, x: p.x, y: p.y, x0: p.x, y0: p.y, bouge: false, pris: false, bouton, doigt: e.pointerType === 'touch' && !this.pleinEcran() };
    this.glisse.pris = this.saisir(this.glisse);
    this.demander();
    if (e.pointerType !== 'mouse') {
      clearTimeout(this.minuteurLong);
      this.minuteurLong = window.setTimeout(() => this.appuiLong(), APPUI_LONG_MS);
    }
  }

  /** Le pointeur est-il en plein écran (un doigt y manipule tout) ? */
  private pleinEcran(): boolean {
    const f = typeof document !== 'undefined' ? document.fullscreenElement : null;
    return !!f && f.contains(this.canvas);
  }

  /**
   * Saisie à l'appui (ou retentée au glisser).  Souris, stylet, plein écran : comme avant.  Doigt : un objet (astre,
   * poignée, flèche, curseur dessiné) est saisi et la page ne défile plus ; une scène à tourner ne l'est pas (un doigt
   * fait défiler la page) : il faut deux doigts, ou un appui long qui la saisit.
   */
  private saisir(g: NonNullable<Scene['glisse']>): boolean {
    const a = this.anim;
    if (!a) return false;
    a.scene_tenue = false;
    const pris = a.presser(this.logique(g.x, g.y), g.bouton);
    if (!pris || !g.doigt) {
      if (pris && g.doigt) this.toucherBloque = true;
      return pris;
    }
    if (!a.saisie_scene()) {
      this.toucherBloque = true;
      return true;
    }
    // scène à tourner : relâchée tout de suite ; un appui long sans bouger la saisit
    a.relacher(this.logique(g.x, g.y));
    a.scene_tenue = false;
    this.aideDeuxDoigts();
    clearTimeout(this.minuteurSaisie);
    this.minuteurSaisie = window.setTimeout(() => {
      const h = this.glisse;
      if (!h || h !== g || h.bouge || h.pris || !this.anim) return;
      this.anim.scene_tenue = false;
      h.pris = this.anim.presser(this.logique(h.x, h.y), h.bouton);
      if (h.pris) {
        this.toucherBloque = true;
        this.boite.classList.add('saisie');
        navigator.vibrate?.(8);
        this.demander();
      }
    }, SAISIE_SCENE_MS);
    return false;
  }

  /** « Deux doigts pour tourner, un doigt pour défiler » : une fois, au premier doigt posé sur une scène à tourner. */
  private aideDeuxDoigts(): void {
    try {
      if (localStorage.getItem(CLE_AIDE_DOIGTS)) return;
      localStorage.setItem(CLE_AIDE_DOIGTS, '1');
    } catch {
      return;
    }
    const bulle = document.createElement('div');
    bulle.className = 'aide-doigts';
    bulle.setAttribute('role', 'status');
    bulle.textContent = this.textes.deuxDoigts;
    this.boite.append(bulle);
    window.setTimeout(() => bulle.remove(), 4000);
  }

  /** textes de l'interface (posés par la page) */
  textes = { deuxDoigts: 'Deux doigts pour tourner, un doigt pour défiler' };

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
    if (!this.pointeurs.has(e.pointerId)) {
      if (e.pointerType === 'mouse' && this.anim) {
        const p = this.position(e);
        this.survolTitre(p.x, p.y);
        const q = this.logique(p.x, p.y);
        if (this.anim.survoler(q)) this.demander();
        const o = this.anim.objet_sous(q, 4);
        if (o) {
          if (this.designe?.fiche !== o.fiche) this.designer(o, 'souris');
        } else if (this.designe?.origine === 'souris') this.designer(null);
      }
      return;
    }
    if (!this.anim) return;
    const p = this.position(e);
    this.pointeurs.set(e.pointerId, p);
    if (this.pince && this.pointeurs.size >= 2) {
      const [a, b] = [...this.pointeurs.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
      const mx = (a.x + b.x) / 2,
        my = (a.y + b.y) / 2;
      const k = Math.max(1, Math.min(ZOOM_MAX, (this.pince.k0 * d) / this.pince.d0));
      if (this.pince.rotation) {
        // rotation par le milieu des doigts, zoom autour du point de départ (Safari : zoom par gesturechange)
        const dmx = mx - this.pince.mxp,
          dmy = my - this.pince.myp;
        this.pince.mxp = mx;
        this.pince.myp = my;
        if (this.gesteSafari) {
          if (dmx || dmy) this.anim.glisser(this.logique(mx, my), dmx / this.k, dmy / this.k);
          this.demander();
          return;
        }
        this.ox = this.pince.mx0 - ((this.pince.mx0 - this.pince.ox0) / this.pince.k0) * k;
        this.oy = this.pince.my0 - ((this.pince.my0 - this.pince.oy0) / this.pince.k0) * k;
        this.k = k;
        this.borner();
        if (dmx || dmy) this.anim.glisser(this.logique(mx, my), dmx / this.k, dmy / this.k);
        this.observateur.zoom?.(this.k);
        this.demander();
        return;
      }
      // Safari : le zoom vient de gesturechange (une seule source, pas de zoom en double)
      if (this.gesteSafari) return;
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
      clearTimeout(this.minuteurSaisie);
    }
    g.x = p.x;
    g.y = p.y;
    // rien n'a été saisi à l'appui (scène pas encore dessinée, réglage changé à cet instant…) : on retente ici, le
    // glisser ne dépend ainsi ni du focus ni de ce qui s'est passé juste avant (au doigt : un objet seulement, une
    // scène à tourner laisse la page défiler)
    if (!g.pris) {
      g.pris = this.saisir(g);
      if (g.pris) this.demander();
      return;
    }
    this.anim.glisser(this.logique(p.x, p.y), dx / this.k, dy / this.k);
    this.demander();
  }

  private haut(e: PointerEvent): void {
    if (!this.pointeurs.has(e.pointerId)) return;
    this.pointeurs.delete(e.pointerId);
    clearTimeout(this.minuteurLong);
    clearTimeout(this.minuteurSaisie);
    if (!this.pointeurs.size) {
      this.toucherBloque = false;
      this.boite.classList.remove('saisie');
    }
    if (this.pince && this.pointeurs.size < 2) {
      if (this.pince.rotation) this.anim?.relacher(this.logique(this.pince.mxp, this.pince.myp));
      this.pince = null;
      return;
    }
    const g = this.glisse;
    if (g && g.id === e.pointerId) {
      this.glisse = null;
      const q = this.logique(g.x, g.y);
      this.anim?.relacher(q);
      // toucher (ou clic) sans glisser : l'objet touché montre sa fiche ; à côté, la fiche se ferme
      if (!g.bouge && this.anim && e.type === 'pointerup') {
        const o = this.anim.objet_sous(q, e.pointerType === 'mouse' ? 4 : 14);
        if (o) this.designer(o, e.pointerType === 'mouse' ? 'souris' : 'toucher');
        else if (this.designe && this.designe.origine !== 'souris') this.designer(null);
      }
      this.demander();
    }
  }

  private annulerGlisse(): void {
    clearTimeout(this.minuteurLong);
    clearTimeout(this.minuteurSaisie);
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
    // objets à fiche : Tab les parcourt (puis la toile rend le focus), les flèches aussi quand une fiche est ouverte
    if (e.key === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey && a.survolables.length) {
      if (this.objetSuivant(e.shiftKey ? -1 : 1, false)) e.preventDefault();
      return;
    }
    if (e.key === 'Escape' && this.designe) {
      this.designer(null);
      e.preventDefault();
      return;
    }
    if (this.designe?.origine === 'clavier' && e.key.startsWith('Arrow')) {
      this.objetSuivant(e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1, true);
      e.preventDefault();
      return;
    }
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
    clearTimeout(this.minuteurSaisie);
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
