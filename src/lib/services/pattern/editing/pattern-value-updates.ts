import type { Pattern } from '../../../models/song';
import { NoteName } from '../../../models/song';
import { formatNoteFromEnum, parseNoteFromString } from '../../../utils/note-utils';
import { formatHex, formatSymbol } from '../../../chips/base/field-formatters';
import {
	envelopePeriodToNote,
	noteToEnvelopePeriod
} from '../../../utils/envelope-note-conversion';
import type { GenericPattern } from '../../../models/song/generic';
import type { EditingContext, FieldInfo } from './editing-context';
import { EffectField } from './effect-field';

export interface GenericFieldUpdate {
	row: number;
	fieldInfo: FieldInfo;
	newValue: string | number | null;
}

export class PatternValueUpdates {
	static updateFieldValue(
		context: EditingContext,
		fieldInfo: FieldInfo,
		newValue: string | number | null | Record<string, unknown>
	): Pattern {
		const genericPattern = context.converter.toGeneric(context.pattern);
		if (fieldInfo.isGlobal) {
			genericPattern.patternRows[context.selectedRow][fieldInfo.fieldKey] = newValue;
		} else {
			genericPattern.channels[fieldInfo.channelIndex].rows[context.selectedRow][
				fieldInfo.fieldKey
			] = newValue;
		}
		return context.converter.fromGeneric(genericPattern);
	}

	static getFieldValue(
		context: EditingContext,
		fieldInfo: FieldInfo
	): string | number | null {
		const genericPattern = context.converter.toGeneric(context.pattern);
		return PatternValueUpdates.getValueFromGeneric(
			genericPattern,
			context.selectedRow,
			fieldInfo
		);
	}

	static getValueFromGeneric(
		genericPattern: GenericPattern,
		row: number,
		fieldInfo: FieldInfo
	): string | number | null {
		if (fieldInfo.isGlobal) {
			const patternRow = genericPattern.patternRows[row];
			return (patternRow[fieldInfo.fieldKey] as string | number | null) ?? null;
		}
		const channel = genericPattern.channels[fieldInfo.channelIndex];
		const rowData = channel.rows[row];
		return (rowData[fieldInfo.fieldKey] as string | number | null) ?? null;
	}

	static applyUpdatesToGeneric(
		genericPattern: GenericPattern,
		updates: GenericFieldUpdate[]
	): void {
		for (const { row, fieldInfo, newValue } of updates) {
			if (fieldInfo.isGlobal) {
				genericPattern.patternRows[row][fieldInfo.fieldKey] = newValue;
			} else {
				genericPattern.channels[fieldInfo.channelIndex].rows[row][fieldInfo.fieldKey] =
					newValue;
			}
		}
	}

	static getFieldDefinition(
		context: EditingContext,
		fieldKey: string
	): { key: string; type: string; length: number; allowZeroValue?: boolean } | null {
		const field = context.schema.fields[fieldKey] || context.schema.globalFields?.[fieldKey];
		return field
			? { key: fieldKey, type: field.type, length: field.length, allowZeroValue: field.allowZeroValue }
			: null;
	}

	static isDisplayedAsEmpty(
		value: string | number | null | undefined,
		fieldType: string,
		length: number,
		allowZeroValue?: boolean
	): boolean {
		if (fieldType === 'hex') {
			return formatHex(value, length, allowZeroValue) === '.'.repeat(length);
		}
		if (fieldType === 'symbol') {
			return formatSymbol(value, length, allowZeroValue) === '.'.repeat(length);
		}
		if (fieldType === 'dec') {
			return value === null || value === undefined;
		}
		return value === null || value === undefined || value === '';
	}

