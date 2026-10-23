/**
 * The colours the open diagram's project uses: its own palette (the
 * company's colours, saved in the shared folder for the whole group) or the
 * default one. Everything that offers colours reads `palettes.colors`.
 */
import { app } from './app.svelte';
import { storage } from '../storage/diagrams';
import { slug } from '../model/diagram';
import { DEFAULT_PALETTE, parsePalette, type Palette, type Swatch } from '../model/palette';

export const paletteFile = (project: string) => `palette-${slug(project, 40) || 'sin-proyecto'}.json`;

class Palettes {
  /** The project whose palette is being edited (the dialog is open), or null. */
  editing = $state<string | null>(null);
  /** Per project: its palette, null for "uses the default", missing while not read yet. */
  byProject = $state<Record<string, Palette | null>>({});

  /** The project in front: the open diagram's, else the folder the list shows. */
  get project(): string {
    return app.doc ? app.doc.project || '' : app.cwd;
  }
  get custom(): Palette | null {
    return this.byProject[this.project] ?? null;
  }
  get palette(): Palette {
    return this.custom ?? DEFAULT_PALETTE;
  }
  get colors(): Swatch[] {
    return this.palette.colors;
  }
  /** Just the hex values, in order. */
  get hexes(): string[] {
    return this.palette.colors.map((c) => c.hex);
  }
  /** Colours given out in turn (mind-map branches, story map activities, UP phases): the project's, or `fallback`. */
  cycle(fallback: string[]): string[] {
    return this.custom ? this.hexes : fallback;
  }

  async load(project: string) {
    try {
      const text = await (await storage()).readConfig(paletteFile(project));
      this.byProject = { ...this.byProject, [project]: parsePalette(text) };
    } catch {
      this.byProject = { ...this.byProject, [project]: null };
    }
  }

  /** Save a project's palette for the group; null goes back to the default. */
  async save(project: string, p: Palette | null) {
    const s = await storage();
    try {
      if (p) await s.writeConfig(paletteFile(project), JSON.stringify(p, null, 2) + '\n');
      else await s.removeConfig(paletteFile(project));
      this.byProject = { ...this.byProject, [project]: p };
      app.notify(p ? `"${p.name}" is now the palette of ${project || 'the top folder'}, for everyone in the group.` : 'Back to the default colours.', 'ok');
    } catch (err) {
      app.notify(`Couldn't save the palette: ${err instanceof Error ? err.message : err}`, 'error');
    }
  }
}

export const palettes = new Palettes();
