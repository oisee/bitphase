import { describe, it, expect } from 'vitest';
import { applyFluff } from '../../../src/lib/fluff/apply-fluff';
import type { ChipFrame } from '../../../src/lib/fluff/chip-frame';
import { createEmptyChipFrame } from '../../../src/lib/fluff/chip-frame';
import { createIdentityFluffFrame } from '../../../src/lib/fluff/fluff-frame';
import type { FluffPattern } from '../../../src/lib/fluff/fluff-pattern';

function makeTestFrame(ap: number, av: number, bp: number, bv: number, cp: number, cv: number): ChipFrame {
	const f = createEmptyChipFrame();
	f.a.p = ap; f.a.v = av; f.a.t = true; f.a.e = true;
	f.b.p = bp; f.b.v = bv; f.b.t = true; f.b.e = true;
	f.c.p = cp; f.c.v = cv; f.c.t = true; f.c.e = true;
	return f;
}

describe('applyFluff', () => {
	describe('identity transform', () => {
		it('should pass through frames unchanged with identity fluff', () => {
			const frames = [
				makeTestFrame(100, 10, 200, 8, 300, 6),
				makeTestFrame(110, 9, 210, 7, 310, 5)
			];

			const ff = createIdentityFluffFrame();
			const pattern: FluffPattern = { repeat: 1, fframes: [ff, ff] };
			const result = applyFluff(frames, [pattern], { stopOutOfFrames: true });

			expect(result).toHaveLength(2);
			expect(result[0].a.p).toBe(100);
			expect(result[0].a.v).toBe(10);
			expect(result[0].b.p).toBe(200);
			expect(result[1].a.p).toBe(110);
		});
	});

	describe('channel rotation', () => {
		it('should swap channel sources (A<-C, B<-A, C<-B)', () => {
			const frames = [makeTestFrame(100, 10, 200, 8, 300, 6)];

			const ff = createIdentityFluffFrame();
			ff.a.s = 'c';
			ff.b.s = 'a';
			ff.c.s = 'b';

			const pattern: FluffPattern = { repeat: 1, fframes: [ff] };
			const result = applyFluff(frames, [pattern], { stopOutOfFrames: true });

			expect(result[0].a.p).toBe(300);
			expect(result[0].a.v).toBe(6);
			expect(result[0].b.p).toBe(100);
			expect(result[0].b.v).toBe(10);
			expect(result[0].c.p).toBe(200);
			expect(result[0].c.v).toBe(8);
		});
	});

	describe('volume modification', () => {
		it('should add relative volume adjustment', () => {
			const frames = [makeTestFrame(100, 10, 200, 8, 300, 6)];

			const ff = createIdentityFluffFrame();
			ff.a.v = -3;

			const pattern: FluffPattern = { repeat: 1, fframes: [ff] };
			const result = applyFluff(frames, [pattern], { stopOutOfFrames: true });

			expect(result[0].a.v).toBe(7);
		});

		it('should clamp volume to 0-15 range', () => {
			const frames = [makeTestFrame(100, 2, 200, 14, 300, 6)];

			const ff = createIdentityFluffFrame();
			ff.a.v = -5;
			ff.b.v = 5;

			const pattern: FluffPattern = { repeat: 1, fframes: [ff] };
			const result = applyFluff(frames, [pattern], { stopOutOfFrames: true });

			expect(result[0].a.v).toBe(0);
			expect(result[0].b.v).toBe(15);
		});

		it('should use absolute volume when va flag is set', () => {
			const frames = [makeTestFrame(100, 10, 200, 8, 300, 6)];

			const ff = createIdentityFluffFrame();
			ff.a.v = 5;
			ff.a.va = true;

			const pattern: FluffPattern = { repeat: 1, fframes: [ff] };
			const result = applyFluff(frames, [pattern], { stopOutOfFrames: true });

			expect(result[0].a.v).toBe(5);
		});
	});

	describe('period modification', () => {
		it('should add relative period offset', () => {
			const frames = [makeTestFrame(100, 10, 200, 8, 300, 6)];

			const ff = createIdentityFluffFrame();
			ff.a.p = 50;

			const pattern: FluffPattern = { repeat: 1, fframes: [ff] };
			const result = applyFluff(frames, [pattern], { stopOutOfFrames: true });

			expect(result[0].a.p).toBe(150);
		});

		it('should use absolute period when pa flag is set', () => {
			const frames = [makeTestFrame(100, 10, 200, 8, 300, 6)];

			const ff = createIdentityFluffFrame();
			ff.a.p = 500;
			ff.a.pa = true;

			const pattern: FluffPattern = { repeat: 1, fframes: [ff] };
			const result = applyFluff(frames, [pattern], { stopOutOfFrames: true });

			expect(result[0].a.p).toBe(500);
		});
	});

	describe('shift (octave)', () => {
		it('should shift period right (higher octave) with positive sh', () => {
			const frames = [makeTestFrame(256, 10, 200, 8, 300, 6)];

			const ff = createIdentityFluffFrame();
			ff.a.sh = 1;

			const pattern: FluffPattern = { repeat: 1, fframes: [ff] };
			const result = applyFluff(frames, [pattern], { stopOutOfFrames: true });

			expect(result[0].a.p).toBe(128);
		});

		it('should shift period left (lower octave) with negative sh', () => {
			const frames = [makeTestFrame(100, 10, 200, 8, 300, 6)];

			const ff = createIdentityFluffFrame();
			ff.a.sh = -1;

			const pattern: FluffPattern = { repeat: 1, fframes: [ff] };
			const result = applyFluff(frames, [pattern], { stopOutOfFrames: true });

			expect(result[0].a.p).toBe(200);
		});
	});

	describe('frame offset (echo)', () => {
		it('should read from earlier frame with negative offset', () => {
			const frames = [
				makeTestFrame(100, 10, 200, 8, 300, 6),
				makeTestFrame(110, 9, 210, 7, 310, 5)
			];

			const ff1 = createIdentityFluffFrame();
			const ff2 = createIdentityFluffFrame();
			ff2.a.o = -1;

			const pattern: FluffPattern = { repeat: 1, fframes: [ff1, ff2] };
			const result = applyFluff(frames, [pattern], { stopOutOfFrames: true });

			expect(result[1].a.p).toBe(100);
			expect(result[1].a.v).toBe(10);
		});

		it('should use empty frame when offset goes out of range', () => {
			const frames = [makeTestFrame(100, 10, 200, 8, 300, 6)];

			const ff = createIdentityFluffFrame();
			ff.a.o = -1;

			const pattern: FluffPattern = { repeat: 1, fframes: [ff] };
			const result = applyFluff(frames, [pattern], { stopOutOfFrames: true });

			expect(result[0].a.p).toBe(0);
			expect(result[0].a.v).toBe(0);
		});
	});

	describe('skip and dup', () => {
		it('should skip frames (consume input without producing output)', () => {
			const frames = [
				makeTestFrame(100, 10, 200, 8, 300, 6),
				makeTestFrame(110, 9, 210, 7, 310, 5),
				makeTestFrame(120, 8, 220, 6, 320, 4)
			];

			const fSkip = createIdentityFluffFrame();
			fSkip.skip = true;
			const fId = createIdentityFluffFrame();

			const pattern: FluffPattern = { repeat: 1, fframes: [fSkip, fId, fId] };
			const result = applyFluff(frames, [pattern], { stopOutOfFrames: true });

			expect(result).toHaveLength(2);
			expect(result[0].a.p).toBe(110);
			expect(result[1].a.p).toBe(120);
		});

		it('should duplicate frames (produce two outputs for one input)', () => {
			const frames = [
				makeTestFrame(100, 10, 200, 8, 300, 6),
				makeTestFrame(110, 9, 210, 7, 310, 5)
			];

			const fDup = createIdentityFluffFrame();
			fDup.dup = true;
			const fId = createIdentityFluffFrame();

			const pattern: FluffPattern = { repeat: 1, fframes: [fDup, fId] };
			const result = applyFluff(frames, [pattern], { stopOutOfFrames: true });

			expect(result).toHaveLength(3);
			expect(result[0].a.p).toBe(100);
			expect(result[1].a.p).toBe(100);
			expect(result[2].a.p).toBe(110);
		});
	});

	describe('envelope routing', () => {
		it('should route envelope to tone (env2tone)', () => {
			const frame = createEmptyChipFrame();
			frame.e.p = 0x0ABC;
			frame.a.t = true;
			frame.a.e = true;

			const ff = createIdentityFluffFrame();
			ff.a.s = 'e';

			const pattern: FluffPattern = { repeat: 1, fframes: [ff] };
			const result = applyFluff([frame], [pattern], { stopOutOfFrames: true });

			expect(result[0].a.p).toBe(0x0ABC);
			expect(result[0].a.v).toBe(0);
		});

		it('should route noise to tone (noise2tone) with N2P shift', () => {
			const frame = createEmptyChipFrame();
			frame.n.p = 16;
			frame.a.t = true;

			const ff = createIdentityFluffFrame();
			ff.a.s = 'n';

			const pattern: FluffPattern = { repeat: 1, fframes: [ff] };
			const result = applyFluff([frame], [pattern], { stopOutOfFrames: true });

			expect(result[0].a.p).toBe((16 << 7) & 0x0fff);
		});

		it('should route tone to envelope (tone2env)', () => {
			const frame = createEmptyChipFrame();
			frame.a.p = 0x100;
			frame.a.t = true;

			const ff = createIdentityFluffFrame();
			ff.e.s = 'a';

			const pattern: FluffPattern = { repeat: 1, fframes: [ff] };
			const result = applyFluff([frame], [pattern], { stopOutOfFrames: true });

			expect(result[0].e.p).toBe(0x100);
		});

		it('should route tone to noise (tone2noise) with right shift', () => {
			const frame = createEmptyChipFrame();
			frame.a.p = 0x380;

			const ff = createIdentityFluffFrame();
			ff.n.s = 'a';

			const pattern: FluffPattern = { repeat: 1, fframes: [ff] };
			const result = applyFluff([frame], [pattern], { stopOutOfFrames: true });

			expect(result[0].n.p).toBe(0x380 >> 7);
		});
	});

	describe('global mixer overrides', () => {
		it('should globally disable tone when g.t is false', () => {
			const frames = [makeTestFrame(100, 10, 200, 8, 300, 6)];

			const ff = createIdentityFluffFrame();
			ff.g.t = false;

			const pattern: FluffPattern = { repeat: 1, fframes: [ff] };
			const result = applyFluff(frames, [pattern], { stopOutOfFrames: true });

			expect(result[0].a.t).toBe(false);
			expect(result[0].b.t).toBe(false);
			expect(result[0].c.t).toBe(false);
		});
	});

	describe('pattern repeat', () => {
		it('should repeat fluff pattern multiple times', () => {
			const frames = [
				makeTestFrame(100, 10, 200, 8, 300, 6),
				makeTestFrame(110, 9, 210, 7, 310, 5),
				makeTestFrame(120, 8, 220, 6, 320, 4),
				makeTestFrame(130, 7, 230, 5, 330, 3)
			];

			const ff = createIdentityFluffFrame();
			const pattern: FluffPattern = { repeat: 2, fframes: [ff, ff] };
			const result = applyFluff(frames, [pattern], { stopOutOfFrames: true });

			expect(result).toHaveLength(4);
			expect(result[0].a.p).toBe(100);
			expect(result[1].a.p).toBe(110);
			expect(result[2].a.p).toBe(120);
			expect(result[3].a.p).toBe(130);
		});
	});

	describe('frame repeat', () => {
		it('should apply same fluff frame for multiple input frames', () => {
			const frames = [
				makeTestFrame(100, 10, 200, 8, 300, 6),
				makeTestFrame(110, 9, 210, 7, 310, 5)
			];

			const ff = createIdentityFluffFrame();
			ff.repeat = 2;

			const pattern: FluffPattern = { repeat: 1, fframes: [ff] };
			const result = applyFluff(frames, [pattern], { stopOutOfFrames: true });

			expect(result).toHaveLength(2);
			expect(result[0].a.p).toBe(100);
			expect(result[1].a.p).toBe(110);
		});
	});

	describe('fineR13 post-processing', () => {
		it('should clear high bits of envelope shape when shape changes between frames', () => {
			const f1 = createEmptyChipFrame();
			f1.e.f = 0x8E;
			const f2 = createEmptyChipFrame();
			f2.e.f = 0x8C;

			const ff = createIdentityFluffFrame();
			const pattern: FluffPattern = { repeat: 1, fframes: [ff, ff] };
			const result = applyFluff([f1, f2], [pattern], { stopOutOfFrames: true });

			expect(result[1].e.f).toBe(0x0C);
		});

		it('should keep high bits when envelope shape does not change', () => {
			const f1 = createEmptyChipFrame();
			f1.e.f = 0x8E;
			const f2 = createEmptyChipFrame();
			f2.e.f = 0x8E;

			const ff = createIdentityFluffFrame();
			const pattern: FluffPattern = { repeat: 1, fframes: [ff, ff] };
			const result = applyFluff([f1, f2], [pattern], { stopOutOfFrames: true });

			expect(result[1].e.f).toBe(0x8E);
		});
	});
});
