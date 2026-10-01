"""
Scene Manim Community Edition per il video didattico sulle potenze complesse.

Sei scene, una classe ``Scene`` ciascuna:

* ``S01Intro``               definizioni formali, Log principale, taglio di ramo
* ``S02PotenzeIntere``       z^n per n = 2, 3, 4, 5: modulo, argomento, avvolgimento, radici
* ``S03PotenzaImmaginaria``  z^i sul ramo principale: derivazione, immagini di curve, i^i
* ``S04Multivalenza``        rami k = -2..2 e allineamento radiale dei valori
* ``S05Confronto``           tabella comparativa formale
* ``S06Outro``               riepilogo dei teoremi e differenze strutturali

Tutta la matematica viene da ``complex_maps.py``: qui c'e' solo la regia.

Rendering (dalla cartella ``video_animation``):

    .venv\\Scripts\\manim -ql scenes.py S01Intro      # prova rapida
    .venv\\Scripts\\manim -qh scenes.py S01Intro      # finale 1080p60

Si veda il README per il rendering completo e la concatenazione.
"""

from __future__ import annotations

import os
from typing import Callable, Iterable, Sequence

import numpy as np
from manim import *


# ---------------------------------------------------------------------------
# Sanificazione del PATH (solo per questo processo).
#
# MiKTeX scorre tutte le voci di PATH e si interrompe con
# "MiKTeX cannot retrieve attributes for the directory ..." se una di esse
# punta a un file anziche' a una cartella. Su questa macchina la voce
# incriminata e' 'C:\Program Files\Tesseract-OCR\tesseract.exe\'. Il risultato
# e' che latex termina senza nemmeno produrre un file di log e Manim riporta
# il fuorviante "Check your LaTeX installation".
#
# Qui filtriamo le voci di PATH che non sono cartelle esistenti. La modifica
# vive nell'ambiente di questo solo processo (e dei suoi sottoprocessi, fra
# cui latex): nessuna variabile di sistema viene toccata.
# ---------------------------------------------------------------------------

def _sanifica_path() -> list[str]:
    """Rimuove da PATH le voci che non sono cartelle esistenti.

    Restituisce l'elenco delle voci scartate, per diagnostica.
    """
    separatore = os.pathsep
    voci = os.environ.get("PATH", "").split(separatore)
    buone, scartate = [], []
    for voce in voci:
        pulita = voce.strip().strip('"')
        if not pulita:
            continue
        if os.path.isdir(pulita):
            buone.append(voce)
        else:
            scartate.append(voce)
    os.environ["PATH"] = separatore.join(buone)
    return scartate


_PATH_SCARTATO = _sanifica_path()

from complex_maps import (
    DUE_PI,
    E_MENO_PI,
    E_PI,
    FATTORE_RAMO,
    PI,
    arg_principal,
    compute_log_branches,
    compute_nth_roots,
    map_z_i_branch,
    map_z_i_principal,
    map_z_power,
    wrap_to_pi,
    z_i_argument,
)

# ---------------------------------------------------------------------------
# Template LaTeX.
#
# ATTENZIONE a 'lmodern': con il solo [T1]{fontenc} MiKTeX ripiega sui font
# bitmap EC (Type3/PK), che dvisvgm non sa convertire in tracciati. Il risultato
# e' che TUTTO il contenuto di \text{...} e di Tex{...} sparisce dal video
# senza alcun messaggio di errore, lasciando solo i simboli matematici. Latin
# Modern e' un font Type1 con codifica T1 completa e risolve il problema,
# rendendo anche disponibili gli accenti italiani.
# amsmath/amssymb servono per \operatorname, \mathbb, \pmod.
# ---------------------------------------------------------------------------

TEMPLATE_ITALIANO = TexTemplate(
    preamble=r"""
\usepackage{lmodern}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{amsmath}
\usepackage{amssymb}
"""
)
config.tex_template = TEMPLATE_ITALIANO
config.background_color = "#0E1117"

# ---------------------------------------------------------------------------
# Palette: tinte ben separate anche in scala di grigi e per daltonismo
# deutan/protan (blu / arancio / verde-acqua / oro / magenta).
# ---------------------------------------------------------------------------

COL_CART = "#4C8DFF"       # griglia cartesiana
COL_CERCHI = "#2BD9C8"     # cerchi |z| = cost.
COL_RAGGI = "#FF9E3D"      # raggi arg z = cost.
COL_TAGLIO = "#FF4D5A"     # taglio di ramo
COL_PUNTO = "#FFD93D"      # punto selezionato
COL_RADICI = "#C77DFF"     # radici n-esime
COL_IMMAGINE = "#8BE04E"   # curve immagine
COL_ACCENTO = "#FFB347"
COL_NOTA = "#9AA5B1"

# Dimensioni minime richieste: nessun testo sotto 24 pt.
FS_TITOLO = 46
FS_SOTTO = 30
FS_FORMULA = 34
FS_TESTO = 28
FS_PICCOLO = 24


# ===========================================================================
# PARTE 1 -- Funzioni riutilizzabili di regia
# ===========================================================================

def piano_complesso(
    raggio: float = 3.2,
    lunghezza: float = 6.0,
    passo: float = 1.0,
    opacita_griglia: float = 0.35,
) -> ComplexPlane:
    """Un piano complesso quadrato, centrato nell'origine.

    ``raggio`` e' il semilato in unita' matematiche, ``lunghezza`` il lato in
    unita' di schermo: la scala e' quindi ``lunghezza / (2 raggio)``.
    """
    return ComplexPlane(
        x_range=[-raggio, raggio, passo],
        y_range=[-raggio, raggio, passo],
        x_length=lunghezza,
        y_length=lunghezza,
        background_line_style={
            "stroke_color": GREY_D,
            "stroke_width": 1.2,
            "stroke_opacity": opacita_griglia,
        },
        axis_config={"stroke_color": GREY_B, "stroke_width": 2.2},
    )


def curva_spec(
    gamma: Callable[[float], complex],
    t_range: Sequence[float],
    color: str = WHITE,
    width: float = 2.6,
    campioni: int = 400,
    opacity: float = 1.0,
) -> dict:
    """Specifica di una curva parametrica ``gamma: [t0, t1] -> C``.

    Le curve vengono descritte come *specifiche* e non come mobject perche'
    l'immagine sotto una mappa non affine va ricalcolata esattamente come
    ``f(gamma(t))``: deformare il mobject punto per punto sarebbe corretto solo
    con un campionamento altrettanto fitto, e una ``Line`` (due sole ancore)
    resterebbe erroneamente un segmento.
    """
    return {
        "gamma": gamma,
        "t_range": (float(t_range[0]), float(t_range[1])),
        "color": color,
        "width": width,
        "campioni": int(campioni),
        "opacity": float(opacity),
    }


def disegna(
    plane: ComplexPlane,
    specs: Iterable[dict],
    f: Callable[[complex], complex] | None = None,
) -> VGroup:
    """Realizza le specifiche su ``plane``, eventualmente composte con ``f``.

    Con ``f=None`` si ottiene la famiglia nel dominio; con ``f`` assegnata si
    ottiene la famiglia immagine, campionata esattamente su ``f(gamma(t))``.
    """
    gruppo = VGroup()
    for s in specs:
        gamma = s["gamma"]
        if f is None:
            h = gamma
        else:
            def h(t, _gamma=gamma, _f=f):
                return _f(_gamma(t))

        t0, t1 = s["t_range"]
        passo = (t1 - t0) / max(s["campioni"], 2)
        gruppo.add(
            ParametricFunction(
                lambda t, _h=h: plane.n2p(complex(_h(t))),
                t_range=(t0, t1, passo),
                color=s["color"],
                stroke_width=s["width"],
                stroke_opacity=s["opacity"],
            )
        )
    return gruppo


def make_grid(
    estremo: float = 1.0,
    n_linee: int = 9,
    color: str = COL_CART,
    width: float = 2.2,
    raggio_max: float | None = None,
) -> list[dict]:
    """Specifiche di una griglia cartesiana sul quadrato ``[-e, e]^2``.

    Con ``raggio_max`` assegnato ogni retta viene ritagliata alla corda interna
    al disco ``|z| <= raggio_max``. Senza il ritaglio, sotto ``z^n`` i vertici
    del quadrato (modulo ``e*sqrt(2)``) esplodono molto piu' in fretta del
    bordo circolare e invadono l'inquadratura: per ``n = 5`` ed ``e = 1.15`` si
    passa da ``|w| <= 2.01`` sul disco a ``|w| <= 9.0`` sul quadrato.
    """
    specs: list[dict] = []
    for c in np.linspace(-estremo, estremo, n_linee):
        c = float(c)
        if raggio_max is None:
            t0, t1 = -estremo, estremo
        else:
            if abs(c) >= raggio_max:
                continue
            semi = float(np.sqrt(raggio_max**2 - c**2))
            t0, t1 = -semi, semi
        specs.append(
            curva_spec(lambda t, c=c: complex(c, t), (t0, t1), color, width)
        )
        specs.append(
            curva_spec(lambda t, c=c: complex(t, c), (t0, t1), color, width)
        )
    return specs


