// Chamadas à API da OpenAI: voz (gpt-4o-mini-tts) e transcrição com tempo por palavra (whisper-1).
// A chave vem só da variável de ambiente OPENAI_API_KEY e nunca é gravada nem impressa.

const BASE = 'https://api.openai.com/v1';
const TENTATIVAS = 3;
/** Espera base entre tentativas (ms). Exportado para os testes encurtarem. */
export const CONFIG = {esperaMs: 1500};

export function chaveOpenAI(env = process.env) {
  const k = (env.OPENAI_API_KEY || '').trim();
  if (!k) throw new Error('Defina a variável OPENAI_API_KEY com a sua chave da OpenAI (veja o README).');
  if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(k)) throw new Error('OPENAI_API_KEY não parece uma chave válida da OpenAI (deve começar com "sk-").');
  return k;
}

async function pedir(caminho, init, {timeoutMs = 120000} = {}) {
  let ultimoErro;
  for (let i = 0; i < TENTATIVAS; i++) {
    try {
      const r = await fetch(`${BASE}${caminho}`, {...init, signal: AbortSignal.timeout(timeoutMs)});
      if (r.ok) return r;
      const corpo = await r.text().catch(() => '');
      const msg = mensagemDeErro(r.status, corpo);
      // Erros de chave, saldo ou pedido inválido não melhoram com nova tentativa.
      if (r.status !== 429 && r.status < 500) throw Object.assign(new Error(msg), {definitivo: true});
      ultimoErro = new Error(msg);
    } catch (e) {
      if (e.definitivo) throw e;
      ultimoErro = e;
    }
    if (i + 1 < TENTATIVAS) await new Promise((res) => setTimeout(res, CONFIG.esperaMs * 2 ** i));
  }
  throw ultimoErro;
}

function mensagemDeErro(status, corpo) {
  let detalhe = '';
  try { detalhe = JSON.parse(corpo)?.error?.message || ''; } catch { /* corpo não é JSON */ }
  const dicas = {
    401: 'chave da OpenAI recusada; confira OPENAI_API_KEY',
    403: 'a chave não tem permissão para este modelo',
    429: 'limite de uso ou saldo esgotado; confira o crédito em platform.openai.com/usage',
  };
  return `OpenAI respondeu ${status}: ${dicas[status] || detalhe || 'erro sem detalhe'}`;
}

/** Gera a fala de um trecho. Devolve o áudio em MP3. */
export async function gerarVoz({texto, voz, estilo, chave}) {
  const r = await pedir('/audio/speech', {
    method: 'POST',
    headers: {Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({model: 'gpt-4o-mini-tts', voice: voz, input: texto, instructions: estilo, response_format: 'mp3'}),
  });
  return Buffer.from(await r.arrayBuffer());
}

/** Transcreve um áudio e devolve a duração e o instante de cada palavra (em segundos). */
export async function transcrever({audio, idioma, chave}) {
  const form = new FormData();
  form.append('file', new Blob([audio], {type: 'audio/mpeg'}), 'fala.mp3');
  form.append('model', 'whisper-1');
  form.append('language', idioma);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  const r = await pedir('/audio/transcriptions', {method: 'POST', headers: {Authorization: `Bearer ${chave}`}, body: form});
  const j = await r.json();
  const palavras = (j.words || []).map((w) => ({w: String(w.word).trim(), t: Number(w.start), f: Number(w.end)}));
  return {duracao: Number(j.duration) || (palavras.at(-1)?.f ?? 0), palavras};
}
