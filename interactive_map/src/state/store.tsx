/**
 * Stato dell'applicazione.
 *
 * Volutamente un solo `useReducer` con contesto, senza librerie esterne: lo
 * stato è piccolo e fortemente accoppiato (cambiare mappa invalida il punto
 * selezionato, cambiare dominio invalida l'inquadratura dell'immagine), e un
 * riduttore unico rende queste dipendenze esplicite e verificabili.
 */

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";

import { type Complex, c } from "../math/complex";
import type { ConfigMappa, TipoMappa } from "../math/complexMaps";
import type { Rettangolo } from "../math/curves";

export type Tab =
  | "modulo"
  | "argomento"
  | "fase"
  | "traiettorie"
  | "preimmagini"
  | "casi";

export interface Interruttori {
  cartesiana: boolean;
  polare: boolean;
  puntiCampione: boolean;
  ritrattoFase: boolean;
  curveImmagine: boolean;
  tracce: boolean;
  radici: boolean;
  taglio: boolean;
  contornoModulo: boolean;
  contornoFase: boolean;
}

export interface Stato {
  mappa: ConfigMappa;
  /** Punto selezionato nel piano del dominio. */
  z: Complex;
  /** Punto selezionato nel piano immagine, per il pannello preimmagini. */
  w: Complex;
  dominio: Rettangolo;
  /** Se vero, il piano immagine usa la stessa scala del dominio. */
  stessaScala: boolean;
  mostra: Interruttori;
  /** Numero di rette/cerchi per famiglia. */
  densita: number;
  /** Cifre decimali nei pannelli numerici. */
  precisione: number;
  /** 0 = arcobaleno classico, 1 = schema ad alta leggibilità. */
  schemaColore: 0 | 1;
  intensitaBande: number;
  tab: Tab;
  traiettoria: {
    id: string;
    parametro: number;
    t: number;
    inRiproduzione: boolean;
  };
  /** Rami di z^i mostrati contemporaneamente nel piano immagine. */
  ramiVisibili: number[];
  /** Testo esplicativo impostato dai casi guidati. */
  notaCasoGuidato: string | null;
}

const DOMINIO_PREDEFINITO: Rettangolo = { xMin: -3, xMax: 3, yMin: -3, yMax: 3 };

export const STATO_INIZIALE: Stato = {
  mappa: { tipo: "zi", n: 2, k: 0 },
  z: c(1, 1),
  w: c(0.5, 0.5),
  dominio: DOMINIO_PREDEFINITO,
  stessaScala: false,
  mostra: {
    cartesiana: false,
    polare: true,
    puntiCampione: true,
    ritrattoFase: true,
    curveImmagine: true,
    tracce: true,
    radici: true,
    taglio: true,
    contornoModulo: true,
    contornoFase: false,
  },
  densita: 12,
  precisione: 4,
  schemaColore: 0,
  intensitaBande: 1,
  tab: "casi",
  traiettoria: { id: "cerchio", parametro: 1, t: 0.25, inRiproduzione: false },
  ramiVisibili: [-1, 0, 1],
  notaCasoGuidato: null,
};

export type Azione =
  | { tipo: "imposta-mappa"; valore: TipoMappa }
  | { tipo: "imposta-n"; valore: number }
  | { tipo: "imposta-k"; valore: number }
  | { tipo: "imposta-z"; valore: Complex }
  | { tipo: "imposta-w"; valore: Complex }
  | { tipo: "imposta-dominio"; valore: Rettangolo }
  | { tipo: "zoom"; fattore: number; centro?: Complex }
  | { tipo: "reset-dominio" }
  | { tipo: "commuta"; chiave: keyof Interruttori }
  | { tipo: "imposta-densita"; valore: number }
  | { tipo: "imposta-precisione"; valore: number }
  | { tipo: "imposta-schema"; valore: 0 | 1 }
  | { tipo: "imposta-intensita"; valore: number }
  | { tipo: "imposta-stessa-scala"; valore: boolean }
  | { tipo: "imposta-tab"; valore: Tab }
  | { tipo: "imposta-traiettoria"; id?: string; parametro?: number; t?: number }
  | { tipo: "commuta-riproduzione" }
  | { tipo: "commuta-ramo"; valore: number }
  | { tipo: "applica-preset"; preset: Partial<Stato> };

