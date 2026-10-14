/**
 * Socle commun des animations (transposition de base.py de Coupole), indépendant du DOM : réglages (curseur + champ
 * à valeur exacte, cases, listes, boutons, champs de saisie), lecture / pause / vitesse / réinitialisation, valeurs
 * affichées, souris.  L'interface (src/app/vue_animation.ts) construit les contrôles HTML à partir de ces modèles et
 * leur reste synchronisée ; les tests utilisent les modèles seuls.
 *
 * Une animation hérite de `Animation`, déclare `ID` (identifiant ClassAction) et redéfinit construire(),
 * avancer(dt), dessiner(p, rect), valeurs() et, si besoin, presser / glisser / relacher (souris).
 */
import { tr } from '../i18n/i18n';
import { c } from '../noyau/dessin';
import { Vue3D } from '../noyau/dessin';
import { type Peintre, type Pt, Rect } from '../noyau/peintre';

export { angle, date_du_jour, duree_hm, heures_minutes, jour_de_date, MOIS_JOURS, nombre } from '../noyau/format';

export const VITESSE_MIN = 0.1;
export const VITESSE_MAX = 10.0;

// ==================================================================== signaux (à la Qt)
export class Signal<A extends unknown[] = []> {
  private fns: ((...a: A) => void)[] = [];
  constructor(private proprio: { signauxBloques: boolean }) {}
  connect(f: (...a: A) => void): void {
    this.fns.push(f);
  }
  emit(...a: A): void {
    if (this.proprio.signauxBloques) return;
    for (const f of [...this.fns]) f(...a);
  }
}

/** Arrondi d'un QDoubleSpinBox (valeur affichée à `dec` décimales, égalités loin de zéro). */
export function arrondiChamp(v: number, dec: number): number {
  if (!Number.isFinite(v)) return v;
  const exact = Math.abs(v).toFixed(Math.min(100, dec + 30));
  const point = exact.indexOf('.');
  const garde = exact.slice(0, point + 1 + dec);
  const suivant = exact.charCodeAt(point + 1 + dec) - 48;
  let r = Number(garde.endsWith('.') ? garde.slice(0, -1) : garde);
  if (suivant >= 5) r = Number((r + 10 ** -dec).toFixed(dec));
  return v < 0 ? -r : r;
}

export type Groupe = 'barre' | 'flux';

export abstract class Controle {
  signauxBloques = false;
  actif = true;
  visible = true;
  /** l'interface s'abonne ici pour rester synchronisée (jamais bloqué) */
  private vues: (() => void)[] = [];
  constructor(
    public cle: string,
    public groupe: Groupe,
  ) {}
  abstract readonly genre: 'curseur' | 'coche' | 'choix' | 'bouton' | 'saisie' | 'etiquette';
  observer(f: () => void): () => void {
    this.vues.push(f);
    return () => {
      this.vues = this.vues.filter((g) => g !== f);
    };
  }
  protected notifierVue(): void {
    for (const f of this.vues) f();
  }
  blockSignals(b: boolean): boolean {
    const avant = this.signauxBloques;
    this.signauxBloques = b;
    return avant;
  }
  setEnabled(b: boolean): void {
    if (this.actif !== b) {
      this.actif = b;
      this.notifierVue();
    }
  }
  isEnabled(): boolean {
    return this.actif;
  }
  setVisible(b: boolean): void {
    if (this.visible !== b) {
      this.visible = b;
      this.notifierVue();
    }
  }
}

/** Libellé + curseur + champ numérique synchronisés (échelle linéaire ou logarithmique) ; valeur exacte gardée. */
export class Reglage extends Controle {
  readonly genre = 'curseur' as const;
  static PAS = 1000;
  valueChanged = new Signal<[number]>(this);
  private v: number;

  constructor(
    cle: string,
    groupe: Groupe,
    public texte: string,
    public mini: number,
    public maxi: number,
    valeur: number,
    public dec = 1,
    public unite = '',
    public log = false,
    public aide = '',
  ) {
    super(cle, groupe);
    // le champ arrondit la valeur de départ à ses décimales, puis la valeur exacte relit le champ (relire_champ)
    this.v = Math.max(mini, Math.min(maxi, arrondiChamp(valeur, dec)));
  }

