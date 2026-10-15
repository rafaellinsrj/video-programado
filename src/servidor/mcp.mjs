import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import {pastaSaida} from './caminhos.mjs';
import {PRECO} from './custo.mjs';
import {conferirAntesDeGastar, gerarVideo} from './gerar.mjs';
import {erroSeguro, log} from './log.mjs';
import {chaveOpenAI} from './openai.mjs';
import {LIMITES, VOZES} from './roteiro.mjs';
import {Fila} from './tarefas.mjs';

const VERSAO = '1.0.0';

const GUIA = `# Como criar um roteiro para o video-programado

Fluxo obrigatório:
1. Escreva o roteiro no formato abaixo.
2. Chame estimar_custo e mostre à pessoa as cenas, a duração e o custo.
3. Só chame criar_video com "confirmado": true depois que a pessoa aprovar.
4. Acompanhe com status_video a cada 20 a 30 segundos até ficar "concluída".

Formato:
{
  "titulo": "Nome do vídeo",
  "opcoes": {"voz": "echo", "velocidade": 1.3, "idioma": "pt", "cor": "#e8622c", "marca": "Nome da marca", "usuario": "@perfil"},
  "cenas": [{"fala": "o que a narração diz", "visual": {"tipo": "...", ...}}]
}

Tipos de visual:
- titulo: {"texto": "até 60 caracteres, *palavra* em destaque", "apoio": "linha menor opcional"}
- terminal: {"titulo": "zsh", "linhas": ["$ comando", "> resposta"], "legenda": "frase acima do Mac"} (até ${LIMITES.linhasPorBloco} linhas de ${LIMITES.caracteresPorLinha} caracteres)
- codigo: {"arquivo": "app.js", "linhas": ["const x = 1"], "legenda": "frase acima do Mac"}
- lista: {"titulo": "...", "itens": ["2 a ${LIMITES.itensPorLista} itens curtos"]} (cada item acende quando a fala cita a primeira palavra dele)
- numero: {"valor": 300, "prefixo": "", "sufixo": " s", "rotulo": "o que o número significa"}
- virada: {"texto": "frase de impacto em tela cheia"} (use no máximo uma vez)
- gancho: {"palavra": "DNS", "chamada": "e receba o guia no direct"} (normalmente a última cena)

Boas práticas: uma ideia por cena; frases curtas; comece com uma pergunta que prenda nos 3 primeiros segundos; termine retomando a abertura ou com o gancho; use só fatos que você consegue confirmar; não coloque dados pessoais no roteiro.

Opções: voz em ${VOZES.join(', ')}; velocidade de 1 a 1.5; idioma pt, en ou es; cor em hexadecimal.
Limites: até ${LIMITES.cenas} cenas, ${LIMITES.caracteresPorFala} caracteres por fala e ${LIMITES.caracteresTotais} no total (cerca de 3 minutos).
Custo: cerca de US$ ${PRECO.vozPorMinuto} por minuto de voz mais US$ ${PRECO.transcricaoPorMinuto} por minuto de transcrição; um vídeo de 45 s custa cerca de US$ 0,02.`;

const texto = (t) => ({content: [{type: 'text', text: t}]});
const falha = (e) => ({isError: true, content: [{type: 'text', text: erroSeguro(e)}]});

