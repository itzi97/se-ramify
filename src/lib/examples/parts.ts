/**
 * Pieces of the example project that the per-kind examples don't cover:
 * the company's own business model, the two infrastructure alternatives
 * drawn separately, every use case with its specification, the team's own
 * development model and a design class diagram. All invented: Faro
 * Software, a four-person company, builds BiblioYa for a university library.
 */
import { blankSpec, uid } from '../model/diagram';
import { build, e, n } from '../editors/graph/examples';
import { nodeTypeInfo } from '../model/kinds';
import { estimateSize } from '../editors/graph/sizing';
import type { BoardData, GraphData, GraphKind, UseCaseSpec } from '../model/types';

/**
 * Coordinates below are the centre of each shape (top-left for containers),
 * so columns line up whatever the label length; this turns them into the
 * top-left corners the canvas stores, with the same size estimate it uses.
 */
function centred(kind: GraphKind, g: GraphData): GraphData {
  for (const node of g.nodes) {
    const info = nodeTypeInfo(kind, node.type, node.icon);
    if (info.container) continue;
    const size = estimateSize(kind, node, info);
    node.x = Math.round(node.x - size.w / 2);
    node.y = Math.round(node.y - size.h / 2);
  }
  return g;
}

const many = (...t: string[]) => t.map((text) => ({ id: uid(), text }));

/** Faro Software's business model (the company, not the product). */
export function companyCanvas(): BoardData {
  return {
    subject: 'Faro Software — software a medida para instituciones educativas y culturales',
    sections: {
      partners: many('Proveedor de nube (alojamiento)', 'Universidades con las que ya trabajamos', 'Freelance de diseño UX'),
      activities: many('Análisis de requisitos con el cliente', 'Desarrollo y pruebas', 'Mantenimiento y soporte'),
      resources: many('Equipo de 4 ingenieros', 'Plantillas y componentes reutilizables', 'Experiencia en el sector educativo'),
      value: many('Aplicaciones a medida entregadas por iteraciones cortas', 'El cliente ve una versión que funciona cada 3 semanas', 'Documentación formal para poder mantenerla'),
      relationships: many('Reunión con el cliente al final de cada iteración', 'Un único interlocutor (jefa de proyecto)'),
      channels: many('Recomendación entre universidades', 'Concursos públicos', 'Web y LinkedIn'),
      segments: many('Bibliotecas y servicios universitarios', 'Museos y archivos pequeños'),
      costs: many('Salarios (≈80 %)', 'Licencias y nube para desarrollo', 'Formación'),
      revenue: many('Proyecto a precio cerrado por fases', 'Contrato anual de mantenimiento (15 % del proyecto)', 'Bolsa de horas para cambios')
    }
  };
}

/** Alternative A: everything in the library's own building, doubled where a failure would stop the service. */
export function localArchitecture(): GraphData {
  // Columns 160 px apart; rows 140 px apart.
  const c = (i: number) => 100 + i * 160;
  return centred(
    'architecture',
    build(
      [
        n('cpd', 'zone', 0, 0, 'Sala técnica de la biblioteca', { w: 680, h: 440, color: '#4a7fc1' }),
        n('fw', 'device', c(2), 80, 'Router + firewall', { icon: 'Shield' }),
        n('sai', 'device', c(0), 220, 'SAI', { icon: 'BatteryCharging' }),
        n('sw', 'device', c(2), 220, 'Switch principal ×2', { icon: 'Network' }),
        n('s1', 'device', c(0), 360, 'Servidor 1 (app + BD)', { icon: 'Server' }),
        n('s2', 'device', c(1), 360, 'Servidor 2 (réplica)', { icon: 'Server' }),
        n('nas', 'device', c(3), 360, 'NAS de copias', { icon: 'HardDrive' }),
        n('sala', 'zone', 0, 500, 'Mostradores y despachos', { w: 680, h: 300, color: '#e8873a' }),
        n('swp', 'device', c(2), 580, 'Switch de planta', { icon: 'Network' }),
        n('lector', 'device', c(0), 720, 'Lectores de carné ×4', { icon: 'CreditCard' }),
        n('pc', 'device', c(1), 720, 'PC mostrador ×4', { icon: 'Monitor' }),
        n('lap', 'device', c(3), 720, 'Portátiles gestión ×2', { icon: 'Laptop' }),
        n('socios', 'device', c(4) + 80, 80, 'Socios (móvil)', { icon: 'Smartphone' })
      ],
      [
        e('fw', 'sw', 'wired'),
        e('sai', 's1', 'wired', { label: 'corriente' }),
        e('sw', 's1', 'wired'),
        e('sw', 's2', 'wired'),
        e('sw', 'nas', 'wired'),
        e('s1', 's2', 'flow', { label: 'réplica' }),
        e('sw', 'swp', 'wired'),
        e('swp', 'pc', 'wired'),
        e('swp', 'lap', 'wireless'),
        e('lector', 'pc', 'wired', { label: 'USB' }),
        e('socios', 'fw', 'wireless', { label: 'Internet (HTTPS)' })
      ]
    )
  );
}

