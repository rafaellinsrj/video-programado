// Teste de ponta a ponta do MCP: inicia o servidor por stdio (como um assistente faria),
// chama as ferramentas e gera um vídeo de verdade. Gasta cerca de US$ 0,01 de crédito da OpenAI.
// Uso: OPENAI_API_KEY=... VIDEO_PROGRAMADO_SAIDA=/pasta node test/e2e/mcp-e2e.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

const roteiro = JSON.parse(fs.readFileSync(new URL('../../exemplos/exemplo.json', import.meta.url), 'utf8'));
const texto = (r) => r.content.map((c) => c.text).join('\n');

const transporte = new StdioClientTransport({
  command: process.execPath,
  args: ['bin/video-programado.mjs'],
  env: {...process.env},
  stderr: 'inherit',
});
const cliente = new Client({name: 'teste-e2e', version: '1.0.0'});
await cliente.connect(transporte);

const {tools} = await cliente.listTools();
assert.equal(tools.length, 5);
console.log('ferramentas:', tools.map((t) => t.name).join(', '));

const guia = await cliente.callTool({name: 'como_criar', arguments: {}});
assert.match(texto(guia), /Tipos de visual/);

const custo = await cliente.callTool({name: 'estimar_custo', arguments: {roteiro}});
console.log(texto(custo));
assert.notEqual(custo.isError, true);

const criar = await cliente.callTool({name: 'criar_video', arguments: {roteiro, confirmado: true}});
console.log(texto(criar));
assert.notEqual(criar.isError, true);
const id = texto(criar).match(/Tarefa: ([0-9a-f-]{36})/)[1];

const inicio = Date.now();
let final;
while (Date.now() - inicio < 20 * 60_000) {
  await new Promise((r) => setTimeout(r, 10_000));
  const s = await cliente.callTool({name: 'status_video', arguments: {id}});
  console.log(`[${Math.round((Date.now() - inicio) / 1000)} s]`, texto(s));
  if (s.isError) throw new Error(texto(s));
  if (/Pronto!/.test(texto(s))) { final = texto(s); break; }
}
assert.ok(final, 'o vídeo não ficou pronto a tempo');
const arquivo = final.match(/Arquivo: (.+\.mp4)/)[1];
assert.ok(fs.statSync(arquivo).size > 500_000, 'MP4 pequeno demais');
const chave = process.env.OPENAI_API_KEY || '';
assert.ok(chave.length > 10 && !final.includes(chave), 'a chave não pode aparecer nas respostas');
console.log('OK:', arquivo);
await cliente.close();
