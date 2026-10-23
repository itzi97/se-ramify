import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allOperations, buildModel, checkSequence, parseCall, parseLifeline, parseOperation } from '../src/lib/model/uml-model';
import { newDiagram } from '../src/lib/model/diagram';
import type { GraphData, SequenceData } from '../src/lib/model/types';

const node = (id: string, label: string, ops: string[] = [], attrs: string[] = []) => ({ id, type: 'class', x: 0, y: 0, label, ops, attrs });
function parchis() {
  const data: GraphData = {
    routing: 'orthogonal',
    nodes: [node('j', 'Jugador', ['+ realizarJugada(): void', '+ casillaActual(): int'], ['- casillaActual: int']), node('d', 'Dado', ['+ tirar(): int']), node('t', 'Tablero', ['+ mover(int actual, int unidades): boolean']), node('b', 'Bot', [])],
    edges: [{ id: 'e', type: 'generalization', from: 'b', to: 'j' }]
  };
  return buildModel([newDiagram('class', 'Clases', 'Parchis', data)]);
}
const seq = (participants: SequenceData['participants'], items: SequenceData['items']): SequenceData => ({ participants, items, activations: true, autonumber: true });

test('operations parse in UML and Java styles', () => {
  assert.deepEqual(parseOperation('+ mover(int actual, int unidades): boolean')?.params, [
    { name: 'actual', type: 'int' },
    { name: 'unidades', type: 'int' }
  ]);
  const o = parseOperation('- reservar(fecha: Date, socio: Socio): Reserva')!;
  assert.equal(o.name, 'reservar');
  assert.equal(o.ret, 'Reserva');
  assert.equal(o.params[1].type, 'Socio');
  assert.equal(parseOperation('nombre: String'), null);
});

test('lifelines and calls', () => {
  assert.deepEqual(parseLifeline('j:Jugador'), { obj: 'j', type: 'Jugador' });
  assert.deepEqual(parseLifeline(':Tablero'), { obj: '', type: 'Tablero' });
  assert.deepEqual(parseCall('mover(casillaActual, v1 + v2)'), { name: 'mover', args: 2 });
  assert.deepEqual(parseCall('ok = mover(a, f(b, c))'), { name: 'mover', args: 2 });
  assert.deepEqual(parseCall('tirar()'), { name: 'tirar', args: 0 });
  assert.equal(parseCall('v1'), null);
  assert.equal(parseCall('casillaActual = casillaActual + 1'), null);
});

test('the model reads classes, operations and inheritance', () => {
  const m = parchis();
  assert.equal(m.classes.size, 4);
  assert.deepEqual(
    allOperations(m, 'bot').map((o) => o.name),
    ['realizarJugada', 'casillaActual']
  );
});

test('a correct sequence has no issues', () => {
  const d = seq(
    [
      { id: 'u', name: 'Usuario', kind: 'actor' },
      { id: 'j', name: 'j:Jugador', kind: 'object' },
      { id: 'd', name: 'd1:Dado', kind: 'object' },
      { id: 't', name: 't:Tablero', kind: 'object' }
    ],
    [
      { id: '1', t: 'msg', from: 'u', to: 'j', text: 'realizarJugada()', style: 'sync' },
      { id: '2', t: 'msg', from: 'j', to: 'd', text: 'tirar()', style: 'sync' },
      { id: '3', t: 'msg', from: 'd', to: 'j', text: 'v1', style: 'reply' },
      { id: '4', t: 'msg', from: 'j', to: 't', text: 'mover(casillaActual, v1 + v2)', style: 'sync' },
      { id: '5', t: 'msg', from: 'j', to: 'j', text: 'casillaActual = casillaActual + v1', style: 'sync' }
    ]
  );
  assert.deepEqual(checkSequence(d, parchis()), []);
});

test('a missing operation, a typo and a wrong class are caught, with fixes', () => {
  const d = seq(
    [
      { id: 'j', name: 'j:Jugador', kind: 'object' },
      { id: 't', name: 't:Tablero', kind: 'object' },
      { id: 'x', name: 'd:Dadoo', kind: 'object' }
    ],
    [
      { id: '1', t: 'msg', from: 'j', to: 't', text: 'moverr(a, b)', style: 'sync' },
      { id: '2', t: 'msg', from: 'j', to: 't', text: 'reiniciar()', style: 'sync' },
      { id: '3', t: 'msg', from: 'j', to: 't', text: 'mover(a)', style: 'sync' }
    ]
  );
  const issues = checkSequence(d, parchis());
  const by = (id: string) => issues.find((i) => i.itemId === id || i.partId === id);
  assert.deepEqual(by('x')?.fix?.fix, { kind: 'rename-part', partId: 'x', to: 'd:Dado' });
  assert.deepEqual(by('1')?.fix?.fix, { kind: 'rename-call', itemId: '1', from: 'moverr', to: 'mover' });
  assert.deepEqual(by('2')?.fix?.fix, { kind: 'add-op', className: 'Tablero', line: '+ reiniciar()' });
  assert.equal(by('3')?.level, 'info');
});

test('no class diagram, nothing to check', () => {
  const d = seq([{ id: 'j', name: 'j:Jugador', kind: 'object' }], [{ id: '1', t: 'msg', from: 'j', to: 'j', text: 'x()', style: 'sync' }]);
  assert.deepEqual(checkSequence(d, buildModel([])), []);
});
