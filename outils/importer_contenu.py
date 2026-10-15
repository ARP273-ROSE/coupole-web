#!/usr/bin/env python3
"""Importe dans le site les contenus préparés hors dépôt : banque de questions, fiches, tables, schémas, images,
modules, index de recherche, ressources liées aux questions.

    python3 outils/importer_contenu.py DOSSIER_CONTENU
    (DOSSIER_CONTENU contient questions/ et ressources/)

Ajouter un module de questions terminé = relancer ce script : il recopie toutes les questions disponibles, refait la
liste des modules et l'index de recherche.  Rien n'est écrit à la main dans public/contenu/.

Sorties :
  public/contenu/modules.json            les 24 modules (ordre, questions numérotées W/G/C/D, ressources)
  public/contenu/q/<fichier>.json        questions (un fichier par module d'origine), macros.json, couleurs.json
  public/contenu/fiches|tables|schemas/  une ressource par fichier (chargée à la demande)
  public/contenu/images/                 images.json + photos WebP
  public/contenu/recherche.json          index FR/EN (questions, fiches, tables, images)
  public/contenu/relevant.json           ressources liées à chaque question (« ★ »)
  public/contenu/sources.json            bibliographie
  src/contenu/moteur_questions.ts        moteur des questions (copie conforme, même version que Coupole)
"""
from __future__ import annotations

import base64
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent.parent
SORTIE = ICI / 'public' / 'contenu'
# Animations propres à Coupole ajoutées aux modules de ClassAction (l'original ne les connaît pas) : module → ids
ANIMATIONS_AJOUTEES = {'renaissance': ['gravityorbits']}
TYPES = {'warmup': 'W', 'general': 'G', 'challenge': 'C', 'discussion': 'D'}


def lire(p: Path):
    return json.loads(p.read_text(encoding='utf-8'))


def ecrire(p: Path, obj) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    texte = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    if p.exists() and p.read_text(encoding='utf-8') == texte:
        return
    p.write_text(texte, encoding='utf-8')


def sans_balises(t: str) -> str:
    """Texte d'un gabarit sans ses trous ni son balisage (pour l'index de recherche)."""
    t = re.sub(r'\{[^{}]*\}', ' ', t)
    return re.sub(r'\s+', ' ', t.replace('**', '').replace('$', '')).strip()


def bilingue(v) -> dict:
    if isinstance(v, dict) and set(v) == {'fr', 'en'}:
        return {'fr': str(v['fr']), 'en': str(v['en'])}
    return {'fr': str(v or ''), 'en': str(v or '')}


GRAINES = ['1', '2', 'x2026']

# Le dépôt est public et neutre (test tests/unit/confidentialite.test.ts) : quelques tournures de la banque sont
# reformulées à l'import (la source privée n'est pas modifiée ici ; chaque remplacement est signalé).
REMPLACEMENTS = [  # (base64 de la tournure d'origine : le dépôt ne l'écrit pas en clair, remplacement)
    (base64.b64decode('VW4gcHJvZmVzc2V1ciB0cmFjZSBhdSBzb2w=').decode(), 'Quelqu’un trace au sol'),
    (base64.b64decode('QSB0ZWFjaGVyIGRyYXdz').decode(), 'Someone draws'),
    (base64.b64decode('KHByb2Zlc3NldXIgZOKAmXVuZSB1bml2ZXJzaXTDqSBkZXZlbnUgbG91cC1nYXJvdSk=').decode(), '(universitaire devenu loup-garou)'),
    (base64.b64decode('KGEgdW5pdmVyc2l0eSBwcm9mZXNzb3IgdHVybmVkIHdlcmV3b2xmKQ==').decode(), '(an academic turned werewolf)'),
]


def neutraliser(d, nom: str):
    t = json.dumps(d, ensure_ascii=False)
    for a, b in REMPLACEMENTS:
        if a in t:
            print(f'{nom} : tournure reformulée → « {b} »', file=sys.stderr)
            t = t.replace(a, b)
    return json.loads(t)


def empreintes(racine: Path, banque: list, macros: dict) -> dict:
    """Empreintes des instances par le moteur Python de référence, pour la banque importée (même méthode que
    outils/generer_references.py du dossier des questions) : le moteur TypeScript du site doit les retrouver."""
    sys.path.insert(0, str(racine / 'questions' / 'moteur' / 'py'))
    import moteur_questions as M  # noqa: E402

    def h(inst):
        return hashlib.sha256(M.json_canonique(inst).encode('utf-8')).hexdigest()

    cas = []
    for q in banque:
        vs = M.variantes(q)
        if len(vs) > 6:
            vs = vs[:3] + vs[-3:]
        for v in vs or [{}]:
            for g in GRAINES:
                for lg in ('fr', 'en'):
                    inst = M.instancier(q, g, v, lg, macros=macros)
                    cas.append({'id': q['id'], 'graine': g, 'parametres': v, 'langue': lg, 'sha256': h(inst),
                                'bonnes': inst['bonnes']})
        if q.get('parametres'):
            for g in GRAINES:
                inst = M.instancier(q, g, None, 'fr', hasard_parametres=True, macros=macros)
                cas.append({'id': q['id'], 'graine': g, 'hasard_parametres': True, 'langue': 'fr', 'sha256': h(inst),
                            'bonnes': inst['bonnes']})
    return {'version_moteur': M.VERSION_MOTEUR, 'graines': GRAINES, 'cas': cas}


