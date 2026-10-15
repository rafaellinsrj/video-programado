import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {apagarPasta, caminhoVideo, criarPastaTemporaria, dentroDe, pastaSaida} from '../src/servidor/caminhos.mjs';
import {estimarCusto, tetoUsd} from '../src/servidor/custo.mjs';
import {conferirAntesDeGastar} from '../src/servidor/gerar.mjs';
import {erroSeguro, redigir} from '../src/servidor/log.mjs';
import {CONFIG, chaveOpenAI, gerarVoz} from '../src/servidor/openai.mjs';
import {validarRoteiro} from '../src/servidor/roteiro.mjs';

const CHAVE = 'sk-test-' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6';
const roteiroCurto = {titulo: 'Teste', cenas: [{fala: 'Uma frase curta.', visual: {tipo: 'titulo', texto: 'Oi'}}]};

test('caminho do vídeo fica sempre dentro da pasta de saída', () => {
  const env = {VIDEO_PROGRAMADO_SAIDA: path.join(os.tmpdir(), 'vp-saida')};
  for (const titulo of ['../../../etc/passwd', '..\\..\\win', '/abs/olute', 'normal']) {
    const c = caminhoVideo(titulo, new Date('2026-10-15T12:00:00Z'), env);
    assert.ok(c.startsWith(env.VIDEO_PROGRAMADO_SAIDA + path.sep), c);
    assert.match(path.basename(c), /^[a-z0-9-]+-20261015-120000\.mp4$/);
  }
});

test('pasta de saída relativa é recusada e o padrão fica na pasta de vídeos do usuário', () => {
  assert.throws(() => pastaSaida({VIDEO_PROGRAMADO_SAIDA: 'videos'}), /absoluto/);
  assert.ok(pastaSaida({}).startsWith(os.homedir()));
});

test('dentroDe bloqueia escape por .. e por prefixo parecido', () => {
  assert.throws(() => dentroDe('/tmp/base', '/tmp/base/../outro/x.mp4'), /fora/);
  assert.throws(() => dentroDe('/tmp/base', '/tmp/base-malicioso/x.mp4'), /fora/);
  assert.equal(dentroDe('/tmp/base', '/tmp/base/x.mp4'), '/tmp/base/x.mp4');
});

test('apagarPasta só remove pastas temporárias do próprio projeto', () => {
  assert.throws(() => apagarPasta(os.homedir()), /recusado/);
  assert.throws(() => apagarPasta(path.join(os.tmpdir(), 'outra-coisa')), /recusado/);
  const p = criarPastaTemporaria();
  fs.writeFileSync(path.join(p, 'a.txt'), 'x');
  apagarPasta(p);
  assert.equal(fs.existsSync(p), false);
});

test('teto de custo bloqueia antes de gastar e aceita ajuste válido', () => {
  const longo = {titulo: 'x', cenas: Array.from({length: 8}, () => ({fala: 'a'.repeat(480), visual: {tipo: 'titulo', texto: 'x'}}))};
  assert.throws(() => conferirAntesDeGastar(longo, {VIDEO_PROGRAMADO_MAX_USD: '0.01'}), /passa do teto/);
  assert.ok(conferirAntesDeGastar(roteiroCurto, {}).custo.usd.total < 0.01);
  assert.equal(tetoUsd({VIDEO_PROGRAMADO_MAX_USD: 'abc'}), 0.5);
  assert.equal(tetoUsd({VIDEO_PROGRAMADO_MAX_USD: '-1'}), 0.5);
  assert.equal(tetoUsd({VIDEO_PROGRAMADO_MAX_USD: '2'}), 2);
});

test('estimativa de custo cresce com o tamanho do roteiro', () => {
  const um = estimarCusto(validarRoteiro(roteiroCurto)).usd.total;
  const dobro = estimarCusto(validarRoteiro({...roteiroCurto, cenas: [...roteiroCurto.cenas, ...roteiroCurto.cenas]})).usd.total;
  assert.ok(dobro > um);
});

test('chave ausente ou malformada é recusada sem ecoar o valor', () => {
  assert.throws(() => chaveOpenAI({}), /OPENAI_API_KEY/);
  try { chaveOpenAI({OPENAI_API_KEY: 'senha-errada-123'}); assert.fail('deveria falhar'); } catch (e) { assert.doesNotMatch(e.message, /senha-errada-123/); }
  assert.equal(chaveOpenAI({OPENAI_API_KEY: ` ${CHAVE} `}), CHAVE);
});

test('logs e erros nunca carregam a chave', () => {
  const env = {OPENAI_API_KEY: CHAVE};
  assert.doesNotMatch(redigir(`falhou com ${CHAVE}`, env), new RegExp(CHAVE));
  assert.doesNotMatch(redigir('Bearer sk-proj-abcdefghijklmnop', {}), /sk-proj/);
  assert.ok(erroSeguro(new Error('x'.repeat(5000))).length <= 800);
});

test('API: erro de chave não é repetido e a mensagem não expõe a chave nem o corpo', async () => {
  const original = globalThis.fetch;
  let chamadas = 0; let destino = ''; let auth = '';
  globalThis.fetch = async (url, init) => {
    chamadas++; destino = String(url); auth = init.headers.Authorization;
    return new Response(JSON.stringify({error: {message: `Incorrect API key provided: ${CHAVE}`}}), {status: 401});
  };
  try {
    await assert.rejects(gerarVoz({texto: 'oi', voz: 'echo', estilo: '', chave: CHAVE}), (e) => {
      assert.match(e.message, /401/);
      assert.doesNotMatch(e.message, new RegExp(CHAVE));
      return true;
    });
    assert.equal(chamadas, 1);
    assert.equal(new URL(destino).host, 'api.openai.com');
    assert.equal(auth, `Bearer ${CHAVE}`);
  } finally { globalThis.fetch = original; }
});

test('API: erro 500 é tentado no máximo 3 vezes', async () => {
  const original = globalThis.fetch; const espera = CONFIG.esperaMs;
  let chamadas = 0;
  CONFIG.esperaMs = 1;
  globalThis.fetch = async () => { chamadas++; return new Response('falha', {status: 500}); };
  try {
    await assert.rejects(gerarVoz({texto: 'oi', voz: 'echo', estilo: '', chave: CHAVE}), /500/);
    assert.equal(chamadas, 3);
  } finally { globalThis.fetch = original; CONFIG.esperaMs = espera; }
});

test('o servidor carrega sem erro e acha o executável do Remotion pelo campo bin', async () => {
  const mod = await import('../src/servidor/render.mjs');
  assert.equal(typeof mod.normalizarVolume, 'function');
  const {criarServidor} = await import('../src/servidor/mcp.mjs');
  assert.ok(criarServidor({executar: async () => ({}), env: {}}).servidor);
});
