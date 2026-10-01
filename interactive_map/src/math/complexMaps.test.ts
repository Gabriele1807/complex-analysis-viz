/**
 * Test delle identità matematiche implementate in `complexMaps.ts`.
 *
 * Rispecchiano la suite Python `video_animation/test_complex_maps.py`: le due
 * implementazioni devono soddisfare le stesse identità analitiche, così che la
 * logica del video e quella dell'app non possano divergere silenziosamente.
 *
 * Esecuzione:  npm test
 */

import { describe, expect, it } from "vitest";

import {
  type Complex,
  DUE_PI,
  PI,
  abs,
  argPrincipal,
  c,
  exp,
  fromPolar,
  mul,
  wrapToPi,
} from "./complex";
import {
  E_MENO_PI,
  E_PI,
  FATTORE_RAMO,
  I_ALLA_I,
  aliasingRadius,
  computeLogBranches,
  computeNthRoots,
  derivativeZPower,
  derivativeZi,
  imageAnnulus,
  indiceRadiceSelezionata,
  injectivityAnnulus,
  mapZPower,
  mapZiBranch,
  mapZiPrincipal,
  nearBranchCut,
  principalLog,
  ziArgument,
  ziFiber,
  ziModulus,
} from "./complexMaps";
import { COLORI, campiona, cerchio, immagineCurva, raggio } from "./curves";

const PUNTI: Complex[] = [
  c(1, 0),
  c(0, 1),
  c(0, -1),
  c(1, 1),
  c(0, 2),
  c(0.5, -0.25),
  c(3, 0.1),
  c(-0.7, 0.7),
  c(-1.2, -0.9),
  c(0.08, 0.06),
];

const lontanoDalTaglio = (z: Complex) => !(z.re < 0 && Math.abs(z.im) < 1e-9);

/** Uguaglianza fra complessi a meno di una tolleranza assoluta. */
function vicino(a: Complex, b: Complex, tol = 1e-10): void {
  expect(Math.hypot(a.re - b.re, a.im - b.im)).toBeLessThan(tol);
}

/** Uguaglianza fra angoli modulo 2π. */
function angoliCongruenti(a: number, b: number, tol = 1e-9): void {
  expect(Math.abs(wrapToPi(a - b))).toBeLessThan(tol);
}

// ===========================================================================
describe("argomento principale", () => {
  it("assume i valori notevoli attesi", () => {
    expect(argPrincipal(c(1, 0))).toBeCloseTo(0, 12);
    expect(argPrincipal(c(0, 1))).toBeCloseTo(PI / 2, 12);
    expect(argPrincipal(c(0, -1))).toBeCloseTo(-PI / 2, 12);
    expect(argPrincipal(c(1, 1))).toBeCloseTo(PI / 4, 12);
  });

  it("resta nell'intervallo semiaperto (−π, π]", () => {
    for (const z of PUNTI) {
      const a = argPrincipal(z);
      expect(a).toBeGreaterThan(-PI - 1e-15);
      expect(a).toBeLessThanOrEqual(PI + 1e-15);
    }
  });

  it("normalizza il taglio a +π anche con zero immaginario negativo", () => {
    expect(argPrincipal(c(-1, 0))).toBeCloseTo(PI, 12);
    expect(argPrincipal({ re: -1, im: -0 })).toBeCloseTo(PI, 12);
    // Math.atan2 da solo non basta: questo è il motivo di argPrincipal.
    expect(Math.atan2(-0, -1)).toBeCloseTo(-PI, 12);
  });

  it("non è definito nell'origine", () => {
    expect(Number.isNaN(argPrincipal(c(0, 0)))).toBe(true);
  });
});

describe("wrapToPi", () => {
  it("è l'identità dentro l'intervallo", () => {
    for (const t of [-3, -1, 0, 1, 3]) expect(wrapToPi(t)).toBeCloseTo(t, 12);
  });

  it("riduce modulo 2π", () => {
    for (const t of [-20, -7.3, 4.2, 11, 100]) {
      const r = wrapToPi(t);
      expect(r).toBeGreaterThan(-PI);
      expect(r).toBeLessThanOrEqual(PI + 1e-12);
      const k = (t - r) / DUE_PI;
      expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-9);
    }
  });

  it("manda −π in +π", () => {
    expect(wrapToPi(-PI)).toBeCloseTo(PI, 12);
    expect(wrapToPi(PI)).toBeCloseTo(PI, 12);
  });
});

