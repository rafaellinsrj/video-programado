import {z} from 'zod';

// Formato do roteiro. A mesma validação vale para o MCP e para a linha de comando,
// e roda antes de qualquer chamada paga à API.

export const LIMITES = {
  cenas: 24,
  caracteresPorFala: 500,
  caracteresTotais: 4000,
  linhasPorBloco: 8,
  caracteresPorLinha: 48,
  itensPorLista: 5,
};

export const VOZES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'];

const texto = (max) => z.string().trim().min(1).max(max);
const linha = z.string().max(LIMITES.caracteresPorLinha);

export const visualSchema = z.discriminatedUnion('tipo', [
  z.strictObject({
    tipo: z.literal('titulo'),
    texto: texto(60).describe('Texto grande da cena. Palavras entre *asteriscos* ficam na cor de destaque.'),
    apoio: texto(60).optional().describe('Linha menor acima do título.'),
  }),
  z.strictObject({
    tipo: z.literal('terminal'),
    titulo: texto(30).default('terminal'),
    linhas: z.array(linha).min(1).max(LIMITES.linhasPorBloco).describe('Linhas digitadas no terminal dentro de um MacBook. Comece com "$ " para comandos.'),
    legenda: texto(60).optional(),
  }),
  z.strictObject({
    tipo: z.literal('codigo'),
    arquivo: texto(30).default('codigo.js'),
    linhas: z.array(linha).min(1).max(LIMITES.linhasPorBloco).describe('Código digitado dentro de um MacBook.'),
    legenda: texto(60).optional(),
  }),
  z.strictObject({
    tipo: z.literal('lista'),
    titulo: texto(50),
    itens: z.array(texto(50)).min(2).max(LIMITES.itensPorLista).describe('Itens que acendem um por um enquanto são falados.'),
  }),
  z.strictObject({
    tipo: z.literal('numero'),
    valor: z.number().finite().describe('Número que conta até o valor final.'),
    prefixo: z.string().max(6).default(''),
    sufixo: z.string().max(10).default(''),
    rotulo: texto(50),
  }),
  z.strictObject({
    tipo: z.literal('virada'),
    texto: texto(40).describe('Frase de impacto em tela cheia na cor de destaque. Use uma vez por vídeo.'),
  }),
  z.strictObject({
    tipo: z.literal('gancho'),
    palavra: z.string().trim().min(2).max(20).regex(/^[\p{L}\p{N}]+$/u, 'uma palavra, sem espaços').describe('Palavra que o público deve comentar.'),
    chamada: texto(50).default('e receba no seu direct'),
  }),
]);

export const cenaSchema = z.strictObject({
  fala: texto(LIMITES.caracteresPorFala).describe('O que a narração diz nesta cena.'),
  visual: visualSchema,
});

export const opcoesSchema = z.strictObject({
  voz: z.enum(VOZES).default('echo'),
  estilo: z.string().max(300).default('Locutor de vídeo de tecnologia: voz firme e confiante, energia alta, ritmo rápido, pausa curta depois de cada ponto final.'),
  velocidade: z.number().min(1).max(1.5).default(1.3).describe('Acelera a fala sem mudar o tom (1 = normal).'),
  idioma: z.enum(['pt', 'en', 'es']).default('pt'),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#e8622c'),
  marca: z.string().max(30).default(''),
  usuario: z.string().max(30).default(''),
  musica: z.boolean().default(true),
  efeitos: z.boolean().default(true),
});

export const roteiroSchema = z.strictObject({
  titulo: texto(80).describe('Nome do vídeo (usado no nome do arquivo).'),
  // prefault: no zod 4, default({}) não aplica os padrões internos; prefault passa o {} pelo schema.
  opcoes: opcoesSchema.prefault({}),
  cenas: z.array(cenaSchema).min(1).max(LIMITES.cenas),
}).superRefine((r, ctx) => {
  const total = r.cenas.reduce((s, c) => s + c.fala.length, 0);
  if (total > LIMITES.caracteresTotais) {
    ctx.addIssue({code: 'custom', message: `o roteiro tem ${total} caracteres de fala; o máximo é ${LIMITES.caracteresTotais} (cerca de 3 minutos)`});
  }
});

/** Valida e completa o roteiro. Lança um erro com todas as mensagens em português. */
export function validarRoteiro(entrada) {
  const r = roteiroSchema.safeParse(entrada);
  if (!r.success) {
    const msgs = r.error.issues.map((i) => `- ${i.path.join('.') || 'roteiro'}: ${i.message}`);
    throw new Error(`Roteiro inválido:\n${msgs.join('\n')}`);
  }
  return r.data;
}

/** Nome de arquivo seguro a partir do título (sem barras, acentos ou caracteres de controle). */
export function nomeArquivo(titulo) {
  const base = titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return base || 'video';
}
