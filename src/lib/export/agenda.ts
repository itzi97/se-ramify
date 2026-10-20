/** The hand-in's parts and weights, read back from the intro's Markdown table (for the deck's agenda). */
export function agendaFrom(intro: string[]): { label: string; weight: string }[] {
  return intro
    .filter((l) => l.startsWith('| ') && !/^\|\s*apartado\s*\|/i.test(l))
    .map((l) => l.split('|').map((c) => c.trim()))
    .filter((c) => c.length >= 4 && c[2])
    .map((c) => ({ label: c[1], weight: c[2] }));
}