def make_polar_grid(
    raggi: Sequence[float] = (0.4, 0.7, 1.0),
    n_angoli: int = 12,
    r_min: float = 0.1,
    r_max: float = 1.15,
    col_cerchi: str = COL_CERCHI,
    col_raggi: str = COL_RAGGI,
    width: float = 2.4,
) -> list[dict]:
    """Specifiche di una griglia polare: cerchi |z| = cost. e raggi arg z = cost.

    ``r_min > 0`` e' necessario per z^i: avvicinandosi all'origine
    ``arg(z^i) = ln|z|`` varia come ``1/r`` e il campionamento diventerebbe
    insufficiente (aliasing della fase).
    """
    specs: list[dict] = []
    for r in raggi:
        r = float(r)
        specs.append(
            curva_spec(
                lambda t, r=r: r * np.exp(1j * t),
                (-PI, PI),
                col_cerchi,
                width,
                campioni=500,
            )
        )
    for a in np.linspace(-PI, PI, n_angoli + 1)[:-1]:
        a = float(a)
        specs.append(
            curva_spec(
                lambda t, a=a: t * np.exp(1j * a),
                (r_min, r_max),
                col_raggi,
                width,
                campioni=300,
            )
        )
    return specs


def animate_map(
    scene: Scene,
    plane: ComplexPlane,
    specs: Iterable[dict],
    f: Callable[[complex], complex] | None,
    sorgente: VGroup,
    run_time: float = 4.0,
    rate_func=smooth,
    animazioni_extra: Sequence = (),
) -> VGroup:
    """Anima la deformazione della famiglia ``specs`` sotto la mappa ``f``.

    ``sorgente`` deve essere il mobject gia' presente in scena (tipicamente il
    risultato di ``disegna(plane, specs)``). Con ``f=None`` si anima il
    percorso inverso, cioe' il ritorno della famiglia alla configurazione del
    dominio.

    ``animazioni_extra`` permette di sincronizzare altre animazioni nello
    stesso ``play`` (per esempio la deformazione del bordo del disco), senza
    doverle spezzare in una chiamata separata che le sfaserebbe.

    Restituisce il nuovo gruppo, da usare come ``sorgente`` al passo successivo.
    """
    specs = list(specs)
    bersaglio = disegna(plane, specs, f)
    scene.play(
        *[ReplacementTransform(a, b) for a, b in zip(sorgente, bersaglio)],
        *animazioni_extra,
        run_time=run_time,
        rate_func=rate_func,
    )
    return bersaglio


def branch_cut_mobject(
    plane: ComplexPlane, r_max: float = 3.2, n_tratti: int = 14
) -> VGroup:
    """Il taglio di ramo ``(-inf, 0]`` con tratteggio obliquo di cortesia."""
    linea = DashedLine(
        plane.n2p(complex(-r_max, 0)),
        plane.n2p(0j),
        color=COL_TAGLIO,
        stroke_width=7,
        dash_length=0.14,
    )
    tratti = VGroup()
    for x in np.linspace(-r_max * 0.97, -r_max * 0.08, n_tratti):
        base = plane.n2p(complex(float(x), 0))
        tratti.add(
            Line(base, base + 0.18 * UP + 0.1 * RIGHT, color=COL_TAGLIO, stroke_width=3)
        )
    origine = Dot(plane.n2p(0j), color=COL_TAGLIO, radius=0.07)
    return VGroup(linea, tratti, origine)


def etichetta_punto(
    plane: ComplexPlane,
    z: complex,
    testo: str,
    color: str = COL_PUNTO,
    direzione=UR,
    raggio: float = 0.075,
    font_size: int = FS_PICCOLO,
) -> VGroup:
    """Un punto campione con etichetta ``MathTex``."""
    punto = Dot(plane.n2p(z), color=color, radius=raggio)
    etichetta = MathTex(testo, font_size=font_size, color=color)
    etichetta.next_to(punto, direzione, buff=0.12)
    return VGroup(punto, etichetta)


def legenda(voci: Sequence[tuple[str, str]], font_size: int = FS_PICCOLO) -> VGroup:
    """Legenda verticale: coppie ``(colore, testo)``."""
    righe = VGroup()
    for colore, testo in voci:
        campione = Line(ORIGIN, 0.42 * RIGHT, color=colore, stroke_width=6)
        etichetta = Text(testo, font_size=font_size, color=COL_NOTA)
        etichetta.next_to(campione, RIGHT, buff=0.18)
        righe.add(VGroup(campione, etichetta))
    righe.arrange(DOWN, aligned_edge=LEFT, buff=0.19)
    cornice = SurroundingRectangle(
        righe, color=GREY_D, stroke_width=1.6, buff=0.18, corner_radius=0.08
    )
    return VGroup(cornice, righe)


def titolo_scena(testo: str, sottotitolo: str | None = None) -> VGroup:
    """Titolo in alto, opzionalmente con sottotitolo."""
    gruppo = VGroup(Text(testo, font_size=FS_TITOLO, color=WHITE, weight=BOLD))
    if sottotitolo:
        sotto = Text(sottotitolo, font_size=FS_PICCOLO, color=COL_NOTA)
        sotto.next_to(gruppo[0], DOWN, buff=0.16)
        gruppo.add(sotto)
    gruppo.to_edge(UP, buff=0.35)
    return gruppo


def nota(testo: str, font_size: int = FS_PICCOLO) -> Text:
    """Riga di commento in basso."""
    return Text(testo, font_size=font_size, color=COL_NOTA)


# ===========================================================================
# SCENA 1 -- Introduzione: definizioni, Log principale, taglio di ramo
# ===========================================================================

