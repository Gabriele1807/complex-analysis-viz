/**
 * Le mappe complesse `z ↦ z^n` e `z ↦ z^i`.
 *
 * Questo modulo è la controparte TypeScript di `video_animation/complex_maps.py`:
 * le firme si corrispondono una a una (`map_z_power` ↔ `mapZPower`,
 * `map_z_i_principal` ↔ `mapZiPrincipal`, …) e le due implementazioni sono
 * verificate contro le stesse identità analitiche.
 *
 * Convenzioni
 * -----------
 * - `Arg z ∈ (-π, π]`;
 * - `Log z = ln|z| + i Arg z`, definito su `ℂ \ {0}`, olomorfo su `ℂ \ (-∞, 0]`;
 * - `log_k z = ln|z| + i(Arg z + 2πk)`, `k ∈ ℤ`;
 * - `z^i` senza altra indicazione è il ramo principale `exp(i Log z)`.
 *
 * Nessuna funzione lancia eccezioni sui punti non definiti: restituisce `NaN`,
 * che i componenti di visualizzazione trattano esplicitamente.
 */

import {
  type Complex,
  DUE_PI,
  PI,
  abs,
  argPrincipal,
  c,
  wrapToPi,
} from "./complex";

// ---------------------------------------------------------------------------
// Costanti notevoli
// ---------------------------------------------------------------------------

/** `e^{-π} ≈ 0.043214`: estremo interno della corona immagine di `z^i`. */
export const E_MENO_PI = Math.exp(-PI);

/** `e^{π} ≈ 23.140693`: estremo esterno, mai attinto. */
export const E_PI = Math.exp(PI);

/** `e^{-2π} ≈ 1.8674e-3`: rapporto fra due rami consecutivi di `z^i`. */
export const FATTORE_RAMO = Math.exp(-DUE_PI);

/** `i^i = e^{-π/2} ≈ 0.2078796`. */
export const I_ALLA_I = Math.exp(-PI / 2);

// ---------------------------------------------------------------------------
// Logaritmo
// ---------------------------------------------------------------------------

/** Logaritmo principale `Log z = ln|z| + i Arg z`. In `z = 0` dà `NaN`. */
export function principalLog(z: Complex): Complex {
  const r = abs(z);
  if (r === 0) return c(NaN, NaN);
  return c(Math.log(r), argPrincipal(z));
}

/**
 * I rami del logaritmo multivalore,
 * `log_k z = ln|z| + i(Arg z + 2πk)` per ogni `k` dato.
 */
export function computeLogBranches(z: Complex, kRange: number[]): Complex[] {
  const base = principalLog(z);
  return kRange.map((k) => c(base.re, base.im + DUE_PI * k));
}

// ---------------------------------------------------------------------------
// z ↦ z^n
// ---------------------------------------------------------------------------

/**
 * Potenza intera `z^n = r^n e^{inθ}`.
 *
 * Per `n` piccolo si usa l'esponenziazione per quadratura, che è esatta sui
 * razionali rappresentabili e non passa per `log`/`exp`; per `n` grande o
 * negativo si ricade sulla forma polare.
 *
 * La mappa è univoca e, per `n ≥ 1`, esattamente `n`-a-1 su `ℂ \ {0}`.
 */
export function mapZPower(z: Complex, n: number): Complex {
  if (!Number.isInteger(n)) throw new Error(`mapZPower richiede n intero, ricevuto ${n}`);
  if (n === 0) return c(1, 0);
  if (n === 1) return z;
  if (z.re === 0 && z.im === 0) return n > 0 ? c(0, 0) : c(NaN, NaN);

  if (n > 0 && n <= 32) {
    // Esponenziazione per quadratura: niente funzioni trascendenti.
    let risultato = c(1, 0);
    let base = z;
    let e = n;
    while (e > 0) {
      if (e & 1) {
        risultato = {
          re: risultato.re * base.re - risultato.im * base.im,
          im: risultato.re * base.im + risultato.im * base.re,
        };
      }
      base = { re: base.re * base.re - base.im * base.im, im: 2 * base.re * base.im };
      e >>= 1;
    }
    return risultato;
  }

  const r = abs(z);
  const theta = argPrincipal(z);
  const m = Math.pow(r, n);
  return c(m * Math.cos(n * theta), m * Math.sin(n * theta));
}