// ===========================================================================
describe("logaritmo principale e suoi rami", () => {
  it("soddisfa exp(Log z) = z", () => {
    for (const z of [...PUNTI, c(-2, 0)]) vicino(exp(principalLog(z)), z, 1e-12);
  });

  it("i rami differiscono per multipli di 2πi", () => {
    const z = c(1, 1);
    const rami = computeLogBranches(z, [-2, -1, 0, 1, 2]);
    const base = principalLog(z);
    rami.forEach((ramo, idx) => {
      const k = idx - 2;
      expect(ramo.re).toBeCloseTo(base.re, 12);
      expect(ramo.im).toBeCloseTo(base.im + DUE_PI * k, 12);
    });
  });

  it("ogni ramo è un logaritmo: exp(log_k z) = z", () => {
    const z = c(2, -1);
    for (const ramo of computeLogBranches(z, [-3, -2, -1, 0, 1, 2, 3])) {
      vicino(exp(ramo), z, 1e-10);
    }
  });
});

// ===========================================================================
describe("z^n: proprietà algebriche", () => {
  const esponenti = [2, 3, 4, 5, 7, 10];

  it("|z^n| = |z|^n", () => {
    for (const n of esponenti) {
      for (const z of PUNTI) {
        expect(abs(mapZPower(z, n))).toBeCloseTo(Math.pow(abs(z), n), 8);
      }
    }
  });

  it("arg(z^n) ≡ n·arg(z) (mod 2π)", () => {
    for (const n of esponenti) {
      for (const z of PUNTI.filter(lontanoDalTaglio)) {
        angoliCongruenti(argPrincipal(mapZPower(z, n)), n * argPrincipal(z), 1e-8);
      }
    }
  });

  it("coincide con il prodotto ripetuto", () => {
    for (const z of PUNTI) {
      let atteso = c(1, 0);
      for (let j = 0; j < 6; j += 1) {
        atteso = mul(atteso, z);
        vicino(mapZPower(z, j + 1), atteso, 1e-10 * Math.max(1, Math.pow(abs(z), j + 1)));
      }
    }
  });

  it("ogni w ≠ 0 ha esattamente n preimmagini distinte", () => {
    const w = c(1.7, -0.9);
    for (const n of [2, 3, 4, 5, 6, 10]) {
      const radici = computeNthRoots(w, n);
      expect(radici).toHaveLength(n);
      for (const r of radici) vicino(mapZPower(r, n), w, 1e-9);
      for (let a = 0; a < n; a += 1) {
        for (let b = a + 1; b < n; b += 1) {
          expect(Math.hypot(radici[a].re - radici[b].re, radici[a].im - radici[b].im))
            .toBeGreaterThan(1e-6);
        }
      }
    }
  });

  it("le radici formano un n-agono regolare", () => {
    const w = c(-2, 3);
    for (const n of [2, 3, 5, 8]) {
      const radici = computeNthRoots(w, n);
      for (const r of radici) expect(abs(r)).toBeCloseTo(Math.pow(abs(w), 1 / n), 10);
      for (let j = 1; j < n; j += 1) {
        const passo = wrapToPi(argPrincipal(radici[j]) - argPrincipal(radici[j - 1]));
        expect(Math.abs(passo)).toBeCloseTo(DUE_PI / n, 8);
      }
    }
  });

  it("la somma delle radici è nulla e il prodotto vale (−1)^(n+1)·w", () => {
    const w = c(1.3, -2.1);
    for (const n of [2, 3, 4, 5]) {
      const radici = computeNthRoots(w, n);
      const somma = radici.reduce((acc, r) => c(acc.re + r.re, acc.im + r.im), c(0, 0));
      expect(abs(somma)).toBeLessThan(1e-9);
      const prodotto = radici.reduce((acc, r) => mul(acc, r), c(1, 0));
      const atteso = c(Math.pow(-1, n + 1) * w.re, Math.pow(-1, n + 1) * w.im);
      vicino(prodotto, atteso, 1e-9);
    }
  });

  it("le radici di 0 sono n zeri (molteplicità)", () => {
    for (const n of [2, 3, 5]) {
      const radici = computeNthRoots(c(0, 0), n);
      expect(radici).toHaveLength(n);
      for (const r of radici) expect(abs(r)).toBe(0);
    }
  });

  it("identifica quale radice è il punto selezionato", () => {
    const z = fromPolar(1.3, 0.8);
    for (const n of [2, 3, 5, 7]) {
      const k = indiceRadiceSelezionata(z, n);
      expect(k).toBeGreaterThanOrEqual(0);
      vicino(computeNthRoots(mapZPower(z, n), n)[k], z, 1e-9);
    }
  });

  it("non è conforme nell'origine per n ≥ 2", () => {
    for (const n of [2, 3, 4, 5]) {
      expect(abs(derivativeZPower(c(0, 0), n))).toBe(0);
      const z = c(0.7, 0.3);
      // det J = |f'|²  =  n²|z|^(2n−2)
      expect(Math.pow(abs(derivativeZPower(z, n)), 2))
        .toBeCloseTo(n * n * Math.pow(abs(z), 2 * n - 2), 8);
    }
  });

  it("rifiuta esponenti non interi", () => {
    expect(() => mapZPower(c(0, 1), 2.5)).toThrow();
    expect(() => computeNthRoots(c(0, 1), 0)).toThrow();
  });
});

