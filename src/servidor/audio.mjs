// Trilha eletrônica e efeitos sonoros gerados por código (sem direito autoral de terceiros).
// Tudo sai em WAV 16 bits, estéreo, 44,1 kHz.

import fs from 'node:fs';

const SR = 44100;

export function gravarWav(caminho, amostras) {
  const n = amostras.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, amostras[i])) * 32767;
    buf.writeInt16LE(v | 0, 44 + i * 4);
    buf.writeInt16LE(v | 0, 46 + i * 4);
  }
  fs.writeFileSync(caminho, buf);
}

// Gerador pseudoaleatório com semente: o mesmo som sai igual em toda execução.
function rng(semente) {
  let s = semente >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 * 2 - 1; };
}

const env = (i, ataque, queda) => { const t = i / SR; return Math.min(1, t / Math.max(ataque, 1e-4)) * Math.exp(-t / queda); };

function somar(destino, origem, inicio, ganho = 1) {
  for (let i = 0; i < origem.length && inicio + i < destino.length; i++) destino[inicio + i] += origem[i] * ganho;
}

function bumbo() {
  const n = Math.floor(SR * 0.35); const s = new Float32Array(n); let fase = 0;
  for (let i = 0; i < n; i++) { const f = 50 + 110 * Math.exp(-(i / SR) * 30); fase += 2 * Math.PI * f / SR; s[i] = Math.sin(fase) * env(i, 0.002, 0.12); }
  return s;
}

function chimbal(dur, aleat) {
  const n = Math.floor(SR * dur); const s = new Float32Array(n); let ant = 0;
  for (let i = 0; i < n; i++) { const r = aleat(); s[i] = (r - ant) * env(i, 0.001, 0.015) * 0.35; ant = r; }
  return s;
}

function nota(f, dur, serra, queda) {
  const n = Math.floor(SR * dur); const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR; let v = 0;
    if (serra) for (let k = 1; k < 8; k++) v += Math.sin(2 * Math.PI * f * k * t) / k;
    else v = Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t);
    s[i] = v * env(i, 0.01, queda);
  }
  return s;
}

/** Trilha de música eletrônica em lá menor (Am F C G), 122 BPM, com a duração pedida. */
export function trilha(segundos) {
  const bpm = 122, batida = 60 / bpm, passo = batida / 4;
  const total = Math.floor(SR * segundos); const out = new Float32Array(total);
  const aleat = rng(7);
  const raizes = [55, 43.65, 65.41, 49];
  const acordes = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 261.63, 329.63], [196, 246.94, 293.66]];
  const kick = bumbo();
  for (let i = 0; i < segundos / passo; i++) {
    const ini = Math.floor(i * passo * SR); const comp = Math.floor(i / 16) % 4;
    if (i % 4 === 0) somar(out, kick, ini, 0.9);
    if (i % 4 === 2) somar(out, chimbal(0.09, aleat), ini, 1.4); else if (i % 2 === 1) somar(out, chimbal(0.06, aleat), ini);
    if (i % 2 === 0) somar(out, nota(raizes[comp] * (i % 8 === 6 ? 2 : 1), passo * 1.8, true, 0.09), ini, 0.22);
    if (i % 16 === 0) for (const f of acordes[comp]) somar(out, nota(f, batida * 4, false, 2.5), ini, 0.07);
    if (i % 4 === 3 && Math.floor(i / 4) % 2 === 1) somar(out, nota(acordes[comp][Math.floor(i / 8) % 3] * 2, passo * 2, false, 0.12), ini, 0.08);
  }
  let pico = 0; for (const v of out) pico = Math.max(pico, Math.abs(v));
  for (let i = 0; i < total; i++) out[i] = out[i] / (pico || 1) * 0.8;
  return out;
}

function ruidoVarrido(dur, f0, f1, aleat) {
  // passa-baixa de um polo com frequência de corte variando de f0 a f1
  const n = Math.floor(SR * dur); const s = new Float32Array(n); let y = 0;
  for (let i = 0; i < n; i++) {
    const fc = f0 + (f1 - f0) * (i / n); const a = 1 - Math.exp(-2 * Math.PI * fc / SR);
    y += a * (aleat() - y); s[i] = y * Math.sin(Math.PI * i / n);
  }
  return normalizar(s, 0.7);
}

function tom(f, dur, queda, ganho = 0.6) {
  const n = Math.floor(SR * dur); const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = (Math.sin(2 * Math.PI * f * i / SR) + 0.3 * Math.sin(4 * Math.PI * f * i / SR)) * env(i, 0.002, queda) * ganho;
  return s;
}

function normalizar(s, alvo) { let p = 0; for (const v of s) p = Math.max(p, Math.abs(v)); for (let i = 0; i < s.length; i++) s[i] = s[i] / (p || 1) * alvo; return s; }

/** Banco de efeitos variados. Devolve {nome: amostras}. */
export function efeitos() {
  const a = rng(11);
  const fx = {
    whoosh_grave: ruidoVarrido(0.5, 300, 2500, a),
    whoosh_agudo: ruidoVarrido(0.3, 1500, 7000, a),
    swipe_sobe: ruidoVarrido(0.55, 400, 9000, a),
    swipe_desce: ruidoVarrido(0.55, 9000, 400, a),
    blip_agudo: tom(1320, 0.12, 0.04),
    blip_medio: tom(880, 0.12, 0.04),
    blip_grave: tom(520, 0.14, 0.05),
  };
  for (let k = 0; k < 3; k++) {
    const n = Math.floor(SR * 0.04); const s = new Float32Array(n); let ant = 0;
    for (let i = 0; i < n; i++) { const r = a(); s[i] = ((r - ant) * env(i, 0.0005, 0.004 + 0.002 * k) + Math.sin(2 * Math.PI * (1800 + 500 * k) * i / SR) * env(i, 0.0005, 0.006) * 0.3) * 0.6; ant = r; }
    fx[`tecla${k + 1}`] = s;
  }
  {
    const n = Math.floor(SR * 0.7); const s = new Float32Array(n); let fase = 0;
    for (let i = 0; i < n; i++) { fase += 2 * Math.PI * (40 + 90 * Math.exp(-(i / SR) * 18)) / SR; s[i] = Math.sin(fase) * env(i, 0.002, 0.25) + a() * env(i, 0.001, 0.02) * 0.4; }
    fx.impacto = normalizar(s, 0.9);
  }
  {
    const n = Math.floor(SR * 0.6); const s = new Float32Array(n);
    somar(s, tom(1046.5, 0.6, 0.25, 0.45), 0); somar(s, tom(1568, 0.5, 0.3, 0.45), Math.floor(SR * 0.09));
    fx.sininho = s;
  }
  {
    const n = Math.floor(SR * 0.9); const s = new Float32Array(n); let fase = 0; const r = ruidoVarrido(0.9, 500, 7000, a);
    for (let i = 0; i < n; i++) { const u = i / n; fase += 2 * Math.PI * (200 + 1400 * u * u) / SR; s[i] = (Math.sin(fase) * 0.3 + r[i] * 0.5) * u * u; }
    fx.riser = normalizar(s, 0.7);
  }
  return fx;
}

export const SAMPLE_RATE = SR;
