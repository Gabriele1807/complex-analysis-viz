"""
Nucleo matematico per le mappe complesse z -> z^n  e  z -> z^i.

Questo modulo contiene *solo* matematica: nessuna dipendenza da Manim o da una
qualunque libreria grafica. Viene usato sia dalle scene del video
(``scenes.py``) sia dalla suite di test (``test_complex_maps.py``), ed e'
l'implementazione di riferimento rispetto alla quale e' validata la versione
TypeScript dell'applicazione interattiva (``interactive_map/src/math/``).

Convenzioni adottate
--------------------
* ``Arg z`` indica l'argomento principale, con ``Arg z`` in ``(-pi, pi]``.
* ``Log z = ln|z| + i Arg z`` e' il logaritmo principale, definito su
  ``C \\ {0}``; e' olomorfo su ``C \\ (-inf, 0]`` (piano tagliato).
* ``log_k z = ln|z| + i (Arg z + 2 pi k)``, ``k`` intero, sono i rami del
  logaritmo multivalore.
* ``z^i`` senza ulteriori specificazioni indica il *ramo principale*
  ``exp(i Log z)``.

Tutte le funzioni sono vettorizzate: accettano scalari (restituendo scalari
Python) oppure array NumPy di qualunque forma (restituendo array della stessa
forma). Nessuna funzione emette RuntimeWarning: i punti non definiti
restituiscono ``nan`` in modo esplicito e controllato.
"""

from __future__ import annotations

from typing import Iterable, Sequence

import numpy as np

__all__ = [
    "PI",
    "DUE_PI",
    "E_MENO_PI",
    "E_PI",
    "FATTORE_RAMO",
    "FORMULE_LATEX",
    "arg_principal",
    "wrap_to_pi",
    "principal_log",
    "compute_log_branches",
    "map_z_power",
    "map_z_i_principal",
    "map_z_i_branch",
    "compute_nth_roots",
    "z_i_modulus",
    "z_i_argument",
    "z_i_fiber",
    "derivative_z_power",
    "derivative_z_i",
    "near_branch_cut",
    "safe_domain_mask",
    "raggio_aliasing",
    "image_annulus",
    "injectivity_annulus",
    "phase_portrait_data",
]

# ---------------------------------------------------------------------------
# Costanti notevoli
# ---------------------------------------------------------------------------

PI = float(np.pi)
DUE_PI = 2.0 * PI

# Estremi del modulo dell'immagine di z^i sul ramo principale:
# |z^i| = e^{-Arg z} con Arg z in (-pi, pi], quindi |z^i| in [e^{-pi}, e^{pi}).
E_MENO_PI = float(np.exp(-PI))   # ~ 0.04321391826377226
E_PI = float(np.exp(PI))         # ~ 23.140692632779267

# Rapporto geometrico fra due rami consecutivi di z^i:
# z^i_{k+1} / z^i_k = e^{-2 pi}.
FATTORE_RAMO = float(np.exp(-DUE_PI))  # ~ 0.0018674427317079893

# Formule simboliche (LaTeX) delle mappe, riutilizzate dal video e dalla UI.
FORMULE_LATEX = {
    "z_power": r"f(z) = z^{{{n}}} = r^{{{n}}} e^{{i {n} \theta}}",
    "z_i_principal": r"f(z) = z^{i} = e^{i \operatorname{Log} z} = e^{-\theta} e^{i \ln r}",
    "z_i_branch": r"f_k(z) = z^{i}_{k} = e^{i \log_k z} = z^{i} e^{-2\pi k}",
    "log_principal": (
        r"\operatorname{Log} z = \ln|z| + i \operatorname{Arg} z,"
        r"\quad \operatorname{Arg} z \in (-\pi, \pi]"
    ),
}


# ---------------------------------------------------------------------------
# Utilita' interne
# ---------------------------------------------------------------------------

def _as_c(z) -> np.ndarray:
    """Converte l'ingresso in array complesso (``complex128``)."""
    return np.asarray(z, dtype=np.complex128)