  pos(v: number): number {
    let t: number;
    if (this.log) {
      v = Math.max(v, this.mini);
      t = (Math.log10(v) - Math.log10(this.mini)) / (Math.log10(this.maxi) - Math.log10(this.mini));
    } else t = this.maxi > this.mini ? (v - this.mini) / (this.maxi - this.mini) : 0;
    return Math.round(Math.max(0.0, Math.min(1.0, t)) * Reglage.PAS);
  }

  val(pos: number): number {
    const t = pos / Reglage.PAS;
    if (this.log) return 10 ** (Math.log10(this.mini) + t * (Math.log10(this.maxi) - Math.log10(this.mini)));
    return this.mini + t * (this.maxi - this.mini);
  }

  /** Le curseur a bougé (position 0…PAS). */
  depuisCurseur(pos: number): void {
    this.appliquer(this.val(pos));
  }

  /** Le champ a été saisi : la valeur est arrondie à ses décimales, comme un QDoubleSpinBox. */
  depuisChamp(v: number): void {
    if (!Number.isFinite(v)) {
      this.notifierVue();
      return;
    }
    this.appliquer(arrondiChamp(Math.max(this.mini, Math.min(this.maxi, v)), this.dec));
  }

  private appliquer(v: number): void {
    v = Math.max(this.mini, Math.min(this.maxi, v));
    const change = v !== this.v;
    this.v = v;
    this.notifierVue();
    if (change) this.valueChanged.emit(v);
  }

  value(): number {
    return this.v;
  }

  setValue(v: number): void {
    this.appliquer(v);
  }

  /** Change les bornes (la valeur est ramenée dedans). */
  borner(mini: number, maxi: number): void {
    this.mini = mini;
    this.maxi = maxi;
    this.appliquer(this.v);
    this.notifierVue();
  }

  /** Valeur affichée dans le champ. */
  valeurChamp(): number {
    return arrondiChamp(this.v, this.dec);
  }
}

export class Coche extends Controle {
  readonly genre = 'coche' as const;
  toggled = new Signal<[boolean]>(this);
  constructor(
    cle: string,
    groupe: Groupe,
    public texte: string,
    private etat: boolean,
    public aide = '',
  ) {
    super(cle, groupe);
  }
  isChecked(): boolean {
    return this.etat;
  }
  setChecked(b: boolean): void {
    if (b === this.etat) return;
    this.etat = b;
    this.notifierVue();
    this.toggled.emit(b);
  }
}

export type Donnee = string | number | boolean | null;

export class Choix extends Controle {
  readonly genre = 'choix' as const;
  currentIndexChanged = new Signal<[number]>(this);
  /** choix fait par l'utilisateur (pas par le programme), comme QComboBox.activated */
  activated = new Signal<[number]>(this);
  options: { texte: string; donnee: Donnee; actif: boolean }[] = [];
  private index = -1;
  constructor(
    cle: string,
    groupe: Groupe,
    public texte: string,
    public aide = '',
  ) {
    super(cle, groupe);
  }
  addItem(texte: string, donnee: Donnee): void {
    this.options.push({ texte, donnee, actif: true });
    if (this.index < 0) {
      this.index = 0;
      this.currentIndexChanged.emit(0);
    }
    this.notifierVue();
  }
  clear(): void {
    this.options = [];
    const avant = this.index;
    this.index = -1;
    this.notifierVue();
    if (avant !== -1) this.currentIndexChanged.emit(-1);
  }
  count(): number {
    return this.options.length;
  }
  findData(d: Donnee): number {
    return this.options.findIndex((o) => o.donnee === d);
  }
  currentIndex(): number {
    return this.index;
  }
  currentData(): Donnee {
    return this.index >= 0 ? this.options[this.index]!.donnee : null;
  }
  currentText(): string {
    return this.index >= 0 ? this.options[this.index]!.texte : '';
  }
  itemData(i: number): Donnee {
    return this.options[i]?.donnee ?? null;
  }
  setItemEnabled(i: number, b: boolean): void {
    const o = this.options[i];
    if (o && o.actif !== b) {
      o.actif = b;
      this.notifierVue();
    }
  }
  setCurrentIndex(i: number): void {
    if (i === this.index || i < -1 || i >= this.options.length) return;
    this.index = i;
    this.notifierVue();
    this.currentIndexChanged.emit(i);
  }
  /** Choix de l'utilisateur dans l'interface. */
  choisirParUtilisateur(i: number): void {
    this.setCurrentIndex(i);
    this.activated.emit(i);
  }
}

