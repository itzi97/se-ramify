# Changelog

Each section below is the release note for that version: short bullets, user-facing changes only.

## 0.5.1

- A home screen: the diagrams you changed last, how far each project's hand-ins are (click one to open its checklist) and every kind of diagram one click away
- Colours by family — company, UML, requirements, design thinking, planning, infrastructure — on every diagram's badge in the list, the new-diagram window, the checklist and the home screen; filter the list by family
- In the list: right-click (or ⋯) to rename, duplicate, move to another project, archive or delete, each with Undo; drag a diagram onto another project; F2 renames; fold projects; sort by date, title or kind
- Ctrl+K finds any diagram or action by typing
- Each teammate has a colour; the list and the top bar show who is in a diagram and who changed it lately
- The checklist shows how much of each hand-in is done, to finish or missing
- Canvas diagrams: right-click menus for shapes, lines and the empty canvas (add a shape where you clicked, change a line's type or direction…); colour any shape or line; a line picker that draws each kind of line; drop targets light up while you connect or drag; a mini map
- The other editors answer the pointer: the drawing and its panel highlight each other (sequence, Gantt, stakeholders, vision, UP), clicking a part of an acta jumps to its field, drop zones light up while you drag cards, a full Kanban column turns amber
- Colour that means something: MoSCoW priorities (Must red, Should orange, Could amber, Won't grey), each assignee's colour, done and late Gantt bars, TCO alternatives, missing prices, review items in actas
- Every action button has an icon, down to restoring, keeping or deleting a sync copy, checking for updates and filling actors from the lines
- Notices say what happened in colour, with Undo or Open where it applies; the window title is the open diagram's name
- Fixes: a selected sequence message no longer exports in blue; a line could not be drawn from a note; traceability boxes were see-through; a selected double line exported as a single one

## 0.4.0

- Edit the hand-in checklist when the teacher asks for something different (use cases also in E1, an extra document…): add, move, copy or remove items; shared with your group through the folder
- See who's on what: the list and the top bar show when a teammate has a diagram open or is changing it
- Tells you when a new version is out, with a link to download it (once a day; can be turned off in Help)
- Every blank diagram says what to do first; toolbars, vision, actas and the Unified Process chart fit at 1280 px; example text in empty fields is clearly an example
- Fixes: closing a diagram while it was saving could fail; a sync app's copy counted twice in the checklist

## 0.3.0

- Installers for Windows, macOS (Intel and Apple Silicon) and Linux
- Team work on a shared folder (Drive, OneDrive, Dropbox or git): teammates' changes appear within seconds, and nobody's work is overwritten — if two people save the same diagram, both versions are kept
- Your name is saved with the diagrams you edit; the list shows who edited each one last
- Sync apps' conflict copies and duplicate files are flagged, with buttons to keep or delete them; git conflict markers are resolved from the app (mine / theirs / both)
- Save a diagram as a file to send, and open a diagram file someone sent you
- Hand-in and project exports also write the memoria as Word (.docx) and LaTeX (a whole document plus a body to \input into your template), and a PowerPoint deck for the presentation; you pick which
- Export a single diagram as a Word document or a PowerPoint slide; copy a LaTeX figure for its PNG
- Image size in the Export menu: normal, high or print resolution; PNGs carry their resolution, so documents insert them at their on-screen size
- Fixes: Create in the hand-in checklist, blank actas start with their agenda, older or half-written files open without errors, TCO reads prices like "$1,234.50" and says when prices are still missing, fitting the view leaves room for the side panel

## 0.2.0

- Hand-in checklist per project: what E1, E2, E3 and the final hand-in ask for, which diagrams cover each part, what's missing inside them; create what's missing and export one hand-in with its own memoria
- New: TCO calculator (local vs cloud, CAPEX / OPEX by year, 3-year and per-user totals, weighted criteria, recommendation)
- New: product backlog (epics, user stories with Gherkin, checker) with the AI brief and AI pack for generating and testing the app
- New: meeting minutes for client meetings, team meetings, post mortem and agile retrospectives
- New: Unified Process plan (phases, iterations, milestones, effort curves, artefacts linked to your diagrams)
- New: org chart with roles, people and responsibilities
- Example project with every hand-in done for an invented app, and its exports in `examples/`

## 0.1.0

- 28 diagram kinds: UML (system / use case, class, sequence, communication, activity, state, deployment), requirements (E/R, DFD, screens, traceability, stakeholders, vision, business model canvas), design thinking (mind map, context map, persona, customer journey, empathy map, brainstorming, crazy eight, six hats, concept map), planning (story map, Kanban, Gantt, flowchart) and infrastructure
- Use case specifications on every use case, exported as tables
- Blank or worked example for every kind
- PNG / SVG export on white; PlantUML, Mermaid, Markdown, Gherkin and CSV exports
- Copy a diagram as an image (Ctrl+Shift+C) to paste into a document
- Export a whole project: numbered PNGs plus a Markdown memoria with specs, stories and tables
- Copy, cut and paste shapes; lines route round other shapes; Tidy keeps swimlanes and traceability columns
- Sequence diagrams from text (PlantUML subset), both ways
- Undo / redo per diagram, autosave, previous versions, recently deleted, projects in the diagram list
- Follows the desktop's light / dark scheme and accent colour; Wayland first
