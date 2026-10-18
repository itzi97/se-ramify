import type { VisionData } from '../../model/types';

export function visionExample(): VisionData {
  return {
    forWho: 'los socios de las bibliotecas municipales',
    who: 'quieren saber si un libro está disponible y llevárselo sin colas',
    product: 'BiblioYa',
    isA: 'servicio web y móvil de préstamos',
    that: 'permite buscar, reservar y renovar préstamos en dos clics',
    unlike: 'el catálogo en línea actual, que solo informa',
    ourProduct: 'avisa cuando el libro vuelve, gestiona la cola de reservas y recuerda las devoluciones'
  };
}
