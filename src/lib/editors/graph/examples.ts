/**
 * Small worked examples for every canvas kind, all about the same neutral
 * subject (a library loans system, one of the exercise themes in Tema 3),
 * so they can be compared side by side.
 */
import { blankSpec, uid } from '../../model/diagram';
import type { EdgeRouting, GEdge, GNode, GraphData, GraphKind } from '../../model/types';

type N = Omit<GNode, 'id'> & { key: string };
type E = Omit<GEdge, 'id' | 'from' | 'to'> & { from: string; to: string };

function build(nodes: N[], edges: E[], routing: EdgeRouting = 'orthogonal'): GraphData {
  const ids = new Map<string, string>();
  for (const n of nodes) ids.set(n.key, uid());
  return {
    routing,
    nodes: nodes.map(({ key, ...n }) => ({ ...n, id: ids.get(key)!, parent: n.parent ? ids.get(n.parent) : undefined })),
    edges: edges.map((e) => ({ ...e, id: uid(), from: ids.get(e.from)!, to: ids.get(e.to)! }))
  };
}

const n = (key: string, type: string, x: number, y: number, label: string, extra: Partial<GNode> = {}): N => ({ key, type, x, y, label, ...extra });
const e = (from: string, to: string, type: string, extra: Partial<GEdge> = {}): E => ({ from, to, type, ...extra });

