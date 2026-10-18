/**
 * Follow the desktop's look. In the Tauri app the Rust side asks the XDG
 * settings portal (GNOME, KDE Plasma, anything that ships a portal) for the
 * colour scheme and accent colour and pushes changes as events; in a plain
 * browser only `prefers-color-scheme` is available.
 *
 * The person can also pin light or dark; that wins over the desktop.
 */
import { isTauri } from '../storage/diagrams';
import { inkFor, luminance } from '../model/colors';

export type ThemePref = 'system' | 'light' | 'dark';

export interface Appearance {
  scheme: 'dark' | 'light' | 'none';
  /** 0..1 RGB, or null when the desktop has no accent setting. */
  accent: [number, number, number] | null;
}

let desktop: Appearance = { scheme: 'none', accent: null };
let pref: ThemePref = 'system';
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function effectiveScheme(): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  if (desktop.scheme === 'dark' || desktop.scheme === 'light') return desktop.scheme;
  return media?.matches ? 'dark' : 'light';
}

function apply() {
  const root = document.documentElement;
  root.dataset.theme = effectiveScheme();
  if (desktop.accent) {
    const [r, g, b] = desktop.accent.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255)) as [number, number, number];
    root.style.setProperty('--accent', `rgb(${r}, ${g}, ${b})`);
    root.style.setProperty('--accent-ink', inkFor(luminance(desktop.accent)));
    root.dataset.accent = 'desktop';
  } else {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-ink');
    delete root.dataset.accent;
  }
}

export function setThemePref(p: ThemePref) {
  pref = p;
  apply();
}

/** Start following the desktop. Call once; safe to call in the browser too. */
export async function startAppearance(initialPref: ThemePref) {
  pref = initialPref;
  media?.addEventListener('change', apply);
  apply();
  if (!isTauri) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');
    desktop = normalise(await invoke<Appearance>('desktop_appearance'));
    apply();
    await listen<Appearance>('appearance-changed', (e) => {
      desktop = normalise(e.payload);
      apply();
    });
  } catch (err) {
    console.warn('desktop appearance unavailable', err);
  }
}

function normalise(a: Appearance): Appearance {
  const accent = Array.isArray(a.accent) && a.accent.length === 3 && a.accent.every((c) => typeof c === 'number' && c >= 0) ? (a.accent as [number, number, number]) : null;
  return { scheme: a.scheme === 'dark' || a.scheme === 'light' ? a.scheme : 'none', accent };
}