def _scalare(z) -> bool:
    """True se l'ingresso originale era uno scalare (ndim == 0)."""
    return np.ndim(z) == 0


def _out(valori: np.ndarray, era_scalare: bool):
    """Riporta il risultato a scalare Python se l'ingresso era scalare."""
    if era_scalare:
        return valori.item()
    return valori


# ---------------------------------------------------------------------------
# Argomento e logaritmo
# ---------------------------------------------------------------------------

def arg_principal(z):
    """Argomento principale Arg z, con valori in (-pi, pi].

    Rispetto a ``np.angle`` questa funzione normalizza in modo *deterministico*
    il comportamento sul taglio di ramo. ``np.angle`` dipende dal segno dello
    zero immaginario: ``np.angle(complex(-1.0, 0.0)) == +pi`` mentre
    ``np.angle(complex(-1.0, -0.0)) == -pi``.

    Poiche' la convenzione scelta e' Arg in (-pi, pi], il semiasse reale
    negativo deve valere +pi in entrambi i casi. In z = 0 l'argomento non e'
    definito e viene restituito ``nan``.
    """
    era_scalare = _scalare(z)
    zz = _as_c(z)
    with np.errstate(invalid="ignore", divide="ignore"):
        a = np.angle(zz)
    # Semiasse reale negativo (incluso il caso Im z = -0.0) -> +pi.
    sul_taglio = (zz.imag == 0.0) & (zz.real < 0.0)
    a = np.where(sul_taglio, PI, a)
    # L'origine non ha argomento.
    a = np.where(zz == 0.0, np.nan, a)
    return _out(np.asarray(a, dtype=np.float64), era_scalare)


def wrap_to_pi(theta):
    """Riduce un angolo all'intervallo (-pi, pi].

    Usata per passare da ``arg`` (multivalore, definito modulo 2 pi) a ``Arg``
    (principale). L'implementazione manda esattamente -pi in +pi, coerentemente
    con la convenzione di intervallo semiaperto a destra.
    """
    era_scalare = _scalare(theta)
    t = np.asarray(theta, dtype=np.float64)
    # (pi - theta) mod 2pi sta in [0, 2pi); il segno meno finale realizza
    # l'intervallo semiaperto a destra invece che a sinistra.
    ridotto = PI - np.mod(PI - t, DUE_PI)
    return _out(np.asarray(ridotto, dtype=np.float64), era_scalare)


def principal_log(z):
    """Logaritmo principale Log z = ln|z| + i Arg z.

    Definito su C senza l'origine, olomorfo sul piano tagliato
    C \\ (-inf, 0]. In z = 0 restituisce ``nan`` senza emettere warning.
    """
    era_scalare = _scalare(z)
    zz = _as_c(z)
    r = np.abs(zz)
    with np.errstate(divide="ignore", invalid="ignore"):
        ln_r = np.where(r > 0.0, np.log(np.where(r > 0.0, r, 1.0)), np.nan)
    a = np.asarray(arg_principal(zz), dtype=np.float64)
    risultato = ln_r + 1j * a
    return _out(np.asarray(risultato, dtype=np.complex128), era_scalare)


def compute_log_branches(z, k_range: Iterable[int] = range(-2, 3)) -> np.ndarray:
    """Rami del logaritmo multivalore.

    Restituisce ``log_k z = ln|z| + i (Arg z + 2 pi k)`` per ogni ``k`` in
    ``k_range``.

    Forma del risultato: ``(len(k_range),)`` per ``z`` scalare, oppure
    ``(len(k_range),) + np.shape(z)`` per ``z`` array (primo asse = rami).
    """
    ks = np.asarray(list(k_range), dtype=np.float64)
    base = _as_c(principal_log(z))
    # Broadcast: aggiunge a ks gli assi necessari ad allinearla a base.
    forma_k = (ks.size,) + (1,) * base.ndim
    return base[np.newaxis, ...] + 1j * DUE_PI * ks.reshape(forma_k)


