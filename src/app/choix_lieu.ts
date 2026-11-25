/**
 * « Choisir un lieu » (jumeau de coupole/modules/td/gui_lieu.py) : carte OpenStreetMap où l'on clique (glisser pour
 * la déplacer, molette ou boutons pour zoomer, pincement au doigt), ou adresse cherchée (Nominatim), puis altitude
 * du terrain (Open-Meteo, Copernicus DEM GLO-90).  Rien n'est envoyé tant qu'on ne clique pas sur « Chercher » ou
 * sur la carte ; les tuiles viennent de tile.openstreetmap.org (attribution affichée).
 */
import { tr, langue } from '../i18n/i18n';
import { h } from './dom';

export interface Choix { lat: number; lon: number; alt: number | null; nom: string }

const TUILE = 256;
const URL_TUILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const URL_GEOCODAGE = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&q={q}&accept-language={langue}';
export const URL_ALTITUDE = 'https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lon}';

export function versMonde(lon: number, lat: number, z: number): [number, number] {
  const n = 2 ** z * TUILE;
  const s = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180);
  return [((lon + 180) / 360) * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
}

export function versLonLat(x: number, y: number, z: number): [number, number] {
  const n = 2 ** z * TUILE;
  const lon = (x / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return [((lon + 540) % 360) - 180, lat];
}

/** « 48.83660 N, 2.33600 E » : ce que relit le lecteur de coordonnées des calculateurs. */
export function textePosition(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(5)} ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(5)} ${lon >= 0 ? 'E' : 'W'}`;
}

export async function geocoder(texte: string): Promise<{ nom: string; court: string; lat: number; lon: number }[]> {
  const url = URL_GEOCODAGE.replace('{q}', encodeURIComponent(texte.trim())).replace('{langue}', langue());
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const liste = (await r.json()) as { display_name?: string; name?: string; lat?: string; lon?: string; address?: Record<string, string> }[];
  return liste.flatMap((x) => {
    const lat = Number(x.lat);
    const lon = Number(x.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const nom = String(x.display_name ?? '');
    const a = x.address ?? {};
    const court = (x.name || ['village', 'town', 'city', 'hamlet', 'municipality'].map((k) => a[k]).find(Boolean) || nom.split(',')[0] || '').trim();
    return [{ nom, court, lat, lon }];
  });
}

export async function altitude(lat: number, lon: number): Promise<number | null> {
  try {
    const r = await fetch(URL_ALTITUDE.replace('{lat}', lat.toFixed(5)).replace('{lon}', lon.toFixed(5)));
    if (!r.ok) return null;
    const v = ((await r.json()) as { elevation?: number[] }).elevation;
    return v && Number.isFinite(v[0]) ? v[0]! : null;
  } catch {
    return null;
  }
}

/** Ouvre la fenêtre ; rend le lieu choisi, ou null si l'on annule. */
export function choisirLieu(depart: { lat: number; lon: number } | null): Promise<Choix | null> {
  return new Promise((fini) => {
    let choix: Choix | null = null;
    let z = depart ? 11 : 5;
    let centre: [number, number] = depart ? [depart.lon, depart.lat] : [2.5, 46.5];
    const adresse = h('input', { type: 'search', id: 'lieu-adresse', autocomplete: 'off', placeholder: tr('lieu_adresse_indice'), title: tr('lieu_adresse_aide') });
    const bChercher = h('button', { type: 'button', class: 'bouton', text: tr('lieu_chercher'), title: tr('lieu_chercher_aide') });
    const resultats = h('ul', { class: 'lieu-resultats', title: tr('lieu_resultats_aide') });
    resultats.hidden = true;
    const tuiles = h('div', { class: 'lieu-tuiles' });
    const repere = h('div', { class: 'lieu-repere' });
    repere.hidden = true;
    const bPlus = h('button', { type: 'button', class: 'bouton lieu-zoom', text: '+', 'aria-label': '+' });
    const bMoins = h('button', { type: 'button', class: 'bouton lieu-zoom', text: '−', 'aria-label': '−' });
    const carte = h('div', { class: 'lieu-carte', title: tr('lieu_carte_aide'), role: 'application', 'aria-label': tr('lieu_carte_aide') },
      tuiles, repere, h('div', { class: 'lieu-boutons-zoom' }, bPlus, bMoins), h('div', { class: 'lieu-osm', text: '© OpenStreetMap' }));
    const etat = h('p', { class: 'td-etat', role: 'status', text: tr('lieu_aucun') });
    const attribution = h('p', { class: 'lieu-attribution' });
    attribution.innerHTML = tr('lieu_attribution');
    const bAnnuler = h('button', { type: 'button', class: 'bouton', text: tr('web_annuler') });
    const bOk = h('button', { type: 'button', class: 'bouton principal', text: tr('lieu_utiliser'), title: tr('lieu_utiliser_aide'), disabled: true });
    const boite = h('dialog', { class: 'lieu-dialogue', 'aria-label': tr('lieu_titre') },
      h('h2', { text: tr('lieu_titre') }), h('p', { class: 'chapo', text: tr('lieu_intro') }),
      h('div', { class: 'td-ligne' }, h('label', { class: 'td-champ', for: 'lieu-adresse' }, h('span', { text: tr('lieu_adresse') }), adresse), bChercher),
      resultats, carte, etat, attribution, h('div', { class: 'td-boutons lieu-fin' }, bAnnuler, bOk));
    document.body.append(boite);

    const dessiner = (): void => {
      const w = carte.clientWidth || 600;
      const hh = carte.clientHeight || 400;
      const [cx, cy] = versMonde(centre[0], centre[1], z);
      const ox = cx - w / 2;
      const oy = cy - hh / 2;
      const n = 2 ** z;
      tuiles.replaceChildren();
      for (let ty = Math.floor(oy / TUILE); ty <= Math.floor((oy + hh) / TUILE); ty++) {
        if (ty < 0 || ty >= n) continue;
        for (let tx = Math.floor(ox / TUILE); tx <= Math.floor((ox + w) / TUILE); tx++) {
          const img = h('img', { alt: '', draggable: 'false', src: URL_TUILES.replace('{z}', String(z)).replace('{x}', String(((tx % n) + n) % n)).replace('{y}', String(ty)) });
          img.style.left = `${tx * TUILE - ox}px`;
          img.style.top = `${ty * TUILE - oy}px`;
          tuiles.append(img);
        }
      }
      if (choix) {
        const [x, y] = versMonde(choix.lon, choix.lat, z);
        repere.hidden = false;
        repere.style.left = `${x - ox}px`;
        repere.style.top = `${y - oy}px`;
      }
    };

    const afficher = (): void => {
      if (!choix) return;
      etat.innerHTML = tr('lieu_choisi', { pos: textePosition(choix.lat, choix.lon), alt: choix.alt === null ? tr('lieu_alt_inconnue') : `${Math.round(choix.alt)} m`, nom: (choix.nom || '—').replace(/[<>&]/g, '') });
      bOk.disabled = false;
    };

    const poser = (lat: number, lon: number, nom: string, chercherAlt = true): void => {
      const c: Choix = { lat, lon, alt: null, nom };
      choix = c;
      afficher();
      dessiner();
      if (!chercherAlt) return;                                    // position déjà saisie : rien n'est envoyé
      void altitude(lat, lon).then((a) => {
        if (choix === c) {
          c.alt = a;
          afficher();
        }
      });
    };

    const zoomer = (dz: number): void => {
      z = Math.max(2, Math.min(18, z + dz));
      dessiner();
    };
    bPlus.addEventListener('click', () => zoomer(1));
    bMoins.addEventListener('click', () => zoomer(-1));
    carte.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoomer(e.deltaY < 0 ? 1 : -1);
    }, { passive: false });
    let glisse: { x: number; y: number; c: [number, number]; bouge: boolean } | null = null;
    carte.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      glisse = { x: e.clientX, y: e.clientY, c: centre, bouge: false };
      carte.setPointerCapture(e.pointerId);
    });
    carte.addEventListener('pointermove', (e) => {
      if (!glisse) return;
      const dx = e.clientX - glisse.x;
      const dy = e.clientY - glisse.y;
      if (Math.abs(dx) + Math.abs(dy) >= 5) glisse.bouge = true;
      if (!glisse.bouge) return;
      const [cx, cy] = versMonde(glisse.c[0], glisse.c[1], z);
      centre = versLonLat(cx - dx, cy - dy, z);
      dessiner();
    });
    carte.addEventListener('pointerup', (e) => {
      if (glisse && !glisse.bouge) {
        const r = carte.getBoundingClientRect();
        const [cx, cy] = versMonde(centre[0], centre[1], z);
        const [lon, lat] = versLonLat(cx - r.width / 2 + (e.clientX - r.left), cy - r.height / 2 + (e.clientY - r.top), z);
        // un clic près du lieu trouvé l'affine : il garde son nom (à moins de 20 km)
        const proche = choix && Math.hypot((lat - choix.lat) * 111, (lon - choix.lon) * 111 * Math.cos((lat * Math.PI) / 180)) < 20;
        poser(lat, lon, proche ? choix!.nom : '');
      }
      glisse = null;
    });

    const chercher = async (): Promise<void> => {
      if (!adresse.value.trim()) return;
      bChercher.disabled = true;
      etat.textContent = tr('lieu_recherche');
      try {
        const liste = await geocoder(adresse.value);
        resultats.replaceChildren();
        resultats.hidden = !liste.length;
        if (!liste.length) {
          etat.textContent = tr('lieu_rien');
          return;
        }
        const prendre = (r: (typeof liste)[number]): void => {
          centre = [r.lon, r.lat];
          z = 14;
          poser(r.lat, r.lon, r.court);
        };
        for (const r of liste) {
          const b = h('button', { type: 'button', class: 'lieu-resultat', text: r.nom });
          b.addEventListener('click', () => prendre(r));
          resultats.append(h('li', {}, b));
        }
        prendre(liste[0]!);
      } catch (err) {
        etat.textContent = tr('lieu_erreur', { erreur: String(err).slice(0, 150) });
      } finally {
        bChercher.disabled = false;
      }
    };
    bChercher.addEventListener('click', () => void chercher());
    adresse.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void chercher();
      }
    });

    const fermer = (r: Choix | null): void => {
      boite.close();
      boite.remove();
      fini(r);
    };
    bAnnuler.addEventListener('click', () => fermer(null));
    bOk.addEventListener('click', () => fermer(choix));
    boite.addEventListener('cancel', (e) => {
      e.preventDefault();
      fermer(null);
    });
    boite.showModal();
    if (depart) poser(depart.lat, depart.lon, '', false);
    else requestAnimationFrame(dessiner);
    adresse.focus();
  });
}
