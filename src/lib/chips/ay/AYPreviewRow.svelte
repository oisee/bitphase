<script lang="ts">
	import type { Chip } from '../types';
	import type { Pattern } from '../../models/song';
	import { Pattern as PatternModel, Note } from '../../models/song';
	import type { PreviewNoteSupport } from '../base/processor';
	import type { AudioService } from '../../services/audio/audio-service';
	import { getContext } from 'svelte';
	import { parseNoteFromString, formatNoteFromEnum } from '../../utils/note-utils';
	import { PatternNoteInput } from '../../services/pattern/editing/pattern-note-input';
	import { editorStateStore } from '../../stores/editor-state.svelte';
	import { instrumentIdToNumber } from '../../utils/instrument-id';
	import { playbackStore } from '../../stores/playback.svelte';
	import { projectStore } from '../../stores/project.svelte';
	import {
		envelopePeriodToNoteString,
		noteStringToEnvelopePeriod
	} from '../../utils/envelope-note-conversion';

	let {
		chip,
		instrumentId = '01',
		tuningTable = []
	}: {
		chip: Chip;
		instrumentId?: string;
		tuningTable?: number[];
	} = $props();

	const ROW_INDEX = 0;
	const containerContext: { audioService: AudioService } = getContext('container');
	const schema = chip.schema;

	let envelopePeriod = $state(0);
	let noiseValue = $state('00');
	let envelopeShape = $state('');
	let table = $state('');
	let volume = $state('F');
	let activeNotes = $state<Array<{ key: string; note: string }>>([]);
	let noteInputEl: HTMLDivElement | null = $state(null);
	let envelopeInputEl: HTMLDivElement | null = $state(null);

	const envelopeAsNote = $derived(editorStateStore.envelopeAsNote);
	const canEnvelopeAsNote = $derived(envelopeAsNote && tuningTable.length > 0);
	const envelopeDisplayValue = $derived(
		canEnvelopeAsNote
			? (envelopePeriodToNoteString(envelopePeriod, tuningTable) ??
					(envelopePeriod >>> 0).toString(16).toUpperCase().padStart(4, '0'))
			: (envelopePeriod >>> 0).toString(16).toUpperCase().padStart(4, '0')
	);

	const previewProcessors = $derived(
		containerContext.audioService.chipProcessors.filter(
			(p) => p.chip === chip && 'playPreviewRow' in p && p.isAudioNodeAvailable()
		)
	);
	const maxPoly = $derived(previewProcessors.length * 3);

	const isDisabled = $derived(playbackStore.isPlaying);

	let hadActiveNotes = $state(false);
	let wasPlaying = $state(false);

	$effect(() => {
		if (isDisabled && !wasPlaying) {
			activeNotes = [];
		}
		wasPlaying = isDisabled;
	});

	$effect(() => {
		const processors = previewProcessors as unknown as PreviewNoteSupport[];
		if (processors.length === 0) return;
		if (activeNotes.length === 0) {
			if (hadActiveNotes) {
				hadActiveNotes = false;
				processors.forEach((proc) => proc.stopPreviewNote());
			}
			return;
		}
		hadActiveNotes = true;
		const normalizedId = (instrumentId || '01').toUpperCase().padStart(2, '0');
		const currentInstrument = projectStore.instruments.find(
			(i) => i.id.toUpperCase().padStart(2, '0') === normalizedId
		);
		const noteStrings = activeNotes.map((n) => n.note);
		processors.forEach((proc, processorIndex) => {
			const start = processorIndex * 3;
			const channelNotes = [
				noteStrings[start] ?? 'OFF',
				noteStrings[start + 1] ?? 'OFF',
				noteStrings[start + 2] ?? 'OFF'
			];
			proc.playPreviewRow(buildPreviewPattern(channelNotes), ROW_INDEX, currentInstrument);
		});
	});

	$effect(() => {
		const keys = activeNotes.map((n) => n.key);
		if (keys.length === 0) return;
		function onWindowKeyUp(e: KeyboardEvent) {
			if (keys.includes(e.key)) {
				activeNotes = activeNotes.filter((n) => n.key !== e.key);
			}
		}
		window.addEventListener('keyup', onWindowKeyUp);
		return () => window.removeEventListener('keyup', onWindowKeyUp);
	});

	function parseHex4(s: string): number {
		const n = parseInt(s.replace(/[^0-9a-fA-F]/g, '').slice(0, 4) || '0', 16);
		return isNaN(n) ? 0 : Math.max(0, Math.min(0xffff, n));
	}

	function parseHex1(s: string): number {
		const n = parseInt(s.replace(/[^0-9a-fA-F]/g, '').slice(0, 1) || '0', 16);
		return isNaN(n) ? 0 : Math.max(0, Math.min(15, n));
	}

	function parseHex2(s: string): number {
		const n = parseInt(s.replace(/[^0-9a-fA-F]/g, '').slice(0, 2) || '0', 16);
		return isNaN(n) ? 0 : Math.max(0, Math.min(0x1f, n));
	}

	function parseTableChar(s: string): number {
		if (!s || s.length === 0) return 0;
		const c = s.toUpperCase().slice(0, 1);
		if (c >= '0' && c <= '9') return parseInt(c, 10);
		if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 55;
		return 0;
	}

	function buildPreviewPattern(noteStrings: string[]): Pattern {
		const pattern = new PatternModel(0, 1, schema) as Pattern;
		const pr = pattern.patternRows[0];
		pr.envelopeValue = Math.max(0, Math.min(0xffff, envelopePeriod));
		pr.noiseValue = parseHex2(noiseValue);
		pr.envelopeEffect = null;

		const instNum = instrumentIdToNumber(instrumentId || '01') || 1;
		const vol = volume ? Math.max(1, Math.min(15, parseHex1(volume))) : 15;
		const shape = envelopeShape ? parseHex1(envelopeShape) : 0;
		const tbl = parseTableChar(table);

		for (let ch = 0; ch < 3; ch++) {
			const row = pattern.channels[ch].rows[0];
			row.instrument = instNum;
			row.envelopeShape = shape;
			row.table = tbl;
			row.volume = vol;
			row.effects = [null];
			const noteStr = noteStrings[ch] ?? 'OFF';
			const { noteName, octave } = parseNoteFromString(noteStr);
			row.note = new Note(noteName, octave);
		}
		return pattern;
	}

	function handleNoteKeyDown(event: KeyboardEvent) {
		if (isDisabled) return;
		if (event.repeat) return;
		const key = event.key;
		if (activeNotes.some((n) => n.key === key)) return;
		if (activeNotes.length >= maxPoly) return;
		const keyLower = key.toLowerCase();
		let noteStr: string;
		const pianoNote = PatternNoteInput.mapKeyboardKeyToNote(event.key);
		if (pianoNote) {
			event.preventDefault();
			noteStr = formatNoteFromEnum(pianoNote.noteName, pianoNote.octave);
		} else if (keyLower === 'a') {
			event.preventDefault();
			noteStr = 'OFF';
		} else {
			const letterNote = PatternNoteInput.getLetterNote(event.key);
			if (letterNote) {
				event.preventDefault();
				const octave = editorStateStore.octave;
				noteStr = formatNoteFromEnum(letterNote, octave);
			} else return;
		}
		activeNotes = [...activeNotes, { key, note: noteStr }];
	}

	function handleNoteKeyUp(event: KeyboardEvent) {
		if (isDisabled) return;
		const key = event.key;
		if (!activeNotes.some((n) => n.key === key)) return;
		activeNotes = activeNotes.filter((n) => n.key !== key);
	}

	function clampEnvelopePeriod() {
		envelopePeriod = Math.max(0, Math.min(0xffff, envelopePeriod));
	}

	function handleEnvelopeNoteKeyDown(event: KeyboardEvent) {
		if (isDisabled || !canEnvelopeAsNote) return;
		event.preventDefault();
		const key = event.key;
		const keyLower = key.toLowerCase();
		let noteStr: string;
		const pianoNote = PatternNoteInput.mapKeyboardKeyToNote(key);
		if (pianoNote) {
			noteStr = formatNoteFromEnum(pianoNote.noteName, pianoNote.octave);
		} else if (keyLower === 'a') {
			envelopePeriod = 0;
			return;
		} else {
			const letterNote = PatternNoteInput.getLetterNote(key);
			if (!letterNote) return;
			const octave = editorStateStore.octave;
			noteStr = formatNoteFromEnum(letterNote, octave);
		}
		const period = noteStringToEnvelopePeriod(
			noteStr,
			tuningTable,
			editorStateStore.octave
		);
		envelopePeriod = Math.max(0, Math.min(0xffff, period));
	}

	function clampNoiseValue() {
		const s = noiseValue
			.replace(/[^0-9a-fA-F]/g, '')
			.slice(0, 2)
			.toUpperCase();
		noiseValue = s.padStart(2, '0') || '00';
	}

	function clampEnvelopeShape() {
		envelopeShape = envelopeShape
			.replace(/[^0-9a-fA-F]/g, '')
			.slice(0, 1)
			.toUpperCase();
	}

	function clampTable() {
		const c = table.slice(-1).toUpperCase();
		if ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z')) table = c;
		else table = '';
	}

	function clampVolume() {
		const v = volume
			.replace(/[^0-9a-fA-F]/g, '')
			.slice(0, 1)
			.toUpperCase();
		if (v) {
			const n = parseInt(v, 16);
			volume = n >= 1 && n <= 15 ? v : 'F';
		} else {
			volume = 'F';
		}
	}
