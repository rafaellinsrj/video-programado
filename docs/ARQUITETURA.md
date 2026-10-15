# Video Programado: arquitetura do MCP

Aprovada pelo Rafael em 15/10/2026.

## 1. Objetivo

Um MCP de código aberto que transforma um pedido em linguagem natural num vídeo vertical de motion graphics narrado, com o mesmo padrão do reel "Este vídeo não foi editado": voz, animação sincronizada palavra por palavra, trilha e efeitos.

A pessoa instala com um comando e depois só conversa com a IA dela.

## 2. Como a pessoa usa

1. Instala no Claude Code, Claude Desktop ou Cursor, com a chave da OpenAI dela.
2. Pede: "faça um vídeo de 40 segundos explicando DNS".
3. A IA consulta o MCP para saber quais cenas existem e escreve o roteiro.
4. O MCP mostra as cenas e o custo estimado (por exemplo, US$ 0,02). A IA pede a confirmação.
5. Com o ok, o MCP gera o vídeo em segundo plano, e a IA acompanha o progresso.
6. Em alguns minutos, a pessoa recebe o caminho do MP4 pronto.

## 3. Visão geral

```
 Pessoa
   |  conversa
   v
 Assistente de IA (Claude / Cursor)
   |  protocolo MCP (stdio, na máquina da pessoa)
   v
 Servidor video-programado (Node.js)
   |-- valida o roteiro e calcula o custo
   |-- OpenAI: voz (gpt-4o-mini-tts) e tempo por palavra (whisper-1)
   |-- gera trilha e efeitos por código
   |-- Remotion: monta as cenas e renderiza com Chrome sem janela
   v
 MP4 em ~/Movies/video-programado (Mac) ou ~/Videos/video-programado
```

Requisitos: macOS 15 ou mais novo, Windows 10/11 ou Linux, e Node.js 18.18+. No Mac, a exigência de macOS 15 vem do Remotion corrigido (versões antigas têm falhas de segurança conhecidas).

Tudo roda no computador da pessoa. Não existe servidor nosso no meio, não guardamos dados de ninguém e não pagamos a conta de ninguém.

## 4. Ferramentas que o MCP oferece à IA

| Ferramenta | O que faz | Gasta crédito? |
|---|---|---|
| `como_criar` | Explica os tipos de cena, os limites e traz um roteiro de exemplo, para a IA escrever certo. | Não |
| `estimar_custo` | Valida o roteiro e devolve duração e custo estimados. | Não |
| `criar_video` | Valida, confere o teto de gasto e inicia a geração em segundo plano. Devolve um número de tarefa na hora. | Sim |
| `status_video` | Mostra a etapa atual, o percentual e, no fim, o caminho do MP4. | Não |
| `cancelar_video` | Interrompe uma geração em andamento. | Não |

A geração roda em segundo plano porque leva minutos, e alguns assistentes cortam chamadas longas.

## 5. Formato do roteiro

A IA escreve um JSON assim:

```json
{
  "titulo": "O que é DNS",
  "opcoes": {"voz": "echo", "velocidade": 1.3, "idioma": "pt", "cor": "#e8622c", "marca": "Minha Empresa", "usuario": "@minhaempresa"},
  "cenas": [
    {"fala": "Você digita um site e ele não abre. Por quê?", "visual": {"tipo": "titulo", "texto": "Por que o site *não abre*?"}},
    {"fala": "O computador pergunta ao DNS qual é o endereço do site.", "visual": {"tipo": "terminal", "linhas": ["$ dig meusite.com", "> 104.21.3.10"]}},
    {"fala": "Se o DNS falha, não existe caminho.", "visual": {"tipo": "virada", "texto": "SEM DNS, SEM SITE."}},
    {"fala": "Comenta DNS que eu te mando o guia.", "visual": {"tipo": "gancho", "palavra": "DNS"}}
  ]
}
```

## 6. Tipos de cena (MVP)

| Tipo | O que aparece |
|---|---|
| `titulo` | Texto grande, com palavras em destaque na cor da marca, entrando no ritmo da fala. |
| `terminal` | MacBook preto com um terminal digitando as linhas. |
| `codigo` | MacBook preto com um editor digitando o código. |
| `lista` | Itens que acendem um por um enquanto são falados. |
| `numero` | Número grande contando até o valor, com rótulo. |
| `virada` | Tela cheia na cor de destaque com uma frase de impacto (uma por vídeo). |
| `gancho` | "Comente PALAVRA" com a palavra pulsando, a chamada e o @ da pessoa. |

Todas as cenas usam o fundo preto com grade e brilhos, a trilha de progresso e a marca no topo.

## 7. Etapas da geração

