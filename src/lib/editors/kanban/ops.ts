/**
 * Kanban edits, the example board and the Markdown export (tests/kanban.test.ts).
 */
import { uid } from '../../model/diagram';
import type { CardType, KanbanCard, KanbanData } from '../../model/types';
import { storyMarkdown, storySentence, storyTitle, totalPoints } from '../../model/stories';

export const CARD_TYPES: { type: CardType; label: string; es: string; color: string }[] = [
  { type: 'story', label: 'Story', es: 'Historia', color: '#4a7fc1' },
  { type: 'task', label: 'Task', es: 'Tarea', color: '#3a9e9a' },
  { type: 'bug', label: 'Bug', es: 'Error', color: '#d9534f' },
  { type: 'epic', label: 'Epic', es: 'Épica', color: '#8a63c4' },
  { type: 'spike', label: 'Spike', es: 'Spike', color: '#e8873a' }
];

export function typeInfo(t: CardType) {
  return CARD_TYPES.find((x) => x.type === t) ?? CARD_TYPES[0];
}

export function cardsIn(data: KanbanData, colId: string): KanbanCard[] {
  return data.cards.filter((c) => c.colId === colId).sort((a, b) => a.order - b.order);
}

/** Over its WIP limit (a limit of 0 means none). */
export function overLimit(data: KanbanData, colId: string): boolean {
  const col = data.columns.find((c) => c.id === colId);
  return !!col && col.wip > 0 && cardsIn(data, colId).length > col.wip;
}

export function moveCard(data: KanbanData, id: string, colId: string, index: number): void {
  const card = data.cards.find((c) => c.id === id);
  if (!card || !data.columns.some((c) => c.id === colId)) return;
  const from = cardsIn(data, card.colId).filter((c) => c.id !== id);
  const to = card.colId === colId ? from : cardsIn(data, colId).filter((c) => c.id !== id);
  card.colId = colId;
  to.splice(Math.max(0, Math.min(index, to.length)), 0, card);
  to.forEach((c, i) => (c.order = i));
  if (from !== to) from.forEach((c, i) => (c.order = i));
}

export function newCard(colId: string, order: number, type: CardType = 'story'): KanbanCard {
  return { id: uid(), colId, order, type, assignee: '', title: '', asA: '', iWant: '', soThat: '', gherkin: '', points: undefined, priority: '', epic: '' };
}

/** Remove a column; its cards go to the column on its left (or right), or are deleted when it was the last. */
export function removeColumn(data: KanbanData, colId: string): void {
  const i = data.columns.findIndex((c) => c.id === colId);
  if (i < 0) return;
  const neighbour = data.columns[i - 1] ?? data.columns[i + 1];
  if (neighbour) {
    const base = cardsIn(data, neighbour.id).length;
    cardsIn(data, colId).forEach((c, k) => {
      c.colId = neighbour.id;
      c.order = base + k;
    });
  } else data.cards = [];
  data.columns.splice(i, 1);
}

export function toMarkdown(title: string, data: KanbanData): string {
  const out = [`# ${title}`];
  for (const col of data.columns) {
    const cards = cardsIn(data, col.id);
    const pts = totalPoints(cards);
    out.push('', `## ${col.name} (${cards.length}${col.wip ? `/${col.wip}` : ''}${pts ? ` · ${pts} pts` : ''})`);
    if (!cards.length) {
      out.push('', '_Vacía._');
      continue;
    }
    for (const c of cards) {
      const t = typeInfo(c.type);
      if (c.type === 'story' && (c.gherkin.trim() || storySentence(c))) {
        out.push('', storyMarkdown({ ...c, title: `[${t.es}] ${storyTitle(c)}${c.assignee ? ` — ${c.assignee}` : ''}` }, 3));
      } else {
        const bits = [`- **[${t.es}]** ${storyTitle(c)}`];
        if (typeof c.points === 'number') bits.push(`(${c.points} pts)`);
        if (c.assignee) bits.push(`— ${c.assignee}`);
        out.push(bits.join(' '));
      }
    }
  }
  return out.join('\n') + '\n';
}

export function kanbanExample(): KanbanData {
  const cols = [
    { id: uid(), name: 'Backlog', wip: 0 },
    { id: uid(), name: 'Por hacer', wip: 0 },
    { id: uid(), name: 'En curso', wip: 3 },
    { id: uid(), name: 'En revisión', wip: 2 },
    { id: uid(), name: 'Hecho', wip: 0 }
  ];
  const cards: KanbanCard[] = [];
  const add = (col: number, type: CardType, title: string, extra: Partial<KanbanCard> = {}) => {
    const order = cards.filter((c) => c.colId === cols[col].id).length;
    cards.push({ ...newCard(cols[col].id, order, type), title, ...extra });
  };
  add(0, 'epic', 'Notificaciones a socios', { epic: 'Notificaciones' });
  add(0, 'story', 'Lista de espera', { asA: 'socio', iWant: 'apuntarme a la lista de espera de un libro prestado', soThat: 'que me avisen cuando vuelva', points: 5, priority: 'Could', epic: 'Préstamos' });
  add(0, 'spike', 'Probar la API de correo del ayuntamiento', { points: 2 });
  add(1, 'story', 'Renovar un préstamo', { asA: 'socio', iWant: 'renovar un préstamo una vez', soThat: 'terminar el libro sin multa', points: 3, priority: 'Should', epic: 'Préstamos', assignee: 'Luis Pérez' });
  add(1, 'task', 'Script de carga del catálogo inicial', { points: 2, assignee: 'Marta Ruiz' });
  add(2, 'story', 'Reservar un libro disponible', {
    asA: 'socio',
    iWant: 'reservar un ejemplar disponible',
    soThat: 'recogerlo en las próximas 48 horas',
    points: 5,
    priority: 'Must',
    epic: 'Préstamos',
    assignee: 'Ana García',
    gherkin: 'Escenario: Reservar un ejemplar libre\n  Dado que hay 2 ejemplares disponibles de "Rayuela"\n  Cuando reservo "Rayuela"\n  Entonces quedan 1 ejemplares disponibles'
  });
  add(2, 'bug', 'La búsqueda no encuentra títulos con tilde', { points: 1, assignee: 'Pablo Gil' });
  add(2, 'task', 'Pantalla de ficha del libro', { points: 3, assignee: 'Marta Ruiz' });
  add(2, 'story', 'Ver mis préstamos', { asA: 'socio', iWant: 'ver los libros que tengo y su fecha de devolución', soThat: 'no pasarme del plazo', points: 2, priority: 'Should', epic: 'Mi cuenta', assignee: 'Luis Pérez' });
  add(3, 'story', 'Registrar el préstamo', { asA: 'bibliotecario', iWant: 'registrar el préstamo al entregar el libro', soThat: 'que conste quién lo tiene y hasta cuándo', points: 3, priority: 'Must', epic: 'Préstamos', assignee: 'Ana García' });
  add(4, 'story', 'Buscar por título o autor', { asA: 'socio', iWant: 'buscar un libro por título o autor', soThat: 'saber si la biblioteca lo tiene', points: 3, priority: 'Must', epic: 'Catálogo', assignee: 'Pablo Gil' });
  add(4, 'task', 'Configurar la base de datos', { points: 2, assignee: 'Marta Ruiz' });
  return { columns: cols, cards };
}
