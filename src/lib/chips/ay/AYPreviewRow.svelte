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

	let {
		chip,
		instrumentId = '01'
	}: {
		chip: Chip;
		instrumentId?: string;
	} = $props();

	const ROW_INDEX = 0;
	const containerContext: { audioService: AudioService } = getContext('container');
	const schema = chip.schema;

	let envelopeValue = $state('0000');
	let envelopeShape = $state('');
	let table = $state('');
	let volume = $state('F');
	let noteString = $state('C-4');
	let pressedPreviewKey: string | null = $state(null);
	let noteInputEl: HTMLDivElement | null = $state(null);

	const chipProcessor = $derived(
		containerContext.audioService.chipProcessors.find((p) => p.chip === chip)
	);
	const canPreview = $derived(
		!!chipProcessor &&
			'playPreviewRow' in chipProcessor &&
			chipProcessor.isAudioNodeAvailable()
	);

	function parseHex4(s: string): number {
		const n = parseInt(s.replace(/[^0-9a-fA-F]/g, '').slice(0, 4) || '0', 16);
		return isNaN(n) ? 0 : Math.max(0, Math.min(0xffff, n));
	}

	function parseHex1(s: string): number {
		const n = parseInt(s.replace(/[^0-9a-fA-F]/g, '').slice(0, 1) || '0', 16);
		return isNaN(n) ? 0 : Math.max(0, Math.min(15, n));
	}

	function parseTableChar(s: string): number {
		if (!s || s.length === 0) return 0;
		const c = s.toUpperCase().slice(0, 1);
		if (c >= '0' && c <= '9') return parseInt(c, 10);
		if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 55;
		return 0;
	}

	function buildPreviewPattern(): Pattern {
		const pattern = new PatternModel(0, 1, schema) as Pattern;
		const pr = pattern.patternRows[0];
		pr.envelopeValue = parseHex4(envelopeValue);
		pr.noiseValue = 0;
		pr.envelopeEffect = null;

		const row = pattern.channels[0].rows[0];
		row.instrument = instrumentIdToNumber(instrumentId || '01') || 1;
		row.envelopeShape = envelopeShape ? parseHex1(envelopeShape) : 0;
		row.table = parseTableChar(table);
		row.volume = volume ? Math.max(1, Math.min(15, parseHex1(volume))) : 15;
		row.effects = [null];

		const { noteName, octave } = parseNoteFromString(noteString);
		row.note = new Note(noteName, octave);

		return pattern;
	}

	function startPreview() {
		if (!canPreview || !chipProcessor) return;
		(chipProcessor as unknown as PreviewNoteSupport).playPreviewRow(
			buildPreviewPattern(),
			ROW_INDEX
		);
	}

	function stopPreview() {
		if (chipProcessor && 'stopPreviewNote' in chipProcessor) {
			(chipProcessor as unknown as PreviewNoteSupport).stopPreviewNote();
		}
	}

	function handleNoteKeyDown(event: KeyboardEvent) {
		if (event.repeat) return;
		const key = event.key.toLowerCase();
		const pianoNote = PatternNoteInput.mapKeyboardKeyToNote(event.key);
		if (pianoNote) {
			event.preventDefault();
			noteString = formatNoteFromEnum(pianoNote.noteName, pianoNote.octave);
			pressedPreviewKey = event.key;
			if (canPreview) startPreview();
			return;
		}
		if (key === 'a') {
			event.preventDefault();
			noteString = 'OFF';
			pressedPreviewKey = event.key;
			if (canPreview) startPreview();
			return;
		}
		const letterNote = PatternNoteInput.getLetterNote(event.key);
		if (letterNote) {
			event.preventDefault();
			const octave = editorStateStore.get().octave;
			noteString = formatNoteFromEnum(letterNote, octave);
			pressedPreviewKey = event.key;
			if (canPreview) startPreview();
		}
	}

	function handleNoteKeyUp(event: KeyboardEvent) {
		if (pressedPreviewKey !== null && event.key === pressedPreviewKey) {
			pressedPreviewKey = null;
			stopPreview();
		}
	}

	$effect(() => {
		if (pressedPreviewKey === null) return;
		const key = pressedPreviewKey;
		function onWindowKeyUp(e: KeyboardEvent) {
			if (e.key === key) {
				pressedPreviewKey = null;
				stopPreview();
			}
		}
		window.addEventListener('keyup', onWindowKeyUp);
		return () => window.removeEventListener('keyup', onWindowKeyUp);
	});

	function clampEnvelopeValue() {
		const s = envelopeValue.replace(/[^0-9a-fA-F]/g, '').slice(0, 4).toUpperCase();
		envelopeValue = s.padStart(4, '0') || '0000';
	}

	function clampEnvelopeShape() {
		envelopeShape = envelopeShape.replace(/[^0-9a-fA-F]/g, '').slice(0, 1).toUpperCase();
	}

	function clampTable() {
		const c = table.slice(-1).toUpperCase();
		if ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z')) table = c;
		else table = '';
	}

	function clampVolume() {
		const v = volume.replace(/[^0-9a-fA-F]/g, '').slice(0, 1).toUpperCase();
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
			class="flex min-h-[1.75rem] w-8 items-center rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-1.5 py-1 uppercase"
			title="Current instrument (select in Instruments panel)">
			{instrumentId}
		</div>
	</div>
	<label class="flex flex-col gap-0.5">
		<span class="text-[var(--color-app-text-muted)]">Envelope</span>
		<input
			type="text"
			class="w-14 rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-1.5 py-1 uppercase"
			maxlength={4}
			placeholder="0000"
			bind:value={envelopeValue}
			onblur={clampEnvelopeValue}
			oninput={(e) => {
				envelopeValue = (e.currentTarget.value || '').replace(/[^0-9a-fA-F]/gi, '').slice(0, 4).toUpperCase();
			}} />
	</label>
	<label class="flex flex-col gap-0.5">
		<span class="text-[var(--color-app-text-muted)]">Shape</span>
		<input
			type="text"
			class="w-8 rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-1.5 py-1 uppercase"
			maxlength={1}
			placeholder="0"
			bind:value={envelopeShape}
			onblur={clampEnvelopeShape}
			oninput={(e) => {
				envelopeShape = (e.currentTarget.value || '').replace(/[^0-9a-fA-F]/gi, '').slice(0, 1).toUpperCase();
			}} />
	</label>
	<label class="flex flex-col gap-0.5">
		<span class="text-[var(--color-app-text-muted)]">Table</span>
		<input
			type="text"
			class="w-8 rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-1.5 py-1 uppercase"
			maxlength={1}
			placeholder="0"
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
			class="w-8 rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-1.5 py-1 uppercase"
			maxlength={1}
			placeholder="F"
			bind:value={volume}
			onblur={clampVolume}
			oninput={(e) => {
				const v = (e.currentTarget.value || '').replace(/[^0-9a-fA-F]/gi, '').slice(0, 1).toUpperCase();
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
			class="flex min-h-[1.75rem] w-14 items-center rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-1.5 py-1 focus:border-[var(--color-app-primary)] focus:outline-none"
			role="textbox"
			tabindex={0}
			aria-label="Note (keyboard: piano keys)"
			title="Click to focus, then use keyboard like pattern editor (piano keys: Z–P, Q–I, etc.; A = OFF; C/D/E/F/G/B = note with current octave). Hold key to preview."
			onclick={() => noteInputEl?.focus()}
			onkeydown={handleNoteKeyDown}
			onkeyup={handleNoteKeyUp}
			onblur={() => {
				pressedPreviewKey = null;
				stopPreview();
			}}
			>{noteString}</div
		>
	</div>
</div>
