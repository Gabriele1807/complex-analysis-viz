# Potenze complesse: `z^n` e `z^i`

### 🌐 Il sito è online su **[www.wasef.it](https://www.wasef.it)**

### 🎬 I video sono in [`video_animation/media/videos/`](video_animation/media/videos/) — scarica **[1080p60 · 18,7 MB](video_animation/media/videos/potenze_complesse_1080p60.mp4)** oppure **[480p15 · 5,2 MB](video_animation/media/videos/potenze_complesse_480p15.mp4)**

*Il sito si apre e basta. I video invece vanno scaricati: GitHub non riproduce
i file `.mp4` nel browser: premi su "Vedi Raw" per scaricare il video. Stesso contenuto nelle due versioni — 4 min 25 s —
la 480p serve solo per una visione rapida o con poca banda. Nella stessa
cartella ci sono anche le [sei scene singole](video_animation/media/videos/scenes/1080p60/).*

---

Due strumenti complementari per studiare la differenza strutturale fra la
potenza intera e la potenza a esponente immaginario, a livello di corso di
analisi complessa.

| Cosa | Dove |
|---|---|
| 💻 Codice dell'applicazione web | [`interactive_map/`](interactive_map/) |
| 💻 Codice delle animazioni Manim | [`video_animation/`](video_animation/) |

**Il video espone il ragionamento in forma lineare; il sito permette di
verificarlo su qualunque punto.** Condividono convenzioni, definizioni e le
quattro correzioni matematiche elencate più sotto.

---

## Che cosa contiene questo repository

### 🌐 [`interactive_map/`](interactive_map/) — il sito, [www.wasef.it](https://www.wasef.it)

Applicazione Vite + React + TypeScript, senza backend. Due piani complessi
affiancati, con il **ritratto di fase calcolato per pixel sulla GPU** in
WebGL 2 e un overlay SVG per curve, punti ed etichette. Si sceglie `z` con un
clic o trascinandolo, e il pannello matematico mostra modulo, argomento in
radianti e gradi, radici `n`-esime, i rami `k = −2…2` e gli avvisi sui punti
critici. In più: superfici 3D di modulo e argomento, traiettorie parametriche
con conteggio degli avvolgimenti, preimmagini e **dieci casi guidati** che
impostano tutto e spiegano il fenomeno.

### 🎬 [`video_animation/`](video_animation/) — il video

Sei scene Manim Community Edition, renderizzate a 1080p60:

| Scena | Durata | Contenuto |
|---|---|---|
| `S01Intro` | 0:39 | definizioni formali, `Log z`, taglio di ramo |
| `S02PotenzeIntere` | 1:18 | `z^n` per `n = 2…5`, avvolgimento, radici `n`-esime |
| `S03PotenzaImmaginaria` | 1:07 | derivazione di `z^i`, immagini di cerchi e raggi, `i^i` |
| `S04Multivalenza` | 0:45 | i rami `k = −2…2`, non iniettività |
| `S05Confronto` | 0:17 | tabella comparativa su otto voci |
| `S06Outro` | 0:19 | i tre teoremi chiave |

Nel repository ci sono le singole scene, il video completo e una versione in
bozza a 480p per chi vuole solo dare un'occhiata rapida
([`potenze_complesse_480p15.mp4`](video_animation/media/videos/potenze_complesse_480p15.mp4),
5,2 MB).

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

Il sito è già pubblicato su **[www.wasef.it](https://www.wasef.it)**: ogni push
su `main` ne ridistribuisce una nuova versione. L'apex `wasef.it` reindirizza
al `www` con un 308 permanente.

Quanto segue serve per replicare la pubblicazione da zero, per esempio su un
fork.

L'app è una **cartella statica senza backend**: si pubblica così com'è.

Questo è un repository con due progetti, e solo `interactive_map/` va
costruito. La configurazione sta quindi in `interactive_map/vercel.json`:

```json
{
  "framework": "vite",
  "installCommand": "npm install",
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

1. su [vercel.com/new](https://vercel.com/new), importa il repository;
2. verifica che **Root Directory** sia `interactive_map` — all'import Vercel
   la rileva da sola, perché è lì che si trova il `package.json`;
3. premi **Deploy**.

> **Attenzione al percorso dei comandi.** Install e build vengono eseguiti
> *dentro* la Root Directory, non nella radice del repository. Un
> `vercel.json` nella radice con comandi del tipo
> `cd interactive_map && npm install` fallisce con
> `sh: line 1: cd: interactive_map: No such file or directory`, perché il
> processo è già dentro `interactive_map`. I percorsi in
> `interactive_map/vercel.json` sono quindi tutti relativi a quella cartella.

Oppure da riga di comando, dalla cartella `interactive_map/`:

```bash
npx vercel          # anteprima
npx vercel --prod   # produzione
```

### I video non vengono pubblicati

La build parte dalla Root Directory `interactive_map/`, quindi i file in
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
