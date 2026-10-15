// Monta a linha do tempo do vídeo a partir das falas geradas: início e fim de cada cena,
// instante de cada palavra (já com a aceleração da fala), marcos visuais e efeitos sonoros.
// É função pura: mesma entrada, mesma saída, testável sem API.

export const FPS = 30;
const INICIO = 0.25;     // respiro antes da primeira fala
const PAUSA = 0.3;       // entre cenas
const CAUDA = 0.9;       // depois da última fala
const CAUDA_GANCHO = 1.6;
const ANTECIPA = 0.15;   // a cena aparece um pouco antes da fala

export const normalizar = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Instante (s) em que a palavra-alvo é falada na cena, ou um ponto proporcional da fala. */
export function tempoDaPalavra(cena, alvo, fracao) {
  const a = normalizar(String(alvo).split(/\s+/)[0] || '');
  if (a.length >= 2) {
    const p = cena.palavras.find((w) => normalizar(w.w).startsWith(a) || (normalizar(w.w).length >= 3 && a.startsWith(normalizar(w.w))));
    if (p) return p.t;
  }
  return cena.falaInicio + (cena.falaFim - cena.falaInicio) * fracao;
}

const WHOOSH = ['whoosh_grave', 'swipe_sobe', 'whoosh_agudo', 'swipe_desce'];
const TECLAS = ['tecla1', 'tecla2', 'tecla3'];

function marcosEEfeitos(cena, i, efeitos) {
  const v = cena.visual;
  const dur = cena.falaFim - cena.falaInicio;
  const ef = (t, som, volume = 0.8) => efeitos.push({t: arred(t), som, volume});
  ef(cena.inicio, WHOOSH[i % WHOOSH.length], 0.7);
  const m = {};
  if (v.tipo === 'titulo') {
    const palavras = v.texto.split(/\s+/).filter(Boolean);
    const janela = Math.max(0.6, Math.min(dur * 0.6, palavras.length * 0.28));
    m.palavras = palavras.map((p, k) => {
      const destaque = /^\*.*\*[.,!?:;]*$/.test(p);
      const limpo = p.replace(/\*/g, '');
      const t = destaque ? tempoDaPalavra(cena, limpo, Math.min(0.9, (k + 1) / palavras.length)) : cena.falaInicio + janela * (k / palavras.length);
      if (destaque) ef(t, 'blip_medio', 0.7);
      return {texto: limpo, destaque, t: arred(t)};
    });
  } else if (v.tipo === 'terminal' || v.tipo === 'codigo') {
    let t = cena.falaInicio + 0.1;
    m.linhas = v.linhas.map((l) => { const ini = t; t += Math.max(0.35, l.length / 45) + 0.12; return {texto: l, t: arred(ini)}; });
    const fimDigitacao = Math.min(t, cena.fim - 0.2);
    let n = 0;
    for (let x = cena.falaInicio + 0.12; x < fimDigitacao && n < 24; x += 0.1, n++) ef(x, TECLAS[n % 3], 0.45);
  } else if (v.tipo === 'lista') {
    m.itens = v.itens.map((item, k) => {
      const t = tempoDaPalavra(cena, item, (k + 0.5) / v.itens.length);
      ef(t, k % 2 ? 'blip_agudo' : 'blip_medio', 0.7);
      return {texto: item, t: arred(t)};
    });
  } else if (v.tipo === 'numero') {
    m.fimContagem = arred(cena.falaInicio + Math.max(0.6, dur * 0.6));
    ef(cena.falaInicio, 'riser', 0.5);
    ef(m.fimContagem, 'impacto', 0.8);
  } else if (v.tipo === 'virada') {
    m.entrada = arred(cena.inicio + 0.05);
    ef(m.entrada, 'impacto', 1.0);
  } else if (v.tipo === 'gancho') {
    m.palavraT = arred(tempoDaPalavra(cena, v.palavra, 0.3));
    m.chamadaT = arred(Math.max(m.palavraT + 0.5, cena.falaInicio + dur * 0.7));
    ef(m.palavraT, 'impacto', 0.9);
    ef(m.chamadaT, 'sininho', 0.8);
  }
  return m;
}

/**
 * @param roteiro roteiro validado
 * @param falas [{duracao, palavras:[{w,t,f}]}] na velocidade original, uma por cena
 */
export function montarLinhaDoTempo(roteiro, falas) {
  if (falas.length !== roteiro.cenas.length) throw new Error('número de falas diferente do número de cenas');
  const v = roteiro.opcoes.velocidade;
  const efeitos = [];
  const cenas = [];
  let t = INICIO;
  roteiro.cenas.forEach((c, i) => {
    const f = falas[i];
    if (!(f.duracao > 0)) throw new Error(`a fala da cena ${i + 1} veio vazia`);
    const falaInicio = t;
    const falaFim = t + f.duracao / v;
    const palavras = f.palavras
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.f))
      .map((p) => ({w: p.w, t: arred(falaInicio + p.t / v), f: arred(falaInicio + p.f / v)}));
    cenas.push({indice: i, audio: `cena-${String(i + 1).padStart(2, '0')}.mp3`, visual: c.visual,
      inicio: arred(Math.max(0, falaInicio - ANTECIPA)), falaInicio: arred(falaInicio), falaFim: arred(falaFim), palavras});
    t = falaFim + PAUSA;
  });
  const ultima = cenas.at(-1);
  const duracao = arred(ultima.falaFim + (ultima.visual.tipo === 'gancho' ? CAUDA_GANCHO : CAUDA));
  cenas.forEach((c, i) => { c.fim = i + 1 < cenas.length ? cenas[i + 1].inicio : duracao; });
  cenas.forEach((c, i) => { c.marcos = marcosEEfeitos(c, i, efeitos); });
  // Sem dois efeitos colados (menos de 0,08 s), para não embolar o som.
  efeitos.sort((a, b) => a.t - b.t);
  const limpos = efeitos.filter((e, k) => k === 0 || e.t - efeitos[k - 1].t >= 0.08 || e.som !== efeitos[k - 1].som);
  return {
    fps: FPS, largura: 1080, altura: 1920, duracao, velocidade: v, idioma: roteiro.opcoes.idioma,
    cor: roteiro.opcoes.cor, marca: roteiro.opcoes.marca, usuario: roteiro.opcoes.usuario,
    musica: roteiro.opcoes.musica, efeitosLigados: roteiro.opcoes.efeitos,
    cenas, efeitos: roteiro.opcoes.efeitos ? limpos : [],
  };
}

const arred = (x) => Math.round(x * 1000) / 1000;
