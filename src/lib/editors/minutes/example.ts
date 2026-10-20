/**
 * Examples: an invented company (Faro Software, four people) building
 * BiblioYa, the loans app for a university library — the same neutral
 * subject as the app's other examples.
 */
import { uid } from '../../model/diagram';
import type { MinutesData } from '../../model/types';

const items = (...texts: string[]) => texts.map((text) => ({ id: uid(), text }));

const team = (present = true) => [
  { id: uid(), name: 'Ana López', role: 'Jefa de proyecto (Faro Software)', present },
  { id: uid(), name: 'Bruno Díaz', role: 'Analista funcional (Faro Software)', present },
  { id: uid(), name: 'Carla Gómez', role: 'Arquitecta de software (Faro Software)', present },
  { id: uid(), name: 'David Martín', role: 'Desarrollo y pruebas (Faro Software)', present }
];

/** A requirements meeting with the head librarian. */
export function minutesExample(): MinutesData {
  const [ana, bruno, carla, david] = team();
  return {
    type: 'client',
    number: '1',
    date: '2026-10-21',
    start: '17:00',
    end: '18:15',
    place: 'Biblioteca central del campus, sala de reuniones 2',
    attendees: [
      { id: uid(), name: 'Marta Ruiz', role: 'Directora de la biblioteca (cliente)', present: true },
      { id: uid(), name: 'Luis Ortega', role: 'Bibliotecario de mostrador (usuario)', present: true },
      ana,
      bruno,
      carla,
      { ...david, present: false }
    ],
    agenda: items(
      'Presentación de los asistentes',
      'Aclarar requisitos de préstamos, reservas y sanciones',
      'Dudas del equipo sobre el diagrama de casos de uso',
      'Próximos pasos'
    ),
    discussion:
      'Ana presenta el objetivo de la reunión y el diagrama de casos de uso provisional. Marta confirma que los dos actores principales son el socio y el bibliotecario, y que el sistema de gestión académica solo se consulta para validar que el socio sigue matriculado.\n\nSe repasan las reglas de préstamo y de reservas (ver preguntas). Luis pide que el mostrador pueda registrar una devolución leyendo solo el código del ejemplar, sin buscar al socio.',
    questions: [
      { id: uid(), text: '¿Cuántos libros puede tener prestados un socio a la vez y durante cuánto tiempo?', answer: 'Estudiantes: 5 libros durante 15 días. Personal docente: 10 libros durante 30 días.' },
      { id: uid(), text: '¿Se puede renovar un préstamo?', answer: 'Sí, hasta 2 veces, siempre que nadie haya reservado el libro.' },
      { id: uid(), text: '¿Hay multas económicas por devolver tarde?', answer: 'No. Se suspende el préstamo un día por cada día de retraso y por cada libro.' },
      { id: uid(), text: '¿Cuántas reservas puede tener un socio y cuánto se guarda el libro?', answer: 'Hasta 3 reservas. Cuando el libro vuelve, se guarda 48 horas en el mostrador y se avisa al socio por correo.' },
      { id: uid(), text: '¿Necesitáis informes de uso?', answer: 'Un informe mensual de préstamos por facultad. Se confirmará el formato en la próxima reunión.' }
    ],
    review: [],
    decisions: items(
      'El socio se identifica con el carné universitario; no habrá usuario y contraseña propios de BiblioYa.',
      'La devolución en mostrador solo necesita el código del ejemplar.',
      'Las sanciones son de suspensión de préstamo, sin importes económicos.'
    ),
    actions: [
      { id: uid(), text: 'Actualizar el diagrama de casos de uso con renovar préstamo y avisar de reserva disponible', owner: 'Bruno Díaz', due: '2026-10-26', done: false },
      { id: uid(), text: 'Escribir las especificaciones de prestar y devolver libro', owner: 'Carla Gómez', due: '2026-10-28', done: false },
      { id: uid(), text: 'Enviar un ejemplo del informe mensual de préstamos', owner: 'Marta Ruiz', due: '2026-10-30', done: false },
      { id: uid(), text: 'Pasar esta acta a todos los asistentes', owner: 'Ana López', due: '2026-10-22', done: true }
    ],
    next: 'Miércoles 4 de noviembre de 2026, 17:00, en la misma sala: validación del diagrama de casos de uso y del informe mensual.'
  };
}

/**
 * The agile-methodology acta for the final hand-in: the team meets to weigh
 * how the same project would have gone with Scrum.
 */
