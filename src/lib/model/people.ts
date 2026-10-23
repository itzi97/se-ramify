/**
 * People get a colour of their own — teammates in the list and the top bar,
 * assignees on a Kanban board — the same one everywhere. With the team's
 * roster (everyone who saved in the folder, A–Z) teammates never share one,
 * on every computer, without anyone choosing; anyone else's comes from their
 * name. White text reads on all of these, in both themes; none is the red
 * kept for warnings and Must.
 */
export const PERSON_COLORS = ['#c2410c', '#15803d', '#1d4ed8', '#7e22ce', '#be185d', '#0e7490', '#a16207', '#4338ca', '#0f766e', '#4d7c0f'];

const norm = (name: string) => name.trim().toLowerCase();

export function personColor(name: string, order?: readonly string[]): string {
  const key = norm(name);
  const at = order ? order.findIndex((r) => norm(r) === key) : -1;
  if (at >= 0) return PERSON_COLORS[at % PERSON_COLORS.length];
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  return PERSON_COLORS[Math.abs(h) % PERSON_COLORS.length];
}

/**
 * The order colours are handed out in: the team A–Z, then anyone else
 * (a board's other assignees) A–Z after them, so teammates keep their colour
 * on every board. Names differing only in case or spacing count once.
 */
export function roster(team: Iterable<string | undefined>, others: Iterable<string | undefined> = []): string[] {
  const seen = new Set<string>();
  const take = (names: Iterable<string | undefined>) => {
    const out: string[] = [];
    for (const n of names) {
      const t = n?.trim();
      if (t && !seen.has(norm(t))) (seen.add(norm(t)), out.push(t));
    }
    return out.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  };
  return [...take(team), ...take(others)];
}

/** "Ana María" -> "A" (or "AM" with two letters). */
export function initials(name: string, letters = 1): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const first = [...words[0]][0] ?? '?';
  if (letters < 2 || words.length < 2) return first.toUpperCase();
  return (first + ([...words[1]][0] ?? '')).toUpperCase();
}

/** "hace un momento", but in the UI's English: "just now", "5 min ago", "yesterday", "12 Oct". */
export function ago(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 2 * 86400) return 'yesterday';
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} days ago`;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