export function graphExample(kind: GraphKind): GraphData {
  switch (kind) {
    case 'usecase':
      return build(
        [
          n('sys', 'boundary', 200, 0, 'Sistema de préstamos — Biblioteca', { w: 520, h: 470 }),
          n('socio', 'actor', 40, 100, 'Socio'),
          n('bib', 'actor', 820, 250, 'Bibliotecario'),
          n('aviso', 'actor', 820, 70, 'Servicio de correo'),
          n('buscar', 'usecase', 300, 60, 'Buscar libro'),
          n('reservar', 'usecase', 300, 170, 'Reservar libro', {
            spec: {
              ...blankSpec(),
              code: 'CU-02',
              primaryActor: 'Socio',
              description: 'El socio reserva un ejemplar que ahora está prestado para recogerlo cuando se devuelva.',
              preconditions: 'El socio ha iniciado sesión y no tiene sanciones.',
              trigger: 'El socio pulsa «Reservar» en la ficha de un libro.',
              mainFlow: 'El socio busca el libro.\nEl sistema muestra la ficha con sus ejemplares.\nEl socio pulsa «Reservar».\nEl sistema registra la reserva y muestra la posición en la cola.',
              alternativeFlows: '3a. Hay un ejemplar disponible: el sistema ofrece prestarlo directamente.\n4a. El socio ya tiene 3 reservas: el sistema lo impide y avisa.',
              postconditions: 'La reserva queda registrada y el socio recibirá un aviso al devolverse el libro.',
              priority: 'Media',
              frequency: 'Unas 20 veces al día'
            }
          }),
          n('prestar', 'usecase', 300, 270, 'Prestar libro', { spec: { ...blankSpec(), code: 'CU-03', primaryActor: 'Bibliotecario', secondaryActors: 'Socio' } }),
          n('identificar', 'usecase', 300, 380, 'Identificar socio'),
          n('notificar', 'usecase', 460, 60, 'Notificar disponibilidad')
        ],
        [
          e('socio', 'buscar', 'association'),
          e('socio', 'reservar', 'association'),
          e('bib', 'prestar', 'association'),
          e('prestar', 'identificar', 'include'),
          e('reservar', 'buscar', 'include'),
          e('notificar', 'reservar', 'extend'),
          e('notificar', 'aviso', 'association')
        ],
        'straight'
      );
    case 'class':
      return build(
        [
          n('socio', 'class', 0, 0, 'Socio', { attrs: ['- numSocio: int', '- nombre: String', '- email: String'], ops: ['+ puedePedir(): boolean'] }),
          n('prestamo', 'class', 320, 0, 'Prestamo', { attrs: ['- fechaInicio: Date', '- fechaFin: Date', '- devuelto: boolean'], ops: ['+ renovar(): void', '+ estaVencido(): boolean'] }),
          n('ejemplar', 'class', 640, 0, 'Ejemplar', { attrs: ['- codigo: String', '- estado: EstadoEjemplar'], ops: [] }),
          n('libro', 'class', 640, 220, 'Libro', { attrs: ['- isbn: String', '- titulo: String'], ops: [] }),
          n('estado', 'enum', 940, 20, 'EstadoEjemplar', { attrs: ['DISPONIBLE', 'PRESTADO', 'RESERVADO', 'BAJA'], ops: [] }),
          n('material', 'class', 320, 220, 'Material', { abstract: true, attrs: ['# titulo: String'], ops: ['+ duracionPrestamo(): int {abstract}'] }),
          n('revista', 'class', 320, 420, 'Revista', { attrs: ['- numero: int'], ops: ['+ duracionPrestamo(): int'] }),
          n('notif', 'interface', 0, 220, 'Notificable', { attrs: [], ops: ['+ notificar(msg: String): void'] })
        ],
        [
          e('socio', 'prestamo', 'association', { fromLabel: '1', toLabel: '0..3', label: 'realiza' }),
          e('prestamo', 'ejemplar', 'association', { fromLabel: '0..*', toLabel: '1' }),
          e('libro', 'ejemplar', 'composition', { fromLabel: '1', toLabel: '1..*' }),
          e('ejemplar', 'estado', 'dependency'),
          e('libro', 'material', 'generalization'),
          e('revista', 'material', 'generalization'),
          e('socio', 'notif', 'realization')
        ]
      );
    case 'activity':
      return build(
        [
          n('l1', 'partition', 0, 0, 'Socio', { w: 240, h: 560 }),
          n('l2', 'partition', 240, 0, 'Sistema', { w: 260, h: 560 }),
          n('ini', 'initial', 109, 60, ''),
          n('a1', 'action', 60, 120, 'Buscar libro'),
          n('a2', 'action', 300, 120, 'Comprobar disponibilidad'),
          n('d', 'decision', 352, 210, ''),
          n('a3', 'action', 300, 300, 'Registrar préstamo'),
          n('a4', 'action', 60, 300, 'Reservar libro'),
          n('m', 'decision', 352, 390, ''),
          n('a5', 'action', 300, 450, 'Enviar confirmación'),
          n('fin', 'final', 107, 500, '')
        ],
        [
          e('ini', 'a1', 'flow'),
          e('a1', 'a2', 'flow'),
          e('a2', 'd', 'flow'),
          e('d', 'a3', 'flow', { label: '[disponible]' }),
          e('d', 'a4', 'flow', { label: '[prestado]' }),
          e('a3', 'm', 'flow'),
          e('a4', 'm', 'flow'),
          e('m', 'a5', 'flow'),
          e('a5', 'fin', 'flow')
        ]
      );
    case 'state':
      return build(
        [
          n('ini', 'initial', 20, 92, ''),
          n('disp', 'state', 100, 70, 'Disponible'),
          n('pres', 'state', 440, 70, 'Prestado', { attrs: ['entry / fijar fecha de devolución', 'do / contar días'] }),
          n('venc', 'state', 100, 300, 'Vencido', { attrs: ['entry / avisar al socio'] }),
          n('res', 'state', 760, 300, 'Reservado'),
          n('baja', 'final', 860, 92, '')
        ],
        [
          e('ini', 'disp', 'transition'),
          e('disp', 'pres', 'transition', { label: 'prestar' }),
          e('pres', 'disp', 'transition', { label: 'devolver [sin reservas]' }),
          e('pres', 'venc', 'transition', { label: 'fin de plazo' }),
          e('venc', 'disp', 'transition', { label: 'devolver / multar' }),
          e('pres', 'res', 'transition', { label: 'devolver [con reserva]' }),
          e('res', 'pres', 'transition', { label: 'recoger' }),
          e('pres', 'baja', 'transition', { label: 'dar de baja' })
        ],
        'straight'
      );
    case 'communication':
      return build(
        [
          n('bib', 'actor', 0, 220, 'Bibliotecario'),
          n('ui', 'object', 200, 130, ':PantallaPrestamo'),
          n('ctl', 'object', 470, 130, ':ControlPrestamo'),
          n('soc', 'object', 470, 330, 's:Socio'),
          n('ej', 'object', 740, 130, 'e:Ejemplar')
        ],
        [
          e('bib', 'ui', 'link', { messages: [{ seq: '1', text: 'prestar(numSocio, codigo)', dir: 'forward' }] }),
          e('ui', 'ctl', 'link', { messages: [{ seq: '1.1', text: 'prestar(numSocio, codigo)', dir: 'forward' }] }),
          e('ctl', 'soc', 'link', { messages: [{ seq: '1.2', text: 'puedePedir()', dir: 'forward' }] }),
          e('ctl', 'ej', 'link', { messages: [{ seq: '1.3', text: 'marcarPrestado()', dir: 'forward' }] })
        ],
        'straight'
      );
    case 'deployment':
      return build(
        [
          n('pc', 'device', 0, 40, 'PC del mostrador', { w: 240, h: 150 }),
          n('nav', 'artifact', 30, 100, 'Navegador web'),
          n('srv', 'node', 340, 0, 'Servidor de aplicaciones', { w: 320, h: 250 }),
          n('jvm', 'execEnv', 360, 60, 'Tomcat', { w: 280, h: 170 }),
          n('war', 'artifact', 390, 120, 'biblioteca.war'),
          n('dbs', 'node', 760, 30, 'Servidor de BD', { w: 230, h: 190 }),
          n('db', 'database', 820, 100, 'PostgreSQL')
        ],
        [e('pc', 'srv', 'path', { label: 'HTTPS' }), e('srv', 'dbs', 'path', { label: 'JDBC / TCP 5432' })]
      );
    case 'architecture':
      return build(
        [
          n('local', 'zone', 0, 0, 'Biblioteca (local)', { w: 520, h: 330, color: '#4a7fc1' }),
          n('pc1', 'device', 30, 60, 'PC mostrador ×2', { icon: 'Monitor' }),
          n('lap', 'device', 30, 200, 'Portátil gestión', { icon: 'Laptop' }),
          n('lector', 'device', 160, 200, 'Lector de carnés', { icon: 'ScanBarcode' }),
          n('sw', 'device', 210, 60, 'Switch', { icon: 'Network' }),
          n('fw', 'device', 380, 60, 'Router + firewall', { icon: 'Shield' }),
          n('nas', 'device', 380, 200, 'NAS (copias)', { icon: 'HardDrive' }),
          n('cloud', 'zone', 640, 0, 'Nube', { w: 300, h: 330, color: '#58a55c' }),
          n('app', 'device', 680, 60, 'App web (PaaS)', { icon: 'Cloud' }),
          n('bd', 'device', 830, 60, 'BD gestionada', { icon: 'Database' }),
          n('mail', 'device', 830, 200, 'Servicio de correo', { icon: 'Mail' }),
          n('socios', 'device', 680, 420, 'Socios (móvil)', { icon: 'Smartphone' })
        ],
        [
          e('pc1', 'sw', 'wired'),
          e('lap', 'sw', 'wireless'),
          e('lector', 'pc1', 'wired', { label: 'USB' }),
          e('sw', 'fw', 'wired'),
          e('nas', 'sw', 'wired'),
          e('fw', 'app', 'wireless', { label: 'Internet (HTTPS)' }),
          e('app', 'bd', 'wired'),
          e('app', 'mail', 'flow'),
          e('socios', 'app', 'wireless', { label: '4G / Wi-Fi' })
        ]
      );
    case 'flowchart':
      return build(
        [
          n('ini', 'terminator', 40, 0, 'Inicio'),
          n('req', 'process', 30, 80, 'Requisitos'),
          n('dis', 'process', 30, 160, 'Diseño'),
          n('imp', 'process', 30, 240, 'Implementación'),
          n('pru', 'process', 30, 320, 'Pruebas'),
          n('ok', 'decision', 25, 400, '¿Cumple?'),
          n('des', 'process', 30, 510, 'Despliegue'),
          n('fin', 'terminator', 40, 590, 'Fin')
        ],
        [
          e('ini', 'req', 'flow'),
          e('req', 'dis', 'flow'),
          e('dis', 'imp', 'flow'),
          e('imp', 'pru', 'flow'),
          e('pru', 'ok', 'flow'),
          e('ok', 'des', 'flow', { label: 'sí' }),
          e('ok', 'imp', 'feedback', { label: 'no' }),
          e('des', 'fin', 'flow')
        ]
      );
    case 'er':
      return build(
        [
          n('socio', 'entity', 0, 140, 'SOCIO'),
          n('presta', 'relationship', 220, 130, 'PIDE'),
          n('ej', 'entity', 470, 140, 'EJEMPLAR'),
          n('de', 'relationship', 690, 130, 'DE'),
          n('libro', 'entity', 920, 140, 'LIBRO'),
          n('num', 'key', 0, 0, 'numSocio'),
          n('nom', 'attribute', 0, 280, 'nombre'),
          n('tel', 'multivalued', 120, 280, 'telefonos'),
          n('fecha', 'attribute', 230, 280, 'fecha'),
          n('cod', 'key', 470, 0, 'codigo'),
          n('isbn', 'key', 920, 0, 'isbn'),
          n('tit', 'attribute', 920, 280, 'titulo')
        ],
        [
          e('socio', 'presta', 'line', { toLabel: 'N', fromLabel: '' }),
          e('presta', 'ej', 'line', { toLabel: 'M' }),
          e('ej', 'de', 'total', { fromLabel: 'N' }),
          e('de', 'libro', 'line', { toLabel: '1' }),
          e('num', 'socio', 'line'),
          e('nom', 'socio', 'line'),
          e('tel', 'socio', 'line'),
          e('fecha', 'presta', 'line'),
          e('cod', 'ej', 'line'),
          e('isbn', 'libro', 'line'),
          e('tit', 'libro', 'line')
        ],
        'straight'
      );
    case 'dfd':
      return build(
        [
          n('socio', 'external', 0, 120, 'Socio'),
          n('p1', 'process', 260, 20, '1 Validar socio'),
          n('p2', 'process', 260, 220, '2 Registrar préstamo'),
          n('d1', 'store', 560, 40, 'D1 Socios'),
          n('d2', 'store', 560, 240, 'D2 Préstamos'),
          n('bib', 'external', 0, 320, 'Bibliotecario')
        ],
        [
          e('socio', 'p1', 'flow', { label: 'carné' }),
          e('p1', 'd1', 'both', { label: 'datos socio' }),
          e('p1', 'p2', 'flow', { label: 'socio válido' }),
          e('bib', 'p2', 'flow', { label: 'código ejemplar' }),
          e('p2', 'd2', 'flow', { label: 'préstamo' }),
          e('p2', 'socio', 'flow', { label: 'comprobante' })
        ],
        'straight'
      );
    case 'screenflow':
      return build(
        [
          n('login', 'screen', 0, 60, 'Acceso socios\nNº socio: ___\nContraseña: ___\n[Entrar]', { w: 210, h: 160 }),
          n('err', 'dialog', 0, 290, 'Aviso\nDebe rellenar el nº de socio\n[Aceptar]', { w: 210, h: 120 }),
          n('home', 'screen', 320, 0, 'Catálogo\nBuscar: ___\n# Resultados\nEl Quijote — disponible\nRayuela — prestado\n[Reservar]', { w: 230, h: 210 }),
          n('ok', 'dialog', 640, 40, 'Reserva hecha\nPosición en la cola: 2\n[Aceptar]', { w: 200, h: 120 }),
          n('bloq', 'screen', 320, 300, 'Cuenta bloqueada\nVuelva a intentarlo en 5 min', { w: 230, h: 110 })
        ],
        [
          e('login', 'home', 'go', { label: 'credenciales válidas' }),
          e('login', 'err', 'error', { label: 'campos vacíos' }),
          e('login', 'bloq', 'error', { label: '3 intentos' }),
          e('home', 'ok', 'go', { label: 'Reservar' })
        ]
      );
    case 'traceability':
      return build(
        [
          n('r1', 'req', 0, 0, 'RQ1 Identificar socio'),
          n('r2', 'req', 0, 60, 'RQ2 Prestar libro'),
          n('c21', 'criterion', 28, 104, 'CA2.1 Máx. 3 préstamos'),
          n('c22', 'criterion', 28, 142, 'CA2.2 Sin sanciones'),
          n('r3', 'req', 0, 200, 'RQ3 Reservar libro'),
          n('ed1', 'design', 260, 0, 'ED1 Pantalla acceso'),
          n('ed2', 'design', 260, 90, 'ED2 Control préstamo'),
          n('ed3', 'design', 260, 200, 'ED3 Cola de reservas'),
          n('cs1', 'component', 500, 0, 'CS1 AuthService'),
          n('cs2', 'component', 500, 90, 'CS2 LoanService'),
          n('cs3', 'component', 500, 200, 'CS3 ReservationService'),
          n('t1', 'test', 760, 0, 'TC1'),
          n('t2', 'test', 760, 60, 'TC2'),
          n('t3', 'test', 760, 120, 'TC3'),
          n('t4', 'test', 760, 200, 'TC4')
        ],
        [
          e('r2', 'c21', 'refines'),
          e('r2', 'c22', 'refines'),
          e('r1', 'ed1', 'trace'),
          e('r2', 'ed2', 'trace'),
          e('r3', 'ed3', 'trace'),
          e('ed1', 'cs1', 'trace'),
          e('ed2', 'cs2', 'trace'),
          e('ed2', 'cs1', 'trace'),
          e('ed3', 'cs3', 'trace'),
          e('cs1', 't1', 'trace'),
          e('cs2', 't2', 'trace'),
          e('cs2', 't3', 'trace'),
          e('cs3', 't4', 'trace')
        ],
        'straight'
      );
    case 'mindmap': {
      const tree: [string, string[]][] = [
        ['Usuarios', ['Socios', 'Bibliotecarios', 'Visitantes']],
        ['Funciones', ['Buscar', 'Prestar', 'Reservar', 'Avisos']],
        ['Problemas hoy', ['Colas en el mostrador', 'Reservas en papel']],
        ['Restricciones', ['Presupuesto bajo', 'RGPD']],
        ['Ideas', ['App móvil', 'Carné digital']]
      ];
      const nodes: N[] = [n('root', 'central', 0, 0, 'App de préstamos de la biblioteca')];
      tree.forEach(([main, subs], i) => {
        nodes.push(n(`m${i}`, 'topic', 0, 0, main, { parent: 'root', order: i }));
        subs.forEach((s, j) => nodes.push(n(`m${i}s${j}`, 'topic', 0, 0, s, { parent: `m${i}`, order: j })));
      });
      return build(nodes, [e('m4s1', 'm0s0', 'crosslink')], 'straight');
    }
    case 'conceptmap':
      return build(
        [
          n('bib', 'concept', 300, 0, 'Biblioteca'),
          n('fondo', 'concept', 80, 140, 'Fondo'),
          n('socio', 'concept', 520, 140, 'Socio'),
          n('libro', 'concept', 0, 280, 'Libro'),
          n('revista', 'concept', 170, 280, 'Revista'),
          n('prestamo', 'concept', 420, 280, 'Préstamo'),
          n('plazo', 'concept', 420, 420, 'Plazo de 15 días'),
          n('carne', 'concept', 640, 280, 'Carné')
        ],
        [
          e('bib', 'fondo', 'relation', { label: 'tiene' }),
          e('bib', 'socio', 'relation', { label: 'atiende a' }),
          e('fondo', 'libro', 'relation', { label: 'incluye' }),
          e('fondo', 'revista', 'relation', { label: 'incluye' }),
          e('socio', 'prestamo', 'relation', { label: 'solicita' }),
          e('prestamo', 'plazo', 'relation', { label: 'dura' }),
          e('socio', 'carne', 'relation', { label: 'se identifica con' })
        ],
        'straight'
      );
  }
}