class S01Intro(Scene):
    """Titolo, definizioni formali di z^n e z^i, costruzione di Log z e del
    taglio di ramo sul semiasse reale negativo."""

    def construct(self) -> None:
        self._apertura()
        self._definizioni()
        self._logaritmo_principale()

    # -- 1a. Titolo -------------------------------------------------------
    def _apertura(self) -> None:
        titolo = Text(
            "Potenze complesse", font_size=56, color=WHITE, weight=BOLD
        )
        formule = MathTex(
            r"z^{n}", r"\qquad\text{e}\qquad", r"z^{i}", font_size=66
        )
        formule[0].set_color(COL_CERCHI)
        formule[2].set_color(COL_RAGGI)
        formule.next_to(titolo, DOWN, buff=0.45)
        sotto = Text(
            "due mappe, due mondi: algebrico e trascendente",
            font_size=FS_TESTO,
            color=COL_NOTA,
        )
        sotto.next_to(formule, DOWN, buff=0.5)

        self.play(Write(titolo), run_time=1.6)
        self.play(FadeIn(formule, shift=UP * 0.3), run_time=1.4)
        self.play(FadeIn(sotto), run_time=1.0)
        self.wait(1.6)
        self.play(FadeOut(VGroup(titolo, formule, sotto)), run_time=0.8)

    # -- 1b. Definizioni formali ------------------------------------------
    def _definizioni(self) -> None:
        testa = titolo_scena("Definizioni formali")
        self.play(FadeIn(testa), run_time=0.7)

        # Potenza intera: definizione puramente algebrica.
        tit_n = Text("Potenza intera", font_size=FS_SOTTO, color=COL_CERCHI, weight=BOLD)
        def_n = MathTex(
            r"z^{n} = \underbrace{z \cdot z \cdots z}_{n \text{ volte}}"
            r"= r^{n} e^{i n \theta}",
            font_size=FS_FORMULA,
        )
        ip_n = MathTex(
            r"z = r e^{i\theta},\quad r = |z| \ge 0,\quad n \in \mathbb{N}",
            font_size=FS_PICCOLO,
            color=COL_NOTA,
        )
        blocco_n = VGroup(tit_n, def_n, ip_n).arrange(DOWN, buff=0.28)

        # Potenza immaginaria: definizione via esponenziale e logaritmo.
        tit_i = Text(
            "Potenza immaginaria", font_size=FS_SOTTO, color=COL_RAGGI, weight=BOLD
        )
        def_i = MathTex(
            r"z^{i} \;:=\; \exp\bigl(i \operatorname{Log} z\bigr)",
            font_size=FS_FORMULA,
        )
        ip_i = MathTex(
            r"\text{nessun prodotto ripetuto: serve il logaritmo}",
            font_size=FS_PICCOLO,
            color=COL_NOTA,
        )
        blocco_i = VGroup(tit_i, def_i, ip_i).arrange(DOWN, buff=0.28)

        blocchi = VGroup(blocco_n, blocco_i).arrange(RIGHT, buff=1.1)
        blocchi.scale(0.95).next_to(testa, DOWN, buff=0.7)
        cornici = VGroup(
            SurroundingRectangle(blocco_n, color=COL_CERCHI, stroke_width=1.6, buff=0.3,
                                 corner_radius=0.1),
            SurroundingRectangle(blocco_i, color=COL_RAGGI, stroke_width=1.6, buff=0.3,
                                 corner_radius=0.1),
        )

        self.play(FadeIn(blocco_n, shift=RIGHT * 0.3), Create(cornici[0]), run_time=1.5)
        self.wait(1.4)
        self.play(FadeIn(blocco_i, shift=LEFT * 0.3), Create(cornici[1]), run_time=1.5)
        self.wait(1.6)

        osservazione = nota(
            "La seconda definizione dipende da quale logaritmo scegliamo: "
            "il logaritmo complesso è multivalore."
        )
        osservazione.to_edge(DOWN, buff=0.5)
        self.play(FadeIn(osservazione), run_time=1.0)
        self.wait(2.2)
        self.play(
            FadeOut(VGroup(blocchi, cornici, osservazione, testa)), run_time=0.8
        )

    # -- 1c. Log principale e taglio di ramo ------------------------------
    def _logaritmo_principale(self) -> None:
        testa = titolo_scena(
            "Il logaritmo principale", "e il suo taglio di ramo"
        )
        self.play(FadeIn(testa), run_time=0.7)

        definizione = MathTex(
            r"\operatorname{Log} z = \ln|z| + i \operatorname{Arg} z,",
            r"\qquad \operatorname{Arg} z \in (-\pi, \pi]",
            font_size=FS_FORMULA,
        )
        definizione[1].set_color(COL_ACCENTO)
        definizione.next_to(testa, DOWN, buff=0.45)
        self.play(Write(definizione), run_time=2.0)
        self.wait(1.2)

        plane = piano_complesso(raggio=3.0, lunghezza=5.2)
        plane.to_edge(LEFT, buff=0.9).shift(DOWN * 0.55)
        self.play(Create(plane), run_time=1.4)

        # Punto mobile sul cerchio |z| = 2, con arco dell'argomento.
        angolo = ValueTracker(0.35)
        raggio_test = 2.0

        def posizione() -> np.ndarray:
            return plane.n2p(raggio_test * np.exp(1j * angolo.get_value()))

        punto = always_redraw(lambda: Dot(posizione(), color=COL_PUNTO, radius=0.085))
        vettore = always_redraw(
            lambda: Line(plane.n2p(0j), posizione(), color=COL_PUNTO, stroke_width=3.5)
        )
        arco = always_redraw(
            lambda: Arc(
                radius=float(np.linalg.norm(plane.n2p(0.75 + 0j) - plane.n2p(0j))),
                start_angle=0.0,
                angle=angolo.get_value(),
                arc_center=plane.n2p(0j),
                color=COL_ACCENTO,
                stroke_width=4,
            )
        )
        taglio = branch_cut_mobject(plane, r_max=3.0)

        # Lettura numerica di Arg z, che salta attraversando il taglio.
        lettura = always_redraw(
            lambda: MathTex(
                r"\operatorname{Arg} z = "
                + f"{wrap_to_pi(angolo.get_value()):+.3f}",
                font_size=FS_FORMULA,
                color=COL_ACCENTO,
            )
            .next_to(plane, RIGHT, buff=0.75)
            .shift(UP * 1.5)
        )
        lettura_mod = always_redraw(
            lambda: MathTex(
                r"\bigl|z^{i}\bigr| = e^{-\operatorname{Arg} z} = "
                + f"{np.exp(-wrap_to_pi(angolo.get_value())):.3f}",
                font_size=FS_TESTO,
                color=COL_RAGGI,
            )
            .next_to(plane, RIGHT, buff=0.75)
            .shift(UP * 0.55)
        )

        self.play(
            Create(vettore), FadeIn(punto), Create(arco),
            FadeIn(lettura), FadeIn(lettura_mod), run_time=1.3,
        )
        self.wait(0.8)

        spiega = VGroup(
            nota("L'argomento principale è univoco", FS_PICCOLO),
            nota("solo se lo confiniamo in un intervallo", FS_PICCOLO),
            nota("di ampiezza 2\u03c0.", FS_PICCOLO),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.14)
        spiega.next_to(plane, RIGHT, buff=0.75).shift(DOWN * 0.9)
        self.play(FadeIn(spiega), run_time=0.9)

        # Rotazione antioraria fino a sfiorare il taglio da sopra.
        self.play(angolo.animate.set_value(PI - 0.02), run_time=3.2, rate_func=linear)
        self.play(Create(taglio), run_time=1.2)
        self.wait(1.0)

        avviso = MathTex(
            r"\text{attraversando } (-\infty, 0]:\quad",
            r"\operatorname{Arg} z \;\to\; \operatorname{Arg} z - 2\pi",
            font_size=FS_TESTO,
            color=COL_TAGLIO,
        )
        avviso.to_edge(DOWN, buff=0.4)
        self.play(FadeIn(avviso), run_time=0.9)

        # Il salto: proseguendo oltre pi, Arg ricade a -pi + eps.
        self.play(angolo.animate.set_value(PI + 0.55), run_time=1.6, rate_func=linear)
        self.wait(1.6)

        conclusione = VGroup(
            MathTex(
                r"\operatorname{Log} \text{ \`e olomorfo su } "
                r"\mathbb{C}\setminus(-\infty, 0]",
                font_size=FS_TESTO,
                color=COL_IMMAGINE,
            ),
            MathTex(
                r"\text{ma \`e definito su } \mathbb{C}\setminus\{0\} "
                r"\text{ con } \operatorname{Arg} z = \pi \text{ sul taglio}",
                font_size=FS_PICCOLO,
                color=COL_NOTA,
            ),
        ).arrange(DOWN, buff=0.24)
        # Il piano occupa la meta' sinistra fin quasi al bordo inferiore:
        # la conclusione va nella colonna destra, al posto della nota laterale,
        # invece che in basso al centro dove sfiorerebbe il piano.
        if conclusione.width > 6.4:
            conclusione.scale_to_fit_width(6.4)
        conclusione.next_to(plane, RIGHT, buff=0.7).shift(DOWN * 1.15)
        self.play(
            FadeOut(avviso), FadeOut(spiega), FadeIn(conclusione), run_time=1.0
        )
        self.wait(2.4)
        self.play(
            FadeOut(
                VGroup(
                    plane, punto, vettore, arco, taglio, lettura, lettura_mod,
                    conclusione, definizione, testa,
                )
            ),
            run_time=0.9,
        )


# ===========================================================================
# SCENA 2 -- Potenze intere z^n
# ===========================================================================

