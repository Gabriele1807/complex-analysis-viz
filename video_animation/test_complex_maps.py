"""
Test automatici del nucleo matematico ``complex_maps``.

I test verificano le identita' analitiche enunciate nel video e nell'app, non
solo il funzionamento del codice. In particolare sono presenti test che
*smentiscono* affermazioni errate ma diffuse (iniettivita' di z^i sul piano
tagliato, chiusura dell'intervallo immagine della circonferenza unitaria).

Esecuzione:  .venv\\Scripts\\python -m pytest -v
"""

import warnings

import numpy as np
import pytest

import complex_maps as cm


# ---------------------------------------------------------------------------
# Punti di prova. Nessuno sta sul taglio di ramo, salvo dove indicato.
# ---------------------------------------------------------------------------

PUNTI_GENERICI = [
    1 + 0j,
    1j,
    -1j,
    1 + 1j,
    2j,
    0.5 - 0.25j,
    3 + 0.1j,
    -0.7 + 0.7j,     # secondo quadrante, lontano dal taglio
    -1.2 - 0.9j,     # terzo quadrante, lontano dal taglio
    0.08 + 0.06j,    # modulo piccolo ma non nullo
]


def _lontano_dal_taglio(z, tol=1e-6):
    return not (z.real < 0 and abs(z.imag) <= tol)


# ===========================================================================
# Argomento principale e riduzione modulo 2 pi
# ===========================================================================

class TestArgomentoPrincipale:

    def test_valori_notevoli(self):
        assert cm.arg_principal(1 + 0j) == pytest.approx(0.0)
        assert cm.arg_principal(1j) == pytest.approx(cm.PI / 2)
        assert cm.arg_principal(-1j) == pytest.approx(-cm.PI / 2)
        assert cm.arg_principal(1 + 1j) == pytest.approx(cm.PI / 4)

    def test_intervallo_semiaperto(self):
        """Arg assume valori in (-pi, pi]: +pi incluso, -pi escluso."""
        z = np.array(PUNTI_GENERICI)
        a = cm.arg_principal(z)
        assert np.all(a > -cm.PI - 1e-15)
        assert np.all(a <= cm.PI + 1e-15)

    def test_taglio_normalizzato_a_piu_pi(self):
        """Sul semiasse reale negativo Arg = +pi, indipendentemente dal segno
        dello zero immaginario. E' il punto in cui np.angle non basta."""
        assert cm.arg_principal(complex(-1.0, 0.0)) == pytest.approx(cm.PI)
        assert cm.arg_principal(complex(-1.0, -0.0)) == pytest.approx(cm.PI)
        assert cm.arg_principal(complex(-5.0, -0.0)) == pytest.approx(cm.PI)
        # Verifica che il comportamento di np.angle sia effettivamente diverso:
        # il test documenta la ragione di esistere di arg_principal.
        assert np.angle(complex(-1.0, -0.0)) == pytest.approx(-cm.PI)

    def test_origine_non_definita(self):
        assert np.isnan(cm.arg_principal(0 + 0j))

    def test_vettorizzazione_preserva_forma(self):
        z = np.array(PUNTI_GENERICI).reshape(5, 2)
        assert cm.arg_principal(z).shape == (5, 2)
        assert np.isscalar(cm.arg_principal(1j)) or isinstance(
            cm.arg_principal(1j), float
        )


class TestWrapToPi:

    def test_identita_dentro_intervallo(self):
        t = np.array([-3.0, -1.0, 0.0, 1.0, 3.0])
        assert cm.wrap_to_pi(t) == pytest.approx(t)

    def test_riduzione_modulo_due_pi(self):
        for t in [-20.0, -7.3, 4.2, 11.0, 100.0]:
            r = cm.wrap_to_pi(t)
            assert -cm.PI < r <= cm.PI + 1e-12
            # differisce dall'originale per un multiplo intero di 2 pi
            k = (t - r) / cm.DUE_PI
            assert k == pytest.approx(round(k), abs=1e-9)

    def test_estremi_convenzione_semiaperta(self):
        assert cm.wrap_to_pi(cm.PI) == pytest.approx(cm.PI)
        assert cm.wrap_to_pi(-cm.PI) == pytest.approx(cm.PI)


# ===========================================================================
# Logaritmo principale e rami
# ===========================================================================

