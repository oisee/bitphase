export const ROW_SELECTION_STYLES = {
	row: 'bg-[var(--color-app-primary)]/20',
	rowNumber: 'bg-[var(--color-app-primary)]/25',
	cell: 'bg-[var(--color-app-primary)]/15',
	input: 'bg-[var(--color-app-primary)]/10'
} as const;

export function isRowSelected(index: number, selectedRowIndices: number[]): boolean {
	return selectedRowIndices.includes(index);
}

export function computeSelectionFromClick(
	index: number,
	event: MouseEvent,
	currentSelection: number[],
	selectionAnchor: number | null
): { indices: number[]; anchor: number } {
	if (event.shiftKey) {
		const anchor = selectionAnchor ?? currentSelection[currentSelection.length - 1] ?? index;
		const start = Math.min(anchor, index);
		const end = Math.max(anchor, index);
		return {
			indices: Array.from({ length: end - start + 1 }, (_, i) => start + i),
			anchor
		};
	}
	if (event.metaKey || event.ctrlKey) {
		const set = new Set(currentSelection);
		if (set.has(index)) {
			set.delete(index);
		} else {
			set.add(index);
		}
		return {
			indices: [...set].sort((a, b) => a - b),
			anchor: index
		};
	}
	return { indices: [index], anchor: index };
}

export function filterValidSelection(
	selectedRowIndices: number[],
	rowCount: number
): number[] {
	return selectedRowIndices.filter((i) => i >= 0 && i < rowCount);
}
