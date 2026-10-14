/**
 * Typographie commune des ressources et des applis (copie du formateur commun) — jumeau TypeScript de typographie.py
 * de Coupole (mêmes cas : tests/references/typographie_cas.json).
 * unite("km s-1 Mpc-1") → « km·s⁻¹·Mpc⁻¹ » ; nombre(x, lg, décimales) ; sci(x, lg, chiffres) ; normaliser ; controle.
 */
export const FINE = ' ';
const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '⁺' };
const sup = (s: string): string => [...s].map((c) => SUP[c] ?? c).join('');

export function unite(code: string): string {
  return code.split(/\s+/).filter(Boolean).map((f) => {
    const m = /^([^\d\-+]+)([-+]?\d+)?$/.exec(f);
    if (!m) throw new Error(`facteur d'unité illisible : ${f}`);
    const [, base, exp] = m;
    return base + (exp && exp !== '1' ? sup(exp.replace('+', '')) : '');
  }).join('·');
}

function grouper(ent: string): string {
  if (ent.length < 5) return ent;
  const g: string[] = [];
  while (ent) { g.unshift(ent.slice(-3)); ent = ent.slice(0, -3); }
  return g.join(FINE);
}

export function nombre(x: number, lg: 'fr' | 'en' = 'fr', decimales = 0): string {
  const s = Math.abs(x).toFixed(decimales);
  const [ent, dec] = s.split('.');
  const r = grouper(ent) + (dec ? (lg === 'fr' ? ',' : '.') + dec : '');
  return (x < 0 && Number(s) !== 0 ? '−' : '') + r;
}

export function sci(x: number, lg: 'fr' | 'en' = 'fr', chiffres = 3): string {
  if (x === 0) return '0';
  let e = Math.floor(Math.log10(Math.abs(x)));
  let m = x / 10 ** e;
  if (Number(Math.abs(m).toFixed(chiffres - 1)) >= 10) { e += 1; m = x / 10 ** e; }
  const t = nombre(m, lg, chiffres - 1);
  return e === 0 ? t : `${t} × 10${sup(String(e))}`;
}

export function normaliser(texte: string): string {
  return texte.replace(/(?<![\d,.])(\d{1,3})((?: \d{3})+)(?!\d)/g, (_, a: string, b: string) => a + b.replace(/ /g, FINE));
}

const UNITE_BARRE = /(?<![\p{L}\p{N}_])(k?m|cm|mm|µm|nm|k?g|W|k?J|N|Pa|eV|K|lbf?|ft|″|k?pc|Mpc|ua|au)\s?\/\s?(s|s²|h|m|m²|m³|cm²|cm³|K|an|yr|Mpc|kpc|ft³|n²|j|d)(?![\p{L}\p{N}_])/u;

export function controle(texte: string, lg: 'fr' | 'en' = 'fr'): string[] {
  const pb: string[] = [];
  const t = texte.replace(/\$[^$]*\$/g, ' ');
  const u = UNITE_BARRE.exec(t);
  if (u) pb.push(`unité écrite avec une barre oblique « ${u[0]} » (écrire m·s⁻¹)`);
  if (/[A-Za-zα-ω]_\(?[A-Za-z0-9]/.test(t)) pb.push('indice écrit avec « _ » hors formule (utiliser $…$ ou les indices Unicode)');
  if (/\^/.test(t)) pb.push('puissance écrite avec « ^ » hors formule (utiliser les exposants ou $…$)');
  if (/\d[eE][−+-]?\d/.test(t)) pb.push('notation informatique « e-11 » (écrire × 10⁻¹¹)');
  if (/(?<![\p{L}\p{N}_\-–])-\s?\d/u.test(t) || /\d\s-\s\d/.test(t)) pb.push('tiret « - » utilisé comme signe moins (écrire −)');
  if (/\d\s?[x*]\s?\d/.test(t)) pb.push('« x » ou « * » comme multiplication (écrire ×)');
  const pt = /(?<![\p{L}\p{N}_.])\d+\.\d+(?![\p{L}\p{N}_.])/u.exec(t);
  if (lg === 'fr' && pt) pb.push(`point décimal en français « ${pt[0]} »`);
  if (lg === 'en' && /(?<![\p{L}\p{N}_,])\d+,(\d{1,2}|\d{4,})(?!\d)/u.test(t)) pb.push('virgule décimale en anglais');
  if (/(?<![\d,.])\d{1,3}(?: \d{3})+(?!\d)/.test(t)) pb.push('milliers séparés par une espace ordinaire (espace fine insécable attendue)');
  return pb;
}
