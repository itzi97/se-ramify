/**
 * "A new version is out": once a day the app asks GitHub for the latest
 * release (one anonymous request, can be turned off in Help) and offers the
 * download page. Nothing is downloaded or installed by the app itself.
 */
export const REPO = 'itzi97/se-ramify';
export const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;
const API = `https://api.github.com/repos/${REPO}/releases/latest`;
export const CHECK_EVERY = 20 * 60 * 60 * 1000;

/** "v0.10.1" > "0.9.3"; anything unparsable is never newer. */
export function isNewer(latest: string, current: string): boolean {
  const parse = (v: string) => /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim())?.slice(1).map(Number);
  const a = parse(latest);
  const b = parse(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/** The latest release's version and page, or null (offline, rate-limited, no release). */
export async function latestRelease(fetcher: typeof fetch = fetch): Promise<{ version: string; url: string } | null> {
  try {
    const r = await fetcher(API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return null;
    const j = (await r.json()) as { tag_name?: string; html_url?: string; draft?: boolean };
    if (!j.tag_name || j.draft) return null;
    return { version: j.tag_name.replace(/^v/, ''), url: j.html_url ?? RELEASES_URL };
  } catch {
    return null;
  }
}

/** Open the release page in the browser (desktop: through the opener plugin, scoped to this repo). */
export async function openReleasePage(url = RELEASES_URL) {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } else window.open(url, '_blank', 'noopener');
}