// ===========================================================================
describe("z^i: ramo principale", () => {
  it("i^i = e^(−π/2) ≈ 0,2078796 ed è reale positivo", () => {
    const w = mapZiPrincipal(c(0, 1));
    expect(Math.abs(w.im)).toBeLessThan(1e-15);
    expect(w.re).toBeCloseTo(Math.exp(-PI / 2), 14);
    expect(w.re).toBeCloseTo(0.20787957635076193, 12);
    expect(I_ALLA_I).toBeCloseTo(w.re, 14);
  });

  it("coincide con exp(i·Log z)", () => {
    for (const z of PUNTI) {
      const L = principalLog(z);
      vicino(mapZiPrincipal(z), exp(c(-L.im, L.re)), 1e-12);
    }
  });

  it("|z^i| = e^(−Arg z): dipende solo dall'argomento", () => {
    for (const z of PUNTI) {
      expect(abs(mapZiPrincipal(z))).toBeCloseTo(Math.exp(-argPrincipal(z)), 10);
      expect(ziModulus(z)).toBeCloseTo(abs(mapZiPrincipal(z)), 10);
    }
  });

  it("il modulo è costante lungo ogni raggio", () => {
    const theta = 0.9;
    for (const r of [0.1, 0.5, 1, 2, 50, 1000]) {
      expect(abs(mapZiPrincipal(fromPolar(r, theta)))).toBeCloseTo(Math.exp(-theta), 10);
    }
  });

  it("arg(z^i) ≡ ln|z| (mod 2π): dipende solo dal modulo", () => {
    for (const z of PUNTI.filter(lontanoDalTaglio)) {
      angoliCongruenti(argPrincipal(mapZiPrincipal(z)), Math.log(abs(z)), 1e-9);
    }
  });

  it("l'argomento è costante su ogni circonferenza", () => {
    const r0 = 2;
    for (let j = 0; j < 50; j += 1) {
      const theta = -PI + 0.01 + (j * (DUE_PI - 0.02)) / 49;
      angoliCongruenti(argPrincipal(mapZiPrincipal(fromPolar(r0, theta))), Math.log(r0), 1e-9);
    }
  });

  it("non è definita nell'origine", () => {
    const w = mapZiPrincipal(c(0, 0));
    expect(Number.isNaN(w.re)).toBe(true);
    expect(Number.isNaN(w.im)).toBe(true);
  });

  it("vicino all'origine il modulo resta limitato: è la fase che oscilla", () => {
    const moduli: number[] = [];
    const fasi: number[] = [];
    for (const r of [1e-1, 1e-3, 1e-6, 1e-12, 1e-30]) {
      const z = fromPolar(r, 0.5);
      moduli.push(abs(mapZiPrincipal(z)));
      fasi.push(ziArgument(z, false));
    }
    for (const m of moduli) expect(m).toBeCloseTo(Math.exp(-0.5), 12);
    for (let j = 1; j < fasi.length; j += 1) expect(fasi[j]).toBeLessThan(fasi[j - 1]);
    expect(fasi[fasi.length - 1]).toBeLessThan(-60);
  });

  it("è conforme in ogni punto del piano tagliato", () => {
    for (const z of PUNTI.filter(lontanoDalTaglio)) {
      const d = derivativeZi(z);
      expect(abs(d)).toBeGreaterThan(0);
      expect(Number.isFinite(abs(d))).toBe(true);
    }
  });

  it("la derivata coincide con il rapporto incrementale", () => {
    const z0 = c(1.3, 0.7);
    const h = 1e-7;
    const avanti = mapZiPrincipal(c(z0.re + h, z0.im));
    const indietro = mapZiPrincipal(c(z0.re - h, z0.im));
    const numerica = c((avanti.re - indietro.re) / (2 * h), (avanti.im - indietro.im) / (2 * h));
    vicino(derivativeZi(z0), numerica, 1e-6);
  });
});

