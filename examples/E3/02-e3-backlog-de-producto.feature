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

Característica: EP-05 Alta de fondos
  Componente: Catálogo
  Registrar los libros que llegan a la biblioteca: la obra y cada uno de sus ejemplares.

  # HU-05.1 Registrar una obra nueva
  # Como bibliotecario, quiero dar de alta una obra con su ISBN, título, autor y materia, para que los socios la encuentren en el catálogo
  Escenario: Alta de una obra con datos completos
    Dado que estoy identificado como bibliotecario
    Y que no existe ninguna obra con ISBN "978-84-376-0494-7"
    Cuando registro la obra con ISBN "978-84-376-0494-7", título "Cien años de soledad" y autor "Gabriel García Márquez"
    Entonces la obra aparece en el catálogo
    Y veo el mensaje "Obra registrada"

  Escenario: ISBN repetido
    Dado que ya existe una obra con ISBN "978-84-376-0494-7"
    Cuando intento registrar otra obra con ese ISBN
    Entonces la obra no se registra
    Y veo el mensaje "Ya existe una obra con ese ISBN"

  Escenario: Falta un dato obligatorio
    Dado que estoy identificado como bibliotecario
    Cuando registro una obra sin título
    Entonces la obra no se registra
    Y el campo "Título" se marca como obligatorio

  # HU-05.2 Añadir ejemplares a una obra
  # Como bibliotecario, quiero añadir ejemplares a una obra indicando su sede, para saber cuántas copias se pueden prestar en cada biblioteca
  Escenario: Añadir dos ejemplares en una sede
    Dado que la obra "Cien años de soledad" tiene 1 ejemplar en la sede "Campus Norte"
    Cuando añado 2 ejemplares en la sede "Campus Norte"
    Entonces la obra tiene 3 ejemplares en "Campus Norte"
    Y cada ejemplar nuevo tiene un código de barras distinto

  Escenario: Cantidad no válida
    Dado que estoy en la ficha de la obra "Cien años de soledad"
    Cuando intento añadir 0 ejemplares
    Entonces no se añade ningún ejemplar
    Y veo el mensaje "Indica al menos un ejemplar"

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

Característica: EP-07 Inventario
  Componente: Catálogo
  Comprobar cada curso que los ejemplares están donde dice el sistema.

  # HU-07.1 Pasar inventario de una sede
  # Como bibliotecario, quiero leer los códigos de barras de una estantería y compararlos con el sistema, para detectar ejemplares perdidos o mal colocados
  Escenario: Todos los ejemplares están en su sitio
    Dado que la estantería "N-12" tiene 40 ejemplares según el sistema
    Cuando leo los 40 códigos de barras
    Entonces el informe dice "Sin incidencias"

  Escenario: Falta un ejemplar
    Dado que la estantería "N-12" tiene 40 ejemplares según el sistema
    Cuando leo 39 códigos de barras y termino
    Entonces el informe lista el ejemplar que falta
    Y lo marca como "No localizado"