</script>

<div class="flex flex-wrap items-end gap-3 font-mono text-xs">
	<div class="flex flex-col gap-0.5">
		<span class="text-[var(--color-app-text-muted)]">Inst</span>
		<div
			class="flex h-7 w-8 items-center rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-1.5 uppercase"
			title="Current instrument (select in Instruments panel)">
			{instrumentId}
		</div>
	</div>
	<label class="flex flex-col gap-0.5">
		<span class="text-[var(--color-app-text-muted)]">Envelope</span>
		{#if canEnvelopeAsNote}
			<div
				bind:this={envelopeInputEl}
				class="flex h-7 w-14 items-center rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-1.5 font-mono uppercase focus:border-[var(--color-app-primary)] focus:outline-none {isDisabled
					? 'pointer-events-none cursor-not-allowed opacity-50'
					: ''}"
				role="textbox"
				tabindex={isDisabled ? -1 : 0}
				aria-label="Envelope as note (keyboard: piano keys or letters)"
				title="Envelope as note. Piano: Z–P, Q–I; A = OFF; letters = note with current octave."
				onclick={() => envelopeInputEl?.focus()}
				onkeydown={handleEnvelopeNoteKeyDown}>
				{envelopePeriod === 0 ? '—' : envelopeDisplayValue}
			</div>
		{:else}
			<input
				type="text"
				class="h-7 w-14 rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-1.5 font-mono uppercase disabled:cursor-not-allowed disabled:opacity-50"
				maxlength={4}
				placeholder="0000"
				disabled={isDisabled}
				value={envelopeDisplayValue}
				onblur={clampEnvelopePeriod}
				oninput={(e) => {
					const s = (e.currentTarget.value || '')
						.replace(/[^0-9a-fA-F]/gi, '')
						.slice(0, 4)
						.toUpperCase();
					const n = parseInt(s || '0', 16);
					envelopePeriod = isNaN(n) ? 0 : Math.max(0, Math.min(0xffff, n));
				}} />
		{/if}
	</label>
	<label class="flex flex-col gap-0.5">
		<span class="text-[var(--color-app-text-muted)]">Shape</span>
		<input
			type="text"
			class="h-7 w-8 rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-1.5 uppercase disabled:cursor-not-allowed disabled:opacity-50"
			maxlength={1}
			placeholder="0"
			disabled={isDisabled}
			bind:value={envelopeShape}
			onblur={clampEnvelopeShape}
			oninput={(e) => {
				envelopeShape = (e.currentTarget.value || '')
					.replace(/[^0-9a-fA-F]/gi, '')
					.slice(0, 1)
					.toUpperCase();
			}} />
	</label>
	<label class="flex flex-col gap-0.5">
		<span class="text-[var(--color-app-text-muted)]">Noise</span>
		<input
			type="text"
			class="h-7 w-10 rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-1.5 uppercase disabled:cursor-not-allowed disabled:opacity-50"
			maxlength={2}
			placeholder="00"
			disabled={isDisabled}
			bind:value={noiseValue}
			onblur={clampNoiseValue}
			oninput={(e) => {
				noiseValue = (e.currentTarget.value || '')
					.replace(/[^0-9a-fA-F]/gi, '')
					.slice(0, 2)
					.toUpperCase();
			}} />
	</label>
	<label class="flex flex-col gap-0.5">
		<span class="text-[var(--color-app-text-muted)]">Table</span>
		<input
			type="text"
			class="h-7 w-8 rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-1.5 uppercase disabled:cursor-not-allowed disabled:opacity-50"
			maxlength={1}
			placeholder="0"
			disabled={isDisabled}
			bind:value={table}
			onblur={clampTable}
			oninput={(e) => {
				const v = (e.currentTarget.value || '').toUpperCase().slice(-1);
				table = (v >= '0' && v <= '9') || (v >= 'A' && v <= 'Z') ? v : '';
			}} />
	</label>
	<label class="flex flex-col gap-0.5">
		<span class="text-[var(--color-app-text-muted)]">Volume</span>
		<input
			type="text"
			class="h-7 w-8 rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-1.5 uppercase disabled:cursor-not-allowed disabled:opacity-50"
			maxlength={1}
			placeholder="F"
			disabled={isDisabled}
			bind:value={volume}
			onblur={clampVolume}
			oninput={(e) => {
				const v = (e.currentTarget.value || '')
					.replace(/[^0-9a-fA-F]/gi, '')
					.slice(0, 1)
					.toUpperCase();
				if (v) {
					const n = parseInt(v, 16);
					volume = n >= 1 && n <= 15 ? v : volume;
				} else {
					volume = '';
				}
			}} />
	</label>
	<div class="flex flex-col gap-0.5">
		<span class="text-[var(--color-app-text-muted)]">Note</span>
		<div
			bind:this={noteInputEl}
			class="flex h-7 max-w-[10rem] min-w-14 items-center rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-1.5 focus:border-[var(--color-app-primary)] focus:outline-none {isDisabled
				? 'pointer-events-none cursor-not-allowed opacity-50'
				: ''}"
			role="textbox"
			tabindex={isDisabled ? -1 : 0}
			aria-label="Note (keyboard: piano keys)"
			aria-disabled={isDisabled}
			title="Click to focus, then use keyboard. Polyphony: {maxPoly} notes (3 per chip). Piano: Z–P, Q–I; A = OFF; letters = note with current octave."
			onclick={() => noteInputEl?.focus()}
			onkeydown={handleNoteKeyDown}
			onkeyup={handleNoteKeyUp}
			onblur={() => {
				activeNotes = [];
			}}>
			{activeNotes.length > 0 ? activeNotes.map((n) => n.note).join(' ') : '—'}
		</div>
	</div>
</div>
