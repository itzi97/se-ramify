/** Example story map: a library loans app, two sprints. */
import { uid } from '../../model/diagram';
import type { StoryMapData } from '../../model/types';

export function storymapExample(): StoryMapData {
  const step = (title: string) => ({ id: uid(), title });
  const buscar = { id: uid(), title: 'Buscar libros', steps: [step('Buscar en el catálogo'), step('Ver la ficha del libro')] };
  const pedir = { id: uid(), title: 'Pedir prestado', steps: [step('Reservar'), step('Recoger en el mostrador')] };
  const devolver = { id: uid(), title: 'Devolver', steps: [step('Devolver el libro'), step('Renovar el préstamo')] };
  const cuenta = { id: uid(), title: 'Gestionar mi cuenta', steps: [step('Ver mis préstamos'), step('Recibir avisos')] };
  const s1 = { id: uid(), name: 'Sprint 1' };
  const s2 = { id: uid(), name: 'Sprint 2' };

  const stories: StoryMapData['stories'] = [];
  const add = (stepId: string, releaseId: string, title: string, asA: string, iWant: string, soThat: string, points: number, priority: string, epic: string, gherkin = '') => {
    const order = stories.filter((s) => s.stepId === stepId && s.releaseId === releaseId).length;
    stories.push({ id: uid(), stepId, releaseId, order, title, asA, iWant, soThat, points, priority, epic, gherkin });
  };

  add(buscar.steps[0].id, s1.id, 'Buscar por título o autor', 'socio', 'buscar un libro por título o autor', 'saber si la biblioteca lo tiene', 3, 'Must', 'Catálogo',
    `Escenario: Buscar un libro que existe
  Dado que el catálogo tiene "Cien años de soledad"
  Cuando busco "cien años"
  Entonces veo "Cien años de soledad" en los resultados

Escenario: Buscar un libro que no existe
  Dado que el catálogo no tiene ningún libro de "Zzz"
  Cuando busco "Zzz"
  Entonces veo el mensaje "No hay resultados"`);
  add(buscar.steps[1].id, s1.id, 'Ver disponibilidad', 'socio', 'ver cuántos ejemplares quedan libres', 'decidir si lo reservo', 2, 'Must', 'Catálogo');
  add(pedir.steps[0].id, s1.id, 'Reservar un libro disponible', 'socio', 'reservar un ejemplar disponible', 'recogerlo en las próximas 48 horas', 5, 'Must', 'Préstamos',
    `Escenario: Reservar un ejemplar libre
  Dado que hay 2 ejemplares disponibles de "Rayuela"
  Cuando reservo "Rayuela"
  Entonces quedan 1 ejemplares disponibles
  Y recibo un aviso con el plazo de recogida`);
  add(pedir.steps[1].id, s1.id, 'Registrar el préstamo', 'bibliotecario', 'registrar el préstamo al entregar el libro', 'que conste quién lo tiene y hasta cuándo', 3, 'Must', 'Préstamos');
  add(devolver.steps[0].id, s1.id, 'Registrar la devolución', 'bibliotecario', 'registrar una devolución escaneando el libro', 'que el ejemplar vuelva a estar disponible', 3, 'Must', 'Préstamos');
  add(cuenta.steps[0].id, s1.id, 'Ver mis préstamos', 'socio', 'ver los libros que tengo y su fecha de devolución', 'no pasarme del plazo', 2, 'Should', 'Mi cuenta');

  add(buscar.steps[0].id, s2.id, 'Filtrar por género y año', 'socio', 'filtrar los resultados por género y año', 'encontrar lecturas parecidas', 3, 'Could', 'Catálogo');
  add(pedir.steps[0].id, s2.id, 'Cancelar una reserva', 'socio', 'cancelar una reserva', 'liberar el ejemplar para otro socio', 2, 'Should', 'Préstamos');
  add(pedir.steps[0].id, s2.id, 'Lista de espera', 'socio', 'apuntarme a la lista de espera de un libro prestado', 'que me avisen cuando vuelva', 5, 'Could', 'Préstamos');
  add(devolver.steps[1].id, s2.id, 'Renovar un préstamo', 'socio', 'renovar un préstamo una vez', 'terminar el libro sin multa', 3, 'Should', 'Préstamos',
    `Escenario: Renovar un préstamo sin reservas pendientes
  Dado que tengo "Rayuela" prestado y nadie lo ha reservado
  Cuando pido renovarlo
  Entonces la fecha de devolución se amplía 14 días`);
  add(cuenta.steps[1].id, s2.id, 'Aviso de vencimiento', 'socio', 'recibir un aviso dos días antes del vencimiento', 'devolver a tiempo', 3, 'Should', 'Mi cuenta');

  return { persona: 'Socio de la biblioteca (y el bibliotecario en el mostrador)', activities: [buscar, pedir, devolver, cuenta], releases: [s1, s2], stories };
}
