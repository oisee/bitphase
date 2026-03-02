import { describe, it, expect } from 'vitest';
import {
	createEmptyChipFrame,
	chipFrameFromRegisters,
	cloneChipFrame
} from '../../../src/lib/fluff/chip-frame';

describe('ChipFrame', () => {
	describe('createEmptyChipFrame', () => {
		it('should create a frame with all zeroes and false flags', () => {
			const frame = createEmptyChipFrame();

			expect(frame.a.p).toBe(0);
			expect(frame.a.v).toBe(0);
			expect(frame.a.e).toBe(false);
			expect(frame.a.t).toBe(false);
			expect(frame.a.n).toBe(false);

			expect(frame.b.p).toBe(0);
			expect(frame.c.p).toBe(0);
			expect(frame.e.p).toBe(0);
			expect(frame.e.f).toBe(0);
			expect(frame.n.p).toBe(0);
		});
	});

	describe('chipFrameFromRegisters', () => {
		it('should parse tone periods from register pairs', () => {
			const regs = [0x34, 0x01, 0x78, 0x02, 0xBC, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
			const frame = chipFrameFromRegisters(regs);

			expect(frame.a.p).toBe(0x134);
			expect(frame.b.p).toBe(0x278);
			expect(frame.c.p).toBe(0x3BC);
		});

		it('should mask tone periods to 12 bits', () => {
			const regs = [0xFF, 0xFF, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
			const frame = chipFrameFromRegisters(regs);

			expect(frame.a.p).toBe(0x0FFF);
		});

		it('should parse volumes from lower 4 bits', () => {
			const regs = [0, 0, 0, 0, 0, 0, 0, 0, 10, 5, 15, 0, 0, 0, 0, 0];
			const frame = chipFrameFromRegisters(regs);

			expect(frame.a.v).toBe(10);
			expect(frame.b.v).toBe(5);
			expect(frame.c.v).toBe(15);
		});

		it('should parse envelope enable from volume bit 4', () => {
			const regs = [0, 0, 0, 0, 0, 0, 0, 0, 0x1F, 0x05, 0x10, 0, 0, 0, 0, 0];
			const frame = chipFrameFromRegisters(regs);

			expect(frame.a.e).toBe(true);
			expect(frame.b.e).toBe(false);
			expect(frame.c.e).toBe(true);
		});

		it('should parse mixer tone bits (inverted logic in register)', () => {
			const regs = [0, 0, 0, 0, 0, 0, 0, 0b000101, 0, 0, 0, 0, 0, 0, 0, 0];
			const frame = chipFrameFromRegisters(regs);

			expect(frame.a.t).toBe(true);
			expect(frame.b.t).toBe(false);
			expect(frame.c.t).toBe(true);
		});

		it('should parse mixer noise bits', () => {
			const regs = [0, 0, 0, 0, 0, 0, 0, 0b101000, 0, 0, 0, 0, 0, 0, 0, 0];
			const frame = chipFrameFromRegisters(regs);

			expect(frame.a.n).toBe(true);
			expect(frame.b.n).toBe(false);
			expect(frame.c.n).toBe(true);
		});

		it('should parse noise period from register 6', () => {
			const regs = [0, 0, 0, 0, 0, 0, 0x1A, 0, 0, 0, 0, 0, 0, 0, 0, 0];
			const frame = chipFrameFromRegisters(regs);

			expect(frame.n.p).toBe(0x1A);
		});

		it('should parse envelope period with left shift by 4', () => {
			const regs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x34, 0x12, 0, 0, 0];
			const frame = chipFrameFromRegisters(regs);

			expect(frame.e.p).toBe(0x1234 << 4);
		});

		it('should parse envelope shape from register 13', () => {
			const regs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x0E, 0, 0];
			const frame = chipFrameFromRegisters(regs);

			expect(frame.e.f).toBe(0x0E);
		});
	});

	describe('cloneChipFrame', () => {
		it('should create an independent copy', () => {
			const original = createEmptyChipFrame();
			original.a.p = 100;
			original.a.v = 12;
			original.a.t = true;
			original.e.p = 500;
			original.n.p = 15;

			const clone = cloneChipFrame(original);

			expect(clone.a.p).toBe(100);
			expect(clone.a.v).toBe(12);
			expect(clone.a.t).toBe(true);
			expect(clone.e.p).toBe(500);
			expect(clone.n.p).toBe(15);

			clone.a.p = 200;
			expect(original.a.p).toBe(100);
		});
	});
});
