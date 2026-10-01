/**
 * Verifica funzionale end-to-end dell'applicazione.
 *
 * Avvia Chrome in modalità headless, carica l'app e pilota l'interfaccia via
 * Chrome DevTools Protocol, controllando sia i comandi sia i valori matematici
 * mostrati. Non richiede alcuna dipendenza: Node 22+ espone `fetch` e
 * `WebSocket` come globali, quindi niente Playwright o Puppeteer da installare.
 *
 * Uso:
 *     npm run dev              (in un altro terminale)
 *     npm run verifica:ui
 *
 * Opzioni via variabili d'ambiente:
 *     URL_APP     indirizzo dell'app          (default http://localhost:5173/)
 *     CHROME      percorso dell'eseguibile    (default: ricerca automatica)
 *                 (la porta di debug viene assegnata dal sistema)
 *     MOSTRA=1    avvia Chrome con finestra visibile
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL_APP = process.env.URL_APP ?? "http://localhost:5173/";

const CANDIDATI_CHROME = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

function trovaChrome() {
  const trovato = CANDIDATI_CHROME.find((p) => existsSync(p));
  if (!trovato) {
    throw new Error(
      "Chrome non trovato. Indica il percorso con la variabile d'ambiente CHROME."
    );
  }
  return trovato;
}

// ---------------------------------------------------------------------------
// Minimo client CDP
// ---------------------------------------------------------------------------

let idMessaggio = 0;
const inAttesa = new Map();
let ws;
const erroriPagina = [];

function invia(metodo, parametri = {}) {
  const id = ++idMessaggio;
  return new Promise((risolvi, rifiuta) => {
    inAttesa.set(id, { risolvi, rifiuta });
    ws.send(JSON.stringify({ id, method: metodo, params: parametri }));
    setTimeout(() => {
      if (inAttesa.has(id)) {
        inAttesa.delete(id);
        rifiuta(new Error(`timeout su ${metodo}`));
      }
    }, 30000);
  });
}

async function valuta(espressione) {
  const r = await invia("Runtime.evaluate", {
    expression: espressione,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error(
      `errore in pagina: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`
    );
  }
  return r.result.value;
}

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

const esiti = [];
function controlla(nome, condizione, dettaglio = "") {
  const ok = Boolean(condizione);
  esiti.push({ nome, ok, dettaglio });
  console.log(`  ${ok ? "\u2713" : "\u2717"}  ${nome}${dettaglio ? `  — ${dettaglio}` : ""}`);
}

// ---------------------------------------------------------------------------
// Avvio del browser
// ---------------------------------------------------------------------------

const profilo = mkdtempSync(join(tmpdir(), "verifica-chrome-"));
const chrome = spawn(
  trovaChrome(),
  [
    ...(process.env.MOSTRA ? [] : ["--headless=new"]),
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${profilo}`,
    // WebGL via rasterizzatore software: il ritratto di fase deve funzionare
    // anche su macchine di integrazione continua senza GPU.
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--window-size=1700,1400",
    // Porta 0 = assegnata dal sistema, poi letta da DevToolsActivePort.
    // Con una porta fissa, se un'altra istanza di Chrome la sta gia' usando la
    // nuova non riesce ad aprirla e lo script si aggancia inavvertitamente al
    // browser sbagliato, dove l'app non e' caricata: i controlli fallirebbero
    // tutti per un motivo che non ha nulla a che vedere con l'app.
    "--remote-debugging-port=0",
    "about:blank",
  ],
  { stdio: "ignore", detached: false }
);

function chiudi(codice) {
  try {
    ws?.close();
  } catch {
    /* già chiuso */
  }
  try {
    chrome.kill();
  } catch {
    /* già terminato */
  }
  try {
    rmSync(profilo, { recursive: true, force: true });
  } catch {
    /* profilo temporaneo: se resta, poco male */
  }
  process.exit(codice);
}

process.on("SIGINT", () => chiudi(130));

// Chrome scrive la porta effettivamente assegnata nella prima riga del file
// DevToolsActivePort dentro il proprio profilo.
let PORTA = null;
const fileporta = join(profilo, "DevToolsActivePort");
for (let tentativo = 0; tentativo < 80 && PORTA === null; tentativo += 1) {
  await attendi(125);
  try {
    const righe = readFileSync(fileporta, "utf-8").split("\n");
    const n = Number(righe[0].trim());
    if (Number.isInteger(n) && n > 0) PORTA = n;
  } catch {
    /* non ancora scritto */
  }
}
if (PORTA === null) {
  console.error("Chrome non ha aperto alcuna porta di debug.");
  chiudi(1);
}

