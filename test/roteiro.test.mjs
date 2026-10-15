import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {LIMITES, nomeArquivo, validarRoteiro} from '../src/servidor/roteiro.mjs';

const exemplo = () => JSON.parse(fs.readFileSync(new URL('../exemplos/exemplo.json', import.meta.url), 'utf8'));
const cena = (fala = 'Uma frase.') => ({fala, visual: {tipo: 'titulo', texto: 'Título'}});

test('rejeita campo desconhecido no roteiro, na cena e no visual', () => {
  assert.throws(() => validarRoteiro({...exemplo(), extra: 1}), /Roteiro inválido/);
  const r = exemplo(); r.cenas[0].saida = '/etc';
  assert.throws(() => validarRoteiro(r), /Roteiro inválido/);
  const r2 = exemplo(); r2.cenas[0].visual.html = '<script>';
  assert.throws(() => validarRoteiro(r2), /Roteiro inválido/);
});

test('rejeita roteiro vazio, sem título ou com tipo de visual desconhecido', () => {
  assert.throws(() => validarRoteiro({titulo: 'x', cenas: []}), /cenas/);
  assert.throws(() => validarRoteiro({cenas: [cena()]}), /titulo/);
  assert.throws(() => validarRoteiro({titulo: 'x', cenas: [{fala: 'oi', visual: {tipo: 'video_externo', url: 'http://x'}}]}), /Roteiro inválido/);
});

test('aplica limites de cenas, de fala e de total de caracteres', () => {
  assert.throws(() => validarRoteiro({titulo: 'x', cenas: Array.from({length: LIMITES.cenas + 1}, () => cena())}), /cenas/);
  assert.throws(() => validarRoteiro({titulo: 'x', cenas: [cena('a'.repeat(LIMITES.caracteresPorFala + 1))]}), /fala/);
  const longas = Array.from({length: 10}, () => cena('a'.repeat(450)));
  assert.throws(() => validarRoteiro({titulo: 'x', cenas: longas}), /máximo é 4000/);
});

test('rejeita opções fora da lista e valores fora da faixa', () => {
  const base = {titulo: 'x', cenas: [cena()]};
  assert.throws(() => validarRoteiro({...base, opcoes: {voz: 'qualquer'}}), /voz/);
  assert.throws(() => validarRoteiro({...base, opcoes: {velocidade: 3}}), /velocidade/);
  assert.throws(() => validarRoteiro({...base, opcoes: {cor: 'red; background:url(x)'}}), /cor/);
  assert.throws(() => validarRoteiro({...base, opcoes: {idioma: 'fr'}}), /idioma/);
});

test('gancho aceita só uma palavra, sem espaços nem símbolos', () => {
  const g = (palavra) => ({titulo: 'x', cenas: [{fala: 'Comenta.', visual: {tipo: 'gancho', palavra}}]});
  assert.throws(() => validarRoteiro(g('duas palavras')), /palavra/);
  assert.throws(() => validarRoteiro(g('<b>')), /palavra/);
  assert.equal(validarRoteiro(g('PROGRAMADO')).cenas[0].visual.palavra, 'PROGRAMADO');
});

test('aceita o roteiro de exemplo e completa as opções padrão', () => {
  const r = validarRoteiro(exemplo());
  assert.equal(r.cenas.length, 6);
  const minimo = validarRoteiro({titulo: 'Teste', cenas: [cena()]});
  assert.equal(minimo.opcoes.voz, 'echo');
  assert.equal(minimo.opcoes.velocidade, 1.3);
});

test('nome de arquivo nunca sai da pasta nem carrega caracteres perigosos', () => {
  assert.equal(nomeArquivo('../../etc/passwd'), 'etc-passwd');
  assert.equal(nomeArquivo('Vídeo: "DNS" <b>!'), 'video-dns-b');
  assert.equal(nomeArquivo('////'), 'video');
  assert.ok(nomeArquivo('a'.repeat(300)).length <= 60);
  assert.doesNotMatch(nomeArquivo('C:\\Windows\\system32'), /[\\/:]/);
});
