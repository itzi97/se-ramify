# se-ramify

The diagrams of a Software Engineering course in one local, open-source desktop app: system and use case diagrams with their specifications, the rest of UML, stakeholder maps, the design thinking boards, user story maps, Kanban and Gantt. Same idea as ramify: every diagram is a plain JSON file in a folder you choose, so it's yours to sync, back up, put in git or read without this app.

## What it draws

| Group | Diagrams |
|---|---|
| **UML** | Diagrama de sistema / casos de uso (actors, system boundary, «include» / «extend», generalisation, plus a full specification per use case) · clases · secuencia · comunicación · actividad (swimlanes, fork / join) · estados · despliegue / componentes |
| **Requirements** (Tema 3) | Modelo entidad / relación (Chen) · DFD (context diagram and levels, Gane–Sarson) · diseño de pantallas · trazabilidad de requisitos (RQ → criterios → diseño → componentes → casos de prueba) · mapa de stakeholders (power / interest grid **and** the onion) · visión (elevator pitch) · lienzo de modelo de negocio |
| **Design thinking** (Tema 3) | Mapa mental · mapa de contexto · customer persona · customer journey (with the emotion curve and moments of truth) · mapa de empatía · brainstorming (random-word stimulus, impact × feasibility) · crazy eight (with the timer) · 6 sombreros · mapa conceptual |
| **Planning** | User Story Mapping (sprints, stories with Gherkin) · Kanban (WIP limits) · Gantt (phases, milestones, dependencies) · flowcharts / process models |
| **Architecture** | Infrastructure diagram: every machine and service of a local or cloud solution, in zones — the picture behind a TCO |

Every kind can start blank or from a small worked example (a library loans system, one of the exercise themes in Tema 3), so they can be compared side by side.

## Exports

**For a document:** `Ctrl+Shift+C` (or Export → *Copy as image*) puts the diagram on the clipboard as a PNG, ready to paste into Google Docs, Word or Slides.

**For a hand-in:** the box icon next to a project name in the list exports the whole project into a folder you pick: every diagram as a numbered PNG, the PlantUML and Gherkin files, and one `…-memoria.md` that shows the diagrams in order with their notes, use case specifications, stories, tables and matrices.

PNG and SVG for every diagram, on white by default (untick *White background* in the Export menu to keep your theme). The SVG holds a sharp 3× image, so it opens the same in Typst, LaTeX, Inkscape, Word and browsers. Text exports, also copyable from the same menu:

* PlantUML: use case, class, state, deployment, mind map
* Mermaid: class, state, activity, flowchart, sequence, Gantt
* Markdown: use case specifications (one table per use case), stories by sprint, stakeholder table, journey, boards, E/R, DFD, screens, traceability matrix, equipment inventory, vision
* Gherkin `.feature` (`# language: es`) from story maps and Kanban cards, CSV for Gantt, stakeholders, traceability and the equipment inventory

The sequence diagram also *imports* PlantUML (⋯ → Import), and has a text tab that round-trips with the clickable editor.

## Using it

First run: pick a folder for your diagrams. *New diagram* (Ctrl+N) shows every kind with where it appears in the course; give it a project name ("Proyecto final", "Ejercicios T3") and the list on the left groups by it.

**Canvas diagrams** (UML, maps, DFD, E/R, screens, traceability, infrastructure): click a shape in the toolbar to drop it in the middle, or drag it onto the canvas; double-click empty canvas for the kind's main shape. Hover a shape and drag from its dot to another shape to connect them — the toolbar's relation menu picks the kind of line (association, «include», composition, data flow…), and the panel on the right changes it afterwards. Double-click a shape to rename it in place (class compartments too), a line to edit its label. Containers (system boundary, swimlanes, packages, deployment nodes, zones) carry whatever is inside them when dragged and resize from their corners. Straight or right-angle lines are a toggle; *Tidy* lays the whole diagram out (undo brings yours back). `Del` deletes, `Ctrl+C` / `Ctrl+X` / `Ctrl+V` copy, cut and paste shapes (also into another diagram of the same kind), `Ctrl+D` duplicates, arrows nudge (Shift: 1 px), `Ctrl+A` selects all, Shift+drag selects an area; select several to align or distribute them.