/** Alternative B: the application in the cloud, in two availability zones; the library keeps only the desks. */
export function cloudArchitecture(): GraphData {
  return centred(
    'architecture',
    build(
      [
        n('lib', 'zone', 0, 0, 'Biblioteca', { w: 360, h: 470, color: '#e8873a' }),
        n('fw', 'device', 180, 90, 'Router + firewall', { icon: 'Shield' }),
        n('sw', 'device', 180, 230, 'Switch', { icon: 'Network' }),
        n('pc', 'device', 90, 380, 'PC mostrador ×4', { icon: 'Monitor' }),
        n('lap', 'device', 270, 380, 'Portátiles gestión ×2', { icon: 'Laptop' }),
        n('cloud', 'zone', 440, 0, 'Nube (región eu-south-2, Madrid)', { w: 680, h: 470, color: '#58a55c' }),
        n('lb', 'device', 760, 90, 'Balanceador de carga', { icon: 'Network' }),
        n('a', 'device', 640, 250, 'VM app — zona A', { icon: 'Cloud' }),
        n('b', 'device', 880, 250, 'VM app — zona B', { icon: 'Cloud' }),
        n('db', 'device', 760, 400, 'BD gestionada (multi-AZ)', { icon: 'Database' }),
        n('bk', 'device', 1010, 400, 'Copias (almacenamiento)', { icon: 'HardDrive' }),
        n('socios', 'device', 1260, 90, 'Socios (móvil)', { icon: 'Smartphone' })
      ],
      [
        e('fw', 'lb', 'wireless', { label: 'Internet (HTTPS)' }),
        e('sw', 'fw', 'wired'),
        e('pc', 'sw', 'wired'),
        e('lap', 'sw', 'wireless'),
        e('lb', 'a', 'flow'),
        e('lb', 'b', 'flow'),
        e('a', 'db', 'wired'),
        e('b', 'db', 'wired'),
        e('db', 'bk', 'flow', { label: 'copia diaria' }),
        e('socios', 'lb', 'wireless', { label: '4G / Wi-Fi' })
      ]
    )
  );
}

const spec = (s: Partial<UseCaseSpec>): UseCaseSpec => ({ ...blankSpec(), ...s });

