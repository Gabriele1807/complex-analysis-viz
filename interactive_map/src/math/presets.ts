/**
 * Casi speciali guidati.
 *
 * Ogni preset imposta in un colpo solo mappa, punto, dominio, interruttori e
 * traiettoria, e fornisce il testo che spiega che cosa si sta guardando.
 */

import { c, PI, DUE_PI } from "./complex";
import { E_MENO_PI, E_PI } from "./complexMaps";
import type { Stato } from "../state/store";

export interface CasoGuidato {
  id: string;
  titolo: string;
  sommario: string;
  /** Testo esteso mostrato una volta applicato il preset. */
  spiegazione: string;
  stato: Partial<Stato>;
}

export const CASI_GUIDATI: CasoGuidato[] = [
  {
    id: "i-alla-i",
    titolo: "i elevato a i",
    sommario: "Un immaginario elevato a un immaginario dà un reale.",
    spiegazione: `Con |i| = 1 si ha ln|i| = 0, quindi arg(i^i) = 0: l'immagine è reale. Con Arg(i) = π/2 si ha |i^i| = e^(−π/2) ≈ 0,20787957635. Dunque i^i = e^(−π/2), reale positivo.

Attenzione: questo è il valore del ramo principale. La relazione multivalore dà l'intera famiglia e^(−π/2−2πk), tutti reali positivi, allineati sul semiasse reale positivo in progressione geometrica di ragione e^(−2π).`,
    stato: {
      mappa: { tipo: "zi", n: 2, k: 0 },
      z: c(0, 1),
      dominio: { xMin: -2, xMax: 2, yMin: -2, yMax: 2 },
      mostra: {
        ritrattoFase: true,
        polare: true,
        cartesiana: false,
        puntiCampione: true,
        curveImmagine: true,
        radici: true,
        tracce: true,
        taglio: true,
        contornoModulo: true,
        contornoFase: false,
      },
    },
  },
  {
    id: "circonferenza-unitaria",
    titolo: "La circonferenza unitaria",
    sommario: "|z| = 1 finisce in un segmento reale, semiaperto.",
    spiegazione: `Su |z| = 1 si ha ln|z| = 0, quindi arg(z^i) = 0 identicamente: tutta la circonferenza finisce sul semiasse reale positivo.

Il modulo vale |z^i| = e^(−Arg z) con Arg z ∈ (−π, π], perciò l'immagine è l'intervallo [e^(−π), e^(π)) = [0,04321…, 23,14069…), SEMIAPERTO a destra: l'estremo e^(π) richiederebbe Arg z = −π, che la convenzione esclude. Il minimo e^(−π) è invece attinto, esattamente in z = −1.

Parametrizzando z = e^(iθ) con θ che cresce da −π a π, l'immagine e^(−θ) DECRESCE da (quasi) e^(π) fino a e^(−π): la corrispondenza inverte il verso.`,
    stato: {
      mappa: { tipo: "zi", n: 2, k: 0 },
      z: c(Math.cos(2.2), Math.sin(2.2)),
      dominio: { xMin: -2, xMax: 2, yMin: -2, yMax: 2 },
      traiettoria: { id: "cerchio", parametro: 1, t: 0.72, inRiproduzione: false },
      mostra: {
        ritrattoFase: true,
        polare: false,
        cartesiana: false,
        puntiCampione: true,
        curveImmagine: true,
        radici: false,
        tracce: false,
        taglio: true,
        contornoModulo: true,
        contornoFase: false,
      },
      tab: "traiettorie",
    },
  },
  {
    id: "semiasse-positivo",
    titolo: "Il semiasse reale positivo",
    sommario: "Va nella circonferenza unitaria, percorsa infinite volte.",
    spiegazione: `Per z = r reale positivo si ha Arg z = 0, quindi |z^i| = e^0 = 1: l'immagine giace sulla circonferenza unitaria.

L'argomento è arg(z^i) = ln r, che è ILLIMITATO in entrambe le direzioni: ln r → −∞ per r → 0⁺ e ln r → +∞ per r → ∞. La circonferenza viene dunque percorsa infinite volte, in entrambi i versi di avvolgimento, e il numero di giri fra r₁ e r₂ è (ln r₂ − ln r₁)/2π.

È la dimostrazione più diretta che il ramo principale non è iniettivo: r ed r·e^(2π) hanno la stessa immagine.`,
    stato: {
      mappa: { tipo: "zi", n: 2, k: 0 },
      z: c(2, 0),
      dominio: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 },
      traiettoria: { id: "raggio", parametro: 0, t: 0.6, inRiproduzione: true },
      mostra: {
        ritrattoFase: true,
        polare: false,
        cartesiana: false,
        puntiCampione: true,
        curveImmagine: true,
        radici: false,
        tracce: true,
        taglio: true,
        contornoModulo: true,
        contornoFase: false,
      },
      tab: "traiettorie",
    },
  },
  {
    id: "raggi-costanti",
    titolo: "Raggi ad argomento costante",
    sommario: "Diventano circonferenze di modulo costante.",
    spiegazione: `Su un raggio arg z = θ₀ il modulo dell'immagine è |z^i| = e^(−θ₀), costante: l'immagine giace sulla circonferenza di raggio e^(−θ₀).

Poiché lungo il raggio r percorre tutto (0, ∞), l'argomento ln r percorre tutto ℝ e la circonferenza viene coperta infinite volte. L'immagine del raggio è quindi la circonferenza INTERA, non un arco.

Al variare di θ₀ in (−π, π] i raggi spazzano circonferenze di raggio da e^(−π) a e^(π): ecco la corona immagine.`,
    stato: {
      mappa: { tipo: "zi", n: 2, k: 0 },
      z: c(1.6, 1.1),
      dominio: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 },
      mostra: {
        ritrattoFase: true,
        polare: true,
        cartesiana: false,
        puntiCampione: false,
        curveImmagine: true,
        radici: false,
        tracce: false,
        taglio: true,
        contornoModulo: true,
        contornoFase: false,
      },
      densita: 16,
    },
  },
  {
    id: "cerchi-costanti",
    titolo: "Cerchi a modulo costante",
    sommario: "Diventano segmenti radiali, non semirette.",
    spiegazione: `Su |z| = r₀ l'argomento dell'immagine è arg(z^i) = ln r₀, costante: l'immagine giace sulla semiretta di argomento ln r₀.

Ma il modulo |z^i| = e^(−Arg z) è confinato in [e^(−π), e^(π)): l'immagine è un SEGMENTO radiale, di lunghezza e^(π) − e^(−π) ≈ 23,0975, non una semiretta illimitata. Il rapporto fra l'estremo esterno e quello interno è esattamente e^(2π) ≈ 535,49, indipendentemente da r₀.

Al crescere di r₀ il segmento ruota: ogni volta che r₀ si moltiplica per e^(2π), il segmento compie un giro completo e torna su sé stesso — di nuovo la non iniettività.`,
    stato: {
      mappa: { tipo: "zi", n: 2, k: 0 },
      z: c(0.9, 0.9),
      dominio: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 },
      mostra: {
        ritrattoFase: true,
        polare: true,
        cartesiana: false,
        puntiCampione: false,
        curveImmagine: true,
        radici: false,
        tracce: false,
        taglio: true,
        contornoModulo: true,
        contornoFase: false,
      },
      densita: 16,
    },
  },
  {
    id: "non-iniettiva",
    titolo: "z^i non è iniettiva",
    sommario: "1 e e^(2π) ≈ 535,49 hanno la stessa immagine.",
    spiegazione: `Da z^i = e^(−θ)·e^(i ln r) segue che z₁^i = z₂^i equivale a θ₁ = θ₂ e ln r₁ − ln r₂ ∈ 2πℤ, cioè z₂ = z₁·e^(2πm).

Controesempio minimo: 1^i = e^(i·ln 1) = e^0 = 1, e (e^(2π))^i = e^(i·ln e^(2π)) = e^(2πi) = 1. Due punti distinti del piano tagliato, distanti più di 534, con la stessa identica immagine.

Il ramo principale è dunque ∞-a-1, non iniettivo. È iniettivo soltanto su una corona {e^a < |z| < e^(a+2π)} intersecata col piano tagliato, cioè dove ln|z| percorre un intervallo di ampiezza minore di 2π. Attiva «Fibra del punto» per vedere gli altri punti con la stessa immagine.`,
    stato: {
      mappa: { tipo: "zi", n: 2, k: 0 },
      z: c(1, 0),
      dominio: { xMin: -700, xMax: 700, yMin: -700, yMax: 700 },
      mostra: {
        ritrattoFase: true,
        polare: false,
        cartesiana: false,
        puntiCampione: false,
        curveImmagine: false,
        radici: false,
        tracce: true,
        taglio: true,
        contornoModulo: true,
        contornoFase: false,
      },
    },
  },
  {
    id: "taglio-di-ramo",
    titolo: "Il salto sul taglio di ramo",
    sommario: "Attraversando (−∞, 0] il modulo salta di e^(2π).",
    spiegazione: `Il ramo principale impone Arg z ∈ (−π, π]. Avvicinandosi al semiasse reale negativo da sopra, Arg z → π e |z^i| → e^(−π) ≈ 0,0432; avvicinandosi da sotto, Arg z → −π e |z^i| → e^(π) ≈ 23,1407.

Il rapporto è esattamente e^(2π) ≈ 535,4917. Non è una singolarità della funzione: è una discontinuità della SCELTA DEL RAMO. La relazione multivalore z^i è perfettamente «continua» nel senso del rivestimento; è il taglio che la taglia.

Sposta il punto lungo una traiettoria che attraversa il taglio (preset «Segmento orizzontale» con quota h → 0) per vedere l'immagine spezzarsi in due pezzi.`,
    stato: {
      mappa: { tipo: "zi", n: 2, k: 0 },
      z: c(-1.5, 0.05),
      dominio: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 },
      traiettoria: { id: "segmento", parametro: 0.02, t: 0.2, inRiproduzione: false },
      mostra: {
        ritrattoFase: true,
        polare: false,
        cartesiana: false,
        puntiCampione: true,
        curveImmagine: true,
        radici: false,
        tracce: false,
        taglio: true,
        contornoModulo: true,
        contornoFase: false,
      },
      tab: "traiettorie",
    },
  },
  {
    id: "radici-nesime",
    titolo: "Le n radici n-esime",
    sommario: "Ogni w ≠ 0 ha esattamente n preimmagini sotto z^n.",
    spiegazione: `Le soluzioni di zⁿ = w sono z_k = |w|^(1/n)·e^(i(Arg w + 2πk)/n), con k = 0, …, n−1: i vertici di un n-agono regolare inscritto nella circonferenza di raggio |w|^(1/n), a passo angolare 2π/n.

Per n ≥ 2 la loro somma è nulla (è il coefficiente di z^(n−1) nel polinomio zⁿ − w) e il loro prodotto vale (−1)^(n+1)·w.

L'unica eccezione è w = 0: la sola preimmagine è z = 0, con molteplicità n. È lì che z^n non è conforme, perché f′(0) = 0 e il Jacobiano degenera; gli angoli nell'origine vengono moltiplicati per n.`,
    stato: {
      mappa: { tipo: "potenza", n: 5, k: 0 },
      z: c(1.1, 0.5),
      dominio: { xMin: -2, xMax: 2, yMin: -2, yMax: 2 },
      mostra: {
        ritrattoFase: true,
        polare: true,
        cartesiana: false,
        puntiCampione: true,
        curveImmagine: true,
        radici: true,
        tracce: false,
        taglio: false,
        contornoModulo: true,
        contornoFase: false,
      },
      tab: "preimmagini",
    },
  },
  {
    id: "avvolgimento",
    titolo: "Avvolgimento n volte",
    sommario: "Un giro nel dominio, n giri nell'immagine.",
    spiegazione: `Percorrendo una volta la circonferenza |z| = ρ, l'argomento di z cresce di 2π e quello di zⁿ cresce di 2πn: l'immagine compie n giri attorno all'origine.

In linguaggio topologico, il grado della restrizione di zⁿ alla circonferenza è n; equivalentemente, zⁿ è un rivestimento n-a-1 di ℂ∖{0} su ℂ∖{0}, ramificato solo nell'origine.

Avvia la traiettoria circolare e osserva il contagiri: è la differenza strutturale più netta rispetto a z^i, dove è il MODULO, non l'argomento, a governare l'avvolgimento.`,
    stato: {
      mappa: { tipo: "potenza", n: 3, k: 0 },
      z: c(1, 0),
      dominio: { xMin: -2, xMax: 2, yMin: -2, yMax: 2 },
      traiettoria: { id: "cerchio", parametro: 1, t: 0, inRiproduzione: true },
      mostra: {
        ritrattoFase: true,
        polare: false,
        cartesiana: false,
        puntiCampione: false,
        curveImmagine: true,
        radici: true,
        tracce: false,
        taglio: false,
        contornoModulo: true,
        contornoFase: false,
      },
      tab: "traiettorie",
    },
  },
  {
    id: "corona-immagine",
    titolo: "La corona immagine",
    sommario: "Tutto il piano finisce in e^(−π) ≤ |w| < e^(π).",
    spiegazione: `Poiché |z^i| = e^(−Arg z) e Arg z ∈ (−π, π], il modulo dell'immagine è confinato in [e^(−π), e^(π)) = [0,0432…, 23,1407…).

L'argomento, invece, assume TUTTI i valori reali, perché ln|z| è surgettivo su ℝ: l'immagine è quindi la corona completa in argomento.

Precisazione importante sugli estremi:
• su ℂ∖{0}, con Arg ∈ (−π, π], la corona è SEMIAPERTA: e^(−π) ≤ |w| < e^(π), con l'estremo interno attinto sul semiasse reale negativo;
• su ℂ∖(−∞,0], con Arg ∈ (−π, π), la corona è APERTA: e^(−π) < |w| < e^(π).`,
    stato: {
      mappa: { tipo: "zi", n: 2, k: 0 },
      z: c(-0.2, 2.4),
      dominio: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 },
      stessaScala: false,
      mostra: {
        ritrattoFase: true,
        polare: true,
        cartesiana: false,
        puntiCampione: true,
        curveImmagine: true,
        radici: false,
        tracce: false,
        taglio: true,
        contornoModulo: true,
        contornoFase: false,
      },
      densita: 14,
    },
  },
];

/** Costanti mostrate accanto ai casi guidati. */
export const VALORI_NOTEVOLI = [
  { simbolo: "i^i", valore: Math.exp(-PI / 2), nota: "e^(−π/2), ramo principale" },
  { simbolo: "e^(−π)", valore: E_MENO_PI, nota: "minimo di |z^i|, attinto in z = −1" },
  { simbolo: "e^(π)", valore: E_PI, nota: "estremo superiore di |z^i|, mai attinto" },
  { simbolo: "e^(2π)", valore: Math.exp(DUE_PI), nota: "salto sul taglio, rapporto fra rami" },
];
