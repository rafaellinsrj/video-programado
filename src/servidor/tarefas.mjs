import crypto from 'node:crypto';

// Fila de gerações em segundo plano: uma por vez (o render usa muita CPU e memória)
// e no máximo 2 esperando. Cada tarefa pode ser cancelada.

const MAX_ATIVAS = 3; // 1 gerando + 2 esperando
const GUARDAR_CONCLUIDAS = 20;

export class Fila {
  constructor(executar) {
    this.executar = executar; // async (tarefa, {sinal, progresso}) => caminhoMp4
    this.tarefas = new Map();
    this.ordem = [];
    this.rodando = null;
  }

  criar(dados) {
    const ativas = this.ordem.filter((id) => ['na fila', 'gerando'].includes(this.tarefas.get(id).estado)).length;
    if (ativas >= MAX_ATIVAS) throw new Error('Já existem vídeos esperando na fila. Aguarde terminar antes de pedir outro.');
    const id = crypto.randomUUID();
    const controle = new AbortController();
    const tarefa = {id, estado: 'na fila', etapa: 'aguardando', progresso: 0, criada: new Date().toISOString(), resultado: null, erro: null, dados, controle};
    this.tarefas.set(id, tarefa);
    this.ordem.push(id);
    this.podar();
    queueMicrotask(() => this.proxima());
    return this.publico(tarefa);
  }

  status(id) {
    const t = this.tarefas.get(id);
    if (!t) throw new Error('Tarefa não encontrada.');
    return this.publico(t);
  }

  cancelar(id) {
    const t = this.tarefas.get(id);
    if (!t) throw new Error('Tarefa não encontrada.');
    if (t.estado === 'concluída' || t.estado === 'erro' || t.estado === 'cancelada') return this.publico(t);
    t.controle.abort();
    if (t.estado === 'na fila') { t.estado = 'cancelada'; t.etapa = 'cancelada'; }
    return this.publico(t);
  }

  async proxima() {
    if (this.rodando) return;
    const id = this.ordem.find((x) => this.tarefas.get(x).estado === 'na fila');
    if (!id) return;
    const t = this.tarefas.get(id);
    this.rodando = t;
    t.estado = 'gerando';
    try {
      t.resultado = await this.executar(t.dados, {
        sinal: t.controle.signal,
        progresso: (etapa, p) => { t.etapa = etapa; t.progresso = Math.max(0, Math.min(100, Math.round(p))); },
      });
      t.estado = 'concluída'; t.etapa = 'pronto'; t.progresso = 100;
    } catch (e) {
      if (t.controle.signal.aborted) { t.estado = 'cancelada'; t.etapa = 'cancelada'; }
      else { t.estado = 'erro'; t.erro = e instanceof Error ? e.message : String(e); }
    } finally {
      t.dados = null; // libera o roteiro da memória
      this.rodando = null;
      queueMicrotask(() => this.proxima());
    }
  }

  podar() {
    const finais = this.ordem.filter((id) => ['concluída', 'erro', 'cancelada'].includes(this.tarefas.get(id).estado));
    while (finais.length > GUARDAR_CONCLUIDAS) {
      const id = finais.shift();
      this.tarefas.delete(id);
      this.ordem = this.ordem.filter((x) => x !== id);
    }
  }

  // Só campos seguros vão para fora (allowlist).
  publico(t) {
    return {id: t.id, estado: t.estado, etapa: t.etapa, progresso: t.progresso, criada: t.criada, resultado: t.resultado, erro: t.erro};
  }
}
