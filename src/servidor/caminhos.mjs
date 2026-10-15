import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {nomeArquivo} from './roteiro.mjs';

// Pastas que o servidor pode tocar: a pasta de vídeos e uma pasta temporária por tarefa.
// O cliente MCP nunca informa caminhos.

export function pastaSaida(env = process.env) {
  const escolhida = (env.VIDEO_PROGRAMADO_SAIDA || '').trim();
  if (escolhida) {
    if (!path.isAbsolute(escolhida)) throw new Error('VIDEO_PROGRAMADO_SAIDA precisa ser um caminho absoluto.');
    return path.normalize(escolhida);
  }
  const base = process.platform === 'darwin' ? 'Movies' : 'Videos';
  return path.join(os.homedir(), base, 'video-programado');
}

/** Caminho final do MP4, garantidamente dentro da pasta de saída. */
export function caminhoVideo(titulo, agora = new Date(), env = process.env) {
  const base = pastaSaida(env);
  const carimbo = agora.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const arquivo = path.resolve(base, `${nomeArquivo(titulo)}-${carimbo}.mp4`);
  dentroDe(base, arquivo);
  return arquivo;
}

/** Lança erro se `alvo` não estiver dentro de `base` depois de normalizar. */
export function dentroDe(base, alvo) {
  const b = path.resolve(base) + path.sep;
  const a = path.resolve(alvo);
  if (!a.startsWith(b)) throw new Error('caminho fora da pasta permitida');
  return a;
}

export function criarPastaTemporaria() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'video-programado-'));
}

export function apagarPasta(p) {
  // Só apaga pastas temporárias criadas por nós.
  const tmp = path.resolve(os.tmpdir()) + path.sep;
  const alvo = path.resolve(p);
  if (!alvo.startsWith(tmp) || !path.basename(alvo).startsWith('video-programado-')) {
    throw new Error('recusado: tentativa de apagar pasta que não é temporária do video-programado');
  }
  fs.rmSync(alvo, {recursive: true, force: true});
}
