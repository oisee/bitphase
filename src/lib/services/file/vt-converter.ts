import { Project, Table } from '../../models/project';
import {
	Song,
	Pattern,
	Note,
	Effect,
	NoteName,
	EffectType,
	Instrument,
	InstrumentRow
} from '../../models/song';
import { PT3TuneTables, generate12TETTuningTable } from '../../models/pt3/tuning-tables';
import { convertPT3ToVT2 } from './pt3-to-vt2';

interface VT2Module {
	title: string;
	author: string;
	version: string;
	speed: number;
	playOrder: number[];
	loopPoint?: number;
	noteTable: number;
	customNoteTable?: number[];
	chipFrequency: number;
	interruptFrequency: number;
}

interface VT2Table {
	id: number;
	data: number[];
	loop: boolean;
	loopPoint: number;
}

interface VT2Sample {
	id: number;
	data: VT2SampleLine[];
}

interface VT2SampleLine {
	tone: boolean;
	noise: boolean;
	envelope: boolean;
	toneAdd: number;
	noiseAdd: number;
	volume: number;
	loop: boolean;
	amplitudeSliding?: boolean;
	amplitudeSlideUp?: boolean;
	toneAccumulation?: boolean;
	noiseAccumulation?: boolean;
}

interface VT2PatternRow {
	note: string;
	instrument: number;
	volume: number;
	table: number;
	envelopeShape: number;
	effects: string;
}

interface VT2Pattern {
	id: number;
	rows: VT2PatternRow[][];
	envelopeValues: number[];
	noiseValues: number[];
}

class VT2Converter {
	private readonly noteNameMap: Record<string, NoteName> = {
		C: NoteName.C,
		'C#': NoteName.CSharp,
		D: NoteName.D,
		'D#': NoteName.DSharp,
		E: NoteName.E,
		F: NoteName.F,
		'F#': NoteName.FSharp,
		G: NoteName.G,
		'G#': NoteName.GSharp,
		A: NoteName.A,
		'A#': NoteName.ASharp,
		B: NoteName.B
	} as const;

	private readonly effectTypeMap: Record<string, EffectType> = {
		'1': EffectType.SlideUp,
		'2': EffectType.SlideDown,
		'3': EffectType.Portamento,
		'6': EffectType.OnOff,
		B: EffectType.Speed,
		D: EffectType.Detune
	} as const;

	/**
	 * Converts a VT2 file content to a Project object
	 */
	convert(vt2Content: string): Project {
		const normalized = vt2Content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
		const lines = normalized.split('\n').map((line) => line.trim());

		const moduleSections = this.splitModuleSections(lines);
		const isTurboSound = moduleSections.length > 1;

		if (isTurboSound) {
			return this.convertTurboSoundModules(moduleSections);
		}

		const module = this.parseModule(lines);
		const tables = this.parseTables(lines);
		const samples = this.parseSamples(lines);
		const patterns = this.parsePatterns(lines);

		const convertedTables = this.convertTables(tables);

		const convertedInstruments = samples.map((sample) => {
			let loopPoint = 0;
			for (let i = 0; i < sample.data.length; i++) {
				if (sample.data[i].loop) {
					loopPoint = i;
					break;
				}
			}

			const instrumentId =
				typeof sample.id === 'string'
					? sample.id
					: sample.id.toString(36).toUpperCase().padStart(2, '0');

			return new Instrument(
				instrumentId,
				sample.data.map((line) => {
					return new InstrumentRow({
						tone: line.tone,
						noise: line.noise,
						envelope: line.envelope,
						toneAdd: line.toneAdd,
						noiseAdd: line.noiseAdd,
						volume: line.volume,
						loop: line.loop,
						amplitudeSliding: line.amplitudeSliding || false,
						amplitudeSlideUp: line.amplitudeSlideUp || false,
						toneAccumulation: line.toneAccumulation || false,
						noiseAccumulation: line.noiseAccumulation || false,
						envelopeAdd: line.noiseAdd,
						envelopeAccumulation: line.noiseAccumulation || false,
						retriggerEnvelope: false
					});
				}),
				loopPoint,
				`Instrument ${instrumentId}`
			);
		});

		const { tuningTable, tuningTableIndex, a4TuningHz } = this.resolveTuningTable(module);
		return this.convertSingleChip(
			module,
			patterns,
			convertedInstruments,
			convertedTables,
			tuningTable,
			tuningTableIndex,
			a4TuningHz
		);
	}

