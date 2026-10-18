/**
 * Persistence: one JSON file per diagram in a folder the person chooses.
 *
 * Inside Tauri this uses the fs / dialog / store plugins. In a plain browser
 * (`npm run dev` without Tauri) it falls back to localStorage so the UI can
 * be worked on without the desktop shell.
 */
import { metaOf, normalizeDiagram, slug, validateDiagram } from '../model/diagram';
import type { Diagram, DiagramMeta } from '../model/types';

export interface FileKind {
  name: string;
  extensions: string[];
  mime: string;
}

export interface Storage {
  /** Where diagrams live, or null until a folder is picked. */
  getDir(): Promise<string | null>;
  /** Ask for a folder; null if cancelled. */
  pickDir(): Promise<string | null>;
  list(): Promise<DiagramMeta[]>;
  load(path: string): Promise<Diagram>;
  /** Saves and returns the path the diagram now lives at. */
  save(d: Diagram, path?: string): Promise<string>;
  remove(path: string): Promise<void>;
  getSetting<T>(key: string): Promise<T | null>;
  setSetting<T>(key: string, value: T): Promise<void>;
  /** Save a text or binary file the person names. Resolves false if they cancel. */
  exportFile(suggestedName: string, content: string | Uint8Array, kind: FileKind): Promise<boolean>;
  /** Read a file the person picks (import). Null if cancelled. */
  importText(kind: FileKind): Promise<{ name: string; text: string } | null>;
  confirm(message: string, title?: string): Promise<boolean>;
  /** Keep a dated copy outside the diagrams folder; old copies past `keep` are dropped. */
  backup(d: Diagram, keep?: number): Promise<void>;
  listBackups(id: string): Promise<BackupMeta[]>;
  loadBackup(path: string): Promise<Diagram>;
}

export interface BackupMeta {
  path: string;
  when: string;
  title: string;
}

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function fileNameFor(d: Diagram): string {
  return `${d.kind}-${slug(d.title) || 'diagram'}-${d.id.slice(0, 6)}.json`;
}

