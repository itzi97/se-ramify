# language: es

Característica: EP-01 Búsqueda en el catálogo
  Componente: Préstamos
  Encontrar una obra y ver en qué sedes hay ejemplares disponibles.

  # HU-01.1 Buscar por título o autor
  # Como socio, quiero buscar una obra por título o autor, para saber si la tienen sin ir a la biblioteca
  Escenario: Hay obras que coinciden
    Dado que el catálogo tiene la obra «La sombra del viento» de Carlos Ruiz Zafón
    Cuando el socio busca «sombra del viento»
    Entonces ve la obra en los resultados con su autor y su año

  Escenario: No hay resultados
    Dado que ninguna obra del catálogo contiene «zzzz»
    Cuando el socio busca «zzzz»
    Entonces ve el mensaje «No hay obras con esa búsqueda»
    Y se le sugiere revisar la ortografía

  # HU-01.2 Ver disponibilidad por sede
  # Como socio, quiero ver cuántos ejemplares hay libres en cada sede, para ir a la que me pille mejor
  Escenario: Ejemplares libres en varias sedes
    Dado que la obra tiene 2 ejemplares libres en la sede Centro y 0 en la sede Norte
    Cuando el socio abre la ficha de la obra
    Entonces ve «Centro: 2 disponibles» y «Norte: ninguno disponible»

  Escenario: Ningún ejemplar libre
    Dado que todos los ejemplares de la obra están prestados
    Cuando el socio abre la ficha de la obra
    Entonces ve «Sin ejemplares disponibles»
    Y ve el botón «Reservar»
