# SYNC-NOTES (branch `merge-upstream`, variant A: merge)

Variant A = `git merge upstream/main` into a branch from the fork's `main` (parents: main 1ef26c0, upstream/main 3718b43).
`git merge` stops with **18 conflicting paths**; they were resolved to **exactly the same final tree as branch
`rebase-on-upstream`** (`git diff rebase-on-upstream merge-upstream` is empty, apart from this preface). So everything
below (decisions, alpha semantics, verification, risks) applies to both branches; the per-commit table describes
how B replays the commits, in A the same behaviour arrives as one merge commit.

Conflicts git reported in the merge (path: kind) and how they were resolved (details in the tables below):

- modify/delete (fork edited, upstream deleted/moved): `CLAUDE.md` (dropped), `public/ay-audio-driver.js`,
  `public/virtual-channel-mixer.js` (re-implemented in `public/ay/`, `public/tracker/`),
  `src/lib/services/file/file-import.ts` (alpha + `.txt` re-applied in `project/file-import.ts`)
- content: `README.md`, `package.json`, `pnpm-lock.yaml` (regenerated), `public/ay/ayumi-state.js`,
  `src/lib/chips/ay/AYInstrumentEditor.svelte`, `src/lib/chips/ay/schema.ts`,
  `src/lib/components/Instruments/InstrumentsView.svelte`, `src/lib/components/Menu/MenuBar.svelte`,
  `src/lib/components/Song/SongView.svelte`, `src/lib/components/Tables/TableEditor.svelte`,
  `src/lib/components/Tables/TablesView.svelte`, `src/lib/models/pt3/tuning-tables.ts`,
  `src/lib/services/file/modules/vt-converter.ts`, `src/lib/services/pattern/pattern-navigation.ts`

Because the fork's tree after the merge equals B's tree, A keeps her full history as the first parent: pushing A
to `main` is a fast-forward (no force push).

---

# SYNC-NOTES: oisee/bitphase main brought up to paator/bitphase main

Date: 2026-11-18. Upstream base: `upstream/main` = 3718b43 (2026-11-17). Fork point: 3d76292. Upstream is 400
commits ahead of the fork point, the fork was 12 commits ahead (11 without the PR merge commit 6461dcd).

This file is for the branch `rebase-on-upstream` (B): the fork's commits replayed on top of upstream/main.
Branch `merge-upstream` (A) has the same final tree (see the A section at the end).

## What changed upstream that touched the fork's code

| Area | Upstream now | Consequence for the fork's commits |
|---|---|---|
| Instruments | rows (`rows[]`, `loop`) replaced by **macros** (`instrument.macros.<id> = {values, loop, release?}`); legacy `rows` are migrated on load (`instrument-legacy-migration.ts`) | alpha column / row field has no place: ported as a macro field |
| Instrument editor | rewritten (`AYInstrumentEditor.svelte` + `AYInstrumentClassicMixer/Timer`, shared `RowEditorTable/*`) | her UI edits to the old editor are gone; only the ones that still make sense were re-applied |
| Audio engine | `public/*.js` split into `public/ay/`, `public/tracker/`, `public/nes/`, `public/saa/`; `VirtualChannelMixer` is chip-generic with adapters | `public/ay-audio-driver.js`, `public/virtual-channel-mixer.js` deleted upstream: alpha re-implemented in the new files |
| Virtual channels | max **3** per hardware channel (clamped on load), roles (`timer`), `virtualChannelRoles` | see "Risks" |
| Project | `initialSpeed`, `tempo`, `interruptFrequency` are project settings (Details panel); import modules moved to `services/file/modules/` and `services/file/project/` | speed spinner re-done on `projectStore` |
| Tuning | `generate12TETTuningTable(chipFreq, a4, maxPeriod)`, table #4 "Natural" = fixed PT3 Cmaj/Am | natural roots added next to it |
| Stereo | ABC / ACB / CAB / mono (+ ST mono) | BAC added, also in TAYM/PSG-register import and TAYM export |
| Build | `pnpm build` now also builds the VitePress docs; `docs/` is a docs site; `CLAUDE.md` removed; deploy.yml kept; Node 20 + emsdk 3.1.45 + pnpm 10.11.0 in CI | see below |