// ===========================================================================
describe("z^i: immagine e iniettività", () => {
  it("l'immagine sta nella corona e^(−π) ≤ |w| < e^(π)", () => {
    let seme = 12345;
    const rnd = () => {
      seme = (seme * 1103515245 + 12345) & 0x7fffffff;
      return seme / 0x7fffffff;
    };
    let massimo = 0;
    for (let j = 0; j < 20000; j += 1) {
      const z = c(rnd() * 8 - 4, rnd() * 8 - 4);
      if (z.re === 0 && z.im === 0) continue;
      const m = abs(mapZiPrincipal(z));
      expect(m).toBeGreaterThanOrEqual(E_MENO_PI - 1e-12);
      massimo = Math.max(massimo, m);
    }
    // L'estremo esterno non è mai attinto.
    expect(massimo).toBeLessThan(E_PI);
  });

  it("l'estremo interno è attinto sul semiasse reale negativo", () => {
    expect(abs(mapZiPrincipal(c(-3, 0)))).toBeCloseTo(E_MENO_PI, 12);
  });

  it("dichiara correttamente quali estremi sono inclusi", () => {
    expect(imageAnnulus("tagliato").rMinIncluso).toBe(false);
    expect(imageAnnulus("bucato").rMinIncluso).toBe(true);
    expect(imageAnnulus("tagliato").rMaxIncluso).toBe(false);
    expect(imageAnnulus("bucato").rMaxIncluso).toBe(false);
  });

  it("NON è iniettiva sul piano tagliato: controesempio 1 e e^(2π)", () => {
    const z1 = c(1, 0);
    const z2 = c(Math.exp(DUE_PI), 0);
    expect(abs(c(z1.re - z2.re, z1.im - z2.im))).toBeGreaterThan(500);
    expect(nearBranchCut(z1)).toBe(false);
    expect(nearBranchCut(z2)).toBe(false);
    vicino(mapZiPrincipal(z1), mapZiPrincipal(z2), 1e-9);
  });

  it("la fibra è una progressione geometrica allineata", () => {
    const z = c(1.4, 0.6);
    const fibra = ziFiber(z, [-2, -1, 0, 1, 2]);
    expect(fibra).toHaveLength(5);
    for (const p of fibra) angoliCongruenti(argPrincipal(p), argPrincipal(z), 1e-12);
    const riferimento = mapZiPrincipal(fibra[2]);
    for (const p of fibra) vicino(mapZiPrincipal(p), riferimento, 1e-8);
  });

  it("è iniettiva sulla corona di ampiezza 2π in ln|z|", () => {
    const { rMin, rMax } = injectivityAnnulus(c(1.5, 0.2));
    expect(Math.log(rMax) - Math.log(rMin)).toBeCloseTo(DUE_PI, 10);
    expect(abs(c(1.5, 0.2))).toBeGreaterThanOrEqual(rMin);
    expect(abs(c(1.5, 0.2))).toBeLessThan(rMax);

    const campioniZ: Complex[] = [];
    for (let j = 0; j < 120; j += 1) {
      const s = (j + 0.5) / 120;
      const r = Math.exp(Math.log(rMin) + s * (Math.log(rMax) - Math.log(rMin)) * 0.98);
      const th = -PI + 0.05 + s * (DUE_PI - 0.1);
      campioniZ.push(fromPolar(r, th));
    }
    const immagini = campioniZ.map(mapZiPrincipal);
    for (let a = 0; a < immagini.length; a += 1) {
      for (let b = a + 1; b < immagini.length; b += 1) {
        expect(Math.hypot(immagini[a].re - immagini[b].re, immagini[a].im - immagini[b].im))
          .toBeGreaterThan(1e-7);
      }
    }
  });

  it("attraversando il taglio il modulo salta di e^(2π) ≈ 535,49", () => {
    const sopra = abs(mapZiPrincipal(c(-2, 1e-9)));
    const sotto = abs(mapZiPrincipal(c(-2, -1e-9)));
    expect(sotto / sopra).toBeCloseTo(Math.exp(DUE_PI), 4);
    expect(sotto / sopra).toBeCloseTo(535.4916555, 3);
  });

  it("rileva la vicinanza al taglio", () => {
    expect(nearBranchCut(c(-2, 0), 1e-3)).toBe(true);
    expect(nearBranchCut(c(-2, 1e-4), 1e-3)).toBe(true);
    expect(nearBranchCut(c(-2, 0.5), 1e-3)).toBe(false);
    expect(nearBranchCut(c(2, 0), 1e-3)).toBe(false);
  });

  it("la soglia di aliasing dipende dal passo di campionamento", () => {
    const h = 6 / 512;
    const r = aliasingRadius(h);
    expect(h / r).toBeCloseTo(PI / 2, 12);
    // Raddoppiando la risoluzione, il raggio critico si dimezza.
    expect(aliasingRadius(h / 2)).toBeCloseTo(r / 2, 12);
  });
});

