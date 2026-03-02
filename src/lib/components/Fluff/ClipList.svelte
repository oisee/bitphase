<script lang="ts">
	import { clipStore } from '../../stores/clips.svelte';
	import { projectStore } from '../../stores/project.svelte';
	import { ClipCaptureService } from '../../services/clip/clip-capture-service';
	import type { AudioService } from '../../services/audio/audio-service';
	import IconCarbonPlay from '~icons/carbon/play';
	import IconCarbonTrashCan from '~icons/carbon/trash-can';
	import IconCarbonAdd from '~icons/carbon/add';
	import { getContext } from 'svelte';

	const services: { audioService: AudioService } = getContext('container');

	let editingClipId = $state<string | null>(null);
	let editingName = $state('');
	let isCapturing = $state(false);
	let captureProgress = $state('');

	function formatDuration(seconds: number): string {
		return `${seconds.toFixed(1)}s`;
	}

	function startRename(clipId: string, currentName: string) {
		editingClipId = clipId;
		editingName = currentName;
	}

	function commitRename(clipId: string) {
		if (editingName.trim()) {
			clipStore.renameClip(clipId, editingName.trim());
		}
		editingClipId = null;
	}

	function playClip(clipId: string) {
		const clip = clipStore.getClip(clipId);
		if (!clip) return;

		const processor = services.audioService.chipProcessors[0] as any;
		if (!processor?.sendLoadClip) return;

		processor.sendLoadClip(clipId, clip.frames, clip.loopPoint);
		processor.sendStartClip(clipId, 0);
	}

	function deleteClip(clipId: string) {
		const processor = services.audioService.chipProcessors[0] as any;
		if (processor?.sendStopClip) {
			processor.sendStopClip(clipId);
		}
		if (processor?.sendRemoveClip) {
			processor.sendRemoveClip(clipId);
		}
		clipStore.removeClip(clipId);
	}

	async function captureFromSong() {
		if (isCapturing) return;
		isCapturing = true;
		captureProgress = 'Starting capture...';

		try {
			const captureService = new ClipCaptureService();
			const project = projectStore.getCurrentProject();
			const clip = await captureService.captureFromSong(project, 0, {
				onProgress: (_pct, msg) => {
					captureProgress = msg;
				}
			});
			clipStore.addClip(clip);
		} catch (err) {
			captureProgress = `Error: ${err instanceof Error ? err.message : 'Capture failed'}`;
		} finally {
			isCapturing = false;
			captureProgress = '';
		}
	}
</script>

<div class="flex flex-col gap-1">
	{#if clipStore.clips.length === 0}
		<p class="py-2 text-center text-xs text-[var(--color-app-text-muted)]">No clips</p>
	{:else}
		{#each clipStore.clips as clip}
			<div
				class="flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-[var(--color-app-surface-hover)]">
				{#if editingClipId === clip.id}
					<input
						type="text"
						bind:value={editingName}
						class="min-w-0 flex-1 rounded border border-[var(--color-app-primary)] bg-[var(--color-app-surface)] px-1 py-0.5 font-mono text-xs text-[var(--color-app-text-primary)] outline-none"
						onblur={() => commitRename(clip.id)}
						onkeydown={(e) => {
							if (e.key === 'Enter') commitRename(clip.id);
							if (e.key === 'Escape') (editingClipId = null);
						}}
						autofocus />
				{:else}
					<button
						type="button"
						class="min-w-0 flex-1 cursor-pointer truncate border-0 bg-transparent p-0 text-left font-mono text-xs text-[var(--color-app-text-primary)]"
						ondblclick={() => startRename(clip.id, clip.name)}
						title="Double-click to rename">
						{clip.name}
					</button>
				{/if}

				<span
					class="shrink-0 rounded bg-[var(--color-app-surface-secondary)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-app-text-muted)]">
					{formatDuration(clip.duration)}
				</span>

				<button
					type="button"
					class="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-[var(--color-app-text-muted)] transition-colors hover:bg-[var(--color-app-surface-hover)] hover:text-[var(--color-app-text-primary)]"
					onclick={() => playClip(clip.id)}
					title="Play clip">
					<IconCarbonPlay class="h-3 w-3" />
				</button>

				<button
					type="button"
					class="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-[var(--color-app-text-muted)] transition-colors hover:bg-[var(--color-app-surface-hover)] hover:text-[var(--color-pattern-note-off)]"
					onclick={() => deleteClip(clip.id)}
					title="Delete clip">
					<IconCarbonTrashCan class="h-3 w-3" />
				</button>
			</div>
		{/each}
	{/if}

	<button
		type="button"
		disabled={isCapturing}
		class="mt-1 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-2 py-1.5 text-xs text-[var(--color-app-text-secondary)] transition-colors hover:bg-[var(--color-app-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
		onclick={captureFromSong}>
		<IconCarbonAdd class="h-3.5 w-3.5" />
		{isCapturing ? captureProgress : 'Capture from Song'}
	</button>
</div>
