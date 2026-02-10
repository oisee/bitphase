import { DEFAULT_AYM_FREQUENCY } from './ayumi-constants.js';
import TrackerState from './tracker-state.js';

class AyumiState extends TrackerState {
	constructor() {
		super(3);
		this.wasmModule = null;
		this.ayumiPtr = null;
		this.aymFrequency = DEFAULT_AYM_FREQUENCY;
		this.isYM = 0;
		this.wasmBuffer = null;

		this.instruments = [];
		this.instrumentIdToIndex = new Map();
		this.channelInstruments = Array(3).fill(-1);
		this.instrumentPositions = Array(3).fill(0);
		this.channelInstrumentVolumes = Array(3).fill(0);
		this.channelToneAccumulator = Array(3).fill(0);
		this.channelNoiseAccumulator = Array(3).fill(0);
		this.channelEnvelopeAccumulator = Array(3).fill(0);
		this.channelAmplitudeSliding = Array(3).fill(0);
		this.channelEnvelopeEnabled = Array(3).fill(false);
		this.channelMuted = Array(3).fill(false);
		this.channelSoundEnabled = Array(3).fill(false);

		this.envelopeSlideDelay = 0;
		this.envelopeSlideDelayCounter = 0;
		this.envelopeSlideDelta = 0;
		this.envelopeSlideCurrent = 0;
		this.envelopeBaseValue = 0;
		this.envelopePortamentoTarget = -1;
		this.envelopePortamentoDelta = 0;
		this.envelopePortamentoActive = false;
		this.envelopePortamentoDelay = 0;
		this.envelopePortamentoCount = 0;
		this.envelopePortamentoStep = 0;
		this.envelopeOnDuration = 0;
		this.envelopeOffDuration = 0;
		this.envelopeOnOffCounter = 0;
		this.envelopeOnOffEnabled = false;
		this.envelopeArpeggioSemitone1 = 0;
		this.envelopeArpeggioSemitone2 = 0;
		this.envelopeArpeggioDelay = 0;
		this.envelopeArpeggioCounter = 0;
		this.envelopeArpeggioPosition = 0;
		this.envelopeArpeggioBaseValue = 0;
		this.noiseBaseValue = 0;
		this.noisePreviousValue = 0;
		this.noiseAddValue = 0;
		this.envelopeAddValue = 0;

		this.envelopeEffectTable = -1;
		this.envelopeEffectTablePosition = 0;
		this.envelopeEffectTableCounter = 0;
		this.envelopeEffectTableDelay = 1;
		this.envelopeEffectType = 0;
		this.envelopeVibratoSpeed = 1;
		this.envelopeVibratoDepth = 0;
		this.envelopeVibratoDelay = 0;
		this.envelopeVibratoCounter = 0;
		this.envelopeVibratoPosition = 0;
		this.envelopeVibratoSliding = 0;

		this.autoEnvelopeActive = false;
		this.autoEnvelopeNumerator = 0;
		this.autoEnvelopeDenominator = 0;
	}

	setWasmModule(module, ptr, wasmBuffer) {
		this.wasmModule = module;
		this.ayumiPtr = ptr;
		this.wasmBuffer = wasmBuffer;
	}

	setAymFrequency(frequency) {
		this.aymFrequency = frequency;
	}

	setChipVariant(chipVariant) {
		this.isYM = chipVariant === 'YM' ? 1 : 0;
	}

	setInstruments(instruments) {
		this.instruments = instruments;
		this.instrumentIdToIndex = new Map();
		instruments.forEach((instrument, index) => {
			if (instrument && instrument.id !== undefined) {
				let numericId;
				if (typeof instrument.id === 'string') {
					numericId = parseInt(instrument.id, 36);
				} else {
					numericId = instrument.id;
				}
				this.instrumentIdToIndex.set(numericId, index);
			}
		});
	}

	reset() {
		super.reset();
		this.channelInstruments.fill(-1);
		this.instrumentPositions.fill(0);
		this.channelInstrumentVolumes.fill(0);
		this.channelToneAccumulator.fill(0);
		this.channelNoiseAccumulator.fill(0);
		this.channelEnvelopeAccumulator.fill(0);
		this.channelAmplitudeSliding.fill(0);
		this.channelEnvelopeEnabled.fill(false);
		this.channelSoundEnabled.fill(false);

		this.envelopeSlideDelay = 0;
		this.envelopeSlideDelayCounter = 0;
		this.envelopeSlideDelta = 0;
		this.envelopeSlideCurrent = 0;
		this.envelopeBaseValue = 0;
		this.envelopePortamentoTarget = -1;
		this.envelopePortamentoDelta = 0;
		this.envelopePortamentoActive = false;
		this.envelopePortamentoDelay = 0;
		this.envelopePortamentoCount = 0;
		this.envelopePortamentoStep = 0;
		this.envelopeOnDuration = 0;
		this.envelopeOffDuration = 0;
		this.envelopeOnOffCounter = 0;
		this.envelopeOnOffEnabled = false;
		this.envelopeArpeggioSemitone1 = 0;
		this.envelopeArpeggioSemitone2 = 0;
		this.envelopeArpeggioDelay = 0;
		this.envelopeArpeggioCounter = 0;
		this.envelopeArpeggioPosition = 0;
		this.envelopeArpeggioBaseValue = 0;
		this.noiseBaseValue = 0;
		this.envelopeAddValue = 0;
		this.noiseAddValue = 0;

		this.envelopeEffectTable = -1;
		this.envelopeEffectTablePosition = 0;
		this.envelopeEffectTableCounter = 0;
		this.envelopeEffectTableDelay = 1;
		this.envelopeEffectType = 0;
		this.envelopeVibratoSpeed = 1;
		this.envelopeVibratoDepth = 0;
		this.envelopeVibratoDelay = 0;
		this.envelopeVibratoCounter = 0;
		this.envelopeVibratoPosition = 0;
		this.envelopeVibratoSliding = 0;

		this.autoEnvelopeActive = false;
		this.autoEnvelopeNumerator = 0;
		this.autoEnvelopeDenominator = 0;
	}
}

export default AyumiState;
