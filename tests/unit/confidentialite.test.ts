/**
 * Garde-fou : le dépôt est public — aucune donnée personnelle dans ses fichiers (prénoms, machines, chemins
 * personnels, adresses, mention d'une formation ou d'un enseignement).  Parcourt tous les fichiers suivis par git (à
 * défaut, toute l'arborescence hors node_modules, dist, .git) : textes, et chaînes lisibles des fichiers binaires.
 *
 * Les mots interdits ne sont pas écrits ici (le test lui-même est public) : seules leurs empreintes SHA-256 le sont,
 * comparées à celles de chaque suite de 1 à 3 mots des fichiers (minuscules, sans accents).  S'y ajoutent des motifs
 * génériques (chemins personnels, adresses électroniques, adresses IP locales).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const RACINE = join(__dirname, '..', '..');
const EXCLUS = new Set(['node_modules', 'dist', '.git', 'test-results', 'playwright-report', 'rapports', 'coverage', '.vite']);

const EMPREINTES = new Set<string>([
  '01f7b00724f40a6e34c0614456498168ebeb1dd6946aa1eac8936ca7c96da31b',
  '10386787e77a92a7f9e55065e2ac6e87026ca8e97b8e6bc52590ff240f31fbe4',
  '1914301f7fbf0a7677a0f64417a781d121ce0f5537994cf9e3a56cc5cb6cd70a',
  '23cca4b6ba6299aa85e8292791c55567587b3cbfc617819fcff57137b00aefc4',
  '2baa615f5a6f806951155f73274b20ec2107bf049e6758cd2a14a305241f69ec',
  '2f01f445b465979f56d66b1d50f25a16290b0b192d32a4ea741e48dfb65d62e0',
  '332bd826f70ae3710cdabe3b07a874d9754f8994283ce1160c44089fcbe2f699',
  '343cb40628bfd83d695c84a89fca169d41f531d1ea410dad28e76847dc738d68',
  '36afd15faa2d18332a87daddcafa4ac49379b002f61f4c308f340e7619bc0963',
  '3ada59c7f152dd548aea76f5a988ebb2038ab19c1548e17d936777d299af23d9',
  '3d3187a158ab17e1ee4452333b9525255c60f608b0c4a217b050f57679b675a6',
  '3e27fc9851a7aff1887ed416416ddaac209ec2e01f3de00f094d659c713c8d6d',
  '3e55b0bdbf0151880cca9e7731a41c5aa81426f5345db632970a548ff8de6879',
  '4066a25ed411c45ec3b5f8c2103982f60166dc2927d3681f31241e7a037469cd',
  '425f8ccfbf8ba3c3e008f71f9dc736e13b13bbc0631e5a7eb9da7118ab42db8a',
  '4b77005515c3d61964081ebfc6e1d6226ea1a3b1ef356f148cff0f8eafb4f2ca',
  '5dfee4541870a248fb67cc3d0fb3da5311225e91f4bdc2658b2536f3c75b130f',
  '5e0176c9d2070a5a2a22bf74b4abed303654690d58d64221ccbd022af827abc4',
  '60d4c64a49974efc287131774aa2c90cc14c5f43d160d78abec5f9a71b530f60',
  '6634fa2853d09371a71b08ede6d6cbd58137a09deca6f53d808239328fc73cdf',
  '6a16babfa9cd9a4a4388b0ef85ffc406e94c9c1ea68dddf74e186e153aa3662c',
  '6d582ce85c1b790890a526bc865b8f2b8a409f74ad215b06c7d2f28f68a43ae9',
  '6dcd2204ce67916fccdd0d69eae98bae50ed94f6e82b159dfd7947bc8264bcc9',
  '6ff9770cf6986977f8ace21d8d41c7f3e503a547ab54e28c392fda3ef8a375f7',
  '7039fc5c02aa08c1d9dd44b428d451d896e8654bbcb09e5ddebd488e6ea52f93',
  '72855f4a830fac39488d9ecc9136cef3106078b17862902092e06687dda21953',
  '72bdb3bc125cf2f6a47a1ca77c84f16da04ca1d78582acc19a552bbfde24e805',
  '7464708d71a3cd8ff33c55eb38446d1b653f1748aaa522ddd80f46703d61799b',
  '74661500aa577db1ae2b41a4be2a01a4a29ba58d625ed00e89a633af171ceacd',
  '778906e0080946dc071df91e4d35c2bbf344690ccf99c732eb160782c760703d',
  '7c7adbf8c09da0504d617dd415989ef46e3990b38511bc7a3d79f5adbc9ea5ae',
  '7fca85d9d14a93cdb0bd352669843aeb9b986230203531b6187d227287fab89e',
  '81ac0e982841c36353ff40f4a7c7e3adb2b6068c91d07bbb29260fc4c0264ca0',
  '85f5e10431f69bc2a14046a13aabaefc660103b6de7a84f75c4b96181d03f0b5',
  '8f2c868df7896234381f95886df1a83cf64d448c98babd24cd8b45ced732e484',
  'a160524700113ddd3205b38e8cf47ad5d9221dc9083ba234c8562ef8365be7be',
  'a4003ff8e6f35e5fcaab2848cc705a57068b0ea137235c20d496c6ec79b96bb8',
  'a608f391bff586bf0cd3fad5f7a2496d0b48c919db3c0c61b955206e3e97ed41',
  'ab9069c50dcc547c1275672b8ff95e6e30b876a47cd6af44a9bd588d2eec2830',
  'c2c6afabc895f966eca4b9e11f8399de5ace4bb6082f08c6ec82a74bb3b3c236',
  'c46b04d862d8a4b960304caa785197ed574194a22a28d2204d78ab1ba24fb4dc',
  'c70eca6b0f88f44d81a41311647e50fda1ac454ec04ffd442b0eb4743a993131',
  'c857d09db23e6822e3600bc06ad8d58f92ed62bc8efd81c753f77048662cb97d',
  'caf968bc875c90632d084666e8bd817b12b31e8a01a00c7c5d34330f06d9e268',
  'cc19e42f4c11238f6e4f69ee94db3a5abf6cd86c408f888a51cc2f3f6023fc77',
  'd715477f67cf8f0fde78dbd383b1a35b071bca3fce032e19f272528fcce6aca4',
  'dd7765412bb781ac836b9c8757927ec67269e068887c6f747996bd13ac687d0e',
  'de7089e62d58244c217676f466aa00086a61de5c77e69accfcfce79fe10e3f81',
  'eab1f2ede0df402f988f2fca268e6e78a298e46b2cfe0dbee0f02fd76ea0777a',
  'eec25aa05fae3393206c24717d4b3cf203ab4c82804b7497b547d2065c51dc7a',
  'f303684257e9b7327012b00c5f3f80e7b9a28d40ad3138803c46421deeeaa082',
  'f43e10b4b167735ace77ae233f2a8b289a20afc84ad19c476d51b86de52a4da7',
]);

const MOTIFS: RegExp[] = [
  /\/w[o]rkspace\b/,
  /\/mnt\/[a-z]/,
  /(?<![\w.])\/root\//,
  /\/home\/(?!(?:x|user|utilisateur|runner)\b)[A-Za-z0-9_.-]+/,
  /[Cc]:\\{1,2}[Uu]sers\\{1,2}(?!(?:x|Public|runneradmin)\b)\w+/,
  /@(?:gmail|hotmail|yahoo|outlook|free|orange|wanadoo|laposte|icloud|proton)\.[a-z]+/i,
  /\b192\.168\.\d{1,3}\.\d{1,3}\b/,
  /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
];

function fichiers(): string[] {
  try {
    const sortie = execFileSync('git', ['ls-files', '-z'], { cwd: RACINE, encoding: 'utf-8' });
    const l = sortie.split('\0').filter(Boolean);
    if (l.length) return l.map((f) => join(RACINE, f));
  } catch {
    /* pas de git : on parcourt l'arborescence */
  }
  const out: string[] = [];
  const parcourir = (d: string): void => {
    for (const n of readdirSync(d)) {
      if (EXCLUS.has(n)) continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) parcourir(p);
      else out.push(p);
    }
  };
  parcourir(RACINE);
  return out;
}

