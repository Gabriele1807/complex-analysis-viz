/**
 * Un piano complesso interattivo: ritratto di fase in WebGL più sovrapposizione
 * vettoriale in SVG.
 *
 * La divisione dei compiti è deliberata:
 *
 * - il **canvas WebGL** disegna il campo continuo (colore = argomento, bande =
 *   modulo), dove serve un valore per pixel;
 * - l'**overlay SVG** disegna gli oggetti discreti (assi, griglie, curve,
 *   punti, etichette), dove servono tratti netti a qualunque zoom, hit-testing
 *   del puntatore e testo leggibile dagli screen reader.
 *
 * Mescolare i due in un solo canvas costringerebbe a reimplementare a mano
 * antialiasing del testo e selezione dei punti.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { type Complex, abs, c } from "../math/complex";
import type { Curva, Rettangolo } from "../math/curves";
import { creaProiezione, passoGriglia, type Proiezione } from "../math/framing";
import { PhaseRenderer, type ParametriShader } from "../render/shader";

export interface PuntoDisegnato {
  z: Complex;
  etichetta?: string;
  colore: string;
  raggio?: number;
  /** Punto principale: viene disegnato più grande e con alone. */
  evidenziato?: boolean;
  titolo?: string;
}

export interface CerchioGuida {
  r: number;
  colore: string;
  tratteggiato?: boolean;
  etichetta?: string;
}

interface Props {
  titolo: string;
  sottotitolo?: string;
  rect: Rettangolo;
  parametriShader: ParametriShader | null;
  curve: Curva[];
  punti: PuntoDisegnato[];
  cerchiGuida?: CerchioGuida[];
  /** Disegna il taglio di ramo come segmento vettoriale in sovrimpressione. */
  mostraTaglio?: boolean;
  /** Abilita click e trascinamento per selezionare un punto. */
  onPunto?: (z: Complex) => void;
  /** Rotella del mouse: zoom centrato sul puntatore. */
  onZoom?: (fattore: number, centro: Complex) => void;
  /** Testo di avvertimento mostrato in sovrimpressione. */
  avviso?: string | null;
}

