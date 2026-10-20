# se-ramify

The diagrams and documents of a Software Engineering course in one local, open-source desktop app: system and use case diagrams with their specifications, the rest of UML, stakeholder maps, the design thinking boards, TCO, org chart, backlog with Gherkin, Unified Process plan, meeting minutes, user story maps, Kanban and Gantt — plus a checklist of what each project hand-in asks for. Same idea as ramify: every diagram is a plain JSON file in a folder you choose, so it's yours to sync, back up, put in git or read without this app.

## What it draws

| Group | Diagrams |
|---|---|
| **Company** (E1 and the actas) | Organigrama y roles (who holds each role, responsibilities) · TCO calculator (cost lines per alternative by Tema 2 block, CAPEX / OPEX per year, 3-year total and per user, weighted criteria, recommendation) · lienzo de modelo de negocio · acta de reunión (client meeting, team meeting, post mortem, agile retrospective) |
| **UML** | Diagrama de sistema / casos de uso (actors, system boundary, «include» / «extend», generalisation, plus a full specification per use case) · clases · secuencia · comunicación · actividad (swimlanes, fork / join) · estados · despliegue / componentes |
| **Requirements** (Tema 3) | Modelo entidad / relación (Chen) · DFD (context diagram and levels, Gane–Sarson) · diseño de pantallas · trazabilidad de requisitos (RQ → criterios → diseño → componentes → casos de prueba) · mapa de stakeholders (power / interest grid **and** the onion) · visión (elevator pitch) |
| **Design thinking** (Tema 3) | Mapa mental · mapa de contexto · customer persona · customer journey (with the emotion curve and moments of truth) · mapa de empatía · brainstorming (random-word stimulus, impact × feasibility) · crazy eight (with the timer) · 6 sombreros · mapa conceptual |
| **Planning** | Backlog de producto (epics → user stories with Gherkin, a checker, and the AI brief / pack for vibe coding) · Proceso Unificado (phases, iterations, milestones, the disciplines' effort humps and each phase's artefacts linked to your diagrams) · User Story Mapping (sprints, stories with Gherkin) · Kanban (WIP limits) · Gantt (phases, milestones, dependencies) · flowcharts / process models |
| **Architecture** | Infrastructure diagram: every machine and service of a local or cloud solution, in zones — the picture behind a TCO |

Every kind can start blank or from a small worked example (a library loans system, one of the exercise themes in Tema 3), so they can be compared side by side.

## Install

