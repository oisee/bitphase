<script lang="ts">
	import type { Pattern } from '../../models/song';
	import type { Chip } from '../../chips/types';
	import { playbackStore } from '../../stores/playback.svelte';
	import { projectStore } from '../../stores/project.svelte';

	let {
		songIndex,
		selectedRow,
		selectedFieldKey,
		currentPatternOrderIndex,
		chip
	}: {
		songIndex: number;
		selectedRow: number;
		selectedFieldKey: string | null;
		currentPatternOrderIndex: number;
		chip: Chip;
	} = $props();

	const patternOrder = $derived(projectStore.patternOrder);
	const patterns = $derived(projectStore.patterns[songIndex] ?? []);
	const speed = $derived(projectStore.songs[songIndex]?.initialSpeed ?? 3);
	const interruptFrequency = $derived(projectStore.songs[songIndex]?.interruptFrequency ?? 50);
	const pattern = $derived(
		patterns.find((p) => p.id === patternOrder[currentPatternOrderIndex]) ?? null
	);

	const schema = chip.schema;

	const helpMessage = $derived.by(() => {
		if (!pattern || selectedRow < 0 || selectedRow >= pattern.length || !selectedFieldKey) {
			return '';
		}

		const field = schema.fields[selectedFieldKey] || schema.globalFields?.[selectedFieldKey];
		if (!field) {
			return '';
		}

		const fieldType = field.type;

		if (fieldType === 'note') {
			return 'Note: Enter a note. You can enter OFF to stop playback.';
		}

		if (selectedFieldKey === 'instrument') {
			return 'Instrument: Select an instrument number. Base 36: (01-ZZ). Empty (..) means no instrument.';
		}

		if (selectedFieldKey === 'volume') {
			return 'Volume: Set channel volume. Hex: (1-F).';
		}

		if (selectedFieldKey === 'effect') {
			return 'Effect: Enter effect command (e.g., A137, S.03, P30F). Check effects list for available commands.';
		}

		if (selectedFieldKey === 'envelopeEffect') {
			return 'Envelope Effect: Set envelope effect command (e.g., A158, 2112). Check effects list for available commands.';
		}

		if (selectedFieldKey === 'envelopeValue') {
			return 'Envelope Value: Set envelope generator period value. Hex: (0000-FFFF).';
		}

		if (selectedFieldKey === 'table') {
			return 'Table: Select a table number. Base 36: (0-9, A-Z).';
		}

		if (selectedFieldKey === 'envelopeShape') {
			return 'Envelope Shape: Set envelope generator shape. Hex: (1-F).';
		}

		if (selectedFieldKey === 'noiseValue') {
			return 'Noise: Set noise generator value. Hex: (00-1F).';
		}

		if (fieldType === 'hex') {
			return `Hex value: Enter hexadecimal value (0-${'F'.repeat(field.length)}).`;
		}

		if (fieldType === 'symbol') {
			return `Symbol: Enter symbol value (0-9, A-Z).`;
		}

		return '';
	});

	function calculateTimeToPosition(
		patternOrder: number[],
		patterns: Pattern[],
		targetPatternOrderIndex: number,
		targetRow: number,
		initialSpeed: number,
		interruptFrequency: number
	): number {
		let totalTime = 0;
		const SPEED_EFFECT_TYPE = 'S'.charCodeAt(0);
		let currentSpeed = initialSpeed;

		for (let orderIdx = 0; orderIdx <= targetPatternOrderIndex; orderIdx++) {
			if (orderIdx >= patternOrder.length) break;

			const patternId = patternOrder[orderIdx];
			const pattern = patterns.find((p) => p.id === patternId);
			if (!pattern) continue;

			const maxRow = orderIdx === targetPatternOrderIndex ? targetRow : pattern.length - 1;

			for (let rowIdx = 0; rowIdx <= maxRow; rowIdx++) {
				for (const channel of pattern.channels) {
					const row = channel.rows[rowIdx];
					if (!row?.effects?.[0] || row.effects[0].effect !== SPEED_EFFECT_TYPE) continue;
					const speedValue = row.effects[0].parameter;
					if (speedValue > 0) {
						currentSpeed = speedValue;
					}
				}

				const rowDuration = currentSpeed / interruptFrequency;
				totalTime += rowDuration;
			}
		}

		return totalTime;
	}

	const currentTime = $derived.by(() => {
		if (!pattern || patternOrder.length === 0) {
			return 0;
		}

		return calculateTimeToPosition(
			patternOrder,
			patterns,
			currentPatternOrderIndex,
			selectedRow,
			speed,
			interruptFrequency
		);
	});

	let baseTime = $state(0);
	let baseTimestamp = $state(0);

	$effect(() => {
		selectedRow;
		currentPatternOrderIndex;
		playbackStore.isPlaying;
		baseTime = currentTime;
		baseTimestamp = Date.now();
	});

	function formatTime(seconds: number): string {
		const minutes = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}

	function getRowSpeed(pattern: Pattern, rowIdx: number, currentSpeed: number): number {
		const SPEED_EFFECT_TYPE = 'S'.charCodeAt(0);
		let rowSpeed = currentSpeed;

		for (const channel of pattern.channels) {
			const row = channel.rows[rowIdx];
			if (!row?.effects?.[0] || row.effects[0].effect !== SPEED_EFFECT_TYPE) continue;
			const speedValue = row.effects[0].parameter;
			if (speedValue > 0) {
				rowSpeed = speedValue;
			}
		}

		return rowSpeed;
	}

	function calculateSampleCounter(
		patternOrder: number[],
		patterns: Pattern[],
		targetPatternOrderIndex: number,
		targetRow: number,
		initialSpeed: number
	): number {
		let totalSamples = 0;
		let currentSpeed = initialSpeed;

		for (let orderIdx = 0; orderIdx < targetPatternOrderIndex; orderIdx++) {
			if (orderIdx >= patternOrder.length) break;

			const patternId = patternOrder[orderIdx];
			const pattern = patterns.find((p) => p.id === patternId);
			if (!pattern) continue;

			for (let rowIdx = 0; rowIdx < pattern.length; rowIdx++) {
				const rowSpeed = getRowSpeed(pattern, rowIdx, currentSpeed);
				currentSpeed = rowSpeed;
				totalSamples += rowSpeed;
			}
		}

		if (targetPatternOrderIndex < patternOrder.length && targetRow >= 0) {
			const patternId = patternOrder[targetPatternOrderIndex];
			const pattern = patterns.find((p) => p.id === patternId);
			if (pattern) {
				if (targetPatternOrderIndex > 0) {
					const prevPatternId = patternOrder[targetPatternOrderIndex - 1];
					const prevPattern = patterns.find((p) => p.id === prevPatternId);
					if (prevPattern) {
						let prevPatternSpeed = currentSpeed;
						for (let prevRowIdx = 0; prevRowIdx < prevPattern.length; prevRowIdx++) {
							prevPatternSpeed = getRowSpeed(
								prevPattern,
								prevRowIdx,
								prevPatternSpeed
							);
						}
						totalSamples += prevPatternSpeed;
						currentSpeed = prevPatternSpeed;
					}
				}

				for (let rowIdx = 0; rowIdx < targetRow; rowIdx++) {
					const rowSpeed = getRowSpeed(pattern, rowIdx, currentSpeed);
					currentSpeed = rowSpeed;
					totalSamples += rowSpeed;
				}
			}
		}

		return totalSamples;
	}

	const sampleCounter = $derived.by(() => {
		if (!pattern || patternOrder.length === 0) {
			return 0;
		}

		return calculateSampleCounter(
			patternOrder,
			patterns,
			currentPatternOrderIndex,
			selectedRow,
			speed
		);
	});

	const maxSampleCounter = $derived.by(() => {
		if (patternOrder.length === 0) {
			return 0;
		}

		const lastPatternIndex = patternOrder.length - 1;
		const lastPatternId = patternOrder[lastPatternIndex];
		const lastPattern = patterns.find((p) => p.id === lastPatternId);
		if (!lastPattern) {
			return 0;
		}

		return calculateSampleCounter(
			patternOrder,
			patterns,
			lastPatternIndex,
			lastPattern.length - 1,
			speed
		);
	});

	const maxTime = $derived.by(() => {
		void playbackStore.isPlaying;
		if (patternOrder.length === 0) {
			return 0;
		}

		const lastPatternIndex = patternOrder.length - 1;
		const lastPatternId = patternOrder[lastPatternIndex];
		const lastPattern = patterns.find((p) => p.id === lastPatternId);
		if (!lastPattern) {
			return 0;
		}

		return calculateTimeToPosition(
			patternOrder,
			patterns,
			lastPatternIndex,
			lastPattern.length - 1,
			speed,
			interruptFrequency
		);
	});

	const displayedTime = $derived.by(() => {
		if (!playbackStore.isPlaying) return currentTime;
		const elapsed = baseTime + (Date.now() - baseTimestamp) / 1000;
		return Math.min(elapsed, maxTime);
	});
</script>

<div
	class="flex h-6 items-center gap-4 border-t border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] px-4 text-xs text-[var(--color-app-text-muted)]">
	<div class="flex-1 truncate">
		{helpMessage || '=== Ready ==='}
	</div>
	<div class="shrink-0">
		Tick: {sampleCounter} / {maxSampleCounter}
	</div>
	<div class="shrink-0">
		Time: {formatTime(displayedTime)} / {formatTime(maxTime)}
	</div>
</div>
