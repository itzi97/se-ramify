# BiblioYa — material para generar y probar la aplicación con IA

Contenido de esta carpeta:

- `PROMPT.md`: el primer mensaje para el modelo.
- `SPEC.md`: definición del producto (contexto, stack, glosario, fuera de alcance, épicas).
- `GUARDRAILS.md`: reglas que el modelo debe respetar.
- `features/`: un fichero Gherkin por épica con sus historias y criterios de aceptación.

## Proceso

1. Abre una conversación nueva con el modelo de IA (por ejemplo, un asistente de programación con acceso a ficheros).
2. Adjunta SPEC.md, GUARDRAILS.md y la carpeta features/, y pega el contenido de PROMPT.md como primer mensaje.
3. Pide primero el plan (estructura de ficheros y modelo de datos) y revísalo antes de dejar que escriba código.
4. Genera la aplicación épica a épica, en el orden del backlog, y ejecuta las pruebas al terminar cada una.
5. Si una prueba falla, pega el error y el escenario Gherkin afectado y pide que lo corrija sin tocar lo que ya funciona.
6. Prueba a mano el camino feliz de cada historia y revisa el código antes de darlo por bueno.
7. Para cambiar la aplicación más adelante: edita primero la historia y sus criterios Gherkin, y repite los pasos 2–6 solo con las épicas afectadas.
