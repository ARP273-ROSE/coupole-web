#!/bin/sh
# Sous-ensemble de la police mathématique STIX Two Math (SIL OFL 1.1, https://github.com/stipub/stixfonts,
# version 2.13 b171) pour les formules en MathML : latin, grec, chiffres en exposant et en indice, opérateurs usuels,
# lettres mathématiques italiques ; la table MATH (fractions, radicaux, variantes extensibles) est conservée.
# Usage : sh outils/police_maths.sh STIXTwoMath-Regular.otf   (fonttools et brotli requis)
set -e
pyftsubset "$1" \
  --unicodes='U+0020-007E,U+00A0-00FF,U+0391-03C9,U+03D1,U+03D5,U+03F5,U+2009,U+200A,U+202F,U+2013,U+2014,U+2032-2034,U+2070-209F,U+210E,U+210F,U+2192,U+2202,U+2206,U+2207,U+2212,U+2213,U+2217,U+2218,U+221A,U+221D,U+221E,U+2248,U+2260,U+2261,U+2264,U+2265,U+226A,U+226B,U+2295,U+22C5,U+2609,U+27E8,U+27E9,U+1D434-1D467,U+1D6E2-1D71B' \
  --layout-features='*' --flavor=woff2 --output-file=public/fonts/stix-two-math.woff2
