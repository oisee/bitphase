# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Bitphase is a chiptune tracker for creating music on retro sound chips. Built with Svelte 5, TypeScript, Vite, and Tailwind 4. Currently supports AY-3-8910/YM2149F chip, with architecture designed for future chip support.

## Commands

- `pnpm dev` — Start dev server (builds WASM first)
- `pnpm build` — Production build
- `pnpm check` — TypeScript and Svelte type checking (run this to catch lint errors)
- `pnpm test` — Run tests in watch mode (vitest)
- `pnpm test:run` — Run tests once
- `pnpm vitest run tests/path/to/file.test.ts` — Run a single test file
- `pnpm build:wasm` — Rebuild WASM only (requires Emscripten SDK with `emcc` in PATH)

## Architecture

### Directory Structure

- `src/lib/chips/` — Chip implementations. Each chip has: `schema.ts`, `adapter.ts`, `renderer.ts`, `types.ts`
  - `base/` — Base interfaces and generic definitions
  - `ay/` — AY-3-8910 implementation
- `src/lib/models/` — Domain models: `project.ts`, `song.ts`, `project-fields.ts`
- `src/lib/services/` — Business logic: `audio/`, `file/` (import/export), `pattern/` (editing, navigation, clipboard), `project/`, `modal/`
- `src/lib/stores/` — Reactive state using `.svelte.ts` files with `$state` rune
- `src/lib/ui-rendering/` — Canvas-based renderers for pattern editor and order list
- `src/lib/components/` — UI components organized by feature
- `src/lib/config/` — App configuration (menu definitions, settings)
- `tests/` — Test files mirroring `src/` structure
- `external/ayumi/` — AY-8910 emulator C code, compiled to WASM → `public/ayumi.wasm`

### Key Patterns

- **Chip abstraction**: Never hardcode chip-specific features in generic code. Use `src/lib/chips/base/schema.ts` for generic definitions. Chips implement adapters and renderers extending base classes. AY-specific code must stay in `src/lib/chips/ay/`.
- **State management**: Svelte 5 runes (`$state`, `$derived`, `$effect`) in `.svelte.ts` files. Do not use writable stores.
- **Pattern editing**: Field-based editing system in `src/lib/services/pattern/editing/` with strategies per field type.
- **Path alias**: `@` maps to `./src` (configured in both vite and vitest).

## Code Style

- Svelte 5 syntax only — runes, `onclick` not `on:click`, `{#snippet}` not slots
- No comments in code — write self-documenting code
- Tailwind 4 for styling
- Follow KISS, DRY, SOLID principles with good OOP practices
- Never allow lint errors — run `pnpm check` to verify. We had production bugs from lint errors.
