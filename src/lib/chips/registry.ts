import type { Chip } from './types';
import type { ResourceLoader } from './base/resource-loader';
import { AY_CHIP } from './ay';

const chips: Map<string, Chip> = new Map();

function initializeChipRegistry(): void {
	const registeredChips: Chip[] = [AY_CHIP];

	for (const chip of registeredChips) {
		chips.set(chip.type, chip);
	}
}

initializeChipRegistry();

export function getChipByType(chipType: string): Chip | null {
	return chips.get(chipType) || null;
}

export function registerChip(chip: Chip): void {
	chips.set(chip.type, chip);
}

export function getAllChips(): Chip[] {
	return Array.from(chips.values());
}

export function getConverter(chip: Chip) {
	return chip.createConverter();
}

export function getFormatter(chip: Chip) {
	return chip.createFormatter();
}

export function createRenderer(chip: Chip, loader?: ResourceLoader) {
	return chip.createRenderer(loader);
}

