# Session Mode, Clips, Live Fluff & N-AY Routing

**Date**: 2026-03-01
**Type**: Brainstorm / Feature Vision
**Status**: Draft
**Related**: [002-fluffenfall-integration](./2026-02-25-002-fluffenfall-integration.md), [004-multi-ay-routing](./2026-02-25-004-multi-ay-routing.md), [005-brainstorm-synthesis](./2026-02-25-005-brainstorm-synthesis.md)

## What is Fluffenfall?

A **post-processor** for PSG streams. You take a finished AY recording (PSG file) and apply "fluff" transformations -- channel remapping, octave shifting, rhythmic duplication/skipping -- frame by frame. Key fluff types:

- **GoRound** -- rotates channel data cyclically (a->b->c->a) at a configurable speed, creating arpeggio/harmony effects
- **Syncopa** -- rhythmic dup/skip patterns creating swing emphasis
- **OctavedGoRound** -- GoRound + automatic octave shifts via bit-shifting periods
- Arbitrary **channel remapping** -- any output channel can source from any input (including envelope->tone, noise->tone with frequency scaling)

The core primitive is the **FluffFrame**: per-channel source mapping + period/volume/mixer modifications + offsets for lookahead/lookback.

Source: `/Users/alice/dev/fluffenfall/`

## Vision: Two Modes, One Project

### Tracker Mode (existing)
Compose with patterns, instruments, virtual channels, alpha masks -> produces a register stream.

### Session Mode (new -- Ableton Live / Launchpad-style)
A performance view where:
- **Clips** (captured register streams) sit in a launchpad grid
- **Fluff layers** are live effects applied to playing clips
- You **jam** -- launching clips, tweaking fluff parameters in real-time
- The session **records** your launches + parameter moves
- You **render** the result back into clips or pattern data for the tracker

The bridge flows both ways:
```
Tracker patterns -> [capture] -> Clips
Clips -> [perform + fluff] -> [render/flatten] -> Tracker patterns
```

## N-AY Virtual Chips with Routing

Instead of fixed "1 AY" or "TurboSound", define an arbitrary chip stack:

```
Project Chip Stack:
  AY-0 (1.7734 MHz)   <- standard ZX Spectrum
  AY-1 (1.7734 MHz)   <- TurboSound second chip
  AY-2 (2.0 MHz)      <- custom config
```

Each gives 3 tone channels = 9 total hardware outputs. Virtual channels route to any of them. Clips and fluff also target specific AY chips. A clip captured from AY-0 can be rerouted to AY-2 with a fluff layer that does octave shifting to compensate for the different clock.

## Clips as Register Streams

```typescript
interface Clip {
  id: string
  name: string
  frames: ChipFrame[]    // raw AY register data per tick
  length: number         // in ticks
  loopPoint?: number     // where to loop back to (-1 = no loop)
  sourceChannels: number // how many channels this clip covers (1 or 3)
  chipClock: number      // clock rate it was captured at
}
```

**Single-channel clips** (1 tone channel worth of data) are the most flexible -- slot into any channel. **Full-chip clips** (3 channels + shared noise/envelope) preserve the original noise/envelope relationships.

## Fluff Layers as Live Effects

Fluffenfall's primitives map to familiar DJ/producer effects:

| Effect | Fluff Implementation |
|--------|---------------------|
| **Delay/Echo** | `offset: -N` -- read from N frames ago, volume reduced |
| **Stutter** | `repeat: N` -- freeze current frame, replay it N times |
| **Repeater** | Short loop: `offset` cycles through a small range (1/2, 1/4, 1/8, 1/16 beat divisions) |
| **Filter (lo-pass feel)** | Reduce volume on high-period frames, or force mixer bits off. Not a real filter but sounds like one on AY |
| **Flanger** | Two reads of source at offsets 0 and +/-1-3, alternating which gets priority |
| **Chorus** | Multiple reads at varying offsets with slight `period +1/-1` detuning |
| **Bitcrusher/Decimator** | `period shift >> N` -- destroys pitch resolution |
| **Ring mod** | Source from noise channel (`noise2tone`) -- imposes noise period on tone |
| **GoRound** | Channel rotation at configurable speed -- the classic |
| **Syncopa** | Rhythmic dup/skip -- swing/shuffle generator |

### GarageBand iPad Holy Trinity (as Fluff)

The three GarageBand iPad live effects that work beautifully as fluff layers:

1. **Filter** -- not a real DSP filter on AY, but volume gating + mixer bit manipulation creates the impression. Low values = only volume-loud frames pass; high values = everything passes. Sweep the cutoff = sweep the volume threshold.

2. **Stutter/Repeater** -- `repeat` flag + `offset` cycling. At 1/4 division: freeze and replay every 4th frame. At 1/16: extreme glitch. The `dup` flag gives you double-time. Map a single knob to division rate.

3. **Flanger** -- two reads of the same source at offset 0 and offset N (where N oscillates slowly). Since AY can't mix two signals on one channel, alternate which read gets priority each frame. Creates the characteristic sweeping comb effect through rapid switching.

### Meta-Parameters

Each fluff layer exposes high-level knobs that generate the low-level FluffFrame arrays:

```typescript
interface FluffLayerMeta {
  type: 'delay' | 'stutter' | 'repeater' | 'filter' | 'goround' | 'syncopa' | ...
  wet: number        // 0-15: alpha blend between dry and effected
  rate: number       // speed/division parameter
  depth: number      // intensity (maps to offset magnitude, volume reduction, shift)
  feedback: number   // for delay: how many echo taps
}
```

