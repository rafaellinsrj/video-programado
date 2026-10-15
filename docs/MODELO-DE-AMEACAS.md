# Modelo de ameaças

Escrito em 15/10/2026, antes da implementação do servidor MCP. Revisar a cada nova ferramenta, dependência ou forma de distribuição.

## Escopo e suposições

- O Video Programado é um servidor MCP local, executado pelo assistente de IA da própria pessoa (Claude Code, Claude Desktop, Cursor) via stdio, na máquina dela, com os privilégios do usuário do sistema operacional.
- Não existe servidor remoto do projeto, banco de dados, contas, login, multi-tenant, navegador público ou upload de terceiros. As seções do documento de segurança sobre isso estão marcadas como não aplicáveis no fim deste arquivo.
- A única rede de saída é `api.openai.com`, em endereços fixos no código.
- O roteiro é escrito por um modelo de linguagem a partir do pedido da pessoa, e pode ter sido influenciado por conteúdo de terceiros que o modelo leu (prompt injection indireta).

## Ativos

| Ativo | Classe | Por que importa |
|---|---|---|
| Chave da OpenAI da pessoa | P0 (secreto) | Quem tem a chave gasta o crédito dela. |
| Crédito da OpenAI | dinheiro | Abuso gera cobrança (denial of wallet). |
| Arquivos da pessoa | P2/P3 | Escrita fora da pasta prevista pode sobrescrever ou poluir arquivos. |
| Texto do roteiro | P3 | Enviado à OpenAI para gerar a voz; não deve conter dados pessoais sensíveis. |
| Integridade do pacote | cadeia de suprimentos | Quem instala executa nosso código com os privilégios do usuário. |
| Reputação do autor | reputação | Repositório público assinado pelo Rafael. |

## Atores

- Pessoa usuária legítima.
- Modelo de linguagem do assistente (não confiável: pode ser induzido por prompt injection a chamar ferramentas com parâmetros maliciosos).
- Conteúdo de terceiros lido pelo modelo (páginas, documentos) tentando induzir ações.
- Atacante na cadeia de suprimentos (dependência comprometida ou nome parecido).
- Quem tiver acesso aos logs do assistente ou a prints compartilhados.

## Fronteiras de confiança

```
[Pessoa] -> [Assistente de IA / modelo]  --(MCP stdio: JSON não confiável)-->  [Servidor video-programado]
                                                                                   |-- valida roteiro (zod, limites)
                                                                                   |-- api.openai.com (HTTPS, chave da pessoa)
                                                                                   |-- disco: pasta temporária própria + pasta de vídeos
                                                                                   |-- Remotion + Chrome sem janela (conteúdo gerado por nós)
```

Travessias e controles:
1. Assistente para servidor: todo argumento de ferramenta é validado por schema estrito com limites antes de qualquer efeito.
2. Servidor para OpenAI: corpo montado por nós, chave só no cabeçalho, tempo limite, tentativas limitadas, sem seguir URLs vindas de entrada.
3. Servidor para disco: caminhos construídos só por nós; nome de arquivo derivado do título passa por normalização e verificação de que fica dentro da pasta base.
4. Respostas da OpenAI para servidor: tratadas como entrada externa (tipos convertidos, campos restritos).
5. Roteiro para cenas renderizadas: o texto vira texto de React (auto-escape), nunca HTML ou código executável.

## Ameaças (STRIDE) e mitigação

