"""Exporte depuis l'appli de bureau Coupole (module « Animations ») les textes, le catalogue et les données reprises
telles quelles par Coupole Web.

Usage : python3 outils/exporter_coupole.py CHEMIN_DU_DEPOT_COUPOLE

Écrit (fichiers suivis par git, à régénérer quand Coupole change) :
  src/i18n/genere/{catalogue,anim}.{fr,en}.json   textes FR/EN (mêmes clés que Coupole)
  src/donnees/genere/catalogue.json               les 92 animations (id, thème, titre et fichier d'origine), lots
  src/donnees/genere/*.json                       données des animations (côtes, spectres, binaires, étoiles…)

Seules les bibliothèques standard sont nécessaires ; les modules importés de Coupole sont ceux sans Qt."""
from __future__ import annotations

import gzip
import json
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parents[1]
CLES_HORS_WEB = ('anim_cli_',)       # textes de la ligne de commande de l'appli de bureau


def ecrire(chemin: Path, donnees) -> None:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    texte = json.dumps(donnees, ensure_ascii=False, separators=(',', ':'), sort_keys=False)
    chemin.write_text(texte + '\n', encoding='utf-8')
    print('%-50s %8d octets' % (chemin.relative_to(ICI), len(texte.encode('utf-8'))))


def lire_gz(chemin: Path):
    return json.loads(gzip.decompress(chemin.read_bytes()))


def main(coupole: Path) -> None:
    sys.path.insert(0, str(coupole))
    from coupole.modules.anim import (catalogue, donnees_eclipses, donnees_etoiles, donnees_lot3, textes,
                                      textes_lot2, textes_lot3)  # noqa: F401  (lot2/lot3 complètent TEXTES)
    anim = coupole / 'coupole' / 'modules' / 'anim'

    # ------------------------------------------------------------ textes
    tt = textes.TEXTES
    ids = [e.cle for e in catalogue.ENTREES]
    for lg in ('fr', 'en'):
        cat, reste = {}, {}
        for k, v in tt.items():
            if k.startswith(CLES_HORS_WEB):
                continue
            if k.startswith(('anim_nom_', 'anim_desc_', 'anim_theme_')) or k in ('anim_credits', 'anim_compte'):
                cat[k] = v[lg]
            else:
                reste[k] = v[lg]
        ecrire(ICI / 'src' / 'i18n' / 'genere' / ('catalogue.%s.json' % lg), cat)
        ecrire(ICI / 'src' / 'i18n' / 'genere' / ('anim.%s.json' % lg), reste)
    assert all(('anim_nom_' + i) in tt for i in ids)

    # ------------------------------------------------------------ catalogue
    ecrire(ICI / 'src' / 'donnees' / 'genere' / 'catalogue.json', {
        'themes': list(catalogue.THEMES),
        'animations': [[e.id, e.theme, e.titre, e.fichier, e.classe] for e in catalogue.ENTREES],
        'ordre': list(catalogue.ORDRE),
        'lot1': list(catalogue.LOT1),
    })

    # ------------------------------------------------------------ données
    g = ICI / 'src' / 'donnees' / 'genere'
    ecrire(g / 'cotes.json', lire_gz(anim / 'donnees' / 'cotes.json.gz'))
    ecrire(g / 'spectres.json', lire_gz(anim / 'donnees' / 'spectres.json.gz'))
    ecrire(g / 'binaires.json', lire_gz(anim / 'donnees' / 'binaires.json.gz'))
    ecrire(g / 'etoiles.json', {'proches': donnees_etoiles.PROCHES, 'brillantes': donnees_etoiles.BRILLANTES,
                                'communes': donnees_etoiles.COMMUNES})
    ecrire(g / 'eclipses.json', {'soleil': donnees_eclipses.SOLEIL, 'lune': donnees_eclipses.LUNE,
                                 'lieux_fr': donnees_eclipses.LIEUX_FR,
                                 'directions_fr': donnees_eclipses.DIRECTIONS_FR,
                                 'types_zone_fr': donnees_eclipses.TYPES_ZONE_FR})
    d3 = donnees_lot3
    ecrire(g / 'lot3.json', {
        'planetes_fiche': d3.PLANETES_FICHE, 'gm_de440': d3.GM_DE440_KM3_S2,
        'elements_standish': d3.ELEMENTS_STANDISH, 'transits': d3.TRANSITS, 'transits_exemples': d3.TRANSITS_EXEMPLES,
        'vitesses_radiales': d3.VITESSES_RADIALES, 'vitesses_radiales_exemples': d3.VITESSES_RADIALES_EXEMPLES,
        'binaires': d3.BINAIRES, 'binaires_a_completer': d3.BINAIRES_A_COMPLETER,
        'binaires_exemples': d3.BINAIRES_EXEMPLES, 'exces_masse_kev': d3.EXCES_MASSE_KEV, 'me_kev': d3.ME_KEV,
        'neutrino_moyen_kev': d3.NEUTRINO_MOYEN_KEV, 'condensation_k': d3.CONDENSATION_K,
        'formation_terre': d3.FORMATION_TERRE, 'formation_jupiter': d3.FORMATION_JUPITER,
        'distances_ua': d3.DISTANCES_UA,
        'ballon_directions': directions_ballon(),
    })


def directions_ballon() -> list:
    """Directions des galaxies de Balloon Universe, tirées comme dans Coupole (numpy, graine 9)."""
    import numpy as np
    g = np.random.default_rng(9)
    v = g.normal(size=(40, 3))
    dirs = v / np.linalg.norm(v, axis=1)[:, None]
    dirs[0] = (0.35, -0.6, 0.72)
    dirs[0] /= np.linalg.norm(dirs[0])
    return dirs.tolist()


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]).resolve())
