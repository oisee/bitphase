import { describe, expect, it } from 'vitest';
import {
	collectSettingSideEffects,
	normalizeChipSettingsRecord
} from '@/lib/chips/base/chip-settings';
import {
	AY_CHIP_SCHEMA,
	ATARI_ST_CHIP_FREQUENCY,
	NATURAL_TUNING_TABLE_INDEX,
	SUNSOFT_5B_CHIP_FREQUENCY
} from '@/lib/chips/ay/schema';
import { PT3ToneTable_4, generateNaturalTuningTable } from '@/lib/models/pt3/tuning-tables';

describe('AY chip settings schema hooks', () => {
	it('offers Sunsoft 5B as a chip frequency', () => {
		const frequency = AY_CHIP_SCHEMA.settings.find((setting) => setting.key === 'chipFrequency');
		expect(frequency?.options).toContainEqual({
			label: 'Sunsoft 5B (0.8949 MHz)',
			value: SUNSOFT_5B_CHIP_FREQUENCY
		});
	});

	it('forces mono stereo layout when ST mixing is enabled', () => {
		expect(
			normalizeChipSettingsRecord(AY_CHIP_SCHEMA, {
				stMixing: true,
				chipVariant: 'AY',
				stereoLayout: 'ABC',
				chipFrequency: 1773400
			})
		).toEqual({
			stMixing: true,
			chipVariant: 'YM',
			stereoLayout: 'mono',
			chipFrequency: ATARI_ST_CHIP_FREQUENCY
		});
	});

	it('returns YM, mono, and Atari ST frequency as side effects when ST mixing is turned on', () => {
		expect(
			collectSettingSideEffects(AY_CHIP_SCHEMA, 'stMixing', true, {
				stMixing: true,
				chipVariant: 'AY',
				stereoLayout: 'ABC',
				chipFrequency: 1773400
			})
		).toEqual([
			{ key: 'chipVariant', value: 'YM' },
			{ key: 'stereoLayout', value: 'mono' },
			{ key: 'chipFrequency', value: ATARI_ST_CHIP_FREQUENCY }
		]);
	});

	it('keeps table #4 for the default natural root C', () => {
		expect(generateNaturalTuningTable(0)).toEqual(PT3ToneTable_4);
		expect(
			AY_CHIP_SCHEMA.resolveTuningTable?.({ tuningTableIndex: NATURAL_TUNING_TABLE_INDEX })
		).toEqual(PT3ToneTable_4);
	});

	it('builds the natural table on the chosen root', () => {
		const table = AY_CHIP_SCHEMA.resolveTuningTable?.({
			tuningTableIndex: NATURAL_TUNING_TABLE_INDEX,
			naturalRoot: 2
		});
		expect(table?.slice(2)).toEqual(PT3ToneTable_4.slice(0, 94));
		expect(table?.slice(0, 2)).toEqual([3240, 3072]);
		expect(AY_CHIP_SCHEMA.tuningTableSettingKeys).toContain('naturalRoot');
		expect(
			AY_CHIP_SCHEMA.resolveTuningTable?.({ tuningTableIndex: 2, naturalRoot: 2 })
		).toEqual(AY_CHIP_SCHEMA.resolveTuningTable?.({ tuningTableIndex: 2 }));
	});

	it('offers a natural chip frequency for each root that puts period 2880 on that root', () => {
		const options = AY_CHIP_SCHEMA.settings.find((s) => s.key === 'chipFrequency')?.options;
		const natural = options?.filter((option) => option.label.startsWith('Natural '));
		expect(natural).toHaveLength(12);
		natural?.forEach((option, root) => {
			const rootHz = 440 * Math.pow(2, (root - 45) / 12);
			expect(option.value).toBe(Math.round(16 * 2880 * rootHz));
		});
	});
});
