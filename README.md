# Video Programado

Um servidor MCP de código aberto que transforma um pedido em linguagem natural num vídeo vertical de motion graphics narrado: voz natural, animação sincronizada palavra por palavra, trilha eletrônica e efeitos sonoros, entregue em MP4 pronto para Reels, TikTok e Shorts.

Você pede para a sua IA ("faça um vídeo de 40 segundos explicando DNS"), ela escreve o roteiro, mostra as cenas e o custo, e o MCP gera o vídeo no seu computador.

[English summary below.](#english)

## Como funciona

1. A IA escreve um roteiro em cenas (fala + tipo de visual).
2. O MCP valida o roteiro e calcula o custo antes de gastar qualquer crédito.
3. A voz é gerada pela API da OpenAI (`gpt-4o-mini-tts`), e cada palavra recebe o instante exato em que é falada (`whisper-1`).
4. A animação é montada em código com [Remotion](https://www.remotion.dev): cada palavra entra na tela junto com a voz.
5. Trilha e efeitos são gerados por código, sem direito autoral de terceiros.
6. O MP4 é salvo na sua pasta de vídeos, em `video-programado`.

Tipos de cena: título com palavras em destaque, terminal e código dentro de um MacBook, lista que acende item a item, número contando, tela de virada na cor de destaque e chamada final "Comente PALAVRA".

## Requisitos

- macOS 15 ou mais novo, Windows 10/11 (64 bits) ou Linux. No Mac, o Remotion atual exige macOS 15 (versões anteriores dele têm falhas de segurança conhecidas e não são usadas aqui).
- Node.js 18.18 ou mais novo.
- Um assistente com suporte a MCP: Claude Code, Claude Desktop ou Cursor.
- Uma chave da API da OpenAI com crédito ([platform.openai.com](https://platform.openai.com)). Defina um limite mensal de gasto na conta.
- Cerca de 1 GB livre. Na primeira execução, o Remotion baixa o navegador sem janela que usa para renderizar.

## Instalação

Claude Code:

```bash
claude mcp add video-programado --env OPENAI_API_KEY=sk-sua-chave -- npx -y github:rafaellinsrj/video-programado
```

Claude Desktop ou Cursor (arquivo de configuração de MCP):

```json
{
  "mcpServers": {
    "video-programado": {
      "command": "npx",
      "args": ["-y", "github:rafaellinsrj/video-programado"],
      "env": {"OPENAI_API_KEY": "sk-sua-chave"}
    }
  }
}
```

Reinicie o assistente e peça um vídeo.

## Ferramentas do MCP

| Ferramenta | O que faz | Gasta crédito |
|---|---|---|
| `como_criar` | Explica o formato do roteiro, os tipos de cena e os limites | não |
| `estimar_custo` | Valida o roteiro e mostra duração e custo | não |
| `criar_video` | Inicia a geração em segundo plano (exige `confirmado: true`) | sim |
| `status_video` | Mostra a etapa e, no fim, o caminho do MP4 | não |
| `cancelar_video` | Interrompe uma geração | não |

## Linha de comando (sem assistente)

```bash
export OPENAI_API_KEY=sk-sua-chave
npx github:rafaellinsrj/video-programado custo roteiro.json
npx github:rafaellinsrj/video-programado criar roteiro.json
```

Veja o formato em [`exemplos/exemplo.json`](exemplos/exemplo.json).

## Configuração opcional

| Variável | Padrão | Para quê |
|---|---|---|
| `VIDEO_PROGRAMADO_SAIDA` | `~/Movies/video-programado` (macOS) ou `~/Videos/video-programado` | Pasta dos vídeos (caminho absoluto) |
| `VIDEO_PROGRAMADO_MAX_USD` | `0.50` | Teto de custo por vídeo, em dólares |
| `VIDEO_PROGRAMADO_CHROME` | navegador baixado pelo Remotion | Caminho de um Chrome instalado, se preferir usá-lo |

## Custo

O projeto é gratuito. O único custo é a API da OpenAI, cobrada por minuto de áudio (preços oficiais conferidos em outubro de 2026): cerca de US$ 0,015 por minuto de voz e US$ 0,006 por minuto de transcrição. Um vídeo de 45 segundos custa cerca de US$ 0,02. O MCP mostra a estimativa antes e recusa vídeos acima do teto.

## Segurança

- A chave da OpenAI é lida só da variável de ambiente, nunca é gravada em arquivo e é removida de qualquer log ou mensagem de erro.
- O roteiro é validado com schema estrito e limites antes de qualquer chamada paga.
- O MCP só escreve na pasta de vídeos e numa pasta temporária própria, apagada ao final.
- A única conexão de rede do servidor é com `api.openai.com`.
- Não coloque dados pessoais sensíveis no roteiro: o texto é enviado à OpenAI para gerar a voz.

Detalhes em [`docs/MODELO-DE-AMEACAS.md`](docs/MODELO-DE-AMEACAS.md) e [`SECURITY.md`](SECURITY.md).

## Desenvolvimento

```bash
npm ci
npm test            # testes automáticos (não chamam a API)
npm run check       # tipos das cenas
npm run studio      # prévia das cenas no navegador
```

## Licenças

Código sob licença MIT. Fontes Inter e JetBrains Mono sob SIL Open Font License. O Remotion tem licença própria: gratuito para pessoas e empresas pequenas; empresas maiores precisam de licença da Remotion ([remotion.dev/license](https://www.remotion.dev/license)).

---

## English

Video Programado is an open source MCP server that turns a plain-language request into a narrated vertical motion graphics video (voice, word-synced animation, music and sound effects) rendered locally with Remotion. Voice and word timing use your own OpenAI API key (about US$ 0.02 per 45-second video). Install with:

```bash
claude mcp add video-programado --env OPENAI_API_KEY=sk-your-key -- npx -y github:rafaellinsrj/video-programado
```

Narration languages: Portuguese, English and Spanish. MIT licensed.
