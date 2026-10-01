/**
 * Dichiarazione minima per `plotly.js-dist-min`, che non distribuisce tipi.
 *
 * Si dichiarano solo le funzioni effettivamente usate: una tipizzazione finta
 * ma completa darebbe una falsa sicurezza, mentre questa rende esplicito che
 * l'interfaccia verso Plotly è volutamente ristretta.
 */
declare module "plotly.js-dist-min" {
  interface PlotlyStatico {
    react(
      contenitore: HTMLElement,
      dati: unknown[],
      layout?: unknown,
      configurazione?: unknown
    ): Promise<unknown>;
    newPlot(
      contenitore: HTMLElement,
      dati: unknown[],
      layout?: unknown,
      configurazione?: unknown
    ): Promise<unknown>;
    purge(contenitore: HTMLElement): void;
  }
  const Plotly: PlotlyStatico;
  export default Plotly;
}
