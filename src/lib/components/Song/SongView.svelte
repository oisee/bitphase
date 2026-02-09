<script lang="ts">
	import type { Pattern, Instrument, Song } from '../../models/song';
	import type {
		ChipProcessor,
		TuningTableSupport,
		InstrumentSupport
	} from '../../chips/base/processor';
	import type { AudioService } from '../../services/audio/audio-service';
	import type { Table } from '../../models/project';
	import Card from '../Card/Card.svelte';
	import PatternEditor from './PatternEditor.svelte';
	import PatternOrder from './PatternOrder.svelte';
	import { TabView } from '../TabView';
	import { TablesView } from '../Tables';
	import { DetailsView } from '../Details';
	import { InstrumentsView } from '../Instruments';
	import IconCarbonChip from '~icons/carbon/chip';
	import IconCarbonListBoxes from '~icons/carbon/list-boxes';
	import IconCarbonDataTable from '~icons/carbon/data-table';
	import IconCarbonWaveform from '~icons/carbon/waveform';
	import IconCarbonInformationSquare from '~icons/carbon/information-square';
	import IconCarbonChevronUp from '~icons/carbon/chevron-up';
	import IconCarbonChevronDown from '~icons/carbon/chevron-down';
	import IconCarbonClose from '~icons/carbon/close';
	import { PATTERN_EDITOR_CONSTANTS } from './types';
	import { getContext, setContext, tick } from 'svelte';
	import Input from '../Input/Input.svelte';
	import { playbackStore } from '../../stores/playback.svelte';
	import StatusBar from './StatusBar.svelte';
	import ChannelOscilloscopes from './ChannelOscilloscopes.svelte';
	import { PatternService } from '../../services/pattern/pattern-service';
	import { settingsStore } from '../../stores/settings.svelte';
	import { editorStateStore } from '../../stores/editor-state.svelte';

	let {
		songs = $bindable(),
		patternOrder = $bindable(),
		patternOrderColors = $bindable(),
		chipProcessors,
		patternEditor = $bindable(),
		tables = $bindable(),
		projectSettings = $bindable(),
		activeEditorIndex = $bindable(0),
		onaction
	}: {
		songs: Song[];
		patternOrder: number[];
		patternOrderColors: Record<number, string>;
		chipProcessors: ChipProcessor[];
		patternEditor?: PatternEditor | null;
		tables: Table[];
		projectSettings: Record<string, unknown>;
		activeEditorIndex?: number;
		onaction?: (data: { action: string; songIndex?: number }) => void;
	} = $props();

	let sharedPatternOrderIndex = $state(0);
	let sharedSelectedRow = $state(0);
	let songViewContainer: HTMLDivElement;
	let patternEditors: PatternEditor[] = $state([]);
	let tuningTableVersion = $state(0);
	let rightPanelActiveTabId = $state('instruments');
	let isRightPanelExpanded = $state(false);
	let selectedColumn = $state(0);
	let selectedFieldKey = $state<string | null>(null);

	$effect(() => {
		if (rightPanelActiveTabId === 'details') {
			isRightPanelExpanded = false;
		}
	});

	$effect(() => {
		const activeEditor = patternEditors[activeEditorIndex];
		if (activeEditor) {
			selectedColumn = activeEditor.getSelectedColumn();
			selectedFieldKey = activeEditor.getSelectedFieldKey();
			const interval = setInterval(() => {
				selectedColumn = activeEditor.getSelectedColumn();
				selectedFieldKey = activeEditor.getSelectedFieldKey();
			}, 100);
			return () => clearInterval(interval);
		}
	});

	let patternLengthValue = $state('');

	const blurredContentClass = $derived(
		isRightPanelExpanded ? 'pointer-events-none opacity-50 blur-sm' : ''
	);

	const services: { audioService: AudioService } = getContext('container');

	setContext('requestPatternRedraw', () => {
		patternEditors.forEach((editor) => editor?.requestRedraw?.());
	});

	let patternsRecord = $state<Record<number, Pattern>>({});

	const songPatterns = $derived(songs.flatMap((song) => song.patterns));

	const SPEED_EFFECT_TYPE = 'S'.charCodeAt(0);

	function handlePatternCreated(pattern: Pattern): void {
		songs.forEach((song) => {
			const existingPattern = song.patterns.find((p) => p.id === pattern.id);
			if (!existingPattern) {
				song.patterns = [...song.patterns, pattern];
			} else {
				song.patterns = song.patterns.map((p) => (p.id === pattern.id ? pattern : p));
			}
		});
	}

	function handleMakeUnique(index: number): void {
		const result = PatternService.makePatternUniqueMultiChip(
			songs,
			patternOrder,
			index,
			(i) => chipProcessors[i]?.chip?.schema
		);
		patternOrder = result.newPatternOrder;
		songs = [...songs];
		if (index === sharedPatternOrderIndex) {
			sharedSelectedRow = 0;
		}
		patternEditors.forEach((editor) => editor?.requestRedraw?.());
	}

	function findLastSpeedCommand(
		song: Song,
		patternOrder: number[],
		startPatternOrderIndex: number,
		startRow: number
	): number | null {
		for (
			let patternOrderIdx = startPatternOrderIndex;
			patternOrderIdx >= 0;
			patternOrderIdx--
		) {
			const patternId = patternOrder[patternOrderIdx];
			const pattern = song.patterns.find((p) => p.id === patternId);
			if (!pattern) continue;

			const startRowIdx =
				patternOrderIdx === startPatternOrderIndex ? startRow : pattern.length - 1;

			for (let rowIdx = startRowIdx; rowIdx >= 0; rowIdx--) {
				for (const channel of pattern.channels) {
					const row = channel.rows[rowIdx];
					if (row.effects[0] && row.effects[0].effect === SPEED_EFFECT_TYPE) {
						const speed = row.effects[0].parameter;
						if (speed > 0) {
							return speed;
						}
					}
				}
			}
		}

		return null;
	}

	function getSpeedForChip(chipIndex: number): number | null {
		const song = songs[chipIndex];
		if (!song) return null;

		const lastSpeed = findLastSpeedCommand(
			song,
			patternOrder,
			sharedPatternOrderIndex,
			sharedSelectedRow
		);
		return lastSpeed !== null ? lastSpeed : song.initialSpeed;
	}

	function initAllChips(playPattern: boolean) {
		const patternId = patternOrder[sharedPatternOrderIndex];
		const patternOrderIndexForInit = playPattern ? 0 : sharedPatternOrderIndex;

		if (playPattern) {
			services.audioService.setPlayPatternRestoreOrder([...patternOrder], patternId);
			services.audioService.updateOrder([patternId]);
		}

		chipProcessors.forEach((chipProcessor, index) => {
			const song = songs[index];
			if (!song) return;

			const currentPattern = song.patterns.find((p) => p.id === patternId);
			if (!currentPattern) return;

			chipProcessor.sendInitPattern(currentPattern, patternOrderIndexForInit);
			chipProcessor.sendInitSpeed(song.initialSpeed);

			const withTuningTables = chipProcessor as ChipProcessor & Partial<TuningTableSupport>;
			const withInstruments = chipProcessor as ChipProcessor & Partial<InstrumentSupport>;
			if ('sendInitTuningTable' in chipProcessor && withTuningTables.sendInitTuningTable) {
				withTuningTables.sendInitTuningTable(song.tuningTable);
			}
			if ('sendInitInstruments' in chipProcessor && withInstruments.sendInitInstruments) {
				withInstruments.sendInitInstruments(song.instruments);
			}
		});

		if (!playPattern) {
			services.audioService.updateOrder(patternOrder);
		}
	}

	function initAllChipsForPlayback() {
		initAllChips(false);
	}

	function initAllChipsForPlayPattern() {
		initAllChips(true);
	}

	function getSpeedForPlayPattern(chipIndex: number): number | null {
		const song = songs[chipIndex];
		if (!song) return null;

		const lastSpeed = findLastSpeedCommand(song, patternOrder, sharedPatternOrderIndex, 0);
		return lastSpeed !== null ? lastSpeed : song.initialSpeed;
	}

	$effect(() => {
		if (songs.length === 0) {
			patternsRecord = {};
			return;
		}
		const record: Record<number, Pattern> = {};
		for (const song of songs) {
			for (const pattern of song.patterns) {
				record[pattern.id] = pattern;
			}
		}
		patternsRecord = record;
	});

	const lineHeight =
		PATTERN_EDITOR_CONSTANTS.FONT_SIZE * PATTERN_EDITOR_CONSTANTS.LINE_HEIGHT_MULTIPLIER;

	let patternOrderHeight = $state(PATTERN_EDITOR_CONSTANTS.DEFAULT_CANVAS_HEIGHT);

	const rightPanelTabs = [
		{ id: 'instruments', label: 'Instruments', icon: IconCarbonWaveform },
		{ id: 'tables', label: 'Tables', icon: IconCarbonDataTable },
		{ id: 'details', label: 'Details', icon: IconCarbonInformationSquare }
	];

	$effect(() => {
		if (!songViewContainer) return;

		const resizeObserver = new ResizeObserver(() => {
			if (songViewContainer.clientHeight > 0) {
				const availableHeight = songViewContainer.clientHeight;
				const gap = 8;
				patternOrderHeight = Math.max(
					PATTERN_EDITOR_CONSTANTS.MIN_CANVAS_HEIGHT,
					availableHeight - gap
				);
			}
		});

		resizeObserver.observe(songViewContainer);

		return () => {
			resizeObserver.disconnect();
		};
	});

	const currentPatternId = $derived(patternOrder[sharedPatternOrderIndex]);
	const currentPatternLength = $derived.by(() => {
		const song = songs[0];
		if (!song?.patterns) return null;
		const pattern = song.patterns.find((p) => p.id === currentPatternId);
		return pattern?.length ?? null;
	});

	$effect(() => {
		const el = document.activeElement;
		if (el?.id?.startsWith?.('pattern-length-input')) return;
		patternLengthValue = currentPatternLength !== null ? currentPatternLength.toString() : '';
	});

	$effect(() => {
		const len = currentPatternLength;
		if (len !== null && sharedSelectedRow >= len) {
			sharedSelectedRow = Math.max(0, len - 1);
		}
	});

	function applyLengthToAllSongs(length: number) {
		const patternId = patternOrder[sharedPatternOrderIndex];
		for (let j = 0; j < songs.length; j++) {
			const song = songs[j];
			const pattern = song.patterns.find((p) => p.id === patternId);
			if (!pattern || pattern.length === length) continue;
			const schema = chipProcessors[j].chip.schema;
			const resized = PatternService.resizePattern(pattern, length, schema);
			song.patterns = PatternService.updatePatternInArray(song.patterns, resized);
		}
		songs = [...songs];
		if (sharedSelectedRow >= length) {
			sharedSelectedRow = Math.max(0, length - 1);
		}
		patternEditors.forEach((editor) => editor?.requestRedraw?.());
	}

	function commitPatternLength() {
		const length = parseInt(patternLengthValue, 10);
		if (!isNaN(length) && length >= 1 && length <= 256) {
			applyLengthToAllSongs(length);
			patternLengthValue = length.toString();
		} else {
			patternLengthValue =
				currentPatternLength !== null ? currentPatternLength.toString() : '';
		}
	}

	function incrementPatternLength() {
		const current = parseInt(patternLengthValue, 10);
		if (isNaN(current) || current < 1 || current >= 256) return;
		const newLength = current + 1;
		applyLengthToAllSongs(newLength);
		patternLengthValue = newLength.toString();
	}

	function decrementPatternLength() {
		const current = parseInt(patternLengthValue, 10);
		if (isNaN(current) || current <= 1 || current > 256) return;
		const newLength = current - 1;
		applyLengthToAllSongs(newLength);
		patternLengthValue = newLength.toString();
	}