class TestLogaritmo:

    def test_definizione(self):
        for z in PUNTI_GENERICI:
            atteso = np.log(abs(z)) + 1j * cm.arg_principal(z)
            assert cm.principal_log(z) == pytest.approx(atteso)

    def test_exp_log_identita(self):
        """exp(Log z) = z per ogni z != 0 (vale anche sul taglio)."""
        for z in PUNTI_GENERICI + [complex(-2.0, 0.0)]:
            assert np.exp(cm.principal_log(z)) == pytest.approx(z, abs=1e-12)

    def test_rami_differiscono_per_due_pi_i(self):
        z = 1 + 1j
        rami = cm.compute_log_branches(z, range(-2, 3))
        assert rami.shape == (5,)
        base = cm.principal_log(z)
        for idx, k in enumerate(range(-2, 3)):
            assert rami[idx] == pytest.approx(base + 1j * cm.DUE_PI * k)
        # parte reale comune a tutti i rami
        assert np.allclose(rami.real, np.log(abs(z)))

    def test_rami_su_array(self):
        z = np.array(PUNTI_GENERICI)
        rami = cm.compute_log_branches(z, range(-1, 2))
        assert rami.shape == (3, len(PUNTI_GENERICI))

    def test_exp_di_ogni_ramo_restituisce_z(self):
        """Ogni ramo del logaritmo e' un logaritmo: exp(log_k z) = z."""
        z = 2 - 1j
        for valore in cm.compute_log_branches(z, range(-3, 4)):
            assert np.exp(valore) == pytest.approx(z, abs=1e-10)


# ===========================================================================
# z^n : proprieta' algebriche
# ===========================================================================

class TestPotenzeIntere:

    @pytest.mark.parametrize("n", [2, 3, 4, 5, 7, 10])
    def test_modulo_moltiplicativo(self, n):
        """|z^n| = |z|^n."""
        z = np.array(PUNTI_GENERICI)
        assert np.abs(cm.map_z_power(z, n)) == pytest.approx(
            np.abs(z) ** n, rel=1e-12
        )

    @pytest.mark.parametrize("n", [2, 3, 4, 5, 10])
    def test_argomento_moltiplicato(self, n):
        """arg(z^n) = n arg(z) modulo 2 pi."""
        z = np.array([p for p in PUNTI_GENERICI if _lontano_dal_taglio(p)])
        atteso = cm.wrap_to_pi(n * cm.arg_principal(z))
        ottenuto = cm.arg_principal(cm.map_z_power(z, n))
        # confronto modulo 2 pi, robusto all'ambiguita' +-pi
        diff = cm.wrap_to_pi(ottenuto - atteso)
        assert np.max(np.abs(diff)) < 1e-9

    @pytest.mark.parametrize("n", [2, 3, 4, 5, 6, 10])
    def test_n_preimmagini_distinte(self, n):
        """Ogni w != 0 ha esattamente n preimmagini distinte sotto z^n."""
        w = 1.7 - 0.9j
        radici = cm.compute_nth_roots(w, n)
        assert radici.shape == (n,)
        # sono effettivamente preimmagini
        assert cm.map_z_power(radici, n) == pytest.approx(
            np.full(n, w), abs=1e-10
        )
        # sono distinte
        distanze = np.abs(radici[:, None] - radici[None, :])
        np.fill_diagonal(distanze, np.inf)
        assert distanze.min() > 1e-6

    @pytest.mark.parametrize("n", [2, 3, 5, 8])
    def test_radici_su_poligono_regolare(self, n):
        """Le radici hanno modulo |w|^{1/n} e passo angolare 2 pi / n."""
        w = -2 + 3j
        radici = cm.compute_nth_roots(w, n)
        assert np.allclose(np.abs(radici), abs(w) ** (1.0 / n))
        angoli = np.angle(radici)
        passi = cm.wrap_to_pi(np.diff(angoli))
        assert np.allclose(np.abs(passi), cm.DUE_PI / n, atol=1e-9)

    @pytest.mark.parametrize("n", [2, 3, 4, 5])
    def test_somma_radici_nulla(self, n):
        """Per n >= 2 la somma delle radici n-esime e' nulla (coeff. di z^{n-1})."""
        w = 3 + 1j
        assert cm.compute_nth_roots(w, n).sum() == pytest.approx(0, abs=1e-10)

    @pytest.mark.parametrize("n", [2, 3, 4, 5])
    def test_prodotto_radici(self, n):
        """Il prodotto delle radici n-esime vale (-1)^{n+1} w."""
        w = 1.3 - 2.1j
        atteso = ((-1.0) ** (n + 1)) * w
        assert np.prod(cm.compute_nth_roots(w, n)) == pytest.approx(
            atteso, abs=1e-10
        )

    @pytest.mark.parametrize("n", [2, 3, 5])
    def test_radici_di_zero_con_molteplicita(self, n):
        radici = cm.compute_nth_roots(0 + 0j, n)
        assert radici.shape == (n,)
        assert np.allclose(radici, 0)

    def test_radici_su_array(self):
        w = np.array([1 + 0j, 1j, -4 + 0j])
        radici = cm.compute_nth_roots(w, 3)
        assert radici.shape == (3, 3)
        assert np.allclose(cm.map_z_power(radici, 3), w[None, :])

    def test_non_conformita_nell_origine(self):
        """f'(0) = 0 per n >= 2: punto critico, Jacobiano degenere."""
        for n in [2, 3, 4, 5]:
            assert cm.derivative_z_power(0 + 0j, n) == pytest.approx(0)
            # det J = |f'|^2
            z = 0.7 + 0.3j
            det_j = abs(cm.derivative_z_power(z, n)) ** 2
            assert det_j == pytest.approx(n**2 * abs(z) ** (2 * n - 2))

    def test_n_uno_identita(self):
        z = np.array(PUNTI_GENERICI)
        assert cm.map_z_power(z, 1) == pytest.approx(z)

    def test_n_non_intero_rifiutato(self):
        with pytest.raises(ValueError):
            cm.map_z_power(1j, 2.5)
        with pytest.raises(ValueError):
            cm.compute_nth_roots(1j, 0)


