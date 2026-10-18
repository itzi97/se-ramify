//! se-ramify desktop shell.
//!
//! All diagram logic lives in the frontend. The Rust side wires up the
//! plugins the UI needs (file system, folder picker, settings store) and,
//! on Linux, reads the desktop's appearance from the XDG settings portal so
//! the app follows GNOME's or KDE's colour scheme and accent colour.
//! Same shell as ramify, minus the network (no AI, no updater).

use serde::Serialize;


/// What the desktop says about how apps should look. `scheme` is "dark",
/// "light" or "none" (no preference / no portal); `accent` is 0..1 RGB.
#[derive(Serialize, Clone, Debug, Default)]
pub struct Appearance {
    scheme: String,
    accent: Option<[f64; 3]>,
}

#[cfg(target_os = "linux")]
mod portal {
    use super::Appearance;
    use ashpd::desktop::settings::{ColorScheme, Settings};
    use futures_util::StreamExt;
    use tauri::{AppHandle, Emitter};

    fn scheme_name(s: ColorScheme) -> &'static str {
        match s {
            ColorScheme::PreferDark => "dark",
            ColorScheme::PreferLight => "light",
            ColorScheme::NoPreference => "none",
        }
    }

    pub async fn read() -> Appearance {
        let Ok(settings) = Settings::new().await else {
            return Appearance::default();
        };
        let scheme = settings.color_scheme().await.map(scheme_name).unwrap_or("none").to_string();
        let accent = settings.accent_color().await.ok().map(|c| [c.red(), c.green(), c.blue()]);
        Appearance { scheme, accent }
    }

    /// Re-read and emit `appearance-changed` whenever the desktop changes either setting.
    pub async fn watch(app: AppHandle) {
        let Ok(settings) = Settings::new().await else { return };
        let scheme = settings.receive_color_scheme_changed().await;
        let accent = settings.receive_accent_color_changed().await;
        let (Ok(mut scheme), Ok(mut accent)) = (scheme, accent) else { return };
        loop {
            tokio::select! {
                s = scheme.next() => { if s.is_none() { break; } }
                a = accent.next() => { if a.is_none() { break; } }
            }
            let _ = app.emit("appearance-changed", read().await);
        }
    }
}

/// Current desktop appearance (Linux: from the XDG portal; elsewhere: nothing,
/// and the UI falls back to `prefers-color-scheme`).
#[tauri::command]
async fn desktop_appearance() -> Appearance {
    #[cfg(target_os = "linux")]
    {
        portal::read().await
    }
    #[cfg(not(target_os = "linux"))]
    {
        Appearance::default()
    }
}

#[cfg(target_os = "linux")]
fn tune_webkit_for_this_machine() {
    use std::path::Path;
    let set_default = |key: &str, value: &str| {
        if std::env::var_os(key).is_none() {
            std::env::set_var(key, value);
        }
    };
    let wayland = std::env::var_os("WAYLAND_DISPLAY").is_some();
    let nvidia = Path::new("/proc/driver/nvidia/version").exists() || Path::new("/sys/module/nvidia").exists();

    // Wayland first: never fall back to XWayland when a Wayland display is
    // there, so the app gets proper scaling, input and decorations.
    if wayland {
        set_default("GDK_BACKEND", "wayland,x11");
    }
    // WebKitGTK's DMA-BUF renderer crashes on the NVIDIA driver ("Error 71
    // (Protocol error) dispatching to Wayland display") and paints a blank
    // window after "Failed to create GBM buffer". Other GPUs are fine and
    // keep the faster path.
    if nvidia {
        set_default("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        set_default("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    } else if !wayland {
        // X11 is best-effort: software compositing is the configuration that
        // works everywhere.
        set_default("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    tune_webkit_for_this_machine();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .invoke_handler(tauri::generate_handler![desktop_appearance])
        .setup(|app| {
            #[cfg(target_os = "linux")]
            {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move { portal::watch(handle).await });
            }
            #[cfg(not(target_os = "linux"))]
            let _ = app; // the portal watcher is Linux-only
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running se-ramify");
}
