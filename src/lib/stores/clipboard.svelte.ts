export interface ClipboardCell {
	row: number;
	column: number;
	fieldKey: string;
	fieldType: string;
	value: unknown;
}

export interface ClipboardData {
	cells: ClipboardCell[];
	minRow: number;
	minColumn: number;
	maxRow: number;
	maxColumn: number;
	rowCount: number;
	columnCount: number;
}

class ClipboardStore {
	clipboardData: ClipboardData | null = $state(null);

	get hasData(): boolean {
		return this.clipboardData !== null && this.clipboardData.cells.length > 0;
	}

	copy(
		cells: ClipboardCell[],
		minRow: number,
		minColumn: number,
		maxRow: number,
		maxColumn: number
	): void {
		this.clipboardData = {
			cells: cells.map((cell) => ({ ...cell })),
			minRow,
			minColumn,
			maxRow,
			maxColumn,
			rowCount: maxRow - minRow + 1,
			columnCount: maxColumn - minColumn + 1
		};
	}

	clear(): void {
		this.clipboardData = null;
	}
}

export const clipboardStore = new ClipboardStore();
