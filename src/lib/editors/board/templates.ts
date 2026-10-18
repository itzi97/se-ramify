/**
 * Sticky-note board templates: pure data, one per board kind. Each
 * template is a CSS grid (columns + named areas) with sections that hold
 * stickies, and "decor" cells that hold no stickies (the subject in the
 * centre, axis labels).
 */
import type { BoardKind } from '../../model/types';

export interface SectionDef {
  id: string;
  /** Spanish title, as in class. */
  title: string;
  /** The question the section answers. */
  hint: string;
  /** grid-area name. */
  area: string;
  /** Hex tint for the section background (mixed softly into the panel). */
  tint?: string;
  /** Lucide icon in the section header. */
  icon?: string;
  /** Six hats: the hat colour drawn in the header. */
  hat?: string;
  /** Crazy eight: the panel number (1–8), drives the timer highlight. */
  panel?: number;
}

export interface DecorDef {
  area: string;
  kind: 'subject' | 'axisX' | 'axisY';
  text?: string;
}

export interface BoardTemplate {
  kind: BoardKind;
  /** Label of the subject field ("Persona", "Reto"…). */
  subjectLabel: string;
  subjectPlaceholder: string;
  /** grid-template-columns. */
  columns: string;
  /** grid-template-areas, one string per row. */
  areas: string[];
  /** Minimum height of each row in px (same length as `areas`); 40 or less is a fixed-height row (axis labels). */
  rowMin: number[];
  minWidth: number;
  sections: SectionDef[];
  decor: DecorDef[];
  /** Which section a double-click outside any section, or the toolbar's "Add", puts a sticky in. */
  defaultSection: string;
}

const HAT = { green: '#58a55c', yellow: '#e2c044', black: '#16191d', white: '#ffffff', red: '#d9534f', blue: '#4a7fc1' };

