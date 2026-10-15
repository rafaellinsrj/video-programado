// Estimativa de custo antes de gastar. Preços oficiais da OpenAI conferidos em 15/10/2026
// (developers.openai.com/api/docs/pricing):
// - gpt-4o-mini-tts: cerca de US$ 0,015 por minuto de áudio gerado;
// - whisper-1 (transcrição com tempo por palavra): US$ 0,006 por minuto.
// A aceleração da fala é feita depois, no render, e não muda o preço.

export const PRECO = {vozPorMinuto: 0.015, transcricaoPorMinuto: 0.006};

// Ritmo médio de fala gerada: cerca de 14 caracteres por segundo em português.
const CARACTERES_POR_SEGUNDO = 14;

export function estimarCusto(roteiro) {
  const caracteres = roteiro.cenas.reduce((s, c) => s + c.fala.length, 0);
  const segundosAudio = caracteres / CARACTERES_POR_SEGUNDO;
  const minutos = segundosAudio / 60;
  const voz = minutos * PRECO.vozPorMinuto;
  const transcricao = minutos * PRECO.transcricaoPorMinuto;
  const velocidade = roteiro.opcoes?.velocidade ?? 1;
  return {
    caracteres,
    segundosVideo: Math.round(segundosAudio / velocidade + roteiro.cenas.length * 0.2),
    usd: {voz: arred(voz), transcricao: arred(transcricao), total: arred(voz + transcricao)},
  };
}

/** Teto de gasto por vídeo (variável VIDEO_PROGRAMADO_MAX_USD, padrão US$ 0,50). */
export function tetoUsd(env = process.env) {
  const v = Number(env.VIDEO_PROGRAMADO_MAX_USD);
  return Number.isFinite(v) && v > 0 ? v : 0.5;
}

const arred = (v) => Math.round(v * 10000) / 10000;
