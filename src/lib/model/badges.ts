/**
 * Colours that carry meaning on story cards (story map, Kanban, backlog, the
 * story fields): MoSCoW priority reads at a glance — Must red, Should orange,
 * Could amber, Won't grey. People's colours are in people.ts.
 */
import { personColor } from './people';

export interface Badge {
  /** Fill. */
  c: string;
  /** Text on it, chosen for contrast (dark on orange and amber). */
  ink: string;
  label: string;
}

const PRIORITY: Record<string, Badge> = {
  Must: { c: '#d9534f', ink: '#ffffff', label: 'Must have' },
  Should: { c: '#e8873a', ink: '#16191d', label: 'Should have' },
  Could: { c: '#e2c044', ink: '#16191d', label: 'Could have' },
  "Won't": { c: '#8d949c', ink: '#16191d', label: "Won't have (this time)" }
};

/** The badge for a MoSCoW priority; a priority typed by hand gets the neutral grey. */
export function priorityBadge(p: string | undefined): Badge | null {
  const v = p?.trim();
  if (!v) return null;
  return PRIORITY[v] ?? PRIORITY[Object.keys(PRIORITY).find((k) => k.toLowerCase() === v.toLowerCase()) ?? ''] ?? { c: '#8d949c', ink: '#16191d', label: v };
}

/** A person's badge: their colour (people.ts) with the text that reads on it. */
export function personBadge(name: string, order?: readonly string[]): { c: string; ink: string } {
  return { c: personColor(name, order), ink: '#ffffff' };
}
