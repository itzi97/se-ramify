import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoteHeadings, memoria } from '../src/lib/export/memoria';
import { newDiagram } from '../src/lib/model/diagram';
import { graphExample } from '../src/lib/editors/graph/examples';
import { graphExports } from '../src/lib/editors/graph/export';
import type { DiagramOf } from '../src/lib/model/types';

test('headings move down under the diagram section', () => {
  assert.equal(demoteHeadings('# A\n## B\ntext #not', 2), '### A\n#### B\ntext #not');
  assert.equal(demoteHeadings('###### deep', 3), '###### deep');
});

test('the memoria lists every diagram with its image and its Markdown export', () => {
  const uc = newDiagram('usecase', 'Casos de uso', 'Gimnasio', graphExample('usecase') as never) as DiagramOf<'usecase'>;
  uc.notes = 'Versión para la E2.';
  const specs = graphExports(uc).find((x) => x.ext === 'md')!.build();
  const md = memoria('Gimnasio', [{ doc: uc, image: '01-casos-de-uso.png', markdown: [specs] }]);
  assert.match(md, /^# Gimnasio/);
  assert.match(md, /1\. \[Casos de uso\]/);
  assert.match(md, /## 1\. Casos de uso/);
  assert.match(md, /!\[Casos de uso\]\(01-casos-de-uso\.png\)/);
  assert.match(md, /Versión para la E2\./);
  assert.match(md, /### CU-02 Reservar libro/);
});
