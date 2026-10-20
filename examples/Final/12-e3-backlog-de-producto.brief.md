# Brief para generar BiblioYa con IA

Este documento define formalmente el producto. Las historias de usuario y sus criterios de aceptación en Gherkin son la especificación: la aplicación generada debe cumplir todos los escenarios.

## Contexto

BiblioYa es la aplicación de la red de bibliotecas de una universidad. Los socios (estudiantes y personal) buscan obras y piden préstamos; los bibliotecarios gestionan el catálogo, los ejemplares de cada sede y el mostrador de préstamo. Esta especificación cubre el componente Catálogo.

## Stack

Aplicación web: TypeScript con SvelteKit, base de datos PostgreSQL, pruebas de aceptación con Cucumber.js sobre los ficheros .feature. Se ejecuta con `npm run dev` y las pruebas con `npm test`.

## Glosario

| Término | Definición |
|---|---|
| Obra | un libro como título (ISBN, título, autor, materia), con independencia de cuántas copias haya. |
| Ejemplar | cada copia física de una obra, con su código de barras y su sede. |
| Sede | cada una de las bibliotecas de la red (Campus Norte, Campus Sur, Medicina). |
| Baja | retirada de un ejemplar del préstamo; se guarda el motivo y su historial. |
| Inventario | comprobación física de los ejemplares de una estantería frente al sistema. |

## Fuera de alcance

- Préstamos, reservas y cuentas de socio (componente Préstamos).
- Pagos de multas.
- La app móvil de lectura de códigos: se usa un lector USB como teclado.

## Guardrails

- Implementa solo lo que describen las historias de usuario y sus criterios de aceptación; no añadas funciones que no estén pedidas.
- Cada escenario Gherkin debe tener una prueba automática que lo ejecute; la tarea no está terminada hasta que todas pasen.
- No inventes campos, entidades ni reglas de negocio: si algo no está definido, pregunta o déjalo anotado como duda.
- Usa los términos del glosario tal cual, en el código, la interfaz y los mensajes.
- Respeta el stack indicado; no cambies de lenguaje, framework ni base de datos.
- Valida todas las entradas del usuario y muestra los mensajes de error que indican los criterios.
- No guardes datos personales que no pidan las historias (RGPD).
- Explica cada cambio que hagas y qué historias y escenarios cubre.

## Proceso para generar y probar

1. Abre una conversación nueva con el modelo de IA (por ejemplo, un asistente de programación con acceso a ficheros).
2. Adjunta SPEC.md, GUARDRAILS.md y la carpeta features/, y pega el contenido de PROMPT.md como primer mensaje.
3. Pide primero el plan (estructura de ficheros y modelo de datos) y revísalo antes de dejar que escriba código.
4. Genera la aplicación épica a épica, en el orden del backlog, y ejecuta las pruebas al terminar cada una.
5. Si una prueba falla, pega el error y el escenario Gherkin afectado y pide que lo corrija sin tocar lo que ya funciona.
6. Prueba a mano el camino feliz de cada historia y revisa el código antes de darlo por bueno.
7. Para cambiar la aplicación más adelante: edita primero la historia y sus criterios Gherkin, y repite los pasos 2–6 solo con las épicas afectadas.

## Historias de usuario y criterios de aceptación

### EP-01 · Búsqueda en el catálogo

Encontrar una obra y ver en qué sedes hay ejemplares disponibles.

#### HU-01.1 · Buscar por título o autor

> Como socio, quiero buscar una obra por título o autor, para saber si la tienen sin ir a la biblioteca.

Prioridad: Must · Puntos: 3

```gherkin
Escenario: Hay obras que coinciden
  Dado que el catálogo tiene la obra «La sombra del viento» de Carlos Ruiz Zafón
  Cuando el socio busca «sombra del viento»
  Entonces ve la obra en los resultados con su autor y su año

Escenario: No hay resultados
  Dado que ninguna obra del catálogo contiene «zzzz»
  Cuando el socio busca «zzzz»
  Entonces ve el mensaje «No hay obras con esa búsqueda»
  Y se le sugiere revisar la ortografía
```

#### HU-01.2 · Ver disponibilidad por sede

> Como socio, quiero ver cuántos ejemplares hay libres en cada sede, para ir a la que me pille mejor.

Prioridad: Should · Puntos: 2

```gherkin
Escenario: Ejemplares libres en varias sedes
  Dado que la obra tiene 2 ejemplares libres en la sede Centro y 0 en la sede Norte
  Cuando el socio abre la ficha de la obra
  Entonces ve «Centro: 2 disponibles» y «Norte: ninguno disponible»

Escenario: Ningún ejemplar libre
  Dado que todos los ejemplares de la obra están prestados
  Cuando el socio abre la ficha de la obra
  Entonces ve «Sin ejemplares disponibles»
  Y ve el botón «Reservar»
```

### EP-05 · Alta de fondos

Registrar los libros que llegan a la biblioteca: la obra y cada uno de sus ejemplares.

#### HU-05.1 · Registrar una obra nueva

> Como bibliotecario, quiero dar de alta una obra con su ISBN, título, autor y materia, para que los socios la encuentren en el catálogo.

Prioridad: Must · Puntos: 3

```gherkin
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
```

#### HU-05.2 · Añadir ejemplares a una obra

> Como bibliotecario, quiero añadir ejemplares a una obra indicando su sede, para saber cuántas copias se pueden prestar en cada biblioteca.

Prioridad: Must · Puntos: 2

```gherkin
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
```

### EP-06 · Bajas y expurgo

Retirar ejemplares perdidos o deteriorados sin perder su historial de préstamos.

#### HU-06.1 · Dar de baja un ejemplar

> Como bibliotecario, quiero dar de baja un ejemplar indicando el motivo, para que deje de aparecer como disponible.

Prioridad: Should · Puntos: 2

```gherkin
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
```

### EP-07 · Inventario

Comprobar cada curso que los ejemplares están donde dice el sistema.

#### HU-07.1 · Pasar inventario de una sede

> Como bibliotecario, quiero leer los códigos de barras de una estantería y compararlos con el sistema, para detectar ejemplares perdidos o mal colocados.

Prioridad: Could · Puntos: 5

```gherkin
Escenario: Todos los ejemplares están en su sitio
  Dado que la estantería "N-12" tiene 40 ejemplares según el sistema
  Cuando leo los 40 códigos de barras
  Entonces el informe dice "Sin incidencias"

Escenario: Falta un ejemplar
  Dado que la estantería "N-12" tiene 40 ejemplares según el sistema
  Cuando leo 39 códigos de barras y termino
  Entonces el informe lista el ejemplar que falta
  Y lo marca como "No localizado"
```
