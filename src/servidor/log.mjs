// Log em stderr (stdout é reservado ao protocolo MCP), com redação central de segredos.

const PADRAO_CHAVE = /sk-[A-Za-z0-9_-]{8,}/g;

export function redigir(texto, env = process.env) {
  let s = String(texto);
  const chave = (env.OPENAI_API_KEY || '').trim();
  if (chave.length >= 8) s = s.split(chave).join('[chave omitida]');
  return s.replace(PADRAO_CHAVE, '[chave omitida]');
}

export function log(...partes) {
  const linha = partes.map((p) => (p instanceof Error ? p.message : typeof p === 'string' ? p : JSON.stringify(p))).join(' ');
  process.stderr.write(`[video-programado] ${redigir(linha)}\n`);
}

/** Mensagem de erro segura para devolver à IA: sem stack, sem caminhos internos, sem segredos. */
export function erroSeguro(e) {
  const msg = e instanceof Error ? e.message : String(e);
  return redigir(msg).slice(0, 800);
}