# ===========================================================================
# z^i : ramo principale
# ===========================================================================

class TestPotenzaImmaginariaPrincipale:

    def test_i_alla_i(self):
        """i^i = e^{-pi/2} ~ 0.207879576..., reale positivo."""
        valore = cm.map_z_i_principal(1j)
        assert valore.imag == pytest.approx(0.0, abs=1e-15)
        assert valore.real == pytest.approx(np.exp(-cm.PI / 2), rel=1e-14)
        assert valore.real == pytest.approx(0.20787957635076193, rel=1e-12)

    def test_uno_alla_i(self):
        assert cm.map_z_i_principal(1 + 0j) == pytest.approx(1 + 0j)

    def test_definizione_via_exp_log(self):
        """z^i = exp(i Log z): coerenza fra forma chiusa e composizione."""
        for z in PUNTI_GENERICI:
            atteso = np.exp(1j * cm.principal_log(z))
            assert cm.map_z_i_principal(z) == pytest.approx(atteso, abs=1e-12)

    def test_modulo_dipende_solo_da_arg(self):
        """|z^i| = e^{-Arg z}."""
        z = np.array(PUNTI_GENERICI)
        assert np.abs(cm.map_z_i_principal(z)) == pytest.approx(
            np.exp(-cm.arg_principal(z)), rel=1e-13
        )
        assert cm.z_i_modulus(z) == pytest.approx(np.abs(cm.map_z_i_principal(z)))

    def test_modulo_invariante_lungo_i_raggi(self):
        """Su un raggio arg z = theta0 il modulo dell'immagine e' costante."""
        theta0 = 0.9
        r = np.array([0.1, 0.5, 1.0, 2.0, 50.0, 1000.0])
        z = r * np.exp(1j * theta0)
        moduli = np.abs(cm.map_z_i_principal(z))
        assert np.allclose(moduli, np.exp(-theta0), rtol=1e-12)

    def test_argomento_dipende_solo_dal_modulo(self):
        """arg(z^i) = ln|z| modulo 2 pi."""
        z = np.array([p for p in PUNTI_GENERICI if _lontano_dal_taglio(p)])
        ottenuto = cm.arg_principal(cm.map_z_i_principal(z))
        atteso = cm.wrap_to_pi(np.log(np.abs(z)))
        diff = cm.wrap_to_pi(ottenuto - atteso)
        assert np.max(np.abs(diff)) < 1e-10

    def test_argomento_invariante_sui_cerchi(self):
        """Su |z| = r0 l'argomento dell'immagine e' costante = ln r0."""
        r0 = 2.0
        theta = np.linspace(-cm.PI + 0.01, cm.PI - 0.01, 50)
        z = r0 * np.exp(1j * theta)
        args = cm.arg_principal(cm.map_z_i_principal(z))
        diff = cm.wrap_to_pi(args - cm.wrap_to_pi(np.log(r0)))
        assert np.max(np.abs(diff)) < 1e-10

    def test_origine_non_definita_senza_warning(self):
        with warnings.catch_warnings():
            warnings.simplefilter("error")
            valore = cm.map_z_i_principal(0 + 0j)
        assert np.isnan(valore.real) and np.isnan(valore.imag)

    def test_nessun_warning_su_griglia_con_origine(self):
        """Una griglia densa che contiene esattamente z = 0 non deve
        generare RuntimeWarning (divide by zero / invalid value)."""
        x = np.linspace(-3, 3, 101)   # 101 punti dispari => contiene 0.0
        X, Y = np.meshgrid(x, x)
        z = X + 1j * Y
        assert np.any(z == 0)
        with warnings.catch_warnings():
            warnings.simplefilter("error")
            w = cm.map_z_i_principal(z)
            _ = cm.map_z_power(z, 5)
            _ = cm.arg_principal(z)
            _ = cm.principal_log(z)
            _ = cm.derivative_z_i(z)
        assert np.isnan(w[z == 0]).all()
        assert np.isfinite(w[z != 0]).all()

    def test_modulo_limitato_vicino_all_origine(self):
        """Correzione concettuale: per r -> 0+ il modulo di z^i NON diverge,
        resta in [e^{-pi}, e^{pi}); e' la fase che oscilla illimitatamente."""
        r = np.array([1e-1, 1e-3, 1e-6, 1e-12, 1e-30])
        z = r * np.exp(1j * 0.5)
        moduli = np.abs(cm.map_z_i_principal(z))
        assert np.allclose(moduli, np.exp(-0.5))
        # la fase non ha limite: ln r -> -inf
        fasi = cm.z_i_argument(z, principale=False)
        assert np.all(np.diff(fasi) < 0)
        assert fasi[-1] < -60

    def test_conformita_su_tutto_il_piano_tagliato(self):
        """f'(z) = i z^i / z non si annulla mai: z^i e' sempre conforme."""
        z = np.array([p for p in PUNTI_GENERICI if _lontano_dal_taglio(p)])
        d = cm.derivative_z_i(z)
        assert np.all(np.abs(d) > 0)
        assert np.all(np.isfinite(d))

    def test_derivata_coerente_con_rapporto_incrementale(self):
        z0 = 1.3 + 0.7j
        h = 1e-7
        numerica = (cm.map_z_i_principal(z0 + h) - cm.map_z_i_principal(z0 - h)) / (2 * h)
        assert cm.derivative_z_i(z0) == pytest.approx(numerica, rel=1e-6)


