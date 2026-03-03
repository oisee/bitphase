# Cents/Linear Pitch System & Arbitrary Chip Frequencies

**Date**: 2026-02-25
**Type**: ADR
**Status**: Proposal

## Context

AY-8910 tone periods are inversely proportional to frequency. This means a slide effect of "+10 period units" sounds very different on low notes vs high notes. Chipnomad (by Megus) solved this with a linear pitch system using cents. This document proposes adding similar capabilities to Bitphase.

## The Problem

AY tone period formula:
```
period = chipFrequency / (16 * noteFrequency)
```

At 1.7734 MHz:
- C-2 (65.4 Hz): period = 1696 — a +10 change = +0.6% frequency shift
- C-6 (1046 Hz): period = 106 — a +10 change = +9.4% frequency shift

Slide/vibrato effects specified in "period units" are therefore pitch-dependent and sound uneven across octaves.

## Proposed: Cent-Based Pitch System

**1 cent = 1/100 of a semitone = 1/1200 of an octave**

### Internal Representation

Add a `centPitch` field alongside the existing `tone` period:

```
centPitch = 6900 + (octave * 1200) + (semitone * 100) + fineTune
```

Where C-1 = 0 cents, C#1 = 100, D-1 = 200, ... B-8 = 9500

### Conversion

```
cents -> period: period = chipFreq / (16 * 440 * 2^((cents - 5700) / 1200))
period -> cents: cents = 5700 + 1200 * log2(chipFreq / (16 * period * 440))
```

### Effect Behavior in Cent Mode

| Effect | Period Mode (current) | Cent Mode (new) |
|--------|----------------------|-----------------|
| Slide up 10 | period -= 10 (pitch-dependent) | cents += 10 (uniform ~1/10 semitone) |
| Vibrato depth 20 | +/-20 period units | +/-20 cents (~1/5 semitone) |
| Portamento | speed in period/tick | speed in cents/tick |
| Arpeggio | semitone offsets (already uniform) | same |
| Detune | period offset | cents offset |

### Mode Selection

This should be a **project-level setting**, not a per-channel toggle:
- `pitchMode: 'period' | 'cents'`
- Default: `'period'` for backward compatibility
- When `'cents'`: all slide/vibrato/portamento effects operate in cent space
- Conversion to AY period happens at the final register-write stage

## Arbitrary Chip Frequencies

### Current State

Bitphase already supports:
- Configurable chip frequency in VT2 import (`ChipFreq` field)
- Dynamic 12-TET table generation via `generate12TETTuningTable(chipFrequency)`
- 5 preset tables (PT3 tables 0-4) + custom table support

### What to Add

1. **Project-level chip frequency setting** (currently only used during import)
   - Default: 1773400 Hz (ZX Spectrum standard)
   - Common alternatives: 1750000 Hz (Amstrad CPC), 2000000 Hz (MSX), 750000 Hz (Sinclair QL)
   - Arbitrary value input for exotic setups

2. **Automatic table regeneration** when chip frequency changes
   - Recalculate all 96 note periods for the new frequency
   - Optionally preserve "perfect ratio" tables (table 4) by recalculating from ratios

3. **Table 5 concept** from the chat discussion: tables with "perfect/whole ratios"
   - Just intonation: ratios like 1:1, 9:8, 5:4, 4:3, 3:2, 5:3, 15:8
   - These ratios stay fixed; the base frequency adjusts to the chip clock
   - Trade-off: perfect intervals within a key, but can't modulate freely

### Relationship to Cents

With cent-based pitch, the tuning table becomes a **lookup acceleration** rather than the source of truth:
- Store a precomputed `cents -> period` lookup (with interpolation for sub-cent precision)
- Regenerate on chip frequency change
- Effects operate in cent space; final conversion uses the lookup

## Implementation Notes

- The cent system lives in the pattern processor (public JS/WASM), not in the UI layer
- Existing period-based effects continue to work unchanged in period mode
- Cent mode is opt-in per project
- No breaking changes to the BTP format (add `pitchMode` field to project metadata)

## Decision

Pending. Priority: lower than virtual channel/downmix work, but pairs well with arbitrary chip frequency support.
