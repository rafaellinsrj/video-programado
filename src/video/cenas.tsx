import React from 'react';
import {AbsoluteFill} from 'remotion';
import type {Cena} from './tipos';
import {APAGADO, BORDA, CARTAO, Digitado, Grande, Mac, PRETO, TEXTO, bate, limitar, pr, pseudo} from './util';

type P = {t: number; cena: Cena; cor: string; idioma: string; usuario: string};

const tamanhoPorTexto = (n: number) => (n <= 12 ? 170 : n <= 22 ? 140 : n <= 36 ? 112 : 92);

/** Barras de onda que se mexem enquanto a narração fala (preenchem a tela sem distrair). */
function Onda({t, cena, cor, y, opacidade = 0.5}: {t: number; cena: Cena; cor: string; y: number; opacidade?: number}) {
  const falando = t >= cena.falaInicio && t <= cena.falaFim;
  const n = 28;
  return <svg viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
    {Array.from({length: n}).map((_, k) => {
      const a = falando ? 16 + Math.abs(Math.sin(t * 11 + k * 0.6)) * 70 * (0.4 + pseudo(k) * 0.6) : 10;
      return <rect key={k} x={150 + k * 28} y={y - a / 2} width={14} height={a} rx={7} fill={cor} opacity={opacidade} />;
    })}
  </svg>;
}

function Titulo({t, cena, cor}: P) {
  if (cena.visual.tipo !== 'titulo') return null;
  const palavras = cena.marcos.palavras ?? [];
  const total = palavras.reduce((s, p) => s + p.texto.length + 1, 0);
  const tamanho = tamanhoPorTexto(total);
  return <>
    {cena.visual.apoio ? <Grande t={t} a={cena.inicio + 0.05} texto={cena.visual.apoio} y={470} tamanho={68} cor={APAGADO} peso={500} /> : null}
    <div style={{position: 'absolute', left: 70, right: 70, top: 600, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: tamanho * 0.28, rowGap: 6}}>
      {palavras.map((p, k) => {
        const op = pr(t, p.t - 0.05, p.t + 0.1);
        const s = 1 + (1 - pr(t, p.t - 0.05, p.t + 0.25)) * 0.35 + (p.destaque ? bate(t, p.t, 0.4) * 0.08 : 0);
        return <span key={k} style={{opacity: op, transform: `scale(${s})`, display: 'inline-block', fontFamily: 'Inter', fontWeight: 600, fontSize: tamanho, lineHeight: 1.08, letterSpacing: '-0.04em', color: p.destaque ? cor : TEXTO, textShadow: p.destaque ? `0 0 50px ${cor}66` : 'none'}}>{p.texto}</span>;
      })}
    </div>
    <Onda t={t} cena={cena} cor={cor} y={1380} opacidade={0.35} />
  </>;
}

function Tela({t, cena, cor}: P) {
  const v = cena.visual;
  if (v.tipo !== 'terminal' && v.tipo !== 'codigo') return null;
  const linhas = cena.marcos.linhas ?? [];
  const maior = Math.max(...linhas.map((l) => l.texto.length), 10);
  const tamanho = Math.min(30, 836 / (maior * 0.6 + 1.6));
  const titulo = v.tipo === 'terminal' ? v.titulo : v.arquivo;
  const legenda = v.legenda ?? (v.tipo === 'terminal' ? 'no terminal' : 'no código');
  return <>
    <Grande t={t} a={cena.inicio + 0.05} texto={legenda} y={340} tamanho={tamanhoPorTexto(legenda.length) * 0.75} />
    <svg viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
      <Mac x={100} y={600} w={880} op={pr(t, cena.inicio, cena.inicio + 0.3)}>
        <Digitado t={t} w={836} linhas={linhas} titulo={titulo} cor={cor} tamanho={tamanho} />
      </Mac>
    </svg>
    <Onda t={t} cena={cena} cor={cor} y={1420} opacidade={0.3} />
  </>;
}