/** The use case diagram with a full specification for every use case. */
export function useCases(): GraphData {
  return centred('usecase', build(
    [
      n('sys', 'boundary', 180, 0, 'BiblioYa', { w: 560, h: 500 }),
      n('socio', 'actor', 70, 150, 'Socio'),
      n('bib', 'actor', 850, 260, 'Bibliotecario'),
      n('correo', 'actor', 70, 400, 'Servicio de correo'),
      n('buscar', 'usecase', 330, 100, 'Buscar libro', {
        spec: spec({
          code: 'CU-01',
          primaryActor: 'Socio',
          description: 'El socio busca libros del catálogo por título, autor o ISBN y ve si hay ejemplares disponibles.',
          preconditions: 'Ninguna (la búsqueda es pública).',
          trigger: 'El socio escribe en el buscador.',
          mainFlow: 'El socio escribe un título, autor o ISBN.\nEl sistema muestra los libros que coinciden, con el número de ejemplares disponibles.\nEl socio abre la ficha de un libro.\nEl sistema muestra sus ejemplares y su estado.',
          alternativeFlows: '2a. No hay resultados: el sistema lo indica y sugiere revisar la ortografía.',
          postconditions: 'Ninguna (no cambia datos).',
          priority: 'Alta',
          frequency: 'Cientos de veces al día'
        })
      }),
      n('reservar', 'usecase', 330, 230, 'Reservar libro', {
        spec: spec({
          code: 'CU-02',
          primaryActor: 'Socio',
          description: 'El socio reserva un libro que ahora está prestado para recogerlo cuando se devuelva.',
          preconditions: 'El socio ha iniciado sesión y no tiene sanciones.',
          trigger: 'El socio pulsa «Reservar» en la ficha de un libro.',
          mainFlow: 'El socio busca el libro (CU-01).\nEl sistema muestra la ficha con sus ejemplares.\nEl socio pulsa «Reservar».\nEl sistema registra la reserva y muestra la posición en la cola.',
          alternativeFlows: '3a. Hay un ejemplar disponible: el sistema ofrece reservarlo para recoger hoy.\n4a. El socio ya tiene 3 reservas: el sistema lo impide y lo avisa.',
          postconditions: 'La reserva queda registrada y el socio recibirá un aviso al devolverse el libro.',
          priority: 'Media',
          frequency: 'Unas 20 veces al día'
        })
      }),
      n('prestar', 'usecase', 600, 100, 'Prestar libro', {
        spec: spec({
          code: 'CU-03',
          primaryActor: 'Bibliotecario',
          secondaryActors: 'Socio',
          description: 'El bibliotecario presta un ejemplar a un socio en el mostrador.',
          preconditions: 'El bibliotecario ha iniciado sesión.',
          trigger: 'Un socio entrega un libro en el mostrador para llevárselo.',
          mainFlow: 'El bibliotecario identifica al socio (CU-04).\nEl bibliotecario lee el código del ejemplar.\nEl sistema comprueba que el socio puede pedir y el ejemplar está disponible.\nEl sistema registra el préstamo con fecha de devolución a 15 días.\nEl sistema imprime o envía el comprobante.',
          alternativeFlows: '3a. El socio tiene una sanción o ya tiene 5 préstamos: el sistema lo impide y muestra el motivo.\n3b. El ejemplar está reservado por otro socio: el sistema lo indica y no lo presta.',
          postconditions: 'El ejemplar queda prestado al socio con su fecha de devolución.',
          priority: 'Alta',
          frequency: 'Unas 150 veces al día'
        })
      }),
      n('devolver', 'usecase', 600, 400, 'Devolver libro', {
        spec: spec({
          code: 'CU-05',
          primaryActor: 'Bibliotecario',
          secondaryActors: 'Socio',
          description: 'El bibliotecario registra la devolución de un ejemplar y, si hay reservas, avisa al siguiente socio.',
          preconditions: 'El ejemplar está prestado.',
          trigger: 'Un socio devuelve un libro en el mostrador.',
          mainFlow: 'El bibliotecario lee el código del ejemplar.\nEl sistema cierra el préstamo con la fecha de hoy.\nEl sistema comprueba si hay retraso.\nEl sistema marca el ejemplar como disponible.',
          alternativeFlows: '3a. Hay retraso: el sistema calcula la sanción (1 día sin préstamo por día de retraso) y la muestra.\n4a. Hay una reserva: el sistema lo marca como reservado y avisa al socio (CU-06).',
          postconditions: 'El préstamo queda cerrado y el ejemplar disponible o reservado.',
          priority: 'Alta',
          frequency: 'Unas 150 veces al día'
        })
      }),
      n('identificar', 'usecase', 600, 250, 'Identificar socio', {
        spec: spec({
          code: 'CU-04',
          primaryActor: 'Bibliotecario',
          description: 'El sistema reconoce al socio por su carné para operar en su nombre.',
          preconditions: 'El socio tiene carné en vigor.',
          trigger: 'El bibliotecario pasa el carné por el lector.',
          mainFlow: 'El bibliotecario pasa el carné por el lector.\nEl sistema muestra los datos del socio, sus préstamos y sus sanciones.',
          alternativeFlows: '1a. El carné no se lee: el bibliotecario escribe el número de socio.\n2a. El carné está caducado: el sistema lo indica.',
          postconditions: 'El socio queda identificado en el mostrador.',
          priority: 'Alta',
          frequency: 'Cada préstamo y devolución'
        })
      }),
      n('notificar', 'usecase', 330, 400, 'Notificar disponibilidad', {
        spec: spec({
          code: 'CU-06',
          primaryActor: 'Servicio de correo',
          description: 'El sistema avisa al socio de que el libro que reservó ya está disponible.',
          preconditions: 'Hay una reserva y el libro se acaba de devolver.',
          trigger: 'Se devuelve un ejemplar con reservas (CU-05).',
          mainFlow: 'El sistema toma la reserva más antigua.\nEl sistema envía un correo al socio con el plazo para recogerlo (3 días).',
          alternativeFlows: '2a. El correo falla: el sistema lo reintenta en una hora y lo anota.',
          postconditions: 'El socio está avisado y el ejemplar apartado para él.',
          priority: 'Media',
          frequency: 'Unas 20 veces al día'
        })
      })
    ],
    [
      e('socio', 'buscar', 'association'),
      e('socio', 'reservar', 'association'),
      e('bib', 'prestar', 'association'),
      e('bib', 'devolver', 'association'),
      e('prestar', 'identificar', 'include'),
      e('devolver', 'identificar', 'include'),
      e('reservar', 'buscar', 'include'),
      e('notificar', 'devolver', 'extend'),
      e('notificar', 'correo', 'association')
    ],
    'straight'
  ));
}