// ===========================================================================
describe("z^i: multivalenza", () => {
  it("il ramo 0 è il principale", () => {
    for (const z of PUNTI) vicino(mapZiBranch(z, 0), mapZiPrincipal(z), 1e-14);
  });

  it("z^i_k = z^i · e^(−2πk)", () => {
    const z = c(1, 1);
    for (const k of [-2, -1, 0, 1, 2]) {
      const base = mapZiPrincipal(z);
      const f = Math.exp(-DUE_PI * k);
      vicino(mapZiBranch(z, k), c(base.re * f, base.im * f), 1e-10 * Math.max(1, f));
    }
  });

  it("coincide con exp(i·log_k z)", () => {
    const z = c(-0.8, 1.1);
    const rami = computeLogBranches(z, [-2, -1, 0, 1, 2]);
    rami.forEach((L, idx) => {
      const k = idx - 2;
      const atteso = exp(c(-L.im, L.re));
      vicino(mapZiBranch(z, k), atteso, 1e-8 * Math.max(1, abs(atteso)));
    });
  });

  it("tutti i rami hanno lo stesso argomento: allineamento radiale", () => {
    const z = c(2, -0.5);
    const a0 = argPrincipal(mapZiBranch(z, 0));
    for (const k of [-2, -1, 1, 2]) {
      angoliCongruenti(argPrincipal(mapZiBranch(z, k)), a0, 1e-9);
    }
  });

  it("rami consecutivi stanno nel rapporto e^(−2π)", () => {
    const z = c(1.7, 0.3);
    for (const k of [-2, -1, 0, 1]) {
      const r = abs(mapZiBranch(z, k + 1)) / abs(mapZiBranch(z, k));
      expect(r).toBeCloseTo(FATTORE_RAMO, 12);
    }
  });

  it("i valori di i^i sono e^(−π/2−2πk), tutti reali positivi", () => {
    for (const k of [-2, -1, 0, 1, 2]) {
      const w = mapZiBranch(c(0, 1), k);
      expect(Math.abs(w.im)).toBeLessThan(1e-12 * Math.max(1, Math.abs(w.re)));
      expect(w.re).toBeCloseTo(Math.exp(-PI / 2 - DUE_PI * k), 8);
    }
  });

  it("rifiuta rami non interi", () => {
    expect(() => mapZiBranch(c(0, 1), 0.5)).toThrow();
  });
});

