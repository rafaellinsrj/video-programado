import React from 'react';

export const PRETO = '#05070b';
export const TEXTO = '#f5f5f7';
export const APAGADO = '#8e8e93';
export const CARTAO = '#0f1218';
export const BORDA = '#252a33';
export const AZUL = '#2997ff';
export const VERDE = '#30d158';

export const limitar = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const suave = (v: number) => 1 - Math.pow(1 - limitar(v), 3);
/** Progresso suave de 0 a 1 entre os instantes a e b (segundos). */
export const pr = (t: number, a: number, b: number) => suave((t - a) / (b - a));
/** Batida curta (0 → 1 → 0) logo depois do instante a. */
export const bate = (t: number, a: number, dur = 0.35) => {const x = t - a; return x < 0 || x > dur ? 0 : Math.sin((x / dur) * Math.PI);};
export const pseudo = (i: number) => {const h = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return h - Math.floor(h);};

/** Texto grande que entra com impacto no instante a. */
export function Grande({t, a, texto, y, tamanho = 140, cor = TEXTO, peso = 600, sai = 1e9}: {t: number; a: number; texto: string; y: number; tamanho?: number; cor?: string; peso?: number; sai?: number}) {
  const op = pr(t, a - 0.05, a + 0.12) * (1 - pr(t, sai - 0.2, sai));
  if (op <= 0) return null;
  const s = 1 + (1 - pr(t, a - 0.05, a + 0.22)) * 0.3;
  return <div style={{position: 'absolute', left: 60, right: 60, top: y, textAlign: 'center', opacity: op, transform: `scale(${s})`, fontFamily: 'Inter', fontWeight: peso, fontSize: tamanho, lineHeight: 1.05, letterSpacing: '-0.04em', color: cor}}>{texto}</div>;
}

/** Fundo preto com grade fina e brilhos, como nos reels da Lins Partners. */
export function Fundo({t, cor}: {t: number; cor: string}) {
  const trilhas = ['M-20 260 H180 L240 200 H420 L470 150 H700', 'M1100 420 H900 L850 470 H700 L660 510 H560', 'M-20 1560 H140 L200 1500 H360 L410 1450 H520', 'M1100 1720 H960 L900 1780 H760 L720 1820 H600'];
  return <svg viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0, width: 1080, height: 1920}}>
    <defs>
      <radialGradient id="g-azul" cx="0.1" cy="0.94" r="0.65"><stop offset="0" stopColor={AZUL} stopOpacity={0.2} /><stop offset="1" stopColor={AZUL} stopOpacity={0} /></radialGradient>
      <radialGradient id="g-cor" cx="0.92" cy="0.06" r="0.6"><stop offset="0" stopColor={cor} stopOpacity={0.16} /><stop offset="1" stopColor={cor} stopOpacity={0} /></radialGradient>
      <pattern id="g-grade" width="54" height="54" patternUnits="userSpaceOnUse"><path d="M54 0H0V54" fill="none" stroke="#ffffff" strokeOpacity={0.035} strokeWidth={1} /></pattern>
    </defs>
    <rect width={1080} height={1920} fill={PRETO} />
    <rect width={1080} height={1920} fill="url(#g-grade)" />
    <rect width={1080} height={1920} fill="url(#g-azul)" />
    <rect width={1080} height={1920} fill="url(#g-cor)" />
    {trilhas.map((d, i) => <path key={i} d={d} fill="none" stroke={i % 2 ? cor : AZUL} strokeOpacity={0.14 + 0.04 * Math.sin(t * 1.5 + i)} strokeWidth={2} />)}
  </svg>;
}

/** MacBook preto (vista frontal); o conteúdo é desenhado em coordenadas da tela. */
export function Mac({x, y, w, op = 1, children}: {x: number; y: number; w: number; op?: number; children?: React.ReactNode}) {
  if (op <= 0) return null;
  const h = w * 0.62, bz = w * 0.025, sw = w - bz * 2, sh = h - bz * 2;
  const id = `mac-${Math.round(x)}-${Math.round(y)}`;
  return <g opacity={op}>
    <rect x={x} y={y} width={w} height={h} rx={w * 0.03} fill="#0a0a0c" stroke="#2a2d33" strokeWidth={2} />
    <clipPath id={id}><rect x={x + bz} y={y + bz} width={sw} height={sh} rx={w * 0.012} /></clipPath>
    <g clipPath={`url(#${id})`}>
      <rect x={x + bz} y={y + bz} width={sw} height={sh} fill="#0d1117" />
      <g transform={`translate(${x + bz},${y + bz})`}>{children}</g>
    </g>
    <path d={`M${x - w * 0.06} ${y + h} H${x + w * 1.06} L${x + w * 1.03} ${y + h + w * 0.035} H${x - w * 0.03} Z`} fill="#1b1c20" stroke="#2a2d33" strokeWidth={2} />
  </g>;
}

/** Linhas digitadas dentro de uma tela (terminal ou editor), com cursor piscando. */
export function Digitado({t, w, linhas, titulo, cor, tamanho = 30}: {t: number; w: number; linhas: {texto: string; t: number}[]; titulo: string; cor: string; tamanho?: number}) {
  const cursorVisivel = Math.floor(t * 2.5) % 2 === 0;
  let ultima = -1;
  let colunaCursor = 0;
  const desenho = linhas.map((l, k) => {
    if (t < l.t) return null;
    const n = Math.min(l.texto.length, Math.floor((t - l.t) * 45));
    ultima = k; colunaCursor = n;
    const comando = l.texto.startsWith('$');
    const resposta = l.texto.startsWith('>');
    return <text key={k} x={tamanho * 0.7} y={tamanho * 2.9 + k * tamanho * 1.45} fontFamily="Mono" fontWeight={500} fontSize={tamanho}
      fill={resposta ? cor : comando ? TEXTO : '#c9d1d9'} style={{whiteSpace: 'pre'}}>{l.texto.slice(0, n)}</text>;
  });
  return <g>
    <rect x={0} y={0} width={w} height={tamanho * 1.6} fill="#161b22" />
    {['#ff5f57', '#febc2e', '#28c840'].map((c, k) => <circle key={c} cx={tamanho * 0.9 + k * tamanho * 0.9} cy={tamanho * 0.8} r={tamanho * 0.25} fill={c} />)}
    <text x={w / 2} y={tamanho * 1.05} textAnchor="middle" fontFamily="Mono" fontWeight={500} fontSize={tamanho * 0.7} fill={APAGADO}>{titulo}</text>
    {desenho}
    {ultima >= 0 && cursorVisivel ? <rect x={tamanho * 0.7 + colunaCursor * tamanho * 0.6} y={tamanho * 2.1 + ultima * tamanho * 1.45} width={tamanho * 0.55} height={tamanho} fill={cor} /> : null}
  </g>;
}
