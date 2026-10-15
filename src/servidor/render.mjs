import {execFile} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {makeCancelSignal, renderMedia, selectComposition} from '@remotion/renderer';
import {efeitos as bancoDeEfeitos, gravarWav, trilha} from './audio.mjs';
import {dentroDe} from './caminhos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const COMPOSICAO = 'VideoProgramado';

/** Caminho do executável oficial do Remotion (campo "bin" do pacote; o "exports" não expõe o arquivo). */
function cliRemotion() {
  const pacote = createRequire(import.meta.url).resolve('@remotion/cli/package.json');
  const {bin} = JSON.parse(fs.readFileSync(pacote, 'utf8'));
  const arquivo = path.resolve(path.dirname(pacote), typeof bin === 'string' ? bin : bin.remotion);
  return dentroDe(path.dirname(pacote), arquivo);
}

/**
 * Normaliza o volume para -14 LUFS (padrão das redes) com o ffmpeg que vem no Remotion
 * (comando oficial `remotion ffmpeg`). Sem shell: argumentos em lista, caminhos gerados por nós.
 */
export function normalizarVolume(entrada, saida, sinal) {
  const args = [cliRemotion(), 'ffmpeg', '-v', 'error', '-y', '-i', entrada, '-c:v', 'copy',
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', saida];
  return new Promise((resolver, rejeitar) => {
    execFile(process.execPath, args, {timeout: 300_000, signal: sinal, maxBuffer: 1024 * 1024}, (erro, _out, err) => {
      if (erro) rejeitar(new Error(`falha ao ajustar o volume: ${String(err || erro.message).slice(0, 300)}`));
      else resolver(saida);
    });
  });
}

/** Chrome opcional (VIDEO_PROGRAMADO_CHROME). Sem ele, o Remotion usa o Chrome sem janela que ele mesmo baixa. */
function navegador(env) {
  const c = (env.VIDEO_PROGRAMADO_CHROME || '').trim();
  if (!c) return null;
  if (!path.isAbsolute(c) || !fs.existsSync(c)) throw new Error('VIDEO_PROGRAMADO_CHROME aponta para um arquivo que não existe.');
  return c;
}

/** Prepara a pasta pública da tarefa: fontes, trilha e só os efeitos usados. */
export function prepararPublico(pasta, linha) {
  fs.mkdirSync(path.join(pasta, 'fontes'), {recursive: true});
  for (const f of fs.readdirSync(path.join(RAIZ, 'public/fontes'))) {
    if (f.endsWith('.woff2')) fs.copyFileSync(path.join(RAIZ, 'public/fontes', f), path.join(pasta, 'fontes', f));
  }
  if (linha.musica) gravarWav(path.join(pasta, 'trilha.wav'), trilha(linha.duracao + 1));
  const usados = new Set(linha.efeitos.map((e) => e.som));
  if (usados.size) {
    fs.mkdirSync(path.join(pasta, 'efeitos'), {recursive: true});
    const banco = bancoDeEfeitos();
    for (const nome of usados) {
      if (!banco[nome]) throw new Error(`efeito desconhecido: ${nome}`);
      gravarWav(path.join(pasta, 'efeitos', `${nome}.wav`), banco[nome]);
    }
  }
}

/**
 * Renderiza o vídeo. `pasta/publico` já contém as falas (cena-NN.mp3).
 * Um render por vez (concorrência 1), para não gerar quadros quebrados em máquinas mais simples.
 */
export async function renderizar({linha, pasta, destino, sinal, progresso = () => {}, env = process.env}) {
  // A pasta pública (falas, fontes, sons) e a pasta do pacote montado ficam separadas:
  // se o pacote ficasse dentro da pública, o empacotador copiaria uma para dentro da outra.
  const publico = path.join(pasta, 'publico');
  prepararPublico(publico, linha);
  const {cancelSignal, cancel} = makeCancelSignal();
  const aoAbortar = () => cancel();
  sinal?.addEventListener('abort', aoAbortar, {once: true});
  try {
    progresso('montando a animação', 45);
    const serveUrl = await bundle({
      entryPoint: path.join(RAIZ, 'src/video/index.ts'),
      publicDir: publico,
      outDir: path.join(pasta, 'pacote'),
      onProgress: (p) => progresso('montando a animação', 45 + p * 0.1),
    });
    if (sinal?.aborted) throw new Error('cancelado');
    const browserExecutable = navegador(env);
    const inputProps = {linha};
    const composition = await selectComposition({serveUrl, id: COMPOSICAO, inputProps, browserExecutable});
    const temporario = path.join(pasta, 'video.mp4');
    await renderMedia({
      composition, serveUrl, inputProps, browserExecutable,
      codec: 'h264', outputLocation: temporario, concurrency: 1, cancelSignal,
      onProgress: ({progress}) => progresso('renderizando', 56 + progress * 42),
    });
    progresso('ajustando o volume', 98);
    const normalizado = path.join(pasta, 'video-final.mp4');
    await normalizarVolume(temporario, normalizado, sinal);
    fs.mkdirSync(path.dirname(destino), {recursive: true});
    // Escrita exclusiva: nunca sobrescreve um arquivo existente.
    fs.copyFileSync(normalizado, destino, fs.constants.COPYFILE_EXCL);
    return destino;
  } finally {
    sinal?.removeEventListener('abort', aoAbortar);
  }
}
