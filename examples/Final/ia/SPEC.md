# Especificación — BiblioYa

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

## Épicas

| Código | Épica | Componente | Prioridad | Historias | Puntos |
|---|---|---|---|---:|---:|
| EP-01 | Búsqueda en el catálogo | Préstamos | Must | 2 | 5 |
| EP-02 | Préstamo y devolución | Préstamos | Must | 0 | — |
| EP-03 | Reservas | Préstamos | Should | 0 | — |
| EP-04 | Cuenta del socio | Préstamos | Could | 0 | — |
| EP-05 | Alta de fondos | Catálogo | Must | 2 | 5 |
| EP-06 | Bajas y expurgo | Catálogo | Should | 1 | 2 |
| EP-07 | Inventario | Catálogo | Could | 1 | 5 |
