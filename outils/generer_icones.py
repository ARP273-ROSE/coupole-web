"""Icônes PNG de Coupole Web (manifeste, écran d'accueil iOS) depuis public/favicon.svg (logo de l'appli Coupole) et
outils/icone_masquable.svg (même logo sur fond plein, dans la zone sûre des icônes masquables), rendues par Qt.

    QT_QPA_PLATFORM=offscreen python3 outils/generer_icones.py
"""
import sys
from pathlib import Path

from PyQt6.QtCore import QRectF, Qt
from PyQt6.QtGui import QColor, QGuiApplication, QImage, QPainter
from PyQt6.QtSvg import QSvgRenderer

ICI = Path(__file__).resolve().parents[1]


def rendre(svg: Path, taille: int, fond: str | None = None) -> QImage:
    r = QSvgRenderer(str(svg))
    im = QImage(taille, taille, QImage.Format.Format_ARGB32)
    im.fill(QColor(fond) if fond else Qt.GlobalColor.transparent)
    p = QPainter(im)
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    r.render(p, QRectF(0, 0, taille, taille))
    p.end()
    return im


def main():
    app = QGuiApplication(sys.argv)  # noqa: F841
    d = ICI / 'public' / 'icons'
    d.mkdir(parents=True, exist_ok=True)
    logo, masq = ICI / 'public' / 'favicon.svg', ICI / 'outils' / 'icone_masquable.svg'
    rendre(logo, 192).save(str(d / 'icone-192.png'))
    rendre(logo, 512).save(str(d / 'icone-512.png'))
    rendre(masq, 512).save(str(d / 'icone-masquable-512.png'))
    rendre(masq, 192).save(str(d / 'icone-masquable-192.png'))
    rendre(masq, 180).save(str(d / 'apple-touch-icon.png'))
    rendre(logo, 32).save(str(d / 'favicon-32.png'))


if __name__ == '__main__':
    main()