export const TEMPLATES: Record<BoardKind, BoardTemplate> = {
  empathy: {
    kind: 'empathy',
    subjectLabel: 'Persona',
    subjectPlaceholder: '¿Para quién es este mapa?',
    columns: 'repeat(6, minmax(0, 1fr))',
    areas: ['think think think think think think', 'see see center center hear hear', 'say say say say say say', 'pain pain pain gain gain gain'],
    rowMin: [150, 190, 150, 150],
    minWidth: 880,
    sections: [
      { id: 'think', title: 'Piensa y siente', hint: '¿Qué le importa de verdad? ¿Qué le preocupa, a qué aspira?', area: 'think', icon: 'Brain' },
      { id: 'see', title: 'Ve', hint: '¿Qué ve en su entorno, sus amigos, el mercado?', area: 'see', icon: 'Eye' },
      { id: 'hear', title: 'Oye', hint: '¿Qué le dicen sus amigos, su jefe, los influyentes?', area: 'hear', icon: 'Ear' },
      { id: 'say', title: 'Dice y hace', hint: '¿Qué dice en público? ¿Cómo se comporta? ¿Hay discordancias?', area: 'say', icon: 'MessageCircle' },
      { id: 'pains', title: 'Esfuerzos (pains)', hint: 'Miedos, frustraciones, obstáculos.', area: 'pain', icon: 'Frown', tint: '#d9534f' },
      { id: 'gains', title: 'Resultados (gains)', hint: 'Deseos, necesidades, cómo mide el éxito.', area: 'gain', icon: 'Smile', tint: '#58a55c' }
    ],
    decor: [{ area: 'center', kind: 'subject' }],
    defaultSection: 'think'
  },

  canvas: {
    kind: 'canvas',
    subjectLabel: 'Negocio',
    subjectPlaceholder: 'Nombre de la empresa o del producto',
    columns: 'repeat(10, minmax(0, 1fr))',
    areas: ['kp kp ka ka vp vp cr cr cs cs', 'kp kp kr kr vp vp ch ch cs cs', 'cost cost cost cost cost rev rev rev rev rev'],
    rowMin: [210, 210, 170],
    minWidth: 880,
    sections: [
      { id: 'partners', title: 'Socios clave', hint: '¿Quiénes son nuestros socios y proveedores clave?', area: 'kp', icon: 'Handshake' },
      { id: 'activities', title: 'Actividades clave', hint: '¿Qué actividades requiere nuestra propuesta de valor?', area: 'ka', icon: 'Activity' },
      { id: 'resources', title: 'Recursos clave', hint: '¿Qué recursos requiere nuestra propuesta de valor?', area: 'kr', icon: 'Package' },
      { id: 'value', title: 'Propuesta de valor', hint: '¿Qué valor entregamos? ¿Qué problema resolvemos?', area: 'vp', icon: 'Gift', tint: '#4a7fc1' },
      { id: 'relationships', title: 'Relación con clientes', hint: '¿Qué relación espera cada segmento?', area: 'cr', icon: 'Heart' },
      { id: 'channels', title: 'Canales', hint: '¿Cómo llegamos a nuestros clientes?', area: 'ch', icon: 'Truck' },
      { id: 'segments', title: 'Segmentos de clientes', hint: '¿Para quién creamos valor?', area: 'cs', icon: 'Users' },
      { id: 'costs', title: 'Estructura de costes', hint: '¿Cuáles son los costes más importantes?', area: 'cost', icon: 'Receipt' },
      { id: 'revenue', title: 'Fuentes de ingresos', hint: '¿Por qué valor están dispuestos a pagar? ¿Cómo?', area: 'rev', icon: 'Coins' }
    ],
    decor: [],
    defaultSection: 'value'
  },

  context: {
    kind: 'context',
    subjectLabel: 'Reto',
    subjectPlaceholder: '¿Qué reto queremos resolver?',
    columns: 'repeat(4, minmax(0, 1fr))',
    areas: ['trends center center tech', 'politics center center economy', 'stakeholders competition uncertainty strengths'],
    rowMin: [160, 160, 230],
    minWidth: 880,
    sections: [
      { id: 'trends', title: 'Tendencias', hint: '¿Qué está cambiando en el entorno del reto?', area: 'trends', icon: 'TrendingUp' },
      { id: 'tech', title: 'Factores tecnológicos', hint: '¿Qué tecnología lo hace posible o lo condiciona?', area: 'tech', icon: 'Cpu' },
      { id: 'politics', title: 'Factores políticos / legales', hint: 'Normativa, protección de datos, administración.', area: 'politics', icon: 'Landmark' },
      { id: 'economy', title: 'Factores económicos', hint: 'Presupuesto, costes, modelo de ingresos.', area: 'economy', icon: 'Coins' },
      { id: 'stakeholders', title: 'Stakeholders', hint: '¿Quién influye o se ve afectado?', area: 'stakeholders', icon: 'Users', tint: '#4a7fc1' },
      { id: 'competition', title: 'Competencia', hint: '¿Qué soluciones existen ya? ¿Quién más lo resuelve?', area: 'competition', icon: 'Swords', tint: '#4a7fc1' },
      { id: 'uncertainty', title: 'Incertidumbre', hint: '¿Qué no sabemos todavía? ¿Qué riesgos hay?', area: 'uncertainty', icon: 'CircleHelp', tint: '#4a7fc1' },
      { id: 'strengths', title: 'Fortalezas', hint: '¿Con qué contamos? ¿En qué somos buenos?', area: 'strengths', icon: 'BicepsFlexed', tint: '#4a7fc1' }
    ],
    decor: [{ area: 'center', kind: 'subject' }],
    defaultSection: 'stakeholders'
  },

  persona: {
    kind: 'persona',
    subjectLabel: 'Persona',
    subjectPlaceholder: 'Nombre, edad, ocupación',
    columns: 'repeat(3, minmax(0, 1fr))',
    areas: ['head quote quote', 'profile goals frustrations', 'profile motivations channels', 'day day day'],
    rowMin: [130, 170, 170, 140],
    minWidth: 880,
    sections: [
      { id: 'quote', title: 'Cita', hint: 'Una frase suya que lo resuma todo.', area: 'quote', icon: 'Quote' },
      { id: 'profile', title: 'Perfil', hint: 'Edad, estudios, trabajo, dónde vive, con quién.', area: 'profile', icon: 'IdCard' },
      { id: 'goals', title: 'Objetivos', hint: '¿Qué quiere conseguir?', area: 'goals', icon: 'Target', tint: '#58a55c' },
      { id: 'frustrations', title: 'Frustraciones', hint: '¿Qué le impide conseguirlo? ¿Qué le molesta?', area: 'frustrations', icon: 'Frown', tint: '#d9534f' },
      { id: 'motivations', title: 'Motivaciones', hint: '¿Qué le mueve? ¿Qué le haría cambiar?', area: 'motivations', icon: 'Flame' },
      { id: 'channels', title: 'Canales / tecnología', hint: 'Dispositivos, apps, redes, cómo se informa.', area: 'channels', icon: 'Smartphone' },
      { id: 'day', title: 'Un día normal', hint: '¿Cómo es su día? ¿Cuándo aparece nuestra solución?', area: 'day', icon: 'Sun' }
    ],
    decor: [{ area: 'head', kind: 'subject' }],
    defaultSection: 'profile'
  },

  brainstorm: {
    kind: 'brainstorm',
    subjectLabel: 'Reto',
    subjectPlaceholder: '¿Cómo podríamos…?',
    columns: 'minmax(0, 1.3fr) 30px minmax(0, 1fr) minmax(0, 1fr)',
    areas: ['ideas ay strategic priority', 'ideas ay discard complementary', 'ideas . ax ax'],
    rowMin: [230, 230, 34],
    minWidth: 880,
    sections: [
      { id: 'ideas', title: 'Ideas', hint: 'Diverge: cantidad, sin juzgar, construye sobre las de los demás.', area: 'ideas', icon: 'Lightbulb' },
      { id: 'strategic', title: 'Estratégicas', hint: 'Mucho impacto, poco viables: proyectos a medio plazo.', area: 'strategic', tint: '#4a7fc1' },
      { id: 'priority', title: 'Prioritarias', hint: 'Mucho impacto y viables: por aquí empezamos.', area: 'priority', tint: '#58a55c' },
      { id: 'discard', title: 'Descartar', hint: 'Poco impacto y poco viables.', area: 'discard', tint: '#8d949c' },
      { id: 'complementary', title: 'Complementarias', hint: 'Poco impacto pero fáciles: si sobra tiempo.', area: 'complementary', tint: '#e2c044' }
    ],
    decor: [
      { area: 'ay', kind: 'axisY', text: 'Impacto' },
      { area: 'ax', kind: 'axisX', text: 'Viabilidad' }
    ],
    defaultSection: 'ideas'
  },

  crazy8: {
    kind: 'crazy8',
    subjectLabel: 'Reto',
    subjectPlaceholder: '¿Qué problema o funcionalidad estamos ideando?',
    columns: 'repeat(4, minmax(0, 1fr))',
    areas: ['p1 p2 p3 p4', 'p5 p6 p7 p8'],
    rowMin: [260, 260],
    minWidth: 880,
    sections: Array.from({ length: 8 }, (_, i) => ({
      id: `p${i + 1}`,
      title: `Idea ${i + 1}`,
      hint: 'Un minuto. Bocetos rápidos, no te limites.',
      area: `p${i + 1}`,
      panel: i + 1
    })),
    decor: [],
    defaultSection: 'p1'
  },

  sixhats: {
    kind: 'sixhats',
    subjectLabel: 'Tema',
    subjectPlaceholder: '¿Sobre qué estamos pensando?',
    columns: 'repeat(6, minmax(0, 1fr))',
    areas: ['green yellow black white red blue'],
    rowMin: [480],
    minWidth: 880,
    sections: [
      { id: 'green', title: 'Creatividad', hint: 'Sombrero verde: ¿qué alternativas nuevas hay? ¿Y si…?', area: 'green', hat: HAT.green, tint: HAT.green },
      { id: 'yellow', title: 'Positivismo', hint: 'Sombrero amarillo: ¿qué beneficios tiene? ¿Por qué funcionará?', area: 'yellow', hat: HAT.yellow, tint: HAT.yellow },
      { id: 'black', title: 'Negativismo', hint: 'Sombrero negro: ¿qué riesgos y problemas tiene? ¿Por qué puede fallar?', area: 'black', hat: HAT.black, tint: '#5c636b' },
      { id: 'white', title: 'Analítico', hint: 'Sombrero blanco: ¿qué datos tenemos? ¿Qué nos falta saber?', area: 'white', hat: HAT.white },
      { id: 'red', title: 'Emocional', hint: 'Sombrero rojo: ¿qué intuimos? ¿Qué sentimos, sin justificarlo?', area: 'red', hat: HAT.red, tint: HAT.red },
      { id: 'blue', title: 'Moderador', hint: 'Sombrero azul: ¿cómo organizamos el proceso? ¿Qué concluimos?', area: 'blue', hat: HAT.blue, tint: HAT.blue }
    ],
    decor: [],
    defaultSection: 'green'
  }
};

