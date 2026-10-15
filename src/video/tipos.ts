// Formato da linha do tempo produzida por src/servidor/linha-do-tempo.mjs.

export type Palavra = {w: string; t: number; f: number};

export type Visual =
  | {tipo: 'titulo'; texto: string; apoio?: string}
  | {tipo: 'terminal'; titulo: string; linhas: string[]; legenda?: string}
  | {tipo: 'codigo'; arquivo: string; linhas: string[]; legenda?: string}
  | {tipo: 'lista'; titulo: string; itens: string[]}
  | {tipo: 'numero'; valor: number; prefixo: string; sufixo: string; rotulo: string}
  | {tipo: 'virada'; texto: string}
  | {tipo: 'gancho'; palavra: string; chamada: string};

export type Marcos = {
  palavras?: {texto: string; destaque: boolean; t: number}[];
  linhas?: {texto: string; t: number}[];
  itens?: {texto: string; t: number}[];
  fimContagem?: number;
  entrada?: number;
  palavraT?: number;
  chamadaT?: number;
};

export type Cena = {
  indice: number;
  audio: string | null;
  visual: Visual;
  inicio: number;
  fim: number;
  falaInicio: number;
  falaFim: number;
  palavras: Palavra[];
  marcos: Marcos;
};

export type Linha = {
  fps: number;
  largura: number;
  altura: number;
  duracao: number;
  velocidade: number;
  idioma: string;
  cor: string;
  marca: string;
  usuario: string;
  musica: boolean;
  efeitosLigados: boolean;
  cenas: Cena[];
  efeitos: {t: number; som: string; volume: number}[];
};