# ---------------------------------------------------------------------------
# Mappa algebrica  z -> z^n
# ---------------------------------------------------------------------------

def map_z_power(z, n: int):
    """Potenza intera z -> z^n.

    In forma polare ``z^n = r^n e^{i n theta}``, da cui ``|z^n| = |z|^n`` e
    ``arg(z^n) = n arg(z)`` modulo 2 pi.

    La mappa e' univoca (polinomiale, quindi intera per ``n >= 0``) e per
    ``n >= 1`` e' esattamente ``n``-a-1 su C senza l'origine: ogni ``w != 0``
    ha ``n`` preimmagini distinte. L'origine e' l'unica preimmagine di 0 e vi
    ha molteplicita' ``n``.

    Parametri
    ---------
    n : int
        Esponente intero. Sono ammessi anche valori negativi (mappa meromorfa
        con polo in 0); in tal caso ``z = 0`` restituisce ``nan``.
    """
    if int(n) != n:
        raise ValueError("map_z_power richiede n intero, ricevuto %r" % (n,))
    n = int(n)
    era_scalare = _scalare(z)
    zz = _as_c(z)
    with np.errstate(divide="ignore", invalid="ignore", over="ignore"):
        risultato = np.power(zz, n)
        if n < 0:
            risultato = np.where(zz == 0.0, np.nan + 1j * np.nan, risultato)
    return _out(np.asarray(risultato, dtype=np.complex128), era_scalare)


def derivative_z_power(z, n: int):
    """Derivata d/dz z^n = n z^{n-1}.

    Per ``n >= 2`` si annulla in z = 0: ivi la mappa non e' conforme e il
    Jacobiano reale, di determinante ``|f'(z)|^2 = n^2 |z|^{2n-2}``, degenera.
    Gli angoli nell'origine vengono moltiplicati per ``n``.
    """
    n = int(n)
    era_scalare = _scalare(z)
    zz = _as_c(z)
    with np.errstate(divide="ignore", invalid="ignore", over="ignore"):
        risultato = n * np.power(zz, n - 1)
    return _out(np.asarray(risultato, dtype=np.complex128), era_scalare)


def compute_nth_roots(w, n: int) -> np.ndarray:
    """Le ``n`` radici n-esime di ``w``, cioe' le preimmagini di ``w`` sotto z^n.

    ``z_k = |w|^{1/n} e^{i (Arg w + 2 pi k)/n}``, con ``k = 0, ..., n-1``.

    Sono i vertici di un n-agono regolare inscritto nella circonferenza di
    raggio ``|w|^{1/n}``, a passo angolare ``2 pi / n``.

    Caso ``w = 0``: la sola preimmagine e' ``z = 0``, con molteplicita' ``n``;
    vengono restituiti ``n`` zeri (le radici *contate con molteplicita'*).

    Forma del risultato: ``(n,)`` per ``w`` scalare, ``(n,) + np.shape(w)`` per
    ``w`` array (primo asse = indice ``k``).
    """
    if int(n) != n or n < 1:
        raise ValueError("compute_nth_roots richiede n intero >= 1, ricevuto %r" % (n,))
    n = int(n)
    ww = _as_c(w)
    modulo = np.abs(ww)
    arg = np.asarray(arg_principal(ww), dtype=np.float64)
    # Per w = 0 l'argomento e' nan: lo sostituiamo con 0 perche' il raggio
    # |w|^{1/n} = 0 annulla comunque il risultato.
    arg = np.where(modulo == 0.0, 0.0, arg)
    raggio = np.power(modulo, 1.0 / n)
    ks = np.arange(n, dtype=np.float64).reshape((n,) + (1,) * ww.ndim)
    theta = (arg[np.newaxis, ...] + DUE_PI * ks) / n
    return raggio[np.newaxis, ...] * np.exp(1j * theta)


# ---------------------------------------------------------------------------
# Mappa trascendente  z -> z^i
# ---------------------------------------------------------------------------

