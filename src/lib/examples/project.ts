/**
 * The example project: every hand-in of the course project (E1, E2, E3 and
 * the final) done for an invented product, BiblioYa (a library loans app),
 * by an invented four-person company, Faro Software. It shows what a
 * complete hand-in looks like in the app and passes the hand-in checklist.
 * Nothing in it is about the real course case.
 */
import { newDiagram } from "../model/diagram";
import type {
  DataByKind,
  Diagram,
  DiagramKind,
  DiagramOf,
} from "../model/types";
import { graphExample } from "../editors/graph/examples";
import { sequenceExample } from "../editors/sequence/example";
import { ganttExample } from "../editors/gantt/example";
import { stakeholderExample } from "../editors/stakeholder/example";
import { storymapExample } from "../editors/storymap/example";
import { visionExample } from "../editors/vision/example";
import { tcoExample } from "../editors/tco/example";
import { backlogExample } from "../editors/backlog/example";
import {
  minutesExample,
  postmortemExample,
  retroExample,
} from "../editors/minutes/example";
import { upExample } from "../editors/up/example";
import { autoLink } from "../editors/up/model";
import {
  cloudArchitecture,
  companyCanvas,
  localArchitecture,
  ownModel,
  useCases,
} from "./parts";

export const EXAMPLE_PROJECT = "Ejemplo — BiblioYa";

export function exampleProject(project = EXAMPLE_PROJECT): Diagram[] {
  const docs: Diagram[] = [];
  const add = <K extends DiagramKind>(
    kind: K,
    title: string,
    data: DataByKind[K],
    notes = "",
  ) => {
    const d = newDiagram(kind, title, project, data);
    d.notes = notes;
    docs.push(d);
    return d as DiagramOf<K>;
  };

  // E1 — empresa y TCO
  add(
    "canvas",
    "E1 · Modelo de negocio — Faro Software",
    companyCanvas(),
    "Faro Software es una empresa inventada de cuatro personas. Este lienzo describe la empresa, no el producto.",
  );
  add("orgchart", "E1 · Organigrama y roles", graphExample("orgchart"));
  add(
    "architecture",
    "E1 · Arquitectura — local",
    localArchitecture(),
    "Alternativa A. Todo duplicado donde una avería pararía el servicio: dos servidores con réplica, dos switches, SAI y copias en NAS.",
  );
  add(
    "architecture",
    "E1 · Arquitectura — nube",
    cloudArchitecture(),
    "Alternativa B. La aplicación en dos zonas de disponibilidad detrás de un balanceador, con base de datos gestionada multi-AZ.",
  );
  add("tco", "E1 · TCO a 3 años", tcoExample());

  // E2 — UML, stakeholders y visión
  add("usecase", "E2 · Casos de uso", useCases());
  add("class", "E2 · Diagrama de clases de diseño", graphExample("class"));
  add("sequence", "E2 · Secuencia — Reservar libro", sequenceExample());
  add("stakeholder", "E2 · Mapa de stakeholders", stakeholderExample());
  add("vision", "E2 · Visión — elevator pitch", visionExample());

  // E3 — modelo propio, backlog y PUD
  add(
    "flowchart",
    "E3 · Modelo de desarrollo Faro",
    ownModel(),
    "Modelo propio: iteraciones de tres semanas que acaban en una demo al cliente; la especificación (historias y Gherkin) se mantiene al día en cada iteración.",
  );
  add("backlog", "E3 · Backlog de producto", backlogExample());
  add("gantt", "E3 · Planificación PUD", ganttExample());
  add("minutes", "E3 · Acta 1 — reunión con el cliente", minutesExample());
  // Design and analysis models the UP plan links to.
  add("er", "E3 · Modelo de datos (E/R)", graphExample("er"));
  add("activity", "E3 · Actividad — Prestar libro", graphExample("activity"));
  add("state", "E3 · Estados — Ejemplar", graphExample("state"));
  add("screenflow", "E3 · Pantallas", graphExample("screenflow"));
  add("deployment", "E3 · Despliegue", graphExample("deployment"));
  add(
    "traceability",
    "E3 · Trazabilidad de requisitos",
    graphExample("traceability"),
  );

  // Final
  add("minutes", "Final · Acta post mortem", postmortemExample());
  add("minutes", "Final · Acta — ¿y con metodología ágil?", retroExample());
  add(
    "storymap",
    "Final · User Story Mapping — sprints 1 y 2",
    storymapExample(),
  );

  // The UP plan last, so it can point at the diagrams above.
  const up = upExample();
  up.artifacts = autoLink(
    up.artifacts,
    docs.map((d) => ({ id: d.id, kind: d.kind, title: d.title })),
  )
    // The deployment plan is a document, not the Gantt chart "plan" matches.
    .artifacts.map((a) =>
      a.name === "Plan de despliegue" ? { ...a, diagramId: undefined } : a,
    )
    .map((a) => ({
      ...a,
      // What is drawn here is done; the rest (code, manuals, training) is described in the report.
      status: a.diagramId ? "done" : a.status === "todo" ? "draft" : a.status,
    }));
  add("up", "E3 · Proceso Unificado — fases y artefactos", up);
  return docs;
}
