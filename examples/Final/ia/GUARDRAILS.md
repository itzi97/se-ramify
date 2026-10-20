# Guardrails

Reglas que el modelo debe seguir siempre al generar o modificar la aplicación.

- Implementa solo lo que describen las historias de usuario y sus criterios de aceptación; no añadas funciones que no estén pedidas.
- Cada escenario Gherkin debe tener una prueba automática que lo ejecute; la tarea no está terminada hasta que todas pasen.
- No inventes campos, entidades ni reglas de negocio: si algo no está definido, pregunta o déjalo anotado como duda.
- Usa los términos del glosario tal cual, en el código, la interfaz y los mensajes.
- Respeta el stack indicado; no cambies de lenguaje, framework ni base de datos.
- Valida todas las entradas del usuario y muestra los mensajes de error que indican los criterios.
- No guardes datos personales que no pidan las historias (RGPD).
- Explica cada cambio que hagas y qué historias y escenarios cubre.
