/**
 * Confronto numerico diretto fra i due nuclei matematici del progetto.
 *
 * `../video_animation/complex_maps.py` (NumPy, vettorizzato) e
 * `../src/math/complexMaps.ts` (TypeScript, scalare) sono implementazioni
 * indipendenti delle stesse funzioni. Le rispettive suite di test verificano
 * le stesse identità analitiche, ma questo non basta a escludere che divergano
 * su un valore concreto: due implementazioni possono soddisfare le medesime
 * identità e restituire numeri diversi, per esempio scegliendo un diverso
 * rappresentante dell'argomento.
 *
 * Questo script chiude il buco: esegue entrambe sugli stessi punti e confronta
 * i valori uno a uno.
 *
 * Uso:
 *     npm run confronta
 *     PYTHON=/percorso/python npm run confronta
 *
 * Il modulo TypeScript viene transpilato al volo con esbuild, che è già
 * presente come dipendenza di Vite: nessun pacchetto aggiuntivo.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE_APP = resolve(QUI, "..");
const DIR_VIDEO = resolve(RADICE_APP, "..", "video_animation");

/** Il Python del venv del progetto, se esiste; altrimenti quello di sistema. */
function trovaPython() {
  if (process.env.PYTHON) return process.env.PYTHON;
  const candidati = [
    join(DIR_VIDEO, ".venv", "Scripts", "python.exe"),
    join(DIR_VIDEO, ".venv", "bin", "python"),
  ];
  return candidati.find((p) => existsSync(p)) ?? "python";
}

const PUNTI = [
  [1, 0], [0, 1], [0, -1], [1, 1], [0, 2], [2, 0], [0.5, 0],
  [-1, 1], [-0.5, -0.5], [-1, 0], [-2, 0], [3, 0.1], [0.08, 0.06],
  [-0.7, 0.7], [-1.2, -0.9], [0.5, -0.25], [7.3, -4.1], [0.01, 0.02],
  [Math.exp(2 * Math.PI), 0], [1e-6, 1e-6], [120, -75],
];

const ESPONENTI = [2, 3, 5, 10];
const RAMI = [-2, -1, 0, 1, 2];

// ---------------------------------------------------------------------------
// Lato Python
// ---------------------------------------------------------------------------

const script = `
import json, sys
sys.path.insert(0, r"${DIR_VIDEO}")
import complex_maps as cm

punti = ${JSON.stringify(PUNTI)}
esponenti = ${JSON.stringify(ESPONENTI)}
rami = ${JSON.stringify(RAMI)}

def coppia(w):
    return [w.real, w.imag]

fuori = []
for x, y in punti:
    z = complex(x, y)
    fuori.append({
        "z": [x, y],
        "arg": cm.arg_principal(z),
        "log": coppia(cm.principal_log(z)),
        "zi": coppia(cm.map_z_i_principal(z)),
        "zi_mod": cm.z_i_modulus(z),
        "zi_arg": cm.z_i_argument(z),
        "derivata_zi": coppia(cm.derivative_z_i(z)),
        "pot": {str(n): coppia(cm.map_z_power(z, n)) for n in esponenti},
        "rami": {str(k): coppia(cm.map_z_i_branch(z, k)) for k in rami},
        "radici5": [coppia(r) for r in cm.compute_nth_roots(z, 5)],
        "corona": list(cm.injectivity_annulus(z)),
    })
print(json.dumps(fuori))
`;

const python = trovaPython();
let riferimento;
try {
  riferimento = JSON.parse(
    execFileSync(python, ["-c", script], { encoding: "utf-8", maxBuffer: 1 << 24 })
  );
} catch (e) {
  console.error(
    `Impossibile eseguire il nucleo Python con «${python}».\n` +
      "Crea il venv in ../video_animation (vedi il suo README) oppure indica\n" +
      "l'interprete con la variabile d'ambiente PYTHON.\n"
  );
  console.error(e.stderr?.toString?.() ?? e.message);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Lato TypeScript
// ---------------------------------------------------------------------------

const esbuild = await import(
  pathToFileURL(join(RADICE_APP, "node_modules", "esbuild", "lib", "main.js")).href
);

async function carica(percorso) {
  const esito = await esbuild.build({
    entryPoints: [percorso],
    bundle: true,
    format: "esm",
    write: false,
    platform: "neutral",
  });
  const codice = Buffer.from(esito.outputFiles[0].text).toString("base64");
  return import(`data:text/javascript;base64,${codice}`);
}

const M = await carica(join(RADICE_APP, "src", "math", "complexMaps.ts"));
const C = await carica(join(RADICE_APP, "src", "math", "complex.ts"));

// ---------------------------------------------------------------------------
// Confronto
// ---------------------------------------------------------------------------

const TOLLERANZA = 1e-12;
let confronti = 0;
const divergenze = [];

function confronta(nome, atteso, ottenuto, punto) {
  confronti += 1;
  if (Number.isNaN(atteso) && Number.isNaN(ottenuto)) return;
  const scala = Math.max(1, Math.abs(atteso), Math.abs(ottenuto));
  if (!(Math.abs(atteso - ottenuto) <= TOLLERANZA * scala)) {
    divergenze.push(`${nome} in z = ${punto}:  python ${atteso}  ≠  ts ${ottenuto}`);
  }
}

function confrontaC(nome, atteso, ottenuto, punto) {
  confronta(`${nome}.re`, atteso[0], ottenuto.re, punto);
  confronta(`${nome}.im`, atteso[1], ottenuto.im, punto);
}

for (const v of riferimento) {
  const z = { re: v.z[0], im: v.z[1] };
  const et = `${v.z[0]}${v.z[1] < 0 ? "−" : "+"}${Math.abs(v.z[1])}i`;

  confronta("arg_principal", v.arg, C.argPrincipal(z), et);
  confrontaC("principal_log", v.log, M.principalLog(z), et);
  confrontaC("map_z_i_principal", v.zi, M.mapZiPrincipal(z), et);
  confronta("z_i_modulus", v.zi_mod, M.ziModulus(z), et);
  confronta("z_i_argument", v.zi_arg, M.ziArgument(z), et);
  confrontaC("derivative_z_i", v.derivata_zi, M.derivativeZi(z), et);

  for (const n of ESPONENTI) {
    confrontaC(`map_z_power(n=${n})`, v.pot[String(n)], M.mapZPower(z, n), et);
  }
  for (const k of RAMI) {
    confrontaC(`map_z_i_branch(k=${k})`, v.rami[String(k)], M.mapZiBranch(z, k), et);
  }
  const radici = M.computeNthRoots(z, 5);
  v.radici5.forEach((r, idx) => confrontaC(`compute_nth_roots[${idx}]`, r, radici[idx], et));

  const corona = M.injectivityAnnulus(z);
  confronta("injectivity_annulus.min", v.corona[0], corona.rMin, et);
  confronta("injectivity_annulus.max", v.corona[1], corona.rMax, et);
}

console.log(`\nConfronto Python ↔ TypeScript su ${riferimento.length} punti`);
console.log(`${confronti} valori confrontati, tolleranza relativa ${TOLLERANZA}`);

if (divergenze.length === 0) {
  console.log("Nessuna divergenza: i due nuclei producono gli stessi numeri.\n");
} else {
  console.log(`\n${divergenze.length} divergenze:`);
  for (const d of divergenze.slice(0, 25)) console.log("  " + d);
  if (divergenze.length > 25) console.log(`  … e altre ${divergenze.length - 25}`);
  console.log();
  process.exit(1);
}
