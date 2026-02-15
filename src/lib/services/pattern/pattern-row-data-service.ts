import type { Pattern } from '../../models/song';
import type { PatternFormatter } from '../../chips/base/formatter-interface';
import type { PatternConverter } from '../../chips/base/adapter';
import type { ChipSchema } from '../../chips/base/schema';
import type { Cache } from '../../utils/memoize';
import type { GenericPattern } from '../../models/song/generic';

export interface RowDataContext {
	pattern: Pattern;
	rowIndex: number;
	converter: PatternConverter;
	formatter: PatternFormatter;
	schema: ChipSchema;
	patternGenericCache: Cache<number, GenericPattern>;
	rowStringCache: Cache<string, string>;
}

export interface GetRowDataOptions {
	debug?: boolean;
}

export class PatternRowDataService {
	static getRowData(context: RowDataContext, options?: GetRowDataOptions): string {
		let genericPattern = context.patternGenericCache.get(context.pattern.id);
		if (!genericPattern) {
			genericPattern = context.converter.toGeneric(context.pattern);
			context.patternGenericCache.set(context.pattern.id, genericPattern);
		}

		const genericPatternRow = genericPattern.patternRows[context.rowIndex];
		const genericChannels = genericPattern.channels.map((ch) => ch.rows[context.rowIndex]);

		if (options?.debug) {
			return context.formatter.formatRow(
				genericPatternRow,
				genericChannels,
				context.rowIndex,
				context.schema,
				{ debug: true }
			);
		}

		const rowCacheKey = `${context.pattern.id}:${context.rowIndex}`;
		let rowString = context.rowStringCache.get(rowCacheKey);
		if (!rowString) {
			rowString = context.formatter.formatRow(
				genericPatternRow,
				genericChannels,
				context.rowIndex,
				context.schema
			);
			context.rowStringCache.set(rowCacheKey, rowString);
		}

		return rowString;
	}

	static clearAllCaches(
		rowStringCache: Cache<string, string>,
		patternGenericCache: Cache<number, GenericPattern>,
		cellPositionsCache: Cache<string, unknown>,
		rowSegmentsCache: Cache<string, unknown>
	): void {
		rowStringCache.clear();
		patternGenericCache.clear();
		cellPositionsCache.clear();
		rowSegmentsCache.clear();
	}
}
