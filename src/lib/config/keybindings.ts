import type { MenuItem } from '../components/Menu/types';
import { undoRedoStore } from '../stores/undo-redo.svelte';
import { clipboardStore } from '../stores/clipboard.svelte';

export const ACTION_UNDO = 'undo';
export const ACTION_REDO = 'redo';
export const ACTION_COPY = 'copy';
export const ACTION_CUT = 'cut';
export const ACTION_PASTE = 'paste';
export const ACTION_PASTE_WITHOUT_ERASING = 'paste-without-erasing';
export const ACTION_SELECT_ALL = 'select-all';
export const ACTION_INCREMENT_VALUE = 'increment-value';
export const ACTION_DECREMENT_VALUE = 'decrement-value';
export const ACTION_TRANSPOSE_OCTAVE_UP = 'transpose-octave-up';
export const ACTION_TRANSPOSE_OCTAVE_DOWN = 'transpose-octave-down';
export const ACTION_APPLY_SCRIPT = 'apply-script';
export const ACTION_TOGGLE_PLAYBACK = 'toggle-playback';
export const ACTION_PLAY_FROM_ROW = 'play-from-row';
export const ACTION_CYCLE_CHANNEL = 'cycle-channel';

export interface BindableAction {
	id: string;
	label: string;
	defaultShortcut: string;
}

export const BINDABLE_ACTIONS: BindableAction[] = [
	{ id: ACTION_UNDO, label: 'Undo', defaultShortcut: 'Mod+Z' },
	{ id: ACTION_REDO, label: 'Redo', defaultShortcut: 'Mod+Y' },
	{ id: ACTION_COPY, label: 'Copy', defaultShortcut: 'Mod+C' },
	{ id: ACTION_CUT, label: 'Cut', defaultShortcut: 'Mod+X' },
	{ id: ACTION_PASTE, label: 'Paste', defaultShortcut: 'Mod+V' },
	{ id: ACTION_PASTE_WITHOUT_ERASING, label: 'Magic paste', defaultShortcut: 'Mod+Shift+V' },
	{ id: ACTION_SELECT_ALL, label: 'Select All', defaultShortcut: 'Mod+A' },
	{ id: ACTION_INCREMENT_VALUE, label: 'Increment Value', defaultShortcut: '=' },
	{ id: ACTION_DECREMENT_VALUE, label: 'Decrement Value', defaultShortcut: '-' },
	{ id: ACTION_TRANSPOSE_OCTAVE_UP, label: 'Transpose Octave Up', defaultShortcut: 'Shift++' },
	{
		id: ACTION_TRANSPOSE_OCTAVE_DOWN,
		label: 'Transpose Octave Down',
		defaultShortcut: 'Shift+-'
	},
	{ id: ACTION_TOGGLE_PLAYBACK, label: 'Play / Pause', defaultShortcut: ' ' },
	{ id: ACTION_PLAY_FROM_ROW, label: 'Play from row (hold)', defaultShortcut: 'Enter' },
	{ id: ACTION_CYCLE_CHANNEL, label: 'Cycle channel', defaultShortcut: '`' },
	{ id: ACTION_APPLY_SCRIPT, label: 'Apply Script...', defaultShortcut: 'Mod+Shift+S' }
];

export const PATTERN_EDITOR_ACTION_IDS = new Set(
	BINDABLE_ACTIONS.filter(
		(a) =>
			a.id !== ACTION_APPLY_SCRIPT &&
			a.id !== ACTION_PLAY_FROM_ROW
	).map((a) => a.id)
);

const DISABLED_GETTERS: Partial<Record<string, () => boolean>> = {
	[ACTION_UNDO]: () => !undoRedoStore.canUndo,
	[ACTION_REDO]: () => !undoRedoStore.canRedo,
	[ACTION_PASTE]: () => !clipboardStore.hasData,
	[ACTION_PASTE_WITHOUT_ERASING]: () => !clipboardStore.hasData
};

export function buildEditMenuItems(): MenuItem[] {
	const items: MenuItem[] = [];
	const dividerAfter = new Set([ACTION_PASTE_WITHOUT_ERASING, ACTION_DECREMENT_VALUE]);

	for (const action of BINDABLE_ACTIONS) {
		items.push({
			label: action.label,
			type: 'normal',
			action: action.id,
			disabled: DISABLED_GETTERS[action.id]
		});
		if (dividerAfter.has(action.id)) {
			items.push({ label: 'divider', type: 'divider' });
		}
	}
	return items;
}