| Etapa | O que acontece | Tempo típico |
|---|---|---|
| 1. Validação | Confere formato, limites e teto de gasto. Nada é cobrado se falhar. | instantâneo |
| 2. Voz | Uma chamada por cena (até 3 ao mesmo tempo), com voz e estilo escolhidos. | 10 a 30 s |
| 3. Tempo por palavra | Transcrição de cada cena com o instante de cada palavra. | 10 a 30 s |
| 4. Linha do tempo | Calcula o início e o fim de cada cena e de cada palavra, já com a aceleração da fala. | instantâneo |
| 5. Som | Gera a trilha eletrônica e os efeitos, e marca um efeito diferente em cada entrada. | 2 s |
| 6. Montagem | Prepara o projeto de animação numa pasta temporária da tarefa. | 20 a 40 s |
| 7. Render | Renderiza com um processo só (sem quadros quebrados). Voz, trilha e efeitos entram direto no MP4. | 2 a 6 min |
| 8. Volume | Normaliza o áudio para -14 LUFS (padrão das redes) com o ffmpeg que vem no Remotion. | 5 a 10 s |
| 9. Entrega | Grava o MP4 na pasta de vídeos e apaga os temporários. | instantâneo |

A aceleração da fala (velocidade 1.3, por exemplo) é feita no render, sem mudar o tom da voz. Não precisa instalar ffmpeg nem Python: o Remotion já traz o que precisa.

## 8. Segurança

- **Chave da OpenAI:** lida só da variável de ambiente `OPENAI_API_KEY`, configurada pela pessoa no assistente. Nunca é gravada em arquivo, nunca aparece em mensagens, logs ou erros.
- **Dinheiro:** custo estimado antes de começar, teto por vídeo (padrão US$ 0,50, ajustável) e confirmação explícita em `criar_video`.
- **Entrada:** roteiro validado com limites (até 24 cenas, 500 caracteres por fala, 4.000 no total, cerca de 3 minutos de vídeo).
- **Arquivos:** o MCP só escreve na pasta de vídeos e numa pasta temporária própria. O nome do arquivo é limpo (sem barras, acentos ou caracteres especiais).
- **Rede:** só conversa com api.openai.com, com tempo limite e no máximo 3 tentativas.
- **Comandos:** nenhum comando de terminal montado com texto da pessoa.
- **Dependências:** versões fixas, sem atualização automática, e o código aberto para qualquer um auditar.

## 9. Custos e limites

| Item | Valor |
|---|---|
| Voz (gpt-4o-mini-tts) | cerca de US$ 0,015 por minuto gerado |
| Tempo por palavra (whisper-1) | US$ 0,006 por minuto |
| Vídeo de 45 s | cerca de US$ 0,02 |
| Teto padrão por vídeo | US$ 0,50 |
| Duração máxima | cerca de 3 minutos |

Preços oficiais conferidos em developers.openai.com/api/docs/pricing em 15/10/2026.

## 10. Estrutura do repositório

```
video-programado/
  bin/video-programado.mjs      entrada: modo MCP (padrão) e linha de comando
  src/servidor/
    mcp.mjs                     ferramentas MCP
    tarefas.mjs                 fila de gerações em segundo plano
    roteiro.mjs                 formato e validação
    custo.mjs                   estimativa e teto
    openai.mjs                  voz e transcrição
    linha-do-tempo.mjs          tempos de cena e de palavra
    audio.mjs                   trilha e efeitos gerados por código
    render.mjs                  montagem e render com Remotion
    caminhos.mjs                pastas permitidas e nomes seguros
  src/video/                    cenas da animação (React + Remotion)
  public/fontes/                Inter e JetBrains Mono (licença OFL)
  exemplos/                     roteiros de exemplo
  test/                         testes automáticos (sem chamar a API)
  docs/                         arquitetura e guia de cenas
  README.md, LICENSE (MIT), SECURITY.md, .env.example
```

## 11. Instalação

```
claude mcp add video-programado --env OPENAI_API_KEY=sk-sua-chave -- npx -y github:rafaellinsrj/video-programado
```

Também funciona por linha de comando, sem assistente: `npx github:rafaellinsrj/video-programado criar roteiro.json`.

## 12. Qualidade

- Testes automáticos de validação, custo, linha do tempo, nomes de arquivo e geração de som, rodando no GitHub a cada envio.
- Checagem de tipos das cenas.
- Teste de ponta a ponta antes de publicar: instalar no Claude, pedir um vídeo e conferir o MP4, com checagem automática de quadros quebrados.
- Commits e arquivos sem menção a ferramentas de IA, como no resto do seu GitHub.

## 13. Fora do MVP (próximas versões)

- Legenda opcional (tradicional ou a "legenda compilada").
- Formatos 16:9 e 1:1.
- Imagens e logotipo da pessoa nas cenas.
- Outras vozes e provedores de voz.
- Prévia de quadros antes do render completo.

## 14. Decisões para você aprovar

1. Nome **Video Programado** e repositório público **rafaellinsrj/video-programado**.
2. Licença **MIT** (qualquer um usa e adapta, mantendo o seu nome no aviso).
3. Voz e transcrição só pela **OpenAI** no MVP.
4. Vídeos salvos na **pasta de vídeos** do computador da pessoa.
5. Teto padrão de **US$ 0,50** por vídeo.
6. Idiomas de narração: **português, inglês e espanhol**.
7. Instalação por **npx direto do GitHub** (sem publicar no npm por enquanto).
