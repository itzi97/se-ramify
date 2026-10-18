/**
 * Geoffrey Moore's elevator pitch (Crossing the Chasm), the template the
 * course uses for the product vision. Pure, for tests and exports.
 */
import type { VisionData } from '../../model/types';

export interface VisionField {
  key: keyof VisionData;
  /** The fixed words that come before this blank in the sentence. */
  lead: string;
  label: string;
  hint: string;
}

export const VISION_FIELDS: VisionField[] = [
  { key: 'forWho', lead: 'Para', label: 'Para (cliente objetivo)', hint: 'los socios de bibliotecas municipales' },
  { key: 'who', lead: 'que', label: 'Que (necesidad u oportunidad)', hint: 'quieren saber si un libro está disponible sin desplazarse' },
  { key: 'product', lead: 'el', label: 'El (nombre del producto)', hint: 'BiblioYa' },
  { key: 'isA', lead: 'es un', label: 'Es un (categoría de producto)', hint: 'servicio web y móvil de préstamos' },
  { key: 'that', lead: 'que', label: 'Que (beneficio clave, razón para comprarlo)', hint: 'permite reservar y renovar en dos clics' },
  { key: 'unlike', lead: 'A diferencia de', label: 'A diferencia de (alternativa / competidor)', hint: 'el catálogo OPAC actual' },
  { key: 'ourProduct', lead: 'nuestro producto', label: 'Nuestro producto (diferenciador)', hint: 'avisa cuando el libro vuelve y gestiona la cola de reservas' }
];

/** The sentence as pieces: fixed words and filled (or empty) blanks, for rendering. */
export function visionPieces(v: VisionData): ({ t: 'lead'; text: string } | { t: 'blank'; key: keyof VisionData; text: string; empty: boolean })[] {
  const out: ReturnType<typeof visionPieces> = [];
  const val = (k: keyof VisionData) => (v[k] ?? '').trim().replace(/[.\s]+$/, '');
  VISION_FIELDS.forEach((f, i) => {
    let lead = i === 1 ? ' que' : i === 2 ? ', el' : i === 5 ? '. A diferencia de' : i === 6 ? ', nuestro producto' : i === 0 ? 'Para' : ` ${f.lead}`;
    let text = val(f.key);
    // "de el catálogo" → "del catálogo"
    if (i === 5 && /^el\s/i.test(text)) {
      lead = '. A diferencia del';
      text = text.replace(/^el\s+/i, '');
    }
    out.push({ t: 'lead', text: `${lead} ` });
    out.push({ t: 'blank', key: f.key, text: text || f.label.replace(/^.*\((.*)\)$/, '$1'), empty: !text });
  });
  out.push({ t: 'lead', text: '.' });
  return out;
}

/** "Para X que Y, el Z es un W que V. A diferencia de U, nuestro producto T." */
export function visionSentence(v: VisionData): string {
  return visionPieces(v)
    .map((p) => (p.t === 'blank' ? (p.empty ? `[${p.text}]` : p.text) : p.text))
    .join('');
}

export function visionMarkdown(v: VisionData, title: string): string {
  const rows = VISION_FIELDS.map((f) => `| ${f.label} | ${(v[f.key] ?? '').trim().replace(/\|/g, '\\|').replace(/\n/g, ' ') || '—'} |`);
  return [`# ${title || 'Visión del producto'}`, '', `> ${visionSentence(v)}`, '', '| Plantilla | Contenido |', '|---|---|', ...rows, ''].join('\n');
}
