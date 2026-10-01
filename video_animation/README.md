# Video animato — potenze complesse `z^n` e `z^i`

Sei scene Manim Community Edition che costruiscono, con rigore da corso di
analisi complessa, il confronto fra la potenza intera e la potenza a esponente
immaginario: definizioni formali, logaritmo principale, taglio di ramo,
avvolgimento, radici `n`-esime, multivalenza e immagine.

---

## Indice

- [Requisiti](#requisiti)
- [Installazione](#installazione)
- [Rendering](#rendering)
- [Le sei scene](#le-sei-scene)
- [Contenuto matematico e correzioni](#contenuto-matematico-e-correzioni)
- [Verifiche numeriche](#verifiche-numeriche)
- [Architettura del codice](#architettura-del-codice)
- [Limitazioni note del rendering](#limitazioni-note-del-rendering)
- [Risoluzione dei problemi](#risoluzione-dei-problemi)

---

## Requisiti

| Componente | Versione collaudata | Serve per |
|---|---|---|
| Python | 3.11.9 | tutto |
| Manim Community Edition | 0.21.0 | rendering delle scene |
| NumPy | 2.4.0 | `complex_maps.py` |
| LaTeX (MiKTeX o TeX Live) | MiKTeX 24.1 | `MathTex` / `Tex` |
| PyAV | 18.1.0 | scrittura degli `.mp4` |
| `imageio-ffmpeg` | 0.6.0 | **solo** per concatenare le scene |
| `pytest` | 9.1.1 | test matematici |

> **FFmpeg di sistema non è necessario.** Da Manim 0.19 i video vengono scritti
> con PyAV, che incorpora libav. FFmpeg serve soltanto a `concatena.py`, e
> arriva come wheel Python tramite `imageio-ffmpeg`: nessuna installazione a
> livello di sistema.

### Se manca qualcosa

- **Manim** — `pip install manim`. Su Windows le dipendenze native (Cairo,
  Pango) arrivano come wheel precompilate, quindi non serve un compilatore.
  Documentazione ufficiale: <https://docs.manim.community/en/stable/installation.html>
- **LaTeX** — su Windows [MiKTeX](https://miktex.org/download); su macOS
  [MacTeX](https://tug.org/mactex/) (o il più leggero BasicTeX); su Debian/Ubuntu
  `texlive-latex-extra texlive-fonts-extra texlive-latex-recommended cm-super`.
  Servono i pacchetti `lmodern`, `amsmath`, `amssymb`, tutti nelle distribuzioni
  di base. Si veda la nota su `lmodern` in
  [Limitazioni note](#limitazioni-note-del-rendering): **senza di esso il testo
  dentro `\text{...}` sparisce silenziosamente dal video.**
- **FFmpeg** — non installarlo a sistema: `pip install imageio-ffmpeg` basta.

---

## Installazione

Dalla cartella `video_animation/`:

```powershell
# Opzione A (consigliata): riusa un Manim già funzionante nel Python di sistema
python -m venv .venv --system-site-packages
.venv\Scripts\python -m pip install pytest imageio-ffmpeg

# Opzione B: ambiente completamente isolato (~400 MB di download)
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

Su macOS e Linux sostituire `.venv\Scripts\` con `.venv/bin/`.

Verifica rapida:

```powershell
.venv\Scripts\python -c "import manim, numpy; print(manim.__version__, numpy.__version__)"
.venv\Scripts\python -m pytest -q
```

---

## Rendering

### Prova rapida (480p15, pochi secondi per scena)

```powershell
.venv\Scripts\python -m manim -ql scenes.py S01Intro
```

### Tutte le scene in bozza

```powershell
.venv\Scripts\python -m manim -ql scenes.py S01Intro S02PotenzeIntere S03PotenzaImmaginaria S04Multivalenza S05Confronto S06Outro
```

### Render finale (1080p60)

```powershell
.venv\Scripts\python -m manim -qh scenes.py S01Intro S02PotenzeIntere S03PotenzaImmaginaria S04Multivalenza S05Confronto S06Outro
```

I file finiscono in `media/videos/scenes/<qualità>/<NomeScena>.mp4`.

| Flag | Risoluzione | Uso |
|---|---|---|
| `-ql` | 854×480, 15 fps | iterazione rapida |
| `-qm` | 1280×720, 30 fps | revisione |
| `-qh` | 1920×1080, 60 fps | consegna |
| `-qk` | 3840×2160, 60 fps | proiezione |

Opzioni utili:

- `--disable_caching` — forza il ricalcolo (indispensabile dopo aver modificato
  `complex_maps.py`, che Manim non considera nel calcolo della cache);
- `-p` — apre il video appena pronto;
- `-s` — salva solo l'ultimo fotogramma come PNG (ottimo per controllare il
  layout senza aspettare il video);
- `-n 12,20` — renderizza solo le animazioni dalla 12 alla 20.

### Video unico

```powershell
.venv\Scripts\python concatena.py                   # unisce le scene 1080p60
.venv\Scripts\python concatena.py --qualita 480p15  # unisce le bozze
.venv\Scripts\python concatena.py --uscita lezione.mp4
```

Lo script usa il demuxer `concat` di FFmpeg con `-c copy`: nessuna
ricodifica, quindi è istantaneo e senza perdita. Il risultato finisce in
`media/videos/potenze_complesse_<qualità>.mp4`.

In alternativa, Manim può concatenare da sé se le scene vengono riunite in una
sola classe; qui si è preferito tenerle separate, così da poter rirenderizzare
una scena sola dopo una correzione.

---

## Le sei scene

| Classe | Durata (≈) | Contenuto |
|---|---|---|
| `S01Intro` | 0:39 | Titolo; definizioni formali di `z^n` e `z^i`; costruzione di `Log z = ln\|z\| + i·Arg z` con `Arg ∈ (−π, π]`; il punto mobile attraversa il taglio di ramo e si vede `Arg z` saltare di `2π`, con la lettura simultanea di `\|z^i\| = e^{−Arg z}`. |
| `S02PotenzeIntere` | 1:18 | Le identità `\|z^n\| = \|z\|^n` e `arg(z^n) = n·arg z`; deformazione della griglia cartesiana e polare per `n = 2, 3, 4, 5`; avvolgimento (un giro nel dominio, `n` giri nell'immagine, con doppio contagiri); le `n` radici `n`-esime come vertici di un `n`-agono regolare, per `n = 2, 3, 5, 6`. |
| `S03PotenzaImmaginaria` | 1:07 | Derivazione in quattro passi di `z^i = e^{−θ}e^{i ln r}`; immagini di cerchi (→ segmenti radiali) e raggi (→ archi di circonferenza) affiancate; il caso `i^i = e^{−π/2} ≈ 0,2079`; la corona immagine con gli estremi `e^{−π}` ed `e^{π}` e la distinzione aperta/semiaperta. |
| `S04Multivalenza` | 0:45 | Le strisce di ampiezza `2π` nel piano di `log z`; la derivazione `z^i_k = z^i e^{−2πk}`; i cinque rami in scala logaritmica, allineati con passo costante `e^{−2π}`; la dimostrazione che il ramo principale **non** è iniettivo, col controesempio `1` ed `e^{2π}`. |
| `S05Confronto` | 0:17 | Tabella comparativa su otto voci: univocità, numero di preimmagini, conformità, comportamento in `0`, modulo, argomento, taglio di ramo, immagine. |
| `S06Outro` | 0:19 | I tre teoremi chiave e la differenza strutturale algebrico/trascendente. |

Totale ≈ **4 minuti e 25 secondi**.

---

## Contenuto matematico e correzioni

Le scene seguono le convenzioni fissate in `complex_maps.py`:

- `Arg z ∈ (−π, π]`, con il semiasse reale negativo normalizzato a `+π`;
- `Log z = ln|z| + i·Arg z`, definito su `ℂ∖{0}`, olomorfo su `ℂ∖(−∞,0]`;
- `log_k z = ln|z| + i(Arg z + 2πk)`;
- `z^i := exp(i·Log z)` salvo indicazione esplicita del ramo.

### Quattro correzioni rispetto alla formulazione iniziale

Sono scelte deliberate, discusse esplicitamente nel video e verificate dai test.

**1. `z^i` NON è iniettiva su `ℂ∖(−∞,0]`: è ∞-a-1.**
Da `z^i = e^{−θ}e^{i ln r}` segue che `z₁^i = z₂^i` equivale a `θ₁ = θ₂` **e**
`ln r₁ − ln r₂ ∈ 2πℤ`, cioè `z₂ = z₁e^{2πm}`. Controesempio minimo:
`1^i = (e^{2π})^i = 1`, due punti del piano tagliato distanti più di `534`.
Il ramo principale è iniettivo soltanto su una corona
`{e^a < |z| < e^{a+2π}} ∩ (ℂ∖(−∞,0])`, dove `ln|z|` percorre un intervallo di
ampiezza minore di `2π`. Scena `S04Multivalenza`; test
`test_z_i_NON_e_iniettiva_sul_piano_tagliato`.

**2. L'immagine è semiaperta o aperta a seconda del dominio.**
`|z^i| = e^{−Arg z}` con `Arg ∈ (−π, π]` dà `|w| ∈ [e^{−π}, e^{π})`:

- su `ℂ∖{0}` la corona è **semiaperta**, `e^{−π} ≤ |w| < e^{π}`, con l'estremo
  interno attinto in `z = −1`;
- su `ℂ∖(−∞,0]` (cioè con `Arg ∈ (−π, π)`) è **aperta**, `e^{−π} < |w| < e^{π}`.

L'estremo `e^{π}` non è mai attinto, perché richiederebbe `Arg z = −π`.
Scena `S03PotenzaImmaginaria`; funzione `image_annulus`.

**3. L'immagine della circonferenza unitaria è `[e^{−π}, e^{π})`, non chiusa.**
Stessa ragione: il minimo è attinto (in `z = −1`), il massimo no.
Test `test_circonferenza_unitaria_va_nel_segmento_reale`.

**4. In `z = 0`, `z^i` oscilla, non diverge.**
Per `r → 0⁺` il modulo `|z^i| = e^{−θ}` resta **limitato**; è l'argomento
`ln r → −∞` a oscillare, avvolgendosi infinite volte. L'origine è un punto di
diramazione, non un polo. Di conseguenza l'esclusione del disco `r < r_min`
non serve a evitare un overflow, ma l'**aliasing della fase**: poiché
`d(arg w)/dr = 1/r`, il raggio critico dipende dalla risoluzione ed è
`r ≈ h/(π/2)` con `h` passo di campionamento (`raggio_aliasing`).

Due precisazioni minori: l'immagine di un cerchio `|z| = r₀` è un **segmento**
radiale, non una semiretta, perché il modulo è confinato nella corona; e
`np.angle` restituisce `+π` o `−π` sul semiasse reale negativo a seconda del
segno dello zero immaginario, per cui `arg_principal` normalizza esplicitamente
quel caso (test `test_taglio_normalizzato_a_piu_pi`).

---

## Verifiche numeriche

```powershell
.venv\Scripts\python -m pytest -q          # 95 test
.venv\Scripts\python -m pytest -v          # con i nomi dei casi
.venv\Scripts\python -m pytest -k "taglio" # solo quelli sul taglio di ramo
```

I test non controllano solo che il codice giri: verificano le identità
analitiche enunciate nel video, su punti scelti in modo da non attraversare il
taglio di ramo salvo dove è proprio quello il punto. Fra gli altri:

| Verifica | Valore atteso |
|---|---|
| `i^i` | `e^{−π/2} = 0.20787957635076193` |
| `\|z^i\|` | `e^{−Arg z}` (invariante lungo ogni raggio) |
| `arg(z^i)` | `ln\|z\|` mod `2π` (invariante su ogni cerchio) |
| `\|(−1)^i\|` | `e^{−π} = 0.043214`, minimo della corona |
| salto sul taglio | fattore `e^{2π} = 535.4916555` |
| rapporto fra rami consecutivi | `e^{−2π} = 1.8674·10⁻³` |
| somma delle `n` radici `n`-esime | `0` |
| prodotto delle `n` radici | `(−1)^{n+1}·w` |
| `det J` di `z^n` | `n²\|z\|^{2n−2}`, nullo in `0` |
| griglia `512×512` di `z^i` | nessun `RuntimeWarning`, calcolata in < 2 s |

Un test dedicato (`test_nessun_warning_su_griglia_con_origine`) impone
`warnings.simplefilter("error")` su una griglia che contiene esattamente
`z = 0`: qualunque `divide by zero` o `invalid value` lo farebbe fallire.

---

## Architettura del codice

```
video_animation/
├── complex_maps.py          nucleo matematico, nessuna dipendenza grafica
├── test_complex_maps.py     95 test delle identità analitiche
├── scenes.py                regia: sei classi Scene + funzioni riutilizzabili
├── concatena.py             unione delle scene in un unico mp4
├── requirements.txt
├── README.md
└── media/                   output di Manim (video, immagini, file parziali)
```

La separazione è netta: `complex_maps.py` non importa Manim, e `scenes.py` non
contiene formule. Questo permette di testare la matematica senza rendering, e
di riusare lo stesso nucleo come riferimento per la versione TypeScript
dell'applicazione interattiva (`../interactive_map/src/math/`), che soddisfa le
stesse identità.

### Funzioni riutilizzabili di `scenes.py`

| Funzione | Ruolo |
|---|---|
| `piano_complesso(...)` | un `ComplexPlane` quadrato con scala esplicita |
| `curva_spec(...)` | descrive una curva come `γ: [t₀,t₁] → ℂ`, non come mobject |
| `disegna(plane, specs, f)` | realizza una famiglia, eventualmente composta con `f` |
| `make_grid(...)` | griglia cartesiana, con ritaglio opzionale al disco |
| `make_polar_grid(...)` | cerchi e raggi, con raggio minimo contro l'aliasing |
| `animate_map(...)` | anima la deformazione di una famiglia sotto una mappa |
| `branch_cut_mobject(...)` | il taglio `(−∞,0]` con tratteggio |
| `etichetta_punto`, `legenda`, `titolo_scena`, `nota` | elementi ricorrenti |

**Perché le curve sono descritte come specifiche e non come mobject.** L'immagine
di una curva sotto una mappa non affine va ricalcolata come `f(γ(t))` campione
per campione. Deformare i vertici di una spezzata darebbe un risultato corretto
solo con un campionamento altrettanto fitto, e una `Line` — che ha due sole
ancore — resterebbe erroneamente un segmento. Tenendo la parametrizzazione, sia
la curva sia la sua immagine sono campionate esattamente.

**Perché la griglia cartesiana viene ritagliata al disco.** Sotto `z^n` i vertici
del quadrato `[−e, e]²`, di modulo `e√2`, esplodono molto più in fretta del
bordo circolare: per `n = 5` ed `e = 1,15` si passa da `|w| ≤ 2,01` sul disco a
`|w| ≤ 9,0` sul quadrato, e l'inquadratura viene invasa. `make_grid` accetta
quindi un `raggio_max` e taglia ogni retta alla corda interna al disco.

---

## Limitazioni note del rendering

Problemi reali incontrati durante lo sviluppo e come sono stati risolti.

### 1. `lmodern` è obbligatorio, altrimenti il testo sparisce senza errori

Con il solo `\usepackage[T1]{fontenc}`, MiKTeX ripiega sui font bitmap EC
(Type 3 / PK) che `dvisvgm` non sa convertire in tracciati. Il risultato è che
**tutto il contenuto di `\text{...}` e di `Tex{...}` scompare dal video**,
lasciando solo i simboli matematici — e senza alcun messaggio d'errore: la
compilazione LaTeX va a buon fine. Il preambolo di `scenes.py` carica quindi
`lmodern` (Latin Modern, Type 1 con codifica T1 completa) prima di `fontenc`.

Sintomo tipico: una formula come `Log è olomorfo su ℂ∖(−∞,0]` appare come
`Log        ℂ∖(−∞,0]`.

### 2. Voci malformate nel `PATH` bloccano MiKTeX

MiKTeX scorre ogni voce di `PATH` e si interrompe se una punta a un file
anziché a una cartella, con
`MiKTeX cannot retrieve attributes for the directory ...`. In quel caso
`latex` termina senza nemmeno produrre un file di log, e Manim riporta il
fuorviante `latex failed but did not produce a log file. Check your LaTeX
installation` — che manda a cercare il problema nella direzione sbagliata.

`scenes.py` chiama all'import `_sanifica_path()`, che rimuove dal `PATH` le
voci che non sono cartelle esistenti. La modifica vive **solo** in questo
processo e nei suoi sottoprocessi: nessuna variabile di sistema viene toccata.
L'elenco delle voci scartate resta disponibile in `_PATH_SCARTATO`.

### 3. Compromessi di inquadratura

Sono scelte, non difetti, ed è il motivo per cui l'app interattiva è il
complemento naturale del video.

- **`z^n`** — il dominio è il disco `|z| ≤ 1,15`, così che `|z^5| ≤ 2,01` resti
  inquadrato con la stessa scala nei due piani. Con un dominio più ampio
  l'immagine uscirebbe dal campo di parecchi ordini di grandezza.
- **`z^i`, immagini di curve** — si usa il semipiano destro (`Arg ∈ (−π/2, π/2)`),
  per cui `|w| ∈ (e^{−π/2}, e^{π/2}) ≈ (0,21, 4,81)`. Sul piano intero il
  rapporto sarebbe `e^{2π} ≈ 535`, impossibile da rendere in scala lineare. Il
  rapporto di scala fra i due piani (1 : 1,57) è indicato a schermo.
- **`z^i`, corona immagine** — mostrata su un piano di semilato 26, dove
  `e^{π} = 23,14` è ben visibile mentre `e^{−π} = 0,043` è quasi puntiforme.
  È proprio questa sproporzione il contenuto della scena, e i valori numerici
  sono riportati accanto.
- **rami di `z^i`** — i valori per `k = −2…2` coprono dieci ordini di grandezza
  e vengono mostrati su una **scala radiale logaritmica**, dichiarata sull'asse.
  In scala lineare quattro dei cinque punti coinciderebbero con l'origine.

### 4. Tempi di rendering

Sulla macchina di sviluppo (Windows 11, Python 3.11, nessuna accelerazione GPU):
circa 4 minuti per l'intero set a `-ql`, sensibilmente di più a `-qh`. La scena
più costosa è `S02PotenzeIntere`, che deforma ~40 curve da 300–500 campioni
ciascuna. Per abbassare i tempi durante lo sviluppo si può ridurre il parametro
`campioni` di `curva_spec` o usare `-n` per renderizzare poche animazioni.

---

## Risoluzione dei problemi

| Sintomo | Causa | Rimedio |
|---|---|---|
| `latex failed but did not produce a log file` | voce malformata nel `PATH` | già gestito da `_sanifica_path()`; se persiste, eseguire `latex -interaction=nonstopmode` su un file minimo per leggere l'errore vero |
| Il testo dentro `\text{}` non appare | manca `lmodern` o i font EC Type 1 | installare `lmodern` (`cm-super` su Debian/Ubuntu); verificare che il preambolo di `scenes.py` sia intatto |
| `No such file or directory: 'latex'` | LaTeX non installato o non nel `PATH` | installare MiKTeX/TeX Live e riaprire il terminale |
| `ModuleNotFoundError: manim` | venv non attivo | usare esplicitamente `.venv\Scripts\python -m manim` |
| Le modifiche a `complex_maps.py` non si vedono | cache di Manim | aggiungere `--disable_caching` |
| `concatena.py` dice che mancano delle scene | non ancora renderizzate a quella qualità | lo script stampa i comandi esatti da eseguire |
| Video molto scuro o colori strani | `config.background_color` modificato | il valore atteso è `#0E1117` |
| Formule tagliate ai bordi | testo più lungo del previsto dopo una modifica | usare `-s` per salvare l'ultimo fotogramma e correggere con `scale_to_fit_width` |

---

## Licenza e riuso

Il codice è pensato per essere riusato in didattica. Le funzioni di
`complex_maps.py` sono indipendenti da Manim e possono essere importate in un
notebook per verificare i conti mostrati nel video.
