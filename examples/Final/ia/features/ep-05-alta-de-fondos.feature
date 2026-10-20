# language: es

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
