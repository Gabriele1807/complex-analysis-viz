"""
Concatena le sei scene in un unico video.

Manim produce un file per scena. Questo script le unisce nell'ordine
narrativo usando il demuxer `concat` di FFmpeg, che copia i flussi senza
ricodificarli: l'operazione e' istantanea e senza perdita di qualita', perche'
tutte le scene condividono codec, risoluzione e frame rate.

Il binario di FFmpeg viene preso da `imageio-ffmpeg`, installato nel venv del
progetto: non serve un FFmpeg di sistema.

Uso:
    .venv\\Scripts\\python concatena.py                 # qualita' alta (1080p60)
    .venv\\Scripts\\python concatena.py --qualita 480p15 # bozza
    .venv\\Scripts\\python concatena.py --uscita mio.mp4
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

#: Ordine narrativo delle scene.
SCENE = [
    "S01Intro",
    "S02PotenzeIntere",
    "S03PotenzaImmaginaria",
    "S04Multivalenza",
    "S05Confronto",
    "S06Outro",
]

QUALITA = {
    "1080p60": "qh",
    "720p30": "qm",
    "854p30": "ql",
    "480p15": "ql",
}


def trova_ffmpeg() -> str:
    """Il binario di FFmpeg fornito da imageio-ffmpeg."""
    try:
        import imageio_ffmpeg
    except ImportError:  # pragma: no cover - dipende dall'ambiente
        print(
            "imageio-ffmpeg non e' installato nel venv.\n"
            "Installalo con:  .venv\\Scripts\\python -m pip install imageio-ffmpeg",
            file=sys.stderr,
        )
        raise SystemExit(2)
    return imageio_ffmpeg.get_ffmpeg_exe()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--qualita",
        default="1080p60",
        help="cartella di qualita' prodotta da Manim (default: 1080p60)",
    )
    parser.add_argument(
        "--uscita",
        default=None,
        help="file di destinazione (default: media/videos/potenze_complesse_<qualita>.mp4)",
    )
    args = parser.parse_args()

    radice = Path(__file__).resolve().parent
    cartella = radice / "media" / "videos" / "scenes" / args.qualita

    if not cartella.is_dir():
        disponibili = sorted(
            p.name for p in (radice / "media" / "videos" / "scenes").glob("*") if p.is_dir()
        )
        print(f"Cartella non trovata: {cartella}", file=sys.stderr)
        print(f"Qualita' disponibili: {', '.join(disponibili) or 'nessuna'}", file=sys.stderr)
        return 1

    mancanti = [s for s in SCENE if not (cartella / f"{s}.mp4").exists()]
    if mancanti:
        flag = QUALITA.get(args.qualita, "qh")
        print("Mancano le scene seguenti:", ", ".join(mancanti), file=sys.stderr)
        print(
            "Rendile con:\n    "
            + "\n    ".join(
                f".venv\\Scripts\\python -m manim -{flag} scenes.py {s}" for s in mancanti
            ),
            file=sys.stderr,
        )
        return 1

    uscita = Path(
        args.uscita
        or (radice / "media" / "videos" / f"potenze_complesse_{args.qualita}.mp4")
    )
    uscita.parent.mkdir(parents=True, exist_ok=True)

    # L'elenco per il demuxer `concat`. I percorsi vanno fra apici semplici e
    # con separatori POSIX, anche su Windows.
    elenco = radice / "media" / "elenco_scene.txt"
    elenco.write_text(
        "\n".join(f"file '{(cartella / f'{s}.mp4').as_posix()}'" for s in SCENE) + "\n",
        encoding="utf-8",
    )

    comando = [
        trova_ffmpeg(),
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(elenco),
        "-c", "copy",
        str(uscita),
    ]
    print("Eseguo:", " ".join(comando))
    esito = subprocess.run(comando, capture_output=True, text=True)
    if esito.returncode != 0:
        print(esito.stderr[-2500:], file=sys.stderr)
        return esito.returncode

    dimensione = uscita.stat().st_size / (1024 * 1024)
    print(f"\nVideo creato: {uscita}  ({dimensione:.1f} MB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
