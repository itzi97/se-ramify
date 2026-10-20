/**
 * Example TCO: BiblioYa (the library loans system of the other examples),
 * built by the invented company Faro Software. Prices are plausible 2026
 * figures for illustration only — every source says so.
 */
import { uid } from '../../model/diagram';
import type { TcoBlock, TcoData, TcoLine } from '../../model/types';
import { scoreKey } from './model';

const EX = 'ejemplo — sustituir por precio real';

function line(name: string, block: TcoBlock, nature: TcoLine['nature'], when: TcoLine['when'], unitCost: number, qty: number, year = 1, source = EX): TcoLine {
  return { id: uid(), name, block, nature, when, unitCost, qty, year, source };
}

export function tcoExample(): TcoData {
  const local = {
    id: uid(),
    name: 'Local (on-premises)',
    description:
      'Dos servidores en la sala técnica de la biblioteca central: uno principal y otro de réplica en espera (la base de datos se replica en tiempo real). SAI para cortes de luz, NAS con copias diarias y una copia semanal fuera del edificio. Un cortafuegos y un switch gestionable conectan con los puestos de las cinco bibliotecas.',
    color: '#4a7fc1',
    lines: [
      line('Análisis, desarrollo y pruebas (horas del equipo, 35 €/h)', 'dev', 'capex', 'once', 35, 1200, 1, 'ejemplo — horas estimadas × coste/hora'),
      line('Instalación, configuración y migración de datos', 'dev', 'capex', 'once', 3200, 1),
      line('Formación del personal de las bibliotecas', 'dev', 'capex', 'once', 1200, 1),
      line('Servidor Dell PowerEdge T150 (Xeon E-2314, 32 GB, 2× SSD 960 GB)', 'hwsw', 'capex', 'once', 1650, 2),
      line('SAI APC Smart-UPS 1500 VA', 'hwsw', 'capex', 'once', 780, 1),
      line('NAS Synology DS923+', 'hwsw', 'capex', 'once', 620, 1),
      line('Discos para el NAS (4 TB)', 'hwsw', 'capex', 'once', 120, 4),
      line('Switch gestionable 24 puertos', 'hwsw', 'capex', 'once', 280, 1),
      line('Cortafuegos FortiGate 40F', 'hwsw', 'capex', 'once', 650, 1),
      line('Armario rack 12U', 'hwsw', 'capex', 'once', 350, 1),
      line('Windows Server 2025 Standard (16 núcleos)', 'hwsw', 'capex', 'once', 1150, 2),
      line('Ampliación de garantía del fabricante', 'hwsw', 'opex', 'yearly', 190, 2, 2),
      line('Administrador de sistemas (20 % de 38.000 €/año)', 'ops', 'opex', 'yearly', 7600, 1, 1, 'ejemplo — tabla salarial'),
      line('Copia externa en la nube (2 TB)', 'ops', 'opex', 'monthly', 25, 1),
      line('Mantenimiento correctivo y parches (40 h/año)', 'ops', 'opex', 'yearly', 1400, 1),
      line('Reemplazo de discos del NAS', 'long', 'capex', 'once', 120, 4, 3)
    ]
  };
  const cloud = {
    id: uid(),
    name: 'Nube (AWS, región España)',
    description:
      'La aplicación corre en dos máquinas virtuales en dos zonas de disponibilidad detrás de un balanceador; la base de datos es PostgreSQL gestionado con réplica en otra zona. Copias automáticas diarias. Las bibliotecas se conectan por Internet (HTTPS) y la sede, además, por VPN.',
    color: '#e8873a',
    lines: [
      line('Análisis, desarrollo y pruebas (horas del equipo, 35 €/h)', 'dev', 'capex', 'once', 35, 1200, 1, 'ejemplo — horas estimadas × coste/hora'),
      line('Migración de datos y puesta en marcha en la nube', 'dev', 'capex', 'once', 2400, 1),
      line('Formación del personal de las bibliotecas', 'dev', 'capex', 'once', 1200, 1),
      line('Máquinas virtuales EC2 t3.medium (una por zona)', 'hwsw', 'opex', 'monthly', 35, 2, 1, 'ejemplo — calculadora de AWS'),
      line('Base de datos RDS PostgreSQL db.t3.medium multi-AZ', 'hwsw', 'opex', 'monthly', 140, 1, 1, 'ejemplo — calculadora de AWS'),
      line('Balanceador de carga (ALB)', 'hwsw', 'opex', 'monthly', 22, 1, 1, 'ejemplo — calculadora de AWS'),
      line('Almacenamiento de copias (S3, 300 GB)', 'hwsw', 'opex', 'monthly', 8, 1, 1, 'ejemplo — calculadora de AWS'),
      line('Tráfico de salida', 'hwsw', 'opex', 'monthly', 5, 1, 1, 'ejemplo — calculadora de AWS'),
      line('VPN sitio a sitio con la biblioteca central', 'hwsw', 'opex', 'monthly', 36, 1, 1, 'ejemplo — calculadora de AWS'),
      line('Plan de soporte Business', 'ops', 'opex', 'monthly', 100, 1, 1, 'ejemplo — web del proveedor'),
      line('Administrador cloud (10 % de 40.000 €/año)', 'ops', 'opex', 'yearly', 4000, 1, 1, 'ejemplo — tabla salarial'),
      line('Monitorización y alertas', 'ops', 'opex', 'monthly', 10, 1, 1, 'ejemplo — calculadora de AWS'),
      line('Crecimiento de uso (más socios y préstamos)', 'long', 'opex', 'yearly', 300, 1, 2),
      line('Plan de salida: exportar datos si se cambia de proveedor', 'long', 'capex', 'once', 800, 1, 3)
    ]
  };
  const crit = (name: string, weight: number) => ({ id: uid(), name, weight });
  const criteria = [crit('Disponibilidad (9–18 h, L–V)', 3), crit('Redundancia', 3), crit('Riesgo operativo', 2), crit('Escalabilidad', 1), crit('Dependencia del proveedor', 1)];
  const scores: Record<string, number> = {};
  const given: [number, number][] = [
    [3, 5],
    [3, 5],
    [2, 4],
    [2, 5],
    [5, 2]
  ];
  criteria.forEach((c, i) => {
    scores[scoreKey(c.id, local.id)] = given[i][0];
    scores[scoreKey(c.id, cloud.id)] = given[i][1];
  });
  return {
    years: 3,
    users: 30,
    alternatives: [local, cloud],
    criteria,
    scores,
    recommendation:
      'Recomendamos la alternativa en la nube. A tres años sale unos 11.000 € más barata, sobre todo porque no hay que comprar servidores ni dedicar tanto tiempo de administración, y cumple mejor los requisitos de la biblioteca: si cae una máquina o una zona, la otra sigue atendiendo, y el proveedor garantiza la disponibilidad en horario de apertura sin depender de una sala técnica que se calienta. Su punto débil es la dependencia del proveedor; por eso incluimos un plan de salida (exportar los datos en formato abierto) y usamos PostgreSQL, que se puede llevar a otro proveedor o a local. Si la biblioteca no tuviera buena conexión a Internet, la alternativa local volvería a ser razonable.'
  };
}