# ===========================================================================
# z^i : immagine, iniettivita', taglio di ramo
# ===========================================================================

class TestImmagineEIniettivita:

    def test_immagine_dentro_la_corona(self):
        """Per ogni z != 0: e^{-pi} <= |z^i| < e^{pi}."""
        rng = np.random.default_rng(20261001)
        z = rng.uniform(-4, 4, 5000) + 1j * rng.uniform(-4, 4, 5000)
        z = z[z != 0]
        m = np.abs(cm.map_z_i_principal(z))
        assert np.all(m >= cm.E_MENO_PI - 1e-12)
        assert np.all(m < cm.E_PI + 1e-12)

    def test_estremo_interno_attinto_sul_taglio(self):
        """|z^i| = e^{-pi} e' attinto esattamente sul semiasse reale negativo,
        dove Arg z = pi. Quindi su C \\ {0} la corona e' semiaperta."""
        valore = cm.map_z_i_principal(complex(-3.0, 0.0))
        assert abs(valore) == pytest.approx(cm.E_MENO_PI, rel=1e-13)

    def test_estremo_esterno_mai_attinto(self):
        """|z^i| = e^{pi} richiederebbe Arg z = -pi, escluso da (-pi, pi]."""
        rng = np.random.default_rng(7)
        z = rng.uniform(-4, 4, 20000) + 1j * rng.uniform(-4, 4, 20000)
        z = z[z != 0]
        assert np.max(np.abs(cm.map_z_i_principal(z))) < cm.E_PI

    def test_bordi_corona_dichiarati_correttamente(self):
        tagliato = cm.image_annulus("tagliato")
        bucato = cm.image_annulus("bucato")
        assert tagliato["r_min_incluso"] is False   # corona aperta
        assert bucato["r_min_incluso"] is True      # corona semiaperta
        assert tagliato["r_max_incluso"] is False
        assert bucato["r_max_incluso"] is False
        assert tagliato["r_min"] == pytest.approx(np.exp(-cm.PI))
        assert tagliato["r_max"] == pytest.approx(np.exp(cm.PI))

    def test_z_i_NON_e_iniettiva_sul_piano_tagliato(self):
        """CORREZIONE alla specifica: controesempio esplicito.
        1 e e^{2 pi} sono entrambi nel piano tagliato e hanno la stessa
        immagine sotto il ramo principale di z^i."""
        z1 = 1 + 0j
        z2 = complex(np.exp(cm.DUE_PI), 0.0)
        assert abs(z1 - z2) > 500            # punti ben distinti
        assert cm.near_branch_cut(z1) is False or not cm.near_branch_cut(z1)
        assert not cm.near_branch_cut(z2)
        assert cm.map_z_i_principal(z1) == pytest.approx(
            cm.map_z_i_principal(z2), abs=1e-9
        )

    def test_fibra_e_progressione_geometrica_allineata(self):
        """La fibra di z e' {z e^{2 pi m}}: stessa semiretta, stessa immagine."""
        z = 1.4 + 0.6j
        fibra = cm.z_i_fiber(z, range(-2, 3))
        assert fibra.shape == (5,)
        # allineamento radiale nel dominio: argomento costante
        assert np.allclose(cm.arg_principal(fibra), cm.arg_principal(z))
        # tutti gli elementi hanno la stessa immagine
        immagini = cm.map_z_i_principal(fibra)
        for valore in immagini:
            assert valore == pytest.approx(immagini[2], rel=1e-8)

    def test_corona_di_iniettivita(self):
        """Su una corona di ampiezza 2 pi in ln|z| la mappa e' iniettiva."""
        a, b = cm.injectivity_annulus(1.5 + 0.2j)
        assert np.log(b) - np.log(a) == pytest.approx(cm.DUE_PI)
        assert a <= abs(1.5 + 0.2j) < b
        # campionamento nella corona: nessuna collisione
        rng = np.random.default_rng(99)
        r = np.exp(rng.uniform(np.log(a) + 1e-3, np.log(b) - 1e-3, 400))
        th = rng.uniform(-cm.PI + 1e-3, cm.PI - 1e-3, 400)
        z = r * np.exp(1j * th)
        w = cm.map_z_i_principal(z)
        d = np.abs(w[:, None] - w[None, :])
        np.fill_diagonal(d, np.inf)
        assert d.min() > 1e-6

    def test_salto_attraverso_il_taglio(self):
        """Attraversando (-inf, 0] il modulo dell'immagine salta di e^{2 pi}."""
        sopra = cm.map_z_i_principal(complex(-2.0, +1e-9))
        sotto = cm.map_z_i_principal(complex(-2.0, -1e-9))
        rapporto = abs(sotto) / abs(sopra)
        assert rapporto == pytest.approx(np.exp(cm.DUE_PI), rel=1e-6)
        assert rapporto == pytest.approx(535.4916555, rel=1e-6)

    def test_rilevamento_taglio(self):
        assert cm.near_branch_cut(-2 + 0j, tol=1e-3)
        assert cm.near_branch_cut(-2 + 1e-4j, tol=1e-3)
        assert not cm.near_branch_cut(-2 + 0.5j, tol=1e-3)
        assert not cm.near_branch_cut(2 + 0j, tol=1e-3)

    def test_raggio_aliasing(self):
        """Con passo h e soglia pi/2, il raggio critico e' 2h/pi."""
        h = 6.0 / 512
        assert cm.raggio_aliasing(h) == pytest.approx(h / (cm.PI / 2))
        r = cm.raggio_aliasing(h)
        # al raggio critico la variazione di fase e' esattamente pi/2
        assert h / r == pytest.approx(cm.PI / 2)

    def test_maschera_dominio_sicuro(self):
        z = np.array([0.0 + 0j, 0.01 + 0j, 0.05 + 0j, 1 + 0j])
        m = cm.safe_domain_mask(z, r_min=0.05)
        assert list(m) == [False, False, True, True]


