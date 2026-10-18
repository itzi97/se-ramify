/**
 * Monochrome icons for ideas and groups: Lucide's stroke set (ISC licence),
 * rendered inline so nothing is fetched. An idea's `icon` is the Lucide
 * name in PascalCase ("Lightbulb"); older boards may hold an emoji, which
 * still renders as text.
 */
import { icons } from 'lucide';

export type IconNode = [string, Record<string, string | number>][];

export function iconData(name: string | null | undefined): IconNode | null {
  if (!name) return null;
  return (icons as Record<string, IconNode>)[name] ?? null;
}

/** "ArrowDownUp" -> "arrow down up", for searching and labels. */
export function iconLabel(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').toLowerCase();
}

export const ALL_ICON_NAMES: string[] = Object.keys(icons);

/** A first screen of likely picks, before the person types anything. */
export const QUICK_ICONS = [
  'Lightbulb', 'Star', 'CircleHelp', 'TriangleAlert', 'Check', 'X', 'Flame', 'Target', 'Zap', 'Heart',
  'Brain', 'Rocket', 'Pin', 'Flag', 'Trophy', 'Clock', 'Hourglass', 'Calendar', 'Coins', 'Wallet',
  'PiggyBank', 'Briefcase', 'GraduationCap', 'BookOpen', 'NotebookPen', 'Code', 'Bug', 'FlaskConical',
  'Wrench', 'Palette', 'House', 'Users', 'Smile', 'Frown', 'HeartPulse', 'Dumbbell', 'Salad', 'Bed',
  'Plane', 'Car', 'Globe', 'Map', 'Compass', 'Mail', 'Phone', 'MessageCircle', 'Shield', 'Lock',
  'Laptop', 'Database', 'Cloud', 'Leaf', 'Sun', 'Moon', 'Music', 'Camera', 'Gamepad2', 'Gift', 'Puzzle', 'Sparkles'
];

export function searchIcons(query: string, limit = 60): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return QUICK_ICONS;
  const words = q.split(/\s+/);
  const scored: { name: string; score: number }[] = [];
  for (const name of ALL_ICON_NAMES) {
    const label = iconLabel(name);
    if (!words.every((w) => label.includes(w))) continue;
    // Prefer matches at the start of the label, then shorter names.
    const score = (label.startsWith(q) ? 0 : label.split(' ').some((p) => p.startsWith(words[0])) ? 1 : 2) * 100 + label.length;
    scored.push({ name, score });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((s) => s.name);
}
