"""Références des 92 animations, tirées de l'appli de bureau Coupole (PyQt6, sans écran) : réglages (bornes,
défauts, décimales, unités, échelle, options, libellés) et valeurs affichées sous la toile (textes exacts, FR et EN)
dans un scénario fixe : à la création, après quelques pas d'animation, après un changement de tous les réglages,
puis encore quelques pas.  Les tests TypeScript (tests/unit/animations.test.ts) rejouent le même scénario.

Usage (Qt sans écran, par exemple dans un conteneur où Coupole et PyQt6 sont installés) :
    QT_QPA_PLATFORM=offscreen python3 outils/references_animations.py CHEMIN_DU_DEPOT_COUPOLE
Écrit tests/references/animations.json."""
from __future__ import annotations

import json
import math
import os
import random
import sys
import tempfile
from pathlib import Path

ICI = Path(__file__).resolve().parents[1]
PAS = 0.37                 # secondes « réelles × vitesse » par pas du scénario
N_PAS = 4


def main(coupole: Path, seulement: list[str]) -> None:
    os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')
    os.environ['COUPOLE_HOME'] = tempfile.mkdtemp(prefix='coupole-web-ref-')
    os.environ['COUPOLE_SANS_RESEAU'] = '1'
    sys.path.insert(0, str(coupole))
    from PyQt6.QtWidgets import QApplication, QCheckBox, QComboBox
    app = QApplication.instance() or QApplication(['coupole-web'])
    from coupole.cli import initialiser
    from coupole.core import i18n
    from coupole.gui import memoire
    from coupole.modules.anim import catalogue
    from coupole.modules.anim.base import Reglage
    initialiser('fr')

    sortie = ICI / 'tests' / 'references' / 'animations.json'
    tout = json.loads(sortie.read_text(encoding='utf-8')) if (seulement and sortie.exists()) else {}
    for e in catalogue.ENTREES:
        if seulement and e.id not in seulement:
            continue
        cls = e.charger()
        res = {'animee': bool(cls.ANIMEE), 'lecture_au_depart': bool(cls.LECTURE_AU_DEPART)}
        for lg in ('fr', 'en'):
            i18n.choisir_langue(lg)
            memoire.reinitialiser_pour_tests()
            random.seed(1)
            w = cls()
            w.resize(1000, 760)
            reglages = []
            for cle, (wid, defaut) in w._defauts.items():
                if isinstance(wid, Reglage):
                    reglages.append({'cle': cle, 'type': 'curseur', 'mini': wid.mini, 'maxi': wid.maxi,
                                     'defaut': defaut, 'valeur': wid.value(), 'dec': wid.champ.decimals(),
                                     'unite': wid.champ.suffix().strip(), 'log': wid.log,
                                     'libelle': wid.libelle.text(), 'aide': wid.champ.toolTip()})
                elif isinstance(wid, QCheckBox):
                    reglages.append({'cle': cle, 'type': 'coche', 'defaut': bool(defaut), 'libelle': wid.text(),
                                     'aide': wid.toolTip()})
                elif isinstance(wid, QComboBox):
                    reglages.append({'cle': cle, 'type': 'choix', 'defaut': defaut,
                                     'options': [[wid.itemText(i), wid.itemData(i)] for i in range(wid.count())],
                                     'aide': wid.toolTip()})
            etapes = [['creation', w.valeurs()]]
            if cls.ANIMEE:
                for _ in range(N_PAS):
                    w.pas(PAS)
                etapes.append(['pas', w.valeurs()])
            # changement de tous les réglages (valeurs tirées une fois pour toutes, mêmes dans les deux langues)
            rnd = random.Random(hash(e.id) & 0xffff if False else sum(map(ord, e.id)))
            changements = []
            for cle, (wid, defaut) in w._defauts.items():
                if cle == 'vitesse':
                    continue
                if isinstance(wid, Reglage):
                    if wid.log:
                        v = 10 ** (math.log10(wid.mini) + rnd.random() * (math.log10(wid.maxi) - math.log10(wid.mini)))
                    else:
                        v = wid.mini + rnd.random() * (wid.maxi - wid.mini)
                    v = round(v, wid.champ.decimals())
                    v = max(wid.mini, min(wid.maxi, v))
                    wid.setValue(v)
                    changements.append([cle, v])
                elif isinstance(wid, QCheckBox):
                    wid.setChecked(not wid.isChecked())
                    changements.append([cle, wid.isChecked()])
                elif isinstance(wid, QComboBox):
                    i = wid.count() - 1
                    wid.setCurrentIndex(i)
                    changements.append([cle, wid.itemData(i)])
            etapes.append(['reglages', w.valeurs()])
            if cls.ANIMEE:
                for _ in range(N_PAS):
                    w.pas(PAS)
                etapes.append(['reglages_pas', w.valeurs()])
            w.reinitialiser()
            etapes.append(['reinitialiser', w.valeurs()])
            res[lg] = {'reglages': reglages, 'etapes': [[n, [list(x) for x in v]] for n, v in etapes]}
            res['changements'] = changements
            w.deleteLater()
            app.processEvents()
        tout[e.id] = res
        print(e.id, len(res['fr']['reglages']), 'réglages')
    i18n.choisir_langue('fr')
    sortie.parent.mkdir(parents=True, exist_ok=True)
    sortie.write_text(json.dumps(tout, ensure_ascii=False, indent=0, sort_keys=True) + '\n', encoding='utf-8')
    print('%d animations → %s' % (len(tout), sortie.relative_to(ICI)))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]).resolve(), sys.argv[2:])
