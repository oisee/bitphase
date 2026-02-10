import { describe, it, expect } from 'vitest';
import { PatternEffectHandling } from '@/lib/services/pattern/editing/pattern-effect-handling';

describe('PatternEffectHandling', () => {
	describe('formatEffectAsString', () => {
		it('formats auto-envelope effect EA32', () => {
			const result = PatternEffectHandling.formatEffectAsString({
				effect: 'E'.charCodeAt(0),
				delay: 0xa,
				parameter: 0x32
			});
			expect(result).toBe('EA32');
		});

		it('formats auto-envelope effect EA11', () => {
			const result = PatternEffectHandling.formatEffectAsString({
				effect: 'E'.charCodeAt(0),
				delay: 0xa,
				parameter: 0x11
			});
			expect(result).toBe('EA11');
		});

		it('formats auto-envelope effect with zero delay as E.32', () => {
			const result = PatternEffectHandling.formatEffectAsString({
				effect: 'E'.charCodeAt(0),
				delay: 0,
				parameter: 0x32
			});
			expect(result).toBe('E.32');
		});
	});

	describe('parseEffectFromString', () => {
		it('parses EA32 as auto-envelope effect', () => {
			const result = PatternEffectHandling.parseEffectFromString('EA32');
			expect(result.effect).toBe('E'.charCodeAt(0));
			expect(result.delay).toBe(0xa);
			expect(result.parameter).toBe(0x32);
		});

		it('parses EA11 as auto-envelope with 1:1 ratio', () => {
			const result = PatternEffectHandling.parseEffectFromString('EA11');
			expect(result.effect).toBe('E'.charCodeAt(0));
			expect(result.delay).toBe(0xa);
			expect(result.parameter).toBe(0x11);
		});

		it('parses lowercase ea32', () => {
			const result = PatternEffectHandling.parseEffectFromString('ea32');
			expect(result.effect).toBe('E'.charCodeAt(0));
			expect(result.delay).toBe(0xa);
			expect(result.parameter).toBe(0x32);
		});

		it('roundtrips EA32 through format and parse', () => {
			const original = {
				effect: 'E'.charCodeAt(0),
				delay: 0xa,
				parameter: 0x32
			};
			const formatted = PatternEffectHandling.formatEffectAsString(original);
			const parsed = PatternEffectHandling.parseEffectFromString(formatted);
			expect(parsed.effect).toBe(original.effect);
			expect(parsed.delay).toBe(original.delay);
			expect(parsed.parameter).toBe(original.parameter);
		});
	});
});