/** Words for the brainstorm's "Estímulo aleatorio". */
export const RANDOM_WORDS = [
  'puente', 'reloj', 'semilla', 'espejo', 'mapa', 'tormenta', 'llave', 'mercado', 'faro', 'abeja', 'tren', 'jardín',
  'brújula', 'receta', 'cometa', 'orquesta', 'nube', 'imán', 'linterna', 'raíz', 'escalera', 'carnaval', 'volcán',
  'biblioteca', 'bicicleta', 'paraguas', 'puzle', 'hormiga', 'telescopio', 'trueque', 'semáforo', 'cartero', 'eco',
  'marea', 'museo', 'mochila', 'disfraz', 'radio', 'colmena', 'cine', 'fábrica', 'isla', 'ajedrez', 'máscara', 'globo',
  'río', 'circo', 'diario', 'invernadero', 'telaraña', 'subasta', 'pasaporte', 'juguete', 'farmacia', 'cohete',
  'concierto', 'abuelo', 'vecindario', 'palanca', 'termómetro', 'lluvia', 'ancla', 'tienda', 'videojuego'
];

export function randomWord(previous?: string): string {
  let w = previous;
  while (w === previous) w = RANDOM_WORDS[Math.floor(Math.random() * RANDOM_WORDS.length)];
  return w!;
}

/** The area names used by a template's grid, for checking it. */
export function areaNames(t: BoardTemplate): Set<string> {
  return new Set(t.areas.flatMap((row) => row.split(/\s+/)).filter((a) => a !== '.'));
}
