import { AY_CHIP as AY_CHIP_CORE } from './core';
import AYInstrumentEditor from './AYInstrumentEditor.svelte';
import AYPreviewRow from './AYPreviewRow.svelte';

export const AY_CHIP = {
	...AY_CHIP_CORE,
	instrumentEditor: AYInstrumentEditor,
	previewRow: AYPreviewRow
} as const;

export { AYProcessor } from './processor';
export { AYConverter } from './adapter';
export { AYFormatter } from './formatter';
export { AYChipRenderer } from './renderer';
export { AYInstrumentEditor, AYPreviewRow };
