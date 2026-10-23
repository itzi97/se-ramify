/**
 * Folder paths inside the diagrams folder, written relative to it with "/"
 * ("" is the folder itself, "Neuranet/E2" a subfolder). A diagram's folder is
 * its project. These rules keep names valid on Windows, macOS and Linux.
 */

/** One folder or file name, safe everywhere: no / \ : * ? " < > |, no trailing dots or spaces. */
export function safeName(s: string): string {
  const t = s
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    // A leading dot hides a folder (and the app skips hidden ones): ".NET" becomes "NET".
    .replace(/^[. ]+/, '');
  if (!t) return 'Sin nombre';
  // Names the browser leaves out on purpose, or Windows refuses: kept visible and valid with a "_".
  if (isHidden(t) || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(t)) return `_${t}`.slice(0, 80);
  return t.slice(0, 80);
}

/** "Neuranet / E2 " → "Neuranet/E2": each part made safe, empty parts dropped. */
export function safeFolder(rel: string): string {
  return rel
    .split(/[\\/]+/)
    .map((p) => p.trim())
    .filter((p) => p && p !== '.' && p !== '..')
    .map(safeName)
    .join('/');
}

export const parentOf = (rel: string) => (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');
export const baseName = (rel: string) => rel.slice(rel.lastIndexOf('/') + 1);
export const joinRel = (a: string, b: string) => (a ? (b ? `${a}/${b}` : a) : b);

/** Folders the browser leaves out: hidden ones, the shared settings, tool caches. */
export function isHidden(name: string): boolean {
  return name.startsWith('.') || name === 'se-ramify-config' || name === 'node_modules' || name === '__pycache__' || name.endsWith('.tmp.json');
}

/** Is `rel` the folder `folder` or inside it? */
export const within = (rel: string, folder: string) => !folder || rel === folder || rel.startsWith(folder + '/');

/** "Neuranet/E2/x" → ["", "Neuranet", "Neuranet/E2", "Neuranet/E2/x"]: every folder on the way, for the path bar. */
export function crumbs(rel: string): string[] {
  const parts = rel ? rel.split('/') : [];
  return ['', ...parts.map((_, i) => parts.slice(0, i + 1).join('/'))];
}

/** The icon for a file the app doesn't open itself, by its extension. */
export function fileIcon(name: string): string {
  const ext = name.toLowerCase().slice(name.lastIndexOf('.') + 1);
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) return 'FileImage';
  if (ext === 'pdf') return 'FileText';
  if (['doc', 'docx', 'odt', 'rtf', 'md', 'txt', 'tex'].includes(ext)) return 'FileText';
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return 'FileSpreadsheet';
  if (['ppt', 'pptx', 'odp', 'key'].includes(ext)) return 'Presentation';
  if (['zip', '7z', 'rar', 'tar', 'gz'].includes(ext)) return 'FileArchive';
  if (['puml', 'mmd', 'feature', 'json', 'js', 'ts', 'py', 'java', 'html', 'css', 'sql'].includes(ext)) return 'FileCode';
  if (['mp4', 'mov', 'webm', 'mkv'].includes(ext)) return 'FileVideo';
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'FileAudio';
  return 'File';
}
