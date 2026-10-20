/** Markdown and CSV exports of a TCO. Pure. */
import type { TcoData } from '../../model/types';
import { BLOCKS, WHEN, blockInfo, cheapest, eur, horizon, lineYears, scoreOf, sum, summarizeAll, weightShare, weightedScore } from './model';

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();
const pct = (v: number) => `${Math.round(v * 100)} %`;
const score = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function tcoMarkdown(data: TcoData, title: string): string {
  const years = horizon(data);
  const yHead = Array.from({ length: years }, (_, i) => `Año ${i + 1}`);
  const sums = summarizeAll(data);
  const out = [`# ${title}`, '', `_Coste total de propiedad a ${years} ${years === 1 ? 'año' : 'años'}, sin inflación ni tasa de descuento. Importes en euros._`, ''];

  data.alternatives.forEach((alt, ai) => {
    const s = sums[ai];
    out.push(`## ${alt.name}`, '');
    if (alt.description.trim()) out.push(alt.description.trim(), '');
    out.push(`| Bloque | Concepto | Tipo | Pago | ${yHead.join(' | ')} | Total | Fuente |`, `|---|---|---|---|${yHead.map(() => '---:|').join('')}---:|---|`);
    for (const b of BLOCKS) {
      for (const l of alt.lines.filter((x) => x.block === b.key)) {
        const ys = lineYears(l, years);
        const when = WHEN.find((w) => w.key === l.when)?.label ?? '';
        const pay = l.when === 'once' ? `${when} (año ${l.year})` : `${when}${l.year > 1 ? ` desde el año ${l.year}` : ''}`;
        out.push(`| ${b.short} | ${cell(l.name || '—')}${l.qty !== 1 ? ` (×${l.qty})` : ''} | ${l.nature === 'capex' ? 'CAPEX' : 'OPEX'} | ${pay} | ${ys.map((v) => eur(v)).join(' | ')} | **${eur(sum(ys))}** | ${cell(l.source)} |`);
      }
    }
    out.push(`| | **Total** | | | ${s.perYear.map((v) => `**${eur(v)}**`).join(' | ')} | **${eur(s.total)}** | |`, '');
  });

  out.push('## Resumen', '', `| Alternativa | ${yHead.join(' | ')} | Total ${years} años | CAPEX | OPEX |${data.users > 0 ? ' Por usuario |' : ''}`, `|---|${yHead.map(() => '---:|').join('')}---:|---:|---:|${data.users > 0 ? '---:|' : ''}`);
  for (const s of sums) {
    out.push(`| ${cell(s.name)} | ${s.perYear.map((v) => eur(v)).join(' | ')} | **${eur(s.total)}** | ${eur(s.capex)} | ${eur(s.opex)} |${s.perUser !== null ? ` ${eur(s.perUser, true)} |` : ''}`);
  }
  out.push('');
  out.push(`| Bloque | ${sums.map((s) => cell(s.name)).join(' | ')} |`, `|---|${sums.map(() => '---:|').join('')}`);
  for (const b of BLOCKS) out.push(`| ${b.label} | ${sums.map((s) => eur(s.byBlock[b.key])).join(' | ')} |`);
  out.push('');
  const c = cheapest(data);
  if (c) out.push(`La alternativa más barata a ${years} años es **${c.name}** (${eur(c.total)}), ${eur(c.saving)} menos que ${c.against}.${c.unpriced ? ` _Aún faltan ${c.unpriced} precios: la comparación no es definitiva._` : ''}`, '');
  if (data.users > 0) out.push(`Calculado para ${data.users} usuarios.`, '');

  if (data.criteria.length) {
    out.push('## Comparación cualitativa', '', '_Puntuación de 1 (peor) a 5 (mejor), ponderada por el peso de cada criterio._', '');
    out.push(`| Criterio | Peso | ${data.alternatives.map((a) => cell(a.name)).join(' | ')} |`, `|---|---:|${data.alternatives.map(() => '---:|').join('')}`);
    for (const cr of data.criteria) {
      out.push(`| ${cell(cr.name)} | ${pct(weightShare(data, cr))} | ${data.alternatives.map((a) => scoreOf(data, cr.id, a.id) || '—').join(' | ')} |`);
    }
    out.push(`| **Puntuación ponderada** | | ${data.alternatives.map((a) => `**${score(weightedScore(data, a.id))}**`).join(' | ')} |`, '');
  }

  if (data.recommendation.trim()) out.push('## Recomendación', '', data.recommendation.trim(), '');
  return out.join('\n').trimEnd() + '\n';
}

function csvCell(v: string | number): string {
  const s = typeof v === 'number' ? csvNumber(v) : v;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Decimal comma, no thousands separator: what a Spanish spreadsheet reads as a number. */
function csvNumber(v: number): string {
  return String(Math.round(v * 100) / 100).replace('.', ',');
}

/** One row per line with its yearly cost, for a spreadsheet in Spanish: `;`, decimal comma, UTF-8 BOM. */
export function tcoCsv(data: TcoData): string {
  const years = horizon(data);
  const head = ['Alternativa', 'Bloque', 'Concepto', 'Tipo', 'Pago', 'Año de inicio', 'Precio unitario (€)', 'Cantidad', ...Array.from({ length: years }, (_, i) => `Año ${i + 1} (€)`), 'Total (€)', 'Fuente'];
  const lines = [head.join(';')];
  for (const alt of data.alternatives) {
    for (const l of alt.lines) {
      const ys = lineYears(l, years);
      lines.push(
        [alt.name, blockInfo(l.block).label, l.name, l.nature === 'capex' ? 'CAPEX' : 'OPEX', WHEN.find((w) => w.key === l.when)?.label ?? '', l.year, l.unitCost, l.qty, ...ys, sum(ys), l.source]
          .map(csvCell)
          .join(';')
      );
    }
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}
