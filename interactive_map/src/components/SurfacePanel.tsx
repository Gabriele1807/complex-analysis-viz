/**
 * Superfici 3D di |f(z)| e Arg f(z), più le corrispondenti mappe 2D.
 *
 * Plotly viene caricato con `import()` dinamico: è l'unica dipendenza pesante
 * del progetto (~3,5 MB) e non deve entrare nel bundle iniziale, che resta
 * leggero per chi non apre mai questi pannelli.
 *
 * Nota sull'argomento: Arg f(z) è discontinuo di 2π attraverso le curve dove
 * la fase attraversa ±π. Disegnarlo come superficie continua produrrebbe pareti
 * verticali che NON sono salti della funzione, ma della sua rappresentazione.
 * Qui le celle dove il salto supera π vengono messe a `null`, lasciando un
 * buco: il grafico mostra la discontinuità invece di inventarci una rampa.
 */

import { useEffect, useRef, useState } from "react";

import { abs, argPrincipal, type Complex } from "../math/complex";
import { mappaCorrente } from "../math/complexMaps";
import { useStato } from "../state/store";

type Grandezza = "modulo" | "argomento";

interface Props {
  grandezza: Grandezza;
}

const RISOLUZIONE = 121;

export function SurfacePanel({ grandezza }: Props) {
  const stato = useStato();
  const contenitore = useRef<HTMLDivElement>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [tridimensionale, setTridimensionale] = useState(true);
  const [scalaLog, setScalaLog] = useState(grandezza === "modulo");

  useEffect(() => {
    let annullato = false;

    async function disegna() {
      setCaricamento(true);
      try {
        const Plotly = (await import("plotly.js-dist-min")).default;
        if (annullato || !contenitore.current) return;

        const f = mappaCorrente(stato.mappa);
        const { xMin, xMax, yMin, yMax } = stato.dominio;
        const xs: number[] = [];
        const ys: number[] = [];
        for (let i = 0; i < RISOLUZIONE; i += 1) {
          xs.push(xMin + ((xMax - xMin) * i) / (RISOLUZIONE - 1));
          ys.push(yMin + ((yMax - yMin) * i) / (RISOLUZIONE - 1));
        }

        const z: (number | null)[][] = [];
        for (let j = 0; j < RISOLUZIONE; j += 1) {
          const riga: (number | null)[] = [];
          for (let i = 0; i < RISOLUZIONE; i += 1) {
            const p: Complex = { re: xs[i], im: ys[j] };
            const w = f(p);
            if (!Number.isFinite(w.re) || !Number.isFinite(w.im)) {
              riga.push(null);
              continue;
            }
            if (grandezza === "modulo") {
              const m = abs(w);
              riga.push(scalaLog ? (m > 0 ? Math.log10(m) : null) : m);
            } else {
              riga.push(argPrincipal(w));
            }
          }
          z.push(riga);
        }

        if (grandezza === "argomento") mascheraSalti(z);

        const titoloZ =
          grandezza === "modulo"
            ? scalaLog
              ? "log₁₀ |f(z)|"
              : "|f(z)|"
            : "Arg f(z)  [rad]";

        const traccia = tridimensionale
          ? {
              type: "surface",
              x: xs,
              y: ys,
              z,
              colorscale: grandezza === "modulo" ? "Viridis" : "HSV",
              connectgaps: false,
              contours: {
                z: { show: true, usecolormap: true, project: { z: true } },
              },
              colorbar: { title: { text: titoloZ }, thickness: 12 },
            }
          : {
              type: "heatmap",
              x: xs,
              y: ys,
              z,
              colorscale: grandezza === "modulo" ? "Viridis" : "HSV",
              connectgaps: false,
              colorbar: { title: { text: titoloZ }, thickness: 12 },
            };

        const layout = {
          autosize: true,
          height: 460,
          margin: { l: 8, r: 8, t: 28, b: 8 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          font: { color: "#c8d1de", size: 11 },
          title: {
            text:
              grandezza === "modulo"
                ? "Modulo dell'immagine"
                : "Argomento principale dell'immagine",
            font: { size: 13 },
          },
          scene: {
            xaxis: { title: { text: "Re z" }, gridcolor: "#2a3240" },
            yaxis: { title: { text: "Im z" }, gridcolor: "#2a3240" },
            zaxis: { title: { text: titoloZ }, gridcolor: "#2a3240" },
            camera: { eye: { x: 1.5, y: -1.5, z: 1.0 } },
          },
          xaxis: { title: { text: "Re z" } },
          yaxis: { title: { text: "Im z" }, scaleanchor: "x" },
        };

        await Plotly.react(contenitore.current, [traccia], layout, {
          responsive: true,
          displaylogo: false,
          locale: "it",
        });
        if (!annullato) setErrore(null);
      } catch (e) {
        if (!annullato) setErrore(e instanceof Error ? e.message : String(e));
      } finally {
        if (!annullato) setCaricamento(false);
      }
    }

    void disegna();
    return () => {
      annullato = true;
    };
  }, [stato.mappa, stato.dominio, grandezza, tridimensionale, scalaLog]);

  return (
    <div className="pannello-superficie">
      <div className="riga-pulsanti">
        <button
          className={tridimensionale ? "attivo" : ""}
          onClick={() => setTridimensionale(true)}
        >
          superficie 3D
        </button>
        <button
          className={!tridimensionale ? "attivo" : ""}
          onClick={() => setTridimensionale(false)}
        >
          mappa 2D
        </button>
        {grandezza === "modulo" && (
          <label className="campo campo--inline">
            <input
              type="checkbox"
              checked={scalaLog}
              onChange={(e) => setScalaLog(e.target.checked)}
            />
            <span>scala logaritmica</span>
          </label>
        )}
      </div>

      {grandezza === "modulo" ? (
        <p className="nota">
          Per z<sup>n</sup> il modulo cresce come |z|<sup>n</sup> e la scala
          logaritmica è quasi indispensabile. Per z<sup>i</sup> il modulo è{" "}
          e<sup>−Arg z</sup>: non dipende affatto da |z|, e la superficie è una
          «scalinata» che sale girando attorno all'origine, con un gradino di
          fattore e<sup>2π</sup> sul taglio di ramo.
        </p>
      ) : (
        <p className="nota">
          L'argomento principale è discontinuo di 2π dove la fase attraversa ±π.
          Le celle attraversate dal salto sono lasciate vuote anziché raccordate:
          le pareti verticali sarebbero un artefatto della rappresentazione, non
          un salto della funzione. Per z<sup>i</sup> l'argomento vale ln|z| e le
          discontinuità sono circonferenze concentriche.
        </p>
      )}

      {caricamento && <p className="nota">Caricamento del motore grafico…</p>}
      {errore && (
        <p className="nota nota--allerta">
          Impossibile disegnare la superficie: {errore}
        </p>
      )}
      <div ref={contenitore} className="contenitore-plotly" />
    </div>
  );
}

/**
 * Mette a `null` le celle attraversate da un salto di fase.
 *
 * Il criterio è locale: se una cella differisce da un vicino per più di π,
 * fra i due passa una discontinuità del ramo principale.
 */
function mascheraSalti(z: (number | null)[][], soglia = Math.PI): void {
  const righe = z.length;
  const colonne = z[0]?.length ?? 0;
  const daAnnullare: Array<[number, number]> = [];

  for (let j = 0; j < righe; j += 1) {
    for (let i = 0; i < colonne; i += 1) {
      const v = z[j][i];
      if (v === null) continue;
      const vicini = [
        j > 0 ? z[j - 1][i] : null,
        j < righe - 1 ? z[j + 1][i] : null,
        i > 0 ? z[j][i - 1] : null,
        i < colonne - 1 ? z[j][i + 1] : null,
      ];
      if (vicini.some((u) => u !== null && Math.abs(u - v) > soglia)) {
        daAnnullare.push([j, i]);
      }
    }
  }
  for (const [j, i] of daAnnullare) z[j][i] = null;
}
