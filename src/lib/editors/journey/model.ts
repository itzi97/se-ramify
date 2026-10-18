/** Customer journey: example, emotion curve geometry and the Markdown export (no Svelte). */
import { uid } from '../../model/diagram';
import type { JourneyData } from '../../model/types';

export const EMOTIONS: { value: number; label: string; icon: string; color: string }[] = [
  { value: 2, label: 'Muy bien', icon: 'Laugh', color: '#58a55c' },
  { value: 1, label: 'Bien', icon: 'Smile', color: '#8cb84f' },
  { value: 0, label: 'Neutral', icon: 'Meh', color: '#8d949c' },
  { value: -1, label: 'Mal', icon: 'Frown', color: '#e8873a' },
  { value: -2, label: 'Muy mal', icon: 'Angry', color: '#d9534f' }
];

export function emotionInfo(v: number) {
  return EMOTIONS.find((e) => e.value === v) ?? EMOTIONS[2];
}

export function clampEmotion(v: number): number {
  return Math.max(-2, Math.min(2, Math.round(v)));
}

/** A smooth path through the points (Catmull-Rom turned into cubic Béziers). */
export function smoothPath(pts: { x: number; y: number }[]): string {
  if (!pts.length) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function journeyExample(): JourneyData {
  const stages = ['Buscar el libro', 'Reservar', 'Recoger', 'Leer y estudiar', 'Devolver'].map((name) => ({ id: uid(), name }));
  const rows = ['Acciones', 'Puntos de contacto', 'Piensa y siente', 'Pains', 'Oportunidades'].map((name) => ({ id: uid(), name }));
  const text: string[][] = [
    ['Busca en el catálogo desde el móvil', 'Pulsa «Reservar» y elige biblioteca', 'Va al mostrador con el carné', 'Estudia el capítulo para el examen', 'Lo deja en el buzón de devolución'],
    ['Catálogo web', 'App de la biblioteca', 'Mostrador, bibliotecario', 'Libro en papel', 'Buzón, correo de confirmación'],
    ['«¿Habrá algún ejemplar libre?»', '«Qué rápido, ya está»', '«Otra vez cola…»', '«Justo lo que necesitaba»', '«¿Lo habrán registrado?»'],
    ['El catálogo no dice cuándo vuelve un ejemplar', '—', '20 minutos de cola en exámenes', 'Le queda poco tiempo de préstamo', 'No recibe confirmación inmediata'],
    ['Mostrar la fecha prevista de devolución', 'Avisar cuando esté listo', 'Taquillas de autorrecogida', 'Renovar desde la app', 'Confirmación al momento por notificación']
  ];
  const cells: Record<string, string> = {};
  rows.forEach((r, i) => stages.forEach((s, j) => (cells[`${r.id}:${s.id}`] = text[i][j])));
  const emo = [-1, 1, -2, 2, 0];
  const emotion: Record<string, number> = {};
  stages.forEach((s, j) => (emotion[s.id] = emo[j]));
  return {
    persona: 'Lucía, 21, estudiante de Biología',
    scenario: 'Necesita el manual de Genética para el examen de la semana que viene',
    stages,
    rows,
    cells,
    emotion,
    moments: [stages[2].id]
  };
}

export function journeyMarkdown(title: string, d: JourneyData): string {
  const cell = (t: string | undefined) => (t ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, '<br>').trim() || ' ';
  const out = [`# ${title}`, ''];
  if (d.persona.trim()) out.push(`**Persona:** ${d.persona.trim()}`, '');
  if (d.scenario.trim()) out.push(`**Escenario:** ${d.scenario.trim()}`, '');
  out.push(`| | ${d.stages.map((s) => cell(s.name) + (d.moments.includes(s.id) ? ' ★' : '')).join(' | ')} |`);
  out.push(`|---|${d.stages.map(() => '---').join('|')}|`);
  for (const r of d.rows) out.push(`| **${cell(r.name)}** | ${d.stages.map((s) => cell(d.cells[`${r.id}:${s.id}`])).join(' | ')} |`);
  out.push(`| **Emoción** | ${d.stages.map((s) => (s.id in d.emotion ? `${emotionInfo(d.emotion[s.id]).label} (${d.emotion[s.id] > 0 ? '+' : ''}${d.emotion[s.id]})` : ' ')).join(' | ')} |`);
  out.push('');
  if (d.moments.length) {
    const names = d.stages.filter((s) => d.moments.includes(s.id)).map((s) => s.name);
    out.push(`★ Momentos de la verdad: ${names.join(', ')}`, '');
  }
  return out.join('\n');
}
