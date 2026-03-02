import { describe, it, expect } from 'vitest';
import { createGoRound } from '../../../src/lib/fluff/presets/go-round';
import { createSyncopa } from '../../../src/lib/fluff/presets/syncopa';
import { createOctavedGoRound } from '../../../src/lib/fluff/presets/octaved-go-round';
import { applyFluff } from '../../../src/lib/fluff/apply-fluff';
import { createEmptyChipFrame } from '../../../src/lib/fluff/chip-frame';

function makeFrames(count: number) {
	return Array.from({ length: count }, (_, i) => {
		const f = createEmptyChipFrame();
		f.a.p = 100 + i; f.a.v = 10; f.a.t = true; f.a.e = true;
		f.b.p = 200 + i; f.b.v = 8; f.b.t = true; f.b.e = true;
		f.c.p = 300 + i; f.c.v = 6; f.c.t = true; f.c.e = true;
		return f;
	});
}

describe('GoRound preset', () => {
	it('should create a single pattern with correct frame count', () => {
		const pats = createGoRound(3);

		expect(pats).toHaveLength(1);
		expect(pats[0].fframes).toHaveLength(9);
		expect(pats[0].repeat).toBe(99999);
	});

	it('should cycle through channel permutations at given speed', () => {
		const pats = createGoRound(2);
		const frames = makeFrames(6);
		const result = applyFluff(frames, pats, { stopOutOfFrames: true });

		expect(result[0].a.p).toBe(100);
		expect(result[1].a.p).toBe(101);

		expect(result[2].a.p).toBe(302);
		expect(result[2].b.p).toBe(102);
		expect(result[2].c.p).toBe(202);

		expect(result[4].a.p).toBe(204);
		expect(result[4].b.p).toBe(304);
		expect(result[4].c.p).toBe(104);
	});
});

describe('Syncopa preset', () => {
	it('should create a rhythmic pattern with identity, dup, and skip frames', () => {
		const pats = createSyncopa(4);

		expect(pats).toHaveLength(1);
		expect(pats[0].repeat).toBe(99999);

		const hasDup = pats[0].fframes.some(ff => ff.dup);
		const hasSkip = pats[0].fframes.some(ff => ff.skip);
		expect(hasDup).toBe(true);
		expect(hasSkip).toBe(true);
	});

	it('should produce output with dup and skip effects', () => {
		const pats = createSyncopa(8);
		const frames = makeFrames(20);
		const result = applyFluff(frames, pats, { stopOutOfFrames: true });

		const dupCount = pats[0].fframes.filter(ff => ff.dup).length;
		const skipCount = pats[0].fframes.filter(ff => ff.skip).length;
		expect(dupCount + skipCount).toBeGreaterThan(0);
		expect(result.length).toBeGreaterThan(0);
	});
});

describe('OctavedGoRound preset', () => {
	it('should create a pattern with channel rotation and octave shifts', () => {
		const pats = createOctavedGoRound(2);

		expect(pats).toHaveLength(1);
		expect(pats[0].fframes).toHaveLength(6);

		const hasShift = pats[0].fframes.some(ff => ff.a.sh !== 0);
		expect(hasShift).toBe(true);
	});

	it('should alternate octave shift direction', () => {
		const pats = createOctavedGoRound(2);
		const shifts = pats[0].fframes.map(ff => ff.a.sh);

		const hasPositive = shifts.some(s => s > 0);
		const hasNegative = shifts.some(s => s < 0);
		expect(hasPositive).toBe(true);
		expect(hasNegative).toBe(true);
	});
});
