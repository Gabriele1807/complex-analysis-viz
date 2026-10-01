/**
 * Pannello matematico del punto selezionato.
 *
 * Mostra z, f(z), moduli e argomenti (radianti e gradi), la formula simbolica
 * della mappa corrente, le n radici n-esime con l'indicazione di quale sia la
 * preimmagine selezionata, i rami k = −2…2 di z^i, e gli avvisi matematici.
 */

import {
  abs,
  argPrincipal,
  formatComplex,
  formatNumber,
  toDegrees,
  type Complex,
} from "../math/complex";
import {
  avvisi,
  computeNthRoots,
  descrizioneMappa,
  formulaMappa,
  indiceRadiceSelezionata,
  injectivityAnnulus,
  mapZPower,
  mapZiBranch,
  mapZiPrincipal,
  mappaCorrente,
  nearBranchCut,
  ziFiber,
} from "../math/complexMaps";
import { useStato } from "../state/store";

const RAMI = [-2, -1, 0, 1, 2];

export function PointPanel() {
  const stato = useStato();
  const { z, mappa, precisione } = stato;
  const f = mappaCorrente(mappa);
  const w = f(z);

  const rz = abs(z);
  const az = argPrincipal(z);
  const rw = abs(w);
  const aw = argPrincipal(w);

  const messaggi = avvisi(z, mappa);

  return (
    <div className="pannello-punto">
      <h3>Punto selezionato</h3>

      <div className="formula-corrente" title={descrizioneMappa(mappa)}>
        {formulaMappa(mappa)}
      </div>

      <table className="tabella-valori">
        <tbody>
          <tr>
            <th scope="row">z</th>
            <td>{formatComplex(z, precisione)}</td>
          </tr>
          <tr>
            <th scope="row">|z|</th>
            <td>{formatNumber(rz, precisione)}</td>
          </tr>
          <tr>
            <th scope="row">Arg z</th>
            <td>
              {formatNumber(az, precisione)} rad
              <span className="secondario"> = {formatNumber(toDegrees(az), 2)}°</span>
            </td>
          </tr>
          <tr className="separatore">
            <th scope="row">f(z)</th>
            <td>{formatComplex(w, precisione)}</td>
          </tr>
          <tr>
            <th scope="row">|f(z)|</th>
            <td>{formatNumber(rw, precisione)}</td>
          </tr>
          <tr>
            <th scope="row">Arg f(z)</th>
            <td>
              {formatNumber(aw, precisione)} rad
              <span className="secondario"> = {formatNumber(toDegrees(aw), 2)}°</span>
            </td>
          </tr>
        </tbody>
      </table>

      {mappa.tipo === "potenza" ? (
        <SezioneRadici z={z} n={mappa.n} precisione={precisione} />
      ) : (
        <SezioneRami z={z} precisione={precisione} />
      )}

      {messaggi.length > 0 && (
        <div className="avvisi">
          {messaggi.map((m, idx) => (
            <p key={idx} className="avviso">
              {m}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function SezioneRadici({
  z,
  n,
  precisione,
}: {
  z: Complex;
  n: number;
  precisione: number;
}) {
  const w = mapZPower(z, n);
  const radici = computeNthRoots(w, n);
  const selezionata = indiceRadiceSelezionata(z, n);

  return (
    <section className="sezione">
      <h4>
        Le {n} radici {n}-esime di f(z)
      </h4>
      <p className="nota">
        Sono le preimmagini di f(z) sotto z<sup>{n}</sup>: i vertici di un{" "}
        {n}-agono regolare di raggio |f(z)|<sup>1/{n}</sup> ={" "}
        {formatNumber(Math.pow(abs(w), 1 / n), precisione)}.
      </p>
      <ol className="elenco-valori">
        {radici.map((r, k) => (
          <li key={k} className={k === selezionata ? "evidenziato" : ""}>
            <span className="indice">z<sub>{k}</sub></span>
            <span className="valore">{formatComplex(r, precisione)}</span>
            {k === selezionata && <span className="badge">punto selezionato</span>}
          </li>
        ))}
      </ol>
      {selezionata < 0 && (
        <p className="nota">
          Il punto selezionato non coincide con nessuna radice: accade solo in
          z = 0, dove l'unica preimmagine ha molteplicità {n}.
        </p>
      )}
    </section>
  );
}

function SezioneRami({ z, precisione }: { z: Complex; precisione: number }) {
  const corona = injectivityAnnulus(z);
  const sulTaglio = nearBranchCut(z, 1e-2);
  const fibra = ziFiber(z, [-1, 0, 1]);

  return (
    <section className="sezione">
      <h4>
        I rami di z<sup>i</sup>
      </h4>
      <p className="nota">
        z<sup>i</sup><sub>k</sub> = z<sup>i</sup> · e<sup>−2πk</sup>: il fattore è
        reale positivo, quindi tutti i rami giacciono sulla stessa semiretta
        uscente dall'origine, in progressione geometrica di ragione e<sup>−2π</sup>.
      </p>
      <ol className="elenco-valori">
        {RAMI.map((k) => {
          const v = mapZiBranch(z, k);
          return (
            <li key={k} className={k === 0 ? "evidenziato" : ""}>
              <span className="indice">k = {k}</span>
              <span className="valore">{formatComplex(v, precisione)}</span>
              {k === 0 && <span className="badge">principale</span>}
            </li>
          );
        })}
      </ol>

      <h4>Iniettività</h4>
      <p className="nota">
        Il ramo principale <strong>non</strong> è iniettivo sul piano tagliato:
        la fibra di z è {"{"}z·e<sup>2πm</sup>{"}"}. Qui{" "}
        {fibra
          .map((p) => formatComplex(p, Math.min(precisione, 3)))
          .join("  ·  ")}{" "}
        hanno tutti immagine {formatComplex(mapZiPrincipal(z), precisione)}.
      </p>
      <p className="nota">
        È iniettivo sulla corona {formatNumber(corona.rMin, 4)} &lt; |z| &lt;{" "}
        {formatNumber(corona.rMax, 4)}, di ampiezza 2π in ln|z|, intersecata col
        piano tagliato.
      </p>
      {sulTaglio && (
        <p className="nota nota--allerta">
          Il punto è sul taglio di ramo: qui Arg z = +π per convenzione, e il
          modulo dell'immagine è il minimo possibile e<sup>−π</sup> ≈ 0,0432.
        </p>
      )}
    </section>
  );
}