class S02PotenzeIntere(Scene):
    """z^2, z^3, z^4, z^5: moltiplicativita' del modulo, dilatazione
    dell'argomento, avvolgimento n volte e radici n-esime."""

    #: Il dominio e' il disco |z| <= 1.15 cosi' che |z^5| <= 2.01 resti
    #: inquadrato: dominio e immagine condividono la stessa scala.
    ESTREMO = 1.15

    def construct(self) -> None:
        self._proprieta_algebriche()
        self._deformazione_griglie()
        self._avvolgimento()
        self._radici()

    # -- 2a. Le due identita' fondamentali --------------------------------
    def _proprieta_algebriche(self) -> None:
        testa = titolo_scena("Potenze intere", "le due identità fondamentali")
        self.play(FadeIn(testa), run_time=0.7)

        catena = MathTex(
            r"z^{n}", r"=", r"\bigl(r e^{i\theta}\bigr)^{n}", r"=",
            r"r^{n} e^{i n \theta}",
            font_size=42,
        )
        catena.next_to(testa, DOWN, buff=0.7)
        self.play(Write(catena), run_time=2.0)
        self.wait(1.0)

        id_modulo = MathTex(
            r"\bigl|z^{n}\bigr| = |z|^{n}", font_size=40, color=COL_CERCHI
        )
        id_arg = MathTex(
            r"\arg\bigl(z^{n}\bigr) \equiv n \arg(z) \pmod{2\pi}",
            font_size=40,
            color=COL_RAGGI,
        )
        identita = VGroup(id_modulo, id_arg).arrange(DOWN, buff=0.55)
        identita.next_to(catena, DOWN, buff=0.8)

        self.play(TransformFromCopy(catena[4], id_modulo), run_time=1.4)
        self.wait(0.8)
        self.play(TransformFromCopy(catena[4], id_arg), run_time=1.4)
        self.wait(1.2)

        chiosa = nota(
            "Il modulo si eleva, l'argomento si moltiplica: "
            "ciascuno dipende solo da se stesso."
        )
        chiosa.to_edge(DOWN, buff=0.5)
        self.play(FadeIn(chiosa), run_time=0.9)
        self.wait(2.0)
        self.play(FadeOut(VGroup(catena, identita, chiosa, testa)), run_time=0.8)

    # -- 2b. Deformazione delle griglie per n = 2..5 ----------------------
    def _deformazione_griglie(self) -> None:
        testa = titolo_scena("Deformazione del piano")
        self.play(FadeIn(testa), run_time=0.6)

        plane = piano_complesso(raggio=2.3, lunghezza=5.6, passo=1.0)
        plane.shift(LEFT * 2.6 + DOWN * 0.45)
        self.play(Create(plane), run_time=1.2)

        specs = make_grid(
            estremo=0.98, n_linee=9, raggio_max=self.ESTREMO
        ) + make_polar_grid(
            raggi=(0.4, 0.75, 1.0, self.ESTREMO),
            n_angoli=12,
            r_min=0.05,
            r_max=self.ESTREMO,
        )
        gruppo = disegna(plane, specs)
        bordo = disegna(
            plane,
            [curva_spec(lambda t: self.ESTREMO * np.exp(1j * t), (-PI, PI),
                        COL_PUNTO, 3.4, campioni=500)],
        )
        self.play(Create(gruppo, lag_ratio=0.02), run_time=2.4)
        self.play(Create(bordo), run_time=0.8)

        leg = legenda(
            [
                (COL_CART, "griglia cartesiana"),
                (COL_CERCHI, "cerchi |z| costante"),
                (COL_RAGGI, "raggi arg z costante"),
                (COL_PUNTO, "bordo |z| = 1,15"),
            ]
        )
        leg.scale(0.9).next_to(plane, RIGHT, buff=0.6).shift(UP * 1.8)
        self.play(FadeIn(leg), run_time=0.8)

        etichetta_n = MathTex(r"n = 1", font_size=52, color=WHITE)
        etichetta_n.next_to(leg, DOWN, buff=0.65)
        dettaglio = MathTex(
            r"\text{angoli} \times 1", font_size=FS_TESTO, color=COL_NOTA
        )
        dettaglio.next_to(etichetta_n, DOWN, buff=0.3)
        self.play(FadeIn(etichetta_n), FadeIn(dettaglio), run_time=0.7)
        self.wait(1.0)

        corrente = gruppo
        corrente_bordo = bordo
        for n in (2, 3, 4, 5):
            nuova_etichetta = MathTex(f"n = {n}", font_size=52, color=COL_ACCENTO)
            nuova_etichetta.move_to(etichetta_n)
            nuovo_dettaglio = MathTex(
                rf"\text{{angoli}} \times {n}", font_size=FS_TESTO, color=COL_NOTA
            )
            nuovo_dettaglio.move_to(dettaglio)

            def f(z, n=n):
                return map_z_power(z, n)

            # La griglia si deforma a partire sempre dal dominio originale,
            # cosi' che ogni fotogramma finale mostri esattamente z -> z^n.
            self.play(
                ReplacementTransform(etichetta_n, nuova_etichetta),
                ReplacementTransform(dettaglio, nuovo_dettaglio),
                run_time=0.5,
            )
            etichetta_n, dettaglio = nuova_etichetta, nuovo_dettaglio

            # Il bordo del disco viene deformato nello stesso ``play`` della
            # griglia: passandolo come animazione extra resta sincronizzato.
            bersaglio_bordo = disegna(
                plane,
                [curva_spec(lambda t, n=n: f(self.ESTREMO * np.exp(1j * t)),
                            (-PI, PI), COL_PUNTO, 3.4, campioni=600)],
            )
            corrente = animate_map(
                self, plane, specs, f, corrente,
                run_time=2.6,
                animazioni_extra=[
                    ReplacementTransform(corrente_bordo[0], bersaglio_bordo[0])
                ],
            )
            corrente_bordo = bersaglio_bordo
            self.wait(1.1)

            # Ritorno al dominio prima della potenza successiva: stessa
            # funzione con f=None, cioe' la famiglia non composta.
            if n != 5:
                ritorno_bordo = disegna(
                    plane,
                    [curva_spec(lambda t: self.ESTREMO * np.exp(1j * t), (-PI, PI),
                                COL_PUNTO, 3.4, campioni=500)],
                )
                corrente = animate_map(
                    self, plane, specs, None, corrente,
                    run_time=1.1,
                    animazioni_extra=[
                        ReplacementTransform(corrente_bordo[0], ritorno_bordo[0])
                    ],
                )
                corrente_bordo = ritorno_bordo

        osserva = MathTex(
            r"\text{I raggi restano raggi, i cerchi restano cerchi: }"
            r"z^{n} \text{ \`e conforme fuori da } 0",
            font_size=FS_PICCOLO,
            color=COL_NOTA,
        )
        osserva.to_edge(DOWN, buff=0.35)
        self.play(FadeIn(osserva), run_time=0.9)
        self.wait(2.0)
        self.play(
            FadeOut(
                VGroup(corrente, corrente_bordo, plane, leg, etichetta_n,
                       dettaglio, osserva, testa)
            ),
            run_time=0.9,
        )

    # -- 2c. Avvolgimento n volte -----------------------------------------
    def _avvolgimento(self) -> None:
        testa = titolo_scena(
            "Avvolgimento", "un giro nel dominio, n giri nell'immagine"
        )
        self.play(FadeIn(testa), run_time=0.6)

        n = 3
        p_dom = piano_complesso(raggio=1.6, lunghezza=4.6, passo=0.5)
        p_img = piano_complesso(raggio=1.6, lunghezza=4.6, passo=0.5)
        p_dom.to_edge(LEFT, buff=1.0).shift(DOWN * 0.4)
        p_img.to_edge(RIGHT, buff=1.0).shift(DOWN * 0.4)

        et_dom = MathTex(r"z", font_size=40, color=COL_PUNTO)
        et_dom.next_to(p_dom, UP, buff=0.2)
        et_img = MathTex(r"w = z^{3}", font_size=40, color=COL_IMMAGINE)
        et_img.next_to(p_img, UP, buff=0.2)

        cerchio_dom = disegna(
            p_dom,
            [curva_spec(lambda t: np.exp(1j * t), (-PI, PI), GREY_B, 2.2, campioni=400)],
        )
        cerchio_img = disegna(
            p_img,
            [curva_spec(lambda t: np.exp(1j * t), (-PI, PI), GREY_B, 2.2, campioni=400)],
        )

        self.play(
            Create(p_dom), Create(p_img), FadeIn(et_dom), FadeIn(et_img), run_time=1.3
        )
        self.play(Create(cerchio_dom), Create(cerchio_img), run_time=0.9)

        t = ValueTracker(-PI)
        punto_dom = always_redraw(
            lambda: Dot(p_dom.n2p(np.exp(1j * t.get_value())),
                        color=COL_PUNTO, radius=0.09)
        )
        punto_img = always_redraw(
            lambda: Dot(p_img.n2p(np.exp(1j * n * t.get_value())),
                        color=COL_IMMAGINE, radius=0.09)
        )
        traccia_dom = TracedPath(
            lambda: p_dom.n2p(np.exp(1j * t.get_value())),
            stroke_color=COL_PUNTO,
            stroke_width=5,
        )
        traccia_img = TracedPath(
            lambda: p_img.n2p(np.exp(1j * n * t.get_value())),
            stroke_color=COL_IMMAGINE,
            stroke_width=5,
        )

        contagiri = always_redraw(
            lambda: MathTex(
                r"\frac{\Delta\arg w}{2\pi} = "
                + f"{(n * (t.get_value() + PI)) / DUE_PI:.2f}",
                font_size=FS_TESTO,
                color=COL_IMMAGINE,
            ).next_to(p_img, DOWN, buff=0.3)
        )
        contagiri_dom = always_redraw(
            lambda: MathTex(
                r"\frac{\Delta\arg z}{2\pi} = "
                + f"{(t.get_value() + PI) / DUE_PI:.2f}",
                font_size=FS_TESTO,
                color=COL_PUNTO,
            ).next_to(p_dom, DOWN, buff=0.3)
        )

        self.add(traccia_dom, traccia_img, punto_dom, punto_img,
                 contagiri, contagiri_dom)
        self.play(t.animate.set_value(PI), run_time=6.0, rate_func=linear)
        self.wait(1.2)

        teorema = MathTex(
            r"\deg\bigl(z^{n}, \partial D\bigr) = n:\quad",
            r"z^{n} \text{ \`e } n\text{-a-}1 \text{ su } \mathbb{C}\setminus\{0\}",
            font_size=FS_TESTO,
            color=WHITE,
        )
        teorema.to_edge(DOWN, buff=0.25)
        self.play(FadeIn(teorema), run_time=1.0)
        self.wait(2.2)
        self.remove(traccia_dom, traccia_img)
        self.play(
            FadeOut(
                VGroup(p_dom, p_img, et_dom, et_img, cerchio_dom, cerchio_img,
                       punto_dom, punto_img, contagiri, contagiri_dom,
                       teorema, testa)
            ),
            run_time=0.9,
        )

    # -- 2d. Le n radici n-esime ------------------------------------------
    def _radici(self) -> None:
        testa = titolo_scena("Radici n-esime", "le n preimmagini di un punto")
        self.play(FadeIn(testa), run_time=0.6)

        formula = MathTex(
            r"z_k = |w|^{1/n} \, e^{i\frac{\operatorname{Arg} w + 2\pi k}{n}},",
            r"\qquad k = 0, 1, \dots, n-1",
            font_size=FS_FORMULA,
        )
        formula[0].set_color(COL_RADICI)
        formula.next_to(testa, DOWN, buff=0.4)
        self.play(Write(formula), run_time=2.0)

        plane = piano_complesso(raggio=1.7, lunghezza=4.8, passo=0.5)
        plane.shift(LEFT * 3.0 + DOWN * 0.7)
        self.play(Create(plane), run_time=1.0)

        w0 = 1.1 * np.exp(1j * 0.9)
        punto_w = etichetta_punto(plane, w0, r"w", COL_PUNTO, UR)
        self.play(FadeIn(punto_w), run_time=0.7)

        gruppo_radici = VGroup()
        gruppo_cerchio = VGroup()
        gruppo_testo = VGroup()
        for n in (2, 3, 5, 6):
            radici = compute_nth_roots(w0, n)
            raggio = abs(w0) ** (1.0 / n)
            cerchio = Circle(
                radius=float(np.linalg.norm(plane.n2p(raggio + 0j) - plane.n2p(0j))),
                color=COL_RADICI,
                stroke_width=2,
                stroke_opacity=0.55,
            ).move_to(plane.n2p(0j))
            punti = VGroup(
                *[
                    Dot(plane.n2p(complex(r)), color=COL_RADICI, radius=0.085)
                    for r in radici
                ]
            )
            poligono = Polygon(
                *[plane.n2p(complex(r)) for r in radici],
                color=COL_RADICI,
                stroke_width=2.4,
                stroke_opacity=0.8,
            ) if n >= 3 else Line(
                plane.n2p(complex(radici[0])),
                plane.n2p(complex(radici[1])),
                color=COL_RADICI,
                stroke_width=2.4,
            )

            descrizione = VGroup(
                MathTex(rf"n = {n}", font_size=46, color=COL_ACCENTO),
                MathTex(
                    rf"|w|^{{1/{n}}} = {raggio:.4f}", font_size=FS_TESTO, color=COL_NOTA
                ),
                MathTex(
                    rf"\text{{passo angolare}} = \tfrac{{2\pi}}{{{n}}}"
                    rf" = {DUE_PI / n:.4f}",
                    font_size=FS_TESTO,
                    color=COL_NOTA,
                ),
                MathTex(
                    rf"\textstyle\sum_k z_k = 0", font_size=FS_TESTO, color=COL_IMMAGINE
                ),
            ).arrange(DOWN, aligned_edge=LEFT, buff=0.25)
            descrizione.next_to(plane, RIGHT, buff=0.8)

            if len(gruppo_radici) == 0:
                self.play(Create(cerchio), run_time=0.6)
                self.play(
                    LaggedStart(*[GrowFromCenter(p) for p in punti], lag_ratio=0.12),
                    run_time=1.1,
                )
                self.play(Create(poligono), FadeIn(descrizione), run_time=0.9)
            else:
                self.play(
                    ReplacementTransform(gruppo_cerchio[0], cerchio),
                    ReplacementTransform(gruppo_radici[0], punti),
                    ReplacementTransform(gruppo_radici[1], poligono),
                    ReplacementTransform(gruppo_testo[0], descrizione),
                    run_time=1.3,
                )
            gruppo_cerchio = VGroup(cerchio)
            gruppo_radici = VGroup(punti, poligono)
            gruppo_testo = VGroup(descrizione)
            self.wait(1.3)

        chiusura = nota(
            "Ogni w diverso da zero ha esattamente n preimmagini: "
            "i vertici di un n-agono regolare."
        )
        chiusura.to_edge(DOWN, buff=0.3)
        self.play(FadeIn(chiusura), run_time=0.9)
        self.wait(2.2)
        self.play(
            FadeOut(
                VGroup(plane, punto_w, gruppo_cerchio, gruppo_radici,
                       gruppo_testo, formula, chiusura, testa)
            ),
            run_time=0.9,
        )


