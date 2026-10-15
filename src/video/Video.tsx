import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Audio, Sequence, cancelRender, continueRender, delayRender, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {CenaVisual} from './cenas';
import type {Linha} from './tipos';
import {APAGADO, Fundo, PRETO, TEXTO, pr} from './util';

const fontes = [
  ['Inter', 400, 'inter-latin-400-normal.woff2'],
  ['Inter', 600, 'inter-latin-600-normal.woff2'],
  ['Mono', 500, 'jetbrains-mono-latin-500-normal.woff2'],
] as const;
const css = fontes.map(([f, w, arq]) => `@font-face{font-family:${f};font-weight:${w};src:url("${staticFile(`fontes/${arq}`)}")}`).join('');

function Topo({t, linha, escuro}: {t: number; linha: Linha; escuro: boolean}) {
  const atual = Math.max(0, linha.cenas.findIndex((c) => t >= c.inicio && t < c.fim));
  const cor = escuro ? PRETO : TEXTO;
  return <div style={{position: 'absolute', left: 60, right: 60, top: 96, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'Inter', fontWeight: 600, fontSize: 34, color: cor}}>
      {linha.marca ? <><span style={{width: 18, height: 18, borderRadius: 9, background: escuro ? PRETO : linha.cor, display: 'inline-block'}} />{linha.marca}</> : null}
    </div>
    <span style={{fontFamily: 'Mono', fontWeight: 500, fontSize: 30, color: escuro ? '#05070bAA' : APAGADO}}>{`${String(atual + 1).padStart(2, '0')} / ${String(linha.cenas.length).padStart(2, '0')}`}</span>
  </div>;
}

export const Video: React.FC<{linha: Linha}> = ({linha}) => {
  const idioma = linha.idioma;
  const frame = useCurrentFrame();
  const [handle] = useState(() => delayRender('carregando fontes'));
  useEffect(() => {
    Promise.all([document.fonts.load('400 32px Inter'), document.fonts.load('600 32px Inter'), document.fonts.load('500 32px Mono')])
      .then(() => continueRender(handle)).catch(cancelRender);
  }, [handle]);
  const t = frame / linha.fps;
  const virada = linha.cenas.find((c) => c.visual.tipo === 'virada' && t >= c.inicio && t < c.fim);
  const fundoCor = virada ? pr(t, virada.inicio, virada.inicio + 0.15) * (1 - pr(t, virada.fim - 0.15, virada.fim)) : 0;
  const falas = linha.cenas.map((c) => [c.falaInicio, c.falaFim]);
  // Música abaixa um pouco enquanto a voz fala.
  const volumeMusica = (f: number) => {
    const s = f / linha.fps;
    const falando = falas.some(([a, b]) => s >= a - 0.1 && s <= b + 0.1);
    const fade = interpolate(s, [0, 0.8, linha.duracao - 1.2, linha.duracao], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    return (falando ? 0.07 : 0.13) * fade;
  };
  return <AbsoluteFill style={{background: PRETO, overflow: 'hidden'}}>
    <style>{css}</style>
    <Fundo t={t} cor={linha.cor} />
    <AbsoluteFill style={{background: linha.cor, opacity: fundoCor}} />
    {linha.cenas.map((c) => <CenaVisual key={c.indice} t={t} cena={c} cor={linha.cor} idioma={idioma} usuario={linha.usuario} />)}
    <Topo t={t} linha={linha} escuro={fundoCor > 0.5} />
    <div style={{position: 'absolute', left: 0, bottom: 0, height: 10, width: `${(t / linha.duracao) * 100}%`, background: fundoCor > 0.5 ? PRETO : linha.cor}} />
    {linha.cenas.map((c) => c.audio ? (
      <Sequence key={`fala-${c.indice}`} from={Math.round(c.falaInicio * linha.fps)} durationInFrames={Math.max(1, Math.ceil((c.falaFim - c.falaInicio + 0.3) * linha.fps))}>
        <Audio src={staticFile(c.audio)} playbackRate={linha.velocidade} />
      </Sequence>
    ) : null)}
    {linha.musica ? <Audio src={staticFile('trilha.wav')} volume={volumeMusica} /> : null}
    {linha.efeitos.map((e, k) => (
      <Sequence key={`fx-${k}`} from={Math.round(e.t * linha.fps)} durationInFrames={Math.round(linha.fps * 1.2)}>
        <Audio src={staticFile(`efeitos/${e.som}.wav`)} volume={e.volume * 0.55} />
      </Sequence>
    ))}
  </AbsoluteFill>;
};
