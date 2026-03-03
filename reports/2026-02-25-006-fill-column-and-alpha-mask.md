# Fill Column & Alpha Mask Layer System

**Date**: 2026-02-25
**Type**: ADR + Design Proposal
**Status**: Proposal

## Summary

Add a **fill instrument column** to the pattern editor and an **alpha mask** to instrument rows. This enables per-channel background layers without requiring extra virtual channel tracks. The fill instrument loops independently and plays through when the primary instrument becomes transparent.

## Motivation

Currently, to mix a kick drum with a bass line on one AY channel, you need virtual channels — separate pattern tracks with priority-based selection. This works but:
- Doubles the visual space in the editor
- Requires managing separate pattern data
- Overkill for the common case of "main sound + background fill"

The fill column approach keeps the pattern compact: one extra field per channel that says "when I'm not playing, play this instead."

## Design

### New Pattern Field: `fill`

Add to the AY schema template:

```
Current:  '{note} {instrument}{envelopeShape}{table}{volume} {effect}'
Proposed: '{note} {instrument}{envelopeShape}{table}{volume} {fill} {effect}'
```

**Field definition**:
```typescript
fill: {
  key: 'fill',
  type: 'symbol',
  length: 2,           // same as instrument: 00-99
  color: 'fill',
  selectable: 'atomic',
  defaultValue: 0,
  allowZeroValue: true,
  usedForBacktracking: true,
  backtrackWhen: 'nonZero'
}
```

**Behavior**:
- `00` or empty = no fill (current behavior)
- `01`-`99` = instrument ID to use as fill layer
- Fill value persists (backtracked) like instrument — set it once, it stays until changed
- Fill instrument plays independently with its own position counter and accumulators

### New InstrumentRow Field: `alpha`

Add to the instrument row model:

```typescript
interface InstrumentRow {
  // ... existing fields ...
  alpha: number         // 0-15, default 15 (fully opaque)
}
```

**Behavior**:
- `alpha = 15`: Primary instrument fully active, fill suppressed
- `alpha = 0`: Primary instrument transparent, fill plays through
- `alpha = 1-14`: Configurable threshold determines crossover

### Downmix Logic

Per tick, per channel, the mixer decides which instrument's output to use:

```
function resolveChannel(primaryState, fillState, alphaThreshold):
  primaryAlpha = currentInstrumentRow.alpha  // 0-15

  if primaryAlpha >= alphaThreshold:
    // Primary is opaque enough — use primary output
    return primaryState
  else if fillState.isActive:
    // Primary is transparent — use fill output
    return fillState
  else:
    // Fill is also inactive — use primary (even if quiet)
    return primaryState
```

**Default threshold**: 8 (configurable per project or per channel group)

This means:
- Instruments with all rows at alpha=15 (default) behave exactly as today
- Setting alpha=0 on tail rows of a drum makes the fill audible during decay
- Setting alpha to intermediate values creates a "priority weight" system

### Processing Pipeline Extension

In `ay-audio-driver.js`, `processInstruments` needs a second pass:

```
1. Process primary instrument (existing logic) -> primaryRegisterState
2. Process fill instrument (parallel logic)    -> fillRegisterState
3. Read alpha from primary's current instrument row
4. Resolve: if alpha < threshold, use fillRegisterState for this channel
5. Write resolved state to registerState.channels[ch]
```

**Fill instrument state** (per channel):
```typescript
fillInstrumentIndex: number        // which instrument is the fill
fillInstrumentPosition: number     // independent position counter
fillToneAccumulator: number        // independent accumulator
fillNoiseAccumulator: number       // independent accumulator
fillEnvelopeAccumulator: number    // independent accumulator
fillAmplitudeSliding: number       // independent sliding
fillActive: boolean                // is the fill currently producing sound
```

The fill instrument loops continuously from the moment it's set. It doesn't need a note trigger — it starts at position 0 and loops forever using the instrument's loop point.

### Fill Note / Pitch

The fill needs a base pitch. Options:

**Option A: Fill uses the channel's current note**
- Simplest: fill instrument reads the same base note as primary
- Works for bass fills (same pitch as the melodic context)
- Doesn't work for cross-pitch fills (e.g., arpeggio fill over melody)

**Option B: Fill has its own note column**
- More flexible but adds another column to the UI
- Might be too heavy for "simple" approach

**Option C: Fill note is set once and persists** (Recommended)
- Add a `fillNote` field alongside `fill` instrument
- When `fillNote` is set, the fill uses that pitch
- When `fillNote` is empty, the fill uses the channel's current note
- Pattern template: `'{note} {instrument}{envelopeShape}{table}{volume} {fill}{fillNote} {effect}'`

### Interaction with Virtual Channels

Fill columns and virtual channels are complementary:

