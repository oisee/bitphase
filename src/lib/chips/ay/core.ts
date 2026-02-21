import { AYProcessor } from './processor';
import { AYConverter } from './adapter';
import { AYFormatter } from './formatter';
import { AYChipRenderer } from './renderer';
import { AY_CHIP_SCHEMA } from './schema';
import type { Chip } from '../types';

export const AY_CHIP: Chip = {
	type: 'ay',
	name: 'AY-3-8910 / YM2149F',
	wasmUrl: 'ayumi.wasm',
	processorName: 'ayumi-processor',
	processorMap: () => new AYProcessor(),
	schema: AY_CHIP_SCHEMA,
	createConverter: () => new AYConverter(),
	createFormatter: () => new AYFormatter(),
	createRenderer: (loader) => new AYChipRenderer(loader),
	instrumentEditor: undefined,
	previewRow: undefined
};

export const CHIP = AY_CHIP;
