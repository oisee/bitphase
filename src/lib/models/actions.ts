import type { Pattern, Song } from './song';

export interface CursorPosition {
	row: number;
	column: number;
	patternOrderIndex: number;
}

export interface Action {
	execute(): void;
	undo(): void;
	getCursorPosition(): CursorPosition;
}

export interface PatternEditContext {
	patterns: Pattern[];
	updatePatterns: (patterns: Pattern[]) => void;
	setCursor: (position: CursorPosition) => void;
}

export interface VirtualChannelEditContext extends PatternEditContext {
	song: Song;
	onVirtualChannelChange: () => void;
}

export class PatternEditAction implements Action {
	private oldPattern: Pattern;
	private newPattern: Pattern;
	private cursorPosition: CursorPosition;

	constructor(
		private context: PatternEditContext,
		oldPattern: Pattern,
		newPattern: Pattern,
		cursorPosition: CursorPosition
	) {
		this.oldPattern = this.deepClonePattern(oldPattern);
		this.newPattern = this.deepClonePattern(newPattern);
		this.cursorPosition = { ...cursorPosition };
	}

	execute(): void {
		this.replacePattern(this.newPattern);
		this.context.setCursor(this.cursorPosition);
	}

	undo(): void {
		this.replacePattern(this.oldPattern);
		this.context.setCursor(this.cursorPosition);
	}

	getCursorPosition(): CursorPosition {
		return { ...this.cursorPosition };
	}

	private replacePattern(pattern: Pattern): void {
		const newPatterns = this.context.patterns.map((p) =>
			p.id === pattern.id ? this.deepClonePattern(pattern) : p
		);
		this.context.updatePatterns(newPatterns);
	}

	private deepClonePattern(pattern: Pattern): Pattern {
		return JSON.parse(JSON.stringify(pattern));
	}
}

export const PatternFieldEditAction = PatternEditAction;
export const BulkPatternEditAction = PatternEditAction;

export class VirtualChannelAction implements Action {
	private oldPatterns: Pattern[];
	private newPatterns: Pattern[];
	private oldMap: Record<number, number>;
	private newMap: Record<number, number>;
	private cursorPosition: CursorPosition;

	constructor(
		private context: VirtualChannelEditContext,
		oldPatterns: Pattern[],
		newPatterns: Pattern[],
		oldMap: Record<number, number>,
		newMap: Record<number, number>,
		cursorPosition: CursorPosition
	) {
		this.oldPatterns = oldPatterns.map((p) => JSON.parse(JSON.stringify(p)));
		this.newPatterns = newPatterns.map((p) => JSON.parse(JSON.stringify(p)));
		this.oldMap = { ...oldMap };
		this.newMap = { ...newMap };
		this.cursorPosition = { ...cursorPosition };
	}

	execute(): void {
		this.apply(this.newMap, this.newPatterns);
	}

	undo(): void {
		this.apply(this.oldMap, this.oldPatterns);
	}

	getCursorPosition(): CursorPosition {
		return { ...this.cursorPosition };
	}

	private apply(map: Record<number, number>, patterns: Pattern[]): void {
		this.context.song.virtualChannelMap = { ...map };
		this.context.updatePatterns(patterns.map((p) => JSON.parse(JSON.stringify(p))));
		this.context.setCursor(this.cursorPosition);
		this.context.onVirtualChannelChange();
	}
}

