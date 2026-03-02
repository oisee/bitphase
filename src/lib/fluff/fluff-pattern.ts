import type { FluffFrame } from './fluff-frame';

export interface FluffPattern {
	repeat: number;
	fframes: FluffFrame[];
}

export function createFluffPattern(fframes: FluffFrame[] = [], repeat = 1): FluffPattern {
	return { repeat, fframes };
}
