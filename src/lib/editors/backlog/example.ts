/**
 * Example backlog: BiblioYa, the university library app the other examples
 * use, as built by the invented company Faro Software. Two components; the
 * Catálogo epics are fully broken down with Gherkin, the others only partly.
 */
import type { BacklogData, Epic, UserStory } from '../../model/types';
import { uid } from '../../model/diagram';
import { PREFILL_GUARDRAILS, PREFILL_PROCESS } from './model';

function story(title: string, asA: string, iWant: string, soThat: string, points: number, priority: string, gherkin: string): UserStory {
  return { id: uid(), title, asA, iWant, soThat, points, priority, epic: '', gherkin: gherkin.trim() };
}

function epic(title: string, component: string, priority: string, description: string, stories: UserStory[] = []): Epic {
  return { id: uid(), code: '', title, description, component, priority, stories };
}

export function backlogExample(): BacklogData {
  const altaFondos = epic('Alta de fondos', 'Catálogo', 'Must', 'Registrar los libros que llegan a la biblioteca: la obra y cada uno de sus ejemplares.', [
    story(
      'Registrar una obra nueva',
      'bibliotecario',
      'dar de alta una obra con su ISBN, título, autor y materia',
      'que los socios la encuentren en el catálogo',
      3,
      'Must',
      `Escenario: Alta de una obra con datos completos
  Dado que estoy identificado como bibliotecario
  Y que no existe ninguna obra con ISBN "978-84-376-0494-7"
  Cuando registro la obra con ISBN "978-84-376-0494-7", título "Cien años de soledad" y autor "Gabriel García Márquez"
  Entonces la obra aparece en el catálogo
  Y veo el mensaje "Obra registrada"

Escenario: ISBN repetido
  Dado que ya existe una obra con ISBN "978-84-376-0494-7"
  Cuando intento registrar otra obra con ese ISBN
  Entonces la obra no se registra
  Y veo el mensaje "Ya existe una obra con ese ISBN"

Escenario: Falta un dato obligatorio
  Dado que estoy identificado como bibliotecario
  Cuando registro una obra sin título
  Entonces la obra no se registra
  Y el campo "Título" se marca como obligatorio`
    ),
    story(
      'Añadir ejemplares a una obra',
      'bibliotecario',
      'añadir ejemplares a una obra indicando su sede',
      'saber cuántas copias se pueden prestar en cada biblioteca',
      2,
      'Must',
      `Escenario: Añadir dos ejemplares en una sede
  Dado que la obra "Cien años de soledad" tiene 1 ejemplar en la sede "Campus Norte"
  Cuando añado 2 ejemplares en la sede "Campus Norte"
  Entonces la obra tiene 3 ejemplares en "Campus Norte"
  Y cada ejemplar nuevo tiene un código de barras distinto

Escenario: Cantidad no válida
  Dado que estoy en la ficha de la obra "Cien años de soledad"
  Cuando intento añadir 0 ejemplares
  Entonces no se añade ningún ejemplar
  Y veo el mensaje "Indica al menos un ejemplar"`
    )
  ]);

  const bajas = epic('Bajas y expurgo', 'Catálogo', 'Should', 'Retirar ejemplares perdidos o deteriorados sin perder su historial de préstamos.', [
    story(
      'Dar de baja un ejemplar',
      'bibliotecario',
      'dar de baja un ejemplar indicando el motivo',
      'que deje de aparecer como disponible',
      2,
      'Should',
      `Escenario: Baja de un ejemplar deteriorado
  Dado que el ejemplar "BY-000123" está disponible
  Cuando lo doy de baja con el motivo "Deteriorado"
  Entonces el ejemplar deja de aparecer como disponible
  Y su historial de préstamos se conserva

Escenario: Ejemplar prestado
  Dado que el ejemplar "BY-000123" está prestado
  Cuando intento darlo de baja
  Entonces la baja no se hace
  Y veo el mensaje "El ejemplar está prestado; espera a que se devuelva"`
    )
  ]);

  const inventario = epic('Inventario', 'Catálogo', 'Could', 'Comprobar cada curso que los ejemplares están donde dice el sistema.', [
    story(
      'Pasar inventario de una sede',
      'bibliotecario',
      'leer los códigos de barras de una estantería y compararlos con el sistema',
      'detectar ejemplares perdidos o mal colocados',
      5,
      'Could',
      `Escenario: Todos los ejemplares están en su sitio
  Dado que la estantería "N-12" tiene 40 ejemplares según el sistema
  Cuando leo los 40 códigos de barras
  Entonces el informe dice "Sin incidencias"

Escenario: Falta un ejemplar
  Dado que la estantería "N-12" tiene 40 ejemplares según el sistema
  Cuando leo 39 códigos de barras y termino
  Entonces el informe lista el ejemplar que falta
  Y lo marca como "No localizado"`
    )
  ]);

  const busqueda = epic('Búsqueda en el catálogo', 'Préstamos', 'Must', 'Encontrar una obra y ver en qué sedes hay ejemplares disponibles.', [
    story('Buscar por título o autor', 'socio', 'buscar una obra por título o autor', 'saber si la tienen sin ir a la biblioteca', 3, 'Must', 'Escenario: Hay obras que coinciden\n  Dado que el catálogo tiene la obra «La sombra del viento» de Carlos Ruiz Zafón\n  Cuando el socio busca «sombra del viento»\n  Entonces ve la obra en los resultados con su autor y su año\n\nEscenario: No hay resultados\n  Dado que ninguna obra del catálogo contiene «zzzz»\n  Cuando el socio busca «zzzz»\n  Entonces ve el mensaje «No hay obras con esa búsqueda»\n  Y se le sugiere revisar la ortografía'),
    story('Ver disponibilidad por sede', 'socio', 'ver cuántos ejemplares hay libres en cada sede', 'ir a la que me pille mejor', 2, 'Should', 'Escenario: Ejemplares libres en varias sedes\n  Dado que la obra tiene 2 ejemplares libres en la sede Centro y 0 en la sede Norte\n  Cuando el socio abre la ficha de la obra\n  Entonces ve «Centro: 2 disponibles» y «Norte: ninguno disponible»\n\nEscenario: Ningún ejemplar libre\n  Dado que todos los ejemplares de la obra están prestados\n  Cuando el socio abre la ficha de la obra\n  Entonces ve «Sin ejemplares disponibles»\n  Y ve el botón «Reservar»')
  ]);

  return {
    product: 'BiblioYa',
    components: ['Préstamos', 'Catálogo'],
    epics: [
      busqueda,
      epic('Préstamo y devolución', 'Préstamos', 'Must', 'Prestar y devolver ejemplares en el mostrador, con plazos y multas por retraso.'),
      epic('Reservas', 'Préstamos', 'Should', 'Reservar una obra prestada y recibir aviso cuando vuelva.'),
      epic('Cuenta del socio', 'Préstamos', 'Could', 'Consultar préstamos, renovar y ver el historial.'),
      altaFondos,
      bajas,
      inventario
    ],
    ai: {
      context:
        'BiblioYa es la aplicación de la red de bibliotecas de una universidad. Los socios (estudiantes y personal) buscan obras y piden préstamos; los bibliotecarios gestionan el catálogo, los ejemplares de cada sede y el mostrador de préstamo. Esta especificación cubre el componente Catálogo.',
      stack: 'Aplicación web: TypeScript con SvelteKit, base de datos PostgreSQL, pruebas de aceptación con Cucumber.js sobre los ficheros .feature. Se ejecuta con `npm run dev` y las pruebas con `npm test`.',
      glossary: [
        'Obra: un libro como título (ISBN, título, autor, materia), con independencia de cuántas copias haya.',
        'Ejemplar: cada copia física de una obra, con su código de barras y su sede.',
        'Sede: cada una de las bibliotecas de la red (Campus Norte, Campus Sur, Medicina).',
        'Baja: retirada de un ejemplar del préstamo; se guarda el motivo y su historial.',
        'Inventario: comprobación física de los ejemplares de una estantería frente al sistema.'
      ].join('\n'),
      outOfScope: 'Préstamos, reservas y cuentas de socio (componente Préstamos).\nPagos de multas.\nLa app móvil de lectura de códigos: se usa un lector USB como teclado.',
      guardrails: PREFILL_GUARDRAILS,
      process: PREFILL_PROCESS
    }
  };
}