def z_i_modulus(z):
    """Modulo di z^i sul ramo principale: |z^i| = e^{-Arg z}.

    Dipende **solo** dall'argomento di ``z``. Poiche' Arg z sta in (-pi, pi],
    si ha ``|z^i|`` in ``[e^{-pi}, e^{pi})``.
    """
    era_scalare = _scalare(z)
    a = np.asarray(arg_principal(z), dtype=np.float64)
    with np.errstate(over="ignore", invalid="ignore"):
        m = np.exp(-a)
    return _out(np.asarray(m, dtype=np.float64), era_scalare)


def z_i_argument(z, principale: bool = True):
    """Argomento di z^i: arg(z^i) = ln|z| modulo 2 pi.

    Dipende **solo** dal modulo di ``z``. Con ``principale=True`` il valore e'
    ridotto a (-pi, pi]; con ``principale=False`` viene restituito il
    rappresentante ``ln|z|``, non ridotto, utile per seguire con continuita'
    l'avvolgimento (illimitato sia per ``r -> 0+`` sia per ``r -> inf``).
    """
    era_scalare = _scalare(z)
    zz = _as_c(z)
    r = np.abs(zz)
    with np.errstate(divide="ignore", invalid="ignore"):
        ln_r = np.where(r > 0.0, np.log(np.where(r > 0.0, r, 1.0)), np.nan)
    valore = wrap_to_pi(ln_r) if principale else ln_r
    return _out(np.asarray(valore, dtype=np.float64), era_scalare)


def map_z_i_principal(z):
    """Ramo principale di z^i.

    ``z^i = exp(i Log z) = exp(i (ln r + i theta)) = e^{-theta} e^{i ln r}``,
    con ``theta = Arg z`` in (-pi, pi].

    Il calcolo usa direttamente la forma chiusa
    ``e^{-theta} (cos(ln r) + i sin(ln r))`` anziche' comporre ``exp`` con
    ``log``: e' numericamente piu' stabile e rende evidente lo *scambio di
    ruoli* fra modulo e argomento.

    In z = 0 restituisce ``nan``: il limite non esiste, perche' pur restando
    ``|z^i| = e^{-theta}`` **limitato**, l'argomento ``ln r -> -inf`` oscilla
    avvolgendosi infinite volte. L'origine e' un punto di diramazione, non un
    polo.
    """
    era_scalare = _scalare(z)
    zz = _as_c(z)
    r = np.abs(zz)
    theta = np.asarray(arg_principal(zz), dtype=np.float64)
    with np.errstate(divide="ignore", invalid="ignore", over="ignore"):
        ln_r = np.where(r > 0.0, np.log(np.where(r > 0.0, r, 1.0)), np.nan)
        modulo = np.exp(-theta)
        risultato = modulo * (np.cos(ln_r) + 1j * np.sin(ln_r))
    risultato = np.where(r == 0.0, np.nan + 1j * np.nan, risultato)
    return _out(np.asarray(risultato, dtype=np.complex128), era_scalare)


def map_z_i_branch(z, k: int):
    """Ramo ``k`` della relazione multivalore z^i.

    Sostituendo ``log_k z = ln r + i (theta + 2 pi k)`` si ottiene

        z^i_k = exp(i log_k z) = e^{-(theta + 2 pi k)} e^{i ln r} = z^i e^{-2 pi k}.

    I rami differiscono dunque per un fattore **reale positivo** ``e^{-2 pi k}``:
    tutti i valori di z^i giacciono sulla stessa semiretta uscente
    dall'origine, in progressione geometrica di ragione
    ``e^{-2 pi} ~ 1.867e-3``.
    """
    if int(k) != k:
        raise ValueError("map_z_i_branch richiede k intero, ricevuto %r" % (k,))
    k = int(k)
    era_scalare = _scalare(z)
    base = _as_c(map_z_i_principal(z))
    with np.errstate(over="ignore", invalid="ignore"):
        risultato = base * np.exp(-DUE_PI * k)
    return _out(np.asarray(risultato, dtype=np.complex128), era_scalare)


