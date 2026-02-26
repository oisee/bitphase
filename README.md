# Bitphase

<div align="center">
  <img src="public/logo.svg" alt="Logo" width="300" />
</div>

[Bitphase](https://bitphase.app/)

A modern web-based chiptune tracker designed for creating music on retro sound chips. Currently supports the AY-3-8910 / YM2149F chip (used in ZX Spectrum and other 8-bit computers), with plans to support additional chips in the future.

## Changelog

### Pattern Editor Navigation
- **Ctrl+Left / Ctrl+Right** — Jump between channels
- **Ctrl+Up / Ctrl+Down** — Jump to first / last row (Home / End)

### Natural Tuning Tables
- Natural (just intonation) tuning now supports **all 12 root notes** (C through B)
- Root note selector appears when Natural tuning table is selected
- Uses just intonation ratios: 1, 16/15, 9/8, 6/5, 5/4, 4/3, 64/45, 3/2, 8/5, 5/3, 16/9, 15/8

### Instrument Editor
- **Duplicate row** button (copy icon) per row
- **Add new row** button at the top of the table
- Row actions always visible: delete, duplicate, delete-below

### Table Editor (Arpeggios)
- **Duplicate row** button (copy icon) per row
- **Add new row** button at the top of the table

### Resizable Right Panel
- Drag the left edge of the right panel to resize
- Panel width persisted across sessions (localStorage)

### Persistent Settings
- **Hex mode** toggle persisted across browser sessions (shared between Instruments and Tables views)

### Alpha Mask (Virtual Channel Gating)

Each instrument row has an **alpha** field (0–F), visible as the **α** column in the instrument editor. Alpha controls **virtual channel priority** — it determines which virtual channel gets to play on a shared hardware channel.

**How it works:**

When multiple virtual channels (e.g. A, A', A'') share one hardware channel, alpha on the **primary** (leftmost) channel acts as a gate:

- **Alpha = F (15)**: Fully opaque — primary channel always wins, even if silent. This is the default, so existing songs are unaffected.
- **Alpha = 0**: Fully transparent — any active underlying channel punches through.
- **Alpha 1–E**: Threshold gate — an underlying channel wins only if its alpha **exceeds** the primary's alpha.
- Among qualifying underlying channels, **leftmost** (highest priority) wins.
- If no underlying channel qualifies, the primary still plays.

**Key detail:** Alpha is the **sole gating mechanism**. A silent primary with alpha=F produces opaque silence (blocks underlying channels). A silent primary with alpha=0 is transparent (lets underlying channels through). Volume and mixer state do not affect priority.

**Gating instrument pattern:**
Create a looping instrument on the primary channel with volume=0 throughout. Set alpha=F on ticks where you want silence, and alpha=0 on ticks where underlying channels should play. This creates rhythmic punch-through patterns without the primary producing any sound.

Alpha values are stored in `.btp` files and default to 15 for older files and VT2/PT3 imports. Single-channel playback (no virtual channels) is unaffected by alpha.

## Prerequisites

- **Node.js** (v18 or higher)
- **pnpm** (v10.11.0 or higher) - Package manager
- **Emscripten SDK** - Required for building WebAssembly modules

### Installing Emscripten

1. Download and install Emscripten from [emscripten.org](https://emscripten.org/docs/getting_started/downloads.html)
2. Set the `EMSDK` environment variable to point to your Emscripten installation
3. Ensure `emcc` is available in your PATH

## Getting Started

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd bitphase
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Build WebAssembly modules**

   ```bash
   pnpm build:wasm
   ```

   This compiles the Ayumi chip emulator to WebAssembly. You only need to run this once, or when the WASM code changes.

4. **Start the development server**

   ```bash
   pnpm dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173` (or the port shown in the terminal)

## Available Scripts

- `pnpm dev` - Build WASM and start development server with hot module replacement
- `pnpm build` - Build WASM and create production build
- `pnpm build:wasm` - Build only the WebAssembly modules
- `pnpm preview` - Preview the production build locally
- `pnpm check` - Run TypeScript and Svelte type checking
- `pnpm test` - Run tests in watch mode
- `pnpm test:run` - Run tests once

## Project Structure

```
bitphase/
├── external/            # Ayumi chip emulator C source by Peter Sovietov
├── public/              # Static assets and compiled WASM (ayumi.wasm, fonts, etc.)
├── src/
│   ├── app.css          # Global styles
│   ├── main.ts          # App entry point
│   ├── App.svelte       # Root component
│   └── lib/
│       ├── chips/       # Chip implementations (AY, future chips)
│       │   ├── ay/      # AY-3-8910 implementation
│       │   └── base/    # Base interfaces and utilities
│       ├── components/  # Svelte UI components
│       │   ├── AppLayout/
│       │   ├── Menu/    # Menu bar and navigation
│       │   ├── Song/    # Pattern editor and song view
│       │   ├── Instruments/
│       │   ├── Modal/
│       │   ├── Settings/
│       │   ├── Tables/
│       │   ├── Theme/
│       │   └── ...
│       ├── config/      # App configuration (menu, settings, themes)
│       ├── models/      # Domain models (Project, Song, etc.)
│       │   ├── pt3/     # PT3 tuning tables
│       │   └── song/    # Song model utilities
│       ├── services/    # Business logic services
│       │   ├── app/     # Menu actions and app context
│       │   ├── audio/   # Audio service and chip processors
│       │   ├── backup/  # Autobackup
│       │   ├── file/    # Import/export functionality
│       │   ├── modal/   # Modal service
│       │   ├── pattern/ # Pattern editing (incl. editing/ subdir)
│       │   ├── project/ # Project service and migration
│       │   ├── theme/   # Theme service
│       │   └── user-scripts/  # User scripts (Lua) execution
│       ├── stores/      # Reactive state (Svelte 5 runes, .svelte.ts)
│       ├── types/       # Shared TypeScript types
│       ├── ui-rendering/# Canvas-based pattern and order list rendering
│       └── utils/       # Utility functions
└── tests/               # Tests mirroring src structure
```
