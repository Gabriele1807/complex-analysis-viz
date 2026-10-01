/**
 * I pannelli secondari: legenda del ritratto di fase, traiettorie,
 * preimmagini e casi guidati.
 */

import { useEffect, useMemo, useRef } from "react";

import {
  abs,
  argPrincipal,
  c,
  formatComplex,
  formatNumber,
  fromPolar,
  DUE_PI,
  PI,
  type Complex,
} from "../math/complex";
import {
  E_MENO_PI,
  E_PI,
  computeNthRoots,
  mapZPower,
  mapZiPrincipal,
  mappaCorrente,
} from "../math/complexMaps";
import { TRAIETTORIE } from "../math/curves";
import { CASI_GUIDATI, VALORI_NOTEVOLI } from "../math/presets";
import { useDispatch, useStato } from "../state/store";

// ---------------------------------------------------------------------------
// Legenda del ritratto di fase
// ---------------------------------------------------------------------------

export function PhaseLegend() {
  const stato = useStato();
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const lato = 180;
    el.width = lato;
    el.height = lato;
    const img = ctx.createImageData(lato, lato);
    const raggio = lato / 2 - 2;

    for (let y = 0; y < lato; y += 1) {
      for (let x = 0; x < lato; x += 1) {
        const dx = x - lato / 2;
        const dy = lato / 2 - y;
        const r = Math.hypot(dx, dy);
        const idx = (y * lato + x) * 4;
        if (r > raggio) {
          img.data[idx + 3] = 0;
          continue;
        }
        const a = Math.atan2(dy, dx);
        let h = (a + PI) / DUE_PI;
        if (stato.schemaColore === 1) {
          h = h + 0.06 * Math.sin(DUE_PI * h) - 0.03 * Math.sin(2 * DUE_PI * h);
        }
        const m = (r / raggio) * 4;
        let l = 0.52;
        if (stato.mostra.contornoModulo && m > 0) {
          const banda = ((Math.log2(m) % 1) + 1) % 1;
          l += stato.intensitaBande * 0.26 * (banda - 0.5);
        }
        const [rr, gg, bb] = hslToRgb(((h % 1) + 1) % 1, 0.88, Math.min(Math.max(l, 0.06), 0.95));
        img.data[idx] = rr;
        img.data[idx + 1] = gg;
        img.data[idx + 2] = bb;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [stato.schemaColore, stato.mostra.contornoModulo, stato.intensitaBande]);

  return (
    <div className="pannello-legenda">
      <h4>Come leggere il colore</h4>
      <div className="legenda-contenuto">
        <canvas ref={canvas} className="ruota-colori" aria-label="ruota dei colori" />
        <ul className="elenco-nota">
          <li>
            <strong>Tinta</strong>: l'argomento di f(z). Rosso = 0, verde-ciano ≈
            +2π/3, blu-viola ≈ −2π/3. Un giro completo di tinte attorno a un punto
            significa che lì f ha uno zero o un polo.
          </li>
          <li>
            <strong>Bande chiaro/scuro</strong>: curve di livello del modulo, in
            progressione geometrica di ragione 2. Bande fitte = modulo che varia
            in fretta.
          </li>
          <li>
            <strong>Settori di fase</strong> (opzionali): dodici spicchi da π/6.
            Insieme alle bande del modulo formano una griglia conforme:
            dove i due reticoli si incontrano ad angolo retto, la mappa è conforme.
          </li>
          <li>
            <strong>Grigio tratteggiato</strong>: regione esclusa vicino
            all'origine per z<sup>i</sup>. Non è una singolarità del modulo — che
            resta in [e<sup>−π</sup>, e<sup>π</sup>) — ma una zona in cui la fase
            ln|z| varia come 1/r e risulta sotto-campionata.
          </li>
          <li>
            <strong>Riga rossa</strong>: il taglio di ramo (−∞, 0].
          </li>
        </ul>
      </div>

      <h4>Valori notevoli</h4>
      <table className="tabella-valori">
        <tbody>
          {VALORI_NOTEVOLI.map((v) => (
            <tr key={v.simbolo}>
              <th scope="row">{v.simbolo}</th>
              <td>
                {formatNumber(v.valore, 7)}
                <span className="secondario"> — {v.nota}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

// ---------------------------------------------------------------------------
// Traiettorie
// ---------------------------------------------------------------------------

export function TrajectoryPanel() {
  const stato = useStato();
  const dispatch = useDispatch();
  const def = TRAIETTORIE.find((t) => t.id === stato.traiettoria.id) ?? TRAIETTORIE[0];

  // Riproduzione: avanza t in un ciclo di animazione, non con setInterval,
  // così resta sincronizzata col refresh dello schermo e si ferma quando la
  // scheda non è visibile.
  const richiesta = useRef<number | null>(null);
  useEffect(() => {
    if (!stato.traiettoria.inRiproduzione) return;
    let precedente = performance.now();
    const passo = (ora: number) => {
      const dt = (ora - precedente) / 1000;
      precedente = ora;
      dispatch({
        tipo: "imposta-traiettoria",
        t: (stato.traiettoria.t + dt * 0.12) % 1,
      });
      richiesta.current = requestAnimationFrame(passo);
    };
    richiesta.current = requestAnimationFrame(passo);
    return () => {
      if (richiesta.current !== null) cancelAnimationFrame(richiesta.current);
    };
  }, [stato.traiettoria.inRiproduzione, stato.traiettoria.t, dispatch]);

  const gamma = def.gamma(stato.traiettoria.t, stato.traiettoria.parametro);
  const f = mappaCorrente(stato.mappa);
  const immagine = f(gamma);

  const giri = useMemo(() => {
    // Conteggio degli avvolgimenti dell'immagine attorno all'origine,
    // ottenuto sommando gli incrementi di argomento lungo la curva.
    const n = 1200;
    let totale = 0;
    let precedenteArg = NaN;
    for (let j = 0; j <= n; j += 1) {
      const p = f(def.gamma(j / n, stato.traiettoria.parametro));
      const a = argPrincipal(p);
      if (Number.isFinite(a) && Number.isFinite(precedenteArg)) {
        let d = a - precedenteArg;
        while (d > PI) d -= DUE_PI;
        while (d < -PI) d += DUE_PI;
        totale += d;
      }
      precedenteArg = a;
    }
    return totale / DUE_PI;
  }, [def, stato.traiettoria.parametro, stato.mappa]);

  return (
    <div className="pannello-traiettorie">
      <h4>Traiettoria γ(t)</h4>
      <div className="griglia-pulsanti">
        {TRAIETTORIE.map((t) => (
          <button
            key={t.id}
            className={t.id === def.id ? "attivo" : ""}
            onClick={() =>
              dispatch({
                tipo: "imposta-traiettoria",
                id: t.id,
                parametro: t.parametro.default,
              })
            }
          >
            {t.nome}
          </button>
        ))}
      </div>

      <p className="nota">{def.descrizione}</p>

      <label className="campo">
        <span>
          {def.parametro.nome}: <strong>{stato.traiettoria.parametro.toFixed(3)}</strong>
        </span>
        <input
          type="range"
          min={def.parametro.min}
          max={def.parametro.max}
          step={(def.parametro.max - def.parametro.min) / 200}
          value={stato.traiettoria.parametro}
          onChange={(e) =>
            dispatch({ tipo: "imposta-traiettoria", parametro: Number(e.target.value) })
          }
        />
      </label>

      <label className="campo">
        <span>
          t = <strong>{stato.traiettoria.t.toFixed(3)}</strong>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={stato.traiettoria.t}
          onChange={(e) =>
            dispatch({ tipo: "imposta-traiettoria", t: Number(e.target.value) })
          }
        />
      </label>

      <div className="riga-pulsanti">
        <button onClick={() => dispatch({ tipo: "commuta-riproduzione" })}>
          {stato.traiettoria.inRiproduzione ? "Pausa" : "Anima"}
        </button>
        <button onClick={() => dispatch({ tipo: "imposta-z", valore: gamma })}>
          Porta z su γ(t)
        </button>
      </div>

      <table className="tabella-valori">
        <tbody>
          <tr>
            <th scope="row">γ(t)</th>
            <td>{formatComplex(gamma, stato.precisione)}</td>
          </tr>
          <tr>
            <th scope="row">f(γ(t))</th>
            <td>{formatComplex(immagine, stato.precisione)}</td>
          </tr>
          <tr>
            <th scope="row">|f(γ(t))|</th>
            <td>{formatNumber(abs(immagine), stato.precisione)}</td>
          </tr>
          <tr>
            <th scope="row">avvolgimenti</th>
            <td>
              {formatNumber(giri, 3)}
              <span className="secondario">
                {" "}
                — giri dell'immagine attorno all'origine lungo tutta la curva
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preimmagini
// ---------------------------------------------------------------------------

export function PreimagePanel() {
  const stato = useStato();
  const dispatch = useDispatch();
  const { w, mappa, precisione } = stato;

  const preimmagini: Complex[] =
    mappa.tipo === "potenza" ? computeNthRoots(w, mappa.n) : preimmaginiZi(w);

  const esatte = mappa.tipo === "potenza";

  return (
    <div className="pannello-preimmagini">
      <h4>Preimmagini di un punto w</h4>
      <p className="nota">
        Scegli w nel piano immagine (clic sul pannello di destra) e osserva le
        sue preimmagini apparire nel piano del dominio.
      </p>

      <div className="campi-punto">
        <label className="campo campo--numerico">
          <span>Re w</span>
          <input
            type="number"
            step={0.05}
            value={Number(w.re.toFixed(6))}
            onChange={(e) =>
              dispatch({ tipo: "imposta-w", valore: c(Number(e.target.value), w.im) })
            }
          />
        </label>
        <label className="campo campo--numerico">
          <span>Im w</span>
          <input
            type="number"
            step={0.05}
            value={Number(w.im.toFixed(6))}
            onChange={(e) =>
              dispatch({ tipo: "imposta-w", valore: c(w.re, Number(e.target.value)) })
            }
          />
        </label>
      </div>

      {esatte ? (
        <p className="nota">
          Sotto z<sup>{mappa.n}</sup> ogni w ≠ 0 ha esattamente {mappa.n}{" "}
          preimmagini: i vertici di un {mappa.n}-agono regolare di raggio |w|
          <sup>1/{mappa.n}</sup> = {formatNumber(Math.pow(abs(w), 1 / mappa.n), precisione)}.
        </p>
      ) : (
        <p className="nota">
          Sotto z<sup>i</sup> le preimmagini esistono solo se{" "}
          e<sup>−π</sup> ≤ |w| &lt; e<sup>π</sup>, cioè{" "}
          {formatNumber(E_MENO_PI, 4)} ≤ |w| &lt; {formatNumber(E_PI, 4)}. In tal
          caso sono <strong>infinite numerabili</strong>: Arg z = −ln|w| è
          determinato, mentre ln|z| ≡ Arg w (mod 2π) lascia la famiglia
          z<sub>m</sub> = e<sup>Arg w + 2πm</sup>·e<sup>−i ln|w|</sup>. Qui sotto
          i cinque rami centrali.
        </p>
      )}

      {preimmagini.length === 0 ? (
        <p className="nota nota--allerta">
          |w| = {formatNumber(abs(w), precisione)} è fuori dalla corona immagine:
          nessuna preimmagine.
        </p>
      ) : (
        <ol className="elenco-valori">
          {preimmagini.map((p, idx) => (
            <li key={idx}>
              <span className="indice">{esatte ? `z${idx}` : `m = ${idx - 2}`}</span>
              <span className="valore">{formatComplex(p, precisione)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * Le preimmagini di `w` sotto il ramo principale di `z^i`.
 *
 * Da `w = e^{-θ}e^{i ln r}` si ricava `θ = -ln|w|` e `ln r = Arg w + 2πm`,
 * cioè `r = e^{Arg w + 2πm}`. La preimmagine esiste solo se il `θ` così
 * ottenuto cade in `(-π, π]`, cioè se `e^{-π} ≤ |w| < e^{π}`.
 */
export function preimmaginiZi(w: Complex, mRange = [-2, -1, 0, 1, 2]): Complex[] {
  const m = abs(w);
  if (!(m > 0) || !Number.isFinite(m)) return [];
  const theta = -Math.log(m);
  if (!(theta > -PI && theta <= PI)) return [];
  const argW = argPrincipal(w);
  return mRange.map((k) => fromPolar(Math.exp(argW + DUE_PI * k), theta));
}

// ---------------------------------------------------------------------------
// Casi guidati
// ---------------------------------------------------------------------------

export function PresetsPanel() {
  const stato = useStato();
  const dispatch = useDispatch();
  const attivo = CASI_GUIDATI.find((k) => k.spiegazione === stato.notaCasoGuidato);

  return (
    <div className="pannello-casi">
      <h4>Casi speciali guidati</h4>
      <p className="nota">
        Ogni pulsante imposta mappa, punto, dominio e visualizzazioni, e spiega
        che cosa stai guardando.
      </p>
      <div className="griglia-casi">
        {CASI_GUIDATI.map((caso) => (
          <button
            key={caso.id}
            className={attivo?.id === caso.id ? "caso attivo" : "caso"}
            onClick={() =>
              dispatch({
                tipo: "applica-preset",
                preset: { ...caso.stato, notaCasoGuidato: caso.spiegazione },
              })
            }
          >
            <strong>{caso.titolo}</strong>
            <span>{caso.sommario}</span>
          </button>
        ))}
      </div>

      {stato.notaCasoGuidato && (
        <div className="spiegazione">
          {stato.notaCasoGuidato.split("\n\n").map((paragrafo, idx) => (
            <p key={idx}>{paragrafo}</p>
          ))}
        </div>
      )}

      <h4>Verifica numerica immediata</h4>
      <table className="tabella-valori">
        <tbody>
          <tr>
            <th scope="row">i^i</th>
            <td>{formatNumber(mapZiPrincipal(c(0, 1)).re, 12)}</td>
          </tr>
          <tr>
            <th scope="row">(−1)^i</th>
            <td>{formatNumber(mapZiPrincipal(c(-1, 0)).re, 12)}</td>
          </tr>
          <tr>
            <th scope="row">1^i</th>
            <td>{formatComplex(mapZiPrincipal(c(1, 0)), 12)}</td>
          </tr>
          <tr>
            <th scope="row">(e^2π)^i</th>
            <td>{formatComplex(mapZiPrincipal(c(Math.exp(DUE_PI), 0)), 12)}</td>
          </tr>
          <tr>
            <th scope="row">
              z<sup>{stato.mappa.n}</sup> in z
            </th>
            <td>{formatComplex(mapZPower(stato.z, stato.mappa.n), stato.precisione)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