</script>

<div bind:this={songViewContainer} class="relative flex h-full flex-col overflow-hidden">
	<div class="flex flex-1 overflow-hidden">
		<div class="relative flex min-w-0 flex-1">
			<div class="h-full shrink-0 transition-all duration-300 {blurredContentClass}">
				<Card
					title="Patterns Order"
					fullHeight={true}
					icon={IconCarbonListBoxes}
					class="overflow-hidden p-0">
					<PatternOrder
						bind:currentPatternOrderIndex={sharedPatternOrderIndex}
						bind:patterns={patternsRecord}
						bind:selectedRow={sharedSelectedRow}
						bind:patternOrder
						bind:patternOrderColors
						canvasHeight={patternOrderHeight}
						{lineHeight}
						{songPatterns}
						{songs}
						onPatternCreated={handlePatternCreated}
						onMakeUnique={handleMakeUnique}
						onPatternOrderEdited={async () => {
							await tick();
							patternEditors.forEach((e) => e?.requestRedraw?.());
						}}
						onPatternSelect={(index) =>
							patternEditors[0]?.markPatternChangeFromUser?.(index)} />
				</Card>
			</div>
			<div
				class="flex flex-1 flex-col justify-center overflow-hidden transition-all duration-300 {blurredContentClass}">
				<div class="flex flex-1 justify-center overflow-hidden">
					{#each songs as song, i}
						<Card
							title={`${chipProcessors[i].chip.name} - (${i + 1})`}
							fullHeight={true}
							icon={IconCarbonChip}
							class="flex flex-col p-0">
							{#snippet headerContent()}
								<div class="flex items-center gap-1">
									<div
										class="flex items-center rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] {playbackStore.isPlaying
											? 'opacity-50'
											: ''}">
										<Input
											value={patternLengthValue}
											id="pattern-length-input-{i}"
											type="number"
											min="1"
											max="256"
											step="1"
											disabled={playbackStore.isPlaying}
											class="h-5 w-10 border-0 bg-transparent px-1 py-0 text-center font-mono text-xs leading-none focus:ring-0 disabled:cursor-not-allowed"
											onfocus={() => {
												if (!playbackStore.isPlaying) {
													activeEditorIndex = i;
													patternEditor = patternEditors[i];
												}
											}}
											oninput={(e) => {
												if (!playbackStore.isPlaying) {
													patternLengthValue = (
														e.target as HTMLInputElement
													).value;
												}
											}}
											onblur={() => {
												if (!playbackStore.isPlaying) {
													commitPatternLength();
												}
											}}
											onkeydown={(e: KeyboardEvent) => {
												if (playbackStore.isPlaying) {
													e.preventDefault();
													return;
												}
												if (e.key === 'Enter') {
													e.preventDefault();
													commitPatternLength();
													(e.target as HTMLInputElement)?.blur();
												}
											}} />
										<div
											class="flex flex-col border-l border-[var(--color-app-border)]">
											<button
												type="button"
												disabled={playbackStore.isPlaying}
												class="flex h-2.5 w-3.5 cursor-pointer items-center justify-center border-b border-[var(--color-app-border)] transition-colors hover:bg-[var(--color-app-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
												onclick={() => {
													if (!playbackStore.isPlaying) {
														activeEditorIndex = i;
														patternEditor = patternEditors[i];
														incrementPatternLength();
													}
												}}
												title="Increment pattern length">
												<IconCarbonChevronUp
													class="h-2 w-2 text-[var(--color-app-text-muted)]" />
											</button>
											<button
												type="button"
												disabled={playbackStore.isPlaying}
												class="flex h-2.5 w-3.5 cursor-pointer items-center justify-center transition-colors hover:bg-[var(--color-app-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
												onclick={() => {
													if (!playbackStore.isPlaying) {
														activeEditorIndex = i;
														patternEditor = patternEditors[i];
														decrementPatternLength();
													}
												}}
												title="Decrement pattern length">
												<IconCarbonChevronDown
													class="h-2 w-2 text-[var(--color-app-text-muted)]" />
											</button>
										</div>
									</div>
									{#if songs.length > 1}
										<button
											type="button"
											disabled={playbackStore.isPlaying}
											class="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-[var(--color-pattern-note-off)] transition-colors hover:bg-[var(--color-app-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
											title="Remove song"
											onclick={() =>
												onaction?.({
													action: 'remove-song',
													songIndex: i
												})}>
											<IconCarbonClose class="h-3.5 w-3.5" />
										</button>
									{/if}
								</div>
							{/snippet}
							<div class="flex flex-1 flex-col overflow-hidden">
								<PatternEditor
									bind:this={patternEditors[i]}
									bind:patterns={song.patterns}
									bind:patternOrder
									bind:currentPatternOrderIndex={sharedPatternOrderIndex}
									bind:selectedRow={sharedSelectedRow}
									isActive={activeEditorIndex === i}
									isPlaybackMaster={i === 0}
									onfocus={() => {
										activeEditorIndex = i;
										patternEditor = patternEditors[i];
									}}
									{onaction}
									initAllChips={initAllChipsForPlayback}
									{initAllChipsForPlayPattern}
									{getSpeedForChip}
									{getSpeedForPlayPattern}
									speed={song.initialSpeed}
									tuningTable={song.tuningTable}
									{tuningTableVersion}
									instruments={song.instruments}
									{tables}
									chip={chipProcessors[i].chip}
									chipProcessor={chipProcessors[i]} />
							</div>
						</Card>
					{/each}
				</div>
			</div>
			{#if isRightPanelExpanded}
				<button
					type="button"
					class="absolute inset-0 z-10 cursor-pointer border-0 bg-transparent p-0"
					onclick={() => (isRightPanelExpanded = false)}
					aria-label="Collapse panel"></button>
			{/if}
		</div>
		<div
			class="relative z-10 flex h-full shrink-0 flex-col border-l border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] transition-all duration-300 {isRightPanelExpanded
				? 'w-[1200px]'
				: 'w-[32rem]'}">
			<div class="min-h-0 flex-1 overflow-hidden">
				<TabView tabs={rightPanelTabs} bind:activeTabId={rightPanelActiveTabId}>
					{#snippet children(tabId)}
						{#if tabId === 'tables'}
							<TablesView
								bind:tables
								bind:isExpanded={isRightPanelExpanded}
								{songs} />
						{:else if tabId === 'instruments'}
							<InstrumentsView
								{songs}
								bind:isExpanded={isRightPanelExpanded}
								chip={chipProcessors[0].chip} />
						{:else if tabId === 'details'}
							<DetailsView
								{chipProcessors}
								bind:values={projectSettings}
								{songs}
								onChipSettingsApplied={() => {
									tuningTableVersion++;
								}} />
						{/if}
					{/snippet}
				</TabView>
			</div>
			{#if songs.length > 0 && activeEditorIndex < songs.length}
				<div class="flex shrink-0 flex-col border-t border-[var(--color-app-border)]/50">
					{#if settingsStore.get().showInstrumentPreview && chipProcessors[activeEditorIndex].chip.previewRow}
						{@const PreviewRow = chipProcessors[activeEditorIndex].chip.previewRow}
						<div class="flex flex-col gap-2 bg-[var(--color-app-surface)] px-2 py-3">
							<span class="text-xs text-[var(--color-app-text-muted)]">Preview playground</span>
							<PreviewRow
								chip={chipProcessors[activeEditorIndex].chip}
								instrumentId={editorStateStore.get().currentInstrument} />
						</div>
					{/if}
					{#if settingsStore.get().showOscilloscopes}
						<div class="border-t border-[var(--color-app-border)]/50">
							<ChannelOscilloscopes
							channelLabels={songs.flatMap((_, i) =>
								(chipProcessors[i]?.chip.schema.channelLabels ?? ['A', 'B', 'C']).map(
									(l) => (songs.length > 1 ? `${i + 1}${l}` : l)
								)
							)} />
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
	{#if songs.length > 0 && activeEditorIndex < songs.length}
		{@const activeSong = songs[activeEditorIndex]}
		<StatusBar
			pattern={activeSong.patterns.find(
				(p) => p.id === patternOrder[sharedPatternOrderIndex]
			) || null}
			selectedRow={sharedSelectedRow}
			{selectedFieldKey}
			currentPatternOrderIndex={sharedPatternOrderIndex}
			{patternOrder}
			patterns={activeSong.patterns}
			speed={activeSong.initialSpeed}
			interruptFrequency={activeSong.interruptFrequency || 50}
			chip={chipProcessors[activeEditorIndex].chip} />
	{/if}
</div>