/** Cria o servidor MCP. `executar` pode ser trocado nos testes para não chamar a API. */
export function criarServidor({executar = gerarVideo, env = process.env} = {}) {
  const fila = new Fila((roteiro, ctx) => executar(roteiro, {...ctx, env}));
  const servidor = new McpServer({name: 'video-programado', version: VERSAO});

  servidor.registerTool('como_criar', {
    title: 'Como criar um vídeo',
    description: 'Explica o formato do roteiro, os tipos de cena, os limites e o custo. Leia antes de escrever o primeiro roteiro.',
    annotations: {readOnlyHint: true, openWorldHint: false},
  }, async () => texto(GUIA));

  servidor.registerTool('estimar_custo', {
    title: 'Estimar custo',
    description: 'Valida o roteiro e devolve a duração e o custo estimados. Não gasta crédito.',
    inputSchema: {roteiro: z.record(z.string(), z.unknown()).describe('Roteiro no formato explicado em como_criar.')},
    annotations: {readOnlyHint: true, openWorldHint: false},
  }, async ({roteiro}) => {
    try {
      const {roteiro: r, custo, teto} = conferirAntesDeGastar(roteiro, env);
      return texto([
        `Roteiro válido: ${r.cenas.length} cenas, cerca de ${custo.segundosVideo} s de vídeo.`,
        `Custo estimado: US$ ${custo.usd.total.toFixed(4)} (voz US$ ${custo.usd.voz.toFixed(4)} + transcrição US$ ${custo.usd.transcricao.toFixed(4)}). Teto por vídeo: US$ ${teto.toFixed(2)}.`,
        'Mostre as cenas e o custo à pessoa e peça a confirmação antes de chamar criar_video.',
      ].join('\n'));
    } catch (e) { return falha(e); }
  });

  servidor.registerTool('criar_video', {
    title: 'Criar vídeo',
    description: 'Gera o vídeo em segundo plano (voz, animação, trilha e efeitos) e devolve o número da tarefa. Gasta crédito da OpenAI da pessoa. Só chame depois que a pessoa aprovar as cenas e o custo mostrados por estimar_custo.',
    inputSchema: {
      roteiro: z.record(z.string(), z.unknown()).describe('Roteiro aprovado pela pessoa.'),
      confirmado: z.literal(true).describe('true somente depois que a pessoa aprovou as cenas e o custo.'),
    },
    annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true},
  }, async ({roteiro}) => {
    try {
      const {roteiro: r, custo} = conferirAntesDeGastar(roteiro, env);
      chaveOpenAI(env); // falha cedo, sem gastar, se a chave não estiver configurada
      const tarefa = fila.criar(r);
      log('nova tarefa', tarefa.id, `${r.cenas.length} cenas`);
      return texto([
        `Geração iniciada. Tarefa: ${tarefa.id}`,
        `Custo estimado: US$ ${custo.usd.total.toFixed(4)}. Duração aproximada: ${custo.segundosVideo} s.`,
        `O vídeo será salvo em ${pastaSaida(env)}.`,
        'Consulte status_video com este número a cada 20 a 30 segundos. Leva alguns minutos.',
      ].join('\n'));
    } catch (e) { return falha(e); }
  });

  servidor.registerTool('status_video', {
    title: 'Status do vídeo',
    description: 'Mostra a etapa, o percentual e, no fim, o caminho do MP4.',
    inputSchema: {id: z.uuid().describe('Número da tarefa devolvido por criar_video.')},
    annotations: {readOnlyHint: true, openWorldHint: false},
  }, async ({id}) => {
    try {
      const s = fila.status(id);
      if (s.estado === 'concluída') return texto(`Pronto! Arquivo: ${s.resultado.arquivo}\nDuração: ${s.resultado.duracaoSegundos} s. Custo estimado: US$ ${s.resultado.custoEstimadoUsd.toFixed(4)}.`);
      if (s.estado === 'erro') return {isError: true, content: [{type: 'text', text: `A geração falhou: ${erroSeguro(s.erro)}`}]};
      return texto(`Estado: ${s.estado}. Etapa: ${s.etapa} (${s.progresso}%).`);
    } catch (e) { return falha(e); }
  });

  servidor.registerTool('cancelar_video', {
    title: 'Cancelar vídeo',
    description: 'Interrompe uma geração em andamento ou na fila.',
    inputSchema: {id: z.uuid()},
    annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false},
  }, async ({id}) => {
    try {
      const s = fila.cancelar(id);
      return texto(`Estado: ${s.estado}.`);
    } catch (e) { return falha(e); }
  });

  return {servidor, fila};
}