let versione = null;
for (let tentativo = 0; tentativo < 40 && !versione; tentativo += 1) {
  try {
    versione = await (await fetch(`http://127.0.0.1:${PORTA}/json/version`)).json();
  } catch {
    await attendi(250);
  }
}
if (!versione) {
  console.error(`Chrome non risponde sulla porta di debug ${PORTA}.`);
  chiudi(1);
}

const elenco = await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json();
const pagina = elenco.find((t) => t.type === "page");
ws = new WebSocket(pagina.webSocketDebuggerUrl);
await new Promise((risolvi, rifiuta) => {
  ws.onopen = risolvi;
  ws.onerror = rifiuta;
});
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && inAttesa.has(m.id)) {
    const { risolvi, rifiuta } = inAttesa.get(m.id);
    inAttesa.delete(m.id);
    m.error ? rifiuta(new Error(m.error.message)) : risolvi(m.result);
  } else if (m.method === "Runtime.exceptionThrown") {
    erroriPagina.push(
      `${m.params.exceptionDetails.text} ${m.params.exceptionDetails.exception?.description ?? ""}`
    );
  } else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    erroriPagina.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  }
};

await invia("Runtime.enable");
await invia("Page.enable");
await invia("Page.navigate", { url: URL_APP });

/**
 * Attende che una condizione sia vera nella pagina.
 *
 * Un'attesa a tempo fisso e' inaffidabile: dopo un'invalidazione HMR, o su una
 * macchina carica, il montaggio puo' richiedere parecchio piu' del previsto, e
 * i controlli successivi fallirebbero tutti per un motivo che non c'entra
 * nulla con quello che vogliono verificare.
 */
async function attendiCondizione(espressione, descrizione, limiteMs = 25000) {
  const scadenza = Date.now() + limiteMs;
  let ultimoErrore = null;
  let ultimoValore = null;
  while (Date.now() < scadenza) {
    try {
      ultimoValore = await valuta(espressione);
      if (ultimoValore) return true;
    } catch (e) {
      ultimoErrore = e;
    }
    await attendi(250);
  }
  console.error(`\nTimeout in attesa di: ${descrizione}`);
  console.error(`  espressione: ${espressione}`);
  console.error(`  ultimo valore: ${JSON.stringify(ultimoValore)}`);
  if (ultimoErrore) console.error(`  ultimo errore: ${ultimoErrore.message}`);
  try {
    console.error(
      "  stato pagina: " +
        (await valuta(
          "JSON.stringify({url: location.href, pronto: document.readyState, radice: document.getElementById('radice')?.innerHTML.length ?? -1, app: !!document.querySelector('.app'), canvas: document.querySelectorAll('.piano__tela canvas').length})"
        ))
    );
  } catch (e) {
    console.error(`  impossibile leggere lo stato: ${e.message}`);
  }
  chiudi(1);
}

await attendiCondizione(
  "!!document.querySelector('.app') && document.querySelectorAll('.piano__tela canvas').length === 2",
  "il montaggio dell'applicazione"
);
// Un attimo in piu' perche' ResizeObserver assegni le dimensioni definitive.
await attendi(800);

// ---------------------------------------------------------------------------
// Utilità iniettate nella pagina
// ---------------------------------------------------------------------------

