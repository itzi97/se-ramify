# language: es

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
