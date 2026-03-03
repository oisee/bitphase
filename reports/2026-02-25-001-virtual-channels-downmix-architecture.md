# Virtual Channels, Downmix & Priority Architecture

**Date**: 2026-02-25
**Type**: ADR + Technical Analysis
**Status**: Proposal

## Context

Bitphase currently implements virtual channels with a simple priority-based selection system. This document analyzes the current state, proposes enhancements inspired by Fluffenfall concepts, and outlines a path toward multi-AY support with configurable downmix rules.

## Current Implementation

### How Virtual Channels Work Today

Virtual channels are mapped to hardware channels via `virtualChannelMap: Record<number, number>` (key=hardware channel index, value=count of virtual sub-channels).

**Mixing is selection-based, not additive**: the `VirtualChannelMixer` iterates virtual channels in index order and picks the **first active** one. Activity is determined by:

```
isActive(vch) = channelSoundEnabled[vch] AND (volume > 0 OR envelope enabled)
```

**Priority levels** = index order within a group. Virtual channel 0 is highest priority, 1 is next, etc. If all channels are inactive, the **last** virtual channel is used as fallback (outputs silence).

### What Gets Selected

When a virtual channel wins priority, its entire state is copied to the hardware channel:
- Tone period (12-bit)
- Volume (4-bit + envelope flag)
- Mixer bits (tone/noise/envelope enables)
- Global: envelope period, envelope shape, noise period

### Limitations

1. **No blending** - only one virtual channel plays per hardware channel at any tick
2. **No alpha/opacity** - instrument silence is binary (active/inactive), no partial transparency
3. **No temporal effects** - no echo/delay via frame offset
4. **Single AY target** - no routing to multiple chips
5. **Fixed priority** - always left-to-right, no dynamic priority

## Proposed Enhancements

### 1. Alpha Mask System for Instruments

Add per-tick transparency to instrument rows, enabling smooth crossfading between virtual channels.

**Concept**: Each instrument row gets an optional `alpha` field (0-15, where 15=fully opaque, 0=fully transparent). When alpha < 15, the channel is "semi-active" and lower-priority channels can bleed through.

**Mixing rule with alpha**:
```
For each tick, for each hardware channel group:
  selected = null
  for vch in virtual_channels (priority order):
    if isActive(vch):
      if alpha(vch) == 15:
        selected = vch  // fully opaque, stop
        break
      else:
        selected = vch  // semi-transparent, but still highest priority
        break           // for AY we can't truly blend, so still select one
  output selected (or fallback)
```

For real AY hardware (where true mixing is impossible), alpha serves as a **gate threshold**: if alpha < threshold, the channel yields to the next one. This enables patterns like:
- Kick drum (alpha=15) always takes priority
- Sustained bass (alpha=8) yields to any instrument with alpha > 8
- Echo/ghost notes (alpha=4) only play when nothing else is active

### 2. Fluffenfall-Inspired Layer Effects

Integrate Fluffenfall's frame-level transformation concepts directly into the virtual channel pipeline.

**Key Fluffenfall concepts to adopt**:

| Concept | Fluffenfall | Bitphase Integration |
|---------|-------------|---------------------|
| Frame offset (echo) | `o: -9` reads 9 frames back | Store N-frame ring buffer per virtual channel, allow "echo" virtual channels that read from buffer |
| Channel rerouting | `s: "b"` routes channel B to output A | Allow virtual channel source remapping in downmix config |
| Tone-to-Envelope | `tone2env()` routes tone period to envelope period | Add reroute mode in virtual channel config |
| Volume scaling | `v: -3` reduces volume | Per-virtual-channel volume offset in downmix rules |
| Bit shifting | `sh: -1` shifts period (octave change) | Period transform in reroute rules |

**Echo as virtual channel**: Instead of a post-processing step, echo becomes a virtual channel that:
- Sources from another virtual channel's ring buffer
- Has configurable delay (in ticks)
- Has configurable volume reduction
- Has lower priority than the source channel

### 3. Multi-AY Routing (1/2/3 AY chips)

**Target configurations**:
- **1 AY** (standard): 3 hardware channels, downmix all virtual channels
- **2 AY / TurboSound**: 6 hardware channels (A1-C1, A2-C2), stereo or extended
- **3 AY**: 9 hardware channels

**Routing model**: A simple left-to-right hierarchy with configurable rules:

