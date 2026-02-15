import { BaseFormatter } from '../base/formatter';
import { envelopePeriodToNoteString } from '../../utils/envelope-note-conversion';
import type { ChipSchema, ChipField } from '../base/schema';
import type { GenericRow, GenericPatternRow } from '../../models/song/generic';
import { EffectField } from '../../services/pattern/editing/effect-field';
import { isPrimitive } from '../../utils/type-guards';

export class AYFormatter extends BaseFormatter {
	tuningTable?: number[];
	envelopeAsNote?: boolean;

	protected formatTemplate(
		template: string,
		data: GenericRow | GenericPatternRow,
		fields: Record<string, ChipField>
	): string {
		if (!data) return '';
		let result = '';
		let i = 0;

		while (i < template.length) {
			if (template[i] === '{') {
				const end = template.indexOf('}', i);
				if (end !== -1) {
					const key = template.substring(i + 1, end);
					const field = fields[key];
					if (field) {
						const value = data[key];
						if (EffectField.isEffectField(key)) {
							if (this._debugFormat) {
								result +=
									value === undefined
										? 'undefined'
										: value === null
											? 'null'
											: EffectField.formatValue(value) ?? 'null';
							} else {
								const effectFormatted = EffectField.formatValue(value);
								result +=
									effectFormatted !== null
										? effectFormatted
										: this.formatField(isPrimitive(value) ? value : null, field);
							}
						} else if (
							key === 'envelopeValue' &&
							this.envelopeAsNote &&
							this.tuningTable &&
							typeof value === 'number'
						) {
							const noteStr = envelopePeriodToNoteString(value, this.tuningTable);
							if (noteStr) {
								result += noteStr.padEnd(field.length, ' ');
							} else {
								result += this.formatField(value, field);
							}
						} else {
							result += this.formatField(isPrimitive(value) ? value : null, field);
						}
					}
					i = end + 1;
				} else {
					result += template[i];
					i++;
				}
			} else {
				result += template[i];
				i++;
			}
		}

		return result;
	}
}