**Use case specifications** live on each use case: select it and fill in the panel (code, actors — *Fill actors from the lines in the diagram* reads them off the drawing — description, trigger, pre / postconditions, main and alternative flows, priority, frequency). *Export → Use case specifications* gives one table per use case.

**Mind maps** lay themselves out: `Tab` adds an idea under the selected one, `Enter` one beside it, `Shift+Enter` just commits, `F2` renames.

**Everything else** (sequence, Gantt, story map, Kanban, stakeholders, journey, boards) has its own editor; cards and sticky notes drag with the pointer directly, so it behaves the same on Wayland, X11 and Windows.

Every change saves itself within half a second. `Ctrl+Z` / `Ctrl+Shift+Z` undo and redo across all editors, and each diagram keeps its own history while the app is open, so switching away and back doesn't lose it. ⋯ keeps *Notes* about the diagram, *Duplicate*, *Archive*, *Previous versions* (a dated copy when you start editing a diagram and every five minutes after, and before a delete or restore) and *Delete*; a deleted diagram can be brought back from *Recently deleted* at the bottom of the list.

Editing text on a shape: `Enter` finishes a one-line name; on notes and screens `Enter` starts a new line and `Ctrl+Enter` (or `Esc`, or clicking away) finishes. `Esc` always keeps what you typed — `Ctrl+Z` takes it back.

## Linux: Wayland and themes

Same shell as ramify: Wayland first (GTK's Wayland backend, no XWayland), WebKitGTK's DMA-BUF renderer switched off automatically on NVIDIA, and the light / dark scheme and accent colour followed live from GNOME or Plasma through the XDG settings portal. ⋯ → Theme pins light or dark.

## Development

Prerequisites: Node 20+, Rust (stable) and Tauri's system deps. On Arch / CachyOS:

```sh
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl appmenu-gtk-module libappindicator-gtk3 librsvg
```

Then:

```sh
npm install
npm run tauri dev      # desktop app with hot reload
npm run dev            # UI only, in the browser (diagrams kept in localStorage)
npm run check          # svelte-check / TypeScript
npm test               # geometry, layouts, parsers, exports, examples (node:test via tsx)
npm run build && npm run e2e   # every kind in a real browser, light and dark, plus a canvas walkthrough
npm run tauri build    # AppImage, .deb and .rpm in src-tauri/target/release/bundle
./scripts/install.sh   # put the newest AppImage in your launcher (uninstall.sh removes it)
```

Tagging `vX.Y.Z` runs `.github/workflows/release.yml`, which builds Linux and Windows installers into a draft release with the version's CHANGELOG bullets as notes.

## Project layout

```
src/
  App.svelte                 shell: top strip, Export and ⋯ menus, notes / versions / help panels
  app.css                    design tokens (ramify's) and shared controls
  lib/model/                 types.ts (the file format), kinds.ts (the catalogue and every palette),
                             diagram.ts (create / validate / normalise), colors.ts, stories.ts, icons.ts
  lib/stores/app.svelte.ts   app state, undo / redo, autosave, backups, image and text export
  lib/storage/diagrams.ts    JSON-file storage (Tauri) + localStorage fallback
  lib/desktop/appearance.ts  desktop colour scheme + accent (XDG portal)
  lib/components/            DiagramList, NewDiagram, Panel, Notices, Swatches, StoryFields, Icon
  lib/editors/
    types.ts                 the contract every editor follows
    registry.ts              kind → editor, example, exports
    graph/                   one Svelte Flow editor for all 14 canvas kinds: shapes, lines
                             (floating, straight / orthogonal, UML ends), inspector, ELK tidy,
                             mind-map layout, PlantUML / Mermaid / Markdown exports
    sequence/  vision/  gantt/  storymap/  kanban/  stakeholder/  journey/
    board/                   one sticky-note editor, templates for the seven boards
tests/                       node:test suites and tests/e2e browser scenarios
src-tauri/                   Rust shell, config, capabilities, icons
```

## License

MIT — see [LICENSE](LICENSE).
