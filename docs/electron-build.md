# Building Bitphase Desktop (Electron)

Bitphase can be packaged as a standalone desktop app via Electron. Cross-platform builds must be done on the target platform — you cannot build Windows `.exe` on macOS, etc.

## Prerequisites (all platforms)

- **Node.js** v18+
- **pnpm** v10.11.0+
- **Emscripten SDK** with `emcc` in PATH ([install guide](https://emscripten.org/docs/getting_started/downloads.html))
- **Git** (with submodule support)

## Quick Start (any platform)

```bash
git clone --recurse-submodules <repository-url>
cd bitphase
pnpm install
pnpm electron:pack
```

Artifacts appear in `release/`.

## Platform-Specific Instructions

### macOS

Produces two `.dmg` files (Intel x64 + Apple Silicon arm64).

```bash
pnpm install
pnpm electron:pack
```

Output:
```
release/Bitphase-0.1.0-alpha.dmg        # Intel
release/Bitphase-0.1.0-alpha-arm64.dmg  # Apple Silicon
```

Not code-signed for alpha. Users must right-click → Open to bypass Gatekeeper.

### Windows

Produces an `.exe` installer (x64) via NSIS.

```powershell
pnpm install
pnpm electron:pack
```

Output:
```
release\Bitphase-0.1.0-alpha-setup.exe
```

Not code-signed for alpha. Windows SmartScreen will show a warning — click "More info" → "Run anyway".

### Linux

Produces an `.AppImage` (x64).

```bash
pnpm install
pnpm electron:pack
```

Output:
```
release/Bitphase-0.1.0-alpha.AppImage
```

Make it executable before running:
```bash
chmod +x release/Bitphase-0.1.0-alpha.AppImage
./release/Bitphase-0.1.0-alpha.AppImage
```

## Dev Mode (run without packaging)

To launch the Electron app directly from source (for development/testing):

```bash
pnpm electron:dev
```

This builds the web app, compiles the Electron main process, and launches the window.

## How It Works

- The web app is built normally with Vite (`pnpm build` → `dist/`)
- The Electron main process (`electron/main.ts`) is compiled to CJS with tsup
- A custom `app://` protocol serves `dist/` contents, so WASM `fetch()`, JS `import()`, and AudioWorklet `addModule()` all work without `file://` limitations
- `electron-builder` packages everything into a platform-native installer
- No `node_modules` are shipped — the Electron main process is fully bundled

## CI/CD

Push a tag matching `v*` (e.g. `v0.1.0-alpha`) to trigger the GitHub Actions release workflow, which builds all three platforms automatically and creates a draft release with all artifacts.
