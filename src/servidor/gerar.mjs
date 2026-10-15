import fs from 'node:fs';
import path from 'node:path';
import {apagarPasta, caminhoVideo, criarPastaTemporaria} from './caminhos.mjs';
import {estimarCusto, tetoUsd} from './custo.mjs';
import {montarLinhaDoTempo} from './linha-do-tempo.mjs';
import {log} from './log.mjs';
import {chaveOpenAI, gerarVoz, transcrever} from './openai.mjs';
import {renderizar} from './render.mjs';
import {validarRoteiro} from './roteiro.mjs';

const IDIOMA = {pt: 'Fale em português do Brasil.', en: 'Speak in American English.', es: 'Habla en español latinoamericano.'};

/** Confere roteiro e custo antes de qualquer chamada paga. Lança erro se passar do teto. */
export function conferirAntesDeGastar(entrada, env = process.env) {
  const roteiro = validarRoteiro(entrada);
  const custo = estimarCusto(roteiro);
  const teto = tetoUsd(env);
  if (custo.usd.total > teto) {
    throw new Error(`Custo estimado de US$ ${custo.usd.total.toFixed(4)} passa do teto de US$ ${teto.toFixed(2)} por vídeo. Encurte o roteiro ou ajuste VIDEO_PROGRAMADO_MAX_USD.`);
  }
  return {roteiro, custo, teto};
}

async function emParalelo(itens, limite, fn) {
  const saida = new Array(itens.length);
  let proximo = 0;
  const trabalhadores = Array.from({length: Math.min(limite, itens.length)}, async () => {
    while (proximo < itens.length) {
      const i = proximo++;
      saida[i] = await fn(itens[i], i);
    }
  });
  await Promise.all(trabalhadores);
  return saida;
}

/** Pipeline completo: voz, tempo por palavra, linha do tempo e render. Devolve o caminho do MP4. */
export async function gerarVideo(entrada, {sinal, progresso = () => {}, env = process.env} = {}) {
  const {roteiro, custo} = conferirAntesDeGastar(entrada, env);
  const chave = chaveOpenAI(env);
  const destino = caminhoVideo(roteiro.titulo, new Date(), env);
  const pasta = criarPastaTemporaria();
  const publico = path.join(pasta, 'publico');
  fs.mkdirSync(publico);
  const parar = () => { if (sinal?.aborted) throw new Error('cancelado'); };
  try {
    const estilo = `${IDIOMA[roteiro.opcoes.idioma]} ${roteiro.opcoes.estilo}`;
    let feitas = 0;
    progresso('gerando a voz', 2);
    const falas = await emParalelo(roteiro.cenas, 3, async (cena, i) => {
      parar();
      const audio = await gerarVoz({texto: cena.fala, voz: roteiro.opcoes.voz, estilo, chave});
      parar();
      fs.writeFileSync(path.join(publico, `cena-${String(i + 1).padStart(2, '0')}.mp3`), audio);
      const t = await transcrever({audio, idioma: roteiro.opcoes.idioma, chave});
      feitas++;
      progresso('gerando a voz', 2 + (feitas / roteiro.cenas.length) * 40);
      return t;
    });
    parar();
    const linha = montarLinhaDoTempo(roteiro, falas);
    await renderizar({linha, pasta, destino, sinal, progresso, env});
    log('vídeo pronto:', path.basename(destino));
    return {arquivo: destino, duracaoSegundos: Math.round(linha.duracao), custoEstimadoUsd: custo.usd.total};
  } finally {
    apagarPasta(pasta);
  }
}