## Fate of the fork's commits (B)

| fork commit | fate in B | resulting commit |
|---|---|---|
| af0af10 alpha field (Phase 1) | re-implemented (macro field `alpha` 0-F default F; legacy row `alpha` kept on import) | ee016a2 + eafd19e + the last commit |
| 5ea317f README fill column | folded into the README "Fork additions" section | ee016a2 |
| ca160db nav shortcuts, natural roots, editor UX | **partly applied**: natural root selector, resizable right panel, duplicate-row (in shared row editor, table editor), add-new-row on top of the table editor. **Dropped (upstream has it)**: Ctrl+Left/Right channel jump (= upstream cycle-channel / `moveToPreviousChannel`), Ctrl+Up/Down (= Home/End), persistent Hex mode (= `settingsStore.hexNumerals`), table list height persistence (= upstream resizable list). Instrument editor duplicate-row/add-on-top not re-applied (editor rewritten, instruments are macros) | 3d85a03 |
| c7f8e63 alpha in audio engine (Phase 2) | re-implemented in `public/tracker/virtual-channel-mixer.js` (`_selectVoiceByAlpha`, optional adapter `getChannelAlpha`), `public/ay/ay-audio-driver.js` (`state.channelCurrentAlpha`), `public/ay/ayumi-state.js` | ee016a2 |
| 157f95f alpha = sole gating | **NOT applied as written** (changed semantics, see below) | eafd19e |
| 2fbf003 README alpha docs | rewritten for the new semantics | ee016a2 |
| 36678ef Electron wrapper | applied (electron/, electron-builder.yml, release.yml, docs/electron-build.md, package.json scripts + devDeps `electron`, `electron-builder`, `tsup`, `pnpm.onlyBuiltDependencies`, version 0.1.0-alpha); lockfile regenerated | ebad35b |
| 6461dcd merge of PR #1 | not replayed (same content as 36678ef) | - |
| 69b3022 remove deploy.yml | applied (upstream's deploy.yml was unchanged, so it applies cleanly) | 42749d8 |
| ef0f849 alpha derived for legacy imports; `.txt` as VT2 | `.txt` added to the module picker; alpha derivation **dropped** (not needed under the new rule) | ee016a2 |
| 52114e5 speed spinner, BAC, Scorpion label, natural frequencies | applied: speed spinner (`NumberStepper`, `projectStore.settings.initialSpeed`, with undo history), BAC (+ TAYM/register import tables), "ZX Spectrum / Scorpion" label, 12 "Natural C..B" chip frequencies | 49afcd4 |
| 1ef26c0 GenPlan + reports | applied unchanged (`docs/GenPlan.md`, `reports/`); note `docs/` is now a VitePress site, GenPlan.md is built as an unlisted page (build passes) | e9793dd |
| CLAUDE.md edits (in af0af10, 36678ef) | **dropped**: upstream deleted CLAUDE.md ("I'm not using it"); the old file is in `main` (`git show main:CLAUDE.md`) | - |

## Decisions by Alice (2026-11-18) and what was done

### 1. Opaque silence: an option, default OFF
- Stored per AY song as `alphaOpaqueSilence: boolean` next to the other AY song settings (`stereoLayout`, `stMixing`...), declared in
  `src/lib/chips/ay/schema.ts`. Absent in a file = off. It is saved in the `.btp` and appears in **Details -> AY settings -> "Opaque silence"**
  (the project settings panel), so it can be changed later. It reaches the player like `stereoLayout` (chip setting -> `update_alpha_opaque_silence`
  worklet message) and the offline paths (PSG / WAV / TAYM / VGM exports pass it to `VirtualChannelMixer.configure(..., {alphaOpaqueSilence})`).
- Import flow: when a loaded file has AY virtual channels and does not say (`alphaOpaqueSilence` absent: legacy `.btp`, autooisee output, module/`.txt` import),
  an **Import options** dialog asks once: "Opaque silence (alpha F masks lower virtual channels even when silent)", default unchecked
  (`ImportOptionsModal.svelte`, `needsAlphaOpaqueChoice` / `setAlphaOpaqueSilence` in `file-import.ts`). Cancelling the dialog means off.
- OFF (default): ported rule, the mask applies only while the primary voice plays a row with alpha < F; alpha F / idle / no lane = upstream
  "first sounding channel wins". ON: the fork's rule, a primary that plays an instrument row with alpha F wins even when silent (alpha is the only gate).
  One deliberate difference from her original even when ON: a primary with no sounding instrument (idle, note released, muted, sample instrument) still
  yields to the channels below; in the original code an idle primary counted as alpha F and blocked them, which silences every echo/overlay channel in
  autooisee-style files while the primary is empty.
- Tests: upstream demo regression suite passes with the option off (default); `tests/public/alpha-opaque-silence.test.ts` plays the same project with the
  option on and off and asserts the PSG frames differ exactly where the primary is silent with alpha F (and are identical in the loud tick and on channels B/C),
  save -> load keeps the option, the import-choice flag. Export honours it (PSG tested; WAV/TAYM/VGM take the same `configure` call, not separately tested).

### 2. Virtual channel limit 3 -> 8
- `MAX_VIRTUAL_CHANNELS_PER_HARDWARE_CHANNEL = 8` (`src/lib/models/virtual-channels.ts`); upstream tests that asserted 3 were changed to 8
  (`virtual-channels.test.ts`, `file-import.test.ts`, `virtual-channel-service.test.ts`).
- Things sized by it: pattern editor (the pattern canvas sits in a horizontal scroller, `data-song-pattern-scroll`, with cursor-into-view; with
  tottoro (18 channels) the scroller is 2558 px wide in a 788 px view and scrolls; nothing collapses; no code change needed), mixer / worklet slots (sized by the
  map, no constant), export paths (take the map). Playback cost: the mixer is O(virtual channels) per tick; imrav (18 virtual channels) renders in a few seconds offline.
- autooisee outputs, before (limit 3) -> after (limit 8), channels loaded: tottoro_example 9 -> 18, imrav 9 -> 18, flim 7 -> 10, chronos 6 -> 6.
  PSG frames that changed vs limit 3 (all 16 registers): tottoro 69%, flim 64%, imrav 39%, chronos 0%. autooisee has no PSG renderer of its own
  (it writes `.btp` and VT2 text downmixed to 3 channels), so there is no reference to compare to; limit 8 is right by construction: it loads exactly the
  channels the converter wrote, under the same "first sounding channel wins" rule the converter was designed for; limit 3 dropped channels 4-8.

## Conflicts met while replaying (file, what each side did, choice)

Conflicts are listed for the first replay of each commit; many are the same file because the fork's commits were
written against the old file layout.

| File | Fork | Upstream | Choice |
|---|---|---|---|
| `src/lib/chips/ay/AYInstrumentEditor.svelte` (af0af10, ca160db) | alpha column, duplicate row, add-row on top in the old table editor | editor split into tabs/macro editors | took upstream; alpha is a macro field (auto-rendered), no custom column |
| `src/lib/services/file/modules/vt-converter.ts` (af0af10, ef0f849) | `alpha: 15 / derived` in 3 `InstrumentRow`s | `instrumentFromLegacy(...)` | took upstream (alpha default F comes from the macro field) |
| `src/lib/services/file/file-import.ts` (modify/delete) | `alpha` in `reconstructInstrumentRow`, `.txt` in picker | file moved to `project/file-import.ts` | re-applied both there (alpha only when the row has it) |
| `public/ay-audio-driver.js`, `public/virtual-channel-mixer.js`, `public/ayumi-state.js` (modify/delete or moved) | `channelCurrentAlpha`, alpha gating | moved/rewritten under `public/ay`, `public/tracker` | re-implemented, see above |
| `src/lib/chips/ay/schema.ts` (ca160db, 52114e5) | `naturalRoot` setting, 12 Natural frequencies, BAC | + `stMixing`, `ATARI_ST_CHIP_FREQUENCY`, Sunsoft 5B, `normalizeSettings` | merged: upstream structure + her options; Atari ST value uses the upstream constant |
| `src/lib/models/pt3/tuning-tables.ts` | `generateNaturalTuningTable`, `getNaturalChipFrequency` | `maxPeriod` parameter, `DEFAULT_MAX_PERIOD` | both; her functions use `DEFAULT_MAX_PERIOD` |
| `src/lib/components/Menu/MenuBar.svelte` | hand-written octave/step/speed inputs | `NumberStepper` component | upstream structure; speed spinner added as a `NumberStepper` bound to `projectStore.getInitialSpeed()`; history entry like the Details panel |
| `src/lib/components/Song/SongView.svelte` | resizable right panel (width in localStorage) | right panel with focus handling (`rightPanelEl`, role region) | both: upstream attributes + her width/handle |
| `src/lib/components/Tables/TableEditor.svelte`, `TablesView.svelte`, `Instruments/InstrumentsView.svelte` | duplicate row, add on top, local hex persistence, list-height persistence | shared `RowEditorTable/*`, `settingsStore.hexNumerals`, `useListResize` | upstream; duplicate row + add on top re-added via shared components (`RowEditorActionsCell.onDuplicate`, `NamedRowEditorSync.duplicateRow`) |
| `src/lib/services/pattern/pattern-navigation.ts`, `pattern-keyboard-shortcuts.ts`, `config/keybindings.ts` | `moveToPrevChannel`, Ctrl+arrow bindings | `moveToPreviousChannel/NextChannel` | upstream; her bindings dropped (same actions exist) |
| `README.md` | changelog + alpha docs; Electron section | rewritten README | upstream + "Fork additions" section + Electron section/scripts |
| `package.json` | electron scripts/devDeps/`main`/`pnpm` block, version 0.1.0-alpha | new scripts (`docs:*`, `btp-to-taym/psg`), vitepress | union |
| `pnpm-lock.yaml` | +2800 lines for electron | other deps | regenerated with `pnpm install --no-frozen-lockfile` (pnpm 10.11.0) |
| `CLAUDE.md` (modify/delete) | edited by the fork | deleted | dropped (see table above) |
| `.gitmodules` | `branch = bitphase` for `external/ayumi` | `branch = master`, submodule at e16304f | upstream (the fork's own sha efd8cd5 predates it) |

Post-replay fix-ups (found by checks, not by git): BAC added to the TAYM/PSG-register layout tables
(`taym-builder.ts`, `taym-ay.ts`, `ay-register-import.ts`); instrument row `alpha` was silently dropped by upstream's
`reconstructInstrumentRow` (found with an end-to-end probe: the mask never engaged); fixed.

## Verification (docker node:20 + corepack pnpm 10.11.0, emscripten/emsdk:3.1.45 for the WASM)

- `pnpm check`: 0 errors, 0 warnings.
- `pnpm test:run`: 186 files, 1762 tests pass (upstream main alone: 185 files, 1749 tests; +13 fork tests, incl. an end-to-end alpha playback test that was shown to fail when the mixer gate is disabled).
- `vite build` and `pnpm docs:build`: pass.
- Headless Chrome (CDP): built `dist/` loads, no console errors or exceptions, no 4xx resources, `#speed-input` present.
- autooisee `.btp` (chronos, tottoro_example, flim, imrav): load, legacy `rows` instruments migrate to macros, render to PSG
  byte-identical to plain upstream.
- `npx prettier --check .` reports style issues in 218 files (upstream main alone: 203); upstream CI runs it as non-blocking.

## Risks

1. (resolved, see decision 2) **Virtual channel cap was 3 per hardware channel (upstream).** autooisee writes up to 8 per hardware channel
   (tottoro 6/4/8 -> 3/3/3: 18 channels become 9; imrav 18 -> 9; flim 10 -> 7; chronos 6 stays 6). Surplus channels are
   dropped on load. The cap is `MAX_VIRTUAL_CHANNELS_PER_HARDWARE_CHANNEL` in `src/lib/models/virtual-channels.ts`
   (upstream tests assert 3). Either autooisee stays within 3, or the constant is raised in the fork (and tests adjusted).
2. Alpha: with the option off (default) "opaque silence" is not active (see decision 1).
3. `pnpm build` includes the docs build; `docs/GenPlan.md` and `docs/electron-build.md` are now published as docs pages.
4. Electron wrapper was not run (no display here); `pnpm electron:build-main` was not run either.
5. Instrument editor: duplicate-row / add-on-top not available for instruments (macro editor), only for tables.
