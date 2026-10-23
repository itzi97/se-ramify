/**
 * The model of a folder (project): read from its class and use case
 * diagrams, cached per file version, so editors can check against it and
 * suggest from it without reading every file on each keystroke.
 */
import { app } from './app.svelte';
import { storage } from '../storage/diagrams';
import { buildModel, type UmlModel } from '../model/uml-model';
import type { Diagram, DiagramMeta } from '../model/types';

const MODEL_KINDS = new Set(['class', 'usecase']);
const cache = new Map<string, { updated: string; doc: Diagram }>();

/** The diagrams the model is read from, as a key that changes when any of them does. */
export function modelSources(project: string): DiagramMeta[] {
  return app.list.filter((m) => MODEL_KINDS.has(m.kind) && (m.project || '') === project && !m.archived && !m.dupOf && !m.conflict);
}
export const modelKey = (project: string) =>
  modelSources(project)
    .map((m) => `${m.path}@${m.updated}`)
    .join('|');

export async function folderModel(project: string): Promise<UmlModel> {
  const s = await storage();
  const docs: Diagram[] = [];
  for (const m of modelSources(project)) {
    const hit = cache.get(m.path);
    if (hit && hit.updated === m.updated) {
      docs.push(hit.doc);
      continue;
    }
    try {
      const doc = await s.load(m.path);
      cache.set(m.path, { updated: m.updated, doc });
      docs.push(doc);
    } catch {
      /* unreadable: the list shows it */
    }
  }
  return buildModel(docs);
}

/** Add an operation line to a class, in whichever class diagram draws it. */
export async function addOperation(diagramId: string, nodeId: string, line: string) {
  const meta = app.list.find((m) => m.id === diagramId && !m.dupOf);
  if (!meta) return app.notify("Couldn't find the class diagram.", 'error');
  await app.patchFile(meta.path, (d) => {
    const n = (d.data as { nodes: { id: string; ops?: string[] }[] }).nodes.find((x) => x.id === nodeId);
    if (n) n.ops = [...(n.ops ?? []), line];
  });
  app.notify(`Added ${line.trim()} to "${meta.title}".`, 'ok', { label: 'Open', run: () => app.open(meta.path) });
}