await valuta(String.raw`
window.__t = {
  valore: (etichetta) => {
    const r = [...document.querySelectorAll('.tabella-valori tr')]
      .find(x => x.querySelector('th')?.textContent.trim().includes(etichetta));
    return r ? r.querySelector('td').textContent.trim() : null;
  },
  tab: (nome) => {
    const b = [...document.querySelectorAll('.tab button')].find(x => x.textContent.includes(nome));
    if (!b) return false; b.click(); return true;
  },
  caso: (nome) => {
    const b = [...document.querySelectorAll('.caso')].find(x => x.textContent.includes(nome));
    if (!b) return false; b.click(); return true;
  },
  premi: (testo) => {
    const b = [...document.querySelectorAll('button')]
      .find(x => x.textContent.replace(/\s+/g,' ').trim().includes(testo));
    if (!b) return false; b.click(); return true;
  },
  mappa: (indice) => {
    const b = [...document.querySelectorAll('.controlli .segmentato button')][indice];
    if (!b) return false; b.click(); return true;
  },
  spunta: (etichetta) => {
    const l = [...document.querySelectorAll('label')].find(x => x.textContent.includes(etichetta));
    const i = l?.querySelector('input[type=checkbox]');
    if (!i) return null; i.click(); return i.checked;
  },
  slider: (etichetta, valore) => {
    const l = [...document.querySelectorAll('label.campo')].find(x => x.textContent.includes(etichetta));
    const i = l?.querySelector('input[type=range]');
    if (!i) return null;
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    s.call(i, String(valore)); i.dispatchEvent(new Event('input', { bubbles: true }));
    return i.value;
  },
  numerico: (etichetta, valore) => {
    const l = [...document.querySelectorAll('label.campo--numerico')]
      .find(x => x.querySelector('span')?.textContent.trim() === etichetta);
    const i = l?.querySelector('input[type=number]');
    if (!i) return null;
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    s.call(i, String(valore)); i.dispatchEvent(new Event('input', { bubbles: true }));
    return i.value;
  },
  clicPiano: (indice, fx, fy) => {
    const svg = document.querySelectorAll('.piano__overlay')[indice];
    if (!svg) return false;
    const r = svg.getBoundingClientRect();
    const o = { bubbles:true, cancelable:true, pointerId:1, pointerType:'mouse', isPrimary:true, buttons:1,
                clientX: r.left + r.width*fx, clientY: r.top + r.height*fy };
    svg.dispatchEvent(new PointerEvent('pointerdown', o));
    svg.dispatchEvent(new PointerEvent('pointerup', o));
    return true;
  },
  trascina: (indice, x0, y0, x1, y1) => {
    const svg = document.querySelectorAll('.piano__overlay')[indice];
    const r = svg.getBoundingClientRect();
    const p = (fx, fy) => ({ clientX: r.left + r.width*fx, clientY: r.top + r.height*fy });
    const o = { bubbles:true, cancelable:true, pointerId:1, pointerType:'mouse', isPrimary:true, buttons:1 };
    svg.dispatchEvent(new PointerEvent('pointerdown', {...o, ...p(x0,y0)}));
    svg.dispatchEvent(new PointerEvent('pointermove', {...o, ...p((x0+x1)/2,(y0+y1)/2)}));
    svg.dispatchEvent(new PointerEvent('pointermove', {...o, ...p(x1,y1)}));
    svg.dispatchEvent(new PointerEvent('pointerup',   {...o, ...p(x1,y1)}));
    return true;
  },
  rotella: (indice, deltaY) => {
    const svg = document.querySelectorAll('.piano__overlay')[indice];
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const ev = new WheelEvent('wheel', {
      bubbles: true, cancelable: true, deltaY, deltaMode: 0,
      clientX: r.left + r.width * 0.5, clientY: r.top + r.height * 0.5,
    });
    svg.dispatchEvent(ev);
    // defaultPrevented === true dimostra che l'ascoltatore NON e' passivo,
    // quindi il browser non fara' scorrere la pagina.
    return { annullato: ev.defaultPrevented };
  },
  semilato: () => parseFloat([...document.querySelectorAll('input[type=number]')][0].value),
  conta: (sel) => document.querySelectorAll(sel).length,
  testo: (sel) => document.querySelector(sel)?.textContent ?? null,
};
'pronto'`);

console.log(`\nVerifica funzionale — ${URL_APP}  (${versione.Browser})\n`);

// ---------------------------------------------------------------------------
// 1. Montaggio e resa
// ---------------------------------------------------------------------------
console.log("Montaggio e resa");
controlla("la pagina monta", (await valuta("!!document.querySelector('.app')")) === true);
controlla("ci sono due piani complessi", (await valuta("window.__t.conta('.piano')")) === 2);
controlla(
  "il ritratto di fase WebGL si inizializza senza ripiego",
  (await valuta("window.__t.conta('.piano__errore')")) === 0
);
const larghezzaCanvas = await valuta(
  "document.querySelector('.piano__tela canvas')?.width ?? 0"
);
controlla(
  "il canvas supera la risoluzione minima richiesta (500 px)",
  larghezzaCanvas >= 500,
  `${larghezzaCanvas} px di lato`
);

// ---------------------------------------------------------------------------
// 2. Valori matematici
// ---------------------------------------------------------------------------
console.log("\nValori matematici");
const modulo0 = await valuta("window.__t.valore('|f(z)|')");
const arg0 = await valuta("window.__t.valore('Arg f(z)')");
controlla(
  "|f(1+i)| = e^(−π/4) = 0,4559",
  Math.abs(parseFloat(modulo0) - Math.exp(-Math.PI / 4)) < 1e-3,
  `letto ${modulo0}`
);
controlla(
  "Arg f(1+i) = ln√2 = 0,3466",
  Math.abs(parseFloat(arg0) - 0.5 * Math.log(2)) < 1e-3,
  `letto ${arg0}`
);