export function PlaneView({
  titolo,
  sottotitolo,
  rect,
  parametriShader,
  curve,
  punti,
  cerchiGuida = [],
  mostraTaglio = false,
  onPunto,
  onZoom,
  avviso,
}: Props) {
  const contenitore = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const renderer = useRef<PhaseRenderer | null>(null);
  const [dimensione, setDimensione] = useState({ larghezza: 420, altezza: 420 });
  const [erroreGL, setErroreGL] = useState<string | null>(null);
  const trascinamento = useRef(false);

  // --- Dimensionamento reattivo ------------------------------------------
  useLayoutEffect(() => {
    const el = contenitore.current;
    if (!el) return;
    const osservatore = new ResizeObserver((voci) => {
      for (const voce of voci) {
        const { width } = voce.contentRect;
        // Il piano resta quadrato: le due scale coincidono e gli angoli non
        // vengono deformati, condizione necessaria per leggere la conformità.
        const lato = Math.max(200, Math.floor(width));
        setDimensione({ larghezza: lato, altezza: lato });
      }
    });
    osservatore.observe(el);
    return () => osservatore.disconnect();
  }, []);

  // --- Inizializzazione WebGL --------------------------------------------
  useEffect(() => {
    if (!canvas.current) return;
    const r = new PhaseRenderer(canvas.current);
    renderer.current = r;
    if (!r.disponibile) setErroreGL(r.errore);
    return () => {
      r.dispose();
      renderer.current = null;
    };
  }, []);

  // --- Disegno -------------------------------------------------------------
  useEffect(() => {
    const r = renderer.current;
    if (!r || !r.disponibile || !parametriShader) return;
    r.ridimensiona(dimensione.larghezza, dimensione.altezza);
    r.disegna(parametriShader);
  }, [parametriShader, dimensione]);

  const { larghezza, altezza } = dimensione;
  const proiezione = creaProiezione(rect, larghezza, altezza);

  // --- Interazione ---------------------------------------------------------
  const puntoDaEvento = useCallback(
    (e: React.PointerEvent<SVGSVGElement>): Complex => {
      const riquadro = e.currentTarget.getBoundingClientRect();
      return proiezione.aComplesso(
        ((e.clientX - riquadro.left) / riquadro.width) * larghezza,
        ((e.clientY - riquadro.top) / riquadro.height) * altezza
      );
    },
    [proiezione, larghezza, altezza]
  );

  const gestisciGiu = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!onPunto) return;
    trascinamento.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Il browser può rifiutare la cattura (puntatore non attivo, eventi
      // sintetici): il trascinamento continua comunque a funzionare, perde
      // solo la garanzia di ricevere gli eventi fuori dall'elemento.
    }
    onPunto(puntoDaEvento(e));
  };

  const gestisciMuovi = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!onPunto || !trascinamento.current) return;
    onPunto(puntoDaEvento(e));
  };

  const gestisciSu = (e: React.PointerEvent<SVGSVGElement>) => {
    trascinamento.current = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Nulla da rilasciare: la cattura non era stata concessa.
    }
  };

  // Lo zoom con la rotella ha bisogno di un listener nativo NON passivo.
  //
  // React registra `onWheel` sul contenitore radice come listener passivo, e
  // in un listener passivo `preventDefault()` viene ignorato dal browser: il
  // risultato era che la rotella zoomava il piano e *contemporaneamente*
  // faceva scorrere la pagina, rendendo il piano inutilizzabile. L'unico modo
  // di impedire lo scorrimento e' registrare l'ascoltatore a mano con
  // `{ passive: false }`.
  //
  // I valori correnti passano da un ref invece che dalle dipendenze
  // dell'effetto, cosi' l'ascoltatore viene registrato una volta sola e non a
  // ogni ridisegno.
  const datiZoom = useRef({ rect, larghezza, altezza, onZoom });
  datiZoom.current = { rect, larghezza, altezza, onZoom };

  useEffect(() => {
    const el = svg.current;
    if (!el) return;

    const gestisciRotella = (e: WheelEvent) => {
      const { rect: r, larghezza: w, altezza: h, onZoom: zoom } = datiZoom.current;
      if (!zoom) return; // piano non zoomabile: la pagina scorre normalmente
      e.preventDefault();

      const riquadro = el.getBoundingClientRect();
      const centro = creaProiezione(r, w, h).aComplesso(
        ((e.clientX - riquadro.left) / riquadro.width) * w,
        ((e.clientY - riquadro.top) / riquadro.height) * h
      );

      // `deltaMode` cambia l'unita' di misura: 0 = pixel (mouse e trackpad),
      // 1 = righe, 2 = pagine. Normalizzandolo, un trackpad non zooma cento
      // volte piu' di una rotella a scatti.
      const unita = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      // Fattore esponenziale: proporzionale allo scorrimento e simmetrico,
      // cosi' zoom e dezoom della stessa quantita' si annullano esattamente.
      const fattore = Math.exp(e.deltaY * unita * 0.0016);
      zoom(Math.min(Math.max(fattore, 1 / 3), 3), centro);
    };

    el.addEventListener("wheel", gestisciRotella, { passive: false });
    return () => el.removeEventListener("wheel", gestisciRotella);
  }, []);

  // Tastiera: spostamento fine del punto selezionato, per chi non usa il mouse.
  const gestisciTasto = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (!onPunto || punti.length === 0) return;
    const principale = punti.find((p) => p.evidenziato) ?? punti[0];
    const passo = (rect.xMax - rect.xMin) / (e.shiftKey ? 200 : 40);
    const mappa: Record<string, Complex> = {
      ArrowLeft: c(-passo, 0),
      ArrowRight: c(passo, 0),
      ArrowUp: c(0, passo),
      ArrowDown: c(0, -passo),
    };
    const delta = mappa[e.key];
    if (!delta) return;
    e.preventDefault();
    onPunto(c(principale.z.re + delta.re, principale.z.im + delta.im));
  };

  const passo = passoGriglia(rect);

  return (
    <div className="piano" ref={contenitore}>
      <div className="piano__intestazione">
        <h3>{titolo}</h3>
        {sottotitolo && <span className="piano__sottotitolo">{sottotitolo}</span>}
      </div>

      <div className="piano__tela" style={{ width: larghezza, height: altezza }}>
        <canvas
          ref={canvas}
          style={{ width: larghezza, height: altezza }}
          aria-hidden="true"
        />
        {!parametriShader && <div className="piano__sfondo-vuoto" />}

        <svg
          ref={svg}
          width={larghezza}
          height={altezza}
          viewBox={`0 0 ${larghezza} ${altezza}`}
          className={onPunto ? "piano__overlay piano__overlay--interattivo" : "piano__overlay"}
          onPointerDown={gestisciGiu}
          onPointerMove={gestisciMuovi}
          onPointerUp={gestisciSu}
          onPointerCancel={gestisciSu}
          onKeyDown={gestisciTasto}
          tabIndex={onPunto ? 0 : -1}
          role={onPunto ? "application" : "img"}
          aria-label={`${titolo}. ${sottotitolo ?? ""}`}
        >
          <GrigliaSfondo rect={rect} proiezione={proiezione} passo={passo} />

          {cerchiGuida.map((g, idx) => (
            <CerchioGuidaSvg key={idx} guida={g} proiezione={proiezione} />
          ))}

          {mostraTaglio && <TaglioDiRamo rect={rect} proiezione={proiezione} />}

          {curve.map((curva) =>
            curva.segmenti.map((segmento, idx) => {
              const d = percorso(segmento, proiezione);
              if (!d) return null;
              return (
                <g key={`${curva.id}-${idx}`}>
                  {/* Sottotraccia scura: senza di essa le curve si perdono sul
                      ritratto di fase, che è saturo e chiaro ovunque. */}
                  {parametriShader && (
                    <path
                      d={d}
                      fill="none"
                      stroke="rgba(8,10,14,0.55)"
                      strokeWidth={curva.larghezza + 2.2}
                      strokeLinecap="round"
                      strokeDasharray={curva.tratteggiata ? "5 4" : undefined}
                    />
                  )}
                  <path
                    d={d}
                    fill="none"
                    stroke={curva.colore}
                    strokeWidth={curva.larghezza}
                    strokeOpacity={0.95}
                    strokeLinecap="round"
                    strokeDasharray={curva.tratteggiata ? "5 4" : undefined}
                  />
                </g>
              );
            })
          )}

          {nascondiEtichetteSovrapposte(punti, proiezione).map((p, idx) => (
            <PuntoSvg key={idx} punto={p} proiezione={proiezione} />
          ))}
        </svg>

        {avviso && <div className="piano__avviso">{avviso}</div>}
        {erroreGL && (
          <div className="piano__errore">
            {erroreGL} Il ritratto di fase non è disponibile; curve, punti e
            pannelli numerici continuano a funzionare.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sottocomponenti
// ---------------------------------------------------------------------------

/**
 * Elimina le etichette che si accavallerebbero.
 *
 * Nel piano immagine di `z^i` le immagini dei punti campione si addensano
 * vicino all'origine (il modulo è compresso in una corona di rapporto 535) e
 * le etichette diventano un grumo illeggibile. I punti restano disegnati, con
 * il nome disponibile come tooltip: si perde solo la scritta, non il dato.
 */
function nascondiEtichetteSovrapposte(
  punti: PuntoDisegnato[],
  proiezione: Proiezione,
  distanzaMinima = 34
): PuntoDisegnato[] {
  // I punti evidenziati hanno la precedenza: li si esamina per primi.
  const ordine = [...punti.keys()].sort((a, b) => {
    const pa = punti[a].evidenziato ? 0 : 1;
    const pb = punti[b].evidenziato ? 0 : 1;
    return pa - pb;
  });
  const occupati: Array<{ x: number; y: number }> = [];
  const risultato = [...punti];

  for (const idx of ordine) {
    const p = punti[idx];
    if (!p.etichetta) continue;
    const { x, y } = proiezione.aPixel(p.z);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const collide = occupati.some(
      (o) => Math.hypot(o.x - x, o.y - y) < distanzaMinima
    );
    if (collide) {
      risultato[idx] = { ...p, etichetta: undefined, titolo: p.titolo ?? p.etichetta };
    } else {
      occupati.push({ x, y });
    }
  }
  return risultato;
}

/** Costruisce l'attributo `d` di un path a partire da una polilinea. */
function percorso(punti: Complex[], proiezione: Proiezione): string {
  if (punti.length === 0) return "";
  const parti: string[] = [];
  for (let j = 0; j < punti.length; j += 1) {
    const { x, y } = proiezione.aPixel(punti[j]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    // Clamp generoso: senza di esso i valori enormi di z^10 producono
    // coordinate che alcuni browser rifiutano di rasterizzare.
    const cx = Math.max(-1e5, Math.min(1e5, x));
    const cy = Math.max(-1e5, Math.min(1e5, y));
    parti.push(`${parti.length === 0 ? "M" : "L"}${cx.toFixed(2)} ${cy.toFixed(2)}`);
  }
  return parti.join(" ");
}

function GrigliaSfondo({
  rect,
  proiezione,
  passo,
}: {
  rect: Rettangolo;
  proiezione: Proiezione;
  passo: number;
}) {
  const linee: React.ReactElement[] = [];
  const etichette: React.ReactElement[] = [];

  const primoX = Math.ceil(rect.xMin / passo) * passo;
  for (let x = primoX; x <= rect.xMax + 1e-9; x += passo) {
    const p = proiezione.aPixel(c(x, rect.yMin));
    const q = proiezione.aPixel(c(x, rect.yMax));
    const asse = Math.abs(x) < passo * 1e-6;
    linee.push(
      <line
        key={`vx-${x}`}
        x1={p.x}
        y1={p.y}
        x2={q.x}
        y2={q.y}
        stroke={asse ? "rgba(220,226,235,0.55)" : "rgba(150,165,185,0.14)"}
        strokeWidth={asse ? 1.3 : 1}
      />
    );
    if (!asse) {
      const o = proiezione.aPixel(c(x, 0));
      etichette.push(
        <text key={`tx-${x}`} x={p.x + 3} y={Math.min(Math.max(o.y - 4, 12), q.y + 400)} className="piano__tacca">
          {formattaTacca(x)}
        </text>
      );
    }
  }

  const primoY = Math.ceil(rect.yMin / passo) * passo;
  for (let y = primoY; y <= rect.yMax + 1e-9; y += passo) {
    const p = proiezione.aPixel(c(rect.xMin, y));
    const q = proiezione.aPixel(c(rect.xMax, y));
    const asse = Math.abs(y) < passo * 1e-6;
    linee.push(
      <line
        key={`hy-${y}`}
        x1={p.x}
        y1={p.y}
        x2={q.x}
        y2={q.y}
        stroke={asse ? "rgba(220,226,235,0.55)" : "rgba(150,165,185,0.14)"}
        strokeWidth={asse ? 1.3 : 1}
      />
    );
    if (!asse) {
      const o = proiezione.aPixel(c(0, y));
      etichette.push(
        <text key={`ty-${y}`} x={o.x + 5} y={p.y - 3} className="piano__tacca">
          {formattaTacca(y)}i
        </text>
      );
    }
  }

  return (
    <g>
      {linee}
      {etichette}
    </g>
  );
}

function formattaTacca(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e5 || (a > 0 && a < 1e-3)) return v.toExponential(0);
  return String(Number(v.toFixed(6)));
}

function CerchioGuidaSvg({
  guida,
  proiezione,
}: {
  guida: CerchioGuida;
  proiezione: Proiezione;
}) {
  const centro = proiezione.aPixel(c(0, 0));
  const bordo = proiezione.aPixel(c(guida.r, 0));
  const raggio = Math.abs(bordo.x - centro.x);
  // Sotto i 4 px il cerchio degenera in un punto indistinguibile dall'origine:
  // meglio ometterlo che suggerire una circonferenza che non si vede.
  if (!Number.isFinite(raggio) || raggio > 2e4 || raggio < 4) return null;
  return (
    <g>
      <circle
        cx={centro.x}
        cy={centro.y}
        r={raggio}
        fill="none"
        stroke={guida.colore}
        strokeWidth={1.8}
        strokeDasharray={guida.tratteggiato ? "6 5" : undefined}
        strokeOpacity={0.95}
      />
      {guida.etichetta && raggio > 14 && (
        <text
          x={centro.x + raggio * 0.707 + 4}
          y={centro.y - raggio * 0.707 - 4}
          className="piano__etichetta"
          fill={guida.colore}
        >
          {guida.etichetta}
        </text>
      )}
    </g>
  );
}

function TaglioDiRamo({
  rect,
  proiezione,
}: {
  rect: Rettangolo;
  proiezione: Proiezione;
}) {
  const sinistra = proiezione.aPixel(c(rect.xMin, 0));
  const origine = proiezione.aPixel(c(0, 0));
  if (rect.xMin >= 0) return null;
  const tratti: React.ReactElement[] = [];
  const n = 26;
  for (let j = 0; j < n; j += 1) {
    const x = sinistra.x + ((origine.x - sinistra.x) * j) / n;
    tratti.push(
      <line
        key={j}
        x1={x}
        y1={sinistra.y}
        x2={x + 6}
        y2={sinistra.y - 7}
        stroke="#ff4d5a"
        strokeWidth={1.3}
        strokeOpacity={0.8}
      />
    );
  }
  return (
    <g aria-label="taglio di ramo">
      <line
        x1={sinistra.x}
        y1={sinistra.y}
        x2={origine.x}
        y2={origine.y}
        stroke="#ff4d5a"
        strokeWidth={3}
        strokeDasharray="9 5"
      />
      {tratti}
      <text x={sinistra.x + 8} y={sinistra.y + 16} className="piano__etichetta" fill="#ff4d5a">
        taglio (−∞, 0]
      </text>
    </g>
  );
}

function PuntoSvg({ punto, proiezione }: { punto: PuntoDisegnato; proiezione: Proiezione }) {
  if (!Number.isFinite(punto.z.re) || !Number.isFinite(punto.z.im)) return null;
  const { x, y } = proiezione.aPixel(punto.z);
  if (!Number.isFinite(x) || Math.abs(x) > 1e5 || Math.abs(y) > 1e5) return null;
  const r = punto.raggio ?? (punto.evidenziato ? 6.5 : 4);
  return (
    <g>
      {punto.evidenziato && (
        <circle cx={x} cy={y} r={r + 6} fill={punto.colore} fillOpacity={0.18} />
      )}
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={punto.colore}
        stroke="rgba(10,12,16,0.85)"
        strokeWidth={1.4}
      >
        {punto.titolo && <title>{punto.titolo}</title>}
      </circle>
      {punto.etichetta && (
        <text x={x + r + 4} y={y - r - 2} className="piano__etichetta" fill={punto.colore}>
          {punto.etichetta}
        </text>
      )}
    </g>
  );
}

/** Esportata per i test manuali di inquadratura. */
export function raggioVisibile(rect: Rettangolo): number {
  return Math.max(
    abs(c(rect.xMin, rect.yMin)),
    abs(c(rect.xMax, rect.yMax)),
    abs(c(rect.xMin, rect.yMax)),
    abs(c(rect.xMax, rect.yMin))
  );
}
