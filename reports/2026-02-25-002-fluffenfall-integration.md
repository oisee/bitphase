# Fluffenfall Integration into Bitphase

**Date**: 2026-02-25
**Type**: Technical Analysis + Proposal
**Status**: Proposal

## What is Fluffenfall?

Fluffenfall (`/Users/alice/dev/fluffenfall/`) is a web-based PSG file post-processor that applies frame-level transformations to AY-8910 register streams. Created ~2016 by oisee, it processes PSG files through configurable "fluff" patterns that can reroute channels, add echo/delay, shift octaves, rotate channels, and create syncopation effects.

**Key insight**: Fluffenfall operates on the PSG register level (post-rendering), while Bitphase operates at the pattern/instrument level (pre-rendering). Integration means bringing Fluffenfall's transformation concepts into the pre-rendering pipeline as first-class virtual channel features.

## Fluffenfall Core Concepts

### Frame-Level Transformations

Each fluff frame defines, per output channel:
- **Source** (`s`): Which input channel to read from (a/b/c/e/n)
- **Offset** (`o`): Temporal offset — read from N frames ago (echo/delay)
- **Period modify** (`p`, `pa`): Additive or absolute period change
- **Shift** (`sh`): Bit shift on period (octave transposition)
- **Volume modify** (`v`, `va`): Additive or absolute volume
- **Gate flags** (`t`, `n`, `e`): Tone/noise/envelope enable with AND logic or absolute override

### Channel Rerouting Functions

| Function | What it does |
|----------|-------------|
| `tone2tone` | Standard: read tone channel, write tone channel |
| `tone2env` | Route tone period to envelope period register |
| `env2tone` | Use envelope period as tone frequency |
| `noise2tone` | Convert noise period to tone (shift by 7 bits) |
| `tone2noise` | Convert tone to noise (shift by -7 bits) |
| `env2env` | Envelope to envelope passthrough |
| `noise2env` | Noise period to envelope period |
| `noise2noise` | Noise passthrough |

### Built-in Effect Patterns

- **GoRound**: Circular channel rotation (A->B->C->A) at configurable speed
- **OctavedGoRound**: GoRound + octave shifting on alternating rotations
- **Syncopa**: Rhythmic frame duplication/skipping for syncopation
- **Echo**: Temporal offset with volume reduction

## Integration Strategy

### Phase 1: Echo as Virtual Channel Effect

The simplest and highest-value integration. Add a ring buffer (circular frame history) to each virtual channel group, then allow "echo" virtual channels that read from the buffer.

**Implementation**:
- Ring buffer stores last N frames of register state per virtual channel (N configurable, default 128 = ~2.5s at 50Hz)
- Echo virtual channel has: `sourceChannel`, `delayTicks`, `volumeReduction`
- At mix time, echo channel reads from `buffer[currentTick - delayTicks]`
- Echo channel participates in normal priority selection (typically lowest priority)

**Use case**: The "goodone" cross-stereo technique — original on AY1, delayed+swapped on AY2.

### Phase 2: Channel Rerouting in Downmix Rules

Allow virtual channels to target non-standard registers during downmix:
- **Tone -> Envelope**: Scale tone period (x2 or x4) and write to envelope period register. Enables using a tone channel to drive envelope frequency for bass sounds.
- **Tone -> Noise**: Extract noise frequency from tone period (>>7). Enables pitched noise drums.

These are configured per downmix rule, not per instrument, keeping the instrument system clean.

### Phase 3: Fluff Pattern as Post-Processing Layer

For advanced users, allow attaching a "fluff pattern" to the export pipeline:
- After virtual channel mixing, before PSG output
- Operates on the hardware register stream
- Full Fluffenfall transformation language
- Useful for effects that don't map cleanly to virtual channels (GoRound, Syncopa)

**Format**: Reuse Fluffenfall's JSON fluff format directly. Import the transformation engine.

## What NOT to Integrate

- **Fluffenfall's React UI** — Bitphase has its own Svelte UI
- **PSG file I/O** — Bitphase already handles this
- **Raw frame format** — Bitphase uses typed register state objects

## Files to Reference

- Fluffenfall core: `/Users/alice/dev/fluffenfall/src/lib/applyFluff.js`
- Fluffenfall frame model: `/Users/alice/dev/fluffenfall/src/lib/ChipFrame.js`
- Bitphase mixer: `/Users/alice/dev/bitphase/public/virtual-channel-mixer.js`
- Bitphase PSG export: `/Users/alice/dev/bitphase/src/lib/services/file/psg-export.ts`
- Example fluffs: `/Users/alice/dev/fluffenfall/src/test/echoBC9.fluff.json`