export class Bouton extends Controle {
  readonly genre = 'bouton' as const;
  constructor(
    cle: string,
    groupe: Groupe,
    public texte: string,
    public rappel: () => void,
    public aide = '',
    /** bouton de premier plan (lecture) */
    public principal = false,
  ) {
    super(cle, groupe);
  }
  setText(s: string): void {
    this.texte = s;
    this.notifierVue();
  }
  click(): void {
    if (this.actif) this.rappel();
  }
}

/** Champ de texte libre (QLineEdit). */
export class Saisie extends Controle {
  readonly genre = 'saisie' as const;
  textEdited = new Signal<[string]>(this);
  private t = '';
  constructor(
    cle: string,
    groupe: Groupe,
    public texte: string,
    public aide = '',
    public largeur = 8,
  ) {
    super(cle, groupe);
  }
  text(): string {
    return this.t;
  }
  setText(s: string): void {
    this.t = s;
    this.notifierVue();
  }
  /** Saisie de l'utilisateur. */
  editer(s: string): void {
    this.t = s;
    this.textEdited.emit(s);
  }
}

/** Texte simple dans la zone des réglages (QLabel). */
export class Etiquette extends Controle {
  readonly genre = 'etiquette' as const;
  constructor(
    cle: string,
    groupe: Groupe,
    public texte: string,
  ) {
    super(cle, groupe);
  }
  setText(s: string): void {
    this.texte = s;
    this.notifierVue();
  }
}

// ==================================================================== hôte (interface) et souris
export interface Hote {
  /** redessiner la toile et mettre à jour les valeurs (au prochain rafraîchissement d'écran) */
  rafraichir(): void;
  /** la lecture a démarré ou s'est arrêtée */
  lectureChangee(): void;
  /** la liste des contrôles a changé (rare : contrôle ajouté après coup) */
  controlesChanges?(): void;
}

const HOTE_VIDE: Hote = { rafraichir() {}, lectureChangee() {} };

export type Bouton_souris = 'gauche' | 'droit' | 'milieu';
export type Rappel_glisse = (pos: Pt) => void;

/** Réglages à appliquer à la création (adresse partagée ou mémoire du navigateur). */
export type EtatReglages = Record<string, number | boolean | Donnee>;

export interface OptionsCurseur {
  dec?: number;
  unite?: string;
  log?: boolean;
  cle_texte?: string | null;
  cle_aide?: string | null;
  groupe?: Groupe;
  rafraichir?: boolean;
}

export abstract class Animation {
  static ID = '';
  static ANIMEE = true;
  static LECTURE_AU_DEPART = false;

  hote: Hote = HOTE_VIDE;
  controles: Controle[] = [];
  defauts = new Map<string, [Controle, number | boolean | Donnee]>();
  _vues: [Rect, Vue3D][] = [];
  _glisse: Vue3D | Rappel_glisse | null = null;
  en_lecture = false;
  vitesse: Reglage | null = null;
  b_lecture: Bouton | null = null;
  private __etatDepart: EtatReglages;

  constructor(etat: EtatReglages = {}, hote?: Hote) {
    this.__etatDepart = etat;
    if (hote) this.hote = hote;
  }

  get __classe(): typeof Animation {
    return this.constructor as typeof Animation;
  }

  get ID(): string {
    return this.__classe.ID;
  }