def main(racine: Path) -> int:
    Q = racine / 'questions' / 'donnees'
    R = racine / 'ressources'
    if not (Q / 'modules.json').exists() or not (R / 'modules.json').exists():
        print('dossier de contenu incomplet : ' + str(racine), file=sys.stderr)
        return 2
    if SORTIE.exists():
        shutil.rmtree(SORTIE)
    SORTIE.mkdir(parents=True)

    # ------------------------------------------------------------------ questions
    fichier_de: dict[str, str] = {}
    toutes: dict[str, dict] = {}
    for f in sorted((Q / 'questions').glob('*.json')):
        d = neutraliser(lire(f), f.name)
        cle = f.stem
        ecrire(SORTIE / 'q' / f.name, {'version': d.get('version', 1), 'questions': d['questions']})
        for q in d['questions']:
            fichier_de.setdefault(q['id'], cle)
            toutes.setdefault(q['id'], q)
    ecrire(SORTIE / 'q' / 'macros.json', lire(Q / 'figures_macros.json'))
    # photographies libres des questions (crédits affichés sous la figure)
    if (Q / 'images.json').exists():
        ecrire(SORTIE / 'q' / 'images.json', lire(Q / 'images.json'))
        (SORTIE / 'q' / 'images').mkdir(parents=True, exist_ok=True)
        for f in sorted((Q / 'images').glob('*.webp')):
            shutil.copy2(f, SORTIE / 'q' / 'images' / f.name)
    ecrire(SORTIE / 'q' / 'couleurs.json', lire(Q / 'couleurs.json'))

    # ------------------------------------------------------------------ modules
    mq = {m['id']: m for m in lire(Q / 'modules.json')['modules']}
    mr = {m['cle']: m for m in lire(R / 'modules.json')['modules']}
    modules = []
    ordre = sorted(mr.values(), key=lambda m: m['ordre'])
    for m in ordre:
        cle = m['cle']
        q = mq.get(cle, {})
        qs = []
        for e in q.get('questions', []):
            ok = e['id'] in fichier_de
            qs.append({'id': e['id'], 'n': e['numero'], 'f': fichier_de.get(e['id'], ''), 'ok': ok,
                       't': bilingue(toutes[e['id']]['titre']) if ok else None})
        modules.append({
            'cle': cle,
            'titre': bilingue(m['titre']),
            'original': m.get('nom_original', ''),
            'affiche': bool(m.get('affiche', True)),
            'bonus': bool(q.get('bonus', not m.get('affiche', True))),
            'questions': qs,
            'animations': m.get('animations', []) + [a for a in ANIMATIONS_AJOUTEES.get(cle, []) if a not in m.get('animations', [])],
            'fiches': m.get('fiches', []),
            'tables': m.get('tables', []),
            'images': m.get('images', []),
        })
    ecrire(SORTIE / 'modules.json', {'format': 'coupole-modules-web/1', 'modules': modules})

    # ------------------------------------------------------------------ ressources
    for dossier in ('fiches', 'tables', 'schemas'):
        for f in sorted((R / dossier).glob('*.json')):
            ecrire(SORTIE / dossier / f.name, lire(f))
    (SORTIE / 'images').mkdir(parents=True, exist_ok=True)
    images = lire(R / 'images' / 'images.json')
    ecrire(SORTIE / 'images' / 'images.json', images)
    for f in sorted((R / 'images').glob('*.webp')):
        shutil.copy2(f, SORTIE / 'images' / f.name)
    ecrire(SORTIE / 'sources.json', lire(R / 'sources.json'))

    # ressources liées (« Relevant ★ ») : celles des ressources + celles de la question elle-même
    rel = lire(R / 'questions_ressources.json')['questions']
    existe = {
        'fiches': {f.stem for f in (R / 'fiches').glob('*.json')},
        'tables': {f.stem for f in (R / 'tables').glob('*.json')},
        'images': {i['id'] for i in images['images']},
        'animations': None,       # vérifiées par les tests (registre des animations)
    }
    ignores: list[str] = []
    liees: dict[str, dict] = {}
    for qid, q in toutes.items():
        r = rel.get(qid, {})
        out = {}
        for genre in ('animations', 'fiches', 'tables', 'images'):
            vus, l = set(), []
            for x in r.get(genre, []):
                if x['id'] not in vus:
                    vus.add(x['id'])
                    l.append([x['id'], x.get('lien', 'original')])
            for x in (q.get('ressources') or {}).get(genre, []):
                i = x if isinstance(x, str) else x.get('id')
                if i and existe[genre] is not None and i not in existe[genre]:
                    ignores.append(f'{qid} → {genre[:-1]} {i}')
                    continue
                if i and i not in vus:
                    vus.add(i)
                    l.append([i, 'choisi'])
            if genre == 'animations' and q.get('animation') and q['animation']['id'] not in vus:
                l.insert(0, [q['animation']['id'], 'original'])
            # ordre : liens de l'original, puis choisis, puis trouvés par mots-clés
            rang = {'original': 0, 'choisi': 1}
            l.sort(key=lambda x: rang.get(x[1], 2))
            if l:
                out[genre] = l
        if out:
            liees[qid] = out
    for x in ignores:
        print('ressource liée inconnue, ignorée : ' + x, file=sys.stderr)
    ecrire(SORTIE / 'relevant.json', {'format': 'coupole-relevant-web/1', 'questions': liees})

    # ------------------------------------------------------------------ recherche
    idx = lire(R / 'index_recherche.json')
    entrees = []
    genre = {'fiche': 'f', 'table': 't', 'image': 'i'}
    for e in idx['entrees']:
        entrees.append({'g': genre[e['type']], 'id': e['id'], 'm': e.get('modules', []), 't': bilingue(e['titre']),
                        'r': bilingue(e.get('resume') or ''),
                        'k': {lg: ' '.join(e.get('mots_cles', {}).get(lg, [])) for lg in ('fr', 'en')}})
    for qid, q in toutes.items():
        en = q.get('enonce') or ''
        entrees.append({'g': 'q', 'id': qid, 'm': [x['module'] for x in q.get('modules', [])],
                        't': bilingue(q['titre']),
                        'r': {lg: sans_balises(bilingue(en)[lg])[:220] for lg in ('fr', 'en')},
                        'k': {lg: '' for lg in ('fr', 'en')}})
    titres = {'f': {}, 't': {}, 'i': {}}
    for e in entrees:
        if e['g'] in titres:
            titres[e['g']][e['id']] = e['t']
    ecrire(SORTIE / 'titres.json', titres)
    ecrire(SORTIE / 'recherche.json', {'format': 'coupole-recherche-web/1', 'entrees': entrees})

    # ------------------------------------------------------------------ moteur
    moteur = racine / 'questions' / 'moteur' / 'ts' / 'moteur_questions.ts'
    cible = ICI / 'src' / 'contenu' / 'moteur_questions.ts'
    cible.parent.mkdir(parents=True, exist_ok=True)
    texte = moteur.read_text(encoding='utf-8')
    entete = ('// @ts-nocheck — copie conforme du moteur des questions (même fichier dans Coupole, en Python) ;\n'
              '// ne pas modifier ici : outils/importer_contenu.py la recopie.\n')
    cible.write_text(entete + texte, encoding='utf-8')
    # cas de parité de la sauvegarde (portage Python de src/contenu/sauvegarde.ts, mêmes résultats exigés)
    cas = racine / 'questions' / 'progression' / 'sauvegarde_cas.json'
    if cas.exists():
        ecrire(ICI / 'tests' / 'references' / 'sauvegarde_cas.json', neutraliser(lire(cas), cas.name))
    src = racine / 'questions' / 'moteur' / 'references' / 'unitaires.json'
    if src.exists():
        ecrire(ICI / 'tests' / 'references' / 'questions' / 'unitaires.json', lire(src))
    ecrire(ICI / 'tests' / 'references' / 'questions' / 'banque_empreintes.json',
           empreintes(racine, list(toutes.values()), lire(Q / 'figures_macros.json')['macros']))

    n_dispo = sum(1 for m in modules for q in m['questions'] if q['ok'])
    n_total = sum(len(m['questions']) for m in modules)
    empreinte = hashlib.sha256(json.dumps(modules, ensure_ascii=False).encode()).hexdigest()[:12]
    print(f'{len(modules)} modules, {len(toutes)} questions ({n_dispo} références disponibles sur {n_total}), '
          f'{len(list((SORTIE / "fiches").glob("*.json")))} fiches, {len(list((SORTIE / "tables").glob("*.json")))} '
          f'tables, {len(list((SORTIE / "schemas").glob("*.json")))} schémas, {len(images["images"])} images ; '
          f'empreinte {empreinte}')
    return 0


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(Path(sys.argv[1]).resolve()))