/**
 * Derivata `d/dz z^n = n z^{n-1}`.
 *
 * Per `n ≥ 2` si annulla in `z = 0`: la mappa non è ivi conforme e il
 * Jacobiano reale, di determinante `|f'(z)|² = n²|z|^{2n-2}`, degenera.
 */
export function derivativeZPower(z: Complex, n: number): Complex {
  const p = mapZPower(z, n - 1);
  return c(n * p.re, n * p.im);
}

/**
 * Le `n` radici `n`-esime di `w`, cioè le preimmagini di `w` sotto `z^n`:
 * `z_k = |w|^{1/n} e^{i(Arg w + 2πk)/n}`, `k = 0, …, n-1`.
 *
 * Sono i vertici di un `n`-agono regolare. Per `w = 0` si restituiscono `n`
 * zeri: l'unica preimmagine è `0`, con molteplicità `n`.
 */
export function computeNthRoots(w: Complex, n: number): Complex[] {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`computeNthRoots richiede n intero ≥ 1, ricevuto ${n}`);
  }
  const modulo = abs(w);
  if (modulo === 0) return Array.from({ length: n }, () => c(0, 0));
  const raggio = Math.pow(modulo, 1 / n);
  const arg = argPrincipal(w);
  const radici: Complex[] = [];
  for (let k = 0; k < n; k += 1) {
    const theta = (arg + DUE_PI * k) / n;
    radici.push(c(raggio * Math.cos(theta), raggio * Math.sin(theta)));
  }
  return radici;
}

/**
 * Indice della radice `n`-esima di `f(z)` che coincide con `z` stesso.
 * Serve a evidenziare, fra le `n` preimmagini, quella effettivamente
 * selezionata dall'utente. Restituisce `-1` se nessuna corrisponde
 * (accade solo in `z = 0`).
 */
export function indiceRadiceSelezionata(z: Complex, n: number): number {
  const radici = computeNthRoots(mapZPower(z, n), n);
  let migliore = -1;
  let distanza = Infinity;
  radici.forEach((r, k) => {
    const d = Math.hypot(r.re - z.re, r.im - z.im);
    if (d < distanza) {
      distanza = d;
      migliore = k;
    }
  });
  const tolleranza = Math.max(1e-9, 1e-7 * abs(z));
  return distanza <= tolleranza ? migliore : -1;
}

// ---------------------------------------------------------------------------
// z ↦ z^i
// ---------------------------------------------------------------------------

/** `|z^i| = e^{-Arg z}`: dipende solo dall'argomento. Valori in `[e^{-π}, e^{π})`. */
export function ziModulus(z: Complex): number {
  return Math.exp(-argPrincipal(z));
}

/**
 * `arg(z^i) ≡ ln|z| (mod 2π)`: dipende solo dal modulo.
 *
 * Con `principale = false` si ottiene il rappresentante `ln|z|` non ridotto,
 * utile per contare gli avvolgimenti: è illimitato sia per `r → 0⁺` sia per
 * `r → ∞`.
 */
export function ziArgument(z: Complex, principale = true): number {
  const r = abs(z);
  if (r === 0) return NaN;
  const lnr = Math.log(r);
  return principale ? wrapToPi(lnr) : lnr;
}

/**
 * Ramo principale di `z^i`:
 *
 *     z^i = exp(i Log z) = exp(i(ln r + iθ)) = e^{-θ} e^{i ln r}.
 *
 * Si usa direttamente la forma chiusa anziché comporre `exp` con `log`: è più
 * stabile e rende evidente lo scambio di ruoli fra modulo e argomento.
 *
 * In `z = 0` restituisce `NaN`. Il limite non esiste: `|z^i| = e^{-θ}` resta
 * **limitato**, ma `arg(z^i) = ln r → -∞` oscilla avvolgendosi infinite volte.
 * L'origine è un punto di diramazione, non un polo.
 */
export function mapZiPrincipal(z: Complex): Complex {
  const r = abs(z);
  if (r === 0) return c(NaN, NaN);
  const theta = argPrincipal(z);
  const lnr = Math.log(r);
  const modulo = Math.exp(-theta);
  return c(modulo * Math.cos(lnr), modulo * Math.sin(lnr));
}

