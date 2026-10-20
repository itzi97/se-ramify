# language: es

Característica: EP-06 Bajas y expurgo
  Componente: Catálogo
  Retirar ejemplares perdidos o deteriorados sin perder su historial de préstamos.

  # HU-06.1 Dar de baja un ejemplar
  # Como bibliotecario, quiero dar de baja un ejemplar indicando el motivo, para que deje de aparecer como disponible
  Escenario: Baja de un ejemplar deteriorado
    Dado que el ejemplar "BY-000123" está disponible
    Cuando lo doy de baja con el motivo "Deteriorado"
    Entonces el ejemplar deja de aparecer como disponible
    Y su historial de préstamos se conserva

  Escenario: Ejemplar prestado
    Dado que el ejemplar "BY-000123" está prestado
    Cuando intento darlo de baja
    Entonces la baja no se hace
    Y veo el mensaje "El ejemplar está prestado; espera a que se devuelva"
