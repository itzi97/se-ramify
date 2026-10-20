# language: es

Característica: Catálogo
  Para: Socio de la biblioteca (y el bibliotecario en el mostrador)

  # Buscar por título o autor
  # Como socio, quiero buscar un libro por título o autor, para saber si la biblioteca lo tiene
  Escenario: Buscar un libro que existe
    Dado que el catálogo tiene "Cien años de soledad"
    Cuando busco "cien años"
    Entonces veo "Cien años de soledad" en los resultados

  Escenario: Buscar un libro que no existe
    Dado que el catálogo no tiene ningún libro de "Zzz"
    Cuando busco "Zzz"
    Entonces veo el mensaje "No hay resultados"

  # Ver disponibilidad
  # Como socio, quiero ver cuántos ejemplares quedan libres, para decidir si lo reservo
  Escenario: Ver disponibilidad
    # Pendiente: criterios de aceptación

  # Filtrar por género y año
  # Como socio, quiero filtrar los resultados por género y año, para encontrar lecturas parecidas
  Escenario: Filtrar por género y año
    # Pendiente: criterios de aceptación

Característica: Préstamos
  Para: Socio de la biblioteca (y el bibliotecario en el mostrador)

  # Reservar un libro disponible
  # Como socio, quiero reservar un ejemplar disponible, para recogerlo en las próximas 48 horas
  Escenario: Reservar un ejemplar libre
    Dado que hay 2 ejemplares disponibles de "Rayuela"
    Cuando reservo "Rayuela"
    Entonces quedan 1 ejemplares disponibles
    Y recibo un aviso con el plazo de recogida

  # Registrar el préstamo
  # Como bibliotecario, quiero registrar el préstamo al entregar el libro, para que conste quién lo tiene y hasta cuándo
  Escenario: Registrar el préstamo
    # Pendiente: criterios de aceptación

  # Registrar la devolución
  # Como bibliotecario, quiero registrar una devolución escaneando el libro, para que el ejemplar vuelva a estar disponible
  Escenario: Registrar la devolución
    # Pendiente: criterios de aceptación

  # Cancelar una reserva
  # Como socio, quiero cancelar una reserva, para liberar el ejemplar para otro socio
  Escenario: Cancelar una reserva
    # Pendiente: criterios de aceptación

  # Lista de espera
  # Como socio, quiero apuntarme a la lista de espera de un libro prestado, para que me avisen cuando vuelva
  Escenario: Lista de espera
    # Pendiente: criterios de aceptación

  # Renovar un préstamo
  # Como socio, quiero renovar un préstamo una vez, para terminar el libro sin multa
  Escenario: Renovar un préstamo sin reservas pendientes
    Dado que tengo "Rayuela" prestado y nadie lo ha reservado
    Cuando pido renovarlo
    Entonces la fecha de devolución se amplía 14 días

Característica: Mi cuenta
  Para: Socio de la biblioteca (y el bibliotecario en el mostrador)

  # Ver mis préstamos
  # Como socio, quiero ver los libros que tengo y su fecha de devolución, para no pasarme del plazo
  Escenario: Ver mis préstamos
    # Pendiente: criterios de aceptación

  # Aviso de vencimiento
  # Como socio, quiero recibir un aviso dos días antes del vencimiento, para devolver a tiempo
  Escenario: Aviso de vencimiento
    # Pendiente: criterios de aceptación