# ===========================================================================
# SCENA 3 -- z^i sul ramo principale
# ===========================================================================

class S03PotenzaImmaginaria(Scene):
    """Derivazione formale di z^i, immagini di cerchi e raggi, caso i^i,
    corona immagine."""

    def construct(self) -> None:
        self._derivazione()
        self._scambio_di_ruoli()
        self._i_alla_i()
        self._corona_immagine()

    # -- 3a. Derivazione passo a passo ------------------------------------
    def _derivazione(self) -> None:
        testa = titolo_scena("Il ramo principale", "la potenza a esponente immaginario")
        self.play(FadeIn(testa), run_time=0.6)

        passi = VGroup(
            MathTex(r"z^{i} = \exp\bigl(i \operatorname{Log} z\bigr)",
                    font_size=FS_FORMULA),
            MathTex(r"= \exp\bigl(i(\ln r + i\theta)\bigr)", font_size=FS_FORMULA),
            MathTex(r"= \exp(i \ln r - \theta)", font_size=FS_FORMULA),
            MathTex(r"= e^{-\theta} \, e^{i \ln r}", font_size=42,
                    color=COL_RAGGI),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.42)
        passi.next_to(testa, DOWN, buff=0.6)

        ipotesi = MathTex(
            r"z = r e^{i\theta},\quad r = |z| > 0,\quad "
            r"\theta = \operatorname{Arg} z \in (-\pi, \pi]",
            font_size=FS_PICCOLO,
            color=COL_NOTA,
        )
        ipotesi.next_to(passi, DOWN, buff=0.55)

        self.play(Write(passi[0]), run_time=1.3)
        self.play(FadeIn(ipotesi), run_time=0.7)
        for k in (1, 2, 3):
            self.play(Write(passi[k]), run_time=1.3)
            self.wait(0.7)
        self.wait(1.0)

        cornice = SurroundingRectangle(
            passi[3], color=COL_RAGGI, stroke_width=2.4, buff=0.2, corner_radius=0.08
        )
        self.play(Create(cornice), run_time=0.8)

        lettura = VGroup(
            MathTex(r"\bigl|z^{i}\bigr| = e^{-\operatorname{Arg} z}",
                    font_size=38, color=COL_CERCHI),
            Text("dipende solo dall'argomento", font_size=FS_PICCOLO, color=COL_NOTA),
            MathTex(r"\arg\bigl(z^{i}\bigr) \equiv \ln|z| \pmod{2\pi}",
                    font_size=38, color=COL_RAGGI),
            Text("dipende solo dal modulo", font_size=FS_PICCOLO, color=COL_NOTA),
        ).arrange(DOWN, buff=0.22)
        lettura.to_edge(DOWN, buff=0.4)
        self.play(FadeIn(lettura[0]), FadeIn(lettura[1]), run_time=1.1)
        self.wait(0.9)
        self.play(FadeIn(lettura[2]), FadeIn(lettura[3]), run_time=1.1)
        self.wait(2.2)

        morale = Text(
            "Modulo e argomento si scambiano i ruoli.",
            font_size=FS_TESTO,
            color=COL_ACCENTO,
        )
        morale.move_to(lettura).shift(DOWN * 0.05)
        self.play(FadeOut(lettura), FadeIn(morale), run_time=1.0)
        self.wait(1.8)
        self.play(
            FadeOut(VGroup(passi, ipotesi, cornice, morale, testa)), run_time=0.8
        )

    # -- 3b. Immagini di cerchi e raggi -----------------------------------
    def _scambio_di_ruoli(self) -> None:
        testa = titolo_scena(
            "Immagini di cerchi e raggi",
            "dominio: semipiano destro, per mantenere l'immagine inquadrata",
        )
        self.play(FadeIn(testa), run_time=0.6)

        p_dom = piano_complesso(raggio=3.4, lunghezza=4.9, passo=1.0)
        p_img = piano_complesso(raggio=5.4, lunghezza=4.9, passo=1.0)
        p_dom.to_edge(LEFT, buff=0.75).shift(DOWN * 0.5)
        p_img.to_edge(RIGHT, buff=0.75).shift(DOWN * 0.5)

        et_dom = Text("dominio z", font_size=FS_PICCOLO, color=COL_NOTA)
        et_dom.next_to(p_dom, UP, buff=0.14)
        et_img = MathTex(r"\text{immagine } w = z^{i}", font_size=FS_PICCOLO,
                         color=COL_NOTA)
        et_img.next_to(p_img, UP, buff=0.14)
        scala = MathTex(
            r"\text{scala } 1:1.57", font_size=20, color=GREY_B
        ).next_to(p_img, DOWN, buff=0.12)

        self.play(Create(p_dom), Create(p_img), FadeIn(et_dom), FadeIn(et_img),
                  FadeIn(scala), run_time=1.4)

        # Il semipiano destro ha Arg in (-pi/2, pi/2), dunque
        # |w| in (e^{-pi/2}, e^{pi/2}) = (0.208, 4.810): inquadrabile.
        raggi_cerchi = (0.3, 0.6, 1.0, 1.8, 3.0)
        angoli = np.linspace(-PI / 2 + 0.12, PI / 2 - 0.12, 9)

        specs_cerchi = [
            curva_spec(
                lambda t, r=float(r): r * np.exp(1j * t),
                (-PI / 2 + 0.12, PI / 2 - 0.12),
                COL_CERCHI,
                3.0,
                campioni=500,
            )
            for r in raggi_cerchi
        ]
        specs_raggi = [
            curva_spec(
                lambda t, a=float(a): t * np.exp(1j * a),
                (0.22, 3.3),
                COL_RAGGI,
                2.8,
                campioni=600,
            )
            for a in angoli
        ]

        dom_cerchi = disegna(p_dom, specs_cerchi)
        dom_raggi = disegna(p_dom, specs_raggi)
        self.play(Create(dom_cerchi, lag_ratio=0.1), run_time=1.6)
        self.play(Create(dom_raggi, lag_ratio=0.1), run_time=1.6)

        leg = legenda(
            [
                (COL_CERCHI, "cerchi |z| = cost."),
                (COL_RAGGI, "raggi arg z = cost."),
            ]
        )
        # La legenda sta nel corridoio centrale fra i due piani: i piani
        # occupano i bordi, il centro e' libero fino alla fascia dei teoremi.
        leg.scale(0.78).move_to([0.0, 0.9, 0.0])
        self.play(FadeIn(leg), run_time=0.6)

        # I cerchi diventano segmenti radiali.
        img_cerchi = disegna(p_img, specs_cerchi, map_z_i_principal)
        teorema1 = MathTex(
            r"|z| = r_0 \;\Longrightarrow\; \arg w = \ln r_0 \text{ costante}",
            font_size=FS_PICCOLO,
            color=COL_CERCHI,
        )
        teorema1.to_edge(DOWN, buff=0.75)
        self.play(
            *[
                ReplacementTransform(a.copy(), b)
                for a, b in zip(dom_cerchi, img_cerchi)
            ],
            FadeIn(teorema1),
            run_time=3.0,
        )
        self.wait(1.6)

        # I raggi diventano archi di cerchio.
        img_raggi = disegna(p_img, specs_raggi, map_z_i_principal)
        teorema2 = MathTex(
            r"\arg z = \theta_0 \;\Longrightarrow\; |w| = e^{-\theta_0} "
            r"\text{ costante}",
            font_size=FS_PICCOLO,
            color=COL_RAGGI,
        )
        teorema2.to_edge(DOWN, buff=0.35)
        self.play(
            *[
                ReplacementTransform(a.copy(), b)
                for a, b in zip(dom_raggi, img_raggi)
            ],
            FadeIn(teorema2),
            run_time=3.0,
        )
        self.wait(2.2)

        avvertenza = Text(
            "Segmenti, non semirette: il modulo dell'immagine è confinato.",
            font_size=20,
            color=COL_ACCENTO,
        )
        avvertenza.next_to(teorema2, UP, buff=0.1)
        self.play(FadeIn(avvertenza), run_time=0.9)
        self.wait(2.0)
        self.play(
            FadeOut(
                VGroup(p_dom, p_img, et_dom, et_img, scala, dom_cerchi, dom_raggi,
                       img_cerchi, img_raggi, teorema1, teorema2, avvertenza,
                       leg, testa)
            ),
            run_time=0.9,
        )

    # -- 3c. Il caso i^i ---------------------------------------------------
    def _i_alla_i(self) -> None:
        testa = titolo_scena("Il caso notevole", "i elevato a i")
        self.play(FadeIn(testa), run_time=0.6)

        plane = piano_complesso(raggio=1.5, lunghezza=4.4, passo=0.5)
        plane.to_edge(LEFT, buff=1.1).shift(DOWN * 0.45)
        self.play(Create(plane), run_time=1.0)

        cerchio = Circle(
            radius=float(np.linalg.norm(plane.n2p(1 + 0j) - plane.n2p(0j))),
            color=GREY_B,
            stroke_width=2,
        ).move_to(plane.n2p(0j))
        z_punto = etichetta_punto(plane, 1j, r"z = i", COL_PUNTO, UR)
        w_punto = etichetta_punto(
            plane, complex(np.exp(-PI / 2), 0), r"i^{\,i}", COL_IMMAGINE, DR
        )
        freccia = CurvedArrow(
            plane.n2p(1j), plane.n2p(complex(np.exp(-PI / 2), 0)),
            color=COL_ACCENTO, stroke_width=3, angle=-TAU / 5,
        )

        self.play(Create(cerchio), FadeIn(z_punto), run_time=1.0)

        calcolo = VGroup(
            MathTex(r"|i| = 1 \;\Longrightarrow\; \ln|i| = 0", font_size=FS_TESTO),
            MathTex(r"\operatorname{Arg}(i) = \tfrac{\pi}{2}", font_size=FS_TESTO),
            MathTex(
                r"i^{\,i} = e^{-\pi/2} \, e^{i \cdot 0} = e^{-\pi/2}",
                font_size=38,
                color=COL_IMMAGINE,
            ),
            MathTex(
                r"= 0.207879576\ldots \in \mathbb{R}_{>0}",
                font_size=FS_TESTO,
                color=COL_ACCENTO,
            ),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.34)
        calcolo.next_to(plane, RIGHT, buff=0.85)

        for riga in calcolo:
            self.play(Write(riga), run_time=1.2)
            self.wait(0.45)
        self.play(Create(freccia), FadeIn(w_punto), run_time=1.2)
        self.wait(1.4)

        sorpresa = Text(
            "Un numero immaginario elevato a un numero immaginario: reale.",
            font_size=22,
            color=COL_ACCENTO,
        )
        sorpresa.to_edge(DOWN, buff=0.35)
        self.play(FadeIn(sorpresa), run_time=0.9)
        self.wait(2.4)
        self.play(
            FadeOut(
                VGroup(plane, cerchio, z_punto, w_punto, freccia, calcolo,
                       sorpresa, testa)
            ),
            run_time=0.9,
        )

    # -- 3d. La corona immagine -------------------------------------------
    def _corona_immagine(self) -> None:
        testa = titolo_scena("L'immagine del ramo principale")
        self.play(FadeIn(testa), run_time=0.6)

        enunciato = MathTex(
            r"\bigl|z^{i}\bigr| = e^{-\operatorname{Arg} z},\qquad "
            r"\operatorname{Arg} z \in (-\pi, \pi]",
            font_size=FS_FORMULA,
        )
        enunciato.next_to(testa, DOWN, buff=0.35)
        self.play(Write(enunciato), run_time=1.6)

        # Piano in scala radiale ampia: e^{pi} = 23.14 contro e^{-pi} = 0.043.
        plane = piano_complesso(raggio=26.0, lunghezza=4.6, passo=10.0)
        plane.to_edge(LEFT, buff=1.2).shift(DOWN * 0.5)
        self.play(Create(plane), run_time=1.0)

        r_est = float(np.linalg.norm(plane.n2p(E_PI + 0j) - plane.n2p(0j)))
        r_int = float(np.linalg.norm(plane.n2p(E_MENO_PI + 0j) - plane.n2p(0j)))
        esterno = Circle(
            radius=r_est, color=COL_RAGGI, stroke_width=3.2
        ).move_to(plane.n2p(0j))
        interno = Circle(
            radius=max(r_int, 0.02), color=COL_CERCHI, stroke_width=3.2
        ).move_to(plane.n2p(0j))
        corona = Annulus(
            inner_radius=max(r_int, 0.001),
            outer_radius=r_est,
            color=COL_IMMAGINE,
            fill_opacity=0.14,
            stroke_width=0,
        ).move_to(plane.n2p(0j))

        self.play(FadeIn(corona), Create(esterno), Create(interno), run_time=1.6)

        dettagli = VGroup(
            MathTex(
                r"e^{-\pi} \le |w| < e^{\pi}", font_size=38, color=COL_IMMAGINE
            ),
            MathTex(
                r"e^{-\pi} = 0.0432\ldots \quad (\text{attinto})",
                font_size=FS_PICCOLO,
                color=COL_CERCHI,
            ),
            MathTex(
                r"e^{\pi} = 23.1407\ldots \quad (\text{mai attinto})",
                font_size=FS_PICCOLO,
                color=COL_RAGGI,
            ),
            MathTex(
                r"\frac{e^{\pi}}{e^{-\pi}} = e^{2\pi} \approx 535.5",
                font_size=FS_PICCOLO,
                color=COL_NOTA,
            ),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.3)
        dettagli.next_to(plane, RIGHT, buff=0.8)
        self.play(FadeIn(dettagli, shift=LEFT * 0.2), run_time=1.4)
        self.wait(1.8)

        precisazione = VGroup(
            MathTex(
                r"\text{su } \mathbb{C}\setminus\{0\}:\;\; "
                r"e^{-\pi} \le |w| < e^{\pi} \;\;(\text{semiaperta})",
                font_size=FS_PICCOLO,
                color=COL_ACCENTO,
            ),
            MathTex(
                r"\text{su } \mathbb{C}\setminus(-\infty,0]:\;\; "
                r"e^{-\pi} < |w| < e^{\pi} \;\;(\text{aperta})",
                font_size=FS_PICCOLO,
                color=COL_ACCENTO,
            ),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.2)
        precisazione.to_edge(DOWN, buff=0.3)
        self.play(FadeIn(precisazione), run_time=1.1)
        self.wait(2.6)
        self.play(
            FadeOut(
                VGroup(plane, corona, esterno, interno, dettagli, precisazione,
                       enunciato, testa)
            ),
            run_time=0.9,
        )