// ===========================================================================
describe("casi speciali guidati", () => {
  it("la circonferenza unitaria va nel segmento reale [e^(−π), e^(π))", () => {
    // L'estremo sinistro e^(−π) è attinto SOLO in θ = π esattamente, cioè in
    // z = −1: il campionamento deve quindi includere π come estremo destro.
    const punti = campiona((t) => fromPolar(1, t), -PI + 1e-12, PI, 2001);
    const immagini = punti.map(mapZiPrincipal);
    let minimo = Infinity;
    let massimo = -Infinity;
    for (const w of immagini) {
      expect(Math.abs(w.im)).toBeLessThan(1e-12);
      expect(w.re).toBeGreaterThan(0);
      minimo = Math.min(minimo, w.re);
      massimo = Math.max(massimo, w.re);
    }
    expect(minimo).toBeCloseTo(E_MENO_PI, 9);
    // Il minimo è attinto esattamente in z = −1, dove Arg z = +π.
    expect(mapZiPrincipal(c(-1, 0)).re).toBeCloseTo(E_MENO_PI, 14);
    // Semiaperto: l'estremo destro non è attinto, nemmeno al limite.
    expect(massimo).toBeLessThan(E_PI);
    expect(E_PI - massimo).toBeGreaterThan(0);
  });

  it("il semiasse reale positivo va nella circonferenza unitaria, percorsa infinite volte", () => {
    const punti = campiona((t) => c(Math.exp(-30 + t * 60), 0), 0, 1, 4001);
    for (const z of punti) expect(abs(mapZiPrincipal(z))).toBeCloseTo(1, 10);
    const fasi = punti.map((z) => ziArgument(z, false));
    const giri = (Math.max(...fasi) - Math.min(...fasi)) / DUE_PI;
    expect(giri).toBeCloseTo(60 / DUE_PI, 6);
    expect(giri).toBeGreaterThan(9);
  });

  it("un raggio va in una circonferenza di modulo costante", () => {
    const theta = -0.4;
    const punti = campiona((t) => fromPolar(Math.exp(-15 + t * 30), theta), 0, 1, 3001);
    const immagini = punti.map(mapZiPrincipal);
    for (const w of immagini) expect(abs(w)).toBeCloseTo(Math.exp(-theta), 10);
    const args = immagini.map(argPrincipal);
    expect(Math.min(...args)).toBeLessThan(-PI / 2);
    expect(Math.max(...args)).toBeGreaterThan(PI / 2);
  });

  it("una circonferenza va in un SEGMENTO radiale, non in una semiretta", () => {
    const r0 = 0.6;
    const punti = campiona((t) => fromPolar(r0, t), -PI + 1e-9, PI, 1501);
    const immagini = punti.map(mapZiPrincipal);
    for (const w of immagini) angoliCongruenti(argPrincipal(w), Math.log(r0), 1e-9);
    const moduli = immagini.map(abs);
    const minimo = Math.min(...moduli);
    const massimo = Math.max(...moduli);
    expect(minimo).toBeCloseTo(E_MENO_PI, 9);
    expect(massimo).toBeLessThan(E_PI); // limitato: segmento, non semiretta
    expect(massimo / minimo).toBeCloseTo(Math.exp(DUE_PI), 2);
  });

  it("valori notevoli tabellati", () => {
    vicino(mapZiPrincipal(c(1, 0)), c(1, 0), 1e-12);
    vicino(mapZiPrincipal(c(0, 1)), c(Math.exp(-PI / 2), 0), 1e-12);
    vicino(mapZiPrincipal(c(0, -1)), c(Math.exp(PI / 2), 0), 1e-12);
    vicino(mapZiPrincipal(c(-1, 0)), c(Math.exp(-PI), 0), 1e-12);
  });

  it("(1+i)^i ha modulo e^(−π/4) e argomento ln√2", () => {
    const w = mapZiPrincipal(c(1, 1));
    expect(abs(w)).toBeCloseTo(Math.exp(-PI / 4), 12);
    expect(argPrincipal(w)).toBeCloseTo(0.5 * Math.log(2), 12);
  });
});

// ===========================================================================
describe("curve e immagini", () => {
  it("l'immagine di una circonferenza sotto z^i resta un unico segmento", () => {
    const img = immagineCurva(cerchio(1.2), mapZiPrincipal, COLORI.immagine);
    expect(img.segmenti.length).toBe(1);
    expect(img.segmenti[0].length).toBeGreaterThan(100);
  });

  it("l'immagine di una curva che attraversa il taglio viene spezzata", () => {
    // Segmento orizzontale a quota nulla che passa sopra il semiasse negativo:
    // il salto di fattore e^(2π) non deve essere unito da una corda.
    const attraversa = {
      id: "test-taglio",
      tipo: "traiettoria" as const,
      colore: COLORI.traiettoria,
      larghezza: 2,
      segmenti: [campiona((t) => c(-2 + 4 * t, 0.0), 0, 1, 801)],
    };
    const img = immagineCurva(attraversa, mapZiPrincipal, COLORI.immagine);
    expect(img.segmenti.length).toBeGreaterThanOrEqual(2);
  });

  it("l'immagine di un raggio sotto z^i ha modulo costante", () => {
    const img = immagineCurva(raggio(0.7, 0.1, 3), mapZiPrincipal, COLORI.immagine);
    const tutti = img.segmenti.flat();
    for (const w of tutti) expect(abs(w)).toBeCloseTo(Math.exp(-0.7), 9);
  });
});
