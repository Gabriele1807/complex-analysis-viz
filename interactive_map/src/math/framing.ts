/**
 * Inquadratura del piano immagine.
 *
 * Le due mappe hanno dinamiche radicalmente diverse: `z^10` sul dominio
 * `[-3,3]²` arriva a `|w| ≈ 2.4·10^7`, mentre `z^i` resta sempre confinata in
 * `[e^{-π}, e^{π})`. Una sola scala fissa renderebbe inutilizzabile uno dei
 * due casi, perciò l'inquadratura viene stimata campionando la mappa e
 * scartando la coda: un quantile robusto evita che pochi pixel agli angoli
 * del dominio comprimano tutto il resto in un punto.
 */

import { type Complex, abs } from "./complex";
import type { Rettangolo } from "./curves";

/** Quantile `q` di un array non ordinato (lo ordina in loco su una copia). */
function quantile(valori: number[], q: number): number {
  const finiti = valori.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (finiti.length === 0) return 1;
  const idx = Math.min(finiti.length - 1, Math.max(0, Math.round(q * (finiti.length - 1))));
  return finiti[idx];
}

/**
 * Rettangolo che inquadra l'immagine del dominio sotto `f`.
 *
 * @param dominio   rettangolo del piano `z`
 * @param f         la mappa
 * @param stessaScala  se vero, restituisce il dominio stesso (confronto 1:1)
 * @param campioni  lato della griglia di sondaggio
 * @param q         quantile del modulo da inquadrare (0.98 scarta la coda)
 */
export function dominioImmagine(
  dominio: Rettangolo,
  f: (z: Complex) => Complex,
  stessaScala: boolean,
  campioni = 48,
  q = 0.985
): Rettangolo {
  if (stessaScala) return dominio;

  const moduli: number[] = [];
  for (let i = 0; i < campioni; i += 1) {
    for (let j = 0; j < campioni; j += 1) {
      const x = dominio.xMin + ((i + 0.5) / campioni) * (dominio.xMax - dominio.xMin);
      const y = dominio.yMin + ((j + 0.5) / campioni) * (dominio.yMax - dominio.yMin);
      const m = abs(f({ re: x, im: y }));
      if (Number.isFinite(m)) moduli.push(m);
    }
  }

  const raggio = Math.max(quantile(moduli, q) * 1.12, 1e-3);
  // Arrotondamento a un passo "gradevole" (1, 2, 2.5, 5 × 10^k), così che la
  // griglia di sfondo cada su valori leggibili e lo zoom non faccia saltare
  // l'etichettatura degli assi.
  const r = arrotondaGradevole(raggio);
  return { xMin: -r, xMax: r, yMin: -r, yMax: r };
}

/** Arrotonda per eccesso al più vicino valore della forma {1,2,2.5,5}·10^k. */
export function arrotondaGradevole(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 1;
  const esponente = Math.floor(Math.log10(x));
  const base = Math.pow(10, esponente);
  const mantissa = x / base;
  const scalini = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
  const scelto = scalini.find((s) => mantissa <= s) ?? 10;
  return scelto * base;
}

/**
 * Passo della griglia di sfondo per un rettangolo dato: punta a circa
 * `obiettivo` suddivisioni per lato, arrotondando a un valore leggibile.
 */
export function passoGriglia(rect: Rettangolo, obiettivo = 8): number {
  const ampiezza = Math.max(rect.xMax - rect.xMin, rect.yMax - rect.yMin);
  return arrotondaGradevole(ampiezza / obiettivo);
}

/** Conversione dominio → pixel. */
export function creaProiezione(rect: Rettangolo, larghezza: number, altezza: number) {
  const sx = larghezza / (rect.xMax - rect.xMin);
  const sy = altezza / (rect.yMax - rect.yMin);
  return {
    /** Dal piano complesso ai pixel SVG (y invertito: in SVG cresce in basso). */
    aPixel(z: Complex): { x: number; y: number } {
      return {
        x: (z.re - rect.xMin) * sx,
        y: altezza - (z.im - rect.yMin) * sy,
      };
    },
    /** Dai pixel SVG al piano complesso. */
    aComplesso(px: number, py: number): Complex {
      return {
        re: rect.xMin + px / sx,
        im: rect.yMin + (altezza - py) / sy,
      };
    },
    scalaX: sx,
    scalaY: sy,
  };
}

export type Proiezione = ReturnType<typeof creaProiezione>;
