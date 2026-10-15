import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {efeitos, gravarWav, SAMPLE_RATE, trilha} from '../src/servidor/audio.mjs';
import {montarLinhaDoTempo, normalizar, tempoDaPalavra} from '../src/servidor/linha-do-tempo.mjs';
import {validarRoteiro} from '../src/servidor/roteiro.mjs';

const roteiro = () => validarRoteiro(JSON.parse(fs.readFileSync(new URL('../exemplos/exemplo.json', import.meta.url), 'utf8')));
const falasDe = (r) => r.cenas.map((c) => {
  const ws = c.fala.split(/\s+/);
  return {duracao: ws.length * 0.4, palavras: ws.map((w, i) => ({w, t: i * 0.4, f: i * 0.4 + 0.3}))};
});

test('recusa falas faltando ou vazias', () => {
  const r = roteiro();
  assert.throws(() => montarLinhaDoTempo(r, falasDe(r).slice(1)), /número de falas/);
  const f = falasDe(r); f[2] = {duracao: 0, palavras: []};
  assert.throws(() => montarLinhaDoTempo(r, f), /vazia/);
});

test('cenas em ordem, sem sobreposição, e palavras dentro da própria fala', () => {
  const r = roteiro();
  const l = montarLinhaDoTempo(r, falasDe(r));
  l.cenas.forEach((c, i) => {
    assert.ok(c.inicio < c.falaInicio && c.falaInicio < c.falaFim && c.falaFim <= c.fim, `cena ${i}`);
    if (i > 0) assert.equal(c.inicio, l.cenas[i - 1].fim);
    for (const p of c.palavras) assert.ok(p.t >= c.falaInicio && p.f <= c.falaFim + 1e-6);
  });
  assert.ok(l.duracao > l.cenas.at(-1).falaFim);
});

test('a aceleração encurta a fala na proporção certa', () => {
  const r = roteiro();
  const lento = montarLinhaDoTempo({...r, opcoes: {...r.opcoes, velocidade: 1}}, falasDe(r));
  const rapido = montarLinhaDoTempo({...r, opcoes: {...r.opcoes, velocidade: 1.5}}, falasDe(r));
  const d = (l) => l.cenas[0].falaFim - l.cenas[0].falaInicio;
  assert.ok(Math.abs(d(lento) / d(rapido) - 1.5) < 0.01);
});

test('efeitos em ordem, todos existentes no banco, e desligáveis', () => {
  const r = roteiro();
  const l = montarLinhaDoTempo(r, falasDe(r));
  const banco = efeitos();
  l.efeitos.forEach((e, i) => {
    assert.ok(banco[e.som], `efeito ${e.som} existe`);
    if (i > 0) assert.ok(e.t >= l.efeitos[i - 1].t);
  });
  assert.ok(new Set(l.efeitos.map((e) => e.som)).size >= 6, 'efeitos variados');
  const semEfeitos = montarLinhaDoTempo({...r, opcoes: {...r.opcoes, efeitos: false}}, falasDe(r));
  assert.equal(semEfeitos.efeitos.length, 0);
});

test('acha a palavra falada ignorando acento e pontuação', () => {
  assert.equal(normalizar('Árvore,'), 'arvore');
  const cena = {falaInicio: 10, falaFim: 12, palavras: [{w: 'o', t: 10, f: 10.1}, {w: 'DNS.', t: 11, f: 11.3}]};
  assert.equal(tempoDaPalavra(cena, 'dns', 0.5), 11);
  assert.equal(tempoDaPalavra(cena, 'inexistente', 0.5), 11);
});

test('trilha e efeitos geram WAV válido', () => {
  const s = trilha(2);
  assert.equal(s.length, SAMPLE_RATE * 2);
  assert.ok(Math.max(...s.map(Math.abs)) <= 1);
  const arq = new URL('../saida-teste.wav', import.meta.url);
  try {
    gravarWav(arq, s.slice(0, 1000));
    const b = fs.readFileSync(arq);
    assert.equal(b.toString('ascii', 0, 4), 'RIFF');
    assert.equal(b.toString('ascii', 8, 12), 'WAVE');
    assert.equal(b.length, 44 + 1000 * 4);
  } finally { fs.rmSync(arq, {force: true}); }
});
