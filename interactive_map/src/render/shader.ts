/**
 * Phase portrait in WebGL2.
 *
 * Il ritratto di fase viene calcolato **per pixel** in un fragment shader
 * anziché su una griglia campionata in CPU. È la ragione principale della
 * scelta di un frontend dedicato: la risoluzione effettiva coincide con quella
 * del canvas (ben oltre i 500×500 richiesti) e l'aggiornamento resta fluido
 * mentre si trascina il punto o si muove lo slider dell'esponente, senza alcun
 * round-trip verso un server.
 *
 * Tutta la matematica qui è una traduzione in GLSL di `math/complexMaps.ts`,
 * con le stesse convenzioni: `Arg ∈ (-π, π]`, `z^i = e^{-θ}e^{i ln r}`.
 */

export const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
out vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform vec4  uDominio;        // xMin, xMax, yMin, yMax
uniform int   uModo;           // 0 = z^n, 1 = z^i (ramo uK), 2 = identita'
uniform float uN;              // esponente intero di z^n
uniform float uK;              // indice di ramo per z^i
uniform float uRMin;           // raggio di esclusione per aliasing di fase
uniform int   uContornoModulo; // bande di livello del modulo
uniform int   uContornoFase;   // bande di livello dell'argomento
uniform int   uMostraTaglio;   // evidenzia (-inf, 0]
uniform int   uSchema;         // 0 = arcobaleno, 1 = ad alta leggibilita'
uniform float uIntensita;      // 0..1, forza delle bande
uniform vec2  uRisoluzione;    // pixel del canvas

const float PI     = 3.141592653589793;
const float DUE_PI = 6.283185307179586;

// --- Arg z in (-pi, pi], con il semiasse reale negativo normalizzato a +pi.
float argPrincipale(vec2 z) {
  if (z.y == 0.0 && z.x < 0.0) return PI;
  return atan(z.y, z.x);
}

// --- z^n in forma polare: r^n e^{i n theta}.
vec2 potenzaIntera(vec2 z, float n) {
  float r = length(z);
  if (r == 0.0) return vec2(0.0);
  float th = argPrincipale(z);
  // log/exp invece di pow(r, n) per non perdere precisione con r molto grande.
  float m = exp(n * log(r));
  return m * vec2(cos(n * th), sin(n * th));
}

// --- z^i_k = e^{-(theta + 2 pi k)} e^{i ln r}.
vec2 potenzaImmaginaria(vec2 z, float k) {
  float r = length(z);
  if (r == 0.0) return vec2(0.0);
  float th = argPrincipale(z);
  float lnr = log(r);
  float m = exp(-(th + DUE_PI * k));
  return m * vec2(cos(lnr), sin(lnr));
}

vec3 hsl2rgb(vec3 hsl) {
  vec3 k = mod(hsl.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0);
  vec3 f = clamp(min(k, 4.0 - k), 0.0, 1.0);
  float ch = (1.0 - abs(2.0 * hsl.z - 1.0)) * hsl.y;
  return (f - 0.5) * ch + hsl.z;
}

// Schema ad alta leggibilita': evita la compressione percettiva del verde
// tipica dell'arcobaleno HSV, redistribuendo la tinta.
float tintaCorretta(float h) {
  // Curva monotona che allarga arancio/ciano e restringe verde/magenta.
  return h + 0.06 * sin(DUE_PI * h) - 0.03 * sin(2.0 * DUE_PI * h);
}

