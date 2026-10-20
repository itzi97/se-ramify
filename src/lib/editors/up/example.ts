/**
 * Example UP plan: BiblioYa, the university library app made by the invented
 * company Faro Software (the subject of the app's other examples).
 */
import { blankUp } from '../../model/diagram';
import type { UpData } from '../../model/types';
import { addSuggested } from './model';

export function upExample(): UpData {
  const data = blankUp();
  data.phases[0].goal = 'Decidir con la biblioteca si BiblioYa merece la pena: alcance, visión y coste.';
  data.phases[1].goal = 'Cerrar los casos de uso de préstamo y reserva y validar la arquitectura con un prototipo.';
  data.phases[2].goal = 'Construir préstamos, reservas y avisos en tres iteraciones de dos semanas.';
  data.phases[3].goal = 'Poner BiblioYa en marcha en la biblioteca central y formar al personal.';
  addSuggested(data);
  const set: Record<string, [UpData['artifacts'][number]['status'], string?]> = {
    'Visión': ['done', 'Elevator pitch aprobado por la directora de la biblioteca'],
    'Caso de negocio': ['done'],
    'Lista de riesgos': ['done', 'Riesgo principal: integración con el catálogo actual'],
    'Modelo de casos de uso inicial': ['done'],
    'Plan del proyecto (Gantt)': ['done'],
    'Glosario': ['draft', 'Ejemplar, préstamo, reserva, sanción'],
    'Modelo de casos de uso con especificaciones': ['draft', 'CU-01 a CU-06 especificados; faltan los de administración'],
    'Modelo del dominio': ['done'],
    'Modelo de análisis': ['draft'],
    'Arquitectura base / descripción de la arquitectura': ['draft'],
    'Plan de iteraciones': ['done'],
    'Prototipo': ['draft', 'Pantallas de búsqueda y préstamo'],
    'Modelo de diseño (clases de diseño)': ['draft'],
    'Diagramas de secuencia': ['todo', 'Uno por escenario principal: prestar, devolver, reservar']
  };
  for (const a of data.artifacts) {
    const s = set[a.name];
    if (!s) continue;
    a.status = s[0];
    if (s[1]) a.note = s[1];
  }
  return data;
}
