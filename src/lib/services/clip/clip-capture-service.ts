import type { Project } from '../../models/project';
import type { Pattern } from '../../models/song';
import type { ResourceLoader } from '../../chips/base/resource-loader';
import { BrowserResourceLoader } from '../../chips/base/resource-loader';
import { Clip } from '../../models/clip';
import type { ChipFrame } from '../../fluff/chip-frame';
import { getTotalVirtualChannelCount } from '../../models/virtual-channels';

const SAMPLE_RATE = 44100;
const DEFAULT_SPEED = 6;
const AYUMI_STRUCT_SIZE = 22928;
const TONE_CHANNELS = 3;
const DEFAULT_AYM_FREQUENCY = 1773400;

type PanSetting = { channel: number; pan: number; isEqp: number };
type GetPanSettingsForLayout = (layout: string) => PanSetting[];

export interface CaptureOptions {
	startOrderIndex?: number;
	endOrderIndex?: number;
	onProgress?: (progress: number, message: string) => void;
}

export class ClipCaptureService {
	private loader: ResourceLoader;

	constructor(loader?: ResourceLoader) {
		this.loader = loader ?? new BrowserResourceLoader();
	}

	async captureFromSong(
		project: Project,
		songIndex: number,
		options: CaptureOptions = {}
	): Promise<Clip> {
		const song = project.songs[songIndex];
		if (!song || song.patterns.length === 0) {
			throw new Error('Song is empty');
		}

		const { onProgress } = options;

		onProgress?.(0, 'Loading WASM module...');
		const wasmBuffer = await this.loader.loadWasm('ayumi.wasm');

		onProgress?.(10, 'Instantiating WASM...');
		const result = await WebAssembly.instantiate(wasmBuffer, {
			env: { emscripten_notify_memory_growth: () => {} }
		});
		const wasm = result.instance.exports as any;

		const { getPanSettingsForLayout } =
			await this.loader.loadModule<{ getPanSettingsForLayout: GetPanSettingsForLayout }>(
				'ayumi-constants.js'
			);

		const chipFrequency = (song as any).chipFrequency || DEFAULT_AYM_FREQUENCY;
		const ayumiPtr = wasm.malloc(AYUMI_STRUCT_SIZE);
		if (!ayumiPtr) throw new Error('Failed to allocate Ayumi structure');

		const isYM = song.chipType === 'ay' && song.chipVariant === 'YM' ? 1 : 0;
		wasm.ayumi_configure(ayumiPtr, isYM, chipFrequency, SAMPLE_RATE);

		const stereoLayout = (song as { stereoLayout?: string }).stereoLayout ?? 'ABC';
		const panSettings = getPanSettingsForLayout(stereoLayout);
		panSettings.forEach(({ channel, pan, isEqp }) => {
			wasm.ayumi_set_pan(ayumiPtr, channel, pan, isEqp);
		});

		onProgress?.(20, 'Loading processor modules...');
		const { default: AyumiState } = await this.loader.loadModule<{ default: new (c?: number) => any }>(
			'ayumi-state.js'
		);
		const { default: TrackerPatternProcessor } =
			await this.loader.loadModule<{ default: new (a: any, b: any, c: any) => any }>(
				'tracker-pattern-processor.js'
			);
		const { default: AYAudioDriver } =
			await this.loader.loadModule<{ default: new (c?: number) => any }>('ay-audio-driver.js');
		const { default: AyumiEngine } =
			await this.loader.loadModule<{ default: new (a: any, b: any) => any }>('ayumi-engine.js');
		const { default: AYChipRegisterState } =
			await this.loader.loadModule<{ default: new (c?: number) => any }>('ay-chip-register-state.js');
		const { default: VirtualChannelMixer } =
			await this.loader.loadModule<{ default: new () => any }>('virtual-channel-mixer.js');

		const virtualChannelMap: Record<number, number> = song.virtualChannelMap ?? {};
		const hasVirtual = Object.values(virtualChannelMap).some((c: number) => c > 1);
		const totalChannelCount = hasVirtual
			? getTotalVirtualChannelCount(TONE_CHANNELS, virtualChannelMap)
			: TONE_CHANNELS;

		const state = new AyumiState(totalChannelCount);
		const interruptFrequency = song.interruptFrequency || 50;
		state.setWasmModule(wasm, ayumiPtr, wasmBuffer);
		state.setAymFrequency(chipFrequency);
		state.setIntFrequency(interruptFrequency, SAMPLE_RATE);
		state.setTuningTable(song.tuningTable);
		state.setInstruments(project.instruments);
		state.setTables(project.tables);
		state.setPatternOrder(project.patternOrder || [0]);
		state.setSpeed(song.initialSpeed || DEFAULT_SPEED);
		state.updateSamplesPerTick(SAMPLE_RATE);

		const audioDriver = new AYAudioDriver(totalChannelCount);
		const ayumiEngine = new AyumiEngine(wasm, ayumiPtr);
		const registerState = new AYChipRegisterState(totalChannelCount);
		const mixer = new VirtualChannelMixer();
		if (hasVirtual) {
			mixer.configure(virtualChannelMap, TONE_CHANNELS);
		}
		const patternProcessor = new TrackerPatternProcessor(state, audioDriver, {
			postMessage: () => {}
		});

		const patternOrder = project.patternOrder || [0];
		const startIdx = options.startOrderIndex ?? 0;
		const endIdx = options.endOrderIndex ?? patternOrder.length - 1;
		const effectiveOrder = patternOrder.slice(startIdx, endIdx + 1);

		const patterns: Pattern[] = [];
		for (const patternId of effectiveOrder) {
			const pattern = song.patterns.find((p: Pattern) => p.id === patternId);
			if (pattern) patterns.push(pattern);
		}

		if (patterns.length === 0) {
			wasm.free(ayumiPtr);
			throw new Error('No patterns found');
		}

		state.setPatternOrder(effectiveOrder);
		state.currentPattern = patterns[0];
		state.currentPatternOrderIndex = 0;

		onProgress?.(50, 'Capturing frames...');

		const capturedFrames: ChipFrame[] = [];
		const maxSamples = SAMPLE_RATE * 300;
		let totalSamples = 0;

		while (totalSamples < maxSamples) {
			state.tickAccumulator += state.tickStep;

			if (state.tickAccumulator >= 1.0) {
				if (state.currentTick === 0 && state.currentPattern) {
					patternProcessor.parsePatternRow(
						state.currentPattern,
						state.currentRow,
						registerState
					);
					patternProcessor.processSpeedTable();
				}

				patternProcessor.processTables();
				patternProcessor.processArpeggio();
				patternProcessor.processEffectTables();
				audioDriver.processInstruments(state, registerState);
				patternProcessor.processVibrato();
				patternProcessor.processSlides();

				let finalState: any;
				if (mixer.hasVirtualChannels()) {
					finalState = mixer.merge(registerState, state);
					registerState.forceEnvelopeShapeWrite = false;
				} else {
					finalState = registerState;
				}

				const frame = this.captureFrame(finalState);
				capturedFrames.push(frame);

				ayumiEngine.applyRegisterState(finalState);

				const isLastPattern =
					state.currentPatternOrderIndex >= effectiveOrder.length - 1;
				const isLastRow = state.currentRow >= state.currentPattern.length - 1;
				const isLastTick = state.currentTick >= state.currentSpeed - 1;

				if (isLastPattern && isLastRow && isLastTick) break;

				const needsPatternChange = state.advancePosition();
				if (needsPatternChange) {
					if (state.currentPatternOrderIndex >= effectiveOrder.length) break;
					if (state.currentPatternOrderIndex < patterns.length) {
						state.currentPattern = patterns[state.currentPatternOrderIndex];
					} else {
						break;
					}
				}

				state.tickAccumulator -= 1.0;
			}

			ayumiEngine.process();
			ayumiEngine.removeDC();
			totalSamples++;
		}

		wasm.free(ayumiPtr);
		onProgress?.(100, 'Capture complete');

		const clipName = project.name
			? `${project.name} - Clip`
			: `Clip ${new Date().toLocaleTimeString()}`;

		return new Clip(clipName, capturedFrames, {
			sourceChannelCount: TONE_CHANNELS,
			chipClock: chipFrequency,
			interruptFrequency
		});
	}

	private captureFrame(registerState: any): ChipFrame {
		const channels = registerState.channels;
		return {
			a: {
				p: channels[0]?.tone ?? 0,
				v: channels[0]?.volume ?? 0,
				e: channels[0]?.mixer?.envelope ?? false,
				t: channels[0]?.mixer?.tone ?? false,
				n: channels[0]?.mixer?.noise ?? false
			},
			b: {
				p: channels[1]?.tone ?? 0,
				v: channels[1]?.volume ?? 0,
				e: channels[1]?.mixer?.envelope ?? false,
				t: channels[1]?.mixer?.tone ?? false,
				n: channels[1]?.mixer?.noise ?? false
			},
			c: {
				p: channels[2]?.tone ?? 0,
				v: channels[2]?.volume ?? 0,
				e: channels[2]?.mixer?.envelope ?? false,
				t: channels[2]?.mixer?.tone ?? false,
				n: channels[2]?.mixer?.noise ?? false
			},
			e: {
				p: registerState.envelopePeriod ?? 0,
				f: registerState.envelopeShape ?? 0
			},
			n: {
				p: registerState.noise ?? 0
			}
		};
	}
}