  /** Construit les contrôles (à appeler une fois, juste après le constructeur). */
  initialiser(): this {
    const cls = this.__classe;
    if (cls.ANIMEE) {
      this.b_lecture = new Bouton('lecture', 'barre', tr('anim_lecture'), () => this.basculer_lecture(), tr('anim_lecture_aide'), true);
      this.controles.push(this.b_lecture);
      this.vitesse = this.curseur('vitesse', VITESSE_MIN, VITESSE_MAX, 1.0, {
        dec: 2, log: true, cle_texte: 'anim_vitesse', cle_aide: 'anim_vitesse_aide', unite: '×', groupe: 'barre',
        rafraichir: false,
      });
    }
    this.controles.push(new Bouton('reinitialiser', 'barre', tr('anim_reinitialiser'), () => this.reinitialiser(), tr('anim_reinitialiser_aide')));
    this.construire();
    this.rafraichir();
    if (cls.ANIMEE && cls.LECTURE_AU_DEPART) this.basculer_lecture();
    return this;
  }

  // ------------------------------------------------------------ à redéfinir
  construire(): void {}
  avancer(_dt: number): void {}
  dessiner(_p: Peintre, _rect: Rect): void {}
  valeurs(): [string, string][] {
    return [];
  }

  presser(pos: Pt, _bouton: Bouton_souris): boolean {
    for (const [r, vue] of this._vues) {
      if (r.contains(pos)) {
        this._glisse = vue;
        return true;
      }
    }
    return false;
  }

  glisser(pos: Pt, dx: number, dy: number): void {
    if (typeof this._glisse === 'function') {
      this._glisse(pos);
      this.rafraichir();
    } else if (this._glisse !== null) {
      this._glisse.tourner(dx, dy);
      this.hote.rafraichir();
    }
  }

  relacher(_pos: Pt): void {
    this._glisse = null;
  }

  /** Remet l'état interne (temps, positions) à son origine ; appelé par Réinitialiser. */
  etat_initial(): void {}

  // ------------------------------------------------------------ réglages
  private __texte(cle: string, cle_texte?: string | null): string {
    return cle_texte || `anim_${this.ID.toLowerCase()}_${cle}`;
  }

  private __depart(cle: string): number | boolean | Donnee | undefined {
    return Object.prototype.hasOwnProperty.call(this.__etatDepart, cle) ? this.__etatDepart[cle] : undefined;
  }

  curseur(cle: string, mini: number, maxi: number, defaut: number, o: OptionsCurseur = {}): Reglage {
    const ct = this.__texte(cle, o.cle_texte);
    const r = new Reglage(cle, o.groupe ?? 'flux', tr(ct), mini, maxi, defaut, o.dec ?? 1, o.unite ?? '', o.log ?? false, tr(o.cle_aide || ct + '_aide'));
    const m = this.__depart(cle);
    if (typeof m === 'number' && Number.isFinite(m)) r.setValue(arrondiChamp(Math.max(mini, Math.min(maxi, m)), r.dec));
    this.defauts.set(cle, [r, defaut]);
    if (o.rafraichir ?? true) r.valueChanged.connect(() => this.reglage_change());
    this.controles.push(r);
    return r;
  }

  coche(cle: string, defaut = false, cle_texte: string | null = null, groupe: Groupe = 'flux'): Coche {
    const ct = this.__texte(cle, cle_texte);
    const m = this.__depart(cle);
    const w = new Coche(cle, groupe, tr(ct), typeof m === 'boolean' ? m : defaut, tr(ct + '_aide'));
    this.defauts.set(cle, [w, defaut]);
    w.toggled.connect(() => this.reglage_change());
    this.controles.push(w);
    return w;
  }

  /** options : [clé du texte, donnée]. */
  choix(cle: string, options: [string, Donnee][], defaut: Donnee, cle_texte: string | null = null, groupe: Groupe = 'flux'): Choix {
    const ct = this.__texte(cle, cle_texte);
    const w = new Choix(cle, groupe, tr(ct), tr(ct + '_aide'));
    for (const [cle_opt, donnee] of options) w.addItem(tr(cle_opt), donnee);
    w.setCurrentIndex(Math.max(0, w.findData(defaut)));
    const m = this.__depart(cle);
    if (m !== undefined) {
      let i = w.findData(m as Donnee);
      if (i < 0) i = w.options.findIndex((o) => String(o.donnee) === String(m));
      if (i >= 0) w.setCurrentIndex(i);
    }
    this.defauts.set(cle, [w, defaut]);
    w.currentIndexChanged.connect(() => this.reglage_change());
    this.controles.push(w);
    return w;
  }