# ===========================================================================
# z^i : multivalenza
# ===========================================================================

class TestMultivalenza:

    def test_ramo_zero_e_il_principale(self):
        for z in PUNTI_GENERICI:
            assert cm.map_z_i_branch(z, 0) == pytest.approx(
                cm.map_z_i_principal(z)
            )

    @pytest.mark.parametrize("k", [-2, -1, 0, 1, 2])
    def test_fattore_esponenziale_reale(self, k):
        """z^i_k = z^i e^{-2 pi k}, con fattore reale positivo."""
        z = 1 + 1j
        atteso = cm.map_z_i_principal(z) * np.exp(-cm.DUE_PI * k)
        assert cm.map_z_i_branch(z, k) == pytest.approx(atteso, rel=1e-12)

    def test_definizione_via_rami_del_logaritmo(self):
        """Coerenza fra map_z_i_branch e exp(i log_k z)."""
        z = -0.8 + 1.1j
        rami_log = cm.compute_log_branches(z, range(-2, 3))
        for idx, k in enumerate(range(-2, 3)):
            atteso = np.exp(1j * rami_log[idx])
            assert cm.map_z_i_branch(z, k) == pytest.approx(atteso, rel=1e-10)

    @pytest.mark.parametrize("k", [-2, -1, 1, 2])
    def test_allineamento_radiale_dei_rami(self, k):
        """Tutti i rami hanno lo stesso argomento: sono allineati sulla stessa
        semiretta uscente dall'origine."""
        z = 2.0 - 0.5j
        a0 = cm.arg_principal(cm.map_z_i_branch(z, 0))
        ak = cm.arg_principal(cm.map_z_i_branch(z, k))
        assert cm.wrap_to_pi(ak - a0) == pytest.approx(0.0, abs=1e-10)

    def test_rapporto_fra_rami_consecutivi(self):
        z = 1.7 + 0.3j
        for k in range(-2, 2):
            r = abs(cm.map_z_i_branch(z, k + 1)) / abs(cm.map_z_i_branch(z, k))
            assert r == pytest.approx(cm.FATTORE_RAMO, rel=1e-12)

    def test_i_alla_i_tutti_i_rami(self):
        """I valori di i^i sono e^{-pi/2 - 2 pi k}, tutti reali positivi."""
        for k in range(-2, 3):
            valore = cm.map_z_i_branch(1j, k)
            assert valore.imag == pytest.approx(0.0, abs=1e-12)
            assert valore.real == pytest.approx(
                np.exp(-cm.PI / 2 - cm.DUE_PI * k), rel=1e-12
            )

    def test_k_non_intero_rifiutato(self):
        with pytest.raises(ValueError):
            cm.map_z_i_branch(1j, 0.5)


