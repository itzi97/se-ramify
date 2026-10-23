import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeGraph, parseClassPuml, parseUsecasePuml } from '../src/lib/editors/graph/plantuml';
import { graphExample } from '../src/lib/editors/graph/examples';
import { graphExports } from '../src/lib/editors/graph/export';
import { newDiagram } from '../src/lib/model/diagram';
import type { GraphData } from '../src/lib/model/types';

const pumlOf = (kind: 'class' | 'usecase', g: GraphData) => graphExports(newDiagram(kind, 'x', '', g) as never).find((x) => x.ext === 'puml')!.build();
const shape = (g: GraphData) => ({
  nodes: g.nodes.map((n) => [n.type, n.label, n.attrs ?? [], n.ops ?? [], !!n.abstract]).sort(),
  edges: g.edges.map((e) => [g.nodes.find((n) => n.id === e.from)!.label, e.type, g.nodes.find((n) => n.id === e.to)!.label, e.label ?? '', e.fromLabel ?? '', e.toLabel ?? '']).sort()
});

test('class diagram: export, read back, nothing lost and nothing moved', () => {
  const g = graphExample('class');
  const parsed = parseClassPuml(pumlOf('class', g));
  assert.deepEqual(parsed.warnings, []);
  const { data, fresh } = mergeGraph(g, parsed);
  assert.equal(fresh.size, 0);
  assert.deepEqual(shape(data), shape(g));
  for (const n of g.nodes) assert.deepEqual([data.nodes.find((x) => x.id === n.id)?.x, data.nodes.find((x) => x.id === n.id)?.y], [n.x, n.y]);
});

test('use case diagram: export, read back', () => {
  const g = graphExample('usecase');
  const parsed = parseUsecasePuml(pumlOf('usecase', g));
  assert.deepEqual(parsed.warnings, []);
  const { data, fresh } = mergeGraph(g, parsed);
  assert.equal(fresh.size, 0);
  assert.deepEqual(shape(data), shape(g));
});

test('hand-written class PlantUML', () => {
  const p = parseClassPuml(`@startuml
class Jugador {
  - casillaActual: int
  + realizarJugada(): void
}
class Dado {
  + tirar(): int
}
abstract class Ficha
Jugador "1" --> "2" Dado : tira
Jugador --> "1" Tablero
Ficha <|-- FichaRoja
Tablero : + mover(int actual, int unidades): boolean
@enduml`);
  assert.deepEqual(p.warnings, []);
  const by = (k: string) => p.nodes.find((n) => n.key === k)!;
  assert.deepEqual(by('Jugador').attrs, ['- casillaActual: int']);
  assert.deepEqual(by('Tablero').ops, ['+ mover(int actual, int unidades): boolean']);
  assert.equal(by('Ficha').abstract, true);
  assert.deepEqual(p.edges[0], { from: 'Jugador', to: 'Dado', type: 'directed', label: 'tira', fromLabel: '1', toLabel: '2' });
  assert.deepEqual(p.edges[2], { from: 'FichaRoja', to: 'Ficha', type: 'generalization', label: undefined, fromLabel: undefined, toLabel: undefined });
});

test('hand-written use cases, with include and a boundary', () => {
  const p = parseUsecasePuml(`@startuml
actor Socio
rectangle Biblioteca {
  (Prestar libro) as P
  usecase "Identificar socio" as I
}
Socio -- P
P ..> I : <<include>>
:Bibliotecario: --> (Devolver libro)
@enduml`);
  assert.deepEqual(p.warnings, []);
  assert.deepEqual(
    p.nodes.map((n) => [n.type, n.label, n.parent ?? '']),
    [
      ['actor', 'Socio', ''],
      ['boundary', 'Biblioteca', ''],
      ['usecase', 'Prestar libro', 'Biblioteca'],
      ['usecase', 'Identificar socio', 'Biblioteca'],
      ['actor', 'Bibliotecario', ''],
      ['usecase', 'Devolver libro', '']
    ]
  );
  assert.equal(p.edges[1].type, 'include');
});

test('a new class in the text keeps the others where they are', () => {
  const g = graphExample('class');
  const text = pumlOf('class', g).replace('@enduml', 'class Multa {\n  - importe: double\n}\nC1 -- Multa\n@enduml');
  const { data, fresh } = mergeGraph(g, parseClassPuml(text));
  assert.equal(fresh.size, 1);
  assert.equal(data.nodes.length, g.nodes.length + 1);
});
