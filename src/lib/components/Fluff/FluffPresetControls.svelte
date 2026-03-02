<script lang="ts">
	import { fluffEditorStore, type PresetType } from '../../stores/fluff-editor.svelte';
	import type { Clip } from '../../models/clip';
	import { applyFluffToClip } from '../../services/clip/apply-fluff-to-clip';
	import { clipStore } from '../../stores/clips.svelte';

	const presetOptions: { value: PresetType; label: string }[] = [
		{ value: 'none', label: 'None' },
		{ value: 'goRound', label: 'Go Round' },
		{ value: 'syncopa', label: 'Syncopa' },
		{ value: 'octavedGoRound', label: 'Octaved Go Round' }
	];

	function handlePresetChange(e: Event) {
		fluffEditorStore.presetType = (e.target as HTMLSelectElement).value as PresetType;
	}

	function handleSpeedChange(e: Event) {
		const val = parseInt((e.target as HTMLInputElement).value, 10);
		if (!isNaN(val) && val >= 1) fluffEditorStore.speed = val;
	}

	function handleFramesPerNoteChange(e: Event) {
		const val = parseInt((e.target as HTMLInputElement).value, 10);
		if (!isNaN(val) && val >= 2) fluffEditorStore.framesPerNote = val;
	}

	function applyToClip(clip: Clip) {
		if (fluffEditorStore.currentPatterns.length === 0) return;
		const result = applyFluffToClip(clip, fluffEditorStore.currentPatterns);
		clipStore.addClip(result);
	}

	const showSpeed = $derived(
		fluffEditorStore.presetType === 'goRound' ||
		fluffEditorStore.presetType === 'octavedGoRound'
	);
	const showFramesPerNote = $derived(fluffEditorStore.presetType === 'syncopa');
	const canApply = $derived(
		fluffEditorStore.presetType !== 'none' && clipStore.clips.length > 0
	);
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center gap-2">
		<span class="w-14 shrink-0 text-xs text-[var(--color-app-text-muted)]">Preset</span>
		<select
			class="flex-1 rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-2 py-1 font-mono text-xs text-[var(--color-app-text-primary)] outline-none focus:border-[var(--color-app-primary)]"
			value={fluffEditorStore.presetType}
			onchange={handlePresetChange}>
			{#each presetOptions as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	</div>

	{#if showSpeed}
		<div class="flex items-center gap-2">
			<span class="w-14 shrink-0 text-xs text-[var(--color-app-text-muted)]">Speed</span>
			<input
				type="number"
				min="1"
				max="32"
				value={fluffEditorStore.speed}
				oninput={handleSpeedChange}
				class="w-16 rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-2 py-1 font-mono text-xs text-[var(--color-app-text-primary)] outline-none focus:border-[var(--color-app-primary)]" />
		</div>
	{/if}

	{#if showFramesPerNote}
		<div class="flex items-center gap-2">
			<span class="w-14 shrink-0 text-xs text-[var(--color-app-text-muted)]">FPN</span>
			<input
				type="number"
				min="2"
				max="32"
				value={fluffEditorStore.framesPerNote}
				oninput={handleFramesPerNoteChange}
				class="w-16 rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-2 py-1 font-mono text-xs text-[var(--color-app-text-primary)] outline-none focus:border-[var(--color-app-primary)]" />
		</div>
	{/if}

	{#if canApply}
		<div class="flex items-center gap-2 pt-1">
			<span class="w-14 shrink-0 text-xs text-[var(--color-app-text-muted)]">Apply to</span>
			<select
				class="flex-1 rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-2 py-1 font-mono text-xs text-[var(--color-app-text-primary)] outline-none focus:border-[var(--color-app-primary)]"
				onchange={(e) => {
					const clipId = (e.target as HTMLSelectElement).value;
					if (!clipId) return;
					const clip = clipStore.getClip(clipId);
					if (clip) applyToClip(clip);
					(e.target as HTMLSelectElement).value = '';
				}}>
				<option value="">Apply to Clip...</option>
				{#each clipStore.clips as clip}
					<option value={clip.id}>{clip.name}</option>
				{/each}
			</select>
		</div>
	{/if}
</div>