These are what you'd map to a MIDI controller, touchscreen XY pad, or on-screen knobs -- high-level performance controls.

## Session View Layout

```
         +-----------------------------------------------------+
         |  AY-0.A    AY-0.B    AY-0.C   | AY-1.A   AY-1.B   |
         +---------------------------------+--------------------+
Scene 1  | [Lead-1] [Bass-1]  [Drums-1]  | [Pad-1]  [Arp-1]  |
Scene 2  | [Lead-2] [Bass-1]  [Drums-2]  | [Pad-2]  [Arp-2]  |
Scene 3  | [Lead-1] [Bass-2]  [Break-1]  | [Pad-1]  [---  ]  |
         +---------------------------------+--------------------+
Fluff    | [Delay ] [------]  [Stutter]  | [GoRnd]  [------]  |
         +---------------------------------+--------------------+
         [> Scene 1]  [* REC]                    [BPM: 125]
```

- **Columns** = hardware channels (grouped by AY chip)
- **Rows** = scenes (launch an entire row at once)
- **Cells** = clip references (click to launch/stop independently)
- **Fluff row** = per-channel effect chain (click to open parameter panel)
- **Scene launch** = triggers all clips in a row, quantized to beat/pattern boundary

## Recording the Session

When you hit REC in session mode, it captures:

```typescript
interface SessionRecording {
  events: SessionEvent[]
  automation: AutomationLane[]
}

interface SessionEvent {
  tick: number
  type: 'clip-launch' | 'clip-stop' | 'scene-launch'
  channel?: number
  clipId?: string
  sceneIndex?: number
}

interface AutomationLane {
  target: { channel: number, fluffLayer: number, param: string }
  points: { tick: number, value: number }[]
}
```

This recording IS your arrangement. You can:
1. **Play it back** -- relive your performance
2. **Flatten it** -- render each channel's output (clips + fluff) into raw ChipFrame[], then convert to pattern data
3. **Edit it** -- move events around, adjust automation

## Back to Tracker: How Clips Integrate

Three options; **A + C combined** is recommended:

### Option A: Clip-instrument
A clip acts like a special instrument. Place it on a row, the channel plays the clip's register stream instead of generating from instrument data.

```
Row  Note  Inst  Vol  Fx
00   C-4   C01   --   ---    <- C01 is a clip-instrument, C-4 = no transpose
01   ...   ...   --   ---
02   ...   ...   --   ---    <- clip keeps playing
03   ===   ...   --   ---    <- clip stops
```

### Option B: Clip column (per-channel)
Each channel gets an optional "CL" column. When a clip ID appears, it starts playing on that channel.

```
Row  Note  Inst  Vol  CL   Fx
00   C-4   01    --   --   ---   <- normal instrument
01   ---   --    --   C3   ---   <- clip C3 starts, overrides instrument
02   ---   --    --   --   ---   <- clip continues
03   ---   --    --   ^^   ---   <- clip stops
```

### Option C: Clip launcher as virtual channel
A special virtual channel type that only plays clips. Lowest priority -- fills silence.

```
Channel layout:
  [Lead (inst)] [Bass (inst)] [Drums (inst)] | [Clip-A] [Clip-B] [Clip-C]
                                              ^ lowest priority, fills gaps
```

### Recommended: A + C
- **Clip-instruments** (A) for surgical placement in tracker -- put clips exactly where you want
- **Clip channels** (C) for laying down a session recording as a background layer
- Both use the same Clip data type, triggered differently
- Alpha masking controls the blend: composed channels at alpha=15 always win, clip channels at lower alpha fill gaps

## The Full Pipeline

```
1. COMPOSE in Tracker
   patterns -> instruments -> virtual channels -> AY register stream
                                                      |
2. CAPTURE to Clips                              [record output]
   register stream -> Clip objects                     |
3. JAM in Session Mode                           [launchpad grid]
   clips -> fluff layers -> live performance           |
4. RECORD Session                                [capture events + automation]
   clip launches + fluff params -> SessionRecording    |
5. FLATTEN / RENDER                              [render to register stream]
   session recording -> finalized Clip or patterns     |
6. BACK TO TRACKER                               [clip-instruments or clip channels]
   finalized clips -> pattern data
```

## Phased Implementation

| Phase | What | Value |
|-------|------|-------|
| **0** | N-AY chip stack + routing config | Foundation for everything |
| **1** | Clip capture during playback | "Record what you hear" |
| **2** | Clip playback as instrument | Use clips in tracker |
| **3** | Port fluffenfall engine to Bitphase | Effect processing core |
| **4** | Fluff meta-parameters + presets | Stutter, delay, filter etc. as one-knob effects |
| **5** | Session view UI (launchpad grid) | Visual clip launching |
| **6** | Session recording + playback | Capture performances |
| **7** | Flatten/render session to patterns | Close the loop |
| **8** | MIDI controller mapping | Physical launchpad support |

## Open Questions

1. Should clips store per-channel or per-chip (3-channel) data? Per-channel is more flexible but loses noise/envelope coupling.
2. How to handle clip clock rate mismatch when routing to AY chips with different clocks? Auto-resample periods?
3. Should fluff layers be per-clip, per-channel, or per-scene? (Probably per-channel, matching Ableton's device chain model.)
4. Session mode quantization: quantize clip launches to beat/bar/pattern boundary? Configurable grid?
5. How deep should the GarageBand-style effect panel go? Simple XY pad + 3 effect slots, or full modular fluff chain?
6. Can we do real-time fluff preview in the tracker (not just session mode)? E.g., "preview with delay" button on a channel?
