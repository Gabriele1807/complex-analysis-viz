# Potenze complesse: `z^n` e `z^i`

Due strumenti complementari per studiare la differenza strutturale fra la
potenza intera e la potenza a esponente immaginario, a livello di corso di
analisi complessa.

| | |
|---|---|
| **[`video_animation/`](video_animation/)** | Sei scene Manim che espongono il ragionamento in forma lineare: definizioni, logaritmo principale, taglio di ramo, avvolgimento, radici `n`-esime, multivalenza, confronto formale. ≈ 4 min 25 s. |
| **[`interactive_map/`](interactive_map/)** | Applicazione web per verificare lo stesso ragionamento su qualunque punto: due piani affiancati, ritratto di fase in WebGL, pannello matematico, superfici 3D, traiettorie, preimmagini, dieci casi guidati. |

Il video espone, l'app permette di controllare. Condividono le convenzioni, le
definizioni e le quattro correzioni matematiche elencate più sotto.

---

## Avvio rapido

```powershell
# Video
cd video_animation
python -m venv .venv --system-site-packages
.venv\Scripts\python -m pip install pytest imageio-ffmpeg
.venv\Scripts\python -m pytest -q
.venv\Scripts\python -m manim -qh scenes.py S01Intro
.venv\Scripts\python concatena.py

# App interattiva
cd ..\interactive_map
npm install
npm run dev          # http://localhost:5173
```

I README delle due cartelle contengono installazione, comandi, architettura,
configurazione e risoluzione dei problemi in dettaglio.

---

## Pubblicazione su Vercel

L'app è una **cartella statica senza backend**: si pubblica così com'è.

Il file `vercel.json` nella radice contiene già tutto, quindi importando il
repository su Vercel **non serve configurare nulla**:

```json
{
  "installCommand": "cd interactive_map && npm install",
  "buildCommand": "cd interactive_map && npm run build",
  "outputDirectory": "interactive_map/dist"
}
```

