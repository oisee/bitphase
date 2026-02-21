import type { Chip } from './types';
import type { ResourceLoader } from './base/resource-loader';
import { CHIP_TYPES } from './chip-registration';

const chips: Map<string, Chip> = new Map();

async function initializeCoreRegistry(): Promise<void> {
	for (const type of CHIP_TYPES) {
		const mod = await import(`./${type}/core`);
		const chip = (mod as { CHIP: Chip }).CHIP;
		chips.set(chip.type, chip);
	}
}

let initPromise: Promise<void> | null = null;

export function ensureCoreRegistry(): Promise<void> {
	if (!initPromise) initPromise = initializeCoreRegistry();
	return initPromise;
}

export function getChipByType(chipType: string): Chip | null {
	return chips.get(chipType) ?? null;
}

export function createRenderer(chip: Chip, loader?: ResourceLoader) {
	return chip.createRenderer(loader);
}