- **Fill column**: Simple background layer, no extra pattern track, one fill per channel
- **Virtual channels**: Full independent pattern tracks, unlimited layers, priority-based

A channel with a fill AND in a virtual channel group would:
1. First resolve fill (alpha mask) -> single channel output
2. Then participate in virtual channel priority selection

This means a virtual channel group of 2 tracks, each with their own fill, gives you 4 effective layers on one hardware channel — without 4 pattern tracks.

### Interaction with Existing Activity Detection

The virtual channel mixer's `_isChannelActive` check now considers the resolved output:

```javascript
_isChannelActive(vch, registerState, state) {
  // After fill resolution, registerState already has the "winner"
  if (!state.channelSoundEnabled[vch]) return false
  const vol = registerState.channels[vch]?.volume ?? 0
  return (vol & 0x0f) > 0 || (vol & 0x10) !== 0
}
```

If primary is silent but fill is playing, the channel is active (fill keeps it alive). This means a fill instrument effectively extends a channel's "active" duration for virtual channel priority purposes — which is exactly what you want.

## UI Considerations

### Instrument Editor

Add an `Alpha` column to the instrument row editor (next to Volume):

```
T N E  Tone   Noise  Vol  Alpha  Acc  Loop
x . .  +0029  +00    F    F      ^    .
x . .  +0029  +00    E    F      ^    .
x . .  +0029  +00    C    8      ^    .     <- alpha drops, fill starts showing
x . .  +0029  +00    8    4      ^    .
x . .  +0000  +00    0    0      .    L     <- fully transparent, fill plays
```

Alpha defaults to F (15) for all existing instruments — zero behavior change.

### Pattern Editor

The fill column renders as 2 hex chars (instrument ID), with a distinct color to differentiate from the primary instrument:

```
C-4 01F1F 03 1234    <- note=C-4, instr=01, fill=03, effect=1234
--- ..... .. ....    <- empty row, fill 03 continues looping
D-5 02... .. ....    <- new note, new instrument, fill 03 still active
--- ..... 00 ....    <- fill cleared (set to 00)
```

### Fill Column with Fill Note (Option C)

```
C-4 01F1F 03C-2 1234    <- fill=instrument 03 at C-2
--- ..... ..... ....    <- fill loops at C-2
D-5 02... ..... ....    <- primary changes, fill unchanged
--- ..... ..D-3 ....    <- fill pitch changes to D-3, instrument stays 03
```

## Data Model Changes

### Song Model

```typescript
// In Row class (per-channel row data)
class Row {
  note: Note
  effects: (Effect | null)[]
  fill: number              // NEW: fill instrument ID (0 = none)
  fillNote: Note            // NEW: fill base note (optional)
  // ... existing dynamic fields from schema
}
```

### Project Format (BTP)

Add `fill` and `fillNote` to saved pattern data. Backward compatible: missing fields default to 0/None.

### State Arrays (ay-audio-driver.js)

```javascript
// NEW per-channel state for fill instrument
state.channelFillInstruments = new Array(channelCount).fill(-1)
state.fillInstrumentPositions = new Array(channelCount).fill(0)
state.fillToneAccumulators = new Array(channelCount).fill(0)
state.fillNoiseAccumulators = new Array(channelCount).fill(0)
state.fillEnvelopeAccumulators = new Array(channelCount).fill(0)
state.fillAmplitudeSliding = new Array(channelCount).fill(0)
state.fillBaseNotes = new Array(channelCount).fill(0)
```

## Implementation Plan

### Phase 1: Alpha Mask (instrument-only change)
1. Add `alpha` field to InstrumentRow model
2. Add alpha column to instrument editor UI
3. Default alpha=15 for all existing/imported instruments
4. No behavioral change yet — just data

### Phase 2: Fill Column (pattern + driver change)
1. Add `fill` field to AY schema
2. Add fill state arrays to audio driver
3. Implement fill instrument processing (parallel to primary)
4. Implement alpha-based resolution in processInstruments
5. Update pattern renderer for fill column
6. Update pattern editing service for fill field input

### Phase 3: Fill Note
1. Add `fillNote` field to schema
2. Implement fill pitch from fillNote (fall back to channel note)
3. Update pattern renderer and editor

### Phase 4: Integration with Virtual Channels
1. Ensure fill resolution happens before virtual channel mixing
2. Test: fill keeps channel "active" for priority purposes
3. Test: fill + virtual channels = 4 effective layers

## Open Questions

1. Should fills also be able to have their own fill? No, one layer is enough.
2. Should alpha be per-instrument-row (fine-grained) or per-instrument (coarse)? Per-row is more powerful and consistent with other per-row fields.
3. Should the alpha threshold be global, per-project, or per-channel? Start with per-project, add per-channel later if needed.
4. What happens when fill instrument has alpha < 15? Ignored — alpha only matters on the primary instrument. Fill is always "opaque" relative to silence.
