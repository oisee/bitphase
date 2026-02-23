export function computeGridRows(
	itemCount: number,
	availableHeight: number,
	rowHeight: number,
	buttonBarHeight: number
): number[][] {
	const visibleRows = Math.max(
		1,
		Math.floor((availableHeight - buttonBarHeight) / rowHeight)
	);
	const itemsPerRow = Math.ceil(itemCount / visibleRows);
	const rows: number[][] = [];
	for (let r = 0; r < visibleRows; r++) {
		const start = r * itemsPerRow;
		const end = Math.min(start + itemsPerRow, itemCount);
		if (start < itemCount) {
			rows.push(Array.from({ length: end - start }, (_, i) => start + i));
		}
	}
	return rows;
}