1. su [vercel.com/new](https://vercel.com/new), importa il repository;
2. lascia tutte le impostazioni come sono e premi **Deploy**.

In alternativa, se preferisci non usare `vercel.json`, puoi cancellarlo e
impostare nel pannello di Vercel **Root Directory = `interactive_map`**: il
preset Vite viene riconosciuto da solo.

Oppure da riga di comando, dalla radice del repository:

```bash
npx vercel          # anteprima
npx vercel --prod   # produzione
```

### I video non vengono pubblicati

`vercel.json` costruisce solo `interactive_map/`, quindi i file in
`video_animation/media/` restano nel repository ma **non** finiscono sul sito.
È voluto: sono 48 MB che il sito non usa.

Per pubblicare anche il video insieme all'app, copialo fra le risorse statiche
prima della build:

```bash
mkdir -p interactive_map/public
cp video_animation/media/videos/potenze_complesse_1080p60.mp4 interactive_map/public/
```

e aggiungi il riferimento nell'app; il file sarà poi raggiungibile a
`/potenze_complesse_1080p60.mp4`. Tieni presente che aggiunge ~19 MB a ogni
distribuzione: per un uso reale conviene appoggiarlo a YouTube, a Vercel Blob o
a un altro servizio di hosting video.

---

## Convenzioni comuni

- `Arg z ∈ (−π, π]`, con il semiasse reale negativo normalizzato a `+π`.
- `Log z = ln|z| + i·Arg z`, definito su `ℂ∖{0}`, olomorfo su `ℂ∖(−∞,0]`.
- `log_k z = ln|z| + i(Arg z + 2πk)`, `k ∈ ℤ`.
- `z^i := exp(i·Log z)` salvo indicazione esplicita del ramo `k`.

Da cui le due identità che reggono tutto il confronto:

```
z^n = r^n e^(inθ)        →  |z^n| = |z|^n          arg(z^n) = n·arg z
z^i = e^(−θ) e^(i ln r)  →  |z^i| = e^(−Arg z)     arg(z^i) = ln|z|
```

`z^n` conserva i ruoli di modulo e argomento; `z^i` li **scambia**. È la
differenza da cui discende tutto il resto.

---

## Le quattro correzioni matematiche

Punti in cui entrambi i deliverable si discostano, deliberatamente, da
formulazioni diffuse ma imprecise. Ciascuno è verificato da test automatici in
entrambe le implementazioni.

**1. `z^i` non è iniettiva su `ℂ∖(−∞,0]`: è ∞-a-1.**
Da `z^i = e^{−θ}e^{i ln r}`, l'uguaglianza `z₁^i = z₂^i` equivale a `θ₁ = θ₂`
**e** `ln r₁ − ln r₂ ∈ 2πℤ`, cioè `z₂ = z₁e^{2πm}`. Controesempio minimo:
`1^i = (e^{2π})^i = 1`, due punti del piano tagliato distanti più di 534. Il ramo
principale è iniettivo soltanto su una corona `{e^a < |z| < e^{a+2π}}`
intersecata col piano tagliato, dove `ln|z|` percorre meno di `2π`.

**2. L'immagine del ramo principale è semiaperta o aperta a seconda del dominio.**
`|z^i| = e^{−Arg z}` con `Arg ∈ (−π, π]` dà `|w| ∈ [e^{−π}, e^{π})`. Su `ℂ∖{0}`
la corona è **semiaperta**, con l'estremo interno attinto in `z = −1`; sul piano
tagliato `ℂ∖(−∞,0]`, dove `Arg ∈ (−π, π)`, è **aperta**. L'estremo `e^{π}` non è
mai attinto, perché richiederebbe `Arg z = −π`.

**3. L'immagine della circonferenza unitaria è `[e^{−π}, e^{π})`, non chiusa.**
Stessa ragione: il minimo è attinto, il massimo no.

**4. In `z = 0`, `z^i` oscilla, non diverge.**
Per `r → 0⁺` il modulo `|z^i| = e^{−θ}` resta **limitato**; è l'argomento
`ln r → −∞` a oscillare, avvolgendosi infinite volte. L'origine è un punto di
diramazione, non un polo. Di conseguenza il disco escluso vicino all'origine non
serve contro un overflow ma contro l'**aliasing della fase**, e il suo raggio
dipende dalla risoluzione (`≈ h/(π/2)`), non è una costante.

Due precisazioni minori: l'immagine di un cerchio `|z| = r₀` è un **segmento**
radiale, non una semiretta, perché il modulo è confinato nella corona; e sia
`np.angle` sia `Math.atan2` restituiscono `−π` sul semiasse reale negativo
quando la parte immaginaria è lo zero negativo, per cui entrambe le
implementazioni normalizzano esplicitamente quel caso a `+π`.

---

## Verifiche

| Suite | Casi | Comando |
|---|---|---|
| Identità matematiche, Python | 95 | `cd video_animation && .venv\Scripts\python -m pytest -q` |
| Identità matematiche, TypeScript | 55 | `cd interactive_map && npm test` |
| Tipi TypeScript | — | `cd interactive_map && npm run controlla` |
| Confronto numerico Python ↔ TypeScript | 819 valori | `cd interactive_map && npm run confronta` |
| Funzionale end-to-end, Chrome headless | 32 | `cd interactive_map && npm run verifica:ui` |

Le due suite matematiche verificano le **stesse identità analitiche** su due
implementazioni indipendenti (NumPy vettorizzato da un lato, TypeScript scalare
dall'altro). Poiché soddisfare le stesse identità non implica restituire gli
stessi numeri, un terzo script esegue **entrambi i nuclei sugli stessi punti** e
confronta i valori uno a uno a 10⁻¹²: nessuna divergenza. La verifica funzionale
pilota davvero l'interfaccia — clic, trascinamento, slider, schede — e controlla
i valori matematici mostrati a schermo.

Valori di controllo usati da entrambe:

| Quantità | Valore |
|---|---|
| `i^i` | `e^{−π/2} = 0.20787957635076193` |
| `(−1)^i` | `e^{−π} = 0.043213918263772…` |
| `(−i)^i` | `e^{π/2} = 4.810477380965…` |
| salto attraverso il taglio | `e^{2π} = 535.4916555…` |
| rapporto fra rami consecutivi | `e^{−2π} = 1.8674427317…·10⁻³` |

---

## Struttura

```
complex_analysis_viz/
├── README.md                      questo file
├── video_animation/
│   ├── complex_maps.py            nucleo matematico (nessuna dipendenza grafica)
│   ├── test_complex_maps.py       95 test
│   ├── scenes.py                  sei classi Scene + funzioni riutilizzabili
│   ├── concatena.py               unione delle scene in un unico mp4
│   ├── requirements.txt
│   ├── README.md
│   └── media/                     video prodotti da Manim
└── interactive_map/
    ├── src/math/                  nucleo matematico TypeScript + 55 test
    ├── src/render/shader.ts       ritratto di fase GLSL
    ├── src/components/            piani, controlli, pannelli
    ├── src/state/store.tsx        stato applicativo
    ├── scripts/verifica-ui.mjs    verifica end-to-end senza dipendenze
    ├── scripts/confronta-con-python.mjs   confronto numerico fra i due nuclei
    ├── assets/architettura.svg
    ├── package.json
    └── README.md
```

---

## Scelte tecniche in breve

**Video — Manim Community Edition.** Separazione netta fra matematica
(`complex_maps.py`, che non importa Manim) e regia (`scenes.py`, che non
contiene formule). Le curve sono descritte come parametrizzazioni `γ: [t₀,t₁] → ℂ`
e non come mobject, perché l'immagine sotto una mappa non affine va ricalcolata
come `f(γ(t))` campione per campione.

**App — Vite + React + TypeScript, WebGL 2 + SVG.** Il vincolo dimensionante è
il ritratto di fase ad alta risoluzione aggiornato a ogni interazione, con clic
e trascinamento sul piano. Uno shader GLSL calcola `arg f(z)` e le curve di
livello di `|f(z)|` **per pixel sulla GPU**, mentre un overlay SVG disegna gli
oggetti discreti dove servono tratti netti, hit-testing e testo accessibile. Le
alternative valutate — Streamlit e Plotly Dash — richiederebbero un round-trip
server a ogni fotogramma e non supportano il trascinamento di un punto. Il
confronto completo è nel [README dell'app](interactive_map/README.md#scelta-tecnologica).

Nessun backend: l'app è una cartella statica che si apre in locale o si
pubblica su qualunque hosting.
