# Changelog

Each section below is the release note for that version: short bullets, user-facing changes only.

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