const BINAIRES = /\.(png|jpe?g|webp|gif|ico|woff2?|ttf|otf|pdf|zip|gz)$/i;

function texteDe(p: string): string {
  const b = readFileSync(p);
  if (!BINAIRES.test(p)) return b.toString('utf-8');
  // chaînes lisibles d'au moins 4 caractères (métadonnées d'images, de polices…)
  return (b.toString('latin1').match(/[\x20-\x7e]{4,}/g) ?? []).join('\n');
}

export function normaliser(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

function sha(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function interdits(texte: string, motifs = true): string[] {
  const out = new Set<string>();
  const mots = normaliser(texte);
  const vus = new Set<string>();
  for (let i = 0; i < mots.length; i++) {
    for (let n = 1; n <= 3 && i + n <= mots.length; n++) {
      const g = mots.slice(i, i + n).join(' ');
      if (vus.has(g)) continue;
      vus.add(g);
      if (EMPREINTES.has(sha(g))) out.add(g.replace(/./g, (c, k) => (k === 0 ? c : '•')));
    }
  }
  for (const m of motifs ? MOTIFS : []) {
    const r = texte.match(m);
    if (r) out.add(r[0]);
  }
  return [...out];
}

describe('confidentialité du dépôt public', () => {
  const liste = fichiers();

  it('les empreintes reconnaissent bien les mots interdits (contrôle du test lui-même)', () => {
    expect(EMPREINTES.size).toBeGreaterThan(40);
    // le test se contrôle avec un mot interdit reconstruit à partir de ses lettres (jamais écrit en clair)
    const mot = String.fromCharCode(99, 108, 97, 117, 100, 101);
    expect(interdits('Bonjour ' + mot.toUpperCase() + ' !').length).toBe(1);
    expect(interdits('Le Soleil, la Lune et les étoiles.')).toEqual([]);
  });

  it('au moins un fichier parcouru par type', () => {
    expect(liste.some((f) => f.endsWith('.ts'))).toBe(true);
    expect(liste.some((f) => f.endsWith('.json'))).toBe(true);
  });

  it('aucun fichier ne contient de donnée personnelle', () => {
    const fautes: string[] = [];
    for (const f of liste) {
      let t: string;
      try {
        t = texteDe(f);
      } catch {
        continue;
      }
      // ce fichier contient les motifs génériques eux-mêmes : seules les empreintes s'y appliquent
      for (const x of interdits(t, !f.endsWith('confidentialite.test.ts'))) fautes.push(`${relative(RACINE, f)} : ${x}`);
    }
    expect(fautes).toEqual([]);
  });
});
