import type { Pattern } from '../../../models/song';
import { NoteName } from '../../../models/song';
import { formatNoteFromEnum, parseNoteFromString } from '../../../utils/note-utils';
import type { EditingContext, FieldInfo } from './editing-context';

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
		if (fieldInfo.isGlobal) {
			const patternRow = genericPattern.patternRows[context.selectedRow];
			return (patternRow[fieldInfo.fieldKey] as string | number | null) ?? null;
		} else {
			const channel = genericPattern.channels[fieldInfo.channelIndex];
			const row = channel.rows[context.selectedRow];
			return (row[fieldInfo.fieldKey] as string | number | null) ?? null;
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
}
