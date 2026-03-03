# Multi-AY Chip Routing & Downmix Architecture

**Date**: 2026-02-25
**Type**: ADR
**Status**: Proposal

## Context

Bitphase currently targets a single AY-8910 (3 tone channels + noise + envelope). The community uses TurboSound (2x AY) and even 3x AY configurations. This document proposes a routing architecture that scales from 1 to N AY chips with configurable downmix rules.

## Target Configurations

| Config | Chips | Channels | Use Case |
|--------|-------|----------|----------|
| Standard | 1 AY | 3 tone | ZX Spectrum, Amstrad CPC |
| TurboSound | 2 AY | 6 tone | ZX Spectrum TS, stereo |
| 3x AY | 3 AY | 9 tone | TS-Conf, custom hardware |

Each AY chip has its own independent noise generator (1 shared across 3 channels) and envelope generator (1 shared across 3 channels). This means noise and envelope are per-chip resources, not per-channel.

## Architecture: Virtual -> Routing -> Hardware

```
[Composition Layer]          [Routing Layer]          [Hardware Layer]

 Virtual Ch 0 ----\                                   AY1: A  B  C
 Virtual Ch 1 -----+---> Routing Rules --------+--->
 Virtual Ch 2 ----/       (configurable)       |      AY2: A  B  C
 Virtual Ch 3 ----\                            |
 Virtual Ch 4 -----+-------------------------/       AY3: A  B  C
 Virtual Ch 5 ----/
 ...
 Echo Ch 0 --------> (auto-generated from rules)
 Echo Ch 1 -------->
```

### Routing Rules

Each rule maps a set of virtual channels to a hardware output:

```typescript
interface RoutingConfig {
  targetChips: ChipTarget[]
  rules: RoutingRule[]
}

interface ChipTarget {
  chipIndex: number          // 0, 1, 2
  chipType: 'AY-8910'       // future: 'SN76489', 'SID', etc.
  clockFrequency: number    // Hz
}

interface RoutingRule {
  sources: number[]          // virtual channel indices
  target: { chip: number, channel: number }
  mode: RoutingMode
  config?: EchoConfig | RerouteConfig
}

type RoutingMode =
  | 'priority'              // first active wins (current behavior)
  | 'echo'                  // delayed copy of another channel
  | 'reroute'               // tone->env, tone->noise, etc.

interface EchoConfig {
  sourceChannel: number
  delayTicks: number
  volumeReduction: number   // 0-15
  periodShift?: number      // bit shift for octave change
  channelSwap?: boolean     // for cross-stereo (BAC->CAB)
}

interface RerouteConfig {
  type: 'tone-to-envelope' | 'tone-to-noise' | 'envelope-to-tone'
  periodScale?: number      // multiplier for period conversion
}
```

### Downmix Scenarios

#### Scenario 1: Composing for 2 AY, exporting to 1 AY

User composes with 6 virtual channels. Export options:
- **Full 2-AY PSG**: Two register streams, one per chip
- **Downmixed 1-AY PSG**: Priority-based selection reduces 6 virtuals to 3 hardware channels
- The downmix rules define how the 6 channels collapse

#### Scenario 2: Composing for 1 AY with Fluffenfall echo

User composes with 3 virtual channels for 1 AY. Routing rules add echo channels targeting AY2:
- AY1 gets the direct output
- AY2 gets delayed, volume-reduced, channel-swapped copy
- Export to TurboSound PSG or separate PSG files

#### Scenario 3: Fill empty ticks with background layer

User has 3 primary channels (melody, bass, drums) plus 3 background channels (arpeggios, pads, ambient). Priority rules:
- Primary channels always win when active
- Background channels fill in during silence
- All 6 virtual channels target 3 hardware channels on 1 AY

### Noise & Envelope Constraints

Critical AY limitation: **noise period and envelope are shared per chip** (not per channel).

When routing multiple virtual channels to the same chip:
- **Noise**: If two channels on the same chip use different noise periods, only one can win. Priority rule: highest-priority active channel's noise setting is used.
- **Envelope**: Same constraint. The mixer must select one envelope period/shape per chip.

This is already handled in the current mixer (`_copyChannel` copies global noise/envelope from the selected channel). Multi-AY extends this naturally — each chip gets its own noise/envelope state.

## UI Concept

### Simple Mode (Left-to-Right Hierarchy)

For most users, a simple visual layout:

```
[Virtual Channels]     [Target]
  Ch 0: Lead      ---> AY1.A
  Ch 1: Bass      ---> AY1.A (priority below Lead)
  Ch 2: Drums     ---> AY1.B
  Ch 3: Arp       ---> AY1.B (priority below Drums)
  Ch 4: Pad       ---> AY1.C

  [+ Add Echo Layer]
  Echo of Ch 0    ---> AY2.C (delay: 6, vol: -3)
  Echo of Ch 2    ---> AY2.A (delay: 3, vol: -4)
```

### Advanced Mode (Node Graph)

For power users, a node-based routing view where:
- Source nodes = virtual channels
- Processing nodes = echo, reroute, volume scale
- Sink nodes = hardware channels on specific chips

This is lower priority — the simple mode covers the discussed use cases.

## Relationship to Chip Abstraction

Bitphase's architecture separates chip-specific code (`src/lib/chips/ay/`) from generic code (`src/lib/chips/base/`). Multi-AY routing fits cleanly:

- `RoutingConfig` is chip-agnostic (just indices and modes)
- The `VirtualChannelMixer` is extended to output to N chips instead of 1
- Each chip's register state is independent
- PSG export writes N register streams

Future chips (SN76489, SID, etc.) would implement their own register state format but use the same routing layer.

## Implementation Order

1. **Extend VirtualChannelMixer** to support multiple output chip states
2. **Add RoutingConfig** to project model
3. **Ring buffer** for frame history (enables echo routing)
4. **Echo routing mode** in mixer
5. **Multi-chip PSG export** (separate streams or interleaved)
6. **Reroute modes** (tone->env, etc.)
7. **Simple UI** for routing configuration
8. **Advanced node UI** (future)

## Open Questions

1. Should routing config be per-song or per-project?
2. Should echo channels be visible/editable in the pattern editor or purely generated?
3. How to handle preview/playback with multi-AY? (Web Audio can mix, but visual feedback needs thought)
