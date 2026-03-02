# Bitphase General Plan

Roadmap and open questions tracked from dev discussions.

## Immediate

### Remove duplicate native menu in Electron
Electron shows its own native menu bar on top of the app's built-in menu. Need to disable the native one (`Menu.setApplicationMenu(null)` or similar). Affects all platforms — Pator confirmed it on Windows, also present on macOS.

### Send accumulated changes as PR to upstream
Alice's fork has several changes ahead of `paator/bitphase`. Package them as a clean PR to upstream.

## Short-Term

### Persist settings to disk in Electron builds
In the web app, settings (theme, keybindings) live in `localStorage` and backups in `IndexedDB`. In Electron, these are tied to the app's Chromium profile path — if users download a new `.exe` each release, they lose everything.

Options to investigate:
- **electron-store** or similar — write settings to a JSON file in the user data directory (`app.getPath('userData')`)
- **Keep using localStorage** — Electron's localStorage persists in `userData/` between runs. The real question is whether NSIS installer overwrites `userData/` on update (it shouldn't)
- **Auto-updater** (`electron-updater`) — handles delta updates without reinstall, preserves all user data automatically. This is how VS Code does it.

### Develop branch + staging URL
Pator suggested: `develop` branch auto-deploys to a separate URL (e.g. `dev.bitphase.app`), while `bitphase.app` only gets stable releases. This protects users from broken builds.

## Clips & Fluff Engine (In Progress)

### Completed (feature/clips-and-fluff)
- Fluffenfall transform engine ported to TypeScript (`src/lib/fluff/`)
- 9 routing functions (tone↔tone, env↔tone, noise↔tone, etc.) + 3 preset generators
- Clip data model (`Clip` class with `ChipFrame[]` frames)
- Clip reactive store (`clipStore` with Svelte 5 `$state` rune)
- Clip capture service (offline, reuses renderer module-loading infrastructure)
- ClipPlayer worklet integration (frame-by-frame playback with loop support)
- Fluff-on-clip integration (pre-computed `applyFluffToClip()`)
- File serialization (clips saved/loaded with `.btp` projects, backward compatible)
- 39 unit tests for fluff engine

### Next Steps
- Clip triggering from pattern effect column (dedicated effect code)
- Minimal UI: "Capture Clip" menu action, clip list panel with play/delete
- Session mode UI (Ableton-style clip grid) — future phase
- Real-time fluff in worklet (streaming transforms) — future phase
- N-AY routing and MIDI mapping — future phase

## Medium-Term

### Auto-updater
Use `electron-updater` (built into electron-builder) to check GitHub Releases for new versions and update in-place. This solves the settings persistence problem entirely since the app directory is updated in-place rather than reinstalled.

### Code signing
Currently unsigned (users must bypass Gatekeeper/SmartScreen). For wider distribution, need:
- **macOS**: Apple Developer ID certificate ($99/yr)
- **Windows**: EV code signing certificate
- Or: distribute via Homebrew / winget / Flathub to sidestep signing

### Tauri migration (future consideration)
Pator mentioned Tauri as a lighter alternative to Electron. Trade-offs:
- Pro: Much smaller binaries (~10MB vs ~110MB), lower memory usage
- Con: Uses system WebView (Safari on macOS) — WebAudio/WASM behavior may differ
- Decision: Stay with Electron for now, revisit once the app is stable