/** Faro's own development model: short iterations with a client demo, and a formal spec kept up to date. */
export function ownModel(): GraphData {
  const X = 330;
  const row = (i: number) => 40 + i * 100;
  return centred(
    'flowchart',
    build(
      [
        n('ini', 'terminator', X, row(0), 'Encargo del cliente'),
        n('vis', 'process', X, row(1), 'Visión y alcance (1 semana)'),
        n('bk', 'document', X, row(2), 'Backlog de épicas'),
        n('plan', 'process', X, row(3), 'Planificar iteración (3 semanas)'),
        n('esp', 'process', X, row(4), 'Especificar historias + Gherkin'),
        n('dev', 'process', X, row(5), 'Diseñar, construir y probar'),
        n('demo', 'process', X, row(6), 'Demo al cliente'),
        n('ok', 'decision', X, row(7) + 10, '¿Listo para producción?'),
        n('ent', 'process', X, row(8) + 30, 'Entrega y formación'),
        n('fin', 'terminator', X, row(9) + 30, 'Mantenimiento'),
        n('spec', 'store', 70, row(4), 'Especificación formal\n(historias + Gherkin)')
      ],
      [
        e('ini', 'vis', 'flow'),
        e('vis', 'bk', 'flow'),
        e('bk', 'plan', 'flow'),
        e('plan', 'esp', 'flow'),
        e('esp', 'dev', 'flow'),
        e('dev', 'demo', 'flow'),
        e('demo', 'ok', 'flow'),
        e('ok', 'ent', 'flow', { label: 'sí' }),
        e('ok', 'plan', 'feedback', { label: 'no' }),
        e('ent', 'fin', 'flow'),
        e('esp', 'spec', 'flow', { label: 'actualiza' })
      ]
    )
  );
}