void main() {
  vec2 z = vec2(
    mix(uDominio.x, uDominio.y, vUV.x),
    mix(uDominio.z, uDominio.w, vUV.y)
  );

  vec2 w;
  if (uModo == 0)      w = potenzaIntera(z, uN);
  else if (uModo == 1) w = potenzaImmaginaria(z, uK);
  else                 w = z;                      // piano immagine: riferimento

  float r = length(z);
  float m = length(w);
  float a = argPrincipale(w);

  // --- Tinta dall'argomento ---------------------------------------------
  float h = (a + PI) / DUE_PI;
  if (uSchema == 1) h = tintaCorretta(h);
  float s = 0.88;
  float l = 0.52;

  // --- Bande di livello del modulo: |w| in progressione geometrica di
  //     ragione 2. Sono curve di livello vere, non un semplice gradiente.
  if (uContornoModulo == 1 && m > 0.0) {
    float lg = log2(m);
    float banda = fract(lg);
    l += uIntensita * 0.26 * (banda - 0.5);
    // riga sottile esattamente sulle potenze di 2
    float bordo = smoothstep(0.0, 0.035, min(banda, 1.0 - banda));
    l = mix(l + 0.18 * uIntensita, l, bordo);
  }

  // --- Bande di livello della fase: 12 settori da pi/6 -------------------
  if (uContornoFase == 1) {
    float settore = fract(h * 12.0);
    float bordo = smoothstep(0.0, 0.05, min(settore, 1.0 - settore));
    s = mix(s * 0.55, s, bordo);
  }

  vec3 colore = hsl2rgb(vec3(fract(h), s, clamp(l, 0.06, 0.95)));

  // --- Zona non affidabile per z^i ---------------------------------------
  // Non e' un overflow: |z^i| resta in [e^{-pi}, e^{pi}). E' la fase che,
  // variando come 1/r, risulta sotto-campionata. La si spegne invece di
  // mostrare colori privi di significato.
  if (uModo == 1 && r < uRMin) {
    float t = clamp(r / max(uRMin, 1e-9), 0.0, 1.0);
    vec3 grigio = vec3(0.13, 0.14, 0.17);
    colore = mix(grigio, colore, t * t);
    // tratteggio diagonale per segnalare che la regione e' esclusa
    float d = fract((gl_FragCoord.x + gl_FragCoord.y) / 9.0);
    if (d < 0.38) colore *= 0.72;
  }

  // --- Taglio di ramo ----------------------------------------------------
  if (uMostraTaglio == 1 && uModo == 1) {
    float pixelY = (uDominio.w - uDominio.z) / max(uRisoluzione.y, 1.0);
    if (z.x < 0.0 && abs(z.y) < 1.6 * pixelY) {
      colore = mix(colore, vec3(1.0, 0.30, 0.35), 0.88);
    }
  }

  // --- Punti non definiti -------------------------------------------------
  if (!(m == m) || !(a == a)) colore = vec3(0.08, 0.09, 0.11);

  fragColor = vec4(colore, 1.0);
}`;

export type ModoShader = 0 | 1 | 2;

export interface ParametriShader {
  dominio: { xMin: number; xMax: number; yMin: number; yMax: number };
  modo: ModoShader;
  n: number;
  k: number;
  rMin: number;
  contornoModulo: boolean;
  contornoFase: boolean;
  mostraTaglio: boolean;
  schema: 0 | 1;
  intensita: number;
}

/**
 * Incapsula il contesto WebGL2 e il programma del ritratto di fase.
 *
 * Se WebGL2 non è disponibile, `disponibile` resta `false` e il chiamante
 * ricade su un rendering alternativo: l'app resta usabile, solo meno rapida.
 */
export class PhaseRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private programma: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private uniform: Record<string, WebGLUniformLocation | null> = {};

  readonly disponibile: boolean;
  readonly errore: string | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) {
      this.disponibile = false;
      this.errore = "WebGL2 non disponibile su questo browser.";
      return;
    }
    this.gl = gl;

    try {
      this.programma = this.compilaProgramma(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    } catch (e) {
      this.disponibile = false;
      this.errore = e instanceof Error ? e.message : String(e);
      return;
    }

    // Quad a schermo intero.
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const loc = gl.getAttribLocation(this.programma, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.vao = vao;

    for (const nome of [
      "uDominio",
      "uModo",
      "uN",
      "uK",
      "uRMin",
      "uContornoModulo",
      "uContornoFase",
      "uMostraTaglio",
      "uSchema",
      "uIntensita",
      "uRisoluzione",
    ]) {
      this.uniform[nome] = gl.getUniformLocation(this.programma, nome);
    }

    this.disponibile = true;
  }

  private compilaProgramma(
    gl: WebGL2RenderingContext,
    sorgenteV: string,
    sorgenteF: string
  ): WebGLProgram {
    const compila = (tipo: number, sorgente: string) => {
      const shader = gl.createShader(tipo);
      if (!shader) throw new Error("Impossibile creare lo shader.");
      gl.shaderSource(shader, sorgente);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Compilazione shader fallita: ${log}`);
      }
      return shader;
    };

    const v = compila(gl.VERTEX_SHADER, sorgenteV);
    const f = compila(gl.FRAGMENT_SHADER, sorgenteF);
    const p = gl.createProgram();
    if (!p) throw new Error("Impossibile creare il programma WebGL.");
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error(`Link del programma fallito: ${log}`);
    }
    return p;
  }

  /** Adegua la dimensione del framebuffer al CSS, tenendo conto del DPI. */
  ridimensiona(larghezzaCss: number, altezzaCss: number, dprMax = 2): void {
    const gl = this.gl;
    if (!gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, dprMax);
    const w = Math.max(1, Math.round(larghezzaCss * dpr));
    const h = Math.max(1, Math.round(altezzaCss * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  disegna(p: ParametriShader): void {
    const gl = this.gl;
    if (!gl || !this.programma || !this.disponibile) return;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.programma);
    gl.bindVertexArray(this.vao);

    gl.uniform4f(
      this.uniform.uDominio!,
      p.dominio.xMin,
      p.dominio.xMax,
      p.dominio.yMin,
      p.dominio.yMax
    );
    gl.uniform1i(this.uniform.uModo!, p.modo);
    gl.uniform1f(this.uniform.uN!, p.n);
    gl.uniform1f(this.uniform.uK!, p.k);
    gl.uniform1f(this.uniform.uRMin!, p.rMin);
    gl.uniform1i(this.uniform.uContornoModulo!, p.contornoModulo ? 1 : 0);
    gl.uniform1i(this.uniform.uContornoFase!, p.contornoFase ? 1 : 0);
    gl.uniform1i(this.uniform.uMostraTaglio!, p.mostraTaglio ? 1 : 0);
    gl.uniform1i(this.uniform.uSchema!, p.schema);
    gl.uniform1f(this.uniform.uIntensita!, p.intensita);
    gl.uniform2f(this.uniform.uRisoluzione!, this.canvas.width, this.canvas.height);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.programma) gl.deleteProgram(this.programma);
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.programma = null;
    this.vao = null;
    this.gl = null;
  }
}
