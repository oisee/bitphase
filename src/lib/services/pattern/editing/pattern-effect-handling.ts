import { formatHex } from '../../../chips/base/field-formatters';

export type EffectLikeObject = {
	effect: number;
	delay: number;
	parameter: number;
	tableIndex?: number;
};

export class PatternEffectHandling {
	static isEmptyEffect(effect: EffectLikeObject | null | undefined): boolean {
		if (!effect) return true;
		const noTable =
			effect.tableIndex === undefined || effect.tableIndex < 0;
		return (
			effect.effect === 0 &&
			(effect.delay ?? 0) === 0 &&
			(effect.parameter ?? 0) === 0 &&
			noTable
		);
	}

	static formatEffectAsString(
		effect:
			| { effect: number; delay: number; parameter: number; tableIndex?: number }
			| null
			| undefined
	): string {
		if (!effect) return '....';
		let type: string;
		if (effect.effect === 0) {
			type = '.';
		} else if (effect.effect === 'A'.charCodeAt(0)) {
			type = 'A';
		} else if (effect.effect === 'V'.charCodeAt(0)) {
			type = 'V';
		} else if (effect.effect === 'S'.charCodeAt(0)) {
			type = 'S';
		} else if (effect.effect === 'P'.charCodeAt(0)) {
			type = 'P';
		} else if (effect.effect === 'E'.charCodeAt(0)) {
			type = 'E';
		} else if (effect.effect >= 1 && effect.effect <= 15) {
			type = effect.effect.toString(16).toUpperCase();
		} else {
			type = effect.effect.toString(16).toUpperCase();
		}
		const delay = formatHex(effect.delay, 1);

		if (effect.tableIndex !== undefined) {
			const tableChar =
				effect.tableIndex < 0 ? '.' : this.tableIndexToChar(effect.tableIndex);
			return type + delay + 'T' + tableChar;
		}

		const param = formatHex(effect.parameter, 2);
		return type + delay + param;
	}

	static parseEffectFromString(value: string): {
		effect: number;
		delay: number;
		parameter: number;
		tableIndex?: number;
	} | null {
		let type: number;
		const typeChar = value[0] || '.';
		if (typeChar === '.') {
			type = 0;
		} else if (typeChar === 'A' || typeChar === 'a') {
			type = 'A'.charCodeAt(0);
		} else if (typeChar === 'V' || typeChar === 'v') {
			type = 'V'.charCodeAt(0);
		} else if (typeChar === 'S' || typeChar === 's') {
			type = 'S'.charCodeAt(0);
		} else if (typeChar === 'P' || typeChar === 'p') {
			type = 'P'.charCodeAt(0);
		} else if (typeChar === 'E' || typeChar === 'e') {
			type = 'E'.charCodeAt(0);
		} else {
			type = parseInt(typeChar, 16) || 0;
		}
		const delay = parseInt(value[1] || '0', 16) || 0;

		const char2 = value[2] || '.';
		if (char2 === 'T' || char2 === 't') {
			const tableChar = value[3] || '0';
			const tableIndex = this.charToTableIndex(tableChar);
			const result = { effect: type, delay, parameter: 0, tableIndex };
			return this.isEmptyEffect(result) ? null : result;
		}

		const param = parseInt((value.slice(2, 4) || '00').replace(/\./g, '0'), 16) || 0;
		const result = { effect: type, delay, parameter: param };
		return this.isEmptyEffect(result) ? null : result;
	}

	private static tableIndexToChar(index: number): string {
		if (index < 0) return '.';
		const displayNum = index + 1;
		if (displayNum < 10) return displayNum.toString();
		if (displayNum < 32) return String.fromCharCode('A'.charCodeAt(0) + displayNum - 10);
		return 'V';
	}

	private static charToTableIndex(char: string): number {
		const upper = char.toUpperCase();
		if (upper === '.' || upper === '0') return -1;
		const code = upper.charCodeAt(0);
		if (code >= '1'.charCodeAt(0) && code <= '9'.charCodeAt(0)) {
			return code - '0'.charCodeAt(0) - 1;
		}
		if (code >= 'A'.charCodeAt(0) && code <= 'V'.charCodeAt(0)) {
			return 10 + (code - 'A'.charCodeAt(0)) - 1;
		}
		return -1;
	}
}
