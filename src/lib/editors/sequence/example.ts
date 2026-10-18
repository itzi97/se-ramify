import { uid } from '../../model/diagram';
import type { SequenceData } from '../../model/types';

/** Prestar un libro: the classic library loan, with an alt for "disponible / no disponible". */
export function sequenceExample(): SequenceData {
  const socio = uid();
  const pantalla = uid();
  const control = uid();
  const catalogo = uid();
  const prestamo = uid();
  const bd = uid();
  return {
    activations: true,
    autonumber: true,
    participants: [
      { id: socio, name: 'Socio', kind: 'actor' },
      { id: pantalla, name: ':PantallaPréstamo', kind: 'boundary' },
      { id: control, name: ':ControlPréstamo', kind: 'control' },
      { id: catalogo, name: ':Catálogo', kind: 'entity' },
      { id: prestamo, name: ':Préstamo', kind: 'object' },
      { id: bd, name: 'BD', kind: 'database' }
    ],
    items: [
      { id: uid(), t: 'msg', from: socio, to: pantalla, text: 'prestar(isbn, nºsocio)', style: 'sync' },
      { id: uid(), t: 'msg', from: pantalla, to: control, text: 'solicitarPréstamo(isbn, nºsocio)', style: 'sync' },
      { id: uid(), t: 'msg', from: control, to: catalogo, text: 'disponible(isbn)', style: 'sync' },
      { id: uid(), t: 'msg', from: catalogo, to: bd, text: 'consultarEjemplares(isbn)', style: 'sync' },
      { id: uid(), t: 'msg', from: bd, to: catalogo, text: 'ejemplares', style: 'reply' },
      { id: uid(), t: 'msg', from: catalogo, to: control, text: 'ejemplar', style: 'reply' },
      { id: uid(), t: 'open', op: 'alt', guard: 'ejemplar disponible' },
      { id: uid(), t: 'msg', from: control, to: prestamo, text: 'new(ejemplar, socio)', style: 'create' },
      { id: uid(), t: 'msg', from: control, to: bd, text: 'guardar(préstamo)', style: 'async' },
      { id: uid(), t: 'msg', from: control, to: pantalla, text: 'préstamo OK, devolver antes del 15/11', style: 'reply' },
      { id: uid(), t: 'else', guard: 'no disponible' },
      { id: uid(), t: 'msg', from: control, to: control, text: 'calcularFechaReserva()', style: 'sync' },
      { id: uid(), t: 'msg', from: control, to: pantalla, text: 'no disponible, ¿reservar?', style: 'reply' },
      { id: uid(), t: 'close' },
      { id: uid(), t: 'msg', from: pantalla, to: socio, text: 'mostrarResultado()', style: 'reply' },
      { id: uid(), t: 'note', over: [socio, pantalla], text: 'Máximo 3 préstamos\na la vez por socio' }
    ]
  };
}
