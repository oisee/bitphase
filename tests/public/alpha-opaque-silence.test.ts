import { describe, it, expect } from 'vitest';
import { FileImportService } from '@/lib/services/file/project/file-import';
import { FileExportService } from '@/lib/services/file/project/file-export';
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

const emptyRow = () => ({
	note: { name: 0, octave: 0 },
	effects: [null],
	instrument: 0,
	envelopeShape: 0,
	table: 0,
	volume: 0
});
const noteRow = (name: number, octave: number, instrument: number) => ({
	...emptyRow(),
	note: { name, octave },
	instrument,
	volume: 15
});
const channel = (label: string, first: ReturnType<typeof noteRow> | null) => ({
	label,
	rows: Array.from({ length: LENGTH }, (_, i) => (i === 0 && first ? first : emptyRow()))
});

// A1 (primary) plays one loud tick, then a silent step with alpha F that holds; A2 sounds all the time.
function projectJson(opaque: boolean | undefined) {
	return JSON.stringify({
		name: 'opaque',
		author: '',
		songs: [
			{
				chipType: 'ay',
				chipVariant: 'AY',
				chipFrequency: 1773400,
				interruptFrequency: 50,
				tuningTableIndex: 2,
				...(opaque === undefined ? {} : { alphaOpaqueSilence: opaque }),
				virtualChannelMap: { 0: 2 },
				patterns: [
					{
						id: 0,
						length: LENGTH,
						channels: [
							channel('A1', noteRow(2, 4, 1)),
							channel('A2', noteRow(9, 4, 2)),
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
		instruments: [
			{
				id: '01',
				name: 'blip',
				rows: [
					{ tone: true, volume: 15, alpha: 15 },
					{ tone: true, volume: 0, alpha: 15 }
				],
				loop: 1
			},
			{ id: '02', name: 'hold', rows: [{ tone: true, volume: 15, alpha: 15 }], loop: 0 }
		]
	});
}

async function load(opaque: boolean | undefined) {
	return FileImportService.reconstructFromJsonAsync(projectJson(opaque));
}

async function psg(project: Awaited<ReturnType<typeof load>>) {
	return Buffer.from(await generatePSGBuffer(project, 0, { modules }));
}

// Bulba PSG -> one 16-register snapshot per frame
function frames(buf: Buffer): number[][] {
	const out: number[][] = [];
	const regs = Array(16).fill(0);
	let i = 16;
	let started = false;
	while (i < buf.length) {
		const b = buf[i++]!;
		if (b === 0xff) {
			if (started) out.push([...regs]);
			started = true;
		} else if (b === 0xfe) {
			const n = buf[i++]! * 4;
			for (let k = 0; k < n; k++) out.push([...regs]);
		} else {
			regs[b] = buf[i++]!;
		}
	}
	if (started) out.push([...regs]);
	return out;
}

describe('alpha opaque silence option', () => {
	it('defaults to off and a file without the key plays as before', async () => {
		const absent = await load(undefined);
		expect((absent.songs[0] as any).alphaOpaqueSilence).toBe(false);
		const off = await load(false);
		expect((await psg(absent)).equals(await psg(off))).toBe(true);
	});

	it('differs exactly in the frames where the primary voice is silent with alpha F', async () => {
		const off = frames(await psg(await load(false)));
		const on = frames(await psg(await load(true)));
		expect(on.length).toBe(off.length);
		let differing = 0;
		let identical = 0;
		for (let f = 0; f < on.length; f++) {
			const o = off[f]!;
			const p = on[f]!;
			const primarySilentInOn = (p[8]! & 0x0f) === 0 && (p[9]! & 0x0f) === 0;
			if (JSON.stringify(o) === JSON.stringify(p)) {
				identical++;
			} else {
				differing++;
				// off: the sounding channel below plays; on: the silent primary masks it
				expect(primarySilentInOn).toBe(true);
				expect(o[8]! & 0x0f).toBeGreaterThan(0);
			}
		}
		expect(identical).toBeGreaterThan(0); // the loud first tick plays the same
		expect(differing).toBeGreaterThan(0);
		expect(on[0]).toEqual(off[0]);
		// hardware channels B and C never differ
		for (let f = 0; f < on.length; f++) {
			expect(on[f]!.slice(2, 8)).toEqual(off[f]!.slice(2, 8));
			expect(on[f]!.slice(9, 14)).toEqual(off[f]!.slice(9, 14));
		}
	});

	it('survives save and load', async () => {
		const project = await load(true);
		const saved = FileExportService.serializeProject(project);
		expect(JSON.parse(saved).songs[0].alphaOpaqueSilence).toBe(true);
		const reloaded = await FileImportService.reconstructFromJsonAsync(saved);
		expect((reloaded.songs[0] as any).alphaOpaqueSilence).toBe(true);
		expect((await psg(reloaded)).equals(await psg(project))).toBe(true);
	});

	it('asks once for projects that stack virtual channels but do not say', async () => {
		const { needsAlphaOpaqueChoice, setAlphaOpaqueSilence } = await import(
			'@/lib/services/file/project/file-import'
		);
		const unset = await load(undefined);
		expect(needsAlphaOpaqueChoice(unset)).toBe(true);
		setAlphaOpaqueSilence(unset, true);
		expect(needsAlphaOpaqueChoice(unset)).toBe(false);
		expect((unset.songs[0] as any).alphaOpaqueSilence).toBe(true);
		expect(needsAlphaOpaqueChoice(await load(false))).toBe(false);
	});
});