Download the installer for your computer from the [latest release](https://github.com/itzi97/se-ramify/releases/latest):

| System | File | First time |
|---|---|---|
| **Windows** | `se-ramify_…_x64-setup.exe` | Windows SmartScreen may say it "protected your PC" (the app isn't signed with a paid certificate): *More info* → *Run anyway*. It installs for your user only, no admin needed. |
| **macOS** (Intel and Apple Silicon) | `se-ramify_…_universal.dmg` | Drag it to Applications. The first time, right-click the app → *Open* → *Open* (or System Settings → Privacy & Security → *Open Anyway*). If macOS says the app "is damaged", run `xattr -cr /Applications/se-ramify.app` in Terminal once. |
| **Linux** | `.AppImage` (any distro), `.deb` (Ubuntu / Debian), `.rpm` (Fedora) | AppImage: `chmod +x se-ramify_*.AppImage` and run it. |

Nothing to sign up for and no internet needed: diagrams are files in a folder you choose.

## Working as a team

Everyone in the group installs the app and points it (*Choose folder* at the bottom of the list) at the **same shared folder**. Each diagram is its own small file, so people working on different diagrams never get in each other's way. Write **your name** at the bottom of the list: it's saved with every diagram you edit, the list shows each diagram's last editor's initial, and hovering shows "Edited by Bruno, 5 min ago".

Three ways to share the folder — use whichever your group already has:

* **Synced folder** (Google Drive for desktop, OneDrive, Dropbox, Nextcloud…): put the folder inside it. The app re-reads the folder every few seconds, so a teammate's changes appear on their own; an open diagram you aren't editing updates in place.
* **Git repository**: keep the folder in a repo and pull / commit / push as usual. Files are pretty-printed JSON, so diffs are readable. If a merge leaves conflict markers in a file, the app lists it under *Files that need attention* with *Mine* / *Theirs* / *Both*; commit the result to finish the merge.
* **Sending files**: ⋯ → *Save a copy to send…* writes one diagram as a file you can send by chat or e-mail; *Open a diagram file…* at the bottom of the list adds one someone sent you (if you already have it, you choose between replacing yours or keeping both).

**Nobody's work is overwritten.** Before saving, the app checks whether the file changed since you opened it. If a teammate saved the same diagram while you were editing it, their version opens and yours is kept next to it as "*… (versión de Itziar)*" — compare the two and keep what you need. Copies that a sync app makes when two people save at once (and files copied by hand) are marked with ⚠ in the list, with buttons to open the original, keep the copy as its own diagram, or delete it. Deleted files keep a backup in *Recently deleted*.

Tip: split the work by diagram (one person per use case diagram, another on the TCO…) and use the hand-in checklist together to see what's left.

## Hand-ins

The checklist icon next to a project in the list (or ⋯ → *Hand-in checklist*) shows, for E1, E2, E3 and the final hand-in of the course project, every part the brief asks for with its weight, which of the project's diagrams cover it, and what is still missing inside them — a use case without its specification, fewer than six stakeholders, a TCO line without a price or a source, a story without Gherkin, an acta with nothing about the methodology. *Create* makes a missing diagram in the project; *Export* writes just that hand-in (the final one includes E1–E3) with its own memoria. Parts that are prose (the brand, your model's pros and cons, the agile report) are listed as reminders.

*Load the example project* (bottom of the list, or Help) adds every hand-in done for an invented product — BiblioYa, a library loans app by an invented company, Faro Software — to see what a complete one looks like. [`examples/`](examples/) has its exports: the images, PlantUML, Gherkin, AI pack and a PDF memoria per hand-in.

## Exports

**Into Word, Google Docs or PowerPoint:** `Ctrl+Shift+C` (or Export → *Copy as image*) puts the diagram on the clipboard as a PNG; paste it. Export → *Word document* gives a `.docx` with the diagram, its notes and its tables (use case specifications, TCO…); *PowerPoint slide* a 16:9 `.pptx` with the diagram fitted to the slide.

**Into LaTeX:** Export → *PNG*, then *Copy LaTeX figure* puts the matching `\begin{figure}…\includegraphics{<the PNG's name>}…\end{figure}` on the clipboard.

**Sharp at the right size:** *Image size* in the Export menu picks 2× (normal), 3× (high) or 4× (print) the screen resolution. Exported PNGs carry their resolution, so Word, PowerPoint and LaTeX insert them at their on-screen size however sharp they are, instead of two to four times too big.

**For a hand-in or the whole project:** the box icon next to a project (or *Export* in the hand-in checklist) asks which documents to write, then exports into a folder you pick: every diagram as a numbered PNG, the PlantUML and Gherkin files, the memoria as Markdown and, as ticked:

* **Word** `…-memoria.docx`: headings with Word's styles (navigation pane, table of contents), real tables, every image with a numbered caption
* **LaTeX** `…-memoria.tex`, a complete document for `pdflatex` / `latexmk -pdf`, and `…-memoria-cuerpo.tex`, the same body to `\input{}` into your group's template (needs graphicx, float, longtable, booktabs, xcolor and fvextra)
* **PowerPoint** `…-presentacion.pptx` for the 5–15 minute presentation: title slide, the parts of the hand-in with their weights, one slide per diagram

PNG and SVG for every diagram, on white by default (untick *White background* in the Export menu to keep your theme). The SVG holds a sharp image (3× or more), so it opens the same in Typst, LaTeX, Inkscape, Word and browsers. Text exports, also copyable from the same menu:

* PlantUML: use case, class, state, deployment, mind map
* Mermaid: class, state, activity, flowchart, sequence, Gantt
* Markdown: use case specifications (one table per use case), TCO tables and recommendation, backlog and AI brief, actas, UP phases and artefacts, roles, stories by sprint, stakeholder table, journey, boards, E/R, DFD, screens, traceability matrix, equipment inventory, vision
* Gherkin `.feature` (`# language: es`) from the backlog, story maps and Kanban cards, CSV for Gantt, TCO, acta actions, stakeholders, traceability and the equipment inventory

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
