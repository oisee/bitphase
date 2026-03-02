import type { FluffPattern } from '../fluff/fluff-pattern';
import { createGoRound } from '../fluff/presets/go-round';
import { createSyncopa } from '../fluff/presets/syncopa';
import { createOctavedGoRound } from '../fluff/presets/octaved-go-round';

export type PresetType = 'none' | 'goRound' | 'syncopa' | 'octavedGoRound';

class FluffEditorStore {
	presetType = $state<PresetType>('none');
	speed = $state(3);
	framesPerNote = $state(4);

	currentPatterns: FluffPattern[] = $derived.by(() => {
		switch (this.presetType) {
			case 'goRound':
				return createGoRound(this.speed);
			case 'syncopa':
				return createSyncopa(this.framesPerNote);
			case 'octavedGoRound':
				return createOctavedGoRound(this.speed);
			default:
				return [];
		}
	});
}

export const fluffEditorStore = new FluffEditorStore();