# ===========================================================================
# SCENA 4 -- Multivalenza di z^i
# ===========================================================================

class S04Multivalenza(Scene):
    """I rami k = -2, ..., 2 del logaritmo, la relazione
    z^i_k = z^i e^{-2 pi k}, l'allineamento radiale dei valori, e la
    correzione sull'iniettivita'."""

    K_RANGE = range(-2, 3)

    def construct(self) -> None:
        self._rami_del_logaritmo()
        self._allineamento_radiale()
        self._non_iniettivita()

    # -- 4a. Le strisce del logaritmo -------------------------------------
    def _rami_del_logaritmo(self) -> None:
        testa = titolo_scena("Multivalenza", "i rami del logaritmo complesso")
        self.play(FadeIn(testa), run_time=0.6)

        definizione = MathTex(
            r"\log_k z = \ln|z| + i\bigl(\operatorname{Arg} z + 2\pi k\bigr),",
            r"\qquad k \in \mathbb{Z}",
            font_size=FS_FORMULA,
        )
        definizione.next_to(testa, DOWN, buff=0.4)
        self.play(Write(definizione), run_time=1.8)

        # Piano del logaritmo: ascissa ln|z|, ordinata arg z.
        assi = Axes(
            x_range=[-2.2, 2.2, 1],
            y_range=[-3 * PI, 3 * PI, PI],
            x_length=5.6,
            y_length=4.6,
            axis_config={"stroke_color": GREY_B, "include_tip": True},
        )
        assi.to_edge(LEFT, buff=0.8).shift(DOWN * 0.55)
        et_x = MathTex(r"\ln|z|", font_size=FS_PICCOLO).next_to(
            assi.x_axis, RIGHT, buff=0.12
        )
        et_y = MathTex(r"\arg z", font_size=FS_PICCOLO).next_to(
            assi.y_axis, UP, buff=0.12
        )
        self.play(Create(assi), FadeIn(et_x), FadeIn(et_y), run_time=1.3)

        colori = [PURPLE_B, BLUE_C, COL_IMMAGINE, COL_ACCENTO, COL_TAGLIO]
        strisce = VGroup()
        etichette = VGroup()
        for colore, k in zip(colori, self.K_RANGE):
            basso = (2 * k - 1) * PI
            alto = (2 * k + 1) * PI
            basso_v = max(basso, -3 * PI)
            alto_v = min(alto, 3 * PI)
            if alto_v <= basso_v:
                continue
            angolo = Polygon(
                assi.c2p(-2.2, basso_v),
                assi.c2p(2.2, basso_v),
                assi.c2p(2.2, alto_v),
                assi.c2p(-2.2, alto_v),
                color=colore,
                fill_opacity=0.2,
                stroke_width=2,
            )
            strisce.add(angolo)
            lab = MathTex(f"k = {k}", font_size=FS_PICCOLO, color=colore)
            lab.move_to(assi.c2p(1.55, (basso_v + alto_v) / 2))
            etichette.add(lab)

        self.play(
            LaggedStart(*[FadeIn(s) for s in strisce], lag_ratio=0.2),
            run_time=2.0,
        )
        self.play(FadeIn(etichette), run_time=0.8)

        spiegazione = VGroup(
            MathTex(
                r"\text{ciascuna striscia \`e alta } 2\pi", font_size=FS_TESTO,
                color=COL_NOTA,
            ),
            MathTex(
                r"\exp \text{ \`e biiettiva su ogni striscia}", font_size=FS_TESTO,
                color=COL_NOTA,
            ),
            MathTex(
                r"k = 0 \;\to\; \operatorname{Log} z \text{ (principale)}",
                font_size=FS_TESTO,
                color=COL_IMMAGINE,
            ),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.3)
        spiegazione.next_to(assi, RIGHT, buff=0.7)
        self.play(FadeIn(spiegazione), run_time=1.2)
        self.wait(2.4)

        derivazione = MathTex(
            r"z^{i}_{k} = \exp\bigl(i\log_k z\bigr)"
            r"= e^{-(\theta + 2\pi k)} e^{i\ln r}"
            r"= z^{i}\, e^{-2\pi k}",
            font_size=FS_TESTO,
            color=COL_RAGGI,
        )
        derivazione.to_edge(DOWN, buff=0.3)
        self.play(Write(derivazione), run_time=2.2)
        self.wait(2.4)
        self.play(
            FadeOut(
                VGroup(assi, et_x, et_y, strisce, etichette, spiegazione,
                       derivazione, definizione, testa)
            ),
            run_time=0.9,
        )

    # -- 4b. Allineamento radiale dei valori ------------------------------
    def _allineamento_radiale(self) -> None:
        testa = titolo_scena(
            "I valori della potenza immaginaria",
            "allineati su una semiretta, in scala logaritmica"
        )
        self.play(FadeIn(testa), run_time=0.6)

        z0 = 1.6 * np.exp(1j * 0.6)
        valori = [complex(map_z_i_branch(z0, k)) for k in self.K_RANGE]
        arg_comune = float(arg_principal(valori[2]))

        # Scala radiale logaritmica: senza di essa due rami consecutivi
        # differiscono di un fattore 535 e sono indistinguibili sullo schermo.
        assi = Axes(
            x_range=[-7.5, 7.5, 2.5],
            y_range=[-2.2, 2.2, 1],
            x_length=7.4,
            y_length=2.6,
            axis_config={"stroke_color": GREY_B, "include_tip": False},
        )
        assi.shift(DOWN * 0.35)
        et_assi = MathTex(
            r"\log_{10} |w| \quad (\text{semiretta } \arg w = "
            + f"{arg_comune:+.3f}" + r")",
            font_size=FS_PICCOLO,
            color=COL_NOTA,
        )
        et_assi.next_to(assi, DOWN, buff=0.3)
        self.play(Create(assi), FadeIn(et_assi), run_time=1.3)

        colori = [PURPLE_B, BLUE_C, COL_IMMAGINE, COL_ACCENTO, COL_TAGLIO]
        punti = VGroup()
        etichette = VGroup()
        for colore, k, w in zip(colori, self.K_RANGE, valori):
            x = float(np.log10(abs(w)))
            punto = Dot(assi.c2p(x, 0), color=colore, radius=0.1)
            lab = VGroup(
                MathTex(f"k = {k}", font_size=FS_PICCOLO, color=colore),
                MathTex(f"{abs(w):.3e}".replace("e", r"\cdot 10^{") + "}",
                        font_size=20, color=colore),
            ).arrange(DOWN, buff=0.1)
            lab.next_to(punto, UP if k % 2 == 0 else DOWN, buff=0.2)
            punti.add(punto)
            etichette.add(lab)

        self.play(
            LaggedStart(*[GrowFromCenter(p) for p in punti], lag_ratio=0.18),
            run_time=1.8,
        )
        self.play(FadeIn(etichette), run_time=1.0)

        # Le frecce fra rami consecutivi: passo costante in scala log.
        frecce = VGroup()
        for i in range(len(punti) - 1):
            frecce.add(
                Arrow(
                    punti[i].get_center(),
                    punti[i + 1].get_center(),
                    buff=0.14,
                    color=COL_NOTA,
                    stroke_width=3,
                    max_tip_length_to_length_ratio=0.12,
                )
            )
        passo = MathTex(
            r"\times e^{-2\pi} \approx 1.867\cdot 10^{-3}",
            font_size=FS_PICCOLO,
            color=COL_ACCENTO,
        )
        passo.next_to(assi, UP, buff=0.9)
        self.play(Create(frecce, lag_ratio=0.2), FadeIn(passo), run_time=1.6)
        self.wait(1.8)

        tesi = VGroup(
            MathTex(
                r"\arg\bigl(z^{i}_{k}\bigr) = \ln|z| \quad "
                r"\text{indipendente da } k",
                font_size=FS_TESTO,
                color=COL_IMMAGINE,
            ),
            MathTex(
                r"e^{-2\pi k} \in \mathbb{R}_{>0}: "
                r"\text{tutti i rami su una stessa semiretta}",
                font_size=24,
                color=COL_NOTA,
            ),
        ).arrange(DOWN, buff=0.22)
        tesi.to_edge(DOWN, buff=0.25)
        self.play(FadeIn(tesi), run_time=1.2)
        self.wait(2.6)
        self.play(
            FadeOut(
                VGroup(assi, et_assi, punti, etichette, frecce, passo, tesi, testa)
            ),
            run_time=0.9,
        )

    # -- 4c. Il ramo principale non e' iniettivo --------------------------
    def _non_iniettivita(self) -> None:
        testa = titolo_scena(
            "Attenzione", "il ramo principale non è iniettivo"
        )
        self.play(FadeIn(testa), run_time=0.6)

        ragionamento = VGroup(
            MathTex(
                r"z_1^{i} = z_2^{i} \iff "
                r"e^{-\theta_1} e^{i\ln r_1} = e^{-\theta_2} e^{i\ln r_2}",
                font_size=FS_TESTO,
            ),
            MathTex(
                r"\iff \theta_1 = \theta_2 \;\text{ e }\; "
                r"\ln r_1 - \ln r_2 \in 2\pi\mathbb{Z}",
                font_size=FS_TESTO,
            ),
            MathTex(
                r"\iff z_2 = z_1 \, e^{2\pi m}, \quad m \in \mathbb{Z}",
                font_size=38,
                color=COL_TAGLIO,
            ),
        ).arrange(DOWN, buff=0.4)
        ragionamento.next_to(testa, DOWN, buff=0.6)

        for riga in ragionamento:
            self.play(Write(riga), run_time=1.5)
            self.wait(0.5)
        self.wait(1.0)

        controesempio = VGroup(
            Text("Controesempio minimo", font_size=FS_SOTTO, color=COL_ACCENTO,
                 weight=BOLD),
            MathTex(r"1^{i} = e^{i \ln 1} = 1", font_size=FS_TESTO),
            MathTex(
                r"\bigl(e^{2\pi}\bigr)^{i} = e^{i \ln e^{2\pi}} = e^{2\pi i} = 1",
                font_size=FS_TESTO,
            ),
            MathTex(
                r"1 \ne e^{2\pi} \approx 535.49, \text{ ma stessa immagine}",
                font_size=FS_PICCOLO,
                color=COL_TAGLIO,
            ),
        ).arrange(DOWN, buff=0.26)
        controesempio.next_to(ragionamento, DOWN, buff=0.55)
        cornice = SurroundingRectangle(
            controesempio, color=COL_TAGLIO, stroke_width=2, buff=0.24,
            corner_radius=0.1,
        )
        self.play(FadeIn(controesempio), Create(cornice), run_time=1.6)
        self.wait(2.6)

        rimedio = MathTex(
            r"\text{iniettiva su } \{e^{a} < |z| < e^{a + 2\pi}\} \cap "
            r"\bigl(\mathbb{C}\setminus(-\infty,0]\bigr)",
            font_size=FS_PICCOLO,
            color=COL_IMMAGINE,
        )
        rimedio.to_edge(DOWN, buff=0.3)
        self.play(FadeIn(rimedio), run_time=1.0)
        self.wait(2.6)
        self.play(
            FadeOut(
                VGroup(ragionamento, controesempio, cornice, rimedio, testa)
            ),
            run_time=0.9,
        )


