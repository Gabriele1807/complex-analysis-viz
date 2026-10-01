/**
 * Famiglie di curve nel dominio e loro immagini.
 *
 * Le curve sono campionate come polilinee di numeri complessi. L'immagine di
 * una curva viene **ricalcolata** come `f(γ(t))` campione per campione, non
 * ottenuta deformando i vertici di una spezzata grossolana: sotto una mappa
 * non affine le due cose differiscono vistosamente.
 */

import { type Complex, PI, DUE_PI, c, fromPolar } from "./complex";

export type TipoCurva =
  | "cartesiana"
  | "cerchio"
  | "raggio"
  | "bordo"
  | "traiettoria";

export interface Curva {
  id: string;
  tipo: TipoCurva;
  /** Segmenti di polilinea: più di uno quando la curva va spezzata. */
  segmenti: Complex[][];
  colore: string;
  larghezza: number;
  tratteggiata?: boolean;
}

export interface Rettangolo {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export const COLORI = {
  cartesiana: "#4c8dff",
  cerchio: "#2bd9c8",
  raggio: "#ff9e3d",
  bordo: "#ffd93d",
  traiettoria: "#c77dff",
  taglio: "#ff4d5a",
  immagine: "#8be04e",
} as const;

/** Campiona `γ` su `[t0, t1]` con `n` campioni (estremi inclusi). */
export function campiona(
  gamma: (t: number) => Complex,
  t0: number,
  t1: number,
  n: number
): Complex[] {
  const punti: Complex[] = new Array(n);
  const dt = (t1 - t0) / (n - 1);
  for (let j = 0; j < n; j += 1) punti[j] = gamma(t0 + j * dt);
  return punti;
}

/**
 * Immagine di una curva sotto `f`, con spezzatura delle discontinuità.
 *
 * Attraversando il taglio di ramo, `z^i` salta di un fattore `e^{2π} ≈ 535`:
 * unire i due campioni con un segmento disegnerebbe una corda che **non
 * appartiene all'immagine della curva**. Qui la polilinea viene interrotta
 * quando il passo supera `sogliaSalto` volte il passo tipico, e i punti non
 * finiti vengono scartati.
 */
export function immagineCurva(
  curva: Curva,
  f: (z: Complex) => Complex,
  colore: string,
  sogliaSalto = 12
): Curva {
  const segmenti: Complex[][] = [];

  for (const segmento of curva.segmenti) {
    const immagini = segmento.map(f);
    // Passo tipico: mediana robusta approssimata tramite la mediana dei passi
    // finiti, per non farsi dominare proprio dal salto che vogliamo scoprire.
    const passi: number[] = [];
    for (let j = 1; j < immagini.length; j += 1) {
      const a = immagini[j - 1];
      const b = immagini[j];
      if (Number.isFinite(a.re) && Number.isFinite(b.re)) {
        passi.push(Math.hypot(b.re - a.re, b.im - a.im));
      }
    }
    passi.sort((x, y) => x - y);
    const mediana = passi.length ? passi[Math.floor(passi.length / 2)] : 0;
    const limite = mediana > 0 ? mediana * sogliaSalto : Infinity;

    let corrente: Complex[] = [];
    for (let j = 0; j < immagini.length; j += 1) {
      const w = immagini[j];
      if (!Number.isFinite(w.re) || !Number.isFinite(w.im)) {
        if (corrente.length > 1) segmenti.push(corrente);
        corrente = [];
        continue;
      }
      if (corrente.length > 0) {
        const p = corrente[corrente.length - 1];
        if (Math.hypot(w.re - p.re, w.im - p.im) > limite) {
          if (corrente.length > 1) segmenti.push(corrente);
          corrente = [];
        }
      }
      corrente.push(w);
    }
    if (corrente.length > 1) segmenti.push(corrente);
  }

  return { ...curva, id: `img-${curva.id}`, segmenti, colore };
}

/** Immagini di un'intera famiglia. */
export function immagineFamiglia(
  curve: Curva[],
  f: (z: Complex) => Complex,
  usaColoreOriginale = true
): Curva[] {
  return curve.map((curva) =>
    immagineCurva(curva, f, usaColoreOriginale ? curva.colore : COLORI.immagine)
  );
}

// ---------------------------------------------------------------------------
// Griglie
// ---------------------------------------------------------------------------

/**
 * Griglia cartesiana sul rettangolo dato.
 *
 * `densita` è il numero di rette per ciascuna direzione; `campioniPerLinea`
 * controlla quanto fedelmente l'immagine seguirà la curvatura.
 */
export function grigliaCartesiana(
  dominio: Rettangolo,
  densita = 13,
  campioniPerLinea = 240
): Curva[] {
  const curve: Curva[] = [];
  for (let j = 0; j < densita; j += 1) {
    const s = densita === 1 ? 0.5 : j / (densita - 1);
    const x = dominio.xMin + s * (dominio.xMax - dominio.xMin);
    const y = dominio.yMin + s * (dominio.yMax - dominio.yMin);
    curve.push({
      id: `vert-${j}`,
      tipo: "cartesiana",
      colore: COLORI.cartesiana,
      larghezza: 1.1,
      segmenti: [
        campiona((t) => c(x, t), dominio.yMin, dominio.yMax, campioniPerLinea),
      ],
    });
    curve.push({
      id: `oriz-${j}`,
      tipo: "cartesiana",
      colore: COLORI.cartesiana,
      larghezza: 1.1,
      segmenti: [
        campiona((t) => c(t, y), dominio.xMin, dominio.xMax, campioniPerLinea),
      ],
    });
  }
  return curve;
}

/**
 * Griglia polare: cerchi `|z| = cost.` e raggi `arg z = cost.`
 *
 * `rMin > 0` è necessario per `z^i`: avvicinandosi all'origine
 * `arg(z^i) = ln|z|` varia come `1/r` e il campionamento diventa insufficiente.
 */
export function grigliaPolare(
  rMax: number,
  nCerchi = 6,
  nRaggi = 16,
  rMin = 0.08,
  campioni = 420
): Curva[] {
  const curve: Curva[] = [];

  for (let j = 1; j <= nCerchi; j += 1) {
    const r = (rMax * j) / nCerchi;
    curve.push({
      id: `cerchio-${j}`,
      tipo: "cerchio",
      colore: COLORI.cerchio,
      larghezza: 1.3,
      // Il cerchio viene aperto appena oltre -π e chiuso in π: così il taglio
      // di ramo non viene attraversato dal campionamento.
      segmenti: [campiona((t) => fromPolar(r, t), -PI + 1e-9, PI, campioni)],
    });
  }

  for (let j = 0; j < nRaggi; j += 1) {
    const theta = -PI + ((j + 0.5) * DUE_PI) / nRaggi;
    curve.push({
      id: `raggio-${j}`,
      tipo: "raggio",
      colore: COLORI.raggio,
      larghezza: 1.3,
      segmenti: [campiona((t) => fromPolar(t, theta), rMin, rMax, campioni)],
    });
  }

  return curve;
}

/** Un singolo cerchio di raggio `r`, come curva evidenziata. */
export function cerchio(r: number, colore = COLORI.cerchio, campioni = 720): Curva {
  return {
    id: `cerchio-sing-${r}`,
    tipo: "cerchio",
    colore,
    larghezza: 2.2,
    segmenti: [campiona((t) => fromPolar(r, t), -PI + 1e-9, PI, campioni)],
  };
}

/** Un singolo raggio di argomento `theta`. */
export function raggio(
  theta: number,
  rMin = 0.05,
  rMax = 3,
  colore = COLORI.raggio,
  campioni = 720
): Curva {
  return {
    id: `raggio-sing-${theta.toFixed(3)}`,
    tipo: "raggio",
    colore,
    larghezza: 2.2,
    segmenti: [campiona((t) => fromPolar(t, theta), rMin, rMax, campioni)],
  };
}

// ---------------------------------------------------------------------------
// Traiettorie parametriche
// ---------------------------------------------------------------------------

export interface DefTraiettoria {
  id: string;
  nome: string;
  descrizione: string;
  gamma: (t: number, p: number) => Complex;
  /** Parametro libero, con etichetta e intervallo. */
  parametro: { nome: string; min: number; max: number; default: number };
}

/** Traiettorie `γ: [0, 1] → ℂ` disponibili nel pannello dedicato. */
export const TRAIETTORIE: DefTraiettoria[] = [
  {
    id: "cerchio",
    nome: "Circonferenza",
    descrizione:
      "γ(t) = ρ·e^(2πit). Sotto z^n l'immagine percorre n volte una circonferenza; sotto z^i diventa un segmento radiale percorso una volta.",
    gamma: (t, rho) => fromPolar(rho, -PI + 1e-9 + t * (DUE_PI - 1e-9)),
    parametro: { nome: "raggio ρ", min: 0.1, max: 3, default: 1 },
  },
  {
    id: "raggio",
    nome: "Semiretta",
    descrizione:
      "γ(t) = r(t)·e^(iθ) con r crescente in scala logaritmica. Sotto z^i l'immagine resta sulla circonferenza |w| = e^(−θ) e la percorre infinite volte.",
    gamma: (t, theta) => fromPolar(Math.exp(-4 + t * 8), theta),
    parametro: { nome: "argomento θ", min: -PI + 0.01, max: PI, default: 0 },
  },
  {
    id: "spirale",
    nome: "Spirale logaritmica",
    descrizione:
      "γ(t) = e^(at)·e^(2πit): modulo e argomento crescono insieme. È l'unica curva che resta una spirale logaritmica sotto entrambe le mappe.",
    gamma: (t, a) => fromPolar(Math.exp(a * (t - 0.5) * 4), -PI + t * DUE_PI * 2),
    parametro: { nome: "passo a", min: 0.05, max: 1.2, default: 0.4 },
  },
  {
    id: "segmento",
    nome: "Segmento orizzontale",
    descrizione:
      "γ(t) = (−R + 2Rt) + ih. Per h → 0 il segmento attraversa il taglio di ramo e l'immagine sotto z^i si spezza in due archi separati dal fattore e^(2π).",
    gamma: (t, h) => c(-2.6 + 5.2 * t, h),
    parametro: { nome: "quota h", min: -1, max: 1, default: 0.25 },
  },
  {
    id: "ellisse",
    nome: "Ellisse",
    descrizione:
      "γ(t) = a·cos(2πt) + i·b·sin(2πt). Non è né un cerchio né un raggio: mostra il comportamento generico della mappa.",
    gamma: (t, b) => c(2 * Math.cos(DUE_PI * t), b * Math.sin(DUE_PI * t)),
    parametro: { nome: "semiasse b", min: 0.2, max: 2.5, default: 1 },
  },
  {
    id: "cardioide",
    nome: "Cardioide",
    descrizione:
      "γ(t) = ρ(1 + cos φ)e^(iφ). Passa vicino all'origine, dove z^i avvolge la fase infinite volte.",
    gamma: (t, rho) => {
      const phi = -PI + 1e-9 + t * (DUE_PI - 1e-9);
      return fromPolar(rho * (1 + Math.cos(phi)) * 0.5 + 0.06, phi);
    },
    parametro: { nome: "scala ρ", min: 0.5, max: 3, default: 2 },
  },
];

/** La curva campionata di una traiettoria. */
export function curvaTraiettoria(
  def: DefTraiettoria,
  parametro: number,
  campioniTot = 1400
): Curva {
  return {
    id: `traiettoria-${def.id}`,
    tipo: "traiettoria",
    colore: COLORI.traiettoria,
    larghezza: 2.4,
    segmenti: [campiona((t) => def.gamma(t, parametro), 0, 1, campioniTot)],
  };
}

// ---------------------------------------------------------------------------
// Punti campione
// ---------------------------------------------------------------------------

export interface PuntoCampione {
  z: Complex;
  etichetta: string;
  nota?: string;
}

/**
 * Punti campione etichettati. La scelta non è casuale: includono i quattro
 * punti dove `z^n` è reale o immaginario puro, i punti dove `z^i` assume i
 * valori notevoli `e^{∓π/2}` ed `e^{−π}`, e un punto sul taglio di ramo.
 */
export const PUNTI_CAMPIONE: PuntoCampione[] = [
  { z: c(1, 0), etichetta: "1", nota: "1^i = 1: punto fisso di z^i e di ogni z^n." },
  { z: c(0, 1), etichetta: "i", nota: "i^i = e^(−π/2) ≈ 0,2079: reale positivo." },
  {
    z: c(-1, 0),
    etichetta: "−1",
    nota: "Sul taglio di ramo: Arg(−1) = +π, quindi (−1)^i = e^(−π) ≈ 0,0432, il minimo del modulo.",
  },
  { z: c(0, -1), etichetta: "−i", nota: "(−i)^i = e^(π/2) ≈ 4,8105." },
  { z: c(1, 1), etichetta: "1+i", nota: "|(1+i)^i| = e^(−π/4); arg = ln√2." },
  { z: c(0, 2), etichetta: "2i", nota: "Stesso modulo immagine di i, argomento ln 2." },
  { z: c(2, 0), etichetta: "2", nota: "2^i = e^(i·ln 2): sulla circonferenza unitaria." },
  { z: c(0.5, 0), etichetta: "1/2", nota: "(1/2)^i = e^(−i·ln 2): simmetrico di 2^i." },
  { z: c(-1, 1), etichetta: "−1+i", nota: "Arg = 3π/4: modulo immagine e^(−3π/4)." },
  { z: c(-0.5, -0.5), etichetta: "−½−½i", nota: "Terzo quadrante: Arg negativo, modulo immagine > 1." },
];
