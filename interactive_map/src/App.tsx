/**
 * Composizione dell'applicazione.
 *
 * Qui si incontrano le tre parti: lo stato (`state/store`), la matematica
 * (`math/*`) e la resa (`components/*`, `render/*`). Questo file non contiene
 * formule: si limita a derivare dallo stato le curve, i punti e i parametri
 * dello shader, e a distribuirli ai due piani e ai pannelli.
 */

import { useMemo } from "react";

import { Controls } from "./components/Controls";
import { PlaneView, type CerchioGuida, type PuntoDisegnato } from "./components/PlaneView";
import { PointPanel } from "./components/PointPanel";
import {
  PhaseLegend,
  PreimagePanel,
  PresetsPanel,
  TrajectoryPanel,
  preimmaginiZi,
} from "./components/SidePanels";
import { SurfacePanel } from "./components/SurfacePanel";
import { abs, c, type Complex } from "./math/complex";
import {
  E_MENO_PI,
  E_PI,
  aliasingRadius,
  computeNthRoots,
  mapZPower,
  mapZiBranch,
  mappaCorrente,
  ziFiber,
} from "./math/complexMaps";
import {
  COLORI,
  PUNTI_CAMPIONE,
  TRAIETTORIE,
  curvaTraiettoria,
  grigliaCartesiana,
  grigliaPolare,
  immagineFamiglia,
  type Curva,
} from "./math/curves";
import { dominioImmagine } from "./math/framing";
import { useDispatch, useStato, type Tab } from "./state/store";
import type { ParametriShader } from "./render/shader";

const TAB: Array<[Tab, string]> = [
  ["casi", "Casi guidati"],
  ["fase", "Ritratto di fase"],
  ["modulo", "Modulo"],
  ["argomento", "Argomento"],
  ["traiettorie", "Traiettorie"],
  ["preimmagini", "Preimmagini"],
];

