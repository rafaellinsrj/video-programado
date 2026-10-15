# Política de segurança

## Como reportar

Encontrou uma vulnerabilidade? Não abra uma issue pública. Use o recurso "Report a vulnerability" (aba Security) deste repositório no GitHub. Resposta inicial em até 7 dias.

Não inclua chaves reais, dados pessoais ou vídeos de terceiros no relato.

## Escopo

- Código deste repositório (servidor MCP, linha de comando e cenas).
- Configuração de dependências e do CI.

Fora do escopo: a API da OpenAI, o Remotion e os assistentes de IA que usam o MCP. Problemas neles devem ser reportados aos respectivos fornecedores.

## Controles adotados

- Chave da OpenAI só por variável de ambiente; redação central em logs e mensagens de erro, com teste automatizado.
- Validação estrita do roteiro (campos desconhecidos rejeitados, limites de tamanho) antes de qualquer chamada paga.
- Teto de custo por vídeo, confirmação explícita e uma geração por vez.
- Escrita só na pasta de vídeos e em pasta temporária própria; nomes de arquivo saneados; escrita exclusiva (nunca sobrescreve).
- Nenhum comando de shell, nenhum `eval`, nenhum HTML bruto nas cenas.
- Dependências fixadas com lockfile, auditoria (`npm audit`) e varredura de segredos no CI, ações do GitHub fixadas por SHA.

O modelo de ameaças completo e os riscos aceitos estão em [`docs/MODELO-DE-AMEACAS.md`](docs/MODELO-DE-AMEACAS.md).

## Se a sua chave vazar

1. Revogue a chave em platform.openai.com (API keys) e crie outra.
2. Confira o uso em platform.openai.com/usage no período em que ela ficou exposta.
3. Atualize a configuração do assistente com a chave nova.
