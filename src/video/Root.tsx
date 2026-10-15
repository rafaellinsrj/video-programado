import React from 'react';
import {Composition} from 'remotion';
import demo from './demo.json';
import type {Linha} from './tipos';
import {Video} from './Video';

// A duração vem da linha do tempo de cada vídeo.
export const Root: React.FC = () => (
  <Composition
    id="VideoProgramado"
    component={Video}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={300}
    defaultProps={{linha: demo as Linha}}
    calculateMetadata={({props}) => ({durationInFrames: Math.max(1, Math.ceil(props.linha.duracao * props.linha.fps)), fps: props.linha.fps})}
  />
);
