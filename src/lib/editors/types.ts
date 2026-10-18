/**
 * The contract every editor follows.
 *
 * An editor is a Svelte component with no props. It reads the open diagram
 * from the store (`app.doc`, narrowed with `app.docOf('kind')`) and changes
 * it only through `app.change(fn, coalesceKey?)`, which records undo history
 * and autosaves. It fills the whole area under the top strip
 * (`position: absolute; inset: 0` inside `.editor-area`).
 *
 * For image export it either marks one element with `data-export-root`
 * (the whole diagram at its natural size, not the scrolled viewport) or
 * registers its own source with `app.setImageSource(fn)` on mount (the
 * graph editor does, to frame the Svelte Flow viewport).
 *
 * Text exports (PlantUML, Mermaid, Markdown, Gherkin…) are plain functions
 * from the diagram to strings, so the node tests can call them.
 */
import type { Component } from 'svelte';
import type { DataByKind, DiagramKind, DiagramOf } from '../model/types';

export interface TextExport {
  /** Menu label: "PlantUML (.puml)". */
  label: string;
  /** File extension without the dot. */
  ext: string;
  mime: string;
  /** Builds the file content. */
  build: () => string;
}

export interface EditorModule<K extends DiagramKind> {
  component: Component;
  /** A small, complete example (neutral subject: a library loans system) to start from. */
  example: () => DataByKind[K];
  /** Text exports for this diagram. */
  exports: (doc: DiagramOf<K>) => TextExport[];
  /** Optional text import (e.g. PlantUML-like sequence text) — returns new data or throws a readable error. */
  importText?: { label: string; extensions: string[]; parse: (text: string, current: DataByKind[K]) => DataByKind[K] };
}

export interface ImageSource {
  el: HTMLElement;
  width: number;
  height: number;
  /** Inline style applied to the clone (e.g. the Svelte Flow viewport transform). */
  style?: Record<string, string>;
}