await valuta("window.__t.numerico('Re z', 0)");
await valuta("window.__t.numerico('Im z', 1)");
await attendi(350);
const fi = await valuta("window.__t.valore('f(z)')");
controlla(
  "z = i dà i^i = e^(−π/2) ≈ 0,2079 (reale)",
  Math.abs(parseFloat(fi) - Math.exp(-Math.PI / 2)) < 1e-3 && fi.includes("0.0000 i"),
  `f(z) = ${fi}`
);

await valuta("window.__t.numerico('Re z', -1)");
await valuta("window.__t.numerico('Im z', 0)");
await attendi(350);
const fMeno1 = await valuta("window.__t.valore('|f(z)|')");
controlla(
  "z = −1 (sul taglio) dà |f(z)| = e^(−π) ≈ 0,0432, il minimo della corona",
  Math.abs(parseFloat(fMeno1) - Math.exp(-Math.PI)) < 1e-3,
  `letto ${fMeno1}`
);
controlla(
  "sul taglio di ramo compare l'avviso matematico",
  (await valuta("window.__t.conta('.avviso')")) > 0
);

// ---------------------------------------------------------------------------
// 3. Interazione sui piani
// ---------------------------------------------------------------------------
console.log("\nInterazione sui piani");
const zPrima = await valuta("window.__t.valore('z')");
await valuta("window.__t.clicPiano(0, 0.75, 0.25)");
await attendi(300);
const zDopo = await valuta("window.__t.valore('z')");
controlla("il clic sul piano del dominio seleziona z", zPrima !== zDopo, `${zPrima} → ${zDopo}`);

await valuta("window.__t.trascina(0, 0.75, 0.25, 0.3, 0.7)");
await attendi(300);
const zTrascinato = await valuta("window.__t.valore('z')");
controlla("il trascinamento sposta z con continuità", zTrascinato !== zDopo, `→ ${zTrascinato}`);

// Regressione: con `onWheel` di React l'ascoltatore e' passivo, quindi
// `preventDefault()` viene ignorato e la rotella zooma il piano E fa scorrere
// la pagina insieme. L'ascoltatore deve essere registrato con passive: false.
const prima = await valuta("window.__t.semilato()");
const giuRotella = await valuta("window.__t.rotella(0, 120)");
await attendi(300);
const dopoDezoom = await valuta("window.__t.semilato()");
controlla(
  "la rotella sul piano annulla lo scorrimento della pagina (listener non passivo)",
  giuRotella?.annullato === true,
  giuRotella?.annullato ? "preventDefault efficace" : "ATTENZIONE: la pagina scorrerebbe"
);
controlla(
  "la rotella verso il basso allarga la finestra (dezoom)",
  dopoDezoom > prima,
  `semilato ${prima} → ${dopoDezoom}`
);

await valuta("window.__t.rotella(0, -120)");
await attendi(300);
const dopoZoom = await valuta("window.__t.semilato()");
controlla(
  "lo zoom inverso riporta alla finestra di partenza",
  Math.abs(dopoZoom - prima) < 1e-6,
  `semilato ${dopoDezoom} → ${dopoZoom} (atteso ${prima})`
);

const rotellaImmagine = await valuta("window.__t.rotella(1, 120)");
controlla(
  "sul piano immagine, non zoomabile, la pagina resta libera di scorrere",
  rotellaImmagine?.annullato === false
);

// ---------------------------------------------------------------------------
// 4. Controlli
// ---------------------------------------------------------------------------
console.log("\nControlli");
await valuta("window.__t.mappa(2)"); // z^i rami
await attendi(300);
controlla(
  "la mappa «z^i rami» espone lo slider del ramo k",
  (await valuta("/ramo k =/.test(document.body.textContent)")) === true
);
await valuta("window.__t.slider('ramo k', 2)");
await attendi(300);
controlla(
  "lo slider del ramo k aggiorna il ramo",
  (await valuta("/ramo k = *2/.test(document.body.textContent)")) === true
);

await valuta("window.__t.mappa(0)"); // z^n
await attendi(300);
await valuta("window.__t.slider('esponente n', 5)");
await attendi(400);
const nRadici = await valuta("document.body.textContent.match(/Le (\\d+) radici/)?.[1] ?? null");
controlla("con n = 5 il pannello annuncia 5 radici", nRadici === "5", `letto «${nRadici}»`);
controlla(
  "le 5 radici sono effettivamente elencate",
  (await valuta("window.__t.conta('.sezione .elenco-valori li')")) === 5
);
controlla(
  "la radice corrispondente a z è marcata",
  (await valuta("!!document.querySelector('.badge')")) === true
);