export function riduttore(stato: Stato, azione: Azione): Stato {
  switch (azione.tipo) {
    case "imposta-mappa": {
      // Cambiando mappa la nota del caso guidato non è più pertinente.
      return { ...stato, mappa: { ...stato.mappa, tipo: azione.valore }, notaCasoGuidato: null };
    }
    case "imposta-n":
      return {
        ...stato,
        mappa: { ...stato.mappa, n: Math.max(2, Math.min(10, Math.round(azione.valore))) },
      };
    case "imposta-k":
      return {
        ...stato,
        mappa: { ...stato.mappa, k: Math.max(-3, Math.min(3, Math.round(azione.valore))) },
      };
    case "imposta-z":
      return { ...stato, z: azione.valore };
    case "imposta-w":
      return { ...stato, w: azione.valore };
    case "imposta-dominio":
      return { ...stato, dominio: azione.valore };
    case "zoom": {
      const { xMin, xMax, yMin, yMax } = stato.dominio;
      const cx = azione.centro ? azione.centro.re : (xMin + xMax) / 2;
      const cy = azione.centro ? azione.centro.im : (yMin + yMax) / 2;
      const f = azione.fattore;
      const semiX = Math.min(Math.max(((xMax - xMin) / 2) * f, 0.05), 400);
      const semiY = Math.min(Math.max(((yMax - yMin) / 2) * f, 0.05), 400);
      return {
        ...stato,
        dominio: { xMin: cx - semiX, xMax: cx + semiX, yMin: cy - semiY, yMax: cy + semiY },
      };
    }
    case "reset-dominio":
      return { ...stato, dominio: DOMINIO_PREDEFINITO };
    case "commuta":
      return {
        ...stato,
        mostra: { ...stato.mostra, [azione.chiave]: !stato.mostra[azione.chiave] },
      };
    case "imposta-densita":
      return { ...stato, densita: Math.max(3, Math.min(30, Math.round(azione.valore))) };
    case "imposta-precisione":
      return { ...stato, precisione: Math.max(2, Math.min(12, Math.round(azione.valore))) };
    case "imposta-schema":
      return { ...stato, schemaColore: azione.valore };
    case "imposta-intensita":
      return { ...stato, intensitaBande: Math.max(0, Math.min(1, azione.valore)) };
    case "imposta-stessa-scala":
      return { ...stato, stessaScala: azione.valore };
    case "imposta-tab":
      return { ...stato, tab: azione.valore };
    case "imposta-traiettoria":
      return {
        ...stato,
        traiettoria: {
          ...stato.traiettoria,
          ...(azione.id !== undefined ? { id: azione.id } : {}),
          ...(azione.parametro !== undefined ? { parametro: azione.parametro } : {}),
          ...(azione.t !== undefined ? { t: azione.t } : {}),
        },
      };
    case "commuta-riproduzione":
      return {
        ...stato,
        traiettoria: {
          ...stato.traiettoria,
          inRiproduzione: !stato.traiettoria.inRiproduzione,
        },
      };
    case "commuta-ramo": {
      const presente = stato.ramiVisibili.includes(azione.valore);
      const rami = presente
        ? stato.ramiVisibili.filter((k) => k !== azione.valore)
        : [...stato.ramiVisibili, azione.valore].sort((a, b) => a - b);
      return { ...stato, ramiVisibili: rami };
    }
    case "applica-preset":
      return {
        ...stato,
        ...azione.preset,
        mostra: { ...stato.mostra, ...(azione.preset.mostra ?? {}) },
        mappa: { ...stato.mappa, ...(azione.preset.mappa ?? {}) },
        traiettoria: { ...stato.traiettoria, ...(azione.preset.traiettoria ?? {}) },
      };
    default:
      return stato;
  }
}

const ContestoStato = createContext<Stato>(STATO_INIZIALE);
const ContestoDispatch = createContext<Dispatch<Azione>>(() => undefined);

export function FornitoreStato({ children }: { children: ReactNode }) {
  const [stato, dispatch] = useReducer(riduttore, STATO_INIZIALE);
  const valore = useMemo(() => stato, [stato]);
  return (
    <ContestoStato.Provider value={valore}>
      <ContestoDispatch.Provider value={dispatch}>{children}</ContestoDispatch.Provider>
    </ContestoStato.Provider>
  );
}

export function useStato(): Stato {
  return useContext(ContestoStato);
}

export function useDispatch(): Dispatch<Azione> {
  return useContext(ContestoDispatch);
}