| Fronteira | Ameaça | Mitigação |
|---|---|---|
| Assistente para servidor | Tampering: roteiro com campos inesperados, enormes ou maliciosos | Schema estrito (campos desconhecidos rejeitados), limites de tamanho, número de cenas e de caracteres. |
| Assistente para servidor | Elevation: prompt injection fazendo o modelo gerar vídeos em massa ou caros | Teto de custo por vídeo, uma geração por vez, fila curta, confirmação explícita no parâmetro, custo mostrado antes. |
| Assistente para servidor | Elevation: escrever arquivos em outro lugar (path traversal) | O cliente não escolhe caminho. Pasta de saída só por variável de ambiente da pessoa; nome do arquivo saneado e verificado contra a base. |
| Assistente para servidor | Information disclosure: ferramenta revelar a chave ou o ambiente | Nenhuma ferramenta devolve variáveis de ambiente; erros com mensagem segura; log com redação da chave. |
| Servidor para OpenAI | Spoofing/SSRF | Host fixo `api.openai.com` em HTTPS; nenhuma URL vem do roteiro. |
| Servidor para OpenAI | DoS / denial of wallet por repetição | Até 3 tentativas com espera exponencial, apenas para 429 e 5xx; erros de chave e saldo param na hora. |
| Servidor para disco | Tampering: sobrescrever arquivo existente | Nome com data e hora; escrita exclusiva (falha se já existir). |
| Servidor para disco | DoS: encher o disco | Pasta temporária por tarefa apagada ao final, inclusive em erro e cancelamento; duração máxima de cerca de 3 minutos. |
| Render | Execução de conteúdo não confiável | Texto do roteiro só como texto React; nenhum HTML bruto, nenhum `eval`; nenhuma URL externa carregada pelas cenas. |
| Processo | Repudiation | Fora de escopo: uso pessoal local, sem trilha de auditoria; o histórico do assistente registra as chamadas. |
| Cadeia de suprimentos | Dependência comprometida | Versões fixas e lockfile versionado, `npm audit` e varredura de segredos no CI, ações do GitHub fixadas por SHA, poucas dependências diretas. |
| Logs | Vazamento da chave em log | stdout reservado ao protocolo MCP; logs só em stderr, com redação central de `sk-...` e do valor exato da chave; teste automatizado procura a chave nos logs. |

## Decisões de risco aceitas

| Decisão | Justificativa | Revisão |
|---|---|---|
| A confirmação de custo é um parâmetro que o modelo envia | O MCP não fala direto com a pessoa; os clientes MCP pedem aprovação da chamada de ferramenta. O teto por vídeo limita o dano mesmo sem confirmação humana. | Quando o protocolo tiver confirmação nativa (elicitation) suportada pelos clientes principais. |
| Texto do roteiro vai para a OpenAI | É necessário para gerar a voz. O README avisa para não colocar dados pessoais sensíveis no roteiro. | A cada novo provedor. |
| Chave via variável de ambiente na configuração do assistente | É o padrão dos clientes MCP. O arquivo de configuração fica na máquina da pessoa. | Se os clientes adotarem cofre de segredos nativo. |
| Remotion 4.0.528 (exige macOS 15 no Mac) | As versões até 4.0.463 têm vulnerabilidades críticas conhecidas (execução remota de código e escrita arbitrária de arquivo, corrigidas a partir da 4.0.410 e 4.0.464). Preferimos exigir macOS 15 a distribuir versão vulnerável. `npm audit` sem achados em 15/10/2026. | A cada versão nova do Remotion. |
| Remotion baixa o Chrome sem janela na primeira execução | Necessário para renderizar; vem do canal oficial do Remotion. | A cada atualização do Remotion. |

## Seções do documento de segurança não aplicáveis

- §2 multi-tenant, §3 BaaS, §4 autenticação e sessão, §16 rotas administrativas, §17 recuperação de conta, §18 APIs públicas e WebSocket, §20 proxy e cache, §21 pagamentos: não existe servidor público, conta, sessão, banco nem tenant. O processo atende um único usuário local.
- §8.4 upload, §8.5 cabeçalhos HTTP e §8.6 navegador: não há upload nem página servida ao público. O render usa um servidor local efêmero do próprio Remotion, acessível só na máquina.
- §11 LGPD: o projeto não coleta nem armazena dados pessoais; o tratamento é da pessoa usuária com a OpenAI. O README orienta a não incluir dados pessoais no roteiro.
