# Autosiril & MIDI Import for Bitphase

**Date**: 2026-03-01
**Type**: Brainstorm / Feature Vision
**Status**: Draft — superseded by detailed proposal in `autosiril/docs/PROPOSAL-multi-virtual-channel-output.md`
**Related**: [007-session-mode-clips-fluff](./2026-03-01-007-session-mode-clips-fluff-brainstorm.md), [001-virtual-channels](./2026-02-25-001-virtual-channels-downmix-architecture.md)
**Implementation Plan**: See `/Users/alice/dev/autosiril/docs/PROPOSAL-multi-virtual-channel-output.md` for the phased approach (Ruby → JS → Bitphase integration)

## What is Autosiril?

A **MIDI-to-VortexTracker converter** (`/Users/alice/dev/autosiril/`). Converts standard MIDI files into AY-3-8910 tracker modules with sophisticated channel classification, polyphonic ornament generation, echo/delay, and configurable channel mixing.

**Implementations**: Ruby (original + refactored), Go (working). JavaScript port attempted in 2016, failed due to MIDI library bugs and timing precision issues.

### Pipeline

```
MIDI -> parse -> classify channels (mono/poly/drums/envelope)
     -> detect key -> polyphonic flattening -> ornament generation
     -> echo/delay -> channel mixing (N MIDI -> 3 AY channels) -> VortexTracker output
```

### Channel Mapping Syntax

A mini-language for describing MIDI-to-AY mapping:
```
"1d-2me-3p,4m[uf]-5m[2]+,5m[6]-6me[2]+-3p[3]+-2mew+"
  | AY-A: drums(ch1) -> bass+env(ch2) -> poly(ch3)
  | AY-B: melody(ch4) -> melody(ch5, priority mix)
  | AY-C: melody(ch5) -> bass+env(ch6) -> poly(ch3) -> melody+wide-echo(ch2)
```

**Instrument Types**: m=monophonic (highest note), p=polyphonic (chord->ornament), d=drums (lowest note, special sample map)
**Subtypes**: e=envelope (hardware envelope for bass)
**Modifiers**: u=mute echo, w=wide/double echo
**Mixing**: +=priority (muted by higher), -=sequential (plays after higher ends)

### Key Algorithms

| Algorithm | What It Does |
|-----------|-------------|
| Timing conversion | MIDI clocks -> tracker rows: `row = (time / clocks_per_row + 0.5)` |
| Key detection | Penalty-based major scale matching across 12 keys |
| Polyphonic flattening | mono: highest note wins; poly: all notes -> ornament; drums: lowest note |
| Ornament squization | Filter chord offsets by distance from median, normalize to base note |
| Echo placement | Clone note, reduce volume (0.7x, 0.49x), place at delay offset if slot empty |
| Channel mixing | Priority: first active wins; Sequential: try offsets +0..+3 for empty slot |
| Pattern dedup | Identify identical patterns, reuse indices |

### Why the JS Port Failed (2016)

1. MIDI library had parsing bugs (certain files produced wrong timing)
2. Float rounding differences between Ruby and JS affected row placement
3. Complex polyphonic ornament generation was difficult to match exactly
4. Decision: focus on Ruby (stable) + Go (performance) instead

## Proposal: Interactive MIDI Import in Bitphase

Instead of porting autosiril as a standalone tool, build it into Bitphase as an **interactive MIDI import wizard**. Autosiril's algorithms become the engine; Bitphase's UI becomes the interface.

### Why Inside Bitphase?

- **Preview immediately** -- audition the result as you tweak mappings
- **Virtual channels** -- map to unlimited virtual channels, not just 3 hardware
- **Instruments/tables** -- use Bitphase's instrument system, not predefined VT samples
- **Iterate** -- tweak, re-map, adjust without re-running a CLI
- **Clips** -- capture individual MIDI channels as clips for session mode

### Import Wizard Flow

**Step 1: Load MIDI**

Drop a .mid file. Show detected info per MIDI channel:
```
Ch 1:  Piano      | range: C2-C6  | 847 notes | poly detected
Ch 2:  Bass       | range: E1-G3  | 214 notes | mono detected
Ch 3:  Strings    | range: G3-B5  | 156 notes | poly detected
Ch 10: Drums      | 12 unique pitches | drums detected
```
Auto-classify using heuristics (note range, density, MIDI ch10=drums, velocity patterns).

**Step 2: Classify & Configure**

User confirms or overrides auto-detection per channel:

| MIDI Ch | Auto | Override | Type | Subtype | Priority |
|---------|------|----------|------|---------|----------|
| 1 | Piano | Lead | mono | -- | 1 |
| 2 | Bass | Bass | mono | envelope | 2 |
| 3 | Strings | Pad | poly | -- | 3 |
| 10 | Drums | Drums | drums | -- | 0 |

**Step 3: Map to Virtual Channels**

