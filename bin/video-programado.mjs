#!/usr/bin/env node
// Entrada do pacote.
//   video-programado            inicia o servidor MCP (stdio), modo usado pelos assistentes de IA
//   video-programado mcp        o mesmo
//   video-programado custo ARQ  valida um roteiro JSON e mostra o custo estimado (não gasta)
//   video-programado criar ARQ  gera o vídeo pela linha de comando
import fs from 'node:fs';
import path from 'node:path';
import {erroSeguro, log} from '../src/servidor/log.mjs';

const [comando = 'mcp', arquivo] = process.argv.slice(2);

function lerRoteiro(arq) {
  if (!arq) throw new Error('Informe o arquivo do roteiro: video-programado criar roteiro.json');
  const caminho = path.resolve(arq);
  const tamanho = fs.statSync(caminho).size;
  if (tamanho > 200_000) throw new Error('Arquivo de roteiro grande demais (máximo de 200 KB).');
  return JSON.parse(fs.readFileSync(caminho, 'utf8'));
}

async function principal() {
  if (comando === 'mcp') {
    // stdout é exclusivo do protocolo MCP: qualquer console.* de dependências vai para stderr.
    for (const nivel of ['log', 'info', 'warn', 'debug']) console[nivel] = (...a) => log(...a);
    const {StdioServerTransport} = await import('@modelcontextprotocol/sdk/server/stdio.js');
    const {criarServidor} = await import('../src/servidor/mcp.mjs');
    const {servidor} = criarServidor();
    await servidor.connect(new StdioServerTransport());
    log('servidor MCP pronto');
    return;
  }
  if (comando === 'custo') {
    const {conferirAntesDeGastar} = await import('../src/servidor/gerar.mjs');
    const {roteiro, custo, teto} = conferirAntesDeGastar(lerRoteiro(arquivo));
    console.log(`Roteiro válido: ${roteiro.cenas.length} cenas, cerca de ${custo.segundosVideo} s.`);
    console.log(`Custo estimado: US$ ${custo.usd.total.toFixed(4)} (teto US$ ${teto.toFixed(2)}).`);
    return;
  }
  if (comando === 'criar') {
    const {gerarVideo} = await import('../src/servidor/gerar.mjs');
    let ultimo = '';
    const r = await gerarVideo(lerRoteiro(arquivo), {
      progresso: (etapa, p) => { const l = `${etapa} ${Math.round(p)}%`; if (l !== ultimo) { ultimo = l; process.stderr.write(`\r${l}      `); } },
    });
    process.stderr.write('\n');
    console.log(`Pronto: ${r.arquivo} (${r.duracaoSegundos} s, custo estimado US$ ${r.custoEstimadoUsd.toFixed(4)})`);
    return;
  }
  throw new Error(`Comando desconhecido: ${comando}. Use: mcp, custo ou criar.`);
}

principal().catch((e) => {
  log('erro:', erroSeguro(e));
  process.exitCode = 1;
});