function Lista({t, cena, cor}: P) {
  if (cena.visual.tipo !== 'lista') return null;
  const itens = cena.marcos.itens ?? [];
  const atual = itens.reduce((a, it, k) => (t >= it.t ? k : a), -1);
  return <>
    <Grande t={t} a={cena.inicio + 0.05} texto={cena.visual.titulo} y={330} tamanho={tamanhoPorTexto(cena.visual.titulo.length) * 0.8} />
    {itens.map((it, k) => {
      const op = pr(t, it.t - 0.05, it.t + 0.2);
      const ativo = k === atual;
      return <div key={k} style={{position: 'absolute', left: 90, right: 90, top: 580 + k * 165, opacity: op, transform: `translateX(${(1 - op) * 60}px)`,
        display: 'flex', alignItems: 'center', gap: 30, padding: '26px 34px', borderRadius: 26, background: ativo ? `${cor}22` : CARTAO, border: `3px solid ${ativo ? cor : BORDA}`}}>
        <div style={{width: 76, height: 76, borderRadius: 20, background: ativo ? cor : '#1a1e26', display: 'grid', placeItems: 'center', fontFamily: 'Mono', fontWeight: 500, fontSize: 36, color: ativo ? PRETO : APAGADO, flex: 'none'}}>{String(k + 1).padStart(2, '0')}</div>
        <div style={{fontFamily: 'Inter', fontWeight: 600, fontSize: 50, letterSpacing: '-0.02em', color: TEXTO, lineHeight: 1.15}}>{it.texto}</div>
      </div>;
    })}
  </>;
}

function formatar(n: number, idioma: string) {
  const casas = Number.isInteger(n) ? 0 : 1;
  const [int, dec] = Math.abs(n).toFixed(casas).split('.');
  const mil = idioma === 'en' ? ',' : '.';
  const virg = idioma === 'en' ? '.' : ',';
  const comMil = int.replace(/\B(?=(\d{3})+(?!\d))/g, mil);
  return `${n < 0 ? '-' : ''}${comMil}${dec ? virg + dec : ''}`;
}

function Numero({t, cena, cor, idioma}: P) {
  const v = cena.visual;
  if (v.tipo !== 'numero') return null;
  const fim = cena.marcos.fimContagem ?? cena.falaFim;
  const u = pr(t, cena.falaInicio, fim);
  const valor = Number.isInteger(v.valor) ? Math.round(v.valor * u) : v.valor * u;
  const texto = `${v.prefixo}${formatar(valor, idioma)}${v.sufixo}`;
  return <>
    <div style={{position: 'absolute', left: 40, right: 40, top: 560, textAlign: 'center', fontFamily: 'Inter', fontWeight: 600, fontSize: limitar(1400 / Math.max(4, texto.length), 110, 280), letterSpacing: '-0.05em', color: cor,
      transform: `scale(${1 + bate(t, fim, 0.4) * 0.08})`, textShadow: `0 0 70px ${cor}55`, opacity: pr(t, cena.inicio, cena.inicio + 0.2)}}>{texto}</div>
    <Grande t={t} a={cena.falaInicio + 0.2} texto={v.rotulo} y={980} tamanho={tamanhoPorTexto(v.rotulo.length) * 0.6} cor={TEXTO} peso={500} />
    <Onda t={t} cena={cena} cor={cor} y={1360} opacidade={0.3} />
  </>;
}

function Virada({t, cena}: P) {
  if (cena.visual.tipo !== 'virada') return null;
  const a = cena.marcos.entrada ?? cena.inicio;
  return <>
    <Grande t={t} a={a} texto={cena.visual.texto} y={640} tamanho={tamanhoPorTexto(cena.visual.texto.length)} cor={PRETO} />
    <Onda t={t} cena={cena} cor={PRETO} y={1320} opacidade={0.8} />
  </>;
}