Drag MIDI channels onto Bitphase virtual channel slots:
```
Virtual Ch 0 (AY-0.A): [Drums (ch10)]  <- highest priority
Virtual Ch 1 (AY-0.A): [Bass (ch2)]    <- fills when drums silent
Virtual Ch 2 (AY-0.B): [Lead (ch1)]
Virtual Ch 3 (AY-0.B): [Pad (ch3)]     <- fills when lead silent
Virtual Ch 4 (AY-0.C): [Lead echo]     <- auto-generated echo
Virtual Ch 5 (AY-0.C): [Pad (ch3)]     <- overflow
```

**Step 4: Configure Effects**

Per-channel: echo delay, volume reduction, ornament speed, key transposition.

**Step 5: Preview & Import**

Hit play to audition. Adjust. When happy, commit -> creates patterns, instruments, ornaments in the current project.

### Algorithms to Port (TypeScript)

| Algorithm | Autosiril Source | Bitphase Target |
|-----------|-----------------|-----------------|
| MIDI parsing | `midilib` gem / Go `midi.go` | `@tonejs/midi` or similar modern JS lib |
| Timing conversion | `VNote` (clocks->rows) | New `MidiImportService` |
| Channel classification | Heuristics + CLI syntax | Auto-detect + interactive UI |
| Polyphonic flattening | `flat_cell_mono/poly/drum` | Same algorithm, TS port |
| Ornament generation | `squize_ornament` | Maps to Bitphase table/ornament system |
| Key detection | Penalty-based scale matching | Same algorithm |
| Echo/delay | Clone + volume reduce + offset | Uses virtual channels + alpha |
| Channel mixing | Priority / sequential | Virtual channel priority (already exists!) |
| Pattern output | VortexTracker text format | Direct `Pattern` / `Song` objects |

**Key insight**: Bitphase's virtual channel system already IS autosiril's channel mixer. Priority mixing = virtual channel priority. The mapping step just decides which virtual channels get which MIDI data.

### What's New vs. Autosiril

| Feature | Autosiril | Bitphase MIDI Import |
|---------|-----------|---------------------|
| Channel limit | 3 hardware | Unlimited virtual |
| Mixing | CLI syntax string | Visual drag-and-drop |
| Preview | None (batch) | Real-time playback |
| Echo | Fixed 2-tap | Virtual channel + alpha + fluff |
| Instruments | Predefined VT samples | Bitphase instrument editor |
| Ornaments | Auto-generated, limited | Full table/ornament system |
| Output | VortexTracker .txt | Native .btp project |
| Polyphony | Ornament trick (arp) | Ornament OR spread across virtual channels |
| Re-import | Start over | Tweak and re-map incrementally |

### Connection to Session Mode / Clips

MIDI import feeds directly into the clip + session workflow:

1. Import MIDI -> each channel becomes patterns AND a capturable clip
2. In session mode, MIDI-derived clips sit in the launchpad grid
3. Apply fluff layers (strings get GoRound, drums get stutter)
4. The full MIDI arrangement becomes a starting point for live remixing

### Phased Implementation

**Phase 1 -- Core Engine (no UI)**
- Port autosiril's algorithms to TypeScript in `src/lib/services/midi/`
- MIDI parsing with a modern JS library (e.g., `@tonejs/midi`)
- Timing conversion, note extraction, polyphonic flattening
- Output: Bitphase `Pattern[]` + `Instrument[]`
- Test with autosiril's test MIDI files (`test/flim.mid`, `test/tottoro_example.mid`, etc.)

**Phase 2 -- Import Wizard UI**
- File drop -> channel analysis display
- Classification editor (auto-detect + override)
- Virtual channel mapping (drag-and-drop or simple grid)
- Effect configuration per channel

**Phase 3 -- Preview & Iteration**
- Play button in the wizard (renders to audio in real-time)
- Tweak mappings, hear changes immediately
- "Accept" commits to project

## Open Questions

1. Which JS MIDI library? `@tonejs/midi` is well-maintained and handles SMF1 correctly. Need to verify timing precision matches Ruby's midilib.
2. Should polyphonic channels use ornaments (autosiril style) or spread notes across multiple virtual channels (Bitphase style)? Probably offer both.
3. How to handle MIDI velocity? Autosiril ignores it. Bitphase could map velocity to AY volume (0-15) or to alpha mask values.
4. Should drum mapping be hardcoded (like autosiril's NOTE2DRUM tables) or configurable? A preset system with editable mappings seems right.
5. Should the import wizard be a modal or a full view? Given the complexity, probably a full-screen wizard view.
6. Can we reuse autosiril's Go implementation as a WASM module instead of porting to TS? Would be faster to ship but harder to integrate with Bitphase's data model.

## Source Files Reference

- Autosiril Ruby (original): `/Users/alice/dev/autosiril/autosiril.rb` (1,048 lines)
- Autosiril Ruby (refactored): `/Users/alice/dev/autosiril/autosiril_refactored.rb` (1,185 lines)
- Autosiril Go: `/Users/alice/dev/autosiril/autosiril-go/`
- Test MIDI files: `/Users/alice/dev/autosiril/test/`
- Architecture docs: `/Users/alice/dev/autosiril/docs/Autosiril_Architecture_Report.md`
