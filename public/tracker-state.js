const DEFAULT_SONG_HZ = 50;
const DEFAULT_SPEED = 3;

class TrackerState {
	constructor(channelCount = 3) {
		this.currentPattern = null;
		this.currentTuningTable = [];

		this.patternOrder = [];
		this.currentPatternOrderIndex = 0;

		this.intFrequency = DEFAULT_SONG_HZ;
		this.samplesPerTick = 0;
		this.sampleCounter = 0;
		this.tickAccumulator = 0.0;
		this.tickStep = 0.0;
		this.currentRow = 0;
		this.currentTick = 0;
		this.currentSpeed = DEFAULT_SPEED;

		this.channelPatternVolumes = Array(channelCount).fill(15);

		this.tables = [];
		this.tablesById = {};
		this.channelTables = Array(channelCount).fill(-1);
		this.tablePositions = Array(channelCount).fill(0);
		this.tableCounters = Array(channelCount).fill(0);
		this.channelBaseNotes = Array(channelCount).fill(0);
		this.channelCurrentNotes = Array(channelCount).fill(0);
		this.channelToneSliding = Array(channelCount).fill(0);
		this.channelVibratoSliding = Array(channelCount).fill(0);
		this.channelSlideStep = Array(channelCount).fill(0);
		this.channelSlideDelay = Array(channelCount).fill(0);
		this.channelSlideCount = Array(channelCount).fill(0);
		this.channelPreviousNotes = Array(channelCount).fill(0);
		this.channelPortamentoTarget = Array(channelCount).fill(-1);
		this.channelPortamentoDelta = Array(channelCount).fill(0);
		this.channelPortamentoActive = Array(channelCount).fill(false);
		this.channelPortamentoDelay = Array(channelCount).fill(0);
		this.channelPortamentoCount = Array(channelCount).fill(0);
		this.channelOnDuration = Array(channelCount).fill(0);
		this.channelOffDuration = Array(channelCount).fill(0);
		this.channelOnOffCounter = Array(channelCount).fill(0);
		this.channelArpeggioSemitone1 = Array(channelCount).fill(0);
		this.channelArpeggioSemitone2 = Array(channelCount).fill(0);
		this.channelArpeggioDelay = Array(channelCount).fill(0);
		this.channelArpeggioCounter = Array(channelCount).fill(0);
		this.channelArpeggioPosition = Array(channelCount).fill(0);
		this.channelVibratoSpeed = Array(channelCount).fill(0);
		this.channelVibratoDepth = Array(channelCount).fill(0);
		this.channelVibratoDelay = Array(channelCount).fill(0);
		this.channelVibratoCounter = Array(channelCount).fill(0);
		this.channelVibratoPosition = Array(channelCount).fill(0);
		this.channelDetune = Array(channelCount).fill(0);

		this.channelEffectTables = Array(channelCount).fill(-1);
		this.channelEffectTablePositions = Array(channelCount).fill(0);
		this.channelEffectTableCounters = Array(channelCount).fill(0);
		this.channelEffectTableDelays = Array(channelCount).fill(1);
		this.channelEffectTypes = Array(channelCount).fill(0);

		this.speedTable = -1;
		this.speedTablePosition = 0;
	}

	reset() {
		this.sampleCounter = 0;
		this.tickAccumulator = 0.0;
		this.currentRow = 0;
		this.currentTick = 0;
		this.currentSpeed = DEFAULT_SPEED;
		this.channelPatternVolumes.fill(15);
		this.channelTables.fill(-1);
		this.tablePositions.fill(0);
		this.tableCounters.fill(0);
		this.channelBaseNotes.fill(0);
		this.channelCurrentNotes.fill(0);
		this.channelToneSliding.fill(0);
		this.channelVibratoSliding.fill(0);
		this.channelSlideStep.fill(0);
		this.channelSlideDelay.fill(0);
		this.channelSlideCount.fill(0);
		this.channelPreviousNotes.fill(0);
		this.channelPortamentoTarget.fill(-1);
		this.channelPortamentoDelta.fill(0);
		this.channelPortamentoActive.fill(false);
		this.channelPortamentoDelay.fill(0);
		this.channelPortamentoCount.fill(0);
		this.channelOnDuration.fill(0);
		this.channelOffDuration.fill(0);
		this.channelOnOffCounter.fill(0);
		this.channelArpeggioSemitone1.fill(0);
		this.channelArpeggioSemitone2.fill(0);
		this.channelArpeggioDelay.fill(0);
		this.channelArpeggioCounter.fill(0);
		this.channelArpeggioPosition.fill(0);
		this.channelVibratoSpeed.fill(0);
		this.channelVibratoDepth.fill(0);
		this.channelVibratoDelay.fill(0);
		this.channelVibratoCounter.fill(0);
		this.channelVibratoPosition.fill(0);
		this.channelDetune.fill(0);

		this.channelEffectTables.fill(-1);
		this.channelEffectTablePositions.fill(0);
		this.channelEffectTableCounters.fill(0);
		this.channelEffectTableDelays.fill(1);
		this.channelEffectTypes.fill(0);

		this.speedTable = -1;
		this.speedTablePosition = 0;
	}

	setTuningTable(table) {
		this.currentTuningTable = table;
	}

	updateSamplesPerTick(sampleRate) {
		this.samplesPerTick = Math.floor(sampleRate / this.intFrequency);
		this.tickStep = this.intFrequency / sampleRate;
	}

	setPattern(pattern, orderIndex) {
		this.currentPattern = pattern;
		if (orderIndex !== undefined) {
			this.currentPatternOrderIndex = orderIndex;
		}
		// Ensure current row is within valid bounds for the new pattern
		if (this.currentPattern && this.currentRow >= this.currentPattern.length) {
			this.currentRow = Math.max(0, this.currentPattern.length - 1);
		}
	}

	setSpeed(speed) {
		this.currentSpeed = speed;
	}

	setPatternOrder(order) {
		this.patternOrder = order;
	}

	setTables(tables) {
		this.tables = tables;
		this.tablesById = {};
		if (tables) {
			for (let i = 0; i < tables.length; i++) {
				const t = tables[i];
				if (t && t.id !== undefined) {
					this.tablesById[t.id] = t;
				}
			}
		}
	}

	getTable(id) {
		return this.tablesById?.[id];
	}

	setIntFrequency(frequency, sampleRate) {
		this.intFrequency = frequency;
		this.updateSamplesPerTick(sampleRate);
	}

	advancePosition() {
		this.currentTick++;
		if (this.currentTick >= this.currentSpeed) {
			this.currentTick = 0;
			this.currentRow++;
			if (this.currentRow >= this.currentPattern.length) {
				this.currentRow = 0;
				this.currentPatternOrderIndex++;
				if (this.currentPatternOrderIndex >= this.patternOrder.length) {
					this.currentPatternOrderIndex = 0;
				}
				return true;
			}
		}
		return false;
	}
}

export default TrackerState;
