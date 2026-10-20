// Write the example project's AI pack (README, PROMPT, SPEC, GUARDRAILS,
// features/) into a folder — what the backlog's "Export AI pack…" button
// writes for any backlog.   npx tsx tests/e2e/ai-pack.ts <dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { exampleProject } from '../../src/lib/examples/project';
import { aiPack } from '../../src/lib/editors/backlog/model';
import type { DiagramOf } from '../../src/lib/model/types';

const out = process.argv[2];
const backlog = exampleProject().find((d) => d.kind === 'backlog') as DiagramOf<'backlog'>;
for (const f of aiPack(backlog.data.product || backlog.title, backlog.data)) {
  const p = join(out, f.path);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, f.content);
  console.log(p);
}
