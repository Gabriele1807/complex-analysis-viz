/**
 * Barra dei controlli: scelta della mappa, parametri, interruttori di
 * visualizzazione, dominio e risoluzione.
 */

import { c } from "../math/complex";
import type { TipoMappa } from "../math/complexMaps";
import { useDispatch, useStato, type Interruttori } from "../state/store";

const ETICHETTE_INTERRUTTORI: Array<[keyof Interruttori, string, string]> = [
  ["ritrattoFase", "Ritratto di fase", "Colore = argomento di f(z), bande = modulo"],
  ["contornoModulo", "Bande del modulo", "Curve di livello |f(z)| in progressione geometrica di ragione 2"],
  ["contornoFase", "Settori di fase", "Dodici settori da π/6 nell'argomento"],
  ["polare", "Griglia polare", "Cerchi |z| costante e raggi arg z costante"],
  ["cartesiana", "Griglia cartesiana", "Rette parallele agli assi"],
  ["curveImmagine", "Curve immagine", "Immagine delle griglie nel piano w"],
  ["puntiCampione", "Punti campione", "1, i, −1, −i, 1+i, 2i e altri notevoli"],
  ["radici", "Radici / rami", "Radici n-esime di f(z), oppure i rami di z^i"],
  ["tracce", "Fibra del punto", "Gli altri punti con la stessa immagine"],
  ["taglio", "Taglio di ramo", "Evidenzia il semiasse reale negativo"],
];

