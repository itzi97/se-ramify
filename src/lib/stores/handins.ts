/**
 * A project's hand-ins as the checklist sees them: its diagrams (no archived
 * ones, no sync copies, the open one with its unsaved edits) reviewed against
 * the brief plus the group's changes to it. Shared by the checklist and the
 * home screen's progress meters.
 */
import { app } from './app.svelte';
import { storage } from '../storage/diagrams';
import { slug } from '../model/diagram';
import { applyCustom, parseCustom, review, type ChecklistCustom, type DeliverableReview } from '../model/deliverables';
import type { Diagram } from '../model/types';

/** The group's checklist changes live in se-ramify-config/<this name>. */
export const checklistFile = (project: string) => `handins-${slug(project, 40) || 'sin-proyecto'}.json`;

export async function projectDocs(project: string): Promise<Diagram[]> {
  const s = await storage();
  const out: Diagram[] = [];
  for (const m of app.list) {
    if ((m.project || '') !== project || m.archived || m.dupOf || m.conflict) continue;
    if (app.doc && app.doc.id === m.id) out.push(JSON.parse(JSON.stringify(app.doc)) as Diagram);
    else {
      try {
        out.push(await s.load(m.path));
      } catch {
        /* unreadable file: the list already shows it */
      }
    }
  }
  return out;
}

export async function projectCustom(project: string): Promise<ChecklistCustom> {
  return parseCustom(await (await storage()).readConfig(checklistFile(project)));
}

export async function projectReviews(project: string): Promise<DeliverableReview[]> {
  const [docs, custom] = await Promise.all([projectDocs(project), projectCustom(project)]);
  return applyCustom(custom).map((d) => review(d, docs));
}
