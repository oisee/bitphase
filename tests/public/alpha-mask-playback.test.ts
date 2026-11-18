import { describe, it, expect } from 'vitest';
import { FileImportService } from '@/lib/services/file/project/file-import';
import { generatePSGBuffer } from '@/lib/services/file/ay/psg-export';
import AyumiState from '../../public/ay/ayumi-state.js';
import AYAudioDriver from '../../public/ay/ay-audio-driver.js';
import AYChipRegisterState from '../../public/ay/ay-chip-register-state.js';
import TrackerPatternProcessor from '../../public/tracker/tracker-pattern-processor.js';
import VirtualChannelMixer from '../../public/ay/virtual-channel-mixer.js';

const modules = {
	AyumiState,
	TrackerPatternProcessor,
	AYAudioDriver,
	AYChipRegisterState,
	VirtualChannelMixer
};

const LENGTH = 8;

function row(noteName: number, octave: number, instrument: number) {
	return {
		note: { name: noteName, octave },
		effects: [null],
		instrument,
		envelopeShape: 0,
		table: 0,
		volume: 15
	};
}

const emptyRow = () => ({
	note: { name: 0, octave: 0 },
	effects: [null],
	instrument: 0,
	envelopeShape: 0,
	table: 0,
	volume: 0
});

function channel(label: string, first: ReturnType<typeof row> | null) {
	const rows = Array.from({ length: LENGTH }, (_, i) => (i === 0 && first ? first : emptyRow()));
	return { label, rows };
}

function instrument(id: string, alpha: number | undefined) {
	return {
		id,
		name: `i${id}`,
		rows: [
			{
				tone: true,
				noise: false,
				envelope: false,
				volume: 15,
				loop: false,
				...(alpha === undefined ? {} : { alpha })
			}
		],
		loop: 0
	};
}

// hardware channel A has two virtual channels: A1 plays C-4 with instrument 01, A2 plays G-4 with instrument 02
function projectJson(primaryAlpha: number | undefined, underlyingAlpha: number | undefined) {
	return JSON.stringify({
		name: 'alpha',
		author: '',
		songs: [
			{
				chipType: 'ay',
				chipVariant: 'AY',
				chipFrequency: 1773400,
				interruptFrequency: 50,
				tuningTableIndex: 2,
				virtualChannelMap: { 0: 2 },
				patterns: [
					{
						id: 0,
						length: LENGTH,
						channels: [
							channel('A1', row(2, 4, 1)),
							channel('A2', row(9, 4, 2)),
							channel('B', null),
							channel('C', null)
						],
						patternRows: Array.from({ length: LENGTH }, () => ({
							envelopeValue: 0,
							noiseValue: -1
						}))
					}
				]
			}
		],
		patternOrder: [0],
		tables: [],
		instruments: [instrument('01', primaryAlpha), instrument('02', underlyingAlpha)]
	});
}

async function render(primaryAlpha: number | undefined, underlyingAlpha: number | undefined) {
	const project = await FileImportService.reconstructFromJsonAsync(
		projectJson(primaryAlpha, underlyingAlpha)
	);
	return Buffer.from(await generatePSGBuffer(project, 0, { modules }));
}

describe('alpha mask in AY playback (instrument alpha lane -> driver -> virtual channel mixer)', () => {
	it('a sounding primary without alpha masks plays over the channel below', async () => {
		const noAlpha = await render(undefined, undefined);
		const f15 = await render(15, 15);
		expect(f15.equals(noAlpha)).toBe(true);
	});

	it('primary alpha 0 lets the channel below (alpha F) through', async () => {
		const masked = await render(0, 15);
		const plain = await render(15, 15);
		expect(masked.equals(plain)).toBe(false);
	});

	it('primary alpha 0 does not let through a channel whose alpha is not higher', async () => {
		const masked = await render(0, 0);
		const plain = await render(15, 15);
		expect(masked.equals(plain)).toBe(true);
	});
});