	private splitModuleSections(lines: string[]): string[][] {
		const sections: string[][] = [];
		let currentSection: string[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line === '[Module]') {
				if (currentSection.length > 0) {
					sections.push(currentSection);
				}
				currentSection = [line];
			} else {
				currentSection.push(line);
			}
		}

		if (currentSection.length > 0) {
			sections.push(currentSection);
		}

		return sections;
	}

	private convertTurboSoundModules(moduleSections: string[][]): Project {
		if (moduleSections.length < 2) {
			throw new Error('TurboSound file must contain at least 2 modules');
		}

		const firstModuleLines = moduleSections[0];
		const secondModuleLines = moduleSections[1];

		const module1 = this.parseModule(firstModuleLines);
		const module2 = this.parseModule(secondModuleLines);

		const tables1 = this.parseTables(firstModuleLines);
		const samples1 = this.parseSamples(firstModuleLines);
		const patterns1 = this.parsePatterns(firstModuleLines);

		const tables2 = this.parseTables(secondModuleLines);
		const samples2 = this.parseSamples(secondModuleLines);
		const patterns2 = this.parsePatterns(secondModuleLines);

		const { tuningTable, tuningTableIndex, a4TuningHz } = this.resolveTuningTable(module1);

		const result1 = this.createSongFromModule(
			module1,
			patterns1,
			samples1,
			tables1,
			tuningTable,
			tuningTableIndex,
			a4TuningHz
		);
		const result2 = this.createSongFromModule(
			module2,
			patterns2,
			samples2,
			tables2,
			tuningTable,
			tuningTableIndex,
			a4TuningHz
		);

		const mergedInstruments = this.mergeInstruments(
			result1.instruments,
			result2.instruments
		);

		return new Project(
			module1.title,
			module1.author,
			[result1.song, result2.song],
			module1.loopPoint || 0,
			module1.playOrder,
			this.convertTables(tables1),
			{},
			mergedInstruments
		);
	}

	private mergeInstruments(a: Instrument[], b: Instrument[]): Instrument[] {
		const byId = new Map(a.map((inst) => [inst.id, inst]));
		for (const inst of b) {
			if (!byId.has(inst.id)) {
				byId.set(inst.id, inst);
			}
		}
		return [...byId.values()].sort(
			(x, y) => parseInt(x.id, 36) - parseInt(y.id, 36)
		);
	}

	private resolveTuningTable(module: VT2Module): {
		tuningTable: number[];
		tuningTableIndex: number;
		a4TuningHz: number;
	} {
		if (module.noteTable >= 0 && module.noteTable < PT3TuneTables.length) {
			return {
				tuningTable: [...PT3TuneTables[module.noteTable]],
				tuningTableIndex: module.noteTable,
				a4TuningHz: 440
			};
		}
		if (module.noteTable === 5) {
			if (
				module.customNoteTable &&
				module.customNoteTable.length === 96 &&
				module.customNoteTable.every((n) => n >= 1 && n <= 4095)
			) {
				return {
					tuningTable: [...module.customNoteTable],
					tuningTableIndex: 5,
					a4TuningHz: 440
				};
			}
			const table = generate12TETTuningTable(module.chipFrequency, 440);
			return { tuningTable: table, tuningTableIndex: 5, a4TuningHz: 440 };
		}
		return {
			tuningTable: [...PT3TuneTables[2]],
			tuningTableIndex: 2,
			a4TuningHz: 440
		};
	}

	private createSongFromModule(
		module: VT2Module,
		patterns: VT2Pattern[],
		samples: VT2Sample[],
		tables: VT2Table[],
		tuningTable: number[],
		tuningTableIndex: number,
		a4TuningHz: number
	): { song: Song; instruments: Instrument[] } {
		const song = new Song();
		song.tuningTable = tuningTable;
		song.tuningTableIndex = tuningTableIndex;
		song.a4TuningHz = a4TuningHz;
		song.initialSpeed = module.speed >= 1 && module.speed <= 255 ? module.speed : 3;
		const chipVariant = this.detectChipType(module);
		song.chipType = chipVariant === 'AY' || chipVariant === 'YM' ? 'ay' : undefined;
		song.chipVariant = chipVariant;
		song.chipFrequency = module.chipFrequency;
		song.interruptFrequency = module.interruptFrequency;

		const convertedInstruments = samples.map((sample) => {
			let loopPoint = 0;
			for (let i = 0; i < sample.data.length; i++) {
				if (sample.data[i].loop) {
					loopPoint = i;
					break;
				}
			}

			const instrumentId =
				typeof sample.id === 'string'
					? sample.id
					: sample.id.toString(36).toUpperCase().padStart(2, '0');

			return new Instrument(
				instrumentId,
				sample.data.map((line) => {
					return new InstrumentRow({
						tone: line.tone,
						noise: line.noise,
						envelope: line.envelope,
						toneAdd: line.toneAdd,
						noiseAdd: line.noiseAdd,
						volume: line.volume,
						loop: line.loop,
						amplitudeSliding: line.amplitudeSliding || false,
						amplitudeSlideUp: line.amplitudeSlideUp || false,
						envelopeAdd: line.noiseAdd,
						envelopeAccumulation: line.noiseAccumulation || false,
						toneAccumulation: line.toneAccumulation || false,
						noiseAccumulation: line.noiseAccumulation || false,
						retriggerEnvelope: false
					});
				}),
				loopPoint,
				`Instrument ${instrumentId}`
			);
		});

		const instrumentsArray = this.initializeInstrumentsArray(convertedInstruments);

		song.patterns = patterns.map((vt2Pattern) => {
			const pattern = new Pattern(vt2Pattern.id, vt2Pattern.rows.length);
			this.convertPattern(vt2Pattern, pattern, 0);
			return pattern;
		});

		return { song, instruments: instrumentsArray };
	}

	private convertTables(tables: VT2Table[]): Table[] {
		return tables.map((table) => {
			return new Table(
				table.id - 1,
				table.data,
				table.loop ? table.loopPoint : 0,
				`Table ${table.id.toString(36).toUpperCase()}`
			);
		});
	}

	private initializeInstrumentsArray(convertedInstruments: Instrument[]): Instrument[] {
		return convertedInstruments.length > 0
			? convertedInstruments
			: [new Instrument('01', [], 0, 'Instrument 01')];
	}

	private convertSingleChip(
		module: VT2Module,
		patterns: VT2Pattern[],
		instruments: Instrument[],
		tables: Table[],
		tuningTable: number[],
		tuningTableIndex: number,
		a4TuningHz: number
	): Project {
		const song = new Song();
		song.tuningTable = tuningTable;
		song.tuningTableIndex = tuningTableIndex;
		song.a4TuningHz = a4TuningHz;
		song.initialSpeed = module.speed >= 1 && module.speed <= 255 ? module.speed : 3;

		song.patterns = patterns.map((vt2Pattern) => {
			const pattern = new Pattern(vt2Pattern.id, vt2Pattern.rows.length);
			this.convertPattern(vt2Pattern, pattern, 0);
			return pattern;
		});

		const chipVariant = this.detectChipType(module);
		song.chipType = chipVariant === 'AY' || chipVariant === 'YM' ? 'ay' : undefined;
		song.chipVariant = chipVariant;
		song.chipFrequency = module.chipFrequency;
		song.interruptFrequency = module.interruptFrequency;

		const instrumentsArray = this.initializeInstrumentsArray(instruments);

		return new Project(
			module.title,
			module.author,
			[song],
			module.loopPoint || 0,
			module.playOrder,
			tables,
			{},
			instrumentsArray
		);
	}

	private detectChipType(module: VT2Module): 'AY' | 'YM' {
		const titleLower = module.title.toLowerCase();
		const authorLower = module.author.toLowerCase();

		if (titleLower.includes('ym') || authorLower.includes('ym')) {
			return 'YM';
		}

		return 'AY';
	}

	private parseModule(lines: string[]): VT2Module {
		const module: VT2Module = {
			title: '',
			author: '',
			version: '',
			speed: 3,
			playOrder: [],
			loopPoint: 0,
			noteTable: 0,
			chipFrequency: 1773400,
			interruptFrequency: 50
		};

		const moduleLines = this.extractSection(lines, '[Module]');

		for (const line of moduleLines) {
			const eqIndex = line.indexOf('=');
			if (eqIndex < 0) continue;
			const key = line.slice(0, eqIndex).trim();
			const value = line.slice(eqIndex + 1).trim();

			switch (key) {
				case 'Title':
					module.title = value;
					break;
				case 'Author':
					module.author = value;
					break;
				case 'Version':
					module.version = value;
					break;
				case 'Speed':
					module.speed = parseInt(value) || 3;
					break;
				case 'PlayOrder':
					const { patternOrder, loopPoint } = this.parsePlayOrder(value);
					module.playOrder = patternOrder;
					module.loopPoint = loopPoint;
					break;
				case 'NoteTable':
					module.noteTable = parseInt(value) || 0;
					break;
				case 'CustomNoteTable': {
					const parts = value.split(',').map((p) => parseInt(p.trim(), 10));
					if (parts.length >= 96 && parts.every((n) => !Number.isNaN(n))) {
						module.customNoteTable = parts.slice(0, 96);
					}
					break;
				}
				case 'ChipFreq':
					module.chipFrequency = parseInt(value) || 1773400;
					break;
				case 'IntFreq': {
					const raw = parseInt(value) || 50;
					module.interruptFrequency = raw >= 1000 ? raw / 1000 : raw;
					break;
				}
			}
		}

		return module;
	}

	private parsePlayOrder(orderString: string): { patternOrder: number[]; loopPoint: number } {
		const parts = orderString.split(',').map((part) => part.trim());
		const patternOrder: number[] = [];
		let loopPoint = 0;

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			if (part.startsWith('L')) {
				loopPoint = i;
				const patternIndex = parseInt(part.substring(1));
				if (!isNaN(patternIndex)) {
					patternOrder.push(patternIndex);
				}
			} else {
				const patternIndex = parseInt(part);
				if (!isNaN(patternIndex)) {
					patternOrder.push(patternIndex);
				}
			}
		}

		return { patternOrder, loopPoint };
	}

	private parseTables(lines: string[]): VT2Table[] {
		const tables: VT2Table[] = [];
		const tableSections = this.extractSections(lines, /^\[Ornament(\d+)\]$/);

		for (const { match, content } of tableSections) {
			const id = parseInt(match[1]);
			const table: VT2Table = {
				id,
				data: [],
				loop: false,
				loopPoint: 0
			};

			for (const line of content) {
				const values = line.split(',').map((v) => v.trim());
				for (const value of values) {
					if (value.startsWith('L')) {
						table.loop = true;
						table.loopPoint = table.data.length;
						const num = parseInt(value.substring(1));
						if (!isNaN(num)) table.data.push(num);
					} else {
						const num = parseInt(value);
						if (!isNaN(num)) table.data.push(num);
					}
				}
			}

			tables.push(table);
		}

		return tables;
	}

	private parseSamples(lines: string[]): VT2Sample[] {
		const samples: VT2Sample[] = [];
		const sampleSections = this.extractSections(lines, /^\[Sample([0-9]+|[A-Za-z])\]$/i);

		for (const { match, content } of sampleSections) {
			const idStr = match[1].toUpperCase();
			let id: number;
			if (/^[0-9]+$/.test(idStr)) {
				id = parseInt(idStr, 10);
			} else {
				id = this.parseBase36Digit(idStr);
			}
			const sample: VT2Sample = {
				id,
				data: content
					.map((line) => this.parseSampleLine(line))
					.filter(Boolean) as VT2SampleLine[]
			};
			samples.push(sample);
		}

		return samples;
	}

	private parseSampleLine(line: string): VT2SampleLine | null {
		const parts = line.split(/\s+/);
		if (parts.length < 4) return null;

		const [flags, toneStr, noiseStr, volumeStr, ...rest] = parts;

		const toneAccumulation = toneStr.includes('^');
		const toneValue = this.parseSignedHex(toneStr.replace('^', ''));

		const noiseAccumulation = noiseStr.includes('^');
		const noiseValue = this.parseSignedHex(noiseStr.replace('^', ''));

		const volumeCleaned = volumeStr.replace('_', '');
		const hasAmplitudeSliding = volumeCleaned.includes('+') || volumeCleaned.includes('-');
		const amplitudeSlideUp = volumeCleaned.includes('+');
		const volumeValue = parseInt(volumeCleaned.replace(/[+-]/g, ''), 16) || 0;

		return {
			tone: flags.includes('T'),
			noise: flags.includes('N'),
			envelope: flags.includes('E'),
			toneAdd: toneValue,
			noiseAdd: noiseValue,
			volume: volumeValue,
			loop: rest.includes('L'),
			amplitudeSliding: hasAmplitudeSliding,
			amplitudeSlideUp: amplitudeSlideUp,
			toneAccumulation: toneAccumulation,
			noiseAccumulation: noiseAccumulation
		};
	}

	private parseSignedHex(str: string): number {
		const cleaned = str.replace(/[+_^-]/g, '');
		let value = parseInt(cleaned, 16) || 0;
		return str.includes('-') ? -value : value;
	}

	private parsePatterns(lines: string[]): VT2Pattern[] {
		const patterns: VT2Pattern[] = [];
		const patternSections = this.extractSections(lines, /^\[Pattern(\d+)\]$/);

		for (const { match, content } of patternSections) {
			const id = parseInt(match[1]);
			const pattern: VT2Pattern = {
				id,
				rows: [],
				envelopeValues: [],
				noiseValues: []
			};

			for (const line of content) {
				const { channelRows, envelopeValue, noiseValue } = this.parsePatternRow(line);
				if (channelRows) {
					pattern.rows.push(channelRows);
					pattern.envelopeValues.push(envelopeValue);
					pattern.noiseValues.push(noiseValue);
				}
			}

			patterns.push(pattern);
		}

		return patterns;
	}

	private parsePatternRow(line: string) {
		const channels = line.split('|');
		if (channels.length < 4) {
			return { channelRows: null, envelopeValue: 0, noiseValue: 0 };
		}

		const [envelopePart, noisePart, ...channelParts] = channels;

		const envelopeValue = this.parseHexValue(envelopePart, 4);
		const noiseValue = this.parseHexValue(noisePart, 2);

		const channelRows = channelParts.map((channelData) =>
			this.parseChannelData(channelData.trim())
		);

		return { channelRows, envelopeValue, noiseValue };
	}

	private parseHexValue(str: string, length: number): number {
		if (str.length < length) return 0;
		const hex = str.substring(0, length).replace(/\./g, '0');
		return parseInt(hex, 16) || 0;
	}

	private parseChannelData(data: string): VT2PatternRow {
		const parts = data.split(/\s+/);
		const [note = '', sampleAndVol = '', ...effectParts] = parts;
		const effects = effectParts.join(' ');

		let instrument = 0;
		let volume = 0;
		let table = 0;
		let envelopeShape = 0;

		if (sampleAndVol.length >= 4) {
			instrument = this.parseBase36Digit(sampleAndVol[0]);
			envelopeShape = this.parseHexDigit(sampleAndVol[1]);
			table = this.parseHexDigit(sampleAndVol[2]);
			volume = this.parseHexDigit(sampleAndVol[3]);
		}

		return {
			note,
			instrument,
			volume,
			table,
			envelopeShape,
			effects
		};
	}

	private convertPattern(
		vt2Pattern: VT2Pattern,
		pattern: Pattern,
		channelOffset: number = 0
	): void {
		const ZERO_VALUE = -1;

		for (
			let rowIndex = 0;
			rowIndex < Math.min(vt2Pattern.rows.length, pattern.length);
			rowIndex++
		) {
			const vt2Row = vt2Pattern.rows[rowIndex];

			if (!vt2Row) {
				continue;
			}

			if (rowIndex < pattern.patternRows.length) {
				pattern.patternRows[rowIndex].envelopeValue =
					vt2Pattern.envelopeValues[rowIndex] || 0;

				const noiseValue = vt2Pattern.noiseValues[rowIndex];
				pattern.patternRows[rowIndex].noiseValue =
					noiseValue === 0 ? ZERO_VALUE : noiseValue;
			}

			for (let channelIndex = 0; channelIndex < 3; channelIndex++) {
				const sourceChannelIndex = channelOffset + channelIndex;
				const vt2ChannelData = vt2Row[sourceChannelIndex];
				const row = pattern.channels[channelIndex].rows[rowIndex];

				if (!vt2ChannelData) {
					continue;
				}

				const { noteName, octave } = this.parseNote(vt2ChannelData.note || '---');
				row.note = new Note(noteName, octave);
				row.instrument = vt2ChannelData.instrument ?? 0;
				row.volume = vt2ChannelData.volume ?? 0;
				row.table = this.convertTableValue(
					vt2ChannelData.table ?? 0,
					vt2ChannelData.envelopeShape ?? 0
				);
				row.envelopeShape = vt2ChannelData.envelopeShape ?? 0;

				const { channelEffect, envelopeEffect } = this.parseEffects(
					vt2ChannelData.effects || ''
				);
				row.effects = channelEffect;

				if (envelopeEffect && rowIndex < pattern.patternRows.length) {
					pattern.patternRows[rowIndex].envelopeEffect = envelopeEffect;
				}
			}
		}
	}

	private parseNote(noteStr: string): { noteName: NoteName; octave: number } {
		if (!noteStr || noteStr === '---') {
			return { noteName: NoteName.None, octave: 0 };
		}
		if (noteStr === 'R--' || noteStr === 'OFF') {
			return { noteName: NoteName.Off, octave: 0 };
		}

		let notePart = '';
		let octave = 0;

		if (noteStr.length >= 3) {
			if (noteStr[1] === '#') {
				notePart = noteStr.substring(0, 2);
				octave = parseInt(noteStr.substring(2)) || 0;
			} else if (noteStr[1] === '-') {
				notePart = noteStr[0];
				octave = parseInt(noteStr.substring(2)) || 0;
			} else {
				notePart = noteStr[0];
				octave = parseInt(noteStr.substring(1)) || 0;
			}
		} else if (noteStr.length === 2) {
			notePart = noteStr[0];
			octave = parseInt(noteStr.substring(1)) || 0;
		} else {
			notePart = noteStr;
			octave = 4;
		}

		return {
			noteName: this.noteNameMap[notePart] || NoteName.None,
			octave
		};
	}

	private parseEffects(effectsStr: string): {
		channelEffect: (Effect | null)[];
		envelopeEffect: Effect | null;
	} {
		const trimmed = effectsStr.trim();

		if (!trimmed || trimmed.length < 1 || trimmed.length > 4) {
			return { channelEffect: [null], envelopeEffect: null };
		}

		const effectTypeChar = trimmed[0];

		if (effectTypeChar === '.') {
			return { channelEffect: [null], envelopeEffect: null };
		}

		let delay = 0;
		let parameter = 0;

		if (trimmed.length === 3) {
			parameter = parseInt(trimmed.slice(1, 3).replace(/\./g, '0'), 16) || 0;
		} else if (trimmed.length === 4) {
			const delayChar = trimmed[1];
			const param1Char = trimmed[2];
			const param2Char = trimmed[3];
			delay = this.parseHexDigit(delayChar);
			const param1 = param1Char !== '.' ? this.parseHexDigit(param1Char) : 0;
			const param2 = param2Char !== '.' ? this.parseHexDigit(param2Char) : 0;
			parameter = (param1 << 4) | param2;
		}

		if (effectTypeChar === '9') {
			return {
				channelEffect: [null],
				envelopeEffect: new Effect(EffectType.SlideUp, delay, parameter)
			};
		} else if (effectTypeChar === 'A') {
			return {
				channelEffect: [null],
				envelopeEffect: new Effect(EffectType.SlideDown, delay, parameter)
			};
		}

		const effectType = this.effectTypeMap[effectTypeChar];
		if (!effectType) {
			return { channelEffect: [null], envelopeEffect: null };
		}

		return {
			channelEffect: [new Effect(effectType, delay, parameter)],
			envelopeEffect: null
		};
	}

	private parseHexDigit(char: string): number {
		if (char === '.') return 0;
		if (char >= '0' && char <= '9') return parseInt(char);
		if (char >= 'A' && char <= 'F') return char.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
		if (char >= 'a' && char <= 'f') return char.charCodeAt(0) - 'a'.charCodeAt(0) + 10;
		return 0;
	}

	private convertTableValue(table: number, envelopeShape: number): number {
		const TABLE_OFF_VALUE = -1;
		const NO_ENVELOPE = 0;

		if (envelopeShape !== NO_ENVELOPE && table === 0) {
			return TABLE_OFF_VALUE;
		}
		return table;
	}

	private parseBase36Digit(char: string): number {
		if (!char || char === '.') return 0;
		const upperChar = char.toUpperCase();
		if (upperChar >= '0' && upperChar <= '9') {
			return parseInt(upperChar, 10);
		}
		if (upperChar >= 'A' && upperChar <= 'Z') {
			return upperChar.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
		}
		return 0;
	}

	private extractSection(lines: string[], sectionName: string): string[] {
		const content: string[] = [];
		let inSection = false;

		for (const line of lines) {
			if (line === sectionName) {
				inSection = true;
				continue;
			}
			if (line.startsWith('[') && line !== sectionName) {
				inSection = false;
				continue;
			}
			if (inSection && line) {
				content.push(line);
			}
		}

		return content;
	}

	private extractSections(
		lines: string[],
		pattern: RegExp
	): Array<{ match: RegExpMatchArray; content: string[] }> {
		const sections: Array<{ match: RegExpMatchArray; content: string[] }> = [];
		let currentMatch: RegExpMatchArray | null = null;
		let currentContent: string[] = [];

		for (const line of lines) {
			if (line === '[Module]') {
				if (currentMatch) {
					sections.push({ match: currentMatch, content: currentContent });
					currentMatch = null;
					currentContent = [];
				}
				continue;
			}

			const match = line.match(pattern);
			if (match) {
				if (currentMatch) {
					sections.push({ match: currentMatch, content: currentContent });
				}
				currentMatch = match;
				currentContent = [];
				continue;
			}

			if (currentMatch) {
				if (line && !line.startsWith('[')) {
					currentContent.push(line);
				} else if (line.startsWith('[')) {
					sections.push({ match: currentMatch, content: currentContent });
					currentMatch = null;
					currentContent = [];
				}
			}
		}

		if (currentMatch) {
			sections.push({ match: currentMatch, content: currentContent });
		}

		return sections;
	}
}

/**
 * Loads and converts a VT2 file to a Song object
 */
export async function loadVT2File(file: File): Promise<Project> {
	const content = await file.text();
	const converter = new VT2Converter();
	return converter.convert(content);
}

/**
 * Converts VT2 file content (as string) to a Song object
 */
export function convertVT2String(content: string): Project {
	const converter = new VT2Converter();
	return converter.convert(content);
}

/**
 * Loads and converts a PT3 file to a Project object
 */
export async function loadPT3File(file: File): Promise<Project> {
	const buffer = await file.arrayBuffer();
	const vt2Content = convertPT3ToVT2(buffer);
	const project = convertVT2String(vt2Content);
	console.log('[PT3 import]', {
		patternOrder: project.patternOrder,
		patternOrderLength: project.patternOrder?.length,
		songsCount: project.songs.length,
		patternsCount: project.songs[0]?.patterns?.length ?? 0,
		patternIds: project.songs[0]?.patterns?.map((p) => p.id) ?? [],
		initialSpeed: project.songs[0]?.initialSpeed,
		instrumentsCount: project.instruments?.length ?? 0,
		loopPointId: project.loopPointId
	});
	return project;
}

export { VT2Converter };