export function Controls() {
  const stato = useStato();
  const dispatch = useDispatch();
  const { mappa } = stato;

  const cambiaMappa = (valore: TipoMappa) =>
    dispatch({ tipo: "imposta-mappa", valore });

  return (
    <div className="controlli">
      <section className="controlli__gruppo">
        <h4>Mappa</h4>
        <div className="segmentato" role="radiogroup" aria-label="Funzione">
          <button
            role="radio"
            aria-checked={mappa.tipo === "potenza"}
            className={mappa.tipo === "potenza" ? "attivo" : ""}
            onClick={() => cambiaMappa("potenza")}
          >
            z<sup>n</sup>
          </button>
          <button
            role="radio"
            aria-checked={mappa.tipo === "zi"}
            className={mappa.tipo === "zi" ? "attivo" : ""}
            onClick={() => cambiaMappa("zi")}
          >
            z<sup>i</sup> principale
          </button>
          <button
            role="radio"
            aria-checked={mappa.tipo === "ziRami"}
            className={mappa.tipo === "ziRami" ? "attivo" : ""}
            onClick={() => cambiaMappa("ziRami")}
          >
            z<sup>i</sup> rami
          </button>
        </div>

        {mappa.tipo === "potenza" && (
          <label className="campo">
            <span>
              esponente n = <strong>{mappa.n}</strong>
            </span>
            <input
              type="range"
              min={2}
              max={10}
              step={1}
              value={mappa.n}
              onChange={(e) =>
                dispatch({ tipo: "imposta-n", valore: Number(e.target.value) })
              }
            />
          </label>
        )}

        {mappa.tipo === "ziRami" && (
          <label className="campo">
            <span>
              ramo k = <strong>{mappa.k}</strong>
            </span>
            <input
              type="range"
              min={-3}
              max={3}
              step={1}
              value={mappa.k}
              onChange={(e) =>
                dispatch({ tipo: "imposta-k", valore: Number(e.target.value) })
              }
            />
          </label>
        )}
      </section>

      <section className="controlli__gruppo">
        <h4>Dominio</h4>
        <div className="riga-pulsanti">
          <button onClick={() => dispatch({ tipo: "zoom", fattore: 1 / 1.4 })}>
            Zoom +
          </button>
          <button onClick={() => dispatch({ tipo: "zoom", fattore: 1.4 })}>
            Zoom −
          </button>
          <button onClick={() => dispatch({ tipo: "reset-dominio" })}>Reset</button>
        </div>
        <div className="campi-dominio">
          <CampoNumerico
            etichetta="semilato"
            valore={(stato.dominio.xMax - stato.dominio.xMin) / 2}
            onChange={(v) => {
              const r = Math.max(0.05, Math.min(400, v));
              const cx = (stato.dominio.xMin + stato.dominio.xMax) / 2;
              const cy = (stato.dominio.yMin + stato.dominio.yMax) / 2;
              dispatch({
                tipo: "imposta-dominio",
                valore: { xMin: cx - r, xMax: cx + r, yMin: cy - r, yMax: cy + r },
              });
            }}
          />
          <label className="campo campo--inline">
            <input
              type="checkbox"
              checked={stato.stessaScala}
              onChange={(e) =>
                dispatch({ tipo: "imposta-stessa-scala", valore: e.target.checked })
              }
            />
            <span title="Usa per il piano immagine la stessa finestra del dominio">
              stessa scala nei due piani
            </span>
          </label>
        </div>
        <p className="nota">
          Rotella del mouse sul piano del dominio: zoom centrato sul puntatore.
        </p>
      </section>

      <section className="controlli__gruppo">
        <h4>Punto z</h4>
        <div className="campi-punto">
          <CampoNumerico
            etichetta="Re z"
            valore={stato.z.re}
            passo={0.01}
            onChange={(v) => dispatch({ tipo: "imposta-z", valore: c(v, stato.z.im) })}
          />
          <CampoNumerico
            etichetta="Im z"
            valore={stato.z.im}
            passo={0.01}
            onChange={(v) => dispatch({ tipo: "imposta-z", valore: c(stato.z.re, v) })}
          />
        </div>
        <label className="campo">
          <span>
            cifre decimali: <strong>{stato.precisione}</strong>
          </span>
          <input
            type="range"
            min={2}
            max={12}
            step={1}
            value={stato.precisione}
            onChange={(e) =>
              dispatch({ tipo: "imposta-precisione", valore: Number(e.target.value) })
            }
          />
        </label>
      </section>

      <section className="controlli__gruppo">
        <h4>Resa grafica</h4>
        <label className="campo">
          <span>
            densità griglie: <strong>{stato.densita}</strong>
          </span>
          <input
            type="range"
            min={3}
            max={30}
            step={1}
            value={stato.densita}
            onChange={(e) =>
              dispatch({ tipo: "imposta-densita", valore: Number(e.target.value) })
            }
          />
        </label>
        <label className="campo">
          <span>
            intensità bande: <strong>{stato.intensitaBande.toFixed(2)}</strong>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={stato.intensitaBande}
            onChange={(e) =>
              dispatch({ tipo: "imposta-intensita", valore: Number(e.target.value) })
            }
          />
        </label>
        <div className="segmentato segmentato--piccolo" role="radiogroup" aria-label="Schema colore">
          <button
            role="radio"
            aria-checked={stato.schemaColore === 0}
            className={stato.schemaColore === 0 ? "attivo" : ""}
            onClick={() => dispatch({ tipo: "imposta-schema", valore: 0 })}
          >
            arcobaleno
          </button>
          <button
            role="radio"
            aria-checked={stato.schemaColore === 1}
            className={stato.schemaColore === 1 ? "attivo" : ""}
            onClick={() => dispatch({ tipo: "imposta-schema", valore: 1 })}
            title="Tinte ridistribuite per migliorare la distinguibilità"
          >
            alta leggibilità
          </button>
        </div>
      </section>

      <section className="controlli__gruppo controlli__gruppo--largo">
        <h4>Che cosa mostrare</h4>
        <div className="interruttori">
          {ETICHETTE_INTERRUTTORI.map(([chiave, etichetta, descrizione]) => (
            <label key={chiave} className="interruttore" title={descrizione}>
              <input
                type="checkbox"
                checked={stato.mostra[chiave]}
                onChange={() => dispatch({ tipo: "commuta", chiave })}
              />
              <span>{etichetta}</span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

function CampoNumerico({
  etichetta,
  valore,
  onChange,
  passo = 0.1,
}: {
  etichetta: string;
  valore: number;
  onChange: (v: number) => void;
  passo?: number;
}) {
  return (
    <label className="campo campo--numerico">
      <span>{etichetta}</span>
      <input
        type="number"
        value={Number.isFinite(valore) ? Number(valore.toFixed(6)) : 0}
        step={passo}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
      />
    </label>
  );
}