const grigliaAccesa = await valuta("window.__t.spunta('Griglia cartesiana')");
await attendi(400);
controlla("l'interruttore della griglia cartesiana risponde", grigliaAccesa === true);
const nPath = await valuta("window.__t.conta('.piano__overlay path')");
controlla("le curve vengono disegnate nei due piani", nPath > 50, `${nPath} tracciati`);

await valuta("window.__t.premi('Zoom +')");
await attendi(200);
const semilatoZoom = await valuta(
  "[...document.querySelectorAll('input[type=number]')][0].value"
);
await valuta("window.__t.premi('Reset')");
await attendi(250);
const semilatoReset = await valuta(
  "[...document.querySelectorAll('input[type=number]')][0].value"
);
controlla(
  "Zoom e Reset del dominio funzionano",
  parseFloat(semilatoZoom) < 3 && Math.abs(parseFloat(semilatoReset) - 3) < 1e-6,
  `zoom → ${semilatoZoom}, reset → ${semilatoReset}`
);

// ---------------------------------------------------------------------------
// 5. Pannelli secondari
// ---------------------------------------------------------------------------
console.log("\nPannelli secondari");
await valuta("window.__t.tab('Casi guidati')");
await attendi(300);
await valuta("window.__t.caso('non è iniettiva')");
await attendi(500);
const spiegazione = (await valuta("window.__t.testo('.spiegazione')")) ?? "";
controlla(
  "il caso guidato sulla non iniettività mostra la dimostrazione",
  spiegazione.includes("Controesempio") && spiegazione.includes("e^(2π)"),
  `${spiegazione.length} caratteri di spiegazione`
);
controlla(
  "il preset commuta effettivamente la mappa a z^i",
  (await valuta("/z\\^i = exp/.test(window.__t.testo('.formula-corrente') ?? '')")) === true
);

await valuta("window.__t.tab('Traiettorie')");
await attendi(600);
const giriZi = parseFloat(await valuta("window.__t.valore('avvolgimenti')"));
controlla(
  "sotto z^i la circonferenza unitaria non avvolge l'origine (0 giri)",
  Math.abs(giriZi) < 1e-6,
  `${giriZi} giri — l'immagine è un segmento reale`
);

await valuta("window.__t.mappa(0)"); // z^n
await attendi(300);
await valuta("window.__t.slider('esponente n', 3)");
await attendi(600);
const giriZ3 = parseFloat(await valuta("window.__t.valore('avvolgimenti')"));
controlla(
  "sotto z^3 la stessa circonferenza avvolge 3 volte l'origine",
  Math.abs(giriZ3 - 3) < 1e-6,
  `${giriZ3} giri`
);

await valuta("window.__t.tab('Preimmagini')");
await attendi(400);
await valuta("window.__t.clicPiano(1, 0.62, 0.42)");
await attendi(400);
const nPre = await valuta("window.__t.conta('.pannello-preimmagini .elenco-valori li')");
controlla(
  "il clic sul piano immagine elenca le preimmagini",
  nPre === 3,
  `${nPre} preimmagini per z^3`
);

await valuta("window.__t.tab('Ritratto di fase')");
await attendi(400);
controlla(
  "la legenda disegna la ruota dei colori",
  (await valuta("document.querySelector('.ruota-colori')?.width")) > 0
);

await valuta("window.__t.tab('Modulo')");
await attendi(7000);
controlla(
  "il pannello Modulo carica Plotly e disegna la superficie 3D",
  (await valuta("window.__t.conta('.contenitore-plotly .plot-container')")) > 0,
  (await valuta("window.__t.testo('.nota--allerta')")) ?? "nessun errore"
);

await valuta("window.__t.tab('Argomento')");
await attendi(6000);
controlla(
  "il pannello Argomento disegna la superficie della fase",
  (await valuta("window.__t.conta('.contenitore-plotly .plot-container')")) > 0
);

// ---------------------------------------------------------------------------
// 6. Igiene
// ---------------------------------------------------------------------------
console.log("\nIgiene");
const erroriVeri = erroriPagina.filter((e) => !/favicon|DevTools|Download the React/i.test(e));
controlla(
  "nessun errore JavaScript non gestito",
  erroriVeri.length === 0,
  erroriVeri.slice(0, 2).join(" | ")
);

// ---------------------------------------------------------------------------
const falliti = esiti.filter((e) => !e.ok);
console.log(`\n${esiti.length - falliti.length}/${esiti.length} controlli superati`);
if (falliti.length) {
  console.log("\nFalliti:");
  for (const f of falliti) console.log(`  - ${f.nome} ${f.dettaglio}`);
}
chiudi(falliti.length ? 1 : 0);