  bouton(cle_texte: string, rappel: () => void, groupe: Groupe = 'flux'): Bouton {
    const b = new Bouton(cle_texte, groupe, tr(cle_texte), rappel, tr(cle_texte + '_aide'));
    this.controles.push(b);
    return b;
  }

  saisie(cle: string, cle_texte: string, cle_aide = '', largeur = 8): Saisie {
    const s = new Saisie(cle, 'flux', tr(cle_texte), cle_aide ? tr(cle_aide) : '', largeur);
    this.controles.push(s);
    return s;
  }

  etiquette(cle: string, texte: string): Etiquette {
    const e = new Etiquette(cle, 'flux', texte);
    this.controles.push(e);
    return e;
  }

  vue(az: number, alt: number, alt_min = -89.0, alt_max = 89.0): Vue3D {
    return new Vue3D(az, alt, alt_min, alt_max);
  }

  /** À appeler dans dessiner() : la souris fait tourner `vue` dans `rect`. */
  zone_rotative(rect: Rect, vue: Vue3D): void {
    this._vues.push([rect.copie(), vue]);
  }

  reglage_change(): void {
    this.rafraichir();
  }

  reinitialiser(): void {
    for (const [, [w, defaut]] of this.defauts) {
      if (w instanceof Reglage) w.setValue(defaut as number);
      else if (w instanceof Coche) w.setChecked(defaut as boolean);
      else if (w instanceof Choix) w.setCurrentIndex(Math.max(0, w.findData(defaut as Donnee)));
    }
    for (const v of Object.values(this)) if (v instanceof Vue3D) v.reinitialiser();
    this.etat_initial();
    if (this.en_lecture) this.basculer_lecture();
    this.rafraichir();
  }

  /** Réglages courants (pour l'adresse partagée et la mémoire du navigateur). */
  etatReglages(): EtatReglages {
    const out: EtatReglages = {};
    for (const [cle, [w]] of this.defauts) {
      if (w instanceof Reglage) out[cle] = w.valeurChamp();
      else if (w instanceof Coche) out[cle] = w.isChecked();
      else if (w instanceof Choix) out[cle] = w.currentData();
    }
    return out;
  }

  /** Réglages qui diffèrent des valeurs par défaut. */
  etatModifie(): EtatReglages {
    const out: EtatReglages = {};
    const e = this.etatReglages();
    for (const [cle, [w, defaut]] of this.defauts) {
      const v = e[cle];
      const d = w instanceof Reglage ? arrondiChamp(defaut as number, w.dec) : defaut;
      if (v !== d) out[cle] = v as number | boolean | Donnee;
    }
    return out;
  }

  // ------------------------------------------------------------ lecture
  basculer_lecture(): void {
    this.en_lecture = !this.en_lecture;
    if (this.b_lecture) this.b_lecture.setText(tr(this.en_lecture ? 'anim_pause' : 'anim_lecture'));
    this.hote.lectureChangee();
  }

  arreter(): void {
    if (this.en_lecture) this.basculer_lecture();
  }

  /** Un battement de la boucle d'animation : dt en secondes réelles (borné à 0,2 s). */
  battement(dt: number): void {
    const v = this.__classe.ANIMEE && this.vitesse ? this.vitesse.value() : 1.0;
    this.avancer(Math.min(0.2, dt) * v);
    this.rafraichir();
  }

  /** Fait avancer d'un pas (tests, boutons pas à pas). */
  pas(dt = 0.1): void {
    this.avancer(dt);
    this.rafraichir();
  }

  // ------------------------------------------------------------ affichage
  rafraichir(): void {
    this.hote.rafraichir();
  }

  /** Dessine toute la toile (fond compris) dans le rectangle donné. */
  peindre(p: Peintre, r: Rect): void {
    p.fillRect(r, c('fond'));
    this._vues = [];
    p.save();
    try {
      this.dessiner(p, r);
    } finally {
      p.restore();
    }
  }
}

export type ClasseAnimation = (new (etat?: EtatReglages, hote?: Hote) => Animation) & typeof Animation;

export { Rect };
