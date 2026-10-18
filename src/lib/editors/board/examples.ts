/**
 * Small worked examples for each board kind (a library loans system).
 * Pure data: the node tests import it.
 */
import { uid } from '../../model/diagram';
import type { BoardData, BoardKind, Sticky } from '../../model/types';

const s = (text: string, color?: string): Sticky => ({ id: uid(), text, ...(color ? { color } : {}) });
const many = (...texts: string[]) => texts.map((t) => s(t));

export function boardExample(kind: BoardKind): BoardData {
  switch (kind) {
    case 'empathy':
      return {
        subject: 'Lucía, 21, estudiante de Biología',
        sections: {
          think: many('Necesita los libros de la bibliografía antes del examen', 'Le agobia no encontrar ejemplares libres', 'Le gustaría estudiar en grupo en la biblioteca'),
          see: many('Compañeros que fotocopian capítulos', 'Colas en el mostrador en época de exámenes', 'Apps de otras universidades con reserva online'),
          hear: many('«El manual de Genética siempre está prestado»', 'El profesor recomienda la edición nueva'),
          say: many('Dice que prefiere el papel, pero lee PDFs en el móvil', 'Va a la biblioteca solo para recoger y devolver'),
          pains: many('No sabe si hay ejemplares sin ir en persona', 'Multas por devolver tarde sin aviso', 'Horario que choca con sus clases'),
          gains: many('Reservar desde el móvil', 'Aviso antes de que venza el préstamo', 'Saber cuándo quedará libre un libro')
        }
      };
    case 'canvas':
      return {
        subject: 'BiblioYa — préstamos de biblioteca desde el móvil',
        sections: {
          partners: many('Bibliotecas universitarias', 'Proveedor del catálogo (OPAC)', 'Editoriales'),
          activities: many('Desarrollo y mantenimiento de la app', 'Integración con catálogos', 'Soporte a bibliotecarios'),
          resources: many('Equipo de desarrollo', 'Servidores en la nube', 'Acuerdos con bibliotecas'),
          value: many('Reservar y renovar préstamos en segundos', 'Avisos antes del vencimiento', 'Menos colas en el mostrador'),
          relationships: many('Autoservicio', 'Soporte por chat para bibliotecas'),
          channels: many('App móvil', 'Web de la biblioteca', 'Campañas en la semana de bienvenida'),
          segments: many('Estudiantes universitarios', 'Personal de biblioteca', 'Profesores'),
          costs: many('Salarios del equipo', 'Infraestructura cloud', 'Marketing'),
          revenue: many('Licencia anual por biblioteca', 'Módulo de estadísticas de pago')
        }
      };
    case 'context':
      return {
        subject: 'Préstamo de libros en la biblioteca de la universidad',
        sections: {
          trends: many('Lectura en el móvil', 'Libros electrónicos con préstamo digital', 'Autoservicio (RFID)'),
          tech: many('Catálogo existente sin API moderna', 'Lectores RFID en las puertas'),
          politics: many('RGPD: datos de lectura son personales', 'Normativa de préstamo de la universidad'),
          economy: many('Presupuesto limitado de la biblioteca', 'Coste de licencias de ebooks'),
          stakeholders: many('Estudiantes', 'Bibliotecarios', 'Profesores', 'Servicio de informática'),
          competition: many('Préstamo interbibliotecario', 'PDFs compartidos entre alumnos', 'Apps comerciales de lectura'),
          uncertainty: many('¿Usarán los alumnos la app?', '¿Se puede integrar con el catálogo actual?'),
          strengths: many('Biblioteca muy usada en exámenes', 'Equipo de informática propio')
        }
      };
    case 'persona':
      return {
        subject: 'Lucía Martín, 21, estudiante',
        sections: {
          quote: [s('«Si tengo que ir hasta la biblioteca para ver que el libro no está, ya he perdido la tarde.»')],
          profile: many('3.º de Biología', 'Vive en un piso compartido a 40 min del campus', 'Trabaja los fines de semana'),
          goals: many('Aprobar Genética a la primera', 'Organizar bien su tiempo de estudio'),
          frustrations: many('Libros siempre prestados', 'Multas por olvidos', 'Horarios rígidos'),
          motivations: many('Ahorrar tiempo y dinero', 'Estudiar con sus amigas'),
          channels: many('Móvil Android', 'Instagram y WhatsApp', 'Aula virtual de la universidad'),
          day: many('Clases por la mañana, prácticas por la tarde; estudia de noche y querría reservar el libro desde el autobús')
        }
      };
    case 'brainstorm':
      return {
        subject: '¿Cómo podríamos reducir las colas del mostrador en exámenes?',
        sections: {
          ideas: many('Taquillas de recogida 24 h', 'Préstamo de un día para libros muy pedidos', 'Lista de espera con aviso', 'Robot que trae los libros'),
          priority: many('Reserva desde la app', 'Renovación automática si nadie lo espera'),
          strategic: many('Autopréstamo con RFID'),
          complementary: many('Pantalla con ocupación del mostrador'),
          discard: many('Abrir solo con cita previa')
        }
      };
    case 'crazy8':
      return {
        subject: 'Pantalla de inicio de la app de la biblioteca',
        sections: {
          p1: many('Buscador grande y nada más'),
          p2: many('Mis préstamos con cuenta atrás'),
          p3: many('Mapa de la biblioteca con huecos libres'),
          p4: many('Recomendaciones por asignatura'),
          p5: many('Escáner del código de barras'),
          p6: many('Avisos del día'),
          p7: many('Modo oscuro para estudiar de noche'),
          p8: many('Chat con el bibliotecario')
        }
      };
    case 'sixhats':
      return {
        subject: 'Cobrar multas por retraso a través de la app',
        sections: {
          green: many('Cambiar multas por horas de voluntariado', 'Bono de puntos por devolver antes'),
          yellow: many('Menos retrasos', 'Pago sin colas'),
          black: many('Rechazo de los alumnos', 'Pasarela de pago cuesta dinero'),
          white: many('Hoy un 18 % de préstamos se devuelven tarde', 'Falta saber cuántos alumnos usan el móvil para pagar'),
          red: many('Parece recaudatorio', 'A mí me daría rabia'),
          blue: many('Primero recordatorios; multas solo si no bajan los retrasos')
        }
      };
  }
}