export function retroExample(): MinutesData {
  const review = (kind: 'well' | 'bad' | 'improve', area: 'team' | 'method', text: string) => ({ id: uid(), text, kind, area });
  return {
    type: 'retro',
    number: '8',
    date: '2027-01-18',
    start: '16:00',
    end: '17:15',
    place: 'Aula 2.3 del campus',
    attendees: team(),
    agenda: items(
      'Qué habría cambiado con una metodología ágil (Scrum)',
      'Qué ha ido bien, qué ha ido mal y qué es mejorable',
      'Acuerdos para el próximo proyecto'
    ),
    discussion:
      'Se repasa el proyecto como si se hubiera hecho con Scrum: los requisitos pasan a épicas, las épicas a historias de usuario con criterios de aceptación en Gherkin y el trabajo se organiza en sprints de dos semanas con una demo a la directora de la biblioteca al final de cada uno.\n\nEl equipo coincide en que el cliente habría visto el préstamo y la devolución funcionando en el primer sprint, y que los cambios en las reservas habrían llegado antes. A cambio, habría hecho falta más disciplina para mantener el backlog ordenado.',
    questions: [],
    review: [
      review('well', 'team', 'El equipo ya trabajaba en reuniones semanales cortas; el paso a una daily habría sido natural.'),
      review('well', 'method', 'Las historias con criterios Gherkin dejan claro cuándo una funcionalidad está terminada.'),
      review('well', 'method', 'Las demos de cada sprint habrían adelantado la opinión del cliente sobre las reservas.'),
      review('bad', 'team', 'Nadie del equipo ha hecho de Product Owner; priorizar el backlog habría costado al principio.'),
      review('bad', 'method', 'Con sprints cortos, la arquitectura de la elaboración se habría decidido sobre la marcha.'),
      review('improve', 'team', 'Rotar el papel de Scrum Master para que todos aprendan a facilitar.'),
      review('improve', 'method', 'Escribir la definición de hecho antes del primer sprint.'),
      review('improve', 'method', 'Reservar un sprint inicial (sprint 0) para la arquitectura y el entorno.')
    ],
    decisions: items(
      'El informe recomendará Scrum con un sprint 0 de arquitectura para proyectos parecidos.',
      'El User Story Mapping de los dos primeros sprints se incluye como anexo del informe.'
    ),
    actions: [
      { id: uid(), text: 'Redactar el apartado de épicas e historias del informe ágil', owner: 'Bruno Díaz', due: '2027-01-22', done: false },
      { id: uid(), text: 'Preparar el User Story Mapping de los sprints 1 y 2', owner: 'Carla Gómez', due: '2027-01-22', done: false },
      { id: uid(), text: 'Revisar los criterios Gherkin de todas las historias', owner: 'David Martín', due: '2027-01-24', done: false }
    ],
    next: 'Lunes 25 de enero de 2027, 16:00: revisión final del informe antes de entregarlo.'
  };
}

/** The team's post mortem of the project, after following the Unified Process. */
export function postmortemExample(): MinutesData {
  const review = (kind: 'well' | 'bad' | 'improve', area: 'team' | 'method', text: string) => ({ id: uid(), text, kind, area });
  return {
    type: 'postmortem',
    number: '7',
    date: '2027-01-14',
    start: '16:00',
    end: '17:30',
    place: 'Teams',
    attendees: team(),
    agenda: items('Qué ha funcionado bien', 'Qué ha ido mal', 'Qué mejoraríamos', 'Acciones para el próximo proyecto'),
    discussion:
      'Cada miembro escribe por separado lo que ha ido bien, lo que ha ido mal y lo que mejoraría, sobre el equipo y sobre el Proceso Unificado. Después se agrupan las notas repetidas y se votan las tres mejoras más importantes.',
    questions: [],
    review: [
      review('well', 'team', 'Repartimos los roles desde el primer día y cada entrega tuvo un responsable claro.'),
      review('well', 'team', 'Las revisiones cruzadas de diagramas detectaron errores antes de entregar.'),
      review('well', 'method', 'Dirigir el proyecto por casos de uso nos dio una lista de requisitos que el cliente entendía.'),
      review('well', 'method', 'La fase de elaboración dejó la arquitectura estable antes de construir.'),
      review('bad', 'team', 'Las tareas de la última semana se acumularon y dos personas cargaron con casi todo.'),
      review('bad', 'method', 'Mantener al día todos los artefactos del PUD llevó más tiempo que construir.'),
      review('bad', 'method', 'El cliente solo vio el producto al final de la construcción y pidió cambios tarde.'),
      review('improve', 'team', 'Revisar la carga de trabajo de cada persona en la reunión semanal.'),
      review('improve', 'method', 'Enseñar al cliente una versión funcionando al final de cada iteración.'),
      review('improve', 'method', 'Documentar solo los artefactos que alguien va a leer.')
    ],
    decisions: items(
      'En el próximo proyecto probaremos Scrum con sprints de dos semanas y una demo al cliente en cada uno.',
      'El tablero de tareas será la única fuente del estado del trabajo.'
    ),
    actions: [
      { id: uid(), text: 'Preparar la plantilla de backlog y de definición de hecho', owner: 'Bruno Díaz', due: '2027-01-21', done: false },
      { id: uid(), text: 'Escribir el informe "qué habría cambiado con una metodología ágil"', owner: 'Ana López', due: '2027-01-25', done: false },
      { id: uid(), text: 'Proponer un límite de trabajo en curso por persona', owner: 'David Martín', due: '2027-01-21', done: false }
    ],
    next: 'Sin fecha: es la reunión de cierre del proyecto.'
  };
}