	static incrementNoteValue(currentValue: string, delta: number): string {
		if (currentValue === '---' || currentValue === 'OFF') {
			return currentValue;
		}

		const { noteName, octave } = parseNoteFromString(currentValue);
		if (noteName === NoteName.None) {
			return currentValue;
		}

		const noteToSemitone = (note: NoteName, oct: number): number => {
			return oct * 12 + (note - NoteName.C);
		};

		const semitoneToNote = (semitone: number): { noteName: NoteName; octave: number } => {
			const octave = Math.floor(semitone / 12);
			const noteIndex = semitone % 12;
			const noteName = (NoteName.C + noteIndex) as NoteName;
			return { noteName, octave };
		};

		const currentSemitone = noteToSemitone(noteName, octave);
		const newSemitone = Math.max(0, Math.min(107, currentSemitone + delta));

		const { noteName: newNoteName, octave: newOctave } = semitoneToNote(newSemitone);
		return formatNoteFromEnum(newNoteName, newOctave);
	}

	static incrementNumericValue(
		currentValue: number,
		delta: number,
		fieldType: string,
		fieldLength?: number
	): number {
		let newValue = currentValue + delta;

		switch (fieldType) {
			case 'hex':
				if (fieldLength) {
					const maxValue = Math.pow(16, fieldLength) - 1;
					newValue = Math.max(0, Math.min(maxValue, newValue));
				} else {
					newValue = Math.max(0, Math.min(255, newValue));
				}
				break;
			case 'symbol':
				if (fieldLength) {
					const maxValue = Math.pow(36, fieldLength) - 1;
					newValue = Math.max(0, Math.min(maxValue, newValue)); // Skip -1 (OFF/"00"), start from 0
				} else {
					newValue = Math.max(0, newValue);
				}

				// Skip 0 value entirely - if result is 0, adjust based on direction
				if (newValue === 0) {
					newValue = delta > 0 ? 1 : 0; // For decrement, stay at 0 instead of going to -1
				}
				break;
			case 'dec':
				newValue = Math.max(0, newValue);
				break;
		}

		return newValue;
	}

	static computeIncrementValue(
		fieldInfo: FieldInfo,
		currentValue: string | number | null,
		delta: number,
		isOctaveIncrement: boolean,
		fieldDefinition: { length?: number; allowZeroValue?: boolean } | null,
		tuningTable?: number[],
		envelopeAsNote?: boolean
	): string | number | null {
		const adjustedDelta =
			fieldInfo.fieldType === 'note' && isOctaveIncrement ? delta * 12 : delta;

		if (fieldInfo.fieldType === 'note') {
			if (currentValue === null || currentValue === undefined || currentValue === '') {
				return null;
			}
			return PatternValueUpdates.incrementNoteValue(
				currentValue as string,
				adjustedDelta
			);
		}

		if (
			fieldInfo.fieldKey === 'envelopeValue' &&
			envelopeAsNote &&
			tuningTable &&
			(currentValue === null || currentValue === undefined || currentValue === '')
		) {
			return null;
		}
		if (
			fieldInfo.fieldKey === 'envelopeValue' &&
			envelopeAsNote &&
			tuningTable
		) {
			const currentPeriod = currentValue as number;
			const noteIndex = envelopePeriodToNote(currentPeriod, tuningTable);
			if (noteIndex === null) return null;
			const semitonesDelta = isOctaveIncrement ? delta * 12 : delta;
			const newNoteIndex = Math.max(
				0,
				Math.min(tuningTable.length - 1, noteIndex + semitonesDelta)
			);
			return noteToEnvelopePeriod(newNoteIndex, tuningTable);
		}

		if (
			(fieldInfo.fieldType === 'hex' ||
				fieldInfo.fieldType === 'dec' ||
				fieldInfo.fieldType === 'symbol') &&
			!EffectField.isEffectField(fieldInfo.fieldKey)
		) {
			if (
				PatternValueUpdates.isDisplayedAsEmpty(
					currentValue,
					fieldInfo.fieldType,
					fieldDefinition?.length ?? 1,
					fieldDefinition?.allowZeroValue
				)
			) {
				return null;
			}
			return PatternValueUpdates.incrementNumericValue(
				currentValue as number,
				delta,
				fieldInfo.fieldType,
				fieldDefinition?.length
			);
		}

		return null;
	}
}
