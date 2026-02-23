<script lang="ts">
	import { BINDABLE_ACTIONS } from '../../config/keybindings';
	import { keybindingsStore } from '../../stores/keybindings.svelte';
	import { ShortcutString } from '../../utils/shortcut-string';
	import type { SettingsTabState } from './types';
	import Button from '../Button/Button.svelte';

	let { registerState } = $props<{
		registerState?: (state: SettingsTabState) => void;
	}>();

	let recordingActionId = $state<string | null>(null);
	let removeRecordingListener: (() => void) | null = null;

	function getKeybindingsSnapshot(): Record<string, string> {
		const snap: Record<string, string> = {};
		for (const action of BINDABLE_ACTIONS) {
			snap[action.id] = keybindingsStore.getShortcut(action.id);
		}
		return snap;
	}

	let keybindingsSnapshot = $state<Record<string, string>>(getKeybindingsSnapshot());

	const hasUnsavedKeybindings = $derived(
		BINDABLE_ACTIONS.some(
			(action) =>
				ShortcutString.normalizeForComparison(keybindingsStore.getShortcut(action.id)) !==
				ShortcutString.normalizeForComparison(keybindingsSnapshot[action.id] ?? '')
		)
	);

	function revertKeybindings(): void {
		for (const action of BINDABLE_ACTIONS) {
			const snapshotValue = keybindingsSnapshot[action.id] ?? action.defaultShortcut;
			const currentValue = keybindingsStore.getShortcut(action.id);
			if (
				ShortcutString.normalizeForComparison(currentValue) !==
				ShortcutString.normalizeForComparison(snapshotValue)
			) {
				if (snapshotValue === action.defaultShortcut) {
					keybindingsStore.resetShortcut(action.id);
				} else {
					keybindingsStore.setShortcut(action.id, snapshotValue);
				}
			}
		}
	}

	const hasConflicts = $derived(keybindingsStore.conflictingActionIds.size > 0);

	let tabState = $state<SettingsTabState>({
		hasUnsavedValue: false,
		hasConflictsValue: false,
		revert: revertKeybindings
	});

	$effect(() => {
		tabState.hasUnsavedValue = hasUnsavedKeybindings;
		tabState.hasConflictsValue = hasConflicts;
		registerState?.(tabState);
	});

	function startRecording(actionId: string) {
		removeRecordingListener?.();
		recordingActionId = actionId;
		const cleanup = () => {
			recordingActionId = null;
			removeRecordingListener?.();
			removeRecordingListener = null;
		};
		const keyHandler = (event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			if (event.key === 'Escape') {
				cleanup();
				return;
			}
			if (
				event.key === 'Shift' ||
				event.key === 'Control' ||
				event.key === 'Meta' ||
				event.key === 'Alt'
			) {
				return;
			}
			const shortcut = ShortcutString.fromEvent(event);
			keybindingsStore.setShortcut(actionId, shortcut);
			cleanup();
		};
		const mouseHandler = (event: MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			const shortcut = ShortcutString.fromMouseEvent(event);
			if (shortcut) {
				keybindingsStore.setShortcut(actionId, shortcut);
				cleanup();
			}
		};
		window.addEventListener('keydown', keyHandler, true);
		window.addEventListener('mousedown', mouseHandler, true);
		removeRecordingListener = () => {
			window.removeEventListener('keydown', keyHandler, true);
			window.removeEventListener('mousedown', mouseHandler, true);
		};
	}

	function handleReset(actionId: string) {
		keybindingsStore.resetShortcut(actionId);
	}

	function handleResetAll() {
		keybindingsStore.resetAll();
	}
</script>

<div class="flex flex-col gap-2">
	{#if hasConflicts}
		<span class="text-xs text-red-500">Resolve duplicate shortcuts before saving.</span>
	{/if}
	<div class="flex items-center justify-between">
		<h3 class="text-xs font-semibold text-[var(--color-app-text-primary)]">Shortcuts</h3>
		<Button variant="secondary" onclick={handleResetAll}>Reset all</Button>
	</div>
	<div class="flex flex-col gap-1">
		{#each BINDABLE_ACTIONS as action (action.id)}
			<div
				class="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center rounded border px-2 py-1 {keybindingsStore.conflictingActionIds.has(action.id)
					? 'border-red-500/70 bg-red-500/5'
					: 'border-[var(--color-app-border)]'}">
				<span class="text-xs text-[var(--color-app-text-primary)]">
					{action.label}
				</span>
				<span
					class="font-mono text-xs {keybindingsStore.conflictingActionIds.has(action.id)
						? 'text-red-500'
						: 'text-[var(--color-app-text-tertiary)]'}">
					{#if recordingActionId === action.id}
						Press a key...
					{:else}
						{ShortcutString.toDisplay(keybindingsStore.getShortcut(action.id))}
					{/if}
				</span>
				<div class="flex gap-1">
					<Button
						variant="secondary"
						onclick={() => startRecording(action.id)}
						disabled={recordingActionId !== null && recordingActionId !== action.id}>
						{#if recordingActionId === action.id}
							Recording...
						{:else}
							Record
						{/if}
					</Button>
					<Button
						variant="secondary"
						onclick={() => handleReset(action.id)}
						disabled={keybindingsStore.getShortcut(action.id) === action.defaultShortcut}>
						Reset
					</Button>
				</div>
			</div>
		{/each}
	</div>
</div>