export function App() {
  const stato = useStato();
  const dispatch = useDispatch();
  const { mappa, dominio, mostra, densita, z, w } = stato;

  const f = useMemo(() => mappaCorrente(mappa), [mappa]);

  // --- Inquadratura del piano immagine -----------------------------------
  const rectImmagine = useMemo(
    () => dominioImmagine(dominio, f, stato.stessaScala),
    [dominio, f, stato.stessaScala]
  );

  // --- Famiglie di curve nel dominio -------------------------------------
  const curveDominio = useMemo(() => {
    const raggioMax = Math.max(
      abs(c(dominio.xMin, dominio.yMin)),
      abs(c(dominio.xMax, dominio.yMax))
    );
    const curve: Curva[] = [];
    if (mostra.polare) {
      // Il raggio minimo tiene conto dell'aliasing di fase di z^i: sotto quella
      // soglia il campionamento non reggerebbe la variazione 1/r.
      const rMin = Math.max(aliasingRadius((dominio.xMax - dominio.xMin) / 600), 1e-3);
      curve.push(
        ...grigliaPolare(raggioMax, Math.max(3, Math.round(densita / 2)), densita, rMin)
      );
    }
    if (mostra.cartesiana) curve.push(...grigliaCartesiana(dominio, densita));
    return curve;
  }, [dominio, densita, mostra.polare, mostra.cartesiana]);

  const curvaGamma = useMemo(() => {
    if (stato.tab !== "traiettorie" && !stato.traiettoria.inRiproduzione) return null;
    const def = TRAIETTORIE.find((t) => t.id === stato.traiettoria.id);
    if (!def) return null;
    return curvaTraiettoria(def, stato.traiettoria.parametro);
  }, [stato.tab, stato.traiettoria]);

  const curveDominioComplete = useMemo(
    () => (curvaGamma ? [...curveDominio, curvaGamma] : curveDominio),
    [curveDominio, curvaGamma]
  );

  const curveImmagine = useMemo(
    () => (mostra.curveImmagine ? immagineFamiglia(curveDominioComplete, f) : []),
    [curveDominioComplete, f, mostra.curveImmagine]
  );

  // --- Punti nel piano del dominio ---------------------------------------
  const puntiDominio = useMemo(() => {
    const punti: PuntoDisegnato[] = [];

    if (mostra.puntiCampione) {
      for (const p of PUNTI_CAMPIONE) {
        punti.push({
          z: p.z,
          etichetta: p.etichetta,
          colore: "rgba(200,212,230,0.85)",
          raggio: 3.4,
          titolo: p.nota,
        });
      }
    }

    // Fibra: gli altri punti con la stessa immagine.
    if (mostra.tracce) {
      if (mappa.tipo === "potenza") {
        const radici = computeNthRoots(mapZPower(z, mappa.n), mappa.n);
        for (const r of radici) {
          punti.push({ z: r, colore: COLORI.cartesiana, raggio: 4.4, titolo: "stessa immagine di z" });
        }
      } else {
        for (const p of ziFiber(z, [-2, -1, 1, 2])) {
          punti.push({ z: p, colore: COLORI.cartesiana, raggio: 4.4, titolo: "stessa immagine di z" });
        }
      }
    }

    // Preimmagini del punto w selezionato nel piano immagine.
    if (stato.tab === "preimmagini") {
      const pre =
        mappa.tipo === "potenza" ? computeNthRoots(w, mappa.n) : preimmaginiZi(w);
      pre.forEach((p, idx) => {
        punti.push({
          z: p,
          colore: COLORI.immagine,
          raggio: 5,
          etichetta: idx === 0 ? "preimmagini di w" : undefined,
          titolo: "preimmagine di w",
        });
      });
    }

    if (curvaGamma) {
      const def = TRAIETTORIE.find((t) => t.id === stato.traiettoria.id);
      if (def) {
        punti.push({
          z: def.gamma(stato.traiettoria.t, stato.traiettoria.parametro),
          colore: COLORI.traiettoria,
          raggio: 5.5,
          etichetta: "γ(t)",
        });
      }
    }

    punti.push({ z, colore: COLORI.bordo, evidenziato: true, etichetta: "z", titolo: "punto selezionato" });
    return punti;
  }, [mostra.puntiCampione, mostra.tracce, mappa, z, w, stato.tab, curvaGamma, stato.traiettoria]);

  // --- Punti nel piano immagine -------------------------------------------
  const puntiImmagine = useMemo(() => {
    const punti: PuntoDisegnato[] = [];

    if (mostra.puntiCampione) {
      // Niente etichette qui: sotto z^i le immagini dei punti campione si
      // addensano in una corona di rapporto 535 e i nomi diventerebbero un
      // grumo. Il nome resta nel tooltip, la corrispondenza nella posizione.
      for (const p of PUNTI_CAMPIONE) {
        punti.push({
          z: f(p.z),
          colore: "rgba(200,212,230,0.7)",
          raggio: 3,
          titolo: `f(${p.etichetta})`,
        });
      }
    }

    // I rami multivalore di z^i: tutti allineati sulla stessa semiretta.
    if (mostra.radici && mappa.tipo !== "potenza") {
      for (const k of stato.ramiVisibili) {
        if (k === 0) continue;
        punti.push({
          z: mapZiBranch(z, k),
          colore: COLORI.raggio,
          raggio: 4.6,
          etichetta: `k=${k}`,
          titolo: `ramo k = ${k}: fattore e^(−2π·${k})`,
        });
      }
    }

    if (curvaGamma) {
      const def = TRAIETTORIE.find((t) => t.id === stato.traiettoria.id);
      if (def) {
        punti.push({
          z: f(def.gamma(stato.traiettoria.t, stato.traiettoria.parametro)),
          colore: COLORI.traiettoria,
          raggio: 5.5,
          etichetta: "f(γ(t))",
        });
      }
    }

    if (stato.tab === "preimmagini") {
      punti.push({ z: w, colore: COLORI.immagine, evidenziato: true, etichetta: "w" });
    }

    punti.push({ z: f(z), colore: COLORI.bordo, evidenziato: true, etichetta: "f(z)" });
    return punti;
  }, [mostra.puntiCampione, mostra.radici, mappa, z, w, f, stato.ramiVisibili, stato.tab, curvaGamma, stato.traiettoria]);

  // --- Cerchi guida --------------------------------------------------------
  const cerchiImmagine: CerchioGuida[] = useMemo(() => {
    if (mappa.tipo === "potenza") return [];
    return [
      { r: E_MENO_PI, colore: COLORI.cerchio, tratteggiato: true, etichetta: "e^(−π)" },
      { r: E_PI, colore: COLORI.raggio, tratteggiato: true, etichetta: "e^(π)" },
    ];
  }, [mappa.tipo]);

  // --- Parametri dello shader ---------------------------------------------
  const rMinAliasing = Math.max(
    aliasingRadius((dominio.xMax - dominio.xMin) / 900),
    0
  );

  const shaderDominio: ParametriShader | null = mostra.ritrattoFase
    ? {
        dominio,
        modo: mappa.tipo === "potenza" ? 0 : 1,
        n: mappa.n,
        k: mappa.tipo === "ziRami" ? mappa.k : 0,
        rMin: rMinAliasing,
        contornoModulo: mostra.contornoModulo,
        contornoFase: mostra.contornoFase,
        mostraTaglio: mostra.taglio && mappa.tipo !== "potenza",
        schema: stato.schemaColore,
        intensita: stato.intensitaBande,
      }
    : null;

  const shaderImmagine: ParametriShader | null = mostra.ritrattoFase
    ? {
        dominio: rectImmagine,
        modo: 2, // identità: il piano immagine fa da riferimento cromatico
        n: 1,
        k: 0,
        rMin: 0,
        contornoModulo: mostra.contornoModulo,
        contornoFase: mostra.contornoFase,
        mostraTaglio: false,
        schema: stato.schemaColore,
        intensita: stato.intensitaBande,
      }
    : null;

  const avvisoDominio =
    mappa.tipo !== "potenza" && dominio.xMax - dominio.xMin > 100
      ? "Dominio molto ampio: la fase di z^i compie moltissimi giri e il ritratto appare a bande fittissime. È il comportamento corretto, non un artefatto."
      : null;

  return (
    <div className="app">
      <header className="intestazione">
        <div>
          <h1>
            Mappe complesse: z<sup>n</sup> e z<sup>i</sup>
          </h1>
          <p>
            Esplorazione interattiva della potenza intera e della potenza a
            esponente immaginario, con ramo principale, taglio di ramo e
            multivalenza trattati esplicitamente.
          </p>
        </div>
      </header>

      <Controls />

      <main className="corpo">
        <section className="piani">
          <PlaneView
            titolo="Piano del dominio — z"
            sottotitolo="clic o trascinamento per scegliere z; rotella per lo zoom"
            rect={dominio}
            parametriShader={shaderDominio}
            curve={curveDominioComplete}
            punti={puntiDominio}
            mostraTaglio={mostra.taglio && mappa.tipo !== "potenza"}
            onPunto={(p) => dispatch({ tipo: "imposta-z", valore: p })}
            onZoom={(fattore, centro) => dispatch({ tipo: "zoom", fattore, centro })}
            avviso={avvisoDominio}
          />
          <PlaneView
            titolo="Piano immagine — w = f(z)"
            sottotitolo={
              stato.stessaScala
                ? "stessa scala del dominio"
                : `semilato ${(rectImmagine.xMax).toPrecision(3)} — scala adattata`
            }
            rect={rectImmagine}
            parametriShader={shaderImmagine}
            curve={curveImmagine}
            punti={puntiImmagine}
            cerchiGuida={cerchiImmagine}
            onPunto={
              stato.tab === "preimmagini"
                ? (p: Complex) => dispatch({ tipo: "imposta-w", valore: p })
                : undefined
            }
          />
        </section>

        <aside className="colonna-destra">
          <PointPanel />
        </aside>
      </main>

      <section className="pannelli">
        <nav className="tab" role="tablist">
          {TAB.map(([chiave, etichetta]) => (
            <button
              key={chiave}
              role="tab"
              aria-selected={stato.tab === chiave}
              className={stato.tab === chiave ? "attivo" : ""}
              onClick={() => dispatch({ tipo: "imposta-tab", valore: chiave })}
            >
              {etichetta}
            </button>
          ))}
        </nav>

        <div className="tab__contenuto" role="tabpanel">
          {stato.tab === "casi" && <PresetsPanel />}
          {stato.tab === "fase" && <PhaseLegend />}
          {stato.tab === "modulo" && <SurfacePanel grandezza="modulo" />}
          {stato.tab === "argomento" && <SurfacePanel grandezza="argomento" />}
          {stato.tab === "traiettorie" && <TrajectoryPanel />}
          {stato.tab === "preimmagini" && <PreimagePanel />}
        </div>
      </section>

      <footer className="pie">
        Convenzioni: Arg z ∈ (−π, π]; Log z = ln|z| + i·Arg z, olomorfo su
        ℂ∖(−∞,0]; z<sup>i</sup> = exp(i·Log z) salvo indicazione del ramo k.
      </footer>
    </div>
  );
}