/**
 * Ramo `k` della relazione multivalore:
 * `z^i_k = exp(i log_k z) = z^i · e^{-2πk}`.
 *
 * I rami differiscono per un fattore **reale positivo**: tutti i valori
 * giacciono sulla stessa semiretta uscente dall'origine, in progressione
 * geometrica di ragione `e^{-2π}`.
 */
export function mapZiBranch(z: Complex, k: number): Complex {
  if (!Number.isInteger(k)) throw new Error(`mapZiBranch richiede k intero, ricevuto ${k}`);
  const base = mapZiPrincipal(z);
  const f = Math.exp(-DUE_PI * k);
  return c(base.re * f, base.im * f);
}

/** Derivata del ramo principale: `d/dz z^i = i z^i / z`. Non si annulla mai. */
export function derivativeZi(z: Complex): Complex {
  const r = abs(z);
  if (r === 0) return c(NaN, NaN);
  const w = mapZiPrincipal(z);
  // i·w/z
  const iw = c(-w.im, w.re);
  const d = z.re * z.re + z.im * z.im;
  return c((iw.re * z.re + iw.im * z.im) / d, (iw.im * z.re - iw.re * z.im) / d);
}

/**
 * La fibra del ramo principale passante per `z`, cioè `{z·e^{2πm}}`.
 *
 * **Il ramo principale di `z^i` non è iniettivo sul piano tagliato.** Da
 * `z^i = e^{-θ}e^{i ln r}` segue che `z₁^i = z₂^i` equivale a `θ₁ = θ₂` e
 * `ln r₁ − ln r₂ ∈ 2πℤ`, cioè `z₂ = z₁e^{2πm}`. La mappa è dunque ∞-a-1, e la
 * fibra è una progressione geometrica di punti allineati sulla stessa
 * semiretta. Controesempio minimo: `1^i = (e^{2π})^i = 1`.
 */
export function ziFiber(z: Complex, mRange: number[]): Complex[] {
  return mRange.map((m) => {
    const f = Math.exp(DUE_PI * m);
    return c(z.re * f, z.im * f);
  });
}

/**
 * La corona massimale di iniettività del ramo principale contenente `z`.
 *
 * Essendo le fibre `{z e^{2πm}}`, il ramo è iniettivo esattamente dove `ln|z|`
 * percorre un intervallo di ampiezza minore di `2π`, cioè su
 * `{e^a < |z| < e^{a+2π}} ∩ (ℂ \ (-∞, 0])`.
 */
export function injectivityAnnulus(z: Complex): { rMin: number; rMax: number } {
  const r = abs(z);
  if (r === 0) return { rMin: NaN, rMax: NaN };
  const a = Math.floor(Math.log(r) / DUE_PI) * DUE_PI;
  return { rMin: Math.exp(a), rMax: Math.exp(a + DUE_PI) };
}

// ---------------------------------------------------------------------------
// Dominio: taglio di ramo e affidabilità numerica
// ---------------------------------------------------------------------------

/**
 * Vicinanza al taglio di ramo `(-∞, 0]`.
 *
 * Attraversandolo, `Arg z` salta di `2π` e quindi `|z^i| = e^{-Arg z}` salta
 * di un fattore `e^{2π} ≈ 535.5`: è una discontinuità del **ramo scelto**, non
 * della relazione multivalore.
 */
export function nearBranchCut(z: Complex, tol = 1e-2): boolean {
  return z.re < 0 && Math.abs(z.im) <= tol;
}

/**
 * Raggio sotto il quale la fase di `z^i` risulta sotto-campionata.
 *
 * Con passo di campionamento `h`, fra due campioni adiacenti si ha
 * `|Δ arg| ≈ h/r`; imponendo `h/r ≤ faseMax` segue `r ≥ h/faseMax`.
 *
 * **Non è una soglia di overflow**: `|z^i|` resta confinato in `[e^{-π}, e^{π})`
 * ovunque. È una soglia di *aliasing*, e come tale dipende dalla risoluzione.
 */
export function aliasingRadius(passo: number, faseMax = PI / 2): number {
  return passo / faseMax;
}

