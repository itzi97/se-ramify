/**
 * Example Gantt: a Unified Process (PUD) plan for a library loans app, with
 * its four phases, iterations, milestones and dependencies. Starts on the
 * Monday of the current week.
 */
import { uid } from '../../model/diagram';
import type { GanttData, GanttTask } from '../../model/types';
import { addDays, mondayOf, todayLocal } from './time';

export function ganttExample(): GanttData {
  const monday = mondayOf(todayLocal());
  const tasks: GanttTask[] = [];

  const group = (name: string, color?: string): string => {
    const id = uid();
    tasks.push({ id, name, start: monday, end: monday, progress: 0, milestone: false, group: true, deps: [], owner: '', color });
    return id;
  };
  /** Task starting `from` days after the plan start, lasting `days` days (inclusive). */
  const task = (parent: string, name: string, from: number, days: number, owner: string, deps: string[] = [], progress = 0): string => {
    const id = uid();
    const start = addDays(monday, from);
    tasks.push({ id, name, start, end: addDays(start, days - 1), progress, milestone: false, group: false, parent, deps, owner });
    return id;
  };
  const milestone = (parent: string, name: string, at: number, deps: string[]): string => {
    const id = uid();
    const d = addDays(monday, at);
    tasks.push({ id, name, start: d, end: d, progress: 0, milestone: true, group: false, parent, deps, owner: '' });
    return id;
  };

  const inicio = group('Inicio', '#4a7fc1');
  const vision = task(inicio, 'I1 · Visión y alcance', 0, 5, 'Ana', [], 100);
  const cu = task(inicio, 'I1 · Casos de uso principales', 3, 7, 'Luis', [], 60);
  const riesgos = task(inicio, 'I1 · Riesgos y TCO', 7, 4, 'Marta', [vision]);
  const lco = milestone(inicio, 'Hito: objetivos del ciclo de vida', 11, [cu, riesgos]);

  const elab = group('Elaboración', '#58a55c');
  const arq = task(elab, 'E1 · Arquitectura base', 14, 10, 'Pablo', [lco]);
  const dom = task(elab, 'E1 · Modelo de dominio (clases)', 14, 8, 'Luis', [lco]);
  const proto = task(elab, 'E2 · Prototipo arquitectónico', 25, 10, 'Pablo', [arq]);
  const seq = task(elab, 'E2 · Diagramas de secuencia', 23, 8, 'Ana', [dom]);
  const lca = milestone(elab, 'Hito: arquitectura del ciclo de vida', 36, [proto, seq]);

  const cons = group('Construcción', '#e8873a');
  const prest = task(cons, 'C1 · Préstamos y devoluciones', 37, 12, 'Marta', [lca]);
  const res = task(cons, 'C2 · Reservas', 51, 10, 'Luis', [prest]);
  const notif = task(cons, 'C3 · Avisos de vencimiento', 63, 8, 'Ana', [res]);
  const pruebas = task(cons, 'C3 · Pruebas de integración', 65, 9, 'Pablo', [res]);
  const ioc = milestone(cons, 'Hito: capacidad operativa inicial', 75, [notif, pruebas]);

  const trans = group('Transición', '#8a63c4');
  const beta = task(trans, 'T1 · Pruebas beta en la biblioteca', 77, 7, 'Marta', [ioc]);
  const form = task(trans, 'T1 · Formación del personal', 81, 4, 'Ana', [ioc]);
  const despl = task(trans, 'T1 · Despliegue', 86, 3, 'Pablo', [beta, form]);
  milestone(trans, 'Hito: entrega del producto', 89, [despl]);

  return { tasks, scale: 'week', showWeekends: true };
}
