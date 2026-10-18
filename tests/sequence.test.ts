import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutSequence, textWidth } from '../src/lib/editors/sequence/layout';
import { parsePlantUml, parsePlantUmlLenient, refOver, toMermaid, toPlantUml } from '../src/lib/editors/sequence/text';
import { layoutSequence } from '../src/lib/editors/sequence/layout';
import { sequenceExample } from '../src/lib/editors/sequence/example';
import type { SequenceData } from '../src/lib/model/types';

const strip = (d: SequenceData) => ({
  participants: d.participants.map((p) => ({ name: p.name, kind: p.kind })),
  items: d.items.map((it) => {
    const { id: _id, ...rest } = it as { id: string } & Record<string, unknown>;
    const names = new Map(d.participants.map((p) => [p.id, p.name]));
    if (it.t === 'msg') return { ...rest, from: names.get(it.from), to: names.get(it.to) };
    if (it.t === 'note') return { ...rest, over: it.over.map((o) => names.get(o)) };
    return rest;
  }),
  activations: d.activations,
  autonumber: d.autonumber
});

test('example lays out without problems, every message inside the drawing', () => {
  const d = sequenceExample();
  const l = layoutSequence(d);
  assert.deepEqual(l.problems, []);
  assert.equal(l.heads.length, d.participants.length);
  assert.equal(l.messages.length, d.items.filter((i) => i.t === 'msg').length);
  for (const m of l.messages) {
    assert.ok(m.x1 >= 0 && m.x2 >= 0 && m.x1 <= l.width && m.x2 <= l.width, `message ${m.text} inside width`);
    assert.ok(m.y > 0 && m.y < l.height);
  }
  // Columns are left to right, far enough apart for their heads.
  for (let i = 1; i < l.heads.length; i++) assert.ok(l.heads[i].x - l.heads[i - 1].x >= (l.heads[i].w + l.heads[i - 1].w) / 2);
  // Messages go down the page in order.
  for (let i = 1; i < l.messages.length; i++) assert.ok(l.messages[i].y > l.messages[i - 1].y);
});

test('a created participant gets its head at the create message, not at the top', () => {
  const d = sequenceExample();
  const l = layoutSequence(d);
  const created = d.participants.find((p) => p.name === ':Préstamo')!;
  const head = l.heads.find((h) => h.id === created.id)!;
  const msg = l.messages.find((m) => m.style === 'create')!;
  assert.ok(head.created);
  assert.ok(head.y < msg.y && head.y + head.h > msg.y, 'head straddles the arrow');
  assert.ok(head.y > l.heads[0].y + 40);
});

test('sync opens a bar on the callee, reply closes it; alt operands restart', () => {
  const d = sequenceExample();
  const l = layoutSequence(d);
  const control = d.participants.find((p) => p.name === ':ControlPréstamo')!.id;
  const bars = l.activations.filter((a) => a.pid === control && a.depth === 0).sort((a, b) => a.y1 - b.y1);
  assert.ok(bars.length >= 2, 'one bar per alt operand');
  const elseY = l.fragments[0].elses[0].y;
  assert.ok(bars[1].y1 === elseY, 'second operand starts at the else line');
  assert.ok(l.activations.every((a) => a.y2 > a.y1));
});

test('fragments wrap their messages and nest inside each other', () => {
  const d = parsePlantUml('A -> B: x\nloop cada uno\n  alt ok\n    B -> C: y\n  else\n    B --> A: n\n  end\nend\n');
  const l = layoutSequence(d);
  assert.deepEqual(l.problems, []);
  const [outer, inner] = l.fragments;
  assert.equal(outer.op, 'loop');
  assert.ok(outer.x1 < inner.x1 && outer.x2 > inner.x2 && outer.y1 < inner.y1 && outer.y2 > inner.y2);
  for (const m of l.messages.slice(1)) assert.ok(m.y > inner.y1 && m.y < inner.y2);
});

test('problems are reported, not thrown', () => {
  const d: SequenceData = { participants: [{ id: 'a', name: 'A', kind: 'actor' }], items: [{ id: 'm', t: 'msg', from: 'a', to: 'gone', text: 'x', style: 'sync' }, { id: 'o', t: 'open', op: 'opt', guard: '' }], activations: true, autonumber: false };
  const l = layoutSequence(d);
  assert.equal(l.problems.length, 2);
});

test('PlantUML round trip keeps participants, items and flags', () => {
  const d = sequenceExample();
  const text = toPlantUml(d, 'Prestar');
  const back = parsePlantUml(text, d);
  assert.deepEqual(strip(back), strip(d));
  // Ids of known participants survive.
  assert.deepEqual(back.participants.map((p) => p.id), d.participants.map((p) => p.id));
  // And a second trip is stable text.
  assert.equal(toPlantUml(back, 'Prestar'), text);
});

test('parser understands declarations, arrows, create / destroy, notes, ref', () => {
  const d = parsePlantUml(`@startuml
actor Socio
boundary ":Pantalla" as P
database BD
autonumber
autoactivate off
Socio -> P: prestar()
P ->> BD: log()
create T
P -> T: new()
P -> T: borrar()
destroy T
P --> Socio: ok
note over Socio, P: dos\\nlíneas
note right of BD
  multi
  línea
end note
ref over Socio, P: Iniciar sesión
@enduml`);
  assert.deepEqual(d.participants.map((p) => `${p.kind} ${p.name}`), ['actor Socio', 'boundary :Pantalla', 'database BD', 'object T']);
  assert.deepEqual(d.items.filter((i) => i.t === 'msg').map((m) => (m as { style: string }).style), ['sync', 'async', 'create', 'destroy', 'reply']);
  assert.equal(d.autonumber, true);
  assert.equal(d.activations, false);
  const notes = d.items.filter((i) => i.t === 'note') as { text: string }[];
  assert.deepEqual(notes.map((n) => n.text), ['dos\nlíneas', 'multi\nlínea']);
  assert.deepEqual(d.items.slice(-2).map((i) => i.t), ['open', 'close']);
});

