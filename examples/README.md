# Example hand-ins

Every hand-in of the course project (E1, E2, E3 and the final one), done in se-ramify for an **invented** product: BiblioYa, a library loans app, built by Faro Software, an invented four-person company. Nothing here is about the real course case. Everything in it, prices included, is illustrative, so swap in real data before you reuse any of it.

Each folder is exactly what the app's hand-in checklist writes with *Export*, plus a PDF of the memoria:

| Folder | What the brief asks for | What's in it |
|---|---|---|
| [`E1`](E1) | Company (name, brand, business model, roles) · both alternatives with their architecture · 3-year TCO · reasoned recommendation | Business model canvas, org chart, local and cloud architecture, TCO with comparison and recommendation |
| [`E2`](E2) | UML (use cases with specifications, classes, sequence) · stakeholder map (≥ 6) · elevator pitch | Use cases with one specification each, design class diagram, sequence diagram, stakeholder map, vision |
| [`E3`](E3) | Own development model · backlog (all epics, one in stories) · PUD: Gantt, phases with artefacts, actas | Process model, backlog with Gherkin, Gantt, Unified Process plan linked to the diagrams, client meeting acta |
| [`Final`](Final) | E1–E3 corrected · post mortem acta · agile acta · story map of the first two sprints · every epic of one component in stories with Gherkin + material to build the app with AI | All of the above, post mortem and agile retrospective actas, user story map, `.feature` files, the AI brief and the AI pack in [`Final/ia`](Final/ia) |

Each `…-memoria.md` lists the parts of the hand-in with their weights and which diagram covers each, then every diagram with its notes and text exports (specifications, tables, stories). The `.pdf` next to it is the same document with the images, ready to read.

To get the same project inside the app, use *Load the example project* at the bottom of the diagram list. To regenerate this folder after changing the app, run `npm run build && npm run examples` (this needs pandoc for the PDFs).
