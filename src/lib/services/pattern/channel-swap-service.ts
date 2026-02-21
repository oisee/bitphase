import type { Pattern } from '../../models/song';
import type { GenericPattern, GenericRow } from '../../models/song/generic';
import type { PatternConverter } from '../../chips/base/adapter';
import type { Chip } from '../../chips/types';
import { PatternFieldDetection } from './editing/pattern-field-detection';
import type { EditingContext } from './editing/editing-context';

export interface ChannelSwapContext {
	pattern: Pattern;
	getCellPositions: (rowString: string, row: number) => { fieldKey?: string; charIndex: number }[];
	getPatternRowData: (pattern: Pattern, row: number) => string;
	createEditingContext: (pattern: Pattern, row: number, col: number) => EditingContext;
	converter: PatternConverter;
	schema: Chip['schema'];
}

export interface SelectionBounds {
	minRow: number;
	maxRow: number;
	minCol: number;
	maxCol: number;
}

function deepCopy<T>(value: T): T {
	if (value === null || value === undefined) {
		return value;
	}
	if (typeof value === 'object') {
		return JSON.parse(JSON.stringify(value)) as T;
	}
	return value;
}

function collectSelectionInfo(
	bounds: SelectionBounds,
	context: ChannelSwapContext
): {
	channelIndices: Set<number>;
	cellsByRowAndField: Map<number, Map<string, Set<number>>>;
} {
	const { getCellPositions, getPatternRowData, createEditingContext } = context;
	const channelIndices = new Set<number>();
	const cellsByRowAndField = new Map<number, Map<string, Set<number>>>();

	for (let row = bounds.minRow; row <= bounds.maxRow && row < context.pattern.length; row++) {
		const rowString = context.getPatternRowData(context.pattern, row);
		const cellPositions = getCellPositions(rowString, row);
		const fieldMap = new Map<string, Set<number>>();

		for (let col = bounds.minCol; col <= bounds.maxCol && col < cellPositions.length; col++) {
			const editingContext = createEditingContext(context.pattern, row, col);
			const fieldInfo = PatternFieldDetection.detectFieldAtCursor(editingContext);
			if (!fieldInfo || fieldInfo.isGlobal) continue;

			channelIndices.add(fieldInfo.channelIndex);
			const channelSet = fieldMap.get(fieldInfo.fieldKey) ?? new Set<number>();
			channelSet.add(fieldInfo.channelIndex);
			fieldMap.set(fieldInfo.fieldKey, channelSet);
		}

		if (fieldMap.size > 0) {
			cellsByRowAndField.set(row, fieldMap);
		}
	}

	return { channelIndices, cellsByRowAndField };
}

export class ChannelSwapService {
	static swapChannelsLeft(
		pattern: Pattern,
		bounds: SelectionBounds,
		context: ChannelSwapContext
	): Pattern {
		const generic = context.converter.toGeneric(pattern);
		const { channelIndices, cellsByRowAndField } = collectSelectionInfo(bounds, context);

		if (channelIndices.size === 0) return pattern;

		const channelCount = generic.channels.length;

		if (channelIndices.size >= 2) {
			for (const [row, fieldMap] of cellsByRowAndField) {
				for (const fieldKey of fieldMap.keys()) {
					const values = generic.channels.map(
						(ch) => deepCopy(ch.rows[row][fieldKey as keyof GenericRow])
					);
					for (let i = 0; i < channelCount; i++) {
						const srcIdx = (i + 1) % channelCount;
						generic.channels[i].rows[row][fieldKey as keyof GenericRow] = values[srcIdx];
					}
				}
			}
		} else {
			const channelOrder = Array.from(channelIndices).sort((a, b) => b - a);
			for (const channelIndex of channelOrder) {
				const leftIdx = (channelIndex - 1 + channelCount) % channelCount;
				for (const [row, fieldMap] of cellsByRowAndField) {
					for (const [fieldKey, channels] of fieldMap) {
						if (!channels.has(channelIndex)) continue;

						const leftRow = generic.channels[leftIdx].rows[row];
						const currRow = generic.channels[channelIndex].rows[row];
						const leftVal = deepCopy(leftRow[fieldKey as keyof GenericRow]);
						const currVal = deepCopy(currRow[fieldKey as keyof GenericRow]);
						leftRow[fieldKey as keyof GenericRow] = currVal;
						currRow[fieldKey as keyof GenericRow] = leftVal;
					}
				}
			}
		}

		return context.converter.fromGeneric(generic);
	}

	static swapChannelsRight(
		pattern: Pattern,
		bounds: SelectionBounds,
		context: ChannelSwapContext
	): Pattern {
		const generic = context.converter.toGeneric(pattern);
		const { channelIndices, cellsByRowAndField } = collectSelectionInfo(bounds, context);

		if (channelIndices.size === 0) return pattern;

		const channelCount = generic.channels.length;

		if (channelIndices.size >= 2) {
			for (const [row, fieldMap] of cellsByRowAndField) {
				for (const fieldKey of fieldMap.keys()) {
					const values = generic.channels.map(
						(ch) => deepCopy(ch.rows[row][fieldKey as keyof GenericRow])
					);
					for (let i = 0; i < channelCount; i++) {
						const srcIdx = (i - 1 + channelCount) % channelCount;
						generic.channels[i].rows[row][fieldKey as keyof GenericRow] = values[srcIdx];
					}
				}
			}
		} else {
			const channelOrder = Array.from(channelIndices).sort((a, b) => a - b);
			for (const channelIndex of channelOrder) {
				const rightIdx = (channelIndex + 1) % channelCount;
				for (const [row, fieldMap] of cellsByRowAndField) {
					for (const [fieldKey, channels] of fieldMap) {
						if (!channels.has(channelIndex)) continue;

						const currRow = generic.channels[channelIndex].rows[row];
						const rightRow = generic.channels[rightIdx].rows[row];
						const currVal = deepCopy(currRow[fieldKey as keyof GenericRow]);
						const rightVal = deepCopy(rightRow[fieldKey as keyof GenericRow]);
						currRow[fieldKey as keyof GenericRow] = rightVal;
						rightRow[fieldKey as keyof GenericRow] = currVal;
					}
				}
			}
		}

		return context.converter.fromGeneric(generic);
	}
}