# ===========================================================================
# SCENA 5 -- Confronto formale
# ===========================================================================

class S05Confronto(Scene):
    """Tabella comparativa fra z^n e z^i su sette voci strutturali."""

    #: (voce, colonna z^n, colonna z^i)
    RIGHE = [
        (
            r"\text{univocit\`a}",
            r"\text{funzione univoca su } \mathbb{C}",
            r"\text{relazione multivalore; ramo scelto}",
        ),
        (
            r"\text{preimmagini di } w \ne 0",
            r"n \text{ (finite)}",
            r"\infty \text{ numerabili: } z e^{2\pi m}",
        ),
        (
            r"\text{conformit\`a}",
            r"\text{conforme fuori da } 0",
            r"\text{conforme su } \mathbb{C}\setminus(-\infty,0]",
        ),
        (
            r"\text{in } z = 0",
            r"f(0) = 0,\; f'(0) = 0",
            r"\text{punto di diramazione}",
        ),
        (
            r"\text{modulo}",
            r"|w| = |z|^{n}",
            r"|w| = e^{-\operatorname{Arg} z}",
        ),
        (
            r"\text{argomento}",
            r"\arg w = n \arg z",
            r"\arg w = \ln|z|",
        ),
        (
            r"\text{taglio di ramo}",
            r"\text{nessuno}",
            r"(-\infty, 0]",
        ),
        (
            r"\text{immagine}",
            r"\mathbb{C} \text{ (surgettiva)}",
            r"e^{-\pi} \le |w| < e^{\pi}",
        ),
    ]

    def construct(self) -> None:
        testa = titolo_scena("Confronto formale")
        self.play(FadeIn(testa), run_time=0.6)

        x_voce, x_n, x_i = -6.1, -2.3, 3.3
        y_top = 2.35
        dy = 0.62

        intestazioni = VGroup(
            MathTex(r"z^{n}", font_size=38, color=COL_CERCHI).move_to([x_n, y_top, 0]),
            MathTex(r"z^{i}", font_size=38, color=COL_RAGGI).move_to([x_i, y_top, 0]),
        )
        linea_testa = Line(
            [x_voce - 0.3, y_top - 0.33, 0], [6.9, y_top - 0.33, 0],
            color=GREY_B, stroke_width=2,
        )
        separatore = Line(
            [0.42, y_top + 0.3, 0], [0.42, y_top - 0.33 - dy * len(self.RIGHE), 0],
            color=GREY_D, stroke_width=1.4,
        )

        righe = VGroup()
        for idx, (voce, col_n, col_i) in enumerate(self.RIGHE):
            y = y_top - 0.33 - dy * (idx + 0.62)
            mob_voce = MathTex(voce, font_size=23, color=COL_NOTA)
            mob_voce.move_to([x_voce, y, 0], aligned_edge=LEFT)
            mob_n = MathTex(col_n, font_size=23, color=WHITE)
            mob_i = MathTex(col_i, font_size=23, color=WHITE)
            # Ogni cella viene rimpicciolita se eccede la colonna: con il testo
            # effettivamente reso (cfr. nota su lmodern) le celle sono molto
            # piu' larghe della sola parte simbolica.
            larghezza_max = 4.9
            for cella, x in ((mob_n, x_n), (mob_i, x_i)):
                if cella.width > larghezza_max:
                    cella.scale_to_fit_width(larghezza_max)
                cella.move_to([x, y, 0])
            if mob_voce.width > 3.2:
                mob_voce.scale_to_fit_width(3.2)
                mob_voce.move_to([x_voce, y, 0], aligned_edge=LEFT)
            righe.add(VGroup(mob_voce, mob_n, mob_i))

        self.play(FadeIn(intestazioni), Create(linea_testa), Create(separatore),
                  run_time=1.1)
        for riga in righe:
            self.play(FadeIn(riga, shift=RIGHT * 0.2), run_time=0.55)
            self.wait(0.35)
        self.wait(2.0)

        # Evidenzia la differenza strutturale piu' profonda.
        evidenza = SurroundingRectangle(
            VGroup(righe[4], righe[5]), color=COL_ACCENTO, stroke_width=2.4,
            buff=0.12, corner_radius=0.08,
        )
        commento = MathTex(
            r"\text{Qui sta tutta la differenza: } z^{n} "
            r"\text{ conserva i ruoli, } z^{i} \text{ li scambia.}",
            font_size=24,
            color=COL_ACCENTO,
        )
        commento.to_edge(DOWN, buff=0.28)
        self.play(Create(evidenza), FadeIn(commento), run_time=1.3)
        self.wait(3.0)
        self.play(
            FadeOut(
                VGroup(righe, intestazioni, linea_testa, separatore, evidenza,
                       commento, testa)
            ),
            run_time=0.9,
        )


