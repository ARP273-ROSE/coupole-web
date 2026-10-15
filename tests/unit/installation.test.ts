/** Règles d'installation : détection du navigateur (dont l'iPad qui se présente comme un Mac) et « ne pas harceler ». */
import { describe, expect, it } from 'vitest';
import { DELAI_PLUS_TARD, doitProposer, ETAT_VIDE, etatValide, plateforme, proposable } from '../../src/app/installation_regles';

const UA = {
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  opera: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OPR/114.0.0.0',
  chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  chromeIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1',
  ipadMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  safari16: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
  firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
  autre: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Epiphany/46 Safari/605.1.15',
};

describe('plateforme', () => {
  it('Chromium sous toutes ses formes', () => {
    for (const u of [UA.chromeAndroid, UA.samsung, UA.edge, UA.opera, UA.chromeMac]) expect(plateforme({ ua: u, maxTouchPoints: 0 }), u).toBe('chromium');
  });
  it('iPhone, Chrome sur iPhone, iPadOS en « Mac » tactile', () => {
    expect(plateforme({ ua: UA.iphone, maxTouchPoints: 5 })).toBe('ios');
    expect(plateforme({ ua: UA.chromeIphone, maxTouchPoints: 5 })).toBe('ios');
    expect(plateforme({ ua: UA.ipadMac, platform: 'MacIntel', maxTouchPoints: 5 })).toBe('ios');
  });
  it('Safari macOS : 17+ seulement', () => {
    expect(plateforme({ ua: UA.ipadMac, platform: 'MacIntel', maxTouchPoints: 0 })).toBe('mac-safari');
    expect(plateforme({ ua: UA.safari16, platform: 'MacIntel', maxTouchPoints: 0 })).toBe('autre');
  });
  it('Firefox Android, Firefox ordinateur, autres', () => {
    expect(plateforme({ ua: UA.firefoxAndroid })).toBe('firefox-android');
    expect(plateforme({ ua: UA.firefox })).toBe('firefox');
    expect(plateforme({ ua: UA.autre })).toBe('autre');
  });
  it('proposable : invite captée, ou plateforme à instructions', () => {
    expect(proposable('chromium', false)).toBe(false);
    expect(proposable('chromium', true)).toBe(true);
    expect(proposable('ios', false)).toBe(true);
    expect(proposable('mac-safari', false)).toBe(true);
    expect(proposable('firefox-android', false)).toBe(true);
    expect(proposable('firefox', false)).toBe(false);
    expect(proposable('autre', false)).toBe(false);
  });
});

describe('ne pas harceler', () => {
  const t = Date.UTC(2026, 9, 15);
  it('après un premier usage seulement (2ᵉ visite ou 30 s)', () => {
    expect(doitProposer({ ...ETAT_VIDE, visites: 1 }, t, false, true)).toBe(false);
    expect(doitProposer({ ...ETAT_VIDE, visites: 2 }, t, false, true)).toBe(true);
    expect(doitProposer({ ...ETAT_VIDE, visites: 1, utilise: 25 }, t, false, true)).toBe(false);
    expect(doitProposer({ ...ETAT_VIDE, visites: 1, utilise: 30 }, t, false, true)).toBe(true);
  });
  it('« Plus tard » 30 jours, « Ne plus proposer », déjà installée, impossible', () => {
    const e = { ...ETAT_VIDE, visites: 5 };
    expect(doitProposer({ ...e, plusTard: t - DELAI_PLUS_TARD + 1000 }, t, false, true)).toBe(false);
    expect(doitProposer({ ...e, plusTard: t - DELAI_PLUS_TARD - 1000 }, t, false, true)).toBe(true);
    expect(doitProposer({ ...e, jamais: true }, t, false, true)).toBe(false);
    expect(doitProposer(e, t, true, true)).toBe(false);
    expect(doitProposer(e, t, false, false)).toBe(false);
  });
  it('mémoire abîmée tolérée', () => {
    expect(etatValide(null)).toEqual(ETAT_VIDE);
    expect(etatValide({ visites: -3, utilise: 'x', plusTard: Infinity, jamais: 'oui' })).toEqual(ETAT_VIDE);
    expect(etatValide({ visites: 2.7, utilise: 12, plusTard: 5, jamais: true })).toEqual({ visites: 2, utilise: 12, plusTard: 5, jamais: true });
  });
});