def derivative_z_i(z):
    """Derivata del ramo principale: d/dz z^i = i z^i / z.

    Non si annulla mai sul piano tagliato, quindi z^i e' **conforme in ogni
    punto** di C \\ (-inf, 0]: nessun punto critico, a differenza di z^n che
    nell'origine ha derivata nulla.
    """
    era_scalare = _scalare(z)
    zz = _as_c(z)
    with np.errstate(divide="ignore", invalid="ignore", over="ignore"):
        denominatore = np.where(zz == 0.0, np.nan, zz)
        risultato = 1j * _as_c(map_z_i_principal(zz)) / denominatore
    return _out(np.asarray(risultato, dtype=np.complex128), era_scalare)


def z_i_fiber(z, k_range: Iterable[int] = range(-2, 3)) -> np.ndarray:
    """Fibra del ramo principale di z^i passante per ``z``.

    **Correzione a un errore frequente: z^i NON e' iniettiva sul piano
    tagliato.** Da ``z^i = e^{-theta} e^{i ln r}`` segue che ``z1^i == z2^i``
    equivale a ``theta1 == theta2`` e ``ln r1 - ln r2`` multiplo di 2 pi, cioe'
    ``z2 = z1 e^{2 pi m}`` con ``m`` intero. Il ramo principale e' quindi
    infinito-a-1: la fibra di ``z`` e' ``{z e^{2 pi m}}``, una progressione
    geometrica di punti allineati sulla **stessa semiretta** di ``z``.
    Controesempio minimo: ``1^i = (e^{2 pi})^i = 1``.

    Forma del risultato: come ``compute_log_branches``.
    """
    ms = np.asarray(list(k_range), dtype=np.float64)
    zz = _as_c(z)
    forma_m = (ms.size,) + (1,) * zz.ndim
    with np.errstate(over="ignore"):
        fattori = np.exp(DUE_PI * ms.reshape(forma_m))
    return zz[np.newaxis, ...] * fattori


# ---------------------------------------------------------------------------
# Dominio, taglio di ramo, immagine
# ---------------------------------------------------------------------------

def near_branch_cut(z, tol: float = 1e-3):
    """Maschera dei punti vicini al taglio di ramo (-inf, 0].

    Criterio: ``Re z < 0`` e ``|Im z| <= tol``. Attraversando il taglio, Arg z
    salta di 2 pi e quindi ``|z^i| = e^{-Arg z}`` salta di un fattore
    ``e^{2 pi} ~ 535.5``: e' una discontinuita' del *ramo*, non della relazione
    multivalore.
    """
    era_scalare = _scalare(z)
    zz = _as_c(z)
    maschera = (zz.real < 0.0) & (np.abs(zz.imag) <= tol)
    return _out(np.asarray(maschera, dtype=bool), era_scalare)


def safe_domain_mask(z, r_min: float = 0.05, r_max: float = np.inf):
    """Maschera dei punti ``z`` numericamente affidabili per z^i.

    Esclude ``|z| < r_min`` e ``|z| > r_max``. **Attenzione al motivo**: non si
    tratta di evitare un overflow -- ``|z^i|`` resta confinato in
    ``[e^{-pi}, e^{pi})`` su tutto il dominio -- ma di evitare l'*aliasing
    della fase*: ``arg(z^i) = ln|z|`` varia come ``d(arg)/dr = 1/r``, quindi
    per ``r`` piccolo due campioni adiacenti possono differire di piu' di pi in
    fase e la visualizzazione diventa ingannevole. Il raggio di esclusione va
    scelto in funzione della risoluzione: cfr. ``raggio_aliasing``.
    """
    era_scalare = _scalare(z)
    r = np.abs(_as_c(z))
    maschera = (r >= r_min) & (r <= r_max)
    return _out(np.asarray(maschera, dtype=bool), era_scalare)


