import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {criarServidor} from '../src/servidor/mcp.mjs';
import {Fila} from '../src/servidor/tarefas.mjs';

const CHAVE = 'sk-test-' + 'Z9y8X7w6V5u4T3s2R1q0P9o8N7m6L5k4';
const exemplo = JSON.parse(fs.readFileSync(new URL('../exemplos/exemplo.json', import.meta.url), 'utf8'));

async function conectar(opcoes) {
  const {servidor, fila} = criarServidor(opcoes);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const cliente = new Client({name: 'teste', version: '1.0.0'});
  await Promise.all([servidor.connect(a), cliente.connect(b)]);
  return {cliente, fila};
}
const textoDe = (r) => r.content.map((c) => c.text).join('\n');
const idDe = (r) => textoDe(r).match(/Tarefa: ([0-9a-f-]{36})/)[1];
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

test('expõe só as 5 ferramentas previstas', async () => {
  const {cliente} = await conectar({executar: async () => ({}), env: {}});
  const {tools} = await cliente.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ['cancelar_video', 'como_criar', 'criar_video', 'estimar_custo', 'status_video']);
});

test('criar_video exige confirmado=true e não executa sem ele', async () => {
  let executou = false;
  const {cliente} = await conectar({executar: async () => { executou = true; }, env: {OPENAI_API_KEY: CHAVE}});
  const r = await cliente.callTool({name: 'criar_video', arguments: {roteiro: exemplo}});
  assert.equal(r.isError, true);
  const r2 = await cliente.callTool({name: 'criar_video', arguments: {roteiro: exemplo, confirmado: 'sim'}});
  assert.equal(r2.isError, true);
  await esperar(20);
  assert.equal(executou, false);
});

test('criar_video sem chave falha antes de gastar', async () => {
  let executou = false;
  const {cliente} = await conectar({executar: async () => { executou = true; }, env: {}});
  const r = await cliente.callTool({name: 'criar_video', arguments: {roteiro: exemplo, confirmado: true}});
  assert.equal(r.isError, true);
  assert.match(textoDe(r), /OPENAI_API_KEY/);
  await esperar(20);
  assert.equal(executou, false);
});

test('roteiro inválido ou acima do teto é recusado antes de gastar', async () => {
  let executou = false;
  const {cliente} = await conectar({executar: async () => { executou = true; }, env: {OPENAI_API_KEY: CHAVE, VIDEO_PROGRAMADO_MAX_USD: '0.0001'}});
  const invalido = await cliente.callTool({name: 'criar_video', arguments: {roteiro: {...exemplo, cenas: []}, confirmado: true}});
  assert.equal(invalido.isError, true);
  const caro = await cliente.callTool({name: 'criar_video', arguments: {roteiro: exemplo, confirmado: true}});
  assert.equal(caro.isError, true);
  assert.match(textoDe(caro), /teto/);
  await esperar(20);
  assert.equal(executou, false);
});

test('fluxo completo com executor simulado: tarefa, progresso e resultado', async () => {
  const {cliente} = await conectar({
    env: {OPENAI_API_KEY: CHAVE},
    executar: async (roteiro, {progresso}) => { progresso('renderizando', 50); await esperar(30); return {arquivo: '/tmp/x.mp4', duracaoSegundos: 30, custoEstimadoUsd: 0.02}; },
  });
  const est = await cliente.callTool({name: 'estimar_custo', arguments: {roteiro: exemplo}});
  assert.match(textoDe(est), /Custo estimado: US\$ 0\.0/);
  const r = await cliente.callTool({name: 'criar_video', arguments: {roteiro: exemplo, confirmado: true}});
  assert.notEqual(r.isError, true);
  const id = idDe(r);
  await esperar(80);
  const s = await cliente.callTool({name: 'status_video', arguments: {id}});
  assert.match(textoDe(s), /Pronto! Arquivo: \/tmp\/x\.mp4/);
});

test('nenhuma resposta das ferramentas carrega a chave, nem em erro do executor', async () => {
  const {cliente} = await conectar({env: {OPENAI_API_KEY: CHAVE}, executar: async () => { throw new Error(`falha interna usando ${CHAVE}`); }});
  const respostas = [];
  respostas.push(await cliente.callTool({name: 'como_criar', arguments: {}}));
  const r = await cliente.callTool({name: 'criar_video', arguments: {roteiro: exemplo, confirmado: true}});
  respostas.push(r);
  await esperar(30);
  respostas.push(await cliente.callTool({name: 'status_video', arguments: {id: idDe(r)}}));
  for (const resp of respostas) assert.doesNotMatch(textoDe(resp), new RegExp(CHAVE));
  assert.equal(respostas.at(-1).isError, true);
});

test('status de tarefa inexistente ou id malformado é recusado', async () => {
  const {cliente} = await conectar({executar: async () => ({}), env: {}});
  const r = await cliente.callTool({name: 'status_video', arguments: {id: '00000000-0000-4000-8000-000000000000'}});
  assert.equal(r.isError, true);
  const r2 = await cliente.callTool({name: 'status_video', arguments: {id: '../../etc'}});
  assert.equal(r2.isError, true);
});

test('fila: uma geração por vez, no máximo 2 esperando, cancelamento e campos públicos', async () => {
  let liberar;
  const travada = new Promise((r) => { liberar = r; });
  const fila = new Fila(async (_d, {sinal}) => { await travada; if (sinal.aborted) throw new Error('cancelado'); return {ok: true}; });
  const a = fila.criar({}); const b = fila.criar({}); const c = fila.criar({});
  assert.throws(() => fila.criar({}), /fila/);
  await esperar(5);
  assert.equal(fila.status(a.id).estado, 'gerando');
  assert.equal(fila.cancelar(c.id).estado, 'cancelada');
  assert.deepEqual(Object.keys(fila.status(b.id)).sort(), ['criada', 'erro', 'estado', 'etapa', 'id', 'progresso', 'resultado']);
  fila.cancelar(a.id); liberar();
  await esperar(20);
  assert.equal(fila.status(a.id).estado, 'cancelada');
  assert.equal(fila.status(b.id).estado, 'concluída');
});