# ===========================================================================
# SCENA 6 -- Chiusura
# ===========================================================================

class S06Outro(Scene):
    """Riepilogo dei tre teoremi chiave e della differenza strutturale."""

    def construct(self) -> None:
        testa = titolo_scena("Riepilogo")
        self.play(FadeIn(testa), run_time=0.6)

        teoremi = VGroup(
            self._teorema(
                "Teorema 1 — avvolgimento",
                r"z \mapsto z^{n} \text{ \`e un rivestimento } n\text{-a-}1 "
                r"\text{ di } \mathbb{C}^{*} \text{ su } \mathbb{C}^{*}",
                COL_CERCHI,
            ),
            self._teorema(
                "Teorema 2 — scambio di ruoli",
                r"\bigl|z^{i}\bigr| = e^{-\operatorname{Arg} z}, \qquad "
                r"\arg\bigl(z^{i}\bigr) = \ln|z|",
                COL_RAGGI,
            ),
            self._teorema(
                "Teorema 3 — struttura dei rami",
                r"z^{i}_{k} = z^{i} e^{-2\pi k}: \text{ progressione geometrica "
                r"su una semiretta}",
                COL_RADICI,
            ),
        ).arrange(DOWN, buff=0.45)
        teoremi.next_to(testa, DOWN, buff=0.55)

        for blocco in teoremi:
            self.play(FadeIn(blocco, shift=UP * 0.2), run_time=1.2)
            self.wait(1.1)
        self.wait(1.2)

        morale = VGroup(
            MathTex(
                r"z^{n} \text{ \`e algebrica: nasce dal prodotto, "
                r"\`e intera, ha un grado.}",
                font_size=26,
                color=COL_CERCHI,
            ),
            MathTex(
                r"z^{i} \text{ \`e trascendente: nasce dal logaritmo, "
                r"ha rami, ha un taglio.}",
                font_size=26,
                color=COL_RAGGI,
            ),
        ).arrange(DOWN, buff=0.24)
        morale.to_edge(DOWN, buff=0.6)
        self.play(FadeIn(morale), run_time=1.4)
        self.wait(3.0)
        self.play(FadeOut(VGroup(teoremi, morale, testa)), run_time=0.9)

        chiusura = MathTex(
            r"i^{\,i} = e^{-\pi/2} \approx 0.2079", font_size=60, color=COL_ACCENTO
        )
        self.play(Write(chiusura), run_time=1.8)
        self.wait(2.4)
        self.play(FadeOut(chiusura), run_time=1.0)

    @staticmethod
    def _teorema(titolo: str, formula: str, colore: str) -> VGroup:
        """Un blocco incorniciato con titolo e formula."""
        t = Text(titolo, font_size=FS_PICCOLO, color=colore, weight=BOLD)
        f = MathTex(formula, font_size=28, color=WHITE)
        contenuto = VGroup(t, f).arrange(DOWN, buff=0.2)
        bordo = SurroundingRectangle(
            contenuto, color=colore, stroke_width=1.8, buff=0.22, corner_radius=0.1
        )
        return VGroup(bordo, contenuto)
