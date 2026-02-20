import type { Pattern } from '../../models/song';
import type { ChipSchema, ChipField } from '../../chips/base/schema';

export interface CatchUpSegment {
	pattern: Pattern;
	patternOrderIndex: number;
	numRows: number;
}

function toNum(v: unknown): number {
	if (v === undefined || v === null) return NaN;
	const n = Number(v);
	return Number.isNaN(n) ? NaN : n;
}

function isGlobalFieldValueSet(
	key: string,
	value: unknown,
	field: ChipField
): boolean {
	if (value === undefined || value === null) return false;
	const n = toNum(value);
	if (Number.isNaN(n)) return false;
	const when = field.backtrackWhen ?? 'any';
	if (when === 'nonZero') return n !== 0;
	return true;
}

function isChannelFieldValueSet(
	key: string,
	value: unknown,
	field: ChipField
): boolean {
	if (value === undefined || value === null) return false;
	if (field.type === 'note' || key === 'note') {
		const note = value as { name?: number } | undefined;
		const name = note?.name;
		return name !== undefined && name !== null && name !== 0;
	}
	const n = toNum(value);
	if (Number.isNaN(n)) return false;
	if (key === 'table') return n === -1 || n > 0;
	const when = field.backtrackWhen ?? 'any';
	if (when === 'nonZero') return n !== 0;
	return true;
}

function positionAfter(
	aOrder: number,
	aRow: number,
	bOrder: number,
	bRow: number
): boolean {
	return aOrder > bOrder || (aOrder === bOrder && aRow > bRow);
}

export function computeStateHorizon(
	patternOrder: number[],
	getPattern: (patternId: number) => Pattern | undefined,
	targetOrderIndex: number,
	targetRow: number,
	schema: ChipSchema
): { orderIndex: number; row: number } | null {
	const channelCount = schema.channelLabels?.length ?? 0;
	const channelFieldEntries = schema.fields
		? Object.entries(schema.fields).filter(
				([_, f]) => f.usedForBacktracking === true
			)
		: [];
	const globalFieldEntries = schema.globalFields
		? Object.entries(schema.globalFields).filter(
				([_, f]) => f.usedForBacktracking === true
			)
		: [];

	let horizonOrderIndex = -1;
	let horizonRow = -1;

	for (let orderIndex = targetOrderIndex; orderIndex >= 0; orderIndex--) {
		const patternId = patternOrder[orderIndex];
		const pattern = getPattern(patternId);
		if (!pattern || !pattern.channels?.length || !pattern.patternRows) continue;

		const rowStart = orderIndex === targetOrderIndex ? targetRow - 1 : pattern.length - 1;
		const rowEnd = 0;

		for (let rowIndex = rowStart; rowIndex >= rowEnd; rowIndex--) {
			if (rowIndex < 0 || rowIndex >= pattern.patternRows.length) continue;

			const patternRow = pattern.patternRows[rowIndex] as Record<string, unknown> | undefined;
			for (const [key, field] of globalFieldEntries) {
				const value = patternRow?.[key];
				if (isGlobalFieldValueSet(key, value, field)) {
					if (
						horizonOrderIndex < 0 ||
						positionAfter(orderIndex, rowIndex, horizonOrderIndex, horizonRow)
					) {
						horizonOrderIndex = orderIndex;
						horizonRow = rowIndex;
					}
				}
			}

			for (let ch = 0; ch < channelCount && ch < pattern.channels.length; ch++) {
				const channel = pattern.channels[ch];
				const row = channel.rows?.[rowIndex] as Record<string, unknown> | undefined;
				if (!row) continue;

				for (const [key, field] of channelFieldEntries) {
					const value = row[key];
					if (isChannelFieldValueSet(key, value, field)) {
						if (
							horizonOrderIndex < 0 ||
							positionAfter(orderIndex, rowIndex, horizonOrderIndex, horizonRow)
						) {
							horizonOrderIndex = orderIndex;
							horizonRow = rowIndex;
						}
					}
				}
			}
		}
	}

	if (horizonOrderIndex < 0 || horizonRow < 0) return null;
	return { orderIndex: horizonOrderIndex, row: horizonRow };
}

export function buildCatchUpSegmentsToHorizon(
	patternOrder: number[],
	getPattern: (patternId: number) => Pattern | undefined,
	horizonOrderIndex: number,
	horizonRow: number
): CatchUpSegment[] {
	const segments: CatchUpSegment[] = [];
	for (let i = 0; i <= horizonOrderIndex; i++) {
		const patternId = patternOrder[i];
		const pattern = getPattern(patternId);
		if (!pattern) continue;
		const numRows =
			i === horizonOrderIndex ? horizonRow + 1 : pattern.length;
		segments.push({ pattern, patternOrderIndex: i, numRows });
	}
	return segments;
}
