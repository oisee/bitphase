import { AYProcessor } from './processor';
import { AYConverter } from './adapter';
import { AYFormatter } from './formatter';
import { AYChipRenderer } from './renderer';
import { AY_CHIP_SCHEMA } from './schema';
import AYInstrumentEditor from './AYInstrumentEditor.svelte';
import AYPreviewRow from './AYPreviewRow.svelte';
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
	createRenderer: () => new AYChipRenderer(),
	instrumentEditor: AYInstrumentEditor,
	previewRow: AYPreviewRow
};

export { AYProcessor, AYConverter, AYFormatter, AYChipRenderer, AYInstrumentEditor, AYPreviewRow };