# ===========================================================================
# Casi speciali guidati (gli stessi preset dell'app interattiva)
# ===========================================================================

class TestCasiSpeciali:

    def test_circonferenza_unitaria_va_nel_segmento_reale(self):
        """|z| = 1 viene inviata nel segmento reale positivo [e^{-pi}, e^{pi}),
        semiaperto a destra: l'estremo e^{pi} non e' attinto."""
        theta = np.linspace(-cm.PI + 1e-12, cm.PI, 2001)
        z = np.exp(1j * theta)
        w = cm.map_z_i_principal(z)
        # immagine reale positiva
        assert np.max(np.abs(w.imag)) < 1e-12
        assert np.all(w.real > 0)
        # estremi
        assert np.min(w.real) >= cm.E_MENO_PI - 1e-12
        assert np.max(w.real) < cm.E_PI
        # il minimo e' attinto (theta = pi), il massimo no
        assert np.min(w.real) == pytest.approx(cm.E_MENO_PI, rel=1e-9)
        assert cm.E_PI - np.max(w.real) > 0

    def test_semiasse_reale_positivo_va_nella_circonferenza_unitaria(self):
        """r > 0 reale => z^i = e^{i ln r}: modulo 1, argomento ln r illimitato,
        dunque la circonferenza e' percorsa infinite volte."""
        r = np.exp(np.linspace(-30, 30, 4001))
        w = cm.map_z_i_principal(r.astype(complex))
        assert np.allclose(np.abs(w), 1.0, rtol=1e-12)
        fase = cm.z_i_argument(r.astype(complex), principale=False)
        # il numero di giri completi e' (ln r_max - ln r_min) / 2 pi
        giri = (fase.max() - fase.min()) / cm.DUE_PI
        assert giri == pytest.approx(60.0 / cm.DUE_PI, rel=1e-9)
        assert giri > 9  # oltre nove avvolgimenti su questo solo intervallo

    def test_raggio_va_in_circonferenza(self):
        """arg z = theta0 costante => |w| = e^{-theta0} costante: l'immagine di
        un raggio e' (parte di) una circonferenza, percorsa infinite volte."""
        theta0 = -0.4
        r = np.exp(np.linspace(-15, 15, 3001))
        w = cm.map_z_i_principal(r * np.exp(1j * theta0))
        assert np.allclose(np.abs(w), np.exp(-theta0), rtol=1e-12)
        # copertura angolare completa: tutti i quadranti sono visitati
        a = cm.arg_principal(w)
        assert a.min() < -cm.PI / 2 and a.max() > cm.PI / 2

    def test_cerchio_va_in_segmento_radiale(self):
        """|z| = r0 costante => arg w = ln r0 costante e |w| in [e^{-pi}, e^{pi}):
        l'immagine e' un SEGMENTO radiale, non una semiretta."""
        r0 = 0.6
        theta = np.linspace(-cm.PI + 1e-9, cm.PI, 1501)
        w = cm.map_z_i_principal(r0 * np.exp(1j * theta))
        a = cm.arg_principal(w)
        assert np.allclose(cm.wrap_to_pi(a - cm.wrap_to_pi(np.log(r0))), 0, atol=1e-10)
        m = np.abs(w)
        assert m.min() == pytest.approx(cm.E_MENO_PI, rel=1e-9)
        assert m.max() < cm.E_PI          # segmento limitato: non una semiretta
        assert m.max() / m.min() == pytest.approx(np.exp(cm.DUE_PI), rel=1e-6)

    def test_valori_notevoli_tabellati(self):
        """Valori di controllo calcolati a mano."""
        casi = {
            1 + 0j: 1 + 0j,
            1j: np.exp(-cm.PI / 2) + 0j,
            -1j: np.exp(cm.PI / 2) + 0j,
            complex(-1.0, 0.0): np.exp(-cm.PI) + 0j,
        }
        for z, atteso in casi.items():
            assert cm.map_z_i_principal(z) == pytest.approx(atteso, abs=1e-12)

    def test_1_piu_i(self):
        """(1+i)^i = e^{-pi/4} e^{i ln sqrt(2)}."""
        z = 1 + 1j
        w = cm.map_z_i_principal(z)
        assert abs(w) == pytest.approx(np.exp(-cm.PI / 4), rel=1e-13)
        assert cm.arg_principal(w) == pytest.approx(0.5 * np.log(2.0), rel=1e-12)


# ===========================================================================
# Supporto alla visualizzazione
# ===========================================================================

class TestPhasePortrait:

    def test_griglia_vettorizzata(self):
        dati = cm.phase_portrait_data(cm.map_z_i_principal, risoluzione=64)
        assert dati["z"].shape == (64, 64)
        assert dati["w"].shape == (64, 64)
        assert dati["argomento"].shape == (64, 64)
        assert np.all(dati["argomento"][np.isfinite(dati["argomento"])] <= cm.PI + 1e-12)

    def test_griglia_z_power(self):
        dati = cm.phase_portrait_data(lambda z: cm.map_z_power(z, 5), risoluzione=32)
        assert np.allclose(dati["modulo"], np.abs(dati["z"]) ** 5)

    def test_prestazioni_griglia_densa(self):
        """500x500 e' il target minimo della specifica: deve essere immediato."""
        import time

        t0 = time.perf_counter()
        dati = cm.phase_portrait_data(cm.map_z_i_principal, risoluzione=512)
        dt = time.perf_counter() - t0
        assert dati["w"].shape == (512, 512)
        assert dt < 2.0, "griglia 512x512 troppo lenta: %.3f s" % dt