test('problems become warnings with line numbers; the rest of the file still comes through', () => {
  const r = parsePlantUmlLenient('actor A\nA -> : x\nalt y\nA -> B: hola\n');
  assert.deepEqual(r.warnings.map((w) => w.line), [2, 3]);
  assert.equal(r.data.items.filter((i) => i.t === 'msg').length, 1);
  assert.deepEqual(r.data.items.map((i) => i.t), ['open', 'msg', 'close'], 'the open alt is closed at the end');
  assert.equal(parsePlantUmlLenient('end').warnings.length, 1);
  assert.equal(parsePlantUmlLenient('A -> B: x\ndestroy C').warnings.length, 1);
});

const TEACHER = `@startuml
/' diagrama del profe
   con comentario de bloque '/
title Reservar clase
skinparam monochrome true
hide footbox
autoactivate on
actor Socio
participant "Pantalla Reservas" as UI #lightblue
control Ctl
Socio -> UI: reservar()
activate UI
UI -[#red]> Ctl: comprobar()
Ctl --> UI: ok
== Cancelación ==
... 5 minutos después ...
UI -> Ctl: cancelar()
return cancelada
Ctl -> R ** : new()
Ctl -> R !! : borrar()
Socio <- UI: confirmación
UI ->x Ctl: perdido
note left of Socio: a la izquierda
note right of UI
  dos líneas
  aquí
end note
ref over UI, Ctl : Iniciar sesión
deactivate UI
@enduml
`;

test('typical teacher files import: dividers, delays, return, create **, ref over, colours, quoted aliases', () => {
  const { data: d, warnings } = parsePlantUmlLenient(TEACHER);
  assert.deepEqual(warnings, []);
  const name = (id: string) => d.participants.find((p) => p.id === id)!.name;
  assert.deepEqual(d.participants.map((p) => p.name), ['Socio', 'Pantalla Reservas', 'Ctl', 'R']);
  const msgs = d.items.filter((i) => i.t === 'msg') as Extract<(typeof d.items)[number], { t: 'msg' }>[];
  const show = msgs.map((m) => `${name(m.from)}>${name(m.to)}:${m.style}:${m.text}`);
  assert.deepEqual(show, [
    'Socio>Pantalla Reservas:sync:reservar()',
    'Pantalla Reservas>Ctl:sync:comprobar()',
    'Ctl>Pantalla Reservas:reply:ok',
    'Pantalla Reservas>Ctl:sync:cancelar()',
    'Ctl>Pantalla Reservas:reply:cancelada',
    'Ctl>R:create:new()',
    'Ctl>R:destroy:borrar()',
    'Pantalla Reservas>Socio:sync:confirmación',
    'Pantalla Reservas>Ctl:async:perdido'
  ]);
  const notes = d.items.filter((i) => i.t === 'note') as { text: string; over: string[] }[];
  assert.deepEqual(notes.map((n) => n.text), ['== Cancelación ==', '... 5 minutos después ...', 'a la izquierda', 'dos líneas\naquí']);
  const ref = d.items.find((i) => i.t === 'open')!;
  assert.deepEqual(refOver(ref)!.map(name), ['Pantalla Reservas', 'Ctl']);
});

test('dividers, delays and partial refs survive a round trip and lay out', () => {
  const d = parsePlantUml(TEACHER);
  const text = toPlantUml(d);
  assert.match(text, /^== Cancelación ==$/m);
  assert.match(text, /^\.\.\. 5 minutos después \.\.\.$/m);
  assert.match(text, /^ref over P1, Ctl: Iniciar sesión$/m);
  const back = parsePlantUmlLenient(text, d);
  assert.deepEqual(back.warnings, []);
  assert.equal(toPlantUml(back.data), text);
  const l = layoutSequence(d);
  assert.deepEqual(l.notes.filter((n) => n.kind).map((n) => n.kind), ['divider', 'delay']);
  const frag = l.fragments.find((f) => f.op === 'ref')!;
  const ui = l.heads.find((h) => h.name === 'Pantalla Reservas')!;
  const socio = l.heads.find((h) => h.name === 'Socio')!;
  assert.ok(frag.x1 > socio.x + 10, 'the ref box leaves Socio out');
  assert.ok(frag.x1 < ui.x);
});

test('Mermaid export balances activations and fragments', () => {
  const m = toMermaid(sequenceExample(), 'Prestar');
  assert.match(m, /^sequenceDiagram\n/);
  assert.match(m, /create participant/);
  const plus = (m.match(/->>\+|-\)\+/g) ?? []).length;
  const minus = (m.match(/-->>-/g) ?? []).length;
  assert.ok(minus <= plus);
  assert.equal((m.match(/^\s*alt /gm) ?? []).length, (m.match(/^\s*end$/gm) ?? []).length);
});

test('textWidth grows with text', () => {
  assert.ok(textWidth('prestar(libro)') > textWidth('ok'));
});
