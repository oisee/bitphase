# Brainstorm Synthesis: Feature Roadmap & Priorities

**Date**: 2026-02-25
**Type**: Summary
**Status**: Draft

## Sources

- Chat discussion (2026-02-25): Alice, Pator, Volutar D, Roman Petrov, n1k-o, Kakos Nonos
- Fluffenfall source analysis (`/Users/alice/dev/fluffenfall/`)
- Bitphase codebase analysis (`/Users/alice/dev/bitphase/`)
- PT3 format documentation (Volutar's pt3player repo)

## Key Ideas from Discussion

### From Pator (Bitphase author)
- Virtual channels already work at tick (frame) granularity
- Priority: leftmost active virtual channel wins
- When instrument ends, next virtual channel takes over at next tick
- Unlimited virtual channels for now, until a format spec constrains them
- Dynamic tone table generation based on chip frequency (already implemented)
- Linear pitch (cents) is interesting but not priority — "completely different mode"

### From Volutar D
- Two virtual layers is practical max for Z80 native playback
- Per-interrupt interleaving (what Bitphase does) requires separate channel state per layer — heavy on Z80
- Row-level merging (what MmcM does manually) doesn't need virtual channels
- PSG register-level processing is heavy for Z80
- Needs mature, feature-frozen spec before Z80 player implementation

### From Roman Petrov
- Proposes abstracted format: register streams + note streams + macros
- Macros = repeated sequences (fits vibrato, arpeggio, volume envelopes)
- One macro per register/stream is Z80-feasible; multiple becomes like LZ compression
- Noise should be one stream, not duplicated per channel

### From Alice (oisee)
- Fluffenfall concepts: virtual channel layers with gate priorities, tone-to-env rerouting
- "Alpha mask" in samples for transparent/semi-transparent ticks
- Frame-grade drum loop layering
- Reroute channels to second AY (BAC -> CAB with delay + lower volume)
- "Automated downmix can be resolved into virtual channels" — autosiril integration

### From n1k-o
- Likes working with layers — faster to edit, easier to read
- Example: hi-hat layer before drums layer (short sounds fill gaps)

## Feature Priority Matrix

| Feature | Musical Value | Implementation Effort | Z80 Feasibility | Priority |
|---------|--------------|----------------------|-----------------|----------|
| Echo virtual channels | High | Medium | Low (heavy) | 1 |
| Configurable downmix rules | High | Medium | Medium | 2 |
| Multi-AY export (TurboSound) | High | Medium | High (existing players) | 3 |
| Alpha mask in instruments | Medium | Low | Medium | 4 |
| Cent-based pitch mode | Medium | Medium | Low (computation heavy) | 5 |
| Arbitrary chip frequency | Medium | Low | High (just tables) | 6 |
| Tone-to-envelope rerouting | Medium | Low | Medium | 7 |
| Fluff post-processing layer | Low | Medium | N/A (PC only) | 8 |
| Node-based routing UI | Low | High | N/A | 9 |

## Practical Compromise: Two Tiers

### Tier 1: Composition Features (PC/Web only)
Unlimited virtual channels, echo, rerouting, cents — all the power. These run in the browser and produce rich compositions. Not constrained by Z80.

### Tier 2: Export Targets
When exporting, user chooses target:
- **PSG file** (pre-rendered register dump) — any complexity works, Z80 just plays back
- **PT3-compatible module** — must fit in PT3 constraints (3 channels, no virtual layers)
- **Future native format** — constrained by what a Z80 player can handle (max 2 layers per channel, simple macros)

This separation means Bitphase can be as powerful as needed for composition while still producing output that plays on real hardware.

## Architecture Implications

All proposed features fit within Bitphase's existing chip abstraction:
- Virtual channels and routing are chip-agnostic
- The mixer operates on generic register state objects
- Multi-chip support extends the existing pattern (multiple register states)
- Cent-based pitch is a transformation layer between pattern data and register output

No changes needed to the chip abstraction boundary (`src/lib/chips/base/`).

## Related Reports

- [001 - Virtual Channels & Downmix Architecture](./2026-02-25-001-virtual-channels-downmix-architecture.md)
- [002 - Fluffenfall Integration](./2026-02-25-002-fluffenfall-integration.md)
- [003 - Cents/Linear Pitch & Tuning](./2026-02-25-003-cents-linear-pitch-and-tuning.md)
- [004 - Multi-AY Routing](./2026-02-25-004-multi-ay-routing.md)
