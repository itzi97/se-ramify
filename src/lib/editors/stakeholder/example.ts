/** Example stakeholder map: a university library loans app. */
import { uid } from '../../model/diagram';
import type { Stakeholder, StakeholderData } from '../../model/types';

const s = (name: string, role: string, power: number, interest: number, ring: Stakeholder['ring'], sector: Stakeholder['sector'], attitude: Stakeholder['attitude'], notes = ''): Stakeholder => ({
  id: uid(),
  name,
  role,
  power,
  interest,
  ring,
  sector,
  attitude,
  notes
});

export function stakeholderExample(): StakeholderData {
  return {
    view: 'grid',
    product: 'App de préstamos',
    stakeholders: [
      s('Dirección de la biblioteca', 'Cliente: encarga y paga el proyecto', 0.9, 0.85, 0, 'decisores', 'supporter', 'Aprueba el alcance y el presupuesto.'),
      s('Vicerrectorado', 'Financia la biblioteca', 0.82, 0.3, 1, 'decisores', 'neutral', 'Solo interviene si cambia el presupuesto.'),
      s('Bibliotecarios', 'Usuarios internos diarios', 0.45, 0.9, 0, 'clientes', 'critic', 'Temen más trabajo durante la migración.'),
      s('Estudiantes', 'Usuarios finales', 0.3, 0.8, 1, 'clientes', 'supporter'),
      s('Profesores', 'Recomiendan bibliografía', 0.35, 0.55, 2, 'clientes', 'neutral'),
      s('Servicio de informática', 'Mantiene servidores y la red', 0.7, 0.6, 1, 'proveedores', 'neutral', 'Necesitamos su visto bueno para integrar el catálogo.'),
      s('Proveedor del catálogo', 'Licencia del software actual (OPAC)', 0.6, 0.25, 2, 'proveedores', 'critic', 'Puede cobrar por abrir su API.'),
      s('Delegado de protección de datos', 'RGPD', 0.75, 0.3, 2, 'influyentes', 'neutral'),
      s('Consejo de estudiantes', 'Representa a los alumnos', 0.25, 0.45, 3, 'influyentes', 'supporter'),
      s('Otras bibliotecas de la red', 'Préstamo interbibliotecario', 0.15, 0.2, 3, 'proveedores', 'neutral')
    ]
  };
}