function parse(text: string, path: string): Diagram {
  const raw = JSON.parse(text);
  const problems = validateDiagram(raw);
  if (problems.length) throw new Error(`${path}: ${problems.join('; ')}`);
  return normalizeDiagram(raw as Diagram);
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
function stampToIso(name: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/.exec(name);
  return m ? `${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z` : name;
}

/** Nextcloud / Syncthing / Dropbox conflict copies are never listed. */
export function isConflictCopy(name: string): boolean {
  return /conflicted copy|sync-conflict/i.test(name);
}

/* ------------------------------------------------------------------ Tauri */

async function tauriStorage(): Promise<Storage> {
  const fs = await import('@tauri-apps/plugin-fs');
  const { open, save: saveDialog, ask } = await import('@tauri-apps/plugin-dialog');
  const { appDataDir } = await import('@tauri-apps/api/path');
  const { load } = await import('@tauri-apps/plugin-store');
  const settings = await load('settings.json', { autoSave: true, defaults: {} });
  const join = (dir: string, name: string) => (dir.endsWith('/') || dir.endsWith('\\') ? dir + name : `${dir}/${name}`);
  const getDir = async () => (await settings.get<string>('dir')) ?? null;

  return {
    getDir,
    async pickDir() {
      const dir = await open({ directory: true, multiple: false, title: 'Choose where se-ramify keeps your diagrams' });
      if (typeof dir !== 'string') return null;
      await settings.set('dir', dir);
      return dir;
    },
    async list() {
      const dir = await getDir();
      if (!dir || !(await fs.exists(dir))) return [];
      const out: DiagramMeta[] = [];
      for (const e of await fs.readDir(dir)) {
        if (!e.isFile || !e.name.endsWith('.json') || e.name.endsWith('.tmp.json') || isConflictCopy(e.name)) continue;
        const path = join(dir, e.name);
        try {
          out.push(metaOf(parse(await fs.readTextFile(path), path), path));
        } catch (err) {
          console.warn('skipping', path, err);
        }
      }
      return out.sort((a, b) => b.updated.localeCompare(a.updated));
    },
    async load(path) {
      return parse(await fs.readTextFile(path), path);
    },
    async save(d, path) {
      const dir = await getDir();
      if (!dir) throw new Error('No folder chosen');
      if (!(await fs.exists(dir))) await fs.mkdir(dir, { recursive: true });
      const target = path ?? join(dir, fileNameFor(d));
      const tmp = target.replace(/\.json$/, '.tmp.json');
      await fs.writeTextFile(tmp, JSON.stringify(d, null, 2));
      await fs.rename(tmp, target);
      return target;
    },
    async remove(path) {
      await fs.remove(path);
    },
    async getSetting<T>(key: string) {
      return (await settings.get<T>(key)) ?? null;
    },
    async setSetting<T>(key: string, value: T) {
      await settings.set(key, value);
    },
    async exportFile(name, content, kind) {
      const dir = (await settings.get<string>('exportDir')) ?? (await getDir());
      const target = await saveDialog({ defaultPath: dir ? join(dir, name) : name, filters: [{ name: kind.name, extensions: kind.extensions }] });
      if (!target) return false;
      if (typeof content === 'string') await fs.writeTextFile(target, content);
      else await fs.writeFile(target, content);
      const sep = Math.max(target.lastIndexOf('/'), target.lastIndexOf('\\'));
      if (sep > 0) await settings.set('exportDir', target.slice(0, sep));
      return true;
    },
    async importText(kind) {
      const picked = await open({ multiple: false, directory: false, filters: [{ name: kind.name, extensions: kind.extensions }] });
      if (typeof picked !== 'string') return null;
      const sep = Math.max(picked.lastIndexOf('/'), picked.lastIndexOf('\\'));
      return { name: picked.slice(sep + 1), text: await fs.readTextFile(picked) };
    },
    async confirm(message, title = 'se-ramify') {
      return ask(message, { title, kind: 'warning', okLabel: 'Yes', cancelLabel: 'No' });
    },
    async backup(d, keep = 30) {
      const dir = join(join(await appDataDir(), 'backups'), d.id);
      if (!(await fs.exists(dir))) await fs.mkdir(dir, { recursive: true });
      await fs.writeTextFile(join(dir, `${stamp()}.json`), JSON.stringify(d));
      const names = (await fs.readDir(dir)).filter((e) => e.isFile && e.name.endsWith('.json')).map((e) => e.name).sort();
      for (const old of names.slice(0, Math.max(0, names.length - keep))) await fs.remove(join(dir, old)).catch(() => {});
    },
    async listBackups(id) {
      const dir = join(join(await appDataDir(), 'backups'), id);
      if (!(await fs.exists(dir))) return [];
      const out: BackupMeta[] = [];
      for (const e of await fs.readDir(dir)) {
        if (!e.isFile || !e.name.endsWith('.json')) continue;
        try {
          const d = JSON.parse(await fs.readTextFile(join(dir, e.name))) as Diagram;
          out.push({ path: join(dir, e.name), when: stampToIso(e.name), title: d.title });
        } catch {
          /* a broken copy is skipped */
        }
      }
      return out.sort((a, b) => b.when.localeCompare(a.when));
    },
    async loadBackup(path) {
      return parse(await fs.readTextFile(path), path);
    }
  };
}

/* ---------------------------------------------------------------- Browser */

function browserStorage(): Storage {
  const PREFIX = 'se-ramify:diagram:';
  const BACKUP = 'se-ramify:backup:';
  const DIR = 'se-ramify:dir';
  return {
    async getDir() {
      return localStorage.getItem(DIR);
    },
    async pickDir() {
      localStorage.setItem(DIR, 'browser-localStorage');
      return 'browser-localStorage';
    },
    async list() {
      const out: DiagramMeta[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        if (!key.startsWith(PREFIX)) continue;
        try {
          out.push(metaOf(parse(localStorage.getItem(key)!, key), key));
        } catch (err) {
          console.warn('skipping', key, err);
        }
      }
      return out.sort((a, b) => b.updated.localeCompare(a.updated));
    },
    async load(path) {
      const text = localStorage.getItem(path);
      if (!text) throw new Error(`missing ${path}`);
      return parse(text, path);
    },
    async save(d, path) {
      const key = path ?? PREFIX + d.id;
      localStorage.setItem(key, JSON.stringify(d));
      return key;
    },
    async remove(path) {
      localStorage.removeItem(path);
    },
    async getSetting<T>(key: string) {
      const raw = localStorage.getItem('se-ramify:setting:' + key);
      return raw === null ? null : (JSON.parse(raw) as T);
    },
    async setSetting<T>(key: string, value: T) {
      localStorage.setItem('se-ramify:setting:' + key, JSON.stringify(value));
    },
    async exportFile(name, content, kind) {
      const blob = new Blob([content as BlobPart], { type: kind.mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    },
    async importText(kind) {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = kind.extensions.map((e) => '.' + e).join(',');
        input.onchange = async () => {
          const f = input.files?.[0];
          resolve(f ? { name: f.name, text: await f.text() } : null);
        };
        input.oncancel = () => resolve(null);
        input.click();
      });
    },
    async confirm(message) {
      return window.confirm(message);
    },
    async backup(d, keep = 10) {
      localStorage.setItem(`${BACKUP}${d.id}:${stamp()}`, JSON.stringify(d));
      const mine = Object.keys(localStorage).filter((k) => k.startsWith(`${BACKUP}${d.id}:`)).sort();
      for (const old of mine.slice(0, Math.max(0, mine.length - keep))) localStorage.removeItem(old);
    },
    async listBackups(id) {
      const out: BackupMeta[] = [];
      for (const k of Object.keys(localStorage)) {
        if (!k.startsWith(`${BACKUP}${id}:`)) continue;
        try {
          const d = JSON.parse(localStorage.getItem(k)!) as Diagram;
          out.push({ path: k, when: stampToIso(k.slice(BACKUP.length + id.length + 1)), title: d.title });
        } catch {
          /* skip */
        }
      }
      return out.sort((a, b) => b.when.localeCompare(a.when));
    },
    async loadBackup(path) {
      const text = localStorage.getItem(path);
      if (!text) throw new Error(`missing ${path}`);
      return parse(text, path);
    }
  };
}

let instance: Promise<Storage> | null = null;
export function storage(): Promise<Storage> {
  return (instance ??= isTauri ? tauriStorage() : Promise.resolve(browserStorage()));
}