function Gancho({t, cena, cor, usuario}: P) {
  const v = cena.visual;
  if (v.tipo !== 'gancho') return null;
  const pt = cena.marcos.palavraT ?? cena.falaInicio;
  const ct = cena.marcos.chamadaT ?? cena.falaFim;
  const caixa = pr(t, pt - 0.1, pt + 0.15);
  const digitado = v.palavra.toUpperCase().slice(0, Math.max(0, Math.floor((t - pt) * 22)));
  const enviado = pr(t, pt + 0.7, pt + 0.9);
  return <>
    <Grande t={t} a={cena.inicio + 0.05} texto="COMENTE" y={360} tamanho={120} />
    <div style={{position: 'absolute', left: 0, right: 0, top: 530, display: 'flex', justifyContent: 'center', opacity: caixa}}>
      <div style={{transform: `scale(${0.85 + 0.15 * caixa + bate(t, pt, 0.4) * 0.08})`, border: `6px solid ${cor}`, borderRadius: 28, padding: '22px 46px', background: `${cor}1f`, boxShadow: `0 0 80px ${cor}55`}}>
        <span style={{fontFamily: 'Mono', fontWeight: 500, fontSize: limitar(1100 / (v.palavra.length + 1), 60, 112), color: cor, letterSpacing: '0.02em'}}>{v.palavra.toUpperCase()}</span>
      </div>
    </div>
    <Grande t={t} a={ct} texto={v.chamada} y={800} tamanho={tamanhoPorTexto(v.chamada.length) * 0.6} cor={TEXTO} peso={500} />
    <svg viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
      <Mac x={200} y={1080} w={680} op={pr(t, cena.inicio + 0.1, cena.inicio + 0.4)}>
        <rect x={0} y={0} width={646} height={52} fill="#161b22" />
        <text x={323} y={35} textAnchor="middle" fontFamily="Inter" fontWeight={600} fontSize={24} fill={TEXTO}>Comentários</text>
        <circle cx={50} cy={110} r={26} fill="#2a2f38" />
        <rect x={92} y={92} width={300} height={16} rx={8} fill="#232733" />
        <rect x={24} y={330} width={598} height={66} rx={33} fill="#161b22" stroke={digitado ? cor : '#2a2f38'} strokeWidth={2} />
        <text x={56} y={373} fontFamily="Inter" fontWeight={500} fontSize={28} fill={digitado ? TEXTO : APAGADO}>{digitado || '...'}</text>
        <circle cx={588} cy={363} r={24} fill={enviado ? cor : '#2a2f38'} />
        <path d="M578 353 L600 363 L578 373 Z" fill={PRETO} />
        <g opacity={enviado}>
          <circle cx={50} cy={190} r={26} fill={cor} opacity={0.8} />
          <text x={92} y={200} fontFamily="Inter" fontWeight={600} fontSize={28} fill={cor}>{v.palavra.toUpperCase()}</text>
        </g>
      </Mac>
    </svg>
    {usuario ? <div style={{position: 'absolute', left: 0, right: 0, top: 1610, textAlign: 'center', fontFamily: 'Inter', fontWeight: 600, fontSize: 40, color: TEXTO, opacity: pr(t, ct, ct + 0.3)}}>{usuario}</div> : null}
  </>;
}

const CENAS = {titulo: Titulo, terminal: Tela, codigo: Tela, lista: Lista, numero: Numero, virada: Virada, gancho: Gancho};

/** Desenha a cena com entrada e saída suaves. */
export function CenaVisual(p: P) {
  const {t, cena} = p;
  const op = pr(t, cena.inicio, cena.inicio + 0.2) * (1 - pr(t, cena.fim - 0.2, cena.fim));
  if (op <= 0) return null;
  const C = CENAS[cena.visual.tipo];
  return <AbsoluteFill style={{opacity: op}}><C {...p} /></AbsoluteFill>;
}
