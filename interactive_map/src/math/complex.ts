/**
 * Aritmetica complessa di base.
 *
 * I numeri complessi sono oggetti semplici `{ re, im }` anziché classi: sono
 * allocati a milioni durante il campionamento delle curve e la forma piatta
 * resta molto più veloce da creare e da confrontare.
 *
 * Convenzione sull'argomento: `Arg z` appartiene a `(-π, π]`.
 */

export interface Complex {
  readonly re: number;
  readonly im: number;
}

export const PI = Math.PI;
export const DUE_PI = 2 * Math.PI;

/** Costruttore conciso. */
export function c(re: number, im = 0): Complex {
  return { re, im };
}

export const ZERO: Complex = { re: 0, im: 0 };
export const UNO: Complex = { re: 1, im: 0 };
export const I: Complex = { re: 0, im: 1 };

export function add(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function sub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

export function mul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

export function scale(a: Complex, k: number): Complex {
  return { re: a.re * k, im: a.im * k };
}

export function div(a: Complex, b: Complex): Complex {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}

/** Modulo `|z|`, calcolato con `Math.hypot` per evitare over/underflow. */
export function abs(z: Complex): number {
  return Math.hypot(z.re, z.im);
}

/** Modulo al quadrato: evita la radice quando serve solo un confronto. */
export function absSq(z: Complex): number {
  return z.re * z.re + z.im * z.im;
}

/**
 * Argomento principale `Arg z ∈ (-π, π]`.
 *
 * `Math.atan2` restituisce `-π` quando la parte immaginaria è lo zero negativo
 * (`atan2(-0, -1) === -π`): poiché la convenzione scelta è semiaperta a destra,
 * il semiasse reale negativo viene normalizzato a `+π` in entrambi i casi.
 * In `z = 0` l'argomento non è definito e si restituisce `NaN`.
 */
export function argPrincipal(z: Complex): number {
  if (z.re === 0 && z.im === 0) return NaN;
  if (z.im === 0 && z.re < 0) return PI;
  return Math.atan2(z.im, z.re);
}

/**
 * Riduce un angolo a `(-π, π]`.
 *
 * Manda esattamente `-π` in `+π`, coerentemente con l'intervallo semiaperto
 * a destra.
 */
export function wrapToPi(theta: number): number {
  if (!Number.isFinite(theta)) return NaN;
  return PI - mod(PI - theta, DUE_PI);
}

/** Modulo matematico, sempre nell'intervallo `[0, m)` anche per `x` negativo. */
export function mod(x: number, m: number): number {
  return ((x % m) + m) % m;
}

/** Forma polare `(r, θ)`. */
export function toPolar(z: Complex): { r: number; theta: number } {
  return { r: abs(z), theta: argPrincipal(z) };
}

/** Da forma polare a cartesiana. */
export function fromPolar(r: number, theta: number): Complex {
  return { re: r * Math.cos(theta), im: r * Math.sin(theta) };
}

/** Esponenziale complesso `e^z`. */
export function exp(z: Complex): Complex {
  const m = Math.exp(z.re);
  return { re: m * Math.cos(z.im), im: m * Math.sin(z.im) };
}

export function isFiniteC(z: Complex): boolean {
  return Number.isFinite(z.re) && Number.isFinite(z.im);
}

export function isNaNC(z: Complex): boolean {
  return Number.isNaN(z.re) || Number.isNaN(z.im);
}

export function equals(a: Complex, b: Complex, tol = 1e-12): boolean {
  return Math.hypot(a.re - b.re, a.im - b.im) <= tol;
}

/**
 * Formattazione in `x + iy` con un numero di cifre configurabile.
 * Le quantità minuscole vengono mostrate in notazione esponenziale perché
 * su `z^i` i rami differiscono di fattori `e^{±2π} ≈ 535` e si arriva presto
 * a ordini di grandezza estremi.
 */
export function formatComplex(z: Complex, cifre = 4): string {
  if (isNaNC(z)) return "non definito";
  const f = (x: number) => formatNumber(x, cifre);
  const segno = z.im < 0 || Object.is(z.im, -0) ? "−" : "+";
  return `${f(z.re)} ${segno} ${f(Math.abs(z.im))} i`;
}

export function formatNumber(x: number, cifre = 4): string {
  if (!Number.isFinite(x)) return Number.isNaN(x) ? "non definito" : "∞";
  const a = Math.abs(x);
  if (a !== 0 && (a < 1e-4 || a >= 1e6)) return x.toExponential(Math.max(cifre - 1, 1));
  return x.toFixed(cifre);
}

/** Da radianti a gradi. */
export function toDegrees(rad: number): number {
  return (rad * 180) / PI;
}