/** Immagine del ramo principale di `z^i`, con gli estremi inclusi o esclusi. */
export function imageAnnulus(dominio: "tagliato" | "bucato" = "bucato"): {
  rMin: number;
  rMax: number;
  rMinIncluso: boolean;
  rMaxIncluso: boolean;
} {
  return {
    rMin: E_MENO_PI,
    rMax: E_PI,
    // L'estremo interno è attinto solo se il semiasse reale negativo
    // (dove Arg z = π) appartiene al dominio.
    rMinIncluso: dominio === "bucato",
    rMaxIncluso: false,
  };
}

// ---------------------------------------------------------------------------
// Selettore della mappa corrente
// ---------------------------------------------------------------------------

export type TipoMappa = "potenza" | "zi" | "ziRami";

export interface ConfigMappa {
  tipo: TipoMappa;
  /** Esponente intero, usato solo da `potenza`. */
  n: number;
  /** Ramo selezionato, usato da `ziRami`. */
  k: number;
}

/** La funzione corrispondente alla configurazione corrente. */
export function mappaCorrente(cfg: ConfigMappa): (z: Complex) => Complex {
  switch (cfg.tipo) {
    case "potenza":
      return (z) => mapZPower(z, cfg.n);
    case "zi":
      return mapZiPrincipal;
    case "ziRami":
      return (z) => mapZiBranch(z, cfg.k);
    default:
      return mapZiPrincipal;
  }
}

/** La formula simbolica (LaTeX-like, resa con entità Unicode) della mappa. */
export function formulaMappa(cfg: ConfigMappa): string {
  switch (cfg.tipo) {
    case "potenza":
      return `f(z) = z^${cfg.n} = r^${cfg.n} e^(i·${cfg.n}θ)`;
    case "zi":
      return "f(z) = z^i = exp(i·Log z) = e^(−θ) · e^(i·ln r)";
    case "ziRami":
      return `f_k(z) = z^i · e^(−2πk),  k = ${cfg.k}`;
    default:
      return "";
  }
}

/** Descrizione testuale del comportamento della mappa, per il pannello. */
export function descrizioneMappa(cfg: ConfigMappa): string {
  switch (cfg.tipo) {
    case "potenza":
      return `Mappa algebrica, ${cfg.n}-a-1 su ℂ∖{0}. Il modulo si eleva alla ${cfg.n}, l'argomento si moltiplica per ${cfg.n}. Conforme ovunque tranne che in z = 0.`;
    case "zi":
      return "Mappa trascendente. Il modulo dell'immagine dipende solo dall'argomento di z, l'argomento dell'immagine solo dal modulo di z. Conforme su tutto il piano tagliato, ma ∞-a-1.";
    case "ziRami":
      return "Ramo k-esimo del logaritmo multivalore. Differisce dal principale per il fattore reale positivo e^(−2πk).";
    default:
      return "";
  }
}

/** Avvisi matematici per il punto selezionato. */
export function avvisi(z: Complex, cfg: ConfigMappa, risoluzione = 600): string[] {
  const messaggi: string[] = [];
  const r = abs(z);

  if (r === 0) {
    messaggi.push(
      cfg.tipo === "potenza"
        ? "z = 0 è l'unica preimmagine di 0 e vi ha molteplicità n: la mappa non è ivi conforme (f′(0) = 0)."
        : "z = 0: z^i non è definita. Il limite non esiste — il modulo resta limitato, ma l'argomento ln|z| → −∞ oscilla infinite volte. È un punto di diramazione."
    );
    return messaggi;
  }

  if (cfg.tipo !== "potenza") {
    if (nearBranchCut(z, 2e-2)) {
      messaggi.push(
        "Sei sul taglio di ramo (−∞, 0]: attraversandolo Arg z salta di 2π e |z^i| cambia di un fattore e^(2π) ≈ 535,49. È una discontinuità del ramo scelto, non della relazione multivalore."
      );
    }
    const rCritico = aliasingRadius(6 / risoluzione);
    if (r < Math.max(rCritico, 0.05)) {
      messaggi.push(
        `|z| = ${r.toFixed(4)} è sotto la soglia di aliasing (≈ ${Math.max(rCritico, 0.05).toFixed(4)}): arg(z^i) = ln|z| varia come 1/r e la colorazione della fase diventa inaffidabile. I valori numerici restano però corretti.`
      );
    }
  } else if (r < 1e-6) {
    messaggi.push("z è numericamente indistinguibile da 0: le n radici collassano nell'origine.");
  }

  return messaggi;
}
