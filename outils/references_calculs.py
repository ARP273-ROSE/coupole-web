"""Valeurs de référence des calculs, tirées du Python de l'appli de bureau Coupole : les tests TypeScript
(tests/unit/calculs.test.ts) doivent retrouver chaque résultat à 1e-9 près (relatif).

Usage : python3 outils/references_calculs.py CHEMIN_DU_DEPOT_COUPOLE
Écrit tests/references/calculs.json : liste de [fonction, arguments, résultat]."""
from __future__ import annotations

import json
import math
import random
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parents[1]


def propre(x):
    """Résultat Python → JSON (tuples en listes, dicts sans fonctions, inf/nan en chaînes)."""
    if isinstance(x, bool) or x is None or isinstance(x, str):
        return x
    if isinstance(x, (int, float)):
        if math.isinf(x):
            return 'inf' if x > 0 else '-inf'
        if math.isnan(x):
            return 'nan'
        return x
    if isinstance(x, (list, tuple)):
        return [propre(v) for v in x]
    if isinstance(x, dict):
        return {str(k): propre(v) for k, v in x.items() if not callable(v)}
    raise TypeError(type(x))


def main(coupole: Path) -> None:
    sys.path.insert(0, str(coupole))
    from coupole.core import i18n
    from coupole.modules.anim import astro, deux_corps, hr, lumiere, textes  # noqa: F401
    i18n.enregistrer(textes.TEXTES)
    i18n.choisir_langue('fr')
    rnd = random.Random(20261014)
    cas = []

    def ajoute(nom, f, *args):
        cas.append([nom, propre(list(args)), propre(f(*args))])

    def u(a, b):
        return rnd.uniform(a, b)

    # ------------------------------------------------------------ astro : temps, Soleil, repères
    for _ in range(25):
        an, mo, jo, he = rnd.randint(1600, 2400), rnd.randint(1, 12), u(1, 28), u(0, 24)
        ajoute('astro.jour_julien', astro.jour_julien, an, mo, jo, he)
    for an in (2000, 2026, 1987, 2100):
        for jour in (0, 79.5, 172.25, 355.9):
            ajoute('astro.jj_jour_de_l_annee', astro.jj_jour_de_l_annee, an, jour)
    for _ in range(25):
        jj = u(2_300_000, 2_600_000)
        ajoute('astro.tsmg', astro.tsmg, jj)
        ajoute('astro.soleil', astro.soleil, jj)
        ajoute('astro.obliquite_moyenne', astro.obliquite_moyenne, jj)
        ajoute('astro.noeud_ascendant_lune', astro.noeud_ascendant_lune, jj)
        ajoute('astro.phase_la_plus_proche', astro.phase_la_plus_proche, jj, False)
        ajoute('astro.phase_la_plus_proche', astro.phase_la_plus_proche, jj, True)
    for an in (2026, 1999):
        for jour in range(0, 365, 23):
            ajoute('astro.soleil_jour', astro.soleil_jour, an, jour + 0.3)
    for a in (365.24219, 365.256363004, 10.0):
        ajoute('astro.jour_sideral_s', astro.jour_sideral_s, a)
    for _ in range(40):
        ajoute('astro.ecliptique_vers_equatorial', astro.ecliptique_vers_equatorial, u(0, 360), u(-80, 80), u(0, 40))
        ajoute('astro.equatorial_vers_horizon', astro.equatorial_vers_horizon, u(-360, 360), u(-90, 90), u(-90, 90))
        ajoute('astro.horizon_vers_equatorial', astro.horizon_vers_equatorial, u(0, 360), u(-90, 90), u(-90, 90))
        d, l = u(-90, 90), u(-90, 90)
        ajoute('astro.angle_horaire_lever', astro.angle_horaire_lever, d, l, rnd.choice((0.0, -0.833, -6.0, -18.0)))
        ajoute('astro.duree_du_jour_h', astro.duree_du_jour_h, d, l)
        ajoute('astro.azimut_lever', astro.azimut_lever, u(-30, 30), u(-70, 70))
        ajoute('astro.hauteur_culmination', astro.hauteur_culmination, d, l)
        ajoute('astro.vecteur_horizon', astro.vecteur_horizon, u(0, 360), u(-90, 90))
        ajoute('astro.vecteur_equatorial', astro.vecteur_equatorial, u(0, 360), u(-90, 90))
        ajoute('astro.matrice_equatorial_vers_horizon', astro.matrice_equatorial_vers_horizon, u(0, 360), u(-90, 90))
        ajoute('astro.hauteur', astro.hauteur, u(-180, 180), u(-90, 90), u(-90, 90))
    for lat in (0.0, 90.0, -90.0, 41.0, -33.9, 1e-12, 66.5):
        ajoute('astro.plages_declinaison', astro.plages_declinaison, lat)
    ajoute('astro.angle_horaire_lever', astro.angle_horaire_lever, 10.0, 90.0, 0.0)
    ajoute('astro.angle_horaire_lever', astro.angle_horaire_lever, -10.0, 90.0, 0.0)
    # ------------------------------------------------------------ Kepler, distances, ombres
    for _ in range(30):
        e = u(0, 0.97)
        ajoute('astro.resoudre_kepler', astro.resoudre_kepler, u(-20, 20), e)
        ajoute('astro.orbite', astro.orbite, u(0.2, 40), e, u(-2, 3))
        ajoute('astro.aire_balayee', astro.aire_balayee, u(0.2, 40), e, u(0, 1), u(0, 1))
        ajoute('astro.periode_annees', astro.periode_annees, u(0.1, 50), u(0.1, 5))
        ajoute('astro.module_de_distance', astro.module_de_distance, 10 ** u(-1, 6))
        ajoute('astro.distance_du_module', astro.distance_du_module, u(-5, 30))
        ajoute('astro.parsecs_de_parallaxe', astro.parsecs_de_parallaxe, u(0.001, 1))
    ajoute('astro.cones_ombre', astro.cones_ombre, astro.R_SOLEIL_KM, astro.R_TERRE_KM, astro.UA_KM)
    ajoute('astro.cones_ombre', astro.cones_ombre, 1.0, 2.0, 10.0)
    ajoute('astro.eclipse_de_lune', astro.eclipse_de_lune)
    for d in (356_500.0, 406_700.0, 300_000.0):
        ajoute('astro.eclipse_de_lune', astro.eclipse_de_lune, d)
    for _ in range(30):
        a = u(0, 720)
        ajoute('astro.fraction_eclairee', astro.fraction_eclairee, a)
        ajoute('astro.nom_de_phase', astro.nom_de_phase, a)
        ajoute('astro.fraction_eclairee_phase', astro.fraction_eclairee_phase, u(0, 180))
    for a in (0, 12, 12.0001, 85, 95, 168, 192, 265, 275, 348, 348.5, 360):
        ajoute('astro.nom_de_phase', astro.nom_de_phase, a)
    # ------------------------------------------------------------ modèles planétaires
    for _ in range(20):
        ajoute('astro.position_circulaire', astro.position_circulaire, u(0.3, 30), u(0.2, 100), u(-5, 5), u(0, 360))
        ajoute('astro.longitude_geocentrique', astro.longitude_geocentrique, u(0.3, 30), u(-5, 5), u(0, 360), u(0, 360))
        ajoute('astro.ptolemee_mars', astro.ptolemee_mars, u(-5, 5))
        ajoute('astro.ptolemee_soleil', astro.ptolemee_soleil, u(-5, 5))
        ajoute('astro.epicycles', astro.epicycles, u(-3, 3), u(40, 150), u(160, 300), rnd.randint(1, 3))
    for a in (1.524, 5.203, 9.537, 19.19, 30.07, 1.1, 2.77):
        ajoute('astro.retrogradation', astro.retrogradation, a)
    for lam in range(0, 360, 7):
        ajoute('astro.constellation_du_soleil', astro.constellation_du_soleil, lam + 0.5)
    # ------------------------------------------------------------ lot 2
    for _ in range(20):
        ajoute('astro.angle_de_phase', astro.angle_de_phase, [u(-5, 5), u(-5, 5)], [u(-5, 5), u(-5, 5)],
               [u(-5, 5), u(-5, 5)])
        ajoute('astro.angle_de_phase', astro.angle_de_phase, [u(-5, 5), u(-5, 5), u(-1, 1)], [0, 0, 0],
               [u(-5, 5), u(-5, 5), u(-1, 1)])
        p1, p2 = u(0.1, 100), u(0.1, 100)
        ajoute('astro.periode_synodique', astro.periode_synodique, p1, p2)
        ajoute('astro.periode_siderale', astro.periode_siderale, u(0.5, 3), 1.0, rnd.random() < 0.5)
        ajoute('astro.demi_grand_axe', astro.demi_grand_axe, u(0.1, 200), u(0.1, 5))
        ajoute('astro.force_gravitation', astro.force_gravitation, 10 ** u(0, 30), 10 ** u(0, 30), 10 ** u(0, 12))
        ajoute('astro.periode_orbite_terre', astro.periode_orbite_terre, u(6.5e6, 5e8))
        ajoute('astro.vitesse_circulaire', astro.vitesse_circulaire, u(6.5e6, 5e8))
        ajoute('astro.rayon_orbite_terre', astro.rayon_orbite_terre, u(3000, 3e6))
        ajoute('astro.diametre_angulaire', astro.diametre_angulaire, u(1, 1e6), u(1, 1e9))
        ajoute('astro.jour_solaire', astro.jour_solaire, u(0.3, 2), u(10, 400))
        k = rnd.randint(-300, 600) + rnd.choice((0, 0.5))
        ajoute('astro.phase_moyenne_jde', astro.phase_moyenne_jde, k)
        ajoute('astro.argument_latitude_lune', astro.argument_latitude_lune, k)
        ajoute('astro.maree_equilibre', astro.maree_equilibre, u(0, 180), 7.35e22, u(3.5e8, 4.1e8))
        ajoute('astro.precession', astro.precession, u(0, 360), u(-89, 89), u(2_300_000, 2_600_000))
        ajoute('astro.precession', astro.precession, u(0, 360), u(-89, 89), u(2_300_000, 2_600_000),
               u(2_400_000, 2_500_000))
    ajoute('astro.periode_synodique', astro.periode_synodique, 2.0, 2.0)
    ajoute('astro.periode_siderale', astro.periode_siderale, 0.5, 1.0, True)
    ajoute('astro.rapport_marees_soleil_lune', astro.rapport_marees_soleil_lune)
    ajoute('astro.soleil_au_noeud', astro.soleil_au_noeud, 2_461_041.5, 2_461_406.5)
    ajoute('astro.soleil_au_noeud', astro.soleil_au_noeud, 2_451_545.0, 2_452_545.0)
    for ra, dec, lat, an, jour in ((101.287, -16.716, 30.0, 2026, 200), (101.287, -16.716, 40.8, 2026, 230),
                                   (88.79, 7.41, 60.0, 2026, 100), (88.79, 7.41, 80.0, 2026, 170)):
        ajoute('astro.visible_a_l_aube', astro.visible_a_l_aube, ra, dec, lat, an, jour)
    ajoute('astro.lever_heliaque', astro.lever_heliaque, 101.287, -16.716, 30.0)
    ajoute('astro.lever_heliaque', astro.lever_heliaque, 279.23, 38.78, 45.0, 2026, 10.0)
    # ------------------------------------------------------------ hr
    for _ in range(30):
        x = u(0, 69)
        ajoute('hr.temperature_de_type', hr.temperature_de_type, x, rnd.choice(('V', 'III', 'I')))
        ajoute('hr.log_temp_de_type', hr.log_temp_de_type, x)
        lt = u(3.3, 4.8)
        ajoute('hr.correction_bolometrique', hr.correction_bolometrique, lt)
        for cl in (1, 2, 3, 4, 5):
            ajoute('hr.log_lum_classe', hr.log_lum_classe, lt, cl)
        ajoute('hr.position_hr', hr.position_hr, x, u(-8, 16))
        ajoute('hr.couleur_rvb', hr.couleur_rvb, 10 ** u(2.8, 4.8))
        ajoute('hr.luminosite_solaire', hr.luminosite_solaire, u(0.1, 100), u(2000, 40000))
        ajoute('hr.puissance_w', hr.puissance_w, u(1e7, 1e11), u(2000, 40000))
        ajoute('hr.rayon_solaire', hr.rayon_solaire, 10 ** u(-4, 6), u(2000, 40000))
        ajoute('hr.flux', hr.flux, u(1, 1e30), u(1, 1e20))
        ajoute('hr.mbol_de_log_lum', hr.mbol_de_log_lum, u(-4, 6))
        ajoute('hr.log_lum_de_mbol', hr.log_lum_de_mbol, u(-10, 15))
        ajoute('hr.vitesse_radiale', hr.vitesse_radiale, u(650, 660), 656.28, rnd.random() < 0.5)
        ajoute('hr.vitesse_transverse', hr.vitesse_transverse, u(0, 10), u(1, 10))
    for x in (0, 9.5, 22, 42, 59.99, 64, 65.5, 69):
        ajoute('hr.temperature_de_type', hr.temperature_de_type, x)
        ajoute('hr.temperature_de_type', hr.temperature_de_type, x, 'I')
    ajoute('hr.T_SOLEIL', lambda: hr.T_SOLEIL)
    # ------------------------------------------------------------ lumiere
    for _ in range(30):
        t = 10 ** u(2.5, 5)
        lam = 10 ** u(-8, -4)
        ajoute('lumiere.planck', lumiere.planck, lam, t)
        ajoute('lumiere.pic_wien_m', lumiere.pic_wien_m, t)
        ajoute('lumiere.temperature_de_pic', lumiere.temperature_de_pic, lam)
        ajoute('lumiere.exitance', lumiere.exitance, t)
        ajoute('lumiere.energie_photon_j', lumiere.energie_photon_j, lam)
        ajoute('lumiere.frequence', lumiere.frequence, lam)
        ajoute('lumiere.domaine_em', lumiere.domaine_em, 10 ** u(-13, 1))
        nb, nh = rnd.randint(1, 5), rnd.randint(6, 9)
        ajoute('lumiere.niveau_ev', lumiere.niveau_ev, nb)
        ajoute('lumiere.transition_ev', lumiere.transition_ev, nb, nh)
        ajoute('lumiere.longueur_onde_nm', lumiere.longueur_onde_nm, u(0.5, 14))
        th, n1, n2 = u(0, 89.9), u(1, 2.5), u(1, 2.5)
        ajoute('lumiere.snell', lumiere.snell, th, n1, n2)
        ajoute('lumiere.angle_critique', lumiere.angle_critique, n1, n2)
        ajoute('lumiere.fresnel', lumiere.fresnel, th, n1, n2)
        ajoute('lumiere.angle_brewster', lumiere.angle_brewster, n1, n2)
        ajoute('lumiere.frequence_recue', lumiere.frequence_recue, u(1, 1000), [u(-50, 50), u(-50, 50)],
               [u(-50, 50), u(-50, 50)], [math.cos(a := u(0, 6.28)), math.sin(a)], 343.0)
        ajoute('lumiere.valeur', lumiere.valeur, rnd.choice(('filtre_U', 'filtre_B', 'filtre_V', 'filtre_R')),
               u(300, 900))
        ajoute('lumiere.couleur_corps_noir', lumiere.couleur_corps_noir, rnd.randint(1000, 40000))
        ajoute('lumiere.couleur_longueur_onde', lumiere.couleur_longueur_onde, u(370, 790))
        ajoute('lumiere.magnitudes_corps_noir', lumiere.magnitudes_corps_noir, rnd.randint(2500, 40000))
    for t in (0.0, 1.0, 300.0):
        ajoute('lumiere.planck', lumiere.planck, 1e-9, t)
    ajoute('lumiere.rgb_de_xyz', lumiere.rgb_de_xyz, 0.3, 0.4, 0.5)
    ajoute('lumiere.rgb_de_xyz', lumiere.rgb_de_xyz, 0.9, 0.5, 0.1, 0.85)
    ajoute('lumiere.rgb_de_xyz', lumiere.rgb_de_xyz, 1.5, 1.2, -0.1)
    ajoute('lumiere.constantes', lambda: [lumiere.SIGMA, lumiere.HC_EV_NM, lumiere.X_WIEN, lumiere.WIEN_B,
                                          lumiere.R_HYDROGENE, lumiere.E_IONISATION_EV])

    def source(tau):
        return (30.0 * tau, 5.0 * math.sin(tau))
    for t in (0.0, 1.5, 7.25, -3.0):
        ajoute('lumiere.temps_retarde', lambda tt: lumiere.temps_retarde(tt, source, (100.0, 20.0), 343.0), t)
    # ------------------------------------------------------------ deux corps
    for _ in range(30):
        m1, m2, a = 10 ** u(29, 31), 10 ** u(24, 30), 10 ** u(9, 12)
        e, i, w = u(0, 0.9), u(0, 90), u(0, 360)
        ajoute('deux_corps.periode_s', deux_corps.periode_s, a, m1, m2)
        ajoute('deux_corps.demi_grand_axe_m', deux_corps.demi_grand_axe_m, 10 ** u(4, 9), m1, m2)
        ajoute('deux_corps.amplitude_k', deux_corps.amplitude_k, m1, m2, a, e, i)
        ph = u(-1, 2)
        ajoute('deux_corps.anomalie_vraie', deux_corps.anomalie_vraie, ph, e)
        ajoute('deux_corps.relative', deux_corps.relative, ph, u(0.5, 5), e, i, w)
        ajoute('deux_corps.vitesse_radiale', deux_corps.vitesse_radiale, ph, u(1, 200), e, w)
        ajoute('deux_corps.phase_conjonction', deux_corps.phase_conjonction, e, w)
        ajoute('deux_corps.aire_recouvrement', deux_corps.aire_recouvrement, u(0.1, 1), u(0.1, 1), u(0, 2.2))
        ajoute('deux_corps.flux_deux_disques', deux_corps.flux_deux_disques, ph, u(0.05, 0.4), u(0.05, 0.4), u(0.2, 1),
               u(0.2, 1), e, u(70, 90), w)
        ajoute('deux_corps.luminosite_de_masse', deux_corps.luminosite_de_masse, u(0.1, 30))
        ajoute('deux_corps.temperature_de_luminosite', deux_corps.temperature_de_luminosite, 10 ** u(-3, 5.9))
        ajoute('deux_corps.etoile_sequence_principale', deux_corps.etoile_sequence_principale, u(0.1, 30))
        siecles = u(-2, 0.5)
        ajoute('deux_corps.heliocentrique', deux_corps.heliocentrique,
               rnd.choice(('mercure', 'venus', 'terre', 'mars', 'jupiter', 'saturne', 'uranus', 'neptune')), siecles)
        ajoute('deux_corps.soleil_barycentrique', deux_corps.soleil_barycentrique, siecles,
               ['jupiter', 'saturne', 'uranus', 'neptune', 'terre'])
    for args in ((0.25, 0.1, 0.01, 0.0, 90.0, 90.0), (0.3, 0.2, 0.1, 0.1, 87.0, 40.0), (0.0, 0.1, 0.05, 0.0, 70.0, 90.0)):
        ajoute('deux_corps.duree_transit', deux_corps.duree_transit, *args)

    # ------------------------------------------------------------ arrondis et formats de Python (base de l'affichage)
    egalites = [0.5, 1.5, 2.5, -0.5, -2.5, 0.125, 0.375, 2.675, 1.005, 1e-7, 123456.5, 0.0, -0.0]
    for x in egalites + [u(-1e4, 1e4) for _ in range(60)] + [10 ** u(-6, 9) for _ in range(30)]:
        for d in (0, 1, 2, 3):
            ajoute('py.fixe', lambda a, b: '{:.{}f}'.format(a, b), x, d)
        ajoute('py.pround', lambda a: float(round(a)), x)
        for n in (-3, -2, -1, 0, 1, 2, 4):
            ajoute('py.proundn', lambda a, b: float(round(a, b)), x, n)
        ajoute('py.pmod', lambda a, b: a % b, x, rnd.choice((360.0, 24.0, 1.0, 365.0)))

    sortie = ICI / 'tests' / 'references' / 'calculs.json'
    sortie.parent.mkdir(parents=True, exist_ok=True)
    sortie.write_text(json.dumps(cas, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print('%d cas → %s' % (len(cas), sortie.relative_to(ICI)))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]).resolve())