```
Virtual Channels:  [V0] [V1] [V2] [V3] [V4] [V5] [V6] [V7] [V8]
                    |    |    |    |    |    |    |    |    |
                    v    v    v    v    v    v    v    v    v
Target Groups:     [--- AY1 ---] [--- AY2 ---] [--- AY3 ---]
                    A1   B1   C1   A2   B2   C2   A3   B3   C3
```

**Downmix rules per target**:
- **Direct map**: Virtual channel N -> Hardware channel N (1:1)
- **Priority group**: Multiple virtuals compete for one hardware channel (current behavior)
- **Overflow**: If target has fewer channels than virtuals, excess channels are downmixed by priority
- **Cross-stereo echo** (TurboSound special case): Route echo of AY1 channels to AY2 with swapped channel order (BAC -> CAB) and reduced volume — exactly the Fluffenfall cross-stereo pattern

### 4. Configurable Downmix Rules

Replace the current hardcoded priority selection with a configurable rule system:

```typescript
interface DownmixRule {
  sourceChannels: number[]      // virtual channel indices in this group
  targetChip: number            // 0, 1, or 2
  targetChannel: number         // 0 (A), 1 (B), 2 (C)
  mode: 'priority' | 'round-robin' | 'echo'
  echoConfig?: {
    sourceChannel: number       // which virtual channel to echo
    delayTicks: number          // frame offset
    volumeReduction: number     // 0-15
    periodShift?: number        // bit shift for octave change
  }
  reroute?: {
    toneToEnvelope?: boolean    // route tone period to envelope register
    periodScale?: number        // multiply period (x2, x4 for env scaling)
  }
}
```

**Example configurations**:

**Standard 1-AY with kick/bass layering** (current behavior):
```json
[
  { "sourceChannels": [0, 1], "targetChip": 0, "targetChannel": 0, "mode": "priority" },
  { "sourceChannels": [2, 3], "targetChip": 0, "targetChannel": 1, "mode": "priority" },
  { "sourceChannels": [4],    "targetChip": 0, "targetChannel": 2, "mode": "priority" }
]
```

**TurboSound cross-stereo echo** (BAC->CAB with delay):
```json
[
  { "sourceChannels": [0], "targetChip": 0, "targetChannel": 0, "mode": "priority" },
  { "sourceChannels": [1], "targetChip": 0, "targetChannel": 1, "mode": "priority" },
  { "sourceChannels": [2], "targetChip": 0, "targetChannel": 2, "mode": "priority" },
  { "sourceChannels": [2], "targetChip": 1, "targetChannel": 0, "mode": "echo",
    "echoConfig": { "sourceChannel": 2, "delayTicks": 3, "volumeReduction": 3 } },
  { "sourceChannels": [0], "targetChip": 1, "targetChannel": 1, "mode": "echo",
    "echoConfig": { "sourceChannel": 0, "delayTicks": 3, "volumeReduction": 3 } },
  { "sourceChannels": [1], "targetChip": 1, "targetChannel": 2, "mode": "echo",
    "echoConfig": { "sourceChannel": 1, "delayTicks": 3, "volumeReduction": 3 } }
]
```

## Priority Levels Summary

| Priority | Meaning | Example |
|----------|---------|---------|
| Index 0 (highest) | Always plays when active | Lead melody, kick drum |
| Index 1 | Plays when 0 is inactive | Bass line, snare fill |
| Index 2 | Plays when 0 and 1 inactive | Arpeggiated chord, hi-hat |
| Index N (lowest) | Background fill | Echo, ambient pad |

With alpha masks, priority becomes more nuanced: a channel with alpha=4 at priority 0 would yield to a channel with alpha=12 at priority 1, controlled by a configurable threshold.

## Implementation Order

1. **Ring buffer for frame history** (enables echo without architectural changes)
2. **Downmix rule configuration** (replaces hardcoded priority logic)
3. **Echo virtual channels** (uses ring buffer + rules)
4. **Multi-AY target support** (extends rule system to multiple chips)
5. **Alpha mask in instruments** (enhances priority selection)
6. **Tone-to-envelope rerouting** (Fluffenfall-style transformations)
7. **UI for rule configuration** (node-based or simple left-to-right hierarchy)

## Decision

Pending discussion. Key question: should the rule system be a simple left-to-right hierarchy (easier to understand, covers 90% of use cases) or a full node-based routing graph (maximum flexibility, harder UI)?