def raggio_aliasing(passo: float, fase_max: float = PI / 2) -> float:
    """Raggio sotto il quale la fase di z^i e' sotto-campionata.

    Con passo di campionamento ``h``, la variazione di fase fra due campioni
    adiacenti e' ``|Delta arg| ~ h / r``. Imponendo ``h / r <= fase_max`` si
    ottiene ``r >= h / fase_max``.
    """
    return float(passo / fase_max)


def image_annulus(dominio: str = "tagliato") -> dict:
    """Immagine del ramo principale di z^i.

    Poiche' ``|z^i| = e^{-Arg z}`` e ``arg(z^i) = ln|z|`` assume **tutti** i
    valori reali al variare di ``r`` in ``(0, inf)``, l'immagine e' una corona
    circolare completa in argomento, i cui estremi radiali dipendono dal
    dominio scelto:

    * ``dominio="tagliato"`` -- su C \\ (-inf, 0], con Arg z in (-pi, pi):
      corona **aperta** ``e^{-pi} < |w| < e^{pi}``.
    * ``dominio="bucato"`` -- su C \\ {0}, con Arg z in (-pi, pi]: corona
      **semiaperta** ``e^{-pi} <= |w| < e^{pi}``. L'estremo interno e' attinto
      (sul semiasse reale negativo, dove Arg z = pi); quello esterno no.
    """
    if dominio not in ("tagliato", "bucato"):
        raise ValueError("dominio deve essere 'tagliato' oppure 'bucato'")
    return {
        "r_min": E_MENO_PI,
        "r_max": E_PI,
        "r_min_incluso": dominio == "bucato",
        "r_max_incluso": False,
        "dominio": dominio,
    }


def injectivity_annulus(z) -> tuple:
    """Corona massimale di iniettivita' del ramo principale di z^i contenente ``z``.

    Dato che le fibre sono ``{z e^{2 pi m}}`` (cfr. ``z_i_fiber``), il ramo
    principale e' iniettivo esattamente sulle regioni in cui ``ln|z|`` percorre
    un intervallo di ampiezza minore di 2 pi, ossia su

        {e^a < |z| < e^{a + 2 pi}}  intersecato con  C \\ (-inf, 0].

    Restituisce la coppia ``(e^a, e^{a + 2 pi})`` della corona ancorata a
    ``a = floor(ln|z| / (2 pi)) * 2 pi``.
    """
    r = float(np.abs(complex(z)))
    if r <= 0.0:
        raise ValueError("injectivity_annulus non e' definita in z = 0")
    a = float(np.floor(np.log(r) / DUE_PI) * DUE_PI)
    return (float(np.exp(a)), float(np.exp(a + DUE_PI)))


# ---------------------------------------------------------------------------
# Supporto alla visualizzazione
# ---------------------------------------------------------------------------

def phase_portrait_data(
    f,
    x_range: Sequence[float] = (-3.0, 3.0),
    y_range: Sequence[float] = (-3.0, 3.0),
    risoluzione: int = 512,
) -> dict:
    """Griglia vettorizzata di ``f`` per i phase portrait.

    Restituisce un dizionario con la griglia ``z``, i valori ``w = f(z)``, il
    modulo e l'argomento principale di ``w``. Il calcolo e' interamente
    vettorizzato: una sola chiamata a ``f`` su un array ``(N, N)``.
    """
    x = np.linspace(float(x_range[0]), float(x_range[1]), int(risoluzione))
    y = np.linspace(float(y_range[0]), float(y_range[1]), int(risoluzione))
    X, Y = np.meshgrid(x, y)
    z = X + 1j * Y
    w = _as_c(f(z))
    with np.errstate(invalid="ignore"):
        modulo = np.abs(w)
    return {
        "x": x,
        "y": y,
        "z": z,
        "w": w,
        "modulo": modulo,
        "argomento": np.asarray(arg_principal(w), dtype=np.float64),
    }
