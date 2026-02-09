import type { ChipProcessor } from './base/processor';
import type { ChipSchema } from './base/schema';
import type { PatternConverter } from './base/adapter';
import type { PatternFormatter } from './base/formatter-interface';
import type { ChipRenderer } from './base/renderer';
import type { Component } from 'svelte';

export interface Chip {
	type: string;
	name: string;
	wasmUrl: string;
	processorName: string;
	processorMap: () => ChipProcessor;
	schema: ChipSchema;
	createConverter: () => PatternConverter;
	createFormatter: () => PatternFormatter;
	createRenderer: () => ChipRenderer;
	instrumentEditor: Component<any>;
	previewRow?: Component<any>;
}

